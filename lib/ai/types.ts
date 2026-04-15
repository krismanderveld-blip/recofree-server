/**
 * RecoFree AI Provider Types — DUAL-STORE ARCHITECTURE
 *
 * TWO SEPARATE DATA SOURCES:
 *
 *   backpack.json → Stable, user-defined identity
 *     - NEVER auto-modified by the system
 *     - NEVER summarized or truncated
 *     - Only the user can edit (via Backpack screen)
 *     - Contains: name, userType, life story sections, intake context, createdAt
 *
 *   user.dat → Dynamic session memory
 *     - Updated ONLY at session end via analysis pipeline
 *     - Can grow over time (triggers, mood history, session analyses)
 *     - Contains: currentMood, moodHistory, chatHistory, moduleUsage, triggerPatterns, totalSessions, etc.
 *
 * AT SESSION START:
 *   Send BOTH completely to GPT. No compression, no character limits, no summarization.
 *
 * DURING SESSION:
 *   AI reads both but does NOT modify them.
 *
 * AT SESSION END:
 *   Only user.dat is updated via analysis.
 *   The backpack remains unchanged unless explicitly edited by the user.
 *
 * CRITICAL RULE:
 *   The backpack is the anchor of identity.
 *   If it is reduced or summarized, the system loses consistency and reliability.
 *   This is NOT a token optimization problem. This is a core architectural requirement.
 */

/** User type determined at intake - IMMUTABLE after assignment */
export type UserType = 'elias' | 'kim';

/** Urgency level determined at intake */
export type UrgencyLevel = 'laag' | 'midden' | 'hoog';

/** Stage of Change — mandatory, influences response depth, directness, confrontation level, intervention type */
export type StageOfChange = 'precontemplation' | 'contemplation' | 'preparation' | 'action' | 'maintenance';

/** Stage of Change labels for UI display */
export const STAGE_OF_CHANGE_OPTIONS: { value: StageOfChange; label: string; description: string }[] = [
  { value: 'precontemplation', label: 'Not ready yet', description: 'I\'m not sure I need to change anything right now.' },
  { value: 'contemplation', label: 'Thinking about it', description: 'I\'m starting to think about making a change.' },
  { value: 'preparation', label: 'Getting ready', description: 'I\'m planning to take action soon.' },
  { value: 'action', label: 'Taking action', description: 'I\'m actively working on change right now.' },
  { value: 'maintenance', label: 'Maintaining', description: 'I\'ve made changes and I\'m working to keep them.' },
];

// ─── Slider Types ──────────────────────────────────────────────

/** Elias slider keys */
export interface EliasMoodSliders {
  craving: number;
  frustration: number;
  despondency: number;
  focus: number;
}

/** Kim slider keys */
export interface KimMoodSliders {
  stress: number;
  boundaryFatigue: number;
  emotionalBurden: number;
  selfCare: number;
}

/** Union type — runtime value depends on userType */
export type MoodSliders = EliasMoodSliders | KimMoodSliders;

/** Intervention threshold definition */
export interface InterventionThreshold {
  level: 'mild' | 'moderate' | 'severe';
  value: number;
}

/** Slider metadata for UI rendering and logic */
export interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  thresholds: InterventionThreshold[];
  /** If true, higher values are GOOD (e.g., focus, selfCare). Alerts trigger on LOW values. */
  inverted?: boolean;
}

/** Elias slider configuration */
export const ELIAS_SLIDER_CONFIG: SliderConfig[] = [
  { key: 'craving', label: 'Craving', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'frustration', label: 'Frustration', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'despondency', label: 'Despondency', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'focus', label: 'Mental Focus', min: 0, max: 10, inverted: true, thresholds: [{ level: 'mild', value: 5 }, { level: 'moderate', value: 3 }, { level: 'severe', value: 1 }] },
];

/** Kim slider configuration */
export const KIM_SLIDER_CONFIG: SliderConfig[] = [
  { key: 'stress', label: 'Stress', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'boundaryFatigue', label: 'Boundary Fatigue', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'emotionalBurden', label: 'Emotional Burden', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'selfCare', label: 'Self-care', min: 0, max: 10, inverted: true, thresholds: [{ level: 'mild', value: 5 }, { level: 'moderate', value: 3 }, { level: 'severe', value: 1 }] },
];

/** Get slider config for a given user type */
export function getSliderConfig(userType: UserType): SliderConfig[] {
  return userType === 'elias' ? ELIAS_SLIDER_CONFIG : KIM_SLIDER_CONFIG;
}

/** Create default slider values for a given user type */
export function createDefaultSliders(userType: UserType): MoodSliders {
  if (userType === 'elias') {
    return { craving: 0, frustration: 0, despondency: 0, focus: 5 };
  }
  return { stress: 0, boundaryFatigue: 0, emotionalBurden: 0, selfCare: 5 };
}

