import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForToken,
  getGoogleUser,
  getAllowedDomain,
} from "@/lib/auth/google";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { deriveUniqueUsername } from "@/lib/auth/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  if (error) {
    console.error("Google OAuth error:", error);
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

  cookieStore.delete("oauth_state");

  try {
    const accessToken = await exchangeCodeForToken(code);
    const googleUser = await getGoogleUser(accessToken);

    // Require verified email
    if (!googleUser.email_verified) {
      return NextResponse.redirect(`${baseUrl}/?error=email_not_verified`);
    }

    // Enforce domain restriction if configured
    const allowedDomain = getAllowedDomain();
    if (allowedDomain && googleUser.hd !== allowedDomain) {
      return NextResponse.redirect(`${baseUrl}/?error=domain_not_allowed`);
    }

    // Account resolution: googleId → email → new user
    let userId: string;

    // 1. Look up by Google ID
    const existingByGoogleId = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleUser.sub))
      .limit(1);

    if (existingByGoogleId.length > 0) {
      userId = existingByGoogleId[0].id;
      await db
        .update(users)
        .set({
          displayName: googleUser.name,
          avatarUrl: googleUser.picture,
          email: googleUser.email,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      // 2. Look up by email (account linking)
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email))
        .limit(1);

      if (existingByEmail.length > 0) {
        userId = existingByEmail[0].id;
        await db
          .update(users)
          .set({
            googleId: googleUser.sub,
            displayName: googleUser.name,
            avatarUrl: googleUser.picture,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      } else {
        // 3. Create new user
        const username = await deriveUniqueUsername(googleUser.email);
        const [newUser] = await db
          .insert(users)
          .values({
            googleId: googleUser.sub,
            username,
            displayName: googleUser.name,
            avatarUrl: googleUser.picture,
            email: googleUser.email,
          })
          .returning({ id: users.id });

        userId = newUser.id;
      }
    }

    const sessionToken = await createSession(userId, {
      source: "web",
      userAgent: request.headers.get("user-agent") || undefined,
    });

    await setSessionCookie(sessionToken);

    const returnTo = storedState.returnTo || "/leaderboard";
    return NextResponse.redirect(`${baseUrl}${returnTo}`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/leaderboard?error=auth_failed`);
  }
}
