/**
 * ACT Router — Intervention Routing and Prompt Builder
 * Based on RECOFREE_ACT_THERAPY_ENGINE_CANON_V2_A_PLUS_B Sections 14, 17
 *
 * Routes detected ACT signals to appropriate processes with:
 * - Safety gating (no ACT at crisisLevel >= 2)
 * - VSP gating (no ACT at PAARS)
 * - EigenRegie gating for Kim (no ACT below 30)
 * - Schema/Mode integration (mode influences process selection)
 * - Prompt builder (compact, non-diagnostic, values-based)
 */

import type {
  ACTProcessId,
  ACTSignalId,
  ACTCandidate,
  ACTDecision,
  ACTEngineInput,
  ACTEngineResult,
  ACTInterventionHint,
  ACTProgress,
} from './act-types';
import {
  SIGNAL_TO_PROCESS_MAP,
  SIGNAL_TO_HINT_MAP,
} from './act-types';
import { detectACTSignals } from './act-detector';

// ─── Session state (reset per session) ───────────────────────────────────────

let sessionACTProcessesUsed: ACTProcessId[] = [];

export function resetACTSessionState(): void {
  sessionACTProcessesUsed = [];
}

export function getSessionACTProcessesUsed(): readonly ACTProcessId[] {
  return sessionACTProcessesUsed;
}

// ─── Mode → Process influence map ────────────────────────────────────────────
// When a schema/mode is active, certain ACT processes become more relevant

const MODE_PROCESS_BOOST: Record<string, ACTProcessId[]> = {
  VULNERABLE_CHILD: ['ACCEPTANCE', 'SELF_AS_CONTEXT'],
  ANGRY_CHILD: ['ACCEPTANCE', 'PRESENT_MOMENT_AWARENESS'],
  IMPULSIVE_CHILD: ['ACCEPTANCE', 'COMMITTED_ACTION'],
  UNDISCIPLINED_CHILD: ['COMMITTED_ACTION', 'VALUES'],
  COMPLIANT_SURRENDERER: ['VALUES', 'COMMITTED_ACTION'],
  DETACHED_PROTECTOR: ['PRESENT_MOMENT_AWARENESS', 'ACCEPTANCE'],
  DETACHED_SELF_SOOTHER: ['ACCEPTANCE', 'VALUES'],
  SELF_AGGRANDIZER: ['SELF_AS_CONTEXT', 'COGNITIVE_DEFUSION'],
  BULLY_AND_ATTACK: ['SELF_AS_CONTEXT', 'COGNITIVE_DEFUSION'],
  PUNITIVE_PARENT: ['COGNITIVE_DEFUSION', 'SELF_AS_CONTEXT'],
  DEMANDING_PARENT: ['COGNITIVE_DEFUSION', 'SELF_AS_CONTEXT'],
  HEALTHY_ADULT: ['VALUES', 'COMMITTED_ACTION'],
  HAPPY_CHILD: ['VALUES', 'PRESENT_MOMENT_AWARENESS'],
};

// ─── Stage of Change → Process relevance ─────────────────────────────────────

const STAGE_PROCESS_RELEVANCE: Record<string, ACTProcessId[]> = {
  PRECONTEMPLATION: ['COGNITIVE_DEFUSION', 'PRESENT_MOMENT_AWARENESS'],
  CONTEMPLATION: ['COGNITIVE_DEFUSION', 'VALUES'],
  PREPARATION: ['VALUES', 'COMMITTED_ACTION'],
  ACTION: ['COMMITTED_ACTION', 'ACCEPTANCE'],
  MAINTENANCE: ['VALUES', 'ACCEPTANCE', 'COMMITTED_ACTION'],
  RELAPSE: ['ACCEPTANCE', 'SELF_AS_CONTEXT', 'COGNITIVE_DEFUSION'],
};

// ─── Core routing function ───────────────────────────────────────────────────

