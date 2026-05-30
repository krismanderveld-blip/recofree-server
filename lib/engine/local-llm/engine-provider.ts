/**
 * EngineProvider — manages the active LocalSignalEngine instance.
 * Default: NullSignalEngine. Swap to Gemma 3 4B via initGemmaEngine().
 */

import type { LocalSignalEngine } from './signal-engine';
import { NullSignalEngine } from './null-engine';
import { GemmaSignalEngine, GEMMA_MODEL_FILENAME } from './gemma-signal-engine';

let activeEngine: LocalSignalEngine = new NullSignalEngine();

/**
 * Get the currently active signal engine.
 * Always returns a valid engine (NullSignalEngine if no model loaded).
 */
export function getEngine(): LocalSignalEngine {
  return activeEngine;
}

/**
 * Swap the active engine to a new implementation.
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
 * Attempt to load the Gemma 3 4B model from the given path.
 * If successful, swaps the active engine to GemmaSignalEngine.
 * If model file not found or load fails, logs warning and stays on NullEngine.
 *
 * Call this at app start (e.g., in _layout.tsx useEffect).
 *
 * @param modelPath - Full path to the GGUF file on device.
 *   Expected: `${FileSystem.documentDirectory}models/${GEMMA_MODEL_FILENAME}`
 *   Android adb: `adb push gemma-3-4b-it-Q4_K_M.gguf /sdcard/Download/`
 *   Then copy to app documents dir at runtime.
 */
export async function initGemmaEngine(modelPath: string): Promise<boolean> {
  const gemma = new GemmaSignalEngine(modelPath);
  const success = await gemma.load();
  if (success) {
    activeEngine = gemma;
    console.log('[EngineProvider] Switched to GemmaSignalEngine (Gemma 3 4B)');
    return true;
  } else {
    console.warn('[EngineProvider] Gemma 3 4B load failed, staying on NullEngine');
    return false;
  }
}

/** Re-export model filename for convenience */
export { GEMMA_MODEL_FILENAME };
