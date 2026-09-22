import { createHash } from "node:crypto";
import { eq, inArray, isNull, or } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { REASON_AVATAR_PLACEHOLDER, hideUsers, unhideUsers } from "./hideUsers";

/**
 * SHA-256 of the grayscale "photo unavailable" PNG that
 * lh3.googleusercontent.com serves once a Google Workspace account is gone.
 * Every deleted account gets byte-identical content, and a malformed photo id
 * answers HTTP 400 instead — so a 200 carrying exactly these bytes means the
 * photo reference is valid but the account behind it no longer has one.
 *
 * If Google ever changes that image this stops matching and the probe simply
 * stops hiding anyone, which is the safe direction to fail in.
 */
export const GOOGLE_PLACEHOLDER_SHA256 =
  "091c0e2fe196a438759d5014383ed0f659a13e1b557eb6fa776f4f27a82ed12f";

/** Wait this long after the first sighting before hiding, so one bad run cannot hide anyone. */
export const DEFAULT_CONFIRM_AFTER_MS = 20 * 60 * 60 * 1000;

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_CONCURRENCY = 5;

export type ProbeOutcome =
  | { kind: "placeholder" }
  | { kind: "avatar" }
  | { kind: "unknown"; detail: string };

export async function probeAvatar(url: string): Promise<ProbeOutcome> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { kind: "unknown", detail: `http_${response.status}` };
    }

    const digest = createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");

    return digest === GOOGLE_PLACEHOLDER_SHA256
      ? { kind: "placeholder" }
      : { kind: "avatar" };
  } catch (error) {
    return {
      kind: "unknown",
      detail: error instanceof Error ? error.message : "probe_failed",
    };
  }
}

/**
 * Only Google-hosted avatars carry this signal. A GitHub avatar URL means
 * nothing about Workspace membership, so those users are left alone.
 */
export function isGoogleAvatarUrl(url: string | null): url is string {
  if (!url) {
    return false;
  }

  try {
    const { hostname } = new URL(url);
    return (
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]);
      }
    }
  );

  await Promise.all(workers);
  return results;
}

export interface AvatarProbeSummary {
  checked: number;
  /** Users skipped because they have no Google-hosted avatar. */
  skipped: number;
  /** Probes that failed or answered non-200; deliberately no state change. */
  unreachable: number;
  /** Placeholder seen for the first time — recorded, not yet acted on. */
  firstSeen: string[];
  /** Placeholder confirmed past the window — hidden this run. */
  hidden: string[];
  /** Real avatar came back for a probe-hidden user — unhidden this run. */
  restored: string[];
}

/**
 * Probe avatars and reconcile the hidden flag.
 *
 * Only users that are visible, or that this probe hid earlier, are considered:
 * a manual hide is an explicit decision and is never undone automatically.
 * Restoring probe-hidden users when their avatar returns is what bounds the
 * damage of a false positive.
 */
export async function runAvatarProbe(
  options: { confirmAfterMs?: number; now?: Date } = {}
): Promise<AvatarProbeSummary> {
  const confirmAfterMs = options.confirmAfterMs ?? DEFAULT_CONFIRM_AFTER_MS;
  const now = options.now ?? new Date();

  const candidates = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      hiddenAt: users.hiddenAt,
      hiddenReason: users.hiddenReason,
      avatarMissingSince: users.avatarMissingSince,
    })
    .from(users)
    .where(
      or(isNull(users.hiddenAt), eq(users.hiddenReason, REASON_AVATAR_PLACEHOLDER))
    );

  const probeable = candidates.filter((user) => isGoogleAvatarUrl(user.avatarUrl));

  const outcomes = await mapWithConcurrency(probeable, PROBE_CONCURRENCY, (user) =>
    probeAvatar(user.avatarUrl as string)
  );

  const summary: AvatarProbeSummary = {
    checked: probeable.length,
    skipped: candidates.length - probeable.length,
    unreachable: 0,
    firstSeen: [],
    hidden: [],
    restored: [],
  };

  const markMissing: string[] = [];
  const clearMissing: string[] = [];
  const toHide: string[] = [];
  const toRestore: string[] = [];

  probeable.forEach((user, index) => {
    const outcome = outcomes[index];
    const hiddenByProbe =
      user.hiddenAt != null && user.hiddenReason === REASON_AVATAR_PLACEHOLDER;

    if (outcome.kind === "unknown") {
      summary.unreachable++;
      return;
    }

    if (outcome.kind === "avatar") {
      if (hiddenByProbe) {
        toRestore.push(user.id);
        summary.restored.push(user.username);
      }
      if (user.avatarMissingSince != null) {
        clearMissing.push(user.id);
      }
      return;
    }

    // Placeholder.
    if (hiddenByProbe) {
      return;
    }

    if (user.avatarMissingSince == null) {
      markMissing.push(user.id);
      summary.firstSeen.push(user.username);
      return;
    }

    if (now.getTime() - user.avatarMissingSince.getTime() >= confirmAfterMs) {
      toHide.push(user.id);
      summary.hidden.push(user.username);
    }
  });

  if (markMissing.length > 0) {
    await db
      .update(users)
      .set({ avatarMissingSince: now })
      .where(inArray(users.id, markMissing));
  }

  if (toRestore.length > 0) {
    await unhideUsers(toRestore);
    clearMissing.push(...toRestore);
  }

  if (clearMissing.length > 0) {
    await db
      .update(users)
      .set({ avatarMissingSince: null })
      .where(inArray(users.id, clearMissing));
  }

  if (toHide.length > 0) {
    await hideUsers(toHide, REASON_AVATAR_PLACEHOLDER);
  }

  return summary;
}
