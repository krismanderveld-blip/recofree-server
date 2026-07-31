/**
 * Kim Advanced Modules P7 — Danger/Child Cluster (GEVAAR-K01, KIND-K01)
 * Integration layer for caregiver danger and child safety support.
 *
 * Pipeline position: ABOVE P6 (Relapse Cluster) — highest priority.
 * When active, OVERRIDES P2-P6 module contexts.
 *
 * Priority within cluster:
 * 1. KIND-K01 (child safety — always wins when children are affected)
 * 2. GEVAAR-K01 (danger without child marker)
 *
 * Kim only. Never reads Elias data. store:false on all GPT calls.
 */

import {
  detectGevaarK01,
  detectKindK01,
  resolveCluster2Priority,
  buildGevaarK01Payload,
  buildKindK01Payload,
  buildDangerChildMemoryPatch,
  filterDangerChildOutput,
} from './modules/dangerChildCluster';
import type {
  KimCluster2RuntimeInput,
  KimCluster2DetectionResult,
  KimCluster2ModuleId,
  KimCluster2MemoryPatch,
} from './modules/dangerChildCluster';

export interface KimAdvancedP7Input {
  intakeCompleted: boolean;
  persona: 'kim' | 'elias';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  sessionId: string;
  turnId: string;
  // Explicit flags from detection or other sources
  immediateDanger: boolean;
  childPresentOrAffected: boolean;
  aggressionDetected: boolean;
  drunkDrivingDetected: boolean;
  disappearanceDetected: boolean;
  overdoseOrMedicalDangerDetected: boolean;
  selfHarmThreatByLovedOneDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  policeRelevantButNot112: boolean;
  childMaltreatmentOrNeglectDetected: boolean;
  childParentificationRiskDetected: boolean;
  timestampIso: string;
}

export interface KimAdvancedP7Result {
  dangerChildContext: string | null;
  activeModule: KimCluster2ModuleId | null;
  routeNext: string;
  overridesLowerModules: boolean;
  safetyFilterFn: ((output: string) => { passed: boolean; violations: string[] }) | null;
  memoryPatch: KimCluster2MemoryPatch | null;
  crisisNumbersToShow: string[];
}

export function runKimAdvancedP7(input: KimAdvancedP7Input): KimAdvancedP7Result {
  const emptyResult: KimAdvancedP7Result = {
    dangerChildContext: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
    overridesLowerModules: false,
    safetyFilterFn: null,
    memoryPatch: null,
    crisisNumbersToShow: [],
  };

  // Persona guard — Kim only
  if (input.persona !== 'kim') {
    return emptyResult;
  }

  // Build runtime input
  const runtimeInput: KimCluster2RuntimeInput = {
    persona: input.persona,
    intakeCompleted: input.intakeCompleted,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language === 'mixed' || input.language === 'unknown' ? 'nl' : input.language,
    detectedMarkers: [],
    lovedOneUseContext: true,
    firstPersonUseContext: false,
    caregiverOverwhelmed: false,
    immediateDanger: input.immediateDanger,
    childPresentOrAffected: input.childPresentOrAffected,
    aggressionDetected: input.aggressionDetected,
    drunkDrivingDetected: input.drunkDrivingDetected,
    disappearanceDetected: input.disappearanceDetected,
    overdoseOrMedicalDangerDetected: input.overdoseOrMedicalDangerDetected,
    selfHarmThreatByLovedOneDetected: input.selfHarmThreatByLovedOneDetected,
    domesticViolenceOrAbuseDetected: input.domesticViolenceOrAbuseDetected,
    policeRelevantButNot112: input.policeRelevantButNot112,
    childMaltreatmentOrNeglectDetected: input.childMaltreatmentOrNeglectDetected,
    childParentificationRiskDetected: input.childParentificationRiskDetected,
    moduleCandidates: [],
    timestampIso: input.timestampIso,
    sessionId: input.sessionId,
    turnId: input.turnId,
  };

  // Run both detectors
  const gevaarResult = detectGevaarK01(runtimeInput);
  const kindResult = detectKindK01(runtimeInput);

  // Resolve priority (KIND > GEVAAR)
  const priority = resolveCluster2Priority(gevaarResult, kindResult);

  if (!priority.primary) {
    return emptyResult;
  }

  const detection = priority.primary;
  const isActive = detection.activationStatus === 'ACTIVE' || detection.activationStatus === 'ESCALATE_TO_CRISIS_NUMBERS';

  if (!isActive) {
    return emptyResult;
  }

  // Build payload
  const payload = detection.moduleId === 'KIND-K01'
    ? buildKindK01Payload(detection)
    : buildGevaarK01Payload(detection);

  // Build memory patch
  const memoryPatch = buildDangerChildMemoryPatch(detection, input.sessionId, input.turnId);

  // Safety filter function
  const safetyFilterFn = (output: string) => {
    const result = filterDangerChildOutput(output, detection.moduleId);
    return { passed: result.passed, violations: result.violations };
  };

  return {
    dangerChildContext: payload.fullPrompt,
    activeModule: detection.moduleId,
    routeNext: detection.moduleId,
    overridesLowerModules: true,
    safetyFilterFn,
    memoryPatch,
    crisisNumbersToShow: detection.crisisNumbersToShow,
  };
}
