/**
 * PAAL01 — Memory patch builder
 * Builds memory patches for all mandatory layers + optional projections.dat
 */

import type {
  SteunpilarenDetectionResult,
  SteunpilarenRuntimeInput,
  SteunpilarenMemoryPatch,
  SteunpilarenProjectionsDatPatch,
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

export function buildPaal01MemoryPatch(input: {
  detection: SteunpilarenDetectionResult;
  runtimeInput: SteunpilarenRuntimeInput;
  newSteunpilaren?: StoredSteunpilaar[];
}): SteunpilarenMemoryPatch | null {
  const { detection, runtimeInput, newSteunpilaren } = input;

  // Only write on ACTIVE status
  if (detection.activationStatus !== "ACTIVE") {
    return null;
  }

  // Guard: Elias only, no crisis
  if (runtimeInput.persona !== "elias") return null;
  if (runtimeInput.crisisDetected) return null;

  const now = runtimeInput.timestampIso;

  return {
    persona: "elias",
    moduleId: "PAAL01",
    activationTimestampIso: now,
    sessionId: runtimeInput.sessionId,
    turnId: runtimeInput.turnId,
    writes: {
      buffer: {
        activeModuleId: "PAAL01",
        activeTriggerContext: detection.triggerContext,
        currentTurnDirective:
          "Use steunpilaren-inventaris framing in this turn. Invite reflection on existing supports. Do not diagnose absence. Do not score.",
        expiresAtTurnEnd: true,
      },
      stateDat: {
        activeTherapeuticFrame: "steunpilaren_inventaris",
        activeModuleId: "PAAL01",
        currentZoneAtActivation: runtimeInput.currentZone,
        lastActivatedAt: now,
        lastActivationTurnId: runtimeInput.turnId,
        crisisOverrideAtActivation: false,
      },
      userDat: {
        moduleUsage: {
          moduleId: "PAAL01",
          incrementBy: 1,
          firstDetectedAt: now,
          lastUpdatedAt: now,
        },
        steunpilaren: newSteunpilaren ?? [],
      },
      projectionsDat: buildProjectionsPatch(runtimeInput),
      logsDat: {
        encryptedEventType: "therapeutic_module_activation",
        moduleId: "PAAL01",
        timestampIso: now,
        sessionId: runtimeInput.sessionId,
        turnId: runtimeInput.turnId,
        safeSummary: `PAAL01 active: steunpilaren inventaris offered as ${detection.triggerContext}. ${runtimeInput.existingEliasSteunpilarenHints.storedSteunpilaren.length} existing pilaren referenced.`,
        matchedMarkers: detection.matchedMarkers,
        rawTextStored: false,
        storePolicy: "local_encrypted_only",
      },
    },
  };
}
