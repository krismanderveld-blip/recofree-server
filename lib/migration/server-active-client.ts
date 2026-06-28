/**
 * ══════════════════════════════════════════════════════════════════════════
 * SERVER ACTIVE CLIENT — Checkpoint F
 * ══════════════════════════════════════════════════════════════════════════
 *
 * When engine mode is SERVER_ACTIVE_CLIENT_SHADOW:
 * - Server is the primary engine (builds GPT payload, calls OpenAI, returns patches)
 * - Client receives the response + patches and applies them locally
 * - Client engine runs in shadow (for comparison logging only, output discarded)
 *
 * When engine mode is SERVER_ONLY_WITH_CLIENT_CRISIS_NET:
 * - Server is the only engine
 * - Client engine is fully disabled
 * - Only the crisis safety net runs client-side (offline/timeout fallback)
 */

import { getEngineMode, shouldRunClientEngine } from './engine-mode';
import { applyServerPatches } from './patch-writer';
import type { ServerStatePatches } from './patch-writer';
import type {
  CanonicalEngineInput,
  DeviceTimeContextPayload,
  VspSectionPayload,
  LogsSessionPayload,
  UserDatSummaryPayload,
  ConversationMessage,
  MoodSlidersPayload,
  EngineRequestType,
} from './engine-input.types';
import type { CyclePart } from '@/lib/core/time/types';
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ServerEngineCallResult {
  success: boolean;
  /** GPT response text (the actual chat reply) */
  responseText: string | null;
  /** State patches to apply locally */
  patches: ServerStatePatches | null;
  /** Session ID from server */
  sessionId: string | null;
  /** Turn ID for idempotency */
  turnId: string | null;
  /** Latency in ms */
  latencyMs: number;
  /** Error message if failed */
  error: string | null;
  /** Whether client fallback was used */
  usedClientFallback: boolean;
}

export interface ServerEngineCallInput {
  persona: RecoFreePersona;
  userName: string;
  locale: 'nl' | 'en' | 'fr';
  country: 'NL' | 'BE' | 'FR' | 'UK' | 'US';
  guidanceDepth: string;
  clinicalModeActive: boolean;
  localUserId: string;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  moodSliders: MoodSlidersPayload;
  isSessionStart: boolean;
  vspSection: VspSectionPayload | null;
  logsSessions: LogsSessionPayload[];
  userDatSummary: UserDatSummaryPayload;
  usedModules: string[];
  previousZoneScore: number;
  messageCount: number;
  sessionStartedAtIso: string;
  apiBaseUrl: string;
}

// ─── Server Engine Call ──────────────────────────────────────────────────

const SERVER_TIMEOUT_MS = 15000; // 15s timeout for server response

/**
 * Daypart helper (inlined to avoid importing from client time module).
 */
