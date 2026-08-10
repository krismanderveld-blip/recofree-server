/**
 * PROMPT TOKEN BUDGET
 * 
 * Deterministic token estimation and budget limits.
 * No clinical interpretation — only size management.
 */

export interface TokenBudgetResult {
  estimatedPromptSize: number;
  recommendedMaxTokens: number;
  budgetWarnings: string[];
}

/** Rough token estimation: ~4 chars per token for Dutch/English */
const CHARS_PER_TOKEN = 4;

/** Maximum system prompt size before warnings */
const MAX_SYSTEM_PROMPT_TOKENS = 3000;

/** Recommended max_tokens for response based on remaining budget */
const MODEL_CONTEXT_WINDOW = 8192; // gpt-4o-mini default
const RESERVED_FOR_RESPONSE = 900;

export function estimateTokenBudget(systemPromptText: string): TokenBudgetResult {
  const estimatedPromptSize = Math.ceil(systemPromptText.length / CHARS_PER_TOKEN);
  const budgetWarnings: string[] = [];

  if (estimatedPromptSize > MAX_SYSTEM_PROMPT_TOKENS) {
    budgetWarnings.push(`System prompt exceeds recommended ${MAX_SYSTEM_PROMPT_TOKENS} tokens (estimated: ${estimatedPromptSize})`);
  }

  const remainingBudget = MODEL_CONTEXT_WINDOW - estimatedPromptSize;
  if (remainingBudget < RESERVED_FOR_RESPONSE) {
    budgetWarnings.push(`Insufficient budget for response: only ${remainingBudget} tokens remaining`);
  }

  const recommendedMaxTokens = Math.min(RESERVED_FOR_RESPONSE, Math.max(300, remainingBudget - 500));

  return {
    estimatedPromptSize,
    recommendedMaxTokens,
    budgetWarnings,
  };
}
