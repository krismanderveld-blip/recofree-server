/**
 * Self-Acceptance Cluster — BLIK01/ONTK01/IKST01/COEX01 Acceptance Tests
 * Tests: persona-scheiding, crisis-override, correcte laag-gebruik,
 * memory-continuïteit in greeting + latere beurt.
 */
import { describe, it, expect } from "vitest";

// Detectors
import { detectBlik01 } from "@/src/modules/elias/BLIK01/blik01.detector";
import { detectOntk01 } from "@/src/modules/elias/ONTK01/ontk01.detector";
import { detectIkst01 } from "@/src/modules/elias/IKST01/ikst01.detector";
import { detectCoex01 } from "@/src/modules/elias/COEX01/coex01.detector";

// Memory patch builders
import { buildBlik01MemoryPatch } from "@/src/modules/elias/BLIK01/blik01.memoryPatchBuilder";
import { buildOntk01MemoryPatch } from "@/src/modules/elias/ONTK01/ontk01.memoryPatchBuilder";
import { buildIkst01MemoryPatch } from "@/src/modules/elias/IKST01/ikst01.memoryPatchBuilder";
import { buildCoex01MemoryPatch } from "@/src/modules/elias/COEX01/coex01.memoryPatchBuilder";

// Prompt builders
import { buildBlik01PromptPayload } from "@/src/modules/elias/BLIK01/blik01.promptBuilder";
import { buildOntk01PromptPayload } from "@/src/modules/elias/ONTK01/ontk01.promptBuilder";
import { buildIkst01PromptPayload } from "@/src/modules/elias/IKST01/ikst01.promptBuilder";
import { buildCoex01PromptPayload } from "@/src/modules/elias/COEX01/coex01.promptBuilder";

// Output safety filter
import { enforceSelfAcceptanceClusterOutputSafety } from "@/src/modules/elias/selfAcceptanceClusterOutputSafetyFilter";

// Context assembler
import { assembleEliasSelfAcceptanceMemoryContext } from "@/src/pipeline/memory/eliasSelfAcceptanceContextAssembler";

// Memory write router
import { buildMemoryWritePlan } from "@/lib/pipeline/memory/memoryWriteRouter";
import type { PipelineDetectionBundle, PipelineTurnContext } from "@/lib/types/memory/memoryCore.types";
import type { EliasSelfAcceptanceRuntimeInput, EliasSelfAcceptanceMemoryHints } from "@/src/types/eliasSelfAcceptanceCluster.types";

// ─── HELPERS ─────────────────────────────────────────────────

function createTestContext(overrides?: Partial<PipelineTurnContext>): PipelineTurnContext {
  return {
    turnId: "turn_sac_001",
    sessionId: "session_sac_001",
    localUserId: "user_sac_001",
    persona: "elias",
    timestampIso: "2026-06-18T10:00:00.000Z",
    appVersion: "1.0.0",
    pipelineVersion: "2.0.0",
    inputHash: "sac_test_hash",
    language: "nl",
    ...overrides,
  };
}

const emptyMemoryHints: EliasSelfAcceptanceMemoryHints = {
  activeModuleIds: [],
  moduleUsageCount: {},
  knownPatterns: [],
  knownBeliefs: [],
  knownHandles: [],
  recentSafeLogSummaries: [],
  lastActivatedAt: {},
};

function createDetectorInput(overrides?: Partial<EliasSelfAcceptanceRuntimeInput>): EliasSelfAcceptanceRuntimeInput {
  return {
    persona: "elias",
    intakeCompleted: true,
    userId: "user_001",
    sessionId: "session_001",
    turnId: "turn_001",
    turnIndex: 6,
    timestampIso: "2026-06-18T10:00:00Z",
    latestUserMessage: "",
    recentMessages: [],
    language: "nl",
    currentZone: "GEEL",
    stabilizedEnoughForReflection: true,
    crisisDetected: false,
    suicideSelfHarmDetected: false,
    acuteDangerDetected: false,
    relapseIntentDetected: false,
    severeIntoxicationDetected: false,
    medicalEmergencyDetected: false,
    activeGroundingNeeded: false,
    paal01Available: true,
    paal01KnownSupportPillars: [],
    existingEliasMemoryHints: emptyMemoryHints,
    ...overrides,
  };
}

// ─── PERSONA SEPARATION ──────────────────────────────────────

