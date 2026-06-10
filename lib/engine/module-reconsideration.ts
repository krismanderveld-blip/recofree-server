/**
 * Module Reconsideration Engine
 * 
 * After each LLM response, the engine evaluates whether the current module
 * is still the best fit based on new signals. The engine decides — the LLM only suggests.
 * 
 * Rules:
 * - Module switch only happens if the new suggestion has significantly higher confidence
 * - Crisis modules (K06) NEVER get overridden
 * - A module must have been active for at least 2 messages before it can be switched
 * - Maximum 2 switches per session to avoid instability
 */

import type { EngineSignalModuleRelevance } from './signal-parser';

// ─── Types ─────────────────────────────────────────────────────────

export interface ModuleReconsiderationInput {
  /** Currently active module ID */
  currentModuleId: string;
  /** How many messages the current module has been active */
  currentModuleMessageCount: number;
  /** Total module switches this session */
  switchCountThisSession: number;
  /** LLM's module suggestion (from engine_signals) */
  llmSuggestion: { moduleId: string; confidence: number } | null;
  /** Whether crisis protocol is active */
  crisisActive: boolean;
  /** Current zone (groen/geel/oranje/rood/paars) */
  currentZone: string;
}

export interface ModuleReconsiderationResult {
  /** Whether a module switch should happen */
  shouldSwitch: boolean;
  /** The new module ID (only if shouldSwitch is true) */
  newModuleId: string | null;
  /** Reason for the decision */
  reason: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const MIN_MESSAGES_BEFORE_SWITCH = 2;
const MAX_SWITCHES_PER_SESSION = 2;
const CONFIDENCE_DELTA_REQUIRED = 0.25; // New module must be 25% more confident than current
const CRISIS_MODULES = ['K06', 'CRISIS', 'SUICIDAL'];

// ─── Reconsideration Logic ─────────────────────────────────────────

/**
 * Evaluate whether the engine should switch to a different module.
 * The engine retains full control — this is a recommendation system.
 */
export function reconsiderModule(input: ModuleReconsiderationInput): ModuleReconsiderationResult {
  const { currentModuleId, currentModuleMessageCount, switchCountThisSession, llmSuggestion, crisisActive, currentZone } = input;

  // Rule 1: Never override crisis
  if (crisisActive || CRISIS_MODULES.includes(currentModuleId.toUpperCase()) || currentZone === 'paars' || currentZone === 'rood') {
    return { shouldSwitch: false, newModuleId: null, reason: 'crisis_active_no_switch' };
  }

  // Rule 2: No suggestion from LLM
  if (!llmSuggestion || !llmSuggestion.moduleId) {
    return { shouldSwitch: false, newModuleId: null, reason: 'no_suggestion' };
  }

  // Rule 3: Same module suggested
  if (llmSuggestion.moduleId === currentModuleId) {
    return { shouldSwitch: false, newModuleId: null, reason: 'same_module' };
  }

  // Rule 4: Too early to switch
  if (currentModuleMessageCount < MIN_MESSAGES_BEFORE_SWITCH) {
    return { shouldSwitch: false, newModuleId: null, reason: 'too_early_min_messages' };
  }

  // Rule 5: Max switches reached
  if (switchCountThisSession >= MAX_SWITCHES_PER_SESSION) {
    return { shouldSwitch: false, newModuleId: null, reason: 'max_switches_reached' };
  }

  // Rule 6: Confidence delta check — the new module must be significantly more relevant
  // We use 0.5 as the "current module baseline" since we don't have its confidence score
  const currentBaseline = 0.5;
  if (llmSuggestion.confidence - currentBaseline < CONFIDENCE_DELTA_REQUIRED) {
    return { shouldSwitch: false, newModuleId: null, reason: 'insufficient_confidence_delta' };
  }

  // All checks passed — recommend switch
  return {
    shouldSwitch: true,
    newModuleId: llmSuggestion.moduleId,
    reason: `switch_recommended_confidence_${llmSuggestion.confidence.toFixed(2)}`,
  };
}
