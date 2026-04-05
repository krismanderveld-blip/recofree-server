/**
 * Core Logic Tests — RecoFree
 *
 * Tests for crisis detection, module system, input signal detection,
 * state analyzer, Rugzak engine, and trigger extraction.
 *
 * Uses Elias sliders: craving, frustration, despondency, focus (0-7)
 * Uses Kim sliders: stress, boundaryFatigue, emotionalBurden, selfCare (0-7)
 */

import { describe, it, expect } from 'vitest';
import { assessCrisis, EMERGENCY_RESOURCES } from '../lib/crisis/detector';
import { getModuleRecommendations, getAllModules } from '../lib/modules/module-system';
import { analyzeState, detectInputSignals, extractTriggersFromSignals } from '../lib/rugzak/state-analyzer';
import { computeRugzakInfluence, updateTriggerPatterns, recordMoodSnapshot, addMessageToRugzak, startNewSession } from '../lib/rugzak/engine';
import { createNewRugzak } from '../lib/ai/types';
import type { Rugzak, MoodSliders, EliasMoodSliders, KimMoodSliders, ChatMessage } from '../lib/ai/types';

// ─── Helper ─────────────────────────────────────────────────────

function createTestRugzak(overrides?: Record<string, unknown>): Rugzak {
  return createNewRugzak({
    userName: 'TestUser',
    userType: 'elias',
    startEmotion: 'anxious',
    urgency: 'midden',
    initialContext: 'Testing the system',
    ...(overrides || {}),
  } as any);
}

// ─── Default test moods ────────────────────────────────────────

const normalElias: EliasMoodSliders = { craving: 2, frustration: 2, despondency: 2, focus: 5 };
const highCravingElias: EliasMoodSliders = { craving: 6, frustration: 3, despondency: 2, focus: 4 };
const highDistressElias: EliasMoodSliders = { craving: 6, frustration: 5, despondency: 6, focus: 1 };
const lowDistressElias: EliasMoodSliders = { craving: 1, frustration: 1, despondency: 1, focus: 6 };

const normalKim: KimMoodSliders = { stress: 2, boundaryFatigue: 2, emotionalBurden: 2, selfCare: 5 };
const highStressKim: KimMoodSliders = { stress: 6, boundaryFatigue: 5, emotionalBurden: 6, selfCare: 1 };

// ─── Crisis Detection Tests ─────────────────────────────────────

describe('Crisis Detection', () => {
  it('should return level 0 for normal messages', () => {
    const result = assessCrisis('I had a good day today', normalElias, 'elias');
    expect(result.level).toBe(0);
    expect(result.recommendedAction).toBe('none');
    expect(result.triggers).toHaveLength(0);
  });

  it('should detect active suicidal ideation as level 2', () => {
    const result = assessCrisis('I want to kill myself', normalElias, 'elias');
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('suicidal_active');
  });

  it('should detect passive suicidal ideation as level 2', () => {
    const result = assessCrisis('I wish I was dead', normalElias, 'elias');
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('suicidal_passive');
  });

  it('should detect self-harm as level 2', () => {
    const result = assessCrisis('I want to hurt myself', normalElias, 'elias');
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('self_harm');
  });

  it('should detect dissociation as level 1', () => {
    const result = assessCrisis("I can't feel anything anymore", normalElias, 'elias');
    expect(result.level).toBe(1);
    expect(result.recommendedAction).toBe('intervene');
    expect(result.triggers).toContain('dissociation');
  });

  it('should detect relapse as level 1', () => {
    const result = assessCrisis('I relapsed last night', normalElias, 'elias');
    expect(result.level).toBe(1);
    expect(result.recommendedAction).toBe('intervene');
    expect(result.triggers).toContain('relapse');
  });

  it('should detect extreme craving via sliders (Elias)', () => {
    const result = assessCrisis('I feel something', highCravingElias, 'elias');
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.triggers).toContain('extreme_craving');
  });

  it('should detect combined risk (high distress + low resilience) (Elias)', () => {
    const result = assessCrisis('Things are rough', highDistressElias, 'elias');
    expect(result.level).toBeGreaterThanOrEqual(1);
  });

  it('should detect extreme emotional burden (Kim)', () => {
    const result = assessCrisis('I feel overwhelmed', highStressKim, 'kim');
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.triggers).toContain('extreme_emotional_burden');
  });

  it('should have emergency resources defined', () => {
    expect(EMERGENCY_RESOURCES).toHaveLength(3);
    expect(EMERGENCY_RESOURCES[0].number).toBe('988');
  });
});

