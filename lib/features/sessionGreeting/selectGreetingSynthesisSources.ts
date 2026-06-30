/**
 * Session Greeting V3 — Source Selection (with Continuity Priority)
 *
 * Selects synthesis sources from eligible candidates.
 * For normal SYNTHESIS mode:
 *   1. LAST_SESSION_SUMMARY always gets the continuity slot (if eligible)
 *   2. Then up to 2 additional state/sfeer sources from the remaining candidates
 *   3. Balance rule: max 1 positive alongside a negative
 *
 * For RETURN_AFTER_ABSENCE:
 *   1. Filter eligible, remove CRISIS sources
 *   2. If LONG_RETURN: remove ACTIVE_HOPE_OR_FEAR unless no other source
 *   3. Sort by return relevance priority
 *   4. Cap at 2
 *
 * DESIGN RATIONALE:
 * LAST_SESSION_SUMMARY (open endpoints, topics, narrative) provides conversational
 * continuity — "where we left off". This is the most important context for a greeting
 * that feels like a real ongoing relationship. State sources (diary, mood, gratitude)
 * provide the "how are you now" layer. Both together create a greeting that references
 * the thread AND acknowledges the current state.
 *
 * Anti-repetition is handled in the prompt layer (focus on open endpoints, not full recap)
 * and by the fact-grounding/validation system that rejects fabrication.
 */

import type {
  GreetingSynthesisCandidate,
  SelectedSynthesisSource,
  GreetingSynthesisSourceType,
  MoodMetricSelection,
} from './sessionGreetingV3.types';
import type { SessionAbsenceResult } from './calculateSessionAbsence';

/** Max additional state sources alongside the continuity slot */
const MAX_STATE_SOURCES = 2;

export interface SelectSynthesisSourcesInput {
  candidates: GreetingSynthesisCandidate[];
  moodMetric: MoodMetricSelection | null;
}

/**
 * Selects sources with continuity priority:
 * 1. LAST_SESSION_SUMMARY always first (if eligible) — the conversational thread
 * 2. Up to 2 additional state/sfeer sources sorted by relevanceScore
 */
export function selectGreetingSynthesisSources(
  input: SelectSynthesisSourcesInput,
): SelectedSynthesisSource[] {
  const { candidates, moodMetric } = input;

  // Filter to eligible only
  const eligible = candidates.filter(c => c.eligible);

  if (eligible.length === 0) return [];

  const selected: SelectedSynthesisSource[] = [];
  let positiveCount = 0;
  let negativeCount = 0;

  // ─── CONTINUITY SLOT: LAST_SESSION_SUMMARY always first ───────────────────
  const sessionSummary = eligible.find(c => c.sourceType === 'LAST_SESSION_SUMMARY');
  if (sessionSummary) {
    selected.push({
      sourceType: sessionSummary.sourceType,
      safeAnchor: sessionSummary.safeAnchor,
      relevanceScore: sessionSummary.relevanceScore,
    });
    const valence = getSourceValence(sessionSummary, moodMetric);
    if (valence === 'positive') positiveCount++;
    if (valence === 'negative') negativeCount++;
  }

  // ─── STATE SLOTS: up to 2 additional sources from the rest ────────────────
  const remaining = eligible
    .filter(c => c.sourceType !== 'LAST_SESSION_SUMMARY')
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  for (const candidate of remaining) {
    if (selected.length >= (sessionSummary ? 1 + MAX_STATE_SOURCES : MAX_STATE_SOURCES + 1)) break;

    const valence = getSourceValence(candidate, moodMetric);

    // Balance rule: max 1 positive if there's already a negative
    if (valence === 'positive' && negativeCount > 0 && positiveCount >= 1) {
      continue;
    }

    selected.push({
      sourceType: candidate.sourceType,
      safeAnchor: candidate.safeAnchor,
      relevanceScore: candidate.relevanceScore,
    });

    if (valence === 'positive') positiveCount++;
    if (valence === 'negative') negativeCount++;
  }

  return selected;
}

// ─── Return After Absence Source Selection ────────────────────────────────────

/** Priority order for return-after-absence source selection */
const RETURN_RELEVANCE_PRIORITY: GreetingSynthesisSourceType[] = [
  'TODAY_MOOD',
  'LAST_SESSION_SUMMARY',
  'RECENT_DIARY',
  'RECENT_GRATITUDE',
  'RECURRING_PATTERN',
  'BACKPACK_RECENT_UPDATE',
  'ACTIVE_HOPE_OR_FEAR',
  'SCHEMA_ROTATION',
];

