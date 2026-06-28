/**
 * buffer — Temporary active chat memory (non-persistent).
 */
import type {
  RecoFreePersona,
  ZoneDecision,
  ActiveModuleDecision,
  DetectedFear,
  DetectedHope,
  DetectedTrigger,
  DetectedSchemaTendency,
  DetectedModeTendency,
} from "./memoryCore.types";
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface SessionBuffer {
  schemaVersion: "buffer.v1";
  persona: RecoFreePersona;
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
  compactMessages: BufferMessage[];
  turnSnapshots: BufferTurnSnapshot[];
  activeDetections: BufferActiveDetections;
  maxMessages: number;
  maxTurnSnapshots: number;
}

export interface BufferMessage {
  turnId: string;
  role: "user" | "assistant";
  timestampIso: string;
  text: string;
  tokenEstimate: number;
}

export interface BufferTurnSnapshot {
  turnId: string;
  timestampIso: string;
  inputHash: string;
  outputHash?: string;
  zone?: ZoneDecision;
  activeModule?: ActiveModuleDecision;
  responseMode?: string;
  detectedCounts: {
    fears: number;
    hopes: number;
    triggers: number;
    schemaTendencies: number;
    modeTendencies: number;
  };
  changedFields: string[];
}

export interface BufferActiveDetections {
  fears: DetectedFear[];
  hopes: DetectedHope[];
  triggers: DetectedTrigger[];
  schemaTendencies: DetectedSchemaTendency[];
  modeTendencies: DetectedModeTendency[];
}

export const DEFAULT_MAX_MESSAGES = 40;
export const DEFAULT_MAX_TURN_SNAPSHOTS = 80;

export function createEmptySessionBuffer(
  persona: RecoFreePersona,
  sessionId: string
): SessionBuffer {
  const now = LocalDeviceTimeService.now().utcIso;
  return {
    schemaVersion: "buffer.v1",
    persona,
    sessionId,
    startedAt: now,
    lastUpdatedAt: now,
    compactMessages: [],
    turnSnapshots: [],
    activeDetections: {
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
    },
    maxMessages: DEFAULT_MAX_MESSAGES,
    maxTurnSnapshots: DEFAULT_MAX_TURN_SNAPSHOTS,
  };
}
