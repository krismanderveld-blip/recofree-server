/**
 * PAAL01 — Steunpilaren Inventaris + Balkmetafoor
 * Acceptance tests: detector, memory patch builder, output safety, pipeline integration
 */
import { describe, it, expect } from "vitest";
import { detectPaal01 } from "@/src/modules/elias/PAAL01/paal01.detector";
import { buildPaal01MemoryPatch } from "@/src/modules/elias/PAAL01/paal01.memoryPatchBuilder";
import { buildPaal01PromptPayload } from "@/src/modules/elias/PAAL01/paal01.promptBuilder";
import { enforceSteunpilarenOutputSafety } from "@/src/modules/elias/steunpilarenOutputSafetyFilter";
import { deriveBalkmetafoorVisualState, createEmptyBalkmetafoor } from "@/src/types/balkmetafoor.types";
import type { SteunpilarenRuntimeInput } from "@/src/types/eliasSteunpilaren.types";
import type { BalkmetafoorData } from "@/src/types/balkmetafoor.types";
import { buildMemoryWritePlan } from "@/lib/pipeline/memory/memoryWriteRouter";
import type { PipelineDetectionBundle, PipelineTurnContext } from "@/lib/types/memory/memoryCore.types";

function createBaseInput(overrides?: Partial<SteunpilarenRuntimeInput>): SteunpilarenRuntimeInput {
  return {
    persona: "elias",
    intakeCompleted: true,
    userId: "user_test_123",
    sessionId: "session_test_456",
    turnId: "turn_test_789",
    turnIndex: 3,
    timestampIso: "2026-06-18T10:00:00.000Z",
    latestUserMessage: "ik ben dankbaar voor mijn vrouw",
    recentMessages: ["hoe gaat het", "het gaat goed", "ik ben dankbaar voor mijn vrouw"],
    language: "nl",
    currentZone: "GROEN",
    crisisDetected: false,
    suicideSelfHarmDetected: false,
    acuteDangerDetected: false,
    relapseIntentDetected: false,
    severeIntoxicationDetected: false,
    medicalEmergencyDetected: false,
    existingEliasSteunpilarenHints: {
      storedSteunpilaren: [],
      lastActivatedAt: null,
      moduleUsageCount: 0,
      recentLogSafeSummaries: [],
      balkmetafoorEntries: { draaglast: [], draagkracht: [] },
    },
    sessionsSinceLastPaal01: 0,
    balkmetafoorInitialized: false,
    ...overrides,
  };
}

function createTestContext(): PipelineTurnContext {
  return {
    turnId: "turn_test_001",
    sessionId: "session_test_001",
    localUserId: "local_user_test",
    persona: "elias",
    timestampIso: "2026-06-18T10:00:00.000Z",
    appVersion: "1.0.0",
    pipelineVersion: "2.0.0",
    inputHash: "abc123",
    language: "nl",
  };
}

