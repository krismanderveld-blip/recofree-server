/**
 * PROMPT REDACTION GUARDS
 * 
 * Prevents debug-only metadata from appearing in user-facing prompts.
 * Prevents server/internal implementation details from leaking into GPT prompt.
 * No clinical filtering — only metadata hygiene.
 */

/** Patterns that should never appear in user-facing system prompts */
const REDACTED_PATTERNS = [
  /\[DEBUG\]/gi,
  /\[INTERNAL\]/gi,
  /\[SERVER_ONLY\]/gi,
  /console\.log/gi,
  /\/\/ TODO:/gi,
  /eliasGuidanceDepthDebug/gi,
  /relapseReason:/gi,
  /harmDepthReason:/gi,
  /wasUserDepthOverridden/gi,
  /promptBuildVersion/gi,
];

/** Sections that are debug-only and should not be included in production prompts */
const DEBUG_ONLY_SECTIONS = [
  'k05OverrideLog',
  'safetyFilterLog',
  'guidanceDepthDebug',
  'pipelineTrace',
];

export interface RedactionResult {
  cleanedPrompt: string;
  redactedItems: string[];
}

/**
 * Remove debug/internal metadata from a system prompt before sending to GPT.
 */
export function redactDebugMetadata(prompt: string): RedactionResult {
  let cleaned = prompt;
  const redactedItems: string[] = [];

  for (const pattern of REDACTED_PATTERNS) {
    if (pattern.test(cleaned)) {
      redactedItems.push(pattern.source);
      cleaned = cleaned.replace(pattern, '');
    }
  }

  return { cleanedPrompt: cleaned, redactedItems };
}

/**
 * Check if a section name is debug-only and should be excluded from production prompts.
 */
export function isDebugOnlySection(sectionName: string): boolean {
  return DEBUG_ONLY_SECTIONS.includes(sectionName);
}
