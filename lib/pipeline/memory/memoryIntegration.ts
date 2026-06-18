/**
 * Memory Integration — Bridges the existing pipeline results to the Memory Write Routing system.
 * Provides a singleton lifecycle manager and helper to build PipelineDetectionBundle from pipeline output.
 */
import type {
  PipelineDetectionBundle,
  PipelineTurnContext,
  DetectedFear,
  DetectedHope,
  DetectedTrigger,
  DetectedSchemaTendency,
  DetectedModeTendency,
  MoodStateExtraction,
  ZoneDecision,
  ActiveModuleDecision,
  RecoFreePersona,
} from "@/lib/types/memory/memoryCore.types";
import type { MemoryStoresSnapshot } from "./memoryCommitService";
import type { MemoryWriteBackOutput } from "./memoryWriteBackStep";
import { executeMemoryWriteBack } from "./memoryWriteBackStep";
import { createSessionLifecycleManager, type SessionLifecycleManager } from "./sessionLifecycle";
import { stableHash } from "@/lib/utils/hash/stableHash";

// ─── Singleton Lifecycle Manager ─────────────────────────────────────────────
let _lifecycleManager: SessionLifecycleManager | null = null;

export function getSessionLifecycleManager(): SessionLifecycleManager {
  if (!_lifecycleManager) {
    _lifecycleManager = createSessionLifecycleManager();
  }
  return _lifecycleManager;
}

// ─── Detection Bundle Builder ────────────────────────────────────────────────

export interface PipelineResultForMemory {
  /** User message text (post-preprocessing) */
  userMessage: string;
  /** Persona (elias or kim) */
  persona: RecoFreePersona;
  /** Session ID */
  sessionId: string;
  /** Local user ID */
  localUserId: string;
  /** Candidate signals from GptSignalEngine (fears/hopes/goals/triggers) */
  candidateSignals?: {
    fears: Array<{ label: string; confidence: number; category?: string }>;
    hopes: Array<{ label: string; confidence: number; category?: string }>;
    goals: Array<{ label: string; confidence: number }>;
    triggers: Array<{ label: string; confidence: number; triggerType?: string }>;
  } | null;
  /** Schema/mode detection results */
  schemaModeResult?: {
    activated: boolean;
    modeDecision: {
      acceptedModes: ReadonlyArray<{ modeId: string; confidence: number; modeName?: string }>;
      dominantMode: string | null;
    };
    schemaDecision: {
      acceptedSchemas: ReadonlyArray<{ schemaId: string; confidence: number; domain?: string; schemaName?: string }>;
      dominantSchema: string | null;
      dominantDomain: string | null;
    };
  } | null;
  /** Buffer snapshot with zone info */
  bufferSnapshot?: {
    zoneColor: string;
    zoneScore: number;
  } | null;
  /** Active module from pipeline */
  activeModule?: {
    moduleId: string;
    confidence: number;
    responseMode: string;
  } | null;
  /** Current mood sliders */
  moodSliders?: Record<string, number> | null;
  /** Module activations from pipeline */
  moduleActivations?: Array<{ id: string; confidence: number; mode: string }>;
  /** PsychoEducation activation from pipeline */
  psychoEducationActivation?: import('@/lib/types/memory/memoryCore.types').PsychoEducationActivation | null;
}

/**
 * Build a PipelineDetectionBundle from the pipeline result.
 * Maps existing pipeline output fields to the memory write routing types.
 */
