import { stableHash } from "./stableHash";

/**
 * Create a deterministic patch ID from turn context.
 */
export function createPatchId(turnId: string, layer: string, path: string): string {
  return `patch_${stableHash(`${turnId}|${layer}|${path}`)}`;
}
