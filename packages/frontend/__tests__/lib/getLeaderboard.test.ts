import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const periodRows: Array<Record<string, unknown>> = [];
  const fromCalls: unknown[] = [];

  const tables = {
    users: {
      id: "users.id",
      username: "users.username",
      displayName: "users.displayName",
      avatarUrl: "users.avatarUrl",
    },
    submissions: {
      id: "submissions.id",
      userId: "submissions.userId",
      submitCount: "submissions.submitCount",
      updatedAt: "submissions.updatedAt",
      totalTokens: "submissions.totalTokens",
      totalCost: "submissions.totalCost",
      cliVersion: "submissions.cliVersion",
      schemaVersion: "submissions.schemaVersion",
    },
    dailyBreakdown: {
      submissionId: "dailyBreakdown.submissionId",
      date: "dailyBreakdown.date",
      tokens: "dailyBreakdown.tokens",
      cost: "dailyBreakdown.cost",
    },
  };

  const eq = vi.fn(() => "eq");
  const desc = vi.fn(() => "desc");
  const and = vi.fn(() => "and");
  const gte = vi.fn(() => "gte");
  const lte = vi.fn(() => "lte");
  const sql = Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
      as: () => ({}),
    })),
    {
      raw: vi.fn(),
    }
  );

  const db = {
    select: vi.fn(() => {
      const builder = {
        from: vi.fn((table: unknown) => {
          fromCalls.push(table);
          return builder;
        }),
        innerJoin: vi.fn(() => builder),
        where: vi.fn(async () => [...periodRows]),
        groupBy: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        offset: vi.fn(() => builder),
      };

      return builder;
    }),
  };

  return {
    db,
    tables,
    fromCalls,
    eq,
    desc,
    and,
    gte,
    lte,
    sql,
    reset() {
      periodRows.length = 0;
      fromCalls.length = 0;
      db.select.mockClear();
      eq.mockClear();
      desc.mockClear();
      and.mockClear();
      gte.mockClear();
      lte.mockClear();
      sql.mockClear();
      sql.raw.mockClear();
    },
    setPeriodRows(rows: Array<Record<string, unknown>>) {
      periodRows.length = 0;
      periodRows.push(...rows);
    },
  };
});

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/db", () => ({
  db: mockState.db,
  users: mockState.tables.users,
  submissions: mockState.tables.submissions,
  dailyBreakdown: mockState.tables.dailyBreakdown,
}));

vi.mock("@/lib/db/visibility", () => ({
  visibleUserCondition: () => "visibleUser",
  visibleUserSql: (alias: string) => `${alias}.hidden_at IS NULL`,
}));

vi.mock("@/lib/db/usernameLookup", () => {
  class AmbiguousUsernameError extends Error {}

  return {
    AmbiguousUsernameError,
    USERNAME_LOOKUP_LIMIT: 2,
    getSingleUsernameMatch: (rows: readonly unknown[], username: string) => {
      if (rows.length > 1) {
        throw new AmbiguousUsernameError(`Multiple users match username ${username} case-insensitively`);
      }
      return rows[0] ?? null;
    },
    normalizeUsernameCacheKey: (username: string) => username.toLowerCase(),
    usernameEqualsIgnoreCase: (username: string) =>
      mockState.sql`lower(${mockState.tables.users.username}) = ${username.toLowerCase()}`,
  };
});

vi.mock("@/lib/submissionFreshness", async () =>
  import("../../src/lib/submissionFreshness")
);

vi.mock("drizzle-orm", () => ({
  eq: mockState.eq,
  desc: mockState.desc,
  and: mockState.and,
  gte: mockState.gte,
  lte: mockState.lte,
  sql: mockState.sql,
}));

type ModuleExports = typeof import("../../src/lib/leaderboard/getLeaderboard");

let getLeaderboardData: ModuleExports["getLeaderboardData"];
let getUserRank: ModuleExports["getUserRank"];

beforeAll(async () => {
  const leaderboardModule = await import("../../src/lib/leaderboard/getLeaderboard");
  getLeaderboardData = leaderboardModule.getLeaderboardData;
  getUserRank = leaderboardModule.getUserRank;
});

