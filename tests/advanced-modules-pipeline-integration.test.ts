/**
 * Integration Test: Advanced Modules (VERGV01/IGH01/AGC01/HWK01) — Full Pipeline Path
 *
 * Verifies the complete end-to-end flow:
 * 1. hasAdvancedModuleMarkers() pre-filter gates correctly
 * 2. runEliasAdvancedModules() detects and routes with correct priority
 * 3. buildGPTPayload() receives and passes through context fields
 * 4. Payload fields are correctly structured for server consumption
 *
 * Tests the integration between:
 * - advanced-modules.ts (detection + prompt block building)
 * - gpt-payload-builder.ts (payload assembly)
 * - pipeline.ts context field mapping (vergv01Context → server)
 */
import { describe, it, expect } from 'vitest';
import {
  hasAdvancedModuleMarkers,
  runEliasAdvancedModules,
  type EliasAdvancedModulesInput,
} from '../lib/engine/elias/advanced-modules';
import { buildGPTPayload, type PayloadBuilderInput } from '../lib/rugzak/gpt-payload-builder';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function baseDetectorInput(overrides: Partial<EliasAdvancedModulesInput> = {}): EliasAdvancedModulesInput {
  return {
    userType: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    crisisLevel: 0,
    intakeCompleted: true,
    shameLevel: 0,
    guiltLevel: 0,
    hopelessnessLevel: 0,
    relapseActive: false,
    ...overrides,
  };
}

function basePayloadInput(overrides: Partial<PayloadBuilderInput> = {}): PayloadBuilderInput {
  return {
    message: 'ik kan mezelf niet vergeven',
    backpack: {
      userType: 'elias',
      name: 'TestUser',
      lifeStory: '',
      triggers: [],
      coreWounds: [],
      relationships: [],
      intake: { startEmotion: 'verdriet', goals: [], context: '' },
    } as any,
    userDat: {
      currentMood: { craving: 3, shame: 4, hopelessness: 2, loneliness: 1, anger: 0 },
      moodHistory: [],
      triggerHistory: [],
      sessionAnalyses: [],
    } as any,
    sliders: { craving: 3, shame: 4, hopelessness: 2, loneliness: 1, anger: 0 } as any,
    isSessionStart: false,
    dominantModule: 'M01',
    riskScore: 2,
    relevance: { triggers: [], coreWound: null, contextLine: null, relationshipAnchor: null } as any,
    diaryEntries: [],
    chatHistory: [
      { role: 'user', content: 'ik kan mezelf niet vergeven', timestamp: Date.now() },
    ] as any,
    detectedEmotion: 'guilt',
    therapeuticStance: 'supportive',
    sessionDurationMinutes: 5,
    urgency: 'low',
    startEmotion: 'verdriet',
    crisisLevel: 0,
    ...overrides,
  };
}

// ─── Full Path: VERGV01 (Elias) ────────────────────────────────────────────────

