/**
 * WILSKRACHT01 + AUTOPILOT01 Acceptance Tests
 *
 * Covers:
 * 1. Persona separation (Elias-only, Kim blocked)
 * 2. Crisis override works
 * 3. Correct, non-duplicate write actions to all five memory layers
 * 4. Memory is used in greeting AND in a later chat turn
 * 5. Output safety filter
 * 6. High craving → DGT deferral
 * 7. VSP PAARS → safety deferral
 */
import { describe, it, expect } from "vitest";
import { detectWilskracht01 } from "@/src/modules/elias/WILSKRACHT01/detector";
import { detectAutopilot01 } from "@/src/modules/elias/AUTOPILOT01/detector";
import { buildWilskracht01PromptPayload } from "@/src/modules/elias/WILSKRACHT01/promptPayloadBuilder";
import { buildAutopilot01PromptPayload } from "@/src/modules/elias/AUTOPILOT01/promptPayloadBuilder";
import { buildEliasPsychoEducationMemoryPatch } from "@/src/modules/elias/psychoEducation/memoryPatchBuilder";
import { readPsychoEducationMemoryHints } from "@/src/modules/elias/psychoEducation/readPsychoEducationMemoryHints";
import { enforceEliasPsychoEducationOutputSafety } from "@/src/modules/elias/psychoEducation/outputSafetyFilter";
import { buildDetectionBundle } from "@/lib/pipeline/memory/memoryIntegration";
import { buildMemoryWritePlan } from "@/lib/pipeline/memory/memoryWriteRouter";
import type {
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationMemoryHint,
} from "@/src/types/eliasPsychoEducation.types";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeBaseInput(overrides?: Partial<EliasPsychoEducationRuntimeInput>): EliasPsychoEducationRuntimeInput {
  return {
    persona: "elias",
    intakeCompleted: true,
    latestUserMessage: "Ik had sterker moeten zijn, het is mijn eigen schuld dat ik weer heb gedronken.",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolActive: false,
    suicideSelfHarmDetected: false,
    acuteDangerDetected: false,
    severeIntoxicationDetected: false,
    relapseIntentDetected: false,
    cravingDetected: true,
    relapseRecentlyOccurred: true,
    selfBlameDetected: true,
    willpowerLanguageDetected: true,
    autopilotLanguageDetected: false,
    triggerExposureDetected: false,
    approachBiasLanguageDetected: false,
    attentionalBiasLanguageDetected: false,
    conditionedTriggerLanguageDetected: false,
    vspZone: "GEEL",
    cravingSliderValue: 5,
    timestampIso: "2026-06-18T10:00:00.000Z",
    sessionId: "session_test_001",
    turnId: "turn_test_001",
    existingMemoryHints: [],
    ...overrides,
  };
}

function makeAutopilotInput(overrides?: Partial<EliasPsychoEducationRuntimeInput>): EliasPsychoEducationRuntimeInput {
  return {
    persona: "elias",
    intakeCompleted: true,
    latestUserMessage: "Ik liep automatisch naar de winkel, zonder na te denken, alsof mijn benen het zelf deden.",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolActive: false,
    suicideSelfHarmDetected: false,
    acuteDangerDetected: false,
    severeIntoxicationDetected: false,
    relapseIntentDetected: false,
    cravingDetected: true,
    relapseRecentlyOccurred: false,
    selfBlameDetected: false,
    willpowerLanguageDetected: false,
    autopilotLanguageDetected: true,
    triggerExposureDetected: true,
    approachBiasLanguageDetected: false,
    attentionalBiasLanguageDetected: false,
    conditionedTriggerLanguageDetected: false,
    vspZone: "ORANJE",
    cravingSliderValue: 5,
    timestampIso: "2026-06-18T10:00:00.000Z",
    sessionId: "session_test_002",
    turnId: "turn_test_002",
    existingMemoryHints: [],
    ...overrides,
  };
}

// ─── 1. PERSONA SEPARATION ──────────────────────────────────────────────────

