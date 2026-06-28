/**
 * TimeProvider — React context for LocalDeviceTimeService initialization.
 *
 * Wraps the app to ensure the time service is initialized on mount
 * and refreshed on foreground transitions. This is the single point
 * where AppState-based timezone refresh is wired.
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

interface TimeContextValue {
  /** Force refresh of device timezone/locale context. */
  refresh: () => { timeZoneChanged: boolean };
}

const TimeContext = createContext<TimeContextValue>({
  refresh: () => ({ timeZoneChanged: false }),
});

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initialize on mount
    LocalDeviceTimeService.refreshDeviceTimeContext();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        const { timeZoneChanged } = LocalDeviceTimeService.refreshDeviceTimeContext();
        if (timeZoneChanged) {
          console.log('[TimeProvider] Device timezone changed — new snapshots will use updated timezone');
        }
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const refresh = () => LocalDeviceTimeService.refreshDeviceTimeContext();

  return (
    <TimeContext.Provider value={{ refresh }}>
      {children}
    </TimeContext.Provider>
  );
}

/**
 * Hook to access the TimeProvider context (for manual refresh triggers).
 * Most code should use LocalDeviceTimeService directly or useLocalDeviceTime().
 */
export function useTimeProvider(): TimeContextValue {
  return useContext(TimeContext);
}
