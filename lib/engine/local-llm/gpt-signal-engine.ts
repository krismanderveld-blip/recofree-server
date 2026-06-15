/**
 * GptSignalEngine — Server-side implementation via GPT-4o-mini
 *
 * Implements LocalSignalEngine using GPT-4o-mini for three small classification tasks.
 * Calls the server's tRPC endpoint which forwards to OpenAI.
 *
 * Design:
 * - Model: gpt-4o-mini always (never gpt-4o for these calls)
 * - Max tokens: 400 per call
 * - Temperature: 0 (deterministic)
 * - Timeout: 3 seconds (returns empty/neutral on timeout)
 * - Fault-tolerant: on parse error → return empty/neutral values
 * - isReady() always returns true (server is always available when online)
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

// ─── Prompts ────────────────────────────────────────────────────

const SIGNAL_DETECTION_PROMPT_ELIAS = (message: string, context?: SignalContext) => {
  const contextBlock = context
    ? `\nCurrent emotional state:\n- Zone: ${context.zone}\n- VSP/Eigen Regie: ${context.vspOrEigenRegie ?? 'unknown'}\n- Key sliders: ${formatSliders(context.keySliders)}${context.activeProjections && context.activeProjections.length > 0 ? `\n- Active projections: ${context.activeProjections.map(p => `${p.category}:${p.content}`).join('; ')}` : ''}\n`
    : '';

  return `You are analyzing a message from someone in addiction recovery.

Detect emotional signals relevant to recovery:
- fears: fear of relapse, loss of control, shame, isolation
- hopes: motivation to stay clean, desire for change, positive goals
- goals: concrete intentions, recovery milestones, behavioral changes
- triggers: situations/emotions that risk relapse (stress, loneliness, conflict)
${contextBlock}
User message: "${message}"

Return JSON only:
{"fears": [{"keyword": "...", "confidence": 0.0-1.0}], "hopes": [{"keyword": "...", "confidence": 0.0-1.0}], "goals": [{"keyword": "...", "confidence": 0.0-1.0}], "triggers": [{"keyword": "...", "confidence": 0.0-1.0}]}
Max 3 items per category. Empty array if nothing detected.`;
};

const SIGNAL_DETECTION_PROMPT_KIM = (message: string, context?: SignalContext) => {
  const contextBlock = context
    ? `\nCurrent emotional state:\n- Zone: ${context.zone}\n- Eigen Regie: ${context.vspOrEigenRegie ?? 'unknown'}\n- Key sliders: ${formatSliders(context.keySliders)}${context.activeProjections && context.activeProjections.length > 0 ? `\n- Active projections: ${context.activeProjections.map(p => `${p.category}:${p.content}`).join('; ')}` : ''}\n`
    : '';

  return `You are analyzing a message from someone supporting a loved one with addiction.

Detect emotional signals relevant to caregiver experience:
- fears: fear of enabling, fear of losing loved one, fear of burnout
- hopes: hope for loved one's recovery, hope for own boundaries, desire for change
- goals: setting boundaries, self-care intentions, communication goals
- triggers: situations that cause enabling behavior, guilt, exhaustion, conflict
${contextBlock}
User message: "${message}"

Return JSON only:
{"fears": [{"keyword": "...", "confidence": 0.0-1.0}], "hopes": [{"keyword": "...", "confidence": 0.0-1.0}], "goals": [{"keyword": "...", "confidence": 0.0-1.0}], "triggers": [{"keyword": "...", "confidence": 0.0-1.0}]}
Max 3 items per category. Empty array if nothing detected.`;
};

function formatSliders(sliders: Record<string, unknown>): string {
  return Object.entries(sliders)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .map(([k, v]) => `${k}=${v}`)
    .join(', ') || 'none';
}

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

const RELAPSE_INTENT_PROMPT = (message: string) =>
  `Detect relapse intent in this message from someone in addiction recovery.

Relapse intent means: the user expressing a desire, urge, or intention to use substances or drink.
Examples: "ik wil gebruiken", "j'ai envie de consommer", "I want to use", "ik ga drinken", "I'm going to drink", "zin om te gebruiken", "envie de boire".

This is INTENT or strong urge to use, NOT a report of past relapse ("I used again" is NOT intent).
This is NOT general craving discussion — it must be an expressed desire/plan/urge to actually use.

User message: "${message}"

Return JSON only:
{"detected": true/false, "confidence": 0.0-1.0}`;

const RELAPSE_INTENT_KIM_PROMPT = (message: string) =>
  `Detect THIRD-PERSON relapse intent in this message from a caregiver/loved one of someone with addiction.

Third-person relapse intent means: the caregiver reporting that their loved one is expressing desire, urge, or intention to use substances or drink.
Examples:
- "hij wil weer drinken" (he wants to drink again)
- "ze zegt dat ze wil gebruiken" (she says she wants to use)
- "my partner says he's going to drink tonight"
- "il dit qu'il va consommer ce soir" (he says he'll use tonight)
- "mijn zoon zegt dat hij gaat gebruiken" (my son says he's going to use)
- "she told me she wants to relapse"
- "hij heeft zin om te gebruiken" (he feels like using)

This is about the LOVED ONE's intent/urge to use, reported by the caregiver.
NOT the caregiver's own intent. NOT a completed relapse ("he used again" is NOT intent).
NOT general discussion about addiction — it must be a reported desire/plan/urge by the loved one.

User message: "${message}"

Return JSON only:
{"detected": true/false, "confidence": 0.0-1.0}`;

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
      const prompt = context?.userType === 'kim'
        ? SIGNAL_DETECTION_PROMPT_KIM(message, context)
        : SIGNAL_DETECTION_PROMPT_ELIAS(message, context);

      const response = await this.callGptMini(prompt);
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

  async detectRelapseIntent(message: string): Promise<RelapseIntentResult> {
    try {
      const response = await this.callGptMini(RELAPSE_INTENT_PROMPT(message));
      const parsed = JSON.parse(response);

      return {
        detected: parsed.detected === true,
        confidence: this.clampScore(parsed.confidence),
      };
    } catch {
      // On failure, return not detected — deterministic fallback handles this case
      return { detected: false, confidence: 0 };
    }
  }

  async detectKimRelapseIntent(message: string): Promise<RelapseIntentResult> {
    try {
      const response = await this.callGptMini(RELAPSE_INTENT_KIM_PROMPT(message));
      const parsed = JSON.parse(response);

      return {
        detected: parsed.detected === true,
        confidence: this.clampScore(parsed.confidence),
      };
    } catch {
      // On failure, return not detected — deterministic fallback handles this case
      return { detected: false, confidence: 0 };
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/signal-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Signal engine API error: ${response.status}`);
      }

      const data = await response.json();
      return data.result ?? '';
    } finally {
      clearTimeout(timeoutId);
    }
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
