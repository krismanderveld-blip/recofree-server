/**
 * state.dat — Current moment and short rolling state layer.
 */
import type { RecoFreePersona, ZoneDecision } from "./memoryCore.types";

export interface StateDat {
  schemaVersion: "state.dat.v2";
  persona: RecoFreePersona;
  current: CurrentStateBlock;
  moodHistory: MoodHistoryRecord[];
  zoneHistoryBuffer: ZoneHistoryBufferRecord[];
  openSessionEndpoints: OpenSessionEndpoint[];
  updatedAt: string;
}

export interface CurrentStateBlock {
  mood?: MoodStateSnapshot;
  zone?: ZoneSnapshot;
  activeModuleId?: string;
  activeResponseMode?: string;
  lastPipelineTurnId?: string;
  lastSessionId?: string;
  lastUpdatedAt: string;
}

export interface MoodStateSnapshot {
  craving?: number;
  frustration?: number;
  despondency?: number;
  focus?: number;
  stress?: number;
  boundaryFatigue?: number;
  emotionalBurden?: number;
  selfCare?: number;
  sourceKind: "slider_ui" | "pipeline_explicit_text";
  confidence: number;
  timestampIso: string;
}

export interface MoodHistoryRecord extends MoodStateSnapshot {
  turnId?: string;
  sessionId: string;
}

export interface ZoneSnapshot {
  zone: ZoneDecision["zone"];
  zoneNumeric?: number;
  confidence: number;
  timestampIso: string;
}

export interface ZoneHistoryBufferRecord extends ZoneSnapshot {
  turnId: string;
  sessionId: string;
}

export interface OpenSessionEndpoint {
  endpointId: string;
  sessionId: string;
  label: string;
  category: "unresolved_question" | "follow_up" | "risk_monitor" | "emotion_unfinished" | "other";
  createdAt: string;
  lastSeenAt: string;
  status: "open" | "resolved" | "dormant";
}

export function createEmptyStateDat(persona: RecoFreePersona): StateDat {
  const now = new Date().toISOString();
  return {
    schemaVersion: "state.dat.v2",
    persona,
    current: { lastUpdatedAt: now },
    moodHistory: [],
    zoneHistoryBuffer: [],
    openSessionEndpoints: [],
    updatedAt: now,
  };
}
