/**
 * Signal Storage Router
 * 
 * Routes parsed engine signals from the LLM to the correct memory layers.
 * The engine decides what to store — the LLM only suggests.
 * 
 * Memory layers:
 * - buffer (volatile): current session topics, emotional arc, persons mentioned
 * - state.dat: sliders, mood, zone — updated by triggers with layer "state.dat"
 * - user.dat: cross-session patterns, triggerPatterns, extractedEntities persons
 * - projections.dat: future-oriented data, hopes, fears
 */

import type { EngineSignals, EngineSignalPerson, EngineSignalTrigger, EngineSignalSchema } from './signal-parser';

// ─── Types ─────────────────────────────────────────────────────────

export interface SignalRoutingResult {
  /** New persons to merge into extractedEntities */
  personsToStore: EngineSignalPerson[];
  /** Triggers to promote to user.dat triggerPatterns */
  triggersToPromote: EngineSignalTrigger[];
  /** Triggers that affect current state (state.dat) */
  stateSignals: EngineSignalTrigger[];
  /** Schema hypotheses to store in schemaTendencies */
  schemasToStore: EngineSignalSchema[];
  /** Buffer enrichment: topic, emotion, therapeutic move */
  bufferUpdate: {
    topic: string;
    emotionalShift: string;
    therapeuticMove: string;
    personsDiscussed: string[];
  };
  /** Module suggestion (engine decides whether to act on it) */
  moduleSuggestion: { moduleId: string; confidence: number } | null;
  /** Whether any meaningful signal was detected */
  hasSignals: boolean;
}

// ─── Confidence thresholds (engine decides, not LLM) ───────────────

const TRIGGER_PROMOTE_THRESHOLD = 0.6;
const SCHEMA_STORE_THRESHOLD = 0.6;
const MODULE_SUGGEST_THRESHOLD = 0.7;
const PERSON_MIN_NAME_LENGTH = 2;

// ─── Router ────────────────────────────────────────────────────────

/**
 * Route engine signals to appropriate memory layers.
 * Returns a routing result that the pipeline can apply.
 * The engine retains full control — it can ignore any suggestion.
 */
export function routeSignals(signals: EngineSignals): SignalRoutingResult {
  // 1. Filter persons — only store if name is meaningful
  const personsToStore = signals.persons.filter(
    (p) => p.name.length >= PERSON_MIN_NAME_LENGTH && p.name !== '...'
  );

  // 2. Route triggers by layer
  const triggersToPromote = signals.triggers.filter(
    (t) => t.confidence >= TRIGGER_PROMOTE_THRESHOLD && (t.layer === 'user.dat' || t.layer === 'projections.dat')
  );
  const stateSignals = signals.triggers.filter(
    (t) => t.confidence >= TRIGGER_PROMOTE_THRESHOLD && t.layer === 'state.dat'
  );

  // 3. Filter schemas by threshold
  const schemasToStore = signals.schemas.filter(
    (s) => s.confidence >= SCHEMA_STORE_THRESHOLD
  );

  // 4. Buffer enrichment (always apply, even low confidence)
  const bufferUpdate = {
    topic: signals.topicProgression !== 'none' ? signals.topicProgression : '',
    emotionalShift: signals.emotionalShift !== 'none' ? signals.emotionalShift : '',
    therapeuticMove: signals.therapeuticMove !== 'none' ? signals.therapeuticMove : '',
    personsDiscussed: personsToStore.map((p) => p.name),
  };

  // 5. Module suggestion (only if high confidence)
  const topModule = signals.moduleRelevance.length > 0
    ? signals.moduleRelevance.reduce((best, m) => m.confidence > best.confidence ? m : best)
    : null;
  const moduleSuggestion = topModule && topModule.confidence >= MODULE_SUGGEST_THRESHOLD
    ? topModule
    : null;

  const hasSignals = personsToStore.length > 0 ||
    triggersToPromote.length > 0 ||
    stateSignals.length > 0 ||
    schemasToStore.length > 0 ||
    bufferUpdate.topic !== '' ||
    moduleSuggestion !== null;

  return {
    personsToStore,
    triggersToPromote,
    stateSignals,
    schemasToStore,
    bufferUpdate,
    moduleSuggestion,
    hasSignals,
  };
}

/**
 * Merge newly detected persons into existing extractedEntities persons list.
 * Deduplicates by name (case-insensitive). Updates valence if changed.
 */
export function mergePersons(
  existing: EngineSignalPerson[],
  newPersons: EngineSignalPerson[]
): EngineSignalPerson[] {
  const merged = [...existing];
  for (const np of newPersons) {
    const idx = merged.findIndex(
      (p) => p.name.toLowerCase() === np.name.toLowerCase()
    );
    if (idx >= 0) {
      // Update valence if the new observation differs
      if (np.valence !== 'neutral') {
        merged[idx] = { ...merged[idx], valence: np.valence, relationship: np.relationship || merged[idx].relationship };
      }
    } else {
      merged.push(np);
    }
  }
  return merged;
}
