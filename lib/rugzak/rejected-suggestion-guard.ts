/**
 * REJECTED SUGGESTION GUARD
 * 
 * Session-only tracking of suggestions the user explicitly rejected.
 * Prevents GPT from immediately re-suggesting something the user said "no" to.
 * 
 * Examples:
 *   User: "wandelen kan niet" → adds 'wandelen' to rejected
 *   User: "ik wil niet mediteren" → adds 'mediteren' to rejected
 *   User: "dat werkt niet voor mij" → adds last suggestion topic to rejected
 * 
 * This is session-only (not persisted). Resets on new session.
 * The rejected list is passed to GPT as a mustAvoid instruction.
 */

// ─── Types ────────────────────────────────────────────────────────
export interface RejectedSuggestion {
  topic: string;
  rejectedAt: string;
  reason: 'explicit_rejection' | 'cannot_do' | 'does_not_work';
}

// ─── Session State (volatile, not persisted) ────────────────────────
let sessionRejected: RejectedSuggestion[] = [];

// ─── Rejection Detection Patterns ────────────────────────────────────
const REJECTION_PATTERNS: Array<{ pattern: RegExp; reason: RejectedSuggestion['reason'] }> = [
  // Dutch: explicit "kan niet" / "wil niet" / "lukt niet" + topic
  { pattern: /\b(wandelen|sporten|mediteren|ademhaling|yoga|hardlopen|fietsen|zwemmen|schrijven|tekenen|lezen|koken|tuinieren|muziek)\b.*\b(kan niet|lukt niet|gaat niet|wil niet|doe ik niet|is niet mogelijk)\b/i, reason: 'cannot_do' },
  { pattern: /\b(kan niet|lukt niet|gaat niet|wil niet|doe ik niet|is niet mogelijk)\b.*\b(wandelen|sporten|mediteren|ademhaling|yoga|hardlopen|fietsen|zwemmen|schrijven|tekenen|lezen|koken|tuinieren|muziek)\b/i, reason: 'cannot_do' },
  // Dutch: "dat werkt niet" / "dat helpt niet"
  { pattern: /\b(dat|dit|het)\b.*\b(werkt niet|helpt niet|doet niets|heeft geen zin)\b/i, reason: 'does_not_work' },
  // Dutch: "nee" + activity
  { pattern: /\bnee\b.*\b(wandelen|sporten|mediteren|ademhaling|yoga|hardlopen|fietsen|zwemmen|schrijven|tekenen|lezen|koken|tuinieren|muziek)\b/i, reason: 'explicit_rejection' },
];

// ─── Activity extraction pattern ────────────────────────────────────
const ACTIVITY_WORDS = /\b(wandelen|sporten|mediteren|ademhaling|yoga|hardlopen|fietsen|zwemmen|schrijven|tekenen|lezen|koken|tuinieren|muziek|bewegen|stretchen|joggen|dansen)\b/gi;

// ─── Public API ────────────────────────────────────────────────────

/**
 * Detect if user message contains a rejection of a suggestion.
 * Returns the rejected topic(s) or empty array.
 */
export function detectRejectedSuggestions(userMessage: string): RejectedSuggestion[] {
  const results: RejectedSuggestion[] = [];
  const lower = userMessage.toLowerCase();
  
  for (const { pattern, reason } of REJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      // Extract the activity word(s) from the message
      const activities = lower.match(ACTIVITY_WORDS);
      if (activities) {
        for (const activity of activities) {
          if (!sessionRejected.some(r => r.topic === activity)) {
            const rejection: RejectedSuggestion = {
              topic: activity,
              rejectedAt: new Date().toISOString(),
              reason,
            };
            results.push(rejection);
          }
        }
      }
    }
  }
  
  return results;
}

/**
 * Record rejected suggestions in session state.
 */
export function recordRejectedSuggestions(rejections: RejectedSuggestion[]): void {
  sessionRejected.push(...rejections);
  // Keep max 10 per session
  if (sessionRejected.length > 10) {
    sessionRejected = sessionRejected.slice(-10);
  }
}

/**
 * Get current session rejected suggestions as a compact prompt instruction.
 * Returns undefined if nothing rejected.
 */
export function buildRejectedSuggestionsBlock(): string | undefined {
  if (sessionRejected.length === 0) return undefined;
  const topics = sessionRejected.map(r => r.topic);
  return `[REJECTED SUGGESTIONS — do NOT repeat these]\nThe user has explicitly rejected: ${topics.join(', ')}.\nDo not suggest these activities again in this session.`;
}

/**
 * Get raw list of rejected topics (for testing/debug).
 */
export function getSessionRejectedTopics(): string[] {
  return sessionRejected.map(r => r.topic);
}

/**
 * Reset session rejected state (call on new session).
 */
export function resetRejectedSuggestions(): void {
  sessionRejected = [];
}
