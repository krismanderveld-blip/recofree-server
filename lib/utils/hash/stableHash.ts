/**
 * Deterministic stable hash for memory record IDs.
 * Uses a simple FNV-1a 32-bit hash converted to hex.
 * Not cryptographic — only for deduplication keys.
 */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // Convert to unsigned 32-bit then hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}
