/**
 * Test: Dutch crisis keyword detection in state-analyzer and crisis detector
 */
import { describe, it, expect } from 'vitest';
import { detectInputSignals } from '../lib/rugzak/state-analyzer';

describe('Dutch crisis signal detection', () => {
  it('detects "ik wil er niet meer zijn" as activeSuicidal', () => {
    const result = detectInputSignals('ik wil er niet meer zijn');
    expect(result.activeSuicidal).toBe(true);
  });

  it('detects "wil dood" as activeSuicidal', () => {
    const result = detectInputSignals('wil dood');
    expect(result.activeSuicidal).toBe(true);
  });

  it('detects "zelfmoord" as activeSuicidal', () => {
    const result = detectInputSignals('zelfmoord');
    expect(result.activeSuicidal).toBe(true);
  });

  it('detects "wil niet meer verder" as activeSuicidal', () => {
    const result = detectInputSignals('ik wil niet meer verder');
    expect(result.activeSuicidal).toBe(true);
  });

  it('detects "kan niet meer" as passiveSuicidal', () => {
    const result = detectInputSignals('ik kan niet meer');
    expect(result.passiveSuicidal).toBe(true);
  });

  it('detects "geen zin meer" as passiveSuicidal', () => {
    const result = detectInputSignals('geen zin meer in het leven');
    expect(result.passiveSuicidal).toBe(true);
  });

  it('detects "klaar met alles" as passiveSuicidal', () => {
    const result = detectInputSignals('ik ben klaar met alles');
    expect(result.passiveSuicidal).toBe(true);
  });

  it('detects "mezelf snijden" as selfHarm', () => {
    const result = detectInputSignals('ik wil mezelf snijden');
    expect(result.selfHarm).toBe(true);
  });

  it('detects "verdoofd" as dissociation', () => {
    const result = detectInputSignals('ik voel me verdoofd');
    expect(result.dissociation).toBe(true);
  });

  it('detects "terugval" as cravingMention', () => {
    const result = detectInputSignals('ik heb een terugval gehad');
    expect(result.cravingMention).toBe(true);
  });

  it('does NOT trigger on normal Dutch text', () => {
    const result = detectInputSignals('vandaag was een goede dag');
    expect(result.activeSuicidal).toBe(false);
    expect(result.passiveSuicidal).toBe(false);
    expect(result.selfHarm).toBe(false);
    expect(result.positiveSignal).toBe(true);
  });
});
