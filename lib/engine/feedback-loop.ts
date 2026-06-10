/**
 * Feedback Loop Integration
 * 
 * The main integration point that wires:
 * 1. Signal Parser (LLM response → structured signals)
 * 2. Signal Router (signals → memory layer routing)
 * 3. Module Reconsideration (should we switch modules?)
 * 4. Buffer Enrichment (update buffer with content-aware data)
 * 
 * Called after every LLM response in the pipeline.
 * The engine retains full control — the LLM only suggests.
 */

import { parseEngineResponse, type ParsedResponse, type EngineSignals } from './signal-parser';
import { routeSignals, mergePersons, type SignalRoutingResult } from './signal-router';
import { reconsiderModule, type ModuleReconsiderationResult } from './module-reconsideration';
import { enrichBuffer, recordModuleSwitch } from './buffer-enrichment';
import type { BufferState } from '../rugzak/short-term-memory-buffer';

// ─── Types ─────────────────────────────────────────────────────────

export interface FeedbackLoopInput {
  /** Raw LLM response (includes engine_signals and possibly clinical block) */
  rawResponse: string;
  /** Current buffer state */
  bufferState: BufferState;
  /** Currently active module ID */
  currentModuleId: string;
  /** Whether crisis is active */
  crisisActive: boolean;
}

export interface FeedbackLoopResult {
  /** Clean user-facing text (engine_signals and clinical stripped) */
  userText: string;
  /** Clinical annotation (if present) */
  clinicalBlock: string | null;
  /** Updated buffer state with content-aware enrichment */
  updatedBuffer: BufferState;
  /** Signal routing result (for pipeline to apply to userDat/extractedEntities) */
  routing: SignalRoutingResult;
  /** Module reconsideration result */
  moduleDecision: ModuleReconsiderationResult;
  /** Raw parsed signals (for debug/clinical mode) */
  signals: EngineSignals | null;
  /** Whether the feedback loop produced any meaningful data */
  hasData: boolean;
}

// ─── Main Integration ──────────────────────────────────────────────

/**
 * Process an LLM response through the full feedback loop.
 * Returns clean user text + all engine decisions.
 */
export function processFeedbackLoop(input: FeedbackLoopInput): FeedbackLoopResult {
  const { rawResponse, bufferState, currentModuleId, crisisActive } = input;

  // 1. Parse the response
  const parsed: ParsedResponse = parseEngineResponse(rawResponse);

  // 2. Route signals (if any)
  const routing: SignalRoutingResult = parsed.signals
    ? routeSignals(parsed.signals)
    : { personsToStore: [], triggersToPromote: [], stateSignals: [], schemasToStore: [], bufferUpdate: { topic: '', emotionalShift: '', therapeuticMove: '', personsDiscussed: [] }, moduleSuggestion: null, hasSignals: false };

  // 3. Enrich buffer
  let updatedBuffer = enrichBuffer(bufferState, routing);

  // 4. Module reconsideration
  const moduleDecision = reconsiderModule({
    currentModuleId,
    currentModuleMessageCount: updatedBuffer.currentModuleMessageCount,
    switchCountThisSession: updatedBuffer.moduleSwitchCount,
    llmSuggestion: routing.moduleSuggestion,
    crisisActive,
    currentZone: updatedBuffer.currentZoneColor.toLowerCase(),
  });

  // 5. If module switch, update buffer
  if (moduleDecision.shouldSwitch && moduleDecision.newModuleId) {
    updatedBuffer = recordModuleSwitch(updatedBuffer, moduleDecision.newModuleId);
  }

  return {
    userText: parsed.userText,
    clinicalBlock: parsed.clinicalBlock,
    updatedBuffer,
    routing,
    moduleDecision,
    signals: parsed.signals,
    hasData: routing.hasSignals,
  };
}
