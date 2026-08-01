/**
 * backpack-dirty-flag.ts
 * 
 * Simple in-memory flag that signals the pipeline to rebuild context.dat
 * when the backpack has been edited during an active chat session.
 * 
 * Flow:
 * 1. user-context.tsx calls `markBackpackDirty()` after any backpack save
 * 2. pipeline.ts checks `isBackpackDirty()` before the context.dat block
 * 3. If dirty, pipeline rebuilds context.dat even on follow-up messages
 * 4. After rebuild, pipeline calls `clearBackpackDirty()` to reset
 */

let _dirty = false;

/** Mark the backpack as changed since last context.dat build */
export function markBackpackDirty(): void {
  _dirty = true;
}

/** Check if backpack has changed since last context.dat build */
export function isBackpackDirty(): boolean {
  return _dirty;
}

/** Clear the dirty flag after context.dat has been rebuilt */
export function clearBackpackDirty(): void {
  _dirty = false;
}
