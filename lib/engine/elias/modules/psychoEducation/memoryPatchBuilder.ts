import type {
  EliasPsychoEducationDetectionResult,
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationMemoryPatch,
  EliasPsychoEducationMemoryHint,
} from "@/lib/types/eliasPsychoEducation.types";

/**
 * Builds the memory patch for Elias psycho-education modules.
 * Returns null if module is not active, persona is not elias, or crisis is active.
 */
export function buildEliasPsychoEducationMemoryPatch(input: {
  detection: EliasPsychoEducationDetectionResult;
  runtimeInput: EliasPsychoEducationRuntimeInput;
}): EliasPsychoEducationMemoryPatch | null {
  const { detection, runtimeInput } = input;

  // Guard: only write when ACTIVE
  if (detection.activationStatus !== "ACTIVE") return null;
  if (runtimeInput.persona !== "elias") return null;
  if (runtimeInput.crisisProtocolActive) return null;

  const now = runtimeInput.timestampIso;
  const moduleId = detection.moduleId;

  if (moduleId === "WILSKRACHT01") {
    return buildWilskrachtPatch(detection, runtimeInput, now);
  }

  if (moduleId === "AUTOPILOT01") {
    return buildAutopilotPatch(detection, runtimeInput, now);
  }

  return null;
}

function buildWilskrachtPatch(
  detection: EliasPsychoEducationDetectionResult,
  runtimeInput: EliasPsychoEducationRuntimeInput,
  now: string
): EliasPsychoEducationMemoryPatch {
  const normalizedLabels = [
    "self_blame_after_relapse",
    "willpower_failure_belief",
    "fast_impulse_vs_slow_control",
    "needs_early_signal_recognition",
  ];

  const hints: EliasPsychoEducationMemoryHint[] = normalizedLabels.map((label) => ({
    hintId: `wilskracht_${label}`,
    moduleId: "WILSKRACHT01",
    label: getLabelText("WILSKRACHT01", label),
    normalizedLabel: label,
    relevance: label.includes("blame") ? "self_blame" : "willpower_belief",
    firstDetectedAt: now,
    lastUpdatedAt: now,
    frequency: 1,
    lastUsedInGreetingAt: null,
    lastUsedInTurnAt: null,
  }));

  return {
    persona: "elias",
    moduleId: "WILSKRACHT01",
    storageTargets: ["user.dat", "projections.dat", "logs.dat"],
    userDatPatch: {
      psychoEducationPatternsToUpsert: hints,
      moduleUsageToIncrement: {
        moduleId: "WILSKRACHT01",
        lastActivatedAt: now,
        activationCountIncrement: 1,
      },
    },
    projectionsDatPatch: {
      beliefsToUpsert: [
        {
          beliefId: "willpower_failure_belief",
          label: "Ik had sterker moeten zijn, ik heb gefaald door gebrek aan wilskracht.",
          normalizedLabel: "willpower_failure_belief",
          category: "willpower_shame_belief",
          sourceModuleId: "WILSKRACHT01",
          firstDetectedAt: now,
          lastUpdatedAt: now,
          decayScoreInitial: 0.75,
        },
      ],
      recoveryHandlesToUpsert: [
        {
          handleId: "rider_horse_pause_window",
          label: "Het eerste eerdere signaal herkennen vóór het impulssysteem vertrekt.",
          normalizedLabel: "rider_horse_pause_window",
          sourceModuleId: "WILSKRACHT01",
          firstDetectedAt: now,
          lastUpdatedAt: now,
        },
      ],
    },
    logsDatPatch: {
      logEvent: {
        logId: `log_wilskracht_${runtimeInput.sessionId}_${runtimeInput.turnId}`,
        sessionId: runtimeInput.sessionId,
        turnId: runtimeInput.turnId,
        timestampIso: now,
        moduleId: "WILSKRACHT01",
        responseMode: detection.responseMode,
        matchedMarkers: detection.matchedMarkers,
        memoryUseDirectiveWritten: true,
        rawTextStored: false,
        storePolicy: "local_elias_scoped_only",
      },
    },
  };
}

