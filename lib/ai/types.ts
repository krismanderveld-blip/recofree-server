/**
 * RecoFree AI Provider Types
 *
 * CRITICAL ARCHITECTURE RULES:
 * 1. Emotion detection is owned by the Elias/Kim logic layer, NOT the AI provider.
 *    The AI provider may return advisory signals, but these are NEVER authoritative.
 * 2. userType is IMMUTABLE after intake. No runtime switching between Elias and Kim.
 * 3. The backend (Elias/Kim logic) is the single source of truth for:
 *    - Detected emotion, user state, module selection, crisis level, therapeutic stance
 */

/** User type determined at intake - IMMUTABLE after assignment */
export type UserType = 'elias' | 'kim';

/** Urgency level determined at intake */
export type UrgencyLevel = 'laag' | 'midden' | 'hoog';

/** Mood slider values (0-10 scale) */
export interface MoodSliders {
  stemming: number;
  craving: number;
  overprikkeling: number;
  sociaal: number;
}

/**
 * Intake data collected during onboarding.
 * This forms the initial state baseline for Elias or Kim.
 * userType is permanent and cannot be changed after intake.
 */
export interface IntakeData {
  userName: string;
  userType: UserType;
  startEmotion: string;
  urgency: UrgencyLevel;
  initialContext: string;
}

/** Rugzak (backpack) - user's meaning-structure context */
export interface Rugzak {
  naam: string;
  userType: UserType;
  entries: Record<string, string>;
}

/** Chat message in conversation history */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modulesUsed?: string[];
}

/** Full context passed to the AI provider for response generation */
export interface ChatContext {
  userType: UserType;
  userName: string;
  currentMessage: string;
  conversationHistory: ChatMessage[];
  moodSliders: MoodSliders;
  rugzak: Rugzak;
  activeModules: string[];
  crisisLevel: number;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: UrgencyLevel;
  startEmotion: string;
}

/**
 * Result returned by the AI provider.
 *
 * advisoryEmotion and advisoryConfidence are OPTIONAL HINTS from the LLM.
 * They are NOT authoritative. The Elias/Kim logic layer is the
 * single source of truth for emotion detection and state.
 */
export interface AIResult {
  response: string;
  advisoryEmotion?: string;
  advisoryConfidence?: number;
}

/**
 * Abstract AI Provider interface.
 * The provider is ONLY responsible for language formulation.
 * All therapeutic logic happens in the Elias/Kim logic layer.
 */
export interface AIProvider {
  generateResponse(context: ChatContext): Promise<AIResult>;
}
