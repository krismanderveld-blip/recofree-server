/**
 * Kim Pattern Support Cluster — Combined Acceptance Tests
 * Modules: PAAL-K01, BEHE-K01, AANP-K01, CODEP-K01
 *
 * Tests: persona separation, crisis priority, correct layer usage,
 * memory continuity, output safety, prompt builders, memory write router.
 */
import { describe, it, expect } from "vitest";
import { detectPaalK01 } from "@/lib/engine/kim/modules/PAAL-K01/paalK01.detector";
import { detectBeheK01 } from "@/lib/engine/kim/modules/BEHE-K01/beheK01.detector";
import { detectAanpK01 } from "@/lib/engine/kim/modules/AANP-K01/aanpK01.detector";
import { detectCodepK01 } from "@/lib/engine/kim/modules/CODEP-K01/codepK01.detector";
import { buildPaalK01MemoryPatch } from "@/lib/engine/kim/modules/PAAL-K01/paalK01.memoryPatchBuilder";
import { buildBeheK01MemoryPatch } from "@/lib/engine/kim/modules/BEHE-K01/beheK01.memoryPatchBuilder";
import { buildAanpK01MemoryPatch } from "@/lib/engine/kim/modules/AANP-K01/aanpK01.memoryPatchBuilder";
import { buildCodepK01MemoryPatch } from "@/lib/engine/kim/modules/CODEP-K01/codepK01.memoryPatchBuilder";
import { buildPaalK01PromptPayload } from "@/lib/engine/kim/modules/PAAL-K01/paalK01.promptBuilder";
import { buildBeheK01PromptPayload } from "@/lib/engine/kim/modules/BEHE-K01/beheK01.promptBuilder";
import { buildAanpK01PromptPayload } from "@/lib/engine/kim/modules/AANP-K01/aanpK01.promptBuilder";
import { buildCodepK01PromptPayload } from "@/lib/engine/kim/modules/CODEP-K01/codepK01.promptBuilder";
import { enforceKimPatternSupportOutputSafety } from "@/lib/engine/kim/modules/patternSupportOutputSafetyFilter";
import { assembleKimPatternSupportMemoryContext } from "@/lib/pipeline/memory/kimPatternSupportContextAssembler";
import { buildMemoryWritePlan } from "@/lib/pipeline/memory/memoryWriteRouter";
import type { PipelineDetectionBundle, PipelineTurnContext } from "@/lib/types/memory/memoryCore.types";
import type { KimPatternRuntimeInput } from "@/lib/types/kimPatternsSupport.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTestContext(): PipelineTurnContext {
  return {
    turnId: `turn_${Date.now()}_abc123`,
    sessionId: "session_test_001",
    localUserId: "local_user_test",
    persona: "kim",
    timestampIso: new Date().toISOString(),
    appVersion: "1.0.0",
    pipelineVersion: "2.0.0",
    inputHash: "test_hash_123",
    language: "nl",
  };
}

function createBaseInput(overrides?: Partial<KimPatternRuntimeInput>): KimPatternRuntimeInput {
  return {
    persona: "kim",
    intakeCompleted: true,
    userId: "user_test_001",
    sessionId: "session_test_001",
    turnId: `turn_${Date.now()}_abc123`,
    turnIndex: 5,
    timestampIso: new Date().toISOString(),
    latestUserMessage: "ik weet niet meer wie ik ben in dit alles",
    recentMessages: [],
    language: "nl",
    currentKimZone: "GEEL",
    stabilizedEnoughForReflection: true,
    crisisDetected: false,
    selfHarmOrSuicideDetected: false,
    acuteDangerDetected: false,
    domesticViolenceOrAbuseDetected: false,
    childDangerDetected: false,
    activeRelapseCrisisDetected: false,
    caregiverOverwhelmed: false,
    existingKimMemoryHints: {
      knownSupportPillars: [],
      knownBalanceDraaglast: [],
      knownBalanceDraagkracht: [],
      activeControlPatternIds: [],
      activeAdaptationPatternIds: [],
      activeCodepPatternIds: [],
      activeProjections: [],
      recentSafeLogSummaries: [],
      moduleUsageCount: { "PAAL-K01": 0, "BEHE-K01": 0, "AANP-K01": 0, "CODEP-K01": 0 },
    },
    ...overrides,
  };
}

