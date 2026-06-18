/**
 * CODEP-K01 Memory Patch Builder
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
import type { CodepK01DetectionResult } from "./codepK01.detector";

export interface CodepK01MemoryPatchInput {
  detection: CodepK01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  latestUserMessage: string;
  currentKimZone: string;
  stabilizedEnoughForReflection: boolean;
}

export function buildCodepK01MemoryPatch(input: CodepK01MemoryPatchInput): KimPatternMemoryPatch {
  const { detection, sessionId, turnId, timestampIso } = input;

  const buffer: KimPatternBufferPatch = {
    activeModuleId: "CODEP-K01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective:
      "Use CODEP-K01 codependency pattern data at every relevant Kim turn. NEVER use the word 'codependent'. Name patterns without labeling. Not keyword-gated.",
    extractedCandidatePatterns: [],
    expiresAtTurnEnd: true,
  };

  const layerJustification: KimPatternMemoryLayerJustification = {
    buffer: "mandatory_current_turn_context",
  };

  let stateDat: KimPatternStateDatPatch | undefined;
  if (detection.activationStatus === "ACTIVE") {
    stateDat = {
      activeKimReflectiveFrame: "caregiver_codependency_awareness",
      activeModuleId: "CODEP-K01",
      currentKimZoneAtActivation: input.currentKimZone as KimPatternStateDatPatch["currentKimZoneAtActivation"],
      lastActivatedAt: timestampIso,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    };
    layerJustification.stateDat = "reflective_frame_opened_for_codependency_pattern_awareness";
  }

  const userDat: KimPatternUserDatPatch = {
    moduleUsage: {
      moduleId: "CODEP-K01",
      incrementBy: 1,
      firstDetectedAt: timestampIso,
      lastUpdatedAt: timestampIso,
    },
    upsertLearnedKimPatterns: detection.matchedMarkerGroups.includes("identityFusion")
      ? [{
          patternId: `codep-k01-fusion-${Date.now()}`,
          patternType: "identity_fusion",
          label: detection.matchedMarkers[0] || "identiteitsfusie",
          normalizedLabel: (detection.matchedMarkers[0] || "identiteitsfusie").toLowerCase(),
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "CODEP-K01",
          neverUseAsDiagnosis: true,
        }]
      : detection.matchedMarkerGroups.includes("rescueBehavior")
        ? [{
            patternId: `codep-k01-rescue-${Date.now()}`,
            patternType: "rescue_behavior",
            label: detection.matchedMarkers[0] || "reddingsgedrag",
            normalizedLabel: (detection.matchedMarkers[0] || "reddingsgedrag").toLowerCase(),
            confidence: detection.confidenceScore,
            firstDetectedAt: timestampIso,
            lastUpdatedAt: timestampIso,
            sourceModuleId: "CODEP-K01",
            neverUseAsDiagnosis: true,
          }]
        : detection.matchedMarkerGroups.includes("boundaryAbsence")
          ? [{
              patternId: `codep-k01-boundary-${Date.now()}`,
              patternType: "boundary_absence",
              label: detection.matchedMarkers[0] || "grensverlies",
              normalizedLabel: (detection.matchedMarkers[0] || "grensverlies").toLowerCase(),
              confidence: detection.confidenceScore,
              firstDetectedAt: timestampIso,
              lastUpdatedAt: timestampIso,
              sourceModuleId: "CODEP-K01",
              neverUseAsDiagnosis: true,
            }]
          : detection.matchedMarkerGroups.includes("selfNeglect")
            ? [{
                patternId: `codep-k01-neglect-${Date.now()}`,
                patternType: "self_neglect",
                label: detection.matchedMarkers[0] || "zelfverwaarlozing",
                normalizedLabel: (detection.matchedMarkers[0] || "zelfverwaarlozing").toLowerCase(),
                confidence: detection.confidenceScore,
                firstDetectedAt: timestampIso,
                lastUpdatedAt: timestampIso,
                sourceModuleId: "CODEP-K01",
                neverUseAsDiagnosis: true,
              }]
            : undefined,
  };
  layerJustification.userDat = "module_usage_tracking_and_durable_codependency_pattern_storage";

  // projections.dat — only when strong belief extracted
  let projectionsDat: KimPatternProjectionsDatPatch | undefined;
  const beliefMarkers = [
    "zonder hem ben ik niets",
    "ik besta alleen als hij er is",
    "hij kan niet zonder mij",
    "ik ben de enige die hem kan helpen",
    "ik weet niet waar hij ophoudt en ik begin",
  ];
  const msgLower = input.latestUserMessage.toLowerCase();
  const foundBeliefs = beliefMarkers.filter(b => msgLower.includes(b));
  if (foundBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: foundBeliefs.map(b => ({
        beliefId: `codep-k01-belief-${b.replace(/\s+/g, "-")}`,
        label: b,
        normalizedLabel: b.toLowerCase(),
        sourceModuleId: "CODEP-K01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsPatternNotDiagnosis: true as const,
      })),
      upsertHandles: [{
        handleId: `codep-k01-handle-pattern-awareness`,
        label: "Codependentie-patroon herkenning",
        instruction: "Kim herkent fusie/reddings/grensverlies-patronen. Benoem zonder het woord 'codependent' te gebruiken.",
        sourceModuleId: "CODEP-K01" as const,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      }],
    };
    layerJustification.projectionsDat = "belief_or_handle_extracted_from_codependency_pattern_awareness";
  }

  const logsDat: KimPatternLogsDatPatch = {
    encryptedEventType: "kim_therapeutic_module_activation",
    moduleId: "CODEP-K01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: `CODEP-K01 activated: ${detection.selectedInterventionType}`,
    rawTextStored: false,
    storePolicy: "local_kim_encrypted_only",
  };
  layerJustification.logsDat = "encrypted_historical_continuity_with_safe_summaries";

  return {
    persona: "kim",
    moduleId: "CODEP-K01",
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
