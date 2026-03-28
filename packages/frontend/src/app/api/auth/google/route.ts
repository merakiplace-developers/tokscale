import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorizationUrl } from "@/lib/auth/google";
import { generateRandomString } from "@/lib/auth/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") || "/leaderboard";

  const state = generateRandomString(32);

  const cookieStore = await cookies();
  cookieStore.set(
    "oauth_state",
    JSON.stringify({ state, returnTo }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    }
  );

  return NextResponse.redirect(getAuthorizationUrl(state));
}
