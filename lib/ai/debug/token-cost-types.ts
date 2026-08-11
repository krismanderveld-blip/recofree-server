/**
 * Token / Cost Clinical Debug Types
 * FASE 9G: Observability only — no clinical logic, no routing changes
 */

export type ModelTier = 'mini' | 'full' | 'unknown';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelPricing {
  model: string;
  tier: ModelTier;
  inputCostPer1MTokensUsd: number;
  outputCostPer1MTokensUsd: number;
  currency: 'USD';
  sourceLabel: string;
  requiresVerificationBeforeProduction: boolean;
}

export interface TokenCostEstimate {
  model: string;
  tier: ModelTier;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  pricingVerified: boolean;
  warning?: string | null;
}

export interface SessionTokenCostState {
  sessionId: string;
  startedAtLocal: string;
  messageCount: number;
  miniCalls: number;
  fullCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  lastModel: string | null;
  lastTier: ModelTier;
  lastReasonCodes: string[];
}

export interface DailyTokenCostState {
  localDayKey: string;
  messageCount: number;
  miniCalls: number;
  fullCalls: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
}
