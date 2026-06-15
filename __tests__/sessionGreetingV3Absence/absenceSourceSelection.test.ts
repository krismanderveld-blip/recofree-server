/**
 * Absence Awareness — Source Selection for Return After Absence
 * Tests: max 2 sources in return mode, positive bias, exclusion rules
 */
import { describe, it, expect } from 'vitest';
import {
  selectReturnAfterAbsenceSources,
} from '@/lib/features/sessionGreeting/selectGreetingSynthesisSources';
import type { GreetingSynthesisCandidate } from '@/lib/features/sessionGreeting/sessionGreetingV3.types';
import type { SessionAbsenceResult } from '@/lib/features/sessionGreeting/calculateSessionAbsence';

const defaultAbsence: SessionAbsenceResult = {
  band: 'RETURN_AFTER_ABSENCE',
  isReturnAfterAbsence: true,
  absenceDaysExact: 5,
  absenceHoursExact: 120,
  lastSessionStartedAt: '2026-06-10T09:00:00.000Z',
  thresholdDays: 3,
  reason: 'User returns after absence threshold.',
};

function makeCandidate(
  sourceType: GreetingSynthesisCandidate['sourceType'],
  relevanceScore: number,
  safeAnchor: string = 'test anchor',
): GreetingSynthesisCandidate {
  return { sourceType, relevanceScore, safeAnchor, eligible: true };
}

describe('Absence Source Selection (Return After Absence)', () => {
  it('C1: Selects max 2 sources in return-after-absence mode', () => {
    const candidates: GreetingSynthesisCandidate[] = [
      makeCandidate('TODAY_MOOD', 0.9, 'frustration=6'),
      makeCandidate('RECENT_DIARY', 0.8, 'Vandaag was moeilijk'),
      makeCandidate('RECENT_GRATITUDE', 0.7, 'Dankbaar voor rust'),
      makeCandidate('BACKPACK_RECENT_UPDATE', 0.6, 'Nieuwe trigger'),
    ];
    const result = selectReturnAfterAbsenceSources({ candidates, absence: defaultAbsence });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('C2: Selects by priority order (TODAY_MOOD > RECENT_DIARY > RECENT_GRATITUDE)', () => {
    const candidates: GreetingSynthesisCandidate[] = [
      makeCandidate('RECENT_GRATITUDE', 0.9, 'Dankbaar'),
      makeCandidate('TODAY_MOOD', 0.5, 'mood'),
      makeCandidate('RECENT_DIARY', 0.3, 'diary'),
    ];
    const result = selectReturnAfterAbsenceSources({ candidates, absence: defaultAbsence });
    expect(result.length).toBe(2);
    // Priority order: TODAY_MOOD (idx 0) > RECENT_DIARY (idx 1) > RECENT_GRATITUDE (idx 2)
    expect(result[0].sourceType).toBe('TODAY_MOOD');
    expect(result[1].sourceType).toBe('RECENT_DIARY');
  });

  it('C3: Returns empty array when no eligible candidates', () => {
    const candidates: GreetingSynthesisCandidate[] = [
      { sourceType: 'TODAY_MOOD', relevanceScore: 0.5, safeAnchor: 'mood', eligible: false },
    ];
    const result = selectReturnAfterAbsenceSources({ candidates, absence: defaultAbsence });
    expect(result.length).toBe(0);
  });

  it('C4: Returns 1 source when only 1 eligible candidate exists', () => {
    const candidates: GreetingSynthesisCandidate[] = [
      makeCandidate('RECENT_GRATITUDE', 0.8, 'Dankbaar voor een goed gesprek'),
    ];
    const result = selectReturnAfterAbsenceSources({ candidates, absence: defaultAbsence });
    expect(result.length).toBe(1);
    expect(result[0].sourceType).toBe('RECENT_GRATITUDE');
  });

  it('C5: Only selects eligible candidates', () => {
    const candidates: GreetingSynthesisCandidate[] = [
      makeCandidate('TODAY_MOOD', 0.9, 'mood'),
      { sourceType: 'RECENT_DIARY', relevanceScore: 0.95, safeAnchor: 'diary', eligible: false },
      makeCandidate('RECENT_GRATITUDE', 0.7, 'gratitude'),
    ];
    const result = selectReturnAfterAbsenceSources({ candidates, absence: defaultAbsence });
    expect(result.length).toBe(2);
    expect(result.find(s => s.sourceType === 'RECENT_DIARY')).toBeUndefined();
  });
});
