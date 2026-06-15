/**
 * Kim Cluster 3 — Detectors for ROL-K01, VETR02-K, LEUGEN-K01
 * Deterministic marker-based detection with acute override gate.
 */

import type {
  KimCluster3RuntimeInput,
  KimCluster3DetectionResult,
  KimCluster3Theme,
  KimCluster3ResponseMode,
} from './kimCluster3.types';
import { applyKimCluster3AcuteOverride } from './kimCluster3AcuteOverrideGate';
import { NL_ROL_K01_MARKERS, NL_VETR02_K_MARKERS, NL_LEUGEN_K01_MARKERS } from './kimCluster3Markers.nl';
import { EN_ROL_K01_MARKERS, EN_VETR02_K_MARKERS, EN_LEUGEN_K01_MARKERS } from './kimCluster3Markers.en';
import { FR_ROL_K01_MARKERS, FR_VETR02_K_MARKERS, FR_LEUGEN_K01_MARKERS } from './kimCluster3Markers.fr';

function scanMarkers(text: string, patterns: RegExp[]): string[] {
  const matched: string[] = [];
  for (const p of patterns) {
    if (p.test(text)) {
      matched.push(p.source);
    }
  }
  return matched;
}

// ─── ROL-K01 ───────────────────────────────────────────────

