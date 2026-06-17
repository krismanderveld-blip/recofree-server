/**
 * Session Greeting Engine — Type Definitions
 *
 * V3.1 REDESIGN: Types now carry FULL personal content instead of truncated summaries.
 * The engine's job is to build a rich prompt for GPT — not to compress data.
 * 
 * BACKWARD COMPATIBLE: Original types preserved for legacy V1 engine + tests.
 */

// ─── Greeting Anchor Types ──────────────────────────────────────────────────

export type GreetingAnchorType =
  | 'FIRST_SESSION'
  | 'CRISIS_OR_HIGH_CRAVING'
  | 'ACTIVE_PROJECTION_FEAR'
  | 'TODAY_MOOD_SLIDERS'
  | 'RECENT_DIARY'
  | 'RECENT_GRATITUDE'
  | 'BACKPACK_RECENT_UPDATE'
  | 'SCHEMA_ROTATION'
  | 'MISSING_DATA_INVITATION';

/**
 * Priority order (corrected from spec):
 * 1. FIRST_SESSION
 * 2. CRISIS_OR_HIGH_CRAVING
 * 3. ACTIVE_PROJECTION_FEAR
 * 4. TODAY_MOOD_SLIDERS
 * 5. RECENT_DIARY
 * 6. RECENT_GRATITUDE
 * 7. BACKPACK_RECENT_UPDATE
 * 8. SCHEMA_ROTATION
 * 9. MISSING_DATA_INVITATION
 */
export const GREETING_ANCHOR_PRIORITY: GreetingAnchorType[] = [
  'FIRST_SESSION',
  'CRISIS_OR_HIGH_CRAVING',
  'ACTIVE_PROJECTION_FEAR',
  'TODAY_MOOD_SLIDERS',
  'RECENT_DIARY',
  'RECENT_GRATITUDE',
  'BACKPACK_RECENT_UPDATE',
  'SCHEMA_ROTATION',
  'MISSING_DATA_INVITATION',
];

// ─── Freshness ───────────────────────────────────────────────────────────────

export interface GreetingFreshnessResult {
  slidersFilledToday: boolean;
  moodUsable: boolean;
  diaryRecentUnder3Days: boolean;
  gratitudeRecentUnder3Days: boolean;
  backpackRecentlyUpdatedUnder24h: boolean;
  /** True when backpackAnalysis.analyzedAt > previousAnalyzedAt */
  backpackAnalysisChanged: boolean;
  latestDiaryAgeInDays: number | null;
  latestGratitudeAgeInDays: number | null;
  backpackAgeInHours: number | null;
}

// ─── Anchor Candidate ────────────────────────────────────────────────────────

export interface GreetingAnchorCandidate {
  anchorType: GreetingAnchorType;
  eligible: boolean;
  reason: string;
  payload?: Record<string, unknown>;
}

// ─── Selected Anchor ─────────────────────────────────────────────────────────

export interface SelectedGreetingAnchor {
  anchorType: GreetingAnchorType;
  reason: string;
  payload: Record<string, unknown>;
}

// ─── Schema Rotation ─────────────────────────────────────────────────────────

export interface GreetingSchemaTendency {
  schemaId?: string;
  schemaName?: string;
  name?: string;
  score?: number;
  confidence?: number;
  confirmed?: boolean;
  lastUpdatedAt?: string;
}

export interface GreetingSchemaRotationState {
  usedSchemaIdsInCurrentCycle: string[];
  lastSchemaAnchorSessionNumber: number;
  lastSchemaIdUsed: string | null;
}

// ─── Prompt Payload ──────────────────────────────────────────────────────────

export interface GreetingPromptPayload {
  persona: 'elias';
  userName: string | null;
  maxSentences: 3;
  greetingTone: 'warm_concrete_not_overloaded';
  selectedGreetingInstruction: string;
  selectedAnchorType: GreetingAnchorType;
  forbiddenOutput: string[];
}

// ─── Engine Result ───────────────────────────────────────────────────────────

export interface SessionGreetingEngineResult {
  selectedAnchor: SelectedGreetingAnchor;
  promptPayload: GreetingPromptPayload;
  debug: SessionGreetingDebug;
}

// ─── Debug ───────────────────────────────────────────────────────────────────

export interface SessionGreetingDebug {
  nowIso: string;
  sessionNumber: number;
  freshness: GreetingFreshnessResult;
  candidates: GreetingAnchorCandidate[];
  selectedAnchorType: GreetingAnchorType;
  selectedReason: string;
}

// ─── Input Snapshots ─────────────────────────────────────────────────────────

