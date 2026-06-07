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

import { ELIAS_DEFAULT_STAGE } from '../engine/elias/stage-of-change';
import type { VspLevel } from '../engine/elias/vsp';

/** User type determined at intake - IMMUTABLE after assignment */
export type UserType = 'elias' | 'kim';

/** Urgency level determined at intake */
export type UrgencyLevel = 'laag' | 'midden' | 'hoog';

/** Stage of Change — mandatory, influences response depth, directness, confrontation level, intervention type */
export type StageOfChange = 'precontemplation' | 'contemplation' | 'preparation' | 'action' | 'maintenance';

/** Guidance depth — user-controlled intensity of AI companion responses */
export type GuidanceDepth = 'light' | 'normal' | 'deep';

/** Guidance depth options for UI display */
export const GUIDANCE_DEPTH_OPTIONS: { value: GuidanceDepth; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'More listening, gentle presence' },
  { value: 'normal', label: 'Normal', description: 'Balanced reflection and guidance' },
  { value: 'deep', label: 'Deep', description: 'Active probing and deeper exploration' },
];

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
  /** VSP (Vroeg Signalerings Plan) — current relapse risk state. null if not yet submitted. */
  vsp: VspLevel | null;
  /** Numeric VSP score for server payload. GROEN=1, GEEL=2, ORANJE=3, ROOD=4, PAARS=5. null if not yet submitted. */
  vspScore: number | null;
}

/** Kim slider keys */
export interface KimMoodSliders {
  stress: number;
  boundaryFatigue: number;
  emotionalBurden: number;
  selfCare: number;
  /** Eigen Regie (VSP) — current positional state. null if not yet submitted. */
  eigenRegie: number | null;
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
    return { craving: 0, frustration: 0, despondency: 0, focus: 5, vsp: null, vspScore: null };
  }
  return { stress: 0, boundaryFatigue: 0, emotionalBurden: 0, selfCare: 5, eigenRegie: null };
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

/** Kim-specific backpack section IDs */
export type KimBackpackSectionId = 'my_story' | 'the_relationship' | 'the_impact' | 'my_boundaries' | 'my_strength';

/** A single Kim backpack section */
export interface KimBackpackSection {
  id: KimBackpackSectionId;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  content: string;
  lastUpdated: string | null;
}

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
  /** Aggregated usage count across sessions */
  count: number;
}

