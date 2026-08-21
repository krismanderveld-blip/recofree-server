/**
 * TESTS: Tendency-to-Canonical Promotion Bridge
 * 
 * Tests the bridge that promotes confirmed schemaTendencies/modeTendencies
 * (detected from chat) to canonical schemas/modes (used by buildPersonalClinicalContext).
 * 
 * PROMOTION RULES:
 * 1. schemaTendency with confirmed=true → promote to canonical schemas[]
 * 2. modeTendency with confirmed=true → promote to canonical modes[]
 * 3. Map schemaId → schema, modeId → mode (same enum values)
 * 4. Set evidenceType='inferred' (chat-detected, not backpack-analyzed)
 * 5. Set sourceLayer='chat_tendency_promotion'
 * 6. Dedup: if schema already in canonical, update only if confidence higher
 * 7. Never overwrite deep-analysis canonical with lower confidence
 * 8. Persona separation: Elias tendencies → Elias canonical only
 * 9. No raw data dump
 * 10. Pure function, no side effects
 */
import { describe, it, expect } from 'vitest';
import { promoteTendenciesToCanonical } from '@/lib/engine/shared/tendency-canonical-bridge';

// ── TEST DATA ──────────────────────────────────────────────────────────────
const CONFIRMED_SCHEMA_TENDENCIES = [
  { schemaId: 'abandonment', domain: 'DISCONNECTION_REJECTION', frequency: 7, lastSeen: '2026-08-20', copingStyle: 'AVOIDANCE', confidence: 0.8, confirmed: true, confirmedAt: '2026-08-20T10:00:00Z', firstDetectedAt: '2026-08-15T08:00:00Z', lastUpdatedAt: '2026-08-20T10:00:00Z' },
  { schemaId: 'emotional_deprivation', domain: 'DISCONNECTION_REJECTION', frequency: 5, lastSeen: '2026-08-19', copingStyle: null, confidence: 0.7, confirmed: true, confirmedAt: '2026-08-19T12:00:00Z', firstDetectedAt: '2026-08-14T09:00:00Z', lastUpdatedAt: '2026-08-19T12:00:00Z' },
];

const UNCONFIRMED_SCHEMA_TENDENCIES = [
  { schemaId: 'defectiveness_shame', domain: 'DISCONNECTION_REJECTION', frequency: 2, lastSeen: '2026-08-18', copingStyle: null, confidence: 0.4, confirmed: false, firstDetectedAt: '2026-08-17T08:00:00Z', lastUpdatedAt: '2026-08-18T08:00:00Z' },
];

const CONFIRMED_MODE_TENDENCIES = [
  { modeId: 'vulnerable_child', frequency: 8, lastSeen: '2026-08-20', effectiveInterventions: ['validation'], confidence: 0.85, confirmed: true, confirmedAt: '2026-08-20T10:00:00Z', firstDetectedAt: '2026-08-14T08:00:00Z', lastUpdatedAt: '2026-08-20T10:00:00Z' },
  { modeId: 'detached_protector', frequency: 6, lastSeen: '2026-08-19', effectiveInterventions: ['gentle_confrontation'], confidence: 0.75, confirmed: true, confirmedAt: '2026-08-19T12:00:00Z', firstDetectedAt: '2026-08-15T09:00:00Z', lastUpdatedAt: '2026-08-19T12:00:00Z' },
];

const UNCONFIRMED_MODE_TENDENCIES = [
  { modeId: 'angry_child', frequency: 1, lastSeen: '2026-08-18', effectiveInterventions: [], confidence: 0.3, confirmed: false, firstDetectedAt: '2026-08-18T08:00:00Z', lastUpdatedAt: '2026-08-18T08:00:00Z' },
];

const EXISTING_CANONICAL_SCHEMAS = [
  { schema: 'insufficient_self_control', evidenceType: 'explicit', confidence: 0.9, doNotDiagnose: true },
];

const EXISTING_CANONICAL_MODES = [
  { mode: 'impulsive_child', evidenceType: 'explicit', confidence: 0.8, doNotDiagnose: true },
];

// ── TEST 1: BASIC PROMOTION ──────────────────────────────────────────────
describe('Basic promotion: confirmed tendencies → canonical', () => {
  it('promotes confirmed schemaTendencies to canonical schemas', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: CONFIRMED_SCHEMA_TENDENCIES,
      modeTendencies: [],
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(2);
    expect(result.promotedSchemas[0].schema).toBe('abandonment');
    expect(result.promotedSchemas[0].confidence).toBe(0.8);
    expect(result.promotedSchemas[0].evidenceType).toBe('inferred');
    expect(result.promotedSchemas[0].sourceLayer).toBe('chat_tendency_promotion');
    expect(result.promotedSchemas[1].schema).toBe('emotional_deprivation');
  });

  it('promotes confirmed modeTendencies to canonical modes', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [],
      modeTendencies: CONFIRMED_MODE_TENDENCIES,
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedModes).toHaveLength(2);
    expect(result.promotedModes[0].mode).toBe('vulnerable_child');
    expect(result.promotedModes[0].confidence).toBe(0.85);
    expect(result.promotedModes[0].evidenceType).toBe('inferred');
    expect(result.promotedModes[0].sourceLayer).toBe('chat_tendency_promotion');
  });

  it('does NOT promote unconfirmed tendencies', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: UNCONFIRMED_SCHEMA_TENDENCIES,
      modeTendencies: UNCONFIRMED_MODE_TENDENCIES,
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(0);
    expect(result.promotedModes).toHaveLength(0);
  });
});

