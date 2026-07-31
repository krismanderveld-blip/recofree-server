/**
 * logs.dat — Encrypted compressed session memory.
 */
import type {
  RecoFreePersona,
  MemoryLayerName,
  ZoneDecision,
  DetectedFear,
  DetectedHope,
  DetectedTrigger,
  DetectedSchemaTendency,
  DetectedModeTendency,
} from "./memoryCore.types";
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface LogsDatPlaintext {
  schemaVersion: "logs.dat.v2";
  persona: RecoFreePersona;
  createdAt: string;
  updatedAt: string;
  sessions: SessionLogSummary[];
  routingAudits: LogsRoutingAuditEntry[];
}

export interface SessionLogSummary {
  summaryId: string;
  sessionId: string;
  persona: RecoFreePersona;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  summaryModel: "gpt-4o" | "gpt-4o-mini";
  summarySchemaVersion: "session_summary.v1";
  compressedNarrative: string;
  discussedTopics: string[];
  emotionalThemes: Array<{
    label: string;
    intensity: number;
    evidenceHash?: string;
  }>;
  breakthroughs: Array<{
    label: string;
    description: string;
    confidence: number;
  }>;
  relapseOrRiskEvents: Array<{
    eventType: "relapse" | "near_relapse" | "craving_spike" | "caregiver_overload" | "crisis" | "none";
    description: string;
    severity: number;
  }>;
  openEndpoints: Array<{
    label: string;
    category: "unresolved_question" | "follow_up" | "risk_monitor" | "emotion_unfinished" | "other";
    suggestedNextModuleId?: string;
  }>;
  extractedCandidates: SessionExtractionCandidates;
  moduleTrace: Array<{
    moduleId: string;
    responseMode: string;
    count: number;
  }>;
  zoneTrace: Array<{
    zone: ZoneDecision["zone"];
    count: number;
  }>;
  inputTokenEstimate: number;
  outputTokenEstimate: number;
  /** Number of turns in this session */
  turnCount?: number;
  /** Dominant themes detected during session */
  dominantThemes?: string[];
  /** Emotional arc description */
  emotionalArc?: string;
  /** Unresolved tensions from session */
  unresolvedTensions?: string[];
  /** Suggested follow-up for next session */
  suggestedFollowUp?: string;
}

export interface SessionExtractionCandidates {
  fears: DetectedFear[];
  hopes: DetectedHope[];
  triggers: DetectedTrigger[];
  schemaTendencies: DetectedSchemaTendency[];
  modeTendencies: DetectedModeTendency[];
}

export interface LogsRoutingAuditEntry {
  auditId: string;
  sessionId: string;
  persona: RecoFreePersona;
  timestampIso: string;
  sourceSummaryId: string;
  routedToUserDat: string[];
  routedToStateDat: string[];
  routedToProjectionsDat: string[];
  skippedCandidates: Array<{
    candidateType: "fear" | "hope" | "trigger" | "schema" | "mode";
    label: string;
    reason: string;
  }>;
  errors: Array<{
    targetLayer: MemoryLayerName;
    message: string;
  }>;
}

export interface LogsDatEncryptedEnvelope {
  schemaVersion: "logs.dat.encrypted.v2";
  persona: RecoFreePersona;
  encryption: {
    algorithm: "AES-256-GCM";
    keyAlias: string;
    ivBase64: string;
    authTagBase64: string;
    createdAt: string;
  };
  ciphertextBase64: string;
  updatedAt: string;
}

export function createEmptyLogsDat(persona: RecoFreePersona): LogsDatPlaintext {
  const now = LocalDeviceTimeService.now().utcIso;
  return {
    schemaVersion: "logs.dat.v2",
    persona,
    createdAt: now,
    updatedAt: now,
    sessions: [],
    routingAudits: [],
  };
}
