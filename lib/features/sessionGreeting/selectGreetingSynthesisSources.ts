/**
 * Session Greeting V3 — Source Selection (with Absence Awareness)
 *
 * Selects up to 3 synthesis sources from eligible candidates.
 * For RETURN_AFTER_ABSENCE: selects up to 2 sources with different priority.
 *
 * Normal synthesis rules:
 * 1. Only eligible candidates (eligible=true) are considered
 * 2. Sort by relevanceScore descending
 * 3. Take top 3
 * 4. Balance rule: never more than 1 "positive" source alongside a "negative" source
 *
 * Return after absence rules:
 * 1. Filter eligible, remove CRISIS sources
 * 2. If LONG_RETURN: remove ACTIVE_HOPE_OR_FEAR unless no other source
 * 3. Sort by return relevance priority
 * 4. Cap at 2
 */

import type {
  GreetingSynthesisCandidate,
  SelectedSynthesisSource,
  GreetingSynthesisSourceType,
  MoodMetricSelection,
} from './sessionGreetingV3.types';
import { V3_MAX_SYNTHESIS_SOURCES } from './sessionGreetingV3.types';
import type { SessionAbsenceResult } from './calculateSessionAbsence';

export interface SelectSynthesisSourcesInput {
  candidates: GreetingSynthesisCandidate[];
  moodMetric: MoodMetricSelection | null;
}

/**
 * Selects up to 3 sources from eligible candidates, applying balance rules.
 */
export function selectGreetingSynthesisSources(
  input: SelectSynthesisSourcesInput,
): SelectedSynthesisSource[] {
  const { candidates, moodMetric } = input;

  // Filter to eligible only
  const eligible = candidates.filter(c => c.eligible);

  if (eligible.length === 0) return [];

  // Sort by relevance descending
  const sorted = [...eligible].sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Take top candidates with balance rules
  const selected: SelectedSynthesisSource[] = [];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const candidate of sorted) {
    if (selected.length >= V3_MAX_SYNTHESIS_SOURCES) break;

    const valence = getSourceValence(candidate, moodMetric);

    // Balance rule: max 1 positive if there's already a negative
    if (valence === 'positive' && negativeCount > 0 && positiveCount >= 1) {
      continue; // skip this positive source
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
  'RECENT_DIARY',
  'RECENT_GRATITUDE',
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
 * Uses different priority than normal synthesis.
 * LONG_RETURN removes fear sources unless nothing else is available.
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

  // Sort by return relevance priority
  const sorted = [...eligible].sort((a, b) => {
    const aIdx = RETURN_RELEVANCE_PRIORITY.indexOf(a.sourceType);
    const bIdx = RETURN_RELEVANCE_PRIORITY.indexOf(b.sourceType);
    const aPriority = aIdx === -1 ? 999 : aIdx;
    const bPriority = bIdx === -1 ? 999 : bIdx;
    return aPriority - bPriority;
  });

  // Cap at 2
  return sorted.slice(0, RETURN_MAX_SOURCES).map(c => ({
    sourceType: c.sourceType,
    safeAnchor: c.safeAnchor,
    relevanceScore: c.relevanceScore,
  }));
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
      return 'neutral'; // diary can be anything

    case 'BACKPACK_RECENT_UPDATE':
      return 'neutral';

    case 'SCHEMA_ROTATION':
      return 'neutral'; // schemas are reflective, not positive/negative

    default:
      return 'neutral';
  }
}
