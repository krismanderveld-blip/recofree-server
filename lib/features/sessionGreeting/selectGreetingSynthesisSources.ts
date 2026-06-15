/**
 * Session Greeting V3 — Source Selection
 *
 * Selects up to 3 synthesis sources from eligible candidates.
 *
 * Rules:
 * 1. Only eligible candidates (eligible=true) are considered
 * 2. Sort by relevanceScore descending
 * 3. Take top 3
 * 4. Balance rule: never more than 1 "positive" source (gratitude, focus)
 *    alongside a "negative" source (alarm mood, fear)
 * 5. If only 1 eligible source, that's fine — GPT handles 1-3 sources
 */

import type {
  GreetingSynthesisCandidate,
  SelectedSynthesisSource,
  MoodMetricSelection,
} from './sessionGreetingV3.types';
import { V3_MAX_SYNTHESIS_SOURCES } from './sessionGreetingV3.types';

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

    // Balance rule: max 1 negative alongside positives (don't overwhelm)
    // Actually per spec: crisis is already handled by override, so in synthesis
    // we allow multiple negatives (elevated mood + fear is valid)

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
