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

// ─── PERSISTENCE TYPES (FASE 9H) ───

export interface PersistedTokenCostSessionState {
  schemaVersion: 'token_cost_session.v1';
  sessionId: string;
  localDayKey: string;
  startedAtLocal: string;
  updatedAtLocal: string;
  messageCount: number;
  miniCalls: number;
  fullCalls: number;
  unknownModelCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  lastModel: string | null;
  lastTier: ModelTier;
  lastReasonCodes: string[];
}

export interface PersistedTokenCostDailyState {
  schemaVersion: 'token_cost_daily.v1';
  localDayKey: string;
  updatedAtLocal: string;
  messageCount: number;
  miniCalls: number;
  fullCalls: number;
  unknownModelCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
}

export interface TokenCostPersistenceResult {
  ok: boolean;
  sessionState: PersistedTokenCostSessionState | null;
  dailyState: PersistedTokenCostDailyState | null;
  warnings: string[];
  errors: string[];
}

export interface RecordTokenCostInput {
  sessionId: string;
  localDayKey: string;
  estimate: TokenCostEstimate;
  reasonCodes: string[];
  nowLocal: string;
}

export interface ResetTokenCostInput {
  scope: 'session' | 'daily' | 'all';
  sessionId?: string;
  localDayKey?: string;
}
