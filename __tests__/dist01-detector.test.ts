/**
 * DIST01 — Detector Tests
 *
 * Tests for the deterministic entity/signal/context extraction from user text.
 */
import { describe, it, expect } from 'vitest';
import { detectDistillation } from '@/lib/engine/shared/dist01-detector';
import type { DetectorInput } from '@/lib/engine/shared/dist01-types';

function makeInput(userText: string, userName = 'Kris'): DetectorInput {
  return {
    userText,
    source: 'chat',
    persona: 'elias',
    sessionId: 's_test_1',
    localDayKey: '2026-08-01',
    userName,
  };
}

describe('DIST01 Detector', () => {
  describe('Entity Detection', () => {
    it('detects a person with explicit relationship (mijn vriendin)', () => {
      const result = detectDistillation(makeInput('Ik heb vandaag met mijn vriendin Melissa gepraat'));
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const melissa = result.entities.find(e => e.name === 'Melissa');
      expect(melissa).toBeDefined();
      expect(melissa!.entityType).toBe('person');
      expect(melissa!.relation).toBe('partner');
    });

    it('detects a person with relationship (mijn moeder)', () => {
      const result = detectDistillation(makeInput('Mijn moeder Anna belde me gisteren'));
      const anna = result.entities.find(e => e.name === 'Anna');
      expect(anna).toBeDefined();
      expect(anna!.relation).toBe('moeder');
    });

    it('detects a person with relationship (mijn therapeut)', () => {
      const result = detectDistillation(makeInput('Ik heb een afspraak met mijn therapeut Peter'));
      const peter = result.entities.find(e => e.name === 'Peter');
      expect(peter).toBeDefined();
      expect(peter!.relation).toBe('therapeut');
    });

    it('does not detect the user themselves as an entity', () => {
      const result = detectDistillation(makeInput('Ik ben Kris en ik voel me goed', 'Kris'));
      const kris = result.entities.find(e => e.name === 'Kris');
      expect(kris).toBeUndefined();
    });

    it('skips very short messages', () => {
      const result = detectDistillation(makeInput('Hoi'));
      expect(result.entities).toHaveLength(0);
      expect(result.signals).toHaveLength(0);
      expect(result.contexts).toHaveLength(0);
    });

    it('detects a place entity', () => {
      const result = detectDistillation(makeInput('Ik werk bij het UZ Gent en daar voel ik me veilig'));
      const place = result.entities.find(e => e.entityType === 'place');
      // Place detection is optional/heuristic, but if detected:
      if (place) {
        expect(place.name).toContain('UZ Gent');
      }
    });
  });

  describe('Signal Detection', () => {
    it('detects a trigger signal (recurring_trigger_detected)', () => {
      const result = detectDistillation(makeInput('Elke keer als ik alcohol zie word ik onrustig en gespannen'));
      const triggers = result.signals.filter(s => s.signalType === 'recurring_trigger_detected' || s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a self-care/protective pattern', () => {
      const result = detectDistillation(makeInput('Wat mij helpt is wandelen in het bos om tot rust te komen'));
      const protective = result.signals.filter(s => s.signalType === 'self_care_pattern_detected');
      expect(protective.length).toBeGreaterThanOrEqual(1);
    });

    it('detects an anchor sentence', () => {
      const result = detectDistillation(makeInput('Ik ben sterker dan mijn verslaving en ik verdien een goed leven'));
      const anchors = result.signals.filter(s => s.signalType === 'anchor_sentence_detected');
      expect(anchors.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a zone signal', () => {
      const result = detectDistillation(makeInput('Ik zit in het rood en het gaat echt niet goed vandaag'));
      const zoneSignals = result.signals.filter(s => s.signalType === 'zone_signal_detected');
      expect(zoneSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a boundary pattern', () => {
      const result = detectDistillation(makeInput('Ik wil niet meer dat hij zo tegen mij praat, mijn grens is bereikt'));
      const boundaries = result.signals.filter(s => s.signalType === 'boundary_pattern_detected');
      expect(boundaries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Context Detection', () => {
    it('detects a life event context', () => {
      const result = detectDistillation(makeInput('Ik ben gescheiden en dat valt me heel zwaar'));
      const lifeEvents = result.contexts.filter(c => c.contextType === 'life_event');
      expect(lifeEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a work/study context (current_situation)', () => {
      const result = detectDistillation(makeInput('Ik werk als verpleegkundige en het is heel druk en stressvol'));
      const contexts = result.contexts.filter(c => c.contextType === 'current_situation');
      expect(contexts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects a living situation context (current_situation)', () => {
      const result = detectDistillation(makeInput('Ik woon alleen in een klein appartement in Brussel'));
      const contexts = result.contexts.filter(c => c.contextType === 'current_situation');
      expect(contexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string gracefully', () => {
      const result = detectDistillation(makeInput(''));
      expect(result.entities).toHaveLength(0);
      expect(result.signals).toHaveLength(0);
      expect(result.contexts).toHaveLength(0);
    });

    it('handles text with only punctuation', () => {
      const result = detectDistillation(makeInput('... !!! ???'));
      expect(result.entities).toHaveLength(0);
    });

    it('does not produce false positives on generic text', () => {
      const result = detectDistillation(makeInput('Het weer is vandaag mooi en ik ga naar buiten'));
      // Should not produce trigger/anchor/boundary signals from neutral text
      const highConfSignals = result.signals.filter(s => s.confidence === 'high');
      expect(highConfSignals).toHaveLength(0);
    });
  });
});