beforeEach(() => {
  mockState.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("period leaderboard data", () => {
  const rows = [
    {
      userId: "user-alice",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      tokens: 100,
      cost: 1.25,
      updatedAt: "2026-03-07T11:00:00.000Z",
      cliVersion: "1.5.0",
      schemaVersion: 1,
    },
    {
      userId: "user-alice",
      username: "alice",
      displayName: "Alice",
      avatarUrl: null,
      tokens: 150,
      cost: 1.75,
      updatedAt: "2026-03-07T11:00:00.000Z",
      cliVersion: "1.5.0",
      schemaVersion: 1,
    },
    {
      userId: "user-bob",
      username: "bob",
      displayName: "Bob",
      avatarUrl: null,
      tokens: 1000,
      cost: 9.5,
      updatedAt: "2026-01-15T09:00:00.000Z",
      cliVersion: "1.3.0",
      schemaVersion: 0,
    },
  ];

  it("builds the week leaderboard from daily rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows(rows);

    const leaderboard = await getLeaderboardData("week", 1, 50, "tokens");

    expect(mockState.fromCalls[0]).toBe(mockState.tables.dailyBreakdown);
    expect(mockState.gte).toHaveBeenCalledWith(
      mockState.tables.dailyBreakdown.date,
      "2026-03-01"
    );
    expect(mockState.lte).toHaveBeenCalledWith(
      mockState.tables.dailyBreakdown.date,
      "2026-03-07"
    );
    expect(leaderboard.users).toHaveLength(2);
    expect(leaderboard.users[0]).toMatchObject({
      rank: 1,
      username: "bob",
      totalTokens: 1000,
      totalCost: 9.5,
      submissionFreshness: {
        lastUpdated: "2026-01-15T09:00:00.000Z",
        cliVersion: "1.3.0",
        schemaVersion: 0,
        isStale: true,
      },
    });
    expect(leaderboard.users[1]).toMatchObject({
      rank: 2,
      username: "alice",
      totalTokens: 250,
      totalCost: 3,
      submissionCount: null,
      submissionFreshness: {
        lastUpdated: "2026-03-07T11:00:00.000Z",
        cliVersion: "1.5.0",
        schemaVersion: 1,
        isStale: false,
      },
    });
    expect(leaderboard.stats).toMatchObject({
      totalTokens: 1250,
      totalCost: 12.5,
      totalSubmissions: null,
      uniqueUsers: 2,
    });
  });

  it("uses the current month for the month leaderboard range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows(rows);

    const leaderboard = await getLeaderboardData("month", 1, 50, "tokens");

    expect(mockState.fromCalls[0]).toBe(mockState.tables.dailyBreakdown);
    expect(mockState.gte).toHaveBeenCalledWith(
      mockState.tables.dailyBreakdown.date,
      "2026-03-01"
    );
    expect(mockState.lte).toHaveBeenCalledWith(
      mockState.tables.dailyBreakdown.date,
      "2026-03-07"
    );
    expect(leaderboard.users[1]).toMatchObject({
      username: "alice",
      totalTokens: 250,
      totalCost: 3,
    });
  });

  it("filters period leaderboards by username while preserving each user's true rank", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows(rows);

    const leaderboard = await getLeaderboardData("week", 1, 50, "tokens", "ali");

    expect(leaderboard.users).toHaveLength(1);
    expect(leaderboard.users[0]).toMatchObject({
      rank: 2,
      username: "alice",
      totalTokens: 250,
      totalCost: 3,
    });
    expect(leaderboard.pagination).toMatchObject({
      totalUsers: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(leaderboard.stats).toMatchObject({
      totalTokens: 1250,
      totalCost: 12.5,
      totalSubmissions: null,
      uniqueUsers: 2,
    });
  });

  it("uses the same daily totals when computing week rank", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows(rows);

    const rank = await getUserRank("alice", "week", "tokens");

    expect(mockState.fromCalls[0]).toBe(mockState.tables.dailyBreakdown);
    expect(rank).toMatchObject({
      rank: 2,
      username: "alice",
      totalTokens: 250,
      totalCost: 3,
      submissionCount: null,
      lastSubmission: "2026-03-07T11:00:00.000Z",
      submissionFreshness: {
        lastUpdated: "2026-03-07T11:00:00.000Z",
        cliVersion: "1.5.0",
        schemaVersion: 1,
        isStale: false,
      },
    });
  });

  it("matches period user rank usernames case-insensitively", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows(rows);

    const rank = await getUserRank("ALICE", "week", "tokens");

    expect(rank).toMatchObject({
      rank: 2,
      username: "alice",
      totalTokens: 250,
      totalCost: 3,
    });
  });

  it("rejects ambiguous case-insensitive period user rank matches", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
    mockState.setPeriodRows([
      ...rows,
      {
        userId: "user-alice-duplicate",
        username: "ALICE",
        displayName: "Alice Duplicate",
        avatarUrl: null,
        tokens: 50,
        cost: 0.5,
        updatedAt: "2026-03-07T11:00:00.000Z",
        cliVersion: "1.5.0",
        schemaVersion: 1,
      },
    ]);

    await expect(getUserRank("alice", "week", "tokens")).rejects.toThrow(
      "Multiple users match username alice case-insensitively"
    );
  });
});

