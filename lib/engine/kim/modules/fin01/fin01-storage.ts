/**
 * FIN01 Storage — Generates user.dat patch for financial control/dependency tracking
 */

import type { FIN01Detection, FIN01StoragePatch } from './fin01-types';

export function buildFIN01StoragePatch(
  detection: FIN01Detection,
  existingDetections: FIN01Detection[],
  existingSessionCount: number
): FIN01StoragePatch {
  const updatedDetections = [...existingDetections, detection].slice(-20); // Keep last 20

  return {
    fin01Detections: updatedDetections,
    fin01Phase: detection.phase,
    fin01SessionCount: existingSessionCount + 1,
    fin01LastActive: detection.timestamp,
  };
}
