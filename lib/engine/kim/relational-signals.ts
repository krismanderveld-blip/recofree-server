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

  if (/\b(grens|boundary|grenzen|limits|te veel)\b/.test(lower)) return 'boundary_violation';
  if (/\b(weer|again|altijd|always|elke keer|every time)\b/.test(lower)) return 'repeated_pattern';
  if (/\b(schuld|guilt|mijn fout|my fault|verantwoordelijk)\b/.test(lower)) return 'guilt';
  if (/\b(moe|tired|uitgeput|exhausted|op|burned out)\b/.test(lower)) return 'caregiver_fatigue';
  if (/\b(alleen|lonely|niemand begrijpt|no one understands)\b/.test(lower)) return 'isolation';
  if (/\b(terugval|relapse|weer begonnen|started again)\b/.test(lower)) return 'loved_one_relapse';
  if (/\b(boos|angry|kwaad|furious|woedend)\b/.test(lower)) return 'anger_at_situation';

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
