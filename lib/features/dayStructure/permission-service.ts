/**
 * Dagstructuur Feature — Permission Service
 *
 * Manages notification permission state and the bell state machine.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { BellState } from './types';
import { STORAGE_KEYS } from './types';

// ─── Bell State Persistence ─────────────────────────────────────────────────

/**
 * Load the current bell state from storage.
 */
export async function loadBellState(): Promise<BellState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.BELL_STATE);
    if (!raw) return 'not_configured';
    return raw as BellState;
  } catch {
    return 'not_configured';
  }
}

/**
 * Save the bell state to storage.
 */
export async function saveBellState(state: BellState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.BELL_STATE, state);
}

// ─── Permission Checks ──────────────────────────────────────────────────────

/**
 * Check current notification permission status.
 */
export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Request notification permission from the OS.
 * Returns the new permission status.
 */
export async function requestPermission(): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'web') return 'denied';

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: false,
    },
  });

  return status === 'granted' ? 'granted' : 'denied';
}

// ─── Bell State Machine ─────────────────────────────────────────────────────

/**
 * Resolve the bell state based on current conditions.
 * Call this at app start and after permission changes.
 */
export async function resolveBellState(params: {
  isConfigured: boolean;
}): Promise<BellState> {
  // If no schema configured, always not_configured
  if (!params.isConfigured) {
    await saveBellState('not_configured');
    return 'not_configured';
  }

  // Check OS permission
  const permission = await getPermissionStatus();

  if (permission === 'denied') {
    await saveBellState('denied');
    return 'denied';
  }

  // If permission is undetermined, keep current state (don't auto-prompt)
  if (permission === 'undetermined') {
    const current = await loadBellState();
    // If was previously enabled/disabled, keep that intent
    if (current === 'enabled' || current === 'disabled') {
      return current;
    }
    // Default to disabled until user explicitly enables
    await saveBellState('disabled');
    return 'disabled';
  }

  // Permission granted — check user preference
  const current = await loadBellState();
  if (current === 'disabled') {
    // User explicitly disabled, respect that
    return 'disabled';
  }

  // Permission granted + user hasn't disabled → enabled
  await saveBellState('enabled');
  return 'enabled';
}

/**
 * User toggles bell ON.
 * Requests permission if needed, then enables.
 */
export async function enableBell(): Promise<BellState> {
  const permission = await getPermissionStatus();

  if (permission === 'undetermined') {
    const result = await requestPermission();
    if (result === 'denied') {
      await saveBellState('denied');
      return 'denied';
    }
  } else if (permission === 'denied') {
    // Can't enable — OS denied
    await saveBellState('denied');
    return 'denied';
  }

  await saveBellState('enabled');
  return 'enabled';
}

/**
 * User toggles bell OFF.
 */
export async function disableBell(): Promise<BellState> {
  await saveBellState('disabled');
  return 'disabled';
}

/**
 * Toggle bell state. Returns new state.
 */
export async function toggleBell(params: {
  isConfigured: boolean;
}): Promise<BellState> {
  if (!params.isConfigured) return 'not_configured';

  const current = await loadBellState();

  if (current === 'enabled') {
    return disableBell();
  } else {
    return enableBell();
  }
}

// ─── Streaks Toggle ────────────────────────────────────────────────────────

/**
 * Load whether streaks are enabled. Defaults to true (on).
 */
export async function loadStreaksEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.STREAKS_ENABLED);
    if (raw === null) return true; // default on
    return raw === 'true';
  } catch {
    return true;
  }
}

/**
 * Save streaks enabled preference.
 */
export async function saveStreaksEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.STREAKS_ENABLED, String(enabled));
}

/**
 * Toggle streaks on/off. Returns the new state.
 */
export async function toggleStreaks(): Promise<boolean> {
  const current = await loadStreaksEnabled();
  const next = !current;
  await saveStreaksEnabled(next);
  return next;
}
