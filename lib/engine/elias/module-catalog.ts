/**
 * Elias Module Catalog — Single Source of Truth
 *
 * All Elias module definitions (E01–E08), trigger→module mapping,
 * slider→module mapping, default/crisis module constants, priority
 * module computation, and mock response pool.
 *
 * No file outside lib/engine/elias/ should contain E01–E08 literals
 * or Elias module definitions.
 */

import type { MoodSliders, TriggerPattern } from '../../ai/types';
import { eliasDistressScore, eliasResilienceScore } from './slider-interpretation';

// ─── Slider Key Access ──────────────────────────────────────────

function get(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

// ─── Module Constants ───────────────────────────────────────────

/** Default Elias module when no strong signals detected */
export const ELIAS_DEFAULT_MODULE = 'E02';

/** Crisis module for Elias */
export const ELIAS_CRISIS_MODULE = 'E_CRISIS';

// ─── Trigger → Module Mapping ───────────────────────────────────

/**
 * Map a trigger string to an Elias module.
 * Exact same mapping as the original switch statement.
 */
export function eliasTriggerToModule(trigger: string): string {
  switch (trigger) {
    case 'craving': return 'E01';
    case 'isolation': return 'E05';
    case 'conflict': return 'E04';
    case 'boredom': return 'E07';
    case 'stress': return 'E02';
    case 'sleep_disruption': return 'E02';
    case 'trauma_memory': return 'E02';
    default: return ELIAS_DEFAULT_MODULE;
  }
}

// ─── Slider → Module Mapping ────────────────────────────────────

/**
 * Determine the Elias module based on slider values.
 * Picks the highest of craving/despondency/frustration.
 * Uses 0-100 internal scale.
 */
export function eliasSliderToModule(mood: MoodSliders): string {
  const craving = get(mood, 'craving') * 10;
  const despondency = get(mood, 'despondency') * 10;
  const frustration = get(mood, 'frustration') * 10;
  if (craving >= despondency && craving >= frustration) return 'E01';
  if (despondency >= frustration) return 'E02';
  return 'E04';
}

// ─── Priority Modules (engine.ts pattern) ───────────────────────

/**
 * Compute Elias priority modules based on mood and trigger patterns.
 * Uses raw 0-10 slider scale.
 *
 * Thresholds:
 * - craving >= 6 → E01
 * - despondency >= 6 → E02
 * - frustration >= 7 → E04
 * - focus <= 3 → E07
 * - declining trajectory → E03
 * - isolation pattern (count >= 2) → E05
 */
export function computeEliasPriorityModules(
  mood: MoodSliders,
  patterns: TriggerPattern[],
  trajectory?: 'improving' | 'stable' | 'declining' | 'volatile'
): string[] {
  const priorities: string[] = [];

  if (get(mood, 'craving') >= 6) priorities.push('E01');
  if (get(mood, 'despondency') >= 6) priorities.push('E02');
  if (get(mood, 'frustration') >= 7) priorities.push('E04');
  if (get(mood, 'focus') <= 3) priorities.push('E07');
  if (trajectory === 'declining') priorities.push('E03');
  if (patterns.some((t) => t.trigger === 'isolation' && t.count >= 2)) {
    priorities.push('E05');
  }

  return [...new Set(priorities)];
}

// ─── Distress/Resilience/Concern on 0-100 (dominant-state-selector pattern) ──

/** Elias distress on 0-100 scale using getInternal pattern */
export function eliasDistress100(mood: MoodSliders): number {
  return eliasDistressScore(mood) * 10;
}

/** Elias resilience on 0-100 scale */
export function eliasResilience100(mood: MoodSliders): number {
  return eliasResilienceScore(mood) * 10;
}

/** Elias primary concern on 0-100 scale */
export function eliasPrimaryConcern100(mood: MoodSliders): number {
  return get(mood, 'craving') * 10;
}

// ─── Module Alignment (backpack-relevance-analyzer pattern) ─────

/**
 * Map Elias module IDs to their primary trigger keywords.
 * Used by backpack-relevance-analyzer for alignment scoring.
 */
export const ELIAS_MODULE_ALIGNMENTS: Record<string, string[]> = {
  'E01': ['craving', 'urge', 'tempted', 'want to use'],
  'E02': ['overwhelmed', 'falling apart', 'too much', 'despondency'],
  'E03': ['relapse', 'used again', 'slipped', 'fell off'],
  'E04': ['hate myself', 'worthless', 'failure', 'ashamed'],
  'E05': ['anxious', 'panic', 'racing', 'can\'t stop thinking'],
  'E06': ['why', 'purpose', 'meaning', 'motivation'],
  'E07': ['can\'t focus', 'distracted', 'foggy', 'confused'],
  'E08': ['accept', 'struggle', 'fight', 'resist'],
};

// ─── Full Module Definitions (module-system.ts pattern) ─────────

export interface EliasModuleTrigger {
  type: 'slider' | 'keyword' | 'behavioral' | 'crisis';
  condition: string;
  direction?: 'above' | 'below';
  threshold?: number;
}

export interface EliasTherapeuticModule {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly triggers: readonly EliasModuleTrigger[];
  readonly userType: 'elias';
}

/**
 * Full Elias therapeutic module definitions (E01–E08).
 * Single source of truth — imported by module-system.ts.
 */
export const ELIAS_THERAPEUTIC_MODULES: readonly EliasTherapeuticModule[] = [
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
  {
    id: 'WILSKRACHT01', name: 'Wilskracht & Zelfverwijt', category: 'PsychoEducation',
    description: 'Psycho-educatie over wilskracht, zelfverwijt na terugval, snel impulssysteem vs trage controle',
    triggers: [
      { type: 'keyword', condition: 'wilskracht|zwak|gefaald|mijn schuld|sterker moeten|discipline|schaam' },
    ],
    userType: 'elias',
  },
  {
    id: 'AUTOPILOT01', name: 'Automatische Piloot & Triggers', category: 'PsychoEducation',
    description: 'Psycho-educatie over geconditioneerde triggers, approach bias, automatische route naar gebruik',
    triggers: [
      { type: 'keyword', condition: 'automatisch|voor ik het wist|route|trek|getrokken|trigger|gewoonte' },
    ],
    userType: 'elias',
  },
];

// ─── High Complexity Modules (model routing) ────────────────────

/**
 * Elias modules that require gpt-4o due to complexity.
 * Used in model routing decisions.
 */
export const ELIAS_HIGH_COMPLEXITY_MODULES: readonly string[] = [
  'e03_pattern_reflection', 'e03', 'pattern_reflection',
  'e04_connection_risk', 'e04', 'connection_risk',
];

// ─── Mock Response Pool ─────────────────────────────────────────

/**
 * Elias mock response pool for UI/flow testing.
 * Separated from logic — pure data.
 */
export const ELIAS_MOCK_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hey, glad you're here. How are you feeling right now?",
    "Welcome back. I'm here, take your time.",
    "Good that you stopped by. What's on your mind?",
  ],
  lowMood: [
    "I notice things are heavy today. That's okay. Want to tell me what's going on?",
    "It sounds like you're having a tough day. Sometimes it helps to just sit with what you feel, without trying to change it.",
    "I hear you. It doesn't have to get better right away. Let's look at what's here right now.",
  ],
  highCraving: [
    "I see the craving is strong. That's not failure — it's a signal. Can you name where it's coming from?",
    "The urge is there. That's okay to feel. Let's look at what's underneath it.",
    "Craving feels like a wave. It rises, it peaks, but it also passes. What do you need right now?",
  ],
  crisis: [
    "I notice things are really hard right now. You're not alone in this. Want to tell me what's happening?",
    "What you're feeling is real and it's allowed to be there. I'm here. Let's look at what you need right now.",
  ],
  reflection: [
    "What you're saying touches on something important. Can you tell me more about that?",
    "I notice this is weighing on you. What would it mean if you could just feel this without having to do anything with it?",
    "That sounds like a pattern you recognize. When did you first notice this?",
  ],
  general: [
    "Thank you for sharing that. What makes you think about this right now?",
    "I'm listening. Feel free to continue.",
    "That's interesting. Tell me more about how that feels.",
  ],
};

