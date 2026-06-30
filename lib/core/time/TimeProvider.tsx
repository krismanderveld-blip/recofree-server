/**
 * TimeProvider — React context for time service initialization.
 *
 * Wraps the app to ensure:
 * 1. LocalDeviceTimeService is initialized on mount
 * 2. InternalClockService is calibrated on mount (single source of truth)
 * 3. On EVERY foreground return: refresh device context so time is always fresh
 *    (fixes drift after long background periods)
 * 4. If timezone changed: signal for notification rescheduling
 *
 * Usage in app/_layout.tsx:
 * ```tsx
 * <TimeProvider>
 *   <ThemeProvider>
 *     ...
 *   </ThemeProvider>
 * </TimeProvider>
 * ```
 */

import React, { useEffect, useRef, createContext, useContext } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { LocalDeviceTimeService } from './LocalDeviceTimeService';
import { InternalClockService } from './InternalClockService';

interface TimeContextValue {
  /** Force refresh of device timezone/locale context and recalibrate internal clock. */
  refresh: () => { timeZoneChanged: boolean };
}

const TimeContext = createContext<TimeContextValue>({
  refresh: () => ({ timeZoneChanged: false }),
});

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initialize LocalDeviceTimeService context
    LocalDeviceTimeService.refreshDeviceTimeContext();

    // Calibrate InternalClockService (single source of truth)
    InternalClockService.calibrate();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        // On EVERY foreground return: recalibrate to get fresh device time.
        // This prevents stale time after long background periods.
        const { timeZoneChanged } = InternalClockService.recalibrateOnForeground();
        if (timeZoneChanged) {
          console.log('[TimeProvider] Timezone changed on foreground return');
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const refresh = () => {
    const result = InternalClockService.recalibrateOnForeground();
    return result;
  };

  return (
    <TimeContext.Provider value={{ refresh }}>
      {children}
    </TimeContext.Provider>
  );
}

/**
 * Hook to access the TimeProvider context (for manual refresh triggers).
 * Most code should use InternalClockService.now() directly.
 */
export function useTimeProvider(): TimeContextValue {
  return useContext(TimeContext);
}
