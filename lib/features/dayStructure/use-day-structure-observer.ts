/**
 * Dagstructuur Feature — Observer Hook
 *
 * Root-level hook that:
 * 1. Sets up notification handler (foreground display)
 * 2. Monitors timezone changes on app foreground → reschedules
 * 3. Verifies scheduled notifications exist on foreground → reschedules if missing
 * 4. Cleans up old completion data
 */

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DayStructureTimeAdapter } from './time-adapter';
import {
  needsRescheduling,
  rescheduleNotifications,
  scheduleAllNotifications,
  setupNotificationChannels,
} from './notification-service';
import { loadBellState } from './permission-service';
import { getDocument } from './day-structure-service';
import { cleanupOldCompletions } from './completion-service';

/**
 * Set up the notification handler for foreground display.
 * Must be called at module level (outside component).
 */
export function initNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Hook to observe day structure state changes.
 * Should be mounted in the root layout.
 */
export function useDayStructureObserver(): void {
  const lastTimezoneCheck = useRef<string>('');

  useEffect(() => {
    // Setup Android notification channels on mount
    if (Platform.OS === 'android') {
      setupNotificationChannels();
    }

    // Cleanup old completions on mount
    cleanupOldCompletions().catch(() => {});

    // On mount: verify notifications are scheduled (handles app reinstall, cleared data, etc.)
    verifyAndRescheduleIfNeeded().catch(() => {});
  }, []);

  useEffect(() => {
    // Monitor app state for foreground return
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;

      try {
        // Check if timezone changed → reschedule
        const currentTz = DayStructureTimeAdapter.getCurrentTimezone();
        if (lastTimezoneCheck.current !== currentTz) {
          lastTimezoneCheck.current = currentTz;

          const bellState = await loadBellState();
          if (bellState === 'enabled') {
            const shouldReschedule = await needsRescheduling();
            if (shouldReschedule) {
              const doc = await getDocument();
              if (doc.weekSchema) {
                await rescheduleNotifications(doc.weekSchema);
                console.log('[DayStructure/Observer] Rescheduled after timezone change');
              }
            }
          }
        }

        // Also verify that OS-scheduled notifications still exist
        // (Android can clear them on reboot if RECEIVE_BOOT_COMPLETED fails,
        //  or iOS can drop them after updates)
        await verifyAndRescheduleIfNeeded();
      } catch (error) {
        console.error('[DayStructure/Observer] Foreground check error:', error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

/**
 * Verify that OS-level scheduled notifications actually exist.
 * If bell is enabled but no notifications are scheduled with the OS,
 * reschedule them. This handles:
 * - App was force-closed and notifications were cleared
 * - Device rebooted and boot receiver failed
 * - iOS dropped notifications after an app update
 */
async function verifyAndRescheduleIfNeeded(): Promise<void> {
  try {
    const bellState = await loadBellState();
    if (bellState !== 'enabled') return;

    // Check if we have any notifications registered with the OS
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length > 0) return; // All good, OS has our notifications

    // No OS notifications but bell is enabled → reschedule
    const doc = await getDocument();
    if (doc.weekSchema) {
      await scheduleAllNotifications(doc.weekSchema);
      console.log(
        '[DayStructure/Observer] Rescheduled: OS had 0 notifications but bell was enabled'
      );
    }
  } catch (error) {
    console.error('[DayStructure/Observer] Verify/reschedule error:', error);
  }
}
