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
import { LocalDeviceTimeService } from "@/lib/core/time";

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
export type LifePhaseId = 'childhood' | 'adolescence' | 'adulthood' | 'family' | 'themes' | 'vsp';

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
  /** ISO timestamp — moment of first detection, NEVER overwritten */
  firstDetectedAt?: string;
  /** ISO timestamp — moment of last reinforcement or update */
  lastUpdatedAt?: string;
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
  /** Engine decision metadata for clinical mode dropdown (populated locally, no GPT dependency) */
  clinicalInfo?: {
    module: string;
    zone: string;
    model: string;
    regulation?: string;
    riskScore?: number;
    source?: string;
    triggers?: string;
    projection?: string;
    intervention?: string;
    buffer?: string;
    k05Override?: { fired: boolean; method?: string; layer1?: { boundary: boolean; repair: boolean }; debugLog?: string[] };
    safetyFilters?: Array<{ filter: string; module?: string; categories: string[]; violations: number }>;
    cmd?: string;
    formulation?: string;
    route?: string;
    epistemic?: string;
    modelRoute?: string;
    cost?: string;
    contextDat?: string;
    anchors?: string;
    clinicalCtx?: string;
    deepAnalysis?: string;
    nanoSelector?: string;
  clinicalFactors?: string;
    moduleMemory?: string;
    projectionsDat?: string;
  };
  /** Schema/Mode detection result for clinical confirmation UI */
  schemaModeResult?: {
    dominantMode?: string | null;
    dominantSchema?: string | null;
    acceptedModes?: string[];
    acceptedSchemas?: string[];
  };
}

/** Intake data collected during onboarding */
/** Eigen Regie intake level for Kim users (1-5) */
export type EigenRegieLevel = 1 | 2 | 3 | 4 | 5;

