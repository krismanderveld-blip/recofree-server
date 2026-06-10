/**
 * Kim Advanced Modules P4 — PAR01, FIN01
 * Integration layer for parentification pattern detection and financial control/dependency.
 *
 * Priority order:
 * 1. K06 always runs first (handled upstream)
 * 2. BEDR01/VETR01/GASL01 (P2) override if acute betrayal/gaslighting is primary
 * 3. CDP01/RNW01 (P3) override if codependency/grief is primary
 * 4. PAR01 has priority over FIN01 (identity-level pattern is more urgent)
 * 5. FIN01 activates if financial control/dependency is primary
 *
 * Kim only. Never reads Elias data. Crisis/safety override.
 */

import { detectPAR01 } from "@/modules/kim/par01/par01-detector";
import { routePAR01 } from "@/modules/kim/par01/par01-router";
import { buildPAR01Prompt } from "@/modules/kim/par01/par01-prompt";
import { detectFIN01 } from "@/modules/kim/fin01/fin01-detector";
import { routeFIN01 } from "@/modules/kim/fin01/fin01-router";
import { buildFIN01Prompt } from "@/modules/kim/fin01/fin01-prompt";

import type { PAR01DetectionInput } from "@/modules/kim/par01/par01-types";
import type { FIN01DetectionInput } from "@/modules/kim/fin01/fin01-types";

export interface KimAdvancedP4Input {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  // PAR01 signals
  par01PreviousDetections: any[];
  // FIN01 signals
  fin01PreviousDetections: any[];
  // Shared
  safetyRisk: number;
  timestampIso: string;
  backpackContext: string;
}

export interface KimAdvancedP4Result {
  par01Context: string | null;
  fin01Context: string | null;
  activeModule: "PAR01" | "FIN01" | null;
  routeNext: string;
}

export function runKimAdvancedP4(input: KimAdvancedP4Input): KimAdvancedP4Result {
  // Persona guard
  if (input.persona !== "kim") {
    return {
      par01Context: null,
      fin01Context: null,
      activeModule: null,
      routeNext: "NO_MODULE",
    };
  }

  // K06 gate
  if (input.K06StabilizationStatus !== "STABILIZED") {
    return {
      par01Context: null,
      fin01Context: null,
      activeModule: null,
      routeNext: "K06_NOT_STABILIZED",
    };
  }

  // Crisis gate
  if (input.crisisProtocolStatus === "ACTIVE") {
    return {
      par01Context: null,
      fin01Context: null,
      activeModule: null,
      routeNext: "CRISIS_OVERRIDE",
    };
  }

  // Step 1: PAR01 — parentification pattern detection (priority over FIN01)
  const par01Input: PAR01DetectionInput = {
    message: input.latestUserMessage,
    recentHistory: input.recentMessages,
    k06Stabilized: input.K06StabilizationStatus === "STABILIZED",
    crisisLevel: input.crisisProtocolStatus === "MONITOR" ? 1 : 0,
    previousDetections: input.par01PreviousDetections,
    backpackContext: input.backpackContext,
  };

  const par01Detection = detectPAR01(par01Input);

  if (par01Detection.detected) {
    const par01Routing = routePAR01(par01Detection);
    if (par01Routing.activate) {
      const par01Prompt = buildPAR01Prompt(par01Routing);
      return {
        par01Context: par01Prompt,
        fin01Context: null,
        activeModule: "PAR01",
        routeNext: `PAR01_${par01Routing.phase.toUpperCase()}`,
      };
    }
  }

  // Step 2: FIN01 — financial control/dependency detection
  const fin01Input: FIN01DetectionInput = {
    message: input.latestUserMessage,
    recentHistory: input.recentMessages,
    k06Stabilized: input.K06StabilizationStatus === "STABILIZED",
    crisisLevel: input.crisisProtocolStatus === "MONITOR" ? 1 : 0,
    previousDetections: input.fin01PreviousDetections,
    backpackContext: input.backpackContext,
  };

  const fin01Detection = detectFIN01(fin01Input);

  if (fin01Detection.detected) {
    const fin01Routing = routeFIN01(fin01Detection);
    if (fin01Routing.activate) {
      const fin01Prompt = buildFIN01Prompt(fin01Routing);
      return {
        par01Context: null,
        fin01Context: fin01Prompt,
        activeModule: "FIN01",
        routeNext: `FIN01_${fin01Routing.phase.toUpperCase()}`,
      };
    }
  }

  return {
    par01Context: null,
    fin01Context: null,
    activeModule: null,
    routeNext: "NO_MODULE",
  };
}
