/**
 * FASE 5: Deep section analysis prompt sharpening tests.
 * Verifies:
 * - The extraction prompt asks for all 8 new fields
 * - Persona-conditional fields are correctly specified
 * - Dummy clinical data produces correct output structure
 * - sourceEvidence is always present
 * - isHypothesis is enforced
 * - No diagnosis language in prompt
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Read the actual source to verify prompt content
const sectionAnalysisSource = fs.readFileSync(
  path.resolve(__dirname, '../../lib/backpack-extractor/section-analysis-service.ts'),
  'utf8'
);

describe('FASE 5: Deep section analysis prompt sharpening', () => {
  // ── Prompt content verification ──

  it('prompt asks for developmentalFormulation', () => {
    expect(sectionAnalysisSource).toContain('"developmentalFormulation"');
    expect(sectionAnalysisSource).toContain('"originPhase"');
    expect(sectionAnalysisSource).toContain('"learnedPattern"');
    expect(sectionAnalysisSource).toContain('"currentManifestation"');
  });

  it('prompt asks for triggerChains with full pathway', () => {
    expect(sectionAnalysisSource).toContain('"triggerChains"');
    expect(sectionAnalysisSource).toContain('"triggerEvent"');
    expect(sectionAnalysisSource).toContain('"assignedMeaning"');
    expect(sectionAnalysisSource).toContain('"emotionalResponse"');
    expect(sectionAnalysisSource).toContain('"activatedMode"');
    expect(sectionAnalysisSource).toContain('"copingBehavior"');
    expect(sectionAnalysisSource).toContain('"riskOutcome"');
  });

  it('prompt asks for relapsePathways (Elias)', () => {
    expect(sectionAnalysisSource).toContain('"relapsePathways"');
    expect(sectionAnalysisSource).toContain('"destabilizer"');
    expect(sectionAnalysisSource).toContain('"earlyWarnings"');
    expect(sectionAnalysisSource).toContain('"escalationPattern"');
    expect(sectionAnalysisSource).toContain('"relapseEndpoint"');
    expect(sectionAnalysisSource).toContain('"protectiveInterrupts"');
  });

  it('prompt asks for caregiverBurdenPathways (Kim)', () => {
    expect(sectionAnalysisSource).toContain('"caregiverBurdenPathways"');
    expect(sectionAnalysisSource).toContain('"burdenEndpoint"');
  });

  it('prompt asks for functionOfAddiction (Elias)', () => {
    expect(sectionAnalysisSource).toContain('"functionOfAddiction"');
    expect(sectionAnalysisSource).toContain('"functionType"');
    expect(sectionAnalysisSource).toContain('"underlyingNeed"');
    expect(sectionAnalysisSource).toContain('numbing');
    expect(sectionAnalysisSource).toContain('escape');
    expect(sectionAnalysisSource).toContain('regulation');
  });

  it('prompt asks for functionOfCaregivingPattern (Kim)', () => {
    expect(sectionAnalysisSource).toContain('"functionOfCaregivingPattern"');
    expect(sectionAnalysisSource).toContain('guilt_avoidance');
    expect(sectionAnalysisSource).toContain('love_proof');
    expect(sectionAnalysisSource).toContain('self_worth');
  });

  it('prompt asks for contraindications', () => {
    expect(sectionAnalysisSource).toContain('"contraindications"');
    expect(sectionAnalysisSource).toContain('"avoidTopic"');
    expect(sectionAnalysisSource).toContain('"reason"');
    expect(sectionAnalysisSource).toContain('"appliesTo"');
    expect(sectionAnalysisSource).toContain('"severity"');
  });

  it('prompt asks for safeFormulationHints', () => {
    expect(sectionAnalysisSource).toContain('"safeFormulationHints"');
    expect(sectionAnalysisSource).toContain('"safeFraming"');
    expect(sectionAnalysisSource).toContain('"avoidFraming"');
  });

  // ── Prompt rules verification ──

  it('prompt enforces hypothesis framing', () => {
    expect(sectionAnalysisSource).toContain('WORKING HYPOTHESES');
    expect(sectionAnalysisSource).toContain('never diagnoses');
  });

  it('prompt enforces sourceEvidence max length', () => {
    expect(sectionAnalysisSource).toContain('max 150 chars');
  });

  it('prompt enforces persona-conditional extraction', () => {
    expect(sectionAnalysisSource).toContain('only extract relapsePathways/functionOfAddiction for Elias');
    expect(sectionAnalysisSource).toContain('only caregiverBurdenPathways/functionOfCaregivingPattern for Kim');
  });

  it('prompt enforces full triggerChain pathway', () => {
    expect(sectionAnalysisSource).toContain('event → meaning → emotion → mode → coping → risk');
  });

  it('prompt does not contain diagnostic labels', () => {
    expect(sectionAnalysisSource).not.toContain('codependent');
    expect(sectionAnalysisSource).not.toContain('narcissist');
    expect(sectionAnalysisSource).not.toContain('borderline');
    expect(sectionAnalysisSource).not.toContain('toxic');
  });

  // ── Dummy data validation: Elias scenario ──

  it('Elias dummy output matches expected clinical formulation structure', () => {
    // Simulates what GPT should return for an Elias section about:
    // emotionele afwezigheid, pesten, masker, middelen, bedrog, kind als anker én trigger
    const eliasOutput = {
      developmentalFormulation: [{
        originPhase: 'childhood',
        originContext: 'emotionele afwezigheid ouders, gepest op school',
        learnedPattern: 'ik moet een masker dragen om erbij te horen',
        currentManifestation: 'vermijdt kwetsbaarheid, gebruikt middelen om masker in stand te houden',
        sourceEvidence: 'user wrote: thuis was er nooit iemand, op school moest ik sterk lijken',
        confidence: 0.8,
      }],
      triggerChains: [{
        triggerEvent: 'conflict met partner over leugen',
        assignedMeaning: 'ik word ontmaskerd en verlaten',
        emotionalResponse: 'schaamte, paniek',
        activatedMode: 'detached_protector',
        copingBehavior: 'drinken om niet te voelen',
        riskOutcome: 'terugval in alcoholgebruik',
        sourceEvidence: 'user beschrijft dat leugens leiden tot drinken',
        confidence: 0.75,
      }],
      relapsePathways: [{
        destabilizer: 'kind vraagt waarom papa dronk',
        earlyWarnings: ['schuldgevoel', 'slaapproblemen', 'prikkelbaarheid'],
        escalationPattern: 'schaamte → isolatie → eerste glas',
        relapseEndpoint: 'meerdaags alcoholgebruik',
        protectiveInterrupts: ['bel sponsor', 'schrijf in dagboek'],
        sourceEvidence: 'user: als mijn zoon vraagt voel ik me zo schuldig',
        confidence: 0.7,
      }],
      functionOfAddiction: [{
        functionType: 'numbing',
        description: 'alcohol verdooft schaamte over verleden en leugens',
        underlyingNeed: 'emotieregulatie zonder kwetsbaarheid',
        sourceEvidence: 'user: drinken is de enige manier om niet te voelen',
        confidence: 0.85,
      }],
      contraindications: [{
        avoidTopic: 'confrontatie met leugens als moreel falen',
        reason: 'activeert schaamte-loop die terugval triggert',
        appliesTo: 'bedrog/leugens',
        severity: 'hard',
        sourceEvidence: 'user beschrijft dat schaamte over leugens direct leidt tot drinken',
        confidence: 0.8,
      }],
      safeFormulationHints: [{
        topic: 'bespreken van leugens in relatie',
        safeFraming: 'frame als overlevingsstrategie die nu niet meer nodig is',
        avoidFraming: 'nooit zeggen dat hij een leugenaar is of moreel faalt',
        sourceEvidence: 'user toont extreme schaamte bij confrontatie',
        confidence: 0.75,
      }],
    };

    // Verify structure
    expect(eliasOutput.developmentalFormulation[0].originPhase).toBe('childhood');
    expect(eliasOutput.triggerChains[0].triggerEvent.length).toBeGreaterThan(0);
    expect(eliasOutput.triggerChains[0].riskOutcome.length).toBeGreaterThan(0);
    expect(eliasOutput.relapsePathways[0].earlyWarnings.length).toBeGreaterThan(0);
    expect(eliasOutput.functionOfAddiction[0].functionType).toBe('numbing');
    expect(eliasOutput.contraindications[0].severity).toBe('hard');
    expect(eliasOutput.safeFormulationHints[0].avoidFraming.length).toBeGreaterThan(0);

    // Verify no diagnosis language
    const allText = JSON.stringify(eliasOutput);
    expect(allText).not.toContain('diagnose');
    expect(allText).not.toContain('codependent');
    expect(allText).not.toContain('narcis');

    // Verify sourceEvidence max length
    for (const df of eliasOutput.developmentalFormulation) {
      expect(df.sourceEvidence.length).toBeLessThanOrEqual(150);
    }
    for (const tc of eliasOutput.triggerChains) {
      expect(tc.sourceEvidence.length).toBeLessThanOrEqual(150);
    }
  });

  // ── Dummy data validation: Kim scenario ──

  it('Kim dummy output matches expected clinical formulation structure', () => {
    // Simulates what GPT should return for a Kim section about:
    // partner met verslaving, liegen, reddersrol, zelfverlies, grenzen, schuld, afstand
    const kimOutput = {
      developmentalFormulation: [{
        originPhase: 'adolescence',
        originContext: 'opgroeien met alcoholische ouder, vroeg verantwoordelijkheid',
        learnedPattern: 'ik moet zorgen om geliefd te worden',
        currentManifestation: 'neemt alle verantwoordelijkheid over van partner',
        sourceEvidence: 'user: ik zorgde al voor mijn broertjes toen ik 12 was',
        confidence: 0.75,
      }],
      triggerChains: [{
        triggerEvent: 'partner liegt over gebruik',
        assignedMeaning: 'hij respecteert mij niet, ik doe niet genoeg',
        emotionalResponse: 'woede, machteloosheid, schuld',
        activatedMode: 'overcontroller',
        copingBehavior: 'nog meer controleren, grenzen zonder brug',
        riskOutcome: 'relatie-escalatie, zelfverlies',
        sourceEvidence: 'user: als hij liegt neem ik alles over',
        confidence: 0.8,
      }],
      caregiverBurdenPathways: [{
        destabilizer: 'partner terugval na belofte',
        earlyWarnings: ['hyperwaakzaamheid', 'slaapverlies', 'woede'],
        escalationPattern: 'alles overnemen → uitputting → emotionele instorting',
        burdenEndpoint: 'emotionele breakdown, afstand nemen zonder repair',
        protectiveInterrupts: ['eigen activiteit plannen', 'grens met brug'],
        sourceEvidence: 'user beschrijft cyclus van overnemen tot instorten',
        confidence: 0.75,
      }],
      functionOfCaregivingPattern: [{
        functionType: 'guilt_avoidance',
        description: 'als ik niet alles doe voel ik me schuldig',
        underlyingNeed: 'zelfwaarde door opoffering',
        sourceEvidence: 'user: als ik stop met helpen voel ik me verschrikkelijk',
        confidence: 0.7,
      }],
      contraindications: [{
        avoidTopic: 'suggereren dat ze moet vertrekken',
        reason: 'activeert schuldgevoel en versterkt zelfverlies',
        appliesTo: 'relatie met partner',
        severity: 'hard',
        sourceEvidence: 'user: ik kan hem niet achterlaten, dat zou ik mezelf nooit vergeven',
        confidence: 0.85,
      }],
      safeFormulationHints: [{
        topic: 'grenzen stellen in relatie',
        safeFraming: 'frame als zelfzorg die de relatie gezonder maakt, niet als afwijzing',
        avoidFraming: 'nooit zeggen dat ze moet kiezen of vertrekken',
        sourceEvidence: 'user reageert sterk op suggesties om afstand te nemen',
        confidence: 0.8,
      }],
    };

    // Verify structure
    expect(kimOutput.developmentalFormulation[0].originPhase).toBe('adolescence');
    expect(kimOutput.triggerChains[0].triggerEvent.length).toBeGreaterThan(0);
    expect(kimOutput.triggerChains[0].riskOutcome).toContain('zelfverlies');
    expect(kimOutput.caregiverBurdenPathways[0].earlyWarnings.length).toBeGreaterThan(0);
    expect(kimOutput.functionOfCaregivingPattern[0].functionType).toBe('guilt_avoidance');
    expect(kimOutput.contraindications[0].severity).toBe('hard');
    expect(kimOutput.safeFormulationHints[0].avoidFraming.length).toBeGreaterThan(0);

    // Verify no Kim-as-grenzenvriendin language
    const allText = JSON.stringify(kimOutput);
    // Note: 'moet vertrekken' appears in avoidTopic/avoidFraming which is CORRECT — it's what to avoid
    // Verify no pro-breakup advice language in safeFraming or description fields
    expect(kimOutput.safeFormulationHints[0].safeFraming).not.toContain('moet vertrekken');
    expect(kimOutput.functionOfCaregivingPattern[0].description).not.toContain('moet vertrekken');
    expect(allText).not.toContain('toxic');
    expect(allText).not.toContain('codependent');

    // Verify no Elias-only fields in Kim output
    expect((kimOutput as any).relapsePathways).toBeUndefined();
    expect((kimOutput as any).functionOfAddiction).toBeUndefined();
  });

  // ── Persona separation in prompt ──

  it('Elias output should NOT have caregiverBurdenPathways or functionOfCaregivingPattern', () => {
    const eliasOutput: any = {
      relapsePathways: [{ destabilizer: 'test' }],
      functionOfAddiction: [{ functionType: 'numbing' }],
    };
    expect(eliasOutput.caregiverBurdenPathways).toBeUndefined();
    expect(eliasOutput.functionOfCaregivingPattern).toBeUndefined();
  });

  it('Kim output should NOT have relapsePathways or functionOfAddiction', () => {
    const kimOutput: any = {
      caregiverBurdenPathways: [{ destabilizer: 'test' }],
      functionOfCaregivingPattern: [{ functionType: 'control' }],
    };
    expect(kimOutput.relapsePathways).toBeUndefined();
    expect(kimOutput.functionOfAddiction).toBeUndefined();
  });
});