describe('Full Pipeline Path: VERGV01 (Elias)', () => {
  const VERGV01_MESSAGE = 'ik kan mezelf niet vergeven, schuld vreet aan me';

  it('Step 1: hasAdvancedModuleMarkers() passes the gate', () => {
    expect(hasAdvancedModuleMarkers(VERGV01_MESSAGE)).toBe(true);
  });

  it('Step 2: runEliasAdvancedModules() detects VERGV01 with correct confidence', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: VERGV01_MESSAGE,
    }));
    expect(result.primaryModule).toBe('VERGV01');
    expect(result.vergv01Active).toBe(true);
    expect(result.confidence).toBe(0.7); // 2 markers
    expect(result.vergv01PromptBlock).toContain('[VERGV01_CONTEXT]');
    expect(result.vergv01PromptBlock).toContain('Elias');
  });

  it('Step 3: buildGPTPayload() includes vergv01Context in output', () => {
    const detectorResult = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: VERGV01_MESSAGE,
    }));

    const payload = buildGPTPayload(basePayloadInput({
      message: VERGV01_MESSAGE,
      vergv01Context: detectorResult.vergv01PromptBlock || undefined,
    }));

    expect(payload.vergv01Context).toBeDefined();
    expect(payload.vergv01Context).toContain('[VERGV01_CONTEXT]');
    expect(payload.vergv01Context).toContain('[/VERGV01_CONTEXT]');
    expect(payload.vergv01Context).toContain('Forbidden');
  });

  it('Step 4: non-activated modules are absent from payload', () => {
    const detectorResult = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: VERGV01_MESSAGE,
    }));

    const payload = buildGPTPayload(basePayloadInput({
      message: VERGV01_MESSAGE,
      vergv01Context: detectorResult.vergv01PromptBlock || undefined,
      igh01Context: detectorResult.igh01PromptBlock || undefined,
      agc01Context: detectorResult.agc01PromptBlock || undefined,
      hwk01Context: detectorResult.hwk01PromptBlock || undefined,
    }));

    expect(payload.vergv01Context).toBeDefined();
    expect(payload.igh01Context).toBeUndefined();
    expect(payload.agc01Context).toBeUndefined();
    expect(payload.hwk01Context).toBeUndefined();
  });
});

// ─── Full Path: HWK01 (Elias) ──────────────────────────────────────────────────

describe('Full Pipeline Path: HWK01 (Elias)', () => {
  const HWK01_MESSAGE = 'ik verdien geen herstel, ik ben herstel niet waard, ik heb mijn kans verspeeld';

  it('Step 1: hasAdvancedModuleMarkers() passes the gate', () => {
    expect(hasAdvancedModuleMarkers(HWK01_MESSAGE)).toBe(true);
  });

  it('Step 2: runEliasAdvancedModules() detects HWK01 with high confidence', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: HWK01_MESSAGE,
    }));
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01Active).toBe(true);
    expect(result.confidence).toBe(0.85); // 3 markers
    expect(result.hwk01PromptBlock).toContain('[HWK01_CONTEXT]');
  });

  it('Step 3: buildGPTPayload() includes hwk01Context in output', () => {
    const detectorResult = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: HWK01_MESSAGE,
    }));

    const payload = buildGPTPayload(basePayloadInput({
      message: HWK01_MESSAGE,
      hwk01Context: detectorResult.hwk01PromptBlock || undefined,
    }));

    expect(payload.hwk01Context).toBeDefined();
    expect(payload.hwk01Context).toContain('[HWK01_CONTEXT]');
    expect(payload.hwk01Context).toContain('Herstelwaardigheid');
    expect(payload.hwk01Context).toContain('Forbidden');
  });
});

// ─── Full Path: IGH01 (Elias only) ────────────────────────────────────────────

describe('Full Pipeline Path: IGH01 (Elias only)', () => {
  const IGH01_MESSAGE = 'mijn vader was ook verslaafd, het zit in de familie, generatie op generatie';

  it('Step 1-2: detects IGH01 with high confidence (3 markers)', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: IGH01_MESSAGE,
    }));
    expect(result.primaryModule).toBe('IGH01');
    expect(result.igh01Active).toBe(true);
    expect(result.confidence).toBe(0.85);
  });

  it('Step 3: buildGPTPayload() includes igh01Context', () => {
    const detectorResult = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: IGH01_MESSAGE,
    }));

    const payload = buildGPTPayload(basePayloadInput({
      message: IGH01_MESSAGE,
      igh01Context: detectorResult.igh01PromptBlock || undefined,
    }));

    expect(payload.igh01Context).toBeDefined();
    expect(payload.igh01Context).toContain('[IGH01_CONTEXT]');
    expect(payload.igh01Context).toContain('Intergenerationeel');
  });

  it('Kim user does NOT get IGH01 in payload', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      userType: 'kim',
      latestUserMessage: IGH01_MESSAGE,
    }));
    expect(result.igh01Active).toBe(false);
    expect(result.igh01PromptBlock).toBeNull();

    const payload = buildGPTPayload(basePayloadInput({
      message: IGH01_MESSAGE,
      backpack: { userType: 'kim', name: 'TestUser', lifeStory: '', triggers: [], coreWounds: [], relationships: [], intake: { startEmotion: 'stress', goals: [], context: '' } } as any,
      igh01Context: result.igh01PromptBlock || undefined,
    }));

    expect(payload.igh01Context).toBeUndefined();
  });
});