export function buildDetectionBundle(input: PipelineResultForMemory): PipelineDetectionBundle {
  const now = new Date().toISOString();
  const inputHash = stableHash(input.userMessage);

  const context: PipelineTurnContext = {
    turnId: `turn_${Date.now()}_${inputHash.slice(0, 6)}`,
    sessionId: input.sessionId || `session_${Date.now()}`,
    localUserId: input.localUserId || "local_user",
    persona: input.persona,
    timestampIso: now,
    appVersion: "1.0.0",
    pipelineVersion: "2.0.0",
    inputHash,
    language: "nl",
  };

  // Map fears from candidateSignals
  const fears: DetectedFear[] = (input.candidateSignals?.fears ?? []).map((f) => ({
    label: f.label,
    normalizedLabel: f.label.toLowerCase().trim(),
    category: (f.category as DetectedFear["category"]) || "unknown",
    confidence: f.confidence,
    sourceKind: "explicit_user_text" as const,
    evidenceHash: stableHash(f.label),
  }));

  // Map hopes from candidateSignals
  const hopes: DetectedHope[] = (input.candidateSignals?.hopes ?? []).map((h) => ({
    label: h.label,
    normalizedLabel: h.label.toLowerCase().trim(),
    category: (h.category as DetectedHope["category"]) || "unknown",
    confidence: h.confidence,
    sourceKind: "explicit_user_text" as const,
    evidenceHash: stableHash(h.label),
  }));

  // Map triggers from candidateSignals
  const triggers: DetectedTrigger[] = (input.candidateSignals?.triggers ?? []).map((t) => ({
    label: t.label,
    normalizedTrigger: t.label.toLowerCase().trim(),
    triggerType: (t.triggerType as DetectedTrigger["triggerType"]) || "unknown",
    confidence: t.confidence,
    sourceKind: "explicit_user_text" as const,
    evidenceHash: stableHash(t.label),
  }));

  // Map schema tendencies from schemaModeResult
  const schemaTendencies: DetectedSchemaTendency[] = [];
  if (input.schemaModeResult?.activated && input.schemaModeResult.schemaDecision.acceptedSchemas) {
    for (const s of input.schemaModeResult.schemaDecision.acceptedSchemas) {
      schemaTendencies.push({
        schemaId: s.schemaId,
        schemaName: s.schemaName || s.schemaId,
        confidence: s.confidence,
        sourceKind: "schema_mode_engine",
        evidenceHash: stableHash(s.schemaId),
      });
    }
  }

  // Map mode tendencies from schemaModeResult
  const modeTendencies: DetectedModeTendency[] = [];
  if (input.schemaModeResult?.activated && input.schemaModeResult.modeDecision.acceptedModes) {
    for (const m of input.schemaModeResult.modeDecision.acceptedModes) {
      modeTendencies.push({
        modeId: m.modeId,
        modeName: m.modeName || m.modeId,
        confidence: m.confidence,
        sourceKind: "schema_mode_engine",
        evidenceHash: stableHash(m.modeId),
      });
    }
  }

  // Map mood state from sliders
  let moodState: MoodStateExtraction | null = null;
  if (input.moodSliders && Object.keys(input.moodSliders).length > 0) {
    moodState = {
      ...input.moodSliders,
      sourceKind: "slider_ui",
      confidence: 0.95,
    } as MoodStateExtraction;
  }

  // Map zone decision
  let zoneDecision: ZoneDecision | null = null;
  if (input.bufferSnapshot) {
    const zoneMap: Record<string, ZoneDecision["zone"]> = {
      GREEN: "GREEN", GROEN: "GREEN",
      YELLOW: "YELLOW", GEEL: "YELLOW",
      ORANGE: "ORANGE", ORANJE: "ORANGE",
      RED: "RED", ROOD: "RED",
      PURPLE: "PURPLE", PAARS: "PURPLE",
    };
    zoneDecision = {
      zone: zoneMap[input.bufferSnapshot.zoneColor?.toUpperCase()] || "UNKNOWN",
      zoneNumeric: input.bufferSnapshot.zoneScore,
      confidence: 0.9,
      sourceKind: "VSPZone_6e",
    };
  }

  // Map active module
  let activeModule: ActiveModuleDecision | null = null;
  if (input.activeModule) {
    activeModule = {
      moduleId: input.activeModule.moduleId,
      persona: input.persona,
      responseMode: input.activeModule.responseMode,
      confidence: input.activeModule.confidence,
    };
  } else if (input.moduleActivations && input.moduleActivations.length > 0) {
    const first = input.moduleActivations[0];
    activeModule = {
      moduleId: first.id,
      persona: input.persona,
      responseMode: first.mode,
      confidence: first.confidence,
    };
  }

  return {
    context,
    fears,
    hopes,
    triggers,
    schemaTendencies,
    modeTendencies,
    moodState,
    zoneDecision,
    activeModule,
    psychoEducationActivation: input.psychoEducationActivation ?? null,
  };
}

// ─── In-Memory Stores for Current Session ────────────────────────────────────

/**
 * Run the memory write-back step with the current in-memory stores.
 * Returns the debug log string and updated stores.
 */
export function runMemoryWriteBack(
  bundle: PipelineDetectionBundle,
  stores: MemoryStoresSnapshot
): MemoryWriteBackOutput {
  return executeMemoryWriteBack({
    detectionBundle: bundle,
    currentStores: stores,
  });
}
