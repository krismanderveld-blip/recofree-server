import { describe, it, expect } from 'vitest';
import { computeBackpackHash, hasBackpackChanged, getChangedSections } from '@/lib/backpack-extractor/hash';
import type { ExtractedEntities, BackpackHashState } from '@/lib/backpack-extractor/types';
import type { Backpack } from '@/lib/ai/types';

// Helper to create a minimal section
function makeSection(id: 'childhood' | 'adolescence' | 'adulthood' | 'family' | 'themes', content: string) {
  return { id, label: id, ageRange: '0-12', prompt: '', content, lastUpdated: null };
}

// Helper to create a minimal Backpack for testing
function makeBackpack(overrides: Partial<Backpack> = {}): Backpack {
  return {
    naam: 'Test',
    userType: 'elias',
    sections: [],
    intakeContext: {
      stageOfChange: 'contemplation',
      startEmotion: '',
      urgency: 'midden',
      initialContext: '',
      intakeDate: '2026-01-01',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BackpackEntityExtractor', () => {
  describe('computeBackpackHash', () => {
    it('returns consistent hash for same content', () => {
      const backpack = makeBackpack({
        sections: [makeSection('childhood', 'Ik ben opgegroeid in Gent')],
      });
      const hash1 = computeBackpackHash(backpack);
      const hash2 = computeBackpackHash(backpack);
      expect(hash1.combinedHash).toBe(hash2.combinedHash);
    });

    it('returns different hash for different content', () => {
      const backpack1 = makeBackpack({
        sections: [makeSection('childhood', 'Ik ben opgegroeid in Gent')],
      });
      const backpack2 = makeBackpack({
        sections: [makeSection('childhood', 'Ik ben opgegroeid in Brussel')],
      });
      const hash1 = computeBackpackHash(backpack1);
      const hash2 = computeBackpackHash(backpack2);
      expect(hash1.combinedHash).not.toBe(hash2.combinedHash);
    });

    it('ignores empty sections', () => {
      const backpack = makeBackpack({
        sections: [makeSection('childhood', '')],
      });
      const hash = computeBackpackHash(backpack);
      expect(hash.sections).toHaveLength(0);
    });

    it('includes Kim backpack sections when present', () => {
      const backpack = makeBackpack({
        kimBackpack: {
          my_story: 'Mijn verhaal als naaste',
          the_relationship: '',
          the_impact: 'De impact op mij',
          my_boundaries: '',
          my_strength: '',
        },
      });
      const hash = computeBackpackHash(backpack);
      expect(hash.sections.length).toBe(2); // my_story + the_impact
      expect(hash.sections.map(s => s.sectionId)).toContain('kim_my_story');
      expect(hash.sections.map(s => s.sectionId)).toContain('kim_the_impact');
    });

    it('includes intake context when present', () => {
      const backpack = makeBackpack({
        intakeContext: {
          stageOfChange: 'contemplation',
          startEmotion: 'angstig',
          urgency: 'hoog',
          initialContext: 'Ik drink te veel sinds de scheiding',
          intakeDate: '2026-01-01',
        },
      });
      const hash = computeBackpackHash(backpack);
      expect(hash.sections.map(s => s.sectionId)).toContain('intake_context');
    });
  });

  describe('hasBackpackChanged', () => {
    it('returns true when no previous hash exists', () => {
      const backpack = makeBackpack({
        sections: [makeSection('childhood', 'Ik groeide op in Gent')],
      });
      const currentHash = computeBackpackHash(backpack);
      const result = hasBackpackChanged(currentHash, null);
      expect(result).toBe(true);
    });

    it('returns false when content has not changed', () => {
      const backpack = makeBackpack({
        sections: [makeSection('childhood', 'Ik groeide op in Gent')],
      });
      const hash1 = computeBackpackHash(backpack);
      const hash2 = computeBackpackHash(backpack);
      const result = hasBackpackChanged(hash2, hash1);
      expect(result).toBe(false);
    });

    it('returns true when a section content changes', () => {
      const backpack1 = makeBackpack({
        sections: [makeSection('childhood', 'Ik groeide op in Gent')],
      });
      const backpack2 = makeBackpack({
        sections: [makeSection('childhood', 'Ik groeide op in Brussel met mijn moeder')],
      });
      const hash1 = computeBackpackHash(backpack1);
      const hash2 = computeBackpackHash(backpack2);
      const result = hasBackpackChanged(hash2, hash1);
      expect(result).toBe(true);
    });
  });

  describe('getChangedSections', () => {
    it('returns all sections when no previous hash', () => {
      const backpack = makeBackpack({
        sections: [
          makeSection('childhood', 'Content 1'),
          makeSection('adolescence', 'Content 2'),
        ],
      });
      const hash = computeBackpackHash(backpack);
      const changed = getChangedSections(hash, null);
      expect(changed).toContain('childhood');
      expect(changed).toContain('adolescence');
    });

    it('returns only changed sections', () => {
      const backpack1 = makeBackpack({
        sections: [
          makeSection('childhood', 'Content 1'),
          makeSection('adolescence', 'Content 2'),
        ],
      });
      const backpack2 = makeBackpack({
        sections: [
          makeSection('childhood', 'Content 1'), // Same
          makeSection('adolescence', 'Updated content'), // Changed
        ],
      });
      const hash1 = computeBackpackHash(backpack1);
      const hash2 = computeBackpackHash(backpack2);
      const changed = getChangedSections(hash2, hash1);
      expect(changed).not.toContain('childhood');
      expect(changed).toContain('adolescence');
    });

    it('returns new sections that did not exist before', () => {
      const backpack1 = makeBackpack({
        sections: [
          makeSection('childhood', 'Content 1'),
        ],
      });
      const backpack2 = makeBackpack({
        sections: [
          makeSection('childhood', 'Content 1'),
          makeSection('adolescence', 'New section'),
        ],
      });
      const hash1 = computeBackpackHash(backpack1);
      const hash2 = computeBackpackHash(backpack2);
      const changed = getChangedSections(hash2, hash1);
      expect(changed).toEqual(['adolescence']);
    });
  });

  describe('ExtractedEntities type validation', () => {
    it('validates a complete extracted entities object', () => {
      const entities: ExtractedEntities = {
        persons: [
          {
            name: 'Lisa',
            relationship: 'daughter',
            relationshipNL: 'dochter',
            age: '14',
            livingSituation: 'woont bij ex-partner',
            emotionalValence: 'ambivalent',
            context: 'Ziet haar om het weekend',
            sourceSection: 'childhood',
          },
        ],
        events: [
          {
            description: 'Scheiding van partner',
            type: 'loss',
            timePeriod: '2020',
            peopleInvolved: ['Lisa', 'ex-partner'],
            emotionalImpact: 'diep verdriet en schuldgevoel',
            isTriggerSource: true,
            sourceSection: 'adult',
          },
        ],
        patterns: [
          {
            description: 'Vermijding van conflict door terugtrekking',
            type: 'avoidance',
            schemaHypothesis: 'emotionele verwaarlozing',
            frequency: 'recurring',
            peopleInvolved: ['partner'],
            sourceSection: 'teen',
          },
        ],
        contexts: [
          {
            description: 'Werkt als verpleegkundige in nachtdienst',
            type: 'work',
            relevance: 'beïnvloedt slaappatroon en sociaal contact',
            sourceSection: 'adult',
          },
        ],
        extractedAt: '2026-06-10T12:00:00.000Z',
        sourceHash: 'abc123def456',
        schemaVersion: 1,
      };

      expect(entities.persons).toHaveLength(1);
      expect(entities.persons[0].name).toBe('Lisa');
      expect(entities.persons[0].emotionalValence).toBe('ambivalent');
      expect(entities.events).toHaveLength(1);
      expect(entities.events[0].isTriggerSource).toBe(true);
      expect(entities.events[0].type).toBe('loss');
      expect(entities.patterns).toHaveLength(1);
      expect(entities.patterns[0].schemaHypothesis).toBe('emotionele verwaarlozing');
      expect(entities.patterns[0].type).toBe('avoidance');
      expect(entities.patterns[0].frequency).toBe('recurring');
      expect(entities.contexts).toHaveLength(1);
      expect(entities.contexts[0].type).toBe('work');
      expect(entities.schemaVersion).toBe(1);
    });

    it('handles entities with null optional fields', () => {
      const entities: ExtractedEntities = {
        persons: [
          {
            name: 'Mama',
            relationship: 'mother',
            relationshipNL: 'moeder',
            age: null,
            livingSituation: null,
            emotionalValence: 'negative',
            context: 'Moeilijke relatie',
            sourceSection: 'childhood',
          },
        ],
        events: [],
        patterns: [],
        contexts: [],
        extractedAt: '2026-06-10T12:00:00.000Z',
        sourceHash: 'test123',
        schemaVersion: 1,
      };

      expect(entities.persons[0].age).toBeNull();
      expect(entities.persons[0].livingSituation).toBeNull();
      expect(entities.events).toHaveLength(0);
    });
  });

  describe('computeSectionHash (via computeBackpackHash)', () => {
    it('trims whitespace before hashing', () => {
      const backpack1 = makeBackpack({
        sections: [makeSection('childhood', '  hello world  ')],
      });
      const backpack2 = makeBackpack({
        sections: [makeSection('childhood', 'hello world')],
      });
      const hash1 = computeBackpackHash(backpack1);
      const hash2 = computeBackpackHash(backpack2);
      expect(hash1.combinedHash).toBe(hash2.combinedHash);
    });
  });
});
