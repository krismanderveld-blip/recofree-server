/**
 * Balkmetafoor — Draaglast/Draagkracht balance bar
 * Profile feature types
 */

export interface BalkmetafoorEntry {
  id: string;
  text: string;
  addedAt: string;
  sourceModuleId: "PAAL01" | "manual";
}

export interface BalkmetafoorData {
  initialized: boolean;
  initializedAt: string | null;
  lastUpdatedAt: string | null;
  draaglast: BalkmetafoorEntry[];
  draagkracht: BalkmetafoorEntry[];
}

/**
 * Visual balance state derived from entry counts.
 * NOT a score — purely qualitative visual indicator.
 */
export type BalkmetafoorVisualState =
  | "BALANCED"
  | "LEANING_DRAAGLAST"
  | "LEANING_DRAAGKRACHT"
  | "EMPTY";

/**
 * Derives the visual state from balkmetafoor data.
 * No numeric scoring — just relative comparison.
 */
export function deriveBalkmetafoorVisualState(
  data: BalkmetafoorData
): BalkmetafoorVisualState {
  if (!data.initialized) return "EMPTY";
  if (data.draaglast.length === 0 && data.draagkracht.length === 0) return "EMPTY";
  if (data.draaglast.length > data.draagkracht.length) return "LEANING_DRAAGLAST";
  if (data.draagkracht.length > data.draaglast.length) return "LEANING_DRAAGKRACHT";
  return "BALANCED";
}

/**
 * Creates empty initial balkmetafoor data.
 */
export function createEmptyBalkmetafoor(): BalkmetafoorData {
  return {
    initialized: false,
    initializedAt: null,
    lastUpdatedAt: null,
    draaglast: [],
    draagkracht: [],
  };
}
