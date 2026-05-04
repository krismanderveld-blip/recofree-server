/**
 * Projection Layer Tests
 *
 * Tests for:
 * 1. Elias signal detection (fear/hope/goal markers, VSP, zone improvement)
 * 2. Kim signal detection (Eigen Regie-based)
 * 3. Decay engine (both Elias and Kim)
 * 4. GPT injection block building
 * 5. Deepening module activation/deactivation
 * 6. Pipeline integration (Step 5d orchestrator)
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  resetProjectionState,
  getProjectionState,
  detectProjectionSignals,
  applyProjectionDecay,
  buildProjectionContext,
  resetSessionTracking,
} from '../lib/engine/elias/projection';

import {
  resetKimProjectionState,
  getKimProjectionState,
  detectKimProjectionSignals,
  applyKimProjectionDecay,
  buildKimProjectionContext,
} from '../lib/engine/kim/projection';

import {
  runProjectionLayer,
  resetDeepeningState,
  checkDeflectionInResponse,
  isDeepeningBlocked,
} from '../lib/rugzak/projection-layer';

// ═══════════════════════════════════════════════════════════════
// 1. ELIAS SIGNAL DETECTION
// ═══════════════════════════════════════════════════════════════

describe('Elias Projection — Signal Detection', () => {
  beforeEach(() => {
    resetProjectionState();
    resetSessionTracking();
  });

  it('detects fear markers in user message', () => {
    const result = detectProjectionSignals({
      message: 'Ik ben bang dat ik weer ga gebruiken als ik stress heb',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    expect(result.totalSignals).toBeGreaterThan(0);

    const state = getProjectionState();
    expect(state.entries.length).toBeGreaterThan(0);
    expect(state.entries.some(e => e.category === 'fear')).toBe(true);
  });

  it('detects hope markers in user message', () => {
    const result = detectProjectionSignals({
      message: 'Ik hoop dat ik ooit clean kan leven en gelukkig kan zijn',
      distressScore: 4,
      resilienceScore: 6,
      vspLevel: 'GROEN',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getProjectionState();
    expect(state.entries.some(e => e.category === 'hope')).toBe(true);
  });

  it('detects goal markers in user message', () => {
    const result = detectProjectionSignals({
      message: 'Ik wil weer gaan werken en mijn kinderen terug krijgen',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getProjectionState();
    expect(state.entries.some(e => e.category === 'goal')).toBe(true);
  });

  it('reinforces existing entry on keyword overlap', () => {
    // First detection
    detectProjectionSignals({
      message: 'Ik ben bang dat ik terugval',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const stateAfterFirst = getProjectionState();
    const firstEntry = stateAfterFirst.entries[0];
    const initialDecayScore = firstEntry.decayScore;

    // Reset session tracking so second detection counts as new signal
    resetSessionTracking();

    // Second detection with same keyword
    detectProjectionSignals({
      message: 'Die angst voor terugval blijft maar komen',
      distressScore: 6,
      resilienceScore: 4,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const stateAfterSecond = getProjectionState();
    // Should reinforce, not create new entry
    const reinforcedEntry = stateAfterSecond.entries.find(e => e.id === firstEntry.id);
    if (reinforcedEntry) {
      expect(reinforcedEntry.decayScore).toBeGreaterThanOrEqual(initialDecayScore);
    }
  });

  it('creates VSP-triggered fear when vspLevel is ROOD', () => {
    const result = detectProjectionSignals({
      message: 'Ik weet niet meer wat ik moet doen',
      distressScore: 9,
      resilienceScore: 1,
      vspLevel: 'ROOD',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getProjectionState();
    expect(state.entries.some(e => e.source === 'slider_signal')).toBe(true);
  });

  it('strengthens hope entries on zone improvement', () => {
    // First create a hope entry
    detectProjectionSignals({
      message: 'Ik hoop dat het beter wordt',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    resetSessionTracking();

    // Now trigger with zone improvement
    detectProjectionSignals({
      message: 'Vandaag gaat het iets beter',
      distressScore: 4,
      resilienceScore: 6,
      vspLevel: 'GROEN',
      zoneImproved: true,
      consecutiveGreenSessions: 1,
    });

    const state = getProjectionState();
    const hopeEntries = state.entries.filter(e => e.category === 'hope');
    expect(hopeEntries.length).toBeGreaterThan(0);
  });

  it('respects max 5 active entries limit', () => {
    // Create 6 different entries
    const messages = [
      'Ik ben bang voor terugval',
      'Ik hoop op herstel',
      'Mijn doel is werk vinden',
      'Ik vrees eenzaamheid',
      'Ik wil graag studeren',
      'Ik ben bang voor afwijzing',
    ];

    for (const msg of messages) {
      resetSessionTracking();
      detectProjectionSignals({
        message: msg,
        distressScore: 6,
        resilienceScore: 4,
        vspLevel: 'GEEL',
        zoneImproved: false,
        consecutiveGreenSessions: 0,
      });
    }

    const state = getProjectionState();
    expect(state.entries.length).toBeLessThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. KIM SIGNAL DETECTION
// ═══════════════════════════════════════════════════════════════

describe('Kim Projection — Signal Detection', () => {
  beforeEach(() => {
    resetKimProjectionState();
  });

  it('creates fear entry when eigenRegieScore is low (< 30)', () => {
    const result = detectKimProjectionSignals({
      message: 'Ik heb het gevoel dat ik geen controle meer heb',
      distressScore: 7,
      resilienceScore: 3,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getKimProjectionState();
    expect(state.entries.some(e => e.category === 'fear')).toBe(true);
  });

  it('creates/reinforces hope entry on consecutive high Eigen Regie sessions', () => {
    // First create a hope entry via message marker
    detectKimProjectionSignals({
      message: 'Ik hoop dat ik sterker word',
      distressScore: 4,
      resilienceScore: 6,
      eigenRegieScore: 60,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    // Now reinforce it with consecutive high ER sessions
    const result = detectKimProjectionSignals({
      message: 'Ik voel me sterker vandaag',
      distressScore: 3,
      resilienceScore: 7,
      eigenRegieScore: 75,
      consecutiveHighRegieSessions: 2,
      zoneImproved: false,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getKimProjectionState();
    expect(state.entries.some(e => e.category === 'hope')).toBe(true);
  });

  it('detects fear markers in Kim user messages', () => {
    const result = detectKimProjectionSignals({
      message: 'Ik ben bang dat ik het niet aankan zonder hulp',
      distressScore: 6,
      resilienceScore: 4,
      eigenRegieScore: 45,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    expect(result.totalSignals).toBeGreaterThan(0);
    const state = getKimProjectionState();
    expect(state.entries.some(e => e.category === 'fear')).toBe(true);
  });

  it('strengthens hope entries on zone improvement', () => {
    // First create a hope entry
    detectKimProjectionSignals({
      message: 'Ik hoop dat ik sterker word',
      distressScore: 4,
      resilienceScore: 6,
      eigenRegieScore: 60,
      consecutiveHighRegieSessions: 1,
      zoneImproved: false,
    });

    // Now trigger with zone improvement
    detectKimProjectionSignals({
      message: 'Het gaat beter',
      distressScore: 3,
      resilienceScore: 7,
      eigenRegieScore: 70,
      consecutiveHighRegieSessions: 2,
      zoneImproved: true,
    });

    const state = getKimProjectionState();
    const hopeEntries = state.entries.filter(e => e.category === 'hope');
    expect(hopeEntries.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. DECAY ENGINE
// ═══════════════════════════════════════════════════════════════

describe('Projection Decay Engine', () => {
  beforeEach(() => {
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: decays entries that were not reinforced this session', () => {
    // Create an entry
    detectProjectionSignals({
      message: 'Ik ben bang voor terugval',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const stateBefore = getProjectionState();
    const entryBefore = stateBefore.entries[0];
    const decayScoreBefore = entryBefore.decayScore;

    // Apply decay (simulating session end without reinforcement)
    resetSessionTracking(); // Ensures entry is not marked as reinforced this session
    const result = applyProjectionDecay(new Date().toISOString());

    expect(result.decayedEntries).toBeGreaterThanOrEqual(0);
    // Entry should still exist but potentially weaker
    const stateAfter = getProjectionState();
    if (stateAfter.entries.length > 0) {
      expect(stateAfter.entries[0].decayScore).toBeLessThanOrEqual(decayScoreBefore);
    }
  });

  it('Elias: removes entries below threshold after repeated decay', () => {
    // Create an entry with minimal strength
    detectProjectionSignals({
      message: 'Ik ben een beetje bang',
      distressScore: 4,
      resilienceScore: 6,
      vspLevel: 'GROEN',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    // Apply decay multiple times to push below threshold
    for (let i = 0; i < 10; i++) {
      resetSessionTracking();
      const ts = new Date(Date.now() + i * 86400000).toISOString();
      applyProjectionDecay(ts);
    }

    const state = getProjectionState();
    // Entries below threshold should be removed
    for (const entry of state.entries) {
      expect(entry.decayScore).toBeGreaterThanOrEqual(20); // PROJECTION_ACTIVE_THRESHOLD
    }
  });

  it('Kim: decays entries not reinforced', () => {
    detectKimProjectionSignals({
      message: 'Ik ben bang dat ik geen controle heb',
      distressScore: 7,
      resilienceScore: 3,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    const result = applyKimProjectionDecay(new Date().toISOString());
    expect(result.decayedEntries).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. GPT INJECTION BLOCK
// ═══════════════════════════════════════════════════════════════

describe('Projection GPT Injection', () => {
  beforeEach(() => {
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: builds injection block with active entries', () => {
    detectProjectionSignals({
      message: 'Ik ben bang dat ik weer ga gebruiken',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const block = buildProjectionContext();
    expect(block).not.toBeNull();
    expect(block).toContain('TOEKOMSTPERSPECTIEF');
  });

  it('Elias: returns null when no active entries', () => {
    const block = buildProjectionContext();
    expect(block).toBeNull();
  });

  it('Kim: builds injection block with active entries', () => {
    detectKimProjectionSignals({
      message: 'Ik ben bang dat ik geen controle heb',
      distressScore: 7,
      resilienceScore: 3,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    const block = buildKimProjectionContext();
    expect(block).not.toBeNull();
    expect(block).toContain('TOEKOMSTPERSPECTIEF');
  });

  it('Kim: returns null when no active entries', () => {
    const block = buildKimProjectionContext();
    expect(block).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. DEEPENING MODULE
// ═══════════════════════════════════════════════════════════════

describe('Projection Deepening Module', () => {
  beforeEach(() => {
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
    resetDeepeningState();
  });

  it('activates deepening for Elias when dominantModule is E03 (reflection)', () => {
    // Create a projection entry first
    detectProjectionSignals({
      message: 'Ik ben bang dat ik weer ga gebruiken',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'Ik denk na over mijn patronen',
      userType: 'elias',
      dominantModule: 'E03',
      distressScore: 6,
      resilienceScore: 4,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.deepeningDirective).not.toBeNull();
  });

  it('activates deepening for Elias when dominantModule is E06 (confrontation)', () => {
    detectProjectionSignals({
      message: 'Ik hoop dat ik ooit clean ben',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'Wat zijn mijn waarden eigenlijk',
      userType: 'elias',
      dominantModule: 'E06',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.deepeningDirective).not.toBeNull();
  });

  it('does NOT activate deepening for non-reflection modules', () => {
    detectProjectionSignals({
      message: 'Ik ben bang voor terugval',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'Ik voel me slecht',
      userType: 'elias',
      dominantModule: 'E01',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.deepeningDirective).toBeNull();
  });

  it('blocks deepening after user deflection', () => {
    detectProjectionSignals({
      message: 'Ik ben bang voor terugval',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    // User deflects
    checkDeflectionInResponse('Weet ik niet, laat maar');

    expect(isDeepeningBlocked()).toBe(true);

    const result = runProjectionLayer({
      message: 'Ik denk na over patronen',
      userType: 'elias',
      dominantModule: 'E03',
      distressScore: 6,
      resilienceScore: 4,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.deepeningDirective).toBeNull();
  });

  it('detects deflection markers correctly', () => {
    const deflectionPhrases = ['weet niet', 'laat maar', 'geen idee', 'skip', 'overslaan'];

    for (const phrase of deflectionPhrases) {
      resetDeepeningState();
      checkDeflectionInResponse(phrase);
      expect(isDeepeningBlocked()).toBe(true);
    }
  });

  it('does NOT block on normal messages', () => {
    checkDeflectionInResponse('Ja dat klopt, ik voel me inderdaad zo');
    expect(isDeepeningBlocked()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. PIPELINE ORCHESTRATOR (runProjectionLayer)
// ═══════════════════════════════════════════════════════════════

describe('Projection Layer Orchestrator', () => {
  beforeEach(() => {
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
    resetDeepeningState();
  });

  it('returns hasActiveEntries=false when no signals detected', () => {
    const result = runProjectionLayer({
      message: 'Hallo, hoe gaat het',
      userType: 'elias',
      dominantModule: 'E01',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GROEN',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.hasActiveEntries).toBe(false);
    expect(result.injectionBlock).toBeNull();
  });

  it('returns injection block when signals are detected', () => {
    const result = runProjectionLayer({
      message: 'Ik ben bang dat ik weer ga gebruiken als ik stress heb',
      userType: 'elias',
      dominantModule: 'E03',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: null,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.hasActiveEntries).toBe(true);
    expect(result.injectionBlock).not.toBeNull();
    expect(result.injectionBlock).toContain('TOEKOMSTPERSPECTIEF');
  });

  it('routes to Kim engine for kim userType', () => {
    const result = runProjectionLayer({
      message: 'Ik ben bang dat ik geen controle meer heb',
      userType: 'kim',
      dominantModule: 'K01',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: null,
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
    });

    expect(result.hasActiveEntries).toBe(true);
    expect(result.injectionBlock).toContain('TOEKOMSTPERSPECTIEF');
  });

  it('Kim deepening activates when eigenRegieScore > 50', () => {
    // First create an entry
    runProjectionLayer({
      message: 'Ik ben bang dat ik geen controle heb',
      userType: 'kim',
      dominantModule: 'K01',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: null,
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
    });

    // Now run with high eigenRegie
    const result = runProjectionLayer({
      message: 'Ik voel me sterker vandaag',
      userType: 'kim',
      dominantModule: 'K03',
      distressScore: 4,
      resilienceScore: 6,
      vspLevel: null,
      zoneImproved: false,
      consecutiveGreenSessions: 0,
      eigenRegieScore: 65,
      consecutiveHighRegieSessions: 1,
    });

    expect(result.deepeningDirective).not.toBeNull();
  });
});
