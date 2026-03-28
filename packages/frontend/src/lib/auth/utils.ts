import { randomBytes, createHash } from "crypto";

/**
 * Generate a cryptographically secure random string.
 */
export function generateRandomString(length: number): string {
  return randomBytes(length).toString("hex").slice(0, length);
}

/**
 * Generate a human-readable user code for device flow.
 * Format: XXXX-XXXX (uppercase alphanumeric, no ambiguous chars)
 */
export function generateUserCode(): string {
  // Exclude ambiguous characters: 0, O, I, L, 1
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(8);

  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += "-";
  }

  return code;
}

/**
 * Generate an API token with prefix.
 * Format: tt_<random>
 */
export function generateApiToken(): string {
  return `tt_${randomBytes(24).toString("hex")}`;
}

/**
 * Hash a token using SHA256 for secure storage comparison.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a device code (internal use, not shown to user).
 */
export function generateDeviceCode(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Derive a unique username from an email address.
 * Takes the local part, keeps only alphanumeric and hyphens,
 * truncates to 39 chars, and appends a random suffix if taken.
 */
export async function deriveUniqueUsername(email: string): Promise<string> {
  const { db, users } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");

  const localPart = email.split("@")[0] || "user";
  const base = localPart
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 39) || "user";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, base))
    .limit(1);

  if (!existing) {
    return base;
  }

  // Append random suffix until unique
  for (let i = 0; i < 10; i++) {
    const suffix = randomBytes(2).toString("hex");
    const candidate = `${base.slice(0, 34)}-${suffix}`;
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (!conflict) {
      return candidate;
    }
  }

  // Fallback: use full random
  return `user-${randomBytes(4).toString("hex")}`;
}
