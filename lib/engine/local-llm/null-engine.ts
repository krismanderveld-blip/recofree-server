/**
 * NullSignalEngine — fallback implementation when no model is loaded.
 * Returns empty/neutral values for all methods.
 */

import type {
  LocalSignalEngine,
  SignalInput,
  ContextInput,
  ContextData,
  CandidateSignals,
  RelevanceMap,
  ContextSummary,
} from './signal-engine';

export class NullSignalEngine implements LocalSignalEngine {
  async detectSignals(_input: SignalInput): Promise<CandidateSignals> {
    return {
      fears: [],
      hopes: [],
      goals: [],
      triggers: [],
    };
  }

  async scoreRelevance(_context: ContextInput): Promise<RelevanceMap> {
    return {
      backpackRelevance: 0,
      diaryRelevance: 0,
      triggerRelevance: 0,
      projectionRelevance: 0,
    };
  }

  async summarizeContext(_data: ContextData): Promise<ContextSummary> {
    return {
      dominantTheme: '',
      urgencyHint: 'low',
      suggestedFocus: '',
    };
  }

  isReady(): boolean {
    return false;
  }
}
