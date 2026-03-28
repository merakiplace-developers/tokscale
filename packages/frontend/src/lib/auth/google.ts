const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_ALLOWED_DOMAIN = process.env.GOOGLE_ALLOWED_DOMAIN || "";
const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
const GOOGLE_REDIRECT_URI = `${NEXT_PUBLIC_URL}/api/auth/google/callback`;

export interface GoogleUser {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  hd?: string;
}

/**
 * Get Google OAuth authorization URL.
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  if (GOOGLE_ALLOWED_DOMAIN) {
    params.set("hd", GOOGLE_ALLOWED_DOMAIN);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange authorization code for access token.
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Google OAuth error: ${data.error_description || data.error}`
    );
  }

  return data.access_token;
}

/**
 * Fetch user profile from Google.
 */
export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the allowed domain for Google Workspace restriction.
 */
export function getAllowedDomain(): string {
  return GOOGLE_ALLOWED_DOMAIN;
}
