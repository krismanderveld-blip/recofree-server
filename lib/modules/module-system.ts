/**
 * RecoFree Module System
 *
 * Maps user state (mood, craving, emotion, behavioral patterns) to
 * therapeutic modules. The module system determines which therapeutic
 * approach is most appropriate for the current context.
 *
 * This is a LOCAL mapping layer. The backend Elias/Kim logic layer
 * makes the final decision on module activation.
 */

export interface TherapeuticModule {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: ModuleTrigger[];
  userType: 'elias' | 'kim' | 'both';
}

export interface ModuleTrigger {
  type: 'mood' | 'craving' | 'keyword' | 'behavioral' | 'crisis';
  condition: string;
  threshold?: number;
}

export interface ModuleRecommendation {
  module: TherapeuticModule;
  relevance: number;
  reason: string;
}

// ─── Elias Modules (Recovery-focused) ───────────────────────────

const ELIAS_MODULES: TherapeuticModule[] = [
  {
    id: 'E01', name: 'Craving Management', category: 'Acute',
    description: 'Techniques for managing acute craving episodes',
    triggers: [
      { type: 'craving', condition: 'high', threshold: 7 },
      { type: 'keyword', condition: 'craving|urge|want to use|tempted' },
    ],
    userType: 'elias',
  },
  {
    id: 'E02', name: 'Emotional Regulation', category: 'Core',
    description: 'Understanding and managing difficult emotions',
    triggers: [
      { type: 'mood', condition: 'low', threshold: 3 },
      { type: 'keyword', condition: 'overwhelmed|can\'t handle|too much|falling apart' },
    ],
    userType: 'elias',
  },
  {
    id: 'E03', name: 'Relapse Prevention', category: 'Core',
    description: 'Identifying and managing relapse triggers',
    triggers: [
      { type: 'keyword', condition: 'relapse|used again|slipped|fell off' },
      { type: 'behavioral', condition: 'craving_trend_up' },
    ],
    userType: 'elias',
  },
  {
    id: 'E04', name: 'Self-Compassion', category: 'Growth',
    description: 'Building self-compassion and reducing self-criticism',
    triggers: [
      { type: 'keyword', condition: 'hate myself|worthless|failure|disgusted|ashamed' },
      { type: 'mood', condition: 'low', threshold: 2 },
    ],
    userType: 'elias',
  },
  {
    id: 'E05', name: 'Mindfulness & Grounding', category: 'Core',
    description: 'Present-moment awareness and grounding techniques',
    triggers: [
      { type: 'keyword', condition: 'anxious|panic|racing|can\'t stop thinking' },
      { type: 'mood', condition: 'overstimulated', threshold: 7 },
    ],
    userType: 'elias',
  },
  {
    id: 'E06', name: 'Values & Meaning', category: 'Growth',
    description: 'Exploring personal values and finding meaning in recovery',
    triggers: [{ type: 'keyword', condition: 'why|purpose|meaning|what\'s the point|motivation' }],
    userType: 'elias',
  },
  {
    id: 'E07', name: 'Social Connection', category: 'Support',
    description: 'Building healthy relationships and support networks',
    triggers: [
      { type: 'mood', condition: 'isolated', threshold: 2 },
      { type: 'keyword', condition: 'alone|lonely|no one|isolated|nobody cares' },
    ],
    userType: 'elias',
  },
  {
    id: 'E08', name: 'ACT - Acceptance', category: 'Therapeutic',
    description: 'Acceptance and Commitment Therapy techniques',
    triggers: [{ type: 'keyword', condition: 'accept|struggle|fight|resist|control' }],
    userType: 'elias',
  },
];

// ─── Kim Modules (Loved-one focused) ────────────────────────────

