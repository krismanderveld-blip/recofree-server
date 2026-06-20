/**
 * Kim Eigen Regie — 5-Step Model
 *
 * Implements the complete Eigen Regie system for Kim users:
 *
 * 1. INPUT: Daily reflection question — percentage 0–100
 *    "To what extent was your day determined by the other person's choices?"
 *    0 = full self-direction, 100 = fully determined by the other
 *
 * 2. INTERNAL SCORE: engineEigenRegieScore = 100 - userInput
 *    High score = high self-direction, low score = low self-direction
 *    No averaging, no smoothing, no trends
 *
 * 3. ZONES: 5 levels based on engineEigenRegieScore
 *
 * 4. MEANING: Fixed text per zone (based on user experience)
 *
 * 5. ENGINE IMPACT: Kim behavior per zone
 *
 * RULES:
 * - UI shows userInput (not inverted value)
 * - Engine works with engineEigenRegieScore
 * - No logic outside Kim engine
 * - No combination with other systems
 * - No inference
 * - No fallback
 */

// ─── Types ──────────────────────────────────────────────────

export type EigenRegieZone = 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';

export interface EigenRegieResult {
  /** The raw user input (0–100). UI displays this value. */
  readonly userInput: number;
  /** The inverted engine score (100 - userInput). Engine uses this value. */
  readonly engineScore: number;
  /** The 5-level zone derived from engineScore. */
  readonly zone: EigenRegieZone;
  /** Fixed meaning text for this zone (based on user experience). */
  readonly meaning: string;
  /** Engine impact directives for Kim behavior in this zone. */
  readonly impact: EigenRegieImpact;
}

export interface EigenRegieImpact {
  /** Primary behavioral directive for Kim in this zone. */
  readonly primaryDirective: string;
  /** Secondary behavioral directive for Kim in this zone. */
  readonly secondaryDirective: string;
}

// ─── Step 2: Score Inversion ────────────────────────────────

/**
 * Convert user input to engine score.
 * engineEigenRegieScore = 100 - userInput
 *
 * No averaging. No smoothing. No trends.
 */
export function computeEigenRegieScore(userInput: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(userInput)));
  return 100 - clamped;
}

// ─── Step 3: Zone Mapping ───────────────────────────────────

/**
 * Map engineEigenRegieScore to one of 5 zones.
 *
 * 0–20   → ROOD
 * 21–40  → ORANJE
 * 41–60  → GEEL
 * 61–80  → LICHTGROEN
 * 81–100 → GROEN
 */
export function getEigenRegieZone(engineScore: number): EigenRegieZone {
  if (engineScore <= 20) return 'ROOD';
  if (engineScore <= 40) return 'ORANJE';
  if (engineScore <= 60) return 'GEEL';
  if (engineScore <= 80) return 'LICHTGROEN';
  return 'GROEN';
}

// ─── Step 4: Zone Meaning ───────────────────────────────────

/**
 * Fixed meaning per zone. Based on user experience.
 * These texts do not change. No interpolation. No inference.
 */
const ZONE_MEANINGS: Readonly<Record<EigenRegieZone, string>> = Object.freeze({
  ROOD: 'I was completely focused on the other person. I felt responsible for their behavior.',
  ORANJE: 'I was mostly occupied with the other person. My own needs barely came up.',
  GEEL: 'I was often thinking about the other person, but also thought about myself briefly.',
  LICHTGROEN: 'I considered the other person, but also stayed with myself.',
  GROEN: 'I followed my own plan. I felt free, regardless of what the other person did.',
});

export function getEigenRegieMeaning(zone: EigenRegieZone): string {
  return ZONE_MEANINGS[zone];
}

// ─── Step 5: Engine Impact ──────────────────────────────────

/**
 * Kim behavior directives per zone.
 * These directly impact how Kim responds.
 *
 * ROOD:       stabilize, no confrontation
 * ORANJE:     raise awareness, light reflection
 * GEEL:       deepen insight, gentle mirroring
 * LICHTGROEN: strengthen, give small direction
 * GROEN:      autonomy, challenge possible
 */
const ZONE_IMPACTS: Readonly<Record<EigenRegieZone, EigenRegieImpact>> = Object.freeze({
  ROOD: Object.freeze({
    primaryDirective: 'stabilize',
    secondaryDirective: 'no confrontation',
  }),
  ORANJE: Object.freeze({
    primaryDirective: 'raise awareness',
    secondaryDirective: 'light reflection',
  }),
  GEEL: Object.freeze({
    primaryDirective: 'deepen insight',
    secondaryDirective: 'gentle mirroring',
  }),
  LICHTGROEN: Object.freeze({
    primaryDirective: 'strengthen',
    secondaryDirective: 'give small direction',
  }),
  GROEN: Object.freeze({
    primaryDirective: 'autonomy',
    secondaryDirective: 'challenge possible',
  }),
});

export function getEigenRegieImpact(zone: EigenRegieZone): EigenRegieImpact {
  return ZONE_IMPACTS[zone];
}

// ─── Complete Pipeline ──────────────────────────────────────

/**
 * Process a single Eigen Regie user input through all 5 steps.
 *
 * Input:  userInput (0–100) — "how much was your day determined by the other's choices?"
 * Output: EigenRegieResult with score, zone, meaning, and impact
 *
 * This is the single entry point for Eigen Regie computation.
 * No logic outside this file. No inference. No fallback.
 */
export function processEigenRegie(userInput: number): EigenRegieResult {
  const engineScore = computeEigenRegieScore(userInput);
  const zone = getEigenRegieZone(engineScore);
  const meaning = getEigenRegieMeaning(zone);
  const impact = getEigenRegieImpact(zone);

  return {
    userInput: Math.max(0, Math.min(100, Math.round(userInput))),
    engineScore,
    zone,
    meaning,
    impact,
  };
}

// ─── UI Display Labels ─────────────────────────────────────

/**
 * Human-readable English labels for each zone.
 * Used in UI only — engine/pipeline always uses the internal zone keys.
 * When language selection is added later, this mapping can be swapped per locale
 * without touching the pipeline or modules.
 */
export const ZONE_DISPLAY_LABELS: Readonly<Record<EigenRegieZone, string>> = Object.freeze({
  ROOD: 'Red',
  ORANJE: 'Orange',
  GEEL: 'Yellow',
  LICHTGROEN: 'Light Green',
  GROEN: 'Green',
});

// ─── Reflection Question ────────────────────────────────────

/**
 * The daily reflection question shown to Kim users.
 * Single source of truth for the question text.
 */
export const EIGEN_REGIE_QUESTION = 'To what extent was your day today determined by the choices of the other person?' as const;

/**
 * Labels for the slider extremes shown in UI.
 * UI displays userInput (0 = full self-direction, 100 = fully determined by the other).
 */
export const EIGEN_REGIE_SLIDER_LABELS = Object.freeze({
  min: 'Full self-direction',
  max: 'Fully determined by the other',
} as const);
