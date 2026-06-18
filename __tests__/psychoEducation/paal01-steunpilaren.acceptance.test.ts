/**
 * PAAL01 — Steunpilaren Inventaris + Balkmetafoor
 * Acceptance tests: detector, memory patch builder, output safety, pipeline integration
 * Spec-aligned V2: DEFER_TO_SAFETY, DEFER_TO_GROUNDING, OFFER_AS_FOLLOWUP,
 * conditional state.dat, layerJustification, intervention types, updated safety filter.
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
import { assembleEliasSteunpilarenMemoryContext } from "@/src/pipeline/memory/eliasSteunpilarenContextAssembler";

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
    stabilizedEnoughForReflection: true,
    crisisDetected: false,
    suicideSelfHarmDetected: false,
    acuteDangerDetected: false,
    relapseIntentDetected: false,
    severeIntoxicationDetected: false,
    medicalEmergencyDetected: false,
    activeGroundingNeeded: false,
    existingPillarsCount: 0,
    existingBalanceItemsCount: 0,
    profileFeatureFirstUse: false,
    hasRecentDifficultMomentResolved: false,
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

// ─── PERSONA SEPARATION ─────────────────────────────────────

describe("PAAL01 — Persona Separation", () => {
  it("blocks Kim persona", () => {
    const result = detectPaal01(createBaseInput({ persona: "kim" }));
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("blocks when intake not completed", () => {
    const result = detectPaal01(createBaseInput({ intakeCompleted: false }));
    expect(result.activationStatus).toBe("BLOCKED_BY_INTAKE");
  });

  it("allows Elias persona", () => {
    const result = detectPaal01(createBaseInput());
    expect(result.activationStatus).not.toBe("BLOCKED_BY_PERSONA");
  });
});

// ─── CRISIS OVERRIDE ────────────────────────────────────────

describe("PAAL01 — Crisis Override", () => {
  it("blocks on crisisDetected", () => {
    const result = detectPaal01(createBaseInput({ crisisDetected: true }));
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("blocks on suicideSelfHarmDetected", () => {
    const result = detectPaal01(createBaseInput({ suicideSelfHarmDetected: true }));
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("blocks on acuteDangerDetected", () => {
    const result = detectPaal01(createBaseInput({ acuteDangerDetected: true }));
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });

  it("blocks on medicalEmergencyDetected", () => {
    const result = detectPaal01(createBaseInput({ medicalEmergencyDetected: true }));
    expect(result.activationStatus).toBe("BLOCKED_BY_CRISIS");
  });
});

// ─── DEFER_TO_SAFETY ────────────────────────────────────────

describe("PAAL01 — DEFER_TO_SAFETY", () => {
  it("defers on relapseIntentDetected", () => {
    const result = detectPaal01(createBaseInput({ relapseIntentDetected: true }));
    expect(result.activationStatus).toBe("DEFER_TO_SAFETY");
  });

  it("defers on severeIntoxicationDetected", () => {
    const result = detectPaal01(createBaseInput({ severeIntoxicationDetected: true }));
    expect(result.activationStatus).toBe("DEFER_TO_SAFETY");
  });

  it("defers on ROOD zone without stabilization", () => {
    const result = detectPaal01(createBaseInput({
      currentZone: "ROOD",
      stabilizedEnoughForReflection: false,
    }));
    expect(result.activationStatus).toBe("DEFER_TO_SAFETY");
  });

  it("defers on PAARS zone without stabilization", () => {
    const result = detectPaal01(createBaseInput({
      currentZone: "PAARS",
      stabilizedEnoughForReflection: false,
    }));
    expect(result.activationStatus).toBe("DEFER_TO_SAFETY");
  });
});

// ─── DEFER_TO_GROUNDING ─────────────────────────────────────

describe("PAAL01 — DEFER_TO_GROUNDING", () => {
  it("defers when activeGroundingNeeded", () => {
    const result = detectPaal01(createBaseInput({ activeGroundingNeeded: true }));
    expect(result.activationStatus).toBe("DEFER_TO_GROUNDING");
  });

  it("defers on ORANJE zone without stabilization", () => {
    const result = detectPaal01(createBaseInput({
      currentZone: "ORANJE",
      stabilizedEnoughForReflection: false,
    }));
    expect(result.activationStatus).toBe("DEFER_TO_GROUNDING");
  });
});

// ─── TRIGGER CONTEXTS & INTERVENTION TYPES ──────────────────

describe("PAAL01 — Trigger Contexts & Intervention Types", () => {
  it("activates FIRST_USE_INTRODUCTION with BALANCE_BAR_INTRODUCTION on first use", () => {
    const result = detectPaal01(createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: null,
        moduleUsageCount: 0,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("FIRST_USE_INTRODUCTION");
    expect(result.selectedInterventionType).toBe("BALANCE_BAR_INTRODUCTION");
    expect(result.shouldIntroduceBalanceFeature).toBe(true);
  });

  it("activates POST_DIFFICULTY_REMINDER with POST_DIFFICULT_MOMENT_RECONNECT", () => {
    const result = detectPaal01(createBaseInput({
      hasRecentDifficultMomentResolved: true,
      currentZone: "GEEL",
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
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("POST_DIFFICULTY_REMINDER");
    expect(result.selectedInterventionType).toBe("POST_DIFFICULT_MOMENT_RECONNECT");
  });

  it("activates PERIODIC_UPDATE_INVITATION after 14+ sessions", () => {
    const result = detectPaal01(createBaseInput({
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
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("PERIODIC_UPDATE_INVITATION");
    expect(result.selectedInterventionType).toBe("QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION");
  });

  it("activates STABLE_REFLECTION on NL markers with sufficient confidence", () => {
    const result = detectPaal01(createBaseInput({
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
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.triggerContext).toBe("STABLE_REFLECTION");
    expect(result.matchedMarkers.length).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.60);
  });

  it("selects REMEMBER_EXISTING_PILLARS when supportSeeking + existing pillars", () => {
    const result = detectPaal01(createBaseInput({
      latestUserMessage: "wat houdt mij overeind, ik zoek houvast",
      existingPillarsCount: 3,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "1", category: "routine", label: "wandelen", description: "", addedAt: "", lastReferencedAt: "", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-10T10:00:00Z",
        moduleUsageCount: 2,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBe("REMEMBER_EXISTING_PILLARS");
  });

  it("selects ADD_ONE_SMALL_PILLAR on isolation belief", () => {
    const result = detectPaal01(createBaseInput({
      latestUserMessage: "ik heb niemand die mij steunt, ik sta er alleen voor",
      balkmetafoorInitialized: true,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBe("ADD_ONE_SMALL_PILLAR");
  });

  it("selects QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION on balkmetafoor markers", () => {
    const result = detectPaal01(createBaseInput({
      latestUserMessage: "ik wil zien wat zwaar is en wat helpt, mijn draaglast en draagkracht",
      balkmetafoorInitialized: true,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBe("QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION");
    expect(result.shouldWriteBalanceItemSuggestion).toBe(true);
  });

  it("does NOT activate on unrelated message", () => {
    const result = detectPaal01(createBaseInput({
      latestUserMessage: "het weer is mooi vandaag",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    }));
    expect(result.activationStatus).toBe("NOT_ACTIVE");
  });

  it("detects EN markers correctly", () => {
    const result = detectPaal01(createBaseInput({
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
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.matchedMarkers.length).toBeGreaterThan(0);
  });
});

// ─── MEMORY PATCH — CONDITIONAL STATE.DAT ───────────────────

describe("PAAL01 — Memory Patch Builder", () => {
  it("returns null when detection is NOT_ACTIVE", () => {
    const input = createBaseInput({ latestUserMessage: "het weer is mooi" });
    const detection = detectPaal01(input);
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

  it("returns null during crisis", () => {
    const input = createBaseInput({ crisisDetected: true });
    const detection = detectPaal01(input);
    const patch = buildPaal01MemoryPatch({
      detection: { ...detection, activationStatus: "ACTIVE" },
      runtimeInput: input,
    });
    expect(patch).toBeNull();
  });

  it("writes state.dat on FIRST_USE_INTRODUCTION trigger", () => {
    const input = createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
    });
    const detection = detectPaal01(input);
    expect(detection.triggerContext).toBe("FIRST_USE_INTRODUCTION");
    const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
    expect(patch).not.toBeNull();
    expect(patch!.writes.stateDat).not.toBeNull();
    expect(patch!.layerJustification.stateDat).toBeDefined();
  });

  it("writes state.dat on STABLE_REFLECTION trigger", () => {
    const input = createBaseInput({
      latestUserMessage: "ik heb steun aan mijn routine en mijn hond geeft mij rust",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "pet", label: "hond", description: "", addedAt: "", lastReferencedAt: "", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    expect(detection.triggerContext).toBe("STABLE_REFLECTION");
    const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
    expect(patch).not.toBeNull();
    expect(patch!.writes.stateDat).not.toBeNull();
  });

  it("does NOT write state.dat on POST_DIFFICULTY_REMINDER trigger", () => {
    const input = createBaseInput({
      hasRecentDifficultMomentResolved: true,
      currentZone: "GEEL",
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "person", label: "mijn vrouw", description: "", addedAt: "", lastReferencedAt: "", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 2,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    expect(detection.triggerContext).toBe("POST_DIFFICULTY_REMINDER");
    const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
    expect(patch).not.toBeNull();
    expect(patch!.writes.stateDat).toBeNull();
    expect(patch!.layerJustification.stateDat).toBeUndefined();
  });

  it("does NOT write state.dat on PERIODIC_UPDATE_INVITATION trigger", () => {
    const input = createBaseInput({
      sessionsSinceLastPaal01: 15,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "routine", label: "wandelen", description: "", addedAt: "", lastReferencedAt: "", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-05-01",
        moduleUsageCount: 3,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    expect(detection.triggerContext).toBe("PERIODIC_UPDATE_INVITATION");
    const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
    expect(patch).not.toBeNull();
    expect(patch!.writes.stateDat).toBeNull();
  });

  it("always writes buffer, userDat, logsDat on ACTIVE", () => {
    const input = createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
    });
    const detection = detectPaal01(input);
    const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
    expect(patch).not.toBeNull();
    expect(patch!.writes.buffer).toBeDefined();
    expect(patch!.writes.buffer.activeModuleId).toBe("PAAL01");
    expect(patch!.writes.buffer.activeInterventionType).toBeDefined();
    expect(patch!.writes.userDat).toBeDefined();
    expect(patch!.writes.userDat.moduleUsage.moduleId).toBe("PAAL01");
    expect(patch!.writes.logsDat).toBeDefined();
    expect(patch!.writes.logsDat.encryptedEventType).toBe("therapeutic_module_activation");
    expect(patch!.writes.logsDat.rawTextStored).toBe(false);
    expect(patch!.layerJustification.buffer).toBe("mandatory_current_turn_context");
    expect(patch!.layerJustification.userDat).toBeDefined();
    expect(patch!.layerJustification.logsDat).toBeDefined();
  });

  it("writes projections.dat ONLY when isolation belief detected", () => {
    const inputNoIsolation = createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
      latestUserMessage: "ik ben dankbaar voor mijn vrouw",
    });
    const detectionNoIso = detectPaal01(inputNoIsolation);
    const patchNoIso = buildPaal01MemoryPatch({ detection: detectionNoIso, runtimeInput: inputNoIsolation });
    expect(patchNoIso!.writes.projectionsDat).toBeNull();
    expect(patchNoIso!.layerJustification.projectionsDat).toBeUndefined();

    const inputIsolation = createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
      latestUserMessage: "ik heb niemand, ik sta er alleen voor",
    });
    const detectionIso = detectPaal01(inputIsolation);
    const patchIso = buildPaal01MemoryPatch({ detection: detectionIso, runtimeInput: inputIsolation });
    expect(patchIso!.writes.projectionsDat).not.toBeNull();
    expect(patchIso!.writes.projectionsDat!.upsertBeliefs[0].normalizedLabel).toBe("perceived_isolation");
    expect(patchIso!.layerJustification.projectionsDat).toBeDefined();
  });

  it("does NOT write any patch on OFFER_AS_FOLLOWUP", () => {
    const input = createBaseInput({
      latestUserMessage: "ik zoek houvast",
      currentZone: "GROEN",
      existingPillarsCount: 2,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [{ id: "1", category: "routine", label: "wandelen", description: "", addedAt: "", lastReferencedAt: "", sourceModuleId: "PAAL01" }],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 1,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
      balkmetafoorInitialized: true,
    });
    const detection = detectPaal01(input);
    if (detection.activationStatus === "OFFER_AS_FOLLOWUP") {
      const patch = buildPaal01MemoryPatch({ detection, runtimeInput: input });
      expect(patch).toBeNull();
    }
  });
});

// ─── PROMPT BUILDER ─────────────────────────────────────────

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

  it("includes selectedInterventionType and gptMayScoreUser:false", () => {
    const input = createBaseInput({
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
    });
    const detection = detectPaal01(input);
    const payload = buildPaal01PromptPayload({ detection, runtimeInput: input });
    expect(payload).not.toBeNull();
    expect(payload!.selectedInterventionType).toBe(detection.selectedInterventionType);
    expect(payload!.gptMayScoreUser).toBe(false);
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayUseKimData).toBe(false);
    expect(payload!.gptMayOverrideCrisis).toBe(false);
    expect(payload!.store).toBe(false);
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
      profileFeatureFirstUse: true,
    });
    const detection = detectPaal01(input);
    const payload = buildPaal01PromptPayload({ detection, runtimeInput: input });

    expect(payload).not.toBeNull();
    expect(payload!.persona).toBe("elias");
    expect(payload!.memoryDirective.hardDirective).toBe(true);
    expect(payload!.memoryDirective.useAtEveryRelevantTurn).toBe(true);
    expect(payload!.memoryDirective.useAtTurnFivePlus).toBe(true);
    expect(payload!.memoryDirective.notKeywordGated).toBe(true);
    expect(payload!.memoryDirective.directiveText).toContain("mijn vrouw");
    expect(payload!.forbiddenOutput.length).toBeGreaterThan(0);
  });
});

// ─── OUTPUT SAFETY FILTER ───────────────────────────────────

describe("PAAL01 — Output Safety Filter", () => {
  const FALLBACK = "Ik maak hier geen score van";

  it("passes safe text through", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Wat fijn dat je vrouw er voor je is. Wat betekent zij voor jou in moeilijke momenten?",
      persona: "elias",
      crisisDetected: false,
    });
    expect(result).toContain("Wat fijn");
  });

  it("blocks Kim persona output", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Wat fijn dat je vrouw er is.",
      persona: "kim",
      crisisDetected: false,
    });
    expect(result).toContain(FALLBACK);
  });

  it("blocks output during crisis", () => {
    const result = enforceSteunpilarenOutputSafety({
      moduleId: "PAAL01",
      text: "Laten we je steunpilaren bekijken.",
      persona: "elias",
      crisisDetected: true,
    });
    expect(result).toContain(FALLBACK);
  });

  const forbiddenPatterns = [
    "Je score is 3 van de 10",
    "Je hebt 5 punten verdiend",
    "Je bent op level 2",
    "Je hebt een badge behaald",
    "Je streak is 7 dagen",
    "Je ranking is laag",
    "Je draagkracht is te laag",
    "Je draaglast is te hoog",
    "Je balans is negatief",
    "Je gaat hervallen als je zo doorgaat",
    "Dit voorspelt herval",
    "Dit is een diagnose",
    "Dit is een symptoom van depressie",
    "Je hebt geen steun",
    "Je bent alleen in dit proces",
    "Je hebt onvoldoende steun",
    "Je hebt te weinig steunpilaren",
    "Je moet meer mensen hebben",
    "Je moet dit invullen",
    "Je faalt in je herstel",
    "Ik heb opgeslagen dat je wandelt",
    "In user.dat staat je informatie",
    "De engine weet wat je nodig hebt",
    "Crisisprotocol hoeft niet",
    "Mood sliders zijn minder belangrijk",
    "Kim zou zeggen dat je moet volhouden",
    "Negatieve balans betekent risico",
  ];

  forbiddenPatterns.forEach((pattern) => {
    it(`rejects: "${pattern.substring(0, 40)}..."`, () => {
      const result = enforceSteunpilarenOutputSafety({
        moduleId: "PAAL01",
        text: pattern,
        persona: "elias",
        crisisDetected: false,
      });
      expect(result).toContain(FALLBACK);
    });
  });
});

// ─── BALKMETAFOOR TYPES ─────────────────────────────────────

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

// ─── MEMORY WRITE ROUTER INTEGRATION ────────────────────────

describe("PAAL01 — Memory Write Router Integration", () => {
  it("generates patches when paal01Activation present", () => {
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
      selfAcceptanceActivation: null,
    };

    const plan = buildMemoryWritePlan(bundle);
    const paal01Patches = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01");
    expect(paal01Patches.length).toBeGreaterThanOrEqual(2);

    const layers = paal01Patches.map((p) => p.layer);
    expect(layers).toContain("user.dat");
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
      selfAcceptanceActivation: null,
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
      selfAcceptanceActivation: null,
    };

    const plan = buildMemoryWritePlan(bundle);
    const pePatchIds = plan.patches.filter((p) => p.source === "PsychoEducation_PE").map((p) => p.patchId);
    const paalPatchIds = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01").map((p) => p.patchId);

    for (const peId of pePatchIds) {
      expect(paalPatchIds).not.toContain(peId);
    }
  });
});

// ─── CONTEXT ASSEMBLER — NOT KEYWORD-GATED ──────────────────

describe("PAAL01 — Context Assembler (not keyword-gated)", () => {
  const baseAssemblerInput = {
    persona: "elias" as const,
    sessionId: "session_test",
    turnId: "turn_test",
    turnIndex: 8,
    latestUserMessage: "het regent vandaag",
    stateDat: null,
    userDat: {
      moduleUsage: [{ moduleId: "PAAL01", count: 3 }],
      steunpilaren: [{ label: "wandelen" }, { label: "mijn zus" }],
      balkmetafoor: {
        draaglast: [{ text: "werkdruk" }],
        draagkracht: [{ text: "wandelen" }],
      },
    },
    logsDat: [{ moduleId: "PAAL01", safeSummary: "PAAL01 active: steunpilaren inventaris" }],
  };

  it("returns context even when message has NO steunpilaren keywords (not keyword-gated)", () => {
    const result = assembleEliasSteunpilarenMemoryContext(baseAssemblerInput);
    expect(result).not.toBeNull();
    expect(result!.hardDirectiveForGpt).toContain("wandelen");
    expect(result!.hardDirectiveForGpt).toContain("mijn zus");
  });

  it("returns context at turn 8 (not limited to first 2 turns)", () => {
    const result = assembleEliasSteunpilarenMemoryContext({ ...baseAssemblerInput, turnIndex: 8 });
    expect(result).not.toBeNull();
  });

  it("returns context at turn 20 (not limited to early turns)", () => {
    const result = assembleEliasSteunpilarenMemoryContext({ ...baseAssemblerInput, turnIndex: 20 });
    expect(result).not.toBeNull();
  });

  it("returns null for Kim persona", () => {
    const result = assembleEliasSteunpilarenMemoryContext({ ...baseAssemblerInput, persona: "kim" as any });
    expect(result).toBeNull();
  });

  it("returns null when no PAAL01 usage exists", () => {
    const result = assembleEliasSteunpilarenMemoryContext({
      ...baseAssemblerInput,
      userDat: { moduleUsage: [], steunpilaren: [] },
    });
    expect(result).toBeNull();
  });

  it("includes balkmetafoor summary when available", () => {
    const result = assembleEliasSteunpilarenMemoryContext(baseAssemblerInput);
    expect(result).not.toBeNull();
    expect(result!.balkmetafoorSummary).toEqual({ draaglastCount: 1, draagkrachtCount: 1 });
  });
});

// ─── MEMORY CONTINUITY AT TURN 5+ ──────────────────────────

describe("PAAL01 — Memory Continuity (turn 5+)", () => {
  it("prompt directive explicitly states turn 5+ usage", () => {
    const input = createBaseInput({
      turnIndex: 7,
      profileFeatureFirstUse: true,
      balkmetafoorInitialized: false,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: [
          { id: "p1", category: "person", label: "mijn vrouw", description: "steun", addedAt: "2026-01-01", lastReferencedAt: "2026-01-01", sourceModuleId: "PAAL01" },
        ],
        lastActivatedAt: "2026-06-01",
        moduleUsageCount: 2,
        recentLogSafeSummaries: [],
        balkmetafoorEntries: { draaglast: [], draagkracht: [] },
      },
    });
    const detection = detectPaal01(input);
    const payload = buildPaal01PromptPayload({ detection, runtimeInput: input });

    expect(payload!.memoryDirective.useAtTurnFivePlus).toBe(true);
    expect(payload!.memoryDirective.notLimitedToFirstTwoTurns).toBe(true);
    expect(payload!.memoryDirective.directiveText).toContain("turn 5+");
    expect(payload!.memoryDirective.directiveText).toContain("mijn vrouw");
  });
});
