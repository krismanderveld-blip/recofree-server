/**
 * Crisis Detection Module
 *
 * Scans user input for crisis indicators using text analysis (regex patterns),
 * slider threshold values, and behavioral patterns.
 *
 * This is a LOCAL analysis layer. The Elias/Kim logic layer on the backend
 * is the ultimate authority for crisis response decisions.
 *
 * Crisis levels:
 *   0 = Normal
 *   1 = Concern (elevated monitoring)
 *   2 = Crisis (immediate intervention)
 */

export interface CrisisAssessment {
  level: number;
  triggers: string[];
  recommendedAction: 'none' | 'monitor' | 'intervene' | 'emergency';
}

// Crisis keyword patterns (language-agnostic internal logic, English output)
const CRISIS_PATTERNS = {
  suicidal_active: [
    /\b(kill myself|end it all|want to die|suicide|take my life)\b/i,
    /\b(don'?t want to live|no reason to live|better off dead)\b/i,
    /\b(end my life|jump off|overdose on purpose)\b/i,
  ],
  suicidal_passive: [
    /\b(wish i was dead|wish i wasn'?t here|disappear forever)\b/i,
    /\b(wouldn'?t mind dying|don'?t care if i die)\b/i,
    /\b(no point|what'?s the point|pointless)\b/i,
  ],
  self_harm: [
    /\b(cut myself|hurt myself|harm myself|self.?harm)\b/i,
    /\b(punish myself|burn myself|hit myself)\b/i,
  ],
  dissociation: [
    /\b(can'?t feel anything|numb|empty|nothing matters)\b/i,
    /\b(not real|doesn'?t feel real|detached|disconnected)\b/i,
  ],
  relapse: [
    /\b(used again|relapsed|gave in|couldn'?t resist)\b/i,
    /\b(back to using|started again|fell off)\b/i,
  ],
};

export function assessCrisis(
  message: string,
  moodSliders: { stemming: number; craving: number; overprikkeling: number; sociaal: number }
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

  // Slider threshold analysis
  if (moodSliders.stemming <= 1) {
    triggers.push('extremely_low_mood');
    maxLevel = Math.max(maxLevel, 1);
  }

  if (moodSliders.craving >= 9) {
    triggers.push('extreme_craving');
    maxLevel = Math.max(maxLevel, 1);
  }

  if (moodSliders.overprikkeling >= 9) {
    triggers.push('extreme_overstimulation');
    maxLevel = Math.max(maxLevel, 1);
  }

  // Combined risk: low mood + high craving = elevated
  if (moodSliders.stemming <= 2 && moodSliders.craving >= 8) {
    triggers.push('combined_risk_mood_craving');
    maxLevel = Math.max(maxLevel, 2);
  }

  // Combined risk: isolation + low mood
  if (moodSliders.sociaal <= 1 && moodSliders.stemming <= 2) {
    triggers.push('combined_risk_isolation_mood');
    maxLevel = Math.max(maxLevel, 1);
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
 * Emergency resources shown during crisis.
 */
export const EMERGENCY_RESOURCES = [
  {
    name: 'National Suicide Prevention Lifeline',
    number: '988',
    description: 'Call or text 988 for immediate help',
  },
  {
    name: 'Crisis Text Line',
    number: 'Text HOME to 741741',
    description: 'Free 24/7 crisis support via text',
  },
  {
    name: 'Emergency Services',
    number: '911',
    description: 'For immediate danger',
  },
];
