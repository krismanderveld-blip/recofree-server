/**
 * MODULE_MEMORY_CROSS_SESSION — Shared types and core logic.
 *
 * Tracks which modules were dominant across sessions per persona.
 * Prevents the same module from becoming dominant again within 3 sessions
 * unless crisis/safety/user-request overrides apply.
 *
 * Architecture:
 * - Engine decides, GPT executes.
 * - GPT never writes memory.
 * - GPT never chooses dominant modules.
 * - Strict persona separation: Elias and Kim have independent memory.
 * - All data stays local on device.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModuleMemoryPersona = 'elias' | 'kim';

export type DominanceLevel =
  | 'dominant'
  | 'secondary'
  | 'context_only'
  | 'blocked';

export type ModuleMemoryActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_PERSONA_UNKNOWN'
  | 'BLOCKED_BY_DATA_CORRUPTION';

export type ModuleRepeatDecision =
  | 'ALLOW_DOMINANT'
  | 'ALLOW_SECONDARY_ONLY'
  | 'BLOCK_DOMINANT'
  | 'ALLOW_OVERRIDE_CRISIS'
  | 'ALLOW_OVERRIDE_SAFETY'
  | 'ALLOW_OVERRIDE_USER_REQUEST'
  | 'ALLOW_OVERRIDE_NO_ALTERNATIVE';

export interface PersonaModuleMemoryConfig {
  persona: ModuleMemoryPersona;
  storagePath: string;
  allowedModules: string[];
  dominanceWindowSessions: 3;
  strictPersonaSeparation: true;
  localOnly: true;
}

export interface ModuleUsageEntry {
  moduleId: string;
  persona: ModuleMemoryPersona;
  sessionId: string;
  activatedAt: string;
  dominanceLevel: DominanceLevel;
  responseMode?: string;
  confidenceScore?: number;
  selectedByEngine: true;
  overrideUsed: boolean;
  overrideReason?: ModuleRepeatDecision;
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  safetyRelated: boolean;
}

export interface SessionModuleMemoryRecord {
  sessionId: string;
  persona: ModuleMemoryPersona;
  startedAt: string;
  endedAt: string;
  dominantModuleId: string | null;
  secondaryModuleIds: string[];
  contextOnlyModuleIds: string[];
  responseModes: string[];
  crisisProtocolActivated: boolean;
  storagePatchApplied: boolean;
}

export interface ModuleMemoryState {
  persona: ModuleMemoryPersona;
  sessions: SessionModuleMemoryRecord[];
  moduleUsage: ModuleUsageEntry[];
  dominantModuleWindow: string[];
  blockedDominance: {
    moduleId: string;
    blockedAt: string;
    reason: string;
    fallbackModuleId?: string;
  }[];
  lastSessionContext: {
    sessionId: string;
    dominantModuleId: string | null;
    therapeuticTheme?: string;
    userStateSummary?: string;
    nextSessionCaution?: string;
  } | null;
  repeatingModulePatterns: {
    moduleId: string;
    countLast10Sessions: number;
    lastSeenAt: string;
    note: string;
  }[];
}

export interface ModuleMemoryRuntimeInput {
  intakeCompleted: boolean;
  persona: ModuleMemoryPersona;
  sessionId: string;
  timestampIso: string;
  candidateModuleId: string;
  candidateConfidenceScore: number;
  candidateResponseMode?: string;
  userExplicitlyRequestedModule: boolean;
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  safetyRelated: boolean;
  medicalRelated: boolean;
  noAlternativeModuleAvailable: boolean;
  existingMemoryState: ModuleMemoryState;
}

export interface ModuleMemoryDecisionResult {
  moduleId: 'MODULE_MEMORY_CROSS_SESSION';
  persona: ModuleMemoryPersona;
  activationStatus: ModuleMemoryActivationStatus;
  candidateModuleId: string;
  repeatDecision: ModuleRepeatDecision;
  allowedDominanceLevel: DominanceLevel;
  reason: string;
  fallbackRequired: boolean;
  previousDominantWindow: string[];
}

export interface ModuleMemoryPromptContext {
  persona: ModuleMemoryPersona;
  previousDominantModules: string[];
  blockedRepeatModules: string[];
  lastSessionContext: ModuleMemoryState['lastSessionContext'];
  compactContextForGPT: string;
  gptMayOverride: false;
  gptMayWriteMemory: false;
}

export interface ModuleMemoryStoragePatch {
  persona: ModuleMemoryPersona;
  storagePath: string;
  appendSessionRecord?: SessionModuleMemoryRecord;
  appendModuleUsage?: ModuleUsageEntry[];
  updateDominantModuleWindow?: string[];
  appendBlockedDominance?: ModuleMemoryState['blockedDominance'][number];
  updateLastSessionContext?: ModuleMemoryState['lastSessionContext'];
  updateRepeatingModulePatterns?: ModuleMemoryState['repeatingModulePatterns'];
}

// ─── Default State Factory ───────────────────────────────────────────────────

export function createDefaultModuleMemoryState(persona: ModuleMemoryPersona): ModuleMemoryState {
  return {
    persona,
    sessions: [],
    moduleUsage: [],
    dominantModuleWindow: [],
    blockedDominance: [],
    lastSessionContext: null,
    repeatingModulePatterns: [],
  };
}

// ─── Detector Logic ──────────────────────────────────────────────────────────

export function evaluateModuleMemoryRepeat(
  input: ModuleMemoryRuntimeInput
): ModuleMemoryDecisionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'BLOCKED_BY_INTAKE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'BLOCK_DOMINANT',
      allowedDominanceLevel: 'blocked',
      reason: 'Intake incomplete. Module memory cannot operate.',
      fallbackRequired: true,
      previousDominantWindow: [],
    };
  }

  if (input.persona !== 'elias' && input.persona !== 'kim') {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'BLOCKED_BY_PERSONA_UNKNOWN',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'BLOCK_DOMINANT',
      allowedDominanceLevel: 'blocked',
      reason: 'Unknown persona. Strict persona separation required.',
      fallbackRequired: true,
      previousDominantWindow: [],
    };
  }

  const previousDominantWindow = input.existingMemoryState.dominantModuleWindow.slice(-3);
  const appearedRecently = previousDominantWindow.includes(input.candidateModuleId);

  // Crisis override — always allow
  if (input.crisisProtocolStatus === 'ACTIVE') {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'ACTIVE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'ALLOW_OVERRIDE_CRISIS',
      allowedDominanceLevel: 'dominant',
      reason: 'Crisis protocol overrides repetition block.',
      fallbackRequired: false,
      previousDominantWindow,
    };
  }

  // Safety/medical override — always allow
  if (input.safetyRelated || input.medicalRelated) {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'ACTIVE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'ALLOW_OVERRIDE_SAFETY',
      allowedDominanceLevel: 'dominant',
      reason: 'Safety or medical routing overrides repetition block.',
      fallbackRequired: false,
      previousDominantWindow,
    };
  }

  // Not appeared recently — allow dominant
  if (!appearedRecently) {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'ACTIVE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'ALLOW_DOMINANT',
      allowedDominanceLevel: 'dominant',
      reason: 'Candidate module not dominant in last 3 sessions.',
      fallbackRequired: false,
      previousDominantWindow,
    };
  }

  // User explicitly requested — allow override
  if (input.userExplicitlyRequestedModule) {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'ACTIVE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'ALLOW_OVERRIDE_USER_REQUEST',
      allowedDominanceLevel: 'dominant',
      reason: 'User explicitly requested same module/theme.',
      fallbackRequired: false,
      previousDominantWindow,
    };
  }

  // No alternative available — allow override
  if (input.noAlternativeModuleAvailable) {
    return {
      moduleId: 'MODULE_MEMORY_CROSS_SESSION',
      persona: input.persona,
      activationStatus: 'ACTIVE',
      candidateModuleId: input.candidateModuleId,
      repeatDecision: 'ALLOW_OVERRIDE_NO_ALTERNATIVE',
      allowedDominanceLevel: 'dominant',
      reason: 'No safe alternative module available above threshold.',
      fallbackRequired: false,
      previousDominantWindow,
    };
  }

  // Default: block dominant, downgrade to secondary
  return {
    moduleId: 'MODULE_MEMORY_CROSS_SESSION',
    persona: input.persona,
    activationStatus: 'ACTIVE',
    candidateModuleId: input.candidateModuleId,
    repeatDecision: 'BLOCK_DOMINANT',
    allowedDominanceLevel: 'secondary',
    reason: 'Candidate module was dominant within last 3 sessions. Downgrade to secondary and require fallback dominant module.',
    fallbackRequired: true,
    previousDominantWindow,
  };
}

// ─── Prompt Context Builder ──────────────────────────────────────────────────

export function buildModuleMemoryPromptContext(
  state: ModuleMemoryState,
  decision: ModuleMemoryDecisionResult
): ModuleMemoryPromptContext {
  const blockedRepeatModules =
    decision.repeatDecision === 'BLOCK_DOMINANT' ? [decision.candidateModuleId] : [];

  return {
    persona: state.persona,
    previousDominantModules: state.dominantModuleWindow.slice(-3),
    blockedRepeatModules,
    lastSessionContext: state.lastSessionContext,
    compactContextForGPT:
      decision.repeatDecision === 'BLOCK_DOMINANT'
        ? 'Previous sessions used this module recently. Do not make it the dominant frame. Use only as secondary context if included by engine payload.'
        : 'Use previous session context only as engine-provided continuity. Do not access or write memory.',
    gptMayOverride: false,
    gptMayWriteMemory: false,
  };
}

// ─── Repeating Module Patterns Computation ───────────────────────────────────

export function computeRepeatingModulePatterns(
  previousUsage: ModuleUsageEntry[],
  newUsage: ModuleUsageEntry[]
): ModuleMemoryState['repeatingModulePatterns'] {
  const combined = [...previousUsage, ...newUsage];
  const lastTenSessions = Array.from(new Set(combined.map((entry) => entry.sessionId))).slice(-10);
  const recent = combined.filter((entry) => lastTenSessions.includes(entry.sessionId));
  const grouped: Record<string, ModuleUsageEntry[]> = {};

  for (const entry of recent) {
    if (!grouped[entry.moduleId]) grouped[entry.moduleId] = [];
    grouped[entry.moduleId].push(entry);
  }

  return Object.entries(grouped)
    .filter(([, entries]) => entries.length >= 3)
    .map(([moduleId, entries]) => ({
      moduleId,
      countLast10Sessions: entries.length,
      lastSeenAt: entries[entries.length - 1].activatedAt,
      note: 'Module appeared repeatedly in recent sessions. Use for continuity, not automatic dominance.',
    }));
}

// ─── Storage Patch Builder ───────────────────────────────────────────────────

export function buildModuleMemoryStoragePatch(args: {
  persona: ModuleMemoryPersona;
  storagePath: string;
  sessionRecord: SessionModuleMemoryRecord;
  moduleUsageEntries: ModuleUsageEntry[];
  previousState: ModuleMemoryState;
  decision?: ModuleMemoryDecisionResult;
  lastSessionContext: ModuleMemoryState['lastSessionContext'];
}): ModuleMemoryStoragePatch {
  const dominantModuleId = args.sessionRecord.dominantModuleId;
  const previousWindow = args.previousState.dominantModuleWindow || [];
  const nextWindow =
    dominantModuleId !== null
      ? [...previousWindow, dominantModuleId].slice(-3)
      : previousWindow.slice(-3);

  const blockedEntry =
    args.decision && args.decision.repeatDecision === 'BLOCK_DOMINANT'
      ? {
          moduleId: args.decision.candidateModuleId,
          blockedAt: args.sessionRecord.endedAt,
          reason: args.decision.reason,
        }
      : undefined;

  return {
    persona: args.persona,
    storagePath: args.storagePath,
    appendSessionRecord: args.sessionRecord,
    appendModuleUsage: args.moduleUsageEntries,
    updateDominantModuleWindow: nextWindow,
    appendBlockedDominance: blockedEntry,
    updateLastSessionContext: args.lastSessionContext,
    updateRepeatingModulePatterns: computeRepeatingModulePatterns(
      args.previousState.moduleUsage,
      args.moduleUsageEntries
    ),
  };
}
