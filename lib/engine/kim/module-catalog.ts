/**
 * Kim Module Catalog & Selection
 *
 * Extracted from:
 * - lib/modules/module-system.ts (KIM_MODULES, lines 118-167)
 * - lib/rugzak/state-analyzer.ts (selectPriorityModules Kim branch, lines 324-344)
 * - lib/rugzak/engine.ts (computePriorityModules Kim branch, lines 183-192)
 *
 * No new logic. Direct extraction only.
 */

import type { MoodSliders } from '../../ai/types';
import type { InputSignals } from '../../rugzak/state-analyzer';

/** Safely read a slider value by key */
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

// ─── Kim Module Definitions (from module-system.ts) ─────────────

export interface KimModuleDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
}

export const KIM_MODULE_CATALOG: readonly KimModuleDefinition[] = Object.freeze([
  { id: 'K01', name: 'Boundary Setting', category: 'Core', description: 'Learning to set and maintain healthy boundaries' },
  { id: 'K02', name: 'Enabling Awareness', category: 'Core', description: 'Recognizing and stopping enabling behaviors' },
  { id: 'K03', name: 'Self-Care', category: 'Core', description: 'Prioritizing your own well-being' },
  { id: 'K04', name: 'Emotional Regulation', category: 'Core', description: 'Managing emotional overload, betrayal, trust, and hope' },
  { id: 'K05', name: 'Communication Skills', category: 'Practical', description: 'Effective communication with someone in addiction' },
  { id: 'K06', name: 'Self-Care & Sustainable Support', category: 'Growth', description: 'Sustainable caregiving without self-destruction' },
  // KO1 (Recognition & Validation) is a separate engine file, not in this catalog
  // K04-S4 (Betrayal/Trust/Hope) is a sub-module of K04
  { id: 'KST01', name: 'Stoicism for Caregivers', category: 'Advanced', description: 'Stoic principles adapted for caregivers: control separation, steadiness, values-based action' },
  { id: 'KDL01', name: 'Detachment with Love', category: 'Advanced', description: 'Loving detachment without abandonment or self-erasure' },
  { id: 'KBR01', name: 'Boundary Restoration', category: 'Advanced', description: 'Clear, humane, enforceable boundary creation and repair' },
  { id: 'KSC01', name: 'Self-Compassion for Caregivers', category: 'Advanced', description: 'Grounded self-compassion without removing responsibility' },
]);

// ─── Kim TherapeuticModule definitions (from module-system.ts KIM_MODULES) ───

/**
 * Full Kim module definitions with triggers.
 * Extracted from module-system.ts KIM_MODULES (lines 118-167).
 * Exact same ids, names, categories, descriptions, triggers, thresholds.
 *
 * Uses the same TherapeuticModule and ModuleTrigger types from module-system.ts.
 */
export interface KimModuleTrigger {
  readonly type: 'slider' | 'keyword' | 'behavioral' | 'crisis';
  readonly condition: string;
  readonly direction?: 'above' | 'below';
  readonly threshold?: number;
}

export interface KimTherapeuticModule {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly triggers: readonly KimModuleTrigger[];
  readonly userType: 'kim';
}

