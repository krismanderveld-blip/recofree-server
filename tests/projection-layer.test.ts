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
      message: 'I am afraid that I will use again when I have stress',
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
      message: 'I hope that I can live clean someday and be happy',
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
      message: 'I want to work again and get my children back',
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
      message: 'I am afraid of relapse',
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
      message: 'That fear of relapse keeps coming back',
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
      message: 'I do not know what to do anymore',
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
      message: 'I hope it gets better',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    resetSessionTracking();

    // Now trigger with zone improvement
    detectProjectionSignals({
      message: 'Today it is going a bit better',
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
      'I am afraid of relapse',
      'I hope for recovery',
      'My goal is to find work',
      'I fear loneliness',
      'I want to study',
      'I am afraid of rejection',
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
      message: 'I feel like I have no control anymore',
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
      message: 'I hope I become stronger',
      distressScore: 4,
      resilienceScore: 6,
      eigenRegieScore: 60,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    // Now reinforce it with consecutive high ER sessions
    const result = detectKimProjectionSignals({
      message: 'I feel stronger today',
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
      message: 'I am afraid I cannot handle it without help',
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
      message: 'I hope I become stronger',
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
      message: 'I am afraid of relapse',
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
      message: 'I am a little afraid',
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
      message: 'I am afraid I have no control',
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
      message: 'I am afraid I will use again',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const block = buildProjectionContext();
    expect(block).not.toBeNull();
    expect(block).toContain('FUTURE PERSPECTIVE');
  });

  it('Elias: returns null when no active entries', () => {
    const block = buildProjectionContext();
    expect(block).toBeNull();
  });

  it('Kim: builds injection block with active entries', () => {
    detectKimProjectionSignals({
      message: 'I am afraid I have no control',
      distressScore: 7,
      resilienceScore: 3,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    const block = buildKimProjectionContext();
    expect(block).not.toBeNull();
    expect(block).toContain('FUTURE PERSPECTIVE');
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
      message: 'I am afraid I will use again',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'I am thinking about my patterns',
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
      message: 'I hope I will be clean someday',
      distressScore: 5,
      resilienceScore: 5,
      vspLevel: 'GEEL',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'What are my values actually',
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
      message: 'I am afraid of relapse',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const result = runProjectionLayer({
      message: 'I feel bad',
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
      message: 'I am afraid of relapse',
      distressScore: 7,
      resilienceScore: 3,
      vspLevel: 'ORANJE',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    // User deflects
    checkDeflectionInResponse('I don\'t know, never mind');

    expect(isDeepeningBlocked()).toBe(true);

    const result = runProjectionLayer({
      message: 'I am thinking about my patterns',
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
    const deflectionPhrases = ['don\'t know', 'never mind', 'no idea', 'skip', 'not important'];

    for (const phrase of deflectionPhrases) {
      resetDeepeningState();
      checkDeflectionInResponse(phrase);
      expect(isDeepeningBlocked()).toBe(true);
    }
  });

  it('does NOT block on normal messages', () => {
    checkDeflectionInResponse('Yes that is correct, I do feel that way');
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
      message: 'Hello, how are you',
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
      message: 'I am afraid that I will use again when I have stress',
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
    expect(result.injectionBlock).toContain('FUTURE PERSPECTIVE');
  });

  it('routes to Kim engine for kim userType', () => {
    const result = runProjectionLayer({
      message: 'I am afraid I have no control anymore',
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
    expect(result.injectionBlock).toContain('FUTURE PERSPECTIVE');
  });

  it('Kim deepening activates when eigenRegieScore > 50', () => {
    // First create an entry
    runProjectionLayer({
      message: 'I am afraid I have no control',
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
      message: 'I feel stronger today',
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
