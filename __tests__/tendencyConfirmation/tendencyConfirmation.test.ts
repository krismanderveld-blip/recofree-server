/**
 * Tendency Confirmation Layer V2 Tests — Multi-Source Verification
 *
 * Tests the V2 confirmation logic:
 * - Single acknowledgment stays CANDIDATE (deepens exploration)
 * - Multi-source verification required for CONFIRMED status
 * - Acknowledged candidates get exploratory prompt injection
 * - User self-acknowledgment NLU detection
 * - Clinical acknowledgment detection
 */
import { describe, it, expect } from 'vitest';
import {
  shouldAutoConfirm,
  shouldConfirm,
  applyAutoConfirmation,
  confirmTendencyById,
  getConfirmedOnly,
  getAcknowledgedCandidates,
  getAllCandidates,
  getConfirmationStats,
  applyClinicalAcknowledgment,
  applyUserAcknowledgment,
  detectUserAcknowledgment,
  detectClinicalAcknowledgment,
  isAcknowledged,
  getAcknowledgmentStatus,
  meetsAutoDetectThreshold,
  AUTO_CONFIRM_FREQUENCY_THRESHOLD,
  AUTO_CONFIRM_CONFIDENCE_THRESHOLD,
  MULTI_SOURCE_FREQUENCY_THRESHOLD,
  OVERWHELMING_FREQUENCY_THRESHOLD,
  type TendencyConfirmable,
} from '../../lib/engine/shared/tendency-confirmation';

// ─── Test Data ─────────────────────────────────────────────────────

function makeSchema(overrides: Partial<TendencyConfirmable & { schemaId: string; domain: string; lastSeen: string; copingStyle: string | null }> = {}): TendencyConfirmable & { schemaId: string; domain: string; lastSeen: string; copingStyle: string | null } {
  return {
    schemaId: overrides.schemaId ?? 'verlating_instabiliteit',
    domain: overrides.domain ?? 'relational',
    frequency: overrides.frequency ?? 1,
    lastSeen: overrides.lastSeen ?? '2026-06-10T10:00:00.000Z',
    copingStyle: overrides.copingStyle ?? null,
    confidence: overrides.confidence ?? 0.5,
    confirmed: overrides.confirmed,
    confirmedAt: overrides.confirmedAt,
    clinicalAcknowledged: overrides.clinicalAcknowledged,
    clinicalAcknowledgedAt: overrides.clinicalAcknowledgedAt,
    userAcknowledged: overrides.userAcknowledged,
    userAcknowledgedAt: overrides.userAcknowledgedAt,
    acknowledgmentScore: overrides.acknowledgmentScore,
  };
}

function makeMode(overrides: Partial<TendencyConfirmable & { modeId: string; lastSeen: string; effectiveInterventions: string[] }> = {}): TendencyConfirmable & { modeId: string; lastSeen: string; effectiveInterventions: string[] } {
  return {
    modeId: overrides.modeId ?? 'kwetsbaar_kind',
    frequency: overrides.frequency ?? 1,
    lastSeen: overrides.lastSeen ?? '2026-06-10T10:00:00.000Z',
    effectiveInterventions: overrides.effectiveInterventions ?? [],
    confidence: overrides.confidence ?? 0.5,
    confirmed: overrides.confirmed,
    confirmedAt: overrides.confirmedAt,
    clinicalAcknowledged: overrides.clinicalAcknowledged,
    clinicalAcknowledgedAt: overrides.clinicalAcknowledgedAt,
    userAcknowledged: overrides.userAcknowledged,
    userAcknowledgedAt: overrides.userAcknowledgedAt,
    acknowledgmentScore: overrides.acknowledgmentScore,
  };
}

const NOW = '2026-06-15T12:00:00.000Z';

// ═══════════════════════════════════════════════════════════════════
// SECTION: V2 Multi-Source Confirmation Logic
// ═══════════════════════════════════════════════════════════════════

