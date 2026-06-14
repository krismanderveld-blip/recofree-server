/**
 * user.dat — Stable user/persona memory layer.
 */
import type {
  RecoFreePersona,
  MemorySource,
  DetectedTrigger,
} from "./memoryCore.types";

export interface UserDat {
  schemaVersion: "user.dat.v2";
  persona: RecoFreePersona;
  identity: UserIdentityBlock;
  triggerPatterns: TriggerPatternRecord[];
  schemaTendencies: SchemaTendencyRecord[];
  modeTendencies: ModeTendencyRecord[];
  moduleUsage: ModuleUsageRecord[];
  updatedAt: string;
}

export interface UserIdentityBlock {
  localUserId: string;
  displayName?: string;
  role: "dependent" | "caregiver";
  intakeCompleted: boolean;
  createdAt: string;
}

export interface TriggerPatternRecord {
  triggerId: string;
  label: string;
  normalizedTrigger: string;
  triggerType: DetectedTrigger["triggerType"];
  frequency: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastConfidence: number;
  highestConfidence: number;
  sourceCounts: {
    explicit_user_text: number;
    pattern_inference: number;
    session_summary: number;
  };
  sources: Array<{
    turnId?: string;
    sessionId: string;
    timestampIso: string;
    source: MemorySource;
    confidence: number;
    evidenceHash?: string;
  }>;
}

export interface SchemaTendencyRecord {
  schemaId: string;
  schemaName: string;
  observationCount: number;
  confidenceAverage: number;
  confidencePeak: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: Array<{
    turnId?: string;
    sessionId: string;
    timestampIso: string;
    source: MemorySource;
    confidence: number;
    evidenceHash?: string;
  }>;
}

export interface ModeTendencyRecord {
  modeId: string;
  modeName: string;
  observationCount: number;
  confidenceAverage: number;
  confidencePeak: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: Array<{
    turnId?: string;
    sessionId: string;
    timestampIso: string;
    source: MemorySource;
    confidence: number;
    evidenceHash?: string;
  }>;
}

export interface ModuleUsageRecord {
  moduleId: string;
  persona: RecoFreePersona;
  usageCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
  lastResponseMode: string;
  recentUses: Array<{
    turnId: string;
    sessionId: string;
    timestampIso: string;
    responseMode: string;
    confidence: number;
  }>;
}

/** Payload types for merge functions */
export interface TriggerPatternPatchPayload {
  label: string;
  normalizedTrigger: string;
  triggerType: DetectedTrigger["triggerType"];
  confidence: number;
  sourceKind: "explicit_user_text" | "pattern_inference" | "session_summary";
  turnId?: string;
  sessionId: string;
  timestampIso: string;
  source: MemorySource;
  evidenceHash?: string;
}

export interface SchemaTendencyPatchPayload {
  schemaId: string;
  schemaName: string;
  confidence: number;
  sourceKind: "schema_mode_engine" | "session_summary";
  turnId?: string;
  sessionId: string;
  timestampIso: string;
  source: MemorySource;
  evidenceHash?: string;
}

export interface ModeTendencyPatchPayload {
  modeId: string;
  modeName: string;
  confidence: number;
  sourceKind: "schema_mode_engine" | "session_summary";
  turnId?: string;
  sessionId: string;
  timestampIso: string;
  source: MemorySource;
  evidenceHash?: string;
}

export interface ModuleUsagePatchPayload {
  moduleId: string;
  persona: RecoFreePersona;
  responseMode: string;
  confidence: number;
  turnId: string;
  sessionId: string;
  timestampIso: string;
}

export function createEmptyUserDat(persona: RecoFreePersona, localUserId: string): UserDat {
  const now = new Date().toISOString();
  return {
    schemaVersion: "user.dat.v2",
    persona,
    identity: {
      localUserId,
      role: persona === "elias" ? "dependent" : "caregiver",
      intakeCompleted: false,
      createdAt: now,
    },
    triggerPatterns: [],
    schemaTendencies: [],
    modeTendencies: [],
    moduleUsage: [],
    updatedAt: now,
  };
}
