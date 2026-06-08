import { describe, it, expect } from 'vitest';
import {
  hasAdvancedModuleMarkers,
  runEliasAdvancedModules,
  type EliasAdvancedModulesInput,
  type EliasAdvancedModulesResult,
} from '../lib/engine/elias/advanced-modules';

// ─── Helper ────────────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<EliasAdvancedModulesInput> = {}): EliasAdvancedModulesInput {
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

// ─── hasAdvancedModuleMarkers (quick gate) ─────────────────────────────────────

describe('hasAdvancedModuleMarkers (quick gate)', () => {
  it('returns false for unrelated message', () => {
    expect(hasAdvancedModuleMarkers('Hoe gaat het vandaag?')).toBe(false);
  });

  it('returns false for empty message', () => {
    expect(hasAdvancedModuleMarkers('')).toBe(false);
  });

  it('detects NL VERGV01 marker', () => {
    expect(hasAdvancedModuleMarkers('Ik kan mezelf niet vergeven voor wat ik deed')).toBe(true);
  });

  it('detects EN VERGV01 marker', () => {
    expect(hasAdvancedModuleMarkers('I cannot forgive myself for what happened')).toBe(true);
  });

  it('detects NL IGH01 marker', () => {
    expect(hasAdvancedModuleMarkers('Mijn vader was ook verslaafd, het zit in de familie')).toBe(true);
  });

  it('detects EN IGH01 marker', () => {
    expect(hasAdvancedModuleMarkers('My father was also addicted to alcohol')).toBe(true);
  });

  it('detects NL AGC01 marker', () => {
    expect(hasAdvancedModuleMarkers('Ik doe dit voor mijn kinderen, niet voor mezelf')).toBe(true);
  });

  it('detects EN AGC01 marker', () => {
    expect(hasAdvancedModuleMarkers('I am doing this for my children')).toBe(true);
  });

  it('detects NL HWK01 marker', () => {
    expect(hasAdvancedModuleMarkers('Ik verdien geen herstel na alles wat ik heb gedaan')).toBe(true);
  });

  it('detects EN HWK01 marker', () => {
    expect(hasAdvancedModuleMarkers('I do not deserve recovery after everything')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(hasAdvancedModuleMarkers('IK KAN MEZELF NIET VERGEVEN')).toBe(true);
    expect(hasAdvancedModuleMarkers('I DO NOT DESERVE RECOVERY')).toBe(true);
  });
});

// ─── Gate conditions ───────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — gate conditions', () => {
  it('returns NONE when intake not completed', () => {
    const result = runEliasAdvancedModules(baseInput({
      intakeCompleted: false,
      latestUserMessage: 'ik kan mezelf niet vergeven',
    }));
    expect(result.primaryModule).toBe('NONE');
    expect(result.vergv01Active).toBe(false);
  });

  it('returns NONE during crisis (level >= 2)', () => {
    const result = runEliasAdvancedModules(baseInput({
      crisisLevel: 2,
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.primaryModule).toBe('NONE');
    expect(result.hwk01Active).toBe(false);
  });

  it('allows activation at crisis level 1', () => {
    const result = runEliasAdvancedModules(baseInput({
      crisisLevel: 1,
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01Active).toBe(true);
  });

  it('returns NONE when no markers present', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'Ik voel me vandaag goed',
    }));
    expect(result.primaryModule).toBe('NONE');
    expect(result.confidence).toBe(0);
  });
});

