/**
 * VSP Insight Pipeline Layer
 *
 * Integration layer that connects the VSP Insight System to the main pipeline.
 * Called AFTER safety core decisions, BEFORE GPT call.
 *
 * CRITICAL RULES:
 * - NEVER mutates safety core output
 * - NEVER overrides crisis detection, zone thresholds, relapse-intent routing, or model routing
 * - store:false on all GPT calls
 * - Silent discrepancy stored locally only — never communicated
 * - Elias and Kim profiles strictly separated
 */

import type {
  VspInsightState,
  VspFrameworkSelection,
  VspInsightPromptFrame,
  VspMoodSlidersSnapshot,
  VspChatSignalSnapshot,
  ImmutableSafetyCoreSnapshot,
  VspZone,
  RecoFreePersona,
} from "./vspInsightTypes";
import { detectVspInsightState } from "./detectVspInsightState";
import { routeVspInsight } from "./vspInsightRouter";
import { routeKimVspInsight, mapToKimInsightState } from "./kimVspVariant";
import { extractChatSignals } from "./vspChatSignalAdapter";
import { buildDgtSoothingFlow } from "./vspDgtSoothingFlow";
import type { VspDgtSoothingFlow, VspInsightProfile } from "./vspInsightTypes";
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Pipeline Integration Input ───────────────────────────────────────────────

export interface VspInsightPipelineInput {
  persona: RecoFreePersona;
  userMessage: string;
  recentMessages: string[];
  moodSliders: {
    craving?: number;
    frustration?: number;
    despondency?: number;
    focus?: number;
  };
  selfReportedZone: VspZone;
  sessionTurnCount: number;
  // Immutable safety core snapshot (READ ONLY)
  safetyCore: {
    finalZone: VspZone;
    userReportedZone: VspZone;
    safetyOverrideActive: boolean;
    crisisDetected: boolean;
    relapseIntentDetected: boolean;
    modelRoutingDecision: "gpt-4o" | "gpt-4o-mini" | "none";
    activeSafetyModuleId: string | null;
  };
  profile: VspInsightProfile | null;
}

// ─── Pipeline Integration Output ──────────────────────────────────────────────

export interface VspInsightPipelineResult {
  active: boolean;
  insightState: VspInsightState;
  framework: VspFrameworkSelection;
  promptFrame: VspInsightPromptFrame | null;
  soothingFlow: VspDgtSoothingFlow | null;
  contextString: string;
  storeGptCall: false;
  debug: {
    reasons: string[];
    rationalGreenScore: number;
    overwhelmScore: number;
    realGreenScore: number;
  };
}

/**
 * Run the VSP Insight pipeline layer.
 * Called after safety core, before GPT call.
 * Returns framework selection and prompt frame for injection.
 */
