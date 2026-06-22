/**
 * Session Lifecycle — Orchestrates session start and end for memory layers.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import type { UserDat } from "@/lib/types/memory/userDat.types";
import type { StateDat } from "@/lib/types/memory/stateDat.types";
import type { ProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import type { LogsDatPlaintext } from "@/lib/types/memory/logsDat.types";
import { createSessionBufferStore, type SessionBufferStore } from "@/lib/storage/memory/sessionBufferStore";
import { createUserDatStore, type UserDatStore } from "@/lib/storage/memory/userDatStore";
import { createStateDatStore, type StateDatStore } from "@/lib/storage/memory/stateDatStore";
import { createProjectionsDatStore, type ProjectionsDatStore } from "@/lib/storage/memory/projectionsDatStore";
import { createLogsDatStore, type LogsDatStore } from "@/lib/storage/memory/logsDatStore";
import { buildSessionInitContext, type SessionInitContext } from "./sessionInitContextBuilder";
import { applyRetentionToLogsDat } from "./logsDatRetention";
import { generateSessionSummary } from "./sessionEndSummarizer";
import { writeUnifiedSessionEnd, isSessionAlreadyClosed, resetSessionCloseLock } from "./unifiedSessionEndWriter";
import { logDebugEvent } from "@/lib/debug/session-logger";

/**
 * Feature flag: when true, uses logs.dat for session init context.
 * Set to false until logs.dat is validated via Test 11.
 */
export const USE_LOGS_DAT_CONTEXT = true;

export interface SessionLifecycleManager {
  startSession(persona: RecoFreePersona, sessionId: string, localUserId: string, apiBaseUrl: string): Promise<SessionStartResult>;
  endSession(persona: RecoFreePersona, apiBaseUrl: string, chatHistoryFallback?: Array<{role: string; content: string; timestamp?: string}>, legacySessionData?: { themes?: string[]; dominantEmotion?: string; modulesUsed?: string[]; messageCount?: number; durationMinutes?: number }): Promise<SessionEndResult>;
  getStores(): SessionStores;
}

export interface SessionStores {
  userDatStore: UserDatStore;
  stateDatStore: StateDatStore;
  projectionsDatStore: ProjectionsDatStore;
  logsDatStore: LogsDatStore;
  sessionBufferStore: SessionBufferStore;
}

export interface SessionStartResult {
  sessionId: string;
  persona: RecoFreePersona;
  initContext: SessionInitContext | null;
  userDat: UserDat;
  stateDat: StateDat;
  projectionsDat: ProjectionsDat;
  buffer: SessionBuffer;
}

export interface SessionEndResult {
  sessionId: string;
  summarized: boolean;
  error?: string;
}