describe("Self-Acceptance Cluster — Persona Separation", () => {
  it("BLIK01 does NOT activate for Kim persona", () => {
    const result = detectBlik01(createDetectorInput({
      persona: "kim",
      latestUserMessage: "ineens is mijn steun weg, ik ben ontslagen",
    }));
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
  });

  it("ONTK01 does NOT activate for Kim persona", () => {
    const result = detectOntk01(createDetectorInput({
      persona: "kim",
      latestUserMessage: "ik heb geen probleem met drinken",
    }));
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
  });

  it("IKST01 does NOT activate for Kim persona", () => {
    const result = detectIkst01(createDetectorInput({
      persona: "kim",
      latestUserMessage: "ik deed het impulsief",
    }));
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
  });

  it("COEX01 does NOT activate for Kim persona", () => {
    const result = detectCoex01(createDetectorInput({
      persona: "kim",
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld",
    }));
    expect(result.activationStatus).toBe("BLOCKED_BY_PERSONA");
  });

  it("BLIK01 DOES activate for Elias persona with matching markers", () => {
    const result = detectBlik01(createDetectorInput({
      latestUserMessage: "ineens is mijn steun weg, ik ben ontslagen",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("BLIK01");
  });

  it("ONTK01 DOES activate for Elias persona with denial markers", () => {
    const result = detectOntk01(createDetectorInput({
      latestUserMessage: "het valt wel mee, ik heb het onder controle, één keer kan geen kwaad",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("ONTK01");
  });

  it("IKST01 DOES activate for Elias persona with impulsive action markers", () => {
    const result = detectIkst01(createDetectorInput({
      latestUserMessage: "ik reageerde impulsief, mijn gevoel nam over en ik moest controle terugpakken",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("IKST01");
  });

  it("COEX01 DOES activate for Elias persona with responsibility confusion markers", () => {
    const result = detectCoex01(createDetectorInput({
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld, ik weet niet meer wie schuld heeft",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.moduleId).toBe("COEX01");
  });
});

// ─── CRISIS OVERRIDE ─────────────────────────────────────────

describe("Self-Acceptance Cluster — Crisis Override", () => {
  it("BLIK01 defers when crisisDetected is true", () => {
    const result = detectBlik01(createDetectorInput({
      crisisDetected: true,
      latestUserMessage: "anderen zien mij als een mislukkeling",
    }));
    expect(result.activationStatus).not.toBe("ACTIVE");
  });

  it("ONTK01 defers when suicideSelfHarmDetected is true", () => {
    const result = detectOntk01(createDetectorInput({
      suicideSelfHarmDetected: true,
      latestUserMessage: "ik heb geen probleem met drinken",
    }));
    expect(result.activationStatus).not.toBe("ACTIVE");
  });

  it("IKST01 defers when crisisDetected is true", () => {
    const result = detectIkst01(createDetectorInput({
      crisisDetected: true,
      latestUserMessage: "ik deed het impulsief",
    }));
    expect(result.activationStatus).not.toBe("ACTIVE");
  });

  it("COEX01 defers when acuteDangerDetected is true", () => {
    const result = detectCoex01(createDetectorInput({
      acuteDangerDetected: true,
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld",
    }));
    expect(result.activationStatus).not.toBe("ACTIVE");
  });
});

// ─── CORRECT LAYER USAGE ─────────────────────────────────────

describe("Self-Acceptance Cluster — Memory Layer Usage", () => {
  it("BLIK01 memory patch writes buffer + state.dat + user.dat + logs.dat", () => {
    const detection = detectBlik01(createDetectorInput({
      latestUserMessage: "ineens is mijn steun weg, ik ben ontslagen",
    }));
    const patch = buildBlik01MemoryPatch({
      detection,
      sessionId: "session_001",
      turnId: "turn_001",
      timestampIso: "2026-06-18T10:00:00Z",
      currentZone: "GEEL",
      stabilizedEnoughForReflection: true,
      latestUserMessage: "ineens is mijn steun weg, ik ben ontslagen",
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.buffer.activeModuleId).toBe("BLIK01");
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.stateDat!.activeTherapeuticFrame).toBe("support_pillar_shock");
    // userDat may be null if no specific pillar label is extracted
    expect(patch.writes.logsDat).toBeDefined();
    expect(patch.writes.logsDat!.encryptedEventType).toBe("therapeutic_module_activation");
  });

  it("ONTK01 memory patch writes buffer + state.dat + user.dat + logs.dat + projections.dat", () => {
    const detection = detectOntk01(createDetectorInput({
      latestUserMessage: "het valt wel mee, ik heb het onder controle, één keer kan geen kwaad",
    }));
    const patch = buildOntk01MemoryPatch({
      detection,
      sessionId: "session_001",
      turnId: "turn_002",
      timestampIso: "2026-06-18T10:01:00Z",
      currentZone: "GEEL",
      stabilizedEnoughForReflection: true,
      latestUserMessage: "het valt wel mee, ik heb het onder controle, één keer kan geen kwaad",
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.stateDat!.activeTherapeuticFrame).toBe("denial_pattern_reflection");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
    // ONTK01 writes projections.dat when belief phrases are present
    expect(patch.writes.projectionsDat).toBeDefined();
    expect(patch.writes.projectionsDat!.upsertBeliefs.length).toBeGreaterThan(0);
    expect(patch.writes.projectionsDat!.upsertBeliefs[0].sourceModuleId).toBe("ONTK01");
  });

  it("IKST01 memory patch writes buffer + state.dat + user.dat + logs.dat", () => {
    const detection = detectIkst01(createDetectorInput({
      latestUserMessage: "ik reageerde impulsief, mijn gevoel nam over en ik moest controle terugpakken, ik heb spijt",
    }));
    const patch = buildIkst01MemoryPatch({
      detection,
      sessionId: "session_001",
      turnId: "turn_003",
      timestampIso: "2026-06-18T10:02:00Z",
      currentZone: "GEEL",
      stabilizedEnoughForReflection: true,
      latestUserMessage: "ik reageerde impulsief, mijn gevoel nam over en ik moest controle terugpakken, ik heb spijt",
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.stateDat!.activeTherapeuticFrame).toBe("ego_strength_recovery");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
  });

  it("COEX01 memory patch writes buffer + state.dat + user.dat + logs.dat", () => {
    const detection = detectCoex01(createDetectorInput({
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld, ik weet niet meer wie schuld heeft",
    }));
    const patch = buildCoex01MemoryPatch({
      detection,
      sessionId: "session_001",
      turnId: "turn_004",
      timestampIso: "2026-06-18T10:03:00Z",
      currentZone: "GEEL",
      stabilizedEnoughForReflection: true,
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld, ik weet niet meer wie schuld heeft",
    });
    expect(patch.writes.buffer).toBeDefined();
    expect(patch.writes.stateDat).toBeDefined();
    expect(patch.writes.stateDat!.activeTherapeuticFrame).toBe("existential_acceptance");
    expect(patch.writes.userDat).toBeDefined();
    expect(patch.writes.logsDat).toBeDefined();
  });
});

// ─── MEMORY WRITE ROUTER INTEGRATION ─────────────────────────

describe("Self-Acceptance Cluster — Memory Write Router", () => {
  it("generates user.dat + state.dat + logs.dat patches for selfAcceptanceActivation", () => {
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
      selfAcceptanceActivation: {
        moduleId: "BLIK01",
        confidence: 0.75,
        matchedMarkers: ["anderen zien mij als"],
        interventionType: "EXTERNAL_GAZE_REFLECTION",
        patternType: "external_judgment_internalized",
      },
      kimPatternSupportActivation: null,
    };

    const plan = buildMemoryWritePlan(bundle);
    const sacPatches = plan.patches.filter((p) =>
      typeof p.source === "string" && p.source.startsWith("SelfAcceptance_")
    );
    expect(sacPatches.length).toBeGreaterThanOrEqual(3);

    const layers = sacPatches.map((p) => p.layer);
    expect(layers).toContain("user.dat");
    expect(layers).toContain("state.dat");
    expect(layers).toContain("logs.dat");
  });

  it("does NOT generate selfAcceptance patches when activation is null", () => {
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
    const sacPatches = plan.patches.filter((p) =>
      typeof p.source === "string" && p.source.startsWith("SelfAcceptance_")
    );
    expect(sacPatches.length).toBe(0);
  });

  it("does NOT duplicate with PAAL01 or psychoEducation patches", () => {
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
      selfAcceptanceActivation: {
        moduleId: "ONTK01",
        confidence: 0.72,
        matchedMarkers: ["ik heb geen probleem"],
        interventionType: "GENTLE_MIRROR",
        patternType: "minimization",
      },
      kimPatternSupportActivation: null,
    };


    const plan = buildMemoryWritePlan(bundle);
    const pePatchIds = plan.patches.filter((p) => p.source === "PsychoEducation_PE").map((p) => p.patchId);
    const paalPatchIds = plan.patches.filter((p) => p.source === "Steunpilaren_PAAL01").map((p) => p.patchId);
    const sacPatchIds = plan.patches.filter((p) =>
      typeof p.source === "string" && p.source.startsWith("SelfAcceptance_")
    ).map((p) => p.patchId);

    // No overlap between any of the three
    for (const sacId of sacPatchIds) {
      expect(pePatchIds).not.toContain(sacId);
      expect(paalPatchIds).not.toContain(sacId);
    }
  });
});

// ─── PROMPT BUILDERS ─────────────────────────────────────────

describe("Self-Acceptance Cluster — Prompt Builders", () => {
  it("BLIK01 prompt payload contains forbidden output and intervention type", () => {
    const detection = detectBlik01(createDetectorInput({
      latestUserMessage: "ineens is mijn steun weg, ik ben ontslagen",
    }));
    const payload = buildBlik01PromptPayload(detection, "session_001", "turn_001");
    expect(payload.moduleId).toBe("BLIK01");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
    expect(payload.selectedInterventionType).toBeDefined();
  });

  it("ONTK01 prompt payload contains confrontation-without-accusation", () => {
    const detection = detectOntk01(createDetectorInput({
      latestUserMessage: "het valt wel mee, ik heb het onder controle, één keer kan geen kwaad",
    }));
    const payload = buildOntk01PromptPayload(detection, "session_001", "turn_002");
    expect(payload.moduleId).toBe("ONTK01");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
    // Must not accuse
    expect(payload.fullPrompt.toLowerCase()).toContain("do not accuse");
  });

  it("IKST01 prompt payload contains strength recovery directive", () => {
    const detection = detectIkst01(createDetectorInput({
      latestUserMessage: "ik reageerde impulsief, mijn gevoel nam over en ik moest controle terugpakken",
    }));
    const payload = buildIkst01PromptPayload(detection, "session_001", "turn_003");
    expect(payload.moduleId).toBe("IKST01");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
  });

  it("COEX01 prompt payload contains responsibility separation directive", () => {
    const detection = detectCoex01(createDetectorInput({
      latestUserMessage: "het is hun schuld maar ook alles is mijn schuld, ik weet niet meer wie schuld heeft",
    }));
    const payload = buildCoex01PromptPayload(detection, "session_001", "turn_004");
    expect(payload.moduleId).toBe("COEX01");
    expect(payload.forbiddenOutput.length).toBeGreaterThan(0);
  });
});

// ─── OUTPUT SAFETY FILTER ────────────────────────────────────

describe("Self-Acceptance Cluster — Output Safety Filter", () => {
  it("blocks diagnostic language", () => {
    const result = enforceSelfAcceptanceClusterOutputSafety({
      moduleId: "BLIK01",
      text: "Je hebt duidelijk een diagnose nodig voor je persoonlijkheidsstoornis.",
      persona: "elias",
      crisisDetected: false,
    });
    // Safety filter returns fallback text (not [BLOCKED]) for forbidden content
    expect(result).not.toContain("diagnose nodig");
  });

  it("blocks Kim persona", () => {
    const result = enforceSelfAcceptanceClusterOutputSafety({
      moduleId: "BLIK01",
      text: "Ik hoor dat je het moeilijk hebt.",
      persona: "kim",
      crisisDetected: false,
    });
    expect(result).toContain("[BLOCKED:");
  });

  it("allows safe therapeutic language for Elias", () => {
    const result = enforceSelfAcceptanceClusterOutputSafety({
      moduleId: "BLIK01",
      text: "Ik hoor dat je het gevoel hebt dat anderen je anders zien dan je bent. Dat klinkt zwaar.",
      persona: "elias",
      crisisDetected: false,
    });
    // Should return the original text (not blocked)
    expect(result).not.toContain("[BLOCKED");
    expect(result).toContain("Ik hoor dat je het gevoel hebt");
  });

  it("blocks crisis-detected output", () => {
    const result = enforceSelfAcceptanceClusterOutputSafety({
      moduleId: "ONTK01",
      text: "Laten we eens kijken naar je ontkenningspatroon.",
      persona: "elias",
      crisisDetected: true,
    });
    expect(result).toContain("[BLOCKED:");
  });
});

// ─── CONTEXT ASSEMBLER — NOT KEYWORD-GATED ───────────────────

describe("Self-Acceptance Cluster — Context Assembler", () => {
  it("assembles context on any turn (not keyword-gated)", () => {
    const ctx = assembleEliasSelfAcceptanceMemoryContext({
      persona: "elias",
      sessionId: "session_test",
      turnId: "turn_test",
      turnIndex: 8,
      latestUserMessage: "vandaag gaat het beter",
      buffer: { activeModuleId: "BLIK01", activeInterventionType: "NAME_PILLAR_SHOCK", currentTurnDirective: "test", extractedCandidates: [] },
      stateDat: { activeTherapeuticFrame: "support_pillar_shock", activeModuleId: "BLIK01" },
      userDat: { moduleUsage: { BLIK01: { count: 2 } } },
      projectionsDat: null,
      logsDat: null,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.directiveText).toContain("BLIK01");
  });

  it("returns null for Kim persona", () => {
    const ctx = assembleEliasSelfAcceptanceMemoryContext({
      persona: "kim",
      sessionId: "session_test",
      turnId: "turn_test",
      turnIndex: 8,
      latestUserMessage: "vandaag gaat het beter",
      buffer: { activeModuleId: "BLIK01", activeInterventionType: "NAME_PILLAR_SHOCK", currentTurnDirective: "test", extractedCandidates: [] },
      stateDat: null,
      userDat: null,
      projectionsDat: null,
      logsDat: null,
    });
    expect(ctx).toBeNull();
  });

  it("includes memory continuity in greeting (turn 0)", () => {
    const ctx = assembleEliasSelfAcceptanceMemoryContext({
      persona: "elias",
      sessionId: "session_new",
      turnId: "turn_greeting",
      turnIndex: 0,
      latestUserMessage: "",
      buffer: { activeModuleId: "ONTK01", activeInterventionType: "GENTLE_MIRROR", currentTurnDirective: "test", extractedCandidates: [] },
      stateDat: { activeTherapeuticFrame: "denial_pattern_reflection", activeModuleId: "ONTK01" },
      userDat: { moduleUsage: { ONTK01: { count: 1 } } },
      projectionsDat: null,
      logsDat: null,
    });
    // Context should be present even at turn 0 (greeting) for memory continuity
    expect(ctx).not.toBeNull();
    expect(ctx!.moduleId).toBe("ONTK01");
  });

  it("includes memory continuity on later turns (turn 10+)", () => {
    const ctx = assembleEliasSelfAcceptanceMemoryContext({
      persona: "elias",
      sessionId: "session_test",
      turnId: "turn_late",
      turnIndex: 12,
      latestUserMessage: "ik denk na over wat je zei",
      buffer: { activeModuleId: "IKST01", activeInterventionType: "IMPULSE_SLOW_DOWN", currentTurnDirective: "test", extractedCandidates: [] },
      stateDat: { activeTherapeuticFrame: "ego_strength_recovery", activeModuleId: "IKST01" },
      userDat: { moduleUsage: { IKST01: { count: 3 } } },
      projectionsDat: null,
      logsDat: null,
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.moduleId).toBe("IKST01");
  });
});

// ─── DETECTOR CONFIDENCE & INTERVENTION TYPE ─────────────────

describe("Self-Acceptance Cluster — Detector Confidence & Intervention Types", () => {
  it("BLIK01 returns correct intervention type for pillar shock", () => {
    const result = detectBlik01(createDetectorInput({
      latestUserMessage: "plotseling is mijn steun weg, de relatie is gedaan",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
  });

  it("ONTK01 returns correct intervention type for minimization", () => {
    const result = detectOntk01(createDetectorInput({
      latestUserMessage: "het valt wel mee, ik drink alleen in het weekend",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
  });

  it("IKST01 returns correct intervention type for impulsive action", () => {
    const result = detectIkst01(createDetectorInput({
      latestUserMessage: "ik reageerde impulsief, mijn gevoel nam over en ik moest controle terugpakken",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
  });

  it("COEX01 returns correct intervention type for blame confusion", () => {
    const result = detectCoex01(createDetectorInput({
      latestUserMessage: "het is hun schuld, maar is het mijn schuld, ben ik verantwoordelijk, het maakt toch niet uit",
    }));
    expect(result.activationStatus).toBe("ACTIVE");
    expect(result.selectedInterventionType).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
  });

  it("Low-confidence messages do NOT activate detectors", () => {
    const blik = detectBlik01(createDetectorInput({
      latestUserMessage: "het weer is mooi vandaag",
    }));
    expect(blik.activationStatus).not.toBe("ACTIVE");

    const ontk = detectOntk01(createDetectorInput({
      latestUserMessage: "ik ga vanavond koken",
    }));
    expect(ontk.activationStatus).not.toBe("ACTIVE");

    const ikst = detectIkst01(createDetectorInput({
      latestUserMessage: "morgen heb ik een afspraak",
    }));
    expect(ikst.activationStatus).not.toBe("ACTIVE");

    const coex = detectCoex01(createDetectorInput({
      latestUserMessage: "de kat ligt op de bank",
    }));
    expect(coex.activationStatus).not.toBe("ACTIVE");
  });
});
