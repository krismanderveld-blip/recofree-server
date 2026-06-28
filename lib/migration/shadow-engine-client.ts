/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHADOW ENGINE CLIENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Called from chat.tsx AFTER the client engine has produced its result.
 * Sends the same input to the server engine endpoint and compares outputs.
 *
 * Behavior:
 *   - Fire-and-forget: never blocks the client response
 *   - Logs comparison results to the shadow log store (encrypted, local)
 *   - Only active when engine mode is CLIENT_ACTIVE_SERVER_SHADOW
 *   - If the server call fails, logs the failure but does NOT affect the user
 *
 * Privacy:
 *   - Data is sent to the server for processing only (transit-only)
 *   - Server does NOT persist any data
 *   - Shadow logs are stored locally encrypted
 */

import { getEngineMode } from './engine-mode';
import type { CanonicalEngineInput } from './engine-input.types';
import { createShadowLogStore } from './shadow-log-store';
import { Platform } from 'react-native';

// Singleton shadow log store instance
let _shadowLogStore: ReturnType<typeof createShadowLogStore> | null = null;
function getShadowLogStore() {
  if (!_shadowLogStore) _shadowLogStore = createShadowLogStore();
  return _shadowLogStore;
}

// ─── Types ───────────────────────────────────────────────────────────

interface ServerEngineResponse {
  stateAnalysis: {
    riskLevel: string;
    emotionalState: string;
    moodTrend: string;
    activeTriggers: string[];
    triggerContextActive: boolean;
    patternAccumulation: number;
    tone: string;
    pacing: string;
    suggestionIntensity: number;
    crisisMonitoring: boolean;
    crisisThresholdLowered: boolean;
    priorityModules: string[];
    stateSummary: string;
  };
  dominantState: null;
  engineVersion: string;
  latencyMs: number;
}

interface ClientEngineOutput {
  stateAnalysis: {
    riskLevel: string;
    emotionalState: string;
    moodTrend: string;
    activeTriggers: string[];
    tone: string;
    pacing: string;
    suggestionIntensity: number;
    crisisMonitoring: boolean;
    priorityModules: string[];
  };
}

// ─── Configuration ───────────────────────────────────────────────────

function getServerBaseUrl(): string {
  // In development, the server runs on port 3000
  // The API URL is configured via environment or defaults
  if (Platform.OS === 'web') {
    return window.location.origin.replace(/:\d+$/, ':3000');
  }
  // For native, use the same host as the Metro bundler
  return 'http://localhost:3000';
}

// ─── Shadow Call ─────────────────────────────────────────────────────

/**
 * Fire-and-forget shadow call to the server engine.
 * Compares server output with client output and logs the result.
 *
 * MUST be called AFTER the client engine has completed.
 * MUST NOT block or affect the client response in any way.
 */
export async function fireShadowEngineCall(
  input: CanonicalEngineInput,
  clientOutput: ClientEngineOutput,
): Promise<void> {
  // Only run in shadow mode
  const mode = getEngineMode();
  if (mode !== 'CLIENT_ACTIVE_SERVER_SHADOW') return;

  try {
    const baseUrl = getServerBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`${baseUrl}/api/engine-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[shadow-engine] Server returned', response.status);
      await logShadowFailure(input, 'server_error', `HTTP ${response.status}`);
      return;
    }

    const serverResult: ServerEngineResponse = await response.json();

    // Compare outputs
    const comparison = compareStateAnalysis(clientOutput, serverResult);

    // Log to shadow store (conform ShadowLogEntry interface)
    const hasCrisisMismatch = comparison.mismatches.some(m => m.severity === 'critical');
    await getShadowLogStore().append({
      sessionId: input.deviceTimeContext.sessionStartedAtDeviceIso,
      turnId: `${input.messageCount}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      clientEngineVersion: 'client-v1.0',
      serverEngineVersion: serverResult.engineVersion,
      normalizedInputHash: hashInput(input),
      fieldComparisons: comparison.mismatches.map(m => ({
        field: m.field,
        clientValue: String(m.clientValue),
        serverValue: String(m.serverValue),
        match: false,
        severity: m.severity,
      })),
      overallSeverity: hasCrisisMismatch ? 'critical' : comparison.mismatches.length > 0 ? comparison.mismatches[0].severity : 'none',
      redactedSummary: comparison.allMatch
        ? 'ALL_MATCH'
        : `MISMATCH: ${comparison.mismatches.map(m => m.field).join(', ')}`,
      crisisMismatch: hasCrisisMismatch,
      totalFields: 7,
      matchedFields: 7 - comparison.mismatches.length,
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[shadow-engine] Server call timed out');
      await logShadowFailure(input, 'timeout', 'Request timed out after 5s');
    } else {
      console.warn('[shadow-engine] Error:', error.message);
      await logShadowFailure(input, 'network_error', error.message);
    }
  }
}

