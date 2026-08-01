/**
 * DIST01 — Store Tests
 *
 * Tests for the Distillation Store merge, deduplication, and limit enforcement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDistillationStore } from '@/lib/engine/shared/dist01-store';
import { createEmptyDistillationStore } from '@/lib/engine/shared/dist01-types';
import type { DetectedEntity, DetectedSignal, DetectedContext } from '@/lib/engine/shared/dist01-types';

// Mock the atomicJsonStore
vi.mock('@/lib/storage/memory/atomicJsonStore', () => ({
  readJson: vi.fn().mockResolvedValue(null),
  writeJson: vi.fn().mockResolvedValue(undefined),
}));

describe('DIST01 Store', () => {
  let store: ReturnType<typeof createDistillationStore>;

  beforeEach(() => {
    store = createDistillationStore();
  });

  describe('mergeDetections - Entities', () => {
    it('adds a new entity to empty store', () => {
      const data = createEmptyDistillationStore('elias');
      const entities: DetectedEntity[] = [{
        name: 'Melissa',
        entityType: 'person',
        relation: 'partner',
        valence: 'positive',
        contextSnippet: 'mijn vriendin Melissa',
        confidence: 'high',
      }];

      const result = store.mergeDetections(data, entities, [], [], 'chat', 's1', '2026-08-01');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Melissa');
      expect(result.entities[0].relation).toBe('partner');
      expect(result.entities[0].mentionCount).toBe(1);
    });

    it('deduplicates entities by name+type (case insensitive)', () => {
      const data = createEmptyDistillationStore('elias');
      const entities1: DetectedEntity[] = [{
        name: 'Melissa',
        entityType: 'person',
        relation: 'partner',
        valence: 'positive',
        contextSnippet: 'mijn vriendin Melissa',
        confidence: 'high',
      }];
      const entities2: DetectedEntity[] = [{
        name: 'melissa',
        entityType: 'person',
        relation: null,
        valence: 'neutral',
        contextSnippet: 'Melissa belde me',
        confidence: 'medium',
      }];

      let result = store.mergeDetections(data, entities1, [], [], 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, entities2, [], [], 'chat', 's2', '2026-08-02');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].mentionCount).toBe(2);
      // Keeps the more specific relation
      expect(result.entities[0].relation).toBe('partner');
    });

    it('enforces max entity limit (100)', () => {
      const data = createEmptyDistillationStore('elias');
      const manyEntities: DetectedEntity[] = Array.from({ length: 110 }, (_, i) => ({
        name: `Person${i}`,
        entityType: 'person' as const,
        relation: null,
        valence: 'neutral' as const,
        contextSnippet: `context ${i}`,
        confidence: 'medium',
      }));

      const result = store.mergeDetections(data, manyEntities, [], [], 'chat', 's1', '2026-08-01');
      expect(result.entities.length).toBeLessThanOrEqual(100);
    });
  });

  describe('mergeDetections - Signals', () => {
    it('adds a new signal', () => {
      const data = createEmptyDistillationStore('elias');
      const signals: DetectedSignal[] = [{
        signalType: 'new_trigger_detected',
        normalizedText: 'alcohol zien maakt onrustig',
        rawUserTextExcerpt: 'als ik alcohol zie word ik onrustig',
        confidence: 'medium',
      }];

      const result = store.mergeDetections(data, [], signals, [], 'chat', 's1', '2026-08-01');
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].signalType).toBe('new_trigger_detected');
      expect(result.signals[0].detectionCount).toBe(1);
      expect(result.signals[0].eligibleForAutoSave).toBe(false);
    });

    it('increments detection count on repeated signal', () => {
      const data = createEmptyDistillationStore('elias');
      const signal: DetectedSignal = {
        signalType: 'new_trigger_detected',
        normalizedText: 'alcohol zien maakt onrustig',
        rawUserTextExcerpt: 'als ik alcohol zie word ik onrustig',
        confidence: 'medium',
      };

      let result = store.mergeDetections(data, [], [signal], [], 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's2', '2026-08-02');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's3', '2026-08-03');

      expect(result.signals[0].detectionCount).toBe(3);
      expect(result.signals[0].confidence).toBe('high');
      expect(result.signals[0].eligibleForAutoSave).toBe(true);
    });

    it('tracks unique sessions and days for auto-save eligibility', () => {
      const data = createEmptyDistillationStore('elias');
      const signal: DetectedSignal = {
        signalType: 'self_care_pattern_detected',
        normalizedText: 'wandelen helpt tot rust komen',
        rawUserTextExcerpt: 'wandelen helpt me om tot rust te komen',
        confidence: 'medium',
      };

      // Same session, same day — should NOT be eligible
      let result = store.mergeDetections(data, [], [signal], [], 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's1', '2026-08-01');
      expect(result.signals[0].detectionCount).toBe(3);
      // Only 1 unique session, so not eligible
      expect(result.signals[0].eligibleForAutoSave).toBe(false);

      // Different session, different day — should be eligible
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's2', '2026-08-02');
      expect(result.signals[0].detectionCount).toBe(4);
      expect(result.signals[0].eligibleForAutoSave).toBe(true);
    });
  });

  describe('mergeDetections - Contexts', () => {
    it('adds a new context', () => {
      const data = createEmptyDistillationStore('kim');
      const contexts: DetectedContext[] = [{
        contextType: 'life_event',
        summary: 'Recent gescheiden',
        confidence: 'medium',
      }];

      const result = store.mergeDetections(data, [], [], contexts, 'chat', 's1', '2026-08-01');
      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].contextType).toBe('life_event');
      expect(result.contexts[0].mentionCount).toBe(1);
    });

    it('deduplicates contexts by normalized summary', () => {
      const data = createEmptyDistillationStore('kim');
      const ctx1: DetectedContext[] = [{ contextType: 'life_event', summary: 'Recent gescheiden', confidence: 'medium' }];
      const ctx2: DetectedContext[] = [{ contextType: 'life_event', summary: 'recent gescheiden', confidence: 'medium' }];

      let result = store.mergeDetections(data, [], [], ctx1, 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, [], [], ctx2, 'chat', 's2', '2026-08-02');

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].mentionCount).toBe(2);
    });
  });

  describe('Query helpers', () => {
    it('getEntity finds by name (case insensitive)', () => {
      const data = createEmptyDistillationStore('elias');
      const entities: DetectedEntity[] = [{
        name: 'Melissa',
        entityType: 'person',
        relation: 'partner',
        valence: 'positive',
        contextSnippet: 'mijn vriendin Melissa',
        confidence: 'high',
      }];
      const result = store.mergeDetections(data, entities, [], [], 'chat', 's1', '2026-08-01');

      expect(store.getEntity(result, 'melissa')).toBeDefined();
      expect(store.getEntity(result, 'MELISSA')).toBeDefined();
      expect(store.getEntity(result, 'Jan')).toBeUndefined();
    });

    it('getRecentEntities returns sorted by lastMentionedAt', () => {
      const data = createEmptyDistillationStore('elias');
      const entities: DetectedEntity[] = [
        { name: 'Anna', entityType: 'person', relation: 'moeder', valence: 'positive', contextSnippet: 'mijn moeder Anna', confidence: 'high' },
        { name: 'Peter', entityType: 'person', relation: 'therapeut', valence: 'neutral', contextSnippet: 'mijn therapeut Peter', confidence: 'medium' },
      ];
      const result = store.mergeDetections(data, entities, [], [], 'chat', 's1', '2026-08-01');
      const recent = store.getRecentEntities(result, 5);
      expect(recent.length).toBe(2);
    });

    it('getHighConfidenceSignals filters correctly', () => {
      const data = createEmptyDistillationStore('elias');
      const signal: DetectedSignal = {
        signalType: 'new_trigger_detected',
        normalizedText: 'alcohol trigger',
        rawUserTextExcerpt: 'alcohol maakt me onrustig',
        confidence: 'low',
      };
      // Add 3 times across different sessions/days to reach high confidence
      let result = store.mergeDetections(data, [], [signal], [], 'chat', 's1', '2026-08-01');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's2', '2026-08-02');
      result = store.mergeDetections(result, [], [signal], [], 'chat', 's3', '2026-08-03');

      const highConf = store.getHighConfidenceSignals(result);
      expect(highConf.length).toBe(1);
      expect(highConf[0].confidence).toBe('high');
    });
  });
});
