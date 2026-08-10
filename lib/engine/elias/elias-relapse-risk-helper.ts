/**
 * ELIAS RELAPSE RISK HELPER
 *
 * Determines whether relapseRiskActive should be true for the guidance-depth-resolver.
 * Uses deterministic keyword/regex matching — same approach as relapse-intent-fallback.
 *
 * relapseRiskActive = true when:
 * - Explicit craving ("ik heb craving", "zware trek")
 * - Relapse intent ("ik wil drinken/gebruiken", "ik ga drinken")
 * - Imminent relapse ("ik sta op het punt", "ik kan niet meer weerstaan")
 * - High craving score (from slider, >= 4 on 0-5 or >= 7 on 0-10)
 * - Active relapse state (relapseActive flag)
 *
 * relapseRiskActive = false when:
 * - Reflecting on past relapse without current urge
 * - Psycho-educational question about addiction
 * - Kim persona (never applies)
 * - General stress without substance use signals
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EliasRelapseRiskInput {
  userMessage: string;
  persona: 'kim' | 'elias';
  cravingSliderValue?: number | null;
  relapseActive?: boolean;
  relapseIntentDetected?: boolean;
}

export interface EliasRelapseRiskResult {
  relapseRiskActive: boolean;
  reason: string;
}

// ─── Craving/Relapse Keywords ────────────────────────────────────────────────

const ACTIVE_CRAVING_PATTERNS: RegExp[] = [
  // NL — explicit craving/urge
  /\b(zware|sterke|hevige|intense)\s*(craving|trek|drang|zucht)\b/i,
  /\bik\s+heb\s+(zo'?n?\s+)?(craving|trek|drang|zucht)\b/i,
  /\bcraving\s+(is|wordt|komt)\s+(erg|sterk|hevig)\b/i,
  /\bik\s+wil\s+(weer\s+|zo\s+graag\s+|echt\s+|gewoon\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\b(ik\s+)?ga\s+(\w+\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\bdrang\s+(om\s+te\s+)?(gebruiken|drinken|roken)\b/i,
  /\bik\s+kan\s+(het\s+)?niet\s+(laten|weerstaan|stoppen)\b/i,
  /\bik\s+sta\s+op\s+het\s+punt\b/i,
  /\bik\s+moet\s+(iets\s+)?(gebruiken|drinken|roken|nemen)\b/i,
  /\bik\s+verlang\s+(er\s+)?(zo\s+)?naar\b/i,
  /\bterugval\s+(dreigt|voelt|komt)\b/i,
  /\bherval\s+(dreigt|voelt|komt)\b/i,
  /\bik\s+(voel|merk)\s+(de\s+)?(drang|trek|craving)\b/i,
  // EN — explicit craving/urge
  /\b(strong|intense|heavy|severe)\s*(craving|urge)\b/i,
  /\bi\s+(want|need)\s+to\s+(use|drink|smoke|get high|get drunk|take something)\b/i,
  /\bi('m|\s+am)\s+going\s+to\s+(use|drink|smoke|get high)\b/i,
  /\bi\s+can'?t\s+resist\s+(the\s+)?(urge|craving|temptation)\b/i,
  /\bi\s+(\w+\s+)?need\s+(a\s+)?(drink|hit|fix|dose)\b/i,
  /\burge\s+to\s+(use|drink|smoke|relapse)\b/i,
  /\bi('m|\s+am)\s+about\s+to\s+relapse\b/i,
  // FR
  /\b(forte|intense)\s*(envie|pulsion)\b/i,
  /\bje\s+veux\s+(boire|consommer|fumer|prendre)\b/i,
  /\bje\s+vais\s+(boire|consommer|fumer|rechuter)\b/i,
];

const PAST_REFLECTION_PATTERNS: RegExp[] = [
  // Patterns that indicate past reflection, NOT current urge
  /\b(vorige|vorig|eerdere|laatste)\s*(terugval|herval|relapse)\b/i,
  /\bwaarom\s+(is|was|heb|ben)\s+.*(teruggevallen|hervallen)\b/i,
  /\bhoe\s+kwam\s+het\s+dat\b/i,
  /\bterugkijkend\b/i,
  /\bwat\s+leerde\s+ik\b/i,
  /\bmy\s+(previous|past|last)\s*(relapse)\b/i,
  /\bwhy\s+did\s+i\s+relapse\b/i,
  /\blooking\s+back\b/i,
];

// ─── Detector ────────────────────────────────────────────────────────────────

export function detectEliasRelapseRisk(input: EliasRelapseRiskInput): EliasRelapseRiskResult {
  // Never active for Kim
  if (input.persona !== 'elias') {
    return { relapseRiskActive: false, reason: 'not_elias' };
  }

  // Check if relapseIntent was already detected by the signal engine
  if (input.relapseIntentDetected) {
    return { relapseRiskActive: true, reason: 'relapse_intent_detected' };
  }

  // Check if relapseActive flag is set (user confirmed relapse)
  if (input.relapseActive) {
    return { relapseRiskActive: true, reason: 'relapse_active_flag' };
  }

  // Check craving slider (>= 4 on 0-5 scale, or >= 7 on 0-10 scale)
  if (typeof input.cravingSliderValue === 'number') {
    if (input.cravingSliderValue >= 7) {
      return { relapseRiskActive: true, reason: 'high_craving_slider' };
    }
    if (input.cravingSliderValue >= 4 && input.cravingSliderValue <= 5) {
      return { relapseRiskActive: true, reason: 'high_craving_slider_0_5_scale' };
    }
  }

  const message = input.userMessage;

  // Check if this is past reflection (exclude from risk)
  const isPastReflection = PAST_REFLECTION_PATTERNS.some(p => p.test(message));
  if (isPastReflection) {
    // Only exclude if there are no ACTIVE craving patterns present
    const hasActiveCraving = ACTIVE_CRAVING_PATTERNS.some(p => p.test(message));
    if (!hasActiveCraving) {
      return { relapseRiskActive: false, reason: 'past_reflection_no_active_craving' };
    }
  }

  // Check active craving/relapse patterns in message
  if (ACTIVE_CRAVING_PATTERNS.some(p => p.test(message))) {
    return { relapseRiskActive: true, reason: 'active_craving_pattern_detected' };
  }

  return { relapseRiskActive: false, reason: 'no_relapse_risk_signals' };
}
