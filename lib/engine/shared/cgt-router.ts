/**
 * CGT Router — Intervention Routing and Prompt Builder
 * Based on RECOFREE_CGT_THERAPY_ENGINE_CANON_V3_ULTIMATE Sections 14, 15, 20, 21
 *
 * Routes detected CBT signals to appropriate processes with:
 * - Safety gating (no CBT at crisisLevel >= 2)
 * - VSP gating (no CBT at PAARS, limited at ROOD)
 * - EigenRegie gating for Kim (no responsibility-increasing CBT below 30)
 * - CBT×ACT integration (ACT defusion before restructuring when fused)
 * - CBT×Schema/Mode integration (mode influences intervention style)
 * - Prompt builder (compact, non-diagnostic, no forced reframing)
 */

import type {
  CBTProcessId,
  CBTSignalId,
  DistortionId,
  CBTCandidate,
  CBTDecision,
  CBTEngineInput,
  CBTEngineResult,
  CBTInterventionHint,
  CBTProgress,
} from './cgt-types';
import {
  CBT_SIGNAL_TO_PROCESS_MAP,
  CBT_SIGNAL_TO_HINT_MAP,
  CBT_SIGNAL_TO_DISTORTION_MAP,
} from './cgt-types';
import { detectCBTSignals } from './cgt-detector';

// ─── Session state (reset per session) ──────────────────────────────────────

let sessionCBTProcessesUsed: CBTProcessId[] = [];

export function resetCBTSessionState(): void {
  sessionCBTProcessesUsed = [];
}

export function getSessionCBTProcessesUsed(): readonly CBTProcessId[] {
  return sessionCBTProcessesUsed;
}

// ─── CBT × Schema/Mode influence map (Section 15) ───────────────────────────
// When a schema/mode is active, certain CBT approaches are modified

const MODE_CBT_ADJUSTMENT: Record<string, { avoid: CBTProcessId[]; prefer: CBTProcessId[]; style: string }> = {
  PUNITIVE_PARENT: {
    avoid: ['COGNITIVE_RESTRUCTURING'],  // can feel like more punishment
    prefer: ['THOUGHT_IDENTIFICATION', 'BALANCED_THINKING'],
    style: 'compassion first, no challenge',
  },
  DEMANDING_PARENT: {
    avoid: ['BEHAVIORAL_ACTIVATION'],  // must avoid productivity pressure
    prefer: ['BALANCED_THINKING', 'UNCERTAINTY_TOLERANCE'],
    style: 'reduce pressure, realistic standards',
  },
  DETACHED_PROTECTOR: {
    avoid: ['CORE_BELIEF_EXPLORATION', 'COGNITIVE_RESTRUCTURING'],
    prefer: ['THOUGHT_IDENTIFICATION'],
    style: 'low-pressure pattern naming only',
  },
  AVOIDANT_PROTECTOR: {
    avoid: ['COGNITIVE_RESTRUCTURING'],
    prefer: ['MICRO_EXPOSURE'],
    style: 'micro exposure, not confrontation',
  },
  IMPULSIVE_CHILD: {
    avoid: ['CORE_BELIEF_EXPLORATION'],
    prefer: ['COPING_PLAN', 'RELAPSE_PATTERN_REVIEW'],
    style: 'behavioral interruption first',
  },
  VULNERABLE_CHILD: {
    avoid: ['COGNITIVE_RESTRUCTURING', 'CORE_BELIEF_EXPLORATION'],
    prefer: ['THOUGHT_IDENTIFICATION', 'COPING_PLAN'],
    style: 'validation first, no challenge',
  },
  RESCUE_MODE: {
    avoid: [],
    prefer: ['RESPONSIBILITY_MAPPING'],
    style: 'responsibility distortion mapping',
  },
  CONTROL_MODE: {
    avoid: [],
    prefer: ['UNCERTAINTY_TOLERANCE', 'SAFETY_BEHAVIOR_REDUCTION'],
    style: 'certainty seeking reduction',
  },
  EXHAUSTED_CAREGIVER: {
    avoid: ['BEHAVIORAL_EXPERIMENT', 'BEHAVIORAL_ACTIVATION', 'RESPONSIBILITY_MAPPING'],
    prefer: ['COPING_PLAN'],
    style: 'no thought homework, reduce burden',
  },
};

