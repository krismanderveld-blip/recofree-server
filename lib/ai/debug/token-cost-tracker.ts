/**
 * Token / Cost Clinical Debug Tracker
 * FASE 9G: Pure functions for cost estimation and session/daily accumulation
 * No clinical logic. No routing changes. No raw data storage.
 */

import type {
  ModelTier,
  TokenUsage,
  TokenCostEstimate,
  SessionTokenCostState,
  DailyTokenCostState,
} from './token-cost-types';
import { getModelPricing } from './model-price-config';

// ─── FUNCTION 1: getModelTierFromModel ───
export function getModelTierFromModel(model: string): ModelTier {
  if (model === 'gpt-4o-mini') return 'mini';
  if (model === 'gpt-4o-2024-08-06') return 'full';
  if (model === 'gpt-4o') return 'full';
  return 'unknown';
}

// ─── FUNCTION 2: estimateTokenCost ───
export function estimateTokenCost(input: {
  model: string;
  tier: ModelTier;
  usage: TokenUsage;
}): TokenCostEstimate {
  const promptTokens = Math.max(0, input.usage.promptTokens || 0);
  const completionTokens = Math.max(0, input.usage.completionTokens || 0);
  const totalTokens = promptTokens + completionTokens;

  const pricing = getModelPricing(input.model);

  if (!pricing) {
    return {
      model: input.model,
      tier: input.tier,
      promptTokens,
      completionTokens,
      totalTokens,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
      pricingVerified: false,
      warning: `Unknown model: ${input.model}. Cost cannot be estimated.`,
    };
  }

  const inputCostUsd = parseFloat(((promptTokens / 1_000_000) * pricing.inputCostPer1MTokensUsd).toFixed(6));
  const outputCostUsd = parseFloat(((completionTokens / 1_000_000) * pricing.outputCostPer1MTokensUsd).toFixed(6));
  const totalCostUsd = parseFloat((inputCostUsd + outputCostUsd).toFixed(6));

  return {
    model: input.model,
    tier: input.tier,
    promptTokens,
    completionTokens,
    totalTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    pricingVerified: !pricing.requiresVerificationBeforeProduction,
    warning: pricing.requiresVerificationBeforeProduction
      ? 'Pricing requires verification before production'
      : null,
  };
}

// ─── FUNCTION 3: updateSessionTokenCostState ───
export function updateSessionTokenCostState(
  state: SessionTokenCostState,
  estimate: TokenCostEstimate,
  reasonCodes: string[],
): SessionTokenCostState {
  return {
    ...state,
    messageCount: state.messageCount + 1,
    miniCalls: state.miniCalls + (estimate.tier === 'mini' ? 1 : 0),
    fullCalls: state.fullCalls + (estimate.tier === 'full' ? 1 : 0),
    totalPromptTokens: state.totalPromptTokens + estimate.promptTokens,
    totalCompletionTokens: state.totalCompletionTokens + estimate.completionTokens,
    totalTokens: state.totalTokens + estimate.totalTokens,
    totalEstimatedCostUsd: parseFloat((state.totalEstimatedCostUsd + estimate.totalCostUsd).toFixed(6)),
    lastModel: estimate.model,
    lastTier: estimate.tier,
    lastReasonCodes: reasonCodes,
  };
}

// ─── FUNCTION 4: updateDailyTokenCostState ───
export function updateDailyTokenCostState(
  state: DailyTokenCostState,
  estimate: TokenCostEstimate,
): DailyTokenCostState {
  return {
    ...state,
    messageCount: state.messageCount + 1,
    miniCalls: state.miniCalls + (estimate.tier === 'mini' ? 1 : 0),
    fullCalls: state.fullCalls + (estimate.tier === 'full' ? 1 : 0),
    totalTokens: state.totalTokens + estimate.totalTokens,
    totalEstimatedCostUsd: parseFloat((state.totalEstimatedCostUsd + estimate.totalCostUsd).toFixed(6)),
  };
}

// ─── FUNCTION 5: buildTokenCostDebugLine ───
export function buildTokenCostDebugLine(input: {
  estimate: TokenCostEstimate | null;
  sessionState: SessionTokenCostState | null;
  dailyState: DailyTokenCostState | null;
}): string {
  if (!input.estimate) {
    return 'Cost: msg=unknown | tokens=unknown | pricing=unavailable';
  }

  const msgCost = input.estimate.totalCostUsd > 0
    ? `$${input.estimate.totalCostUsd.toFixed(6)}`
    : 'unknown';

  const sessionCost = input.sessionState
    ? `$${input.sessionState.totalEstimatedCostUsd.toFixed(6)}`
    : 'n/a';

  const dayCost = input.dailyState
    ? `$${input.dailyState.totalEstimatedCostUsd.toFixed(6)}`
    : 'n/a';

  const tokens = `${input.estimate.promptTokens}/${input.estimate.completionTokens}/${input.estimate.totalTokens}`;

  const pricingNote = input.estimate.pricingVerified ? '' : ' | pricing=verify';

  return `Cost: msg=${msgCost} | session=${sessionCost} | day=${dayCost} | tokens=${tokens}${pricingNote}`;
}

// ─── FUNCTION 6: buildModelDebugLine ───
export function buildModelDebugLine(input: {
  flag: boolean;
  tier: ModelTier;
  model: string;
  score?: number;
  reasonCodes?: string[];
}): string {
  const reasons = input.reasonCodes?.join(',') || 'none';
  const score = input.score ?? 0;
  return `ModelRoute: flag=${input.flag} tier=${input.tier} model=${input.model} score=${score} reason=${reasons}`;
}

// ─── FUNCTION 7: createInitialSessionState ───
export function createInitialSessionState(sessionId: string): SessionTokenCostState {
  return {
    sessionId,
    startedAtLocal: new Date().toISOString(),
    messageCount: 0,
    miniCalls: 0,
    fullCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalEstimatedCostUsd: 0,
    lastModel: null,
    lastTier: 'unknown',
    lastReasonCodes: [],
  };
}

// ─── FUNCTION 8: createInitialDailyState ───
export function createInitialDailyState(localDayKey: string): DailyTokenCostState {
  return {
    localDayKey,
    messageCount: 0,
    miniCalls: 0,
    fullCalls: 0,
    totalTokens: 0,
    totalEstimatedCostUsd: 0,
  };
}

