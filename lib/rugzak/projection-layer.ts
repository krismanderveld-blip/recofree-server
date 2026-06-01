/**
 * Projection Layer Orchestrator — PRE-GPT Step 5d
 *
 * Called in the pipeline after backpack-relevance-analyzer (Step 5c).
 * Orchestrates projection signal detection for both Elias and Kim.
 * Also handles the Deepening Module activation logic.
 *
 * This module does NOT modify the Backpack.
 * Storage: local within-device memory only (AsyncStorage).
 */

import {
  detectProjectionSignals,
  buildProjectionContext,
  getProjectionState,
  saveEliasProjection,
  type ProjectionSignalInput,
  type ProjectionSignalResult,
} from '../engine/elias/projection';

import {
  detectKimProjectionSignals,
  buildKimProjectionContext,
  getKimProjectionState,
  saveKimProjection,
  type KimProjectionSignalInput,
  type KimProjectionSignalResult,
} from '../engine/kim/projection';

import type { UserType } from '../ai/types';
import { logDebugEvent } from '../debug/session-logger';

// ─── Output Types ───────────────────────────────────────────────

export interface ProjectionResult {
  hasActiveEntries: boolean;
  injectionBlock: string | null;
  newEntriesCount: number;
  deepeningDirective: string | null;
}

// ─── Deepening Module State (per-session) ───────────────────────

let wasDeflected = false;

export function resetDeepeningState(): void {
  wasDeflected = false;
}

export function markDeflected(): void {
  wasDeflected = true;
}

export function isDeepeningBlocked(): boolean {
  return wasDeflected;
}

// ─── Deepening Module Logic ─────────────────────────────────────

// E03 = Relapse Prevention (pattern_reflection), E04 = Self-Compassion (connection_risk/confrontation)
// E06 = Values & Meaning (reflective exploration)
const ELIAS_DEEPENING_MODULES = ['E03', 'E04', 'E06'];
const PROJECTION_DEEPENING_DIRECTIVE = 'When the moment is right, gently ask about hopes or fears for the future.';

function shouldActivateDeepening(
  userType: UserType,
  dominantModule: string,
  eigenRegieScore: number | null,
): boolean {
  if (wasDeflected) return false;

  if (userType === 'elias') {
    return ELIAS_DEEPENING_MODULES.includes(dominantModule);
  } else {
    // Kim: activate when Eigen Regie > 50 (stable enough to look forward)
    return eigenRegieScore !== null && eigenRegieScore > 50;
  }
}

// ─── Main Orchestrator ──────────────────────────────────────────

export interface ProjectionLayerInput {
  userType: UserType;
  message: string;
  dominantModule: string;

  // Elias-specific
  vspLevel: string | null;
  distressScore: number;
  resilienceScore: number;
  consecutiveGreenSessions: number;
  zoneImproved: boolean;

  // Kim-specific
  eigenRegieScore: number | null;
  consecutiveHighRegieSessions: number;
}

/**
 * Run projection signal detection and build injection context.
 * Called in pipeline Step 5d (after backpack-relevance-analyzer).
 */
export function runProjectionLayer(input: ProjectionLayerInput): ProjectionResult {
  let signalResult: ProjectionSignalResult | KimProjectionSignalResult;
  let injectionBlock: string | null;

  if (input.userType === 'elias') {
    const signalInput: ProjectionSignalInput = {
      message: input.message,
      vspLevel: input.vspLevel,
      distressScore: input.distressScore,
      resilienceScore: input.resilienceScore,
      consecutiveGreenSessions: input.consecutiveGreenSessions,
      zoneImproved: input.zoneImproved,
    };
    signalResult = detectProjectionSignals(signalInput);
    injectionBlock = buildProjectionContext();
  } else {
    const signalInput: KimProjectionSignalInput = {
      message: input.message,
      eigenRegieScore: input.eigenRegieScore,
      consecutiveHighRegieSessions: input.consecutiveHighRegieSessions,
      distressScore: input.distressScore,
      resilienceScore: input.resilienceScore,
      zoneImproved: input.zoneImproved,
    };
    signalResult = detectKimProjectionSignals(signalInput);
    injectionBlock = buildKimProjectionContext();
  }

  // ── Debug logging for projection signals ──
  for (const entry of signalResult.newEntries) {
    logDebugEvent('projection_signal', {
      action: 'created',
      category: entry.category,
      content: entry.content,
      source: entry.source,
      strength: entry.strength,
    });
  }
  if (signalResult.reinforcedEntryIds.length > 0) {
    logDebugEvent('projection_signal', {
      action: 'reinforced',
      count: signalResult.reinforcedEntryIds.length,
      ids: signalResult.reinforcedEntryIds,
    });
  }

  // ── Persist projection state after detection (fire-and-forget) ──
  // Ensures new entries and reinforcements survive app restarts mid-session
  if (signalResult.newEntries.length > 0 || signalResult.reinforcedEntryIds.length > 0) {
    if (input.userType === 'elias') {
      saveEliasProjection(getProjectionState()).catch(() => {});
    } else {
      saveKimProjection(getKimProjectionState()).catch(() => {});
    }
  }

  // Deepening module
  const deepeningActive = shouldActivateDeepening(
    input.userType,
    input.dominantModule,
    input.eigenRegieScore,
  );
  const deepeningDirective = deepeningActive ? PROJECTION_DEEPENING_DIRECTIVE : null;

  return {
    hasActiveEntries: injectionBlock !== null,
    injectionBlock,
    newEntriesCount: signalResult.newEntries.length,
    deepeningDirective,
  };
}

/**
 * Check if the user deflected in their response.
 * Called POST-GPT to deactivate deepening for remainder of session.
 * Uses the same deflection markers as intervention-continuity.
 */
export function checkDeflectionInResponse(userMessage: string): boolean {
  const deflectionMarkers = [
    'don\'t know', 'no idea', 'whatever', 'doesn\'t matter',
    'never mind', 'forget it', 'not important', 'skip',
    'rather not', 'no need', 'move on', 'let it go',
  ];
  const lower = userMessage.toLowerCase();
  const deflected = deflectionMarkers.some(m => lower.includes(m));
  if (deflected) {
    markDeflected();
  }
  return deflected;
}
