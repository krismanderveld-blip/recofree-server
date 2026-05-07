/**
 * Debug Session Logger — on-device engine monitoring (__DEV__ only)
 *
 * Captures engine events during a session for the debug log screen.
 * All data is in-memory only and resets on session end or app restart.
 */

export type DebugEventType =
  | 'session_start'
  | 'session_end'
  | 'message_processed'
  | 'zone_shift'
  | 'projection_signal'
  | 'crisis_detected'
  | 'model_selected';

export interface DebugEvent {
  id: number;
  timestamp: string;
  type: DebugEventType;
  data: Record<string, unknown>;
}

export interface MessageEvent {
  messageIndex: number;
  zone: string;
  model: string;
  estimatedTokens: number;
  activeBlocks: string[];
  dominantModule: string;
  riskScore: number;
}

// ─── In-memory event store ───────────────────────────────────

let events: DebugEvent[] = [];
let eventCounter = 0;

/**
 * Log a debug event. Only works in __DEV__ mode.
 */
export function logDebugEvent(type: DebugEventType, data: Record<string, unknown>): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
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
      return `category=${data.category} content="${data.content}" strength=${data.strength}`;
    case 'crisis_detected':
      return `level=${data.level} risk=${data.riskScore} source=${data.source ?? '?'}`;
    case 'model_selected':
      return `model=${data.model} reason=${data.reason ?? '?'}`;
    default:
      return JSON.stringify(data);
  }
}
