/**
 * STOA-K Detector — Scans markers and determines activation
 */

import type {
  KimStoaRuntimeInput,
  KimStoaDetectionResult,
  KimStoaTheme,
  KimStoaResponseMode,
} from './kimStoaK.types';
import { applyKimStoaAcuteOverride } from './kimStoaKAcuteOverrideGate';

import * as NL from './kimStoaKMarkers.nl';
import * as EN from './kimStoaKMarkers.en';
import * as FR from './kimStoaKMarkers.fr';

interface MarkerScanResult {
  controlDistinction: boolean;
  controlLoop: boolean;
  lettingGo: boolean;
  values: boolean;
  acceptance: boolean;
  boundaryControl: boolean;
  responsibility: boolean;
  deeperReflection: boolean;
  fastGrounding: boolean;
  matchedMarkers: string[];
}

function scanMarkers(text: string): MarkerScanResult {
  const matched: string[] = [];

  const test = (patterns: RegExp[], label: string): boolean => {
    for (const p of patterns) {
      if (p.test(text)) {
        matched.push(label);
        return true;
      }
    }
    return false;
  };

  const controlDistinction =
    test(NL.NL_STOA_K_CONTROL_DISTINCTION, 'control_distinction_nl') ||
    test(EN.EN_STOA_K_CONTROL_DISTINCTION, 'control_distinction_en') ||
    test(FR.FR_STOA_K_CONTROL_DISTINCTION, 'control_distinction_fr');

  const controlLoop =
    test(NL.NL_STOA_K_CONTROL_LOOP, 'control_loop_nl') ||
    test(EN.EN_STOA_K_CONTROL_LOOP, 'control_loop_en') ||
    test(FR.FR_STOA_K_CONTROL_LOOP, 'control_loop_fr');

  const lettingGo =
    test(NL.NL_STOA_K_LETTING_GO, 'letting_go_nl') ||
    test(EN.EN_STOA_K_LETTING_GO, 'letting_go_en') ||
    test(FR.FR_STOA_K_LETTING_GO, 'letting_go_fr');

  const values =
    test(NL.NL_STOA_K_VALUES, 'values_nl') ||
    test(EN.EN_STOA_K_VALUES, 'values_en') ||
    test(FR.FR_STOA_K_VALUES, 'values_fr');

  const acceptance =
    test(NL.NL_STOA_K_ACCEPTANCE, 'acceptance_nl') ||
    test(EN.EN_STOA_K_ACCEPTANCE, 'acceptance_en') ||
    test(FR.FR_STOA_K_ACCEPTANCE, 'acceptance_fr');

  const boundaryControl =
    test(NL.NL_STOA_K_BOUNDARY_CONTROL, 'boundary_control_nl') ||
    test(EN.EN_STOA_K_BOUNDARY_CONTROL, 'boundary_control_en') ||
    test(FR.FR_STOA_K_BOUNDARY_CONTROL, 'boundary_control_fr');

  const responsibility =
    test(NL.NL_STOA_K_RESPONSIBILITY, 'responsibility_nl') ||
    test(EN.EN_STOA_K_RESPONSIBILITY, 'responsibility_en') ||
    test(FR.FR_STOA_K_RESPONSIBILITY, 'responsibility_fr');

  const deeperReflection =
    test(NL.NL_STOA_K_DEEPER_REFLECTION, 'deeper_reflection_nl') ||
    test(EN.EN_STOA_K_DEEPER_REFLECTION, 'deeper_reflection_en') ||
    test(FR.FR_STOA_K_DEEPER_REFLECTION, 'deeper_reflection_fr');

  const fastGrounding =
    test(NL.NL_STOA_K_FAST_GROUNDING, 'fast_grounding_nl') ||
    test(EN.EN_STOA_K_FAST_GROUNDING, 'fast_grounding_en') ||
    test(FR.FR_STOA_K_FAST_GROUNDING, 'fast_grounding_fr');

  return {
    controlDistinction,
    controlLoop,
    lettingGo,
    values,
    acceptance,
    boundaryControl,
    responsibility,
    deeperReflection,
    fastGrounding,
    matchedMarkers: matched,
  };
}