export function runVspInsightLayer(input: VspInsightPipelineInput): VspInsightPipelineResult {
  const {
    persona,
    userMessage,
    recentMessages,
    moodSliders,
    selfReportedZone,
    sessionTurnCount,
    safetyCore,
    profile,
  } = input;

  // Build immutable core snapshot (READ ONLY — we never modify this)
  const immutableCore: ImmutableSafetyCoreSnapshot = {
    finalZone: safetyCore.finalZone,
    userReportedZone: safetyCore.userReportedZone,
    safetyOverrideActive: safetyCore.safetyOverrideActive,
    crisisDetected: safetyCore.crisisDetected,
    relapseIntentDetected: safetyCore.relapseIntentDetected,
    modelRoutingDecision: safetyCore.modelRoutingDecision,
    activeSafetyModuleId: safetyCore.activeSafetyModuleId,
    immutableCoreVersion: "1.0.0",
  };

  // If safety core override is active, VSP Insight defers completely
  if (immutableCore.safetyOverrideActive || immutableCore.crisisDetected) {
    return {
      active: false,
      insightState: "OVERWHELMED_ORANGE_RED",
      framework: "SAFETY_CORE_ONLY",
      promptFrame: null,
      soothingFlow: null,
      contextString: "",
      storeGptCall: false,
      debug: {
        reasons: ["Safety core override active — VSP Insight defers"],
        rationalGreenScore: 0,
        overwhelmScore: 10,
        realGreenScore: 0,
      },
    };
  }

  // Extract chat signals from current + recent messages
  const allMessages = [...recentMessages, userMessage];
  const chatSignals = extractChatSignals(allMessages.join(" "));

  // Build mood snapshot
  const mood: VspMoodSlidersSnapshot = {
    selfReportedZone,
    craving: moodSliders.craving ?? 0,
    frustration: moodSliders.frustration ?? 0,
    despondency: moodSliders.despondency ?? 0,
    focus: moodSliders.focus ?? 5,
    capturedAt: LocalDeviceTimeService.now().utcIso,
  };

  // Detect insight state
  const stateResult = detectVspInsightState({
    mood,
    chatSignals,
    immutableCore,
  });

  // Route to framework (persona-specific)
  let framework: VspFrameworkSelection;
  let promptFrame: VspInsightPromptFrame;

  if (persona === "kim") {
    const kimResult = routeKimVspInsight({
      insightState: stateResult.insightState,
      immutableCore,
      sessionTurnCount,
    });
    framework = kimResult.framework;
    promptFrame = kimResult.promptFrame;
  } else {
    const eliasResult = routeVspInsight({
      insightState: stateResult.insightState,
      immutableCore,
      persona: "elias",
      sessionTurnCount,
    });
    framework = eliasResult.framework;
    promptFrame = eliasResult.promptFrame;
  }

  // Build DGT soothing flow if overwhelmed
  let soothingFlow: VspDgtSoothingFlow | null = null;
  if (framework === "DGT" && stateResult.insightState === "OVERWHELMED_ORANGE_RED") {
    soothingFlow = buildDgtSoothingFlow({
      persona,
      mood,
      immutableCore,
      profile,
    });
  }

  // Build context string for ChatContext injection
  const contextString = buildVspInsightContextString(
    stateResult.insightState,
    framework,
    promptFrame,
    soothingFlow,
    persona
  );

  return {
    active: framework !== "SAFETY_CORE_ONLY",
    insightState: stateResult.insightState,
    framework,
    promptFrame,
    soothingFlow,
    contextString,
    storeGptCall: false,
    debug: {
      reasons: stateResult.reasons,
      rationalGreenScore: stateResult.rationalGreenScore,
      overwhelmScore: stateResult.overwhelmScore,
      realGreenScore: stateResult.realGreenScore,
    },
  };
}

// ─── Context String Builder ───────────────────────────────────────────────────

function buildVspInsightContextString(
  insightState: VspInsightState,
  framework: VspFrameworkSelection,
  promptFrame: VspInsightPromptFrame | null,
  soothingFlow: VspDgtSoothingFlow | null,
  persona: RecoFreePersona
): string {
  if (!promptFrame || framework === "SAFETY_CORE_ONLY") return "";

  const lines: string[] = [
    `[VSP-INSIGHT LAYER]`,
    `State: ${insightState}`,
    `Framework: ${framework}`,
    `Persona: ${persona}`,
    `store: false`,
    ``,
    promptFrame.systemInstruction,
  ];

  // Add never-say rules
  if (promptFrame.neverSay.length > 0) {
    lines.push("");
    lines.push("NOOIT ZEGGEN:");
    for (const ns of promptFrame.neverSay) {
      lines.push(`- "${ns}"`);
    }
  }

  // Add soothing flow if present
  if (soothingFlow) {
    lines.push("");
    lines.push("DGT SOOTHING OPTIES:");
    lines.push(soothingFlow.userFacingIntro);
    for (const opt of soothingFlow.selectedOptions) {
      lines.push(`- ${opt.label}: ${opt.instruction}`);
    }
  }

  return lines.join("\n");
}
