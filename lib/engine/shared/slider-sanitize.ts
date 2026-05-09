/**
 * Slider Sanitize — Shared Utility
 *
 * Single source of truth for filtering non-numeric keys from slider objects.
 * Used by:
 * - gpt-payload-builder.ts (outgoing payload)
 * - moodHistory snapshot creation (pipeline.ts, engine.ts)
 * - migration logic (user-context.tsx restore)
 *
 * Purpose: EliasMoodSliders.vsp is a VspLevel string (by design).
 * When creating moodHistory snapshots or sending to server, only numeric
 * slider values should be included. This function strips everything else.
 */

/**
 * Returns a new object containing only entries where the value is typeof 'number'.
 * Does NOT mutate the input.
 */
export function sanitizeSliders(sliders: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(sliders).filter(([, v]) => typeof v === 'number' && Number.isFinite(v as number))
  ) as Record<string, number>;
}
