/**
 * Kim SLAAP01 Module Integration
 * Pipeline integration for Kim sleep-and-caregiver sustainability.
 * Persona-separated: reads only Kim data.
 */

import { detectSLAAP01Kim } from "@/modules/kim/slaap01/slaap01-detector";
import { routeSLAAP01Kim } from "@/modules/kim/slaap01/slaap01-router";
import { buildSLAAP01KimPromptPayload } from "@/modules/kim/slaap01/slaap01-prompt";
import { buildSLAAP01KimStoragePatch } from "@/modules/kim/slaap01/slaap01-storage";
import type { SLAAP01KimRuntimeInput } from "@/modules/kim/slaap01/slaap01-types";

export interface KimSLAAP01Input {
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
  nightVigilanceDetected: boolean;
  sleepGuiltDetected: boolean;
  fatigueBoundaryTriggerDetected: boolean;
  boundaryFatigueIntensity: number;
  caregiverStressIntensity: number;
  acuteHouseholdSafetyRisk: boolean;
  timestampIso: string;
}

export interface KimSLAAP01Result {
  slaap01Active: boolean;
  slaap01Context: string | null;
  slaap01ResponseMode: string | null;
  slaap01RouteNext: string | null;
  slaap01StoragePatch: Record<string, unknown> | null;
}

export function runKimSLAAP01(input: KimSLAAP01Input): KimSLAAP01Result {
  // Persona guard
  if (input.persona !== "kim") {
    return {
      slaap01Active: false,
      slaap01Context: null,
      slaap01ResponseMode: null,
      slaap01RouteNext: null,
      slaap01StoragePatch: null,
    };
  }

  const runtimeInput: SLAAP01KimRuntimeInput = {
    persona: "kim",
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
    nightVigilanceDetected: input.nightVigilanceDetected,
    sleepGuiltDetected: input.sleepGuiltDetected,
    fatigueBoundaryTriggerDetected: input.fatigueBoundaryTriggerDetected,
    boundaryFatigueIntensity: input.boundaryFatigueIntensity,
    caregiverStressIntensity: input.caregiverStressIntensity,
    acuteHouseholdSafetyRisk: input.acuteHouseholdSafetyRisk,
    timestampIso: input.timestampIso,
  };

  const detection = detectSLAAP01Kim(runtimeInput);
  const route = routeSLAAP01Kim(detection);

  if (!route.shouldActivate) {
    return {
      slaap01Active: false,
      slaap01Context: null,
      slaap01ResponseMode: detection.responseMode,
      slaap01RouteNext: detection.routeNext,
      slaap01StoragePatch: null,
    };
  }

  const promptPayload = buildSLAAP01KimPromptPayload(detection);
  const storagePatch = buildSLAAP01KimStoragePatch(runtimeInput, detection);

  return {
    slaap01Active: true,
    slaap01Context: promptPayload?.fullPrompt ?? null,
    slaap01ResponseMode: detection.responseMode,
    slaap01RouteNext: detection.routeNext,
    slaap01StoragePatch: storagePatch as Record<string, unknown>,
  };
}