describe("Persona separation", () => {
  it("WILSKRACHT01: Kim persona is BLOCKED", () => {
    const input = makeBaseInput({ persona: "kim" });
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.routeNext).toBe("NO_MODULE");
    expect(result.memoryWriteRequired).toBe(false);
  });

  it("AUTOPILOT01: Kim persona is BLOCKED", () => {
    const input = makeAutopilotInput({ persona: "kim" });
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.routeNext).toBe("NO_MODULE");
    expect(result.memoryWriteRequired).toBe(false);
  });

  it("WILSKRACHT01: Elias persona activates", () => {
    const input = makeBaseInput();
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("WILSKRACHT01");
    expect(result.confidenceScore).toBeGreaterThan(0.8);
  });

  it("AUTOPILOT01: Elias persona activates", () => {
    const input = makeAutopilotInput();
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("AUTOPILOT01");
    expect(result.confidenceScore).toBeGreaterThan(0.8);
  });
});

// ─── 2. CRISIS OVERRIDE ─────────────────────────────────────────────────────

describe("Crisis override", () => {
  it("WILSKRACHT01: crisis blocks activation", () => {
    const input = makeBaseInput({ crisisProtocolActive: true });
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
    expect(result.routeNext).toBe("CRISIS_PROTOCOL");
  });

  it("AUTOPILOT01: crisis blocks activation", () => {
    const input = makeAutopilotInput({ crisisProtocolActive: true });
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
    expect(result.routeNext).toBe("CRISIS_PROTOCOL");
  });

  it("WILSKRACHT01: suicideSelfHarm blocks activation", () => {
    const input = makeBaseInput({ suicideSelfHarmDetected: true });
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("AUTOPILOT01: acuteDanger blocks activation", () => {
    const input = makeAutopilotInput({ acuteDangerDetected: true });
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("WILSKRACHT01: high craving defers to DGT", () => {
    const input = makeBaseInput({ cravingSliderValue: 8 });
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("DEFER_TO_CRAVING_REGULATION");
    expect(result.routeNext).toBe("DGT_CRAVING_REGULATION");
  });

  it("AUTOPILOT01: high craving defers to DGT", () => {
    const input = makeAutopilotInput({ cravingSliderValue: 9 });
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("DEFER_TO_CRAVING_REGULATION");
    expect(result.routeNext).toBe("DGT_CRAVING_REGULATION");
  });

  it("WILSKRACHT01: VSP PAARS defers to safety", () => {
    const input = makeBaseInput({ vspZone: "PAARS" });
    const result = detectWilskracht01(input);
    expect(result.activationStatus).toBe("DEFER_TO_VSP_SAFETY");
    expect(result.routeNext).toBe("VSP_SAFETY");
  });

  it("AUTOPILOT01: VSP PAARS defers to safety", () => {
    const input = makeAutopilotInput({ vspZone: "PAARS" });
    const result = detectAutopilot01(input);
    expect(result.activationStatus).toBe("DEFER_TO_VSP_SAFETY");
    expect(result.routeNext).toBe("VSP_SAFETY");
  });
});

// ─── 3. MEMORY WRITE ACTIONS (non-duplicate, all layers) ─────────────────────

describe("Memory write actions — WILSKRACHT01", () => {
  it("produces correct memory patch with all three targets", () => {
    const input = makeBaseInput();
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch).not.toBeNull();
    expect(patch!.persona).toBe("elias");
    expect(patch!.moduleId).toBe("WILSKRACHT01");
    expect(patch!.storageTargets).toContain("user.dat");
    expect(patch!.storageTargets).toContain("projections.dat");
    expect(patch!.storageTargets).toContain("logs.dat");
  });

  it("user.dat patch has psychoEducationPatterns and moduleUsage", () => {
    const input = makeBaseInput();
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch!.userDatPatch.psychoEducationPatternsToUpsert.length).toBeGreaterThan(0);
    expect(patch!.userDatPatch.moduleUsageToIncrement.moduleId).toBe("WILSKRACHT01");
    expect(patch!.userDatPatch.moduleUsageToIncrement.activationCountIncrement).toBe(1);
  });

  it("projections.dat patch has beliefs and recovery handles", () => {
    const input = makeBaseInput();
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch!.projectionsDatPatch.beliefsToUpsert.length).toBeGreaterThan(0);
    expect(patch!.projectionsDatPatch.beliefsToUpsert[0].category).toBe("willpower_shame_belief");
    expect(patch!.projectionsDatPatch.recoveryHandlesToUpsert.length).toBeGreaterThan(0);
  });

  it("logs.dat patch has correct event structure", () => {
    const input = makeBaseInput();
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch!.logsDatPatch.logEvent.moduleId).toBe("WILSKRACHT01");
    expect(patch!.logsDatPatch.logEvent.rawTextStored).toBe(false);
    expect(patch!.logsDatPatch.logEvent.storePolicy).toBe("local_elias_scoped_only");
    expect(patch!.logsDatPatch.logEvent.memoryUseDirectiveWritten).toBe(true);
  });

  it("does NOT write when crisis is active", () => {
    const input = makeBaseInput({ crisisProtocolActive: true });
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });
    expect(patch).toBeNull();
  });

  it("does NOT write when persona is kim", () => {
    const input = makeBaseInput({ persona: "kim" });
    const detection = detectWilskracht01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });
    expect(patch).toBeNull();
  });
});