// ─── Module System Tests ────────────────────────────────────────

describe('Module System', () => {
  it('should return Elias modules for elias user type', () => {
    const modules = getAllModules('elias');
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.every((m) => m.userType === 'elias')).toBe(true);
  });

  it('should return Kim modules for kim user type', () => {
    const modules = getAllModules('kim');
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.every((m) => m.userType === 'kim')).toBe(true);
  });

  it('should recommend Craving Management for high craving (Elias)', () => {
    const recs = getModuleRecommendations('elias', 'I have a strong urge', highCravingElias);
    const cravingModule = recs.find((r) => r.module.id === 'E01');
    expect(cravingModule).toBeDefined();
    expect(cravingModule!.relevance).toBeGreaterThan(0);
  });

  it('should recommend Emotional Regulation for high despondency (Elias)', () => {
    const mood: EliasMoodSliders = { craving: 2, frustration: 2, despondency: 5, focus: 3 };
    const recs = getModuleRecommendations('elias', 'I feel overwhelmed', mood);
    const emotionModule = recs.find((r) => r.module.id === 'E02');
    expect(emotionModule).toBeDefined();
  });

  it('should recommend Boundary Setting for Kim user', () => {
    const recs = getModuleRecommendations('kim', 'I need to set boundaries', normalKim);
    const boundaryModule = recs.find((r) => r.module.id === 'K01');
    expect(boundaryModule).toBeDefined();
  });

  it('should recommend Stress Management for high stress (Kim)', () => {
    const recs = getModuleRecommendations('kim', 'I am so stressed', highStressKim);
    const stressModule = recs.find((r) => r.module.id === 'K04');
    expect(stressModule).toBeDefined();
  });

  it('should sort recommendations by relevance (highest first)', () => {
    const recs = getModuleRecommendations('elias', 'I feel overwhelmed and tempted', highDistressElias);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].relevance).toBeGreaterThanOrEqual(recs[i].relevance);
    }
  });
});

// ─── Input Signal Detection Tests ───────────────────────────────

describe('Input Signal Detection', () => {
  it('detects passive suicidal signals', () => {
    const signals = detectInputSignals('I feel like giving up');
    expect(signals.passiveSuicidal || signals.hopelessness).toBe(true);
  });

  it('detects active suicidal signals', () => {
    const signals = detectInputSignals('I want to kill myself');
    expect(signals.activeSuicidal).toBe(true);
  });

  it('detects craving mention', () => {
    const signals = detectInputSignals('I have a strong craving right now');
    expect(signals.cravingMention).toBe(true);
  });

  it('detects isolation signal', () => {
    const signals = detectInputSignals('I feel so alone, nobody cares');
    expect(signals.isolationSignal).toBe(true);
  });

  it('detects positive signal', () => {
    const signals = detectInputSignals('I had a really good day today, feeling grateful');
    expect(signals.positiveSignal).toBe(true);
  });

  it('detects no signals in neutral text', () => {
    const signals = detectInputSignals('The weather is nice today');
    expect(signals.passiveSuicidal).toBe(false);
    expect(signals.activeSuicidal).toBe(false);
    expect(signals.cravingMention).toBe(false);
    expect(signals.isolationSignal).toBe(false);
  });
});

// ─── State Analyzer Tests ───────────────────────────────────────

describe('State Analyzer', () => {
  it('returns low risk for neutral input with good mood (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = lowDistressElias;

    const analysis = analyzeState(rugzak, 'I had a good day');
    expect(analysis.riskLevel).toBe('low');
    expect(analysis.emotionalState).toBe('stable');
  });

  it('returns high risk for "giving up" with high distress (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = { craving: 6, frustration: 5, despondency: 5, focus: 1 } as EliasMoodSliders;

    const analysis = analyzeState(rugzak, 'I feel like giving up');
    expect(analysis.riskLevel).toBe('high');
    expect(analysis.crisisMonitoring).toBe(true);
  });

  it('returns critical risk for active suicidal signals (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = highDistressElias;

    const analysis = analyzeState(rugzak, 'I want to kill myself');
    expect(analysis.riskLevel).toBe('critical');
    expect(analysis.emotionalState).toBe('crisis');
    expect(analysis.tone).toBe('crisis');
  });

  it('selects craving module when craving is high (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = highCravingElias;

    const analysis = analyzeState(rugzak, 'I have a strong craving');
    expect(analysis.priorityModules).toContain('E01');
  });

  it('selects Kim modules for naaste user type', () => {
    const rugzak = createTestRugzak({ userType: 'kim' });
    rugzak.currentMood = highStressKim;

    const analysis = analyzeState(rugzak, 'I feel overwhelmed');
    expect(analysis.priorityModules.some((m: string) => m.startsWith('K'))).toBe(true);
  });

  it('generates state summary string with slider labels', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = normalElias;

    const analysis = analyzeState(rugzak, 'Hello');
    expect(analysis.stateSummary).toContain('Craving: 2/7');
    expect(analysis.stateSummary).toContain('Focus: 5/7');
  });
});

