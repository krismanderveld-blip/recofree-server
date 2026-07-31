/**
 * COEX01 - Co-existentie verantwoordelijkheid Memory Patch Builder
 */
import type {
  EliasSelfAcceptanceMemoryPatch,
  ClusterBufferPatch,
  ClusterStateDatPatch,
  ClusterUserDatPatch,
  ClusterProjectionsDatPatch,
  ClusterLogsDatPatch,
} from "../../../../types/eliasSelfAcceptanceCluster.types";
import type { Coex01DetectionResult } from "./coex01.detector";

interface PatchInput {
  detection: Coex01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  currentZone: string;
  stabilizedEnoughForReflection: boolean;
  latestUserMessage: string;
}

export function buildCoex01MemoryPatch(input: PatchInput): EliasSelfAcceptanceMemoryPatch {
  const { detection, sessionId, turnId, timestampIso, currentZone, stabilizedEnoughForReflection } = input;

  const buffer: ClusterBufferPatch = {
    activeModuleId: "COEX01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective: "Hold blame/responsibility context. Separate fault from responsibility. Do not remove agency or add total blame.",
    extractedCandidates: detection.matchedMarkers.slice(0, 5),
    expiresAtTurnEnd: true,
  };

  const stateDat: ClusterStateDatPatch = {
    activeTherapeuticFrame: "existential_acceptance",
    activeModuleId: "COEX01",
    currentZoneAtActivation: currentZone,
    lastActivatedAt: timestampIso,
    lastActivationTurnId: turnId,
    stabilizedEnoughForReflection,
    bridgeCandidateModules: detection.recommendedBridgeModules,
  };

  // user.dat: when pattern is identified
  let userDat: ClusterUserDatPatch | null = null;
  if (detection.patternType !== "unknown") {
    userDat = {
      moduleUsage: {
        moduleId: "COEX01",
        incrementBy: 1,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      },
      learnedPatterns: [
        {
          patternId: `coex01_${detection.patternType}_${turnId}`,
          patternType: detection.patternType,
          label: detection.matchedMarkers[0] || detection.patternType,
          normalizedLabel: detection.patternType,
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "COEX01",
          neverUseAsDiagnosis: true,
        },
      ],
    };
  }

  // projections.dat: when blame belief is detected
  let projectionsDat: ClusterProjectionsDatPatch | null = null;
  const msg = input.latestUserMessage.toLowerCase();
  const beliefPatterns = [
    { pattern: /alles is mijn schuld/i, label: "alles is mijn schuld" },
    { pattern: /everything is my fault/i, label: "everything is my fault" },
    { pattern: /het is hun schuld/i, label: "het is hun schuld" },
    { pattern: /it is their fault/i, label: "it is their fault" },
    { pattern: /ik verdien geen hulp/i, label: "ik verdien geen hulp" },
    { pattern: /het maakt toch niet uit/i, label: "het maakt toch niet uit" },
  ];
  const detectedBeliefs = beliefPatterns.filter((b) => b.pattern.test(msg));
  if (detectedBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: detectedBeliefs.map((b) => ({
        beliefId: `coex01_belief_${turnId}_${b.label.replace(/\s+/g, "_").slice(0, 20)}`,
        label: b.label,
        normalizedLabel: b.label.toLowerCase().replace(/\s+/g, "_"),
        sourceModuleId: "COEX01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsMutable: true as const,
      })),
      upsertHandles: [
        {
          handleId: "schuld_is_niet_verantwoordelijkheid",
          label: "Schuld is niet verantwoordelijkheid",
          instruction: "Fault is about the past; responsibility is about the next step.",
          sourceModuleId: "COEX01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
        {
          handleId: "een_volgende_stap_niet_alle",
          label: "Eén volgende stap, niet alle",
          instruction: "Take one next step without owning all steps or none.",
          sourceModuleId: "COEX01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
      ],
    };
  }

  const logsDat: ClusterLogsDatPatch = {
    encryptedEventType: "therapeutic_module_activation",
    moduleId: "COEX01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: "COEX01 active: blame/responsibility pattern processed without removing agency or adding total blame.",
    rawTextStored: false,
    storePolicy: "local_encrypted_only",
  };

  return {
    persona: "elias",
    moduleId: "COEX01",
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
    layerJustification: {
      buffer: "Holds blame/responsibility context for this turn.",
      "state.dat": "Session-level responsibility frame must persist across turns.",
      "user.dat": userDat ? "Durable blame pattern and moduleUsage belong to user profile." : undefined,
      "projections.dat": projectionsDat ? "Blame belief detected; handles needed for reframing." : undefined,
      "logs.dat": "Encrypted continuity for responsibility pattern.",
    },
  };
}