export interface GreetingUserDatSnapshot {
  userName?: string;
  sessionStats: {
    totalSessionsStarted: number;
    currentSessionNumber: number;
    lastSessionStartedAt?: string;
    schemaRotationState?: GreetingSchemaRotationState;
  };
  schemaTendencies: GreetingSchemaTendency[];
  backpackLastUpdatedAt?: string;
  /** True when backpackAnalysis.analyzedAt > previousAnalyzedAt (new analysis since last session) */
  backpackAnalysisChanged?: boolean;
  /** Full backpack analysis content — only populated when backpackAnalysisChanged is true */
  backpackAnalysisContent?: {
    schemas: Array<{ name: string; confidence: number; evidence: string }>;
    modi: Array<{ name: string; confidence: number; evidence: string }>;
    triggers: string[];
    coreBeliefs: string[];
    copingPatterns: string[];
  };
}

export interface GreetingStateDatSnapshot {
  currentMood?: {
    craving?: number;
    frustration?: number;
    despondency?: number;
    focus?: number;
    [key: string]: number | undefined;
  };
  moodLastUpdatedAt?: string;
  vspZone?: string;
}

export interface GreetingProjectionsDatSnapshot {
  fears: GreetingProjectionFear[];
}

export interface GreetingProjectionFear {
  label: string;
  decayScore: number;
  lastReinforcedAt: string;
}

/**
 * V3.1: LogsDat snapshot now carries FULL session narrative + topics + emotional arc.
 * No more 120-char truncation. Original fields preserved for backward compat.
 */
export interface GreetingLogsDatSnapshot {
  /** Full compressed narrative from last session (no truncation) */
  latestLogDigest?: string;
  /** Open loops / unresolved tensions from last session */
  lastSessionOpenLoops: string[];
  /** Discussed topics from last session */
  lastSessionTopics?: string[];
  /** Emotional arc description from last session */
  lastSessionEmotionalArc?: string;
  /** Suggested follow-up from last session */
  lastSessionFollowUp?: string[];
  /** Cross-session recurring pattern detected from logs.dat history */
  recurringPatternAnchor?: string;
  recurringPatternConfidence?: number;
}

/**
 * V3.1: Diary metadata now carries FULL content of recent entries (up to 3).
 * No more 80-char truncation. Original fields preserved for backward compat.
 */
export interface GreetingDiaryMetadata {
  latestEntryCreatedAt?: string;
  /** FULL content of the most recent diary entry (no truncation) */
  latestSafeAnchor?: string;
  /** Full content of up to 3 recent entries for richer context */
  recentEntries?: Array<{
    content: string;
    moodTag: string;
    timestamp: string;
  }>;
}

/**
 * V3.1: Gratitude metadata now carries ALL 3 gratitude entries.
 * No more single-field 80-char truncation. Original fields preserved for backward compat.
 */
export interface GreetingGratitudeMetadata {
  latestEntryCreatedAt?: string;
  /** Combined gratitude text (all entries, not truncated) */
  latestSafeAnchor?: string;
  /** Individual gratitude entries for richer context */
  gratitudeEntries?: string[];
}

// ─── Main Engine Input ───────────────────────────────────────────────────────

export interface SessionGreetingInitInput {
  nowIso: string;
  localCalendarDate: string; // YYYY-MM-DD
  timezone: string;
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  projectionsDat: GreetingProjectionsDatSnapshot | null;
  logsDat: GreetingLogsDatSnapshot | null;
  diaryMetadata: GreetingDiaryMetadata | null;
  gratitudeMetadata: GreetingGratitudeMetadata | null;
  /** Structured VSP section data for zone-specific greeting context */
  vspSection?: GreetingVspSectionSnapshot | null;
}

/** Snapshot of the user's structured VSP section for the greeting engine */
export interface GreetingVspSectionSnapshot {
  /** The current zone entry (matching stateDat.vspZone) */
  currentZoneEntry?: {
    signals: string[];
    whatHelps: string[];
    anchorSentence: string;
  } | null;
  /** Main anchor sentence across all zones */
  mainAnchorSentence?: string;
  /** Recovery rules */
  recoveryRules?: string[];
  /** Active triggers with counter-thoughts */
  triggers?: Array<{ trigger: string; counterThought: string }>;
}

// ─── Session Init Context ────────────────────────────────────────────────────

export interface SessionInitContext {
  userName?: string;
  selectedGreetingAnchor: SelectedGreetingAnchor;
  compactMemoryContext: {
    latestLogDigest?: string;
    activeFearCount: number;
    activeHopeCount: number;
    triggerPatternCount: number;
    schemaTendencyCount: number;
    lastSessionOpenLoops: string[];
  };
}

// ─── GPT Client Interface ────────────────────────────────────────────────────

export interface GreetingGptClient {
  generateGreeting(payload: GreetingPromptPayload): Promise<string>;
}
