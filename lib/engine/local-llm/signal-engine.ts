/**
 * LocalSignalEngine Interface
 *
 * Defines the contract for preprocessing engines that run BEFORE the main GPT call.
 * The engine performs three small classification tasks on a single user message:
 *
 * 1. Signal Detection — extract fears, hopes, goals, triggers with confidence scores
 * 2. Relevance Scoring — score how relevant context blocks are for the current message
 * 3. Context Summarization — compress backpack + session into max 3 sentences
 *
 * Implementations:
 * - GptSignalEngine: server-side via GPT-4o-mini (default, always available)
 * - NullSignalEngine: returns empty/neutral values (fallback)
 *
 * The engine does NOT:
 * - Conduct conversations with the user
 * - Make therapeutic decisions
 * - Replace GPT-4o for response generation
 * - Access the chat interface directly
 */

// ─── Output Types ───────────────────────────────────────────────

export interface DetectedSignal {
  keyword: string;
  confidence: number; // 0.0 - 1.0
}

export interface SignalDetectionResult {
  fears: DetectedSignal[];
  hopes: DetectedSignal[];
  goals: DetectedSignal[];
  triggers: DetectedSignal[];
}

export interface RelevanceScores {
  backpackRelevance: number; // 0.0 - 1.0
  diaryRelevance: number;   // 0.0 - 1.0
  triggerRelevance: number;  // 0.0 - 1.0
  projectionRelevance: number; // 0.0 - 1.0
}

export interface ContextSummary {
  text: string; // max 3 sentences, plain text, max 100 words
}

// ─── Context Input Types ────────────────────────────────────────

/** Optional emotional context passed to detectSignals for richer signal detection */
export interface SignalContext {
  zone: string;            // current zone color (GREEN, YELLOW, ORANGE, RED, PURPLE)
  vspOrEigenRegie: string; // VSP level (Elias) or eigenRegie score (Kim)
  keySliders: Record<string, number>; // key slider values (e.g. despondency, craving, stress)
  userType?: 'elias' | 'kim'; // user type for prompt routing (Elias = addiction, Kim = caregiver)
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

// ─── Interface ──────────────────────────────────────────────────

export interface LocalSignalEngine {
  /** Whether the engine is ready to process requests */
  isReady(): boolean;

  /** Detect signals (fears, hopes, goals, triggers) in a single message */
  detectSignals(message: string, context?: SignalContext): Promise<SignalDetectionResult>;

  /** Score relevance of context blocks for the current message */
  scoreRelevance(message: string, context: RelevanceContext): Promise<RelevanceScores>;

  /** Summarize context into max 3 sentences for GPT payload optimization */
  summarizeContext(context: SummarizationContext): Promise<ContextSummary>;
}
