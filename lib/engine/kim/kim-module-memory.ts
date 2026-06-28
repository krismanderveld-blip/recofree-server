/**
 * Kim Module Memory — Persona-specific session state and storage patch.
 *
 * Reads and writes ONLY Kim user.dat.moduleMemory.
 * Never accesses Elias state.
 * Crisis override always bypasses blocking.
 * GPT never writes module memory.
 */

import type {
  ModuleMemoryPersona,
  ModuleMemoryState,
  ModuleUsageEntry,
  SessionModuleMemoryRecord,
  ModuleMemoryDecisionResult,
  ModuleMemoryStoragePatch,
  PersonaModuleMemoryConfig,
  DominanceLevel,
} from '../shared/module-memory-cross-session';
import {
  createDefaultModuleMemoryState,
  buildModuleMemoryStoragePatch,
} from '../shared/module-memory-cross-session';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Kim Config ──────────────────────────────────────────────────────────────

export const KimModuleMemoryConfig: PersonaModuleMemoryConfig = {
  persona: 'kim',
  storagePath: 'local://recofree/personas/kim/user.dat.moduleMemory',
  allowedModules: [
    'KST01',
    'KDL01',
    'KBR01',
    'KSC01',
    'K01',
    'K02',
    'K03',
    'K04',
    'K05',
    'K06',
  ],
  dominanceWindowSessions: 3,
  strictPersonaSeparation: true,
  localOnly: true,
};

// ─── Session State (in-memory, reset per session) ────────────────────────────

interface KimModuleMemorySessionState {
  active: boolean;
  dominantModuleId: string | null;
  secondaryModuleIds: string[];
  contextOnlyModuleIds: string[];
  responseModes: string[];
  moduleUsageEntries: ModuleUsageEntry[];
  crisisProtocolActivated: boolean;
  lastDecision: ModuleMemoryDecisionResult | null;
}

let sessionState: KimModuleMemorySessionState = {
  active: false,
  dominantModuleId: null,
  secondaryModuleIds: [],
  contextOnlyModuleIds: [],
  responseModes: [],
  moduleUsageEntries: [],
  crisisProtocolActivated: false,
  lastDecision: null,
};

export function getKimModuleMemorySessionState(): KimModuleMemorySessionState {
  return { ...sessionState };
}

export function resetKimModuleMemorySessionState(): void {
  sessionState = {
    active: false,
    dominantModuleId: null,
    secondaryModuleIds: [],
    contextOnlyModuleIds: [],
    responseModes: [],
    moduleUsageEntries: [],
    crisisProtocolActivated: false,
    lastDecision: null,
  };
}

/**
 * Record a module activation during the current session.
 */
export function recordKimModuleActivation(args: {
  moduleId: string;
  sessionId: string;
  dominanceLevel: DominanceLevel;
  responseMode?: string;
  confidenceScore?: number;
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  safetyRelated: boolean;
  overrideUsed: boolean;
  overrideReason?: ModuleUsageEntry['overrideReason'];
}): void {
  sessionState.active = true;

  const entry: ModuleUsageEntry = {
    moduleId: args.moduleId,
    persona: 'kim',
    sessionId: args.sessionId,
    activatedAt: LocalDeviceTimeService.now().utcIso,
    dominanceLevel: args.dominanceLevel,
    responseMode: args.responseMode,
    confidenceScore: args.confidenceScore,
    selectedByEngine: true,
    overrideUsed: args.overrideUsed,
    overrideReason: args.overrideReason,
    crisisProtocolStatus: args.crisisProtocolStatus,
    safetyRelated: args.safetyRelated,
  };

  sessionState.moduleUsageEntries.push(entry);

  if (args.dominanceLevel === 'dominant') {
    sessionState.dominantModuleId = args.moduleId;
  } else if (args.dominanceLevel === 'secondary') {
    if (!sessionState.secondaryModuleIds.includes(args.moduleId)) {
      sessionState.secondaryModuleIds.push(args.moduleId);
    }
  } else if (args.dominanceLevel === 'context_only') {
    if (!sessionState.contextOnlyModuleIds.includes(args.moduleId)) {
      sessionState.contextOnlyModuleIds.push(args.moduleId);
    }
  }

  if (args.responseMode && !sessionState.responseModes.includes(args.responseMode)) {
    sessionState.responseModes.push(args.responseMode);
  }

  if (args.crisisProtocolStatus === 'ACTIVE') {
    sessionState.crisisProtocolActivated = true;
  }
}

