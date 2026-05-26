/**
 * Server-side fix for the timezone bucketing problem fixed (partially) by PR #2
 * (CLI cap removal). The CLI emits `contribution.date` in the submitter's
 * local timezone (`chrono::Local`), so two clients sitting in different
 * timezones disagree on which day a midnight submission belongs to. The
 * fork's daily leaderboard is anchored to `LEADERBOARD_TIMEZONE`, which means
 * the CLI's local-date string is the wrong source of truth.
 *
 * When `LEADERBOARD_TIMEZONE` is set, this helper recomputes the bucket from
 * the earliest-message `timestampMs` (added upstream in PR #187) so every
 * submission lands on the same calendar day the leaderboard renders, no
 * matter where the submitting machine is. When the env var is unset (the
 * upstream default), we keep the CLI's value to preserve global-SaaS
 * semantics — each user sees their own local day.
 *
 * Legacy CLI (`schemaVersion = 0`) does not send `timestampMs`; that case
 * also falls back to the CLI string.
 */
export function normalizeContributionDate(
  rawDate: string,
  timestampMs: number | null,
  timezoneOverride: string | null,
): string {
  if (!timezoneOverride) return rawDate;
  if (timestampMs == null) return rawDate;
  return new Date(timestampMs).toLocaleDateString("en-CA", {
    timeZone: timezoneOverride,
  });
}
