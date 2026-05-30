import { describe, it, expect } from 'vitest';
import { NullSignalEngine } from '../lib/engine/local-llm/null-engine';
import type { SignalInput, ContextInput, ContextData } from '../lib/engine/local-llm/signal-engine';

describe('NullSignalEngine', () => {
  const engine = new NullSignalEngine();

  const mockSignalInput: SignalInput = {
    currentMessage: 'ik voel me slecht',
    conversationHistory: [{ role: 'user', content: 'hallo' }],
    bufferSnapshot: {} as any,
    moodSliders: { distress: 7, hope: 3 },
    projectionEntries: [],
    userDatSummary: {
      totalSessions: 5,
      recentTriggers: ['alcohol'],
      dominantModules: ['craving'],
    },
  };

  const mockContextInput: ContextInput = {
    message: 'ik heb trek in alcohol',
    backpackSections: [{ label: 'Triggers', content: 'feestjes' }],
    recentDiary: [{ content: 'moeilijke dag', moodTag: 'sad' }],
    triggerPatterns: [{ trigger: 'alcohol', count: 3 }],
  };

  const mockContextData: ContextData = {
    backpackSections: [{ label: 'Coping', content: 'wandelen' }],
    sessionAnalyses: [{ dominantEmotion: 'anxiety', themes: ['relapse'] }],
    projectionEntries: [],
  };

  it('detectSignals() returns empty arrays', async () => {
    const result = await engine.detectSignals(mockSignalInput);
    expect(result.fears).toEqual([]);
    expect(result.hopes).toEqual([]);
    expect(result.goals).toEqual([]);
    expect(result.triggers).toEqual([]);
  });

  it('scoreRelevance() returns all scores as 0', async () => {
    const result = await engine.scoreRelevance(mockContextInput);
    expect(result.backpackRelevance).toBe(0);
    expect(result.diaryRelevance).toBe(0);
    expect(result.triggerRelevance).toBe(0);
    expect(result.projectionRelevance).toBe(0);
  });

  it('summarizeContext() returns neutral values', async () => {
    const result = await engine.summarizeContext(mockContextData);
    expect(result.dominantTheme).toBe('');
    expect(result.urgencyHint).toBe('low');
    expect(result.suggestedFocus).toBe('');
  });

  it('isReady() returns false', () => {
    expect(engine.isReady()).toBe(false);
  });
});
