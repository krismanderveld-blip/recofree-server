/**
 * projections.dat — Future-oriented emotional projections with decay.
 */
import type { RecoFreePersona, MemorySource } from "./memoryCore.types";

export interface ProjectionsDat {
  schemaVersion: "projections.dat.v2";
  persona: RecoFreePersona;
  fears: ProjectionRecord[];
  hopes: ProjectionRecord[];
  decayConfig: ProjectionDecayConfig;
  updatedAt: string;
}

export interface ProjectionRecord {
  projectionId: string;
  kind: "fear" | "hope";
  label: string;
  normalizedLabel: string;
  category: string;
  currentScore: number;
  baseConfidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastReinforcedAt: string;
  decayHalfLifeDays: number;
  reinforcementCount: number;
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

export interface ProjectionDecayConfig {
  fearHalfLifeDays: number;
  hopeHalfLifeDays: number;
  minimumScore: number;
  reinforcementBoost: number;
  maxScore: number;
  dormantBelowScore: number;
  pruneBelowScoreAfterDays: number;
}

export const DEFAULT_PROJECTION_DECAY_CONFIG: ProjectionDecayConfig = {
  fearHalfLifeDays: 21,
  hopeHalfLifeDays: 30,
  minimumScore: 0.05,
  reinforcementBoost: 0.12,
  maxScore: 1.0,
  dormantBelowScore: 0.08,
  pruneBelowScoreAfterDays: 120,
};

export function createEmptyProjectionsDat(persona: RecoFreePersona): ProjectionsDat {
  const now = new Date().toISOString();
  return {
    schemaVersion: "projections.dat.v2",
    persona,
    fears: [],
    hopes: [],
    decayConfig: { ...DEFAULT_PROJECTION_DECAY_CONFIG },
    updatedAt: now,
  };
}
