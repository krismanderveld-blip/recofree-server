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
import { KIM_THERAPEUTIC_MODULES } from '../engine/kim/module-catalog';
import { ELIAS_THERAPEUTIC_MODULES } from '../engine/elias/module-catalog';

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
// Elias module definitions are now imported from lib/engine/elias/module-catalog.ts
// Cast to mutable TherapeuticModule[] for compatibility with existing code.
const ELIAS_MODULES: TherapeuticModule[] = ELIAS_THERAPEUTIC_MODULES as unknown as TherapeuticModule[];

// ─── Kim Modules (Loved-one focused) ────────────────────────────
// Kim module definitions are now imported from lib/engine/kim/module-catalog.ts
// Cast to mutable TherapeuticModule[] for compatibility with existing code.
const KIM_MODULES: TherapeuticModule[] = KIM_THERAPEUTIC_MODULES as unknown as TherapeuticModule[];

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
