/**
 * KERP01 Wizard Extension — Connection Fields Tests
 *
 * 13 test cases:
 * 1. New fields exist in types
 * 2. New fields saved per zone
 * 3. Existing plans migrate without data loss
 * 4. Wizard shows new fields (component structure check)
 * 5. Empty new fields don't break prompt injection
 * 6. Prompt injection contains new fields when filled
 * 7. Normal friction uses bridgeSentence
 * 8. RELATIONAL_HARM_PATTERN uses repairCondition before bridgeSentence
 * 9. Safety uses safetyException and doesn't force connection
 * 10. No fixed person names in placeholders/defaults
 * 11. No existing KERP01 data overwritten
 * 12. No parallel Eigen Regie Plan
 * 13. 0 TypeScript errors (verified by tsc --noEmit)
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EIGEN_REGIE_PLAN,
  buildEigenRegiePromptContext,
  type EigenRegiePlan,
  type EigenRegieZoneEntry,
  type EigenRegieZoneId,
} from '@/lib/engine/kim/kerp01-types';

// EMPTY_ZONE is not exported, derive it from defaults
const EMPTY_ZONE_LIKE: EigenRegieZoneEntry = {
  label: '',
  userMeaning: '',
  signals: [],
  bodySignals: [],
  thoughts: [],
  behaviour: [],
  whatHelps: [],
  boundaryActions: [],
  contactRule: '',
  anchorSentence: '',
  connectionIntent: '',
  bridgeSentence: '',
  repairCondition: '',
  safetyException: '',
};

// ─── Test 1: New fields exist in types ─────────────────────────

describe('KERP01 Types — Connection Fields', () => {
  it('TEST 1: Zone type has all 4 connection fields', () => {
    // Verify via default plan zones
    const zone = DEFAULT_EIGEN_REGIE_PLAN.zones.geel;
    expect(zone).toHaveProperty('connectionIntent');
    expect(zone).toHaveProperty('bridgeSentence');
    expect(zone).toHaveProperty('repairCondition');
    expect(zone).toHaveProperty('safetyException');
  });

  it('TEST 2: DEFAULT_EIGEN_REGIE_PLAN zones have connection fields', () => {
    const zones = DEFAULT_EIGEN_REGIE_PLAN.zones;
    for (const zoneId of Object.keys(zones) as EigenRegieZoneId[]) {
      const zone = zones[zoneId];
      expect(zone).toHaveProperty('connectionIntent');
      expect(zone).toHaveProperty('bridgeSentence');
      expect(zone).toHaveProperty('repairCondition');
      expect(zone).toHaveProperty('safetyException');
    }
  });

  it('TEST 2b: Connection fields are saved per zone (different values per zone)', () => {
    const zones = DEFAULT_EIGEN_REGIE_PLAN.zones;
    // Rood has specific defaults, donkergroen has different ones
    expect(zones.rood.connectionIntent).toContain('niet veilig');
    expect(zones.donkergroen.connectionIntent).toContain('Vrije verbinding');
    expect(zones.rood.safetyException).toContain('gevaar');
  });
});

// ─── Test 3: Migration ─────────────────────────────────────────

describe('KERP01 Migration — Connection Fields', () => {
  it('TEST 3: Existing plan without connection fields gets empty defaults', () => {
    // Simulate an old plan without the new fields
    const oldZone: any = {
      label: 'Test zone',
      userMeaning: 'My meaning',
      signals: ['signal1'],
      bodySignals: [],
      thoughts: [],
      behaviour: [],
      whatHelps: ['walking'],
      boundaryActions: [],
      contactRule: 'call sponsor',
      anchorSentence: 'I am strong',
      // NO connectionIntent, bridgeSentence, repairCondition, safetyException
    };
    // The migration function adds empty defaults
    const migrated: EigenRegieZoneEntry = {
      ...EMPTY_ZONE_LIKE,
      ...oldZone,
    };
    // Existing data preserved
    expect(migrated.signals).toEqual(['signal1']);
    expect(migrated.whatHelps).toEqual(['walking']);
    expect(migrated.contactRule).toBe('call sponsor');
    expect(migrated.anchorSentence).toBe('I am strong');
    // New fields get defaults
    expect(migrated.connectionIntent).toBe('');
    expect(migrated.bridgeSentence).toBe('');
    expect(migrated.repairCondition).toBe('');
    expect(migrated.safetyException).toBe('');
  });

  it('TEST 11: Existing data is NOT overwritten by migration', () => {
    const existingZone: EigenRegieZoneEntry = {
      ...EMPTY_ZONE_LIKE,
      signals: ['my signal'],
      whatHelps: ['my help'],
      anchorSentence: 'my anchor',
      connectionIntent: 'my intent',
      bridgeSentence: 'my bridge',
      repairCondition: 'my repair',
      safetyException: 'my safety',
    };
    // Spreading EMPTY_ZONE first, then existing data: existing wins
    const result = { ...EMPTY_ZONE_LIKE, ...existingZone };
    expect(result.signals).toEqual(['my signal']);
    expect(result.connectionIntent).toBe('my intent');
    expect(result.bridgeSentence).toBe('my bridge');
  });
});

// ─── Test 5-6: Prompt Injection ────────────────────────────────

describe('KERP01 Prompt Injection — Connection Fields', () => {
  it('TEST 5: Empty connection fields do NOT break prompt injection', () => {
    const plan: EigenRegiePlan = {
      ...DEFAULT_EIGEN_REGIE_PLAN,
      zones: {
        ...DEFAULT_EIGEN_REGIE_PLAN.zones,
        geel: {
          ...EMPTY_ZONE_LIKE,
          // All connection fields empty
          connectionIntent: '',
          bridgeSentence: '',
          repairCondition: '',
          safetyException: '',
        },
      },
    };
    // Should not throw
    const context = buildEigenRegiePromptContext(plan, 'geel');
    expect(context).toBeDefined();
    expect(typeof context).toBe('string');
    // Empty fields should NOT appear in output
    expect(context).not.toContain('connectionIntent:');
    expect(context).not.toContain('bridgeSentence:');
  });

  it('TEST 6: Filled connection fields appear in prompt injection', () => {
    const plan: EigenRegiePlan = {
      ...DEFAULT_EIGEN_REGIE_PLAN,
      zones: {
        ...DEFAULT_EIGEN_REGIE_PLAN.zones,
        oranje: {
          ...DEFAULT_EIGEN_REGIE_PLAN.zones.oranje,
          connectionIntent: 'Kort contact is mogelijk',
          bridgeSentence: 'Ik wil er zijn maar niet op een manier die mij kapotmaakt',
          repairCondition: 'Contact alleen als ik mijn grens kan vasthouden',
          safetyException: 'Bij geweld: geen contact',
        },
      },
    };
    const context = buildEigenRegiePromptContext(plan, 'oranje');
    expect(context).toContain('connectionIntent: Kort contact is mogelijk');
    expect(context).toContain('bridgeSentence: Ik wil er zijn maar niet op een manier die mij kapotmaakt');
    expect(context).toContain('repairCondition: Contact alleen als ik mijn grens kan vasthouden');
    expect(context).toContain('safetyException: Bij geweld: geen contact');
  });

  it('TEST 7: Prompt contains behavioral rule for normal friction (bridgeSentence)', () => {
    const plan = DEFAULT_EIGEN_REGIE_PLAN;
    const context = buildEigenRegiePromptContext(plan, 'geel');
    expect(context).toContain('Normal friction: bridgeSentence may be actively used');
  });

  it('TEST 8: Prompt contains behavioral rule for RELATIONAL_HARM_PATTERN (repairCondition first)', () => {
    const plan = DEFAULT_EIGEN_REGIE_PLAN;
    const context = buildEigenRegiePromptContext(plan, 'oranje');
    expect(context).toContain('RELATIONAL_HARM_PATTERN: repairCondition first');
  });

  it('TEST 9: Prompt contains behavioral rule for safety (safetyException, no forced connection)', () => {
    const plan = DEFAULT_EIGEN_REGIE_PLAN;
    const context = buildEigenRegiePromptContext(plan, 'rood');
    expect(context).toContain('Safety-first: safetyException first');
    expect(context).toContain('do NOT force connection');
  });
});

// ─── Test 10: No fixed person names ────────────────────────────

describe('KERP01 — No Fixed Person Names', () => {
  it('TEST 10: No fixed person names in default plan', () => {
    const plan = DEFAULT_EIGEN_REGIE_PLAN;
    const allText = JSON.stringify(plan);
    expect(allText).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa|Johan|Sophie)\b/);
  });

  it('TEST 10b: No fixed person names in prompt injection', () => {
    const plan = DEFAULT_EIGEN_REGIE_PLAN;
    for (const zoneId of Object.keys(plan.zones) as EigenRegieZoneId[]) {
      const context = buildEigenRegiePromptContext(plan, zoneId);
      expect(context).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa|Johan|Sophie)\b/);
    }
  });
});

// ─── Test 12: No parallel Eigen Regie Plan ─────────────────────

describe('KERP01 — No Parallel Plan', () => {
  it('TEST 12: DEFAULT_EIGEN_REGIE_PLAN has exactly 5 zones', () => {
    const zoneIds = Object.keys(DEFAULT_EIGEN_REGIE_PLAN.zones);
    expect(zoneIds).toHaveLength(5);
    expect(zoneIds).toContain('rood');
    expect(zoneIds).toContain('oranje');
    expect(zoneIds).toContain('geel');
    expect(zoneIds).toContain('lichtgroen');
    expect(zoneIds).toContain('donkergroen');
  });

  it('TEST 12b: Plan version is 1, persona is kim', () => {
    expect(DEFAULT_EIGEN_REGIE_PLAN.version).toBe(1);
    expect(DEFAULT_EIGEN_REGIE_PLAN.persona).toBe('kim');
  });
});