const RETURN_MAX_SOURCES = 2;

export interface SelectReturnAfterAbsenceSourcesInput {
  candidates: GreetingSynthesisCandidate[];
  absence: SessionAbsenceResult;
}

/**
 * Selects up to 2 sources for RETURN_AFTER_ABSENCE mode.
 * LAST_SESSION_SUMMARY is always included if eligible (continuity matters even more after absence).
 * Then 1 additional state source.
 */
export function selectReturnAfterAbsenceSources(
  input: SelectReturnAfterAbsenceSourcesInput,
): SelectedSynthesisSource[] {
  const { candidates, absence } = input;

  // Filter eligible
  let eligible = candidates.filter(c => c.eligible);

  if (eligible.length === 0) return [];

  // For LONG_RETURN: remove ACTIVE_HOPE_OR_FEAR unless it's the only source
  if (absence.band === 'LONG_RETURN') {
    const withoutFear = eligible.filter(c => c.sourceType !== 'ACTIVE_HOPE_OR_FEAR');
    if (withoutFear.length > 0) {
      eligible = withoutFear;
    }
    // Also remove SCHEMA_ROTATION unless it's the only source
    const withoutSchema = eligible.filter(c => c.sourceType !== 'SCHEMA_ROTATION');
    if (withoutSchema.length > 0) {
      eligible = withoutSchema;
    }
  }

  const selected: SelectedSynthesisSource[] = [];

  // Continuity slot first
  const sessionSummary = eligible.find(c => c.sourceType === 'LAST_SESSION_SUMMARY');
  if (sessionSummary) {
    selected.push({
      sourceType: sessionSummary.sourceType,
      safeAnchor: sessionSummary.safeAnchor,
      relevanceScore: sessionSummary.relevanceScore,
    });
  }

  // Then fill remaining slots by relevanceScore (with RETURN_RELEVANCE_PRIORITY as tiebreaker)
  const remaining = eligible
    .filter(c => c.sourceType !== 'LAST_SESSION_SUMMARY')
    .sort((a, b) => {
      const scoreDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      const aIdx = RETURN_RELEVANCE_PRIORITY.indexOf(a.sourceType);
      const bIdx = RETURN_RELEVANCE_PRIORITY.indexOf(b.sourceType);
      const aPriority = aIdx === -1 ? 999 : aIdx;
      const bPriority = bIdx === -1 ? 999 : bIdx;
      return aPriority - bPriority;
    });

  for (const candidate of remaining) {
    if (selected.length >= RETURN_MAX_SOURCES) break;
    selected.push({
      sourceType: candidate.sourceType,
      safeAnchor: candidate.safeAnchor,
      relevanceScore: candidate.relevanceScore,
    });
  }

  return selected;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines the emotional valence of a source for balance rules.
 */
function getSourceValence(
  candidate: GreetingSynthesisCandidate,
  moodMetric: MoodMetricSelection | null,
): 'positive' | 'negative' | 'neutral' {
  switch (candidate.sourceType) {
    case 'TODAY_MOOD':
      if (!moodMetric) return 'neutral';
      if (moodMetric.interpretation === 'positive') return 'positive';
      if (moodMetric.interpretation === 'high_alarm' || moodMetric.interpretation === 'elevated') return 'negative';
      return 'neutral';

    case 'RECENT_GRATITUDE':
      return 'positive';

    case 'ACTIVE_HOPE_OR_FEAR':
      return 'negative'; // fears are concerning

    case 'RECENT_DIARY':
      // Diary valence is now inferred in buildGreetingSynthesisCandidates via the reason field
      if (candidate.reason.includes('valence=negative')) return 'negative';
      if (candidate.reason.includes('valence=positive')) return 'positive';
      return 'neutral';

    case 'BACKPACK_RECENT_UPDATE':
      return 'neutral';

    case 'SCHEMA_ROTATION':
      return 'neutral';

    case 'LAST_SESSION_SUMMARY':
      return 'neutral'; // session continuity is contextual

    case 'RECURRING_PATTERN':
      return 'neutral';

    default:
      return 'neutral';
  }
}
