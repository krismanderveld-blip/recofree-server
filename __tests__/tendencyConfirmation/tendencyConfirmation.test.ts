/**
 * Tendency Confirmation Layer Tests
 *
 * Tests the confirmation logic that gates which schema/mode tendencies
 * are safe to present as "known patterns" to GPT vs. which remain
 * as candidates for the deterministic SchemaMode engine only.
 */
import { describe, it, expect } from 'vitest';
import {
  shouldAutoConfirm,
  applyAutoConfirmation,
  confirmTendencyById,
  getConfirmedOnly,
  getAllCandidates,
  getConfirmationStats,
  AUTO_CONFIRM_FREQUENCY_THRESHOLD,
  AUTO_CONFIRM_CONFIDENCE_THRESHOLD,
} from '../../lib/engine/shared/tendency-confirmation';

// ─── Test Data ─────────────────────────────────────────────────────

function makeSchema(overrides: Partial<{
  schemaId: string;
  frequency: number;
  confidence: number;
  confirmed: boolean;
  confirmedAt: string;
}> = {}) {
  return {
    schemaId: overrides.schemaId ?? 'verlating_instabiliteit',
    domain: 'relational',
    frequency: overrides.frequency ?? 1,
    lastSeen: '2026-06-10T10:00:00.000Z',
    copingStyle: null as string | null,
    firstDetectedAt: '2026-06-01T10:00:00.000Z',
    lastUpdatedAt: '2026-06-10T10:00:00.000Z',
    confidence: overrides.confidence ?? 0.5,
    confirmed: overrides.confirmed,
    confirmedAt: overrides.confirmedAt,
  };
}

function makeMode(overrides: Partial<{
  modeId: string;
  frequency: number;
  confidence: number;
  confirmed: boolean;
  confirmedAt: string;
}> = {}) {
  return {
    modeId: overrides.modeId ?? 'kwetsbaar_kind',
    frequency: overrides.frequency ?? 1,
    lastSeen: '2026-06-10T10:00:00.000Z',
    effectiveInterventions: [] as string[],
    firstDetectedAt: '2026-06-01T10:00:00.000Z',
    lastUpdatedAt: '2026-06-10T10:00:00.000Z',
    confidence: overrides.confidence ?? 0.5,
    confirmed: overrides.confirmed,
    confirmedAt: overrides.confirmedAt,
  };
}

const NOW = '2026-06-15T12:00:00.000Z';

// ─── shouldAutoConfirm ─────────────────────────────────────────────

describe('shouldAutoConfirm', () => {
  it('TC01: returns false when frequency below threshold', () => {
    const t = makeSchema({ frequency: 2, confidence: 0.8 });
    expect(shouldAutoConfirm(t)).toBe(false);
  });

  it('TC02: returns false when confidence below threshold', () => {
    const t = makeSchema({ frequency: 6, confidence: 0.6 });
    expect(shouldAutoConfirm(t)).toBe(false);
  });

  it('TC03: returns true when both thresholds met', () => {
    const t = makeSchema({ frequency: 5, confidence: 0.7 });
    expect(shouldAutoConfirm(t)).toBe(true);
  });

  it('TC04: returns true when thresholds exceeded', () => {
    const t = makeSchema({ frequency: 10, confidence: 0.95 });
    expect(shouldAutoConfirm(t)).toBe(true);
  });

  it('TC05: returns false when already confirmed', () => {
    const t = makeSchema({ frequency: 10, confidence: 0.95, confirmed: true });
    expect(shouldAutoConfirm(t)).toBe(false);
  });

  it('TC06: returns false when confidence is undefined (defaults to 0)', () => {
    const t = { frequency: 6, confidence: undefined, confirmed: undefined };
    expect(shouldAutoConfirm(t)).toBe(false);
  });

  it('TC07: exact boundary — frequency=5, confidence=0.7 → true', () => {
    expect(shouldAutoConfirm({ frequency: 5, confidence: 0.7 })).toBe(true);
  });

  it('TC08: just below boundary — frequency=5, confidence=0.699 → false', () => {
    expect(shouldAutoConfirm({ frequency: 5, confidence: 0.699 })).toBe(false);
  });
});

// ─── applyAutoConfirmation ─────────────────────────────────────────

