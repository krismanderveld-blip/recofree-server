/**
 * Dagstructuur Feature — Core Type Definitions
 *
 * All types for the local day-structure system: schema, blocks, completion,
 * notification index, bell state, and wizard state.
 *
 * Design principles:
 * - One shared schema for Elias and Kim (no persona-specific structure)
 * - All time logic via LocalDeviceTimeService
 * - All storage encrypted (AES-256-GCM)
 * - No engine/greeting/server integration
 */

// ─── Weekday ────────────────────────────────────────────────────────────────

/** ISO-8601 weekday names (lowercase). Monday = 1, Sunday = 7. */
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Map ISO weekday number (1=Mon, 7=Sun) to Weekday string. */
export const WEEKDAY_FROM_NUMBER: Record<number, Weekday> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
};

/** Map Weekday string to ISO weekday number. */
export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

// ─── Time Block ─────────────────────────────────────────────────────────────

/** Block kind determines notification profile. */
export type BlockKind = 'wake' | 'activity' | 'sleep';

/** Notification profile for a block. */
export type NotificationProfile = 'alarm' | 'push' | 'none';

/** A single time block in a day. */
export interface TimeBlock {
  /** Unique ID (UUID v4). */
  id: string;
  /** User-defined free text label (not a category). */
  label: string;
  /** Block kind: wake, activity, or sleep. */
  kind: BlockKind;
  /** Start time as "HH:mm" (24h format). */
  startTime: string;
  /** End time as "HH:mm" (24h format). May be < startTime for midnight crossing. */
  endTime: string;
  /** Display order within the day (0-based). */
  orderIndex: number;
  /** Notification profile: alarm (wake only), push (activity), none. */
  notificationProfile: NotificationProfile;
}

// ─── Day Schema ─────────────────────────────────────────────────────────────

/** A single day's structure (ordered list of blocks). */
export interface DaySchema {
  /** Weekday this schema belongs to. */
  weekday: Weekday;
  /** Ordered list of time blocks. Empty = unconfigured day. */
  blocks: TimeBlock[];
}

// ─── Week Schema ────────────────────────────────────────────────────────────

/** Full week schema: one DaySchema per weekday. */
export type WeekSchema = Record<Weekday, DaySchema>;

// ─── Document ───────────────────────────────────────────────────────────────

