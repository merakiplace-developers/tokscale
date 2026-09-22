import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { runAvatarProbe } from "@/lib/offboarding/avatarProbe";
import {
  normalizeUsernameCacheKey,
  revalidateUsernamePaths,
} from "@/lib/db/usernameLookup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled avatar probe (see vercel.json `crons`).
 *
 * Hides users whose Google avatar has been the "photo unavailable"
 * placeholder across two runs, and restores any it hid earlier whose avatar
 * came back. Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
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

  try {
    const summary = await runAvatarProbe();

    const changed = [...summary.hidden, ...summary.restored];

    for (const username of changed) {
      const usernameCacheKey = normalizeUsernameCacheKey(username);
      revalidateUsernamePaths(username);
      revalidateTag(`user:${usernameCacheKey}`, "max");
      revalidateTag(`user-rank:${usernameCacheKey}`, "max");
      revalidateTag(`embed-user:${usernameCacheKey}`, "max");
      revalidateTag(`embed-user:${usernameCacheKey}:tokens`, "max");
      revalidateTag(`embed-user:${usernameCacheKey}:cost`, "max");
    }

    if (changed.length > 0) {
      revalidateTag("leaderboard", "max");
      revalidateTag("user-rank", "max");
    }

    console.info("[avatar-probe] done", summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[avatar-probe] failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });

    return NextResponse.json({ error: "Probe failed" }, { status: 500 });
  }
}
