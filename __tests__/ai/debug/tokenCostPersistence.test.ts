/**
 * FASE 9H: Token Cost Persistence Tests
 * 62 tests covering storage, recording, privacy, reset, debug, integration, regression
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTokenCostSessionState,
  saveTokenCostSessionState,
  loadTokenCostDailyState,
  saveTokenCostDailyState,
  recordTokenCostEstimate,
  resetTokenCostStats,
  buildPersistentTokenCostDebugLine,
  SESSION_KEY,
  DAILY_KEY,
  createEmptySessionState,
  createEmptyDailyState,
} from '@/lib/ai/debug/token-cost-persistence';
import type {
  PersistedTokenCostSessionState,
  PersistedTokenCostDailyState,
  TokenCostEstimate,
} from '@/lib/ai/debug/token-cost-types';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStorage[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn(async (key: string) => { delete mockStorage[key]; }),
  },
}));

function clearMockStorage() { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }

const now = '2026-08-11T14:00:00.000Z';
const dayKey = '2026-08-11';
const sessionId = 'test-session-001';

function makeMiniEstimate(tokens = 100): TokenCostEstimate {
  return { model: 'gpt-4o-mini', tier: 'mini', promptTokens: tokens, completionTokens: 20, totalTokens: tokens + 20, inputCostUsd: 0.000015, outputCostUsd: 0.000012, totalCostUsd: 0.000027, pricingVerified: true };
}
function makeFullEstimate(tokens = 500): TokenCostEstimate {
  return { model: 'gpt-4o', tier: 'full', promptTokens: tokens, completionTokens: 80, totalTokens: tokens + 80, inputCostUsd: 0.00125, outputCostUsd: 0.0008, totalCostUsd: 0.00205, pricingVerified: true };
}

beforeEach(() => { clearMockStorage(); });

describe('Storage load/save', () => {
  it('1. new session state when storage empty', async () => {
    const r = await loadTokenCostSessionState(sessionId, dayKey);
    expect(r.state.sessionId).toBe(sessionId);
    expect(r.state.messageCount).toBe(0);
    expect(r.warning).toBeUndefined();
  });
  it('2. new daily state when storage empty', async () => {
    const r = await loadTokenCostDailyState(dayKey);
    expect(r.state.localDayKey).toBe(dayKey);
    expect(r.state.messageCount).toBe(0);
  });
  it('3. existing session state is loaded', async () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    s.messageCount = 5;
    mockStorage[SESSION_KEY] = JSON.stringify(s);
    const r = await loadTokenCostSessionState(sessionId, dayKey);
    expect(r.state.messageCount).toBe(5);
  });
  it('4. existing daily state is loaded', async () => {
    const d = createEmptyDailyState(dayKey, now);
    d.messageCount = 10;
    mockStorage[DAILY_KEY] = JSON.stringify(d);
    const r = await loadTokenCostDailyState(dayKey);
    expect(r.state.messageCount).toBe(10);
  });
  it('5. corrupt session state gives warning and reset', async () => {
    mockStorage[SESSION_KEY] = '{"bad":true}';
    const r = await loadTokenCostSessionState(sessionId, dayKey);
    expect(r.warning).toBe('corrupt_session_state_reset');
    expect(r.state.messageCount).toBe(0);
  });
  it('6. corrupt daily state gives warning and reset', async () => {
    mockStorage[DAILY_KEY] = 'not json at all!!!';
    const r = await loadTokenCostDailyState(dayKey);
    expect(r.warning).toBeTruthy();
    expect(r.state.messageCount).toBe(0);
  });
  it('7. day mismatch creates new daily state', async () => {
    const d = createEmptyDailyState('2026-08-10', now);
    d.messageCount = 99;
    mockStorage[DAILY_KEY] = JSON.stringify(d);
    const r = await loadTokenCostDailyState('2026-08-11');
    expect(r.state.messageCount).toBe(0);
    expect(r.warning).toBe('day_mismatch_new_day');
  });
  it('8. schema mismatch gives warning', async () => {
    mockStorage[SESSION_KEY] = JSON.stringify({ schemaVersion: 'wrong.v99', sessionId, messageCount: 5 });
    const r = await loadTokenCostSessionState(sessionId, dayKey);
    expect(r.warning).toContain('corrupt');
  });
  it('9. storage error does not crash', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk full'));
    const r = await loadTokenCostSessionState(sessionId, dayKey);
    expect(r.state.messageCount).toBe(0);
    expect(r.warning).toContain('storage_read_error');
  });
  it('10. save writes only technical counters', async () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    s.messageCount = 3;
    await saveTokenCostSessionState(s);
    const stored = JSON.parse(mockStorage[SESSION_KEY]);
    expect(stored.messageCount).toBe(3);
    expect(stored).not.toHaveProperty('rawPrompt');
    expect(stored).not.toHaveProperty('userMessage');
  });
});

describe('Record estimate', () => {
  it('11. record increases session messageCount', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.messageCount).toBe(1);
  });
  it('12. record increases daily messageCount', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.dailyState!.messageCount).toBe(1);
  });
  it('13. record increases miniCalls', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.miniCalls).toBe(1);
    expect(r.sessionState!.fullCalls).toBe(0);
  });
  it('14. record increases fullCalls', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeFullEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.fullCalls).toBe(1);
    expect(r.sessionState!.miniCalls).toBe(0);
  });
  it('15. record increases unknownModelCalls', async () => {
    const est: TokenCostEstimate = { model: 'unknown', tier: 'unknown', promptTokens: 10, completionTokens: 5, totalTokens: 15, inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0, pricingVerified: false };
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: est, reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.unknownModelCalls).toBe(1);
  });
  it('16. promptTokens are accumulated', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(200), reasonCodes: [], nowLocal: now });
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(300), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.totalPromptTokens).toBe(500);
  });
  it('17. completionTokens are accumulated', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.totalCompletionTokens).toBe(40);
  });
  it('18. totalTokens are accumulated', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(100), reasonCodes: [], nowLocal: now });
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(100), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.totalTokens).toBe(240);
  });
  it('19. cost is accumulated', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.totalEstimatedCostUsd).toBeCloseTo(0.000054, 6);
  });
  it('20. lastModel is updated', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeFullEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.lastModel).toBe('gpt-4o');
  });
  it('21. lastTier is updated', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeFullEstimate(), reasonCodes: [], nowLocal: now });
    expect(r.sessionState!.lastTier).toBe('full');
  });
  it('22. lastReasonCodes are updated', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: ['crisis', 'zone_red'], nowLocal: now });
    expect(r.sessionState!.lastReasonCodes).toEqual(['crisis', 'zone_red']);
  });
  it('23. updatedAtLocal is updated', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: '2026-08-11T15:30:00.000Z' });
    expect(r.sessionState!.updatedAtLocal).toBe('2026-08-11T15:30:00.000Z');
  });
});

describe('Privacy', () => {
  it('24. persisted session contains no raw prompt', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    const stored = mockStorage[SESSION_KEY];
    expect(stored).not.toContain('rawPrompt');
    expect(stored).not.toContain('systemPrompt');
  });
  it('25. persisted session contains no raw userMessage', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(mockStorage[SESSION_KEY]).not.toContain('userMessage');
  });
  it('26. persisted session contains no raw GPT response', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(mockStorage[SESSION_KEY]).not.toContain('gptResponse');
    expect(mockStorage[SESSION_KEY]).not.toContain('responseText');
  });
  it('27. persisted session contains no raw Backpack', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(mockStorage[SESSION_KEY]).not.toContain('backpack');
  });
  it('28. persisted session contains no raw DIST01', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(mockStorage[SESSION_KEY]).not.toContain('distillation');
    expect(mockStorage[SESSION_KEY]).not.toContain('dist01');
  });
  it('29. persisted session contains no raw CMD', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    expect(mockStorage[SESSION_KEY]).not.toContain('selectedItems');
    expect(mockStorage[SESSION_KEY]).not.toContain('cmdMemory');
  });
  it('30. persisted daily contains no raw data', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    const d = mockStorage[DAILY_KEY];
    expect(d).not.toContain('rawPrompt');
    expect(d).not.toContain('userMessage');
    expect(d).not.toContain('backpack');
  });
  it('31. warnings contain no personal content', async () => {
    mockStorage[SESSION_KEY] = 'corrupt';
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    for (const w of r.warnings) {
      expect(w).not.toMatch(/melissa|kris|ellen|jules/i);
    }
  });
  it('32. errors contain no personal content', async () => {
    const r = await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    for (const e of r.errors) {
      expect(e).not.toMatch(/melissa|kris|ellen|jules/i);
    }
  });
});

describe('Reset', () => {
  it('33. reset session clears session counters', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    await resetTokenCostStats({ scope: 'session' });
    expect(mockStorage[SESSION_KEY]).toBeUndefined();
  });
  it('34. reset daily clears daily counters', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    await resetTokenCostStats({ scope: 'daily' });
    expect(mockStorage[DAILY_KEY]).toBeUndefined();
  });
  it('35. reset all clears both', async () => {
    await recordTokenCostEstimate({ sessionId, localDayKey: dayKey, estimate: makeMiniEstimate(), reasonCodes: [], nowLocal: now });
    await resetTokenCostStats({ scope: 'all' });
    expect(mockStorage[SESSION_KEY]).toBeUndefined();
    expect(mockStorage[DAILY_KEY]).toBeUndefined();
  });
  it('36. reset does not touch memory keys', async () => {
    mockStorage['recofree_userdat_elias'] = '{"test":true}';
    mockStorage['recofree_backpack_elias'] = '{"test":true}';
    await resetTokenCostStats({ scope: 'all' });
    expect(mockStorage['recofree_userdat_elias']).toBe('{"test":true}');
    expect(mockStorage['recofree_backpack_elias']).toBe('{"test":true}');
  });
  it('37. reset does not touch Backpack/VSP/ERP keys', async () => {
    mockStorage['recofree_vsp_elias'] = '{"test":true}';
    mockStorage['recofree_erp_kim'] = '{"test":true}';
    await resetTokenCostStats({ scope: 'all' });
    expect(mockStorage['recofree_vsp_elias']).toBe('{"test":true}');
    expect(mockStorage['recofree_erp_kim']).toBe('{"test":true}');
  });
  it('38. reset returns ok=true on success', async () => {
    const r = await resetTokenCostStats({ scope: 'all' });
    expect(r.ok).toBe(true);
  });
});

describe('Debug line', () => {
  it('39. persistent debug line contains msg/session/day', () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    s.totalEstimatedCostUsd = 0.001;
    const d = createEmptyDailyState(dayKey, now);
    d.totalEstimatedCostUsd = 0.005;
    const line = buildPersistentTokenCostDebugLine(s, d, makeMiniEstimate());
    expect(line).toContain('msg=');
    expect(line).toContain('session=');
    expect(line).toContain('day=');
  });
  it('40. persistent debug line contains mini/full calls', () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    s.miniCalls = 5; s.fullCalls = 2;
    const line = buildPersistentTokenCostDebugLine(s, null, makeMiniEstimate());
    expect(line).toContain('mini:5/full:2');
  });
  it('41. persistent debug line contains tokens', () => {
    const line = buildPersistentTokenCostDebugLine(null, null, makeMiniEstimate(200));
    expect(line).toContain('200/20/220');
  });
  it('42. persistent debug line contains pricing status', () => {
    const line = buildPersistentTokenCostDebugLine(null, null, makeMiniEstimate());
    expect(line).toContain('pricing=verified');
  });
  it('43. missing estimate does not crash', () => {
    const line = buildPersistentTokenCostDebugLine(null, null, null);
    expect(line).toContain('msg=unknown');
  });
  it('44. unknown pricing shows safe fallback', () => {
    const est: TokenCostEstimate = { model: 'unknown', tier: 'unknown', promptTokens: 10, completionTokens: 5, totalTokens: 15, inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0, pricingVerified: false, warning: 'unknown model' };
    const line = buildPersistentTokenCostDebugLine(null, null, est);
    expect(line).toContain('pricing=verify');
  });
  it('45. debug line contains no raw prompt/message/memory', () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    const d = createEmptyDailyState(dayKey, now);
    const line = buildPersistentTokenCostDebugLine(s, d, makeMiniEstimate());
    expect(line).not.toContain('rawPrompt');
    expect(line).not.toContain('userMessage');
    expect(line).not.toContain('backpack');
    expect(line).not.toContain('dist01');
  });
});

describe('Integration', () => {
  it('46. pipeline imports recordTokenCostEstimate', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('recordTokenCostEstimate');
  });
  it('47. missing token usage does not crash pipeline', () => {
    // The pipeline wraps in if(tokenUsage) — this is a structural test
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('if (tokenUsage)');
  });
  it('48. clinicalInfo Cost line remains visible', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('cost:');
  });
  it('49. ModelRoute remains visible', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('modelRoute:');
  });
  it('50. CMD line remains visible', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('cmd:');
  });
  it('51. Epistemic line remains visible', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('epistemic:');
  });
  it('52. Route minimal-proxy/store:false remains visible', () => {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
    expect(code).toContain('minimal-proxy | store:false');
  });
});

describe('Regression', () => {
  it('53. no server file changes', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toMatch(/from ['"].*server/);
  });
  it('54. no provider behavior change', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toMatch(/from ['"].*openai-provider/);
  });
  it('55. no model routing retune', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toContain('resolveEpistemicModelRouting');
  });
  it('56. no prompt content', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toContain('buildSystemPrompt');
    expect(persistCode).not.toContain('buildClientSystemPrompt');
  });
  it('57. no CMD/DIST01 changes', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toContain('clinical-memory-distillation');
    expect(persistCode).not.toContain('dist01');
  });
  it('58. no Kim/Elias retune', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toContain('kim-relational-formulation');
    expect(persistCode).not.toContain('elias-recovery-formulation');
  });
  it('59. no clinical storage schema change', () => {
    const fs = require('fs');
    const path = require('path');
    const persistCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-persistence.ts'), 'utf-8');
    expect(persistCode).not.toContain('recofree_userdat');
    expect(persistCode).not.toContain('recofree_statedat');
    expect(persistCode).not.toContain('recofree_backpack');
  });
  it('60. storage keys are correct', () => {
    expect(SESSION_KEY).toBe('recofree_debug_token_cost_session_v1');
    expect(DAILY_KEY).toBe('recofree_debug_token_cost_daily_v1');
  });
  it('61. session schema version is correct', () => {
    const s = createEmptySessionState(sessionId, dayKey, now);
    expect(s.schemaVersion).toBe('token_cost_session.v1');
  });
  it('62. daily schema version is correct', () => {
    const d = createEmptyDailyState(dayKey, now);
    expect(d.schemaVersion).toBe('token_cost_daily.v1');
  });
});
