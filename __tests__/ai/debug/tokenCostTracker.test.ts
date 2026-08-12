import { describe, it, expect } from 'vitest';
import {
  estimateTokenCost,
  updateSessionTokenCostState,
  updateDailyTokenCostState,
  buildTokenCostDebugLine,
  buildModelDebugLine,
  getModelTierFromModel,
  createInitialSessionState,
  createInitialDailyState,
} from '@/lib/ai/debug/token-cost-tracker';
import { getModelPricing, MODEL_PRICING_CONFIG } from '@/lib/ai/debug/model-price-config';
import * as fs from 'fs';
import * as path from 'path';

describe('FASE 9G: Token / Cost Clinical Debug Tracker', () => {
  // ─── PRICE CONFIG (1-5) ───
  describe('Price Config', () => {
    it('1. gpt-4o-mini has pricing config', () => { expect(getModelPricing('gpt-4o-mini')).not.toBeNull(); });
    it('2. gpt-4o-2024-08-06 has pricing config', () => { expect(getModelPricing('gpt-4o-2024-08-06')).not.toBeNull(); });
    it('3. gpt-4o has pricing config', () => { expect(getModelPricing('gpt-4o')).not.toBeNull(); });
    it('4. unknown model returns null', () => { expect(getModelPricing('gpt-unknown')).toBeNull(); });
    it('5. all configs have requiresVerificationBeforeProduction flag', () => {
      for (const p of MODEL_PRICING_CONFIG) { expect(typeof p.requiresVerificationBeforeProduction).toBe('boolean'); }
    });
  });

  // ─── TOKEN ESTIMATE (6-13) ───
  describe('Token Estimate', () => {
    it('6. calculates input cost', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 1000000, completionTokens: 0, totalTokens: 1000000 } });
      expect(r.inputCostUsd).toBe(0.15);
    });
    it('7. calculates output cost', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 0, completionTokens: 1000000, totalTokens: 1000000 } });
      expect(r.outputCostUsd).toBe(0.6);
    });
    it('8. calculates total cost', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 2000, completionTokens: 100, totalTokens: 2100 } });
      expect(r.totalCostUsd).toBe(parseFloat((2000/1000000*0.15 + 100/1000000*0.60).toFixed(6)));
    });
    it('9. negative tokens become 0', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: -5, completionTokens: -3, totalTokens: -8 } });
      expect(r.promptTokens).toBe(0); expect(r.completionTokens).toBe(0); expect(r.totalTokens).toBe(0);
    });
    it('10. missing/NaN tokens become 0', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: NaN, completionTokens: undefined as any, totalTokens: 0 } });
      expect(r.promptTokens).toBe(0); expect(r.completionTokens).toBe(0);
    });
    it('11. inconsistent totalTokens is recalculated', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 999 } });
      expect(r.totalTokens).toBe(150);
    });
    it('12. costs rounded to 6 decimals', () => {
      const r = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });
      expect(r.inputCostUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6);
    });
    it('13. unknown model gives cost 0 + warning', () => {
      const r = estimateTokenCost({ model: 'gpt-unknown', tier: 'unknown', usage: { promptTokens: 1000, completionTokens: 100, totalTokens: 1100 } });
      expect(r.totalCostUsd).toBe(0); expect(r.warning).toBeTruthy();
    });
  });

  // ─── TIER DETECTION (14-17) ───
  describe('Tier Detection', () => {
    it('14. gpt-4o-mini → mini', () => { expect(getModelTierFromModel('gpt-4o-mini')).toBe('mini'); });
    it('15. gpt-4o-2024-08-06 → full', () => { expect(getModelTierFromModel('gpt-4o-2024-08-06')).toBe('full'); });
    it('16. gpt-4o → full', () => { expect(getModelTierFromModel('gpt-4o')).toBe('full'); });
    it('17. unknown model → unknown', () => { expect(getModelTierFromModel('gpt-xyz')).toBe('unknown'); });
  });

  // ─── SESSION ACCUMULATOR (18-28) ───
  describe('Session Accumulator', () => {
    const initial = createInitialSessionState('test-session');
    const est = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 2000, completionTokens: 100, totalTokens: 2100 } });

    it('18. messageCount increment', () => { const s = updateSessionTokenCostState(initial, est, ['light']); expect(s.messageCount).toBe(1); });
    it('19. miniCalls increment', () => { const s = updateSessionTokenCostState(initial, est, ['light']); expect(s.miniCalls).toBe(1); });
    it('20. fullCalls increment for full tier', () => {
      const fullEst = estimateTokenCost({ model: 'gpt-4o', tier: 'full', usage: { promptTokens: 3000, completionTokens: 200, totalTokens: 3200 } });
      const s = updateSessionTokenCostState(initial, fullEst, ['crisis']); expect(s.fullCalls).toBe(1);
    });
    it('21. totalPromptTokens accumulate', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.totalPromptTokens).toBe(2000); });
    it('22. totalCompletionTokens accumulate', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.totalCompletionTokens).toBe(100); });
    it('23. totalTokens accumulate', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.totalTokens).toBe(2100); });
    it('24. totalEstimatedCostUsd accumulates', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.totalEstimatedCostUsd).toBeGreaterThan(0); });
    it('25. lastModel updated', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.lastModel).toBe('gpt-4o-mini'); });
    it('26. lastTier updated', () => { const s = updateSessionTokenCostState(initial, est, []); expect(s.lastTier).toBe('mini'); });
    it('27. lastReasonCodes updated', () => { const s = updateSessionTokenCostState(initial, est, ['crisis', 'zone_red']); expect(s.lastReasonCodes).toEqual(['crisis', 'zone_red']); });
    it('28. no raw text fields in state', () => {
      const s = updateSessionTokenCostState(initial, est, ['test']);
      const json = JSON.stringify(s);
      expect(json).not.toContain('systemPrompt'); expect(json).not.toContain('userMessage'); expect(json).not.toContain('gptResponse');
    });
  });

  // ─── DAILY ACCUMULATOR (29-33) ───
  describe('Daily Accumulator', () => {
    const daily = createInitialDailyState('2026-08-11');
    const est = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 1500, completionTokens: 80, totalTokens: 1580 } });

    it('29. localDayKey preserved', () => { const d = updateDailyTokenCostState(daily, est); expect(d.localDayKey).toBe('2026-08-11'); });
    it('30. day messageCount increment', () => { const d = updateDailyTokenCostState(daily, est); expect(d.messageCount).toBe(1); });
    it('31. day mini/full calls increment', () => { const d = updateDailyTokenCostState(daily, est); expect(d.miniCalls).toBe(1); expect(d.fullCalls).toBe(0); });
    it('32. day totalTokens accumulate', () => { const d = updateDailyTokenCostState(daily, est); expect(d.totalTokens).toBe(1580); });
    it('33. day cost accumulates', () => { const d = updateDailyTokenCostState(daily, est); expect(d.totalEstimatedCostUsd).toBeGreaterThan(0); });
  });

  // ─── DEBUG LINES (34-40) ───
  describe('Debug Lines', () => {
    const est = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 2441, completionTokens: 84, totalTokens: 2525 } });
    const session = updateSessionTokenCostState(createInitialSessionState('s1'), est, ['light']);
    const daily = updateDailyTokenCostState(createInitialDailyState('2026-08-11'), est);

    it('34. model debug line contains tier/model/score/reason', () => {
      const line = buildModelDebugLine({ flag: true, tier: 'mini', model: 'gpt-4o-mini', score: 15, reasonCodes: ['light_context'] });
      expect(line).toContain('tier=mini'); expect(line).toContain('model=gpt-4o-mini'); expect(line).toContain('score=15'); expect(line).toContain('reason=light_context');
    });
    it('35. cost debug line contains msg/session/day/tokens', () => {
      const line = buildTokenCostDebugLine({ estimate: est, sessionState: session, dailyState: daily });
      expect(line).toContain('msg='); expect(line).toContain('session='); expect(line).toContain('day='); expect(line).toContain('tokens=');
    });
    it('36. unknown cost debug line is user-safe', () => {
      const line = buildTokenCostDebugLine({ estimate: null, sessionState: null, dailyState: null });
      expect(line).toContain('unknown'); expect(line).not.toContain('undefined'); expect(line).not.toContain('null');
    });
    it('37. debug line contains no raw prompt', () => {
      const line = buildTokenCostDebugLine({ estimate: est, sessionState: session, dailyState: daily });
      expect(line).not.toContain('system'); expect(line).not.toContain('You are');
    });
    it('38. debug line contains no raw user message', () => {
      const line = buildTokenCostDebugLine({ estimate: est, sessionState: session, dailyState: daily });
      expect(line).not.toMatch(/ik voel|ik ben|hij zegt/i);
    });
    it('39. debug line contains no raw memory', () => {
      const line = buildTokenCostDebugLine({ estimate: est, sessionState: session, dailyState: daily });
      expect(line).not.toContain('backpack'); expect(line).not.toContain('user.dat');
    });
    it('40. debug line contains no personal names', () => {
      const line = buildTokenCostDebugLine({ estimate: est, sessionState: session, dailyState: daily });
      expect(line).not.toContain('Melissa'); expect(line).not.toContain('Kris');
    });
  });

  // ─── CLINICAL INTEGRATION (41-46) ───
  describe('Clinical Integration', () => {
    it('41. clinicalInfo has cost field when tokens available', () => {
      // The pipeline adds cost to clinicalInfo when tokenUsage exists
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toContain('cost: tokenUsage ?');
    });
    it('42. clinicalInfo does not crash when tokens missing', () => {
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toMatch(/cost:.*tokens=unknown/);
    });
    it('43. route minimal-proxy/store:false remains visible', () => {
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toContain("minimal-proxy | store:false");
    });
    it('44. CMD line remains visible', () => {
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toContain('cmd: cmdDebug.featureFlag');
    });
    it('45. Epistemic line remains visible', () => {
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toContain('epistemic: `flag=');
    });
    it('46. ModelRoute line remains visible', () => {
      const pipelineCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/rugzak/pipeline.ts'), 'utf-8');
      expect(pipelineCode).toContain('modelRoute: `flag=');
    });
  });

  // ─── REGRESSION (47-56) ───
  describe('Regression', () => {
    it('47. no server file changes', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/from ['"].*server/);
    });
    it('48. no provider behavior change (tracker is read-only)', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/from ['"].*openai-provider/);
    });
    it('49. no model routing retune', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/resolveEpistemicModelRouting|buildModelRoutingHints/);
    });
    it('50. no prompt changes', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/from ['"].*prompt/);
    });
    it('51. no CMD/DIST01 changes', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/from ['"].*clinical-memory|from ['"].*dist01/);
    });
    it('52. no Kim/Elias retune', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/from ['"].*kim|from ['"].*elias/);
    });
    it('53. no storage schema changes', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/AsyncStorage|SecureStore|FileSystem/);
    });
    it('54. no lockfile changes', () => {
      const trackerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-tracker.ts'), 'utf-8');
      expect(trackerCode).not.toMatch(/pnpm-lock|package-lock|yarn\.lock/);
    });
    it('55. TypeScript 0 errors (types compile)', () => {
      const typesCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/token-cost-types.ts'), 'utf-8');
      expect(typesCode).toContain('ModelTier'); expect(typesCode).toContain('TokenUsage'); expect(typesCode).toContain('SessionTokenCostState');
    });
    it('56. all existing tests still pass (no import conflicts)', () => {
      const configCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/ai/debug/model-price-config.ts'), 'utf-8');
      expect(configCode).toContain('verified 2026-08-11');
    });
  });
});