// ── TEST 2: DEDUP WITH EXISTING CANONICAL ──────────────────────────────
describe('Dedup: tendency vs existing canonical', () => {
  it('does NOT overwrite existing canonical schema with lower confidence', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [
        { schemaId: 'insufficient_self_control', domain: 'IMPAIRED_LIMITS', frequency: 5, lastSeen: '2026-08-20', copingStyle: null, confidence: 0.7, confirmed: true, confirmedAt: '2026-08-20T10:00:00Z' },
      ],
      modeTendencies: [],
      existingSchemas: EXISTING_CANONICAL_SCHEMAS, // has insufficient_self_control at 0.9
      existingModes: [],
    });
    // Should not promote because existing canonical has higher confidence (0.9 > 0.7)
    expect(result.promotedSchemas).toHaveLength(0);
    expect(result.skippedSchemas).toContain('insufficient_self_control');
  });

  it('DOES promote tendency with higher confidence than existing canonical', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [
        { schemaId: 'insufficient_self_control', domain: 'IMPAIRED_LIMITS', frequency: 10, lastSeen: '2026-08-20', copingStyle: null, confidence: 0.95, confirmed: true, confirmedAt: '2026-08-20T10:00:00Z' },
      ],
      modeTendencies: [],
      existingSchemas: EXISTING_CANONICAL_SCHEMAS, // has insufficient_self_control at 0.9
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(1);
    expect(result.promotedSchemas[0].confidence).toBe(0.95);
    expect(result.promotedSchemas[0].isUpdate).toBe(true);
  });

  it('adds NEW tendency alongside existing canonical schemas', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: CONFIRMED_SCHEMA_TENDENCIES, // abandonment + emotional_deprivation
      modeTendencies: [],
      existingSchemas: EXISTING_CANONICAL_SCHEMAS, // insufficient_self_control
      existingModes: [],
    });
    // Should add 2 new schemas (abandonment, emotional_deprivation) alongside existing
    expect(result.promotedSchemas).toHaveLength(2);
    expect(result.mergedSchemas).toHaveLength(3); // 1 existing + 2 new
  });
});

// ── TEST 3: MIXED CONFIRMED + UNCONFIRMED ──────────────────────────────
describe('Mixed confirmed and unconfirmed', () => {
  it('only promotes confirmed, ignores unconfirmed', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [...CONFIRMED_SCHEMA_TENDENCIES, ...UNCONFIRMED_SCHEMA_TENDENCIES],
      modeTendencies: [...CONFIRMED_MODE_TENDENCIES, ...UNCONFIRMED_MODE_TENDENCIES],
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(2); // only confirmed
    expect(result.promotedModes).toHaveLength(2); // only confirmed
    expect(result.promotedSchemas.find((s: any) => s.schema === 'defectiveness_shame')).toBeUndefined();
    expect(result.promotedModes.find((m: any) => m.mode === 'angry_child')).toBeUndefined();
  });
});

// ── TEST 4: EDGE CASES ──────────────────────────────────────────────────
describe('Edge cases', () => {
  it('handles empty tendencies', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [],
      modeTendencies: [],
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(0);
    expect(result.promotedModes).toHaveLength(0);
    expect(result.mergedSchemas).toHaveLength(0);
    expect(result.mergedModes).toHaveLength(0);
  });

  it('handles undefined tendencies', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: undefined as any,
      modeTendencies: undefined as any,
      existingSchemas: [],
      existingModes: [],
    });
    expect(result.promotedSchemas).toHaveLength(0);
    expect(result.promotedModes).toHaveLength(0);
  });

  it('handles null confidence gracefully', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [
        { schemaId: 'abandonment', domain: 'DISCONNECTION_REJECTION', frequency: 5, lastSeen: '2026-08-20', copingStyle: null, confidence: undefined as any, confirmed: true, confirmedAt: '2026-08-20T10:00:00Z' },
      ],
      modeTendencies: [],
      existingSchemas: [],
      existingModes: [],
    });
    // Should still promote with default confidence
    expect(result.promotedSchemas).toHaveLength(1);
    expect(result.promotedSchemas[0].confidence).toBe(0.5); // default
  });

  it('preserves doNotDiagnose=true on all promoted items', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: CONFIRMED_SCHEMA_TENDENCIES,
      modeTendencies: CONFIRMED_MODE_TENDENCIES,
      existingSchemas: [],
      existingModes: [],
    });
    for (const s of result.promotedSchemas) {
      expect(s.doNotDiagnose).toBe(true);
    }
    for (const m of result.promotedModes) {
      expect(m.doNotDiagnose).toBe(true);
    }
  });
});

// ── TEST 5: REPORT ──────────────────────────────────────────────────────
describe('Promotion report', () => {
  it('returns a report with counts', () => {
    const result = promoteTendenciesToCanonical({
      schemaTendencies: [...CONFIRMED_SCHEMA_TENDENCIES, ...UNCONFIRMED_SCHEMA_TENDENCIES],
      modeTendencies: [...CONFIRMED_MODE_TENDENCIES, ...UNCONFIRMED_MODE_TENDENCIES],
      existingSchemas: EXISTING_CANONICAL_SCHEMAS,
      existingModes: EXISTING_CANONICAL_MODES,
    });
    expect(result.report.schemasPromoted).toBe(2);
    expect(result.report.modesPromoted).toBe(2);
    expect(result.report.schemasSkipped).toBeGreaterThanOrEqual(0);
    expect(result.report.modesSkipped).toBeGreaterThanOrEqual(0);
    expect(result.report.totalCanonicalSchemas).toBe(3); // 1 existing + 2 promoted
    expect(result.report.totalCanonicalModes).toBe(3); // 1 existing + 2 promoted
  });
});
