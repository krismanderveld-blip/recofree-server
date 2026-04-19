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
  { id: 'K04', name: 'Stress Management', category: 'Core', description: 'Managing stress and emotional overload' },
  { id: 'K05', name: 'Communication Skills', category: 'Practical', description: 'Effective communication with someone in addiction' },
  { id: 'K06', name: 'Detachment with Love', category: 'Growth', description: 'Learning to love without losing yourself' },
]);

// ─── Kim Module Selection (from state-analyzer.ts) ──────────────

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

  // High stress → K04 (Stress Management)
  if (stress >= 6) modules.push('K04');
  // Boundary fatigue → K01 (Boundary Setting)
  if (boundaryFatigue >= 6) modules.push('K01');
  // Emotional burden / hopelessness → K03 (Self-Care)
  if (emotionalBurden >= 6 || signals.hopelessness) modules.push('K03');
  // Low self-care → K03
  if (selfCare <= 3) modules.push('K03');
  // Enabling patterns detected → K02
  if (activeTriggers.includes('enabling')) modules.push('K02');
  // Isolation → K05 (Support Network)
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
