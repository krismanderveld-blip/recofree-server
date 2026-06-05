/**
 * STO01 Stoicism Integration — Routing
 *
 * Decision tree and intervention selection for STO01.
 * Implements the module decision tree from spec section 7, 12, 13.
 *
 * MODULE_ID: STO01
 * PIPELINE POSITION: 5e4 (after SW01)
 */

import type {
  STO01Input,
  STO01Output,
  STO01RoutingDecision,
  STO01Principle,
  STO01FallbackModule,
} from './sto01_types';
import { getSTO01ForbiddenOutputs } from './sto01_forbidden_outputs';
import { buildSTO01PromptBlock } from './sto01_prompt_builder';

// ─── Main Evaluation Function ───────────────────────────────────────────────

/**
 * Evaluate STO01 activation based on input context.
 * This is the main entry point called by the pipeline at step 5e4.
 */
export function evaluateSTO01(input: STO01Input): STO01Output {
  // Safety override check — highest priority
  const safetyOverride =
    input.safety.activeSuicidalIntent ||
    input.safety.selfHarmIntent ||
    input.safety.acuteMedicalRisk ||
    input.safety.overdoseOrPoisoningRisk ||
    input.safety.severeIntoxication ||
    input.safety.acuteWithdrawalRisk ||
    input.safety.deliriumOrSeizureRisk;

  if (safetyOverride) {
    const fallbackModule: STO01FallbackModule =
      input.safety.activeSuicidalIntent || input.safety.selfHarmIntent
        ? "CRISIS_PROTOCOL"
        : "MEDICAL_SAFETY";

    return {
      routingDecision: {
        activate: false,
        reason: "STO01 blocked by safety override",
        fallbackModule,
      },
      generatedInstruction: {
        moduleId: "STO01",
        active: false,
        selectedPrinciples: [],
        selectedIntervention: null,
        gptPromptBlock: "",
        forbiddenOutputs: getSTO01ForbiddenOutputs(),
        requiredResponsePattern: [],
        safetyOverride: true,
        fallbackModule,
      },
      pipelineContinue: true,
      nextPipelineStep: fallbackModule,
    };
  }

  // Intervention selection
  const selected = selectSTO01Intervention(input);

  if (!selected.activate) {
    return {
      routingDecision: selected,
      generatedInstruction: {
        moduleId: "STO01",
        active: false,
        selectedPrinciples: [],
        selectedIntervention: null,
        gptPromptBlock: "",
        forbiddenOutputs: getSTO01ForbiddenOutputs(),
        requiredResponsePattern: [],
        safetyOverride: false,
      },
      pipelineContinue: true,
      nextPipelineStep: "GENERAL_RESPONSE_SYNTHESIS",
    };
  }

  // Active — build prompt block
  const selectedPrinciples = [
    selected.primaryPrinciple,
    selected.secondaryPrinciple,
  ].filter(Boolean) as STO01Principle[];

  return {
    routingDecision: selected,
    generatedInstruction: {
      moduleId: "STO01",
      active: true,
      selectedPrinciples,
      selectedIntervention: selected.interventionType ?? null,
      gptPromptBlock: buildSTO01PromptBlock(selected, input),
      forbiddenOutputs: getSTO01ForbiddenOutputs(),
      requiredResponsePattern: [
        "Validate emotional reality first",
        "Name the Stoic distinction simply",
        "Translate it into recovery context",
        "Offer one concrete next step",
        "Avoid lecturing or philosophical overload",
      ],
      safetyOverride: false,
    },
    pipelineContinue: true,
    nextPipelineStep: "GENERAL_RESPONSE_SYNTHESIS",
  };
}

// ─── Intervention Selection (spec section 13) ───────────────────────────────

/**
 * Select the appropriate STO01 intervention based on trigger markers and context.
 */
export function selectSTO01Intervention(input: STO01Input): STO01RoutingDecision {
  const markers = input.triggerMarkers;

  // Priority 1: Explicit stoicism/philosophy request
  if (markers.explicitStoicismRequest || markers.explicitPhilosophyRequest) {
    if (input.recoveryContext.recentRelapse) {
      return {
        activate: true,
        primaryPrinciple: "amor_fati",
        secondaryPrinciple: "dichotomy_of_control",
        interventionType: "STO01_IT03_RELAPSE_MEANING_REFRAME",
        activationStrength: "high",
      };
    }

    if (markers.ruminationOutsideControl) {
      return {
        activate: true,
        primaryPrinciple: "dichotomy_of_control",
        secondaryPrinciple: "apatheia",
        interventionType: "STO01_IT01_CONTROL_SORTING",
        activationStrength: "high",
      };
    }

    // Default explicit request: control sorting
    return {
      activate: true,
      primaryPrinciple: "dichotomy_of_control",
      secondaryPrinciple: "apatheia",
      interventionType: "STO01_IT01_CONTROL_SORTING",
      activationStrength: "high",
    };
  }

  // Priority 2: Relapse meaning search with recent relapse
  if (markers.relapseMeaningSearch && input.recoveryContext.recentRelapse) {
    return {
      activate: true,
      primaryPrinciple: "amor_fati",
      secondaryPrinciple: "memento_mori",
      interventionType: "STO01_IT03_RELAPSE_MEANING_REFRAME",
      activationStrength: "medium",
    };
  }

  // Priority 3: External cause fixation
  if (markers.externalCauseFixation) {
    return {
      activate: true,
      primaryPrinciple: "dichotomy_of_control",
      secondaryPrinciple: "sympatheia",
      interventionType: "STO01_IT05_CONNECTED_RESPONSIBILITY",
      activationStrength: "medium",
    };
  }

  // Priority 4: Rumination outside control
  if (markers.ruminationOutsideControl) {
    return {
      activate: true,
      primaryPrinciple: "dichotomy_of_control",
      secondaryPrinciple: "apatheia",
      interventionType: "STO01_IT01_CONTROL_SORTING",
      activationStrength: "medium",
    };
  }

  // No trigger marker active
  return {
    activate: false,
    reason: "No STO01 trigger marker active",
  };
}