// ─── VERGV01 Detection ─────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — VERGV01 detection', () => {
  it('activates on NL forgiveness marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik kan mezelf niet vergeven',
    }));
    expect(result.vergv01Active).toBe(true);
    expect(result.primaryModule).toBe('VERGV01');
    expect(result.vergv01PromptBlock).toContain('[VERGV01_CONTEXT]');
    expect(result.vergv01PromptBlock).toContain('Elias');
  });

  it('activates on EN forgiveness marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'i cannot forgive myself for what i did',
    }));
    expect(result.vergv01Active).toBe(true);
    expect(result.primaryModule).toBe('VERGV01');
  });

  it('activates for Kim user with Kim-specific prompt', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'ik kan hen niet vergeven',
    }));
    expect(result.vergv01Active).toBe(true);
    expect(result.vergv01PromptBlock).toContain('Kim');
  });

  it('higher confidence with multiple markers', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik kan mezelf niet vergeven, schuld vreet aan me, ik verdien straf',
    }));
    expect(result.vergv01Active).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ─── IGH01 Detection ───────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — IGH01 detection', () => {
  it('activates on NL generational marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'mijn vader was ook verslaafd',
    }));
    expect(result.igh01Active).toBe(true);
    expect(result.primaryModule).toBe('IGH01');
    expect(result.igh01PromptBlock).toContain('[IGH01_CONTEXT]');
  });

  it('activates on EN generational marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'my father was also addicted',
    }));
    expect(result.igh01Active).toBe(true);
    expect(result.primaryModule).toBe('IGH01');
  });

  it('does NOT activate for Kim user (Elias only)', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'mijn vader was ook verslaafd',
    }));
    expect(result.igh01Active).toBe(false);
    expect(result.primaryModule).not.toBe('IGH01');
  });

  it('detects markers in recentMessages too', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik weet het niet',
      recentMessages: ['het zit in de familie, generatie op generatie'],
    }));
    expect(result.igh01Active).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ─── AGC01 Detection ───────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — AGC01 detection', () => {
  it('activates on NL external motivation marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik doe dit voor mijn kinderen',
    }));
    expect(result.agc01Active).toBe(true);
    expect(result.primaryModule).toBe('AGC01');
    expect(result.agc01PromptBlock).toContain('[AGC01_CONTEXT]');
    expect(result.agc01PromptBlock).toContain('Elias');
  });

  it('activates on EN external motivation marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'i am doing this for my children',
    }));
    expect(result.agc01Active).toBe(true);
  });

  it('activates for Kim user with Kim-specific prompt', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'ik moet sterk blijven voor iedereen',
    }));
    expect(result.agc01Active).toBe(true);
    expect(result.agc01PromptBlock).toContain('Kim');
  });

  it('Kim-specific role phrases trigger AGC01', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'als ik een grens stel ben ik egoistisch',
    }));
    expect(result.agc01Active).toBe(true);
    expect(result.primaryModule).toBe('AGC01');
  });
});

// ─── HWK01 Detection ───────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — HWK01 detection', () => {
  it('activates on NL worthiness marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.hwk01Active).toBe(true);
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01PromptBlock).toContain('[HWK01_CONTEXT]');
  });

  it('activates on EN worthiness marker (Elias)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'i do not deserve recovery',
    }));
    expect(result.hwk01Active).toBe(true);
    expect(result.primaryModule).toBe('HWK01');
  });

  it('does NOT activate for Kim user (Elias only)', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.hwk01Active).toBe(false);
    expect(result.primaryModule).not.toBe('HWK01');
  });

  it('higher confidence with multiple markers', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, ik ben herstel niet waard, ik heb mijn kans verspeeld',
    }));
    expect(result.hwk01Active).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ─── Priority Routing ──────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — priority routing', () => {
  it('HWK01 wins over VERGV01 when both triggered', () => {
    // Message contains both HWK01 and VERGV01 markers
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel en ik kan mezelf niet vergeven',
    }));
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01Active).toBe(true);
    expect(result.vergv01Active).toBe(false); // only primary activates
  });

  it('HWK01 wins over IGH01 when both triggered', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, mijn vader was ook verslaafd',
    }));
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01Active).toBe(true);
    expect(result.igh01Active).toBe(false);
  });

  it('HWK01 wins over AGC01 when both triggered', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, ik doe dit voor mijn kinderen',
    }));
    expect(result.primaryModule).toBe('HWK01');
    expect(result.hwk01Active).toBe(true);
    expect(result.agc01Active).toBe(false);
  });

  it('VERGV01 wins over IGH01 when both triggered', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik kan mezelf niet vergeven, mijn vader was ook verslaafd',
    }));
    expect(result.primaryModule).toBe('VERGV01');
    expect(result.vergv01Active).toBe(true);
    expect(result.igh01Active).toBe(false);
  });

  it('VERGV01 wins over AGC01 when both triggered', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik kan mezelf niet vergeven, ik doe dit voor mijn kinderen',
    }));
    expect(result.primaryModule).toBe('VERGV01');
    expect(result.vergv01Active).toBe(true);
    expect(result.agc01Active).toBe(false);
  });

  it('IGH01 wins over AGC01 when both triggered', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'mijn vader was ook verslaafd, ik doe dit voor mijn kinderen',
    }));
    expect(result.primaryModule).toBe('IGH01');
    expect(result.igh01Active).toBe(true);
    expect(result.agc01Active).toBe(false);
  });

  it('only ONE module activates (no dual activation)', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, ik kan mezelf niet vergeven, mijn vader was ook verslaafd, ik doe dit voor mijn kinderen',
    }));
    const activeCount = [result.vergv01Active, result.igh01Active, result.agc01Active, result.hwk01Active]
      .filter(Boolean).length;
    expect(activeCount).toBe(1);
    expect(result.primaryModule).toBe('HWK01');
  });

  it('Kim: VERGV01 wins over AGC01 (IGH01/HWK01 not available for Kim)', () => {
    const result = runEliasAdvancedModules(baseInput({
      userType: 'kim',
      latestUserMessage: 'ik kan hen niet vergeven, ik moet sterk blijven voor iedereen',
    }));
    expect(result.primaryModule).toBe('VERGV01');
    expect(result.vergv01Active).toBe(true);
    expect(result.agc01Active).toBe(false);
  });
});