export function createSessionLifecycleManager(): SessionLifecycleManager {
  const stores: SessionStores = {
    userDatStore: createUserDatStore(),
    stateDatStore: createStateDatStore(),
    projectionsDatStore: createProjectionsDatStore(),
    logsDatStore: createLogsDatStore(),
    sessionBufferStore: createSessionBufferStore(),
  };

  return {
    async startSession(persona, sessionId, localUserId, apiBaseUrl) {
      // Load all memory layers
      const userDat = await stores.userDatStore.load(persona, localUserId);
      const stateDat = await stores.stateDatStore.load(persona);
      const projectionsDat = await stores.projectionsDatStore.load(persona);

      // Initialize session buffer
      const buffer = stores.sessionBufferStore.initialize(persona, sessionId);

      // Build session init context (only if feature flag is on)
      let initContext: SessionInitContext | null = null;
      if (USE_LOGS_DAT_CONTEXT) {
        try {
          const logsDat = await stores.logsDatStore.load(persona);

          // ── Retention policy: compress old entries, prune >6mo ──
          if (logsDat.sessions.length > 0) {
            const retentionResult = applyRetentionToLogsDat(logsDat);
            if (retentionResult.compressed > 0 || retentionResult.pruned > 0) {
              await stores.logsDatStore.save(persona, logsDat);
              console.log(`[SessionLifecycle] Retention applied: kept=${retentionResult.keptFull}, compressed=${retentionResult.compressed}, pruned=${retentionResult.pruned}`);
            }
          }

          initContext = buildSessionInitContext(userDat, stateDat, projectionsDat, logsDat);
        } catch {
          // Graceful: no context if logs.dat fails
          initContext = null;
        }
      }

      console.log(`[SessionLifecycle] Session started: ${sessionId} (persona=${persona}, USE_LOGS_DAT_CONTEXT=${USE_LOGS_DAT_CONTEXT})`);

      return {
        sessionId,
        persona,
        initContext,
        userDat,
        stateDat,
        projectionsDat,
        buffer,
      };
    },

    async endSession(persona, apiBaseUrl, chatHistoryFallback?: Array<{role: string; content: string; timestamp?: string}>, legacySessionData?: { themes?: string[]; dominantEmotion?: string; modulesUsed?: string[]; messageCount?: number; durationMinutes?: number }) {
      let buffer = stores.sessionBufferStore.getBuffer();
      
      // If buffer is null but we have chatHistory, build a synthetic buffer
      // This ensures logs.dat ALWAYS gets written even if startSession was missed
      if (!buffer && chatHistoryFallback && chatHistoryFallback.length > 0) {
        const sessionId = `session_recovered_${Date.now()}`;
        buffer = stores.sessionBufferStore.initialize(persona, sessionId);
        // Populate buffer from chatHistory
        for (const msg of chatHistoryFallback.slice(-20)) {
          buffer = stores.sessionBufferStore.appendMessage(buffer, {
            turnId: `turn_recovered_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            role: msg.role as 'user' | 'assistant',
            text: (msg.content || '').slice(0, 300),
            timestampIso: msg.timestamp || new Date().toISOString(),
          });
        }
        console.log(`[SessionLifecycle] Buffer recovered from chatHistory (${chatHistoryFallback.length} msgs)`);
      }
      
      if (!buffer) {
        return { sessionId: "unknown", summarized: false, error: "no active buffer and no chatHistory fallback" };
      }

      const sessionId = buffer.sessionId;

      // ── Concurrency check: skip if already closed ──
      if (isSessionAlreadyClosed(sessionId)) {
        console.log(`[SessionLifecycle] Session ${sessionId} already closed (concurrency guard)`);
        stores.sessionBufferStore.clear();
        return { sessionId, summarized: true, error: "already_closed" };
      }

      // ── Unified writer: ALWAYS writes to logs.dat (GPT or fallback) ──
      const writeResult = await writeUnifiedSessionEnd({
        persona,
        sessionId,
        buffer,
        apiBaseUrl,
        legacySessionData,
      });

      // Upsert to logs.dat (encrypted) — upgrades the incremental raw entry
      // that was written during the session with the full GPT summary.
      // Uses upsert (not append) to avoid duplicates with the per-turn writes.
      await stores.logsDatStore.upsertCurrentSession(persona, writeResult.summary);

      // ── Transfer Diagnostic Point 3: logs.dat write completed ──
      logDebugEvent('transfer_3_logsdat_write', {
        success: writeResult.success,
        persona,
        sessionId,
        storageKey: `recofree_memory/${persona}/logs.dat`,
        source: writeResult.source,
        summaryHasNarrative: !!writeResult.summary.compressedNarrative,
        summaryTopics: writeResult.summary.discussedTopics?.length ?? 0,
        error: writeResult.error ?? null,
      });

      // Clear buffer
      stores.sessionBufferStore.clear();

      console.log(`[SessionLifecycle] Session ended: ${sessionId} (source=${writeResult.source})`);
      return { sessionId, summarized: writeResult.source === "gpt_summarized" };
    },

    getStores() {
      return stores;
    },
  };
}