describe('shouldConfirm — V2 multi-source verification', () => {
  it('TC01: auto-detect alone does NOT confirm (freq≥3, conf≥0.7, no acks)', () => {
    const t = makeSchema({ frequency: 4, confidence: 0.8 });
    expect(shouldConfirm(t).confirm).toBe(false);
  });

  it('TC02: clinical ack alone does NOT confirm', () => {
    const t = makeSchema({ frequency: 2, confidence: 0.5, clinicalAcknowledged: true });
    expect(shouldConfirm(t).confirm).toBe(false);
  });

  it('TC03: user ack alone does NOT confirm', () => {
    const t = makeSchema({ frequency: 2, confidence: 0.5, userAcknowledged: true });
    expect(shouldConfirm(t).confirm).toBe(false);
  });

  it('TC04: Path A — auto + clinical + user = CONFIRMED', () => {
    const t = makeSchema({ frequency: 4, confidence: 0.8, clinicalAcknowledged: true, userAcknowledged: true });
    const result = shouldConfirm(t);
    expect(result.confirm).toBe(true);
    expect(result.source).toBe('multi-source');
  });

  it('TC05: Path B — auto + clinical + freq≥5 = CONFIRMED', () => {
    const t = makeSchema({ frequency: 5, confidence: 0.8, clinicalAcknowledged: true });
    const result = shouldConfirm(t);
    expect(result.confirm).toBe(true);
    expect(result.source).toBe('multi-source');
  });

  it('TC06: Path B — auto + user + freq≥5 = CONFIRMED', () => {
    const t = makeSchema({ frequency: 5, confidence: 0.8, userAcknowledged: true });
    const result = shouldConfirm(t);
    expect(result.confirm).toBe(true);
    expect(result.source).toBe('multi-source');
  });

  it('TC07: Path B fails — auto + clinical but freq<5 = NOT confirmed', () => {
    const t = makeSchema({ frequency: 4, confidence: 0.8, clinicalAcknowledged: true });
    expect(shouldConfirm(t).confirm).toBe(false);
  });

  it('TC08: Path C — overwhelming frequency (≥8) = CONFIRMED regardless', () => {
    const t = makeSchema({ frequency: 8, confidence: 0.5 });
    const result = shouldConfirm(t);
    expect(result.confirm).toBe(true);
    expect(result.source).toBe('overwhelming');
  });

  it('TC09: already confirmed returns false', () => {
    const t = makeSchema({ frequency: 10, confidence: 0.9, confirmed: true });
    expect(shouldConfirm(t).confirm).toBe(false);
  });

  it('TC10: freq=7 with no acks does NOT confirm (below overwhelming threshold)', () => {
    const t = makeSchema({ frequency: 7, confidence: 0.9 });
    expect(shouldConfirm(t).confirm).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: shouldAutoConfirm (backward compat wrapper)
// ═══════════════════════════════════════════════════════════════════

describe('shouldAutoConfirm — backward compat', () => {
  it('TC11: uses V2 logic (freq≥3 + conf≥0.7 alone does NOT confirm)', () => {
    const t = { frequency: 5, confidence: 0.8, confirmed: undefined };
    // V2: auto-detect alone is NOT sufficient
    expect(shouldAutoConfirm(t)).toBe(false);
  });

  it('TC12: overwhelming frequency still confirms via wrapper', () => {
    const t = { frequency: 8, confidence: 0.5 };
    expect(shouldAutoConfirm(t)).toBe(true);
  });

  it('TC13: already confirmed returns false', () => {
    const t = { frequency: 10, confidence: 0.9, confirmed: true };
    expect(shouldAutoConfirm(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Acknowledgment Application
// ═══════════════════════════════════════════════════════════════════

describe('applyClinicalAcknowledgment', () => {
  it('TC14: marks tendency as clinically acknowledged', () => {
    const tendencies = [makeSchema({ schemaId: 'target', frequency: 3, confidence: 0.8 })];
    const { tendencies: result, result: ackResult } = applyClinicalAcknowledgment(tendencies, 'schemaId', 'target', NOW);
    expect(result[0].clinicalAcknowledged).toBe(true);
    expect(result[0].clinicalAcknowledgedAt).toBe(NOW);
    expect(result[0].acknowledgmentScore).toBe(2);
    expect(ackResult!.newlyAcknowledged).toBe(true);
    expect(ackResult!.source).toBe('clinical');
  });

  it('TC15: clinical ack does NOT confirm when freq<5 and no user ack', () => {
    const tendencies = [makeSchema({ schemaId: 'target', frequency: 4, confidence: 0.8 })];
    const { tendencies: result, result: ackResult } = applyClinicalAcknowledgment(tendencies, 'schemaId', 'target', NOW);
    expect(result[0].confirmed).toBeUndefined();
    expect(ackResult!.triggeredConfirmation).toBe(false);
  });

  it('TC16: clinical ack TRIGGERS confirmation when freq≥5 + auto threshold met', () => {
    const tendencies = [makeSchema({ schemaId: 'target', frequency: 5, confidence: 0.8 })];
    const { tendencies: result, result: ackResult } = applyClinicalAcknowledgment(tendencies, 'schemaId', 'target', NOW);
    expect(result[0].confirmed).toBe(true);
    expect(result[0].confirmedAt).toBe(NOW);
    expect(ackResult!.triggeredConfirmation).toBe(true);
  });

  it('TC17: does not re-acknowledge already acknowledged tendency', () => {
    const tendencies = [makeSchema({ schemaId: 'target', clinicalAcknowledged: true, clinicalAcknowledgedAt: '2026-01-01' })];
    const { result: ackResult } = applyClinicalAcknowledgment(tendencies, 'schemaId', 'target', NOW);
    expect(ackResult).toBeNull();
  });
});

describe('applyUserAcknowledgment', () => {
  it('TC18: marks tendency as user-acknowledged', () => {
    const tendencies = [makeMode({ modeId: 'kwetsbaar_kind', frequency: 3, confidence: 0.8 })];
    const { tendencies: result, result: ackResult } = applyUserAcknowledgment(tendencies, 'modeId', 'kwetsbaar_kind', NOW);
    expect(result[0].userAcknowledged).toBe(true);
    expect(result[0].userAcknowledgedAt).toBe(NOW);
    expect(result[0].acknowledgmentScore).toBe(2);
    expect(ackResult!.newlyAcknowledged).toBe(true);
    expect(ackResult!.source).toBe('user');
  });

  it('TC19: user ack does NOT confirm alone', () => {
    const tendencies = [makeMode({ modeId: 'target', frequency: 4, confidence: 0.8 })];
    const { tendencies: result, result: ackResult } = applyUserAcknowledgment(tendencies, 'modeId', 'target', NOW);
    expect(result[0].confirmed).toBeUndefined();
    expect(ackResult!.triggeredConfirmation).toBe(false);
  });

  it('TC20: user ack + clinical ack + auto threshold = CONFIRMED (Path A)', () => {
    const tendencies = [makeMode({ modeId: 'target', frequency: 4, confidence: 0.8, clinicalAcknowledged: true, acknowledgmentScore: 2 })];
    const { tendencies: result, result: ackResult } = applyUserAcknowledgment(tendencies, 'modeId', 'target', NOW);
    expect(result[0].confirmed).toBe(true);
    expect(ackResult!.triggeredConfirmation).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: applyAutoConfirmation (V2 — only confirms multi-source)
// ═══════════════════════════════════════════════════════════════════

describe('applyAutoConfirmation — V2', () => {
  it('TC21: does NOT confirm with freq+conf alone (no acks)', () => {
    const tendencies = [makeSchema({ frequency: 6, confidence: 0.8 })];
    const result = applyAutoConfirmation(tendencies, NOW);
    expect(result[0].confirmed).toBeUndefined();
  });

  it('TC22: confirms overwhelming frequency (≥8)', () => {
    const tendencies = [makeSchema({ frequency: 8, confidence: 0.5 })];
    const result = applyAutoConfirmation(tendencies, NOW);
    expect(result[0].confirmed).toBe(true);
    expect(result[0].confirmedAt).toBe(NOW);
  });

  it('TC23: confirms multi-source (auto + clinical + freq≥5)', () => {
    const tendencies = [makeSchema({ frequency: 5, confidence: 0.8, clinicalAcknowledged: true })];
    const result = applyAutoConfirmation(tendencies, NOW);
    expect(result[0].confirmed).toBe(true);
  });

  it('TC24: does not mutate input', () => {
    const original = [makeSchema({ frequency: 8, confidence: 0.8 })];
    const result = applyAutoConfirmation(original, NOW);
    expect(result).not.toBe(original);
    expect(original[0].confirmed).toBeUndefined();
  });

  it('TC25: already confirmed entries are not re-confirmed', () => {
    const oldDate = '2026-06-01T00:00:00.000Z';
    const tendencies = [makeSchema({ frequency: 10, confidence: 0.9, confirmed: true, confirmedAt: oldDate })];
    const result = applyAutoConfirmation(tendencies, NOW);
    expect(result[0].confirmedAt).toBe(oldDate);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Filtering — getAcknowledgedCandidates
// ═══════════════════════════════════════════════════════════════════

describe('getAcknowledgedCandidates', () => {
  it('TC26: returns acknowledged but not confirmed tendencies', () => {
    const tendencies = [
      makeSchema({ schemaId: 'ack_clinical', clinicalAcknowledged: true }),
      makeSchema({ schemaId: 'ack_user', userAcknowledged: true }),
      makeSchema({ schemaId: 'confirmed', confirmed: true, clinicalAcknowledged: true }),
      makeSchema({ schemaId: 'plain_candidate' }),
    ];
    const result = getAcknowledgedCandidates(tendencies);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.schemaId)).toEqual(['ack_clinical', 'ack_user']);
  });

  it('TC27: returns empty when no acknowledged candidates', () => {
    const tendencies = [
      makeSchema({ schemaId: 'plain' }),
      makeSchema({ schemaId: 'confirmed', confirmed: true }),
    ];
    expect(getAcknowledgedCandidates(tendencies)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: User Self-Acknowledgment Detection (NLU)
// ═══════════════════════════════════════════════════════════════════

describe('detectUserAcknowledgment', () => {
  it('TC28: detects Dutch acknowledgment "ja dat herken ik"', () => {
    expect(detectUserAcknowledgment('Ja dat herken ik inderdaad')).toBe(true);
  });

  it('TC29: detects Dutch acknowledgment "dat klopt"', () => {
    expect(detectUserAcknowledgment('Ja dat klopt helemaal')).toBe(true);
  });

  it('TC30: detects Dutch acknowledgment "zo voelt het"', () => {
    expect(detectUserAcknowledgment('Ja zo voelt het precies')).toBe(true);
  });

  it('TC31: detects English acknowledgment "yes I recognize that"', () => {
    expect(detectUserAcknowledgment('yes i recognize that pattern')).toBe(true);
  });

  it('TC32: detects "altijd hetzelfde patroon"', () => {
    expect(detectUserAcknowledgment('Het is altijd hetzelfde patroon bij mij')).toBe(true);
  });

  it('TC33: does NOT match short messages (< 3 words)', () => {
    expect(detectUserAcknowledgment('ja')).toBe(false);
    expect(detectUserAcknowledgment('ok')).toBe(false);
  });

  it('TC34: does NOT match unrelated messages', () => {
    expect(detectUserAcknowledgment('Ik heb vandaag veel gedronken')).toBe(false);
    expect(detectUserAcknowledgment('Hoe gaat het met jou?')).toBe(false);
  });

  it('TC35: case insensitive matching', () => {
    expect(detectUserAcknowledgment('DAT KLOPT HELEMAAL')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Clinical Acknowledgment Detection
// ═══════════════════════════════════════════════════════════════════

describe('detectClinicalAcknowledgment', () => {
  it('TC36: detects "bevestig schema"', () => {
    expect(detectClinicalAcknowledgment('bevestig schema verlating')).toBe(true);
  });

  it('TC37: detects "confirm mode"', () => {
    expect(detectClinicalAcknowledgment('confirm mode vulnerable child')).toBe(true);
  });

  it('TC38: detects "patroon bevestigd"', () => {
    expect(detectClinicalAcknowledgment('Dit patroon bevestigd na 3 sessies')).toBe(true);
  });

  it('TC39: does NOT match regular clinical messages', () => {
    expect(detectClinicalAcknowledgment('De gebruiker toont vermijdingsgedrag')).toBe(false);
  });

  it('TC40: case insensitive', () => {
    expect(detectClinicalAcknowledgment('BEVESTIG SCHEMA wantrouwen')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Utility Functions
// ═══════════════════════════════════════════════════════════════════

describe('isAcknowledged', () => {
  it('TC41: returns true for clinical ack', () => {
    expect(isAcknowledged({ clinicalAcknowledged: true })).toBe(true);
  });

  it('TC42: returns true for user ack', () => {
    expect(isAcknowledged({ userAcknowledged: true })).toBe(true);
  });

  it('TC43: returns false for no acks', () => {
    expect(isAcknowledged({})).toBe(false);
  });
});

describe('getAcknowledgmentStatus', () => {
  it('TC44: returns "both" when both acknowledged', () => {
    expect(getAcknowledgmentStatus({ clinicalAcknowledged: true, userAcknowledged: true })).toBe('both');
  });

  it('TC45: returns "clinical" for clinical only', () => {
    expect(getAcknowledgmentStatus({ clinicalAcknowledged: true })).toBe('clinical');
  });

  it('TC46: returns "user" for user only', () => {
    expect(getAcknowledgmentStatus({ userAcknowledged: true })).toBe('user');
  });

  it('TC47: returns "none" for no acks', () => {
    expect(getAcknowledgmentStatus({})).toBe('none');
  });
});

describe('meetsAutoDetectThreshold', () => {
  it('TC48: true when freq≥3 and conf≥0.7', () => {
    expect(meetsAutoDetectThreshold({ frequency: 3, confidence: 0.7 })).toBe(true);
  });

  it('TC49: false when freq<3', () => {
    expect(meetsAutoDetectThreshold({ frequency: 2, confidence: 0.9 })).toBe(false);
  });

  it('TC50: false when conf<0.7', () => {
    expect(meetsAutoDetectThreshold({ frequency: 5, confidence: 0.6 })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: getConfirmationStats (V2 — includes acknowledged count)
// ═══════════════════════════════════════════════════════════════════

describe('getConfirmationStats — V2', () => {
  it('TC51: returns correct stats with acknowledged category', () => {
    const tendencies = [
      makeSchema({ confirmed: true }),
      makeSchema({ clinicalAcknowledged: true }),
      makeSchema({ userAcknowledged: true }),
      makeSchema({}),
    ];
    const stats = getConfirmationStats(tendencies);
    expect(stats.total).toBe(4);
    expect(stats.confirmed).toBe(1);
    expect(stats.acknowledged).toBe(2);
    expect(stats.candidates).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Legacy Compatibility
// ═══════════════════════════════════════════════════════════════════

describe('confirmTendencyById — legacy', () => {
  it('TC52: still works for direct confirmation', () => {
    const tendencies = [makeSchema({ schemaId: 'target', frequency: 2 })];
    const result = confirmTendencyById(tendencies, 'schemaId', 'target', NOW);
    expect(result[0].confirmed).toBe(true);
    expect(result[0].confirmedAt).toBe(NOW);
  });
});

describe('getConfirmedOnly', () => {
  it('TC53: returns only confirmed tendencies', () => {
    const tendencies = [
      makeSchema({ schemaId: 'confirmed1', confirmed: true }),
      makeSchema({ schemaId: 'ack_only', clinicalAcknowledged: true }),
      makeSchema({ schemaId: 'plain' }),
    ];
    const result = getConfirmedOnly(tendencies);
    expect(result).toHaveLength(1);
    expect((result[0] as any).schemaId).toBe('confirmed1');
  });
});

describe('getAllCandidates', () => {
  it('TC54: returns all tendencies regardless of status', () => {
    const tendencies = [
      makeSchema({ confirmed: true }),
      makeSchema({ clinicalAcknowledged: true }),
      makeSchema({}),
    ];
    expect(getAllCandidates(tendencies)).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Exported Thresholds
// ═══════════════════════════════════════════════════════════════════

describe('Exported thresholds', () => {
  it('TC55: AUTO_CONFIRM_FREQUENCY_THRESHOLD is 3', () => {
    expect(AUTO_CONFIRM_FREQUENCY_THRESHOLD).toBe(3);
  });

  it('TC56: AUTO_CONFIRM_CONFIDENCE_THRESHOLD is 0.7', () => {
    expect(AUTO_CONFIRM_CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  it('TC57: MULTI_SOURCE_FREQUENCY_THRESHOLD is 5', () => {
    expect(MULTI_SOURCE_FREQUENCY_THRESHOLD).toBe(5);
  });

  it('TC58: OVERWHELMING_FREQUENCY_THRESHOLD is 8', () => {
    expect(OVERWHELMING_FREQUENCY_THRESHOLD).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION: Integration — KNOWN USER PATTERNS gating
// ═══════════════════════════════════════════════════════════════════

describe('KNOWN USER PATTERNS gating (V2 integration)', () => {
  function simulateBuildKnownUserPatterns(userDat: {
    schemaTendencies?: Array<{ schemaId: string; confidence?: number; confirmed?: boolean; clinicalAcknowledged?: boolean; userAcknowledged?: boolean }>;
    modeTendencies?: Array<{ modeId: string; confidence?: number; confirmed?: boolean; clinicalAcknowledged?: boolean; userAcknowledged?: boolean }>;
  }) {
    // Normal mode: only CONFIRMED
    const schemas = (userDat.schemaTendencies || [])
      .filter(s => s.confirmed === true && (s.confidence ?? 0) >= 0.35)
      .map(s => ({ name: s.schemaId, confidence: s.confidence ?? 0 }));
    const modes = (userDat.modeTendencies || [])
      .filter(m => m.confirmed === true && (m.confidence ?? 0) >= 0.35)
      .map(m => ({ name: m.modeId, confidence: m.confidence ?? 0 }));
    if (schemas.length === 0 && modes.length === 0) return null;
    return { schemas, modes };
  }

  it('TC59: acknowledged-only schemas are NOT in KNOWN USER PATTERNS', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.9, clinicalAcknowledged: true }, // NOT confirmed
      ],
    });
    expect(result).toBeNull();
  });

  it('TC60: only multi-source confirmed schemas appear in KNOWN USER PATTERNS', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.9, confirmed: true }, // Properly confirmed
        { schemaId: 'wantrouwen', confidence: 0.8, clinicalAcknowledged: true, userAcknowledged: true }, // Acknowledged but not confirmed
      ],
    });
    expect(result!.schemas).toHaveLength(1);
    expect(result!.schemas[0].name).toBe('verlating');
  });
});