describe("PAAL01 — Detector", () => {
  it("blocks Kim persona", () => {
    const input = createBaseInput({ persona: "kim" });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("blocks when intake not completed", () => {
    const input = createBaseInput({ intakeCompleted: false });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_INTAKE");
  });

  it("blocks during crisis", () => {
    const input = createBaseInput({ crisisDetected: true });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("blocks during suicide/self-harm detection", () => {
    const input = createBaseInput({ suicideSelfHarmDetected: true });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("blocks in ROOD zone", () => {
    const input = createBaseInput({ currentZone: "ROOD" });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("NOT_ACTIVE");
    expect(result.reason).toContain("not stable");
  });

  it("blocks in ORANJE zone", () => {
    const input = createBaseInput({ currentZone: "ORANJE" });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("NOT_ACTIVE");
  });

  it("activates FIRST_USE_INTRODUCTION when moduleUsageCount=0 and balkmetafoor not initialized", () => {
    const input = createBaseInput({
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: null,
        moduleUsageCount: 0,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: false,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("FIRST_USE_INTRODUCTION");
    expect(result.confidenceScore).toBe(0.80);
    expect(result.confidenceBand).toBe("VERY_HIGH");
  });

  it("activates POST_DIFFICULTY_REMINDER after stabilization from ORANJE/ROOD", () => {
    const input = createBaseInput({
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "person", label: "mijn vrouw", description: "steun", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 2,
        recentLogSafeSummaries: ["PAAL01 active: ORANJE zone detected last session"],
        balkmetafoorEntries: { draaglast: ["werk"], draagkracht: ["vrouw"] },
      },
      balkmetafoorInitialized: true,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("POST_DIFFICULTY_REMINDER");
    expect(result.confidenceScore).toBe(0.70);
  });

  it("activates PERIODIC_UPDATE_INVITATION after 14+ sessions", () => {
    const input = createBaseInput({
      sessionsSinceLastPaal01: 15,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "routine", label: "wandelen", description: "dagelijks", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-05-01",
        moduleUsageCount: 3,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: ["wandelen"] },
      },
      balkmetafoorInitialized: true,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("PERIODIC_UPDATE_INVITATION");
    expect(result.confidenceScore).toBe(0.60);
  });

  it("activates STABLE_REFLECTION on NL markers with sufficient confidence", () => {
    const input = createBaseInput({
      latestUserMessage: "ik heb steun aan mijn routine en mijn hond geeft mij rust",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "pet", label: "hond", description: "mijn hond", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: ["hond"] },
      },
      balkmetafoorInitialized: true,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("STABLE_REFLECTION");
    expect(result.matchedMarkers.length).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.60);
  });

  it("does NOT activate on unrelated message", () => {
    const input = createBaseInput({
      latestUserMessage: "het weer is mooi vandaag",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("NOT_ACTIVE");
  });

  it("detects EN markers correctly", () => {
    const input = createBaseInput({
      latestUserMessage: "i am grateful for my dog and my routine helps me a lot",
      language: "en",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const result = detectPaal01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.matchedMarkers.length).toBeGreaterThan(0);
  });
});

describe("PAAL01 — Memory Patch Builder", () => {
  it("returns null when detection is NOT_ACTIVE", () => {
    const input = createBaseInput({ latestUserMessage: "het weer is mooi" });
    const detection = detectPaal01(input);
    // Ensure it's not active for this test
    const patch = buildPaal01MemoryPatch({
      detection: { ...detection, activationStatus: "NOT_ACTIVE" },
      runtimeInput: input,
    });
    expect(patch).toBeNull();
  });

  it("returns null for Kim persona", () => {
    const input = createBaseInput({ persona: "kim" });
    const detection = detectPaal01(input);
    const patch = buildPaal01MemoryPatch({
      detection: { ...detection, activationStatus: "ACTIVE" },
      runtimeInput: input,
    });
    expect(patch).toBeNull();
  });

  it("builds all mandatory layers on ACTIVE detection", () => {
    const input = createBaseInput();
    const detection = detectPaal01(input);
    // Force active for test
    const activeDetection = { ...detection, activationStatus: "ACTIVE" as const, triggerContext: "FIRST_USE_INTRODUCTION" as const };
    const patch = buildPaal01MemoryPatch({ detection: activeDetection, runtimeInput: input });

    expect(patch).not.toBeNull();
    expect(patch!.persona).toBe("elias");
    expect(patch!.moduleId).toBe("PAAL01");
    expect(patch!.writes.buffer.activeModuleId).toBe("PAAL01");
    expect(patch!.writes.stateDat.activeTherapeuticFrame).toBe("steunpilaren_inventaris");
    expect(patch!.writes.userDat.moduleUsage.moduleId).toBe("PAAL01");
    expect(patch!.writes.logsDat.encryptedEventType).toBe("therapeutic_module_activation");
    expect(patch!.writes.logsDat.rawTextStored).toBe(false);
  });

  it("writes projections.dat ONLY when isolation belief detected", () => {
    const inputNoIsolation = createBaseInput({ latestUserMessage: "ik ben dankbaar voor mijn vrouw" });
    const detection = detectPaal01(inputNoIsolation);
    const activeDetection = { ...detection, activationStatus: "ACTIVE" as const, triggerContext: "STABLE_REFLECTION" as const };
    const patchNoIsolation = buildPaal01MemoryPatch({ detection: activeDetection, runtimeInput: inputNoIsolation });
    expect(patchNoIsolation!.writes.projectionsDat).toBeNull();

    const inputIsolation = createBaseInput({ latestUserMessage: "ik heb niemand, ik sta er alleen voor" });
    const patchIsolation = buildPaal01MemoryPatch({ detection: activeDetection, runtimeInput: inputIsolation });
    expect(patchIsolation!.writes.projectionsDat).not.toBeNull();
    expect(patchIsolation!.writes.projectionsDat!.upsertBeliefs[0].normalizedLabel).toBe("perceived_isolation");
  });

  it("does NOT write when crisis is detected", () => {
    const input = createBaseInput({ crisisDetected: true });
    const detection = detectPaal01(input);
    const activeDetection = { ...detection, activationStatus: "ACTIVE" as const, triggerContext: "STABLE_REFLECTION" as const };
    const patch = buildPaal01MemoryPatch({ detection: activeDetection, runtimeInput: input });
    expect(patch).toBeNull();
  });
});

describe("PAAL01 — Prompt Builder", () => {
  it("returns null when not active", () => {
    const input = createBaseInput();
    const detection = detectPaal01(input);
    const payload = buildPaal01PromptPayload({
      detection: { ...detection, activationStatus: "NOT_ACTIVE" as const },
      runtimeInput: input,
    });
    expect(payload).toBeNull();
  });

  it("returns null for Kim persona", () => {
    const input = createBaseInput({ persona: "kim" });
    const detection = detectPaal01(input);
    const payload = buildPaal01PromptPayload({
      detection: { ...detection, activationStatus: "ACTIVE" as const },
      runtimeInput: input,
    });
    expect(payload).toBeNull();
  });

  it("builds correct payload with memory directive on ACTIVE", () => {
    const input = createBaseInput({
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "person", label: "mijn vrouw", description: "steun", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 2,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: ["vrouw"] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    const activeDetection = { ...detection, activationStatus: "ACTIVE" as const, triggerContext: "STABLE_REFLECTION" as const };
    const payload = buildPaal01PromptPayload({ detection: activeDetection, runtimeInput: input });

    expect(payload).not.toBeNull();
    expect(payload!.persona).toBe("elias");
    expect(payload!.store).toBe(false);
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayUseKimData).toBe(false);
    expect(payload!.gptMayOverrideCrisis).toBe(false);
    expect(payload!.memoryDirective.hardDirective).toBe(true);
    expect(payload!.memoryDirective.useAtEveryRelevantTurn).toBe(true);
    expect(payload!.memoryDirective.useAtTurnFivePlus).toBe(true);
    expect(payload!.memoryDirective.notKeywordGated).toBe(true);
    expect(payload!.memoryDirective.directiveText).toContain("mijn vrouw");
    expect(payload!.forbiddenOutput.length).toBeGreaterThan(0);
  });
});

describe("PAAL01 — Output Safety Filter", () => {
  it("passes safe text through", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Wat fijn dat je vrouw er voor je is. Wat betekent zij voor jou in moeilijke momenten?",
      persona: "elias",
      crisisDetected: false,
    });
    expect(result).toContain("Wat fijn");
  });

  it("blocks forbidden pattern 'je hebt geen steun'", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Het klinkt alsof je hebt geen steun in je leven.",
      persona: "elias",
      crisisDetected: false,
    });
    expect(result).toContain("Ik wil niet vastzetten");
  });

  it("blocks Kim persona output", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Wat fijn dat je vrouw er is.",
      persona: "kim",
      crisisDetected: false,
    });
    expect(result).toContain("Ik wil niet vastzetten");
  });

  it("blocks output during crisis", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Laten we je steunpilaren bekijken.",
      persona: "elias",
      crisisDetected: true,
    });
    expect(result).toContain("Ik wil niet vastzetten");
  });

  it("blocks gamification language", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Je hebt 5 punten verdiend voor deze reflectie!",
      persona: "elias",
      crisisDetected: false,
    });
    expect(result).toContain("Ik wil niet vastzetten");
  });

  it("blocks memory disclosure", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Ik heb opgeslagen dat je vrouw belangrijk is.",
      persona: "elias",
      crisisDetected: false,
    });
    expect(result).toContain("Ik wil niet vastzetten");
  });
});

