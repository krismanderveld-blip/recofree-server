/**
 * IKST01 - Ik-sterkte herstel Memory Patch Builder
 */
import type {
  EliasSelfAcceptanceMemoryPatch,
  ClusterBufferPatch,
  ClusterStateDatPatch,
  ClusterUserDatPatch,
  ClusterProjectionsDatPatch,
  ClusterLogsDatPatch,
} from "../../../types/eliasSelfAcceptanceCluster.types";
import type { Ikst01DetectionResult } from "./ikst01.detector";

interface PatchInput {
  detection: Ikst01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  currentZone: string;
  stabilizedEnoughForReflection: boolean;
  latestUserMessage: string;
}

export function buildIkst01MemoryPatch(input: PatchInput): EliasSelfAcceptanceMemoryPatch {
  const { detection, sessionId, turnId, timestampIso, currentZone, stabilizedEnoughForReflection } = input;

  const buffer: ClusterBufferPatch = {
    activeModuleId: "IKST01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective: "Hold the impulsive action context. Separate feeling from command. Do not shame impulsivity.",
    extractedCandidates: detection.matchedMarkers.slice(0, 5),
    expiresAtTurnEnd: true,
  };

  const stateDat: ClusterStateDatPatch = {
    activeTherapeuticFrame: "ego_strength_recovery",
    activeModuleId: "IKST01",
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
        moduleId: "IKST01",
        incrementBy: 1,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      },
      learnedPatterns: [
        {
          patternId: `ikst01_${detection.patternType}_${turnId}`,
          patternType: detection.patternType,
          label: detection.matchedMarkers[0] || detection.patternType,
          normalizedLabel: detection.patternType,
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "IKST01",
          neverUseAsDiagnosis: true,
        },
      ],
    };
  }

  // projections.dat: only when belief about self-control emerges
  let projectionsDat: ClusterProjectionsDatPatch | null = null;
  const msg = input.latestUserMessage.toLowerCase();
  const beliefPatterns = [
    { pattern: /ik kan mezelf niet vertrouwen/i, label: "ik kan mezelf niet vertrouwen" },
    { pattern: /i cannot trust myself/i, label: "I cannot trust myself" },
    { pattern: /ik ben impulsief/i, label: "ik ben impulsief (als identiteit)" },
    { pattern: /ik heb geen zelfcontrole/i, label: "ik heb geen zelfcontrole" },
    { pattern: /i have no self-control/i, label: "I have no self-control" },
  ];
  const detectedBeliefs = beliefPatterns.filter((b) => b.pattern.test(msg));
  if (detectedBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: detectedBeliefs.map((b) => ({
        beliefId: `ikst01_belief_${turnId}_${b.label.replace(/\s+/g, "_").slice(0, 20)}`,
        label: b.label,
        normalizedLabel: b.label.toLowerCase().replace(/\s+/g, "_"),
        sourceModuleId: "IKST01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsMutable: true as const,
      })),
      upsertHandles: [
        {
          handleId: "gevoel_is_geen_bevel",
          label: "Gevoel is geen bevel",
          instruction: "A feeling is information, not a command to act.",
          sourceModuleId: "IKST01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
        {
          handleId: "ik_sterkte_is_bouwbaar",
          label: "Ik-sterkte is bouwbaar",
          instruction: "Ego strength is buildable, not a fixed trait.",
          sourceModuleId: "IKST01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
      ],
    };
  }

  const logsDat: ClusterLogsDatPatch = {
    encryptedEventType: "therapeutic_module_activation",
    moduleId: "IKST01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: "IKST01 active: impulsive/emotion-led action pattern reflected without shaming impulsivity.",
    rawTextStored: false,
    storePolicy: "local_encrypted_only",
  };

  return {
    persona: "elias",
    moduleId: "IKST01",
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
      buffer: "Holds impulsive action context for this turn to separate feeling from command.",
      "state.dat": "Session-level ego-strength frame must persist across turns.",
      "user.dat": userDat ? "Durable impulsive pattern and moduleUsage belong to user profile." : undefined,
      "projections.dat": projectionsDat ? "Self-control belief detected; handles needed for reframing." : undefined,
      "logs.dat": "Encrypted continuity for ego-strength building.",
    },
  };
}