/** Check which sliders exceed intervention thresholds */
export function checkInterventions(sliders: MoodSliders, userType: UserType): { key: string; label: string; level: 'mild' | 'moderate' | 'severe' }[] {
  const config = getSliderConfig(userType);
  const alerts: { key: string; label: string; level: 'mild' | 'moderate' | 'severe' }[] = [];
  for (const sc of config) {
    const value = (sliders as any)[sc.key] as number;
    if (value == null) continue;
    if (sc.inverted) {
      const sorted = [...sc.thresholds].sort((a, b) => a.value - b.value);
      for (const t of sorted) {
        if (value <= t.value) {
          alerts.push({ key: sc.key, label: sc.label, level: t.level });
          break;
        }
      }
    } else {
      const sorted = [...sc.thresholds].sort((a, b) => b.value - a.value);
      for (const t of sorted) {
        if (value >= t.value) {
          alerts.push({ key: sc.key, label: sc.label, level: t.level });
          break;
        }
      }
    }
  }
  return alerts;
}

// ─── Shared Sub-Types ──────────────────────────────────────────

/** A single mood snapshot with timestamp */
export interface MoodSnapshot {
  sliders: MoodSliders;
  timestamp: string;
}

/** Life-phase section IDs for the Backpack narrative document */
export type LifePhaseId = 'childhood' | 'adolescence' | 'adulthood' | 'family' | 'themes';

/**
 * A single life-phase section in the Backpack.
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
  context: string;
}

/** A detected trigger pattern */
export interface TriggerPattern {
  trigger: string;
  count: number;
  /** Trigger weight on 0–50 internal scale (Patch G). Legacy 0–5 values auto-migrate via *10. */
  weight?: number;
  firstSeen: string;
  lastSeen: string;
}

/** Chat message in conversation history */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modulesUsed?: string[];
}

/** Intake data collected during onboarding */
export interface IntakeData {
  userName: string;
  userType: UserType;
  stageOfChange: StageOfChange;
  startEmotion: string;
  urgency: UrgencyLevel;
  initialContext: string;
}

// ─── BACKPACK (backpack.json) — STABLE IDENTITY ────────────────

/**
 * Backpack — the anchor of identity.
 *
 * RULES:
 * - NEVER auto-modified by the system
 * - NEVER summarized, truncated, or compressed
 * - Only the user can edit (via Backpack screen)
 * - Always sent in full to GPT at session start
 * - This is NOT a token optimization problem
 */
export interface Backpack {
  /** User's name */
  naam: string;
  /** User type — IMMUTABLE after intake */
  userType: UserType;
  /** Life story narrative sections — user-written, user-edited */
  sections: LifePhaseSection[];
  /** Intake context — captured once at onboarding */
  intakeContext: {
    stageOfChange: StageOfChange;
    startEmotion: string;
    urgency: UrgencyLevel;
    initialContext: string;
    intakeDate: string;
  };
  /** When the backpack was created */
  createdAt: string;
}

// ─── USER.DAT — DYNAMIC SESSION MEMORY ─────────────────────────

/**
 * UserDat — dynamic session memory.
 *
 * RULES:
 * - Updated ONLY at session end via analysis pipeline
 * - Can grow over time (new triggers, mood snapshots, session analyses)
 * - System-managed, not user-edited
 * - Always sent in full to GPT at session start
 */
export interface UserDat {
  /** Current mood slider values */
  currentMood: MoodSliders;
  /** Mood snapshots across sessions */
  moodHistory: MoodSnapshot[];
  /** Full chat history — never reset, accumulates across sessions */
  chatHistory: ChatMessage[];
  /** Module usage records */
  moduleUsage: ModuleUsageRecord[];
  /** Detected recurring trigger patterns */
  triggerPatterns: TriggerPattern[];
  /** Total number of completed sessions */
  totalSessions: number;
  /** Last session date */
  lastSessionDate: string | null;
  /** Session analysis summaries — grows after each session end */
  sessionAnalyses: SessionAnalysisRecord[];
  /** Current stage of change — set at intake, may evolve over sessions */
  stageOfChange: StageOfChange;
  /** Detected relational anchors — persisted across sessions */
  relationalAnchors?: Array<{ name: string; role: string; roleEN: string; emotionalWeight: number }>;
  /** Last detected relational pattern */
  lastRelationalPattern?: { pattern: string; schema: string; confidence: number } | null;
}

/** A record of a completed session's analysis */
export interface SessionAnalysisRecord {
  sessionNumber: number;
  date: string;
  messageCount: number;
  durationMinutes: number;
  dominantEmotion: string;
  themes: string[];
  newTriggers: string[];
  modulesUsed: string[];
  moodDelta: {
    distressChange: number;
    resilienceChange: number;
  };
  endRiskLevel: string;
}

// ─── RUGZAK — COMPOSED VIEW (backward compatibility) ───────────

/**
 * Rugzak — composed view of Backpack + UserDat.
 *
 * This type exists for backward compatibility with the engine,
 * state-analyzer, and pipeline. It is a READ-ONLY view that
 * combines both stores. It should NEVER be persisted directly.
 *
 * Use `composeRugzak(backpack, userDat)` to create this view.
 */
