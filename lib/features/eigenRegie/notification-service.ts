/**
 * Eigen Regie — Notification Reminder Service
 *
 * Schedules a daily notification to remind the user to do their eigen-regie check
 * when they haven't done one in the configured number of days.
 *
 * Uses expo-notifications with daily triggers at a user-configurable time.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const STORAGE_KEY_SETTINGS = '@recofree_eigenregie_notification_settings';
const STORAGE_KEY_LAST_CHECK = '@recofree_eigenregie_last_check';
const NOTIFICATION_IDENTIFIER = 'eigenregie-daily-reminder';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EigenRegieNotificationSettings {
  /** Whether the reminder is enabled */
  enabled: boolean;
  /** Hour of day to send reminder (0-23), default 20 */
  hour: number;
  /** Minute of hour (0-59), default 0 */
  minute: number;
  /** Number of days without check before reminder fires, default 3 */
  inactiveDaysThreshold: number;
}

const DEFAULT_SETTINGS: EigenRegieNotificationSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
  inactiveDaysThreshold: 3,
};

// ─── Notification Content (Dutch) ────────────────────────────────────────────
const NOTIFICATION_TITLE = 'Eigen Regie Check';
const NOTIFICATION_BODY = 'Hoe gaat het met je regie? Neem even een moment om je zone te checken.';

// ─── Settings Persistence ─────────────────────────────────────────────────────
export async function loadSettings(): Promise<EigenRegieNotificationSettings> {
  try {
    const raw = await readEncrypted(STORAGE_KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return JSON.parse(raw) as EigenRegieNotificationSettings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: EigenRegieNotificationSettings): Promise<void> {
  await writeEncrypted(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

// ─── Last Check Timestamp ─────────────────────────────────────────────────────
export async function getLastCheckTimestamp(): Promise<string | null> {
  try {
    return await readEncrypted(STORAGE_KEY_LAST_CHECK);
  } catch {
    return null;
  }
}

export async function recordEigenRegieCheck(): Promise<void> {
  await writeEncrypted(STORAGE_KEY_LAST_CHECK, new Date().toISOString());
}

/**
 * Returns the number of days since the last eigen-regie check.
 * Returns Infinity if no check has ever been recorded.
 */
export async function daysSinceLastCheck(): Promise<number> {
  const lastCheck = await getLastCheckTimestamp();
  if (!lastCheck) return Infinity;
  const lastDate = new Date(lastCheck);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Cancel any existing eigen-regie reminder notification.
 */
export async function cancelReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
  } catch {
    // May not exist, that's fine
  }
}

/**
 * Schedule the daily eigen-regie reminder notification.
 * Fires daily at the configured time. The app will check on open
 * whether the threshold has been exceeded.
 */
export async function scheduleReminder(settings?: EigenRegieNotificationSettings): Promise<boolean> {
  const config = settings ?? await loadSettings();

  if (!config.enabled) {
    await cancelReminder();
    return false;
  }

  // Cancel existing before rescheduling
  await cancelReminder();

  const content: Notifications.NotificationContentInput = {
    title: NOTIFICATION_TITLE,
    body: NOTIFICATION_BODY,
    data: {
      type: 'eigenregie_reminder',
    },
  };

  // Android channel
  if (Platform.OS === 'android') {
    (content as Record<string, unknown>).channelId = 'eigenregie-reminders';
  }

  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: config.hour,
    minute: config.minute,
  };

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDENTIFIER,
      content,
      trigger,
    });
    console.log('[EigenRegie/Notifications] Scheduled daily reminder at', config.hour, ':', config.minute);
    return true;
  } catch (error) {
    console.error('[EigenRegie/Notifications] Failed to schedule:', error);
    return false;
  }
}

/**
 * Setup Android notification channel for eigen-regie reminders.
 * No-op on iOS.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('eigenregie-reminders', {
    name: 'Eigen Regie Herinneringen',
    description: 'Dagelijkse herinnering om je eigen regie te checken',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Enable the reminder with given settings, save, and schedule.
 */
export async function enableReminder(
  hour: number = 20,
  minute: number = 0,
  inactiveDaysThreshold: number = 3,
): Promise<void> {
  const settings: EigenRegieNotificationSettings = {
    enabled: true,
    hour,
    minute,
    inactiveDaysThreshold,
  };
  await saveSettings(settings);
  await scheduleReminder(settings);
}

/**
 * Disable the reminder, save settings, and cancel notification.
 */
export async function disableReminder(): Promise<void> {
  const settings = await loadSettings();
  settings.enabled = false;
  await saveSettings(settings);
  await cancelReminder();
}

/**
 * Check if reminder should fire based on last check timestamp.
 * Call this on app open to conditionally show an in-app prompt.
 */
export async function shouldShowInAppReminder(): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings.enabled) return false;
  const days = await daysSinceLastCheck();
  return days >= settings.inactiveDaysThreshold;
}