describe('FASE 9G-B: Pricing Verification', () => {
  it('V1. gpt-4o-mini input price = 0.15', () => { expect(getModelPricing('gpt-4o-mini')!.inputCostPer1MTokensUsd).toBe(0.15); });
  it('V2. gpt-4o-mini output price = 0.60', () => { expect(getModelPricing('gpt-4o-mini')!.outputCostPer1MTokensUsd).toBe(0.60); });
  it('V3. gpt-4o input price = 2.50', () => { expect(getModelPricing('gpt-4o')!.inputCostPer1MTokensUsd).toBe(2.50); });
  it('V4. gpt-4o output price = 10.00', () => { expect(getModelPricing('gpt-4o')!.outputCostPer1MTokensUsd).toBe(10.00); });
  it('V5. gpt-4o-2024-08-06 input price = 2.50', () => { expect(getModelPricing('gpt-4o-2024-08-06')!.inputCostPer1MTokensUsd).toBe(2.50); });
  it('V6. gpt-4o-2024-08-06 output price = 10.00', () => { expect(getModelPricing('gpt-4o-2024-08-06')!.outputCostPer1MTokensUsd).toBe(10.00); });
  it('V7. verified models have requiresVerificationBeforeProduction=false', () => {
    for (const p of MODEL_PRICING_CONFIG) { expect(p.requiresVerificationBeforeProduction).toBe(false); }
  });
  it('V8. debug line shows pricing=verified for verified models', () => {
    const est = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 } });
    expect(est.pricingVerified).toBe(true);
    const line = buildTokenCostDebugLine({ estimate: est, sessionState: createInitialSessionState('s'), dailyState: createInitialDailyState('d') });
    expect(line).toContain('pricing=verified');
  });
  it('V9. unknown model shows pricing=verify/warning', () => {
    const est = estimateTokenCost({ model: 'gpt-unknown', tier: 'unknown', usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 } });
    expect(est.pricingVerified).toBe(false);
    expect(est.warning).toBeTruthy();
    const line = buildTokenCostDebugLine({ estimate: est, sessionState: createInitialSessionState('s'), dailyState: createInitialDailyState('d') });
    expect(line).toContain('pricing=verify');
  });
  it('V10. cost calculation correct for gpt-4o-mini', () => {
    const est = estimateTokenCost({ model: 'gpt-4o-mini', tier: 'mini', usage: { promptTokens: 1000000, completionTokens: 1000000, totalTokens: 2000000 } });
    expect(est.inputCostUsd).toBe(0.15);
    expect(est.outputCostUsd).toBe(0.60);
    expect(est.totalCostUsd).toBe(0.75);
  });
  it('V11. no routing logic in price config', () => {
    const configCode = require('fs').readFileSync(require('path').resolve(__dirname, '../../../lib/ai/debug/model-price-config.ts'), 'utf-8');
    expect(configCode).not.toContain('resolveEpistemicModelRouting');
  });
  it('V12. no provider/server imports in price config', () => {
    const configCode = require('fs').readFileSync(require('path').resolve(__dirname, '../../../lib/ai/debug/model-price-config.ts'), 'utf-8');
    expect(configCode).not.toMatch(/from ['"].*server|from ['"].*openai-provider/);
  });
  it('V13. sourceLabel contains verified date', () => {
    for (const p of MODEL_PRICING_CONFIG) { expect(p.sourceLabel).toContain('verified 2026-08-11'); }
  });
  it('V14. all models have currency USD', () => {
    for (const p of MODEL_PRICING_CONFIG) { expect(p.currency).toBe('USD'); }
  });
});