function determineThemes(scan: MarkerScanResult): KimStoaTheme[] {
  const themes: KimStoaTheme[] = [];
  if (scan.controlDistinction) themes.push('cannot_control_loved_one');
  if (scan.controlLoop) themes.push('control_loop');
  if (scan.lettingGo) themes.push('letting_go_without_abandoning');
  if (scan.values) themes.push('values_as_compass');
  if (scan.boundaryControl) themes.push('boundaries_as_controllable_action');
  if (scan.acceptance) themes.push('acceptance_without_approval');
  if (scan.responsibility) themes.push('responsibility_separation');
  return themes;
}

function determineResponseMode(scan: MarkerScanResult, themes: KimStoaTheme[]): KimStoaResponseMode {
  if (scan.controlLoop) return 'CONTROL_LOOP_DEFUSION';
  if (scan.acceptance) return 'ACCEPTANCE_NOT_APPROVAL';
  if (scan.lettingGo) return 'NON_CONTROL_WITH_CARE';
  if (scan.values) return 'VALUES_BASED_ACTION';
  if (scan.boundaryControl) return 'BOUNDARY_WITH_ACCEPTANCE';
  if (scan.controlDistinction) return 'CONTROL_DISTINCTION_REFLECTION';
  return 'CONTROL_DISTINCTION_REFLECTION';
}

export function detectStoaK(input: KimStoaRuntimeInput): KimStoaDetectionResult {
  // Apply acute override gate first
  const override = applyKimStoaAcuteOverride(input);
  if (override.blocked) {
    return {
      moduleId: 'STOA-K',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: [],
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  // Scan markers
  const scan = scanMarkers(input.latestUserMessage);

  // Enrich input flags from scan
  const enrichedInput = {
    ...input,
    controlDistinctionDetected: input.controlDistinctionDetected || scan.controlDistinction,
    controlLoopDetected: input.controlLoopDetected || scan.controlLoop,
    lettingGoQuestionDetected: input.lettingGoQuestionDetected || scan.lettingGo,
    valuesQuestionDetected: input.valuesQuestionDetected || scan.values,
    boundaryControlQuestionDetected: input.boundaryControlQuestionDetected || scan.boundaryControl,
    responsibilitySeparationDetected: input.responsibilitySeparationDetected || scan.responsibility,
    acceptanceNotApprovalDetected: input.acceptanceNotApprovalDetected || scan.acceptance,
    deeperStoicReflectionDetected: input.deeperStoicReflectionDetected || scan.deeperReflection,
    fastGroundingNeedDetected: input.fastGroundingNeedDetected || scan.fastGrounding,
  };

  // Re-check KST01 boundary after marker scan
  if (enrichedInput.fastGroundingNeedDetected && !enrichedInput.deeperStoicReflectionDetected) {
    return {
      moduleId: 'STOA-K',
      activationStatus: 'DEFER_TO_KST01',
      confidenceScore: 0.3,
      matchedMarkers: scan.matchedMarkers,
      themes: [],
      responseMode: 'FAST_GROUNDING_DEFER_TO_KST01',
      crisisNumbersToShow: [],
      routeNext: 'KST01',
      reason: 'Fast grounding need without deeper reflection → KST01.',
    };
  }

  // Determine themes and response mode
  const themes = determineThemes(scan);
  const responseMode = determineResponseMode(scan, themes);

  // Calculate confidence
  const markerCount = scan.matchedMarkers.length;
  const hasAnyStoa = scan.controlDistinction || scan.controlLoop || scan.lettingGo ||
    scan.values || scan.acceptance || scan.boundaryControl || scan.responsibility ||
    scan.deeperReflection;

  if (!hasAnyStoa) {
    return {
      moduleId: 'STOA-K',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: scan.matchedMarkers,
      themes: [],
      responseMode: 'CONTROL_DISTINCTION_REFLECTION',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No STOA-K markers detected.',
    };
  }

  const confidence = Math.min(0.95, 0.5 + markerCount * 0.1);

  return {
    moduleId: 'STOA-K',
    activationStatus: 'ACTIVE',
    confidenceScore: confidence,
    matchedMarkers: scan.matchedMarkers,
    themes,
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'STOA-K',
    reason: `STOA-K activated with themes: ${themes.join(', ')}`,
  };
}
