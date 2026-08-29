import { describe, expect, it } from 'vitest';

import { getDeepAnalysisStoredTotals } from '@/lib/rugzak/manual-data-refresh';
import { normalizeClientNanoInterpretResult } from '@/lib/pipeline/nano-interpret-client';
import { selectRelevantClinicalContext } from '@/lib/engine/shared/clinical-context-relevance-selector';
import { buildClinicalMemoryDistillationRuntimeContext } from '@/lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-runtime';

describe('device runtime coherence regressions', () => {
  it('reads DeepAnalysis stored totals from the same canonical user.dat snapshot', () => {
    expect(getDeepAnalysisStoredTotals({
      schemas: [{ schema: 'a' }, { schema: 'b' }],
      modes: [{ mode: 'x' }],
      triggers: [{ trigger: 't1' }, { trigger: 't2' }, { trigger: 't3' }],
    })).toEqual({ totalSchemas: 2, totalModes: 1, totalTriggers: 3 });
  });

  it('drops autonomous_defense from pure craving without autonomy evidence', () => {
    const message = 'Ik heb craving en ik wil drinken, maar ik wil het eigenlijk niet doen.';
    const result = normalizeClientNanoInterpretResult({
      translatedNL: message,
      intent: 'seeking_action',
      themes: ['craving', 'autonomous_defense'],
      resolvedModule: 'E01',
      matchedTheme: 'craving',
    }, message, 'elias');

    expect(result.themes).toEqual(['craving']);
    expect(result.resolvedModule).toBe('E01');
  });

  it('drops anxiety, existential_void and fear_of_error from a medical question without evidence', () => {
    const message = 'Kan ik plots stoppen met zwaar drinken zonder dokter?';
    const result = normalizeClientNanoInterpretResult({
      translatedNL: message,
      intent: 'seeking_action',
      themes: ['anxiety', 'existential_void', 'fear_of_error'],
      resolvedModule: 'E02',
      matchedTheme: 'anxiety',
    }, message, 'elias');

    expect(result.themes).toEqual([]);
    expect(result.matchedTheme).toBeNull();
  });

  it('matches the direct Kim K05 boundary phrase instead of send-all fallback', () => {
    const message = 'Ik wil gewoon zeggen dat hij zijn plan moet trekken en dat ik er klaar mee ben.';
    const nano = normalizeClientNanoInterpretResult({
      translatedNL: message,
      intent: 'seeking_action',
      themes: [],
      resolvedModule: null,
      matchedTheme: null,
    }, message, 'kim');
    const relevance = selectRelevantClinicalContext(nano.themes, nano.intent, message);

    expect(nano.themes).toContain('boundary_statement');
    expect(nano.resolvedModule).toBe('K05');
    expect(relevance.reason).toBe('k05_boundary_direct');
    expect(relevance.relevantSchemas).toEqual([]);
    expect(relevance.relevantModes).toEqual([]);
  });

  it('turns Kim caregiverPatterns into persona-safe CMD candidates', () => {
    const result = buildClinicalMemoryDistillationRuntimeContext({
      persona: 'kim',
      nowLocal: '2026-08-29T09:00:00.000Z',
      currentZone: 'orange',
      maxPromptTokens: 1600,
      caregiverPatterns: [{
        type: 'emotional_burden',
        description: 'Voelt zich uitgeput doordat zij alles moet dragen.',
        confidence: 0.9,
        sourceSectionId: 'kim_story',
      }],
    });

    expect(result.context?.formulationInput.recurrentPatterns).toHaveLength(1);
    expect(result.context?.formulationInput.recurrentPatterns[0]?.persona).toBe('kim');
    expect(result.context?.formulationInput.recurrentPatterns[0]?.evidence[0]?.sourceField).toBe('caregiverPatterns');
    expect(result.selectorOutput?.selectedItems.length).toBeGreaterThan(0);
  });
});
