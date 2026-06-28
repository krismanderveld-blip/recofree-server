/**
 * Signal Engine — Server-side consolidated implementation
 *
 * Runs GPT-4o-mini signal detection DIRECTLY on the server (no HTTP round-trip).
 * Replaces the client→server proxy pattern with direct OpenAI calls.
 *
 * Tasks:
 * 1. Signal Detection — extract fears, hopes, goals, triggers
 * 2. Relevance Scoring — score context block relevance
 * 3. Context Summarization — compress context to max 3 sentences
 * 4. Relapse Intent Detection — detect substance use intent
 *
 * Model: gpt-4o-mini always | Max tokens: 400 | Temperature: 0 | Timeout: 3s
 */

// ─── Types ──────────────────────────────────────────────────────
export interface DetectedSignal {
  keyword: string;
  confidence: number;
}

export interface SignalDetectionResult {
  fears: DetectedSignal[];
  hopes: DetectedSignal[];
  goals: DetectedSignal[];
  triggers: DetectedSignal[];
}

export interface RelapseIntentResult {
  detected: boolean;
  confidence: number;
}

export interface RelevanceScores {
  backpackRelevance: number;
  diaryRelevance: number;
  triggerRelevance: number;
  projectionRelevance: number;
}

export interface ContextSummary {
  text: string;
}

export interface SignalContext {
  zone: string;
  vspOrEigenRegie: string | number | null;
  keySliders: Record<string, unknown>;
  userType: 'elias' | 'kim';
  activeProjections?: Array<{ category: string; content: string; strength: string }>;
}

export interface RelevanceContext {
  backpackSummary: string;
  diarySummary: string;
  triggerList: string[];
}

export interface SummarizationContext {
  backpackSections: string;
  recentSessionThemes: string;
}

export interface SignalEngineResult {
  signals: SignalDetectionResult;
  relapseIntent: RelapseIntentResult;
  relevance: RelevanceScores;
  summary: ContextSummary;
  latencyMs: number;
}

// ─── Constants ──────────────────────────────────────────────────
const EMPTY_SIGNALS: SignalDetectionResult = { fears: [], hopes: [], goals: [], triggers: [] };
const NEUTRAL_SCORES: RelevanceScores = { backpackRelevance: 0.5, diaryRelevance: 0.5, triggerRelevance: 0.5, projectionRelevance: 0.5 };
const TIMEOUT_MS = 3000;

// ─── Prompts ────────────────────────────────────────────────────
function formatSliders(sliders: Record<string, unknown>): string {
  return Object.entries(sliders).map(([k, v]) => `${k}=${v}`).join(', ');
}

function signalDetectionPrompt(message: string, userType: 'elias' | 'kim', context?: SignalContext): string {
  const contextBlock = context
    ? `\nCurrent emotional state:\n- Zone: ${context.zone}\n- VSP/Eigen Regie: ${context.vspOrEigenRegie ?? 'unknown'}\n- Key sliders: ${formatSliders(context.keySliders)}${context.activeProjections?.length ? `\n- Active projections: ${context.activeProjections.map(p => `${p.category}:${p.content}`).join('; ')}` : ''}\n`
    : '';

  if (userType === 'kim') {
    return `You are analyzing a message from a caregiver/loved one of someone with addiction.
Detect emotional signals relevant to their support role:
- fears: fear of enabling, losing the person, burnout, helplessness
- hopes: signs of progress in loved one, self-care motivation, boundary setting
- goals: concrete support intentions, self-care plans, boundary decisions
- triggers: situations that drain their energy (conflict, manipulation, guilt-tripping)
${contextBlock}
User message: "${message}"
Return JSON only:
{"fears": [{"keyword": "...", "confidence": 0.0-1.0}], "hopes": [{"keyword": "...", "confidence": 0.0-1.0}], "goals": [{"keyword": "...", "confidence": 0.0-1.0}], "triggers": [{"keyword": "...", "confidence": 0.0-1.0}]}
Max 3 items per category. Empty array if nothing detected.`;
  }

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
}

function relapseIntentPrompt(message: string, isKim: boolean): string {
  if (isKim) {
    return `You are detecting whether a caregiver is reporting their loved one's desire/urge/intention to use substances.
NOT the caregiver's own relapse (they are not the user), but reporting about their loved one.
Examples: "hij wil weer gebruiken", "ze heeft trek", "ik denk dat hij terugvalt"
User message: "${message}"
Return JSON only: {"detected": true/false, "confidence": 0.0-1.0}`;
  }
  return `You are detecting relapse INTENT: the user expressing desire/urge/intention to use substances.
NOT completed relapse, NOT past use, but current desire/plan/urge.
Examples: "ik wil weer gebruiken", "ik heb zo'n trek", "ik denk eraan om te scoren"
User message: "${message}"
Return JSON only: {"detected": true/false, "confidence": 0.0-1.0}`;
}