export interface Rugzak {
  naam: string;
  userType: UserType;
  sections: LifePhaseSection[];
  currentMood: MoodSliders;
  moodHistory: MoodSnapshot[];
  chatHistory: ChatMessage[];
  moduleUsage: ModuleUsageRecord[];
  triggerPatterns: TriggerPattern[];
  intakeContext: {
    startEmotion: string;
    urgency: UrgencyLevel;
    initialContext: string;
    intakeDate: string;
  };
  lastSessionDate: string | null;
  totalSessions: number;
  createdAt: string;
}

// ─── Factory Functions ─────────────────────────────────────────

/** Default sections for a new Backpack */
export const DEFAULT_BACKPACK_SECTIONS: LifePhaseSection[] = [
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

// Keep old name as alias for backward compatibility in tests
export const DEFAULT_RUGZAK_SECTIONS = DEFAULT_BACKPACK_SECTIONS;

/** Create a new Backpack from intake data */
export function createNewBackpack(intake: IntakeData): Backpack {
  return {
    naam: intake.userName,
    userType: intake.userType,
    sections: DEFAULT_BACKPACK_SECTIONS.map((s) => ({ ...s })),
    intakeContext: {
      stageOfChange: intake.stageOfChange,
      startEmotion: intake.startEmotion,
      urgency: intake.urgency,
      initialContext: intake.initialContext,
      intakeDate: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

/** Create a new UserDat from intake data */
export function createNewUserDat(userType: UserType, stageOfChange: StageOfChange = 'contemplation'): UserDat {
  return {
    currentMood: createDefaultSliders(userType),
    moodHistory: [],
    chatHistory: [],
    moduleUsage: [],
    triggerPatterns: [],
    totalSessions: 0,
    lastSessionDate: null,
    sessionAnalyses: [],
    stageOfChange,
    relationalAnchors: [],
    lastRelationalPattern: null,
  };
}

/** Compose a Rugzak view from Backpack + UserDat (READ-ONLY, never persist this) */
export function composeRugzak(backpack: Backpack, userDat: UserDat): Rugzak {
  return {
    naam: backpack.naam,
    userType: backpack.userType,
    sections: backpack.sections,
    currentMood: userDat.currentMood,
    moodHistory: userDat.moodHistory,
    chatHistory: userDat.chatHistory,
    moduleUsage: userDat.moduleUsage,
    triggerPatterns: userDat.triggerPatterns,
    intakeContext: backpack.intakeContext,
    lastSessionDate: userDat.lastSessionDate,
    totalSessions: userDat.totalSessions,
    createdAt: backpack.createdAt,
  };
}

/** Create a Rugzak from intake (backward compatibility for tests) */
export function createNewRugzak(intake: IntakeData): Rugzak {
  const backpack = createNewBackpack(intake);
  const userDat = createNewUserDat(intake.userType);
  return composeRugzak(backpack, userDat);
}

// ─── Diary Entry (shared type for AI context) ────────────────

/** A diary entry written by the user */
export interface DiaryEntry {
  id: string;
  content: string;
  moodTag: string;
  timestamp: string;
}

// ─── Context Types ─────────────────────────────────────────────

/** Full context passed to the AI provider for response generation */
export interface ChatContext {
  userType: UserType;
  userName: string;
  currentMessage: string;
  conversationHistory: ChatMessage[];
  moodSliders: MoodSliders;
  /** The composed Rugzak view — for engine/analyzer compatibility */
  rugzak: Rugzak;
  /** The raw Backpack — sent in full to GPT, NEVER modified */
  backpack: Backpack;
  /** The raw UserDat — sent in full to GPT, updated only at session end */
  userDat: UserDat;
  /** Whether this is the first message of the session (backpack+userDat sent in full) */
  isSessionStart: boolean;
  /** Recent diary entries — included at session start for AI context */
  diaryEntries: DiaryEntry[];
  activeModules: string[];
  crisisLevel: number;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: UrgencyLevel;
  startEmotion: string;
  /** Stable buffer snapshot — injected by pipeline, used by provider for GPT payload */
  bufferSnapshot?: import('../rugzak/short-term-memory-buffer').BufferSnapshot;
}

/**
 * Result returned by the AI provider.
 *
 * advisoryEmotion and advisoryConfidence are OPTIONAL HINTS from the LLM.
 * They are NOT authoritative.
 */
export interface AIResult {
  response: string;
  advisoryEmotion?: string;
  advisoryConfidence?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Abstract AI Provider interface.
 * The provider is ONLY responsible for language formulation.
 */
export interface AIProvider {
  generateResponse(context: ChatContext): Promise<AIResult>;
}

/**
 * Rugzak influence output — computed by the Rugzak engine
 * and passed into module selection + response generation.
 */
export interface RugzakInfluence {
  tone: 'warm' | 'grounding' | 'assertive' | 'crisis';
  moodTrajectory: 'improving' | 'stable' | 'declining' | 'volatile';
  suggestionIntensity: number;
  crisisSensitivityBoost: number;
  priorityModules: string[];
  activePatterns: string[];
}
