/**
 * RecoFree Module System
 *
 * Maps user state (mood, craving, emotion, behavioral patterns) to
 * therapeutic modules. The module system determines which therapeutic
 * approach is most appropriate for the current context.
 *
 * Supports both Elias and Kim slider types via generic access.
 *
 * This is a LOCAL mapping layer. The backend Elias/Kim logic layer
 * makes the final decision on module activation.
 */

import type { MoodSliders, UserType } from '../ai/types';

export interface TherapeuticModule {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: ModuleTrigger[];
  userType: 'elias' | 'kim' | 'both';
}

export interface ModuleTrigger {
  type: 'slider' | 'keyword' | 'behavioral' | 'crisis';
  /** For slider: key name. For keyword: pipe-separated keywords */
  condition: string;
  /** For slider: 'above' or 'below' threshold */
  direction?: 'above' | 'below';
  threshold?: number;
}

export interface ModuleRecommendation {
  module: TherapeuticModule;
  relevance: number;
  reason: string;
}

// Generic slider access
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

// ─── Elias Modules (Recovery-focused) ───────────────────────────

const ELIAS_MODULES: TherapeuticModule[] = [
  {
    id: 'E01', name: 'Craving Management', category: 'Acute',
    description: 'Techniques for managing acute craving episodes',
    triggers: [
      { type: 'slider', condition: 'craving', direction: 'above', threshold: 4 },
      { type: 'keyword', condition: 'craving|urge|want to use|tempted' },
    ],
    userType: 'elias',
  },
  {
    id: 'E02', name: 'Emotional Regulation', category: 'Core',
    description: 'Understanding and managing difficult emotions',
    triggers: [
      { type: 'slider', condition: 'despondency', direction: 'above', threshold: 4 },
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
      { type: 'slider', condition: 'despondency', direction: 'above', threshold: 5 },
    ],
    userType: 'elias',
  },
  {
    id: 'E05', name: 'Mindfulness & Grounding', category: 'Core',
    description: 'Present-moment awareness and grounding techniques',
    triggers: [
      { type: 'keyword', condition: 'anxious|panic|racing|can\'t stop thinking' },
      { type: 'slider', condition: 'frustration', direction: 'above', threshold: 5 },
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
    id: 'E07', name: 'Focus & Clarity', category: 'Support',
    description: 'Rebuilding focus and mental clarity during recovery',
    triggers: [
      { type: 'slider', condition: 'focus', direction: 'below', threshold: 2 },
      { type: 'keyword', condition: 'can\'t focus|distracted|foggy|confused|scattered' },
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
    triggers: [
      { type: 'keyword', condition: 'boundary|boundaries|too much|can\'t anymore|limit' },
      { type: 'slider', condition: 'boundaryFatigue', direction: 'above', threshold: 4 },
    ],
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
      { type: 'slider', condition: 'selfCare', direction: 'below', threshold: 2 },
      { type: 'keyword', condition: 'exhausted|tired|burned out|can\'t cope|drained' },
    ],
    userType: 'kim',
  },
  {
    id: 'K04', name: 'Stress Management', category: 'Core',
    description: 'Managing stress and emotional overload',
    triggers: [
      { type: 'slider', condition: 'stress', direction: 'above', threshold: 4 },
      { type: 'keyword', condition: 'stressed|overwhelmed|too much|breaking down' },
    ],
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
    triggers: [
      { type: 'keyword', condition: 'let go|detach|step back|distance|space' },
      { type: 'slider', condition: 'emotionalBurden', direction: 'above', threshold: 5 },
    ],
    userType: 'kim',
  },
];

// ─── Module Recommendation Engine ───────────────────────────────

export function getModuleRecommendations(
  userType: UserType,
  message: string,
  moodSliders: MoodSliders
): ModuleRecommendation[] {
  const modules = userType === 'elias' ? ELIAS_MODULES : KIM_MODULES;
  const recommendations: ModuleRecommendation[] = [];
  const MAX = 7; // slider max

  for (const module of modules) {
    let maxRelevance = 0;
    let reason = '';

    for (const trigger of module.triggers) {
      let relevance = 0;
      let triggerReason = '';

      switch (trigger.type) {
        case 'slider': {
          const value = getSlider(moodSliders, trigger.condition);
          const threshold = trigger.threshold ?? 4;

          if (trigger.direction === 'above' && value >= threshold) {
            relevance = Math.min(1, (value - threshold + 1) / (MAX - threshold + 1));
            triggerReason = `${trigger.condition} at ${value}/${MAX}`;
          } else if (trigger.direction === 'below' && value <= threshold) {
            relevance = Math.min(1, (threshold - value + 1) / (threshold + 1));
            triggerReason = `${trigger.condition} at ${value}/${MAX}`;
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

export function getAllModules(userType: UserType): TherapeuticModule[] {
  return userType === 'elias' ? ELIAS_MODULES : KIM_MODULES;
}
