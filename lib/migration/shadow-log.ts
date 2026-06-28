/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHADOW LOGGING — LOCAL ENCRYPTED ONLY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Because server may NOT store personal data persistently:
 *   - Client stores shadow comparison logs locally encrypted.
 *   - Server returns only output.
 *   - Mismatch analysis happens locally or in developer-only export.
 *   - Raw user text NEVER goes to server logs.
 *
 * Shadow log entry contains:
 *   - sessionId, turnId, timestamp
 *   - clientEngineVersion, serverEngineVersion
 *   - normalized input hash
 *   - per-field match/mismatch
 *   - severity
 *   - redacted summary
 *   - crisis mismatch flag
 */

import type { CanonicalEngineOutput } from './engine-output.types';

// ─── Shadow Log Entry ─────────────────────────────────────────────────

export type ShadowMismatchSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ShadowFieldComparison {
  field: string;
  clientValue: string | number | boolean;
  serverValue: string | number | boolean;
  match: boolean;
  /** Severity of this specific mismatch. */
  severity: ShadowMismatchSeverity;
}

export interface ShadowLogEntry {
  /** Session identifier. */
  sessionId: string;
  /** Turn identifier (unique per message in session). */
  turnId: string;
  /** Timestamp of comparison (device time ISO). */
  timestamp: string;
  /** Client engine version/hash. */
  clientEngineVersion: string;
  /** Server engine version/hash. */
  serverEngineVersion: string;
  /** Normalized input hash (for deduplication, no content). */
  normalizedInputHash: string;
  /** Per-field comparison results. */
  fieldComparisons: ShadowFieldComparison[];
  /** Overall severity (highest of all field mismatches). */
  overallSeverity: ShadowMismatchSeverity;
  /** Redacted summary (no personal content, only field names and match status). */
  redactedSummary: string;
  /** Whether there was a crisis-related mismatch (zero tolerance). */
  crisisMismatch: boolean;
  /** Total fields compared. */
  totalFields: number;
  /** Total fields matched. */
  matchedFields: number;
}

// ─── Comparison Logic ─────────────────────────────────────────────────

/**
 * Fields to compare and their severity if mismatched.
 * Critical: crisis/safety fields — zero tolerance.
 * High: module selection, zone color — affects user experience.
 * Medium: scores, trends — may differ slightly.
 * Low: emotion detection, trajectory — LLM-dependent.
 */
const FIELD_SEVERITY_MAP: Record<string, ShadowMismatchSeverity> = {
  // Critical — zero tolerance
  crisisLevel: 'critical',
  showEmergency: 'critical',
  relapseIntentDetected: 'critical',
  status: 'critical',
  // High — affects user experience
  dominantModule: 'high',
  zoneColor: 'high',
  responseDirection: 'high',
  riskLevel: 'high',
  emotionalState: 'high',
  loopDetected: 'high',
  // Medium — may differ slightly
  zoneScore: 'medium',
  moodTrend: 'medium',
  liveIntent: 'medium',
  selectedModel: 'medium',
  'regulationResult.action': 'medium',
  'regulationResult.zone': 'medium',
  'regulationResult.effectiveDepth': 'medium',
  // Low — LLM-dependent
  currentEmotion: 'low',
  intensityTrajectory: 'low',
  clinicalAnnotationPresent: 'low',
};

/**
 * Compare two CanonicalEngineOutput objects field by field.
 * Returns a ShadowLogEntry (without sessionId/turnId/timestamp — caller fills those).
 */
