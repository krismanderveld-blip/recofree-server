/**
 * PAR01 Storage — Generates user.dat patch for parentification tracking
 */

import type { PAR01Detection, PAR01StoragePatch } from './par01-types';

export function buildPAR01StoragePatch(
  detection: PAR01Detection,
  existingDetections: PAR01Detection[],
  existingSessionCount: number
): PAR01StoragePatch {
  const updatedDetections = [...existingDetections, detection].slice(-20); // Keep last 20

  return {
    par01Detections: updatedDetections,
    par01Phase: detection.phase,
    par01SessionCount: existingSessionCount + 1,
    par01LastActive: detection.timestamp,
  };
}
