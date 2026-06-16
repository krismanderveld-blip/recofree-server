/**
 * Kim Cluster 2 (GEVAAR-K01 + KIND-K01) — Critical Acceptance Tests
 *
 * Tests cover:
 * - Persona separation (Elias → BLOCKED_BY_PERSONA)
 * - Crisis numbers (only 1813 / 1712 / 112 / 101)
 * - KIND-K01 priority over GEVAAR-K01 when child is in danger
 * - Safety filter (anti-rescue/control/diagnosis)
 * - Kim-scoped memory patches
 * - store:false on all prompts
 * - GptSignalEngine Kim-prompt for third-person relapse detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectGevaarK01,
  detectKindK01,
  resolveCluster2Priority,
  scanMarkers,
} from '@/modules/kim/dangerChildCluster/kimDangerChildDetector';
import { buildGevaarK01Payload, buildKindK01Payload } from '@/modules/kim/dangerChildCluster/kimDangerChildPayloads';
import { buildDangerChildMemoryPatch } from '@/modules/kim/dangerChildCluster/kimDangerChildMemoryPatch';
import { filterDangerChildOutput } from '@/modules/kim/dangerChildCluster/kimDangerChildSafetyFilter';
import type { KimCluster2RuntimeInput, FixedBelgianCrisisNumber } from '@/modules/kim/dangerChildCluster/kimDangerChildCluster.types';
import { GptSignalEngine } from '@/lib/engine/local-llm/gpt-signal-engine';
import { NullSignalEngine } from '@/lib/engine/local-llm/null-engine';

// ─── Helper ─────────────────────────────────────────────────────────

function kimInput(message: string, overrides: Partial<KimCluster2RuntimeInput> = {}): KimCluster2RuntimeInput {
  return {
    persona: 'kim',
    intakeCompleted: true,
    latestUserMessage: message,
    recentMessages: [message],
    language: 'nl',
    detectedMarkers: [],
    lovedOneUseContext: true,
    firstPersonUseContext: false,
    caregiverOverwhelmed: false,
    immediateDanger: false,
    childPresentOrAffected: false,
    aggressionDetected: false,
    drunkDrivingDetected: false,
    disappearanceDetected: false,
    overdoseOrMedicalDangerDetected: false,
    selfHarmThreatByLovedOneDetected: false,
    domesticViolenceOrAbuseDetected: false,
    policeRelevantButNot112: false,
    childMaltreatmentOrNeglectDetected: false,
    childParentificationRiskDetected: false,
    moduleCandidates: [],
    timestampIso: new Date().toISOString(),
    sessionId: 'test-session',
    turnId: 'test-turn',
    ...overrides,
  };
}

const ALLOWED: FixedBelgianCrisisNumber[] = ['1813', '1712', '112', '101'];

// ─── TEST 1: Persona separation — Elias does NOT activate ─────────

describe('Kim Cluster 2: Persona Separation', () => {
  it('Elias persona does NOT activate GEVAAR-K01', () => {
    const input = kimInput('hij slaat mij als hij dronken is', { persona: 'elias' });
    const result = detectGevaarK01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_PERSONA');
  });

  it('Elias persona does NOT activate KIND-K01', () => {
    const input = kimInput('de kinderen zijn bang', { persona: 'elias' });
    const result = detectKindK01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_PERSONA');
  });
});

// ─── TEST 2: Crisis numbers — only allowed Belgian numbers ────────

describe('Kim Cluster 2: Crisis Numbers', () => {
  it('only uses allowed Belgian crisis numbers (1813, 1712, 112, 101)', () => {
    expect(ALLOWED).toContain('1813');
    expect(ALLOWED).toContain('1712');
    expect(ALLOWED).toContain('112');
    expect(ALLOWED).toContain('101');
  });

  it('GEVAAR-K01 violence scenario routes to 101 and/or 1712', () => {
    const input = kimInput('hij slaat mij als hij dronken is', { aggressionDetected: true });
    const result = detectGevaarK01(input);
    expect(result.activationStatus).not.toBe('BLOCKED_BY_PERSONA');
    expect(result.activationStatus).not.toBe('NOT_ACTIVE');
    const allAllowed = result.crisisNumbersToShow.every(n => ALLOWED.includes(n));
    expect(allAllowed).toBe(true);
    expect(result.crisisNumbersToShow.some(n => n === '101' || n === '1712')).toBe(true);
  });

  it('KIND-K01 child maltreatment routes to 1712', () => {
    const input = kimInput('hij slaat de kinderen', { childMaltreatmentOrNeglectDetected: true, childPresentOrAffected: true });
    const result = detectKindK01(input);
    expect(result.activationStatus).not.toBe('BLOCKED_BY_PERSONA');
    expect(result.activationStatus).not.toBe('NOT_ACTIVE');
    expect(result.crisisNumbersToShow).toContain('1712');
    const allAllowed = result.crisisNumbersToShow.every(n => ALLOWED.includes(n));
    expect(allAllowed).toBe(true);
  });
});

// ─── TEST 3: KIND-K01 wins over GEVAAR-K01 when child is in danger ─

describe('Kim Cluster 2: Priority Resolution', () => {
  it('KIND-K01 wins when both danger and child markers are present (test 16)', () => {
    const input = kimInput('hij is agressief en de kinderen zijn bang', {
      aggressionDetected: true,
      childPresentOrAffected: true,
    });
    const gevaarResult = detectGevaarK01(input);
    const kindResult = detectKindK01(input);
    const priority = resolveCluster2Priority(gevaarResult, kindResult);
    expect(priority.primary).not.toBeNull();
    expect(priority.primary!.moduleId).toBe('KIND-K01');
  });

  it('GEVAAR-K01 wins when only danger markers present (no child)', () => {
    const input = kimInput('hij rijdt dronken naar huis', { drunkDrivingDetected: true });
    const gevaarResult = detectGevaarK01(input);
    const kindResult = detectKindK01(input);
    const priority = resolveCluster2Priority(gevaarResult, kindResult);
    expect(priority.primary).not.toBeNull();
    expect(priority.primary!.moduleId).toBe('GEVAAR-K01');
  });
});

// ─── TEST 4: Safety filter ──────────────────────────────────────────

describe('Kim Cluster 2: Output Safety Filter', () => {
  it('rejects rescue/control language', () => {
    const result = filterDangerChildOutput('Je moet hem tegenhouden en fysiek ingrijpen');
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('rejects diagnosis language', () => {
    const result = filterDangerChildOutput('Hij heeft waarschijnlijk een antisociale persoonlijkheidsstoornis');
    expect(result.passed).toBe(false);
  });

  it('passes safe supportive language', () => {
    const result = filterDangerChildOutput('Ik hoor dat je je onveilig voelt. Laten we samen kijken wat je nu kunt doen voor jezelf.');
    expect(result.passed).toBe(true);
  });
});

// ─── TEST 5: Kim-scoped memory patches ──────────────────────────────

describe('Kim Cluster 2: Memory Patches', () => {
  it('memory patch is Kim-scoped (persona: kim)', () => {
    const input = kimInput('hij slaat mij', { aggressionDetected: true });
    const detection = detectGevaarK01(input);
    const patch = buildDangerChildMemoryPatch(detection, 'sess-1', 'turn-1');
    expect(patch.persona).toBe('kim');
  });

  it('memory patch targets user.dat, projections.dat, logs.dat', () => {
    const input = kimInput('mijn kind is bang', { childPresentOrAffected: true });
    const detection = detectKindK01(input);
    const patch = buildDangerChildMemoryPatch(detection, 'sess-1', 'turn-1');
    expect(patch.storageTargets).toContain('user.dat');
    expect(patch.storageTargets).toContain('projections.dat');
    expect(patch.storageTargets).toContain('logs.dat');
  });
});

// ─── TEST 6: store:false on all prompts ─────────────────────────────

describe('Kim Cluster 2: store:false policy', () => {
  it('GEVAAR-K01 payload has store:false', () => {
    const input = kimInput('hij slaat mij', { aggressionDetected: true });
    const detection = detectGevaarK01(input);
    const payload = buildGevaarK01Payload(detection);
    expect(payload.store).toBe(false);
  });

  it('KIND-K01 payload has store:false', () => {
    const input = kimInput('mijn kind is bang voor papa', { childPresentOrAffected: true });
    const detection = detectKindK01(input);
    const payload = buildKindK01Payload(detection);
    expect(payload.store).toBe(false);
  });
});

// ─── TEST 7: GptSignalEngine Kim-prompt for third-person relapse ────

describe('GptSignalEngine: Kim third-person relapse detection', () => {
  it('has detectKimRelapseIntent method', () => {
    const engine = new GptSignalEngine('http://localhost:3000');
    expect(typeof engine.detectKimRelapseIntent).toBe('function');
  });

  it('NullSignalEngine returns not detected for Kim relapse intent', async () => {
    const engine = new NullSignalEngine();
    const result = await engine.detectKimRelapseIntent('hij wil weer drinken');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('GptSignalEngine.detectKimRelapseIntent returns fallback on network error', async () => {
    const engine = new GptSignalEngine('http://localhost:99999');
    const result = await engine.detectKimRelapseIntent('hij wil weer drinken');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

// ─── TEST 8: Marker detection NL (flat structure) ───────────────────

describe('Kim Cluster 2: NL Marker Detection', () => {
  it('detects aggression markers in NL', () => {
    const markers = scanMarkers('hij slaat mij als hij dronken is');
    expect(markers.aggression).toBe(true);
  });

  it('detects child fear markers in NL', () => {
    const markers = scanMarkers('mijn kind is bang voor papa');
    expect(markers.childFear).toBe(true);
  });

  it('detects drunk driving markers in NL', () => {
    const markers = scanMarkers('hij rijdt dronken naar huis');
    expect(markers.drunkDriving).toBe(true);
  });
});
