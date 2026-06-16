/**
 * Overwhelm Signal Detector
 *
 * Detects OVERWHELMED_ORANGE_RED state:
 * - High craving (>= 7)
 * - Relapse intent language
 * - Panic/shutdown markers
 * - Safety flags from immutable core
 * - Dysregulation signals
 *
 * Score >= 5 indicates OVERWHELMED_ORANGE_RED.
 */

import type {
  VspMoodSlidersSnapshot,
  VspChatSignalSnapshot,
  ImmutableSafetyCoreSnapshot,
} from "./vspInsightTypes";

export interface DetectOverwhelmInput {
  mood: VspMoodSlidersSnapshot;
  chatSignals: VspChatSignalSnapshot;
  immutableCore: ImmutableSafetyCoreSnapshot;
}

export interface DetectOverwhelmResult {
  score: number;
  reasons: string[];
}

// NL markers for overwhelm/panic/shutdown
const OVERWHELM_MARKERS_NL = [
  "ik kan niet meer", "te veel", "overspoeld", "paniek", "ik stik",
  "ik ga stuk", "ik breek", "ik houd het niet vol", "alles is zwart",
  "ik wil stoppen", "ik wil weg", "het houdt niet op", "ik verdwijn",
  "ik voel niets meer", "dichtklappen", "bevriezen", "verlamd",
  "op springen", "exploderen", "ik ga door het lint",
];

const CRAVING_MARKERS_NL = [
  "ik wil gebruiken", "zucht", "trek", "craving", "ik moet scoren",
  "ik ga bellen", "ik wil drinken", "ik wil een pil", "ik wil roken",
  "ik ga het doen", "de verleiding", "ik kan niet weerstaan",
  "het trekt", "mijn lichaam schreeuwt", "ik heb het nodig",
];

const SHUTDOWN_MARKERS_NL = [
  "ik voel niets", "leeg", "dood van binnen", "afwezig", "weg",
  "er niet zijn", "verdoofd", "numb", "uitgeschakeld", "afgesloten",
];

export function detectOverwhelmSignals(
  input: DetectOverwhelmInput
): DetectOverwhelmResult {
  const { mood, chatSignals, immutableCore } = input;
  let score = 0;
  const reasons: string[] = [];

  // ─── Safety core flags (immediate overwhelm) ──────────────────────────────
  if (immutableCore.crisisDetected) {
    score += 5;
    reasons.push("Crisis detected by immutable core");
  }
  if (immutableCore.relapseIntentDetected) {
    score += 4;
    reasons.push("Relapse intent detected by immutable core");
  }
  if (chatSignals.safetyFlags.acuteDangerDetected) {
    score += 5;
    reasons.push("Acute danger detected");
  }
  if (chatSignals.safetyFlags.suicideSelfHarmDetected) {
    score += 5;
    reasons.push("Suicide/self-harm detected");
  }

  // ─── High craving ────────────────────────────────────────────────────────
  if (mood.craving >= 8) {
    score += 3;
    reasons.push(`Very high craving (${mood.craving})`);
  } else if (mood.craving >= 7) {
    score += 2;
    reasons.push(`High craving (${mood.craving})`);
  } else if (mood.craving >= 5) {
    score += 1;
    reasons.push(`Moderate craving (${mood.craving})`);
  }

  // ─── High frustration + despondency compound ──────────────────────────────
  if (mood.frustration >= 7 && mood.despondency >= 7) {
    score += 2;
    reasons.push(`High frustration (${mood.frustration}) + despondency (${mood.despondency})`);
  } else if (mood.frustration >= 6 || mood.despondency >= 7) {
    score += 1;
    reasons.push(`Elevated distress (frustration: ${mood.frustration}, despondency: ${mood.despondency})`);
  }

  // ─── Chat overwhelm markers ──────────────────────────────────────────────
  const overwhelmCount = chatSignals.overwhelmMarkers.length;
  if (overwhelmCount >= 3) {
    score += 3;
    reasons.push(`Multiple overwhelm markers (${overwhelmCount})`);
  } else if (overwhelmCount >= 1) {
    score += overwhelmCount;
    reasons.push(`Overwhelm markers present (${overwhelmCount})`);
  }

  // ─── Craving markers in chat ──────────────────────────────────────────────
  const cravingCount = chatSignals.cravingMarkers.length;
  if (cravingCount >= 2) {
    score += 2;
    reasons.push(`Craving language present (${cravingCount})`);
  } else if (cravingCount >= 1) {
    score += 1;
    reasons.push(`Craving marker detected (${cravingCount})`);
  }

  // ─── Relapse intent markers ───────────────────────────────────────────────
  const relapseCount = chatSignals.relapseIntentMarkers.length;
  if (relapseCount >= 1) {
    score += 2;
    reasons.push(`Relapse intent markers (${relapseCount})`);
  }

  // ─── Zone escalation from core ────────────────────────────────────────────
  if (
    immutableCore.finalZone === "ROOD" ||
    immutableCore.finalZone === "PAARS"
  ) {
    score += 2;
    reasons.push(`Core final zone is ${immutableCore.finalZone}`);
  } else if (immutableCore.finalZone === "ORANJE") {
    score += 1;
    reasons.push("Core final zone is ORANJE");
  }

  return { score, reasons };
}

/**
 * Utility: extract overwhelm markers from raw message text.
 * Used by chat signal adapter.
 */
export function extractOverwhelmMarkers(messageText: string): string[] {
  const lower = messageText.toLowerCase();
  const found: string[] = [];

  for (const marker of OVERWHELM_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }
  for (const marker of CRAVING_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }
  for (const marker of SHUTDOWN_MARKERS_NL) {
    if (lower.includes(marker)) found.push(marker);
  }

  return found;
}
