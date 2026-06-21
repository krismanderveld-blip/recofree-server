/**
 * Debug Session Logger — on-device engine monitoring (__DEV__ only)
 *
 * Captures engine events during a session for the debug log screen.
 * All data is in-memory only and resets on session end or app restart.
 */

export type DebugEventType =
  | 'session_start'
  | 'session_end'
  | 'session_auto_end'
  | 'session_auto_end_complete'
  | 'memory_write_back'
  | 'memory_session_end'
  | 'message_processed'
  | 'zone_shift'
  | 'projection_signal'
  | 'crisis_detected'
  | 'model_selected'
  | 'chat_crash'
  // 5-point buffer→sessionAnalyses transfer diagnostic
  | 'transfer_1_session_end_detected'
  | 'transfer_2_buffer_status'
  | 'transfer_3_logsdat_write'
  | 'transfer_4_lifecycle_result'
  | 'transfer_5_greeting_read';

export interface DebugEvent {
  id: number;
  timestamp: string;
  type: DebugEventType;
  data: Record<string, unknown>;
}

export interface ModuleActivation {
  id: string;
  confidence: number;
  mode: string;
}

export interface MessageEvent {
  messageIndex: number;
  zone: string;
  model: string;
  estimatedTokens: number;
  activeBlocks: string[];
  dominantModule: string;
  riskScore: number;
  /** P2/P3/P4 module activations with confidence scores */
  activeModules: ModuleActivation[];
  /** K06 stabilization status: 'complete' | 'in_progress' | 'not_started' */
  k06Status: string;
  /** Whether crisis protocol is currently active */
  crisisProtocolActive: boolean;
}

// ─── In-memory event store ───────────────────────────────────

let events: DebugEvent[] = [];
let eventCounter = 0;

/**
 * Log a debug event. Works in all builds (needed for on-device debugging).
 */
export function logDebugEvent(type: DebugEventType, data: Record<string, unknown>): void {
  eventCounter++;
  events.push({
    id: eventCounter,
    timestamp: new Date().toISOString(),
    type,
    data,
  });
}

/**
 * Get all debug events for the current session.
 */
export function getDebugEvents(): DebugEvent[] {
  return events;
}

/**
 * Clear all debug events (called at session start).
 */
export function clearDebugEvents(): void {
  events = [];
  eventCounter = 0;
}

/**
 * Format all events as plain text for clipboard copy.
 * One event per line, human-readable.
 */
export function formatDebugLog(): string {
  if (events.length === 0) return '(no events logged this session)';

  return events.map((e) => {
    const time = e.timestamp.split('T')[1]?.split('.')[0] ?? e.timestamp;
    const dataStr = formatEventData(e.type, e.data);
    return `[${time}] ${e.type} | ${dataStr}`;
  }).join('\n');
}

function formatEventData(type: DebugEventType, data: Record<string, unknown>): string {
  switch (type) {
    case 'session_start':
      return `user=${data.userType ?? '?'}`;
    case 'session_end':
      return `messages=${data.messageCount ?? 0} duration=${data.durationMs ?? '?'}ms`;
    case 'message_processed': {
      const m = data as unknown as MessageEvent;
      const blocks = Array.isArray(m.activeBlocks) ? m.activeBlocks.join(',') : '';
      return `#${m.messageIndex} zone=${m.zone} model=${m.model} tokens≈${m.estimatedTokens} module=${m.dominantModule} risk=${m.riskScore} blocks=[${blocks}]`;
    }
    case 'zone_shift':
      return `${data.from} → ${data.to} reason=${data.reason ?? '?'}`;
    case 'projection_signal':
      if (data.action === 'reinforced') return `reinforced ${data.count ?? 0} entries [${(Array.isArray(data.ids) ? data.ids : []).join(', ')}]`;
      return `${data.category ?? '?'}: "${data.content ?? '?'}" str=${data.strength ?? '?'}`;
    case 'crisis_detected':
      return `level=${data.level} risk=${data.riskScore} source=${data.source ?? '?'}`;
    case 'model_selected':
      return `model=${data.model} reason=${data.reason ?? '?'}`;
    default:
      return JSON.stringify(data);
  }
}