describe("Memory write actions — AUTOPILOT01", () => {
  it("produces correct memory patch with all three targets", () => {
    const input = makeAutopilotInput();
    const detection = detectAutopilot01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch).not.toBeNull();
    expect(patch!.persona).toBe("elias");
    expect(patch!.moduleId).toBe("AUTOPILOT01");
    expect(patch!.storageTargets).toContain("user.dat");
    expect(patch!.storageTargets).toContain("projections.dat");
    expect(patch!.storageTargets).toContain("logs.dat");
  });

  it("projections.dat has autopilot_trigger_belief", () => {
    const input = makeAutopilotInput();
    const detection = detectAutopilot01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch!.projectionsDatPatch.beliefsToUpsert[0].category).toBe("autopilot_trigger_belief");
  });

  it("logs.dat has correct AUTOPILOT01 event", () => {
    const input = makeAutopilotInput();
    const detection = detectAutopilot01(input);
    const patch = buildEliasPsychoEducationMemoryPatch({ detection, runtimeInput: input });

    expect(patch!.logsDatPatch.logEvent.moduleId).toBe("AUTOPILOT01");
    expect(patch!.logsDatPatch.logEvent.rawTextStored).toBe(false);
    expect(patch!.logsDatPatch.logEvent.storePolicy).toBe("local_elias_scoped_only");
  });
});

// ─── 4. MEMORY USED IN GREETING AND LATER TURN ──────────────────────────────

