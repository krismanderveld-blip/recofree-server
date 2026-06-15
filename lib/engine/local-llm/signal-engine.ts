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

export interface RelapseIntentResult {
  /** Whether relapse intent was detected */
  detected: boolean;
  /** Confidence score 0.0 - 1.0 */
  confidence: number;
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

export interface RelevanceContext {
  backpackSummary: string;
  diarySummary: string;
  triggerList: string[];
}

export interface SummarizationContext {
  backpackSections: string;
  recentSessionThemes: string;
}

/** Context passed to detectSignals for recovery-aware signal detection */
export interface SignalContext {
  zone: string;
  vspOrEigenRegie: string | number | null;
  keySliders: Record<string, unknown>;
  userType: 'elias' | 'kim';
  activeProjections?: Array<{ category: string; content: string; strength: string }>;
}

// ─── Interface ──────────────────────────────────────────────────

export interface LocalSignalEngine {
  /** Whether the engine is ready to process requests */
  isReady(): boolean;

  /** Detect signals (fears, hopes, goals, triggers) in a single message */
  detectSignals(message: string, context?: SignalContext): Promise<SignalDetectionResult>;

  /**
   * Detect relapse intent: user expressing desire/urge/intention to use substances.
   * Distinct from completed relapse (handled by crisis detector).
   * Language-agnostic via GPT-4o-mini.
   */
  detectRelapseIntent(message: string): Promise<RelapseIntentResult>;

  /**
   * Detect THIRD-PERSON relapse intent: caregiver reporting loved one's desire/urge/intention to use.
   * Kim-specific semantic detection. Language-agnostic via GPT-4o-mini.
   */
  detectKimRelapseIntent(message: string): Promise<RelapseIntentResult>;

  /** Score relevance of context blocks for the current message */
  scoreRelevance(message: string, context: RelevanceContext): Promise<RelevanceScores>;

  /** Summarize context into max 3 sentences for GPT payload optimization */
  summarizeContext(context: SummarizationContext): Promise<ContextSummary>;
}
