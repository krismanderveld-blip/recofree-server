/**
 * Rational Green Signal Detector
 *
 * Detects when user reports "green" but language shows:
 * - Over-explanation / intellectualizing
 * - Detachment from feeling
 * - Control-focused language
 * - Absence of embodied emotion words
 *
 * Score >= 4 indicates RATIONAL_GREEN state.
 */

import type {
  VspMoodSlidersSnapshot,
  VspChatSignalSnapshot,
} from "./vspInsightTypes";

export interface DetectRationalGreenInput {
  mood: VspMoodSlidersSnapshot;
  chatSignals: VspChatSignalSnapshot;
}

export interface DetectRationalGreenResult {
  score: number;
  reasons: string[];
}

// NL markers for rationality/detachment
const RATIONAL_MARKERS_NL = [
  "objectief", "logisch", "rationeel", "eigenlijk", "feitelijk",
  "onder controle", "geen probleem", "niets aan de hand", "ik begrijp",
  "het is wat het is", "ik snap", "dat klopt", "gewoon", "simpelweg",
  "uiteraard", "vanzelfsprekend", "in principe", "theoretisch",
  "als je het zo bekijkt", "puur", "analytisch", "functioneel",
];

const DETACHMENT_MARKERS_NL = [
  "maakt niet uit", "het is oké", "ik voel niets", "geen emotie",
  "ik sta erboven", "het raakt me niet", "ik ben er klaar mee",
  "niet belangrijk", "doet er niet toe", "maakt me niets uit",
  "ik heb er vrede mee", "het boeit me niet",
];

const CONTROL_MARKERS_NL = [
  "alles onder controle", "ik heb het in de hand", "ik manage het",
  "ik regel het", "ik los het op", "ik kan het aan", "geen hulp nodig",
  "ik red me wel", "ik hoef niets", "het lukt wel",
];

// Absence of feeling words (negative signal for real green)
const FEELING_WORDS_NL = [
  "voel", "voelen", "gevoel", "verdriet", "blij", "bang", "boos",
  "angstig", "warm", "koud", "pijn", "tranen", "huilen", "lachen",
  "ontroerd", "geraakt", "kwetsbaar", "teder", "zacht", "hart",
  "buik", "lichaam", "adem", "trillen", "rillen",
];

export function detectRationalGreenSignals(
  input: DetectRationalGreenInput
): DetectRationalGreenResult {
  const { mood, chatSignals } = input;
  let score = 0;
  const reasons: string[] = [];

  // ─── Rationality markers from chat signals ────────────────────────────────
  const rationalCount = chatSignals.rationalityMarkers.length;
  if (rationalCount >= 3) {
    score += 3;
    reasons.push(`High rationality markers (${rationalCount})`);
  } else if (rationalCount >= 1) {
    score += rationalCount;
    reasons.push(`Rationality markers present (${rationalCount})`);
  }

  // ─── Avoidance markers ────────────────────────────────────────────────────
  const avoidanceCount = chatSignals.avoidanceMarkers.length;
  if (avoidanceCount >= 2) {
    score += 2;
    reasons.push(`Avoidance markers present (${avoidanceCount})`);
  } else if (avoidanceCount >= 1) {
    score += 1;
    reasons.push(`Mild avoidance (${avoidanceCount})`);
  }

  // ─── Absence of emotional connection ──────────────────────────────────────
  const emotionalConnectionCount = chatSignals.emotionalConnectionMarkers.length;
  const embodiedCount = chatSignals.embodiedEmotionMarkers.length;
  if (emotionalConnectionCount === 0 && embodiedCount === 0) {
    score += 2;
    reasons.push("No emotional connection or embodied emotion markers");
  }

  // ─── High focus slider (over-control indicator) ───────────────────────────
  if (mood.focus >= 8) {
    score += 1;
    reasons.push(`High focus (${mood.focus}) suggests over-control`);
  }

  // ─── Low craving + low frustration + low despondency = "everything fine" ─
  if (mood.craving <= 2 && mood.frustration <= 2 && mood.despondency <= 2 && mood.focus >= 7) {
    score += 1;
    reasons.push("All-low mood with high focus: possible over-controlled presentation");
  }

  return { score, reasons };
}

/**
 * Utility: check raw message text for rational green markers.
 * Used by chat signal adapter to populate rationalityMarkers.
 */
export function extractRationalGreenMarkers(messageText: string): string[] {
  const lower = messageText.toLowerCase();
  const found: string[] = [];

  for (const marker of RATIONAL_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }
  for (const marker of DETACHMENT_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }
  for (const marker of CONTROL_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }

  return found;
}

/**
 * Utility: check if message lacks feeling words (supports rational green detection).
 */
export function messageLacksFeelingWords(messageText: string): boolean {
  const lower = messageText.toLowerCase();
  return !FEELING_WORDS_NL.some((word) => lower.includes(word));
}
