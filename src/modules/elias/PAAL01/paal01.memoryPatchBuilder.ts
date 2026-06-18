/**
 * PAAL01 — Memory patch builder
 * Builds memory patches with conditional layer writing and explicit justification.
 * Aligned with PAAL01 spec V1.
 *
 * Layer rules:
 * - buffer: ALWAYS mandatory (current turn context)
 * - state.dat: ONLY when session reflective frame is active (STABLE_REFLECTION or FIRST_USE)
 * - user.dat: ALWAYS on activation (module usage increment + confirmed steunpilaren)
 * - projections.dat: ONLY for protective beliefs/handles (isolation belief detection)
 * - logs.dat: ALWAYS on activation (encrypted event)
 */

import type {
  SteunpilarenDetectionResult,
  SteunpilarenRuntimeInput,
  SteunpilarenMemoryPatch,
  SteunpilarenStateDatPatch,
  SteunpilarenProjectionsDatPatch,
  Paal01MemoryLayerJustification,
  StoredSteunpilaar,
} from "@/src/types/eliasSteunpilaren.types";
import { PAAL01_NL_MARKERS } from "./paal01.markerBank.nl";
import { PAAL01_EN_MARKERS } from "./paal01.markerBank.en";

/**
 * Detects if the user expresses a strong isolation belief.
 */
function detectIsolationBelief(message: string): boolean {
  const lower = message.toLowerCase();
  const allIsolationMarkers = [
    ...PAAL01_NL_MARKERS.isolationBelief,
    ...PAAL01_EN_MARKERS.isolationBelief,
  ];
  return allIsolationMarkers.some((m) => lower.includes(m));
}

/**
 * Builds optional projections.dat patch when strong isolation belief detected.
 */
function buildProjectionsPatch(
  input: SteunpilarenRuntimeInput
): SteunpilarenProjectionsDatPatch | null {
  if (!detectIsolationBelief(input.latestUserMessage)) {
    return null;
  }

  const now = input.timestampIso;
  return {
    upsertBeliefs: [
      {
        beliefId: `paal01_belief_perceived_isolation_${input.turnId}`,
        label: "ik sta er alleen voor",
        normalizedLabel: "perceived_isolation",
        sourceModuleId: "PAAL01",
        confidence: 0.70,
        firstDetectedAt: now,
        lastUpdatedAt: now,
        mustFrameAsLearnedRule: true,
      },
    ],
    upsertHandles: [
      {
        handleId: `paal01_handle_niet_alleen_${input.turnId}`,
        label: "niet_alleen",
        instruction:
          "Je hoeft niet alles alleen te dragen. Eén persoon, één routine, één plek kan al een pilaar zijn.",
        sourceModuleId: "PAAL01",
        firstDetectedAt: now,
        lastUpdatedAt: now,
      },
    ],
  };
}

/**
 * Determines if state.dat should be written.
 * Per spec: only when session reflective frame is active.
 */
function shouldWriteStateDat(detection: SteunpilarenDetectionResult): boolean {
  return (
    detection.triggerContext === "STABLE_REFLECTION" ||
    detection.triggerContext === "FIRST_USE_INTRODUCTION"
  );
}

/**
 * Builds state.dat patch when justified.
 */
function buildStateDatPatch(
  detection: SteunpilarenDetectionResult,
  runtimeInput: SteunpilarenRuntimeInput
): SteunpilarenStateDatPatch | null {
  if (!shouldWriteStateDat(detection)) return null;

  return {
    activeReflectiveFeature: detection.shouldIntroduceBalanceFeature
      ? "balance_bar"
      : "support_pillars",
    activeModuleId: "PAAL01",
    currentZoneAtActivation: runtimeInput.currentZone,
    lastActivatedAt: runtimeInput.timestampIso,
    stabilizedEnoughForReflection: runtimeInput.stabilizedEnoughForReflection,
  };
}

/**
 * Builds the layer justification object.
 */
function buildLayerJustification(
  detection: SteunpilarenDetectionResult,
  hasProjections: boolean
): Paal01MemoryLayerJustification {
  const justification: Paal01MemoryLayerJustification = {
    buffer: "mandatory_current_turn_context",
    userDat: "module_usage_increment_and_confirmed_steunpilaren_storage",
    logsDat: "encrypted_event_logging_for_audit_trail",
  };

  if (shouldWriteStateDat(detection)) {
    justification.stateDat = "session_reflective_frame_active_for_" + detection.triggerContext;
  }

  if (hasProjections) {
    justification.projectionsDat = "isolation_belief_detected_requires_protective_handle_storage";
  }

  return justification;
}

export function buildPaal01MemoryPatch(input: {
  detection: SteunpilarenDetectionResult;
  runtimeInput: SteunpilarenRuntimeInput;
  newSteunpilaren?: StoredSteunpilaar[];
}): SteunpilarenMemoryPatch | null {
  const { detection, runtimeInput, newSteunpilaren } = input;

  // Only write on ACTIVE status (OFFER_AS_FOLLOWUP does not write)
  if (detection.activationStatus !== "ACTIVE") {
    return null;
  }

  // Guard: Elias only, no crisis
  if (runtimeInput.persona !== "elias") return null;
  if (runtimeInput.crisisDetected) return null;

  const now = runtimeInput.timestampIso;
  const projectionsDat = buildProjectionsPatch(runtimeInput);
  const stateDat = buildStateDatPatch(detection, runtimeInput);

  return {
    persona: "elias",
    moduleId: "PAAL01",
    activationTimestampIso: now,
    sessionId: runtimeInput.sessionId,
    turnId: runtimeInput.turnId,
    writes: {
      buffer: {
        activeModuleId: "PAAL01",
        activeInterventionType: detection.selectedInterventionType,
        activeTriggerContext: detection.triggerContext,
        currentTurnDirective:
          "Use steunpilaren-inventaris framing in this turn. Invite reflection on existing supports. Do not diagnose absence. Do not score.",
        candidatePillars: [],
        candidateBalanceItems: [],
        expiresAtTurnEnd: true,
      },
      stateDat,
      userDat: {
        moduleUsage: {
          moduleId: "PAAL01",
          incrementBy: 1,
          firstDetectedAt: now,
          lastUpdatedAt: now,
        },
        steunpilaren: newSteunpilaren ?? [],
      },
      projectionsDat,
      logsDat: {
        encryptedEventType: "therapeutic_module_activation",
        moduleId: "PAAL01",
        timestampIso: now,
        sessionId: runtimeInput.sessionId,
        turnId: runtimeInput.turnId,
        safeSummary: `PAAL01 active: ${detection.selectedInterventionType} via ${detection.triggerContext}. ${runtimeInput.existingEliasSteunpilarenHints.storedSteunpilaren.length} existing pilaren referenced.`,
        matchedMarkers: detection.matchedMarkers,
        rawTextStored: false,
        storePolicy: "local_encrypted_only",
      },
    },
    layerJustification: buildLayerJustification(detection, projectionsDat !== null),
  };
}
