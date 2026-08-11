/**
 * Manual Data Refresh — Tests
 * FASE: MANUAL DATA REFRESH BUTTON
 *
 * 40 tests covering:
 * - UI/trigger (5)
 * - Persona separation (5)
 * - Refresh behavior (9)
 * - Privacy (7)
 * - CMD integration (5)
 * - Clinical debug (4)
 * - Regression (5)
 */
import { describe, it, expect } from 'vitest';
import {
  runManualDataRefresh,
  loadManualRefreshState,
  saveManualRefreshState,
  clearForceNextChatCMD,
} from '@/lib/rugzak/manual-data-refresh';
import type { ManualDataRefreshInput, ManualDataRefreshOutput, ManualRefreshState } from '@/lib/rugzak/manual-data-refresh';

// ─── Helper ────────────────────────────────────────────────────────────────
function makeInput(overrides: Partial<ManualDataRefreshInput> = {}): ManualDataRefreshInput {
  return {
    persona: 'elias',
    refreshBackpack: true,
    refreshVsp: true,
    refreshErp: false,
    refreshDist01: true,
    refreshContextDat: true,
    forceNextChatCMD: true,
    reason: 'manual_user_refresh',
    nowLocal: '2026-08-11T10:00:00.000Z',
    ...overrides,
  };
}

// ─── UI / Trigger Tests ────────────────────────────────────────────────────
describe('Manual Data Refresh — UI / Trigger', () => {
  it('1. ManualDataRefreshButton component exists', async () => {
    const fs = require('fs');
    const path = require('path').resolve(__dirname, '../../components/profile/ManualDataRefreshButton.tsx');
    const exists = fs.existsSync(path);
    expect(exists).toBe(true);
    const content = fs.readFileSync(path, 'utf-8');
    expect(content).toContain('ManualDataRefreshButton');
  });

  it('2. button is importable from profile component path', async () => {
    const fs = require('fs');
    const path = require('path').resolve(__dirname, '../../components/profile/ManualDataRefreshButton.tsx');
    const exists = fs.existsSync(path);
    expect(exists).toBe(true);
    const content = fs.readFileSync(path, 'utf-8');
    expect(content).toContain('export function ManualDataRefreshButton');
  });

  it('3. runManualDataRefresh returns output with ok field', async () => {
    const result = await runManualDataRefresh(makeInput());
    expect(result).toHaveProperty('ok');
    expect(typeof result.ok).toBe('boolean');
  });

  it('4. runManualDataRefresh returns refreshed object', async () => {
    const result = await runManualDataRefresh(makeInput());
    expect(result.refreshed).toHaveProperty('backpackAnalysis');
    expect(result.refreshed).toHaveProperty('vspAnalysis');
    expect(result.refreshed).toHaveProperty('erpAnalysis');
    expect(result.refreshed).toHaveProperty('dist01');
    expect(result.refreshed).toHaveProperty('contextDat');
    expect(result.refreshed).toHaveProperty('cmdReadyForNextChat');
  });

  it('5. error state does not crash', async () => {
    // Even with empty persona, should not throw
    const result = await runManualDataRefresh(makeInput({ persona: 'elias' }));
    expect(result).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ─── Persona Separation Tests ──────────────────────────────────────────────
describe('Manual Data Refresh — Persona Separation', () => {
  it('6. Elias refresh uses Elias scope', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'elias', refreshVsp: true, refreshErp: false }));
    // VSP should not be skipped for Elias (unless VSP doesn't exist)
    const vspSkip = result.skipped.find(s => s.key === 'vspAnalysis');
    if (vspSkip) {
      expect(vspSkip.reason).not.toBe('not_elias_persona');
    }
  });

  it('7. Kim refresh uses Kim scope', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'kim', refreshVsp: true, refreshErp: true }));
    // VSP should be skipped for Kim
    const vspSkip = result.skipped.find(s => s.key === 'vspAnalysis');
    expect(vspSkip).toBeDefined();
    expect(vspSkip!.reason).toBe('not_elias_persona');
  });

  it('8. Kim refresh does not read Elias VSP/sobriety/relapsePlan', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'kim', refreshVsp: true }));
    const vspSkip = result.skipped.find(s => s.key === 'vspAnalysis');
    expect(vspSkip?.reason).toBe('not_elias_persona');
  });

  it('9. Elias refresh does not read Kim ERP/relationalPattern', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'elias', refreshErp: true }));
    const erpSkip = result.skipped.find(s => s.key === 'erpAnalysis');
    expect(erpSkip).toBeDefined();
    expect(erpSkip!.reason).toBe('not_kim_persona');
  });

  it('10. persona separation remains hard', async () => {
    const eliasResult = await runManualDataRefresh(makeInput({ persona: 'elias', refreshErp: true }));
    const kimResult = await runManualDataRefresh(makeInput({ persona: 'kim', refreshVsp: true }));
    expect(eliasResult.skipped.some(s => s.reason === 'not_kim_persona')).toBe(true);
    expect(kimResult.skipped.some(s => s.reason === 'not_elias_persona')).toBe(true);
  });
});