// ─── Rugzak Engine Tests ────────────────────────────────────────

describe('Rugzak Engine', () => {
  it('creates a new Rugzak from intake data', () => {
    const rugzak = createTestRugzak();
    expect(rugzak.naam).toBe('TestUser');
    expect(rugzak.userType).toBe('elias');
    expect(rugzak.sections.length).toBe(5);
    expect(rugzak.chatHistory).toEqual([]);
    expect(rugzak.moodHistory).toEqual([]);
    expect(rugzak.triggerPatterns).toEqual([]);
    expect(rugzak.totalSessions).toBe(0);
  });

  it('records mood snapshot (Elias)', () => {
    let rugzak = createTestRugzak();
    rugzak = recordMoodSnapshot(rugzak, normalElias);

    expect(rugzak.currentMood).toEqual(normalElias);
    expect(rugzak.moodHistory.length).toBe(1);
    expect(rugzak.moodHistory[0].sliders).toEqual(normalElias);
  });

  it('adds message to Rugzak', () => {
    let rugzak = createTestRugzak();
    const msg: ChatMessage = {
      id: 'msg_1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    };
    rugzak = addMessageToRugzak(rugzak, msg);

    expect(rugzak.chatHistory.length).toBe(1);
    expect(rugzak.chatHistory[0].content).toBe('Hello');
  });

  it('updates trigger patterns', () => {
    const existing = [{ trigger: 'isolation', count: 1, firstSeen: '2025-01-01', lastSeen: '2025-01-01' }];
    const updated = updateTriggerPatterns(existing, ['isolation', 'craving']);

    expect(updated.length).toBe(2);
    expect(updated.find((t) => t.trigger === 'isolation')?.count).toBe(2);
    expect(updated.find((t) => t.trigger === 'craving')?.count).toBe(1);
  });

  it('starts new session', () => {
    let rugzak = createTestRugzak();
    expect(rugzak.totalSessions).toBe(0);

    rugzak = startNewSession(rugzak);
    expect(rugzak.totalSessions).toBe(1);
    expect(rugzak.lastSessionDate).not.toBeNull();
  });
});

// ─── Rugzak Influence Tests ─────────────────────────────────────

describe('Rugzak Influence', () => {
  it('computes stable influence for healthy state (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = lowDistressElias;

    const influence = computeRugzakInfluence(rugzak, 0);
    expect(influence.tone).toBe('warm');
    expect(influence.moodTrajectory).toBe('stable');
    expect(influence.crisisSensitivityBoost).toBe(0);
  });

  it('returns crisis tone when crisis level is high (Elias)', () => {
    const rugzak = createTestRugzak();
    rugzak.currentMood = highDistressElias;

    const influence = computeRugzakInfluence(rugzak, 2);
    expect(influence.tone).toBe('crisis');
  });

  it('computes influence for Kim user', () => {
    const rugzak = createTestRugzak({ userType: 'kim' });
    rugzak.currentMood = highStressKim;

    const influence = computeRugzakInfluence(rugzak, 0);
    expect(influence.suggestionIntensity).toBeGreaterThan(0);
  });
});

// ─── Trigger Extraction Tests ───────────────────────────────────

describe('Trigger Extraction', () => {
  it('extracts craving trigger from signals', () => {
    const signals = detectInputSignals('I have a strong craving');
    const triggers = extractTriggersFromSignals(signals);
    expect(triggers).toContain('craving');
  });

  it('extracts multiple triggers', () => {
    const signals = detectInputSignals('I feel alone and I have a craving');
    const triggers = extractTriggersFromSignals(signals);
    expect(triggers).toContain('craving');
    expect(triggers).toContain('isolation');
  });

  it('extracts no triggers from neutral text', () => {
    const signals = detectInputSignals('The weather is nice');
    const triggers = extractTriggersFromSignals(signals);
    expect(triggers.length).toBe(0);
  });
});
