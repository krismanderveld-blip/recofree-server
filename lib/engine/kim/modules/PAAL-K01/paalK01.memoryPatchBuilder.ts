/**
 * PAAL-K01 Memory Patch Builder
 *
 * Buffer: always. state.dat: when reflective frame opened. user.dat: when pillar confirmed.
 * projections.dat: only when belief/handle extracted. logs.dat: on activation.
 */

import type {
  KimPatternMemoryPatch,
  KimPatternBufferPatch,
  KimPatternStateDatPatch,
  KimPatternUserDatPatch,
  KimPatternProjectionsDatPatch,
  KimPatternLogsDatPatch,
  KimPatternMemoryLayerJustification,
} from "@/lib/types/kimPatternsSupport.types";
import type { PaalK01DetectionResult } from "./paalK01.detector";

export interface PaalK01MemoryPatchInput {
  detection: PaalK01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  latestUserMessage: string;
  currentKimZone: string;
  stabilizedEnoughForReflection: boolean;
  existingPillarCount: number;
}

export function buildPaalK01MemoryPatch(input: PaalK01MemoryPatchInput): KimPatternMemoryPatch {
  const { detection, sessionId, turnId, timestampIso } = input;

  // Buffer — always mandatory
  const buffer: KimPatternBufferPatch = {
    activeModuleId: "PAAL-K01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective:
      "Use PAAL-K01 Kim-only support pillar/balance data at every relevant Kim turn. Not keyword-gated. Not limited to greeting. Do not mention storage. Do not use Elias data.",
    extractedCandidatePatterns: [],
    expiresAtTurnEnd: true,
  };

  const layerJustification: KimPatternMemoryLayerJustification = {
    buffer: "mandatory_current_turn_context",
  };

  // state.dat — when reflective frame opened or balance feature introduced
  let stateDat: KimPatternStateDatPatch | undefined;
  const frameInterventions = [
    "INTRODUCE_KIM_SUPPORT_PILLARS",
    "KIM_BALANCE_BAR_INTRODUCTION",
    "INVENTORY_KIM_PEOPLE_ROUTINES_PLACES_BELIEFS",
    "POST_DIFFICULT_MOMENT_RECONNECT",
  ];
  if (frameInterventions.includes(detection.selectedInterventionType)) {
    stateDat = {
      activeKimReflectiveFrame: "kim_support_pillars",
      activeModuleId: "PAAL-K01",
      currentKimZoneAtActivation: input.currentKimZone as KimPatternStateDatPatch["currentKimZoneAtActivation"],
      lastActivatedAt: timestampIso,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    };
    layerJustification.stateDat = "reflective_frame_opened_for_kim_support_pillar_inventory";
  }

  // user.dat — moduleUsage always, pillars when confirmed
  const userDat: KimPatternUserDatPatch = {
    moduleUsage: {
      moduleId: "PAAL-K01",
      incrementBy: 1,
      firstDetectedAt: timestampIso,
      lastUpdatedAt: timestampIso,
    },
  };
  layerJustification.userDat = "module_usage_tracking_and_durable_kim_support_pillar_storage";

  // projections.dat — only when belief/handle extracted
  let projectionsDat: KimPatternProjectionsDatPatch | undefined;
  const beliefMarkers = [
    "ik mag ook steun nodig hebben",
    "mijn welzijn telt ook",
    "ik ben meer dan de zorgrol",
  ];
  const msgLower = input.latestUserMessage.toLowerCase();
  const foundBeliefs = beliefMarkers.filter(b => msgLower.includes(b));
  if (foundBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: foundBeliefs.map(b => ({
        beliefId: `paal-k01-belief-${b.replace(/\s+/g, "-")}`,
        label: b,
        normalizedLabel: b.toLowerCase(),
        sourceModuleId: "PAAL-K01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsPatternNotDiagnosis: true as const,
      })),
      upsertHandles: [],
    };
    layerJustification.projectionsDat = "belief_or_handle_extracted_from_kim_support_reflection";
  }

  // logs.dat — on activation
  const logsDat: KimPatternLogsDatPatch = {
    encryptedEventType: "kim_therapeutic_module_activation",
    moduleId: "PAAL-K01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: `PAAL-K01 activated: ${detection.selectedInterventionType}`,
    rawTextStored: false,
    storePolicy: "local_kim_encrypted_only",
  };
  layerJustification.logsDat = "encrypted_historical_continuity_with_safe_summaries";

  return {
    persona: "kim",
    moduleId: "PAAL-K01",
    activationTimestampIso: timestampIso,
    sessionId,
    turnId,
    writes: {
      buffer,
      stateDat,
      userDat,
      projectionsDat,
      logsDat,
    },
    layerJustification,
  };
}
