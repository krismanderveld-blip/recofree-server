/**
 * BackpackEntityExtractor — Hash Utilities
 *
 * Computes content hashes for backpack sections to detect changes.
 * Uses a simple string-based hash (djb2) for fast local comparison.
 * No crypto dependency needed — this is for change detection, not security.
 */

import type { BackpackHashState, BackpackSectionHash } from './types';
import type { Backpack } from '../ai/types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── DJB2 Hash ─────────────────────────────────────────────────

/**
 * Fast string hash (djb2 algorithm).
 * Produces a hex string for easy comparison.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── Compute Section Hashes ────────────────────────────────────

/**
 * Compute hashes for all backpack sections (Elias life-phase + Kim backpack + intake).
 */
export function computeBackpackHash(backpack: Backpack): BackpackHashState {
  const now = LocalDeviceTimeService.now().utcIso;
  const sectionHashes: BackpackSectionHash[] = [];

  // Elias life-phase sections
  for (const section of backpack.sections) {
    if (section.content && section.content.trim().length > 0) {
      sectionHashes.push({
        sectionId: section.id,
        hash: djb2Hash(section.content.trim()),
        computedAt: now,
      });
    }
  }

  // Kim backpack sections
  if (backpack.kimBackpack) {
    const kimKeys: Array<keyof NonNullable<Backpack['kimBackpack']>> = [
      'my_story', 'the_relationship', 'the_impact', 'my_boundaries', 'my_strength',
    ];
    for (const key of kimKeys) {
      const content = backpack.kimBackpack[key];
      if (content && content.trim().length > 0) {
        sectionHashes.push({
          sectionId: `kim_${key}`,
          hash: djb2Hash(content.trim()),
          computedAt: now,
        });
      }
    }
  }

  // Intake context
  if (backpack.intakeContext.initialContext && backpack.intakeContext.initialContext.trim().length > 0) {
    sectionHashes.push({
      sectionId: 'intake_context',
      hash: djb2Hash(backpack.intakeContext.initialContext.trim()),
      computedAt: now,
    });
  }

  // Combined hash = hash of all individual hashes concatenated
  const combinedInput = sectionHashes.map(s => s.hash).sort().join('|');
  const combinedHash = djb2Hash(combinedInput);

  return {
    sections: sectionHashes,
    combinedHash,
    computedAt: now,
  };
}

// ─── Compare Hashes ────────────────────────────────────────────

/**
 * Quick check: has the backpack changed since last extraction?
 * Returns true if ANY section changed (or if no previous hash exists).
 */
export function hasBackpackChanged(
  currentHash: BackpackHashState,
  previousHash: BackpackHashState | null
): boolean {
  if (!previousHash) return true;
  return currentHash.combinedHash !== previousHash.combinedHash;
}

/**
 * Detailed check: which sections changed?
 * Returns section IDs that have new or modified content.
 */
export function getChangedSections(
  currentHash: BackpackHashState,
  previousHash: BackpackHashState | null
): string[] {
  if (!previousHash) {
    return currentHash.sections.map(s => s.sectionId);
  }

  const previousMap = new Map(previousHash.sections.map(s => [s.sectionId, s.hash]));
  const changed: string[] = [];

  for (const section of currentHash.sections) {
    const prevHash = previousMap.get(section.sectionId);
    if (!prevHash || prevHash !== section.hash) {
      changed.push(section.sectionId);
    }
  }

  return changed;
}