// ─── Full Path: AGC01 (Elias + Kim) ───────────────────────────────────────────

describe('Full Pipeline Path: AGC01 (Elias + Kim)', () => {
  const AGC01_ELIAS_MESSAGE = 'ik doe dit voor mijn kinderen, anders verlies ik mijn kind';
  const AGC01_KIM_MESSAGE = 'ik moet sterk blijven voor iedereen, als ik een grens stel ben ik egoistisch';

  it('Elias: detects AGC01 and passes to payload', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: AGC01_ELIAS_MESSAGE,
    }));
    expect(result.primaryModule).toBe('AGC01');
    expect(result.agc01Active).toBe(true);

    const payload = buildGPTPayload(basePayloadInput({
      message: AGC01_ELIAS_MESSAGE,
      agc01Context: result.agc01PromptBlock || undefined,
    }));

    expect(payload.agc01Context).toContain('[AGC01_CONTEXT]');
    expect(payload.agc01Context).toContain('Elias');
  });

  it('Kim: detects AGC01 with Kim-specific prompt block', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      userType: 'kim',
      latestUserMessage: AGC01_KIM_MESSAGE,
    }));
    expect(result.primaryModule).toBe('AGC01');
    expect(result.agc01Active).toBe(true);
    expect(result.agc01PromptBlock).toContain('Kim');

    const payload = buildGPTPayload(basePayloadInput({
      message: AGC01_KIM_MESSAGE,
      backpack: { userType: 'kim', name: 'TestUser', lifeStory: '', triggers: [], coreWounds: [], relationships: [], intake: { startEmotion: 'stress', goals: [], context: '' } } as any,
      agc01Context: result.agc01PromptBlock || undefined,
    }));

    expect(payload.agc01Context).toContain('[AGC01_CONTEXT]');
    expect(payload.agc01Context).toContain('Kim');
  });
});

// ─── Priority Routing through full pipeline ────────────────────────────────────

describe('Full Pipeline Path: Priority Routing', () => {
  it('HWK01 wins over VERGV01 in payload (only hwk01Context present)', () => {
    const message = 'ik verdien geen herstel en ik kan mezelf niet vergeven';
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
    }));

    expect(result.primaryModule).toBe('HWK01');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      vergv01Context: result.vergv01PromptBlock || undefined,
      igh01Context: result.igh01PromptBlock || undefined,
      agc01Context: result.agc01PromptBlock || undefined,
      hwk01Context: result.hwk01PromptBlock || undefined,
    }));

    expect(payload.hwk01Context).toBeDefined();
    expect(payload.vergv01Context).toBeUndefined();
    expect(payload.igh01Context).toBeUndefined();
    expect(payload.agc01Context).toBeUndefined();
  });

  it('VERGV01 wins over AGC01 in payload', () => {
    const message = 'ik kan mezelf niet vergeven, ik doe dit voor mijn kinderen';
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
    }));

    expect(result.primaryModule).toBe('VERGV01');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      vergv01Context: result.vergv01PromptBlock || undefined,
      agc01Context: result.agc01PromptBlock || undefined,
    }));

    expect(payload.vergv01Context).toBeDefined();
    expect(payload.agc01Context).toBeUndefined();
  });

  it('All 4 modules triggered → only HWK01 reaches payload', () => {
    const message = 'ik verdien geen herstel, ik kan mezelf niet vergeven, mijn vader was ook verslaafd, ik doe dit voor mijn kinderen';
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
    }));

    expect(result.primaryModule).toBe('HWK01');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      vergv01Context: result.vergv01PromptBlock || undefined,
      igh01Context: result.igh01PromptBlock || undefined,
      agc01Context: result.agc01PromptBlock || undefined,
      hwk01Context: result.hwk01PromptBlock || undefined,
    }));

    expect(payload.hwk01Context).toBeDefined();
    expect(payload.vergv01Context).toBeUndefined();
    expect(payload.igh01Context).toBeUndefined();
    expect(payload.agc01Context).toBeUndefined();
  });
});

