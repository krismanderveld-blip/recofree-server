/**
 * NullSignalEngine — Fallback implementation
 *
 * Returns empty/neutral values for all operations.
 * Used when the real engine is unavailable or during testing.
 */

import type {
  LocalSignalEngine,
  SignalDetectionResult,
  RelapseIntentResult,
  RelevanceScores,
  RelevanceContext,
  ContextSummary,
  SummarizationContext,
  SignalContext,
} from './signal-engine';

export class NullSignalEngine implements LocalSignalEngine {
  isReady(): boolean {
    return true;
  }

  async detectSignals(_message: string, _context?: SignalContext): Promise<SignalDetectionResult> {
    return { fears: [], hopes: [], goals: [], triggers: [] };
  }

  async detectRelapseIntent(_message: string): Promise<RelapseIntentResult> {
    return { detected: false, confidence: 0 };
  }

  async scoreRelevance(_message: string, _context: RelevanceContext): Promise<RelevanceScores> {
    return {
      backpackRelevance: 0.5,
      diaryRelevance: 0.5,
      triggerRelevance: 0.5,
      projectionRelevance: 0.5,
    };
  }

  async summarizeContext(_context: SummarizationContext): Promise<ContextSummary> {
    return { text: '' };
  }
}
