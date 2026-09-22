import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const PROBE_REASON = "offboarded:avatar-placeholder";

const mockState = vi.hoisted(() => {
  const candidates: Array<Record<string, unknown>> = [];
  const updates: Array<{ values: Record<string, unknown>; ids: string[] }> = [];
  const hideCalls: Array<{ ids: string[]; reason: string }> = [];
  const unhideCalls: string[][] = [];

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [...candidates]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async (condition: { ids: string[] }) => {
          updates.push({ values, ids: condition.ids });
        }),
      })),
    })),
  };

  return {
    db,
    updates,
    hideCalls,
    unhideCalls,
    setCandidates(rows: Array<Record<string, unknown>>) {
      candidates.length = 0;
      candidates.push(...rows);
    },
    reset() {
      candidates.length = 0;
      updates.length = 0;
      hideCalls.length = 0;
      unhideCalls.length = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockState.db,
  users: {
    id: "users.id",
    username: "users.username",
    avatarUrl: "users.avatarUrl",
    hiddenAt: "users.hiddenAt",
    hiddenReason: "users.hiddenReason",
    avatarMissingSince: "users.avatarMissingSince",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq"),
  isNull: vi.fn(() => "isNull"),
  or: vi.fn(() => "or"),
  inArray: vi.fn((_column: unknown, ids: string[]) => ({ ids })),
}));

vi.mock("../../src/lib/offboarding/hideUsers", () => ({
  REASON_MANUAL: "offboarded",
  REASON_AVATAR_PLACEHOLDER: PROBE_REASON,
  hideUsers: vi.fn(async (ids: string[], reason: string) => {
    mockState.hideCalls.push({ ids, reason });
    return [];
  }),
  unhideUsers: vi.fn(async (ids: string[]) => {
    mockState.unhideCalls.push(ids);
    return [];
  }),
}));

type ModuleExports = typeof import("../../src/lib/offboarding/avatarProbe");

let probeAvatar: ModuleExports["probeAvatar"];
let isGoogleAvatarUrl: ModuleExports["isGoogleAvatarUrl"];
let runAvatarProbe: ModuleExports["runAvatarProbe"];
let GOOGLE_PLACEHOLDER_SHA256: ModuleExports["GOOGLE_PLACEHOLDER_SHA256"];

beforeAll(async () => {
  const probeModule = await import("../../src/lib/offboarding/avatarProbe");
  probeAvatar = probeModule.probeAvatar;
  isGoogleAvatarUrl = probeModule.isGoogleAvatarUrl;
  runAvatarProbe = probeModule.runAvatarProbe;
  GOOGLE_PLACEHOLDER_SHA256 = probeModule.GOOGLE_PLACEHOLDER_SHA256;
});

beforeEach(() => {
  mockState.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: Uint8Array | null, init: { ok?: boolean; status?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (body === null) {
        throw new Error("network down");
      }
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        arrayBuffer: async () =>
          body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      };
    })
  );
}

const PLACEHOLDER_BYTES = new Uint8Array(
  readFileSync(join(__dirname, "../fixtures/google-avatar-placeholder.png"))
);

describe("probeAvatar", () => {
  it("recognizes the Google 'photo unavailable' placeholder", async () => {
    stubFetch(PLACEHOLDER_BYTES);

    await expect(probeAvatar("https://lh3.googleusercontent.com/a/x")).resolves.toEqual({
      kind: "placeholder",
    });
  });

  it("pins the placeholder hash to the real image", () => {
    // Guards against the constant drifting away from the bytes Google serves.
    expect(GOOGLE_PLACEHOLDER_SHA256).toBe(
      "091c0e2fe196a438759d5014383ed0f659a13e1b557eb6fa776f4f27a82ed12f"
    );
  });

  it("treats any other payload as a real avatar", async () => {
    stubFetch(new Uint8Array([1, 2, 3, 4]));

    await expect(probeAvatar("https://lh3.googleusercontent.com/a/y")).resolves.toEqual({
      kind: "avatar",
    });
  });

  it("reports a non-200 as unknown rather than guessing", async () => {
    stubFetch(new Uint8Array([1]), { ok: false, status: 400 });

    await expect(probeAvatar("https://lh3.googleusercontent.com/a/z")).resolves.toMatchObject({
      kind: "unknown",
      detail: "http_400",
    });
  });

  it("reports a failed request as unknown", async () => {
    stubFetch(null);

    await expect(probeAvatar("https://lh3.googleusercontent.com/a/z")).resolves.toMatchObject({
      kind: "unknown",
    });
  });
});

