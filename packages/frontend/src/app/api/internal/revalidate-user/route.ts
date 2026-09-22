import { NextResponse } from "next/server";
import { revalidateUserCaches } from "@/lib/offboarding/revalidateUserCaches";

export const dynamic = "force-dynamic";

/**
 * Drop the cached views of specific users.
 *
 * The offboarding script talks to the database directly and cannot call
 * Next's revalidation APIs, so it posts here after hiding someone. Shares
 * CRON_SECRET with the scheduled probe.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const usernames = Array.isArray(body?.usernames)
    ? body.usernames.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (usernames.length === 0) {
    return NextResponse.json(
      { error: "Body must be { usernames: string[] }" },
      { status: 400 }
    );
  }

  for (const username of usernames) {
    revalidateUserCaches(username);
  }

  return NextResponse.json({ revalidated: usernames });
}
