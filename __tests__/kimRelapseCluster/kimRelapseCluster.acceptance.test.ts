/**
 * Kim Relapse Cluster — 20 Acceptance Tests
 * Tests: HERV-K01, NAHERV-K01, CRISIS-K01
 * Corrected Belgian crisis numbers (0800 32 123, NOT 1813).
 */
import { describe, it, expect } from 'vitest';
import {
  detectKimRelapseClusterModule,
  scanMarkers,
  routeKimRelapseCluster,
  buildRuntimeInput,
  filterKimRelapseClusterOutput,
  BELGIAN_CRISIS_NUMBERS,
} from '../../modules/kim/relapseCluster';
import type {
  KimRelapseClusterRuntimeInput,
} from '../../modules/kim/relapseCluster';

// Helper to build a minimal Kim runtime input
function kimInput(
  message: string,
  overrides?: Partial<KimRelapseClusterRuntimeInput>
): KimRelapseClusterRuntimeInput {
  const normalizedMessage = message.toLowerCase().trim();
  return {
    persona: 'kim',
    language: 'nl',
    userMessage: message,
    normalizedMessage,
    timestampIso: '2026-06-15T12:00:00.000Z',
    sessionId: 'test-session',
    turnId: 'test-turn-1',
    storePolicy: 'store:false',
    detectedMarkers: scanMarkers(normalizedMessage),
    caregiverState: 'distressed',
    safetyRiskLevel: 'NONE',
    vspZone: 'GROEN',
    explicitAcuteDanger: false,
    explicitSelfHarmRiskLovedOne: false,
    explicitSelfHarmRiskCaregiver: false,
    explicitViolenceRisk: false,
    explicitMedicalEmergency: false,
    explicitDisappearance: false,
    explicitImpairedDrivingRisk: false,
    explicitChildSafetyRisk: false,
    ...overrides,
  };
}

