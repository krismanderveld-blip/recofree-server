/**
 * Elias Advanced Modules P4 — SLAAP01 (Sleep and Addiction Recovery)
 * Pipeline step 5e8 — runs after P3 (TERV01/MI02).
 * Persona-separated: reads only Elias data.
 */

import { detectSLAAP01Elias } from "@/modules/elias/slaap01/slaap01-detector";
import { routeSLAAP01Elias } from "@/modules/elias/slaap01/slaap01-router";
import { buildSLAAP01EliasPromptPayload } from "@/modules/elias/slaap01/slaap01-prompt";
import { buildSLAAP01EliasStoragePatch } from "@/modules/elias/slaap01/slaap01-storage";
import type { SLAAP01EliasRuntimeInput } from "@/modules/elias/slaap01/slaap01-types";

export interface EliasP4Input {
  persona: string;
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  medicalRisk: number;
  safetyRisk: number;
  sleepProblemDetected: boolean;
  sleepAnxietyDetected: boolean;
  nightCravingDetected: boolean;
  cravingIntensity: number;
  fatigueRelapseTriggerDetected: boolean;
  withdrawalSleepConcern: boolean;
  withdrawalRisk: number;
  paarsZoneActive: boolean;
  relapseRecentlyOccurred: boolean;
  timestampIso: string;
}

export interface EliasP4Result {
  slaap01Active: boolean;
  slaap01Context: string | null;
  slaap01ResponseMode: string | null;
  slaap01RouteNext: string | null;
  slaap01StoragePatch: Record<string, unknown> | null;
}

export function runEliasAdvancedP4(input: EliasP4Input): EliasP4Result {
  // Persona guard
  if (input.persona !== "elias") {
    return {
      slaap01Active: false,
      slaap01Context: null,
      slaap01ResponseMode: null,
      slaap01RouteNext: null,
      slaap01StoragePatch: null,
    };
  }

  const runtimeInput: SLAAP01EliasRuntimeInput = {
    persona: "elias",
    intakeCompleted: input.intakeCompleted,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    medicalRisk: input.medicalRisk,
    safetyRisk: input.safetyRisk,
    sleepProblemDetected: input.sleepProblemDetected,
    sleepAnxietyDetected: input.sleepAnxietyDetected,
    nightCravingDetected: input.nightCravingDetected,
    cravingIntensity: input.cravingIntensity,
    fatigueRelapseTriggerDetected: input.fatigueRelapseTriggerDetected,
    withdrawalSleepConcern: input.withdrawalSleepConcern,
    withdrawalRisk: input.withdrawalRisk,
    paarsZoneActive: input.paarsZoneActive,
    relapseRecentlyOccurred: input.relapseRecentlyOccurred,
    timestampIso: input.timestampIso,
  };

  const detection = detectSLAAP01Elias(runtimeInput);
  const route = routeSLAAP01Elias(detection);

  if (!route.shouldActivate) {
    return {
      slaap01Active: false,
      slaap01Context: null,
      slaap01ResponseMode: detection.responseMode,
      slaap01RouteNext: detection.routeNext,
      slaap01StoragePatch: null,
    };
  }

  const promptPayload = buildSLAAP01EliasPromptPayload(detection);
  const storagePatch = buildSLAAP01EliasStoragePatch(runtimeInput, detection);

  return {
    slaap01Active: true,
    slaap01Context: promptPayload?.fullPrompt ?? null,
    slaap01ResponseMode: detection.responseMode,
    slaap01RouteNext: detection.routeNext,
    slaap01StoragePatch: storagePatch as Record<string, unknown>,
  };
}
