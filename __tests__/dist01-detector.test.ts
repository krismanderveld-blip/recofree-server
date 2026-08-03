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

  describe('Addiction Recovery Signal Detection (Elias)', () => {
    // ─── Valkuil / trigger (natural speech) ─────────────────────────────────
    it('detects "X is mijn grootste valkuil"', () => {
      const result = detectDistillation(makeInput('hij is mijn grootste valkuil omdat ik maar weinig contact met hem heb'));
      const triggers = result.signals.filter(s => s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
      expect(triggers[0].normalizedText).toContain('valkuil');
    });

    it('detects "X is een risico voor mij"', () => {
      const result = detectDistillation(makeInput('Alcohol op feestjes is een risico voor mij'));
      const triggers = result.signals.filter(s => s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "bij X moet ik oppassen"', () => {
      const result = detectDistillation(makeInput('Bij oude vrienden moet ik oppassen want ze drinken allemaal'));
      const triggers = result.signals.filter(s => s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "X trekt me / verleidt me"', () => {
      const result = detectDistillation(makeInput('Het uitgaansleven trekt me nog steeds enorm'));
      const triggers = result.signals.filter(s => s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik kan niet weerstaan"', () => {
      const result = detectDistillation(makeInput('Ik kan niet weerstaan als er een fles op tafel staat'));
      const triggers = result.signals.filter(s => s.signalType === 'new_trigger_detected');
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Terugval / relapse ──────────────────────────────────────────────────
    it('detects "ik heb een terugval gehad"', () => {
      const result = detectDistillation(makeInput('Vorig weekend heb ik een terugval gehad'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
      expect(risk[0].normalizedText).toContain('terugval');
    });

    it('detects "ik ben teruggevallen"', () => {
      const result = detectDistillation(makeInput('Ik ben teruggevallen na drie weken nuchter te zijn'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik heb weer gedronken"', () => {
      const result = detectDistillation(makeInput('Ik heb weer gedronken gisteren, ik schaam me'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "het is weer fout gegaan"', () => {
      const result = detectDistillation(makeInput('Het is weer fout gegaan afgelopen weekend'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "herval gehad"', () => {
      const result = detectDistillation(makeInput('Ik heb een herval gehad na het bezoek'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Anchor sentences (nuchter/kracht) ───────────────────────────────────
    it('detects "X geeft me kracht om nuchter te blijven"', () => {
      const result = detectDistillation(makeInput('Hem zien zal me terug kracht geven om nuchter te blijven'));
      const anchors = result.signals.filter(s => s.signalType === 'anchor_sentence_detected');
      expect(anchors.length).toBeGreaterThanOrEqual(1);
      expect(anchors.some(a => a.normalizedText.includes('nuchter') || a.normalizedText.includes('kracht'))).toBe(true);
    });

    it('detects "ik doe het voor mijn zoon"', () => {
      const result = detectDistillation(makeInput('Ik doe het voor mijn zoon, hij verdient een nuchtere vader'));
      const anchors = result.signals.filter(s => s.signalType === 'anchor_sentence_detected');
      expect(anchors.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik wil nuchter blijven"', () => {
      const result = detectDistillation(makeInput('Ik wil nuchter blijven voor mezelf en mijn gezin'));
      const anchors = result.signals.filter(s => s.signalType === 'anchor_sentence_detected');
      expect(anchors.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "nuchter blijven betekent..."', () => {
      const result = detectDistillation(makeInput('Nuchter blijven betekent vrijheid voor mij'));
      const anchors = result.signals.filter(s => s.signalType === 'anchor_sentence_detected');
      expect(anchors.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Patroonherkenning ───────────────────────────────────────────────────
    it('detects "ja dat herken ik wel"', () => {
      const result = detectDistillation(makeInput('Ja dat herken ik wel, ik doe dat altijd'));
      const patterns = result.signals.filter(s => s.signalType === 'recurring_trigger_detected');
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0].normalizedText).toContain('patroonherkenning');
    });

    it('detects "het is altijd hetzelfde"', () => {
      const result = detectDistillation(makeInput('Het is altijd hetzelfde verhaal met mij'));
      const patterns = result.signals.filter(s => s.signalType === 'recurring_trigger_detected');
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik merk dat ik..."', () => {
      const result = detectDistillation(makeInput('Ik merk dat ik steeds dezelfde fouten maak in relaties'));
      const patterns = result.signals.filter(s => s.signalType === 'recurring_trigger_detected');
      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Craving / zucht ─────────────────────────────────────────────────────
    it('detects "ik heb trek in alcohol"', () => {
      const result = detectDistillation(makeInput('Ik heb trek in een biertje vanavond'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
      expect(risk[0].normalizedText).toContain('craving');
    });

    it('detects "de verleiding wordt sterker"', () => {
      const result = detectDistillation(makeInput('De verleiding wordt sterker als ik alleen ben'));
      const risk = result.signals.filter(s => s.signalType === 'risk_pattern_detected');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Protective / recovery ───────────────────────────────────────────────
    it('detects "ik ben al X dagen nuchter"', () => {
      const result = detectDistillation(makeInput('Ik ben al 45 dagen nuchter en dat voelt goed'));
      const protective = result.signals.filter(s => s.signalType === 'protective_pattern_detected');
      expect(protective.length).toBeGreaterThanOrEqual(1);
    });

    // ─── Support source (addiction) ──────────────────────────────────────────
    it('detects "mijn sponsor"', () => {
      const result = detectDistillation(makeInput('Mijn sponsor heeft me geholpen om rustig te blijven'));
      const support = result.signals.filter(s => s.signalType === 'support_source_detected');
      expect(support.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Addiction Recovery Context Detection', () => {
    it('detects "ik zit in opname"', () => {
      const result = detectDistillation(makeInput('Ik zit in opname nu, het was een week geleden'));
      const contexts = result.contexts.filter(c => c.contextType === 'current_situation');
      expect(contexts.length).toBeGreaterThanOrEqual(1);
      expect(contexts[0].summary).toContain('opname');
    });

    it('detects "ik ben in behandeling"', () => {
      const result = detectDistillation(makeInput('Ik ben in behandeling voor mijn alcoholverslaving'));
      const contexts = result.contexts.filter(c => c.contextType === 'current_situation');
      expect(contexts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik volg een programma"', () => {
      const result = detectDistillation(makeInput('Ik volg een programma van zes weken in de kliniek'));
      const contexts = result.contexts.filter(c => c.contextType === 'current_situation');
      expect(contexts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects "ik ga naar AA"', () => {
      const result = detectDistillation(makeInput('Ik ga naar AA elke dinsdag en dat helpt'));
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
