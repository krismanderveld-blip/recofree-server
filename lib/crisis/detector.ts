/**
 * Crisis Detection Module
 *
 * Scans user input for crisis indicators using text analysis (regex patterns),
 * slider threshold values, and behavioral patterns.
 *
 * This is a LOCAL analysis layer. The Elias/Kim logic layer on the backend
 * is the ultimate authority for crisis response decisions.
 *
 * Supports both Elias and Kim slider types via generic access.
 *
 * Crisis levels:
 *   0 = Normal
 *   1 = Concern (elevated monitoring)
 *   2 = Crisis (immediate intervention)
 */

import type { MoodSliders, UserType } from '../ai/types';
import { kimDistressScore, kimResilienceScore } from '../engine/kim/slider-interpretation';
import { checkKimCrisisTrigger } from '../engine/kim/crisis-trigger';
import { eliasDistressScore, eliasResilienceScore } from '../engine/elias/slider-interpretation';
import { checkEliasCrisisTriggers } from '../engine/elias/state-logic';

export interface CrisisAssessment {
  level: number;
  triggers: string[];
  recommendedAction: 'none' | 'monitor' | 'intervene' | 'emergency';
}

// Generic slider access
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

/** Get distress score based on user type */
function getDistress(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasDistressScore(mood);
  return kimDistressScore(mood);
}

/** Get resilience score based on user type */
function getResilience(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? eliasResilienceScore(mood) : kimResilienceScore(mood);
}

// Crisis keyword patterns (language-agnostic internal logic, English output)
const CRISIS_PATTERNS = {
  suicidal_active: [
    /\b(kill myself|end it all|want to die|suicide|take my life)\b/i,
    /\b(don'?t want to live|no reason to live|better off dead)\b/i,
    /\b(end my life|jump off|overdose on purpose)\b/i,
    // Dutch
    /\b(wil (er niet meer zijn|dood|niet meer leven)|zelfmoord|maak er een einde aan)\b/i,
    /\b(ik wil er niet meer zijn|wil niet meer verder|wil niet meer bestaan)\b/i,
    /\b(ik wil dood|geen reden om te leven|beter af zonder mij)\b/i,
  ],
  suicidal_passive: [
    /\b(wish i was dead|wish i wasn'?t here|disappear forever)\b/i,
    /\b(wouldn'?t mind dying|don'?t care if i die)\b/i,
    /\b(no point|what'?s the point|pointless)\b/i,
    // Dutch
    /\b(was ik maar dood|wou dat ik er niet was|voor altijd verdwijnen)\b/i,
    /\b(geen zin meer|waarom nog|klaar met alles|ik geef het op)\b/i,
    /\b(kan niet meer|het heeft geen zin|maakt niet uit als ik doodga)\b/i,
  ],
  self_harm: [
    /\b(cut myself|hurt myself|harm myself|self.?harm)\b/i,
    /\b(punish myself|burn myself|hit myself)\b/i,
    // Dutch
    /\b(mezelf (pijn doen|snijden|verwonden|straffen)|automutilatie)\b/i,
    /\b(mezelf branden|mezelf slaan|snijden)\b/i,
  ],
  dissociation: [
    /\b(can'?t feel anything|numb|empty|nothing matters)\b/i,
    /\b(not real|doesn'?t feel real|detached|disconnected)\b/i,
    // Dutch
    /\b(voel niets|verdoofd|leeg|niets doet ertoe)\b/i,
    /\b(niet echt|voelt niet echt|losgekoppeld|afwezig)\b/i,
  ],
  relapse: [
    /\b(used again|relapsed|gave in|couldn'?t resist)\b/i,
    /\b(back to using|started again|fell off)\b/i,
    // Dutch
    /\b(weer gebruikt|terugval|toegegeven|kon niet weerstaan)\b/i,
    /\b(opnieuw begonnen|weer begonnen|hervallen)\b/i,
  ],
};

export function assessCrisis(
  message: string,
  moodSliders: MoodSliders,
  userType: UserType = 'elias'
): CrisisAssessment {
  const triggers: string[] = [];
  let maxLevel = 0;

  // Text pattern analysis
  for (const [category, patterns] of Object.entries(CRISIS_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        triggers.push(category);

        if (category === 'suicidal_active') {
          maxLevel = Math.max(maxLevel, 2);
        } else if (category === 'suicidal_passive' || category === 'self_harm') {
          maxLevel = Math.max(maxLevel, 2);
        } else if (category === 'dissociation') {
          maxLevel = Math.max(maxLevel, 1);
        } else if (category === 'relapse') {
          maxLevel = Math.max(maxLevel, 1);
        }

        break; // One match per category is enough
      }
    }
  }

  // Slider threshold analysis (generic, works for both Elias and Kim)
  const distress = getDistress(moodSliders, userType);
  const resilience = getResilience(moodSliders, userType);

  // Very high distress
  if (distress >= 6) {
    triggers.push('extreme_distress');
    maxLevel = Math.max(maxLevel, 1);
  }

  // Very low resilience
  if (resilience <= 1) {
    triggers.push('depleted_resilience');
    maxLevel = Math.max(maxLevel, 1);
  }

  // User-type-specific slider crisis checks
  if (userType === 'elias') {
    const eliasCrisis = checkEliasCrisisTriggers(moodSliders);
    triggers.push(...eliasCrisis.triggers);
    maxLevel = Math.max(maxLevel, eliasCrisis.maxLevel);
  } else {
    const kimCrisis = checkKimCrisisTrigger(moodSliders);
    if (kimCrisis.fired) {
      triggers.push(kimCrisis.triggerName);
      maxLevel = Math.max(maxLevel, 1);
    }
  }

  // Combined risk: high distress + low resilience = elevated
  if (distress >= 5 && resilience <= 1) {
    triggers.push('combined_risk_distress_depleted');
    maxLevel = Math.max(maxLevel, 2);
  }

  let recommendedAction: CrisisAssessment['recommendedAction'];
  if (maxLevel >= 2) {
    recommendedAction = 'emergency';
  } else if (maxLevel >= 1) {
    recommendedAction = 'intervene';
  } else {
    recommendedAction = 'none';
  }

  return {
    level: maxLevel,
    triggers: [...new Set(triggers)],
    recommendedAction,
  };
}

/**
 * @deprecated Use getCrisisContentForMessage() from '@/lib/crisis/resources' instead.
 * Kept for backward compatibility with existing tests.
 */
export const EMERGENCY_RESOURCES = [
  {
    name: 'Zelfmoordlijn',
    number: '1813',
    description: 'Bel 1813, 24/7 gratis anoniem',
  },
  {
    name: 'Centrum Geestelijke Gezondheidszorg',
    number: '107',
    description: 'Bel 107, 24/7 gratis voor iedereen',
  },
  {
    name: 'Noodnummer',
    number: '112',
    description: 'Bel 112, bij onmiddellijk gevaar',
  },
];
