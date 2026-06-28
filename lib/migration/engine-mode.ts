/**
 * ══════════════════════════════════════════════════════════════════════════
 * ENGINE MODE FEATURE FLAG
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Controls which engine source is active during the server migration.
 *
 * Modes:
 *   CLIENT_ACTIVE_SERVER_OFF       → Current state. Client engine only.
 *   CLIENT_ACTIVE_SERVER_SHADOW    → Client active, server runs in shadow for comparison.
 *   SERVER_ACTIVE_CLIENT_SHADOW    → Server active, client runs in shadow for validation.
 *   SERVER_ONLY_WITH_CLIENT_CRISIS_NET → Final state. Server only + offline crisis vangnet.
 *
 * Rule:
 *   This flag ONLY determines which engine-output is actively used.
 *   The UI must NOT directly import engine components based on shortcuts.
 */

/**
 * The four migration modes, ordered from start to final state.
 */
export type EngineMode =
  | 'CLIENT_ACTIVE_SERVER_OFF'
  | 'CLIENT_ACTIVE_SERVER_SHADOW'
  | 'SERVER_ACTIVE_CLIENT_SHADOW'
  | 'SERVER_ONLY_WITH_CLIENT_CRISIS_NET';

/**
 * Current engine mode. Start: CLIENT_ACTIVE_SERVER_OFF.
 * This will be advanced as migration phases complete.
 */
let currentEngineMode: EngineMode = 'CLIENT_ACTIVE_SERVER_OFF';

/**
 * Get the current engine mode.
 */
export function getEngineMode(): EngineMode {
  return currentEngineMode;
}

/**
 * Set the engine mode. Only for testing and controlled migration advancement.
 * In production, this should only be called during app initialization
 * based on a persisted config value.
 */
export function setEngineMode(mode: EngineMode): void {
  currentEngineMode = mode;
}

/**
 * Whether the client engine should run (active or shadow).
 */
export function shouldRunClientEngine(): boolean {
  return (
    currentEngineMode === 'CLIENT_ACTIVE_SERVER_OFF' ||
    currentEngineMode === 'CLIENT_ACTIVE_SERVER_SHADOW' ||
    currentEngineMode === 'SERVER_ACTIVE_CLIENT_SHADOW'
  );
}

/**
 * Whether the server engine should be called (active or shadow).
 */
export function shouldCallServerEngine(): boolean {
  return (
    currentEngineMode === 'CLIENT_ACTIVE_SERVER_SHADOW' ||
    currentEngineMode === 'SERVER_ACTIVE_CLIENT_SHADOW' ||
    currentEngineMode === 'SERVER_ONLY_WITH_CLIENT_CRISIS_NET'
  );
}

/**
 * Whether the client engine output is the active (displayed) source.
 */
export function isClientEngineActive(): boolean {
  return (
    currentEngineMode === 'CLIENT_ACTIVE_SERVER_OFF' ||
    currentEngineMode === 'CLIENT_ACTIVE_SERVER_SHADOW'
  );
}

/**
 * Whether the server engine output is the active (displayed) source.
 */
export function isServerEngineActive(): boolean {
  return (
    currentEngineMode === 'SERVER_ACTIVE_CLIENT_SHADOW' ||
    currentEngineMode === 'SERVER_ONLY_WITH_CLIENT_CRISIS_NET'
  );
}

/**
 * Whether the client-side crisis safety net should be active.
 * Always true in final mode; also true in server-active mode as fallback.
 */
export function shouldRunClientCrisisNet(): boolean {
  return (
    currentEngineMode === 'SERVER_ACTIVE_CLIENT_SHADOW' ||
    currentEngineMode === 'SERVER_ONLY_WITH_CLIENT_CRISIS_NET'
  );
}