function getDaypart(hour: number): CyclePart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export async function callServerEngine(input: ServerEngineCallInput): Promise<ServerEngineCallResult> {
  const startTime = Date.now();

  try {
    const now = new Date();
    const localHour = now.getHours();

    // Build canonical input matching CanonicalEngineInput exactly
    const engineInput: CanonicalEngineInput = {
      requestType: 'LIVE_MESSAGE',
      userType: input.persona,
      userName: input.userName,
      locale: input.locale,
      country: input.country,
      guidanceDepth: input.guidanceDepth,
      clinicalModeActive: input.clinicalModeActive,
      message: input.userMessage,
      conversationHistory: input.conversationHistory,
      moodSliders: input.moodSliders,
      isSessionStart: input.isSessionStart,
      vspSection: input.vspSection,
      logsSessions: input.logsSessions,
      userDatSummary: input.userDatSummary,
      usedModules: input.usedModules,
      previousZoneScore: input.previousZoneScore,
      messageCount: input.messageCount,
      deviceTimeContext: {
        deviceNowIso: now.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        localDate: now.toISOString().split('T')[0],
        localTime: now.toTimeString().slice(0, 8),
        greetingDaypart: getDaypart(localHour),
        cycleTimestamp: now.toISOString().split('T')[0],
        sessionStartedAtDeviceIso: input.sessionStartedAtIso,
      },
    };

    // Call server endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);

    const response = await fetch(`${input.apiBaseUrl}/api/engine-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...engineInput,
        includeGPTResponse: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const latencyMs = Date.now() - startTime;

    // Apply patches locally
    if (result.statePatches && result.sessionId && result.turnId) {
      await applyServerPatches(
        result.statePatches,
        result.sessionId,
        result.turnId,
        input.persona,
        input.localUserId,
      );
    }

    return {
      success: true,
      responseText: result.gptResponse?.text ?? null,
      patches: result.statePatches ?? null,
      sessionId: result.sessionId ?? null,
      turnId: result.turnId ?? null,
      latencyMs,
      error: null,
      usedClientFallback: false,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      responseText: null,
      patches: null,
      sessionId: null,
      turnId: null,
      latencyMs,
      error: err.message || 'Unknown server engine error',
      usedClientFallback: false,
    };
  }
}

// ─── Mode-aware Engine Dispatcher ────────────────────────────────────────

export interface EngineDispatchResult {
  /** The response text to show to the user */
  responseText: string;
  /** Whether the server was used as primary */
  serverPrimary: boolean;
  /** Whether client fallback was activated */
  clientFallback: boolean;
  /** Latency in ms */
  latencyMs: number;
  /** Any error that occurred */
  error: string | null;
}

/**
 * Dispatches the engine call based on the current engine mode.
 *
 * - CLIENT_ACTIVE_SERVER_OFF: only client engine runs (no server call)
 * - CLIENT_ACTIVE_SERVER_SHADOW: client primary, server shadow (fire-and-forget)
 * - SERVER_ACTIVE_CLIENT_SHADOW: server primary, client shadow (for comparison)
 * - SERVER_ONLY_WITH_CLIENT_CRISIS_NET: server only, client crisis net only
 *
 * @param serverInput - Input for the server engine call
 * @param runClientEngine - Callback that runs the client engine and returns the response text
 * @returns The dispatch result with the response text to show
 */
export async function dispatchEngine(
  serverInput: ServerEngineCallInput,
  runClientEngine: () => Promise<string>,
): Promise<EngineDispatchResult> {
  const mode = getEngineMode();
  const startTime = Date.now();

  switch (mode) {
    case 'CLIENT_ACTIVE_SERVER_OFF': {
      // Only client engine
      const text = await runClientEngine();
      return {
        responseText: text,
        serverPrimary: false,
        clientFallback: false,
        latencyMs: Date.now() - startTime,
        error: null,
      };
    }

    case 'CLIENT_ACTIVE_SERVER_SHADOW': {
      // Client primary, server shadow (fire-and-forget)
      const text = await runClientEngine();
      // Fire shadow call non-blocking
      callServerEngine(serverInput).catch(() => { /* shadow failure is non-fatal */ });
      return {
        responseText: text,
        serverPrimary: false,
        clientFallback: false,
        latencyMs: Date.now() - startTime,
        error: null,
      };
    }

    case 'SERVER_ACTIVE_CLIENT_SHADOW': {
      // Server primary, client shadow
      const serverResult = await callServerEngine(serverInput);

      if (serverResult.success && serverResult.responseText) {
        // Server succeeded — run client in shadow (non-blocking, for comparison)
        if (shouldRunClientEngine()) {
          runClientEngine().catch(() => { /* shadow failure is non-fatal */ });
        }
        return {
          responseText: serverResult.responseText,
          serverPrimary: true,
          clientFallback: false,
          latencyMs: serverResult.latencyMs,
          error: null,
        };
      }

      // Server failed — fall back to client engine
      console.warn(`[ServerActiveClient] Server failed (${serverResult.error}), falling back to client engine`);
      const fallbackText = await runClientEngine();
      return {
        responseText: fallbackText,
        serverPrimary: false,
        clientFallback: true,
        latencyMs: Date.now() - startTime,
        error: serverResult.error,
      };
    }

    case 'SERVER_ONLY_WITH_CLIENT_CRISIS_NET': {
      // Server only — no client engine at all (except crisis net)
      const serverResult = await callServerEngine(serverInput);

      if (serverResult.success && serverResult.responseText) {
        return {
          responseText: serverResult.responseText,
          serverPrimary: true,
          clientFallback: false,
          latencyMs: serverResult.latencyMs,
          error: null,
        };
      }

      // Server failed — crisis net only (minimal safe response)
      console.error(`[ServerOnlyMode] Server failed (${serverResult.error}), activating crisis safety net`);
      return {
        responseText: getCrisisSafetyNetResponse(serverInput.userMessage),
        serverPrimary: false,
        clientFallback: true,
        latencyMs: Date.now() - startTime,
        error: serverResult.error,
      };
    }
  }
}

// ─── Crisis Safety Net (offline/timeout fallback) ────────────────────────

const CRISIS_KEYWORDS = [
  'zelfmoord', 'suicide', 'dood', 'niet meer leven', 'er niet meer zijn',
  'einde maken', 'geen zin meer', 'wil dood', 'opgehangen', 'pillen',
  'van de brug', 'geen uitweg', 'ik wil er niet meer zijn',
];

function detectCrisisOffline(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

function getCrisisSafetyNetResponse(userMessage: string): string {
  if (detectCrisisOffline(userMessage)) {
    return `Ik ben hier. Je bent niet alleen.

Ben je nu veilig?

Als je in nood bent, neem contact op met:
\u2022 Zelfmoordlijn: 0800 32 123 (24/7, gratis)
\u2022 Hulplijn: 107 (24/7)

Ik ben er voor je zodra de verbinding hersteld is.`;
  }

  return `Er is een tijdelijk verbindingsprobleem. Ik ben er zo weer voor je. Als je dringend hulp nodig hebt, bel 0800 32 123 (Zelfmoordlijn, 24/7, gratis).`;
}
