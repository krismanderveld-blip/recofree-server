/**
 * BLIK01 - Blikseminslag Memory Patch Builder
 */
import type {
  EliasSelfAcceptanceMemoryPatch,
  ClusterBufferPatch,
  ClusterStateDatPatch,
  ClusterUserDatPatch,
  ClusterProjectionsDatPatch,
  ClusterLogsDatPatch,
} from "../../../types/eliasSelfAcceptanceCluster.types";
import type { Blik01DetectionResult } from "./blik01.detector";

interface PatchInput {
  detection: Blik01DetectionResult;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  currentZone: string;
  stabilizedEnoughForReflection: boolean;
  latestUserMessage: string;
}

export function buildBlik01MemoryPatch(input: PatchInput): EliasSelfAcceptanceMemoryPatch {
  const { detection, sessionId, turnId, timestampIso, currentZone, stabilizedEnoughForReflection } = input;

  // Buffer: ALWAYS required
  const buffer: ClusterBufferPatch = {
    activeModuleId: "BLIK01",
    activeInterventionType: detection.selectedInterventionType,
    currentTurnDirective: "Use the shock/pillar context now without declaring it as total collapse.",
    extractedCandidates: detection.matchedMarkers.slice(0, 5),
    expiresAtTurnEnd: true,
  };

  // state.dat: relevant when shock is active in session
  const stateDat: ClusterStateDatPatch = {
    activeTherapeuticFrame: "support_pillar_shock",
    activeModuleId: "BLIK01",
    currentZoneAtActivation: currentZone,
    lastActivatedAt: timestampIso,
    lastActivationTurnId: turnId,
    stabilizedEnoughForReflection,
    bridgeCandidateModules: detection.recommendedBridgeModules,
  };

  // user.dat: relevant when affected pillar is confirmed
  let userDat: ClusterUserDatPatch | null = null;
  if (detection.affectedPillarLabel || detection.affectedKnownPillarId) {
    userDat = {
      moduleUsage: {
        moduleId: "BLIK01",
        incrementBy: 1,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
      },
      learnedPatterns: [
        {
          patternId: `blik01_pillar_vuln_${turnId}`,
          patternType: "support_pillar_loss_vulnerability",
          label: detection.affectedPillarLabel || "unknown pillar",
          normalizedLabel: (detection.affectedPillarLabel || "unknown").toLowerCase().replace(/\s+/g, "_"),
          confidence: detection.confidenceScore,
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
          sourceModuleId: "BLIK01",
          neverUseAsDiagnosis: true,
        },
      ],
    };
  }

  // projections.dat: only when belief detected
  let projectionsDat: ClusterProjectionsDatPatch | null = null;
  const msg = input.latestUserMessage.toLowerCase();
  const beliefPatterns = [
    { pattern: /zonder .+ is alles weg/i, label: "zonder deze pilaar is alles weg" },
    { pattern: /als .+ wegvalt.* ben ik niets/i, label: "als deze pilaar wegvalt ben ik niets" },
    { pattern: /ik kan dit niet dragen zonder/i, label: "ik kan dit niet dragen zonder X" },
    { pattern: /alles is weg/i, label: "alles is weg" },
  ];
  const detectedBeliefs = beliefPatterns.filter((b) => b.pattern.test(msg));
  if (detectedBeliefs.length > 0) {
    projectionsDat = {
      upsertBeliefs: detectedBeliefs.map((b) => ({
        beliefId: `blik01_belief_${turnId}_${b.label.replace(/\s+/g, "_").slice(0, 20)}`,
        label: b.label,
        normalizedLabel: b.label.toLowerCase().replace(/\s+/g, "_"),
        sourceModuleId: "BLIK01" as const,
        confidence: detection.confidenceScore,
        firstDetectedAt: timestampIso,
        lastUpdatedAt: timestampIso,
        mustFrameAsMutable: true as const,
      })),
      upsertHandles: [
        {
          handleId: "een_pilaar_is_niet_het_hele_gebouw",
          label: "Een pilaar is niet het hele gebouw",
          instruction: "One pillar can fall without the whole self being gone.",
          sourceModuleId: "BLIK01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
        {
          handleId: "wat_staat_nog",
          label: "Wat staat nog",
          instruction: "Identify one thing still standing before deciding everything is lost.",
          sourceModuleId: "BLIK01",
          firstDetectedAt: timestampIso,
          lastUpdatedAt: timestampIso,
        },
      ],
    };
  }

  // logs.dat: always on activation
  const logsDat: ClusterLogsDatPatch = {
    encryptedEventType: "therapeutic_module_activation",
    moduleId: "BLIK01",
    timestampIso,
    sessionId,
    turnId,
    safeSummary: "BLIK01 active: sudden threat/loss of a concrete support pillar processed without diagnosing or minimizing.",
    rawTextStored: false,
    storePolicy: "local_encrypted_only",
  };

  return {
    persona: "elias",
    moduleId: "BLIK01",
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
      buffer: "Current shock/pillar label must be held in this turn to avoid vague response.",
      "state.dat": "Pillar-shock state can remain active across session and must be continued without re-asking.",
      "user.dat": userDat ? "Durable support vulnerability pattern and moduleUsage belong to user profile." : undefined,
      "projections.dat": projectionsDat ? "Belief about total collapse detected; handles needed for reframing." : undefined,
      "logs.dat": "Encrypted historical continuity for later support rebuilding.",
    },
  };
}
