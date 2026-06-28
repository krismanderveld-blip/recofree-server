/**
 * useLocalDeviceTime — React hook for accessing LocalDeviceTimeService.
 *
 * Provides reactive access to the central time source.
 * Handles AppState foreground refresh automatically.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { LocalDeviceTimeService } from './LocalDeviceTimeService';
import type { LocalTimeSnapshot, CycleTimestamp } from './types';

/**
 * Hook that provides access to LocalDeviceTimeService and automatically
 * refreshes device context when the app returns to foreground.
 *
 * Usage:
 * ```tsx
 * const { now, getCurrentLocalHour, toCycleTimestamp } = useLocalDeviceTime();
 * const snapshot = now(); // Full snapshot
 * const hour = getCurrentLocalHour(); // Just the hour
 * ```
 */
export function useLocalDeviceTime() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initial refresh on mount
    LocalDeviceTimeService.refreshDeviceTimeContext();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        // App returned to foreground — refresh timezone/locale
        const { timeZoneChanged } = LocalDeviceTimeService.refreshDeviceTimeContext();
        if (timeZoneChanged) {
          console.log('[LocalDeviceTime] Timezone changed on foreground resume');
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const now = useCallback((): LocalTimeSnapshot => {
    return LocalDeviceTimeService.now();
  }, []);

  const getCurrentLocalDate = useCallback((): string => {
    return LocalDeviceTimeService.getCurrentLocalDate();
  }, []);

  const getCurrentLocalDayKey = useCallback((): string => {
    return LocalDeviceTimeService.getCurrentLocalDayKey();
  }, []);

  const getCurrentLocalHour = useCallback((): number => {
    return LocalDeviceTimeService.getCurrentLocalHour();
  }, []);

  const getCurrentTimeZone = useCallback((): string => {
    return LocalDeviceTimeService.getCurrentTimeZone();
  }, []);

  const toCycleTimestamp = useCallback((): CycleTimestamp => {
    return LocalDeviceTimeService.toCycleTimestamp();
  }, []);

  const formatLocalTime = useCallback(LocalDeviceTimeService.formatLocalTime.bind(LocalDeviceTimeService), []);

  const hasLocalDayChanged = useCallback(
    (previousSnapshot: Pick<LocalTimeSnapshot, 'localDayKey'>): boolean => {
      return LocalDeviceTimeService.hasLocalDayChanged(previousSnapshot);
    },
    []
  );

  return {
    now,
    getCurrentLocalDate,
    getCurrentLocalDayKey,
    getCurrentLocalHour,
    getCurrentTimeZone,
    toCycleTimestamp,
    formatLocalTime,
    hasLocalDayChanged,
  };
}