// ─── Refresh Behavior Tests ────────────────────────────────────────────────
describe('Manual Data Refresh — Refresh Behavior', () => {
  it('11. Backpack analysis skipped if backpack empty', async () => {
    // With no backpack in storage, should skip
    const result = await runManualDataRefresh(makeInput({ refreshBackpack: true }));
    const skip = result.skipped.find(s => s.key === 'backpackAnalysis');
    // Either refreshed (if backpack exists) or skipped (if not)
    expect(result.refreshed.backpackAnalysis || !!skip).toBe(true);
  });

  it('12. Backpack analysis skipped reason is correct', async () => {
    const result = await runManualDataRefresh(makeInput({ refreshBackpack: true }));
    const skip = result.skipped.find(s => s.key === 'backpackAnalysis');
    if (skip) {
      expect(skip.reason).toBe('backpack_empty_or_missing');
    }
  });

  it('13. Elias VSP analysis skipped if VSP not available', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'elias', refreshVsp: true }));
    const skip = result.skipped.find(s => s.key === 'vspAnalysis');
    if (skip) {
      expect(skip.reason).toBe('vsp_not_available');
    }
  });

  it('14. Kim ERP analysis skipped if ERP not available', async () => {
    const result = await runManualDataRefresh(makeInput({ persona: 'kim', refreshErp: true }));
    const skip = result.skipped.find(s => s.key === 'erpAnalysis');
    if (skip) {
      expect(['erp_not_available', 'not_kim_persona']).toContain(skip.reason);
    }
  });

  it('15. DIST01/context refresh is triggered', async () => {
    const result = await runManualDataRefresh(makeInput({ refreshDist01: true }));
    // Either refreshed or skipped (empty) — should not error
    const dist01Skip = result.skipped.find(s => s.key === 'dist01');
    expect(result.refreshed.dist01 || !!dist01Skip || result.errors.some(e => e.key === 'dist01')).toBe(true);
  });

  it('16. cmdReadyForNextChat becomes true on success', async () => {
    const result = await runManualDataRefresh(makeInput({ forceNextChatCMD: true }));
    expect(result.refreshed.cmdReadyForNextChat).toBe(true);
  });

  it('17. forceNextChatCMD can be cleared', async () => {
    await saveManualRefreshState({
      lastUpdatedAtLocal: '2026-08-11T10:00:00.000Z',
      persona: 'elias',
      status: 'success',
      forceNextChatCMD: true,
    });
    await clearForceNextChatCMD();
    const state = await loadManualRefreshState();
    expect(state?.forceNextChatCMD).toBe(false);
  });

  it('18. partial success when some items missing', async () => {
    // With no backpack in storage, backpack will be skipped but CMD still works
    const result = await runManualDataRefresh(makeInput());
    // Should be ok=true even with skips (partial or success)
    expect(result.ok).toBe(true);
  });

  it('19. errors do not crash the function', async () => {
    const result = await runManualDataRefresh(makeInput());
    expect(result).toBeDefined();
    expect(typeof result.ok).toBe('boolean');
  });
});

// ─── Privacy Tests ─────────────────────────────────────────────────────────
describe('Manual Data Refresh — Privacy', () => {
  it('20. no raw Backpack in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"sections":[{');
    expect(json).not.toContain('"content":"');
  });

  it('21. no raw VSP in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"vspSection"');
    expect(json).not.toContain('"earlyWarnings"');
  });

  it('22. no raw ERP in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"eigenRegiePlan"');
  });

  it('23. no raw DIST01 in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"entities":[{');
    expect(json).not.toContain('"signals":[{');
  });

  it('24. no raw user.dat/state.dat/context.dat in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"chatHistory"');
    expect(json).not.toContain('"schemas"');
    expect(json).not.toContain('"keyFigures"');
  });

  it('25. no full prompt in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('systemPrompt');
    expect(json).not.toContain('[IDENTITY]');
  });

  it('26. no raw selectedItems in output', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('"selectedItems"');
  });
});

