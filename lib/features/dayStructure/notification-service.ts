/**
 * Dagstructuur Feature — Notification Service
 *
 * Schedules and manages local notifications for day structure blocks.
 * Uses expo-notifications with weekly triggers.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';
import type {
  NotificationIndex,
  ScheduledNotificationEntry,
  TimeBlock,
  WeekSchema,
  Weekday,
} from './types';
import { WEEKDAYS, WEEKDAY_TO_NUMBER, STORAGE_KEYS } from './types';
import { NOTIFICATION_CHANNELS, MAX_SCHEDULED_NOTIFICATIONS } from './constants';
import { DayStructureTimeAdapter } from './time-adapter';

// ─── Sleep Notification Content ───────────────────────────────────────────────
// NOTE: Notifications are scheduled ahead of time and stored as plain strings.
// We cannot use i18n t() here because the notification fires when the app may be
// backgrounded. We store the user's device language at schedule time.
// For now, Dutch is the primary language.
const SLEEP_NOTIFICATION_TITLE = 'Bedtijd 🌙';
const SLEEP_NOTIFICATION_BODY = 'Vergeet je wekker niet te zetten!';

// ─── Notification Index Persistence ─────────────────────────────────────────

async function loadNotificationIndex(): Promise<NotificationIndex> {
  try {
    const raw = await readEncrypted(STORAGE_KEYS.NOTIFICATION_INDEX);
    if (!raw) return { entries: [], scheduledAtTimezone: '', lastScheduledAt: '' };
    return JSON.parse(raw) as NotificationIndex;
  } catch {
    return { entries: [], scheduledAtTimezone: '', lastScheduledAt: '' };
  }
}

async function saveNotificationIndex(index: NotificationIndex): Promise<void> {
  await writeEncrypted(STORAGE_KEYS.NOTIFICATION_INDEX, JSON.stringify(index));
}

// ─── Channel Setup (Android) ────────────────────────────────────────────────

/**
 * Create Android notification channels. No-op on iOS.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(
    NOTIFICATION_CHANNELS.WAKE_ALARM.id,
    {
      name: NOTIFICATION_CHANNELS.WAKE_ALARM.name,
      description: NOTIFICATION_CHANNELS.WAKE_ALARM.description,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [...NOTIFICATION_CHANNELS.WAKE_ALARM.vibrationPattern],
      enableLights: NOTIFICATION_CHANNELS.WAKE_ALARM.enableLights,
      lightColor: NOTIFICATION_CHANNELS.WAKE_ALARM.lightColor,
      sound: NOTIFICATION_CHANNELS.WAKE_ALARM.sound,
    },
  );

  await Notifications.setNotificationChannelAsync(
    NOTIFICATION_CHANNELS.ACTIVITY.id,
    {
      name: NOTIFICATION_CHANNELS.ACTIVITY.name,
      description: NOTIFICATION_CHANNELS.ACTIVITY.description,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [...NOTIFICATION_CHANNELS.ACTIVITY.vibrationPattern],
      enableLights: NOTIFICATION_CHANNELS.ACTIVITY.enableLights,
      lightColor: NOTIFICATION_CHANNELS.ACTIVITY.lightColor,
    },
  );
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

/**
 * Parse "HH:mm" into hours and minutes.
 */
function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

/**
 * Build notification content for a block.
 */
function buildNotificationContent(
  block: TimeBlock,
  weekday: Weekday,
): Notifications.NotificationContentInput {
  // Title and body use block label — actual i18n is handled at display time
  // For notifications, we store the label directly (user-entered text)
  let body: string;
  if (block.kind === 'wake') {
    body = `⏰ ${block.startTime}`;
  } else if (block.kind === 'sleep') {
    // Sleep notification reminds user to set their device alarm
    body = SLEEP_NOTIFICATION_BODY;
  } else {
    body = `📋 Over 10 min: ${block.label} (${block.startTime} - ${block.endTime})`;
  }

  const content: Notifications.NotificationContentInput = {
    title: block.kind === 'sleep' ? SLEEP_NOTIFICATION_TITLE : block.label,
    body,
    data: {
      type: 'daystructure_block',
      blockId: block.id,
      blockKind: block.kind,
      weekday,
    },
  };

  // Android channel routing
  if (Platform.OS === 'android') {
    if (block.notificationProfile === 'alarm') {
      (content as any).channelId = NOTIFICATION_CHANNELS.WAKE_ALARM.id;
    } else {
      (content as any).channelId = NOTIFICATION_CHANNELS.ACTIVITY.id;
    }
  }

  return content;
}

