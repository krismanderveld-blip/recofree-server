/**
 * STO01 Stoicism Integration Module — Test Cases
 *
 * Tests the full STO01 transport chain:
 * - Trigger detection
 * - Safety flag detection
 * - Routing decisions (activation, principle, intervention, fallback)
 * - Forbidden outputs
 * - Storage contract
 *
 * Based on STO01TestCases from the spec document (section 18).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectSTO01TriggerMarkers,
  detectSTO01SafetyFlags,
  hasSTO01Markers,
  evaluateSTO01,
  selectSTO01Intervention,
  getSTO01ForbiddenOutputs,
  getSTO01SessionState,
  resetSTO01SessionState,
  updateSTO01SessionState,
  updateSTO01Progress,
  createDefaultSTO01Progress,
} from '../lib/engine/elias/stoicism';
import type { STO01Input } from '../lib/engine/elias/stoicism';

// ─── Helper: Build a default STO01Input ────────────────────────────────────

function buildDefaultInput(overrides: Partial<STO01Input> = {}): STO01Input {
  return {
    moduleId: 'STO01',
    pipelinePosition: '5e4',
    userInput: '',
    language: 'en',
    triggerMarkers: {
      ruminationOutsideControl: false,
      externalCauseFixation: false,
      relapseMeaningSearch: false,
      explicitStoicismRequest: false,
      explicitPhilosophyRequest: false,
    },
    safety: {
      activeSuicidalIntent: false,
      passiveDeathWish: false,
      selfHarmIntent: false,
      acuteMedicalRisk: false,
      overdoseOrPoisoningRisk: false,
      severeIntoxication: false,
      acuteWithdrawalRisk: false,
      deliriumOrSeizureRisk: false,
      dissociationHeavy: false,
    },
    recoveryContext: {
      userRole: 'person_in_recovery',
      recentRelapse: false,
      externalConflictPresent: false,
      caregiverImpactPresent: false,
    },
    shadowWorkContext: {
      sw01Executed: false,
      projectionDetected: false,
      avoidanceDetected: false,
      intellectualizationDetected: false,
      shameCoreActivated: false,
      shadowWorkRecommendedButNotPrimary: false,
    },
    ...overrides,
  };
}

// ─── STO01_TEST_001: Rumination Outside Control ────────────────────────────

describe('STO01 Stoicism Integration', () => {
  beforeEach(() => {
    resetSTO01SessionState();
  });

  it('STO01_TEST_001: activates dichotomy_of_control for rumination', () => {
    const userText = 'I cannot stop thinking about what she thinks of me.';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(triggerMarkers.ruminationOutsideControl).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(true);
    expect(result.routingDecision.primaryPrinciple).toBe('dichotomy_of_control');
    expect(result.routingDecision.interventionType).toBe('STO01_IT01_CONTROL_SORTING');
    expect(result.generatedInstruction.active).toBe(true);
    expect(result.generatedInstruction.gptPromptBlock.length).toBeGreaterThan(0);
    expect(result.pipelineContinue).toBe(true);
  });

  // ─── STO01_TEST_002: External Cause Fixation ──────────────────────────────

  it('STO01_TEST_002: activates connected_responsibility for external blame', () => {
    const userText = 'They made me drink again.';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(triggerMarkers.externalCauseFixation).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(true);
    expect(result.routingDecision.primaryPrinciple).toBe('dichotomy_of_control');
    expect(result.routingDecision.interventionType).toBe('STO01_IT05_CONNECTED_RESPONSIBILITY');
    expect(result.generatedInstruction.active).toBe(true);
    expect(result.pipelineContinue).toBe(true);
  });

  // ─── STO01_TEST_003: Relapse Meaning Search ───────────────────────────────

  it('STO01_TEST_003: activates amor_fati for relapse meaning search', () => {
    const userText = 'I relapsed. What does that mean about me?';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(triggerMarkers.relapseMeaningSearch).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
      recoveryContext: {
        userRole: 'person_in_recovery',
        recentRelapse: true,
        externalConflictPresent: false,
        caregiverImpactPresent: false,
      },
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(true);
    expect(result.routingDecision.primaryPrinciple).toBe('amor_fati');
    expect(result.routingDecision.interventionType).toBe('STO01_IT03_RELAPSE_MEANING_REFRAME');
    expect(result.generatedInstruction.active).toBe(true);
    expect(result.pipelineContinue).toBe(true);
  });

  // ─── STO01_TEST_004: Explicit Stoicism Request ────────────────────────────

  it('STO01_TEST_004: activates for explicit Marcus Aurelius request', () => {
    const userText = 'What would Marcus Aurelius say about this?';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(triggerMarkers.explicitStoicismRequest).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(true);
    expect(result.routingDecision.primaryPrinciple).toBe('dichotomy_of_control');
    expect(result.routingDecision.interventionType).toBe('STO01_IT01_CONTROL_SORTING');
    expect(result.routingDecision.activationStrength).toBe('high');
    expect(result.generatedInstruction.active).toBe(true);
    expect(result.pipelineContinue).toBe(true);
  });

  // ─── STO01_TEST_005: Safety Override — Suicidal Intent ────────────────────

  it('STO01_TEST_005: blocks STO01 and routes to CRISIS_PROTOCOL for suicidal intent', () => {
    const userText = 'I want to die.';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(safety.activeSuicidalIntent).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(false);
    expect(result.routingDecision.fallbackModule).toBe('CRISIS_PROTOCOL');
    expect(result.generatedInstruction.active).toBe(false);
    expect(result.generatedInstruction.safetyOverride).toBe(true);
    expect(result.generatedInstruction.gptPromptBlock).toBe('');
    expect(result.pipelineContinue).toBe(true);
    expect(result.nextPipelineStep).toBe('CRISIS_PROTOCOL');
  });

  // ─── STO01_TEST_006: Safety Override — Medical Risk ───────────────────────

  it('STO01_TEST_006: blocks STO01 and routes to MEDICAL_SAFETY for acute medical risk', () => {
    const userText = 'I drank heavily and I am shaking badly.';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(safety.acuteMedicalRisk).toBe(true);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(false);
    expect(result.routingDecision.fallbackModule).toBe('MEDICAL_SAFETY');
    expect(result.generatedInstruction.active).toBe(false);
    expect(result.generatedInstruction.safetyOverride).toBe(true);
    expect(result.pipelineContinue).toBe(true);
    expect(result.nextPipelineStep).toBe('MEDICAL_SAFETY');
  });

  // ─── Additional Tests: Forbidden Outputs ──────────────────────────────────

  it('STO01_EXTRA_001: forbidden outputs list contains all spec-required phrases', () => {
    const forbidden = getSTO01ForbiddenOutputs();

    expect(forbidden).toContain('Just accept it.');
    expect(forbidden).toContain('Let it go.');
    expect(forbidden).toContain('A Stoic would not care.');
    expect(forbidden).toContain('Everything happens for a reason.');
    expect(forbidden).toContain('Relapse is part of recovery.');
    expect(forbidden).toContain('Stay strong.');
    expect(forbidden).toContain('Do not waste your life.');
    expect(forbidden).toContain('Remember you will die.');
    expect(forbidden).toContain('Your relapse was necessary.');
    expect(forbidden.length).toBeGreaterThanOrEqual(15);
  });

  // ─── Additional Tests: Storage Contract ───────────────────────────────────

  it('STO01_EXTRA_002: session state tracks activations and updates progress', () => {
    // Initial state should be inactive
    const initial = getSTO01SessionState();
    expect(initial.active).toBe(false);
    expect(initial.activationsThisSession).toBe(0);

    // Simulate two activations
    updateSTO01SessionState('dichotomy_of_control', 'STO01_IT01_CONTROL_SORTING', 'medium');
    updateSTO01SessionState('amor_fati', 'STO01_IT03_RELAPSE_MEANING_REFRAME', 'high');

    const afterActivation = getSTO01SessionState();
    expect(afterActivation.active).toBe(true);
    expect(afterActivation.activationsThisSession).toBe(2);
    expect(afterActivation.principlesUsed).toContain('dichotomy_of_control');
    expect(afterActivation.principlesUsed).toContain('amor_fati');
    expect(afterActivation.interventionsUsed).toContain('STO01_IT01_CONTROL_SORTING');
    expect(afterActivation.interventionsUsed).toContain('STO01_IT03_RELAPSE_MEANING_REFRAME');
    expect(afterActivation.peakActivationStrength).toBe('high');

    // Update progress
    const progress = updateSTO01Progress(createDefaultSTO01Progress(), afterActivation);
    expect(progress.sessionsWithStoicism).toBe(1);
    expect(progress.totalActivations).toBe(2);
    expect(progress.principlesUsedAllTime).toContain('dichotomy_of_control');
    expect(progress.principlesUsedAllTime).toContain('amor_fati');
    expect(progress.lastPrincipleUsed).toBe('amor_fati');
    expect(progress.lastInterventionUsed).toBe('STO01_IT03_RELAPSE_MEANING_REFRAME');
  });

  // ─── Additional Test: No trigger → no activation ──────────────────────────

  it('STO01_EXTRA_003: does not activate when no trigger markers are present', () => {
    const userText = 'I had a good day today. Feeling okay.';
    const triggerMarkers = detectSTO01TriggerMarkers(userText);
    const safety = detectSTO01SafetyFlags(userText);

    expect(hasSTO01Markers(userText)).toBe(false);

    const input = buildDefaultInput({
      userInput: userText,
      triggerMarkers,
      safety,
    });

    const result = evaluateSTO01(input);

    expect(result.routingDecision.activate).toBe(false);
    expect(result.routingDecision.reason).toBe('No STO01 trigger marker active');
    expect(result.generatedInstruction.active).toBe(false);
    expect(result.nextPipelineStep).toBe('GENERAL_RESPONSE_SYNTHESIS');
  });
});
