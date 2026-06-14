/**
 * Memory Write Routing — 15 Acceptance Tests
 * Tests the full pipeline: types, utilities, merge logic, patch builders,
 * write router, commit service, and session lifecycle.
 */
import { describe, it, expect } from "vitest";

// Utilities
import { stableHash } from "@/lib/utils/hash/stableHash";
import { createPatchId } from "@/lib/utils/hash/createPatchId";
import { createLogId } from "@/lib/utils/hash/createLogId";
import { roundTo3 } from "@/lib/utils/math/roundTo3";
import { clamp } from "@/lib/utils/math/clamp";
import { daysBetween } from "@/lib/utils/time/daysBetween";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";
import { unique } from "@/lib/utils/arrays/unique";

// Types
import { WRITE_THRESHOLDS } from "@/lib/types/memory/memoryCore.types";
import { createEmptyUserDat } from "@/lib/types/memory/userDat.types";
import { createEmptyStateDat } from "@/lib/types/memory/stateDat.types";
import { createEmptyProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import { createEmptySessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import { createEmptyLogsDat } from "@/lib/types/memory/logsDat.types";

// Merge functions
import { mergeTriggerPattern, mergeSchemaTendency, mergeModeTendency, mergeModuleUsage } from "@/lib/storage/memory/mergeUserDat";
import { mergeMoodHistory, mergeZoneHistoryBuffer } from "@/lib/storage/memory/mergeStateDat";
import { mergeProjectionRecord } from "@/lib/storage/memory/mergeProjectionsDat";
import { applyProjectionDecay, reinforceProjectionScore } from "@/lib/storage/memory/projectionDecay";

// Pipeline
import { buildMemoryWritePlan } from "@/lib/pipeline/memory/memoryWriteRouter";
import { applyMemoryWritePlan } from "@/lib/pipeline/memory/memoryCommitService";
import { executeMemoryWriteBack } from "@/lib/pipeline/memory/memoryWriteBackStep";
import { buildSessionInitContext } from "@/lib/pipeline/memory/sessionInitContextBuilder";
import { USE_LOGS_DAT_CONTEXT } from "@/lib/pipeline/memory/sessionLifecycle";

// Helpers
import type { PipelineDetectionBundle, PipelineTurnContext } from "@/lib/types/memory/memoryCore.types";

function createTestContext(overrides?: Partial<PipelineTurnContext>): PipelineTurnContext {
  return {
    turnId: "turn_001",
    sessionId: "session_001",
    persona: "ELIAS",
    timestampIso: "2026-06-14T10:00:00.000Z",
    inputHash: "abc123",
    ...overrides,
  };
}

function createMinimalBundle(overrides?: Partial<PipelineDetectionBundle>): PipelineDetectionBundle {
  return {
    context: createTestContext(),
    fears: [],
    hopes: [],
    triggers: [],
    schemaTendencies: [],
    modeTendencies: [],
    activeModule: null,
    zoneDecision: null,
    moodState: null,
    ...overrides,
  };
}

describe("Memory Write Routing — Acceptance Tests", () => {
  // Test 1: Utility functions produce deterministic output
  it("Test 1: stableHash is deterministic", () => {
    const h1 = stableHash("verlatingsangst");
    const h2 = stableHash("verlatingsangst");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(8);
    // Different input → different hash
    expect(stableHash("eenzaamheid")).not.toBe(h1);
  });

  // Test 2: roundTo3, clamp, daysBetween work correctly
  it("Test 2: Math utilities work correctly", () => {
    expect(roundTo3(0.12345)).toBe(0.123);
    expect(roundTo3(0.9999)).toBe(1);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(daysBetween("2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z")).toBe(7);
    expect(estimateTokens("Hello world")).toBe(3); // 11 chars / 4 ≈ 3
  });

  // Test 3: Write thresholds are correctly defined
  it("Test 3: WRITE_THRESHOLDS has correct values", () => {
    expect(WRITE_THRESHOLDS.FEAR_PER_TURN).toBe(0.60);
    expect(WRITE_THRESHOLDS.HOPE_PER_TURN).toBe(0.60);
    expect(WRITE_THRESHOLDS.TRIGGER_PER_TURN).toBe(0.50);
    expect(WRITE_THRESHOLDS.SCHEMA_PER_TURN).toBe(0.35);
    expect(WRITE_THRESHOLDS.MODE_PER_TURN).toBe(0.35);
    expect(WRITE_THRESHOLDS.MOOD_CONFIDENCE).toBe(0.75);
  });

  // Test 4: Empty bundle produces only buffer snapshot patch
  it("Test 4: Empty detection bundle produces minimal write plan", () => {
    const bundle = createMinimalBundle();
    const plan = buildMemoryWritePlan(bundle);

    expect(plan.patches.length).toBe(1); // Only buffer snapshot
    expect(plan.patches[0].layer).toBe("buffer");
    expect(plan.patches[0].shouldWrite).toBe(true);
  });

  // Test 5: Fear below threshold is NOT written
  it("Test 5: Fear below threshold produces shouldWrite=false", () => {
    const bundle = createMinimalBundle({
      fears: [{
        label: "verlating",
        normalizedLabel: "verlating",
        category: "relational",
        confidence: 0.20, // Below 0.30 threshold
        sourceKind: "explicit_user_text",
        evidenceHash: "ev1",
      }],
    });
    const plan = buildMemoryWritePlan(bundle);
    const fearPatch = plan.patches.find((p) => p.path === "fears");
    expect(fearPatch).toBeDefined();
    expect(fearPatch!.shouldWrite).toBe(false);
  });

  // Test 6: Fear above threshold IS written
  it("Test 6: Fear above threshold produces shouldWrite=true", () => {
    const bundle = createMinimalBundle({
      fears: [{
        label: "verlatingsangst",
        normalizedLabel: "verlatingsangst",
        category: "relational",
        confidence: 0.65,
        sourceKind: "explicit_user_text",
        evidenceHash: "ev2",
      }],
    });
    const plan = buildMemoryWritePlan(bundle);
    const fearPatch = plan.patches.find((p) => p.path === "fears");
    expect(fearPatch).toBeDefined();
    expect(fearPatch!.shouldWrite).toBe(true);
    expect(fearPatch!.operation).toBe("DECAY_REFRESH_UPSERT");
  });

  // Test 7: Schema/mode use 0.35 threshold
  it("Test 7: Schema at 0.34 is NOT written, at 0.36 IS written", () => {
    const bundleLow = createMinimalBundle({
      schemaTendencies: [{
        schemaId: "ABANDONMENT",
        schemaName: "Verlating",
        confidence: 0.34,
        sourceKind: "pattern_inference",
        evidenceHash: "ev3",
      }],
    });
    const planLow = buildMemoryWritePlan(bundleLow);
    const schemaPatchLow = planLow.patches.find((p) => p.path === "schemaTendencies");
    expect(schemaPatchLow!.shouldWrite).toBe(false);

    const bundleHigh = createMinimalBundle({
      schemaTendencies: [{
        schemaId: "ABANDONMENT",
        schemaName: "Verlating",
        confidence: 0.36,
        sourceKind: "pattern_inference",
        evidenceHash: "ev4",
      }],
    });
    const planHigh = buildMemoryWritePlan(bundleHigh);
    const schemaPatchHigh = planHigh.patches.find((p) => p.path === "schemaTendencies");
    expect(schemaPatchHigh!.shouldWrite).toBe(true);
  });

  // Test 8: mergeUserDat trigger deduplication
  it("Test 8: Trigger merge deduplicates by normalizedTrigger+triggerType", () => {
    let userDat = createEmptyUserDat("ELIAS", "user1");

    const payload1 = {
      label: "eenzaamheid",
      normalizedTrigger: "eenzaamheid",
      triggerType: "emotional" as const,
      confidence: 0.7,
      sourceKind: "explicit_user_text" as const,
      turnId: "t1",
      sessionId: "s1",
      timestampIso: "2026-06-14T10:00:00Z",
      source: "SignalEngine_6c" as const,
      evidenceHash: "h1",
    };

    userDat = mergeTriggerPattern(userDat, payload1);
    expect(userDat.triggerPatterns.length).toBe(1);
    expect(userDat.triggerPatterns[0].frequency).toBe(1);

    // Same trigger again → frequency increases
    userDat = mergeTriggerPattern(userDat, { ...payload1, turnId: "t2", timestampIso: "2026-06-14T11:00:00Z" });
    expect(userDat.triggerPatterns.length).toBe(1);
    expect(userDat.triggerPatterns[0].frequency).toBe(2);
  });

  // Test 9: Projection decay works correctly
  it("Test 9: Projection decay halves score after halfLifeDays", () => {
    const record = {
      projectionId: "fear_test",
      kind: "fear" as const,
      label: "verlating",
      normalizedLabel: "verlating",
      category: "relational",
      currentScore: 1.0,
      baseConfidence: 0.8,
      firstSeenAt: "2026-06-01T00:00:00Z",
      lastSeenAt: "2026-06-01T00:00:00Z",
      lastReinforcedAt: "2026-06-01T00:00:00Z",
      decayHalfLifeDays: 7,
      reinforcementCount: 1,
      sourceCounts: { explicit_user_text: 1, pattern_inference: 0, session_summary: 0 },
      sources: [],
    };

    const config = { fearHalfLifeDays: 7, hopeHalfLifeDays: 14, minimumScore: 0.05, maxScore: 1.0, reinforcementBoost: 0.2 };

    // After exactly 7 days → score should be ~0.5
    const decayed = applyProjectionDecay(record, "2026-06-08T00:00:00Z", config);
    expect(decayed.currentScore).toBeCloseTo(0.5, 1);

    // After 14 days → score should be ~0.25
    const decayed14 = applyProjectionDecay(record, "2026-06-15T00:00:00Z", config);
    expect(decayed14.currentScore).toBeCloseTo(0.25, 1);
  });

  // Test 10: Full write-back produces debug log with gewijzigde velden
  it("Test 10: executeMemoryWriteBack produces debug log with changed fields", () => {
    const bundle = createMinimalBundle({
      fears: [{
        label: "verlatingsangst",
        normalizedLabel: "verlatingsangst",
        category: "relational",
        confidence: 0.65,
        sourceKind: "explicit_user_text",
        evidenceHash: "ev5",
      }],
      triggers: [{
        label: "eenzaamheid",
        normalizedTrigger: "eenzaamheid",
        triggerType: "emotional",
        confidence: 0.55,
        sourceKind: "explicit_user_text",
        evidenceHash: "ev6",
      }],
    });

    const stores = {
      userDat: createEmptyUserDat("ELIAS", "user1"),
      stateDat: createEmptyStateDat("ELIAS"),
      projectionsDat: createEmptyProjectionsDat("ELIAS"),
      sessionBuffer: createEmptySessionBuffer("ELIAS", "session_001"),
    };

    const output = executeMemoryWriteBack({ detectionBundle: bundle, currentStores: stores });

    expect(output.debugLog).toContain("gewijzigde velden:");
    expect(output.debugLog).toContain("projections.fears");
    expect(output.debugLog).toContain("user.triggerPatterns");
    expect(output.commitResult.writtenPatches.length).toBeGreaterThan(0);
    expect(output.commitResult.errors.length).toBe(0);
  });

  // Test 11: USE_LOGS_DAT_CONTEXT flag exists and is false
  it("Test 11: USE_LOGS_DAT_CONTEXT flag is false", () => {
    expect(USE_LOGS_DAT_CONTEXT).toBe(false);
  });

  // Test 12: buildSessionInitContext returns empty when no data
  it("Test 12: buildSessionInitContext returns empty for fresh memory", () => {
    const userDat = createEmptyUserDat("ELIAS", "user1");
    const stateDat = createEmptyStateDat("ELIAS");
    const projDat = createEmptyProjectionsDat("ELIAS");
    const logsDat = createEmptyLogsDat("ELIAS");

    const ctx = buildSessionInitContext(userDat, stateDat, projDat, logsDat);
    expect(ctx.contextBlock).toBe("");
    expect(ctx.tokenEstimate).toBe(0);
  });

  // Test 13: buildSessionInitContext includes projections when active
  it("Test 13: buildSessionInitContext includes active projections", () => {
    const userDat = createEmptyUserDat("ELIAS", "user1");
    const stateDat = createEmptyStateDat("ELIAS");
    const projDat = createEmptyProjectionsDat("ELIAS");

    // Add an active fear
    projDat.fears.push({
      projectionId: "fear_test",
      kind: "fear",
      label: "verlating",
      normalizedLabel: "verlating",
      category: "relational",
      currentScore: 0.7,
      baseConfidence: 0.8,
      firstSeenAt: "2026-06-01T00:00:00Z",
      lastSeenAt: "2026-06-14T00:00:00Z",
      lastReinforcedAt: "2026-06-14T00:00:00Z",
      decayHalfLifeDays: 7,
      reinforcementCount: 3,
      sourceCounts: { explicit_user_text: 2, pattern_inference: 1, session_summary: 0 },
      sources: [],
    });

    const ctx = buildSessionInitContext(userDat, stateDat, projDat, null);
    expect(ctx.contextBlock).toContain("verlating");
    expect(ctx.contextBlock).toContain("Actieve projecties");
    expect(ctx.tokenEstimate).toBeGreaterThan(0);
  });

  // Test 14: Full pipeline commit applies patches correctly
  it("Test 14: applyMemoryWritePlan correctly merges into stores", () => {
    const bundle = createMinimalBundle({
      context: createTestContext(),
      fears: [{
        label: "verlatingsangst",
        normalizedLabel: "verlatingsangst",
        category: "relational",
        confidence: 0.65,
        sourceKind: "explicit_user_text",
        evidenceHash: "ev7",
      }],
      schemaTendencies: [{
        schemaId: "ABANDONMENT",
        schemaName: "Verlating",
        confidence: 0.50,
        sourceKind: "pattern_inference",
        evidenceHash: "ev8",
      }],
      zoneDecision: {
        zone: "YELLOW",
        zoneNumeric: 2,
        confidence: 0.8,
        sourceKind: "pipeline",
      },
    });

    const stores = {
      userDat: createEmptyUserDat("ELIAS", "user1"),
      stateDat: createEmptyStateDat("ELIAS"),
      projectionsDat: createEmptyProjectionsDat("ELIAS"),
      sessionBuffer: createEmptySessionBuffer("ELIAS", "session_001"),
    };

    const plan = buildMemoryWritePlan(bundle);
    const { stores: updated, result } = applyMemoryWritePlan(plan, stores);

    // Fear should be in projections.dat
    expect(updated.projectionsDat.fears.length).toBe(1);
    expect(updated.projectionsDat.fears[0].label).toBe("verlatingsangst");

    // Schema should be in user.dat
    expect(updated.userDat.schemaTendencies.length).toBe(1);
    expect(updated.userDat.schemaTendencies[0].schemaId).toBe("ABANDONMENT");

    // Zone should be in state.dat
    expect(updated.stateDat.current.zone).toBeDefined();
    expect(updated.stateDat.current.zone!.zone).toBe("YELLOW");
    expect(updated.stateDat.zoneHistoryBuffer.length).toBe(1);

    // No errors
    expect(result.errors.length).toBe(0);
  });

  // Test 15: Reinforcement boosts decayed score
  it("Test 15: Reinforcement correctly boosts a decayed projection score", () => {
    const config = { fearHalfLifeDays: 7, hopeHalfLifeDays: 14, minimumScore: 0.05, maxScore: 1.0, reinforcementBoost: 0.2 };

    // Score decayed to 0.5, reinforce with confidence 0.8
    const boosted = reinforceProjectionScore(0.5, 0.8, config);
    // 0.5 + (0.2 * 0.8) = 0.66
    expect(boosted).toBeCloseTo(0.66, 2);

    // Score near max, should cap at 1.0
    const capped = reinforceProjectionScore(0.95, 1.0, config);
    expect(capped).toBe(1.0);
  });
});