export function compareEngineOutputs(
  client: CanonicalEngineOutput,
  server: CanonicalEngineOutput,
  meta: {
    sessionId: string;
    turnId: string;
    timestamp: string;
    clientEngineVersion: string;
    serverEngineVersion: string;
    normalizedInputHash: string;
  }
): ShadowLogEntry {
  const fieldComparisons: ShadowFieldComparison[] = [];

  // Compare flat fields
  const flatFields: (keyof CanonicalEngineOutput)[] = [
    'riskLevel', 'crisisLevel', 'showEmergency', 'relapseIntentDetected',
    'emotionalState', 'currentEmotion', 'moodTrend',
    'dominantModule', 'loopDetected',
    'zoneScore', 'zoneColor',
    'liveIntent', 'intensityTrajectory', 'responseDirection',
    'selectedModel', 'status', 'clinicalAnnotationPresent',
  ];

  for (const field of flatFields) {
    const cv = client[field];
    const sv = server[field];
    let match: boolean;

    if (field === 'zoneScore') {
      // Tolerance: max 1 point difference for floating/rounding
      match = Math.abs((cv as number) - (sv as number)) <= 1;
    } else {
      match = cv === sv;
    }

    fieldComparisons.push({
      field,
      clientValue: cv as string | number | boolean,
      serverValue: sv as string | number | boolean,
      match,
      severity: match ? 'none' : (FIELD_SEVERITY_MAP[field] ?? 'low'),
    });
  }

  // Compare regulation result
  const regFields: (keyof CanonicalEngineOutput['regulationResult'])[] = [
    'action', 'zone', 'effectiveDepth', 'wasSoftened', 'wasSkipped', 'hasIntervention',
  ];
  for (const rf of regFields) {
    const cv = client.regulationResult[rf];
    const sv = server.regulationResult[rf];
    const match = cv === sv;
    const fullField = `regulationResult.${rf}`;
    fieldComparisons.push({
      field: fullField,
      clientValue: cv as string | number | boolean,
      serverValue: sv as string | number | boolean,
      match,
      severity: match ? 'none' : (FIELD_SEVERITY_MAP[fullField] ?? 'medium'),
    });
  }

  // Compare moduleActivations (order-independent, by moduleId)
  const clientModules = new Set(client.moduleActivations.map(m => m.moduleId));
  const serverModules = new Set(server.moduleActivations.map(m => m.moduleId));
  const modulesMatch = clientModules.size === serverModules.size &&
    [...clientModules].every(m => serverModules.has(m));
  fieldComparisons.push({
    field: 'moduleActivations',
    clientValue: [...clientModules].sort().join(','),
    serverValue: [...serverModules].sort().join(','),
    match: modulesMatch,
    severity: modulesMatch ? 'none' : 'high',
  });

  // Determine overall severity
  const severityOrder: ShadowMismatchSeverity[] = ['none', 'low', 'medium', 'high', 'critical'];
  let overallSeverity: ShadowMismatchSeverity = 'none';
  for (const fc of fieldComparisons) {
    if (severityOrder.indexOf(fc.severity) > severityOrder.indexOf(overallSeverity)) {
      overallSeverity = fc.severity;
    }
  }

  // Crisis mismatch flag
  const crisisMismatch = fieldComparisons.some(
    fc => !fc.match && fc.severity === 'critical'
  );

  // Redacted summary (no personal content)
  const mismatches = fieldComparisons.filter(fc => !fc.match);
  const redactedSummary = mismatches.length === 0
    ? 'FULL_MATCH'
    : `MISMATCH(${mismatches.length}): ${mismatches.map(m => `${m.field}[${m.severity}]`).join(', ')}`;

  return {
    sessionId: meta.sessionId,
    turnId: meta.turnId,
    timestamp: meta.timestamp,
    clientEngineVersion: meta.clientEngineVersion,
    serverEngineVersion: meta.serverEngineVersion,
    normalizedInputHash: meta.normalizedInputHash,
    fieldComparisons,
    overallSeverity,
    redactedSummary,
    crisisMismatch,
    totalFields: fieldComparisons.length,
    matchedFields: fieldComparisons.filter(fc => fc.match).length,
  };
}

// ─── Shadow Log Store ─────────────────────────────────────────────────

/**
 * Interface for the shadow log store.
 * Implementation will use local encrypted storage (same pattern as logs.dat).
 */
export interface ShadowLogStore {
  /** Append a shadow log entry (locally encrypted). */
  append(entry: ShadowLogEntry): Promise<void>;
  /** Read all entries (for developer export only). */
  readAll(): Promise<ShadowLogEntry[]>;
  /** Get summary statistics. */
  getSummary(): Promise<{
    totalComparisons: number;
    totalMatches: number;
    crisisMismatches: number;
    highMismatches: number;
    matchRate: number;
  }>;
  /** Clear all entries (after export or for storage management). */
  clear(): Promise<void>;
}