function buildAutopilotPatch(
  detection: EliasPsychoEducationDetectionResult,
  runtimeInput: EliasPsychoEducationRuntimeInput,
  now: string
): EliasPsychoEducationMemoryPatch {
  const normalizedLabels = [
    "automatic_route_to_use",
    "approach_bias_trigger",
    "attentional_bias_to_substance_cue",
    "conditioned_trigger_response",
    "needs_route_interrupt_handle",
  ];

  const hints: EliasPsychoEducationMemoryHint[] = normalizedLabels.map((label) => ({
    hintId: `autopilot_${label}`,
    moduleId: "AUTOPILOT01",
    label: getLabelText("AUTOPILOT01", label),
    normalizedLabel: label,
    relevance: label.includes("route") ? "autopilot_craving" : "trigger_bias",
    firstDetectedAt: now,
    lastUpdatedAt: now,
    frequency: 1,
    lastUsedInGreetingAt: null,
    lastUsedInTurnAt: null,
  }));

  return {
    persona: "elias",
    moduleId: "AUTOPILOT01",
    storageTargets: ["user.dat", "projections.dat", "logs.dat"],
    userDatPatch: {
      psychoEducationPatternsToUpsert: hints,
      moduleUsageToIncrement: {
        moduleId: "AUTOPILOT01",
        lastActivatedAt: now,
        activationCountIncrement: 1,
      },
    },
    projectionsDatPatch: {
      beliefsToUpsert: [
        {
          beliefId: "autopilot_no_choice_belief",
          label: "Mijn lichaam beweegt soms al richting gebruik voordat ik bewust kies.",
          normalizedLabel: "autopilot_no_choice_belief",
          category: "autopilot_trigger_belief",
          sourceModuleId: "AUTOPILOT01",
          firstDetectedAt: now,
          lastUpdatedAt: now,
          decayScoreInitial: 0.72,
        },
      ],
      recoveryHandlesToUpsert: [
        {
          handleId: "interrupt_automatic_route",
          label: "De automatische route onderbreken bij de eerste cue.",
          normalizedLabel: "interrupt_automatic_route",
          sourceModuleId: "AUTOPILOT01",
          firstDetectedAt: now,
          lastUpdatedAt: now,
        },
      ],
    },
    logsDatPatch: {
      logEvent: {
        logId: `log_autopilot_${runtimeInput.sessionId}_${runtimeInput.turnId}`,
        sessionId: runtimeInput.sessionId,
        turnId: runtimeInput.turnId,
        timestampIso: now,
        moduleId: "AUTOPILOT01",
        responseMode: detection.responseMode,
        matchedMarkers: detection.matchedMarkers,
        memoryUseDirectiveWritten: true,
        rawTextStored: false,
        storePolicy: "local_elias_scoped_only",
      },
    },
  };
}

function getLabelText(moduleId: string, normalizedLabel: string): string {
  const labels: Record<string, string> = {
    self_blame_after_relapse: "Zelfverwijt na terugval",
    willpower_failure_belief: "Overtuiging dat wilskracht faalde",
    fast_impulse_vs_slow_control: "Snel impulssysteem vs. trage controle",
    needs_early_signal_recognition: "Vroeg signaal herkennen",
    automatic_route_to_use: "Automatische route richting gebruik",
    approach_bias_trigger: "Approach bias bij trigger",
    attentional_bias_to_substance_cue: "Aandachtsvernauwing bij middelcue",
    conditioned_trigger_response: "Geconditioneerde triggerrespons",
    needs_route_interrupt_handle: "Route-onderbreking nodig bij eerste cue",
  };
  return labels[normalizedLabel] ?? normalizedLabel;
}
