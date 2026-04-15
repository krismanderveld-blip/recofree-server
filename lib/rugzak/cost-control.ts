/**
 * Cost Control Layer — Engine Spec V2
 *
 * Tracks token usage per API call and per session.
 * Provides warnings when calls exceed thresholds.
 * Stores cumulative usage in UserDat for long-term tracking.
 *
 * Token estimation is done locally (no extra API call).
 * Actual usage is read from the OpenAI response headers.
 *
 * RULES:
 *   - Max input tokens per call: ~4000 (system prompt + context + history)
 *   - Max output tokens per call: 500 (set in server)
 *   - Warning threshold: input > 3500 tokens
 *   - Critical threshold: input > 5000 tokens
 *   - Session budget: ~25,000 total tokens (input + output combined)
 */

// ─── Types ────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CallCostRecord {
  timestamp: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isSessionStart: boolean;
  dominantModule: string;
  warning?: string;
}

export interface SessionCostSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  averageTokensPerCall: number;
  peakCallTokens: number;
  warnings: string[];
}

// ─── Thresholds ──────────────────────────────────────────────────

const INPUT_WARNING_THRESHOLD = 3500;
const INPUT_CRITICAL_THRESHOLD = 5000;
const SESSION_BUDGET = 25000;
const MAX_OUTPUT_TOKENS = 500;

// ─── Token Estimator (local, no API call) ────────────────────────

/**
 * Rough token estimation: ~4 chars per token for English/Dutch text.
 * This is an approximation — actual tokenization varies.
 * Used for pre-call budget checks and logging.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Average: 1 token ≈ 4 characters for mixed English/Dutch
  return Math.ceil(text.length / 4);
}

/**
 * Estimate the total input tokens for a call based on the payload components.
 */
export function estimateCallInputTokens(params: {
  systemPromptLength: number;
  conversationHistoryLength: number;
  userMessageLength: number;
}): number {
  return (
    estimateTokens(' '.repeat(params.systemPromptLength)) +
    estimateTokens(' '.repeat(params.conversationHistoryLength)) +
    estimateTokens(' '.repeat(params.userMessageLength))
  );
}

// ─── Cost Tracker (per session, in-memory) ───────────────────────

let sessionCalls: CallCostRecord[] = [];

/**
 * Reset the session cost tracker. Call at session start.
 */
export function resetSessionCost(): void {
  sessionCalls = [];
}

/**
 * Record a single API call's token usage.
 * Returns any warnings generated.
 */
export function recordCallCost(
  usage: TokenUsage,
  isSessionStart: boolean,
  dominantModule: string,
): CallCostRecord {
  const warnings: string[] = [];

  // Check input token thresholds
  if (usage.promptTokens > INPUT_CRITICAL_THRESHOLD) {
    warnings.push(`CRITICAL: Input tokens (${usage.promptTokens}) exceed critical threshold (${INPUT_CRITICAL_THRESHOLD}). Consider reducing context.`);
  } else if (usage.promptTokens > INPUT_WARNING_THRESHOLD) {
    warnings.push(`WARNING: Input tokens (${usage.promptTokens}) exceed warning threshold (${INPUT_WARNING_THRESHOLD}).`);
  }

  // Check session budget
  const currentSessionTotal = sessionCalls.reduce((sum, c) => sum + c.totalTokens, 0);
  const newTotal = currentSessionTotal + usage.totalTokens;
  if (newTotal > SESSION_BUDGET) {
    warnings.push(`WARNING: Session token budget exceeded (${newTotal}/${SESSION_BUDGET}). Consider ending the session.`);
  } else if (newTotal > SESSION_BUDGET * 0.8) {
    warnings.push(`INFO: Session at ${Math.round((newTotal / SESSION_BUDGET) * 100)}% of token budget.`);
  }

  const record: CallCostRecord = {
    timestamp: new Date().toISOString(),
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    isSessionStart,
    dominantModule,
    warning: warnings.length > 0 ? warnings.join(' | ') : undefined,
  };

  sessionCalls.push(record);

  // Log to console
  console.log(`[CostControl] Call #${sessionCalls.length}: ${usage.promptTokens} in + ${usage.completionTokens} out = ${usage.totalTokens} total`);
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[CostControl] ${w}`);
    }
  }

  return record;
}

/**
 * Get the current session's cost summary.
 */
export function getSessionCostSummary(): SessionCostSummary {
  const totalCalls = sessionCalls.length;
  const totalPromptTokens = sessionCalls.reduce((sum, c) => sum + c.promptTokens, 0);
  const totalCompletionTokens = sessionCalls.reduce((sum, c) => sum + c.completionTokens, 0);
  const totalTokens = sessionCalls.reduce((sum, c) => sum + c.totalTokens, 0);
  const peakCallTokens = sessionCalls.length > 0
    ? Math.max(...sessionCalls.map(c => c.totalTokens))
    : 0;
  const averageTokensPerCall = totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0;
  const warnings = sessionCalls
    .filter(c => c.warning)
    .map(c => c.warning!);

  return {
    totalCalls,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    averageTokensPerCall,
    peakCallTokens,
    warnings,
  };
}

/**
 * Get the remaining token budget for this session.
 */
export function getRemainingBudget(): number {
  const used = sessionCalls.reduce((sum, c) => sum + c.totalTokens, 0);
  return Math.max(0, SESSION_BUDGET - used);
}

/**
 * Check if the session is over budget.
 */
export function isOverBudget(): boolean {
  return getRemainingBudget() <= 0;
}

/**
 * Build a cost summary record for storing in UserDat at session end.
 */
export function buildSessionCostRecord(): {
  totalCalls: number;
  totalTokens: number;
  averageTokensPerCall: number;
  peakCallTokens: number;
  date: string;
} {
  const summary = getSessionCostSummary();
  return {
    totalCalls: summary.totalCalls,
    totalTokens: summary.totalTokens,
    averageTokensPerCall: summary.averageTokensPerCall,
    peakCallTokens: summary.peakCallTokens,
    date: new Date().toISOString(),
  };
}
