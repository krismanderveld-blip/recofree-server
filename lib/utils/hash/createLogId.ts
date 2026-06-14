import { stableHash } from "./stableHash";

/**
 * Create a deterministic log/audit ID.
 */
export function createLogId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${stableHash(parts.join("|")).slice(0, 16)}`;
}
