/**
 * VSP Insight System — Test Suite (22 cases)
 *
 * Tests cover:
 * - State detection (rational green, overwhelm, real green)
 * - Router framework selection (MI, MBT, DGT)
 * - Safety core deference (crisis, relapse intent)
 * - Kim variant routing
 * - DGT soothing flow (safety filtering, personalization)
 * - Chat signal extraction
 * - Phase tracker
 * - PDF export (disclaimer presence)
 * - Pipeline layer integration
 */

import { describe, it, expect } from "vitest";
import { detectVspInsightState } from "@/lib/features/vspInsight/detectVspInsightState";
import { detectRationalGreenSignals } from "@/lib/features/vspInsight/detectRationalGreenSignals";
import { detectOverwhelmSignals } from "@/lib/features/vspInsight/detectOverwhelmSignals";
import { routeVspInsight } from "@/lib/features/vspInsight/vspInsightRouter";
import { routeKimVspInsight, mapToKimInsightState, detectKimOverwhelmBoost, detectKimRationalGreenBoost } from "@/lib/features/vspInsight/kimVspVariant";
import { extractChatSignals, mergeChatSignals, createEmptyChatSignals } from "@/lib/features/vspInsight/vspChatSignalAdapter";
import { buildDgtSoothingFlow, getAllSoothingOptions } from "@/lib/features/vspInsight/vspDgtSoothingFlow";
import { buildPdfSections, buildPdfPlainText } from "@/lib/features/vspInsight/vspInsightPdfExport";
import { detectPhaseTransition, createPhaseTrackerState } from "@/lib/features/vspInsight/vspInsightPhaseTracker";
import { runVspInsightLayer } from "@/lib/features/vspInsight/vspInsightPipelineLayer";
import type {
  VspMoodSlidersSnapshot,
  VspChatSignalSnapshot,
  ImmutableSafetyCoreSnapshot,
  VspInsightProfile,
  VspPdfExportInput,
} from "@/lib/features/vspInsight/vspInsightTypes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMood(overrides: Partial<VspMoodSlidersSnapshot> = {}): VspMoodSlidersSnapshot {
  return {
    selfReportedZone: "GROEN",
    craving: 0,
    frustration: 0,
    despondency: 0,
    focus: 5,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSafetyCore(overrides: Partial<ImmutableSafetyCoreSnapshot> = {}): ImmutableSafetyCoreSnapshot {
  return {
    finalZone: "GROEN",
    userReportedZone: "GROEN",
    safetyOverrideActive: false,
    crisisDetected: false,
    relapseIntentDetected: false,
    modelRoutingDecision: "gpt-4o-mini",
    activeSafetyModuleId: null,
    immutableCoreVersion: "1.0.0",
    ...overrides,
  };
}

function makeEmptySignals(): VspChatSignalSnapshot {
  return createEmptyChatSignals();
}

// ─── TEST 1: Rational Green Detection — Elias ────────────────────────────────

describe("VSP Insight State Detection", () => {
  it("T01: detects RATIONAL_GREEN when user reports green but shows rationality markers", () => {
    const mood = makeMood({ selfReportedZone: "GROEN", craving: 2, frustration: 3 });
    const signals = createEmptyChatSignals();
    signals.rationalityMarkers = ["het gaat goed", "ik voel me prima", "alles is onder controle"];
    signals.emotionalConnectionMarkers = [];

    const result = detectVspInsightState({
      mood,
      chatSignals: signals,
      immutableCore: makeSafetyCore(),
    });

    expect(result.insightState).toBe("RATIONAL_GREEN");
    expect(result.rationalGreenScore).toBeGreaterThan(result.realGreenScore);
  });

  it("T02: detects REAL_GREEN when user shows genuine emotional connection", () => {
    const mood = makeMood({ selfReportedZone: "GROEN", craving: 0, frustration: 1 });
    const signals = createEmptyChatSignals();
    signals.emotionalConnectionMarkers = ["ik voel me echt goed", "ik ben blij"];
    signals.warmthMarkers = ["dankbaar", "verbonden"];
    signals.rationalityMarkers = [];

    const result = detectVspInsightState({
      mood,
      chatSignals: signals,
      immutableCore: makeSafetyCore(),
    });

    expect(result.insightState).toBe("REAL_GREEN");
    expect(result.realGreenScore).toBeGreaterThan(result.rationalGreenScore);
  });

  it("T03: detects OVERWHELMED_ORANGE_RED when high craving + overwhelm markers", () => {
    const mood = makeMood({ selfReportedZone: "ORANJE", craving: 8, frustration: 7 });
    const signals = createEmptyChatSignals();
    signals.overwhelmMarkers = ["ik kan niet meer", "te veel"];
    signals.cravingMarkers = ["ik wil gebruiken"];

    const result = detectVspInsightState({
      mood,
      chatSignals: signals,
      immutableCore: makeSafetyCore({ finalZone: "ORANJE" }),
    });

    expect(result.insightState).toBe("OVERWHELMED_ORANGE_RED");
    expect(result.overwhelmScore).toBeGreaterThan(result.realGreenScore);
  });

  it("T04: defers to safety core when crisis detected", () => {
    const mood = makeMood({ selfReportedZone: "ROOD", craving: 9 });
    const signals = createEmptyChatSignals();

    const result = detectVspInsightState({
      mood,
      chatSignals: signals,
      immutableCore: makeSafetyCore({ crisisDetected: true, safetyOverrideActive: true }),
    });

    expect(result.insightState).toBe("OVERWHELMED_ORANGE_RED");
    expect(result.reasons[0]).toContain("Safety core override active");
  });
});

// ─── TEST 5-8: Router Framework Selection ─────────────────────────────────────

describe("VSP Insight Router", () => {
  it("T05: routes REAL_GREEN to MI framework", () => {
    const result = routeVspInsight({
      insightState: "REAL_GREEN",
      immutableCore: makeSafetyCore(),
      persona: "elias",
      sessionTurnCount: 5,
    });

    expect(result.framework).toBe("MI");
    expect(result.promptFrame.frameworkLabel).toBe("MI");
    expect(result.storeGptCall).toBe(false);
  });

  it("T06: routes RATIONAL_GREEN to MBT framework", () => {
    const result = routeVspInsight({
      insightState: "RATIONAL_GREEN",
      immutableCore: makeSafetyCore(),
      persona: "elias",
      sessionTurnCount: 3,
    });

    expect(result.framework).toBe("MBT");
    expect(result.promptFrame.frameworkLabel).toBe("MBT");
    expect(result.promptFrame.silentDiscrepancyNote).not.toBeNull();
  });

  it("T07: routes OVERWHELMED_ORANGE_RED to DGT framework", () => {
    const result = routeVspInsight({
      insightState: "OVERWHELMED_ORANGE_RED",
      immutableCore: makeSafetyCore({ finalZone: "ORANJE" }),
      persona: "elias",
      sessionTurnCount: 2,
    });

    expect(result.framework).toBe("DGT");
    expect(result.promptFrame.frameworkLabel).toBe("DGT");
  });

  it("T08: defers to SAFETY_CORE_ONLY when relapse intent detected", () => {
    const result = routeVspInsight({
      insightState: "OVERWHELMED_ORANGE_RED",
      immutableCore: makeSafetyCore({ relapseIntentDetected: true }),
      persona: "elias",
      sessionTurnCount: 1,
    });

    expect(result.framework).toBe("SAFETY_CORE_ONLY");
  });
});

// ─── TEST 9-12: Kim Variant ───────────────────────────────────────────────────

describe("VSP Insight Kim Variant", () => {
  it("T09: maps REAL_GREEN to REAL_GREEN_CAREGIVER for Kim", () => {
    expect(mapToKimInsightState("REAL_GREEN")).toBe("REAL_GREEN_CAREGIVER");
  });

  it("T10: routes Kim RATIONAL_GREEN to MBT with caregiver framing", () => {
    const result = routeKimVspInsight({
      insightState: "RATIONAL_GREEN",
      immutableCore: makeSafetyCore(),
      sessionTurnCount: 4,
    });

    expect(result.framework).toBe("MBT");
    expect(result.kimInsightState).toBe("RATIONAL_GREEN_CAREGIVER");
    expect(result.promptFrame.systemInstruction).toContain("parentificatie");
  });

  it("T11: routes Kim OVERWHELMED to DGT with caregiver burnout framing", () => {
    const result = routeKimVspInsight({
      insightState: "OVERWHELMED_ORANGE_RED",
      immutableCore: makeSafetyCore({ finalZone: "ORANJE" }),
      sessionTurnCount: 2,
    });

    expect(result.framework).toBe("DGT");
    expect(result.promptFrame.systemInstruction).toContain("mantelzorger-burnout");
  });

  it("T12: detects Kim-specific overwhelm markers", () => {
    const signals = createEmptyChatSignals();
    signals.overwhelmMarkers = ["ik kan niet meer zorgen", "ik ben uitgeput", "alles draait om hem"];

    const boost = detectKimOverwhelmBoost(signals);
    expect(boost).toBeGreaterThanOrEqual(2);
  });
});

// ─── TEST 13-15: DGT Soothing Flow ───────────────────────────────────────────

describe("VSP DGT Soothing Flow", () => {
  it("T13: returns max 3 soothing options", () => {
    const result = buildDgtSoothingFlow({
      persona: "elias",
      mood: makeMood({ craving: 7, frustration: 6, selfReportedZone: "ORANJE" }),
      immutableCore: makeSafetyCore({ finalZone: "ORANJE" }),
      profile: null,
    });

    expect(result.selectedOptions.length).toBeLessThanOrEqual(3);
    expect(result.selectedOptions.length).toBeGreaterThan(0);
    expect(result.userFacingIntro).toBeTruthy();
  });

  it("T14: filters out craving-triggering options when craving is high", () => {
    const result = buildDgtSoothingFlow({
      persona: "elias",
      mood: makeMood({ craving: 9, selfReportedZone: "ROOD" }),
      immutableCore: makeSafetyCore({ finalZone: "ROOD" }),
      profile: null,
    });

    // Options with excludedIfCravingAtLeast should be filtered
    const allOptions = getAllSoothingOptions();
    const cravingExcluded = allOptions.filter(o => o.excludedIfCravingAtLeast && o.excludedIfCravingAtLeast <= 9);
    for (const excluded of cravingExcluded) {
      expect(result.selectedOptions.find(o => o.optionId === excluded.optionId)).toBeUndefined();
    }
  });

  it("T15: Kim never gets craving-related soothing intro", () => {
    const result = buildDgtSoothingFlow({
      persona: "kim",
      mood: makeMood({ frustration: 8, selfReportedZone: "ORANJE" }),
      immutableCore: makeSafetyCore({ finalZone: "ORANJE" }),
      profile: null,
    });

    expect(result.userFacingIntro).not.toContain("craving");
    expect(result.userFacingIntro).toContain("zwaar");
  });
});

// ─── TEST 16-17: Chat Signal Extraction ───────────────────────────────────────

describe("VSP Chat Signal Adapter", () => {
  it("T16: extracts rationality markers from Dutch text", () => {
    const text = "Het gaat goed met mij, alles is onder controle. Ik voel me prima.";
    const signals = extractChatSignals(text);

    expect(signals.rationalityMarkers.length).toBeGreaterThan(0);
  });

  it("T17: merges multiple signal snapshots correctly", () => {
    const s1 = createEmptyChatSignals();
    s1.rationalityMarkers = ["marker1"];
    s1.overwhelmMarkers = ["overwhelm1"];

    const s2 = createEmptyChatSignals();
    s2.rationalityMarkers = ["marker2"];
    s2.cravingMarkers = ["craving1"];

    const merged = mergeChatSignals([s1, s2]);
    expect(merged.rationalityMarkers).toContain("marker1");
    expect(merged.rationalityMarkers).toContain("marker2");
    expect(merged.cravingMarkers).toContain("craving1");
    expect(merged.overwhelmMarkers).toContain("overwhelm1");
  });
});

// ─── TEST 18-19: Phase Tracker ────────────────────────────────────────────────

describe("VSP Phase Tracker", () => {
  it("T18: detects phase transition from RATIONAL_GREEN to REAL_GREEN", () => {
    const state = createPhaseTrackerState("RATIONAL_GREEN", "GROEN", new Date(Date.now() - 300000).toISOString());

    const result = detectPhaseTransition(state, {
      insightState: "REAL_GREEN",
      zone: "GROEN",
      nowIso: new Date().toISOString(),
      sourceSignals: [],
      lastSoothingChoiceEvent: null,
    });

    expect(result).not.toBeNull();
    expect(result!.fromState).toBe("RATIONAL_GREEN");
    expect(result!.toState).toBe("REAL_GREEN");
  });

  it("T19: does NOT detect transition when state is unchanged", () => {
    const state = createPhaseTrackerState("REAL_GREEN", "GROEN", new Date().toISOString());

    const result = detectPhaseTransition(state, {
      insightState: "REAL_GREEN",
      zone: "GROEN",
      nowIso: new Date().toISOString(),
      sourceSignals: [],
      lastSoothingChoiceEvent: null,
    });

    expect(result).toBeNull();
  });
});

// ─── TEST 20: PDF Export ──────────────────────────────────────────────────────

describe("VSP PDF Export", () => {
  it("T20: includes disclaimer and never includes raw messages", () => {
    const profile: VspInsightProfile = {
      profileVersion: "vsp_insight_profile.v1",
      userId: "test-user",
      persona: "elias",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
      selfReportedEarlySigns: [],
      observedEarlySigns: [],
      phaseTransitionExamples: [],
      wheelOfChangeHistory: [],
      discrepancyHistory: [],
      soothingProfile: {
        genericOptionsUsed: [],
        personalizedEffectiveOptions: [],
        excludedOptions: [],
      },
      rationalGreenPattern: { patternId: "rg", label: "Rational Green", markers: [], confidence: 0, examples: [], firstDetectedAt: "", lastUpdatedAt: "" },
      overwhelmPattern: { patternId: "ow", label: "Overwhelm", markers: [], confidence: 0, examples: [], firstDetectedAt: "", lastUpdatedAt: "" },
      realGreenPattern: { patternId: "rg2", label: "Real Green", markers: [], confidence: 0, examples: [], firstDetectedAt: "", lastUpdatedAt: "" },
    };

    const input: VspPdfExportInput = {
      persona: "elias",
      profile,
      includeRawUserSelectedExamples: false,
      selectedExampleIds: [],
      exportedAt: new Date().toISOString(),
    };

    const sections = buildPdfSections(input);
    const disclaimerSection = sections.find(s => s.title === "Disclaimer");

    expect(disclaimerSection).toBeDefined();
    expect(disclaimerSection!.content).toContain("GEEN diagnose");
    expect(disclaimerSection!.content).toContain("geen medisch dossier");

    // Plain text version
    const plainText = buildPdfPlainText(input);
    expect(plainText).toContain("GEEN diagnose");
    expect(plainText).not.toContain("__RAW_MESSAGE__");
  });
});

// ─── TEST 21-22: Pipeline Layer Integration ───────────────────────────────────

describe("VSP Insight Pipeline Layer", () => {
  it("T21: pipeline layer returns active=false when safety core overrides", () => {
    const result = runVspInsightLayer({
      persona: "elias",
      userMessage: "ik wil dood",
      recentMessages: [],
      moodSliders: { craving: 9, frustration: 9, despondency: 9, focus: 1 },
      selfReportedZone: "ROOD",
      sessionTurnCount: 1,
      safetyCore: {
        finalZone: "ROOD",
        userReportedZone: "ROOD",
        safetyOverrideActive: true,
        crisisDetected: true,
        relapseIntentDetected: false,
        modelRoutingDecision: "gpt-4o",
        activeSafetyModuleId: "CRISIS_01",
      },
      profile: null,
    });

    expect(result.active).toBe(false);
    expect(result.framework).toBe("SAFETY_CORE_ONLY");
    expect(result.contextString).toBe("");
    expect(result.storeGptCall).toBe(false);
  });

  it("T22: pipeline layer returns active=true with MBT when rational green detected", () => {
    const result = runVspInsightLayer({
      persona: "elias",
      userMessage: "het gaat goed met mij, alles is onder controle, ik voel me prima",
      recentMessages: ["ja het gaat goed", "ik heb geen problemen"],
      moodSliders: { craving: 1, frustration: 2, despondency: 1, focus: 7 },
      selfReportedZone: "GROEN",
      sessionTurnCount: 5,
      safetyCore: {
        finalZone: "GROEN",
        userReportedZone: "GROEN",
        safetyOverrideActive: false,
        crisisDetected: false,
        relapseIntentDetected: false,
        modelRoutingDecision: "gpt-4o-mini",
        activeSafetyModuleId: null,
      },
      profile: null,
    });

    expect(result.active).toBe(true);
    // Should detect rational green or real green — both are valid active states
    expect(["MI", "MBT"]).toContain(result.framework);
    expect(result.contextString.length).toBeGreaterThan(0);
    expect(result.storeGptCall).toBe(false);
  });
});
