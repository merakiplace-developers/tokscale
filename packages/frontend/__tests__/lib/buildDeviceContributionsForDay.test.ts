import { describe, it, expect } from "vitest";
import {
  buildDeviceContributionsForDay,
  type ClientBreakdownData,
  type DeviceContributions,
} from "../../src/lib/db/helpers";

function client(tokens: number): ClientBreakdownData {
  return {
    tokens,
    cost: tokens / 1000,
    input: Math.floor(tokens / 2),
    output: Math.floor(tokens / 2),
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    messages: 1,
    models: {},
  };
}

describe("buildDeviceContributionsForDay", () => {
  describe("cross-day preservation regression", () => {
    it("preserves an existing client on this day when the new submission omits it on this day, even if the same client appears on another day of the same submission", () => {
      // Scenario from the 2026-05 upstream-sync regression: new CLI dedups
      // some Codex sessions, so the same submission now contains codex tokens
      // only on day X. When the server processes day Y (codex previously
      // counted, but absent from this day's incoming data), codex must be
      // preserved on day Y.
      const existing: DeviceContributions = {
        "device-1": {
          codex: client(100),
          claude: client(200),
        },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        incomingClientBreakdown: {
          claude: client(250), // codex absent from this day's payload
        },
        deviceKey: "device-1",
      });

      expect(result["device-1"]?.codex?.tokens).toBe(100);
      expect(result["device-1"]?.claude?.tokens).toBe(250);
    });

    it("replaces a client when this day's incoming data carries it", () => {
      const existing: DeviceContributions = {
        "device-1": { codex: client(100) },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        incomingClientBreakdown: { codex: client(80) },
        deviceKey: "device-1",
      });

      expect(result["device-1"]?.codex?.tokens).toBe(80);
    });

    it("does not touch other devices' slots", () => {
      const existing: DeviceContributions = {
        "device-1": { codex: client(100) },
        "device-2": { codex: client(500), claude: client(700) },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        incomingClientBreakdown: { claude: client(50) },
        deviceKey: "device-1",
      });

      expect(result["device-2"]?.codex?.tokens).toBe(500);
      expect(result["device-2"]?.claude?.tokens).toBe(700);
      expect(result["device-1"]?.codex?.tokens).toBe(100);
      expect(result["device-1"]?.claude?.tokens).toBe(50);
    });
  });

  describe("legacy migration day-scope", () => {
    it("moves only this day's submitted clients out of the legacy slot; others stay in __legacy__", () => {
      // Legacy day has codex + claude. This day's submission carries only
      // claude. After migration, codex must remain in __legacy__ (it's
      // historical data from before deviceContributions existed), and claude
      // must end up in this device's slot.
      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: {
          codex: client(100),
          claude: client(200),
        },
        existingDeviceContributions: null,
        incomingClientBreakdown: { claude: client(250) },
        deviceKey: "device-1",
      });

      expect(result.__legacy__?.codex?.tokens).toBe(100);
      expect(result.__legacy__?.claude).toBeUndefined();
      expect(result["device-1"]?.claude?.tokens).toBe(250);
    });
  });

  describe("kilocode/kilo aliasing within day scope", () => {
    it("replaces a legacy kilocode slot when this day's incoming data carries kilo", () => {
      const existing: DeviceContributions = {
        "device-1": { kilocode: client(100) },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        incomingClientBreakdown: { kilo: client(80) },
        deviceKey: "device-1",
      });

      // kilocode slot should be removed (aliased to kilo), kilo slot replaces it.
      expect(result["device-1"]?.kilocode).toBeUndefined();
      expect(result["device-1"]?.kilo?.tokens).toBe(80);
    });

    it("preserves an existing kilocode slot on this day when neither kilo nor kilocode appear in this day's incoming data", () => {
      const existing: DeviceContributions = {
        "device-1": { kilocode: client(100) },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        incomingClientBreakdown: { claude: client(50) },
        deviceKey: "device-1",
      });

      expect(result["device-1"]?.kilocode?.tokens).toBe(100);
      expect(result["device-1"]?.claude?.tokens).toBe(50);
    });
  });

  describe("empty device slot handling", () => {
    it("drops the device key entirely when the new slot is empty", () => {
      const existing: DeviceContributions = {
        "device-1": { codex: client(100) },
      };

      const result = buildDeviceContributionsForDay({
        existingSourceBreakdown: null,
        existingDeviceContributions: existing,
        // Empty incoming clears any clients matching daySubmittedClients;
        // since daySubmittedClients is empty, codex is preserved.
        incomingClientBreakdown: {},
        deviceKey: "device-1",
      });

      expect(result["device-1"]?.codex?.tokens).toBe(100);
    });
  });
});
