/**
 * Server-safe Loopblocker + Mid-Session Re-eval
 *
 * Prevents the same module from being selected twice in one session.
 * Also handles mid-session re-evaluation when zone changes significantly.
 *
 * RULES:
 * 1. If a module was already used this session → block it from selection
 * 2. Exception: crisis modules are NEVER blocked
 * 3. If zone jumps 2+ levels → allow re-eval of previously used modules
 * 4. Maximum module switches per session: 5 (after that, stick with current)
 */

import type { BufferState, ZoneColor } from './buffer-server';

// ─── Types ────────────────────────────────────────────────────

export interface LoopblockResult {
  /** Whether the proposed module is blocked */
  isBlocked: boolean;
  /** Reason for blocking (if blocked) */
  reason: string | null;
  /** Whether mid-session re-eval was triggered */
  reEvalTriggered: boolean;
  /** Modules that are currently blocked */
  blockedModules: string[];
  /** Modules that are available */
  availableModules: string[];
}

// ─── Constants ────────────────────────────────────────────────

const MAX_MODULE_SWITCHES = 5;
const CRISIS_MODULES = ['CRISIS-E01', 'CRISIS-K01', 'crisis', 'CRISIS'];
const ZONE_ORDER: ZoneColor[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'PURPLE'];

// ─── Main Functions ───────────────────────────────────────────

/**
 * Check if a proposed module is blocked by the loopblocker.
 */
export function checkLoopblock(
  buffer: BufferState,
  proposedModule: string,
  allModules: string[],
): LoopblockResult {
  const usedModules = buffer.usedModules || [];
  const moduleSwitchCount = buffer.moduleSwitchCount || 0;

  // Crisis modules are NEVER blocked
  if (CRISIS_MODULES.some(cm => proposedModule.toUpperCase().includes(cm))) {
    return {
      isBlocked: false,
      reason: null,
      reEvalTriggered: false,
      blockedModules: usedModules,
      availableModules: allModules.filter(m => !usedModules.includes(m)),
    };
  }

  // Max switches reached → stick with current module
  if (moduleSwitchCount >= MAX_MODULE_SWITCHES) {
    const isBlocked = !usedModules.includes(proposedModule);
    return {
      isBlocked,
      reason: isBlocked ? `Max module switches (${MAX_MODULE_SWITCHES}) reached` : null,
      reEvalTriggered: false,
      blockedModules: allModules.filter(m => !usedModules.includes(m)),
      availableModules: usedModules,
    };
  }

  // Check if module was already used
  const isBlocked = usedModules.includes(proposedModule);
  return {
    isBlocked,
    reason: isBlocked ? `Module "${proposedModule}" already used this session` : null,
    reEvalTriggered: false,
    blockedModules: usedModules,
    availableModules: allModules.filter(m => !usedModules.includes(m)),
  };
}

/**
 * Check if a mid-session re-evaluation should be triggered.
 * This happens when the zone jumps 2+ levels.
 */
export function checkMidSessionReEval(
  previousZoneColor: ZoneColor,
  currentZoneColor: ZoneColor,
  buffer: BufferState,
): { reEvalTriggered: boolean; clearedModules: string[] } {
  const prevIdx = ZONE_ORDER.indexOf(previousZoneColor);
  const currIdx = ZONE_ORDER.indexOf(currentZoneColor);
  const jump = Math.abs(currIdx - prevIdx);

  if (jump >= 2) {
    // Zone jumped 2+ levels → clear used modules to allow re-selection
    return {
      reEvalTriggered: true,
      clearedModules: buffer.usedModules || [],
    };
  }

  return { reEvalTriggered: false, clearedModules: [] };
}

/**
 * Apply loopblocker update to buffer after module selection.
 */
export function applyLoopblockToBuffer(
  buffer: BufferState,
  selectedModule: string,
): BufferState {
  const usedModules = buffer.usedModules || [];
  const isNewModule = !usedModules.includes(selectedModule);

  return {
    ...buffer,
    usedModules: isNewModule ? [...usedModules, selectedModule] : usedModules,
    moduleSwitchCount: isNewModule
      ? (buffer.moduleSwitchCount || 0) + 1
      : buffer.moduleSwitchCount || 0,
    currentModuleMessageCount: isNewModule ? 1 : (buffer.currentModuleMessageCount || 0) + 1,
  };
}

/**
 * Clear the loopblocker (used when mid-session re-eval triggers).
 */
export function clearLoopblock(buffer: BufferState): BufferState {
  return {
    ...buffer,
    usedModules: [],
    moduleSwitchCount: 0,
    currentModuleMessageCount: 0,
  };
}
