/**
 * Kim Advanced Modules P3 — CDP01, RNW01
 * Integration layer for codependency pattern detection and ambiguous grief validation.
 *
 * Priority order:
 * 1. K06 always runs first (handled upstream)
 * 2. BEDR01/VETR01/GASL01 (P2) override if acute betrayal/gaslighting is primary
 * 3. CDP01 has priority over RNW01 (self-loss pattern is more urgent)
 * 4. RNW01 activates if grief-for-who-they-were is primary
 *
 * Kim only. Never reads Elias data. Crisis/safety override.
 */

import { detectCDP01 } from "@/lib/engine/kim/modules/cdp01/cdp01-detector";
import { routeCDP01 } from "@/lib/engine/kim/modules/cdp01/cdp01-router";
import { detectRNW01 } from "@/lib/engine/kim/modules/rnw01/rnw01-detector";
import { routeRNW01 } from "@/lib/engine/kim/modules/rnw01/rnw01-router";

import type { CDP01RuntimeInput } from "@/lib/engine/kim/modules/cdp01/cdp01-types";
import type { RNW01RuntimeInput } from "@/lib/engine/kim/modules/rnw01/rnw01-types";

export interface KimAdvancedP3Input {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  // CDP01 signals
  selfLossPattern: boolean;
  relationalFusion: boolean;
  emotionalDependencyOnPartnerState: boolean;
  rescueCompulsion: boolean;
  overResponsibility: boolean;
  controlFromFear: boolean;
  selfCareGuilt: boolean;
  identityCollapseWithoutPartner: boolean;
  acuteOverload: boolean;
  // RNW01 signals
  missesOldPerson: boolean;
  griefForLivingPerson: boolean;
  ambiguousGriefMarker: boolean;
  falseHopeSeeking: boolean;
  acceptancePressure: boolean;
  relationshipAsItWasLost: boolean;
  guiltAboutGrieving: boolean;
  futureLoss: boolean;
  acuteFlooding: boolean;
  // Shared
  safetyRisk: number;
  timestampIso: string;
}

export interface KimAdvancedP3Result {
  cdp01Context: string | null;
  rnw01Context: string | null;
  activeModule: "CDP01" | "RNW01" | null;
  routeNext: string;
}

export function runKimAdvancedP3(input: KimAdvancedP3Input): KimAdvancedP3Result {
  // Persona guard
  if (input.persona !== "kim") {
    return {
      cdp01Context: null,
      rnw01Context: null,
      activeModule: null,
      routeNext: "NO_MODULE",
    };
  }

  // Step 1: CDP01 — codependency pattern detection (priority over RNW01)
  const cdp01Input: CDP01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    selfLossPattern: input.selfLossPattern,
    relationalFusion: input.relationalFusion,
    emotionalDependencyOnPartnerState: input.emotionalDependencyOnPartnerState,
    rescueCompulsion: input.rescueCompulsion,
    overResponsibility: input.overResponsibility,
    controlFromFear: input.controlFromFear,
    selfCareGuilt: input.selfCareGuilt,
    identityCollapseWithoutPartner: input.identityCollapseWithoutPartner,
    acuteOverload: input.acuteOverload,
    safetyRisk: input.safetyRisk,
    timestampIso: input.timestampIso,
  };

  const cdp01Detection = detectCDP01(cdp01Input);

  if (cdp01Detection.activationStatus === "ACTIVE") {
    const cdp01Result = routeCDP01(cdp01Input, cdp01Detection);
    return {
      cdp01Context: cdp01Result.promptPayload
        ? cdp01Result.promptPayload.compactPrompt
        : null,
      rnw01Context: null,
      activeModule: "CDP01",
      routeNext: cdp01Result.routeNext,
    };
  }

  // Step 2: RNW01 — ambiguous grief validation
  const rnw01Input: RNW01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    missesOldPerson: input.missesOldPerson,
    griefForLivingPerson: input.griefForLivingPerson,
    ambiguousGriefMarker: input.ambiguousGriefMarker,
    falseHopeSeeking: input.falseHopeSeeking,
    acceptancePressure: input.acceptancePressure,
    relationshipAsItWasLost: input.relationshipAsItWasLost,
    guiltAboutGrieving: input.guiltAboutGrieving,
    futureLoss: input.futureLoss,
    acuteFlooding: input.acuteFlooding,
    safetyRisk: input.safetyRisk,
    timestampIso: input.timestampIso,
  };

  const rnw01Detection = detectRNW01(rnw01Input);

  if (rnw01Detection.activationStatus === "ACTIVE") {
    const rnw01Result = routeRNW01(rnw01Input, rnw01Detection);
    return {
      cdp01Context: null,
      rnw01Context: rnw01Result.promptPayload
        ? rnw01Result.promptPayload.compactPrompt
        : null,
      activeModule: "RNW01",
      routeNext: rnw01Result.routeNext,
    };
  }

  return {
    cdp01Context: null,
    rnw01Context: null,
    activeModule: null,
    routeNext: "NO_MODULE",
  };
}
