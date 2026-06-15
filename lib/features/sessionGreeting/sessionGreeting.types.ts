/**
 * Session Greeting Engine — Type Definitions
 * Engine decides anchor, GPT generates greeting text.
 */

// ─── Anchor Types ────────────────────────────────────────────────────────────

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
  latestDiaryAgeInDays: number | null;
  latestGratitudeAgeInDays: number | null;
  backpackAgeInHours: number | null;
}

// ─── Candidate ───────────────────────────────────────────────────────────────

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
  schemaId: string;
  schemaName: string;
  confidence: number;
  lastUpdatedAt: string;
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

export interface GreetingLogsDatSnapshot {
  latestLogDigest?: string;
  lastSessionOpenLoops: string[];
}

export interface GreetingDiaryMetadata {
  latestEntryCreatedAt?: string;
  latestSafeAnchor?: string;
}

export interface GreetingGratitudeMetadata {
  latestEntryCreatedAt?: string;
  latestSafeAnchor?: string;
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
