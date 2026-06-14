/**
 * Projection decay and reinforcement logic.
 */
import type { ProjectionRecord, ProjectionDecayConfig } from "@/lib/types/memory/projectionsDat.types";
import { roundTo3 } from "@/lib/utils/math/roundTo3";

/**
 * Apply time-based exponential decay to a projection record.
 */
export function applyProjectionDecay(
  record: ProjectionRecord,
  nowIso: string,
  config: ProjectionDecayConfig
): ProjectionRecord {
  const last = new Date(record.lastReinforcedAt).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(last) || Number.isNaN(now) || now <= last) return record;

  const elapsedDays = (now - last) / (24 * 60 * 60 * 1000);
  const decayFactor = Math.pow(0.5, elapsedDays / record.decayHalfLifeDays);
  const decayedScore = Math.max(
    config.minimumScore,
    roundTo3(record.currentScore * decayFactor)
  );

  return { ...record, currentScore: decayedScore };
}

/**
 * Reinforce a projection score after decay has been applied.
 */
export function reinforceProjectionScore(
  decayedScore: number,
  confidence: number,
  config: ProjectionDecayConfig
): number {
  return roundTo3(
    Math.min(config.maxScore, decayedScore + config.reinforcementBoost * confidence)
  );
}
