/**
 * Verification tests for Bug 1 + Bug 2 fixes:
 * - Schema detector picks up Dutch markers
 * - Mode detector picks up Dutch markers
 * - GptSignalEngine initializes correctly (replaces NullSignalEngine)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { detectSchemaCandidates } from '@/lib/engine/shared/schema-detector';
import { detectModeCandidates } from '@/lib/engine/shared/mode-detector';
import { initGptSignalEngine, getEngine, resetEngine } from '@/lib/engine/local-llm/engine-provider';
import { NullSignalEngine } from '@/lib/engine/local-llm/null-engine';
import type { SchemaModeDetectionInput } from '@/lib/engine/shared/schema-mode-types';

function makeInput(message: string, userType: 'elias' | 'kim' = 'elias'): SchemaModeDetectionInput {
  return {
    message,
    userType,
    sliders: {},
    zoneColor: 'GREEN',
    isCrisis: false,
    schemaTendencies: [],
    modeTendencies: [],
    activeProjections: [],
    sessionHistory: [],
  };
}

describe('Schema Detector — Dutch markers', () => {
  it('detects ABANDONMENT_INSTABILITY from Dutch input', () => {
    const input = makeInput('ik ga ze verliezen, niemand blijft bij mij');
    const candidates = detectSchemaCandidates(input);
    const found = candidates.find(c => c.schemaId === 'ABANDONMENT_INSTABILITY');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects DEFECTIVENESS_SHAME from Dutch input', () => {
    const input = makeInput('ik ben waardeloos en ik deug niet');
    const candidates = detectSchemaCandidates(input);
    const found = candidates.find(c => c.schemaId === 'DEFECTIVENESS_SHAME');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects INSUFFICIENT_SELF_CONTROL from Dutch input', () => {
    const input = makeInput('ik kan mezelf niet controleren, ik heb geen wilskracht');
    const candidates = detectSchemaCandidates(input);
    const found = candidates.find(c => c.schemaId === 'INSUFFICIENT_SELF_CONTROL');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects SELF_SACRIFICE from Dutch input (Kim user)', () => {
    const input = makeInput('ik zet altijd anderen op de eerste plaats, ik geef tot ik leeg ben', 'kim');
    const candidates = detectSchemaCandidates(input);
    const found = candidates.find(c => c.schemaId === 'SELF_SACRIFICE');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects PUNITIVENESS from Dutch input', () => {
    const input = makeInput('ik verdien straf, fouten moeten bestraft worden');
    const candidates = detectSchemaCandidates(input);
    const found = candidates.find(c => c.schemaId === 'PUNITIVENESS');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });
});

describe('Mode Detector — Dutch markers', () => {
  it('detects VULNERABLE_CHILD from Dutch input', () => {
    const input = makeInput('ik voel me kwetsbaar en ik ben zo bang');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'VULNERABLE_CHILD');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects RELAPSE_SEEKING from Dutch input', () => {
    const input = makeInput('ik wil gebruiken, ik verlang er zo naar');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'RELAPSE_SEEKING');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects PUNITIVE_PARENT from Dutch input', () => {
    const input = makeInput('ik haat mezelf, ik ben waardeloos, ik verpest alles');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'PUNITIVE_PARENT');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects RESCUE_MODE from Dutch input (Kim user)', () => {
    const input = makeInput('ik moet ze redden, ze hebben me nodig', 'kim');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'RESCUE_MODE');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects EXHAUSTED_CAREGIVER from Dutch input (Kim user)', () => {
    const input = makeInput('ik ben leeg, ik ben uitgeput, ik verlies mezelf', 'kim');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'EXHAUSTED_CAREGIVER');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects CRISIS_COLLAPSE from Dutch input', () => {
    const input = makeInput('ik kan niet meer, alles valt uit elkaar');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'CRISIS_COLLAPSE');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects RELAPSE_JUSTIFYING from Dutch input', () => {
    const input = makeInput('maar één keer, het is niet zo erg, iedereen doet het');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'RELAPSE_JUSTIFYING');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });

  it('detects MORAL_INJURY from Dutch input (Kim user)', () => {
    const input = makeInput('ik haat wie ik geworden ben, ik heb mezelf verraden', 'kim');
    const candidates = detectModeCandidates(input);
    const found = candidates.find(c => c.modeId === 'MORAL_INJURY');
    expect(found).toBeDefined();
    expect(found!.confidence).toBeGreaterThan(0);
  });
});

describe('GptSignalEngine initialization (Bug 2)', () => {
  beforeEach(() => {
    resetEngine();
  });

  it('starts with NullSignalEngine by default', () => {
    const engine = getEngine();
    expect(engine).toBeInstanceOf(NullSignalEngine);
  });

  it('switches to GptSignalEngine after initGptSignalEngine()', () => {
    initGptSignalEngine('http://localhost:3000');
    const engine = getEngine();
    // After init, engine should NOT be NullSignalEngine
    expect(engine).not.toBeInstanceOf(NullSignalEngine);
    // It should have detectSignals method
    expect(typeof engine.detectSignals).toBe('function');
  });

  it('GptSignalEngine returns empty signals on network error (graceful fallback)', async () => {
    initGptSignalEngine('http://localhost:9999'); // non-existent server
    const engine = getEngine();
    // Without a real server, detectSignals should catch error and return EMPTY_SIGNALS
    const signals = await engine.detectSignals('test message');
    expect(signals).toBeDefined();
    expect(signals.fears).toEqual([]);
    expect(signals.hopes).toEqual([]);
    expect(signals.goals).toEqual([]);
    expect(signals.triggers).toEqual([]);
  });
});
