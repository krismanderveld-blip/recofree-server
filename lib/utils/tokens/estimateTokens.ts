/**
 * Rough token estimate: ~4 chars per token for English/Dutch text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
