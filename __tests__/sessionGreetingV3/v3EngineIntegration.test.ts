/**
 * Session Greeting V3 — Full Engine Integration Tests
 * Tests: end-to-end V3 engine flow, mode selection, debug output
 */
import { describe, it, expect } from 'vitest';
import { sessionGreetingEngineV3 } from '@/lib/features/sessionGreeting/sessionGreetingEngineV3';
import type { SessionGreetingInitInput } from '@/lib/features/sessionGreeting/sessionGreeting.types';

const NOW = '2026-06-15T10:00:00.000Z';
const TODAY = '2026-06-15';
const YESTERDAY = '2026-06-14T18:00:00.000Z';
const THREE_DAYS_AGO = '2026-06-12T10:00:00.000Z';

function makeInput(overrides: Partial<SessionGreetingInitInput> = {}): SessionGreetingInitInput {
  return {
    nowIso: NOW,
    localCalendarDate: TODAY,
    timezone: 'Europe/Amsterdam',
    userDat: {
      userName: 'Kris',
      sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
      schemaTendencies: [
        { schemaId: 'verlating', schemaName: 'verlating/instabiliteit', confidence: 0.85, lastUpdatedAt: YESTERDAY },
      ],
      backpackLastUpdatedAt: YESTERDAY,
    },
    stateDat: {
      currentMood: { craving: 3, frustration: 4, despondency: 2, focus: 6 },
      moodLastUpdatedAt: NOW,
      vspZone: 'GROEN',
    },
    projectionsDat: { fears: [] },
    logsDat: { lastSessionOpenLoops: [] },
    diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Vandaag was een rustige dag op werk' },
    gratitudeMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dankbaar voor de stilte' },
    ...overrides,
  };
}

describe('V3 Engine Integration', () => {
  it('T26: Normal session produces SYNTHESIS mode with sources', () => {
    const result = sessionGreetingEngineV3(makeInput());
    expect(result.mode).toBe('SYNTHESIS');
    expect(result.override).toBeNull();
    expect(result.synthesisPayload).not.toBeNull();
    expect(result.selectedSources.length).toBeGreaterThan(0);
    expect(result.selectedSources.length).toBeLessThanOrEqual(3);
  });

  it('T27: Crisis session produces CRISIS_OVERRIDE mode', () => {
    const result = sessionGreetingEngineV3(makeInput({
      stateDat: {
        currentMood: { craving: 9, frustration: 8, despondency: 7, focus: 1 },
        moodLastUpdatedAt: NOW,
        vspZone: 'ROOD',
      },
    }));
    expect(result.mode).toBe('CRISIS_OVERRIDE');
    expect(result.override).not.toBeNull();
    expect(result.overridePrompt).not.toBeNull();
    expect(result.synthesisPayload).toBeNull();
    expect(result.selectedSources).toHaveLength(0);
  });

  it('T28: First session produces FIRST_SESSION mode', () => {
    const result = sessionGreetingEngineV3(makeInput({
      userDat: {
        userName: 'Kris',
        sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 },
        schemaTendencies: [],
        backpackLastUpdatedAt: undefined,
      },
      stateDat: {
        currentMood: undefined,
        moodLastUpdatedAt: undefined,
        vspZone: 'GROEN',
      },
    }));
    expect(result.mode).toBe('FIRST_SESSION');
    expect(result.overridePrompt).toContain('EERSTE sessie');
  });

  it('T29: Missing data produces MISSING_DATA mode', () => {
    const result = sessionGreetingEngineV3(makeInput({
      userDat: {
        userName: 'Kris',
        sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
        schemaTendencies: [],
        backpackLastUpdatedAt: '2026-06-10T10:00:00.000Z', // 5 days ago, not fresh
      },
      stateDat: {
        currentMood: undefined,
        moodLastUpdatedAt: undefined,
        vspZone: 'GROEN',
      },
      diaryMetadata: null,
      gratitudeMetadata: null,
    }));
    expect(result.mode).toBe('MISSING_DATA');
    expect(result.overridePrompt).toContain('nog niets ingevuld');
  });

  it('T30: Synthesis payload contains userName and sources', () => {
    const result = sessionGreetingEngineV3(makeInput());
    expect(result.synthesisPayload!.userName).toBe('Kris');
    expect(result.synthesisPayload!.selectedSources.length).toBeGreaterThan(0);
    expect(result.synthesisPayload!.synthesisInstruction).toContain('Kris');
  });

  it('T31: Debug contains mode and session number', () => {
    const result = sessionGreetingEngineV3(makeInput());
    expect(result.debug.mode).toBe('SYNTHESIS');
    expect(result.debug.sessionNumber).toBe(11);
  });

  it('T32: Synthesis prompt forbids checklist language', () => {
    const result = sessionGreetingEngineV3(makeInput());
    const instruction = result.synthesisPayload!.synthesisInstruction;
    expect(instruction).toContain('VERBODEN');
    expect(instruction).toContain('checklist');
    expect(result.synthesisPayload!.forbiddenPatterns).toContain('hoe voel je je');
  });
});
