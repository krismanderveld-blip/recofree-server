/**
 * Tests proving relationalHarmPatternActive is wired to detectRelationalSignals
 * and that legacy proxy uses store:false via generateAIResponse.
 */
import { describe, it, expect } from 'vitest';
import { detectRelationalSignals } from '@/lib/engine/kim/relational-stance-filter';
import * as fs from 'fs';
import * as path from 'path';

describe('Relational Harm Pattern Wiring', () => {
  it('detectRelationalSignals returns relationalHarmPatternSignal for repeated betrayal', () => {
    const signals = detectRelationalSignals('hij heeft al meerdere keren gelogen en bedrogen, telkens opnieuw');
    expect(signals.relationalHarmPatternSignal).toBe(true);
    expect(signals.repeatedBetrayalSignal).toBe(true);
  });

  it('detectRelationalSignals returns false for normal relational tension', () => {
    const signals = detectRelationalSignals('we hadden een discussie over het huishouden');
    expect(signals.relationalHarmPatternSignal).toBe(false);
  });

  it('detectRelationalSignals returns relationalHarmPatternSignal for chronic trust damage', () => {
    const signals = detectRelationalSignals('mijn vertrouwen kapot, steeds opnieuw hetzelfde patroon');
    expect(signals.chronicTrustDamageSignal).toBe(true);
    expect(signals.relationalHarmPatternSignal).toBe(true);
  });

  it('pipeline.ts no longer has hardcoded isHarm = false', () => {
    const pipelineCode = fs.readFileSync(
      path.join(__dirname, '../../lib/rugzak/pipeline.ts'),
      'utf-8'
    );
    // The old TODO line should be gone
    expect(pipelineCode).not.toContain('const isHarm = false; // TODO');
    // The new wiring should be present
    expect(pipelineCode).toContain('relationalHarmPatternSignal');
  });
});

describe('Legacy Proxy store:false', () => {
  it('generateAIResponse in ai-chat.ts uses store:false', () => {
    const aiChatCode = fs.readFileSync(
      path.join(__dirname, '../../server/ai-chat.ts'),
      'utf-8'
    );
    // Must contain store: false in the OpenAI call
    expect(aiChatCode).toContain('store: false');
  });

  it('legacy gpt-proxy calls generateAIResponse (which has store:false)', () => {
    const proxyCode = fs.readFileSync(
      path.join(__dirname, '../../server/gpt-proxy.ts'),
      'utf-8'
    );
    expect(proxyCode).toContain('generateAIResponse');
  });
});