export function detectRolK01(input: KimCluster3RuntimeInput): KimCluster3DetectionResult {
  const override = applyKimCluster3AcuteOverride(input, 'ROL-K01');
  if (override.blocked) {
    return {
      moduleId: 'ROL-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const text = input.latestUserMessage;
  const allMarkers = [...NL_ROL_K01_MARKERS, ...EN_ROL_K01_MARKERS, ...FR_ROL_K01_MARKERS];
  const matched = scanMarkers(text, allMarkers);

  // Also check flags
  const hasCorePattern =
    (input.careRoleDroppedOrPaused || input.lovedOneStableOrAdmitted) &&
    input.suppressedEmotionWaveDetected;

  if (matched.length === 0 && !hasCorePattern) {
    return {
      moduleId: 'ROL-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: [],
      themes: [],
      responseMode: 'PERMISSION_TO_FEEL_WITHOUT_GUILT',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No ROL-K01 care role drop / suppressed emotion pattern detected.',
    };
  }

  const themes: KimCluster3Theme[] = ['suppressed_emotions_after_care_role'];
  if (/wie ben ik|who am I|qui je suis/i.test(text) || /kwijt ben|lost myself|perdu/i.test(text)) {
    themes.push('caregiver_identity_after_role_drop');
  }

  // Determine response mode
  let responseMode: KimCluster3ResponseMode = 'PERMISSION_TO_FEEL_WITHOUT_GUILT';
  if (/boos|woede|anger|rage|col[eè]re/i.test(text) || /moe|exhausted|[eé]puis/i.test(text) || /leeg|empty|vide/i.test(text)) {
    responseMode = 'EXHAUSTION_ANGER_GRIEF_EMPTYNESS';
  }
  if (/wie ben ik|who am I|qui je suis|kwijt ben|lost myself|perdu/i.test(text)) {
    responseMode = 'IDENTITY_BEYOND_CARE_ROLE';
  }

  const confidenceScore = matched.length >= 2 ? 0.94 : hasCorePattern ? 0.90 : 0.82;

  return {
    moduleId: 'ROL-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: matched,
    themes: [...new Set(themes)],
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'ROL-K01',
    reason: 'Care role drop with suppressed emotion wave detected.',
  };
}

// ─── VETR02-K ──────────────────────────────────────────────

export function detectVetr02K(input: KimCluster3RuntimeInput): KimCluster3DetectionResult {
  const override = applyKimCluster3AcuteOverride(input, 'VETR02-K');
  if (override.blocked) {
    return {
      moduleId: 'VETR02-K',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const text = input.latestUserMessage;
  const allMarkers = [...NL_VETR02_K_MARKERS, ...EN_VETR02_K_MARKERS, ...FR_VETR02_K_MARKERS];
  const matched = scanMarkers(text, allMarkers);

  const hasCorePattern =
    input.partnerAbsentOrInAdmission &&
    (input.hypervigilanceDetected || input.reexperienceDetected);

  if (matched.length === 0 && !hasCorePattern) {
    return {
      moduleId: 'VETR02-K',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: [],
      themes: [],
      responseMode: 'ABSENCE_TRIGGERED_HYPERVIGILANCE',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No VETR02-K absence/admission hypervigilance pattern detected.',
    };
  }

  const themes: KimCluster3Theme[] = [];
  if (input.partnerAbsentOrInAdmission || /opgenomen|admitted|hospitalis/i.test(text)) {
    themes.push('triggered_reexperience_absence_admission');
  }
  if (input.hypervigilanceDetected || /check|controleer|v[eé]rifier|scannen|alert/i.test(text)) {
    themes.push('hypervigilance_when_partner_absent');
  }

  let responseMode: KimCluster3ResponseMode = 'ABSENCE_TRIGGERED_HYPERVIGILANCE';
  if (input.reexperienceDetected || /herleef|herbeleef|relive|re-experience|revis/i.test(text)) {
    responseMode = 'GROUNDING_THEN_NOW';
  }
  if (/stilte.*onveilig|silence.*unsafe|silence.*peur/i.test(text)) {
    responseMode = 'SILENCE_FEELS_UNSAFE';
  }

  const confidenceScore = input.reexperienceDetected ? 0.92 : matched.length >= 2 ? 0.90 : 0.82;

  return {
    moduleId: 'VETR02-K',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: matched,
    themes: [...new Set(themes)],
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'VETR02-K',
    reason: 'Absence/admission-triggered hypervigilance or re-experiencing detected.',
  };
}

// ─── LEUGEN-K01 ────────────────────────────────────────────

export function detectLeugenK01(input: KimCluster3RuntimeInput): KimCluster3DetectionResult {
  const override = applyKimCluster3AcuteOverride(input, 'LEUGEN-K01');
  if (override.blocked) {
    return {
      moduleId: 'LEUGEN-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const text = input.latestUserMessage;
  const allMarkers = [...NL_LEUGEN_K01_MARKERS, ...EN_LEUGEN_K01_MARKERS, ...FR_LEUGEN_K01_MARKERS];
  const matched = scanMarkers(text, allMarkers);

  const hasCorePattern = input.chronicLyingDetected || input.detectiveRoleDetected;

  if (matched.length === 0 && !hasCorePattern) {
    return {
      moduleId: 'LEUGEN-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: [],
      themes: [],
      responseMode: 'BETRAYAL_PAIN_AND_CLARITY',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No LEUGEN-K01 chronic lying / detective role pattern detected.',
    };
  }

  const themes: KimCluster3Theme[] = ['chronic_lying_betrayal_clarity'];
  if (input.detectiveRoleDetected || /detective|bewijs|proof|preuves|controleer|check|v[eé]rifi/i.test(text)) {
    themes.push('detective_role_risk');
  }
  if (input.betrayalPainDetected || /vertrouw.*niet|trust.*not|confiance.*plus/i.test(text)) {
    themes.push('boundary_repair');
  }

  let responseMode: KimCluster3ResponseMode = 'BETRAYAL_PAIN_AND_CLARITY';
  if (input.detectiveRoleDetected || /detective|bewijs|proof|controleer alles|check everything/i.test(text)) {
    responseMode = 'BOUNDARIES_WITHOUT_DETECTIVE_ROLE';
  }
  if (/heen en weer|torn between|partag[eé]e entre/i.test(text)) {
    responseMode = 'UNCERTAINTY_WITHOUT_SELF_ERASURE';
  }

  const confidenceScore =
    (input.chronicLyingDetected && input.detectiveRoleDetected) ? 0.94 :
    matched.length >= 3 ? 0.92 :
    matched.length >= 2 ? 0.88 :
    0.80;

  return {
    moduleId: 'LEUGEN-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: matched,
    themes: [...new Set(themes)],
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'LEUGEN-K01',
    reason: 'Chronic lying / detective role pattern detected.',
  };
}

// ─── Priority Resolver ─────────────────────────────────────

export function resolveCluster3Priority(
  input: KimCluster3RuntimeInput
): KimCluster3DetectionResult | null {
  const rolResult = detectRolK01(input);
  const vetrResult = detectVetr02K(input);
  const leugenResult = detectLeugenK01(input);

  // If any is blocked (same override for all), return the first blocked result
  if (rolResult.activationStatus !== 'ACTIVE' && rolResult.activationStatus !== 'NOT_ACTIVE') {
    return rolResult;
  }

  // Collect active results
  const active: KimCluster3DetectionResult[] = [];
  if (rolResult.activationStatus === 'ACTIVE') active.push(rolResult);
  if (vetrResult.activationStatus === 'ACTIVE') active.push(vetrResult);
  if (leugenResult.activationStatus === 'ACTIVE') active.push(leugenResult);

  if (active.length === 0) return null;

  // Pick highest confidence
  active.sort((a, b) => b.confidenceScore - a.confidenceScore);
  return active[0];
}
