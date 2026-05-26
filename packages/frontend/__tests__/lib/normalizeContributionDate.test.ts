import { describe, it, expect } from "vitest";
import { normalizeContributionDate } from "../../src/lib/leaderboard/normalizeContributionDate";

describe("normalizeContributionDate", () => {
  it("returns the CLI date unchanged when no LEADERBOARD_TIMEZONE override is configured", () => {
    // Default upstream/global-SaaS behavior — each user keeps their local day.
    const tsKstMidnightThirty = Date.UTC(2026, 4, 25, 15, 30);
    expect(normalizeContributionDate("2026-05-26", tsKstMidnightThirty, null)).toBe(
      "2026-05-26",
    );
  });

  it("returns the CLI date unchanged for legacy CLI submissions without timestampMs", () => {
    // schemaVersion=0 callers don't send timestampMs; we have no signal to
    // recompute, so trust the CLI string regardless of the override.
    expect(normalizeContributionDate("2026-05-26", null, "Asia/Seoul")).toBe(
      "2026-05-26",
    );
  });

  it("keeps a KST-machine submission on its KST date when UTC is still the previous day", () => {
    // 2026-05-26T00:30:00+09:00 = 2026-05-25T15:30:00Z. Without R2 the
    // daily-breakdown bucket would land on UTC 2026-05-25 and the KST
    // "Today" leaderboard would not see it until 09:00 KST. This is the
    // exact case PR #2 surfaced.
    const kst0030 = Date.UTC(2026, 4, 25, 15, 30);
    expect(normalizeContributionDate("2026-05-26", kst0030, "Asia/Seoul")).toBe(
      "2026-05-26",
    );
  });

  it("overrides a non-KST CLI date when the timestamp falls on a different KST day", () => {
    // 2026-05-25T17:30:00-07:00 (Pacific) = 2026-05-26T00:30:00Z =
    // 2026-05-26T09:30:00+09:00. A US team member submitting at the very
    // end of their day in Pacific must still land on KST 2026-05-26 so
    // the KST daily leaderboard sees a single, agreed-upon day.
    const pacificTimestamp = Date.UTC(2026, 4, 26, 0, 30);
    expect(
      normalizeContributionDate("2026-05-25", pacificTimestamp, "Asia/Seoul"),
    ).toBe("2026-05-26");
  });

  it("returns a strict YYYY-MM-DD format usable as a daily_breakdown.date primary lookup key", () => {
    const ts = Date.UTC(2026, 0, 1, 0, 0);
    const result = normalizeContributionDate("2026-01-01", ts, "UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe("2026-01-01");
  });
});
