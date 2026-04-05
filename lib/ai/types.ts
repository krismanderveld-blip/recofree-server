/**
 * RecoFree AI Provider Types
 *
 * CRITICAL ARCHITECTURE RULES:
 * 1. Emotion detection is owned by the Elias/Kim logic layer, NOT the AI provider.
 *    The AI provider may return advisory signals, but these are NEVER authoritative.
 * 2. userType is IMMUTABLE after intake. No runtime switching between Elias and Kim.
 * 3. The backend (Elias/Kim logic) is the single source of truth for:
 *    - Detected emotion, user state, module selection, crisis level, therapeutic stance
 * 4. The Rugzak is an ACTIVE therapeutic engine, not passive storage.
 *    It actively influences: module selection, tone, crisis detection, suggestion intensity.
 * 5. State persists across sessions — it does NOT reset per chat.
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

/** A single mood snapshot with timestamp */
export interface MoodSnapshot {
  sliders: MoodSliders;
  timestamp: string;
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

/** Life-phase section IDs for the Rugzak narrative document */
export type LifePhaseId = 'childhood' | 'adolescence' | 'adulthood' | 'family' | 'themes';

/**
 * A single life-phase section in the Rugzak.
 * Each section is a free-text narrative field where the user
 * writes their story for that life phase.
 */
export interface LifePhaseSection {
  id: LifePhaseId;
  label: string;
  ageRange: string;
  prompt: string;
  content: string;
  lastUpdated: string | null;
}

/** A record of module usage for tracking */
export interface ModuleUsageRecord {
  moduleId: string;
  usedAt: string;
  context: string; // Brief context of why it was triggered
}

/** A detected trigger pattern */
export interface TriggerPattern {
  trigger: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/**
 * Rugzak (backpack) - ACTIVE therapeutic engine.
 *
 * The Rugzak is NOT passive storage. It is a living system that:
 * 1. Stores the user's life-story narrative (5 sections)
 * 2. Maintains persistent state (mood, craving, stimuli, social)
 * 3. Tracks full chat history across sessions
 * 4. Detects and accumulates trigger patterns over time
 * 5. Records module usage for context
 *
 * On EVERY message:
 * 1. Read current state
 * 2. Update state based on input
 * 3. Pass updated state into module selection + response generation
 * 4. Store state again
 *
 * The Rugzak ACTIVELY influences:
 * - Module selection (trigger patterns + mood trajectory)
 * - Tone (mood trajectory + history depth adjusts warmth/directness)
 * - Crisis detection (pattern accumulation raises baseline sensitivity)
 * - Suggestion intensity (low engagement + high craving = more assertive)
 */
export interface Rugzak {
  naam: string;
  userType: UserType;

  // ── Narrative Layer ──
  sections: LifePhaseSection[];

  // ── Persistent State Layer ──
  currentMood: MoodSliders;
  moodHistory: MoodSnapshot[]; // Accumulates across sessions
  chatHistory: ChatMessage[]; // Full history, never reset
  moduleUsage: ModuleUsageRecord[]; // What modules were used when
  triggerPatterns: TriggerPattern[]; // Detected recurring triggers

  // ── Intake Context ──
  intakeContext: {
    startEmotion: string;
    urgency: UrgencyLevel;
    initialContext: string;
    intakeDate: string;
  };

  // ── Meta ──
  lastSessionDate: string | null;
  totalSessions: number;
  createdAt: string;
}

/** Default sections for a new Rugzak */
export const DEFAULT_RUGZAK_SECTIONS: LifePhaseSection[] = [
  {
    id: 'childhood',
    label: 'Childhood',
    ageRange: '6\u201312 years',
    prompt: 'Where did you grow up during this period? Describe the atmosphere at home, your school years, friendships, and events that made an impression on you.',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adolescence',
    label: 'Adolescence',
    ageRange: '12\u201318 years',
    prompt: 'How was your teenage years? How were things at home, at school, and with peers? Did you have struggles or moments of growth?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adulthood',
    label: 'Adulthood',
    ageRange: '18\u201350 years',
    prompt: 'What are important choices or events in your adult life? Think about work, relationships, children, addiction, loss, growth, or meaning.',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'family',
    label: 'Family',
    ageRange: 'Throughout life',
    prompt: 'How has your relationship with your parents or family been? Are there patterns, loyalties, or tensions that still influence you today?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'themes',
    label: 'Recurring Themes',
    ageRange: 'Across all phases',
    prompt: 'Are there recurring themes, beliefs, or inner struggles that you recognize across these life phases?',
    content: '',
    lastUpdated: null,
  },
];

/** Create a fresh Rugzak for a new user */
export function createNewRugzak(intake: IntakeData): Rugzak {
  return {
    naam: intake.userName,
    userType: intake.userType,
    sections: DEFAULT_RUGZAK_SECTIONS.map((s) => ({ ...s })),
    currentMood: { stemming: 5, craving: 0, overprikkeling: 3, sociaal: 5 },
    moodHistory: [],
    chatHistory: [],
    moduleUsage: [],
    triggerPatterns: [],
    intakeContext: {
      startEmotion: intake.startEmotion,
      urgency: intake.urgency,
      initialContext: intake.initialContext,
      intakeDate: new Date().toISOString(),
    },
    lastSessionDate: null,
    totalSessions: 0,
    createdAt: new Date().toISOString(),
  };
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

/**
 * Rugzak influence output — computed by the Rugzak engine
 * and passed into module selection + response generation.
 */
export interface RugzakInfluence {
  /** Adjusted tone: 'warm' | 'grounding' | 'assertive' | 'crisis' */
  tone: 'warm' | 'grounding' | 'assertive' | 'crisis';
  /** Mood trajectory: 'improving' | 'stable' | 'declining' | 'volatile' */
  moodTrajectory: 'improving' | 'stable' | 'declining' | 'volatile';
  /** How assertive suggestions should be (0-10) */
  suggestionIntensity: number;
  /** Elevated crisis sensitivity based on pattern accumulation */
  crisisSensitivityBoost: number;
  /** Module IDs that are especially relevant given history */
  priorityModules: string[];
  /** Recurring trigger keywords detected over time */
  activePatterns: string[];
}
