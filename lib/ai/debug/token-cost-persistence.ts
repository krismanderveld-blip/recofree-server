/**
 * Token Cost Persistence Service
 * FASE 9H: Local AsyncStorage persistence for session/daily cost tracking
 *
 * PRIVACY: Only technical counters are stored.
 * NEVER stores: raw prompts, messages, responses, backpack, DIST01, CMD, user.dat, persoonsgegevens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PersistedTokenCostSessionState,
  PersistedTokenCostDailyState,
  TokenCostPersistenceResult,
  TokenCostEstimate,
  RecordTokenCostInput,
  ResetTokenCostInput,
  ModelTier,
} from './token-cost-types';

// ─── STORAGE KEYS ───
const SESSION_KEY = 'recofree_debug_token_cost_session_v1';
const DAILY_KEY = 'recofree_debug_token_cost_daily_v1';

// ─── HELPERS ───

function createEmptySessionState(sessionId: string, localDayKey: string, nowLocal: string): PersistedTokenCostSessionState {
  return {
    schemaVersion: 'token_cost_session.v1',
    sessionId,
    localDayKey,
    startedAtLocal: nowLocal,
    updatedAtLocal: nowLocal,
    messageCount: 0,
    miniCalls: 0,
    fullCalls: 0,
    unknownModelCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalEstimatedCostUsd: 0,
    lastModel: null,
    lastTier: 'unknown',
    lastReasonCodes: [],
  };
}

function createEmptyDailyState(localDayKey: string, nowLocal: string): PersistedTokenCostDailyState {
  return {
    schemaVersion: 'token_cost_daily.v1',
    localDayKey,
    updatedAtLocal: nowLocal,
    messageCount: 0,
    miniCalls: 0,
    fullCalls: 0,
    unknownModelCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalEstimatedCostUsd: 0,
  };
}

function isValidSessionState(data: any): data is PersistedTokenCostSessionState {
  return data && data.schemaVersion === 'token_cost_session.v1' && typeof data.sessionId === 'string' && typeof data.messageCount === 'number';
}

function isValidDailyState(data: any): data is PersistedTokenCostDailyState {
  return data && data.schemaVersion === 'token_cost_daily.v1' && typeof data.localDayKey === 'string' && typeof data.messageCount === 'number';
}

// ─── PUBLIC FUNCTIONS ───

/**
 * 1. loadTokenCostSessionState
 */
export async function loadTokenCostSessionState(sessionId: string, localDayKey: string): Promise<{ state: PersistedTokenCostSessionState; warning?: string }> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return { state: createEmptySessionState(sessionId, localDayKey, new Date().toISOString()) };
    const parsed = JSON.parse(raw);
    if (!isValidSessionState(parsed)) {
      return { state: createEmptySessionState(sessionId, localDayKey, new Date().toISOString()), warning: 'corrupt_session_state_reset' };
    }
    if (parsed.sessionId !== sessionId) {
      return { state: createEmptySessionState(sessionId, localDayKey, new Date().toISOString()) };
    }
    return { state: parsed };
  } catch {
    return { state: createEmptySessionState(sessionId, localDayKey, new Date().toISOString()), warning: 'storage_read_error_session' };
  }
}

/**
 * 2. saveTokenCostSessionState
 */
export async function saveTokenCostSessionState(state: PersistedTokenCostSessionState): Promise<{ ok: boolean; error?: string }> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `storage_write_error_session: ${e?.message ?? 'unknown'}` };
  }
}

/**
 * 3. loadTokenCostDailyState
 */
export async function loadTokenCostDailyState(localDayKey: string): Promise<{ state: PersistedTokenCostDailyState; warning?: string }> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_KEY);
    if (!raw) return { state: createEmptyDailyState(localDayKey, new Date().toISOString()) };
    const parsed = JSON.parse(raw);
    if (!isValidDailyState(parsed)) {
      return { state: createEmptyDailyState(localDayKey, new Date().toISOString()), warning: 'corrupt_daily_state_reset' };
    }
    if (parsed.localDayKey !== localDayKey) {
      return { state: createEmptyDailyState(localDayKey, new Date().toISOString()), warning: 'day_mismatch_new_day' };
    }
    return { state: parsed };
  } catch {
    return { state: createEmptyDailyState(localDayKey, new Date().toISOString()), warning: 'storage_read_error_daily' };
  }
}

/**
 * 4. saveTokenCostDailyState
 */
export async function saveTokenCostDailyState(state: PersistedTokenCostDailyState): Promise<{ ok: boolean; error?: string }> {
  try {
    await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `storage_write_error_daily: ${e?.message ?? 'unknown'}` };
  }
}

/**
 * 5. recordTokenCostEstimate — main entry point for pipeline
 */