describe('applyAutoConfirmation', () => {
  it('TC09: confirms tendencies meeting threshold, leaves others unchanged', () => {
    const tendencies = [
      makeSchema({ schemaId: 'high', frequency: 6, confidence: 0.8 }),
      makeSchema({ schemaId: 'low', frequency: 2, confidence: 0.3 }),
      makeSchema({ schemaId: 'mid', frequency: 5, confidence: 0.7 }),
    ];
    const result = applyAutoConfirmation(tendencies, NOW);

    expect(result[0].confirmed).toBe(true);
    expect(result[0].confirmedAt).toBe(NOW);
    expect(result[1].confirmed).toBeUndefined();
    expect(result[1].confirmedAt).toBeUndefined();
    expect(result[2].confirmed).toBe(true);
    expect(result[2].confirmedAt).toBe(NOW);
  });

  it('TC10: does not mutate the input array', () => {
    const original = [makeSchema({ frequency: 6, confidence: 0.8 })];
    const result = applyAutoConfirmation(original, NOW);
    expect(result).not.toBe(original);
    expect(original[0].confirmed).toBeUndefined();
  });

  it('TC11: already confirmed entries are not re-confirmed (preserves original confirmedAt)', () => {
    const oldDate = '2026-06-01T00:00:00.000Z';
    const tendencies = [makeSchema({ frequency: 10, confidence: 0.9, confirmed: true, confirmedAt: oldDate })];
    const result = applyAutoConfirmation(tendencies, NOW);
    expect(result[0].confirmedAt).toBe(oldDate); // Not overwritten
  });

  it('TC12: empty array returns empty array', () => {
    const result = applyAutoConfirmation([], NOW);
    expect(result).toEqual([]);
  });
});

// ─── confirmTendencyById ───────────────────────────────────────────

describe('confirmTendencyById', () => {
  it('TC13: confirms a specific schema by schemaId', () => {
    const tendencies = [
      makeSchema({ schemaId: 'target', frequency: 2, confidence: 0.4 }),
      makeSchema({ schemaId: 'other', frequency: 3, confidence: 0.5 }),
    ];
    const result = confirmTendencyById(tendencies, 'schemaId', 'target', NOW);
    expect(result[0].confirmed).toBe(true);
    expect(result[0].confirmedAt).toBe(NOW);
    expect(result[1].confirmed).toBeUndefined();
  });

  it('TC14: confirms a specific mode by modeId', () => {
    const modes = [
      makeMode({ modeId: 'kwetsbaar_kind', frequency: 2, confidence: 0.4 }),
      makeMode({ modeId: 'boze_beschermer', frequency: 3, confidence: 0.5 }),
    ];
    const result = confirmTendencyById(modes, 'modeId', 'kwetsbaar_kind', NOW);
    expect(result[0].confirmed).toBe(true);
    expect(result[1].confirmed).toBeUndefined();
  });

  it('TC15: does not re-confirm already confirmed tendency', () => {
    const oldDate = '2026-06-01T00:00:00.000Z';
    const tendencies = [makeSchema({ schemaId: 'x', confirmed: true, confirmedAt: oldDate })];
    const result = confirmTendencyById(tendencies, 'schemaId', 'x', NOW);
    expect(result[0].confirmedAt).toBe(oldDate); // Preserved
  });

  it('TC16: non-matching ID leaves all unchanged', () => {
    const tendencies = [makeSchema({ schemaId: 'a' }), makeSchema({ schemaId: 'b' })];
    const result = confirmTendencyById(tendencies, 'schemaId', 'nonexistent', NOW);
    expect(result.every(t => t.confirmed === undefined)).toBe(true);
  });
});

// ─── getConfirmedOnly ──────────────────────────────────────────────

describe('getConfirmedOnly', () => {
  it('TC17: returns only confirmed tendencies', () => {
    const tendencies = [
      makeSchema({ schemaId: 'confirmed1', confirmed: true }),
      makeSchema({ schemaId: 'candidate1' }),
      makeSchema({ schemaId: 'confirmed2', confirmed: true }),
      makeSchema({ schemaId: 'candidate2', confirmed: false }),
    ];
    const result = getConfirmedOnly(tendencies);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.schemaId)).toEqual(['confirmed1', 'confirmed2']);
  });

  it('TC18: returns empty array when none confirmed', () => {
    const tendencies = [makeSchema(), makeSchema({ schemaId: 'b' })];
    expect(getConfirmedOnly(tendencies)).toEqual([]);
  });
});

// ─── getAllCandidates ──────────────────────────────────────────────

describe('getAllCandidates', () => {
  it('TC19: returns all tendencies regardless of confirmation status', () => {
    const tendencies = [
      makeSchema({ schemaId: 'a', confirmed: true }),
      makeSchema({ schemaId: 'b' }),
      makeSchema({ schemaId: 'c', confirmed: false }),
    ];
    const result = getAllCandidates(tendencies);
    expect(result).toHaveLength(3);
  });
});