const KIM_MODULES: TherapeuticModule[] = [
  {
    id: 'K01', name: 'Boundary Setting', category: 'Core',
    description: 'Learning to set and maintain healthy boundaries',
    triggers: [{ type: 'keyword', condition: 'boundary|boundaries|too much|can\'t anymore|limit' }],
    userType: 'kim',
  },
  {
    id: 'K02', name: 'Enabling Awareness', category: 'Core',
    description: 'Recognizing and stopping enabling behaviors',
    triggers: [{ type: 'keyword', condition: 'help|save|fix|cover|enable|protect|rescue' }],
    userType: 'kim',
  },
  {
    id: 'K03', name: 'Self-Care', category: 'Core',
    description: 'Prioritizing your own well-being',
    triggers: [
      { type: 'mood', condition: 'low', threshold: 3 },
      { type: 'keyword', condition: 'exhausted|tired|burned out|can\'t cope|drained' },
    ],
    userType: 'kim',
  },
  {
    id: 'K04', name: 'Grief & Loss', category: 'Emotional',
    description: 'Processing grief related to addiction in a loved one',
    triggers: [{ type: 'keyword', condition: 'lost|grief|mourn|miss|used to be|before' }],
    userType: 'kim',
  },
  {
    id: 'K05', name: 'Communication Skills', category: 'Practical',
    description: 'Effective communication with someone in addiction',
    triggers: [{ type: 'keyword', condition: 'talk to|say to|communicate|conversation|argue|fight' }],
    userType: 'kim',
  },
  {
    id: 'K06', name: 'Detachment with Love', category: 'Growth',
    description: 'Learning to love without losing yourself',
    triggers: [{ type: 'keyword', condition: 'let go|detach|step back|distance|space' }],
    userType: 'kim',
  },
];

// ─── Module Recommendation Engine ───────────────────────────────

export function getModuleRecommendations(
  userType: 'elias' | 'kim',
  message: string,
  moodSliders: { stemming: number; craving: number; overprikkeling: number; sociaal: number }
): ModuleRecommendation[] {
  const modules = userType === 'elias' ? ELIAS_MODULES : KIM_MODULES;
  const recommendations: ModuleRecommendation[] = [];

  for (const module of modules) {
    let maxRelevance = 0;
    let reason = '';

    for (const trigger of module.triggers) {
      let relevance = 0;
      let triggerReason = '';

      switch (trigger.type) {
        case 'craving': {
          const threshold = trigger.threshold || 7;
          if (moodSliders.craving >= threshold) {
            relevance = Math.min(1, (moodSliders.craving - threshold + 1) / 4);
            triggerReason = `Craving level at ${moodSliders.craving}/10`;
          }
          break;
        }
        case 'mood': {
          const threshold = trigger.threshold || 3;
          if (trigger.condition === 'low' && moodSliders.stemming <= threshold) {
            relevance = Math.min(1, (threshold - moodSliders.stemming + 1) / 4);
            triggerReason = `Mood level at ${moodSliders.stemming}/10`;
          } else if (trigger.condition === 'overstimulated' && moodSliders.overprikkeling >= threshold) {
            relevance = Math.min(1, (moodSliders.overprikkeling - threshold + 1) / 4);
            triggerReason = `Overstimulation at ${moodSliders.overprikkeling}/10`;
          } else if (trigger.condition === 'isolated' && moodSliders.sociaal <= threshold) {
            relevance = Math.min(1, (threshold - moodSliders.sociaal + 1) / 4);
            triggerReason = `Social connection at ${moodSliders.sociaal}/10`;
          }
          break;
        }
        case 'keyword': {
          const keywords = trigger.condition.split('|');
          const lowerMessage = message.toLowerCase();
          const matched = keywords.find((kw) => lowerMessage.includes(kw));
          if (matched) {
            relevance = 0.8;
            triggerReason = `Keyword detected: "${matched}"`;
          }
          break;
        }
      }

      if (relevance > maxRelevance) {
        maxRelevance = relevance;
        reason = triggerReason;
      }
    }

    if (maxRelevance > 0) {
      recommendations.push({ module, relevance: maxRelevance, reason });
    }
  }

  return recommendations.sort((a, b) => b.relevance - a.relevance);
}

export function getAllModules(userType: 'elias' | 'kim'): TherapeuticModule[] {
  return userType === 'elias' ? ELIAS_MODULES : KIM_MODULES;
}
