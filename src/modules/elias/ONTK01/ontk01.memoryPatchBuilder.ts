/**
 * ONTK01 - Ontkenningspatroon Memory Patch Builder
 */
import type {
  EliasSelfAcceptanceMemoryPatch,
  ClusterBufferPatch,
  ClusterStateDatPatch,
  ClusterUserDatPatch,
  ClusterProjectionsDatPatch,
  ClusterLogsDatPatch,
} from "../../../types/eliasSelfAcceptanceCluster.types";
import type { Ontk01DetectionResult } from "./ontk01.detector";

interface PatchInput {
  detection: Ontk01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  currentZone: string;
  stabilizedEnoughForReflection: boolean;
  latestUserMessage: string;
}

export function buildOntk01MemoryPatch(input: PatchInput): EliasSelfAcceptanceMemoryPatch {
  const { detection, sessionId, turnId, timestampIso, currentZone, stabilizedEnoughForReflection } = input;

  const buffer: ClusterBufferPatch = {
    activeModuleId: "ONTK01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective: "Hold current permission/minimization sentence for this turn. Mirror gently without accusing.",
    extractedCandidates: detection.matchedMarkers.slice(0, 5),
    expiresAtTurnEnd: true,
  };

  // state.dat: relevant when ONTK01 is active in current session
  const stateDat: ClusterStateDatPatch = {
    activeTherapeuticFrame: "denial_pattern_reflection",
    activeModuleId: "ONTK01",
    currentZoneAtActivation: currentZone,
    lastActivatedAt: timestampIso,
    lastActivationTurnId: turnId,
    stabilizedEnoughForReflection,
    bridgeCandidateModules: [],
  };

  // user.dat: relevant when pattern is repeated or clearly present
  let userDat: ClusterUserDatPatch | null = null;
  if (detection.patternType !== "unknown") {
    userDat = {
      moduleUsage: {
        moduleId: "ONTK01",
        incrementBy: 1,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      },
      learnedPatterns: [
        {
          patternId: `ontk01_${detection.patternType}_${turnId}`,
          patternType: detection.patternType === "minimization" ? "use_minimization" : "use_rationalization",
          label: detection.matchedMarkers[0] || detection.patternType,
          normalizedLabel: detection.patternType,
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "ONTK01",
          neverUseAsDiagnosis: true,
        },
      ],
    };
  }

  // projections.dat: relevant when permission sentence / belief appears
  let projectionsDat: ClusterProjectionsDatPatch | null = null;
  const msg = input.latestUserMessage.toLowerCase();
  const beliefPatterns = [
    { pattern: /één keer kan geen kwaad/i, label: "één keer kan geen kwaad" },
    { pattern: /once cannot hurt/i, label: "once cannot hurt" },
    { pattern: /ik heb het onder controle/i, label: "ik heb het onder controle" },
    { pattern: /i have it under control/i, label: "I have it under control" },
    { pattern: /vanaf morgen stop ik/i, label: "vanaf morgen stop ik" },
    { pattern: /i will stop tomorrow/i, label: "I will stop tomorrow" },
    { pattern: /het valt wel mee/i, label: "het valt wel mee" },
  ];
  const detectedBeliefs = beliefPatterns.filter((b) => b.pattern.test(msg));
  if (detectedBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: detectedBeliefs.map((b) => ({
        beliefId: `ontk01_belief_${turnId}_${b.label.replace(/\s+/g, "_").slice(0, 20)}`,
        label: b.label,
        normalizedLabel: b.label.toLowerCase().replace(/\s+/g, "_"),
        sourceModuleId: "ONTK01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsMutable: true as const,
      })),
      upsertHandles: [
        {
          handleId: "toestemmingszin_herkennen",
          label: "Toestemmingszin herkennen",
          instruction: "Identify the sentence that gives permission before action.",
          sourceModuleId: "ONTK01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
        {
          handleId: "eerlijk_zonder_schaamte",
          label: "Eerlijk zonder schaamte",
          instruction: "Name the fact without self-attack.",
          sourceModuleId: "ONTK01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
      ],
    };
  }

  const logsDat: ClusterLogsDatPatch = {
    encryptedEventType: "therapeutic_module_activation",
    moduleId: "ONTK01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: "ONTK01 active: minimization/rationalization pattern mirrored without accusation.",
    rawTextStored: false,
    storePolicy: "local_encrypted_only",
  };

  return {
    persona: "elias",
    moduleId: "ONTK01",
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
      buffer: "Holds current permission/minimization sentence for this turn.",
      "state.dat": "Same-session continuity helps later turns avoid restarting denial reflection.",
      "user.dat": userDat ? "Durable relapse-prevention pattern and moduleUsage belong to user profile." : undefined,
      "projections.dat": projectionsDat ? "Permission sentence/belief detected; handles needed for recognition." : undefined,
      "logs.dat": "Encrypted continuity for relapse-prevention pattern.",
    },
  };
}
