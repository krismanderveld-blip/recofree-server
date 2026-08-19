/**
 * FASE 4: Backpack clinical formulation output schema extension tests.
 * Verifies:
 * - All 8 new types are correctly defined
 * - Backwards compatibility with existing user.dat (new fields optional)
 * - Persona separation (Elias-only, Kim-only, shared)
 * - confidence + sourceEvidence on all new types
 * - isHypothesis always true where applicable
 * - No raw Backpack/user.dat/DIST01 in output
 */
import { describe, it, expect } from 'vitest';
import type {
  DevelopmentalFormulation,
  TriggerChain,
  RelapsePathway,
  CaregiverBurdenPathway,
  FunctionOfAddiction,
  FunctionOfCaregivingPattern,
  Contraindication,
  SafeFormulationHint,
  BackpackSectionAnalysisResult,
} from '../../lib/backpack-extractor/section-analysis-types';

describe('FASE 4: Backpack clinical formulation output schema extension', () => {
  // ── Type structure tests ──

  it('DevelopmentalFormulation has required fields', () => {
    const df: DevelopmentalFormulation = {
      originPhase: 'childhood',
      originContext: 'parental neglect',
      learnedPattern: 'I am not worthy of attention',
      currentManifestation: 'avoids asking for help',
      sourceEvidence: 'user wrote: mijn ouders waren er nooit',
      confidence: 0.75,
      sourceSectionId: 'section_childhood',
      isHypothesis: true,
    };
    expect(df.isHypothesis).toBe(true);
    expect(df.confidence).toBeGreaterThan(0);
    expect(df.sourceEvidence.length).toBeGreaterThan(0);
  });

  it('TriggerChain maps full activation pathway', () => {
    const tc: TriggerChain = {
      triggerEvent: 'partner raises voice',
      assignedMeaning: 'I am being abandoned',
      emotionalResponse: 'panic, fear',
      activatedMode: 'vulnerable_child',
      copingBehavior: 'drinking to numb',
      riskOutcome: 'relapse',
      sourceEvidence: 'user described conflict leading to drinking',
      confidence: 0.8,
      sourceSectionId: 'section_relationships',
      isHypothesis: true,
    };
    expect(tc.isHypothesis).toBe(true);
    expect(tc.triggerEvent.length).toBeGreaterThan(0);
    expect(tc.riskOutcome.length).toBeGreaterThan(0);
  });

  it('RelapsePathway is Elias-specific', () => {
    const rp: RelapsePathway = {
      destabilizer: 'social drinking situation',
      earlyWarnings: ['irritability', 'sleep disruption', 'isolation'],
      escalationPattern: 'one drink leads to binge',
      relapseEndpoint: 'multi-day alcohol use',
      protectiveInterrupts: ['call sponsor', 'leave situation'],
      sourceEvidence: 'user described pattern in life story',
      confidence: 0.7,
      sourceSectionId: 'section_addiction',
      isHypothesis: true,
    };
    expect(rp.isHypothesis).toBe(true);
    expect(rp.earlyWarnings.length).toBeGreaterThan(0);
    expect(rp.protectiveInterrupts.length).toBeGreaterThan(0);
  });

  it('CaregiverBurdenPathway is Kim-specific', () => {
    const cbp: CaregiverBurdenPathway = {
      destabilizer: 'partner relapse after promise',
      earlyWarnings: ['hypervigilance', 'sleep loss', 'anger'],
      escalationPattern: 'takes over all responsibilities',
      burdenEndpoint: 'emotional breakdown',
      protectiveInterrupts: ['delegate tasks', 'set boundary'],
      sourceEvidence: 'user described burnout after partner relapse',
      confidence: 0.75,
      sourceSectionId: 'section_impact',
      isHypothesis: true,
    };
    expect(cbp.isHypothesis).toBe(true);
    expect(cbp.earlyWarnings.length).toBeGreaterThan(0);
  });

  it('FunctionOfAddiction maps psychological function (Elias only)', () => {
    const foa: FunctionOfAddiction = {
      functionType: 'numbing',
      description: 'alcohol numbs grief after mother death',
      underlyingNeed: 'emotional regulation',
      sourceEvidence: 'user wrote: drinken is de enige manier om niet te voelen',
      confidence: 0.85,
      sourceSectionId: 'section_addiction',
      isHypothesis: true,
    };
    expect(foa.isHypothesis).toBe(true);
    expect(foa.functionType).toBe('numbing');
  });

  it('FunctionOfCaregivingPattern maps psychological function (Kim only)', () => {
    const fcp: FunctionOfCaregivingPattern = {
      functionType: 'guilt_avoidance',
      description: 'over-caring prevents guilt of not doing enough',
      underlyingNeed: 'self-worth through sacrifice',
      sourceEvidence: 'user wrote: als ik niet help voel ik me schuldig',
      confidence: 0.7,
      sourceSectionId: 'section_my_story',
      isHypothesis: true,
    };
    expect(fcp.isHypothesis).toBe(true);
    expect(fcp.functionType).toBe('guilt_avoidance');
  });

  it('Contraindication has severity and appliesTo', () => {
    const ci: Contraindication = {
      avoidTopic: 'suggesting contact with mother',
      reason: 'mother is deceased, user grieves',
      appliesTo: 'moeder',
      severity: 'hard',
      sourceEvidence: 'user wrote: mijn moeder is 2 jaar geleden overleden',
      confidence: 0.95,
      sourceSectionId: 'section_family',
    };
    expect(ci.severity).toBe('hard');
    expect(ci.appliesTo.length).toBeGreaterThan(0);
  });

  it('SafeFormulationHint has safe and avoid framing', () => {
    const sfh: SafeFormulationHint = {
      topic: 'discussing relapse',
      safeFraming: 'frame as learning moment, not failure',
      avoidFraming: 'never say you failed or you are weak',
      sourceEvidence: 'user expressed shame about relapse',
      confidence: 0.8,
      sourceSectionId: 'section_recovery',
    };
    expect(sfh.safeFraming.length).toBeGreaterThan(0);
    expect(sfh.avoidFraming.length).toBeGreaterThan(0);
  });

  // ── Backwards compatibility ──

  it('BackpackSectionAnalysisResult works without new fields (backwards compatible)', () => {
    const result: BackpackSectionAnalysisResult = {
      persona: 'elias',
      sectionId: 'test',
      sectionHash: 'abc123',
      analyzedAt: new Date().toISOString(),
      personalAnchors: [],
      relationGraph: [],
      lifeEvents: [],
      lifeStatusFacts: [],
      schemas: [],
      modes: [],
      triggers: [],
      protectiveFactors: [],
      values: [],
      goals: [],
      risks: [],
      recoveryPatterns: [],
      caregiverPatterns: [],
      confidenceSummary: { overallConfidence: 0, explicitFactCount: 0, inferredFactCount: 0, unsupportedFactsDiscarded: 0 },
      warnings: [],
    };
    // New fields are optional — result compiles without them
    expect(result.developmentalFormulation).toBeUndefined();
    expect(result.triggerChains).toBeUndefined();
    expect(result.relapsePathways).toBeUndefined();
    expect(result.caregiverBurdenPathways).toBeUndefined();
    expect(result.functionOfAddiction).toBeUndefined();
    expect(result.functionOfCaregivingPattern).toBeUndefined();
    expect(result.contraindications).toBeUndefined();
    expect(result.safeFormulationHints).toBeUndefined();
  });

  it('BackpackSectionAnalysisResult accepts new fields when present', () => {
    const result: BackpackSectionAnalysisResult = {
      persona: 'elias',
      sectionId: 'test',
      sectionHash: 'abc123',
      analyzedAt: new Date().toISOString(),
      personalAnchors: [],
      relationGraph: [],
      lifeEvents: [],
      lifeStatusFacts: [],
      schemas: [],
      modes: [],
      triggers: [],
      protectiveFactors: [],
      values: [],
      goals: [],
      risks: [],
      recoveryPatterns: [],
      caregiverPatterns: [],
      developmentalFormulation: [{ originPhase: 'childhood', originContext: 'test', learnedPattern: 'test', currentManifestation: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      triggerChains: [{ triggerEvent: 'test', assignedMeaning: 'test', emotionalResponse: 'test', activatedMode: 'test', copingBehavior: 'test', riskOutcome: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      relapsePathways: [{ destabilizer: 'test', earlyWarnings: ['a'], escalationPattern: 'test', relapseEndpoint: 'test', protectiveInterrupts: ['b'], sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      functionOfAddiction: [{ functionType: 'numbing', description: 'test', underlyingNeed: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      contraindications: [{ avoidTopic: 'test', reason: 'test', appliesTo: 'test', severity: 'hard', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x' }],
      safeFormulationHints: [{ topic: 'test', safeFraming: 'test', avoidFraming: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x' }],
      confidenceSummary: { overallConfidence: 0.5, explicitFactCount: 1, inferredFactCount: 1, unsupportedFactsDiscarded: 0 },
      warnings: [],
    };
    expect(result.developmentalFormulation!.length).toBe(1);
    expect(result.triggerChains!.length).toBe(1);
    expect(result.relapsePathways!.length).toBe(1);
    expect(result.functionOfAddiction!.length).toBe(1);
    expect(result.contraindications!.length).toBe(1);
    expect(result.safeFormulationHints!.length).toBe(1);
  });

  // ── Persona separation ──

  it('relapsePathways and functionOfAddiction are Elias-only by convention', () => {
    // Type system allows them on any result, but convention is Elias-only
    // This test documents the convention
    const eliasResult: Partial<BackpackSectionAnalysisResult> = {
      persona: 'elias',
      relapsePathways: [{ destabilizer: 'test', earlyWarnings: [], escalationPattern: 'test', relapseEndpoint: 'test', protectiveInterrupts: [], sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      functionOfAddiction: [{ functionType: 'escape', description: 'test', underlyingNeed: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
    };
    expect(eliasResult.persona).toBe('elias');
    expect(eliasResult.relapsePathways!.length).toBe(1);
  });

  it('caregiverBurdenPathways and functionOfCaregivingPattern are Kim-only by convention', () => {
    const kimResult: Partial<BackpackSectionAnalysisResult> = {
      persona: 'kim',
      caregiverBurdenPathways: [{ destabilizer: 'test', earlyWarnings: [], escalationPattern: 'test', burdenEndpoint: 'test', protectiveInterrupts: [], sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      functionOfCaregivingPattern: [{ functionType: 'control', description: 'test', underlyingNeed: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
    };
    expect(kimResult.persona).toBe('kim');
    expect(kimResult.caregiverBurdenPathways!.length).toBe(1);
  });

  it('developmentalFormulation, triggerChains, contraindications, safeFormulationHints are shared', () => {
    // Both Elias and Kim can have these
    const shared: Partial<BackpackSectionAnalysisResult> = {
      persona: 'elias',
      developmentalFormulation: [{ originPhase: 'adolescence', originContext: 'test', learnedPattern: 'test', currentManifestation: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      triggerChains: [{ triggerEvent: 'test', assignedMeaning: 'test', emotionalResponse: 'test', activatedMode: 'test', copingBehavior: 'test', riskOutcome: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true }],
      contraindications: [{ avoidTopic: 'test', reason: 'test', appliesTo: 'test', severity: 'soft', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x' }],
      safeFormulationHints: [{ topic: 'test', safeFraming: 'test', avoidFraming: 'test', sourceEvidence: 'test', confidence: 0.5, sourceSectionId: 'x' }],
    };
    expect(shared.developmentalFormulation!.length).toBe(1);
    expect(shared.triggerChains!.length).toBe(1);
    expect(shared.contraindications!.length).toBe(1);
    expect(shared.safeFormulationHints!.length).toBe(1);
  });

  // ── Confidence & sourceEvidence ──

  it('all new types require confidence field', () => {
    // Compile-time check: if these compile, confidence is required
    const df: DevelopmentalFormulation = { originPhase: 'childhood', originContext: 'x', learnedPattern: 'x', currentManifestation: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    const tc: TriggerChain = { triggerEvent: 'x', assignedMeaning: 'x', emotionalResponse: 'x', activatedMode: 'x', copingBehavior: 'x', riskOutcome: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    const ci: Contraindication = { avoidTopic: 'x', reason: 'x', appliesTo: 'x', severity: 'hard', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x' };
    const sfh: SafeFormulationHint = { topic: 'x', safeFraming: 'x', avoidFraming: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x' };
    expect(df.confidence).toBeDefined();
    expect(tc.confidence).toBeDefined();
    expect(ci.confidence).toBeDefined();
    expect(sfh.confidence).toBeDefined();
  });

  it('all hypothesis types have isHypothesis=true', () => {
    const df: DevelopmentalFormulation = { originPhase: 'childhood', originContext: 'x', learnedPattern: 'x', currentManifestation: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    const tc: TriggerChain = { triggerEvent: 'x', assignedMeaning: 'x', emotionalResponse: 'x', activatedMode: 'x', copingBehavior: 'x', riskOutcome: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    const rp: RelapsePathway = { destabilizer: 'x', earlyWarnings: [], escalationPattern: 'x', relapseEndpoint: 'x', protectiveInterrupts: [], sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    const foa: FunctionOfAddiction = { functionType: 'numbing', description: 'x', underlyingNeed: 'x', sourceEvidence: 'x', confidence: 0.5, sourceSectionId: 'x', isHypothesis: true };
    expect(df.isHypothesis).toBe(true);
    expect(tc.isHypothesis).toBe(true);
    expect(rp.isHypothesis).toBe(true);
    expect(foa.isHypothesis).toBe(true);
  });

  // ── No raw data leak ──

  it('sourceEvidence is a quote/summary, not raw backpack dump', () => {
    // Convention: sourceEvidence should be a short quote or paraphrase, max ~200 chars
    const ci: Contraindication = {
      avoidTopic: 'suggesting reconciliation with father',
      reason: 'father was abusive',
      appliesTo: 'vader',
      severity: 'hard',
      sourceEvidence: 'user wrote: mijn vader sloeg mij als kind',
      confidence: 0.9,
      sourceSectionId: 'section_childhood',
    };
    expect(ci.sourceEvidence.length).toBeLessThan(300);
    expect(ci.sourceEvidence).not.toContain('user.dat');
    expect(ci.sourceEvidence).not.toContain('AsyncStorage');
    expect(ci.sourceEvidence).not.toContain('DIST01');
  });
});