/** The root document stored encrypted in AsyncStorage. */
export interface DayStructureDocumentV1 {
  /** Schema version for future migrations. */
  version: 1;
  /** The full week schema. */
  weekSchema: WeekSchema;
  /** IANA timezone at last planning/edit. */
  timezoneAtLastPlanning: string;
  /** ISO timestamp of last edit. */
  lastEditedAt: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

// ─── Completion ─────────────────────────────────────────────────────────────

/** Completion state for a single day (keyed by localDayKey YYYY-MM-DD). */
export interface DayCompletion {
  /** localDayKey this completion belongs to. */
  localDayKey: string;
  /** Set of block IDs that have been checked off. */
  completedBlockIds: string[];
}

/** Full completion store: map of localDayKey → DayCompletion. */
export type CompletionStore = Record<string, DayCompletion>;

// ─── Bell State ─────────────────────────────────────────────────────────────

/**
 * Bell state machine:
 * - 'enabled': notifications active, OS permission granted
 * - 'disabled': user toggled off (no notifications scheduled)
 * - 'denied': OS permission denied (bell shows denied state)
 * - 'not_configured': no schema exists yet
 * - 'provisional': iOS provisional permission (silent notifications)
 */
export type BellState =
  | 'enabled'
  | 'disabled'
  | 'denied'
  | 'not_configured'
  | 'provisional';

// ─── Notification Index ─────────────────────────────────────────────────────

/** A single scheduled notification entry in the index. */
export interface ScheduledNotificationEntry {
  /** The expo-notifications identifier returned by scheduleNotificationAsync. */
  notificationId: string;
  /** The block ID this notification belongs to. */
  blockId: string;
  /** The weekday this notification is scheduled for. */
  weekday: Weekday;
  /** The local time "HH:mm" this notification fires. */
  localTime: string;
  /** The notification profile used. */
  profile: NotificationProfile;
}

/** Full notification index: all currently scheduled notifications. */
export interface NotificationIndex {
  /** All scheduled notification entries. */
  entries: ScheduledNotificationEntry[];
  /** Timezone at time of scheduling. */
  scheduledAtTimezone: string;
  /** ISO timestamp of last scheduling run. */
  lastScheduledAt: string;
}

// ─── Wizard State ───────────────────────────────────────────────────────────

/** Wizard step identifiers. */
export type WizardStep =
  | 'intro'
  | 'wake'
  | 'activities'
  | 'sleep'
  | 'review'
  | 'copy_week';

/** Transient wizard state (not persisted). */
export interface WizardState {
  /** Current step. */
  currentStep: WizardStep;
  /** The day being configured in the wizard. */
  targetDay: Weekday;
  /** Blocks being built (not yet saved). */
  draftBlocks: TimeBlock[];
}

// ─── Storage Keys ───────────────────────────────────────────────────────────

/** AsyncStorage keys for the dagstructuur feature. */
export const STORAGE_KEYS = {
  /** Encrypted day structure document. */
  DOCUMENT: '@recofree_daystructure_v1',
  /** Encrypted completion store. */
  COMPLETION: '@recofree_daystructure_completion_v1',
  /** Encrypted notification index. */
  NOTIFICATION_INDEX: '@recofree_daystructure_notif_index_v1',
  /** Bell state (plain, not sensitive). */
  BELL_STATE: '@recofree_daystructure_bell_state',
  /** Wizard draft (partial, may be incomplete). */
  WIZARD_DRAFT: '@recofree_daystructure_wizard_draft_v1',
  /** Streaks toggle (plain, not sensitive). */
  STREAKS_ENABLED: '@recofree_daystructure_streaks_enabled',
} as const;

// ─── Validation ─────────────────────────────────────────────────────────────

/** Validation error for a block or day. */
export interface ValidationError {
  /** Which block (by ID) or 'day' level. */
  target: string;
  /** Error code for programmatic handling. */
  code:
    | 'INVALID_TIME_FORMAT'
    | 'START_EQUALS_END'
    | 'OVERLAP'
    | 'DUPLICATE_WAKE'
    | 'DUPLICATE_SLEEP'
    | 'ALARM_ON_NON_WAKE'
    | 'MISSING_LABEL'
    | 'INVALID_ORDER_INDEX';
  /** Human-readable i18n key for the error message. */
  messageKey: string;
}

// ─── Time Adapter Port ──────────────────────────────────────────────────────

/** Port interface for time operations needed by the dagstructuur feature. */
export interface DayStructureTimePort {
  /** Get current weekday as Weekday type. */
  getCurrentWeekday(): Weekday;
  /** Get current localDayKey (YYYY-MM-DD). */
  getCurrentLocalDayKey(): string;
  /** Get current IANA timezone. */
  getCurrentTimezone(): string;
  /** Get current local time as "HH:mm". */
  getCurrentLocalTime(): string;
  /**
   * Resolve the next absolute Date for a given weekday + local time.
   * If the target is today but the time has passed, returns next week.
   */
  resolveNextOccurrence(weekday: Weekday, localTime: string): Date;
  /**
   * Compare two local clock times ("HH:mm").
   * Returns negative if a < b, 0 if equal, positive if a > b.
   */
  compareLocalClockTimes(a: string, b: string): number;
  /**
   * Check if timezone has changed since a given previous timezone string.
   */
  hasTimezoneChanged(previousTimezone: string): boolean;
  /** Get timezone offset in minutes. */
  getTimezoneOffsetMinutes(): number;
}
