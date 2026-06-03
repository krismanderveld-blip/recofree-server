/**
 * SW01 Shadow Work — Projection Mapper
 *
 * Detects projection patterns and maps them to relational categories.
 * Projection means the user sees something outside themselves that also
 * carries inner meaning. It does NOT mean the external situation is false.
 *
 * CANON: shadowwork.txt section 10
 * Rule: Never say "you are projecting" as accusation.
 * Say: "This reaction may be showing us something."
 */

import type { ProjectionEntry } from './sw01_shadow_types';

// ─── Projection Triggers ─────────────────────────────────────────────────────

export type ProjectionChannel =
  | 'irritation'
  | 'attraction'
  | 'obsession'
  | 'jealousy'
  | 'disgust'
  | 'admiration'
  | 'moral_judgment'
  | 'fear'
  | 'idealization'
  | 'contempt';

export type RelationalCategory =
  | 'partner_ex'
  | 'parent_family'
  | 'friends_peers'
  | 'authority_therapeutic';

// ─── Relational Shadow Patterns ──────────────────────────────────────────────

interface RelationalPattern {
  category: RelationalCategory;
  common_shadows: string[];
  elias_questions: string[];
}

const RELATIONAL_PATTERNS: RelationalPattern[] = [
  {
    category: 'partner_ex',
    common_shadows: [
      'fear of being left',
      'fear of being trapped',
      'sexual shame',
      'dependency conflict',
      'resentment',
      'unspoken needs',
      'control',
      'comparison',
      'betrayal wound',
    ],
    elias_questions: [
      'What does this person awaken in you that feels older than this situation?',
      'What do you want from them that you are ashamed to need?',
      'What part of you becomes most extreme around them?',
    ],
  },
  {
    category: 'parent_family',
    common_shadows: [
      'old child part',
      'anger never allowed',
      'loyalty conflict',
      'shame inheritance',
      'fear of disappointing',
      'fear of becoming like them',
    ],
    elias_questions: [
      'When you speak to them, how old do you feel inside?',
      'What role do you automatically return to?',
      'What truth are you still not allowed to say there?',
    ],
  },
  {
    category: 'friends_peers',
    common_shadows: [
      'comparison',
      'inferiority',
      'envy',
      'fear of exclusion',
      'performance self',
      'false confidence',
    ],
    elias_questions: [
      'What do you pretend not to care about with them?',
      'Who do you become to stay included?',
      'What part of you feels smaller after contact?',
    ],
  },
  {
    category: 'authority_therapeutic',
    common_shadows: [
      'wanting rescue',
      'resisting help',
      'testing safety',
      'shame around dependence',
      'anger at being seen',
    ],
    elias_questions: [
      'Do you want help here, or do you want to prove that help will fail?',
      'What would happen if someone actually saw the part you hide?',
    ],
  },
];

// ─── Projection Detection ────────────────────────────────────────────────────

// Keywords that suggest projection intensity
const PROJECTION_INTENSITY_MARKERS: string[] = [
  'always', 'never', 'hate', 'cannot stand', 'makes me sick',
  'obsessed', 'jealous', 'furious', 'disgusted', 'fascinated',
  'cannot stop thinking', 'drives me crazy', 'reminds me of',
  'just like', 'exactly like', 'triggered',
  // Dutch equivalents
  'altijd', 'nooit', 'haat', 'kan er niet tegen', 'maakt me misselijk',
  'geobsedeerd', 'jaloers', 'woedend', 'walg', 'gefascineerd',
  'kan niet stoppen met denken', 'maakt me gek', 'doet me denken aan',
  'precies zoals', 'net als', 'getriggerd',
];

/**
 * Detect if projection is present in user text.
 * Returns confidence 0-1 based on intensity markers.
 */
export function detectProjectionIntensity(userText: string): number {
  const normalized = userText.toLowerCase();
  const matches = PROJECTION_INTENSITY_MARKERS.filter(m => normalized.includes(m));

  if (matches.length === 0) return 0;
  if (matches.length === 1) return 0.3;
  if (matches.length === 2) return 0.5;
  if (matches.length >= 3) return 0.75;
  return 0;
}

/**
 * Determine the relational category based on context keywords.
 */
export function detectRelationalCategory(userText: string): RelationalCategory | null {
  const normalized = userText.toLowerCase();

  // Partner/ex detection
  if (/\b(partner|ex|girlfriend|boyfriend|wife|husband|vriendin|vriend|vrouw|man|relatie|relationship)\b/.test(normalized)) {
    return 'partner_ex';
  }
  // Parent/family detection
  if (/\b(mother|father|mom|dad|parent|sister|brother|family|moeder|vader|mama|papa|ouder|zus|broer|familie)\b/.test(normalized)) {
    return 'parent_family';
  }
  // Authority/therapeutic detection
  if (/\b(therapist|counselor|doctor|boss|teacher|coach|therapeut|arts|baas|leraar)\b/.test(normalized)) {
    return 'authority_therapeutic';
  }
  // Friends/peers detection
  if (/\b(friend|colleague|mate|buddy|group|vriend|collega|groep)\b/.test(normalized)) {
    return 'friends_peers';
  }

  return null;
}

/**
 * Get the relational pattern for a given category.
 */
export function getRelationalPattern(category: RelationalCategory): RelationalPattern {
  return RELATIONAL_PATTERNS.find(p => p.category === category) ?? RELATIONAL_PATTERNS[0];
}

/**
 * Build a projection entry from detected signals.
 */
export function buildProjectionEntry(
  personOrGroup: string,
  emotionalCharge: string,
  category: RelationalCategory,
  relapseLink: string
): ProjectionEntry {
  const pattern = getRelationalPattern(category);
  const matchingShadow = pattern.common_shadows.find(s =>
    emotionalCharge.toLowerCase().includes(s.split(' ')[0])
  ) ?? pattern.common_shadows[0];

  return {
    person_or_group: personOrGroup,
    emotional_charge: emotionalCharge,
    external_reality: 'To be explored — external reality may be valid',
    inner_shadow_hypothesis: matchingShadow,
    boundary_required: emotionalCharge.includes('control') || emotionalCharge.includes('fear'),
    relapse_link: relapseLink,
  };
}

/**
 * Get Elias questions for a specific relational category.
 */
export function getProjectionQuestions(category: RelationalCategory): string[] {
  const pattern = getRelationalPattern(category);
  return pattern.elias_questions;
}