export const KIM_THERAPEUTIC_MODULES: readonly KimTherapeuticModule[] = Object.freeze([
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
      { type: 'slider', condition: 'selfCare', direction: 'below', threshold: 3 },
      { type: 'keyword', condition: 'exhausted|tired|burned out|can\'t cope|drained' },
    ],
    userType: 'kim',
  },
  {
    id: 'K04', name: 'Emotional Regulation', category: 'Core',
    description: 'Managing emotional overload, betrayal, trust, and hope',
    triggers: [
      { type: 'slider', condition: 'stress', direction: 'above', threshold: 4 },
      { type: 'keyword', condition: 'stressed|overwhelmed|too much|breaking down|betrayed|trust|hope' },
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
    id: 'K06', name: 'Self-Care & Sustainable Support', category: 'Growth',
    description: 'Sustainable caregiving without self-destruction',
    triggers: [
      { type: 'keyword', condition: 'let go|detach|step back|distance|space|burnout|exhausted|can\'t anymore' },
      { type: 'slider', condition: 'emotionalBurden', direction: 'above', threshold: 5 },
    ],
    userType: 'kim',
  },
  {
    id: 'CDP01', name: 'Codependentie Patroon Detectie', category: 'Advanced',
    description: 'Mirrors self-loss and codependency-like patterns without diagnosis or forced change',
    triggers: [
      { type: 'keyword', condition: 'zonder hem besta ik niet|ik besta niet zonder|ik leef voor hem|ik leef voor haar|als het goed gaat met hem|ik moet hem redden|ik voel me egoistisch' },
    ],
    userType: 'kim',
  },
  {
    id: 'RNW01', name: 'Rouw Naaste: Wie Ze Was', category: 'Advanced',
    description: 'Validates ambiguous grief for who the loved one was before addiction',
    triggers: [
      { type: 'keyword', condition: 'ik mis wie hij was|ik mis de oude hem|hij is er nog maar toch weg|ik rouw om iemand die nog leeft|ik mis ons van vroeger' },
    ],
    userType: 'kim',
  },
  {
    id: 'PAR01', name: 'Parentificatie Patroon Detectie', category: 'Advanced',
    description: 'Detects and mirrors parentification patterns — the child who had to be the parent',
    triggers: [
      { type: 'keyword', condition: 'ik moest altijd zorgen|ik was het ouderlijke kind|ik moest volwassen zijn|ik had geen kindertijd|ik zorgde voor mijn ouders|ik mocht niet kind zijn' },
    ],
    userType: 'kim',
  },
  {
    id: 'FIN01', name: 'Financi\u00eble Afhankelijkheid/Controle', category: 'Advanced',
    description: 'Detects financial dependency or control patterns — money as a tool of power',
    triggers: [
      { type: 'keyword', condition: 'hij beheert al het geld|ik mag niets uitgeven|financieel afhankelijk|geld als controle|ik heb geen eigen rekening|hij bepaalt wat ik koop' },
    ],
    userType: 'kim',
  },
]);

// ─── Kim Module Selection (from state-analyzer.ts) ────────────────

/**
 * Select priority modules based on Kim sliders and signals.
 * Extracted from state-analyzer.ts selectPriorityModules (else branch).
 * Returns max 3 modules, deduplicated.
 */
export function selectKimPriorityModules(
  mood: MoodSliders,
  signals: InputSignals,
  activeTriggers: string[]
): string[] {
  const modules: string[] = [];

  const stress = getSlider(mood, 'stress');
  const boundaryFatigue = getSlider(mood, 'boundaryFatigue');
  const emotionalBurden = getSlider(mood, 'emotionalBurden');
  const selfCare = getSlider(mood, 'selfCare');

  // High stress → K04 (Emotional Regulation)
  if (stress >= 6) modules.push('K04');
  // Boundary fatigue → K01 (Boundary Setting)
  if (boundaryFatigue >= 6) modules.push('K01');
  // Emotional burden / hopelessness → K03 (Self-Care) or K06 (Sustainable Support)
  if (emotionalBurden >= 6 || signals.hopelessness) modules.push('K03');
  // Low self-care → K03
  if (selfCare <= 3) modules.push('K03');
  // Enabling patterns detected → K02
  if (activeTriggers.includes('enabling')) modules.push('K02');
  // Isolation → K05 (Communication Skills)
  if (signals.isolationSignal) modules.push('K05');

  if (modules.length === 0) modules.push('K01');

  return [...new Set(modules)].slice(0, 3);
}

// ─── Kim Engine Priority Modules (from engine.ts) ───────────────

/**
 * Compute priority modules from rugzak engine context.
 * Extracted from engine.ts computePriorityModules (else branch).
 */
export function computeKimEngineModules(
  mood: MoodSliders,
  triggerPatterns: Array<{ trigger: string; count: number }>
): string[] {
  const priorities: string[] = [];

  if (getSlider(mood, 'stress') >= 6) priorities.push('K04');
  if (getSlider(mood, 'boundaryFatigue') >= 6) priorities.push('K01');
  if (getSlider(mood, 'emotionalBurden') >= 6) priorities.push('K03');
  if (getSlider(mood, 'selfCare') <= 3) priorities.push('K03');
  if (triggerPatterns.some((t) => t.trigger === 'enabling' && t.count >= 2)) {
    priorities.push('K02');
  }
  if (priorities.length === 0) priorities.push('K01');

  return [...new Set(priorities)];
}

// ─── Kim Trigger→Module Mapping (from dominant-state-selector.ts) ───

/**
 * Map a Kim trigger to its corresponding module.
 * Extracted from dominant-state-selector.ts getTriggerModule (else branch, lines 87-96).
 * Exact same switch, exact same defaults.
 */
export function kimTriggerToModule(trigger: string): string {
  switch (trigger) {
    case 'boundary_violation': return 'K01';
    case 'repeated_pattern': return 'K02';
    case 'guilt': return 'K03';
    case 'caregiver_fatigue': return 'K03';
    case 'isolation': return 'K05';
    case 'loved_one_relapse': return 'K04';
    case 'anger_at_situation': return 'K04';
    default: return 'K01';
  }
}