describe("PAAL01 — Balkmetafoor Types", () => {
  it("creates empty balkmetafoor", () => {
    const empty = createEmptyBalkmetafoor();
    expect(empty.initialized).toBe(false);
    expect(empty.draaglast).toHaveLength(0);
    expect(empty.draagkracht).toHaveLength(0);
  });

  it("derives EMPTY state for uninitialized data", () => {
    const state = deriveBalkmetafoorVisualState(createEmptyBalkmetafoor());
    expect(state).toBe("EMPTY");
  });

  it("derives BALANCED state when equal entries", () => {
    const data: BalkmetafoorData = {
      initialized: true,
      initializedAt: "2026-01-01",
      lastUpdatedAt: "2026-06-01",
      draaglast: [{ id: "1", text: "werk", addedAt: "2026-01-01", sourceModuleId: "PAAL01" }],
      draagkracht: [{ id: "2", text: "vrouw", addedAt: "2026-01-01", sourceModuleId: "PAAL01" }],
    };
    expect(deriveBalkmetafoorVisualState(data)).toBe("BALANCED");
  });

  it("derives LEANING_DRAAGLAST when more draaglast", () => {
    const data: BalkmetafoorData = {
      initialized: true,
      initializedAt: "2026-01-01",
      lastUpdatedAt: "2026-06-01",
      draaglast: [
        { id: "1", text: "werk", addedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        { id: "2", text: "schulden", addedAt: "2026-01-01", sourceModuleId: "PAAL01" },
      ],
      draagkracht: [{ id: "3", text: "vrouw", addedAt: "2026-01-01", sourceModuleId: "PAAL01" }],
    };
    expect(deriveBalkmetafoorVisualState(data)).toBe("LEANING_DRAAGLAST");
  });

  it("derives LEANING_DRAAGKRACHT when more draagkracht", () => {
    const data: BalkmetafoorData = {
      initialized: true,
      initializedAt: "2026-01-01",
      lastUpdatedAt: "2026-06-01",
      draaglast: [{ id: "1", text: "werk", addedAt: "2026-01-01", sourceModuleId: "PAAL01" }],
      draagkracht: [
        { id: "2", text: "vrouw", addedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        { id: "3", text: "wandelen", addedAt: "2026-01-01", sourceModuleId: "PAAL01" },
      ],
    };
    expect(deriveBalkmetafoorVisualState(data)).toBe("LEANING_DRAAGKRACHT");
  });
});

describe("PAAL01 — Memory Write Router Integration", () => {
  it("generates user.dat + state.dat + logs.dat patches when paal01Activation present", () => {
    const bundle: PipelineDetectionBundle = {
      context: createTestContext(),
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
      activeModule: null,
      zoneDecision: null,
      moodState: null,
      psychoEducationActivation: null,
      paal01Activation: {
        moduleId: "PAAL01",
        triggerContext: "FIRST_USE_INTRODUCTION",
        confidence: 0.80,
        matchedMarkers: [],
      },
    };

    const plan = buildMemoryWritePlan(bundle);
    const paal01Patches = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01");
    expect(paal01Patches.length).toBe(3); // user.dat + state.dat + logs.dat

    const layers = paal01Patches.map((p) => p.layer);
    expect(layers).toContain("user.dat");
    expect(layers).toContain("state.dat");
    expect(layers).toContain("logs.dat");
  });

  it("does NOT generate PAAL01 patches when paal01Activation is null", () => {
    const bundle: PipelineDetectionBundle = {
      context: createTestContext(),
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
      activeModule: null,
      zoneDecision: null,
      moodState: null,
      psychoEducationActivation: null,
      paal01Activation: null,
    };

    const plan = buildMemoryWritePlan(bundle);
    const paal01Patches = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01");
    expect(paal01Patches.length).toBe(0);
  });

  it("does NOT duplicate with psychoEducation patches", () => {
    const bundle: PipelineDetectionBundle = {
      context: createTestContext(),
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
      activeModule: null,
      zoneDecision: null,
      moodState: null,
      psychoEducationActivation: {
        moduleId: "WILSKRACHT01",
        detectedMarkers: ["wilskracht"],
        activationConfidence: 0.75,
        responseMode: "FULL_PSYCHOEDUCATION",
        crisisOverride: false,
        memoryHints: null,
      },
      paal01Activation: {
        moduleId: "PAAL01",
        triggerContext: "STABLE_REFLECTION",
        confidence: 0.65,
        matchedMarkers: ["ik heb steun aan"],
      },
    };

    const plan = buildMemoryWritePlan(bundle);
    const pePatchIds = plan.patches.filter((p) => p.source === "PsychoEducation_PE").map((p) => p.patchId);
    const paalPatchIds = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01").map((p) => p.patchId);

    // No overlap in patch IDs
    for (const peId of pePatchIds) {
      expect(paalPatchIds).not.toContain(peId);
    }
  });
});

describe("PAAL01 — Memory Continuity (turn 5+)", () => {
  it("prompt directive explicitly states turn 5+ usage", () => {
    const input = createBaseInput({
      turnIndex: 7,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "person", label: "mijn vrouw", description: "steun", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 2,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    const activeDetection = { ...detection, activationStatus: "ACTIVE" as const, triggerContext: "STABLE_REFLECTION" as const };
    const payload = buildPaal01PromptPayload({ detection: activeDetection, runtimeInput: input });

    expect(payload!.memoryDirective.useAtTurnFivePlus).toBe(true);
    expect(payload!.memoryDirective.notLimitedToFirstTwoTurns).toBe(true);
    expect(payload!.memoryDirective.directiveText).toContain("turn 5+");
    expect(payload!.memoryDirective.directiveText).toContain("mijn vrouw");
  });
});
