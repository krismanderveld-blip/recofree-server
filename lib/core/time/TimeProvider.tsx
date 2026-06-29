/**
 * TimeProvider — React context for time service initialization.
 *
 * Wraps the app to ensure:
 * 1. LocalDeviceTimeService is initialized on mount
 * 2. InternalClockService is calibrated on mount (single source of truth)
 * 3. On foreground return: timezone check → recalibrate if changed
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
        // On foreground return: check timezone and recalibrate if changed
        const recalibrated = InternalClockService.checkAndRecalibrate();
        if (recalibrated) {
          console.log('[TimeProvider] Internal clock recalibrated after timezone change');
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const refresh = () => {
    const result = LocalDeviceTimeService.refreshDeviceTimeContext();
    if (result.timeZoneChanged) {
      InternalClockService.calibrate();
    }
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
