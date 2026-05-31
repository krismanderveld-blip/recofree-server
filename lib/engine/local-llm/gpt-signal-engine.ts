/**
 * GptSignalEngine — Server-side implementation via GPT-4o-mini
 *
 * Implements LocalSignalEngine using GPT-4o-mini for three small classification tasks.
 * Calls the server's tRPC endpoint which forwards to OpenAI.
 *
 * Design:
 * - Model: gpt-4o-mini always (never gpt-4o for these calls)
 * - Max tokens: 150 per call
 * - Temperature: 0 (deterministic)
 * - Fault-tolerant: on parse error → return empty/neutral values
 * - isReady() always returns true (server is always available when online)
 */

import type {
  LocalSignalEngine,
  SignalDetectionResult,
  SignalContext,
  RelevanceScores,
  RelevanceContext,
  ContextSummary,
  SummarizationContext,
} from './signal-engine';

// ─── Prompts ────────────────────────────────────────────────────

const SIGNAL_DETECTION_PROMPT = (message: string, context?: SignalContext) => {
  const contextBlock = context
    ? `\nCurrent emotional state:\n- Zone: ${context.zone}\n- VSP/Eigen Regie: ${context.vspOrEigenRegie}\n- Key sliders: ${Object.entries(context.keySliders).map(([k, v]) => `${k}=${v}`).join(', ')}\n`
    : '';
  return `Analyze this message and return JSON only.${contextBlock}
User message: "${message}"
Return: {"fears": [{"keyword": "...", "confidence": 0.0-1.0}], "hopes": [{"keyword": "...", "confidence": 0.0-1.0}], "goals": [{"keyword": "...", "confidence": 0.0-1.0}], "triggers": [{"keyword": "...", "confidence": 0.0-1.0}]}
Max 3 items per category. Only what is clearly present. If nothing detected, use empty arrays.`;
};

const RELEVANCE_SCORING_PROMPT = (message: string, context: RelevanceContext) =>
  `Score relevance of these context blocks for this message (0.0-1.0):
Message: "${message}"
Backpack: ${context.backpackSummary || 'empty'}
Diary: ${context.diarySummary || 'empty'}
Triggers: ${context.triggerList.length > 0 ? context.triggerList.join(', ') : 'none'}
Return JSON only: {"backpackRelevance": 0.0, "diaryRelevance": 0.0, "triggerRelevance": 0.0, "projectionRelevance": 0.0}`;

const SUMMARIZE_CONTEXT_PROMPT = (context: SummarizationContext) =>
  `Summarize in max 3 sentences, plain text, no labels, max 100 words:
${context.backpackSections}
${context.recentSessionThemes}`;

// ─── Default (empty/neutral) values ─────────────────────────────

const EMPTY_SIGNALS: SignalDetectionResult = {
  fears: [],
  hopes: [],
  goals: [],
  triggers: [],
};

const NEUTRAL_SCORES: RelevanceScores = {
  backpackRelevance: 0.5,
  diaryRelevance: 0.5,
  triggerRelevance: 0.5,
  projectionRelevance: 0.5,
};

// ─── Implementation ─────────────────────────────────────────────

export class GptSignalEngine implements LocalSignalEngine {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
  }

  isReady(): boolean {
    return true;
  }

  async detectSignals(message: string, context?: SignalContext): Promise<SignalDetectionResult> {
    try {
      const response = await this.callGptMini(SIGNAL_DETECTION_PROMPT(message, context));
      const parsed = JSON.parse(response);

      // Validate structure
      return {
        fears: this.validateSignalArray(parsed.fears),
        hopes: this.validateSignalArray(parsed.hopes),
        goals: this.validateSignalArray(parsed.goals),
        triggers: this.validateSignalArray(parsed.triggers),
      };
    } catch {
      return EMPTY_SIGNALS;
    }
  }

  async scoreRelevance(message: string, context: RelevanceContext): Promise<RelevanceScores> {
    try {
      const response = await this.callGptMini(RELEVANCE_SCORING_PROMPT(message, context));
      const parsed = JSON.parse(response);

      return {
        backpackRelevance: this.clampScore(parsed.backpackRelevance),
        diaryRelevance: this.clampScore(parsed.diaryRelevance),
        triggerRelevance: this.clampScore(parsed.triggerRelevance),
        projectionRelevance: this.clampScore(parsed.projectionRelevance),
      };
    } catch {
      return NEUTRAL_SCORES;
    }
  }

  async summarizeContext(context: SummarizationContext): Promise<ContextSummary> {
    try {
      const response = await this.callGptMini(SUMMARIZE_CONTEXT_PROMPT(context));
      // Plain text response, trim and limit
      const text = response.trim().slice(0, 500);
      return { text };
    } catch {
      return { text: '' };
    }
  }

  // ─── Private helpers ────────────────────────────────────────────

  private async callGptMini(prompt: string): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/api/signal-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Signal engine API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result ?? '';
  }

  private validateSignalArray(arr: unknown): Array<{ keyword: string; confidence: number }> {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (item): item is { keyword: string; confidence: number } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as any).keyword === 'string' &&
          typeof (item as any).confidence === 'number'
      )
      .slice(0, 3)
      .map((item) => ({
        keyword: item.keyword,
        confidence: this.clampScore(item.confidence),
      }));
  }

  private clampScore(value: unknown): number {
    if (typeof value !== 'number' || isNaN(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }
}