export async function recordTokenCostEstimate(input: RecordTokenCostInput): Promise<TokenCostPersistenceResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Load session
  const sessionLoad = await loadTokenCostSessionState(input.sessionId, input.localDayKey);
  if (sessionLoad.warning) warnings.push(sessionLoad.warning);
  let sessionState = sessionLoad.state;

  // Load daily
  const dailyLoad = await loadTokenCostDailyState(input.localDayKey);
  if (dailyLoad.warning) warnings.push(dailyLoad.warning);
  let dailyState = dailyLoad.state;

  // Update session
  const tier: ModelTier = input.estimate.tier;
  sessionState = {
    ...sessionState,
    updatedAtLocal: input.nowLocal,
    messageCount: sessionState.messageCount + 1,
    miniCalls: sessionState.miniCalls + (tier === 'mini' ? 1 : 0),
    fullCalls: sessionState.fullCalls + (tier === 'full' ? 1 : 0),
    unknownModelCalls: sessionState.unknownModelCalls + (tier === 'unknown' ? 1 : 0),
    totalPromptTokens: sessionState.totalPromptTokens + input.estimate.promptTokens,
    totalCompletionTokens: sessionState.totalCompletionTokens + input.estimate.completionTokens,
    totalTokens: sessionState.totalTokens + input.estimate.totalTokens,
    totalEstimatedCostUsd: parseFloat((sessionState.totalEstimatedCostUsd + input.estimate.totalCostUsd).toFixed(6)),
    lastModel: input.estimate.model,
    lastTier: tier,
    lastReasonCodes: input.reasonCodes,
  };

  // Update daily
  dailyState = {
    ...dailyState,
    updatedAtLocal: input.nowLocal,
    messageCount: dailyState.messageCount + 1,
    miniCalls: dailyState.miniCalls + (tier === 'mini' ? 1 : 0),
    fullCalls: dailyState.fullCalls + (tier === 'full' ? 1 : 0),
    unknownModelCalls: dailyState.unknownModelCalls + (tier === 'unknown' ? 1 : 0),
    totalPromptTokens: dailyState.totalPromptTokens + input.estimate.promptTokens,
    totalCompletionTokens: dailyState.totalCompletionTokens + input.estimate.completionTokens,
    totalTokens: dailyState.totalTokens + input.estimate.totalTokens,
    totalEstimatedCostUsd: parseFloat((dailyState.totalEstimatedCostUsd + input.estimate.totalCostUsd).toFixed(6)),
  };

  // Save both
  const sessionSave = await saveTokenCostSessionState(sessionState);
  if (!sessionSave.ok && sessionSave.error) errors.push(sessionSave.error);

  const dailySave = await saveTokenCostDailyState(dailyState);
  if (!dailySave.ok && dailySave.error) errors.push(dailySave.error);

  return {
    ok: errors.length === 0,
    sessionState,
    dailyState,
    warnings,
    errors,
  };
}

/**
 * 6. resetTokenCostStats
 */
export async function resetTokenCostStats(input: ResetTokenCostInput): Promise<{ ok: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    if (input.scope === 'session' || input.scope === 'all') {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
    if (input.scope === 'daily' || input.scope === 'all') {
      await AsyncStorage.removeItem(DAILY_KEY);
    }
    return { ok: true, warnings };
  } catch (e: any) {
    warnings.push(`reset_error: ${e?.message ?? 'unknown'}`);
    return { ok: false, warnings };
  }
}

/**
 * 7. buildPersistentTokenCostDebugLine
 */
export function buildPersistentTokenCostDebugLine(
  sessionState: PersistedTokenCostSessionState | null,
  dailyState: PersistedTokenCostDailyState | null,
  lastEstimate: TokenCostEstimate | null,
): string {
  if (!lastEstimate) {
    const sCost = sessionState ? `$${sessionState.totalEstimatedCostUsd.toFixed(6)}` : '$0.000000';
    const dCost = dailyState ? `$${dailyState.totalEstimatedCostUsd.toFixed(6)}` : '$0.000000';
    return `msg=unknown | session=${sCost} | day=${dCost} | pricing=unknown`;
  }

  const msgCost = `$${lastEstimate.totalCostUsd.toFixed(6)}`;
  const sCost = sessionState ? `$${sessionState.totalEstimatedCostUsd.toFixed(6)}` : '$0.000000';
  const dCost = dailyState ? `$${dailyState.totalEstimatedCostUsd.toFixed(6)}` : '$0.000000';
  const calls = sessionState ? `mini:${sessionState.miniCalls}/full:${sessionState.fullCalls}` : 'mini:0/full:0';
  const tokens = `${lastEstimate.promptTokens}/${lastEstimate.completionTokens}/${lastEstimate.totalTokens}`;
  const pricing = lastEstimate.pricingVerified ? 'verified' : 'verify';

  return `msg=${msgCost} | session=${sCost} | day=${dCost} | calls=${calls} | tokens=${tokens} | pricing=${pricing}`;
}

// ─── EXPORTS FOR TESTING ───
export { SESSION_KEY, DAILY_KEY, createEmptySessionState, createEmptyDailyState };