// ─── Gate conditions block pipeline ────────────────────────────────────────────

describe('Full Pipeline Path: Gate Conditions', () => {
  it('crisis level >= 2 blocks all modules from reaching payload', () => {
    const message = 'ik verdien geen herstel';
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
      crisisLevel: 2,
    }));

    expect(result.primaryModule).toBe('NONE');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      hwk01Context: result.hwk01PromptBlock || undefined,
    }));

    expect(payload.hwk01Context).toBeUndefined();
  });

  it('intake not completed blocks all modules from reaching payload', () => {
    const message = 'ik kan mezelf niet vergeven';
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
      intakeCompleted: false,
    }));

    expect(result.primaryModule).toBe('NONE');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      vergv01Context: result.vergv01PromptBlock || undefined,
    }));

    expect(payload.vergv01Context).toBeUndefined();
  });

  it('no markers → quick gate blocks detection → no context in payload', () => {
    const message = 'Ik voel me vandaag goed, bedankt voor het luisteren';
    expect(hasAdvancedModuleMarkers(message)).toBe(false);

    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: message,
    }));

    expect(result.primaryModule).toBe('NONE');

    const payload = buildGPTPayload(basePayloadInput({
      message,
      vergv01Context: result.vergv01PromptBlock || undefined,
      igh01Context: result.igh01PromptBlock || undefined,
      agc01Context: result.agc01PromptBlock || undefined,
      hwk01Context: result.hwk01PromptBlock || undefined,
    }));

    expect(payload.vergv01Context).toBeUndefined();
    expect(payload.igh01Context).toBeUndefined();
    expect(payload.agc01Context).toBeUndefined();
    expect(payload.hwk01Context).toBeUndefined();
  });
});

// ─── Prompt block content validation for server ────────────────────────────────

describe('Full Pipeline Path: Prompt Block Server Contract', () => {
  it('VERGV01 prompt block contains required server-side tags', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: 'ik kan mezelf niet vergeven',
    }));

    const block = result.vergv01PromptBlock!;
    expect(block).toMatch(/^\[VERGV01_CONTEXT\]/);
    expect(block).toMatch(/\[\/VERGV01_CONTEXT\]$/);
    expect(block).toContain('Forbidden');
    expect(block).toContain('Module: Vergevingsmodule');
  });

  it('IGH01 prompt block contains required server-side tags', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: 'mijn vader was ook verslaafd',
    }));

    const block = result.igh01PromptBlock!;
    expect(block).toMatch(/^\[IGH01_CONTEXT\]/);
    expect(block).toMatch(/\[\/IGH01_CONTEXT\]$/);
    expect(block).toContain('Forbidden');
    expect(block).toContain('Intergenerationeel Herstel');
  });

  it('AGC01 prompt block contains required server-side tags', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: 'ik doe dit voor mijn kinderen',
    }));

    const block = result.agc01PromptBlock!;
    expect(block).toMatch(/^\[AGC01_CONTEXT\]/);
    expect(block).toMatch(/\[\/AGC01_CONTEXT\]$/);
    expect(block).toContain('Forbidden');
    expect(block).toContain('Agency-Check');
  });

  it('HWK01 prompt block contains required server-side tags', () => {
    const result = runEliasAdvancedModules(baseDetectorInput({
      latestUserMessage: 'ik verdien geen herstel',
    }));

    const block = result.hwk01PromptBlock!;
    expect(block).toMatch(/^\[HWK01_CONTEXT\]/);
    expect(block).toMatch(/\[\/HWK01_CONTEXT\]$/);
    expect(block).toContain('Forbidden');
    expect(block).toContain('Herstelwaardigheid-kern');
  });
});
