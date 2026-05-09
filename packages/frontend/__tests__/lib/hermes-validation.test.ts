import { describe, it, expect } from "vitest";
import { validateSubmission } from "../../src/lib/validation/submission";

describe("hermes client validation regression", () => {
  it("accepts a submission containing the hermes client", () => {
    const data = {
      meta: {
        generatedAt: "2026-05-09T00:00:00.000Z",
        version: "2.1.0",
        dateRange: { start: "2026-05-01", end: "2026-05-09" },
      },
      summary: {
        totalTokens: 1000,
        totalCost: 0.5,
        totalDays: 1,
        activeDays: 1,
        averagePerDay: 0.5,
        maxCostInSingleDay: 0.5,
        clients: ["claude", "hermes"],
        models: ["claude-sonnet-4", "Hermes-3-405B-FP8"],
      },
      years: [
        {
          year: "2026",
          totalTokens: 1000,
          totalCost: 0.5,
          range: { start: "2026-05-01", end: "2026-05-09" },
        },
      ],
      contributions: [
        {
          date: "2026-05-09",
          totals: { tokens: 1000, cost: 0.5, messages: 5 },
          intensity: 2,
          tokenBreakdown: {
            input: 600,
            output: 400,
            cacheRead: 0,
            cacheWrite: 0,
            reasoning: 0,
          },
          clients: [
            {
              client: "claude",
              modelId: "claude-sonnet-4",
              tokens: {
                input: 400,
                output: 200,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0,
              },
              cost: 0.3,
              messages: 3,
            },
            {
              client: "hermes",
              modelId: "Hermes-3-405B-FP8",
              tokens: {
                input: 200,
                output: 200,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0,
              },
              cost: 0.2,
              messages: 2,
            },
          ],
        },
      ],
    };

    const result = validateSubmission(data);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.data?.summary.clients).toContain("hermes");
  });

  // Note: only clients present in SUPPORTED_SOURCES (Zod allowlist) are tested.
  // Upstream defines additional Rust ClientId variants (zed, antigravity, codebuff, goose)
  // that have not yet been added to the frontend submission allowlist.
  it.each([
    "copilot",
    "crush",
    "hermes",
  ])("accepts %s as a valid client", (clientName) => {
    const data = {
      meta: {
        generatedAt: "2026-05-09T00:00:00.000Z",
        version: "2.1.0",
        dateRange: { start: "2026-05-09", end: "2026-05-09" },
      },
      summary: {
        totalTokens: 100,
        totalCost: 0.05,
        totalDays: 1,
        activeDays: 1,
        averagePerDay: 0.05,
        maxCostInSingleDay: 0.05,
        clients: [clientName],
        models: ["model-x"],
      },
      years: [
        {
          year: "2026",
          totalTokens: 100,
          totalCost: 0.05,
          range: { start: "2026-05-09", end: "2026-05-09" },
        },
      ],
      contributions: [
        {
          date: "2026-05-09",
          totals: { tokens: 100, cost: 0.05, messages: 1 },
          intensity: 1,
          tokenBreakdown: {
            input: 60,
            output: 40,
            cacheRead: 0,
            cacheWrite: 0,
            reasoning: 0,
          },
          clients: [
            {
              client: clientName,
              modelId: "model-x",
              tokens: {
                input: 60,
                output: 40,
                cacheRead: 0,
                cacheWrite: 0,
                reasoning: 0,
              },
              cost: 0.05,
              messages: 1,
            },
          ],
        },
      ],
    };

    const result = validateSubmission(data);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
