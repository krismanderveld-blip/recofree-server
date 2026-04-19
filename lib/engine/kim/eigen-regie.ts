/**
 * Kim Eigen Regie — 5-Step Model
 *
 * Implements the complete Eigen Regie system for Kim users:
 *
 * 1. INPUT: Daily reflection question — percentage 0–100
 *    "In hoeverre werd jouw dag vandaag bepaald door de keuzes van de ander?"
 *    0 = volledig eigen regie, 100 = volledig bepaald door de ander
 *
 * 2. INTERNE SCORE: engineEigenRegieScore = 100 - userInput
 *    Hoge score = hoge eigen regie, lage score = lage eigen regie
 *    Geen averaging, geen smoothing, geen trends
 *
 * 3. ZONES: 5 niveaus gebaseerd op engineEigenRegieScore
 *
 * 4. BETEKENIS: Vaste tekst per zone (gebaseerd op user ervaring)
 *
 * 5. ENGINE IMPACT: Kim gedrag per zone
 *
 * REGELS:
 * - UI toont userInput (niet omgekeerde waarde)
 * - Engine werkt met engineEigenRegieScore
 * - Geen logica buiten Kim engine
 * - Geen combinatie met andere systemen
 * - Geen inferentie
 * - Geen fallback
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
  /** Fixed meaning text for this zone (Dutch, based on user experience). */
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
 * Fixed meaning per zone. Based on user experience (Dutch).
 * These texts do not change. No interpolation. No inference.
 */
const ZONE_MEANINGS: Readonly<Record<EigenRegieZone, string>> = Object.freeze({
  ROOD: 'Ik was volledig gefocust op de ander. Ik voelde me verantwoordelijk voor zijn/haar gedrag.',
  ORANJE: 'Ik was grotendeels bezig met de ander. Mijn eigen behoeften kwamen weinig aan bod.',
  GEEL: 'Ik was veel met de ander bezig, maar heb ook even aan mezelf gedacht.',
  LICHTGROEN: 'Ik hield rekening met de ander, maar bleef ook bij mezelf.',
  GROEN: 'Ik heb mijn eigen plan getrokken. Ik voelde me vrij, ongeacht wat de ander deed.',
});

export function getEigenRegieMeaning(zone: EigenRegieZone): string {
  return ZONE_MEANINGS[zone];
}

// ─── Step 5: Engine Impact ──────────────────────────────────

/**
 * Kim behavior directives per zone.
 * These directly impact how Kim responds.
 *
 * ROOD:       stabiliseren, geen confrontatie
 * ORANJE:     bewustmaken, lichte reflectie
 * GEEL:       inzicht verdiepen, zachte spiegeling
 * LICHTGROEN: versterken, kleine richting geven
 * GROEN:      autonomie, uitdaging mogelijk
 */
const ZONE_IMPACTS: Readonly<Record<EigenRegieZone, EigenRegieImpact>> = Object.freeze({
  ROOD: Object.freeze({
    primaryDirective: 'stabiliseren',
    secondaryDirective: 'geen confrontatie',
  }),
  ORANJE: Object.freeze({
    primaryDirective: 'bewustmaken',
    secondaryDirective: 'lichte reflectie',
  }),
  GEEL: Object.freeze({
    primaryDirective: 'inzicht verdiepen',
    secondaryDirective: 'zachte spiegeling',
  }),
  LICHTGROEN: Object.freeze({
    primaryDirective: 'versterken',
    secondaryDirective: 'kleine richting geven',
  }),
  GROEN: Object.freeze({
    primaryDirective: 'autonomie',
    secondaryDirective: 'uitdaging mogelijk',
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

// ─── Reflection Question ────────────────────────────────────

/**
 * The daily reflection question shown to Kim users.
 * Single source of truth for the question text.
 */
export const EIGEN_REGIE_QUESTION = 'In hoeverre werd jouw dag vandaag bepaald door de keuzes van de ander?' as const;

/**
 * Labels for the slider extremes shown in UI.
 * UI displays userInput (0 = eigen regie, 100 = bepaald door ander).
 */
export const EIGEN_REGIE_SLIDER_LABELS = Object.freeze({
  min: 'Volledig eigen regie',
  max: 'Volledig bepaald door de ander',
} as const);
