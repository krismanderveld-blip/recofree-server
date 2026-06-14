/**
 * Deterministic merge functions for projections.dat layer.
 */
import type {
  ProjectionsDat,
  ProjectionRecord,
  ProjectionDecayConfig,
} from "@/lib/types/memory/projectionsDat.types";
import type { MemorySource } from "@/lib/types/memory/memoryCore.types";
import { stableHash } from "@/lib/utils/hash/stableHash";
import { roundTo3 } from "@/lib/utils/math/roundTo3";
import { clamp } from "@/lib/utils/math/clamp";
import { applyProjectionDecay, reinforceProjectionScore } from "./projectionDecay";

const MAX_SOURCES = 20;

export interface ProjectionMergePayload {
  kind: "fear" | "hope";
  label: string;
  normalizedLabel: string;
  category: string;
  confidence: number;
  sourceKind: "explicit_user_text" | "pattern_inference" | "session_summary";
  turnId?: string;
  sessionId: string;
  timestampIso: string;
  source: MemorySource;
  evidenceHash?: string;
}

/**
 * Merge a projection (fear or hope) into projections.dat.
 * Key: kind + normalizedLabel + category
 * Always applies decay before reinforcement.
 */
export function mergeProjectionRecord(
  projDat: ProjectionsDat,
  payload: ProjectionMergePayload
): ProjectionsDat {
  const config = projDat.decayConfig;
  const list = payload.kind === "fear" ? projDat.fears : projDat.hopes;
  const key = `${payload.kind}|${payload.normalizedLabel}|${payload.category}`;

  const existing = list.find(
    (p) => `${p.kind}|${p.normalizedLabel}|${p.category}` === key
  );

  const sourceEntry = {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    timestampIso: payload.timestampIso,
    source: payload.source,
    confidence: payload.confidence,
    evidenceHash: payload.evidenceHash,
  };

  if (existing) {
    // Apply decay first
    const decayed = applyProjectionDecay(existing, payload.timestampIso, config);
    // Reinforce
    const newScore = reinforceProjectionScore(decayed.currentScore, payload.confidence, config);

    const updated: ProjectionRecord = {
      ...decayed,
      currentScore: newScore,
      baseConfidence: Math.max(existing.baseConfidence, payload.confidence),
      lastSeenAt: payload.timestampIso,
      lastReinforcedAt: payload.timestampIso,
      reinforcementCount: existing.reinforcementCount + 1,
      sourceCounts: {
        ...existing.sourceCounts,
        [payload.sourceKind]: (existing.sourceCounts[payload.sourceKind] || 0) + 1,
      },
      sources: [...existing.sources, sourceEntry].slice(-MAX_SOURCES),
    };

    const updatedList = list.map((p) =>
      `${p.kind}|${p.normalizedLabel}|${p.category}` === key ? updated : p
    );

    return {
      ...projDat,
      ...(payload.kind === "fear" ? { fears: updatedList } : { hopes: updatedList }),
      updatedAt: payload.timestampIso,
    };
  }

  // New projection
  const halfLife = payload.kind === "fear" ? config.fearHalfLifeDays : config.hopeHalfLifeDays;
  const newRecord: ProjectionRecord = {
    projectionId: `${payload.kind}_${stableHash(`${payload.normalizedLabel}|${payload.category}`).slice(0, 16)}`,
    kind: payload.kind,
    label: payload.label,
    normalizedLabel: payload.normalizedLabel,
    category: payload.category,
    currentScore: clamp(payload.confidence, config.minimumScore, config.maxScore),
    baseConfidence: payload.confidence,
    firstSeenAt: payload.timestampIso,
    lastSeenAt: payload.timestampIso,
    lastReinforcedAt: payload.timestampIso,
    decayHalfLifeDays: halfLife,
    reinforcementCount: 1,
    sourceCounts: {
      explicit_user_text: payload.sourceKind === "explicit_user_text" ? 1 : 0,
      pattern_inference: payload.sourceKind === "pattern_inference" ? 1 : 0,
      session_summary: payload.sourceKind === "session_summary" ? 1 : 0,
    },
    sources: [sourceEntry],
  };

  const newList = [...list, newRecord];

  return {
    ...projDat,
    ...(payload.kind === "fear" ? { fears: newList } : { hopes: newList }),
    updatedAt: payload.timestampIso,
  };
}
