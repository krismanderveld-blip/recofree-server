/**
 * Tests for cross-session recurring pattern detection.
 * Tests only what's directly affected by the new feature.
 */
import { describe, it, expect } from 'vitest';
import { detectRecurringPatterns, type RecurringPattern, type PatternDetectionResult } from '@/lib/features/sessionGreeting/detectRecurringPatterns';
import type { SessionLogSummary } from '@/lib/types/memory/logsDat.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionLogSummary> = {}): SessionLogSummary {
  return {
    summaryId: `sum_${Math.random().toString(36).slice(2)}`,
    sessionId: `sess_${Math.random().toString(36).slice(2)}`,
    persona: 'elias',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    summaryModel: 'gpt-4o-mini',
    summarySchemaVersion: 'session_summary.v1',
    compressedNarrative: 'Test session narrative.',
    discussedTopics: [],
    emotionalThemes: [],
    breakthroughs: [],
    relapseOrRiskEvents: [],
    openEndpoints: [],
    extractedCandidates: {
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
    },
    moduleTrace: [],
    zoneTrace: [],
    inputTokenEstimate: 500,
    outputTokenEstimate: 300,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('detectRecurringPatterns', () => {
  it('returns empty patterns when fewer than 3 sessions', () => {
    const result = detectRecurringPatterns([makeSession(), makeSession()]);
    expect(result.patterns).toHaveLength(0);
    expect(result.bestPattern).toBeNull();
    expect(result.debugSummary).toContain('Insufficient sessions');
  });

  it('returns empty patterns when no topics recur', () => {
    const sessions = [
      makeSession({ discussedTopics: ['a'] }),
      makeSession({ discussedTopics: ['b'] }),
      makeSession({ discussedTopics: ['c'] }),
    ];
    const result = detectRecurringPatterns(sessions);
    expect(result.patterns).toHaveLength(0);
  });

  it('detects a recurring topic when it appears in 3+ sessions', () => {
    const sessions = [
      makeSession({ discussedTopics: ['eenzaamheid', 'werk'] }),
      makeSession({ discussedTopics: ['eenzaamheid', 'relatie'] }),
      makeSession({ discussedTopics: ['eenzaamheid', 'slaap'] }),
      makeSession({ discussedTopics: ['werk'] }),
    ];
    const result = detectRecurringPatterns(sessions);
    expect(result.patterns.length).toBeGreaterThanOrEqual(1);
    const topicPattern = result.patterns.find(p => p.patternType === 'topic' && p.label === 'eenzaamheid');
    expect(topicPattern).toBeDefined();
    expect(topicPattern!.occurrenceCount).toBe(3);
    expect(topicPattern!.confidence).toBeGreaterThan(0.4);
    expect(topicPattern!.safeAnchor).toContain('eenzaamheid');
  });

  it('detects recurring emotional themes', () => {
    const sessions = [
      makeSession({ emotionalThemes: [{ label: 'Schaamte', intensity: 6 }] }),
      makeSession({ emotionalThemes: [{ label: 'schaamte', intensity: 7 }] }),
      makeSession({ emotionalThemes: [{ label: 'Schaamte', intensity: 5 }] }),
    ];
    const result = detectRecurringPatterns(sessions);
    const emotionPattern = result.patterns.find(p => p.patternType === 'emotional_theme');
    expect(emotionPattern).toBeDefined();
    expect(emotionPattern!.label).toBe('schaamte');
    expect(emotionPattern!.occurrenceCount).toBe(3);
  });

  it('detects temporal risk patterns (day-of-week)', () => {
    // Create sessions all on Sundays (day 0) with risk events
    const sundaySessions = Array.from({ length: 4 }, (_, i) => {
      // 2026-06-07 is a Sunday
      const date = new Date(2026, 5, 7 + i * 7, 14, 0, 0);
      return makeSession({
        startedAt: date.toISOString(),
        relapseOrRiskEvents: [{ eventType: 'craving_spike', description: 'Sterke craving', severity: 5 }],
      });
    });
    // Add some non-Sunday sessions without risk
    const otherSessions = [
      makeSession({ startedAt: new Date(2026, 5, 8, 14, 0, 0).toISOString() }),
      makeSession({ startedAt: new Date(2026, 5, 9, 14, 0, 0).toISOString() }),
    ];
    const result = detectRecurringPatterns([...sundaySessions, ...otherSessions]);
    const temporalPattern = result.patterns.find(p => p.patternType === 'temporal');
    expect(temporalPattern).toBeDefined();
    expect(temporalPattern!.dayOfWeek).toBe('zondag');
    expect(temporalPattern!.safeAnchor).toContain('zondag');
  });

  it('detects recurring risk event types', () => {
    const sessions = [
      makeSession({ relapseOrRiskEvents: [{ eventType: 'craving_spike', description: 'test', severity: 4 }] }),
      makeSession({ relapseOrRiskEvents: [{ eventType: 'craving_spike', description: 'test', severity: 5 }] }),
      makeSession({ relapseOrRiskEvents: [{ eventType: 'craving_spike', description: 'test', severity: 3 }] }),
      makeSession({ relapseOrRiskEvents: [{ eventType: 'none', description: '', severity: 0 }] }),
    ];
    const result = detectRecurringPatterns(sessions);
    const riskPattern = result.patterns.find(p => p.patternType === 'risk_event');
    expect(riskPattern).toBeDefined();
    expect(riskPattern!.label).toBe('craving-piek');
    expect(riskPattern!.occurrenceCount).toBe(3);
  });

  it('returns the highest confidence pattern as bestPattern', () => {
    const sessions = Array.from({ length: 5 }, () =>
      makeSession({
        discussedTopics: ['eenzaamheid', 'craving'],
        emotionalThemes: [{ label: 'verdriet', intensity: 8 }],
      })
    );
    const result = detectRecurringPatterns(sessions);
    expect(result.bestPattern).not.toBeNull();
    // bestPattern should be the one with highest confidence
    const maxConfidence = Math.max(...result.patterns.map(p => p.confidence));
    expect(result.bestPattern!.confidence).toBe(maxConfidence);
  });

  it('limits output to MAX_PATTERNS (5)', () => {
    // Create sessions with many different recurring topics
    const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const sessions = Array.from({ length: 10 }, () =>
      makeSession({ discussedTopics: topics })
    );
    const result = detectRecurringPatterns(sessions);
    expect(result.patterns.length).toBeLessThanOrEqual(5);
  });

  it('handles sessions with empty/missing fields gracefully', () => {
    const sessions = [
      makeSession({ discussedTopics: [], emotionalThemes: [], relapseOrRiskEvents: [] }),
      makeSession({ discussedTopics: [], emotionalThemes: [], relapseOrRiskEvents: [] }),
      makeSession({ discussedTopics: [], emotionalThemes: [], relapseOrRiskEvents: [] }),
    ];
    const result = detectRecurringPatterns(sessions);
    expect(result.patterns).toHaveLength(0);
    expect(result.bestPattern).toBeNull();
  });
});
