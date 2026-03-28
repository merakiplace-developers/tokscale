const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_ALLOWED_ORG = process.env.GITHUB_ALLOWED_ORG || "";
const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
const GITHUB_REDIRECT_URI = `${NEXT_PUBLIC_URL}/api/auth/github/callback`;

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

/**
 * Get GitHub OAuth authorization URL.
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: GITHUB_ALLOWED_ORG
      ? "read:user user:email read:org"
      : "read:user user:email",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Exchange authorization code for access token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `GitHub OAuth error: ${data.error_description || data.error}`
    );
  }

  return data.access_token;
}

/**
 * Fetch user profile from GitHub API.
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch user's primary email from GitHub API.
 */
export async function getGitHubUserEmail(
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const emails: Array<{ email: string; primary: boolean; verified: boolean }> =
      await response.json();

    const primaryEmail = emails.find((e) => e.primary && e.verified);
    return primaryEmail?.email || null;
  } catch {
    return null;
  }
}

/**
 * Check if the user belongs to the allowed GitHub organization.
 * Returns true if no org restriction is configured.
 */
export async function checkOrgMembership(
  accessToken: string
): Promise<boolean> {
  if (!GITHUB_ALLOWED_ORG) {
    return true;
  }

  try {
    const response = await fetch("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return false;
    }

    const orgs: Array<{ login: string }> = await response.json();
    return orgs.some(
      (org) => org.login.toLowerCase() === GITHUB_ALLOWED_ORG.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Get the allowed organization name.
 */
export function getAllowedOrg(): string {
  return GITHUB_ALLOWED_ORG;
}
