/**
 * EngineProvider — manages the active LocalSignalEngine instance.
 * Default: NullSignalEngine. Swap to Gemma (or other) via setEngine().
 */

import type { LocalSignalEngine } from './signal-engine';
import { NullSignalEngine } from './null-engine';

let activeEngine: LocalSignalEngine = new NullSignalEngine();

/**
 * Get the currently active signal engine.
 * Always returns a valid engine (NullSignalEngine if no model loaded).
 */
export function getEngine(): LocalSignalEngine {
  return activeEngine;
}

/**
 * Swap the active engine to a new implementation (e.g., Gemma).
 * The pipeline will automatically use the new engine on next message.
 */
export function setEngine(engine: LocalSignalEngine): void {
  activeEngine = engine;
}

/**
 * Reset to NullSignalEngine (e.g., when model is unloaded).
 */
export function resetEngine(): void {
  activeEngine = new NullSignalEngine();
}