// ─── Confidence Scoring ────────────────────────────────────────────────────────

describe('runEliasAdvancedModules — confidence scoring', () => {
  it('1 marker = 0.5 confidence', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.confidence).toBe(0.5);
  });

  it('2 markers = 0.7 confidence', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, ik ben herstel niet waard',
    }));
    expect(result.confidence).toBe(0.7);
  });

  it('3+ markers = 0.85 confidence', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel, ik ben herstel niet waard, ik heb mijn kans verspeeld',
    }));
    expect(result.confidence).toBe(0.85);
  });
});

// ─── Prompt Block Content ──────────────────────────────────────────────────────

describe('runEliasAdvancedModules — prompt block content', () => {
  it('VERGV01 Elias prompt contains correct structure', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik kan mezelf niet vergeven',
    }));
    expect(result.vergv01PromptBlock).toContain('[VERGV01_CONTEXT]');
    expect(result.vergv01PromptBlock).toContain('[/VERGV01_CONTEXT]');
    expect(result.vergv01PromptBlock).toContain('Forbidden');
  });

  it('IGH01 prompt contains correct structure', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'mijn vader was ook verslaafd',
    }));
    expect(result.igh01PromptBlock).toContain('[IGH01_CONTEXT]');
    expect(result.igh01PromptBlock).toContain('[/IGH01_CONTEXT]');
    expect(result.igh01PromptBlock).toContain('Intergenerationeel');
  });

  it('AGC01 Elias prompt contains correct structure', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik doe dit voor mijn kinderen',
    }));
    expect(result.agc01PromptBlock).toContain('[AGC01_CONTEXT]');
    expect(result.agc01PromptBlock).toContain('[/AGC01_CONTEXT]');
    expect(result.agc01PromptBlock).toContain('Elias');
  });

  it('HWK01 prompt contains correct structure', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.hwk01PromptBlock).toContain('[HWK01_CONTEXT]');
    expect(result.hwk01PromptBlock).toContain('[/HWK01_CONTEXT]');
    expect(result.hwk01PromptBlock).toContain('Herstelwaardigheid');
  });

  it('non-activated modules have null prompt blocks', () => {
    const result = runEliasAdvancedModules(baseInput({
      latestUserMessage: 'ik verdien geen herstel',
    }));
    expect(result.hwk01Active).toBe(true);
    expect(result.vergv01PromptBlock).toBeNull();
    expect(result.igh01PromptBlock).toBeNull();
    expect(result.agc01PromptBlock).toBeNull();
  });
});
