import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  getGitHubUser,
  getGitHubUserEmail,
  checkOrgMembership,
} from "@/lib/auth/github";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  // Handle OAuth errors
  if (error) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/?error=oauth_error`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedStateRaw = cookieStore.get("oauth_state")?.value;

  if (!storedStateRaw) {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  let storedState: { state: string; returnTo: string };
  try {
    storedState = JSON.parse(storedStateRaw);
  } catch {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  if (storedState.state !== state) {
    return NextResponse.redirect(`${baseUrl}/?error=state_mismatch`);
  }

  // Clear the state cookie
  cookieStore.delete("oauth_state");

  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // Fetch user info from GitHub
    const githubUser = await getGitHubUser(accessToken);

    // Enforce org restriction if configured
    const isMember = await checkOrgMembership(accessToken);
    if (!isMember) {
      return NextResponse.redirect(`${baseUrl}/?error=org_not_allowed`);
    }

    const email = githubUser.email || (await getGitHubUserEmail(accessToken));

    // Account resolution: githubId → email (linking) → new user
    let userId: string;
    // Non-null when the resolved account was hidden (offboarded). A freshly
    // created account is never hidden.
    let hiddenAt: Date | null = null;

    // 1. Look up by GitHub ID
    const existingByGithubId = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubUser.id))
      .limit(1);

    if (existingByGithubId.length > 0) {
      userId = existingByGithubId[0].id;
      hiddenAt = existingByGithubId[0].hiddenAt;
      await db
        .update(users)
        .set({
          username: githubUser.login,
          displayName: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          email: email,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else if (email) {
      // 2. Look up by email (account linking with Google users)
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingByEmail.length > 0) {
        userId = existingByEmail[0].id;
        hiddenAt = existingByEmail[0].hiddenAt;
        await db
          .update(users)
          .set({
            githubId: githubUser.id,
            username: githubUser.login,
            displayName: githubUser.name,
            avatarUrl: githubUser.avatar_url,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      } else {
        // 3. Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            githubId: githubUser.id,
            username: githubUser.login,
            displayName: githubUser.name,
            avatarUrl: githubUser.avatar_url,
            email: email,
          })
          .returning({ id: users.id });

        userId = newUser.id;
      }
    } else {
      // No email available, create new user without linking
      const [newUser] = await db
        .insert(users)
        .values({
          githubId: githubUser.id,
          username: githubUser.login,
          displayName: githubUser.name,
          avatarUrl: githubUser.avatar_url,
          email: email,
        })
        .returning({ id: users.id });

      userId = newUser.id;
    }

    // An offboarded account must not be able to sign back in and mint a fresh
    // session or API token. Restoring access is a deliberate admin unhide.
    if (hiddenAt != null) {
      return NextResponse.redirect(`${baseUrl}/login?error=account_hidden`);
    }

    // Create session
    const sessionToken = await createSession(userId, {
      source: "web",
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Set session cookie
    await setSessionCookie(sessionToken);

    // Redirect to return URL
    const returnTo = storedState.returnTo || "/leaderboard";
    return NextResponse.redirect(`${baseUrl}${returnTo}`);
  } catch (err) {
    console.error("GitHub OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/leaderboard?error=auth_failed`);
  }
}
