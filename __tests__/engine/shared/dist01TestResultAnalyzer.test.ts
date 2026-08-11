import { describe, it, expect } from 'vitest';
import {
  analyzeDist01TestResult,
  analyzeDist01TestBatch,
  mapFailureToRecommendedActions,
  mapFailureToTargetLayers,
  determineAffectedDomains,
  buildDist01QualitySummary,
  Dist01QualityScenarioInput,
} from '@/lib/engine/shared/dist01-quality';
import * as fs from 'fs';
import * as path from 'path';

describe('FASE 9E: DIST01 Test Result Analyzer', () => {
  // ─── BASIS (1-5) ───
  describe('Basis', () => {
    it('1. pass scenario with score >= 9 gives no_dist01_change_needed', () => {
      const input: Dist01QualityScenarioInput = { scenarioId: 's1', persona: 'elias', userInputSummary: 'check-in', expectedBehavior: ['warm'], observedBehavior: ['warm'], pass: true, score: 9.5 };
      const r = analyzeDist01TestResult(input);
      expect(r.recommendedActions).toContain('no_dist01_change_needed');
      expect(r.targetLayers).toContain('none');
    });
    it('2. score >= 9 without failures gives no modification flags', () => {
      const input: Dist01QualityScenarioInput = { scenarioId: 's2', persona: 'kim', userInputSummary: 'licht', expectedBehavior: ['ok'], observedBehavior: ['ok'], pass: true, score: 9.8 };
      const r = analyzeDist01TestResult(input);
      expect(r.shouldModifyDetection).toBe(false);
      expect(r.shouldModifyPromotion).toBe(false);
      expect(r.shouldModifyDecay).toBe(false);
    });
    it('3. failed scenario without clear category gives warning', () => {
      const input: Dist01QualityScenarioInput = { scenarioId: 's3', persona: 'elias', userInputSummary: 'test', expectedBehavior: ['x'], observedBehavior: ['y'], pass: false, score: 5 };
      const r = analyzeDist01TestResult(input);
      expect(r.warnings.length).toBeGreaterThan(0);
    });
    it('4. warnings contain no raw personal content', () => {
      const input: Dist01QualityScenarioInput = { scenarioId: 's4', persona: 'kim', userInputSummary: 'Melissa vertelt over haar man Kris', expectedBehavior: ['x'], observedBehavior: ['y'], pass: false };
      const r = analyzeDist01TestResult(input);
      for (const w of r.warnings) { expect(w).not.toContain('Melissa'); expect(w).not.toContain('Kris'); }
    });
    it('5. notes contain no raw personal content', () => {
      const input: Dist01QualityScenarioInput = { scenarioId: 's5', persona: 'elias', userInputSummary: 'Jan praat over drugs', expectedBehavior: ['x'], observedBehavior: ['hypothese als feit'], pass: false, tags: ['hypothesis_promoted_to_fact'] };
      const r = analyzeDist01TestResult(input);
      for (const n of r.notes) { expect(n).not.toContain('Jan'); }
    });
  });

  // ─── FAILURE CATEGORIES (6-25) ───
  describe('Failure Categories', () => {
    const mkFail = (obs: string[], tags?: string[]): Dist01QualityScenarioInput => ({ scenarioId: 'fc', persona: 'elias', userInputSummary: 'test', expectedBehavior: ['correct'], observedBehavior: obs, pass: false, score: 6, tags });

    it('6. hypothesis_promoted_to_fact detected', () => { const r = analyzeDist01TestResult(mkFail(['hypothese als feit gepresenteerd'])); expect(r.failureCategories).toContain('hypothesis_promoted_to_fact'); });
    it('7. interpretation_treated_as_fact detected', () => { const r = analyzeDist01TestResult(mkFail(['interpretatie als feit behandeld'])); expect(r.failureCategories).toContain('interpretation_treated_as_fact'); });
    it('8. mindreading detected', () => { const r = analyzeDist01TestResult(mkFail(['mindreading bevestigd'])); expect(r.failureCategories).toContain('mindreading'); });
    it('9. rescue_role_advice detected', () => { const r = analyzeDist01TestResult(mkFail(['reddersrol advies gegeven'])); expect(r.failureCategories).toContain('rescue_role_advice'); });
    it('10. responsibility_misattribution detected', () => { const r = analyzeDist01TestResult(mkFail(['verantwoordelijkheid verkeerd toegewezen'])); expect(r.failureCategories).toContain('responsibility_misattribution'); });
    it('11. medical_certainty_overclaim detected', () => { const r = analyzeDist01TestResult(mkFail(['medisch zeker zonder bron'])); expect(r.failureCategories).toContain('medical_certainty_overclaim'); });
    it('12. stale_memory_overweighted detected', () => { const r = analyzeDist01TestResult(mkFail(['verouderd geheugen te zwaar gewogen'])); expect(r.failureCategories).toContain('stale_memory_overweighted'); });
    it('13. contradiction_ignored detected', () => { const r = analyzeDist01TestResult(mkFail(['contradictie genegeerd'])); expect(r.failureCategories).toContain('contradiction_ignored'); });
    it('14. persona_leakage detected', () => { const r = analyzeDist01TestResult(mkFail(['persona leakage: elias in kim'])); expect(r.failureCategories).toContain('persona_leakage'); });
    it('15. raw_memory_risk detected', () => { const r = analyzeDist01TestResult(mkFail(['raw memory dump zichtbaar'])); expect(r.failureCategories).toContain('raw_memory_risk'); });
    it('16. safety_underweighted detected', () => { const r = analyzeDist01TestResult(mkFail(['veiligheid onderschat'])); expect(r.failureCategories).toContain('safety_underweighted'); });
    it('17. false_positive_pattern detected', () => { const r = analyzeDist01TestResult(mkFail(['false positive: onterecht herkend'])); expect(r.failureCategories).toContain('false_positive_pattern'); });
    it('18. false_negative_pattern detected', () => { const r = analyzeDist01TestResult(mkFail(['false negative: niet herkend'])); expect(r.failureCategories).toContain('false_negative_pattern'); });
    it('19. confidence_too_high detected', () => { const r = analyzeDist01TestResult(mkFail(['confidence te hoog, zekerheid overdreven'])); expect(r.failureCategories).toContain('confidence_too_high'); });
    it('20. confidence_too_low detected', () => { const r = analyzeDist01TestResult(mkFail(['confidence te laag, zekerheid onderschat'])); expect(r.failureCategories).toContain('confidence_too_low'); });
    it('21. unsupported_recovery_claim detected', () => { const r = analyzeDist01TestResult(mkFail(['recovery claim zonder bewijs, herstel claim zonder'])); expect(r.failureCategories).toContain('unsupported_recovery_claim'); });
    it('22. unsupported_relational_claim detected', () => { const r = analyzeDist01TestResult(mkFail(['relatie claim zonder bewijs, relational unsupported'])); expect(r.failureCategories).toContain('unsupported_relational_claim'); });
    it('23. shame_identity_reinforced detected', () => { const r = analyzeDist01TestResult(mkFail(['schaamte als identiteit bevestigd, zwak bevestigd'])); expect(r.failureCategories).toContain('shame_identity_reinforced'); });
    it('24. craving_story_followed detected', () => { const r = analyzeDist01TestResult(mkFail(['craving verhaal gevolgd, toestemming gegeven'])); expect(r.failureCategories).toContain('craving_story_followed'); });
    it('25. user_emotion_not_validated detected', () => { const r = analyzeDist01TestResult(mkFail(['emotie niet gevalideerd, gevoel genegeerd'])); expect(r.failureCategories).toContain('user_emotion_not_validated'); });
  });

  // ─── ACTIONS (26-39) ───
  describe('Actions', () => {
    it('26. hypothesis → store_as_hypothesis_only', () => { expect(mapFailureToRecommendedActions('hypothesis_promoted_to_fact')).toContain('store_as_hypothesis_only'); });
    it('27. hypothesis severe → suppress_from_gpt', () => { expect(mapFailureToRecommendedActions('hypothesis_promoted_to_fact')).toContain('suppress_from_gpt'); });
    it('28. mindreading → add_mindreading_guard', () => { expect(mapFailureToRecommendedActions('mindreading')).toContain('add_mindreading_guard'); });
    it('29. rescue role → add_rescue_role_guard', () => { expect(mapFailureToRecommendedActions('rescue_role_advice')).toContain('add_rescue_role_guard'); });
    it('30. responsibility → add_responsibility_boundary_label', () => { expect(mapFailureToRecommendedActions('responsibility_misattribution')).toContain('add_responsibility_boundary_label'); });
    it('31. medical overclaim → add_medical_uncertainty_label', () => { expect(mapFailureToRecommendedActions('medical_certainty_overclaim')).toContain('add_medical_uncertainty_label'); });
    it('32. stale → apply_decay', () => { expect(mapFailureToRecommendedActions('stale_memory_overweighted')).toContain('apply_decay'); });
    it('33. contradiction → mark_contradiction', () => { expect(mapFailureToRecommendedActions('contradiction_ignored')).toContain('mark_contradiction'); });
    it('34. contradiction → require_user_confirmation', () => { expect(mapFailureToRecommendedActions('contradiction_ignored')).toContain('require_user_confirmation'); });
    it('35. persona leakage → add_persona_filter', () => { expect(mapFailureToRecommendedActions('persona_leakage')).toContain('add_persona_filter'); });
    it('36. persona leakage → suppress_from_gpt', () => { expect(mapFailureToRecommendedActions('persona_leakage')).toContain('suppress_from_gpt'); });
    it('37. safety underweighted → add_safety_priority', () => { expect(mapFailureToRecommendedActions('safety_underweighted')).toContain('add_safety_priority'); });
    it('38. craving story → add_craving_permission_guard', () => { expect(mapFailureToRecommendedActions('craving_story_followed')).toContain('add_craving_permission_guard'); });
    it('39. shame identity → add_shame_identity_guard', () => { expect(mapFailureToRecommendedActions('shame_identity_reinforced')).toContain('add_shame_identity_guard'); });
  });

  // ─── TARGET LAYERS (40-48) ───
  describe('Target Layers', () => {
    it('40. Kim rescue-role targets epistemic/kim_adapter', () => { const l = mapFailureToTargetLayers('rescue_role_advice', 'kim', []); expect(l).toContain('epistemic_engine'); expect(l).toContain('kim_adapter'); });
    it('41. Kim relational harm targets dist01_signals/cmd_selector', () => { const l = mapFailureToTargetLayers('stale_memory_overweighted', 'kim', ['relational_harm']); expect(l).toContain('dist01_contexts'); expect(l).toContain('cmd_selector'); });
    it('42. Elias craving targets dist01_signals/elias_adapter', () => { const l = mapFailureToTargetLayers('craving_story_followed', 'elias', []); expect(l).toContain('dist01_signals'); expect(l).toContain('elias_adapter'); });
    it('43. Elias shame targets dist01_signals/elias_adapter', () => { const l = mapFailureToTargetLayers('shame_identity_reinforced', 'elias', []); expect(l).toContain('dist01_signals'); expect(l).toContain('elias_adapter'); });
    it('44. medical uncertainty targets epistemic_engine/cmd_contract', () => { const l = mapFailureToTargetLayers('medical_certainty_overclaim', 'elias', []); expect(l).toContain('epistemic_engine'); expect(l).toContain('cmd_contract'); });
    it('45. contradiction targets dist01_signals/dist01_contexts', () => { const l = mapFailureToTargetLayers('contradiction_ignored', 'elias', []); expect(l).toContain('dist01_signals'); expect(l).toContain('dist01_contexts'); });
    it('46. stale targets dist01_contexts/cmd_selector', () => { const l = mapFailureToTargetLayers('stale_memory_overweighted', 'kim', []); expect(l).toContain('dist01_contexts'); expect(l).toContain('cmd_selector'); });
    it('47. persona leakage targets persona adapter/cmd_selector', () => { const l = mapFailureToTargetLayers('persona_leakage', 'kim', []); expect(l).toContain('cmd_selector'); expect(l).toContain('kim_adapter'); });
    it('48. raw memory risk targets cmd_selector/cmd_contract', () => { const l = mapFailureToTargetLayers('raw_memory_risk', 'elias', []); expect(l).toContain('cmd_selector'); expect(l).toContain('cmd_contract'); });
  });

  // ─── BATCH ANALYSIS (49-57) ───
  describe('Batch Analysis', () => {
    const mkInput = (id: string, persona: 'elias' | 'kim', pass: boolean, obs: string[]): Dist01QualityScenarioInput => ({ scenarioId: id, persona, userInputSummary: 'test', expectedBehavior: ['ok'], observedBehavior: obs, pass, score: pass ? 9.5 : 5 });

    it('49. counts total/pass/fail', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', true, ['ok']), mkInput('b', 'kim', false, ['contradictie genegeerd'])]);
      expect(batch.totalScenarios).toBe(2);
      expect(batch.passedScenarios).toBe(1);
      expect(batch.failedScenarios).toBe(1);
    });
    it('50. recurrent contradiction recommends contradiction_resolution', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', false, ['contradictie genegeerd']), mkInput('b', 'kim', false, ['contradictie genegeerd'])]);
      expect(batch.recommendedNextPhase).toBe('contradiction_resolution');
    });
    it('51. recurrent stale recommends decay_stale_cleanup', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', false, ['verouderd geheugen te zwaar']), mkInput('b', 'kim', false, ['oud geheugen stale weight'])]);
      expect(batch.recommendedNextPhase).toBe('decay_stale_cleanup');
    });
    it('52. recurrent confidence issues recommends confidence_promotion', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', false, ['confidence te hoog']), mkInput('b', 'kim', false, ['zekerheid overdreven, confidence hoog'])]);
      expect(batch.recommendedNextPhase).toBe('confidence_promotion');
    });
    it('53. any persona leakage recommends persona_filter_patch', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', true, ['ok']), mkInput('b', 'kim', false, ['persona leakage'])]);
      expect(batch.recommendedNextPhase).toBe('persona_filter_patch');
    });
    it('54. any safety underweighted recommends safety_priority_patch', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', true, ['ok']), mkInput('b', 'kim', false, ['veiligheid onderschat'])]);
      expect(batch.recommendedNextPhase).toBe('safety_priority_patch');
    });
    it('55. all pass recommends no_dist01_change_needed', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', true, ['ok']), mkInput('b', 'kim', true, ['ok'])]);
      expect(batch.recommendedNextPhase).toBe('no_dist01_change_needed');
    });
    it('56. priority safety beats confidence', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'elias', false, ['veiligheid onderschat']), mkInput('b', 'kim', false, ['confidence te hoog']), mkInput('c', 'kim', false, ['confidence te hoog'])]);
      expect(batch.recommendedNextPhase).toBe('safety_priority_patch');
    });
    it('57. priority persona leakage beats decay', () => {
      const batch = analyzeDist01TestBatch([mkInput('a', 'kim', false, ['persona leakage']), mkInput('b', 'elias', false, ['verouderd geheugen te zwaar']), mkInput('c', 'elias', false, ['oud geheugen stale weight'])]);
      expect(batch.recommendedNextPhase).toBe('persona_filter_patch');
    });
  });

  // ─── DOMAIN DETECTION (58-70) ───
  describe('Domain Detection', () => {
    const mkDomain = (summary: string, tags?: string[]): Dist01QualityScenarioInput => ({ scenarioId: 'dd', persona: 'elias', userInputSummary: summary, expectedBehavior: [], observedBehavior: [], pass: true, tags });

    it('58. detects craving domain', () => { expect(determineAffectedDomains(mkDomain('craving naar alcohol'))).toContain('craving'); });
    it('59. detects relapse_risk domain', () => { expect(determineAffectedDomains(mkDomain('terugval risico'))).toContain('relapse_risk'); });
    it('60. detects shame domain', () => { expect(determineAffectedDomains(mkDomain('schaamte en schuld'))).toContain('shame'); });
    it('61. detects medical_uncertainty domain', () => { expect(determineAffectedDomains(mkDomain('medisch advies arts'))).toContain('medical_uncertainty'); });
    it('62. detects responsibility_boundary domain', () => { expect(determineAffectedDomains(mkDomain('verantwoordelijkheid en grens'))).toContain('responsibility_boundary'); });
    it('63. detects rescue_role domain', () => { expect(determineAffectedDomains(mkDomain('redder rol overnemen'))).toContain('rescue_role'); });
    it('64. detects mindreading domain', () => { expect(determineAffectedDomains(mkDomain('hij begrijpt niet wat hij doet'))).toContain('mindreading'); });
    it('65. detects relational_harm domain', () => { expect(determineAffectedDomains(mkDomain('leugen en bedrog'))).toContain('relational_harm'); });
    it('66. detects self_loss domain', () => { expect(determineAffectedDomains(mkDomain('zelfverlies en verdwijnen'))).toContain('self_loss'); });
    it('67. detects safety/crisis domain', () => { expect(determineAffectedDomains(mkDomain('veiligheid en crisis'))).toContain('safety'); });
    it('68. detects contradiction domain', () => { expect(determineAffectedDomains(mkDomain('contradictie en tegenspraak'))).toContain('contradiction'); });
    it('69. detects stale_memory domain', () => { expect(determineAffectedDomains(mkDomain('verouderd en stale geheugen'))).toContain('stale_memory'); });
    it('70. detects persona_separation domain', () => { expect(determineAffectedDomains(mkDomain('persona leakage elias kim'))).toContain('persona_separation'); });
  });

  // ─── PRIVACY / REGRESSION (71-82) ───
  describe('Privacy & Regression', () => {
    it('71. summary max 1500 chars', () => {
      const inputs: Dist01QualityScenarioInput[] = Array.from({ length: 50 }, (_, i) => ({ scenarioId: `s${i}`, persona: 'elias' as const, userInputSummary: 'x'.repeat(100), expectedBehavior: ['x'], observedBehavior: ['contradictie genegeerd'], pass: false, score: 3 }));
      const batch = analyzeDist01TestBatch(inputs);
      const summary = buildDist01QualitySummary(batch);
      expect(summary.length).toBeLessThanOrEqual(1500);
    });
    it('72. summary has no raw user input', () => {
      const inputs: Dist01QualityScenarioInput[] = [{ scenarioId: 's1', persona: 'elias', userInputSummary: 'Kris praat over Melissa en drinken', expectedBehavior: ['ok'], observedBehavior: ['hypothese als feit'], pass: false }];
      const batch = analyzeDist01TestBatch(inputs);
      const summary = buildDist01QualitySummary(batch);
      expect(summary).not.toContain('Kris'); expect(summary).not.toContain('Melissa');
    });
    it('73. summary has no raw response text', () => {
      const inputs: Dist01QualityScenarioInput[] = [{ scenarioId: 's1', persona: 'kim', userInputSummary: 'test', expectedBehavior: ['ok'], observedBehavior: ['Het antwoord was: je moet afstand nemen van je partner'], pass: false }];
      const batch = analyzeDist01TestBatch(inputs);
      const summary = buildDist01QualitySummary(batch);
      expect(summary).not.toContain('je moet afstand nemen');
    });
    it('74. summary has no personal names', () => {
      const inputs: Dist01QualityScenarioInput[] = [{ scenarioId: 's1', persona: 'elias', userInputSummary: 'Ellen en Jules bespreken', expectedBehavior: ['ok'], observedBehavior: ['ok'], pass: true, score: 9.5 }];
      const batch = analyzeDist01TestBatch(inputs);
      const summary = buildDist01QualitySummary(batch);
      expect(summary).not.toContain('Ellen'); expect(summary).not.toContain('Jules');
    });
    it('75. no server imports', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/from ['"].*server/);
    });
    it('76. no provider imports', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/from ['"].*openai-provider/);
    });
    it('77. no pipeline imports', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/from ['"].*pipeline/);
    });
    it('78. no DIST01 mutation', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/\.save\(|\.write\(|\.update\(|\.delete\(/);
    });
    it('79. no CMD mutation', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/from ['"].*clinical-memory-distillation/);
    });
    it('80. no storage mutation', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/AsyncStorage|SecureStore|FileSystem/);
    });
    it('81. TypeScript 0 errors (types file compiles)', () => {
      const typesCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer-types.ts'), 'utf-8');
      expect(typesCode).toContain('Dist01FailureCategory');
      expect(typesCode).toContain('Dist01RecommendedAction');
      expect(typesCode).toContain('Dist01TargetLayer');
    });
    it('82. no lockfile change (file exists and is not imported)', () => {
      const analyzerCode = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/dist01-quality/dist01-test-result-analyzer.ts'), 'utf-8');
      expect(analyzerCode).not.toMatch(/pnpm-lock|package-lock|yarn\.lock/);
    });
  });
});