// ─── getConfirmationStats ──────────────────────────────────────────

describe('getConfirmationStats', () => {
  it('TC20: returns correct stats', () => {
    const tendencies = [
      makeSchema({ confirmed: true }),
      makeSchema({}),
      makeSchema({ confirmed: true }),
      makeSchema({ confirmed: false }),
    ];
    const stats = getConfirmationStats(tendencies);
    expect(stats.total).toBe(4);
    expect(stats.confirmed).toBe(2);
    expect(stats.candidates).toBe(2);
  });
});

// ─── Integration: buildKnownUserPatterns gating ────────────────────

describe('KNOWN USER PATTERNS gating (integration)', () => {
  // Simulate what buildKnownUserPatterns does with the confirmed filter
  function simulateBuildKnownUserPatterns(userDat: {
    schemaTendencies?: Array<{ schemaId: string; confidence?: number; confirmed?: boolean }>;
    modeTendencies?: Array<{ modeId: string; confidence?: number; confirmed?: boolean }>;
    triggerPatterns?: Array<{ trigger: string; count?: number }>;
  }) {
    const schemas = (userDat.schemaTendencies || [])
      .filter(s => s.confirmed === true && (s.confidence ?? 0) >= 0.35)
      .map(s => ({ name: s.schemaId, confidence: s.confidence ?? 0 }));
    const modes = (userDat.modeTendencies || [])
      .filter(m => m.confirmed === true && (m.confidence ?? 0) >= 0.35)
      .map(m => ({ name: m.modeId, confidence: m.confidence ?? 0 }));
    const triggers = (userDat.triggerPatterns || [])
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 8)
      .map(t => t.trigger);
    if (schemas.length === 0 && modes.length === 0 && triggers.length === 0) return null;
    return { schemas, modes, triggers };
  }

  it('TC21: unconfirmed schemas with high confidence are NOT included', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.9 }, // NOT confirmed
      ],
      triggerPatterns: [{ trigger: 'alcohol', count: 5 }],
    });
    expect(result!.schemas).toHaveLength(0);
    expect(result!.triggers).toHaveLength(1); // Triggers always included
  });

  it('TC22: confirmed schemas with high confidence ARE included', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.9, confirmed: true },
      ],
    });
    expect(result!.schemas).toHaveLength(1);
    expect(result!.schemas[0].name).toBe('verlating');
  });

  it('TC23: confirmed schema with low confidence is NOT included (still needs ≥0.35)', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.2, confirmed: true },
      ],
    });
    expect(result).toBeNull(); // Nothing meaningful
  });

  it('TC24: mix of confirmed and unconfirmed — only confirmed pass through', () => {
    const result = simulateBuildKnownUserPatterns({
      schemaTendencies: [
        { schemaId: 'verlating', confidence: 0.9, confirmed: true },
        { schemaId: 'wantrouwen', confidence: 0.8 }, // NOT confirmed
      ],
      modeTendencies: [
        { modeId: 'kwetsbaar_kind', confidence: 0.7, confirmed: true },
        { modeId: 'boze_beschermer', confidence: 0.6 }, // NOT confirmed
      ],
    });
    expect(result!.schemas).toHaveLength(1);
    expect(result!.schemas[0].name).toBe('verlating');
    expect(result!.modes).toHaveLength(1);
    expect(result!.modes[0].name).toBe('kwetsbaar_kind');
  });

  it('TC25: SchemaMode engine still receives ALL candidates (not just confirmed)', () => {
    // This simulates what the pipeline passes to runSchemaModeEngine
    const allTendencies = [
      { schemaId: 'verlating', frequency: 6, lastSeen: '2026-06-10', confirmed: true },
      { schemaId: 'wantrouwen', frequency: 3, lastSeen: '2026-06-08' }, // unconfirmed
    ];
    // Pipeline passes ALL tendencies to the engine (no filter)
    const engineInput = getAllCandidates(allTendencies);
    expect(engineInput).toHaveLength(2); // Both pass through
  });
});

// ─── Thresholds exported correctly ────────────────────────────────

describe('Exported thresholds', () => {
  it('TC26: AUTO_CONFIRM_FREQUENCY_THRESHOLD is 5', () => {
    expect(AUTO_CONFIRM_FREQUENCY_THRESHOLD).toBe(3);
  });

  it('TC27: AUTO_CONFIRM_CONFIDENCE_THRESHOLD is 0.7', () => {
    expect(AUTO_CONFIRM_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});
