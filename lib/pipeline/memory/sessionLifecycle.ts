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
import { generateSessionSummary } from "./sessionEndSummarizer";
import { logDebugEvent } from "@/lib/debug/session-logger";

/**
 * Feature flag: when true, uses logs.dat for session init context.
 * Set to false until logs.dat is validated via Test 11.
 */
export const USE_LOGS_DAT_CONTEXT = true;

export interface SessionLifecycleManager {
  startSession(persona: RecoFreePersona, sessionId: string, localUserId: string, apiBaseUrl: string): Promise<SessionStartResult>;
  endSession(persona: RecoFreePersona, apiBaseUrl: string, chatHistoryFallback?: Array<{role: string; content: string; timestamp?: string}>): Promise<SessionEndResult>;
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

    async endSession(persona, apiBaseUrl, chatHistoryFallback?: Array<{role: string; content: string; timestamp?: string}>) {
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

      try {
        // Generate session summary via GPT-4o-mini
        const { summary } = await generateSessionSummary({
          persona,
          sessionId,
          buffer,
          apiBaseUrl,
        });

        // Append to logs.dat (encrypted)
        await stores.logsDatStore.appendSessionSummary(persona, summary);

        // ── Transfer Diagnostic Point 3: logs.dat write completed ──
        logDebugEvent('transfer_3_logsdat_write', {
          success: true,
          persona,
          sessionId,
          storageKey: `recofree_memory/${persona}/logs.dat`,
          summaryHasNarrative: !!(summary as any).compressedNarrative,
          summaryTopics: (summary as any).discussedTopics?.length ?? 0,
        });

        // Clear buffer
        stores.sessionBufferStore.clear();

        console.log(`[SessionLifecycle] Session ended: ${sessionId} (summarized=true)`);
        return { sessionId, summarized: true };
      } catch (err) {
        // Graceful: session ends even if summary fails
        stores.sessionBufferStore.clear();
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[SessionLifecycle] Session end error: ${errorMsg}`);
        return { sessionId, summarized: false, error: errorMsg };
      }
    },

    getStores() {
      return stores;
    },
  };
}
