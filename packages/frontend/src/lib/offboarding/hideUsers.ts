import { inArray, or, sql } from "drizzle-orm";
import { db, users, apiTokens, sessions } from "@/lib/db";
import { usernameLowerExpression } from "@/lib/db/usernameIndex";

/** Written to `users.hidden_reason` when an admin hides someone by hand. */
export const REASON_MANUAL = "offboarded";
/** Written when the avatar probe hides someone automatically. */
export const REASON_AVATAR_PLACEHOLDER = "offboarded:avatar-placeholder";

export interface OffboardingTarget {
  id: string;
  username: string;
  email: string | null;
  hiddenAt: Date | null;
  hiddenReason: string | null;
}

export interface ResolveResult {
  found: OffboardingTarget[];
  missing: string[];
}

const TARGET_COLUMNS = {
  id: users.id,
  username: users.username,
  email: users.email,
  hiddenAt: users.hiddenAt,
  hiddenReason: users.hiddenReason,
} as const;

/**
 * Resolve free-form identifiers — an email or a username, in any casing, with
 * a leading "@" tolerated — to user rows. Identifiers that match nothing are
 * returned separately so callers can report them instead of silently
 * hiding fewer people than asked.
 */
export async function resolveUsers(identifiers: string[]): Promise<ResolveResult> {
  const normalized = identifiers
    .map((value) => value.trim().replace(/^@/, "").toLowerCase())
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return { found: [], missing: [] };
  }

  const rows = await db
    .select(TARGET_COLUMNS)
    .from(users)
    .where(
      or(
        inArray(usernameLowerExpression(users.username), normalized),
        inArray(sql`lower(${users.email})`, normalized)
      )
    );

  const matched = new Set<string>();
  for (const row of rows) {
    matched.add(row.username.toLowerCase());
    if (row.email) {
      matched.add(row.email.toLowerCase());
    }
  }

  return {
    found: rows,
    missing: normalized.filter((value) => !matched.has(value)),
  };
}

export interface HideResult {
  userId: string;
  username: string;
  tokensDeleted: number;
  sessionsDeleted: number;
}

/**
 * Hide the given users and revoke their credentials in one transaction.
 *
 * Their rows and submissions are left alone: past usage still belongs in
 * org-wide totals, and re-hiring only needs the flag cleared. Deleting the
 * tokens is the part that actually stops a departed laptop from continuing to
 * submit — `authenticatePersonalToken` rejects hidden users as a second line
 * of defense.
 *
 * Already-hidden users are skipped so re-running never refreshes hidden_at.
 */
export async function hideUsers(
  userIds: string[],
  reason: string = REASON_MANUAL
): Promise<HideResult[]> {
  if (userIds.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    const targets = await tx
      .select(TARGET_COLUMNS)
      .from(users)
      .where(inArray(users.id, userIds));

    const pending = targets.filter((target) => target.hiddenAt == null);

    if (pending.length === 0) {
      return [];
    }

    const pendingIds = pending.map((target) => target.id);

    await tx
      .update(users)
      .set({ hiddenAt: new Date(), hiddenReason: reason, updatedAt: new Date() })
      .where(inArray(users.id, pendingIds));

    const deletedTokens = await tx
      .delete(apiTokens)
      .where(inArray(apiTokens.userId, pendingIds))
      .returning({ userId: apiTokens.userId });

    const deletedSessions = await tx
      .delete(sessions)
      .where(inArray(sessions.userId, pendingIds))
      .returning({ userId: sessions.userId });

    const countBy = (rows: Array<{ userId: string }>, userId: string) =>
      rows.filter((row) => row.userId === userId).length;

    return pending.map((target) => ({
      userId: target.id,
      username: target.username,
      tokensDeleted: countBy(deletedTokens, target.id),
      sessionsDeleted: countBy(deletedSessions, target.id),
    }));
  });
}

/**
 * Clear the hidden flag. Credentials are NOT restored — the deleted tokens are
 * gone for good and the user has to issue new ones.
 */
export async function unhideUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return [];
  }

  const restored = await db
    .update(users)
    .set({ hiddenAt: null, hiddenReason: null, updatedAt: new Date() })
    .where(inArray(users.id, userIds))
    .returning({ username: users.username });

  return restored.map((row) => row.username);
}
