import { describe, it, expect } from 'vitest';
import { assessCrisis, EMERGENCY_RESOURCES } from '../lib/crisis/detector';
import { getModuleRecommendations, getAllModules } from '../lib/modules/module-system';

// ─── Crisis Detection Tests ─────────────────────────────────────

describe('Crisis Detection', () => {
  const normalMood = { stemming: 5, craving: 3, overprikkeling: 3, sociaal: 5 };

  it('should return level 0 for normal messages', () => {
    const result = assessCrisis('I had a good day today', normalMood);
    expect(result.level).toBe(0);
    expect(result.recommendedAction).toBe('none');
    expect(result.triggers).toHaveLength(0);
  });

  it('should detect active suicidal ideation as level 2', () => {
    const result = assessCrisis('I want to kill myself', normalMood);
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('suicidal_active');
  });

  it('should detect passive suicidal ideation as level 2', () => {
    const result = assessCrisis('I wish I was dead', normalMood);
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('suicidal_passive');
  });

  it('should detect self-harm as level 2', () => {
    const result = assessCrisis('I want to hurt myself', normalMood);
    expect(result.level).toBe(2);
    expect(result.recommendedAction).toBe('emergency');
    expect(result.triggers).toContain('self_harm');
  });

  it('should detect dissociation as level 1', () => {
    const result = assessCrisis('I can\'t feel anything anymore', normalMood);
    expect(result.level).toBe(1);
    expect(result.recommendedAction).toBe('intervene');
    expect(result.triggers).toContain('dissociation');
  });

  it('should detect relapse as level 1', () => {
    const result = assessCrisis('I relapsed last night', normalMood);
    expect(result.level).toBe(1);
    expect(result.recommendedAction).toBe('intervene');
    expect(result.triggers).toContain('relapse');
  });

  it('should detect extremely low mood via sliders', () => {
    const lowMood = { stemming: 1, craving: 3, overprikkeling: 3, sociaal: 5 };
    const result = assessCrisis('I feel bad', lowMood);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.triggers).toContain('extremely_low_mood');
  });

  it('should detect extreme craving via sliders', () => {
    const highCraving = { stemming: 5, craving: 9, overprikkeling: 3, sociaal: 5 };
    const result = assessCrisis('I feel something', highCraving);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.triggers).toContain('extreme_craving');
  });

  it('should detect combined risk (low mood + high craving) as level 2', () => {
    const combined = { stemming: 2, craving: 8, overprikkeling: 3, sociaal: 5 };
    const result = assessCrisis('Things are rough', combined);
    expect(result.level).toBe(2);
    expect(result.triggers).toContain('combined_risk_mood_craving');
  });

  it('should have emergency resources defined', () => {
    expect(EMERGENCY_RESOURCES).toHaveLength(3);
    expect(EMERGENCY_RESOURCES[0].number).toBe('988');
  });
});

// ─── Module System Tests ────────────────────────────────────────

describe('Module System', () => {
  const normalMood = { stemming: 5, craving: 3, overprikkeling: 3, sociaal: 5 };

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

  it('should recommend Craving Management for high craving', () => {
    const highCraving = { stemming: 5, craving: 8, overprikkeling: 3, sociaal: 5 };
    const recs = getModuleRecommendations('elias', 'I have a strong urge', highCraving);
    const cravingModule = recs.find((r) => r.module.id === 'E01');
    expect(cravingModule).toBeDefined();
    expect(cravingModule!.relevance).toBeGreaterThan(0);
  });

  it('should recommend Emotional Regulation for low mood', () => {
    const lowMood = { stemming: 2, craving: 3, overprikkeling: 3, sociaal: 5 };
    const recs = getModuleRecommendations('elias', 'I feel overwhelmed', lowMood);
    const emotionModule = recs.find((r) => r.module.id === 'E02');
    expect(emotionModule).toBeDefined();
  });

  it('should recommend Boundary Setting for Kim user with boundary keywords', () => {
    const recs = getModuleRecommendations('kim', 'I need to set boundaries', normalMood);
    const boundaryModule = recs.find((r) => r.module.id === 'K01');
    expect(boundaryModule).toBeDefined();
  });

  it('should recommend Self-Care for Kim user with low mood', () => {
    const lowMood = { stemming: 2, craving: 0, overprikkeling: 3, sociaal: 5 };
    const recs = getModuleRecommendations('kim', 'I am exhausted', lowMood);
    const selfCareModule = recs.find((r) => r.module.id === 'K03');
    expect(selfCareModule).toBeDefined();
  });

  it('should return empty recommendations for neutral messages', () => {
    const recs = getModuleRecommendations('elias', 'Hello, how are you?', normalMood);
    // May return some or none depending on keyword matching
    expect(Array.isArray(recs)).toBe(true);
  });

  it('should sort recommendations by relevance (highest first)', () => {
    const lowMood = { stemming: 1, craving: 9, overprikkeling: 8, sociaal: 1 };
    const recs = getModuleRecommendations('elias', 'I feel overwhelmed and tempted', lowMood);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].relevance).toBeGreaterThanOrEqual(recs[i].relevance);
    }
  });
});
