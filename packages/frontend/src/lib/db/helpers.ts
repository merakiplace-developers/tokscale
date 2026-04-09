/**
 * Client-level merge helpers for submission API
 */

export interface ModelBreakdownData {
  tokens: number;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  messages: number;
}

export interface ClientBreakdownData {
  tokens: number;
  cost: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  messages: number;
  models: Record<string, ModelBreakdownData>;
  /** @deprecated Legacy field for backward compat - use models instead */
  modelId?: string;
}

export interface DayTotals {
  tokens: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

export function recalculateDayTotals(
  clientBreakdown: Record<string, ClientBreakdownData>
): DayTotals {
  let tokens = 0;
  let cost = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let reasoningTokens = 0;

  for (const client of Object.values(clientBreakdown)) {
    tokens += client.tokens || 0;
    cost += client.cost || 0;
    inputTokens += client.input || 0;
    outputTokens += client.output || 0;
    cacheReadTokens += client.cacheRead || 0;
    cacheWriteTokens += client.cacheWrite || 0;
    reasoningTokens += client.reasoning || 0;
  }

  return {
    tokens,
    cost,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
  };
}

export function mergeClientBreakdowns(
  existing: Record<string, ClientBreakdownData> | null | undefined,
  incoming: Record<string, ClientBreakdownData>,
  incomingClients: Set<string>
): Record<string, ClientBreakdownData> {
  const merged: Record<string, ClientBreakdownData> = { ...(existing || {}) };

  for (const clientName of incomingClients) {
    if (incoming[clientName]) {
      merged[clientName] = { ...incoming[clientName] };
    } else {
      delete merged[clientName];
    }
  }

  return merged;
}

export function buildModelBreakdown(
  clientBreakdown: Record<string, ClientBreakdownData>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const client of Object.values(clientBreakdown)) {
    if (client.models) {
      for (const [modelId, modelData] of Object.entries(client.models)) {
        result[modelId] = (result[modelId] || 0) + modelData.tokens;
      }
    } else if (client.modelId) {
      result[client.modelId] = (result[client.modelId] || 0) + client.tokens;
    }
  }

  return result;
}

export function clientContributionToBreakdownData(
  client_contrib: {
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning?: number };
    cost: number;
    modelId: string;
    messages: number;
  }
): ModelBreakdownData {
  const { input, output, cacheRead, cacheWrite, reasoning = 0 } = client_contrib.tokens;
  return {
    tokens: input + output + cacheRead + cacheWrite + reasoning,
    cost: client_contrib.cost,
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning,
    messages: client_contrib.messages,
  };
}

export type DeviceContributions = Record<string, Record<string, ClientBreakdownData>>;

/**
 * Initialize deviceContributions from a legacy daily_breakdown row
 * that has sourceBreakdown but no deviceContributions.
 *
 * Clients in submittedClients are excluded from __legacy__ to avoid
 * double-counting (the current device will provide authoritative data for those).
 */
export function initDeviceContributionsFromLegacy(
  existingSourceBreakdown: Record<string, ClientBreakdownData>,
  submittedClients: Set<string>,
): DeviceContributions {
  const legacySlot: Record<string, ClientBreakdownData> = {};
  for (const [clientName, clientData] of Object.entries(existingSourceBreakdown)) {
    if (!submittedClients.has(clientName)) {
      legacySlot[clientName] = clientData;
    }
  }

  if (Object.keys(legacySlot).length === 0) {
    return {};
  }
  return { __legacy__: legacySlot };
}

/**
 * Aggregate client data across all devices by summing per-client values.
 * Returns a sourceBreakdown-shaped object (same format as before).
 */
export function aggregateDeviceContributions(
  deviceContributions: DeviceContributions,
): Record<string, ClientBreakdownData> {
  const aggregated: Record<string, ClientBreakdownData> = {};

  for (const deviceSlot of Object.values(deviceContributions)) {
    for (const [clientName, clientData] of Object.entries(deviceSlot)) {
      const existing = aggregated[clientName];
      if (!existing) {
        aggregated[clientName] = {
          tokens: clientData.tokens || 0,
          cost: clientData.cost || 0,
          input: clientData.input || 0,
          output: clientData.output || 0,
          cacheRead: clientData.cacheRead || 0,
          cacheWrite: clientData.cacheWrite || 0,
          reasoning: clientData.reasoning || 0,
          messages: clientData.messages || 0,
          models: {},
        };
        if (clientData.models) {
          for (const [modelId, modelData] of Object.entries(clientData.models)) {
            aggregated[clientName].models[modelId] = { ...modelData };
          }
        }
      } else {
        existing.tokens += clientData.tokens || 0;
        existing.cost += clientData.cost || 0;
        existing.input += clientData.input || 0;
        existing.output += clientData.output || 0;
        existing.cacheRead += clientData.cacheRead || 0;
        existing.cacheWrite += clientData.cacheWrite || 0;
        existing.reasoning += clientData.reasoning || 0;
        existing.messages += clientData.messages || 0;

        if (clientData.models) {
          for (const [modelId, modelData] of Object.entries(clientData.models)) {
            const existingModel = existing.models[modelId];
            if (existingModel) {
              existingModel.tokens += modelData.tokens || 0;
              existingModel.cost += modelData.cost || 0;
              existingModel.input += modelData.input || 0;
              existingModel.output += modelData.output || 0;
              existingModel.cacheRead += modelData.cacheRead || 0;
              existingModel.cacheWrite += modelData.cacheWrite || 0;
              existingModel.reasoning += modelData.reasoning || 0;
              existingModel.messages += modelData.messages || 0;
            } else {
              existing.models[modelId] = { ...modelData };
            }
          }
        }
      }
    }
  }

  return aggregated;
}

/**
 * Merge two nullable timestamps, keeping the earliest non-null value.
 * Used by both submit and profile aggregation to maintain consistent merge semantics.
 */
export function mergeTimestampMs(
  existing: number | null | undefined,
  incoming: number | null | undefined,
): number | null {
  if (incoming != null && existing != null) return Math.min(existing, incoming);
  return incoming ?? existing ?? null;
}
