/**
 * Dagstructuur Feature — Observer Hook
 *
 * Root-level hook that:
 * 1. Sets up notification handler (foreground display)
 * 2. Monitors timezone changes on app foreground
 * 3. Reschedules notifications when timezone drifts
 * 4. Cleans up old completion data
 */

import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DayStructureTimeAdapter } from './time-adapter';
import {
  needsRescheduling,
  rescheduleNotifications,
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
  }, []);

  useEffect(() => {
    // Monitor app state for timezone changes
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;

      try {
        // Check if timezone changed
        const currentTz = DayStructureTimeAdapter.getCurrentTimezone();
        if (lastTimezoneCheck.current === currentTz) return;
        lastTimezoneCheck.current = currentTz;

        // Check if bell is enabled
        const bellState = await loadBellState();
        if (bellState !== 'enabled') return;

        // Check if rescheduling needed
        const shouldReschedule = await needsRescheduling();
        if (!shouldReschedule) return;

        // Reschedule
        const doc = await getDocument();
        if (doc.weekSchema) {
          await rescheduleNotifications(doc.weekSchema);
          console.log('[DayStructure/Observer] Rescheduled notifications after timezone change');
        }
      } catch (error) {
        console.error('[DayStructure/Observer] Timezone check error:', error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
