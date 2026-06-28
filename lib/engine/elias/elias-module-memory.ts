/**
 * Elias Module Memory — Persona-specific session state and storage patch.
 *
 * Reads and writes ONLY Elias user.dat.moduleMemory.
 * Never accesses Kim state.
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

// ─── Elias Config ────────────────────────────────────────────────────────────

export const EliasModuleMemoryConfig: PersonaModuleMemoryConfig = {
  persona: 'elias',
  storagePath: 'local://recofree/personas/elias/user.dat.moduleMemory',
  allowedModules: [
    'VERG01',
    'ROUW01',
    'IDEN01',
    'ZINK01',
    'FALE01',
    'STO01',
    'SW01',
    'SchemaMode',
    'E01',
    'E02',
    'MI01',
    'EKT01',
    'ACT01',
    'MBT01',
  ],
  dominanceWindowSessions: 3,
  strictPersonaSeparation: true,
  localOnly: true,
};

// ─── Session State (in-memory, reset per session) ────────────────────────────

interface EliasModuleMemorySessionState {
  active: boolean;
  dominantModuleId: string | null;
  secondaryModuleIds: string[];
  contextOnlyModuleIds: string[];
  responseModes: string[];
  moduleUsageEntries: ModuleUsageEntry[];
  crisisProtocolActivated: boolean;
  lastDecision: ModuleMemoryDecisionResult | null;
}

let sessionState: EliasModuleMemorySessionState = {
  active: false,
  dominantModuleId: null,
  secondaryModuleIds: [],
  contextOnlyModuleIds: [],
  responseModes: [],
  moduleUsageEntries: [],
  crisisProtocolActivated: false,
  lastDecision: null,
};

export function getEliasModuleMemorySessionState(): EliasModuleMemorySessionState {
  return { ...sessionState };
}

export function resetEliasModuleMemorySessionState(): void {
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
export function recordEliasModuleActivation(args: {
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
    persona: 'elias',
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
export function setEliasModuleMemoryDecision(decision: ModuleMemoryDecisionResult): void {
  sessionState.lastDecision = decision;
}

// ─── Progress Persistence (stored in userDat at session end) ─────────────────

/**
 * Build the Elias module memory storage patch at session end.
 * Enforces persona separation: throws if non-Elias data is passed.
 */
export function buildEliasModuleMemoryPatch(args: {
  sessionId: string;
  sessionStartedAt: string;
  sessionEndedAt: string;
  previousState: ModuleMemoryState;
  therapeuticTheme?: string;
  userStateSummary?: string;
  nextSessionCaution?: string;
}): ModuleMemoryStoragePatch {
  const state = getEliasModuleMemorySessionState();

  if (args.previousState.persona !== 'elias') {
    throw new Error('Persona separation violation: Elias patch received non-Elias session.');
  }

  const sessionRecord: SessionModuleMemoryRecord = {
    sessionId: args.sessionId,
    persona: 'elias',
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
    persona: 'elias',
    storagePath: EliasModuleMemoryConfig.storagePath,
    sessionRecord,
    moduleUsageEntries: state.moduleUsageEntries,
    previousState: args.previousState,
    decision: state.lastDecision ?? undefined,
    lastSessionContext,
  });
}

/**
 * Apply a storage patch to the existing Elias module memory state.
 * Returns the updated state for persistence.
 */
export function applyEliasModuleMemoryPatch(
  existing: ModuleMemoryState | undefined,
  patch: ModuleMemoryStoragePatch
): ModuleMemoryState {
  if (patch.persona !== 'elias') {
    throw new Error('Persona separation violation: cannot apply non-Elias patch to Elias memory.');
  }

  const state = existing ?? createDefaultModuleMemoryState('elias');

  return {
    ...state,
    sessions: patch.appendSessionRecord
      ? [...state.sessions, patch.appendSessionRecord].slice(-20) // Keep last 20 sessions
      : state.sessions,
    moduleUsage: patch.appendModuleUsage
      ? [...state.moduleUsage, ...patch.appendModuleUsage].slice(-100) // Keep last 100 entries
      : state.moduleUsage,
    dominantModuleWindow: patch.updateDominantModuleWindow ?? state.dominantModuleWindow,
    blockedDominance: patch.appendBlockedDominance
      ? [...state.blockedDominance, patch.appendBlockedDominance].slice(-10)
      : state.blockedDominance,
    lastSessionContext: patch.updateLastSessionContext ?? state.lastSessionContext,
    repeatingModulePatterns: patch.updateRepeatingModulePatterns ?? state.repeatingModulePatterns,
  };
}
