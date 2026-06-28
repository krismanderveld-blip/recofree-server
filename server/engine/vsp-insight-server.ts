/**
 * VSP Insight Layer — Server-safe wrapper
 *
 * Imports the pure sub-modules directly (no react-native deps).
 * Replaces LocalDeviceTimeService.now().utcIso with new Date().toISOString().
 * The pipeline layer function is inlined here to avoid the @/lib/core/time import.
 */
import { detectVspInsightState } from '../../src/features/vspInsight/detectVspInsightState';
import { routeVspInsight } from '../../src/features/vspInsight/vspInsightRouter';
import { routeKimVspInsight, mapToKimInsightState } from '../../src/features/vspInsight/kimVspVariant';
import { extractChatSignals } from '../../src/features/vspInsight/vspChatSignalAdapter';
import { buildDgtSoothingFlow } from '../../src/features/vspInsight/vspDgtSoothingFlow';
import type {
  VspInsightState,
  VspFrameworkSelection,
  VspInsightPromptFrame,
  VspDgtSoothingFlow,
  VspInsightProfile,
  VspMoodSlidersSnapshot,
  VspZone,
  RecoFreePersona,
  ImmutableSafetyCoreSnapshot,
} from '../../src/features/vspInsight/vspInsightTypes';

// ─── Types ──────────────────────────────────────────────────────
export interface VspInsightServerInput {
  persona: 'elias' | 'kim';
  userMessage: string;
  recentMessages: string[];
  moodSliders: {
    craving?: number;
    frustration?: number;
    despondency?: number;
    focus?: number;
  };
  selfReportedZone: string; // VspZone
  sessionTurnCount: number;
  safetyCore: {
    finalZone: string;
    userReportedZone: string;
    safetyOverrideActive: boolean;
    crisisDetected: boolean;
    relapseIntentDetected: boolean;
    modelRoutingDecision: 'gpt-4o' | 'gpt-4o-mini' | 'none';
    activeSafetyModuleId: string | null;
  };
  profile?: VspInsightProfile | null;
}

export interface VspInsightServerResult {
  active: boolean;
  insightState: string;
  framework: string;
  contextString: string;
  debug: {
    reasons: string[];
    rationalGreenScore: number;
    overwhelmScore: number;
    realGreenScore: number;
  };
}

// ─── Implementation ─────────────────────────────────────────────
export function runVspInsightServer(input: VspInsightServerInput): VspInsightServerResult {
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

  // Build immutable core snapshot
  const immutableCore: ImmutableSafetyCoreSnapshot = {
    finalZone: safetyCore.finalZone as VspZone,
    userReportedZone: safetyCore.userReportedZone as VspZone,
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
      contextString: "",
      debug: {
        reasons: ["Safety core override active — VSP Insight defers"],
        rationalGreenScore: 0,
        overwhelmScore: 10,
        realGreenScore: 0,
      },
    };
  }

  // Extract chat signals
  const allMessages = [...recentMessages, userMessage];
  const chatSignals = extractChatSignals(allMessages.join(" "));

  // Build mood snapshot (replaces LocalDeviceTimeService.now().utcIso with Date)
  const mood: VspMoodSlidersSnapshot = {
    selfReportedZone: selfReportedZone as VspZone,
    craving: moodSliders.craving ?? 0,
    frustration: moodSliders.frustration ?? 0,
    despondency: moodSliders.despondency ?? 0,
    focus: moodSliders.focus ?? 5,
    capturedAt: new Date().toISOString(),
  };

  // Detect insight state
  const stateResult = detectVspInsightState({
    mood,
    chatSignals,
    immutableCore,
  });

  // Route to framework
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
      persona: persona as RecoFreePersona,
      mood,
      immutableCore,
      profile: profile ?? undefined,
    });
  }

  // Build context string
  const contextString = buildContextString(
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
    contextString,
    debug: {
      reasons: stateResult.reasons,
      rationalGreenScore: stateResult.rationalGreenScore,
      overwhelmScore: stateResult.overwhelmScore,
      realGreenScore: stateResult.realGreenScore,
    },
  };
}

// ─── Context String Builder ─────────────────────────────────────
function buildContextString(
  insightState: VspInsightState,
  framework: VspFrameworkSelection,
  promptFrame: VspInsightPromptFrame | null,
  soothingFlow: VspDgtSoothingFlow | null,
  persona: string
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

  if (promptFrame.neverSay.length > 0) {
    lines.push("");
    lines.push("NOOIT ZEGGEN:");
    for (const ns of promptFrame.neverSay) {
      lines.push(`- "${ns}"`);
    }
  }

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
