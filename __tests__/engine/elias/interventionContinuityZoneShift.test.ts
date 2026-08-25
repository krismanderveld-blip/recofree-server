import { beforeEach, describe, expect, it } from 'vitest';

import {
  evaluateInterventionContinuity,
  resetInterventionState,
  updateInterventionAfterResponse,
} from '@/lib/engine/elias/intervention-continuity';
import type { ResolvedEliasZone } from '@/lib/engine/elias/vsp-resolution';

function zone(label: 'GROEN' | 'ORANJE', severity: 1 | 3): ResolvedEliasZone {
  return {
    finalZoneLabel: label,
    finalSeverity: severity,
    isBlocked: false,
  } as ResolvedEliasZone;
}

describe('Intervention continuity — zone shift re-evaluation', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('replaces previous GREEN reflection with ORANGE regulation on the next turn', () => {
    updateInterventionAfterResponse(zone('GROEN', 1), 'reflect');

    const result = evaluateInterventionContinuity(
      zone('ORANJE', 3),
      'Ik heb craving en ik wil drinken, maar ik wil het eigenlijk niet doen.',
      'regulate',
    );

    expect(result?.wasReEvaluated).toBe(true);
    expect(result?.lastInterventionType).toBe('regulation');
    expect(result?.interventionGoal).toContain('physiological arousal');
    expect(result?.linkedZone).toBe('ORANJE');
  });
});