/** Eigen Regie intake options shown to Kim users */
export const EIGEN_REGIE_INTAKE_OPTIONS: { value: EigenRegieLevel; zone: string; label: string }[] = [
  { value: 1, zone: 'RED', label: 'My life revolves entirely around the other person' },
  { value: 2, zone: 'ORANGE', label: 'I am mostly focused on the other person' },
  { value: 3, zone: 'YELLOW', label: 'There is a mix between myself and the other person' },
  { value: 4, zone: 'LIGHT GREEN', label: 'I mostly maintain my own direction' },
  { value: 5, zone: 'DARK GREEN', label: 'I fully live my own life' },
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

// ─── VSP STRUCTURED PLAN ────────────────────────────────────────────────

/** A single zone entry in the structured VSP */
export interface VspZoneEntry {
  /** How the user recognizes themselves in this zone (signals, thoughts, behaviors) */
  signals: string;
  /** What helps in this zone (concrete actions, strategies) */
  whatHelps: string;
  /** Personal anchor sentence for this zone */
  anchorSentence: string;
}

/** A personal trigger with counter-thought */
export interface VspTrigger {
  /** The trigger description */
  trigger: string;
  /** The counter-thought ("tegenzin") */
  counterThought: string;
}

/** The full structured VSP (Veiligheidsplan) */
export interface VspStructuredPlan {
  /** Per-zone content */
  zones: {
    green: VspZoneEntry;
    yellow: VspZoneEntry;
    orange: VspZoneEntry;
    red: VspZoneEntry;
    purple: VspZoneEntry;
  };
  /** Personal triggers with counter-thoughts */
  triggers: VspTrigger[];
  /** Personal recovery rules */
  recoveryRules: string[];
  /** The overarching anchor sentence */
  mainAnchorSentence: string;
  /** Last updated timestamp */
  lastUpdated: string | null;
}

/** Default empty VSP structured plan */
export const DEFAULT_VSP_STRUCTURED_PLAN: VspStructuredPlan = {
  zones: {
    green: { signals: '', whatHelps: '', anchorSentence: '' },
    yellow: { signals: '', whatHelps: '', anchorSentence: '' },
    orange: { signals: '', whatHelps: '', anchorSentence: '' },
    red: { signals: '', whatHelps: '', anchorSentence: '' },
    purple: { signals: '', whatHelps: '', anchorSentence: '' },
  },
  triggers: [],
  recoveryRules: [],
  mainAnchorSentence: '',
  lastUpdated: null,
};

// ─── BACKPACK (backpack.json) — STABLE IDENTITY ────────────────
/**
 * Backpack — the anchor of identity..
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
  /** Structured VSP (Veiligheidsplan) — user-written per zone (Elias only) */
  vspSection?: VspStructuredPlan;
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
  /** Eigen Regie Plan — structured self-direction plan (Kim only) */
  eigenRegiePlan?: import('@/lib/engine/kim/kerp01-types').EigenRegiePlan;
  /** Balkmetafoor — qualitative draaglast/draagkracht balance (Elias only) */
  balkmetafoor?: import('@/lib/types/balkmetafoor.types').BalkmetafoorData;
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
// ─── USER-REPORTED CLINICAL FACTORS ─────────────────────────────

export type ClinicalFactorCategory =
  | 'neurodevelopmental'
  | 'personality_traits'
  | 'mood_disorder'
  | 'anxiety_disorder'
  | 'trauma_related'
  | 'substance_related'
  | 'psychotic_spectrum'
  | 'eating_disorder'
  | 'neurocognitive'
  | 'medication'
  | 'other';

export type ClinicalFactorStatus =
  | 'user_reported_diagnosed'
  | 'clinician_reported_by_user'
  | 'user_suspected'
  | 'screening_indicated'
  | 'unclear';

export type ClinicalFactorPromptUse =
  | 'adapt_pacing'
  | 'adapt_tone'
  | 'adapt_structure'
  | 'increase_risk_awareness'
  | 'avoid_triggers'
  | 'context_only'
  | 'medication_awareness';

export type ClinicalFactorImpactArea =
  | 'impulse_control'
  | 'emotional_regulation'
  | 'attention_focus'
  | 'social_interaction'
  | 'sleep'
  | 'medication_adherence'
  | 'relapse_risk'
  | 'relationship_patterns'
  | 'self_image'
  | 'communication_style'
  | 'pacing_needs'
  | 'crisis_vulnerability';

export interface UserReportedClinicalFactor {
  factorId: string;
  label: string;
  category: ClinicalFactorCategory;
  status: ClinicalFactorStatus;
  source: 'backpack' | 'chat' | 'intake' | 'manual';
  evidenceSnippet: string;
  firstSeenAt: string;
  lastSeenAt: string;
  activeImpactAreas: ClinicalFactorImpactArea[];
  promptUse: ClinicalFactorPromptUse;
  safetyNotes?: string;
  confidence: number;
}

export interface UserDat {
  /** User's name — backup copy from Backpack (redundant, for import resilience) */
  naam?: string;
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
  modeTendencies?: Array<{ modeId: string; frequency: number; lastSeen: string; effectiveInterventions: string[]; /** ISO — first detection, never overwritten */ firstDetectedAt?: string; /** ISO — last confidence update */ lastUpdatedAt?: string; confidence?: number; /** Confirmed = safe to present as known pattern to GPT */ confirmed?: boolean; /** ISO — when confirmation occurred */ confirmedAt?: string; /** Clinical acknowledgment */ clinicalAcknowledged?: boolean; clinicalAcknowledgedAt?: string | null; /** User self-acknowledgment */ userAcknowledged?: boolean; userAcknowledgedAt?: string | null; /** Weighted score (auto=+1, clinical=+2, user=+2) */ acknowledgmentScore?: number }>;
  /** Schema/Mode: recurring schema tendencies (hybrid persistence — patterns only, never diagnosis) */
  schemaTendencies?: Array<{ schemaId: string; domain: string; frequency: number; lastSeen: string; copingStyle: string | null; /** ISO — first detection, never overwritten */ firstDetectedAt?: string; /** ISO — last confidence update */ lastUpdatedAt?: string; confidence?: number; /** Confirmed = safe to present as known pattern to GPT */ confirmed?: boolean; /** ISO — when confirmation occurred */ confirmedAt?: string; /** Clinical acknowledgment */ clinicalAcknowledged?: boolean; clinicalAcknowledgedAt?: string | null; /** User self-acknowledgment */ userAcknowledged?: boolean; userAcknowledgedAt?: string | null; /** Weighted score (auto=+1, clinical=+2, user=+2) */ acknowledgmentScore?: number }>;
  /** Backpack analysis timestamps — tracks which sections have been analyzed by GPT and when.
   * Key = sectionId (e.g. 'childhood', 'my_story'), value = ISO timestamp of last GPT analysis.
   * Used to determine if a section needs re-analysis (section.lastUpdated > this timestamp). */
  backpackAnalysisTimestamps?: Record<string, string>;
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
  /** MODULE_MEMORY_CROSS_SESSION: persona-separated cross-session module dominance tracking (local within-device memory) */
  moduleMemory?: import('../engine/shared/module-memory-cross-session').ModuleMemoryState;
  /** Structured entities extracted from backpack via LLM (persons, events, patterns, contexts). Updated only when backpack content changes. */
  extractedEntities?: import('../backpack-extractor/types').ExtractedEntities;
  /** Deep analysis of backpack: schemas, modes, triggers, core beliefs, coping patterns. Updated on each backpack save via GPT-4o. */
  backpackAnalysis?: {
    schemas: Array<{ name: string; confidence: number; evidence: string }>;
    modi: Array<{ name: string; confidence: number; evidence: string }>;
    triggers: string[];
    coreBeliefs: string[];
    copingPatterns: string[];
    analysisVersion: number;
    /** ISO timestamp — moment of this analysis */
    analyzedAt: string;
    /** ISO timestamp — moment of previous analysis, null on first */
    previousAnalyzedAt: string | null;
  };
  /** Relapse-intent event log: persisted per-detection for cross-session pattern analysis */
  relapseIntentLog?: Array<{
    /** ISO timestamp of detection */
    timestamp: string;
    /** Detection source: 'gpt' (semantic) or 'fallback' (deterministic markers) */
    source: 'gpt' | 'fallback';
    /** Confidence score 0-1 */
    confidence: number;
    /** Session number when detected */
    sessionNumber: number;
    /** The user message that triggered detection (truncated to 200 chars) */
    messageSnippet: string;
    /** Zone before escalation */
    zoneBeforeEscalation: string;
    /** Zone after escalation */
    zoneAfterEscalation: string;
  }>;
  /** User-reported relapse/slip events — persisted for greeting signals and pattern tracking */
  relapseEvents?: Array<{
    /** ISO timestamp of event */
    timestamp: string;
    /** 'herval' = full relapse (resets sobriety date), 'terugval' = slip (preserves sobriety) */
    type: 'herval' | 'terugval';
    /** Optional user context/note */
    context?: string;
    /** Session number when reported */
    sessionNumber: number;
  }>;
  /** Terugval-preventieplan — user-filled relapse prevention plan */
  preventionPlan?: {
    /** Warning signs the user recognizes */
    warningSigns: string;
    /** Coping strategies that work for the user */
    copingStrategies: string;
    /** People to contact in crisis */
    supportContacts: string;
    /** Safe activities to do instead */
    safeActivities: string;
    /** Personal motivation / reasons to stay clean */
    motivation: string;
    /** Last updated timestamp */
    updatedAt: string;
  };
  /** Deep analysis: Elias-specific recovery patterns (stored by section-analysis-service) */
  recoveryPatterns?: Array<{ type: string; description: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: Kim-specific caregiver patterns (stored by section-analysis-service) */
  caregiverPatterns?: Array<{ type: string; description: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: schemas detected from backpack (stored by section-analysis-service) */
  schemas?: Array<{ schema: string; evidenceType: string; confidence: number; sourceSectionId?: string; doNotDiagnose?: boolean }>;
  /** Deep analysis: modes detected from backpack (stored by section-analysis-service) */
  modes?: Array<{ mode: string; evidenceType: string; confidence: number; sourceSectionId?: string; doNotDiagnose?: boolean }>;
  /** Deep analysis: triggers detected from backpack (stored by section-analysis-service) */
  triggers?: Array<{ trigger: string; context?: string; severity?: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: protective factors detected from backpack (stored by section-analysis-service) */
  protectiveFactors?: Array<{ factor: string; domain?: string; strength?: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: values detected from backpack (stored by section-analysis-service) */
  values?: Array<{ value: string; importance?: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: goals detected from backpack (stored by section-analysis-service) */
  goals?: Array<{ goal: string; timeframe?: string; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: risks detected from backpack (stored by section-analysis-service) */
  risks?: Array<{ risk: string; severity?: string; isActive?: boolean; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: relation graph edges (stored by section-analysis-service) */
  relationGraph?: Array<{ subjectPerson: string; relation: string; objectPerson: string; explicitInSource?: boolean; confidence: number; sourceSectionId?: string }>;
  /** Deep analysis: life status facts (stored by section-analysis-service) */
  lifeStatusFacts?: Array<{ person: string; status: 'alive' | 'deceased' | 'unknown'; explicitInSource?: boolean; confidence: number; sourceSectionId?: string }>;
  /** FASE 4: Developmental formulation hypotheses */
  developmentalFormulation?: Array<{ originPhase: string; originContext: string; learnedPattern: string; currentManifestation: string; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Trigger chains (event→meaning→emotion→mode→coping→risk) */
  triggerChains?: Array<{ triggerEvent: string; assignedMeaning: string; emotionalResponse: string; activatedMode: string; copingBehavior: string; riskOutcome: string; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Relapse pathways (Elias only) */
  relapsePathways?: Array<{ destabilizer: string; earlyWarnings: string[]; escalationPattern: string; relapseEndpoint: string; protectiveInterrupts: string[]; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Caregiver burden pathways (Kim only) */
  caregiverBurdenPathways?: Array<{ destabilizer: string; earlyWarnings: string[]; escalationPattern: string; burdenEndpoint: string; protectiveInterrupts: string[]; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Function of addiction (Elias only) */
  functionOfAddiction?: Array<{ functionType: string; description: string; underlyingNeed: string; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Function of caregiving pattern (Kim only) */
  functionOfCaregivingPattern?: Array<{ functionType: string; description: string; underlyingNeed: string; sourceEvidence: string; confidence: number; sourceSectionId?: string; isHypothesis: true }>;
  /** FASE 4: Contraindications — what NOT to say/do for this person */
  contraindications?: Array<{ avoidTopic: string; reason: string; appliesTo: string; severity: 'hard' | 'soft'; sourceEvidence: string; confidence: number; sourceSectionId?: string }>;
  /** FASE 4: Safe formulation hints — how to frame clinical content safely */
  safeFormulationHints?: Array<{ topic: string; safeFraming: string; avoidFraming: string; sourceEvidence: string; confidence: number; sourceSectionId?: string }>;
  /** V1: User-reported clinical factors — NEVER diagnose, only adapt approach */
  userReportedClinicalFactors?: UserReportedClinicalFactor[];
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
    label: 'Kindertijd',
    ageRange: '6–12 jaar',
    prompt: 'Waar groeide je op in deze periode? Beschrijf de sfeer thuis, je schooljaren, vriendschappen en gebeurtenissen die indruk op je maakten.',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adolescence',
    label: 'Adolescentie',
    ageRange: '12–18 jaar',
    prompt: 'Hoe was je tienertijd? Hoe ging het thuis, op school en met leeftijdsgenoten? Had je worstelingen of groeimomenten?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'adulthood',
    label: 'Volwassenheid',
    ageRange: '18–50 jaar',
    prompt: 'Wat zijn belangrijke keuzes of gebeurtenissen in je volwassen leven? Denk aan werk, relaties, kinderen, verslaving, verlies, groei of betekenis.',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'family',
    label: 'Familie',
    ageRange: 'Heel het leven',
    prompt: 'Hoe is je relatie met je ouders of familie geweest? Zijn er patronen, loyaliteiten of spanningen die je vandaag nog beïnvloeden?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'themes',
    label: 'Terugkerende thema\'s',
    ageRange: 'Door alle fases heen',
    prompt: 'Zijn er terugkerende thema\'s, overtuigingen of innerlijke worstelingen die je herkent door deze levensfasen heen?',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'vsp',
    label: 'Veiligheidsplan (VSP)',
    ageRange: 'Persoonlijke signalen',
    prompt: 'Schrijf je veiligheidsplan hier per zone. Gebruik labels als GROEN:, GEEL:, ORANJE:, ROOD:, PAARS: om te beschrijven wat je opmerkt in elke zone — je signalen, gedachten, gedrag en wat helpt.',
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
    title: 'Mijn verhaal',
    subtitle: 'Wie ben ik buiten deze relatie?',
    emoji: '👤',
    color: '#E57373',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'the_relationship',
    title: 'De relatie',
    subtitle: 'Hoe is het geëvolueerd? Wanneer veranderde het?',
    emoji: '🔗',
    color: '#81C784',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'the_impact',
    title: 'De impact',
    subtitle: 'Wat heeft verslaving gedaan met mijn leven, familie, werk?',
    emoji: '🌊',
    color: '#4DD0E1',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'my_boundaries',
    title: 'Mijn grenzen',
    subtitle: 'Wat kan ik dragen? Wat heb ik al geprobeerd?',
    emoji: '🛡️',
    color: '#FFD54F',
    content: '',
    lastUpdated: null,
  },
  {
    id: 'my_strength',
    title: 'Mijn kracht',
    subtitle: 'Waar vind ik kracht? Wat wil ik voor mezelf?',
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
      intakeDate: LocalDeviceTimeService.now().utcIso,
    },
    createdAt: LocalDeviceTimeService.now().utcIso,
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
  /** context.dat: distilled in-memory context that replaces full backpack/userDat/diary at SESSION_INIT.
   * When present, the payload builder uses this instead of raw layers. */
  contextDatSerialized?: string;
  /** Deepening fragments: targeted raw-layer fragments retrieved by the deepening layer */
  deepeningBlock?: string;
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
  /** Signal engine: relapse intent detection result — triggers zone escalation to ORANJE minimum */
  relapseIntent?: {
    detected: boolean;
    confidence: number;
    source: 'gpt' | 'fallback';
  };
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
  vergv01Context?: string;
  igh01Context?: string;
  agc01Context?: string;
  hwk01Context?: string;
  fale01Context?: string;
  verg01Context?: string;
  rouw01Context?: string;
  iden01Context?: string;
  zink01Context?: string;
  terv01Context?: string;
  mi02Context?: string;
  slaap01EliasContext?: string;
  slaap01KimContext?: string;
  bedr01Context?: string;
  vetr01Context?: string;
  gasl01Context?: string;
  cdp01Context?: string;
  rnw01Context?: string;
  par01Context?: string;
  fin01Context?: string;
  iso01Context?: string;
  /** Kim Relapse Cluster prompt payload (HERV-K01/NAHERV-K01/CRISIS-K01). When present, overrides all lower Kim module contexts. */
  relapseClusterContext?: string;
  /** Kim Danger/Child Cluster prompt payload (GEVAAR-K01/KIND-K01). When present, overrides ALL lower Kim modules including relapse cluster. */
  dangerChildContext?: string;
  /** Kim Relational Dynamics Cluster (ROL-K01/VETR02-K/LEUGEN-K01) prompt context. Reflective modules below acute clusters. */
  relationalDynamicsContext?: string;
  /** Kim Cluster 4 (HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01) — emotional loss context */
  emotionalLossContext?: string;
  /** Kim Cluster 5 (STOA-K) — stoic reflective framework context */
  stoaKContext?: string;
  /** VSP Insight System — framework selection and prompt frame (MI/MBT/DGT). Never mutates safety core. store:false. */
  vspInsightContext?: string;
  /** VSP profile parsed from backpack recurringThemes section (Elias only, read-only). Bypasses relevance analyzer 2-source limit. */
  vspBackpackProfile?: string;
  /** VSP Structured Section — user's own per-zone signals, whatHelps, anchorSentence formatted as prompt block (Elias only) */
  vspStructuredSection?: string;
  /** PsychoEducation continuity context (WILSKRACHT01/AUTOPILOT01, Elias only). Injected every relevant turn. */
  psychoEducationContext?: string;
  /** Steunpilaren inventaris context (PAAL01, Elias only). Injected every relevant turn, not keyword-gated. */
  steunpilarenContext?: string;
  /** Self-acceptance cluster context (BLIK01/ONTK01/IKST01/COEX01) */
  selfAcceptanceContext?: string;
  kimPatternSupportContext?: string;
  /** Structured entities extracted from backpack (persons, events, patterns, contexts). Sent instead of full backpack when unchanged. */
  extractedEntities?: import('../backpack-extractor/types').ExtractedEntities;
  /** Whether backpack content changed since last extraction (forces full backpack resend) */
  backpackChanged?: boolean;
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
  /** PAST_REFERENCE: context from logs.dat/user.dat when user references something from the past */
  pastReferenceContext?: string;
  /** Eigen Regie context (Kim only): zone, meaning, impact computed from user's daily self-regulation input.
   * Replaces stageOfChange for Kim users in the GPT prompt. */
  eigenRegieContext?: {
    userInput: number;
    engineScore: number;
    zone: 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';
    meaning: string;
    impact: { primaryDirective: string; secondaryDirective: string };
  };
  /** User-selected app language (from i18n provider). Determines AI response language. */
  locale?: 'nl' | 'en' | 'fr';
  /** User country code for emergency numbers */
  country?: 'NL' | 'BE' | 'FR' | 'UK' | 'US';
  /** KERP01: Eigen Regie Plan context — zone-specific signals, helps, anchors, triggers, boundary rules */
  eigenRegiePlanContext?: {
    currentZoneEntry: import('@/lib/engine/kim/kerp01-types').EigenRegieZoneEntry | null;
    mainAnchorSentence: string;
    triggers: import('@/lib/engine/kim/kerp01-types').EigenRegieTrigger[];
    boundaryRules: string[];
  };
  /** Backpack deep analysis: schema/mode/trigger context from GPT-4o */
  backpackAnalysis?: { triggers?: string[]; coreBeliefs?: string[]; copingPatterns?: string[]; schemaHypotheses?: string[] };
  /** DIST01: Serialized distillation context for GPT prompt injection (persons, life context, signals) */
  distillationContext?: string | null;
  /** DIST01 Pattern Acknowledgment: instruction for Elias/Kim to reference repeated patterns in response */
  patternAcknowledgment?: string | null;
  /** KIM RELATIONAL STANCE FILTER: compiled directive block ensuring Kim validates without polarizing */
  relationalStanceFilter?: string | null;
  /** KIM FORMULATION BLOCK: prominent concrete relational formulation (mustMention/mustAvoid/responsibility) */
  kimFormulationBlock?: string | null;

  /** ELIAS RECOVERY FORMULATION: compact formulation block for Elias recovery-focused GPT guidance */
  eliasFormulationBlock?: string | null;
  epistemicGuidanceSummary?: string | null;
  epistemicModelRoutingHints?: any;
  /** CMD SELECTED MEMORY SUMMARY: compact budget-selected clinical memory block for GPT context */
  cmdMemorySummary?: string | null;
  /** PERSONAL ANCHORS: confirmed key figure facts (always sent, never hedged) */
  personalAnchors?: string | null;
  personalClinicalContext?: string | null;

  // ─── PRE-BUILT PROMPT BLOCKS (from local pipeline) ───
  /** Age category for communication depth — never raw birthDate */
  ageCategory?: string | null;
  diarySummary?: string;
  /** Ready-to-inject PERSONEN-LOOKUP block (built locally) */
  personLookupBlock?: string | null;
  /** Ready-to-inject PERSONAL MEMORY block (built locally) */
  lifeContextBlock?: string | null;
  /** Ready-to-inject STRUCTURED MEMORY block (built locally) */
  prebuiltStructuredMemory?: string | null;
  /** Ready-to-inject session history summary (built locally) */
  prebuiltSessionHistory?: string | null;
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