export function routeACTEngine(input: ACTEngineInput, actProgress?: ACTProgress): ACTEngineResult {
  // ─── Safety gating ───────────────────────────────────────────────────────
  if (input.crisisLevel >= 2) {
    return createSuppressedResult('Crisis level >= 2: ACT suppressed for safety');
  }

  if (input.vspLevel === 'PAARS') {
    return createSuppressedResult('VSP PAARS: ACT suppressed, safety protocol active');
  }

  // Kim-specific: EigenRegie gating
  if (input.userType === 'kim' && input.eigenRegieScore !== null && input.eigenRegieScore < 30) {
    return createSuppressedResult('EigenRegie < 30: ACT suppressed for Kim, focus on stabilization');
  }

  // ─── Detect ACT signals from text ──────────────────────────────────────
  const detectedSignals = detectACTSignals(input.userMessage);

  if (detectedSignals.length === 0) {
    return createSuppressedResult('No ACT signals detected');
  }

  // ─── Build candidates ──────────────────────────────────────────────────
  const candidates: ACTCandidate[] = detectedSignals.map((signal) => {
    const processId = SIGNAL_TO_PROCESS_MAP[signal.signalId];
    const hint = SIGNAL_TO_HINT_MAP[signal.signalId];

    // Apply mode boost
    let confidence = signal.confidence;
    if (input.activeMode && MODE_PROCESS_BOOST[input.activeMode]) {
      const boostedProcesses = MODE_PROCESS_BOOST[input.activeMode];
      if (boostedProcesses.includes(processId)) {
        confidence = Math.min(0.95, confidence + 0.1);
      }
    }

    // Apply stage relevance boost
    if (STAGE_PROCESS_RELEVANCE[input.stageOfChange]) {
      const relevantProcesses = STAGE_PROCESS_RELEVANCE[input.stageOfChange];
      if (relevantProcesses.includes(processId)) {
        confidence = Math.min(0.95, confidence + 0.05);
      }
    }

    // Apply preferred tools boost from ACT progress
    if (actProgress && actProgress.preferredTools.includes(processId)) {
      confidence = Math.min(0.95, confidence + 0.05);
    }

    // Apply repeated fusion pattern boost
    if (actProgress && actProgress.repeatedFusionPatterns.includes(signal.signalId)) {
      confidence = Math.min(0.95, confidence + 0.05);
    }

    return {
      processId,
      signalId: signal.signalId,
      confidence,
      source: 'DETERMINISTIC_MARKER' as const,
      evidence: signal.evidence,
      allowedForPrompt: true,
      interventionHint: hint,
    };
  });

  // ─── Filter: minimum confidence threshold ──────────────────────────────
  const CONFIDENCE_THRESHOLD = 0.35;
  const accepted = candidates.filter((c) => c.confidence >= CONFIDENCE_THRESHOLD);
  const rejected = candidates.filter((c) => c.confidence < CONFIDENCE_THRESHOLD);

  if (accepted.length === 0) {
    return {
      decision: {
        acceptedACTCandidates: [],
        rejectedACTCandidates: rejected,
        dominantProcess: null,
        dominantSignal: null,
        safeToUseACT: true,
        reason: 'All candidates below confidence threshold',
        promptSummary: '',
      },
      promptBlock: '',
      activated: false,
    };
  }

  // ─── Select dominant (highest confidence) ──────────────────────────────
  const dominant = accepted[0];

  // ─── Anti-repeat: suppress if same process used 2+ times this session ──
  const processUsageCount = sessionACTProcessesUsed.filter(
    (p) => p === dominant.processId
  ).length;
  if (processUsageCount >= 2) {
    // Try next candidate with different process
    const alternative = accepted.find(
      (c) => c.processId !== dominant.processId &&
        sessionACTProcessesUsed.filter((p) => p === c.processId).length < 2
    );
    if (alternative) {
      // Use alternative
      sessionACTProcessesUsed.push(alternative.processId);
      return buildResult(accepted, rejected, alternative);
    }
    // All processes exhausted this session
    return createSuppressedResult('ACT process variety exhausted this session');
  }

  // Track usage
  sessionACTProcessesUsed.push(dominant.processId);

  return buildResult(accepted, rejected, dominant);
}

// ─── Result builders ─────────────────────────────────────────────────────────