/**
 * Schedule a single weekly notification for a block.
 */
async function scheduleBlockNotification(
  block: TimeBlock,
  weekday: Weekday,
): Promise<ScheduledNotificationEntry | null> {
  if (block.notificationProfile === 'none') return null;

  const { hour, minute } = parseTime(block.startTime);
  const weekdayNum = WEEKDAY_TO_NUMBER[weekday]; // 1=Mon, 7=Sun

  // expo-notifications uses 1=Sunday, 2=Monday, ..., 7=Saturday
  // Convert from ISO (1=Mon, 7=Sun) to expo (1=Sun, 2=Mon, ..., 7=Sat)
  const expoWeekday = weekdayNum === 7 ? 1 : weekdayNum + 1;

  // Schedule 10 minutes BEFORE block start for activity/sleep blocks
  // Wake blocks fire at exact time (alarm)
  let triggerHour = hour;
  let triggerMinute = minute;
  if (block.kind !== 'wake') {
    // Subtract 10 minutes
    triggerMinute -= 10;
    if (triggerMinute < 0) {
      triggerMinute += 60;
      triggerHour -= 1;
      if (triggerHour < 0) triggerHour = 23;
    }
  }

  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: expoWeekday,
    hour: triggerHour,
    minute: triggerMinute,
  };

  const content = buildNotificationContent(block, weekday);

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    return {
      notificationId,
      blockId: block.id,
      weekday,
      localTime: block.startTime,
      profile: block.notificationProfile,
    };
  } catch (error) {
    console.error('[DayStructure/Notifications] Failed to schedule:', error);
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Cancel all currently scheduled day structure notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  const index = await loadNotificationIndex();

  for (const entry of index.entries) {
    try {
      await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
    } catch {
      // Notification may already have been dismissed
    }
  }

  await saveNotificationIndex({
    entries: [],
    scheduledAtTimezone: '',
    lastScheduledAt: '',
  });
}

/**
 * Schedule all notifications for the full week schema.
 * Cancels existing ones first, then reschedules.
 * Respects MAX_SCHEDULED_NOTIFICATIONS limit.
 */
export async function scheduleAllNotifications(
  weekSchema: WeekSchema,
): Promise<{ scheduled: number; skipped: number }> {
  // Cancel existing
  await cancelAllNotifications();

  const entries: ScheduledNotificationEntry[] = [];
  let skipped = 0;

  for (const weekday of WEEKDAYS) {
    const day = weekSchema[weekday];
    if (!day || day.blocks.length === 0) continue;

    for (const block of day.blocks) {
      if (entries.length >= MAX_SCHEDULED_NOTIFICATIONS) {
        skipped++;
        continue;
      }

      const entry = await scheduleBlockNotification(block, weekday);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  // Save index
  const newIndex: NotificationIndex = {
    entries,
    scheduledAtTimezone: DayStructureTimeAdapter.getCurrentTimezone(),
    lastScheduledAt: new Date().toISOString(),
  };
  await saveNotificationIndex(newIndex);

  return { scheduled: entries.length, skipped };
}

/**
 * Reschedule notifications (e.g., after timezone change or schema edit).
 */
export async function rescheduleNotifications(
  weekSchema: WeekSchema,
): Promise<{ scheduled: number; skipped: number }> {
  return scheduleAllNotifications(weekSchema);
}

/**
 * Get the current notification index (for debugging/display).
 */
export async function getNotificationIndex(): Promise<NotificationIndex> {
  return loadNotificationIndex();
}

/**
 * Check if notifications need rescheduling due to timezone change.
 */
export async function needsRescheduling(): Promise<boolean> {
  const index = await loadNotificationIndex();
  if (!index.scheduledAtTimezone) return false;
  return DayStructureTimeAdapter.hasTimezoneChanged(index.scheduledAtTimezone);
}