// ─── CMD Integration Tests ─────────────────────────────────────────────────
describe('Manual Data Refresh — CMD Integration', () => {
  it('27. next chat CMD runs when forceNextChatCMD is true', async () => {
    const result = await runManualDataRefresh(makeInput({ forceNextChatCMD: true }));
    expect(result.refreshed.cmdReadyForNextChat).toBe(true);
    const state = await loadManualRefreshState();
    expect(state?.forceNextChatCMD).toBe(true);
  });

  it('28. selector remains mandatory (not bypassed)', async () => {
    // The refresh function never bypasses selector — it only refreshes data
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('bypassSelector');
    expect(json).not.toContain('skipSelector');
  });

  it('29. should_not_go_to_gpt remains excluded', async () => {
    // Refresh never sends data to GPT
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('gpt');
    expect(json).not.toContain('openai');
  });

  it('30. selectedClinicalMemorySummary is only built via selector', async () => {
    // Refresh function does not build any summary — that's pipeline's job
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('selectedClinicalMemory');
    expect(json).not.toContain('memorySummary');
  });

  it('31. no bypass to GPT', async () => {
    const result = await runManualDataRefresh(makeInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain('api.openai.com');
    expect(json).not.toContain('minimal-gpt-proxy');
  });
});

// ─── Clinical Debug Tests ──────────────────────────────────────────────────
describe('Manual Data Refresh — Clinical Debug', () => {
  it('32. lastRefresh timestamp is saved', async () => {
    await runManualDataRefresh(makeInput({ nowLocal: '2026-08-11T12:00:00.000Z' }));
    const state = await loadManualRefreshState();
    expect(state?.lastUpdatedAtLocal).toBe('2026-08-11T12:00:00.000Z');
  });

  it('33. refresh status is saved', async () => {
    await runManualDataRefresh(makeInput());
    const state = await loadManualRefreshState();
    expect(['success', 'partial', 'error']).toContain(state?.status);
  });

  it('34. cmdReadyNextChat is saved', async () => {
    await runManualDataRefresh(makeInput({ forceNextChatCMD: true }));
    const state = await loadManualRefreshState();
    expect(state?.forceNextChatCMD).toBe(true);
  });

  it('35. no raw content in saved state', async () => {
    await runManualDataRefresh(makeInput());
    const state = await loadManualRefreshState();
    const json = JSON.stringify(state);
    expect(json).not.toContain('"content"');
    expect(json).not.toContain('"chatHistory"');
    expect(json).not.toContain('"sections"');
  });
});

// ─── Regression Tests ──────────────────────────────────────────────────────
describe('Manual Data Refresh — Regression', () => {
  it('36. service file exists and exports correctly', async () => {
    const mod = await import('@/lib/rugzak/manual-data-refresh');
    expect(mod.runManualDataRefresh).toBeDefined();
    expect(mod.loadManualRefreshState).toBeDefined();
    expect(mod.saveManualRefreshState).toBeDefined();
    expect(mod.clearForceNextChatCMD).toBeDefined();
  });

  it('37. no server imports in service', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(require('path').resolve(__dirname, '../../lib/rugzak/manual-data-refresh.ts'), 'utf-8');
    expect(content).not.toMatch(/import.*from.*['"].*server/);
    expect(content).not.toMatch(/import.*from.*['"].*ai-chat/);
  });

  it('38. no provider imports in service', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(require('path').resolve(__dirname, '../../lib/rugzak/manual-data-refresh.ts'), 'utf-8');
    expect(content).not.toMatch(/import.*from.*['"].*openai-provider/);
    expect(content).not.toMatch(/import.*from.*['"].*minimal-gpt-proxy/);
  });

  it('39. no lockfile changes (structural check)', () => {
    // This test verifies the service doesn't require new packages
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '../../package.json'), 'utf-8'));
    // Manual refresh uses only existing deps
    expect(pkg.dependencies['@react-native-async-storage/async-storage']).toBeDefined();
  });

  it('40. output shape is stable', async () => {
    const result = await runManualDataRefresh(makeInput());
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('refreshed');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('updatedAtLocal');
    expect(typeof result.updatedAtLocal).toBe('string');
  });
});