// ─── Elias Signal→Module Mapping (from state-analyzer.ts) ───

/**
 * Map input signals to Elias module IDs.
 * Extracted from state-analyzer.ts selectPriorityModules (Elias signal-based checks).
 * Exact same signal→module mappings.
 */
export function eliasSignalToModules(signals: {
  cravingMention: boolean;
  hopelessness: boolean;
  dissociation: boolean;
  isolationSignal: boolean;
  positiveSignal: boolean;
}): string[] {
  const modules: string[] = [];
  if (signals.cravingMention) modules.push('E01');
  if (signals.hopelessness) modules.push('E02');
  if (signals.dissociation) modules.push('E04');
  if (signals.isolationSignal) modules.push('E05');
  if (signals.positiveSignal) modules.push('E06');
  return modules;
}

// ELIAS_MODULE_ALIGNMENTS is defined above (line ~120).

// ─── Elias Backpack Slider Scoring (from backpack-relevance-analyzer.ts) ───

/**
 * Score Elias slider relevance for a given trigger.
 * Extracted from backpack-relevance-analyzer.ts (lines 191-194).
 * Exact same thresholds, exact same scoring.
 */
export function eliasBackpackSliderScore(
  triggerId: string,
  sliders: { craving?: number; focus?: number; despondency?: number; frustration?: number }
): number {
  let score = 0;
  if (triggerId === 'craving' && (sliders.craving ?? 0) >= 6) score += 2;
  if (triggerId === 'isolation' && (sliders.focus ?? 5) <= 3) score += 2;
  if ((triggerId === 'shame' || triggerId === 'self_worth' || triggerId === 'hopelessness') && (sliders.despondency ?? 0) >= 6) score += 2;
  if ((triggerId === 'anger' || triggerId === 'control') && (sliders.frustration ?? 0) >= 6) score += 2;
  return score;
}
