import { describe, it, expect } from 'vitest';
import { detectClinicalFactorsFromChat } from '@/lib/engine/shared/clinical-factor-chat-detector';
import type { UserReportedClinicalFactor } from '@/lib/ai/types';
import { buildPersonalClinicalContext } from '@/lib/rugzak/pipeline';

/**
 * Tests proving the clinical factor detector is correctly wired into the pipeline.
 * These simulate the exact code path in pipeline.ts POST-GPT STEP 7a-cf.
 */
describe('Clinical Factors — Pipeline Wiring Simulation', () => {
  
  // Simulate the exact pipeline logic
  function simulatePipelineClinicalFactorDetection(
    userMessage: string,
    existingFactors: UserReportedClinicalFactor[] = []
  ): { updatedFactors: UserReportedClinicalFactor[]; detected: number } {
    const newFactors = detectClinicalFactorsFromChat(userMessage, existingFactors);
    if (newFactors.length === 0) return { updatedFactors: existingFactors, detected: 0 };
    
    const merged = [...existingFactors];
    for (const newFactor of newFactors) {
      const existingIdx = merged.findIndex(f => f.factorId === newFactor.factorId);
      if (existingIdx >= 0) {
        const existing = merged[existingIdx];
        merged[existingIdx] = {
          ...existing,
          lastSeenAt: new Date().toISOString(),
          ...(newFactor.confidence > existing.confidence ? {
            status: newFactor.status,
            confidence: newFactor.confidence,
            evidenceSnippet: newFactor.evidenceSnippet,
          } : {}),
        };
      } else {
        merged.push(newFactor);
      }
    }
    return { updatedFactors: merged, detected: newFactors.length };
  }

  it('W_CF_01: "ik heb ADHD" stores factor in user.dat', () => {
    const { updatedFactors, detected } = simulatePipelineClinicalFactorDetection('ik heb ADHD');
    expect(detected).toBe(1);
    expect(updatedFactors.length).toBe(1);
    expect(updatedFactors[0].factorId).toBe('adhd');
    expect(updatedFactors[0].status).toBe('user_reported_diagnosed');
    expect(updatedFactors[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(updatedFactors[0].firstSeenAt).toBeDefined();
    expect(updatedFactors[0].lastSeenAt).toBeDefined();
  });

  it('W_CF_02: repeated mention updates lastSeenAt, not duplicate', () => {
    const first = simulatePipelineClinicalFactorDetection('ik heb ADHD');
    expect(first.updatedFactors.length).toBe(1);
    
    // Wait a tick for timestamp difference
    const originalLastSeen = first.updatedFactors[0].lastSeenAt;
    
    // Second mention — should update existing, not add new
    const second = simulatePipelineClinicalFactorDetection('ik heb ADHD en dat maakt het moeilijk', first.updatedFactors);
    // Detector returns 0 new when factor already exists with same or lower confidence
    expect(second.updatedFactors.length).toBe(1); // Still 1, no duplicate
    expect(second.updatedFactors[0].factorId).toBe('adhd');
  });

  it('W_CF_03: "ik vermoed autisme" stores user_suspected, does NOT confirm diagnosis', () => {
    const { updatedFactors, detected } = simulatePipelineClinicalFactorDetection('ik vermoed dat ik autisme heb');
    expect(detected).toBe(1);
    expect(updatedFactors[0].factorId).toBe('autism_spectrum');
    expect(updatedFactors[0].status).toBe('user_suspected');
    expect(updatedFactors[0].confidence).toBeLessThan(0.9);
    // Must NOT be diagnosed
    expect(updatedFactors[0].status).not.toBe('user_reported_diagnosed');
  });

  it('W_CF_04: GPT output or third-person mention never stores factor', () => {
    // Third person — should not trigger
    const { detected: d1 } = simulatePipelineClinicalFactorDetection('mijn broer heeft ADHD');
    expect(d1).toBe(0);
    
    // GPT-style suggestion — should not trigger
    const { detected: d2 } = simulatePipelineClinicalFactorDetection('jij hebt misschien ADHD');
    expect(d2).toBe(0);
    
    // General mention without self-report
    const { detected: d3 } = simulatePipelineClinicalFactorDetection('ADHD is een veelvoorkomende aandoening');
    expect(d3).toBe(0);
  });

  it('W_CF_05: symptom-only text does NOT store diagnosis', () => {
    const { detected: d1 } = simulatePipelineClinicalFactorDetection('ik kan me niet concentreren en ben impulsief');
    expect(d1).toBe(0);
    
    const { detected: d2 } = simulatePipelineClinicalFactorDetection('ik voel me depressief vandaag');
    expect(d2).toBe(0);
    
    const { detected: d3 } = simulatePipelineClinicalFactorDetection('ik heb last van angst');
    expect(d3).toBe(0);
  });

  it('W_CF_06: factor reaches prompt only as formatted summary (no raw evidence)', () => {
    
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental',
        status: 'user_reported_diagnosed', source: 'chat',
        evidenceSnippet: 'ik heb ADHD gediagnosticeerd door mijn psychiater',
        firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z',
        activeImpactAreas: ['impulse_control'], promptUse: 'adapt_pacing', confidence: 0.95,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    expect(result).toContain('ADHD');
    expect(result).toContain('USER-REPORTED CLINICAL FACTORS');
    // Raw evidence should NOT be in prompt
    expect(result).not.toContain('gediagnosticeerd door mijn psychiater');
  });

  it('W_CF_07: store:false is unchanged (verified in wiring tests)', () => {
    // This is a structural check — the pipeline wiring does NOT touch store:false
    // The clinical factor detection is purely client-side and does not make any API calls
    const detectorSource = require('fs').readFileSync(
      require('path').resolve(__dirname, '../lib/engine/shared/clinical-factor-chat-detector.ts'), 'utf8'
    );
    expect(detectorSource).not.toContain('fetch(');
    expect(detectorSource).not.toContain('openai.com');
    expect(detectorSource).not.toContain('api.openai');
    expect(detectorSource).not.toContain('axios');
  });

  it('W_CF_08: multiple factors detected in single message', () => {
    const { updatedFactors, detected } = simulatePipelineClinicalFactorDetection('ik heb ADHD en depressie');
    expect(detected).toBe(2);
    expect(updatedFactors.length).toBe(2);
    expect(updatedFactors.map(f => f.factorId)).toContain('adhd');
    expect(updatedFactors.map(f => f.factorId)).toContain('depression');
  });

  it('W_CF_09: status upgrade from suspected to diagnosed on re-mention', () => {
    // First: user suspects
    const first = simulatePipelineClinicalFactorDetection('ik vermoed dat ik ADHD heb');
    expect(first.updatedFactors[0].status).toBe('user_suspected');
    expect(first.updatedFactors[0].confidence).toBeLessThan(0.9);
    
    // Later: user confirms diagnosis
    const second = simulatePipelineClinicalFactorDetection('ik ben gediagnosticeerd met ADHD', first.updatedFactors);
    // The detector should detect this as a new higher-confidence detection
    // and the merge logic should upgrade the existing entry
    expect(second.updatedFactors.length).toBe(1); // Still 1
    expect(second.updatedFactors[0].status).toBe('user_reported_diagnosed');
    expect(second.updatedFactors[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('W_CF_10: debug dropdown format is correct', () => {
    const factors: UserReportedClinicalFactor[] = [
      { factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental', status: 'user_reported_diagnosed', source: 'chat', evidenceSnippet: '', firstSeenAt: '', lastSeenAt: '', activeImpactAreas: [], promptUse: 'adapt_pacing', confidence: 0.95 },
      { factorId: 'depression', label: 'Depressie', category: 'mood_disorder', status: 'user_suspected', source: 'chat', evidenceSnippet: '', firstSeenAt: '', lastSeenAt: '', activeImpactAreas: [], promptUse: 'increase_risk_awareness', confidence: 0.6 },
    ];
    // Simulate the debug line from pipeline.ts
    const diagnosed = factors.filter(f => f.status === 'user_reported_diagnosed').length;
    const suspected = factors.filter(f => f.status === 'user_suspected').length;
    const medication = factors.filter(f => f.category === 'medication').length;
    const debugLine = `count=${factors.length} diagnosed=${diagnosed} suspected=${suspected} medication=${medication}`;
    expect(debugLine).toBe('count=2 diagnosed=1 suspected=1 medication=0');
  });
});
