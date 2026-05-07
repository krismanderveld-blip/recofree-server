/**
 * Kim Relational Signals
 *
 * Extracted from:
 * - lib/rugzak/short-term-memory-buffer.ts (detectTriggerGuess Kim branch, lines 353-362)
 * - lib/rugzak/relational-pattern-analyzer.ts (Kim priority rules)
 *
 * Kim-specific trigger categories and relational pattern detection.
 *
 * No new logic. Direct extraction only.
 */

/**
 * Kim trigger categories from buffer.ts detectTriggerGuess (else branch).
 * Maps text patterns to Kim-specific trigger names.
 */
export function detectKimTrigger(text: string): string {
  const lower = text.toLowerCase();

  if (/\b(boundary|boundaries|limits|too much|overstepped)\b/.test(lower)) return 'boundary_violation';
  if (/\b(again|always|every time|keeps happening)\b/.test(lower)) return 'repeated_pattern';
  if (/\b(guilt|guilty|my fault|responsible)\b/.test(lower)) return 'guilt';
  if (/\b(tired|exhausted|burned out|drained)\b/.test(lower)) return 'caregiver_fatigue';
  if (/\b(lonely|alone|no one understands|isolated)\b/.test(lower)) return 'isolation';
  if (/\b(relapse|relapsed|started again|using again)\b/.test(lower)) return 'loved_one_relapse';
  if (/\b(angry|furious|rage|frustrated)\b/.test(lower)) return 'anger_at_situation';

  return '';
}

/**
 * Kim relational priority signals.
 * Extracted from relational-pattern-analyzer.ts Kim priority rules.
 *
 * Kim prioritizes: boundary, enabling, guilt, caregiver_fatigue, isolation.
 */
export const KIM_PRIORITY_TRIGGERS: readonly string[] = Object.freeze([
  'boundary_violation',
  'enabling',
  'guilt',
  'caregiver_fatigue',
  'isolation',
]);

/**
 * Check if a trigger is a Kim priority trigger.
 */
export function isKimPriorityTrigger(trigger: string): boolean {
  return KIM_PRIORITY_TRIGGERS.includes(trigger);
}

// ─── Kim Mock Detection (from mock-provider.ts) ───────────────

/**
 * Detect Kim boundary topic from message.
 * Extracted from MockAIProvider.detectBoundaryTopic (mock-provider.ts line 139-142).
 * Exact same keywords, exact same logic.
 */
export function detectKimBoundaryTopic(message: string): boolean {
  const keywords = ['boundary', 'boundaries', 'too much', 'can\'t anymore', 'stop', 'enough', 'my space', 'limit'];
  return keywords.some((kw) => message.toLowerCase().includes(kw));
}

/**
 * Detect Kim enabling pattern from message.
 * Extracted from MockAIProvider.detectEnablingPattern (mock-provider.ts line 144-147).
 * Exact same keywords, exact same logic.
 */
export function detectKimEnablingPattern(message: string): boolean {
  const keywords = ['i do everything', 'i help', 'i save', 'i fix', 'for him', 'for her', 'take over', 'cover for'];
  return keywords.some((kw) => message.toLowerCase().includes(kw));
}