// ─── Kim Slider→Module Mapping (from dominant-state-selector.ts) ───

/**
 * Map Kim slider values to the dominant module.
 * Extracted from dominant-state-selector.ts getSliderModule (else branch, lines 108-115).
 * Uses 0–100 internal scale (slider * 10).
 * Exact same comparisons, exact same returns.
 */
export function kimSliderToModule(mood: MoodSliders): string {
  const stress = getSlider(mood, 'stress') * 10;
  const boundary = getSlider(mood, 'boundaryFatigue') * 10;
  const burden = getSlider(mood, 'emotionalBurden') * 10;
  if (boundary >= stress && boundary >= burden) return 'K01';
  if (stress >= burden) return 'K04';
  return 'K03';
}

/**
 * Kim default module.
 * Extracted from dominant-state-selector.ts getDefaultModule (Kim branch).
 */
export const KIM_DEFAULT_MODULE = 'K01';

/**
 * Kim crisis module.
 * Extracted from dominant-state-selector.ts getCrisisModule (Kim branch).
 */
export const KIM_CRISIS_MODULE = 'K_CRISIS';

// ─── Kim Distress/Resilience/Concern (0–100 scale, from dominant-state-selector.ts) ───

/**
 * Kim distress on 0–100 scale.
 * Extracted from dominant-state-selector.ts getDistress100 (Kim branch).
 * (stress + boundaryFatigue + emotionalBurden) / 3, each * 10.
 */
export function kimDistress100(mood: MoodSliders): number {
  return (getSlider(mood, 'stress') * 10 + getSlider(mood, 'boundaryFatigue') * 10 + getSlider(mood, 'emotionalBurden') * 10) / 3;
}

/**
 * Kim resilience on 0–100 scale.
 * Extracted from dominant-state-selector.ts getResilience100 (Kim branch).
 * selfCare * 10.
 */
export function kimResilience100(mood: MoodSliders): number {
  return getSlider(mood, 'selfCare') * 10;
}

/**
 * Kim primary concern on 0–100 scale.
 * Extracted from dominant-state-selector.ts getPrimaryConcern100 (Kim branch).
 * stress * 10.
 */
export function kimPrimaryConcern100(mood: MoodSliders): number {
  return getSlider(mood, 'stress') * 10;
}

// ─── Kim Module Alignment Mapping (from backpack-relevance-analyzer.ts) ───

/**
 * Maps Kim module IDs (and named aliases) to their aligned trigger IDs.
 * Extracted from backpack-relevance-analyzer.ts moduleAlignments (lines 217-222).
 * Exact same keys, exact same trigger arrays.
 *
 * Used by backpack relevance scoring to boost triggers that align with the active module.
 */
export const KIM_MODULE_ALIGNMENTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  K_BOUNDARY_PRESSURE: ['boundary_violation', 'control', 'overgiving'],
  K01: ['boundary_violation', 'control', 'overgiving'],
  K_CAREGIVER_DEPLETION: ['overgiving', 'depletion', 'hopelessness'],
  K03: ['overgiving', 'depletion', 'hopelessness'],
  K_RELATIONAL_REFLECTION: ['guilt', 'disappointment', 'abandonment'],
  K02: ['guilt', 'disappointment', 'abandonment'],
});

// ─── Kim High-Complexity Modules (for model routing in ai-chat.ts) ───

/**
 * Kim modules that require the more capable model (gpt-4o) for routing.
 * Extracted from server/ai-chat.ts HIGH_COMPLEXITY_MODULES (Kim entries).
 * Exact same strings, lowercase.
 */
export const KIM_HIGH_COMPLEXITY_MODULES: readonly string[] = [
  'k_relational_reflection', 'k02', 'relational_reflection',
  'k_boundary_pressure', 'k01', 'boundary_pressure',
  'kst01', 'kdl01', 'kbr01', 'ksc01',
];

// ─── Kim Advanced Module Route Target Enum ───────────────────────

export type KimModuleRouteTarget =
  | 'K06_CAREGIVER_CANON'
  | 'KST01_STOICISM_FOR_CAREGIVERS'
  | 'KDL01_DETACHMENT_WITH_LOVE'
  | 'KBR01_BOUNDARY_RESTORATION'
  | 'KSC01_SELF_COMPASSION_CAREGIVER'
  | 'K06_STABILIZATION'
  | 'K06_SAFETY'
  | 'NO_MODULE';
