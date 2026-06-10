import { describe, it, expect } from 'vitest';
import { parseEngineResponse, EMPTY_SIGNALS } from '@/lib/engine/signal-parser';
import { routeSignals, mergePersons } from '@/lib/engine/signal-router';
import { reconsiderModule } from '@/lib/engine/module-reconsideration';
import { enrichBuffer, recordModuleSwitch } from '@/lib/engine/buffer-enrichment';
import { processFeedbackLoop } from '@/lib/engine/feedback-loop';
import type { BufferState } from '@/lib/rugzak/short-term-memory-buffer';

// ─── Helper: minimal buffer state ──────────────────────────────────

function makeBuffer(overrides: Partial<BufferState> = {}): BufferState {
  return {
    sessionId: 'test_session',
    recentMessages: [],
    currentEmotion: 'neutral',
    currentTriggerGuess: '',
    currentRelationshipAnchor: '',
    currentIntent: 'neutral',
    currentZoneScore: 20,
    currentZoneColor: 'GREEN',
    responseDirection: 'explore',
    temporaryRepeats: [],
    messageCount: 5,
    previousZoneScore: 20,
    intensityTrajectory: 'stable',
    usedModules: [],
    topicHistory: [],
    personsDiscussed: [],
    emotionalArc: [],
    currentTopic: '',
    moduleSwitchCount: 0,
    currentModuleMessageCount: 3,
    ...overrides,
  };
}

// ─── Signal Parser Tests ───────────────────────────────────────────

describe('Signal Parser', () => {
  it('parses a complete response with engine_signals and clinical blocks', () => {
    const raw = `Ik hoor je, dat klinkt zwaar.

<engine_signals>
{
  "persons": [{"name": "Anja", "relationship": "zus", "valence": "positive"}],
  "triggers": [{"label": "eenzaamheid", "confidence": 0.8, "layer": "user.dat"}],
  "schemas": [{"name": "abandonment", "confidence": 0.7}],
  "emotionalShift": "opening",
  "topicProgression": "relatie met zus",
  "therapeuticMove": "reflective listening",
  "moduleRelevance": [{"moduleId": "ISO01", "confidence": 0.75}]
}
</engine_signals>

<clinical>
Method: Reflective listening
Observation: Client shows opening toward social reconnection
Intervention: Validated the positive relationship with sister
Signals: eenzaamheid +1 (user.dat)
</clinical>`;

    const result = parseEngineResponse(raw);
    expect(result.userText).toBe('Ik hoor je, dat klinkt zwaar.');
    expect(result.signals).not.toBeNull();
    expect(result.signals!.persons).toHaveLength(1);
    expect(result.signals!.persons[0].name).toBe('Anja');
    expect(result.signals!.triggers).toHaveLength(1);
    expect(result.signals!.triggers[0].label).toBe('eenzaamheid');
    expect(result.signals!.schemas).toHaveLength(1);
    expect(result.signals!.emotionalShift).toBe('opening');
    expect(result.signals!.topicProgression).toBe('relatie met zus');
    expect(result.clinicalBlock).toContain('Reflective listening');
  });

  it('handles response without engine_signals gracefully', () => {
    const raw = 'Hoe gaat het vandaag met je?';
    const result = parseEngineResponse(raw);
    expect(result.userText).toBe('Hoe gaat het vandaag met je?');
    expect(result.signals).toBeNull();
    expect(result.clinicalBlock).toBeNull();
  });

  it('handles malformed JSON in engine_signals', () => {
    const raw = `Antwoord hier.

<engine_signals>
{invalid json here}
</engine_signals>`;
    const result = parseEngineResponse(raw);
    expect(result.userText).toBe('Antwoord hier.');
    expect(result.signals).toBeNull();
  });

  it('filters schemas below 0.5 confidence', () => {
    const raw = `Test.

<engine_signals>
{
  "persons": [],
  "triggers": [],
  "schemas": [{"name": "abandonment", "confidence": 0.3}, {"name": "mistrust", "confidence": 0.8}],
  "emotionalShift": "none",
  "topicProgression": "none",
  "therapeuticMove": "none",
  "moduleRelevance": []
}
</engine_signals>`;
    const result = parseEngineResponse(raw);
    expect(result.signals!.schemas).toHaveLength(1);
    expect(result.signals!.schemas[0].name).toBe('mistrust');
  });

  it('clamps confidence values to 0-1 range', () => {
    const raw = `Test.

<engine_signals>
{
  "persons": [],
  "triggers": [{"label": "craving", "confidence": 1.5, "layer": "state.dat"}],
  "schemas": [],
  "emotionalShift": "none",
  "topicProgression": "none",
  "therapeuticMove": "none",
  "moduleRelevance": []
}
</engine_signals>`;
    const result = parseEngineResponse(raw);
    expect(result.signals!.triggers[0].confidence).toBe(1);
  });
});

