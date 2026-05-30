/**
 * GemmaSignalEngine — LocalSignalEngine implementation using Gemma 3 4B via llama.rn.
 *
 * Model: gemma-3-4b-it-Q4_K_M.gguf (~2.5 GB)
 * Runtime: llama.rn (React Native binding of llama.cpp)
 * Inference: fully on-device, no server calls
 *
 * The 4B model provides significantly better reasoning and structured output
 * compared to 1B, while still fitting in modern phone RAM (6GB+).
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

// llama.rn types (imported dynamically to avoid crash if not installed)
type LlamaContext = {
  completion: (params: {
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    n_predict: number;
    stop?: string[];
    temperature?: number;
  }) => Promise<{ text: string; timings?: Record<string, number> }>;
  release: () => Promise<void>;
};

type InitLlamaParams = {
  model: string;
  use_mlock?: boolean;
  n_ctx?: number;
  n_gpu_layers?: number;
};

// ─── Constants ──────────────────────────────────────────────────

/** Expected model filename on device */
export const GEMMA_MODEL_FILENAME = 'gemma-3-4b-it-Q4_K_M.gguf';

/** Expected model size in bytes (~2.5 GB) */
export const GEMMA_MODEL_SIZE_BYTES = 2_700_000_000;

// ─── Prompts ────────────────────────────────────────────────────

const DETECT_SIGNALS_SYSTEM = `You are a therapeutic signal detector. Analyze the user's message and conversation context to identify psychological signals.
Return ONLY valid JSON with this exact structure:
{"fears":[{"keyword":"...","confidence":0.0}],"hopes":[{"keyword":"...","confidence":0.0}],"goals":[{"keyword":"...","confidence":0.0}],"triggers":[{"keyword":"...","confidence":0.0}]}
Rules:
- confidence is 0.0-1.0
- keyword is 1-3 words max
- Return empty arrays if no signals detected
- Max 3 items per category`;

const SCORE_RELEVANCE_SYSTEM = `You are a context relevance scorer. Score how relevant each context source is to the user's current message.
Return ONLY valid JSON with this exact structure:
{"backpackRelevance":0.0,"diaryRelevance":0.0,"triggerRelevance":0.0,"projectionRelevance":0.0}
Rules:
- All scores are 0.0-1.0
- 0.0 = completely irrelevant
- 1.0 = highly relevant
- Base scores on semantic overlap between message and context`;

const SUMMARIZE_CONTEXT_SYSTEM = `You are a therapeutic context summarizer. Summarize the user's current state.
Return ONLY valid JSON with this exact structure:
{"dominantTheme":"...","urgencyHint":"low","suggestedFocus":"..."}
Rules:
- dominantTheme: 1-5 words describing the main theme
- urgencyHint: exactly "low", "medium", or "high"
- suggestedFocus: 1 sentence suggesting what to focus on next`;

// ─── Engine ─────────────────────────────────────────────────────