describe('Kim Relapse Cluster — Acceptance Tests', () => {
  // ============================================================
  // TEST 1: HERV-K01 activates on "hij heeft weer gedronken"
  // ============================================================
  it('TEST 1: HERV-K01 activates on active relapse NL', () => {
    const input = kimInput('hij heeft weer gedronken');
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('HERV-K01');
    expect(result.phase).toBe('ACTIVE_RELAPSE_NOW');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  // ============================================================
  // TEST 2: HERV-K01 activates on "she is drinking again" (EN)
  // ============================================================
  it('TEST 2: HERV-K01 activates on active relapse EN', () => {
    const input = kimInput('she is drinking again', { language: 'en' });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('HERV-K01');
    expect(result.phase).toBe('ACTIVE_RELAPSE_NOW');
  });

  // ============================================================
  // TEST 3: HERV-K01 activates on "il a encore bu" (FR)
  // ============================================================
  it('TEST 3: HERV-K01 activates on active relapse FR', () => {
    const input = kimInput('il a encore bu', { language: 'fr' });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('HERV-K01');
    expect(result.phase).toBe('ACTIVE_RELAPSE_NOW');
  });

  // ============================================================
  // TEST 4: NAHERV-K01 activates on "hij is hervallen"
  // ============================================================
  it('TEST 4: NAHERV-K01 activates on post-relapse NL', () => {
    const input = kimInput('hij is hervallen');
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('NAHERV-K01');
    expect(result.phase).toBe('POST_RELAPSE_AFTERSHOCK');
  });

  // ============================================================
  // TEST 5: NAHERV-K01 activates on aftercare conversation
  // ============================================================
  it('TEST 5: NAHERV-K01 activates on aftercare conversation request', () => {
    const input = kimInput('hoe praat ik hierover');
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('NAHERV-K01');
    expect(result.matchedMarkers.some(m => m.markerType === 'aftercare_conversation')).toBe(true);
  });

  // ============================================================
  // TEST 6: CRISIS-K01 activates on violence
  // ============================================================
  it('TEST 6: CRISIS-K01 activates on violence', () => {
    const input = kimInput('hij slaat');
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('CRISIS-K01');
    expect(result.safetyRiskLevel).not.toBe('NONE');
  });

  // ============================================================
  // TEST 7: CRISIS-K01 activates on disappearance
  // ============================================================
  it('TEST 7: CRISIS-K01 activates on disappearance', () => {
    const input = kimInput('hij is verdwenen');
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('CRISIS-K01');
    expect(result.matchedMarkers.some(m => m.markerType === 'disappearance')).toBe(true);
  });

  // ============================================================
  // TEST 8: Suicide risk → routes to 0800 32 123 (NOT 1813)
  // ============================================================
  it('TEST 8: Suicide risk routes to 0800 32 123 (corrected, not 1813)', () => {
    const input = kimInput('hij wil zichzelf iets aandoen', {
      explicitSelfHarmRiskLovedOne: true,
    });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('CRISIS-K01');
    expect(result.crisisEscalationRoute).toBe('CALL_0800_32_123');
    // Verify the number is correct
    expect(BELGIAN_CRISIS_NUMBERS.suicideLine080032123).toBe('0800 32 123');
  });

  // ============================================================
  // TEST 9: Medical emergency → routes to 112 (NOT 1813)
  // ============================================================
  it('TEST 9: Medical emergency routes to 112', () => {
    const input = kimInput('hij is bewusteloos', {
      explicitMedicalEmergency: true,
    });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('CRISIS-K01');
    expect(result.crisisEscalationRoute).toBe('CALL_112');
  });

  // ============================================================
  // TEST 10: Violence + unsafe → routes to 112
  // ============================================================
  it('TEST 10: Violence with unsafe caregiver routes to 112', () => {
    const input = kimInput('hij is agressief', {
      explicitViolenceRisk: true,
      caregiverState: 'unsafe',
    });
    const result = detectKimRelapseClusterModule(input);
    expect(result.crisisEscalationRoute).toBe('CALL_112');
  });

  // ============================================================
  // TEST 11: Persona separation — "hij heeft weer gedronken" in ELIAS → NO_MODULE
  // ============================================================
  it('TEST 11: Elias persona does NOT activate Kim relapse cluster', () => {
    const input = kimInput('hij heeft weer gedronken', { persona: 'elias' });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBeNull();
    expect(result.routeNext).toBe('NO_MODULE');
    expect(result.reason).toContain('Kim-only');
  });

  // ============================================================
  // TEST 12: "ik wil gebruiken" in Kim → NOT routed as naaste-herval
  // ============================================================
  it('TEST 12: First-person "ik wil gebruiken" in Kim does NOT activate relapse cluster', () => {
    const input = kimInput('ik wil gebruiken');
    const result = detectKimRelapseClusterModule(input);
    // "ik wil gebruiken" is first-person (Elias relapse-intent), not third-person (Kim)
    expect(result.selectedModuleId).toBeNull();
  });

  // ============================================================
  // TEST 13: CRISIS overrides HERV
  // ============================================================
  it('TEST 13: CRISIS-K01 overrides HERV-K01 when both markers present', () => {
    const input = kimInput('hij is weer aan het drinken en hij slaat mij', {
      explicitViolenceRisk: true,
    });
    const result = detectKimRelapseClusterModule(input);
    expect(result.selectedModuleId).toBe('CRISIS-K01');
  });

  // ============================================================
  // TEST 14: Memory patch writes to Kim-scoped user.dat
  // ============================================================
  it('TEST 14: Memory patch is Kim-scoped (persona: kim)', () => {
    const input = kimInput('hij heeft weer gedronken');
    const routerOutput = routeKimRelapseCluster(input);
    expect(routerOutput.memoryPatch).not.toBeNull();
    expect(routerOutput.memoryPatch!.persona).toBe('kim');
    expect(routerOutput.memoryPatch!.moduleId).toBe('HERV-K01');
  });

  // ============================================================
  // TEST 15: Memory patch writes to logs.dat with correct event type
  // ============================================================
  it('TEST 15: Memory patch includes logs.dat event', () => {
    const input = kimInput('hij is hervallen');
    const routerOutput = routeKimRelapseCluster(input);
    expect(routerOutput.memoryPatch!.logsDatPatch).toBeDefined();
    expect(routerOutput.memoryPatch!.logsDatPatch!.eventType).toBe('KIM_RELAPSE_CLUSTER_EVENT');
    expect(routerOutput.memoryPatch!.logsDatPatch!.selectedModuleId).toBe('NAHERV-K01');
  });

  // ============================================================
  // TEST 16: Output safety filter blocks rescue language
  // ============================================================
  it('TEST 16: Safety filter blocks rescue language', () => {
    const output = 'Je moet hem redden. Alleen jij kunt hem helpen.';
    const result = filterKimRelapseClusterOutput(output);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category === 'rescue')).toBe(true);
  });

  // ============================================================
  // TEST 17: Output safety filter blocks control language
  // ============================================================
  it('TEST 17: Safety filter blocks control language', () => {
    const output = 'Verstop de drank zodat hij er niet bij kan.';
    const result = filterKimRelapseClusterOutput(output);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category === 'control')).toBe(true);
  });

  // ============================================================
  // TEST 18: Output safety filter blocks wrong number 1813
  // ============================================================
  it('TEST 18: Safety filter blocks wrong number 1813', () => {
    const output = 'Bel 1813 voor hulp.';
    const result = filterKimRelapseClusterOutput(output);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.ruleId === 'wrong_number_1813')).toBe(true);
  });

  // ============================================================
  // TEST 19: Output safety filter passes valid therapeutic output
  // ============================================================
  it('TEST 19: Safety filter passes valid therapeutic output', () => {
    const output = 'Ik hoor dat dit zwaar is. Ben jij nu veilig? Wat heb jij nu nodig?';
    const result = filterKimRelapseClusterOutput(output);
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  // ============================================================
  // TEST 20: store:false on all GPT payloads
  // ============================================================
  it('TEST 20: All prompt payloads have store:false', () => {
    // HERV-K01
    const hervInput = kimInput('hij heeft weer gedronken');
    const hervOutput = routeKimRelapseCluster(hervInput);
    expect(hervOutput.promptPayload!.storePolicy).toBe('store:false');
    expect(hervOutput.promptPayload!.gptInstruction).toContain('store:false');

    // NAHERV-K01
    const nahervInput = kimInput('hij is hervallen');
    const nahervOutput = routeKimRelapseCluster(nahervInput);
    expect(nahervOutput.promptPayload!.storePolicy).toBe('store:false');
    expect(nahervOutput.promptPayload!.gptInstruction).toContain('store:false');

    // CRISIS-K01
    const crisisInput = kimInput('hij slaat', { explicitViolenceRisk: true });
    const crisisOutput = routeKimRelapseCluster(crisisInput);
    expect(crisisOutput.promptPayload!.storePolicy).toBe('store:false');
    expect(crisisOutput.promptPayload!.gptInstruction).toContain('store:false');
  });
});
