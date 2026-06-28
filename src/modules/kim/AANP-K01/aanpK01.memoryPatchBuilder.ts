/**
 * AANP-K01 Memory Patch Builder
 */

import type {
  KimPatternMemoryPatch,
  KimPatternBufferPatch,
  KimPatternStateDatPatch,
  KimPatternUserDatPatch,
  KimPatternProjectionsDatPatch,
  KimPatternLogsDatPatch,
  KimPatternMemoryLayerJustification,
} from "@/src/types/kimPatternsSupport.types";
import type { AanpK01DetectionResult } from "./aanpK01.detector";
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface AanpK01MemoryPatchInput {
  detection: AanpK01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  latestUserMessage: string;
  currentKimZone: string;
  stabilizedEnoughForReflection: boolean;
}

export function buildAanpK01MemoryPatch(input: AanpK01MemoryPatchInput): KimPatternMemoryPatch {
  const { detection, sessionId, turnId, timestampIso } = input;

  const buffer: KimPatternBufferPatch = {
    activeModuleId: "AANP-K01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective:
      "Use AANP-K01 adaptation/covering-up pattern data at every relevant Kim turn. Do not push Kim to disclose. Not keyword-gated.",
    extractedCandidatePatterns: [],
    expiresAtTurnEnd: true,
  };

  const layerJustification: KimPatternMemoryLayerJustification = {
    buffer: "mandatory_current_turn_context",
  };

  let stateDat: KimPatternStateDatPatch | undefined;
  if (detection.activationStatus === "ACTIVE") {
    stateDat = {
      activeKimReflectiveFrame: "caregiver_adaptation_pattern",
      activeModuleId: "AANP-K01",
      currentKimZoneAtActivation: input.currentKimZone as KimPatternStateDatPatch["currentKimZoneAtActivation"],
      lastActivatedAt: timestampIso,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    };
    layerJustification.stateDat = "reflective_frame_opened_for_caregiver_adaptation_pattern_awareness";
  }

  const userDat: KimPatternUserDatPatch = {
    moduleUsage: {
      moduleId: "AANP-K01",
      incrementBy: 1,
      firstDetectedAt: timestampIso,
      lastUpdatedAt: timestampIso,
    },
    upsertLearnedKimPatterns: detection.matchedMarkerGroups.includes("coveringUp")
      ? [{
          patternId: `aanp-k01-covering-${LocalDeviceTimeService.now().epochMs}`,
          patternType: "covering_up",
          label: detection.matchedMarkers[0] || "schijn ophouden",
          normalizedLabel: (detection.matchedMarkers[0] || "schijn ophouden").toLowerCase(),
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "AANP-K01",
          neverUseAsDiagnosis: true,
        }]
      : detection.matchedMarkerGroups.includes("selfErasure")
        ? [{
            patternId: `aanp-k01-erasure-${LocalDeviceTimeService.now().epochMs}`,
            patternType: "self_erasure",
            label: detection.matchedMarkers[0] || "zelfuitwissing",
            normalizedLabel: (detection.matchedMarkers[0] || "zelfuitwissing").toLowerCase(),
            confidence: detection.confidenceScore,
            firstDetectedAt: timestampIso,
            lastUpdatedAt: timestampIso,
            sourceModuleId: "AANP-K01",
            neverUseAsDiagnosis: true,
          }]
        : detection.matchedMarkerGroups.includes("keepingUpAppearances")
          ? [{
              patternId: `aanp-k01-appearances-${LocalDeviceTimeService.now().epochMs}`,
              patternType: "keeping_up_appearances",
              label: detection.matchedMarkers[0] || "schijn ophouden",
              normalizedLabel: (detection.matchedMarkers[0] || "schijn ophouden").toLowerCase(),
              confidence: detection.confidenceScore,
              firstDetectedAt: timestampIso,
              lastUpdatedAt: timestampIso,
              sourceModuleId: "AANP-K01",
              neverUseAsDiagnosis: true,
            }]
          : undefined,
  };
  layerJustification.userDat = "module_usage_tracking_and_durable_caregiver_adaptation_pattern_storage";

  let projectionsDat: KimPatternProjectionsDatPatch | undefined;
  const beliefMarkers = [
    "ik verlies mezelf",
    "ik weet niet meer wie ik ben",
    "het vreet aan me",
  ];
  const msgLower = input.latestUserMessage.toLowerCase();
  const foundBeliefs = beliefMarkers.filter(b => msgLower.includes(b));
  if (foundBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: foundBeliefs.map(b => ({
        beliefId: `aanp-k01-belief-${b.replace(/\s+/g, "-")}`,
        label: b,
        normalizedLabel: b.toLowerCase(),
        sourceModuleId: "AANP-K01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsPatternNotDiagnosis: true as const,
      })),
      upsertHandles: [],
    };
    layerJustification.projectionsDat = "belief_extracted_from_caregiver_adaptation_pattern_awareness";
  }

  const logsDat: KimPatternLogsDatPatch = {
    encryptedEventType: "kim_therapeutic_module_activation",
    moduleId: "AANP-K01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: `AANP-K01 activated: ${detection.selectedInterventionType}`,
    rawTextStored: false,
    storePolicy: "local_kim_encrypted_only",
  };
  layerJustification.logsDat = "encrypted_historical_continuity_with_safe_summaries";

  return {
    persona: "kim",
    moduleId: "AANP-K01",
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
