/**
 * PAR01 NL Detection Tests
 *
 * Tests that Dutch (NL) trigger patterns are correctly detected
 * across all 9 marker categories, AND that existing English patterns
 * continue to work unchanged.
 */

import { describe, it, expect } from 'vitest';
import { detectPAR01 } from '@/lib/engine/kim/modules/par01/par01-detector';
import type { PAR01DetectionInput } from '@/lib/engine/kim/modules/par01/par01-types';

function makeInput(message: string, overrides?: Partial<PAR01DetectionInput>): PAR01DetectionInput {
  return {
    message,
    recentHistory: [],
    k06Stabilized: true,
    crisisLevel: 0,
    previousDetections: [],
    backpackContext: '',
    ...overrides,
  };
}

describe('PAR01 — Dutch (NL) trigger detection', () => {
  describe('role-reversal (NL)', () => {
    it('detects "ik moet voor hem zorgen als een kind"', () => {
      const result = detectPAR01(makeInput(
        'ik moet altijd zorgen voor hem, alsof ik zijn moeder ben. als ik het niet doe doet niemand het.'
      ));
      expect(result.markers).toContain('role-reversal');
    });

    it('detects "alsof ik haar vader ben"', () => {
      const result = detectPAR01(makeInput(
        'het voelt alsof ik haar vader ben, ik moet haar alles leren. en zonder mij lukt het niet.'
      ));
      expect(result.markers).toContain('role-reversal');
    });
  });

  describe('responsibility-overload (NL)', () => {
    it('detects "als ik het niet doe doet niemand het"', () => {
      const result = detectPAR01(makeInput(
        'als ik het niet doe doet niemand anders het. ik moet alles alleen doen.'
      ));
      expect(result.markers).toContain('responsibility-overload');
    });

    it('detects "alles op mijn schouders"', () => {
      const result = detectPAR01(makeInput(
        'ik draag alles op mijn schouders. als ik er niet ben valt alles uit elkaar.'
      ));
      expect(result.markers).toContain('responsibility-overload');
    });
  });

  describe('own-needs-suppressed (NL)', () => {
    it('detects "mijn behoeften doen er niet toe"', () => {
      const result = detectPAR01(makeInput(
        'mijn behoeften doen er niet toe. ik kom altijd als laatste.'
      ));
      expect(result.markers).toContain('own-needs-suppressed');
    });

    it('detects "geen tijd voor mezelf"', () => {
      const result = detectPAR01(makeInput(
        'ik heb geen tijd voor mezelf, altijd hij eerst. ik tel niet mee.'
      ));
      expect(result.markers).toContain('own-needs-suppressed');
    });
  });

  describe('guilt-when-stepping-back (NL)', () => {
    it('detects "ik voel me schuldig als ik even niet help"', () => {
      const result = detectPAR01(makeInput(
        'ik voel me schuldig als ik even niet help. ik kan hem toch niet zomaar achterlaten.'
      ));
      expect(result.markers).toContain('guilt-when-stepping-back');
    });

    it('detects "schuldig + afstand nemen"', () => {
      const result = detectPAR01(makeInput(
        'ik voel me zo schuldig als ik afstand neem. het lukt niet om los te laten.'
      ));
      expect(result.markers).toContain('guilt-when-stepping-back');
    });
  });

  describe('identity-as-caretaker (NL)', () => {
    it('detects "ik ben er altijd voor iedereen"', () => {
      const result = detectPAR01(makeInput(
        'ik ben er altijd voor iedereen. zonder mij lukt het niet.'
      ));
      expect(result.markers).toContain('identity-as-caretaker');
    });

    it('detects "ik ben degene die alles fixt"', () => {
      const result = detectPAR01(makeInput(
        'ik ben degene die alles fixt. ze hebben mij nodig, ze zijn afhankelijk van mij.'
      ));
      expect(result.markers).toContain('identity-as-caretaker');
    });
  });

  describe('childhood-pattern (NL)', () => {
    it('detects "ik deed dit al als kind"', () => {
      const result = detectPAR01(makeInput(
        'ik deed dit al als kind. ik zorgde al voor mijn moeder toen ik klein was.'
      ));
      expect(result.markers).toContain('childhood-pattern');
    });

    it('detects "moest te vroeg volwassen worden"', () => {
      const result = detectPAR01(makeInput(
        'ik moest snel volwassen worden. mijn hele leven al verantwoordelijk voor alles.'
      ));
      expect(result.markers).toContain('childhood-pattern');
    });
  });

  describe('exhaustion-denial (NL)', () => {
    it('detects "ik ben kapot maar ik moet door"', () => {
      const result = detectPAR01(makeInput(
        'ik ben kapot maar ik moet door. ik mag niet moe zijn.'
      ));
      expect(result.markers).toContain('exhaustion-denial');
    });

    it('detects "uitgeput maar toch doorgaan"', () => {
      const result = detectPAR01(makeInput(
        'ik ben zo uitgeput maar toch ga ik door. rust kan later, niet nu.'
      ));
      expect(result.markers).toContain('exhaustion-denial');
    });
  });

  describe('emotional-labor (NL)', () => {
    it('detects "ik houd alles bij elkaar"', () => {
      const result = detectPAR01(makeInput(
        'ik houd alles bij elkaar. ik moet de sfeer bewaken voor iedereen.'
      ));
      expect(result.markers).toContain('emotional-labor');
    });

    it('detects "emoties reguleren voor hem"', () => {
      const result = detectPAR01(makeInput(
        'ik moet hem altijd kalmeren en sussen. bij elkaar houden is mijn taak.'
      ));
      expect(result.markers).toContain('emotional-labor');
    });
  });

  describe('boundary-inability (NL)', () => {
    it('detects "ik kan geen nee zeggen"', () => {
      const result = detectPAR01(makeInput(
        'ik kan geen nee zeggen. ik zeg altijd ja, ook als ik niet wil.'
      ));
      expect(result.markers).toContain('boundary-inability');
    });

    it('detects "ik durf geen grens te stellen"', () => {
      const result = detectPAR01(makeInput(
        'ik durf geen grens te stellen. altijd geven geven geven en nooit krijgen.'
      ));
      expect(result.markers).toContain('boundary-inability');
    });
  });

  describe('Combined NL detection (multi-marker threshold)', () => {
    it('detects parentification with 2+ NL markers', () => {
      const result = detectPAR01(makeInput(
        'ik moet altijd zorgen voor hem, alsof ik zijn moeder ben. als ik het niet doe doet niemand anders het. ik ben zo moe maar ik moet door.'
      ));
      expect(result.detected).toBe(true);
      expect(result.markers.length).toBeGreaterThanOrEqual(2);
      expect(result.confidence).toBeGreaterThanOrEqual(0.35);
    });

    it('single NL marker is insufficient', () => {
      const result = detectPAR01(makeInput(
        'ik ben moe maar ik moet door.'
      ));
      expect(result.detected).toBe(false);
    });
  });

  describe('English patterns still work (regression)', () => {
    it('detects EN role-reversal + responsibility-overload', () => {
      const result = detectPAR01(makeInput(
        'I have to take care of him like he is a child. If I don\'t do it, nobody else will.'
      ));
      expect(result.detected).toBe(true);
      expect(result.markers).toContain('role-reversal');
      expect(result.markers).toContain('responsibility-overload');
    });

    it('detects EN childhood-pattern + identity-as-caretaker', () => {
      const result = detectPAR01(makeInput(
        'As a child I always had to care for everyone. Without me they would fall apart.'
      ));
      expect(result.detected).toBe(true);
      expect(result.markers).toContain('identity-as-caretaker');
      expect(result.markers).toContain('childhood-pattern');
    });

    it('detects EN exhaustion-denial + guilt-when-stepping-back', () => {
      const result = detectPAR01(makeInput(
        'I am so exhausted but I have to keep going. I feel guilty when I try to step back and rest.'
      ));
      expect(result.detected).toBe(true);
      expect(result.markers).toContain('exhaustion-denial');
      expect(result.markers).toContain('guilt-when-stepping-back');
    });

    it('EN single marker insufficient', () => {
      const result = detectPAR01(makeInput(
        'I am tired but I must keep going.'
      ));
      expect(result.detected).toBe(false);
    });
  });

  describe('Safety gates still work with NL input', () => {
    it('does not activate when K06 not stabilized (NL input)', () => {
      const result = detectPAR01(makeInput(
        'ik moet altijd zorgen voor hem. als ik het niet doe doet niemand het.',
        { k06Stabilized: false }
      ));
      expect(result.detected).toBe(false);
      expect(result.markers).toHaveLength(0);
    });

    it('does not activate during crisis (NL input)', () => {
      const result = detectPAR01(makeInput(
        'ik moet altijd zorgen voor hem. als ik het niet doe doet niemand het.',
        { crisisLevel: 2 }
      ));
      expect(result.detected).toBe(false);
      expect(result.markers).toHaveLength(0);
    });
  });
});