// ─── Signal Router Tests ───────────────────────────────────────────

describe('Signal Router', () => {
  it('routes triggers to correct layers based on confidence', () => {
    const signals = {
      ...EMPTY_SIGNALS,
      triggers: [
        { label: 'craving', confidence: 0.8, layer: 'user.dat' as const },
        { label: 'stress', confidence: 0.4, layer: 'state.dat' as const },
        { label: 'isolation', confidence: 0.7, layer: 'state.dat' as const },
      ],
    };
    const result = routeSignals(signals);
    expect(result.triggersToPromote).toHaveLength(1);
    expect(result.triggersToPromote[0].label).toBe('craving');
    expect(result.stateSignals).toHaveLength(1);
    expect(result.stateSignals[0].label).toBe('isolation');
  });

  it('filters persons with short names', () => {
    const signals = {
      ...EMPTY_SIGNALS,
      persons: [
        { name: 'A', relationship: 'unknown', valence: 'neutral' as const },
        { name: 'Lisa', relationship: 'dochter', valence: 'positive' as const },
        { name: '...', relationship: 'unknown', valence: 'neutral' as const },
      ],
    };
    const result = routeSignals(signals);
    expect(result.personsToStore).toHaveLength(1);
    expect(result.personsToStore[0].name).toBe('Lisa');
  });

  it('only suggests module if confidence >= 0.7', () => {
    const lowConfidence = { ...EMPTY_SIGNALS, moduleRelevance: [{ moduleId: 'ISO01', confidence: 0.5 }] };
    const highConfidence = { ...EMPTY_SIGNALS, moduleRelevance: [{ moduleId: 'ISO01', confidence: 0.8 }] };
    expect(routeSignals(lowConfidence).moduleSuggestion).toBeNull();
    expect(routeSignals(highConfidence).moduleSuggestion).not.toBeNull();
  });

  it('mergePersons deduplicates by name and updates valence', () => {
    const existing = [{ name: 'Anja', relationship: 'zus', valence: 'neutral' as const }];
    const newPersons = [
      { name: 'anja', relationship: 'zus', valence: 'positive' as const },
      { name: 'Tom', relationship: 'zoon', valence: 'ambivalent' as const },
    ];
    const merged = mergePersons(existing, newPersons);
    expect(merged).toHaveLength(2);
    expect(merged[0].valence).toBe('positive'); // updated
    expect(merged[1].name).toBe('Tom');
  });
});

// ─── Module Reconsideration Tests ──────────────────────────────────

describe('Module Reconsideration', () => {
  it('never switches during crisis', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 5,
      switchCountThisSession: 0,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.95 },
      crisisActive: true,
      currentZone: 'green',
    });
    expect(result.shouldSwitch).toBe(false);
    expect(result.reason).toBe('crisis_active_no_switch');
  });

  it('does not switch if too early (< 2 messages)', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 1,
      switchCountThisSession: 0,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.9 },
      crisisActive: false,
      currentZone: 'green',
    });
    expect(result.shouldSwitch).toBe(false);
    expect(result.reason).toBe('too_early_min_messages');
  });

  it('does not switch if max switches reached', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 5,
      switchCountThisSession: 2,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.9 },
      crisisActive: false,
      currentZone: 'green',
    });
    expect(result.shouldSwitch).toBe(false);
    expect(result.reason).toBe('max_switches_reached');
  });

  it('switches when confidence is high enough', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 5,
      switchCountThisSession: 0,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.85 },
      crisisActive: false,
      currentZone: 'green',
    });
    expect(result.shouldSwitch).toBe(true);
    expect(result.newModuleId).toBe('ISO01');
  });

  it('does not switch if confidence delta is too small', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 5,
      switchCountThisSession: 0,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.6 },
      crisisActive: false,
      currentZone: 'green',
    });
    expect(result.shouldSwitch).toBe(false);
    expect(result.reason).toBe('insufficient_confidence_delta');
  });

  it('does not switch in red zone', () => {
    const result = reconsiderModule({
      currentModuleId: 'E01',
      currentModuleMessageCount: 5,
      switchCountThisSession: 0,
      llmSuggestion: { moduleId: 'ISO01', confidence: 0.9 },
      crisisActive: false,
      currentZone: 'rood',
    });
    expect(result.shouldSwitch).toBe(false);
  });
});