// ─── CBT × ACT integration map (Section 14) ────────────────────────────────
// When ACT process is active, CBT adjusts its approach

const ACT_CBT_ADJUSTMENT: Record<string, { sequence: string; blockProcess: CBTProcessId[] }> = {
  COGNITIVE_DEFUSION: {
    sequence: 'ACT defusion before CBT restructuring',
    blockProcess: ['COGNITIVE_RESTRUCTURING', 'CORE_BELIEF_EXPLORATION'],
  },
  ACCEPTANCE: {
    sequence: 'ACT acceptance before CBT challenge',
    blockProcess: ['COGNITIVE_RESTRUCTURING'],
  },
  SELF_AS_CONTEXT: {
    sequence: 'ACT self-as-context before CBT balanced thought',
    blockProcess: ['CORE_BELIEF_EXPLORATION'],
  },
  PRESENT_MOMENT_AWARENESS: {
    sequence: 'ACT grounding active, CBT light only',
    blockProcess: ['CORE_BELIEF_EXPLORATION', 'BEHAVIORAL_EXPERIMENT'],
  },
  VALUES: {
    sequence: 'ACT values active, CBT committed action can follow',
    blockProcess: [],
  },
  COMMITTED_ACTION: {
    sequence: 'ACT committed action active, CBT behavioral step can support',
    blockProcess: [],
  },
};

// ─── VSP level → allowed depth (Section 20) ────────────────────────────────

type CBTDepthLevel = 'full' | 'gentle' | 'grounding' | 'stabilization' | 'crisis_only';

function getVSPDepthLevel(vspLevel: string): CBTDepthLevel {
  switch (vspLevel) {
    case 'GROEN': return 'full';
    case 'GEEL': return 'gentle';
    case 'ORANJE': return 'grounding';
    case 'ROOD': return 'stabilization';
    case 'PAARS': return 'crisis_only';
    default: return 'full';
  }
}

// All processes blocked for crisis_only
const ALL_CBT_PROCESSES_BLOCKED: CBTProcessId[] = [
  'THOUGHT_IDENTIFICATION',
  'DISTORTION_DETECTION',
  'COGNITIVE_RESTRUCTURING',
  'BEHAVIORAL_EXPERIMENT',
  'MICRO_EXPOSURE',
  'RELAPSE_PATTERN_REVIEW',
  'BALANCED_THINKING',
  'COPING_PLAN',
  'CORE_BELIEF_EXPLORATION',
  'UNCERTAINTY_TOLERANCE',
  'RESPONSIBILITY_MAPPING',
  'SAFETY_BEHAVIOR_REDUCTION',
  'BEHAVIORAL_ACTIVATION',
];

const DEPTH_BLOCKED_PROCESSES: Record<CBTDepthLevel, CBTProcessId[]> = {
  full: [],
  gentle: ['CORE_BELIEF_EXPLORATION'],
  grounding: ['CORE_BELIEF_EXPLORATION', 'COGNITIVE_RESTRUCTURING', 'BEHAVIORAL_EXPERIMENT'],
  stabilization: ['CORE_BELIEF_EXPLORATION', 'COGNITIVE_RESTRUCTURING', 'BEHAVIORAL_EXPERIMENT', 'MICRO_EXPOSURE', 'BALANCED_THINKING'],
  crisis_only: ALL_CBT_PROCESSES_BLOCKED,
};

// ─── Core routing function ──────────────────────────────────────────────────

