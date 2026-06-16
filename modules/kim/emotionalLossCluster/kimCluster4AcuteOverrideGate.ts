/**
 * Kim Cluster 4 — Acute Override Gate
 *
 * Ensures reflective modules (HOOP, SCHAAM, ROUW, ISOL) always lose to acute clusters.
 * Special case: HOOP-K01 suicidality-split — if Kim expresses suicidal ideation,
 * escalate to CRISIS-K01 with 1813 (+ 112 if immediate danger).
 */

import type {
  KimCluster4ModuleId,
  KimCluster4RuntimeInput,
  KimCluster4AcuteOverrideResult,
  FixedBelgianCrisisNumber,
} from './kimCluster4.types';

/**
 * Check if an acute cluster should override this reflective module.
 * Priority: CRISIS-K01 > GEVAAR-K01 > KIND-K01 > HERV-K01 > NAHERV-K01
 */
export function applyKimCluster4AcuteOverride(
  input: KimCluster4RuntimeInput,
  moduleId: KimCluster4ModuleId
): KimCluster4AcuteOverrideResult {
  const notBlocked: KimCluster4AcuteOverrideResult = {
    blocked: false,
    activationStatus: 'NOT_ACTIVE',
    responseMode: 'DEFERRED',
    crisisNumbersToShow: [],
    routeNext: 'NO_MODULE',
    reason: '',
  };

  // ─── Persona guard ────────────────────────────────────────────────────────
  if (input.persona !== 'kim') {
    return {
      blocked: true,
      activationStatus: 'BLOCKED_BY_PERSONA',
      responseMode: 'BLOCKED',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: `${moduleId} is Kim-only. Current persona: ${input.persona}.`,
    };
  }

  // ─── Suicidality-split (applies to ALL Cluster 4 modules) ─────────────────
  // If Kim herself expresses suicidal ideation / self-harm, escalate to CRISIS-K01
  if (input.selfHarmOrSuicideDetectedInKim) {
    const crisisNumbers: FixedBelgianCrisisNumber[] = ['1813'];
    if (input.immediateDanger) {
      crisisNumbers.push('112');
    }
    return {
      blocked: true,
      activationStatus: 'DEFERRED_TO_CRISIS_K01',
      responseMode: 'SUICIDE_RISK_BRIDGE',
      crisisNumbersToShow: crisisNumbers,
      routeNext: 'CRISIS-K01',
      reason: `Suicidal ideation/self-harm detected in Kim. ${moduleId} defers to CRISIS-K01.`,
    };
  }

  // ─── Danger / violence / abuse ────────────────────────────────────────────
  if (input.dangerOrViolenceDetected || input.domesticViolenceOrAbuseDetected || input.aggressionDetected) {
    const crisisNumbers: FixedBelgianCrisisNumber[] = ['1712'];
    if (input.immediateDanger) {
      crisisNumbers.push('112');
    }
    return {
      blocked: true,
      activationStatus: 'DEFERRED_TO_GEVAAR_K01',
      responseMode: 'DEFERRED',
      crisisNumbersToShow: crisisNumbers,
      routeNext: 'GEVAAR-K01',
      reason: `Danger/violence/aggression detected. ${moduleId} defers to GEVAAR-K01.`,
    };
  }

  // ─── Child safety ─────────────────────────────────────────────────────────
  if (input.childPresentOrAffected) {
    const crisisNumbers: FixedBelgianCrisisNumber[] = ['1712'];
    if (input.immediateDanger) {
      crisisNumbers.push('112');
    }
    return {
      blocked: true,
      activationStatus: 'DEFERRED_TO_KIND_K01',
      responseMode: 'DEFERRED',
      crisisNumbersToShow: crisisNumbers,
      routeNext: 'KIND-K01',
      reason: `Child safety concern detected. ${moduleId} defers to KIND-K01.`,
    };
  }

  // ─── Active relapse now ───────────────────────────────────────────────────
  if (input.activeRelapseNow) {
    return {
      blocked: true,
      activationStatus: 'DEFERRED_TO_HERV_K01',
      responseMode: 'DEFERRED',
      crisisNumbersToShow: [],
      routeNext: 'HERV-K01',
      reason: `Active relapse happening now. ${moduleId} defers to HERV-K01.`,
    };
  }

  // ─── Immediate aftermath ──────────────────────────────────────────────────
  if (input.immediateAftermathActive) {
    return {
      blocked: true,
      activationStatus: 'DEFERRED_TO_NAHERV_K01',
      responseMode: 'DEFERRED',
      crisisNumbersToShow: [],
      routeNext: 'NAHERV-K01',
      reason: `Immediate aftermath active. ${moduleId} defers to NAHERV-K01.`,
    };
  }

  return notBlocked;
}
