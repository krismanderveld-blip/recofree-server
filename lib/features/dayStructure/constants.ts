/**
 * Dagstructuur Feature — Constants
 *
 * Notification channels, timing defaults, validation limits.
 */

// ─── Notification Channels (Android) ────────────────────────────────────────

export const NOTIFICATION_CHANNELS = {
  WAKE_ALARM: {
    id: 'daystructure_wake_alarm',
    name: 'Wake Alarm',
    description: 'Alarm-style wake notifications with sound',
    importance: 'MAX' as const,
    sound: 'wake_alarm.wav',
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    enableLights: true,
    lightColor: '#FF9800',
  },
  ACTIVITY: {
    id: 'daystructure_activity',
    name: 'Activity Reminders',
    description: 'Gentle reminders for scheduled activities',
    importance: 'HIGH' as const,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableLights: false,
    lightColor: '#2196F3',
  },
} as const;

// ─── Timing Defaults ────────────────────────────────────────────────────────

/** Default wake time for wizard suggestion. */
export const DEFAULT_WAKE_TIME = '07:00';

/** Default sleep time for wizard suggestion. */
export const DEFAULT_SLEEP_TIME = '23:00';

/** Minimum block duration in minutes. */
export const MIN_BLOCK_DURATION_MINUTES = 15;

/** Maximum blocks per day. */
export const MAX_BLOCKS_PER_DAY = 24;

// ─── Completion ─────────────────────────────────────────────────────────────

/** Days to retain completion data before optional cleanup. */
export const COMPLETION_RETENTION_DAYS = 90;

// ─── Notification Scheduling ────────────────────────────────────────────────

/** Maximum number of scheduled notifications (iOS limit is 64). */
export const MAX_SCHEDULED_NOTIFICATIONS = 56;

/**
 * Minutes before block start to fire notification.
 * 0 = at exact start time.
 */
export const NOTIFICATION_LEAD_TIME_MINUTES = 0;

// ─── Validation ─────────────────────────────────────────────────────────────

/** Maximum label length for a block. */
export const MAX_LABEL_LENGTH = 100;

/** Minimum label length for a block. */
export const MIN_LABEL_LENGTH = 1;