export function routeCBTEngine(input: CBTEngineInput, cbtProgress?: CBTProgress): CBTEngineResult {
  // ─── Safety gating ──────────────────────────────────────────────────────
  if (input.crisisLevel >= 2) {
    return createSuppressedResult('Crisis level >= 2: CBT suppressed for safety');
  }

  if (input.vspLevel === 'PAARS') {
    return createSuppressedResult('VSP PAARS: CBT suppressed, crisis protocol active');
  }

  // Kim-specific: EigenRegie gating (Section 20)
  if (input.userType === 'kim' && input.eigenRegieScore !== null && input.eigenRegieScore < 30) {
    return createSuppressedResult('EigenRegie < 30: CBT suppressed for Kim, reduce burden');
  }

  // ─── Detect CBT signals from text ─────────────────────────────────────
  const detectedSignals = detectCBTSignals(input.userMessage);

  if (detectedSignals.length === 0) {
    return createSuppressedResult('No CBT signals detected');
  }

  // ─── Determine depth level from VSP ───────────────────────────────────
  const depthLevel = getVSPDepthLevel(input.vspLevel);
  const blockedByVSP = DEPTH_BLOCKED_PROCESSES[depthLevel] ?? [];

  // ─── Determine blocked processes from active ACT process ──────────────
  const blockedByACT: CBTProcessId[] = input.activeACTProcess
    ? (ACT_CBT_ADJUSTMENT[input.activeACTProcess]?.blockProcess ?? [])
    : [];

  // ─── Determine adjustments from active mode ───────────────────────────
  const modeAdjustment = input.activeMode
    ? MODE_CBT_ADJUSTMENT[input.activeMode] ?? null
    : null;
  const blockedByMode: CBTProcessId[] = modeAdjustment?.avoid ?? [];
  const preferredByMode: CBTProcessId[] = modeAdjustment?.prefer ?? [];

  // ─── Build candidates ─────────────────────────────────────────────────
  const candidates: CBTCandidate[] = detectedSignals.map((signal) => {
    let processId = CBT_SIGNAL_TO_PROCESS_MAP[signal.signalId];
    const hint = CBT_SIGNAL_TO_HINT_MAP[signal.signalId];
    const distortionIds = CBT_SIGNAL_TO_DISTORTION_MAP[signal.signalId];

    // Check if process is blocked
    const isBlocked = blockedByVSP.includes(processId)
      || blockedByACT.includes(processId)
      || blockedByMode.includes(processId);

    // Apply confidence adjustments
    let confidence = signal.confidence;

    // Mode preference boost
    if (preferredByMode.includes(processId)) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    // Recurring distortion boost from progress
    if (cbtProgress) {
      const hasRecurring = distortionIds.some(d => cbtProgress.recurringDistortions.includes(d));
      if (hasRecurring) {
        confidence = Math.min(0.95, confidence + 0.05);
      }
      if (cbtProgress.preferredTools.includes(processId)) {
        confidence = Math.min(0.95, confidence + 0.05);
      }
    }

    return {
      processId,
      signalId: signal.signalId,
      distortionIds,
      confidence,
      source: 'DETERMINISTIC_MARKER' as const,
      evidence: signal.evidence,
      allowedForPrompt: !isBlocked,
      interventionHint: isBlocked ? 'NO_CBT' as CBTInterventionHint : hint,
    };
  });

  // ─── Filter: minimum confidence threshold + allowed ───────────────────
  const CONFIDENCE_THRESHOLD = 0.35;
  const accepted = candidates.filter((c) => c.confidence >= CONFIDENCE_THRESHOLD && c.allowedForPrompt);
  const rejected = candidates.filter((c) => c.confidence < CONFIDENCE_THRESHOLD || !c.allowedForPrompt);

  if (accepted.length === 0) {
    return {
      decision: {
        acceptedCBTCandidates: [],
        rejectedCBTCandidates: rejected,
        dominantProcess: null,
        dominantSignal: null,
        dominantDistortion: null,
        safeToUseCBT: true,
        reason: 'All CBT candidates blocked or below threshold',
        promptSummary: '',
      },
      promptBlock: '',
      activated: false,
    };
  }

  // ─── Select dominant (highest confidence) ─────────────────────────────
  const dominant = accepted[0];

  // ─── Anti-repeat: suppress if same process used 2+ times this session ─
  const processUsageCount = sessionCBTProcessesUsed.filter(
    (p) => p === dominant.processId
  ).length;
  if (processUsageCount >= 2) {
    // Try next candidate with different process
    const alternative = accepted.find(
      (c) => c.processId !== dominant.processId &&
        sessionCBTProcessesUsed.filter((p) => p === c.processId).length < 2
    );
    if (alternative) {
      sessionCBTProcessesUsed.push(alternative.processId);
      return buildResult(accepted, rejected, alternative, input, modeAdjustment);
    }
    return createSuppressedResult('CBT process variety exhausted this session');
  }

  // Track usage
  sessionCBTProcessesUsed.push(dominant.processId);

  return buildResult(accepted, rejected, dominant, input, modeAdjustment);
}