// ─── Buffer Enrichment Tests ───────────────────────────────────────

describe('Buffer Enrichment', () => {
  it('adds new topic to history', () => {
    const buffer = makeBuffer({ topicHistory: ['werk'] });
    const routing = { personsToStore: [], triggersToPromote: [], stateSignals: [], schemasToStore: [], bufferUpdate: { topic: 'relatie met vader', emotionalShift: 'opening', therapeuticMove: 'validation', personsDiscussed: [] }, moduleSuggestion: null, hasSignals: true };
    const result = enrichBuffer(buffer, routing);
    expect(result.topicHistory).toEqual(['werk', 'relatie met vader']);
    expect(result.currentTopic).toBe('relatie met vader');
    expect(result.emotionalArc).toEqual(['opening']);
  });

  it('deduplicates persons by name', () => {
    const buffer = makeBuffer({ personsDiscussed: ['Anja'] });
    const routing = { personsToStore: [], triggersToPromote: [], stateSignals: [], schemasToStore: [], bufferUpdate: { topic: '', emotionalShift: '', therapeuticMove: '', personsDiscussed: ['anja', 'Tom'] }, moduleSuggestion: null, hasSignals: true };
    const result = enrichBuffer(buffer, routing);
    expect(result.personsDiscussed).toEqual(['Anja', 'Tom']);
  });

  it('recordModuleSwitch increments count and resets message counter', () => {
    const buffer = makeBuffer({ moduleSwitchCount: 0, currentModuleMessageCount: 5 });
    const result = recordModuleSwitch(buffer, 'ISO01');
    expect(result.moduleSwitchCount).toBe(1);
    expect(result.currentModuleMessageCount).toBe(0);
    expect(result.usedModules).toContain('ISO01');
  });
});

// ─── Full Feedback Loop Integration Test ───────────────────────────

describe('Feedback Loop Integration', () => {
  it('processes a full LLM response through the entire loop', () => {
    const rawResponse = `Ik begrijp dat het moeilijk is om contact te houden met je zus.

<engine_signals>
{
  "persons": [{"name": "Anja", "relationship": "zus", "valence": "positive"}],
  "triggers": [{"label": "isolatie", "confidence": 0.75, "layer": "user.dat"}],
  "schemas": [],
  "emotionalShift": "opening",
  "topicProgression": "contact met zus",
  "therapeuticMove": "reflective listening",
  "moduleRelevance": [{"moduleId": "ISO01", "confidence": 0.8}]
}
</engine_signals>`;

    const result = processFeedbackLoop({
      rawResponse,
      bufferState: makeBuffer({ currentModuleMessageCount: 4 }),
      currentModuleId: 'E01',
      crisisActive: false,
    });

    // User text is clean
    expect(result.userText).toBe('Ik begrijp dat het moeilijk is om contact te houden met je zus.');
    // Signals parsed
    expect(result.signals).not.toBeNull();
    expect(result.signals!.persons[0].name).toBe('Anja');
    // Routing applied
    expect(result.routing.personsToStore).toHaveLength(1);
    expect(result.routing.triggersToPromote).toHaveLength(1);
    // Buffer enriched
    expect(result.updatedBuffer.topicHistory).toContain('contact met zus');
    expect(result.updatedBuffer.personsDiscussed).toContain('Anja');
    expect(result.updatedBuffer.emotionalArc).toContain('opening');
    // Module switch recommended (ISO01 at 0.8 > 0.75 threshold)
    expect(result.moduleDecision.shouldSwitch).toBe(true);
    expect(result.moduleDecision.newModuleId).toBe('ISO01');
    expect(result.hasData).toBe(true);
  });

  it('handles response without engine_signals gracefully', () => {
    const result = processFeedbackLoop({
      rawResponse: 'Hoe gaat het vandaag?',
      bufferState: makeBuffer(),
      currentModuleId: 'E01',
      crisisActive: false,
    });
    expect(result.userText).toBe('Hoe gaat het vandaag?');
    expect(result.signals).toBeNull();
    expect(result.hasData).toBe(false);
    expect(result.moduleDecision.shouldSwitch).toBe(false);
  });
});
