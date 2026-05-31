/**
 * EngineProvider — Singleton manager for LocalSignalEngine
 *
 * Manages the active signal engine instance. Default: GptSignalEngine.
 * Provides setEngine/resetEngine for testing and future local model swap.
 *
 * Usage:
 *   import { getEngine, initGptSignalEngine } from './engine-provider';
 *   initGptSignalEngine('https://api.example.com');
 *   const engine = getEngine();
 *   const signals = await engine.detectSignals(message);
 */

import type { LocalSignalEngine } from './signal-engine';
import { NullSignalEngine } from './null-engine';
import { GptSignalEngine } from './gpt-signal-engine';

// ─── Singleton State ────────────────────────────────────────────

let activeEngine: LocalSignalEngine = new NullSignalEngine();

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get the currently active signal engine.
 * Returns NullSignalEngine if not yet initialized.
 */
export function getEngine(): LocalSignalEngine {
  return activeEngine;
}

/**
 * Initialize the GptSignalEngine with the API base URL.
 * This should be called once at app startup.
 */
export function initGptSignalEngine(apiBaseUrl: string): void {
  activeEngine = new GptSignalEngine(apiBaseUrl);
}

/**
 * Set a custom engine (for testing or future local model).
 */
export function setEngine(engine: LocalSignalEngine): void {
  activeEngine = engine;
}

/**
 * Reset to NullSignalEngine (for testing or cleanup).
 */
export function resetEngine(): void {
  activeEngine = new NullSignalEngine();
}
