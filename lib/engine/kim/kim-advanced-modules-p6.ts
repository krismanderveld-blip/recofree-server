/**
 * Kim Advanced Modules P6 — Relapse Cluster (HERV-K01, NAHERV-K01, CRISIS-K01)
 * Integration layer for caregiver relapse-related support.
 *
 * Pipeline position: HIGHEST PRIORITY — runs BEFORE all other Kim advanced modules.
 * When active, OVERRIDES P2-P5 module contexts (crisis > relapse > everything else).
 *
 * Priority within cluster:
 * 1. CRISIS-K01 (acute danger, violence, suicide risk, medical emergency)
 * 2. HERV-K01 (active relapse happening now)
 * 3. NAHERV-K01 (post-relapse aftermath, aftercare conversation)
 *
 * Kim only. Never reads Elias data. store:false on all GPT calls.
 */

import {
  routeKimRelapseCluster,
  filterKimRelapseClusterOutput,
  scanMarkers,
} from './modules/relapseCluster';
import type {
  KimRelapseClusterRuntimeInput,
  KimRelapseClusterLanguage,
  KimCaregiverState,
  KimSafetyRiskLevel,
  KimRelapseClusterModuleId,
} from './modules/relapseCluster';
import type { KimRelapseClusterRouterOutput } from './modules/relapseCluster';

export interface KimAdvancedP6Input {
  intakeCompleted: boolean;
  persona: 'kim' | 'elias';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  sessionId: string;
  turnId: string;
  caregiverState: KimCaregiverState;
  safetyRiskLevel: KimSafetyRiskLevel;
  vspZone: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  // Explicit flags from crisis detection or other sources
  explicitAcuteDanger: boolean;
  explicitSelfHarmRiskLovedOne: boolean;
  explicitSelfHarmRiskCaregiver: boolean;
  explicitViolenceRisk: boolean;
  explicitMedicalEmergency: boolean;
  explicitDisappearance: boolean;
  explicitImpairedDrivingRisk: boolean;
  explicitChildSafetyRisk: boolean;
  timestampIso: string;
}

export interface KimAdvancedP6Result {
  relapseClusterContext: string | null;
  activeModule: KimRelapseClusterModuleId | null;
  routeNext: string;
  overridesLowerModules: boolean;
  safetyFilterFn: ((output: string) => { passed: boolean; violations: Array<{ ruleId: string; category: string; matchedPhrase: string }> }) | null;
  memoryPatch: KimRelapseClusterRouterOutput['memoryPatch'];
}

export function runKimAdvancedP6(input: KimAdvancedP6Input): KimAdvancedP6Result {
  const emptyResult: KimAdvancedP6Result = {
    relapseClusterContext: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
    overridesLowerModules: false,
    safetyFilterFn: null,
    memoryPatch: null,
  };

  // Persona guard — Kim only
  if (input.persona !== 'kim') {
    return emptyResult;
  }

  // Build runtime input for the relapse cluster
  const normalizedMessage = input.latestUserMessage.toLowerCase().trim();
  const detectedMarkers = scanMarkers(normalizedMessage);

  const runtimeInput: KimRelapseClusterRuntimeInput = {
    persona: input.persona,
    language: normalizeLanguage(input.language),
    userMessage: input.latestUserMessage,
    normalizedMessage,
    timestampIso: input.timestampIso,
    sessionId: input.sessionId,
    turnId: input.turnId,
    storePolicy: 'store:false',
    detectedMarkers,
    caregiverState: input.caregiverState,
    safetyRiskLevel: input.safetyRiskLevel,
    vspZone: input.vspZone as KimRelapseClusterRuntimeInput['vspZone'],
    explicitAcuteDanger: input.explicitAcuteDanger,
    explicitSelfHarmRiskLovedOne: input.explicitSelfHarmRiskLovedOne,
    explicitSelfHarmRiskCaregiver: input.explicitSelfHarmRiskCaregiver,
    explicitViolenceRisk: input.explicitViolenceRisk,
    explicitMedicalEmergency: input.explicitMedicalEmergency,
    explicitDisappearance: input.explicitDisappearance,
    explicitImpairedDrivingRisk: input.explicitImpairedDrivingRisk,
    explicitChildSafetyRisk: input.explicitChildSafetyRisk,
  };

  const routerOutput = routeKimRelapseCluster(runtimeInput);

  if (!routerOutput.shouldActivate || !routerOutput.promptPayload) {
    return emptyResult;
  }

  return {
    relapseClusterContext: routerOutput.promptPayload.gptInstruction,
    activeModule: routerOutput.detection.selectedModuleId,
    routeNext: routerOutput.detection.routeNext ?? 'RELAPSE_CLUSTER',
    overridesLowerModules: true,
    safetyFilterFn: filterKimRelapseClusterOutput,
    memoryPatch: routerOutput.memoryPatch,
  };
}

function normalizeLanguage(lang: string): KimRelapseClusterLanguage {
  if (lang === 'nl' || lang === 'en' || lang === 'fr') return lang;
  return 'nl'; // default to NL for mixed/unknown
}
