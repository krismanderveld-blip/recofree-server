/**
 * Import Diagnostics — on-screen visible diagnostic log for APK builds.
 *
 * Captures each step of the import flow with status, timing, and error details.
 * Designed to be displayed on-screen (not console) so Kris can see exactly
 * where the import fails on a production APK without Metro console access.
 */

import { LocalDeviceTimeService } from "@/lib/core/time";
export interface ImportDiagStep {
  id: number;
  timestamp: string;
  label: string;
  status: 'OK' | 'FAIL' | 'INFO' | 'WARN';
  detail?: string;
}

// ─── In-memory store ───────────────────────────────────────

let steps: ImportDiagStep[] = [];
let stepCounter = 0;

/**
 * Clear all diagnostic steps (call at start of new import attempt).
 */
export function clearImportDiag(): void {
  steps = [];
  stepCounter = 0;
}

/**
 * Log a diagnostic step. Returns the step ID.
 */
export function logImportDiag(
  label: string,
  status: ImportDiagStep['status'],
  detail?: string,
): number {
  stepCounter++;
  steps.push({
    id: stepCounter,
    timestamp: LocalDeviceTimeService.now().utcIso.slice(11, 23), // HH:mm:ss.SSS
    label,
    status,
    detail: detail ?? undefined,
  });
  return stepCounter;
}

/**
 * Get all diagnostic steps for display.
 */
export function getImportDiagSteps(): ImportDiagStep[] {
  return [...steps];
}

/**
 * Format all steps into a single readable string for on-screen display.
 */
export function formatImportDiag(): string {
  if (steps.length === 0) return '(no diagnostic data)';
  return steps.map((s) => {
    const icon = s.status === 'OK' ? '✓' : s.status === 'FAIL' ? '✗' : s.status === 'WARN' ? '⚠' : '•';
    const line = `${icon} [${s.timestamp}] ${s.label}`;
    return s.detail ? `${line}\n   → ${s.detail}` : line;
  }).join('\n');
}
