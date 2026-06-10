/**
 * Buffer Enrichment
 * 
 * Applies signal-router output to the ShortTermMemoryBuffer.
 * Called after each LLM response is parsed and routed.
 */

import type { BufferState } from '../rugzak/short-term-memory-buffer';
import type { SignalRoutingResult } from './signal-router';

const MAX_TOPIC_HISTORY = 20;
const MAX_EMOTIONAL_ARC = 30;
const MAX_PERSONS = 50;

/**
 * Enrich the buffer with content-aware data from the signal router.
 * Returns a new buffer state (immutable update).
 */
export function enrichBuffer(
  current: BufferState,
  routing: SignalRoutingResult
): BufferState {
  const { bufferUpdate } = routing;

  // Topic history: append new topic if different from last
  let topicHistory = [...current.topicHistory];
  if (bufferUpdate.topic && bufferUpdate.topic !== topicHistory[topicHistory.length - 1]) {
    topicHistory.push(bufferUpdate.topic);
    if (topicHistory.length > MAX_TOPIC_HISTORY) {
      topicHistory = topicHistory.slice(-MAX_TOPIC_HISTORY);
    }
  }

  // Persons discussed: deduplicate by lowercase name
  const existingNames = new Set(current.personsDiscussed.map(n => n.toLowerCase()));
  const newPersons = bufferUpdate.personsDiscussed.filter(
    n => !existingNames.has(n.toLowerCase())
  );
  let personsDiscussed = [...current.personsDiscussed, ...newPersons];
  if (personsDiscussed.length > MAX_PERSONS) {
    personsDiscussed = personsDiscussed.slice(-MAX_PERSONS);
  }

  // Emotional arc: append shift if meaningful
  let emotionalArc = [...current.emotionalArc];
  if (bufferUpdate.emotionalShift && bufferUpdate.emotionalShift !== 'none') {
    emotionalArc.push(bufferUpdate.emotionalShift);
    if (emotionalArc.length > MAX_EMOTIONAL_ARC) {
      emotionalArc = emotionalArc.slice(-MAX_EMOTIONAL_ARC);
    }
  }

  return {
    ...current,
    topicHistory,
    personsDiscussed,
    emotionalArc,
    currentTopic: bufferUpdate.topic || current.currentTopic,
  };
}

/**
 * Record a module switch in the buffer.
 */
export function recordModuleSwitch(current: BufferState, newModuleId: string): BufferState {
  return {
    ...current,
    moduleSwitchCount: current.moduleSwitchCount + 1,
    currentModuleMessageCount: 0,
    usedModules: [...current.usedModules, newModuleId],
  };
}
