/**
 * KERP01 Storage Layer
 *
 * Reads and writes the Eigen Regie Plan from/to the backpack.
 * The plan lives in backpack.eigenRegiePlan (Kim only).
 *
 * RULES:
 * - NEVER auto-modified by the system
 * - Only the user can edit (via Eigen Regie Plan screens)
 * - Persisted via the same backpack AsyncStorage mechanism
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EigenRegiePlan,
  EigenRegieZoneEntry,
  EigenRegieTrigger,
  EigenRegieZoneId,
  DEFAULT_EIGEN_REGIE_PLAN,
} from './kerp01-types';

const STORAGE_KEY = '@recofree:eigenRegiePlan';

// ─── Read ────────────────────────────────────────────────────

/**
 * Load the Eigen Regie Plan from AsyncStorage.
 * Returns the default empty plan if none exists.
 */
export async function loadEigenRegiePlan(): Promise<EigenRegiePlan> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EIGEN_REGIE_PLAN };
    const parsed = JSON.parse(raw) as EigenRegiePlan;
    // Version migration guard
    if (!parsed.version || parsed.version < 1) {
      return { ...DEFAULT_EIGEN_REGIE_PLAN };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_EIGEN_REGIE_PLAN };
  }
}

// ─── Write ───────────────────────────────────────────────────

/**
 * Save the entire Eigen Regie Plan to AsyncStorage.
 * Updates the lastUpdated timestamp.
 */
export async function saveEigenRegiePlan(plan: EigenRegiePlan): Promise<void> {
  const updated: EigenRegiePlan = {
    ...plan,
    lastUpdated: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// ─── Zone Operations ─────────────────────────────────────────

/**
 * Update a single zone entry in the plan.
 */
export async function updateZoneEntry(
  zoneId: EigenRegieZoneId,
  entry: Partial<EigenRegieZoneEntry>,
): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  plan.zones[zoneId] = { ...plan.zones[zoneId], ...entry };
  await saveEigenRegiePlan(plan);
  return plan;
}

// ─── Trigger Operations ──────────────────────────────────────

/**
 * Add a trigger to the plan.
 */
export async function addTrigger(trigger: EigenRegieTrigger): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  plan.triggers.push(trigger);
  await saveEigenRegiePlan(plan);
  return plan;
}

/**
 * Remove a trigger by index.
 */
export async function removeTrigger(index: number): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  plan.triggers.splice(index, 1);
  await saveEigenRegiePlan(plan);
  return plan;
}

/**
 * Update a trigger at a specific index.
 */
export async function updateTrigger(
  index: number,
  trigger: Partial<EigenRegieTrigger>,
): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  if (plan.triggers[index]) {
    plan.triggers[index] = { ...plan.triggers[index], ...trigger };
  }
  await saveEigenRegiePlan(plan);
  return plan;
}

// ─── Boundary Rules ──────────────────────────────────────────

/**
 * Update boundary rules.
 */
export async function updateBoundaryRules(rules: string[]): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  plan.boundaryRules = rules;
  await saveEigenRegiePlan(plan);
  return plan;
}

// ─── Anchor Sentence ─────────────────────────────────────────

/**
 * Update the main anchor sentence.
 */
export async function updateMainAnchorSentence(sentence: string): Promise<EigenRegiePlan> {
  const plan = await loadEigenRegiePlan();
  plan.mainAnchorSentence = sentence;
  await saveEigenRegiePlan(plan);
  return plan;
}

// ─── Full Plan Replace (wizard output) ───────────────────────

/**
 * Replace the entire plan (used after wizard completion).
 * Preserves version and persona fields.
 */
export async function replaceFullPlan(newPlan: Omit<EigenRegiePlan, 'version' | 'persona'>): Promise<EigenRegiePlan> {
  const plan: EigenRegiePlan = {
    ...newPlan,
    version: 1,
    persona: 'kim',
    lastUpdated: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  return plan;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Check if the plan has meaningful content (at least one zone with signals or whatHelps).
 */
export function isPlanFilled(plan: EigenRegiePlan): boolean {
  return Object.values(plan.zones).some(
    zone => zone.signals.length > 0 || zone.whatHelps.length > 0 || zone.anchorSentence !== '',
  );
}

/**
 * Get the zone entry for the current Eigen Regie zone.
 */
export function getZoneEntry(plan: EigenRegiePlan, zoneId: EigenRegieZoneId): EigenRegieZoneEntry {
  return plan.zones[zoneId];
}