export class GemmaSignalEngine implements LocalSignalEngine {
  private context: LlamaContext | null = null;
  private loading = false;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  /**
   * Load the Gemma 3 4B model asynchronously.
   * Call this at app start via EngineProvider.setEngine().
   * If model file not found or load fails, logs warning and stays not-ready.
   *
   * Expected load time: 5-10 seconds on modern devices.
   * RAM usage: ~3-4 GB during inference.
   */
  async load(): Promise<boolean> {
    if (this.context) return true;
    if (this.loading) return false;

    this.loading = true;
    try {
      // Dynamic import to avoid crash if llama.rn not installed
      // @ts-ignore — llama.rn is a native dependency installed at build time, not in dev sandbox
      const { initLlama } = (await import('llama.rn')) as {
        initLlama: (params: InitLlamaParams) => Promise<LlamaContext>;
      };

      this.context = await initLlama({
        model: this.modelPath,
        use_mlock: true,
        n_ctx: 4096, // 4B model can handle larger context
        n_gpu_layers: 99, // Metal (iOS) / OpenCL (Android)
      });

      console.log('[GemmaSignalEngine] Gemma 3 4B model loaded successfully');
      return true;
    } catch (error) {
      console.warn('[GemmaSignalEngine] Failed to load Gemma 3 4B model:', error);
      this.context = null;
      return false;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Release the model context and free memory.
   */
  async unload(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
      console.log('[GemmaSignalEngine] Model unloaded');
    }
  }

  isReady(): boolean {
    return this.context !== null;
  }

  async detectSignals(input: SignalInput): Promise<CandidateSignals> {
    if (!this.context) {
      return { fears: [], hopes: [], goals: [], triggers: [] };
    }

    const userPrompt = buildDetectSignalsPrompt(input);

    try {
      const result = await this.context.completion({
        messages: [
          { role: 'system', content: DETECT_SIGNALS_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        n_predict: 300,
        stop: ['\n\n', '</s>'],
        temperature: 0.1,
      });

      return parseSignalsJSON(result.text);
    } catch (error) {
      console.warn('[GemmaSignalEngine] detectSignals failed:', error);
      return { fears: [], hopes: [], goals: [], triggers: [] };
    }
  }

  async scoreRelevance(context: ContextInput): Promise<RelevanceMap> {
    if (!this.context) {
      return { backpackRelevance: 0, diaryRelevance: 0, triggerRelevance: 0, projectionRelevance: 0 };
    }

    const userPrompt = buildRelevancePrompt(context);

    try {
      const result = await this.context.completion({
        messages: [
          { role: 'system', content: SCORE_RELEVANCE_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        n_predict: 100,
        stop: ['\n\n', '</s>'],
        temperature: 0.1,
      });

      return parseRelevanceJSON(result.text);
    } catch (error) {
      console.warn('[GemmaSignalEngine] scoreRelevance failed:', error);
      return { backpackRelevance: 0, diaryRelevance: 0, triggerRelevance: 0, projectionRelevance: 0 };
    }
  }

  async summarizeContext(data: ContextData): Promise<ContextSummary> {
    if (!this.context) {
      return { dominantTheme: '', urgencyHint: 'low', suggestedFocus: '' };
    }

    const userPrompt = buildSummarizePrompt(data);

    try {
      const result = await this.context.completion({
        messages: [
          { role: 'system', content: SUMMARIZE_CONTEXT_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        n_predict: 150,
        stop: ['\n\n', '</s>'],
        temperature: 0.1,
      });

      return parseSummaryJSON(result.text);
    } catch (error) {
      console.warn('[GemmaSignalEngine] summarizeContext failed:', error);
      return { dominantTheme: '', urgencyHint: 'low', suggestedFocus: '' };
    }
  }
}

// ─── Prompt Builders ────────────────────────────────────────────

function buildDetectSignalsPrompt(input: SignalInput): string {
  const lines: string[] = [];
  lines.push(`Current message: "${input.currentMessage}"`);

  if (input.conversationHistory.length > 0) {
    const recent = input.conversationHistory.slice(-3);
    lines.push(`Recent conversation (last ${recent.length} messages):`);
    for (const m of recent) {
      lines.push(`  ${m.role}: ${m.content.slice(0, 100)}`);
    }
  }

  const sliderKeys = Object.keys(input.moodSliders);
  if (sliderKeys.length > 0) {
    lines.push(`Mood sliders: ${sliderKeys.map(k => `${k}=${input.moodSliders[k]}`).join(', ')}`);
  }

  if (input.userDatSummary.recentTriggers.length > 0) {
    lines.push(`Known triggers: ${input.userDatSummary.recentTriggers.join(', ')}`);
  }

  lines.push('');
  lines.push('Detect fears, hopes, goals, and triggers from this context. Return JSON only.');
  return lines.join('\n');
}

function buildRelevancePrompt(context: ContextInput): string {
  const lines: string[] = [];
  lines.push(`User message: "${context.message}"`);

  if (context.backpackSections.length > 0) {
    lines.push(`Backpack sections: ${context.backpackSections.map(s => s.label).join(', ')}`);
    for (const s of context.backpackSections.slice(0, 3)) {
      lines.push(`  ${s.label}: ${s.content.slice(0, 80)}`);
    }
  }

  if (context.recentDiary.length > 0) {
    lines.push(`Recent diary (${context.recentDiary.length} entries):`);
    for (const d of context.recentDiary.slice(0, 3)) {
      lines.push(`  [${d.moodTag}] ${d.content.slice(0, 60)}`);
    }
  }

  if (context.triggerPatterns.length > 0) {
    lines.push(`Trigger patterns: ${context.triggerPatterns.map(t => `${t.trigger}(${t.count}x)`).join(', ')}`);
  }

  lines.push('');
  lines.push('Score relevance of each context source to the message. Return JSON only.');
  return lines.join('\n');
}

function buildSummarizePrompt(data: ContextData): string {
  const lines: string[] = [];

  if (data.sessionAnalyses.length > 0) {
    const recent = data.sessionAnalyses.slice(-3);
    lines.push(`Recent sessions: ${recent.map(s => `${s.dominantEmotion}(${s.themes.join(',')})`).join(' | ')}`);
  }

  if (data.backpackSections.length > 0) {
    lines.push(`Backpack: ${data.backpackSections.map(s => s.label).join(', ')}`);
  }

  if (data.projectionEntries.length > 0) {
    lines.push(`Active projections: ${data.projectionEntries.length}`);
  }

  lines.push('');
  lines.push('Summarize the dominant theme, urgency, and suggested focus. Return JSON only.');
  return lines.join('\n');
}

// ─── JSON Parsers (fault-tolerant) ──────────────────────────────

function parseSignalsJSON(text: string): CandidateSignals {
  const fallback: CandidateSignals = { fears: [], hopes: [], goals: [], triggers: [] };
  try {
    const json = extractJSON(text);
    if (!json) return fallback;
    const parsed = JSON.parse(json);
    return {
      fears: Array.isArray(parsed.fears) ? parsed.fears.slice(0, 3).map(normalizeSignal) : [],
      hopes: Array.isArray(parsed.hopes) ? parsed.hopes.slice(0, 3).map(normalizeSignal) : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals.slice(0, 3).map(normalizeSignal) : [],
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers.slice(0, 3).map(normalizeSignal) : [],
    };
  } catch {
    return fallback;
  }
}

function parseRelevanceJSON(text: string): RelevanceMap {
  const fallback: RelevanceMap = { backpackRelevance: 0, diaryRelevance: 0, triggerRelevance: 0, projectionRelevance: 0 };
  try {
    const json = extractJSON(text);
    if (!json) return fallback;
    const parsed = JSON.parse(json);
    return {
      backpackRelevance: clamp01(parsed.backpackRelevance),
      diaryRelevance: clamp01(parsed.diaryRelevance),
      triggerRelevance: clamp01(parsed.triggerRelevance),
      projectionRelevance: clamp01(parsed.projectionRelevance),
    };
  } catch {
    return fallback;
  }
}

function parseSummaryJSON(text: string): ContextSummary {
  const fallback: ContextSummary = { dominantTheme: '', urgencyHint: 'low', suggestedFocus: '' };
  try {
    const json = extractJSON(text);
    if (!json) return fallback;
    const parsed = JSON.parse(json);
    const urgency = parsed.urgencyHint;
    return {
      dominantTheme: typeof parsed.dominantTheme === 'string' ? parsed.dominantTheme.slice(0, 50) : '',
      urgencyHint: (urgency === 'low' || urgency === 'medium' || urgency === 'high') ? urgency : 'low',
      suggestedFocus: typeof parsed.suggestedFocus === 'string' ? parsed.suggestedFocus.slice(0, 200) : '',
    };
  } catch {
    return fallback;
  }
}

// ─── Utilities ──────────────────────────────────────────────────

/** Extract first JSON object from text (handles preamble/postamble) */
function extractJSON(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeSignal(item: unknown): { keyword: string; confidence: number } {
  if (typeof item !== 'object' || item === null) return { keyword: '', confidence: 0 };
  const obj = item as Record<string, unknown>;
  return {
    keyword: typeof obj.keyword === 'string' ? obj.keyword.slice(0, 30) : '',
    confidence: clamp01(obj.confidence),
  };
}

function clamp01(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