/** A single Eigen Regie daily reflection entry (Kim users only) */
export interface EigenRegieEntry {
  /** Raw user input (0–100). UI displays this value. */
  userInput: number;
  /** Timestamp of the reflection */
  timestamp: string;
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

/**
 * Cross-session repeating pattern (loopblocker).
 * Tracks themes/signals that recur across 3+ sessions without progression.
 * When threshold is reached, triggers explicit loop-naming GPT directive.
 */
export interface RepeatingPattern {
  /** The theme/signal identifier (e.g., 'verlatingsangst', 'craving') */
  theme: string;
  /** Number of sessions where this theme appeared */
  sessionCount: number;
  /** Whether progression was detected (user showed insight/change) */
  progressionDetected: boolean;
  /** First session where this theme appeared */
  firstSeenSession: string;
  /** Last session where this theme appeared */
  lastSeenSession: string;
  /** Whether the loop has been explicitly named to the user */
  loopNamed: boolean;
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
/** Eigen Regie intake level for Kim users (1-5) */
export type EigenRegieLevel = 1 | 2 | 3 | 4 | 5;

/** Eigen Regie intake options shown to Kim users */
export const EIGEN_REGIE_INTAKE_OPTIONS: { value: EigenRegieLevel; zone: string; label: string }[] = [
  { value: 1, zone: 'ROOD', label: 'My life revolves entirely around the other person' },
  { value: 2, zone: 'ORANJE', label: 'I am mostly focused on the other person' },
  { value: 3, zone: 'GEEL', label: 'There is a mix between myself and the other person' },
  { value: 4, zone: 'LICHT GROEN', label: 'I mostly maintain my own direction' },
  { value: 5, zone: 'DONKER GROEN', label: 'I fully live my own life' },
];

export interface IntakeData {
  userName: string;
  userType: UserType;
  /** Stage of Change — Elias only. Null for Kim users. */
  stageOfChange: StageOfChange | null;
  /** Eigen Regie level — Kim only. Null for Elias users. */
  eigenRegieLevel: EigenRegieLevel | null;
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
  /** Life story narrative sections — user-written, user-edited (Elias) */
  sections: LifePhaseSection[];
  /** Kim-specific backpack sections — user-written, user-edited (Kim only) */
  kimBackpack?: {
    my_story: string;
    the_relationship: string;
    the_impact: string;
    my_boundaries: string;
    my_strength: string;
  };
  /** Intake context — captured once at onboarding */
  intakeContext: {
    /** Stage of Change — Elias only */
    stageOfChange?: StageOfChange;
    /** Eigen Regie level — Kim only (1-5) */
    eigenRegieLevel?: EigenRegieLevel;
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
  /** Mood snapshots (local within-device memory) */
  moodHistory: MoodSnapshot[];
  /** Full chat history — accumulates within device (local within-device memory) */
  chatHistory: ChatMessage[];
  /** Module usage records */
  moduleUsage: ModuleUsageRecord[];
  /** Detected recurring trigger patterns */
  triggerPatterns: TriggerPattern[];
  /** Cross-session repeating patterns without progression (loopblocker) */
  repeatingPatterns?: RepeatingPattern[];
  /** Total number of completed sessions */
  totalSessions: number;
  /** Last session date */
  lastSessionDate: string | null;
  /** Session analysis summaries — grows after each session end */
  sessionAnalyses: SessionAnalysisRecord[];
  /** Current stage of change — set at intake, may evolve over sessions */
  stageOfChange: StageOfChange;
  /** User-controlled guidance depth — affects AI response intensity */
  guidanceDepth?: GuidanceDepth;
  /** Eigen Regie daily reflections (Kim users only) */
  eigenRegieHistory?: EigenRegieEntry[];
  /** Detected relational anchors (local within-device memory) */
  relationalAnchors?: Array<{ name: string; role: string; roleEN: string; emotionalWeight: number }>;
  /** Last detected relational pattern */
  lastRelationalPattern?: { pattern: string; schema: string; confidence: number } | null;
  /** STOA sessions used in previous sessions (cross-session cooldown tracking) */
  stoaSessionsUsed?: Array<{ sessionId: number; usedAtSession: number }>;
  /** Schema/Mode: recurring mode tendencies (hybrid persistence — patterns only, never identity) */
  modeTendencies?: Array<{ modeId: string; frequency: number; lastSeen: string; effectiveInterventions: string[] }>;
  /** Schema/Mode: recurring schema tendencies (hybrid persistence — patterns only, never diagnosis) */
  schemaTendencies?: Array<{ schemaId: string; domain: string; frequency: number; lastSeen: string; copingStyle: string | null }>;
  /** ACT: progress tracking (values, preferred tools, fusion patterns, success counts) */
  actProgress?: {
    userValues: string[];
    preferredTools: string[];
    repeatedFusionPatterns: string[];
    successfulDefusionCount: number;
    successfulGroundingCount: number;
    successfulUrgeSurfingCount: number;
    valuesBasedActionsCompleted: number;
    lastACTProcessUsed: string | null;
    lastACTSessionDate: string | null;
  };
  /** CBT/CGT: progress tracking (recurring distortions, preferred tools, success counts) */
  cgtProgress?: {
    recurringDistortions: string[];
    preferredTools: string[];
    successfulReframes: number;
    successfulExperiments: number;
    relapsePatternCount: number;
    safetyBehaviorsIdentified: string[];
    avoidanceLoopsIdentified: string[];
    lastCBTProcessUsed: string | null;
    lastCBTSessionDate: string | null;
  };
  /** DGT/DBT: progress tracking (successful skills, grounding preferences, trigger patterns) */
  dgtProgress?: {
    successfulSkills: string[];
    groundingPreference: string[];
    triggerPatterns: string[];
    relapseInterruptionPatterns: string[];
    effectiveValidationDepth: string | null;
    boundarySkillSuccess: string[];
    caregiverOverloadPatterns: string[];
    lastDGTProcessUsed: string | null;
    lastDGTSessionDate: string | null;
  };
  /** MBT++: mentalizing progress tracking */
  mbtProgress?: {
    dominantMentalizingPattern: string | null;
    recurringCollapsePatterns: string[];
    successfulRepairs: number;
    successfulRegulations: number;
    boundaryProtectionsUsed: number;
    preferredResponseModes: string[];
    lastMBTProcessUsed: string | null;
    lastMBTSessionDate: string | null;
  };
  /** KO1 Recognition & Validation: Kim-only pattern tracking */
  ko1Progress?: {
    lastPatternDetected: string | null;
    lastSessionDate: string | null;
    validationPreferences: string[];
    repairPatterns: string[];
    burnoutSignalCount: number;
    reassuranceLoopCount: number;
  };
  /** K05 Communication Skills: Kim-only communication tracking */
  k05Progress?: {
    communicationTriggersDetected: string[];
    repairPatternsUsed: string[];
    escalationPatternsDetected: number;
    lastCommunicationMode: string | null;
    lastSessionDate: string | null;
    timingViolationCount: number;
  };
  k02Progress?: {
    awarenessLevel: string;
    dominantFlags: string[];
    guiltIntensity: string;
    selfLossLevel: string;
    microboundaryAttempted: boolean;
    lastSessionDate: string | null;
    sessionCount: number;
  };
  k04Progress?: {
    sessionsWithOverwhelm: number;
    sessionsWithAnger: number;
    sessionsWithGuilt: number;
    sessionsWithFear: number;
    sessionsWithNumbness: number;
    burnoutIndicatorCount: number;
    lastMicrotoolUsed: string | null;
    emotionalStabilityTrend: string;
  };
  k04s4Progress?: {
    sessionsWithTrustErosion: number;
    sessionsWithHopeExhaustion: number;
    sessionsWithHypervigilance: number;
    sessionsWithBoundaryGuilt: number;
    sessionsWithIsolation: number;
    sessionsWithChildConcern: number;
    cyclicPatternCount: number;
    trustRecoveryTrend: string;
    lastResponseMode: string;
  };
  k06Progress?: {
    sessionsInControlMode: number;
    sessionsInExhaustion: number;
    sessionsInCollapse: number;
    sessionsWithGuiltLoop: number;
    sessionsWithRelapseStress: number;
    sessionsWithSelfLoss: number;
    sessionsWithHypervigilance: number;
    sessionsInRecovery: number;
    sessionsInRebuild: number;
    blindSpotsReflected: string[];
    lastState: string;
    lastResponseMode: string;
    sustainabilityTrend: string;
    consecutiveCollapseRisk: number;
  };
  k01Progress?: {
    sessionsWithBoundaryFatigue: number;
    sessionsWithGuiltAfterBoundary: number;
    sessionsWithCollapse: number;
    sessionsWithAbandonmentFear: number;
    boundaryRepairAttempts: number;
    boundaryPracticeCount: number;
    lastInterventionType: string | null;
    lastSessionDate: string | null;
    boundaryStabilityTrend: string;
  };
  sw01Progress?: {
    sessionsWithShadowWork: number;
    loopsIdentified: string[];
    projectionsProcessed: number;
    journalPromptsGiven: number;
    lastActiveLoop: string | null;
    lastInterventionMode: string | null;
  };
  k03Progress?: {
    sessionsActivated: number;
    sessionsWithShadow: number;
    sessionsAtLevel3: number;
    shadowPartsDetected: string[];
    lastShadowPart: string;
    lastResponseLevel: string;
    lastInterventionMode: string;
    k06ReferralsMade: number;
    consecutiveLowCare: number;
  };
  /** Consecutive days with all 3 gratitude entries filled. Resets to 0 on skip. */
  gratitudeStreak: number;
  /** ISO date of last gratitude entry (for streak calculation) */
  lastGratitudeDate: string | null;
  /** ISO date string (YYYY-MM-DD) of sobriety start. User-set. Elias only. */
  sobrietyDate: string | null;
  /** ISO date (YYYY-MM-DD) of last milestone notification shown. Prevents repeat on same day. */
  lastMilestoneShown: string | null;
  /** Clinical Mode — enables therapeutic annotations in AI responses. Default: false. */
  clinicalModeActive: boolean;
  /** GDPR consent accepted by user */
  gdprAccepted?: boolean;
  /** ISO timestamp when GDPR consent was accepted */
  gdprAcceptedAt?: string;
  /** Version of GDPR terms accepted */
  gdprVersion?: string;
  /** Whether the first-chat disclaimer modal has been seen */
  firstChatSeen?: boolean;
  /** Module 98: consecutive sessions without diary, slider, or backpack engagement */
  consecutiveSessionsWithoutEngagement: number;
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
    ageRange: '6–12 years',
    prompt: 'Where did you grow up during this period? Describe the atmosphere at home, your school years, friendships, and events that made an impression on you.',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adolescence',
    label: 'Adolescence',
    ageRange: '12–18 years',
    prompt: 'How was your teenage years? How were things at home, at school, and with peers? Did you have struggles or moments of growth?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adulthood',
    label: 'Adulthood',
    ageRange: '18–50 years',
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

/** Default Kim backpack sections */
export const DEFAULT_KIM_BACKPACK_SECTIONS: KimBackpackSection[] = [
  {
    id: 'my_story',
    title: 'My Story',
    subtitle: 'Who am I outside of this relationship?',
    emoji: '👤',
    color: '#E57373',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'the_relationship',
    title: 'The Relationship',
    subtitle: 'How did it evolve? When did it change?',
    emoji: '🔗',
    color: '#81C784',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'the_impact',
    title: 'The Impact',
    subtitle: 'What has addiction done to my life, family, work?',
    emoji: '🌊',
    color: '#4DD0E1',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'my_boundaries',
    title: 'My Boundaries',
    subtitle: 'What can I carry? What have I already tried?',
    emoji: '🛡️',
    color: '#FFD54F',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'my_strength',
    title: 'My Strength',
    subtitle: 'Where do I find strength? What do I want for myself?',
    emoji: '💪',
    color: '#CE93D8',
    content: '',
    lastUpdated: null,
  },
];

/** Create default kimBackpack data from sections */
export function createDefaultKimBackpack(): Backpack['kimBackpack'] {
  return {
    my_story: '',
    the_relationship: '',
    the_impact: '',
    my_boundaries: '',
    my_strength: '',
  };
}

/** Create a new Backpack from intake data */
export function createNewBackpack(intake: IntakeData): Backpack {
  return {
    naam: intake.userName,
    userType: intake.userType,
    sections: DEFAULT_BACKPACK_SECTIONS.map((s) => ({ ...s })),
    ...(intake.userType === 'kim' ? { kimBackpack: createDefaultKimBackpack() } : {}),
    intakeContext: {
      ...(intake.stageOfChange != null ? { stageOfChange: intake.stageOfChange } : {}),
      ...(intake.eigenRegieLevel != null ? { eigenRegieLevel: intake.eigenRegieLevel } : {}),
      startEmotion: intake.startEmotion,
      urgency: intake.urgency,
      initialContext: intake.initialContext,
      intakeDate: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

/** Create a new UserDat from intake data */
export function createNewUserDat(
  userType: UserType,
  stageOfChange: StageOfChange = ELIAS_DEFAULT_STAGE,
  eigenRegieLevel?: EigenRegieLevel | null,
): UserDat {
  const mood = createDefaultSliders(userType);
  // For Kim users: convert intake eigenRegieLevel (1-5) to eigenRegie (0-100) in currentMood
  if (userType === 'kim' && eigenRegieLevel != null && 'eigenRegie' in mood) {
    // Level 1 = 0, Level 2 = 25, Level 3 = 50, Level 4 = 75, Level 5 = 100
    (mood as KimMoodSliders).eigenRegie = (eigenRegieLevel - 1) * 25;
  }
  return {
    currentMood: mood,
    moodHistory: [],
    chatHistory: [],
    moduleUsage: [],
    triggerPatterns: [],
    repeatingPatterns: [],
    totalSessions: 0,
    lastSessionDate: null,
    sessionAnalyses: [],
    stageOfChange,
    relationalAnchors: [],
    lastRelationalPattern: null,
    stoaSessionsUsed: [],
    modeTendencies: [],
    schemaTendencies: [],
    actProgress: {
      userValues: [],
      preferredTools: [],
      repeatedFusionPatterns: [],
      successfulDefusionCount: 0,
      successfulGroundingCount: 0,
      successfulUrgeSurfingCount: 0,
      valuesBasedActionsCompleted: 0,
      lastACTProcessUsed: null,
      lastACTSessionDate: null,
    },
    cgtProgress: {
      recurringDistortions: [],
      preferredTools: [],
      successfulReframes: 0,
      successfulExperiments: 0,
      relapsePatternCount: 0,
      safetyBehaviorsIdentified: [],
      avoidanceLoopsIdentified: [],
      lastCBTProcessUsed: null,
      lastCBTSessionDate: null,
    },
    dgtProgress: {
      successfulSkills: [],
      groundingPreference: [],
      triggerPatterns: [],
      relapseInterruptionPatterns: [],
      effectiveValidationDepth: null,
      boundarySkillSuccess: [],
      caregiverOverloadPatterns: [],
      lastDGTProcessUsed: null,
      lastDGTSessionDate: null,
    },
    mbtProgress: {
      dominantMentalizingPattern: null,
      recurringCollapsePatterns: [],
      successfulRepairs: 0,
      successfulRegulations: 0,
      boundaryProtectionsUsed: 0,
      preferredResponseModes: [],
      lastMBTProcessUsed: null,
      lastMBTSessionDate: null,
    },
    ko1Progress: {
      lastPatternDetected: null,
      lastSessionDate: null,
      validationPreferences: [],
      repairPatterns: [],
      burnoutSignalCount: 0,
      reassuranceLoopCount: 0,
    },
    k05Progress: {
      communicationTriggersDetected: [],
      repairPatternsUsed: [],
      escalationPatternsDetected: 0,
      lastCommunicationMode: null,
      lastSessionDate: null,
      timingViolationCount: 0,
    },
    k02Progress: {
      awarenessLevel: 'none',
      dominantFlags: [],
      guiltIntensity: 'low',
      selfLossLevel: 'low',
      microboundaryAttempted: false,
      lastSessionDate: null,
      sessionCount: 0,
    },
    k04Progress: {
      sessionsWithOverwhelm: 0,
      sessionsWithAnger: 0,
      sessionsWithGuilt: 0,
      sessionsWithFear: 0,
      sessionsWithNumbness: 0,
      burnoutIndicatorCount: 0,
      lastMicrotoolUsed: null,
      emotionalStabilityTrend: 'unknown',
    },
    k04s4Progress: {
      sessionsWithTrustErosion: 0,
      sessionsWithHopeExhaustion: 0,
      sessionsWithHypervigilance: 0,
      sessionsWithBoundaryGuilt: 0,
      sessionsWithIsolation: 0,
      sessionsWithChildConcern: 0,
      cyclicPatternCount: 0,
      trustRecoveryTrend: 'unknown',
      lastResponseMode: 'none',
    },
    k06Progress: {
      sessionsInControlMode: 0,
      sessionsInExhaustion: 0,
      sessionsInCollapse: 0,
      sessionsWithGuiltLoop: 0,
      sessionsWithRelapseStress: 0,
      sessionsWithSelfLoss: 0,
      sessionsWithHypervigilance: 0,
      sessionsInRecovery: 0,
      sessionsInRebuild: 0,
      blindSpotsReflected: [],
      lastState: 'none',
      lastResponseMode: 'none',
      sustainabilityTrend: 'unknown',
      consecutiveCollapseRisk: 0,
    },
    k01Progress: {
      sessionsWithBoundaryFatigue: 0,
      sessionsWithGuiltAfterBoundary: 0,
      sessionsWithCollapse: 0,
      sessionsWithAbandonmentFear: 0,
      boundaryRepairAttempts: 0,
      boundaryPracticeCount: 0,
      lastInterventionType: null,
      lastSessionDate: null,
      boundaryStabilityTrend: 'unknown',
    },
    sw01Progress: {
      sessionsWithShadowWork: 0,
      loopsIdentified: [],
      projectionsProcessed: 0,
      journalPromptsGiven: 0,
      lastActiveLoop: null,
      lastInterventionMode: null,
    },
    k03Progress: {
      sessionsActivated: 0,
      sessionsWithShadow: 0,
      sessionsAtLevel3: 0,
      shadowPartsDetected: [],
      lastShadowPart: 'none',
      lastResponseLevel: 'level_1',
      lastInterventionMode: 'none',
      k06ReferralsMade: 0,
      consecutiveLowCare: 0,
    },
    gratitudeStreak: 0,
    lastGratitudeDate: null,
    sobrietyDate: null,
    lastMilestoneShown: null,
    clinicalModeActive: false,
    consecutiveSessionsWithoutEngagement: 0,
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
  /** Optional gratitude entries — 3 things the user is grateful for */
  gratitude?: {
    entry1: string;
    entry2: string;
    entry3: string;
  };
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
  /** Whether the resolved zone is a crisis state (PAARS / severity 5). From ResolvedEliasZone.isCrisis. */
  isCrisis?: boolean;
  /** VSP level for Elias users (GROEN/GEEL/ORANJE/ROOD/PAARS) — used for model routing */
  vspLevel?: string | null;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: UrgencyLevel;
  startEmotion: string;
  /** Stable buffer snapshot — injected by pipeline, used by provider for GPT payload */
  bufferSnapshot?: import('../rugzak/short-term-memory-buffer').BufferSnapshot;
  /** User-controlled guidance depth — affects response intensity */
  guidanceDepth?: GuidanceDepth;
  /** Regulation result from the regulation layer — injected by pipeline */
  regulationResult?: {
    action: string;
    intervention: string | null;
    gptInstruction: string | null;
    zone: string;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  };
  /** Routed engine directive — Elias OR Kim, never both. Injected by pipeline via orchestration routing. */
  engineDirective?: import('../engine/orchestration').EngineDirective;
  /** Intervention continuity context — injected by pipeline for Elias, enables consistent therapeutic line */
  interventionContinuity?: string;
  /** Projection layer context — future-facing fears/hopes/goals detected from user signals */
  projectionContext?: string;
  /** Projection deepening directive — instruction for GPT to explore future projections when safe */
  projectionDeepening?: string;
  /** Signal engine: detected signals from current message (fears, hopes, goals, triggers) */
  candidateSignals?: {
    fears: { keyword: string; confidence: number }[];
    hopes: { keyword: string; confidence: number }[];
    goals: { keyword: string; confidence: number }[];
    triggers: { keyword: string; confidence: number }[];
  };
  /** Signal engine: relevance scores for context blocks */
  relevanceScores?: {
    backpackRelevance: number;
    diaryRelevance: number;
    triggerRelevance: number;
    projectionRelevance: number;
  };
  /** Signal engine: compressed context summary for LIVE_MESSAGE (replaces full lifeStorySummary) */
  contextSummary?: string;
  /** STOA engine: injection block for Stoic session (Elias only) */
  stoaContext?: string;
  /** Schema/Mode engine: compact intervention context from deterministic mode/schema detection */
  schemaModeContext?: string;
  actContext?: string;
  /** CBT/CGT engine: compact intervention context from deterministic distortion/signal detection */
  cgtContext?: string;
  /** DGT/DBT engine: compact intervention context from deterministic emotional/behavioral signal detection */
  dgtContext?: string;
  /** MBT++ engine: mentalizing state detection + response mode routing */
  mbtContext?: string;
  /** KO1 Recognition & Validation engine: Kim-only pattern detection + validation levels */
  ko1Context?: string;
  /** K05 Communication Skills engine: Kim-only communication context + timing + framework */
  k05Context?: string;
  k02Context?: string;
  k04Context?: string;
  k04s4Context?: string;
  k06Context?: string;
  k01Context?: string;
  k03Context?: string;
  sw01Context?: string;
  sto01Context?: string;
  kst01Context?: string;
  kdl01Context?: string;
  kbr01Context?: string;
  ksc01Context?: string;
  /** Whether the user's backpack is empty (no sections filled) — used for greeting tone adaptation */
  backpackEmpty?: boolean;
  /** LOOPBLOCKER: cross-session repeating pattern directive for GPT (injected by pipeline) */
  loopDetected?: {
    active: true;
    theme: string;
    sessionCount: number;
    instruction: string;
  };
  /** LANGUAGE_RECOVERY: diminishing negative intensity detected in user language */
  languageRecovery?: {
    detected: true;
    theme: string;
    delta: number;
    instruction: string;
  };
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
  selectedModel?: string;
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