describe("Memory continuity — hints used in greeting and later turns", () => {
  const storedHints: EliasPsychoEducationMemoryHint[] = [
    {
      hintId: "wilskracht_self_blame_after_relapse",
      moduleId: "WILSKRACHT01",
      label: "Zelfverwijt na terugval",
      normalizedLabel: "self_blame_after_relapse",
      relevance: "self_blame",
      firstDetectedAt: "2026-06-17T10:00:00.000Z",
      lastUpdatedAt: "2026-06-17T10:00:00.000Z",
      frequency: 3,
      lastUsedInGreetingAt: null,
      lastUsedInTurnAt: null,
    },
  ];

  it("readPsychoEducationMemoryHints returns hints when markers match", () => {
    const hints = readPsychoEducationMemoryHints({
      persona: "elias",
      userDat: { elias: { psychoEducationPatterns: { wilskracht: storedHints } } },
      projectionsDat: { elias: { recoveryHandles: [] } },
      latestUserMessage: "Ik heb weer gefaald, mijn wilskracht is niet genoeg.",
      detectedMarkers: ["self_blame", "willpower"],
      currentModuleCandidates: ["WILSKRACHT01"],
    });
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].moduleId).toBe("WILSKRACHT01");
  });

  it("readPsychoEducationMemoryHints returns empty for Kim", () => {
    const hints = readPsychoEducationMemoryHints({
      persona: "kim",
      userDat: { elias: { psychoEducationPatterns: { wilskracht: storedHints } } },
      projectionsDat: { elias: { recoveryHandles: [] } },
      latestUserMessage: "Ik heb weer gefaald.",
      detectedMarkers: ["self_blame"],
      currentModuleCandidates: ["WILSKRACHT01"],
    });
    expect(hints.length).toBe(0);
  });

  it("promptPayload includes memory continuity directives when hints exist", () => {
    const input = makeBaseInput({ existingMemoryHints: storedHints });
    const detection = detectWilskracht01(input);
    const payload = buildWilskracht01PromptPayload({ detection, runtimeInput: input });

    expect(payload.memoryContinuityDirectives.length).toBeGreaterThan(0);
    expect(payload.memoryContinuityDirectives[0].appliesTo).toBe("every_relevant_chat_turn");
    expect(payload.memoryContinuityDirectives[0].hardDirective).toContain("Use stored WILSKRACHT01 continuity");
  });

  it("promptPayload has empty directives when no hints exist", () => {
    const input = makeBaseInput({ existingMemoryHints: [] });
    const detection = detectWilskracht01(input);
    const payload = buildWilskracht01PromptPayload({ detection, runtimeInput: input });

    expect(payload.memoryContinuityDirectives.length).toBe(0);
  });
});

// ─── 5. OUTPUT SAFETY FILTER ─────────────────────────────────────────────────

describe("Output safety filter", () => {
  it("rejects forbidden output: 'je bent zwak'", () => {
    const result = enforceEliasPsychoEducationOutputSafety({
      moduleId: "WILSKRACHT01",
      text: "Je bent zwak, je had sterker moeten zijn.",
      crisisProtocolActive: false,
      memoryHintsUsed: [],
    });
    expect(result).not.toContain("je bent zwak");
    expect(result).toContain("snelle impulssysteem"); // fallback text
  });

  it("rejects memory internals: 'logs.dat'", () => {
    const result = enforceEliasPsychoEducationOutputSafety({
      moduleId: "AUTOPILOT01",
      text: "Ik heb in logs.dat gezien dat je eerder dit patroon had.",
      crisisProtocolActive: false,
      memoryHintsUsed: [],
    });
    expect(result).not.toContain("logs.dat");
    expect(result).toContain("automatische piloot"); // fallback text
  });

  it("rejects Kim persona language in Elias module", () => {
    const result = enforceEliasPsychoEducationOutputSafety({
      moduleId: "WILSKRACHT01",
      text: "Kim hier, ik wil je helpen met wilskracht.",
      crisisProtocolActive: false,
      memoryHintsUsed: [],
    });
    expect(result).not.toContain("Kim hier");
  });

  it("returns fallback when crisis is active", () => {
    const result = enforceEliasPsychoEducationOutputSafety({
      moduleId: "WILSKRACHT01",
      text: "Laat me je uitleggen over het impulssysteem.",
      crisisProtocolActive: true,
      memoryHintsUsed: [],
    });
    expect(result).toContain("snelle impulssysteem"); // fallback
  });

  it("passes safe output through unchanged", () => {
    const safeText = "Het snelle impulssysteem vertrekt eerder dan je bewuste controle. Dat wist de gevolgen niet uit.";
    const result = enforceEliasPsychoEducationOutputSafety({
      moduleId: "WILSKRACHT01",
      text: safeText,
      crisisProtocolActive: false,
      memoryHintsUsed: [],
    });
    expect(result).toBe(safeText);
  });
});

// ─── 6. MEMORY WRITE ROUTER INTEGRATION ─────────────────────────────────────

