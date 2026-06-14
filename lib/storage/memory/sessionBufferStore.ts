/**
 * SessionBuffer store — in-memory only, never persisted.
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type {
  SessionBuffer,
  BufferMessage,
  BufferTurnSnapshot,
  BufferActiveDetections,
} from "@/lib/types/memory/sessionBuffer.types";
import { createEmptySessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";

export interface SessionBufferStore {
  initialize(persona: RecoFreePersona, sessionId: string): SessionBuffer;
  appendMessage(buffer: SessionBuffer, msg: Omit<BufferMessage, "tokenEstimate">): SessionBuffer;
  appendTurnSnapshot(buffer: SessionBuffer, snapshot: BufferTurnSnapshot): SessionBuffer;
  updateActiveDetections(buffer: SessionBuffer, detections: BufferActiveDetections): SessionBuffer;
  clear(): SessionBuffer | null;
  getBuffer(): SessionBuffer | null;
}

export function createSessionBufferStore(): SessionBufferStore {
  let currentBuffer: SessionBuffer | null = null;

  return {
    initialize(persona, sessionId) {
      currentBuffer = createEmptySessionBuffer(persona, sessionId);
      return currentBuffer;
    },

    appendMessage(buffer, msg) {
      const fullMsg: BufferMessage = {
        ...msg,
        tokenEstimate: estimateTokens(msg.text),
      };

      let messages = [...buffer.compactMessages, fullMsg];
      // Cap messages
      if (messages.length > buffer.maxMessages) {
        messages = messages.slice(-buffer.maxMessages);
      }

      currentBuffer = {
        ...buffer,
        compactMessages: messages,
        lastUpdatedAt: msg.timestampIso,
      };
      return currentBuffer;
    },

    appendTurnSnapshot(buffer, snapshot) {
      let snapshots = [...buffer.turnSnapshots, snapshot];
      if (snapshots.length > buffer.maxTurnSnapshots) {
        snapshots = snapshots.slice(-buffer.maxTurnSnapshots);
      }

      currentBuffer = {
        ...buffer,
        turnSnapshots: snapshots,
        lastUpdatedAt: snapshot.timestampIso,
      };
      return currentBuffer;
    },

    updateActiveDetections(buffer, detections) {
      currentBuffer = {
        ...buffer,
        activeDetections: detections,
        lastUpdatedAt: new Date().toISOString(),
      };
      return currentBuffer;
    },

    clear() {
      const prev = currentBuffer;
      currentBuffer = null;
      return prev;
    },

    getBuffer() {
      return currentBuffer;
    },
  };
}
