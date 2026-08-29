import { describe, expect, it } from 'vitest';
import { resolveSafetyPresentation } from '@/lib/rugzak/runtime-safety-presentation';

describe('runtime safety presentation', () => {
  it('makes explicit Elias medical safety dominant for the current turn', () => {
    expect(resolveSafetyPresentation({
      persona: 'elias',
      module: 'E02',
      zone: 'GREEN',
      medicalUncertainty: true,
      safetyRelevant: true,
    })).toEqual({
      module: 'E05',
      zone: 'YELLOW',
      responseDriver: 'medical_safety:E05',
      medicalSafetyActive: true,
    });
  });

  it('does not relabel non-medical Elias turns', () => {
    expect(resolveSafetyPresentation({
      persona: 'elias', module: 'E01', zone: 'YELLOW', medicalUncertainty: false, safetyRelevant: false,
    })).toMatchObject({ module: 'E01', zone: 'YELLOW', medicalSafetyActive: false });
  });

  it('does not turn Kim relational sensitivity into an Elias medical module', () => {
    expect(resolveSafetyPresentation({
      persona: 'kim', module: 'K04', zone: 'ORANGE', medicalUncertainty: false, safetyRelevant: true,
    })).toMatchObject({ module: 'K04', zone: 'ORANGE', medicalSafetyActive: false });
  });
});