describe("Memory write router — psychoEducationActivation", () => {
  it("generates patches when psychoEducationActivation is present", () => {
    const bundle = buildDetectionBundle({
      userMessage: "Ik had sterker moeten zijn.",
      persona: "elias",
      sessionId: "session_test_003",
      localUserId: "local_user",
      candidateSignals: null,
      schemaModeResult: null,
      bufferSnapshot: null,
      activeModule: null,
      moodSliders: null,
      moduleActivations: [],
      psychoEducationActivation: {
        moduleId: "WILSKRACHT01",
        detectedMarkers: ["self_blame", "willpower"],
        activationConfidence: 0.92,
        responseMode: "FULL_PSYCHOEDUCATION",
        crisisOverride: false,
        memoryHints: null,
      },
    });

    expect(bundle.psychoEducationActivation).not.toBeNull();
    expect(bundle.psychoEducationActivation!.moduleId).toBe("WILSKRACHT01");

    const plan = buildMemoryWritePlan(bundle);
    // Should have psychoEducation patches (user.dat + projections.dat)
    const pePatchIds = plan.patches
      .filter(p => p.source === "PsychoEducation_PE")
      .map(p => p.patchId);
    expect(pePatchIds.length).toBe(2); // user.dat + projections.dat
  });

  it("does NOT generate patches when crisisOverride is true", () => {
    const bundle = buildDetectionBundle({
      userMessage: "Ik had sterker moeten zijn.",
      persona: "elias",
      sessionId: "session_test_004",
      localUserId: "local_user",
      candidateSignals: null,
      schemaModeResult: null,
      bufferSnapshot: null,
      activeModule: null,
      moodSliders: null,
      moduleActivations: [],
      psychoEducationActivation: {
        moduleId: "WILSKRACHT01",
        detectedMarkers: ["self_blame"],
        activationConfidence: 0.92,
        responseMode: "CONTINUITY_ONLY",
        crisisOverride: true,
        memoryHints: null,
      },
    });

    const plan = buildMemoryWritePlan(bundle);
    const pePatchIds = plan.patches
      .filter(p => p.source === "PsychoEducation_PE")
      .map(p => p.patchId);
    expect(pePatchIds.length).toBe(0);
  });

  it("does NOT duplicate patches when psychoEducationActivation is null", () => {
    const bundle = buildDetectionBundle({
      userMessage: "Hoe gaat het vandaag?",
      persona: "elias",
      sessionId: "session_test_005",
      localUserId: "local_user",
      candidateSignals: null,
      schemaModeResult: null,
      bufferSnapshot: null,
      activeModule: null,
      moodSliders: null,
      moduleActivations: [],
      psychoEducationActivation: null,
    });

    const plan = buildMemoryWritePlan(bundle);
    const pePatchIds = plan.patches
      .filter(p => p.source === "PsychoEducation_PE")
      .map(p => p.patchId);
    expect(pePatchIds.length).toBe(0);
  });
});

// ─── 7. PROMPT PAYLOAD STRUCTURE ─────────────────────────────────────────────

describe("Prompt payload structure", () => {
  it("WILSKRACHT01 payload has store:false and safety flags", () => {
    const input = makeBaseInput();
    const detection = detectWilskracht01(input);
    const payload = buildWilskracht01PromptPayload({ detection, runtimeInput: input });

    expect(payload.store).toBe(false);
    expect(payload.gptMayDiagnose).toBe(false);
    expect(payload.gptMayGiveMedicalAdvice).toBe(false);
    expect(payload.gptMayExcuseConsequences).toBe(false);
    expect(payload.gptMayIgnoreMemoryHints).toBe(false);
    expect(payload.persona).toBe("elias");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
  });

  it("AUTOPILOT01 payload has correct moduleId and forbidden output", () => {
    const input = makeAutopilotInput();
    const detection = detectAutopilot01(input);
    const payload = buildAutopilot01PromptPayload({ detection, runtimeInput: input });

    expect(payload.moduleId).toBe("AUTOPILOT01");
    expect(payload.store).toBe(false);
    expect(payload.persona).toBe("elias");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
  });
});
