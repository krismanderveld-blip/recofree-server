/**
 * BEHE-K01 Memory Patch Builder
 *
 * Buffer: always. state.dat: when frame opened. user.dat: pattern tracking.
 * projections.dat: when belief extracted. logs.dat: on activation.
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
import type { BeheK01DetectionResult } from "./beheK01.detector";
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface BeheK01MemoryPatchInput {
  detection: BeheK01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  latestUserMessage: string;
  currentKimZone: string;
  stabilizedEnoughForReflection: boolean;
}

export function buildBeheK01MemoryPatch(input: BeheK01MemoryPatchInput): KimPatternMemoryPatch {
  const { detection, sessionId, turnId, timestampIso } = input;

  const buffer: KimPatternBufferPatch = {
    activeModuleId: "BEHE-K01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective:
      "Use BEHE-K01 caregiver control pattern data at every relevant Kim turn. Name patterns without blaming. Not keyword-gated. Not limited to greeting.",
    extractedCandidatePatterns: [],
    expiresAtTurnEnd: true,
  };

  const layerJustification: KimPatternMemoryLayerJustification = {
    buffer: "mandatory_current_turn_context",
  };

  // state.dat — when reflective frame opened
  let stateDat: KimPatternStateDatPatch | undefined;
  if (detection.activationStatus === "ACTIVE") {
    stateDat = {
      activeKimReflectiveFrame: "caregiver_control_pattern",
      activeModuleId: "BEHE-K01",
      currentKimZoneAtActivation: input.currentKimZone as KimPatternStateDatPatch["currentKimZoneAtActivation"],
      lastActivatedAt: timestampIso,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    };
    layerJustification.stateDat = "reflective_frame_opened_for_caregiver_control_pattern_awareness";
  }

  // user.dat — module usage + pattern tracking
  const userDat: KimPatternUserDatPatch = {
    moduleUsage: {
      moduleId: "BEHE-K01",
      incrementBy: 1,
      firstDetectedAt: timestampIso,
      lastUpdatedAt: timestampIso,
    },
    upsertLearnedKimPatterns: detection.matchedMarkerGroups.includes("controlBehavior")
      ? [{
          patternId: `behe-k01-control-${LocalDeviceTimeService.now().epochMs}`,
          patternType: "caregiver_control",
          label: detection.matchedMarkers[0] || "controlegedrag",
          normalizedLabel: (detection.matchedMarkers[0] || "controlegedrag").toLowerCase(),
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "BEHE-K01",
          neverUseAsDiagnosis: true,
        }]
      : undefined,
  };
  layerJustification.userDat = "module_usage_tracking_and_durable_caregiver_control_pattern_storage";

  // projections.dat — only when belief extracted
  let projectionsDat: KimPatternProjectionsDatPatch | undefined;
  const beliefMarkers = [
    "ik weet dat het niet helpt",
    "ik doe het automatisch",
    "het is een patroon",
    "ik herken het bij mezelf",
  ];
  const msgLower = input.latestUserMessage.toLowerCase();
  const foundBeliefs = beliefMarkers.filter(b => msgLower.includes(b));
  if (foundBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: foundBeliefs.map(b => ({
        beliefId: `behe-k01-belief-${b.replace(/\s+/g, "-")}`,
        label: b,
        normalizedLabel: b.toLowerCase(),
        sourceModuleId: "BEHE-K01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsPatternNotDiagnosis: true as const,
      })),
      upsertHandles: [{
        handleId: `behe-k01-handle-control-awareness`,
        label: "Controlepatroon herkenning",
        instruction: "Kim herkent controlegedrag als patroon. Benoem zonder te beschuldigen.",
        sourceModuleId: "BEHE-K01" as const,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      }],
    };
    layerJustification.projectionsDat = "belief_or_handle_extracted_from_caregiver_control_pattern_awareness";
  }

  // logs.dat — on activation
  const logsDat: KimPatternLogsDatPatch = {
    encryptedEventType: "kim_therapeutic_module_activation",
    moduleId: "BEHE-K01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: `BEHE-K01 activated: ${detection.selectedInterventionType}`,
    rawTextStored: false,
    storePolicy: "local_kim_encrypted_only",
  };
  layerJustification.logsDat = "encrypted_historical_continuity_with_safe_summaries";

  return {
    persona: "kim",
    moduleId: "BEHE-K01",
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