/**
 * Store the last decision for use in session-end patch.
 */
export function setKimModuleMemoryDecision(decision: ModuleMemoryDecisionResult): void {
  sessionState.lastDecision = decision;
}

// ─── Progress Persistence (stored in userDat at session end) ─────────────────

/**
 * Build the Kim module memory storage patch at session end.
 * Enforces persona separation: throws if non-Kim data is passed.
 */
export function buildKimModuleMemoryPatch(args: {
  sessionId: string;
  sessionStartedAt: string;
  sessionEndedAt: string;
  previousState: ModuleMemoryState;
  therapeuticTheme?: string;
  userStateSummary?: string;
  nextSessionCaution?: string;
}): ModuleMemoryStoragePatch {
  const state = getKimModuleMemorySessionState();

  if (args.previousState.persona !== 'kim') {
    throw new Error('Persona separation violation: Kim patch received non-Kim session.');
  }

  const sessionRecord: SessionModuleMemoryRecord = {
    sessionId: args.sessionId,
    persona: 'kim',
    startedAt: args.sessionStartedAt,
    endedAt: args.sessionEndedAt,
    dominantModuleId: state.dominantModuleId,
    secondaryModuleIds: state.secondaryModuleIds,
    contextOnlyModuleIds: state.contextOnlyModuleIds,
    responseModes: state.responseModes,
    crisisProtocolActivated: state.crisisProtocolActivated,
    storagePatchApplied: true,
  };

  const lastSessionContext: ModuleMemoryState['lastSessionContext'] = {
    sessionId: args.sessionId,
    dominantModuleId: state.dominantModuleId,
    therapeuticTheme: args.therapeuticTheme,
    userStateSummary: args.userStateSummary,
    nextSessionCaution: args.nextSessionCaution,
  };

  return buildModuleMemoryStoragePatch({
    persona: 'kim',
    storagePath: KimModuleMemoryConfig.storagePath,
    sessionRecord,
    moduleUsageEntries: state.moduleUsageEntries,
    previousState: args.previousState,
    decision: state.lastDecision ?? undefined,
    lastSessionContext,
  });
}

/**
 * Apply a storage patch to the existing Kim module memory state.
 * Returns the updated state for persistence.
 */
export function applyKimModuleMemoryPatch(
  existing: ModuleMemoryState | undefined,
  patch: ModuleMemoryStoragePatch
): ModuleMemoryState {
  if (patch.persona !== 'kim') {
    throw new Error('Persona separation violation: cannot apply non-Kim patch to Kim memory.');
  }

  const state = existing ?? createDefaultModuleMemoryState('kim');

  return {
    ...state,
    sessions: patch.appendSessionRecord
      ? [...state.sessions, patch.appendSessionRecord].slice(-20)
      : state.sessions,
    moduleUsage: patch.appendModuleUsage
      ? [...state.moduleUsage, ...patch.appendModuleUsage].slice(-100)
      : state.moduleUsage,
    dominantModuleWindow: patch.updateDominantModuleWindow ?? state.dominantModuleWindow,
    blockedDominance: patch.appendBlockedDominance
      ? [...state.blockedDominance, patch.appendBlockedDominance].slice(-10)
      : state.blockedDominance,
    lastSessionContext: patch.updateLastSessionContext ?? state.lastSessionContext,
    repeatingModulePatterns: patch.updateRepeatingModulePatterns ?? state.repeatingModulePatterns,
  };
}