function relevanceScoringPrompt(message: string, context: RelevanceContext): string {
  return `Score how relevant each context block is for responding to this user message.
User message: "${message}"
Context blocks:
- Backpack (life story): ${context.backpackSummary.slice(0, 200)}
- Diary entries: ${context.diarySummary.slice(0, 200)}
- Known triggers: ${context.triggerList.slice(0, 5).join(', ')}
Return JSON only: {"backpackRelevance": 0.0-1.0, "diaryRelevance": 0.0-1.0, "triggerRelevance": 0.0-1.0, "projectionRelevance": 0.0-1.0}`;
}

function summarizeContextPrompt(context: SummarizationContext): string {
  return `Summarize this person's context in max 3 sentences (max 100 words). Focus on what's most relevant for a therapeutic response.
Life story sections: ${context.backpackSections.slice(0, 500)}
Recent session themes: ${context.recentSessionThemes.slice(0, 300)}
Return plain text only (no JSON, no quotes).`;
}

// ─── Core Implementation ────────────────────────────────────────
async function callGptMini(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        store: false,
        messages: [
          { role: 'system', content: 'You are a classification assistant. Return only the requested format. No explanations.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeoutId);
  }
}

function validateSignalArray(arr: unknown): DetectedSignal[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is { keyword: string; confidence: number } =>
      typeof item === 'object' && item !== null &&
      typeof (item as any).keyword === 'string' &&
      typeof (item as any).confidence === 'number'
    )
    .slice(0, 3)
    .map(item => ({ keyword: item.keyword, confidence: Math.max(0, Math.min(1, item.confidence)) }));
}

function clampScore(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

// ─── Public API ─────────────────────────────────────────────────
export async function runSignalEngine(
  message: string,
  userType: 'elias' | 'kim',
  context?: SignalContext,
  relevanceContext?: RelevanceContext,
  summarizationContext?: SummarizationContext,
): Promise<SignalEngineResult> {
  const start = Date.now();

  // Run all tasks in parallel with individual error handling
  const [signalsRaw, relapseRaw, relevanceRaw, summaryRaw] = await Promise.allSettled([
    callGptMini(signalDetectionPrompt(message, userType, context)),
    callGptMini(relapseIntentPrompt(message, userType === 'kim')),
    relevanceContext ? callGptMini(relevanceScoringPrompt(message, relevanceContext)) : Promise.resolve(null),
    summarizationContext ? callGptMini(summarizeContextPrompt(summarizationContext)) : Promise.resolve(null),
  ]);

  // Parse signals
  let signals = EMPTY_SIGNALS;
  if (signalsRaw.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(signalsRaw.value);
      signals = {
        fears: validateSignalArray(parsed.fears),
        hopes: validateSignalArray(parsed.hopes),
        goals: validateSignalArray(parsed.goals),
        triggers: validateSignalArray(parsed.triggers),
      };
    } catch { /* use empty */ }
  }

  // Parse relapse intent
  let relapseIntent: RelapseIntentResult = { detected: false, confidence: 0 };
  if (relapseRaw.status === 'fulfilled') {
    try {
      const parsed = JSON.parse(relapseRaw.value);
      relapseIntent = { detected: parsed.detected === true, confidence: clampScore(parsed.confidence) };
    } catch { /* use default */ }
  }

  // Parse relevance
  let relevance = NEUTRAL_SCORES;
  if (relevanceRaw.status === 'fulfilled' && relevanceRaw.value) {
    try {
      const parsed = JSON.parse(relevanceRaw.value);
      relevance = {
        backpackRelevance: clampScore(parsed.backpackRelevance),
        diaryRelevance: clampScore(parsed.diaryRelevance),
        triggerRelevance: clampScore(parsed.triggerRelevance),
        projectionRelevance: clampScore(parsed.projectionRelevance),
      };
    } catch { /* use neutral */ }
  }

  // Parse summary
  let summary: ContextSummary = { text: '' };
  if (summaryRaw.status === 'fulfilled' && summaryRaw.value) {
    summary = { text: (summaryRaw.value as string).trim().slice(0, 500) };
  }

  return {
    signals,
    relapseIntent,
    relevance,
    summary,
    latencyMs: Date.now() - start,
  };
}