describe("isGoogleAvatarUrl", () => {
  it("accepts Google-hosted avatars", () => {
    expect(isGoogleAvatarUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(true);
  });

  it("rejects avatars the signal says nothing about", () => {
    expect(isGoogleAvatarUrl("https://avatars.githubusercontent.com/u/1")).toBe(false);
    expect(isGoogleAvatarUrl(null)).toBe(false);
    expect(isGoogleAvatarUrl("not-a-url")).toBe(false);
    // Must not be fooled by a lookalike host.
    expect(isGoogleAvatarUrl("https://evilgoogleusercontent.com/a/x")).toBe(false);
  });
});

describe("runAvatarProbe", () => {
  const NOW = new Date("2026-09-22T03:17:00.000Z");
  const GOOGLE_URL = "https://lh3.googleusercontent.com/a/abc=s96-c";

  const visibleUser = {
    id: "user-1",
    username: "alice",
    avatarUrl: GOOGLE_URL,
    hiddenAt: null,
    hiddenReason: null,
    avatarMissingSince: null,
  };

  const always = (kind: "placeholder" | "avatar" | "unknown") => async () =>
    kind === "unknown"
      ? ({ kind, detail: "test" } as const)
      : ({ kind } as const);

  it("only records the first placeholder sighting", async () => {
    mockState.setCandidates([visibleUser]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("placeholder") });

    expect(summary.firstSeen).toEqual(["alice"]);
    expect(summary.hidden).toEqual([]);
    expect(mockState.hideCalls).toEqual([]);
    expect(mockState.updates).toEqual([
      { values: { avatarMissingSince: NOW }, ids: ["user-1"] },
    ]);
  });

  it("waits out the confirmation window before hiding", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        avatarMissingSince: new Date(NOW.getTime() - 60 * 60 * 1000),
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("placeholder") });

    expect(summary.hidden).toEqual([]);
    expect(mockState.hideCalls).toEqual([]);
  });

  it("hides once the placeholder is confirmed past the window", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        avatarMissingSince: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("placeholder") });

    expect(summary.hidden).toEqual(["alice"]);
    expect(mockState.hideCalls).toEqual([
      { ids: ["user-1"], reason: PROBE_REASON },
    ]);
  });

  it("clears the flag when a real avatar comes back", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        avatarMissingSince: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("avatar") });

    expect(summary.hidden).toEqual([]);
    expect(mockState.updates).toEqual([
      { values: { avatarMissingSince: null }, ids: ["user-1"] },
    ]);
  });

  it("restores a user it hid earlier when their avatar returns", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        hiddenAt: new Date("2026-09-01T00:00:00.000Z"),
        hiddenReason: PROBE_REASON,
        avatarMissingSince: new Date("2026-08-30T00:00:00.000Z"),
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("avatar") });

    expect(summary.restored).toEqual(["alice"]);
    expect(mockState.unhideCalls).toEqual([["user-1"]]);
  });

  it("never reverses a manual hide", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        hiddenAt: new Date("2026-09-01T00:00:00.000Z"),
        hiddenReason: "offboarded",
        avatarMissingSince: null,
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("avatar") });

    expect(summary.restored).toEqual([]);
    expect(mockState.unhideCalls).toEqual([]);
  });

  it("changes nothing when the probe cannot reach the avatar", async () => {
    mockState.setCandidates([
      {
        ...visibleUser,
        avatarMissingSince: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("unknown") });

    expect(summary.unreachable).toBe(1);
    expect(summary.hidden).toEqual([]);
    expect(mockState.hideCalls).toEqual([]);
    expect(mockState.updates).toEqual([]);
  });

  it("skips users whose avatar is not Google-hosted", async () => {
    mockState.setCandidates([
      { ...visibleUser, avatarUrl: "https://avatars.githubusercontent.com/u/1" },
      { ...visibleUser, id: "user-2", username: "bob", avatarUrl: null },
    ]);

    const summary = await runAvatarProbe({ now: NOW, probe: always("placeholder") });

    expect(summary.checked).toBe(0);
    expect(summary.skipped).toBe(2);
    expect(mockState.hideCalls).toEqual([]);
  });
});