// ─── Result builders ────────────────────────────────────────────────────────

function createSuppressedResult(reason: string): CBTEngineResult {
  return {
    decision: {
      acceptedCBTCandidates: [],
      rejectedCBTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      dominantDistortion: null,
      safeToUseCBT: false,
      reason,
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
}

function buildResult(
  accepted: CBTCandidate[],
  rejected: CBTCandidate[],
  dominant: CBTCandidate,
  input: CBTEngineInput,
  modeAdjustment: { avoid: CBTProcessId[]; prefer: CBTProcessId[]; style: string } | null,
): CBTEngineResult {
  const promptBlock = buildCBTPromptBlock(dominant, input, modeAdjustment);

  return {
    decision: {
      acceptedCBTCandidates: accepted,
      rejectedCBTCandidates: rejected,
      dominantProcess: dominant.processId,
      dominantSignal: dominant.signalId,
      dominantDistortion: dominant.distortionIds[0] ?? null,
      safeToUseCBT: true,
      reason: `CBT process ${dominant.processId} activated via ${dominant.signalId} (conf: ${dominant.confidence.toFixed(2)})`,
      promptSummary: promptBlock,
    },
    promptBlock,
    activated: true,
  };
}

// ─── Prompt Builder (Section 21) ────────────────────────────────────────────
// Compact, non-diagnostic, no forced reframing. Context budget: max 4 lines.

function buildCBTPromptBlock(
  dominant: CBTCandidate,
  input: CBTEngineInput,
  modeAdjustment: { avoid: CBTProcessId[]; prefer: CBTProcessId[]; style: string } | null,
): string {
  const distortionContext = getDistortionContext(dominant.distortionIds[0] ?? null);
  const processGuidance = getProcessGuidance(dominant.processId, dominant.interventionHint);
  const actSequence = input.activeACTProcess
    ? (ACT_CBT_ADJUSTMENT[input.activeACTProcess]?.sequence ?? '')
    : '';
  const modeStyle = modeAdjustment?.style ?? '';

  const lines: string[] = [
    `[CBT_CONTEXT]`,
    `Distortion: ${distortionContext}`,
    `Process: ${processGuidance}`,
  ];

  if (actSequence) {
    lines.push(`ACT integration: ${actSequence}`);
  }

  if (modeStyle) {
    lines.push(`Mode style: ${modeStyle}`);
  }

  lines.push(
    `Rules: Do not argue with emotion. Do not force reframe. Do not say "irrational". Validate first. One small flexible step only. No toxic positivity.`,
    `[/CBT_CONTEXT]`,
  );

  return lines.join('\n');
}

function getDistortionContext(distortion: DistortionId | null): string {
  if (!distortion) return 'general cognitive pattern detected';

  const contexts: Record<DistortionId, string> = {
    ALL_OR_NOTHING: 'user may be thinking in extremes (all-or-nothing)',
    CATASTROPHIZING: 'user may be catastrophizing future outcomes',
    MIND_READING: 'user may be assuming what others think',
    FORTUNE_TELLING: 'user may be predicting negative future as certain',
    EMOTIONAL_REASONING: 'user may be treating feelings as facts',
    OVERGENERALIZATION: 'user may be overgeneralizing from one event',
    SHOULD_STATEMENTS: 'user may be applying rigid should-rules',
    LABELING: 'user may be labeling self based on behavior',
    PERSONALIZATION: 'user may be taking excessive responsibility',
    DISCOUNTING_POSITIVE: 'user may be dismissing positive evidence',
    MENTAL_FILTER: 'user may be filtering only negative details',
    MAGNIFICATION: 'user may be magnifying mistakes',
    MINIMIZATION: 'user may be minimizing risk or progress',
    CONTROL_FALLACY: 'user may believe they must control everything',
    FAIRNESS_FALLACY: 'user may be stuck on fairness expectations',
    BLAME: 'user may be stuck in blame (self or other)',
    COMPARISON_TRAP: 'user may be comparing self to others unfavorably',
    NEGATIVE_PREDICTION: 'user may be predicting failure as certain',
    SHAME_GENERALIZATION: 'user may be generalizing one event to whole identity',
    RELAPSE_FINALITY: 'user may believe relapse means recovery is over',
    CERTAINTY_SEEKING: 'user may be seeking certainty that is not available',
    RESPONSIBILITY_DISTORTION: 'user may be taking responsibility beyond actual control',
    THREAT_OVERESTIMATION: 'user may be overestimating danger',
    COPING_UNDERESTIMATION: 'user may be underestimating ability to cope',
    PERMANENCE_DISTORTION: 'user may believe this feeling will last forever',
    IDENTITY_FUSION: 'user may be fusing identity with addiction/failure',
    MORAL_OVERGENERALIZATION: 'user may be generalizing one wrong action to moral identity',
  };

  return contexts[distortion] ?? 'cognitive pattern detected';
}

function getProcessGuidance(process: CBTProcessId, hint: CBTInterventionHint): string {
  const guidance: Record<CBTProcessId, string> = {
    THOUGHT_IDENTIFICATION: 'Help user notice the automatic thought without judgment. Name it gently.',
    DISTORTION_DETECTION: 'Help user see the thinking pattern. Do not label as wrong.',
    COGNITIVE_RESTRUCTURING: 'Offer one gentle flexible question. Do not debate or force.',
    BEHAVIORAL_EXPERIMENT: 'Suggest one tiny safe test of the belief. Reversible and non-shaming.',
    MICRO_EXPOSURE: 'Suggest one micro step toward avoided stimulus. Very small, very safe.',
    RELAPSE_PATTERN_REVIEW: 'Map the relapse thought loop. Reduce shame. Identify trigger.',
    BALANCED_THINKING: 'Offer a balanced alternative that does not deny pain.',
    COPING_PLAN: 'Identify one workable coping step for right now.',
    CORE_BELIEF_EXPLORATION: 'Gently explore deeper belief only if user is stable and willing.',
    UNCERTAINTY_TOLERANCE: 'Help user sit with not-knowing. Normalize uncertainty.',
    RESPONSIBILITY_MAPPING: 'Map what is controllable vs not. Reduce excessive responsibility.',
    SAFETY_BEHAVIOR_REDUCTION: 'Gently identify the safety behavior. Suggest one small reduction.',
    BEHAVIORAL_ACTIVATION: 'Identify one small meaningful action aligned with recovery.',
  };

  const hintAddition: Record<CBTInterventionHint, string> = {
    THOUGHT_CHECK: ' Use "What is the thought saying?" framing.',
    REFRAME: ' Offer balanced perspective without forcing.',
    BEHAVIORAL_TEST: ' Tiny experiment appropriate.',
    MICRO_STEP: ' One micro step appropriate.',
    GROUND_FIRST: ' Ground and stabilize before any cognitive work.',
    RESPONSIBILITY_MAP: ' Responsibility mapping appropriate.',
    URGE_LOOP_MAP: ' Map the urge-behavior-consequence loop.',
    UNCERTAINTY_TOLERANCE: ' Help tolerate not-knowing.',
    NO_CBT: '',
  };

  return guidance[process] + (hintAddition[hint] || '');
}