function createSuppressedResult(reason: string): ACTEngineResult {
  return {
    decision: {
      acceptedACTCandidates: [],
      rejectedACTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      safeToUseACT: false,
      reason,
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
}

function buildResult(
  accepted: ACTCandidate[],
  rejected: ACTCandidate[],
  dominant: ACTCandidate
): ACTEngineResult {
  const promptBlock = buildACTPromptBlock(dominant);

  return {
    decision: {
      acceptedACTCandidates: accepted,
      rejectedACTCandidates: rejected,
      dominantProcess: dominant.processId,
      dominantSignal: dominant.signalId,
      safeToUseACT: true,
      reason: `ACT process ${dominant.processId} activated via ${dominant.signalId} (conf: ${dominant.confidence.toFixed(2)})`,
      promptSummary: promptBlock,
    },
    promptBlock,
    activated: true,
  };
}

// ─── Prompt Builder (Section 17) ─────────────────────────────────────────────
// Compact, non-diagnostic, values-based. Never labels the user.

function buildACTPromptBlock(dominant: ACTCandidate): string {
  const processGuidance = getProcessGuidance(dominant.processId, dominant.interventionHint);
  const signalContext = getSignalContext(dominant.signalId);

  return [
    `[ACT_CONTEXT]`,
    `Process: ${dominant.processId}`,
    `Signal: ${signalContext}`,
    `Hint: ${processGuidance}`,
    `Rules: Do not label or diagnose. Do not say "you are fused with". Do not impose values. Offer space, not pressure. One small step only.`,
    `[/ACT_CONTEXT]`,
  ].join('\n');
}

function getProcessGuidance(process: ACTProcessId, hint: ACTInterventionHint): string {
  const guidance: Record<ACTProcessId, string> = {
    ACCEPTANCE: 'Help user make room for this feeling without fighting it. Normalize the experience. Do not minimize.',
    COGNITIVE_DEFUSION: 'Help user notice the thought as a thought, not as truth. Use "I notice the thought that..." framing.',
    PRESENT_MOMENT_AWARENESS: 'Gently guide attention to present sensory experience. One breath, one sensation.',
    SELF_AS_CONTEXT: 'Help user see they are more than this experience. The observer self is stable.',
    VALUES: 'Explore what matters to the user right now. Do not impose. Ask, do not tell.',
    COMMITTED_ACTION: 'Identify one small, workable next step aligned with what matters. No pressure.',
  };

  const hintAddition: Record<ACTInterventionHint, string> = {
    DEFUSE: ' Defusion technique appropriate.',
    ACCEPT: ' Acceptance and willingness appropriate.',
    GROUND: ' Grounding in present moment appropriate.',
    VALUES_CLARIFY: ' Values clarification appropriate.',
    COMMITTED_ACTION: ' Small committed action appropriate.',
    URGE_SURF: ' Urge surfing technique appropriate. Ride the wave, do not fight it.',
    SELF_AS_CONTEXT: ' Observer self perspective appropriate.',
    NO_ACT_INTERVENTION: '',
  };

  return guidance[process] + (hintAddition[hint] || '');
}

function getSignalContext(signal: ACTSignalId): string {
  const contexts: Record<ACTSignalId, string> = {
    THOUGHT_FUSION: 'User appears caught in a thought as if it were absolute truth',
    SHAME_FUSION: 'User appears fused with shame-based self-judgment',
    FUTURE_FUSION: 'User appears fused with catastrophic future predictions',
    RELAPSE_JUSTIFICATION: 'User appears to be rationalizing substance use',
    CRAVING_URGE: 'User is experiencing strong urges or cravings',
    CONTROL_FUSION: 'User appears fused with need for control or certainty',
    RESCUE_FUSION: 'User appears fused with responsibility for others',
    AVOIDANCE: 'User appears to be avoiding difficult internal experiences',
    VALUES_DISCONNECTION: 'User appears disconnected from what matters to them',
    PERFECTIONISTIC_PRESSURE: 'User appears caught in perfectionistic demands',
    HOPELESS_PREDICTION: 'User appears fused with hopelessness about the future',
    IDENTITY_FUSION: 'User appears fused with a fixed identity label',
    EMOTIONAL_AVOIDANCE: 'User appears to be blocking or numbing emotional experience',
    ACTION_PARALYSIS: 'User appears stuck and unable to take any step forward',
  };
  return contexts[signal];
}
