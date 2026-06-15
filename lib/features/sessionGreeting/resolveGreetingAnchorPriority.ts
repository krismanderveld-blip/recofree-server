/**
 * Resolves the highest-priority eligible anchor from the candidate list.
 * Priority order (corrected):
 * 1. FIRST_SESSION
 * 2. CRISIS_OR_HIGH_CRAVING
 * 3. ACTIVE_PROJECTION_FEAR
 * 4. TODAY_MOOD_SLIDERS
 * 5. RECENT_DIARY
 * 6. RECENT_GRATITUDE
 * 7. BACKPACK_RECENT_UPDATE
 * 8. SCHEMA_ROTATION
 * 9. MISSING_DATA_INVITATION
 */

import type {
  GreetingAnchorCandidate,
  SelectedGreetingAnchor,
  GREETING_ANCHOR_PRIORITY,
} from './sessionGreeting.types';
import { GREETING_ANCHOR_PRIORITY as PRIORITY_ORDER } from './sessionGreeting.types';

export function resolveGreetingAnchorPriority(
  candidates: GreetingAnchorCandidate[]
): SelectedGreetingAnchor {
  // Build a map for O(1) lookup
  const candidateMap = new Map(candidates.map(c => [c.anchorType, c]));

  // Walk priority order, pick first eligible
  for (const anchorType of PRIORITY_ORDER) {
    const candidate = candidateMap.get(anchorType);
    if (candidate && candidate.eligible) {
      return {
        anchorType: candidate.anchorType,
        reason: candidate.reason,
        payload: candidate.payload ?? {},
      };
    }
  }

  // Fallback (should never reach here since MISSING_DATA_INVITATION is always eligible)
  return {
    anchorType: 'MISSING_DATA_INVITATION',
    reason: 'Fallback: no eligible anchor found',
    payload: {},
  };
}