describe("hidden users on the period leaderboard", () => {
  const visibleRow = {
    userId: "user-alice",
    username: "alice",
    displayName: "Alice",
    avatarUrl: null,
    tokens: 250,
    cost: 3,
    updatedAt: "2026-03-07T11:00:00.000Z",
    cliVersion: "1.5.0",
    schemaVersion: 1,
    hiddenAt: null,
  };

  const hiddenRow = {
    userId: "user-bob",
    username: "bob",
    displayName: "Bob",
    avatarUrl: null,
    tokens: 1000,
    cost: 9.5,
    updatedAt: "2026-03-06T09:00:00.000Z",
    cliVersion: "1.5.0",
    schemaVersion: 1,
    hiddenAt: new Date("2026-03-06T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T18:45:00Z"));
  });

  it("keeps hidden users out of the listing but inside the totals", async () => {
    mockState.setPeriodRows([visibleRow, hiddenRow]);

    const leaderboard = await getLeaderboardData("week", 1, 50, "tokens");

    expect(leaderboard.users.map((user) => user.username)).toEqual(["alice"]);
    // Org-wide usage must still account for work done by people who have left.
    expect(leaderboard.stats.totalTokens).toBe(1250);
    expect(leaderboard.stats.totalCost).toBe(12.5);
    expect(leaderboard.stats.uniqueUsers).toBe(2);
    expect(leaderboard.pagination.totalUsers).toBe(1);
  });

  it("closes the rank gap left by a hidden user", async () => {
    // bob outranks alice on tokens, so hiding him must promote her to rank 1
    // rather than leaving a hole at the top.
    mockState.setPeriodRows([visibleRow, hiddenRow]);

    const leaderboard = await getLeaderboardData("week", 1, 50, "tokens");

    expect(leaderboard.users[0]).toMatchObject({ username: "alice", rank: 1 });
  });

  it("does not leak the hidden flag to callers", async () => {
    mockState.setPeriodRows([visibleRow, hiddenRow]);

    const leaderboard = await getLeaderboardData("week", 1, 50, "tokens");

    expect(leaderboard.users[0]).not.toHaveProperty("hidden");
  });

  it("returns no rank for a hidden user", async () => {
    mockState.setPeriodRows([visibleRow, hiddenRow]);

    await expect(getUserRank("bob", "week", "tokens")).resolves.toBeNull();
  });

  it("still ranks visible users against visible users only", async () => {
    mockState.setPeriodRows([visibleRow, hiddenRow]);

    await expect(getUserRank("alice", "week", "tokens")).resolves.toMatchObject({
      username: "alice",
      rank: 1,
    });
  });
});