// ─── 1. PERSONA SEPARATION ──────────────────────────────────────────────────

describe("Kim Pattern Support — Persona Separation", () => {
  it("PAAL-K01 blocks when persona is elias", () => {
    const input = createBaseInput({
      persona: "elias",
      latestUserMessage: "wie steunt mij eigenlijk in dit alles",
    });
    const result = detectPaalK01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("BEHE-K01 blocks when persona is elias", () => {
    const input = createBaseInput({
      persona: "elias",
      latestUserMessage: "ik controleer alles thuis zodat het niet escaleert",
    });
    const result = detectBeheK01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("AANP-K01 blocks when persona is elias", () => {
    const input = createBaseInput({
      persona: "elias",
      latestUserMessage: "ik pas me altijd aan om ruzie te voorkomen",
    });
    const result = detectAanpK01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("CODEP-K01 blocks when persona is elias", () => {
    const input = createBaseInput({
      persona: "elias",
      latestUserMessage: "zonder mij zou hij helemaal instorten",
    });
    const result = detectCodepK01(input);
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
    expect(result.confidenceScore).toBe(0);
  });

  it("PAAL-K01 activates for Kim persona", () => {
    const input = createBaseInput({
      persona: "kim",
      latestUserMessage: "ik heb zelf steun nodig, ik wil mijn eigen steunpilaren zien, wat houdt mij recht",
    });
    const result = detectPaalK01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("BEHE-K01 activates for Kim persona", () => {
    const input = createBaseInput({
      persona: "kim",
      latestUserMessage: "ik controleer alles, ik ben moe van het controleren, het is een patroon",
    });
    const result = detectBeheK01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("AANP-K01 activates for Kim persona", () => {
    const input = createBaseInput({
      persona: "kim",
      latestUserMessage: "ik houd het stil, ik pas me aan, ik verlies mezelf erin",
    });
    const result = detectAanpK01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("CODEP-K01 activates for Kim persona", () => {
    const input = createBaseInput({
      persona: "kim",
      latestUserMessage: "ik moet hem redden, ik vergeet mezelf, mijn leven draait om hem",
    });
    const result = detectCodepK01(input);
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });
});

// ─── 2. CRISIS PRIORITY ─────────────────────────────────────────────────────

describe("Kim Pattern Support — Crisis Override", () => {
  it("PAAL-K01 defers to CRISIS-K01 when crisis is active", () => {
    const input = createBaseInput({
      crisisDetected: true,
      latestUserMessage: "wie steunt mij eigenlijk in dit alles",
    });
    const result = detectPaalK01(input);
    expect(result.activationStatus).toBe("DEFER_TO_CRISIS_K01");
    expect(result.confidenceScore).toBe(0);
  });

  it("BEHE-K01 defers to GEVAAR-K01 when acute danger", () => {
    const input = createBaseInput({
      acuteDangerDetected: true,
      latestUserMessage: "ik controleer alles thuis zodat het niet escaleert",
    });
    const result = detectBeheK01(input);
    expect(result.activationStatus).toBe("DEFER_TO_GEVAAR_K01");
    expect(result.confidenceScore).toBe(0);
  });

  it("AANP-K01 defers to KIND-K01 when child danger", () => {
    const input = createBaseInput({
      childDangerDetected: true,
      latestUserMessage: "ik pas me altijd aan om ruzie te voorkomen",
    });
    const result = detectAanpK01(input);
    expect(result.activationStatus).toBe("DEFER_TO_KIND_K01");
    expect(result.confidenceScore).toBe(0);
  });

  it("CODEP-K01 defers to CRISIS-K01 when self-harm detected", () => {
    const input = createBaseInput({
      selfHarmOrSuicideDetected: true,
      latestUserMessage: "zonder mij zou hij helemaal instorten",
    });
    const result = detectCodepK01(input);
    expect(result.activationStatus).toBe("DEFER_TO_CRISIS_K01");
    expect(result.confidenceScore).toBe(0);
  });

  it("PAAL-K01 defers to HERV-K01 when active relapse crisis", () => {
    const input = createBaseInput({
      activeRelapseCrisisDetected: true,
      latestUserMessage: "wie steunt mij eigenlijk in dit alles",
    });
    const result = detectPaalK01(input);
    expect(result.activationStatus).toBe("DEFER_TO_HERV_K01");
    expect(result.confidenceScore).toBe(0);
  });
});

// ─── 3. CORRECT LAYER USAGE ─────────────────────────────────────────────────

describe("Kim Pattern Support — Memory Layer Usage", () => {
  it("PAAL-K01 writes buffer + user.dat + state.dat + logs.dat", () => {
    const input = createBaseInput({
      latestUserMessage: "ik heb zelf steun nodig, ik wil mijn eigen steunpilaren zien, wat houdt mij recht",
    });
    const detection = detectPaalK01(input);
    expect(detection.activationStatus).toBe("ACTIVE");
    const patch = buildPaalK01MemoryPatch({
      detection,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: input.timestampIso,
      latestUserMessage: input.latestUserMessage,
      currentKimZone: input.currentKimZone,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
      existingPillarCount: 0,
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.buffer.activeModuleId).toBe("PAAL-K01");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.userDat!.moduleUsage.moduleId).toBe("PAAL-K01");
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
    expect(patch.writes.logsDat!.encryptedEventType).toBe("kim_therapeutic_module_activation");
  });

  it("BEHE-K01 writes buffer + user.dat + state.dat + logs.dat", () => {
    const input = createBaseInput({
      latestUserMessage: "ik controleer alles, ik ben moe van het controleren, het is een patroon",
    });
    const detection = detectBeheK01(input);
    expect(detection.activationStatus).toBe("ACTIVE");
    const patch = buildBeheK01MemoryPatch({
      detection,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: input.timestampIso,
      latestUserMessage: input.latestUserMessage,
      currentKimZone: input.currentKimZone,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.buffer.activeModuleId).toBe("BEHE-K01");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
  });

  it("AANP-K01 writes buffer + user.dat + state.dat + logs.dat", () => {
    const input = createBaseInput({
      latestUserMessage: "ik houd het stil, ik pas me aan, ik verlies mezelf erin",
    });
    const detection = detectAanpK01(input);
    expect(detection.activationStatus).toBe("ACTIVE");
    const patch = buildAanpK01MemoryPatch({
      detection,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: input.timestampIso,
      latestUserMessage: input.latestUserMessage,
      currentKimZone: input.currentKimZone,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.buffer.activeModuleId).toBe("AANP-K01");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
  });

  it("CODEP-K01 writes buffer + user.dat + state.dat + logs.dat", () => {
    const input = createBaseInput({
      latestUserMessage: "ik moet hem redden, ik vergeet mezelf, mijn leven draait om hem",
    });
    const detection = detectCodepK01(input);
    expect(detection.activationStatus).toBe("ACTIVE");
    const patch = buildCodepK01MemoryPatch({
      detection,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: input.timestampIso,
      latestUserMessage: input.latestUserMessage,
      currentKimZone: input.currentKimZone,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.buffer.activeModuleId).toBe("CODEP-K01");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
  });

  it("PAAL-K01 does NOT write projections.dat (not justified for support pillars)", () => {
    const input = createBaseInput({
      latestUserMessage: "ik heb zelf steun nodig, ik wil mijn eigen steunpilaren zien, wat houdt mij recht",
    });
    const detection = detectPaalK01(input);
    const patch = buildPaalK01MemoryPatch({
      detection,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: input.timestampIso,
      latestUserMessage: input.latestUserMessage,
      currentKimZone: input.currentKimZone,
      stabilizedEnoughForReflection: input.stabilizedEnoughForReflection,
      existingPillarCount: 0,
    });
    expect(patch.writes.projectionsDat).toBeUndefined();
  });
});

// ─── 4. MEMORY CONTINUITY ────────────────────────────────────────────────────

describe("Kim Pattern Support — Memory Continuity", () => {
  it("context assembler produces directive from existing memory state", () => {
    const directive = assembleKimPatternSupportMemoryContext({
      persona: "kim",
      sessionId: "session_test_001",
      turnId: "turn_001",
      turnIndex: 0,
      latestUserMessage: "hallo",
      stateDat: {
        activeKimReflectiveFrame: "caregiver_control_pattern",
      },
      userDat: {
        kimProfile: {
          supportPillars: [{ label: "mijn zus", active: true }],
          learnedPatterns: [
            { patternType: "hypervigilance", label: "controleert alles thuis" },
          ],
        },
      },
      projectionsDat: null,
      logsDat: {
        events: [{ safeSummary: "Kim reflecteerde over controlepatronen", moduleId: "BEHE-K01" }],
      },
    });
    expect(directive).not.toBeNull();
    expect(directive!.persona).toBe("kim");
    expect(directive!.hardDirectiveForGpt).toContain("Kim");
    expect(directive!.activeModuleHints).toContain("BEHE-K01");
  });

  it("context assembler produces directive on later turn (not just greeting)", () => {
    const directive = assembleKimPatternSupportMemoryContext({
      persona: "kim",
      sessionId: "session_test_001",
      turnId: "turn_007",
      turnIndex: 7,
      latestUserMessage: "ik voel me weer beter vandaag",
      stateDat: {
        activeKimReflectiveFrame: "caregiver_adaptation_pattern",
      },
      userDat: {
        kimProfile: {
          learnedPatterns: [
            { patternType: "conflict_avoidance", label: "past zich aan" },
          ],
        },
      },
      projectionsDat: null,
      logsDat: null,
    });
    expect(directive).not.toBeNull();
    expect(directive!.activeModuleHints).toContain("AANP-K01");
  });

  it("context assembler returns null for Elias persona", () => {
    const directive = assembleKimPatternSupportMemoryContext({
      persona: "elias",
      sessionId: "session_test_001",
      turnId: "turn_001",
      turnIndex: 0,
      latestUserMessage: "hallo",
      stateDat: { activeKimReflectiveFrame: "kim_control_patterns" },
      userDat: {},
      projectionsDat: null,
      logsDat: null,
    });
    expect(directive).toBeNull();
  });

  it("context assembler returns null when no relevant memory data", () => {
    const directive = assembleKimPatternSupportMemoryContext({
      persona: "kim",
      sessionId: "session_test_001",
      turnId: "turn_001",
      turnIndex: 0,
      latestUserMessage: "hallo",
      stateDat: null,
      userDat: null,
      projectionsDat: null,
      logsDat: null,
    });
    expect(directive).toBeNull();
  });
});

// ─── 5. OUTPUT SAFETY FILTER ─────────────────────────────────────────────────

describe("Kim Pattern Support — Output Safety Filter", () => {
  it("blocks diagnostic language", () => {
    const result = enforceKimPatternSupportOutputSafety({
      moduleId: "CODEP-K01",
      text: "Je vertoont duidelijk codependentie als diagnose.",
      persona: "kim",
      crisisDetected: false,
    });
    // Should return the fallback which does not contain 'codependentie' or 'diagnose' as a label
    expect(result).not.toContain("codependentie");
    expect(result).toContain("Ik plak hier geen label op");
  });

  it("blocks output for wrong persona", () => {
    const result = enforceKimPatternSupportOutputSafety({
      moduleId: "BEHE-K01",
      text: "Ik hoor dat je veel draagt.",
      persona: "elias",
      crisisDetected: false,
    });
    // Should return the fallback for wrong persona
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it("blocks output during crisis", () => {
    const result = enforceKimPatternSupportOutputSafety({
      moduleId: "AANP-K01",
      text: "Laten we kijken naar je aanpassingspatroon.",
      persona: "kim",
      crisisDetected: true,
    });
    // Should return crisis fallback
    expect(result).toBeDefined();
    expect(result).not.toContain("aanpassingspatroon");
  });

  it("allows safe reflective output", () => {
    const safeText = "Ik hoor dat je veel draagt. Wat zou jou op dit moment het meeste helpen?";
    const result = enforceKimPatternSupportOutputSafety({
      moduleId: "PAAL-K01",
      text: safeText,
      persona: "kim",
      crisisDetected: false,
    });
    expect(result).toContain("Ik hoor dat je veel draagt");
  });
});

// ─── 6. PROMPT BUILDERS ──────────────────────────────────────────────────────

describe("Kim Pattern Support — Prompt Builders", () => {
  it("PAAL-K01 prompt contains forbidden output rules and module ID", () => {
    const input = createBaseInput({
      latestUserMessage: "wie steunt mij eigenlijk in dit alles",
    });
    const detection = detectPaalK01(input);
    const prompt = buildPaalK01PromptPayload(detection);
    expect(prompt.forbiddenOutput.length).toBeGreaterThan(0);
    expect(prompt.moduleId).toBe("PAAL-K01");
    expect(prompt.persona).toBe("kim");
    expect(prompt.store).toBe(false);
    expect(prompt.gptMayDiagnose).toBe(false);
    expect(prompt.gptMayUseEliasData).toBe(false);
  });

  it("BEHE-K01 prompt includes intervention type", () => {
    const input = createBaseInput({
      latestUserMessage: "ik controleer alles thuis zodat het niet escaleert",
    });
    const detection = detectBeheK01(input);
    const prompt = buildBeheK01PromptPayload(detection);
    expect(prompt.moduleId).toBe("BEHE-K01");
    expect(prompt.selectedInterventionType).toBeDefined();
    expect(prompt.selectedInterventionType.length).toBeGreaterThan(0);
  });

  it("AANP-K01 prompt includes intervention type", () => {
    const input = createBaseInput({
      latestUserMessage: "ik pas me altijd aan om ruzie te voorkomen",
    });
    const detection = detectAanpK01(input);
    const prompt = buildAanpK01PromptPayload(detection);
    expect(prompt.moduleId).toBe("AANP-K01");
    expect(prompt.selectedInterventionType).toBeDefined();
  });

  it("CODEP-K01 prompt includes intervention type and hard directive", () => {
    const input = createBaseInput({
      latestUserMessage: "zonder mij zou hij helemaal instorten",
    });
    const detection = detectCodepK01(input);
    const prompt = buildCodepK01PromptPayload(detection);
    expect(prompt.moduleId).toBe("CODEP-K01");
    expect(prompt.selectedInterventionType).toBeDefined();
    expect(prompt.memoryDirective.hardDirective).toBe(true);
    expect(prompt.memoryDirective.requiredToUseOnEveryRelevantTurn).toBe(true);
  });
});

// ─── 7. MEMORY WRITE ROUTER INTEGRATION ─────────────────────────────────────

describe("Kim Pattern Support — Memory Write Router", () => {
  it("routes kimPatternSupportActivation to user.dat + state.dat + logs.dat", () => {
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
      kimPatternSupportActivation: {
        moduleId: "BEHE-K01",
        confidence: 0.78,
        matchedMarkers: ["ik controleer alles"],
        interventionType: "PATTERN_NAMING",
      },
    };
    const plan = buildMemoryWritePlan(bundle);
    const kpsPatches = plan.patches.filter((p) =>
      typeof p.source === "string" && p.source.startsWith("KimPatternSupport_")
    );
    expect(kpsPatches.length).toBeGreaterThanOrEqual(3);
    const layers = kpsPatches.map((p) => p.layer);
    expect(layers).toContain("user.dat");
    expect(layers).toContain("state.dat");
    expect(layers).toContain("logs.dat");
  });

  it("does NOT route when kimPatternSupportActivation is null", () => {
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
      kimPatternSupportActivation: null,
    };
    const plan = buildMemoryWritePlan(bundle);
    const kpsPatches = plan.patches.filter((p) =>
      typeof p.source === "string" && p.source.startsWith("KimPatternSupport_")
    );
    expect(kpsPatches.length).toBe(0);
  });

  it("does NOT duplicate with other module patches", () => {
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
      paal01Activation: null,
      selfAcceptanceActivation: null,
      kimPatternSupportActivation: {
        moduleId: "CODEP-K01",
        confidence: 0.72,
        matchedMarkers: ["zonder mij"],
        interventionType: "GENTLE_MIRROR",
      },
    };
    const plan = buildMemoryWritePlan(bundle);
    const kpsPatchIds = plan.patches
      .filter((p) => typeof p.source === "string" && p.source.startsWith("KimPatternSupport_"))
      .map((p) => p.patchId);
    const pePatchIds = plan.patches
      .filter((p) => p.source === "PsychoEducation_PE")
      .map((p) => p.patchId);
    for (const kpsId of kpsPatchIds) {
      expect(pePatchIds).not.toContain(kpsId);
    }
  });
});
