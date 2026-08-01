/**
 * DIST01 — Context Injector Tests
 *
 * Tests for building the distillation context that gets injected into GPT prompts.
 */
import { describe, it, expect } from 'vitest';
import { buildDistillationContext, hasDistillationContent } from '@/lib/engine/shared/dist01-context-injector';
import { createEmptyDistillationStore } from '@/lib/engine/shared/dist01-types';
import { createDistillationStore } from '@/lib/engine/shared/dist01-store';
import type { DetectedEntity, DetectedSignal, DetectedContext } from '@/lib/engine/shared/dist01-types';

describe('DIST01 Context Injector', () => {
  describe('hasDistillationContent', () => {
    it('returns false for empty store', () => {
      const data = createEmptyDistillationStore('elias');
      expect(hasDistillationContent(data)).toBe(false);
    });

    it('returns true when store has entities', () => {
      const storeApi = createDistillationStore();
      const data = createEmptyDistillationStore('elias');
      const entities: DetectedEntity[] = [{
        name: 'Melissa',
        entityType: 'person',
        relation: 'partner',
        valence: 'positive',
        contextSnippet: 'mijn vriendin Melissa',
        confidence: 'high',
      }];
      const result = storeApi.mergeDetections(data, entities, [], [], 'chat', 's1', '2026-08-01');
      expect(hasDistillationContent(result)).toBe(true);
    });
  });

  describe('buildDistillationContext', () => {
    it('returns empty arrays for empty store', () => {
      const data = createEmptyDistillationStore('elias');
      const context = buildDistillationContext(data);
      expect(context.knownPersons).toHaveLength(0);
      expect(context.recentContext).toHaveLength(0);
      expect(context.activeSignals).toHaveLength(0);
    });

    it('includes known persons with relation', () => {
      const storeApi = createDistillationStore();
      const data = createEmptyDistillationStore('elias');
      const entities: DetectedEntity[] = [
        { name: 'Melissa', entityType: 'person', relation: 'partner', valence: 'positive', contextSnippet: 'mijn vriendin Melissa', confidence: 'high' },
        { name: 'UZ Gent', entityType: 'place', relation: null, valence: 'neutral', contextSnippet: 'ik werk bij UZ Gent', confidence: 'medium' },
      ];
      const result = storeApi.mergeDetections(data, entities, [], [], 'chat', 's1', '2026-08-01');
      const context = buildDistillationContext(result);

      expect(context.knownPersons.length).toBeGreaterThanOrEqual(1);
      const melissa = context.knownPersons.find(p => p.name === 'Melissa');
      expect(melissa).toBeDefined();
      expect(melissa!.relation).toBe('partner');
    });

    it('includes active signals with high confidence (3+ detections across sessions)', () => {
      const storeApi = createDistillationStore();
      const data = createEmptyDistillationStore('elias');
      const signals: DetectedSignal[] = [{
        signalType: 'new_trigger_detected',
        normalizedText: 'alcohol zien maakt onrustig',
        rawUserTextExcerpt: 'als ik alcohol zie word ik onrustig',
        confidence: 'medium',
      }];
      // Add 3 times across different sessions/days to reach high confidence
      let result = storeApi.mergeDetections(data, [], signals, [], 'chat', 's1', '2026-08-01');
      result = storeApi.mergeDetections(result, [], signals, [], 'chat', 's2', '2026-08-02');
      result = storeApi.mergeDetections(result, [], signals, [], 'chat', 's3', '2026-08-03');

      const context = buildDistillationContext(result);
      expect(context.activeSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('includes recent context items', () => {
      const storeApi = createDistillationStore();
      const data = createEmptyDistillationStore('kim');
      const contexts: DetectedContext[] = [
        { contextType: 'life_event', summary: 'Recent gescheiden', confidence: 'medium' },
        { contextType: 'current_situation', summary: 'Werkt als verpleegkundige', confidence: 'medium' },
      ];
      const result = storeApi.mergeDetections(data, [], [], contexts, 'chat', 's1', '2026-08-01');
      const context = buildDistillationContext(result);

      expect(context.recentContext.length).toBe(2);
    });

    it('limits output to max 7 persons', () => {
      const storeApi = createDistillationStore();
      let data = createEmptyDistillationStore('elias');
      // Add 10 persons
      for (let i = 0; i < 10; i++) {
        const entities: DetectedEntity[] = [{
          name: `Person${i}`,
          entityType: 'person',
          relation: null,
          valence: 'neutral',
          contextSnippet: `context ${i}`,
          confidence: 'medium',
        }];
        data = storeApi.mergeDetections(data, entities, [], [], 'chat', `s${i}`, '2026-08-01');
      }
      const context = buildDistillationContext(data);
      expect(context.knownPersons.length).toBeLessThanOrEqual(7);
    });
  });
});