// ─── Comparison Logic ────────────────────────────────────────────────

interface ComparisonResult {
  allMatch: boolean;
  mismatches: Array<{
    field: string;
    clientValue: any;
    serverValue: any;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
}

function compareStateAnalysis(
  client: ClientEngineOutput,
  server: ServerEngineResponse,
): ComparisonResult {
  const mismatches: ComparisonResult['mismatches'] = [];

  // Critical: crisis detection must match
  if (client.stateAnalysis.crisisMonitoring !== server.stateAnalysis.crisisMonitoring) {
    mismatches.push({
      field: 'crisisMonitoring',
      clientValue: client.stateAnalysis.crisisMonitoring,
      serverValue: server.stateAnalysis.crisisMonitoring,
      severity: 'critical',
    });
  }

  // High: risk level
  if (client.stateAnalysis.riskLevel !== server.stateAnalysis.riskLevel) {
    mismatches.push({
      field: 'riskLevel',
      clientValue: client.stateAnalysis.riskLevel,
      serverValue: server.stateAnalysis.riskLevel,
      severity: 'high',
    });
  }

  // High: emotional state
  if (client.stateAnalysis.emotionalState !== server.stateAnalysis.emotionalState) {
    mismatches.push({
      field: 'emotionalState',
      clientValue: client.stateAnalysis.emotionalState,
      serverValue: server.stateAnalysis.emotionalState,
      severity: 'high',
    });
  }

  // Medium: tone
  if (client.stateAnalysis.tone !== server.stateAnalysis.tone) {
    mismatches.push({
      field: 'tone',
      clientValue: client.stateAnalysis.tone,
      serverValue: server.stateAnalysis.tone,
      severity: 'medium',
    });
  }

  // Medium: pacing
  if (client.stateAnalysis.pacing !== server.stateAnalysis.pacing) {
    mismatches.push({
      field: 'pacing',
      clientValue: client.stateAnalysis.pacing,
      serverValue: server.stateAnalysis.pacing,
      severity: 'medium',
    });
  }

  // Low: priority modules (order-independent comparison)
  const clientModules = [...client.stateAnalysis.priorityModules].sort();
  const serverModules = [...server.stateAnalysis.priorityModules].sort();
  if (JSON.stringify(clientModules) !== JSON.stringify(serverModules)) {
    mismatches.push({
      field: 'priorityModules',
      clientValue: clientModules,
      serverValue: serverModules,
      severity: 'low',
    });
  }

  // Low: suggestion intensity (allow ±1 difference)
  if (Math.abs(client.stateAnalysis.suggestionIntensity - server.stateAnalysis.suggestionIntensity) > 1) {
    mismatches.push({
      field: 'suggestionIntensity',
      clientValue: client.stateAnalysis.suggestionIntensity,
      serverValue: server.stateAnalysis.suggestionIntensity,
      severity: 'low',
    });
  }

  return {
    allMatch: mismatches.length === 0,
    mismatches,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function hashInput(input: CanonicalEngineInput): string {
  // Simple hash for deduplication — not cryptographic
  const key = `${input.userName}_${input.message.slice(0, 50)}_${input.deviceTimeContext.deviceNowIso}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function logShadowFailure(
  input: CanonicalEngineInput,
  reason: string,
  _detail: string,
): Promise<void> {
  try {
    await getShadowLogStore().append({
      sessionId: input.deviceTimeContext.sessionStartedAtDeviceIso,
      turnId: `${input.messageCount}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      clientEngineVersion: 'client-v1.0',
      serverEngineVersion: 'unreachable',
      normalizedInputHash: hashInput(input),
      fieldComparisons: [{
        field: '_server_call',
        clientValue: 'attempted',
        serverValue: reason,
        match: false,
        severity: 'high' as const,
      }],
      overallSeverity: 'high',
      redactedSummary: `SERVER_UNREACHABLE: ${reason}`,
      crisisMismatch: false,
      totalFields: 0,
      matchedFields: 0,
    });
  } catch {
    // Silently fail — shadow logging must never crash the app
  }
}
