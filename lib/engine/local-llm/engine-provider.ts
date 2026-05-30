/**
 * EngineProvider — manages the active LocalSignalEngine instance.
 * Default: NullSignalEngine. Swap to Gemma (or other) via setEngine().
 */

import type { LocalSignalEngine } from './signal-engine';
import { NullSignalEngine } from './null-engine';
import { GemmaSignalEngine } from './gemma-signal-engine';

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

/**
 * Attempt to load the Gemma model from the given path.
 * If successful, swaps the active engine to GemmaSignalEngine.
 * If model file not found or load fails, logs warning and stays on NullEngine.
 *
 * Call this at app start (e.g., in _layout.tsx useEffect).
 */
export async function initGemmaEngine(modelPath: string): Promise<boolean> {
  const gemma = new GemmaSignalEngine(modelPath);
  const success = await gemma.load();
  if (success) {
    activeEngine = gemma;
    console.log('[EngineProvider] Switched to GemmaSignalEngine');
    return true;
  } else {
    console.warn('[EngineProvider] Gemma load failed, staying on NullEngine');
    return false;
  }
}
