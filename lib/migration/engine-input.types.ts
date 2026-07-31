/**
 * ══════════════════════════════════════════════════════════════════════════
 * CANONICAL ENGINE INPUT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Client and server MUST use exactly the same input basis for comparison.
 * This is the single source of truth for what goes into the engine.
 *
 * Rule: For user-facing time logic, deviceTimeContext is authoritative.
 * Server MUST NOT use Node Date for user-facing decisions.
 */

import type { CyclePart } from '@/lib/core/time/types';
import type { SessionLogSummary } from '@/lib/types/memory/logsDat.types';

// ─── Device Time Context ──────────────────────────────────────────────

/**
 * Device time context — authoritative for all user-facing time decisions.
 * SESSION_INIT sends the full object.
 * LIVE_MESSAGE sends deviceNowIso, timeZone, and cycleTimestamp.
 */
export interface DeviceTimeContextPayload {
  /** ISO-8601 UTC from device clock at moment of request. */
  deviceNowIso: string;
  /** IANA timezone (e.g. "Europe/Brussels"). */
  timeZone: string;
  /** UTC offset in minutes at moment of capture. */
  timezoneOffsetMinutes: number;
  /** Local date as YYYY-MM-DD. */
  localDate: string;
  /** Local time as HH:mm:ss. */
  localTime: string;
  /** Greeting day part derived from localHour. */
  greetingDaypart: CyclePart;
  /** Cycle timestamp ISO — generated/validated by client. */
  cycleTimestamp: string;
  /** Session start timestamp (device local, ISO). */
  sessionStartedAtDeviceIso: string;
}

// ─── VSP Section ──────────────────────────────────────────────────────

/**
 * VSP (Veiligheidsplan) section — user-reported relapse risk level.
 */
export interface VspSectionPayload {
  /** User-selected VSP level this session. */
  level: 'GROEN' | 'LICHTGROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS';
  /** VSP score (numeric, 1-6). */
  score: number;
  /** Signals content from VSP plan (what the user notices). */
  signals?: string;
  /** What helps content from VSP plan. */
  whatHelps?: string;
  /** Anchor phrase from VSP plan. */
  anchorPhrase?: string;
}

// ─── Mood Sliders ─────────────────────────────────────────────────────

/**
 * Mood sliders as submitted by the user (0-10 scale).
 * Elias: craving, frustration, despondency, focus, vsp, vspScore
 * Kim: stress, boundaryFatigue, emotionalBurden, selfCare, eigenRegie
 */
export interface MoodSlidersPayload {
  [key: string]: number | null | undefined;
}

// ─── Conversation History ─────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// ─── UserDat Summary ──────────────────────────────────────────────────

/**
 * Summary of user.dat — NEVER the full user.dat.
 * Only the subset needed for engine decisions.
 */
export interface UserDatSummaryPayload {
  /** Total sessions completed. */
  totalSessions: number;
  /** Last session date (ISO). */
  lastSessionDate: string | null;
  /** Current mood sliders. */
  currentMood: MoodSlidersPayload;
  /** Mood history (last 7 entries max). */
  moodHistory: Array<{
    date: string;
    sliders: MoodSlidersPayload;
  }>;
  /** Trigger patterns (max 10). */
  triggerPatterns: Array<{
    trigger: string;
    frequency: number;
    lastSeen: string;
  }>;
  /** Module usage (last 5 sessions). */
  moduleUsage: Array<{
    moduleId: string;
    count: number;
    lastUsed: string;
  }>;
  /** Stage of change. */
  stageOfChange: string;
  /** Clinical mode active. */
  clinicalModeActive: boolean;
  /** Guidance depth setting. */
  guidanceDepth?: string;
  /** Schema tendencies (max 5). */
  schemaTendencies?: Array<{
    domain: string;
    confidence: number;
  }>;
  /** Eigen regie history (Kim only, last 5). */
  eigenRegieHistory?: Array<{
    value: number;
    timestamp: string;
  }>;
  /** Recent relapse/slip event (Elias only) */
  recentRelapseEvent?: { type: string; daysAgo: number; context?: string | null } | null;
  /** Prevention plan (zone-filtered) */
  preventionPlan?: { zone?: string; warningSigns?: string; copingStrategies?: string; supportContacts?: string; safeActivities?: string; motivation?: string } | null;
  /** Whether prevention plan is missing */
  preventionPlanMissing?: boolean;
}

// ─── Logs Sessions ────────────────────────────────────────────────────

/**
 * Logs sessions summary — safe summaries from logs.dat.
 * Only compressedNarrative + metadata, never raw messages.
 */
export interface LogsSessionPayload {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  compressedNarrative: string;
  discussedTopics: string[];
  emotionalThemes: string[];
  openEndpoints: string[];
  moduleTrace: Array<{ moduleId: string; count: number }>;
  zoneTrace: Array<{ zone: string; count: number }>;
}

// ─── Request Type ─────────────────────────────────────────────────────

export type EngineRequestType = 'SESSION_INIT' | 'LIVE_MESSAGE';

// ─── Canonical Engine Input ───────────────────────────────────────────

/**
 * The canonical EngineInput object.
 * Both client and server use this exact shape for engine processing.
 */
export interface CanonicalEngineInput {
  /** Request type: SESSION_INIT or LIVE_MESSAGE. */
  requestType: EngineRequestType;

  // ── Identity ──
  /** User type: 'elias' (verslaafde) or 'kim' (naaste). */
  userType: 'elias' | 'kim';
  /** User's display name. */
  userName: string;
  /** Locale for response language. */
  locale: 'nl' | 'en' | 'fr';
  /** Country for emergency numbers. */
  country: 'NL' | 'BE' | 'FR' | 'UK' | 'US';
  /** Guidance depth setting. */
  guidanceDepth: string;
  /** Whether clinical mode is active. */
  clinicalModeActive: boolean;

  // ── Message ──
  /** The user's current message text. */
  message: string;
  /** Conversation history (last N messages). */
  conversationHistory: ConversationMessage[];

  // ── Pre-chat state ──
  /** Mood sliders (current session submission). */
  moodSliders: MoodSlidersPayload;
  /** Whether this is the first message of the session. */
  isSessionStart: boolean;
  /** VSP section (null if not yet submitted). */
  vspSection: VspSectionPayload | null;

  // ── Context ──
  /** Logs sessions (safe summaries, max 3 recent). */
  logsSessions: LogsSessionPayload[];
  /** UserDat summary (never full user.dat). */
  userDatSummary: UserDatSummaryPayload;

  // ── Session state ──
  /** Modules already used this session (for loopblocker). */
  usedModules: string[];
  /** Previous zone score (from last turn). */
  previousZoneScore: number;
  /** Message count in current session. */
  messageCount: number;

  // ── Time ──
  /** Device time context — authoritative for user-facing time. */
  deviceTimeContext: DeviceTimeContextPayload;
}
