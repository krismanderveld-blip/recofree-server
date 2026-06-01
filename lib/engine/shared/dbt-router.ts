/**
 * DGT Router — Intervention Routing, Validation Engine, and Prompt Builder
 * Based on RECOFREE_DGT_THERAPY_ENGINE_CANON_V4_HYBRID_MANUS_READY Sections 3-18, 23
 *
 * Routes detected DGT signals to appropriate processes with:
 * - Safety gating (Section 3: IMMEDIATE_SAFETY overrides all)
 * - VSP absolute priority (Section 5)
 * - Validation engine L1-L6 (Section 8)
 * - Skill selection (Section 7: hidden skills, engine-only)
 * - Escalation stage scoring (Section 9)
 * - Shame spiral routing (Section 15)
 * - Abandonment panic routing (Section 14)
 * - Relapse-specific routing (Section 16)
 * - Kim boundary-first endstate (Section 17)
 * - DGT → EKT routing (Section 4)
 * - DGT × ACT × CBT × Schema arbitration (Section 18)
 * - Prompt builder (Section 23: context budget max 4 lines)
 */

import type {
  DGTProcessId,
  DGTSignalId,
  DGTSkillId,
  DGTCandidate,
  DGTDecision,
  DGTEngineInput,
  DGTEngineResult,
  DGTInterventionHint,
  DGTProgress,
  ValidationLevelId,
  EscalationStage,
  EKTPhase,
} from './dbt-types';
import {
  DGT_SIGNAL_TO_PROCESS_MAP,
  DGT_SIGNAL_TO_SKILL_MAP,
  DGT_SIGNAL_TO_HINT_MAP,
  VSP_TO_VALIDATION_LEVEL,
  ESCALATION_TO_VALIDATION_LEVEL,
} from './dbt-types';
import { detectDGTSignals } from './dbt-detector';

// ─── Session state (reset per session) ─────────────────────────────────────

let sessionDGTProcessesUsed: DGTProcessId[] = [];

export function resetDGTSessionState(): void {
  sessionDGTProcessesUsed = [];
}

export function getSessionDGTProcessesUsed(): readonly DGTProcessId[] {
  return sessionDGTProcessesUsed;
}

// ─── Escalation stage scoring (Section 9) ──────────────────────────────────

function resolveEscalationStage(input: DGTEngineInput): EscalationStage {
  // Crisis level direct mapping
  if (input.crisisLevel >= 2) return 'CRISIS';

  // VSP-based escalation
  if (input.vspLevel === 'PAARS') return 'CRISIS';
  if (input.vspLevel === 'ROOD') return 'FLOODING';

  // Distress-based escalation
  if (input.distressScore >= 8) return 'FLOODING';
  if (input.distressScore >= 6) return 'RISING';

  // Zone-based escalation
  if (input.resolvedZone === 'RED') return 'FLOODING';
  if (input.resolvedZone === 'ORANGE') return 'RISING';

  return 'CALM';
}

// ─── Validation level routing (Section 8) ──────────────────────────────────

function resolveValidationLevel(
  vspLevel: string,
  escalationStage: EscalationStage,
  userType: 'elias' | 'kim',
  eigenRegieScore: number | null,
): ValidationLevelId {
  // VSP has absolute priority (Section 5)
  const vspValidation = VSP_TO_VALIDATION_LEVEL[vspLevel];
  if (vspValidation && (vspLevel === 'PAARS' || vspLevel === 'ROOD')) {
    return vspValidation;
  }

  // Escalation stage validation
  const escalationValidation = ESCALATION_TO_VALIDATION_LEVEL[escalationStage];

  // Kim exhaustion override: L1 when very low Eigen Regie
  if (userType === 'kim' && eigenRegieScore !== null && eigenRegieScore < 20) {
    return 'L1_PRESENCE';
  }

  // Use the more conservative (lower numbered) validation level
  if (vspValidation) {
    const vspIndex = ALL_VALIDATION_LEVELS_ORDERED.indexOf(vspValidation);
    const escIndex = ALL_VALIDATION_LEVELS_ORDERED.indexOf(escalationValidation);
    return vspIndex < escIndex ? vspValidation : escalationValidation;
  }

  return escalationValidation;
}

const ALL_VALIDATION_LEVELS_ORDERED: ValidationLevelId[] = [
  'L1_PRESENCE',
  'L2_ACCURATE_REFLECTION',
  'L3_EMOTION_REFLECTION',
  'L4_CONTEXT_VALIDATION',
  'L5_NORMALIZATION',
  'L6_RADICAL_GENUINENESS',
];

// ─── DGT → EKT routing (Section 4) ────────────────────────────────────────

function resolveEKTPhase(escalationStage: EscalationStage, stabilized: boolean): EKTPhase | null {
  // DGT always stabilizes before EKT
  if (!stabilized) return null;

  switch (escalationStage) {
    case 'FLOODING':
    case 'CRISIS':
    case 'SHUTDOWN':
      return 'EKT_EXIT';
    case 'RISING':
      return 'EKT_CLARIFICATION';
    case 'CALM':
      return 'EKT_MIRROR';
    default:
      return null;
  }
}

// ─── Kim boundary-first routing (Section 17) ───────────────────────────────

const KIM_BOUNDARY_SIGNALS: DGTSignalId[] = [
  'RESCUE_OVERLOAD',
  'CONTROL_BEHAVIOR',
  'BOUNDARY_COLLAPSE',
  'EXHAUSTION',
  'CHECKING_URGE',
];

function isKimBoundaryContext(signalId: DGTSignalId, userType: 'elias' | 'kim'): boolean {
  return userType === 'kim' && KIM_BOUNDARY_SIGNALS.includes(signalId);
}

// ─── DGT × ACT × CBT × Schema arbitration (Section 18) ────────────────────
// DGT wins when flooded, crisis, impulsive, relapse urge, shame spiral,
// abandonment panic, Kim exhausted

const DGT_PRIORITY_SIGNALS: DGTSignalId[] = [
  'EMOTIONAL_FLOODING',
  'SHAME_SPIRAL',
  'RELAPSE_URGE',
  'ABANDONMENT_PANIC',
  'PANIC',
  'SHUTDOWN',
  'IMPULSIVITY',
  'ANGER_ESCALATION',
  'CRAVING_WAVE',
];

function shouldDGTOverrideOtherEngines(
  dominantSignal: DGTSignalId | null,
  escalationStage: EscalationStage,
  activeCBTProcess: string | null,
  activeACTProcess: string | null,
): { overrides: boolean; reason: string } {
  // DGT always wins during flooding/crisis/shutdown
  if (escalationStage === 'FLOODING' || escalationStage === 'CRISIS' || escalationStage === 'SHUTDOWN') {
    return { overrides: true, reason: `DGT priority: escalation=${escalationStage}, stabilization first` };
  }

  // DGT wins for priority signals
  if (dominantSignal && DGT_PRIORITY_SIGNALS.includes(dominantSignal)) {
    return { overrides: true, reason: `DGT priority: signal=${dominantSignal} requires stabilization before ACT/CBT` };
  }

  // If ACT/CBT are active and user is calm/rising, DGT defers
  if ((activeCBTProcess || activeACTProcess) && escalationStage === 'CALM') {
    return { overrides: false, reason: 'User calm, ACT/CBT active, DGT defers' };
  }

  return { overrides: true, reason: 'DGT active, no conflict' };
}

// ─── VSP depth gating ──────────────────────────────────────────────────────

type DGTDepthLevel = 'full' | 'skill_only' | 'validation_only' | 'presence_only';

function getVSPDepthLevel(vspLevel: string): DGTDepthLevel {
  switch (vspLevel) {
    case 'GROEN': return 'full';
    case 'GEEL': return 'full';
    case 'ORANJE': return 'skill_only';
    case 'ROOD': return 'validation_only';
    case 'PAARS': return 'presence_only';
    default: return 'full';
  }
}

// Processes blocked at each depth level
const DEPTH_BLOCKED_PROCESSES: Record<DGTDepthLevel, DGTProcessId[]> = {
  full: [],
  skill_only: ['CHAIN_ANALYSIS', 'OPPOSITE_ACTION', 'EMOTION_REGULATION'],
  validation_only: ['CHAIN_ANALYSIS', 'OPPOSITE_ACTION', 'EMOTION_REGULATION', 'INTERPERSONAL_EFFECTIVENESS', 'SKILL_SELECTION', 'BOUNDARY_EFFECTIVENESS'],
  presence_only: ['CHAIN_ANALYSIS', 'OPPOSITE_ACTION', 'EMOTION_REGULATION', 'INTERPERSONAL_EFFECTIVENESS', 'SKILL_SELECTION', 'BOUNDARY_EFFECTIVENESS', 'MINDFULNESS', 'RADICAL_ACCEPTANCE'],
};

// ─── Core routing function ─────────────────────────────────────────────────

export function routeDGTEngine(input: DGTEngineInput, dgtProgress?: DGTProgress): DGTEngineResult {
  // ─── Resolve escalation stage ──────────────────────────────────────────
  const escalationStage = resolveEscalationStage(input);

  // ─── Resolve validation level ──────────────────────────────────────────
  const validationLevel = resolveValidationLevel(
    input.vspLevel,
    escalationStage,
    input.userType,
    input.eigenRegieScore,
  );

  // ─── Detect DGT signals from text ─────────────────────────────────────
  const detectedSignals = detectDGTSignals(input.userMessage);

  if (detectedSignals.length === 0) {
    return createSuppressedResult('No DGT signals detected', validationLevel, escalationStage);
  }

  // ─── Determine depth level from VSP ───────────────────────────────────
  const depthLevel = getVSPDepthLevel(input.vspLevel);
  const blockedByVSP = DEPTH_BLOCKED_PROCESSES[depthLevel] ?? [];

  // ─── DGT × ACT × CBT × Schema arbitration ────────────────────────────
  const arbitration = shouldDGTOverrideOtherEngines(
    detectedSignals[0]?.signalId ?? null,
    escalationStage,
    input.activeCBTProcess,
    input.activeACTProcess,
  );

  if (!arbitration.overrides && escalationStage === 'CALM') {
    return createSuppressedResult(arbitration.reason, validationLevel, escalationStage);
  }

  // ─── Build candidates ─────────────────────────────────────────────────
  const candidates: DGTCandidate[] = detectedSignals.map((signal) => {
    const processId = DGT_SIGNAL_TO_PROCESS_MAP[signal.signalId];
    const skillId = DGT_SIGNAL_TO_SKILL_MAP[signal.signalId];
    const hint = DGT_SIGNAL_TO_HINT_MAP[signal.signalId];

    // Check if process is blocked by depth
    const isBlocked = blockedByVSP.includes(processId);

    // Confidence adjustments
    let confidence = signal.confidence;

    // Kim boundary-first boost (Section 17)
    if (isKimBoundaryContext(signal.signalId, input.userType)) {
      confidence = Math.min(0.95, confidence + 0.10);
    }

    // Zone escalation boost (Section 22)
    if (input.resolvedZone === 'RED' || input.resolvedZone === 'ORANGE') {
      confidence = Math.min(0.95, confidence + 0.10);
    }

    // VSP ORANGE/RED boost (Section 22)
    if (input.vspLevel === 'ORANJE' || input.vspLevel === 'ROOD') {
      confidence = Math.min(0.95, confidence + 0.10);
    }

    // Progress: successful skill boost
    if (dgtProgress && skillId && dgtProgress.successfulSkills.includes(skillId)) {
      confidence = Math.min(0.95, confidence + 0.05);
    }

    return {
      processId,
      signalId: signal.signalId,
      skillId: isBlocked ? null : skillId,
      confidence,
      source: 'DETERMINISTIC_MARKER' as const,
      evidence: signal.evidence,
      validationLevel,
      escalationStage,
      allowedForPrompt: !isBlocked,
      interventionHint: isBlocked ? 'NO_DGT' as DGTInterventionHint : hint,
    };
  });

  // ─── Filter: minimum confidence threshold + allowed ───────────────────
  const CONFIDENCE_THRESHOLD = 0.20;
  const accepted = candidates.filter((c) => c.confidence >= CONFIDENCE_THRESHOLD && c.allowedForPrompt);
  const rejected = candidates.filter((c) => c.confidence < CONFIDENCE_THRESHOLD || !c.allowedForPrompt);

  if (accepted.length === 0) {
    return {
      decision: {
        acceptedDGTCandidates: [],
        rejectedDGTCandidates: rejected,
        dominantProcess: null,
        dominantSignal: null,
        selectedSkill: null,
        validationLevel,
        escalationStage,
        safeToUseDGT: true,
        ektPhase: null,
        reason: 'All DGT candidates blocked or below threshold',
        promptSummary: '',
      },
      promptBlock: '',
      activated: false,
    };
  }

  // ─── Select dominant (highest confidence) ─────────────────────────────
  const dominant = accepted[0];

  // ─── Anti-repeat: suppress if same process used 3+ times this session ─
  const processUsageCount = sessionDGTProcessesUsed.filter(
    (p) => p === dominant.processId
  ).length;
  if (processUsageCount >= 3) {
    // Try next candidate with different process
    const alternative = accepted.find(
      (c) => c.processId !== dominant.processId &&
        sessionDGTProcessesUsed.filter((p) => p === c.processId).length < 3
    );
    if (alternative) {
      sessionDGTProcessesUsed.push(alternative.processId);
      return buildResult(accepted, rejected, alternative, input, validationLevel, escalationStage);
    }
    return createSuppressedResult('DGT process variety exhausted this session', validationLevel, escalationStage);
  }

  // Track usage
  sessionDGTProcessesUsed.push(dominant.processId);

  return buildResult(accepted, rejected, dominant, input, validationLevel, escalationStage);
}

// ─── Result builders ───────────────────────────────────────────────────────

function createSuppressedResult(
  reason: string,
  validationLevel: ValidationLevelId,
  escalationStage: EscalationStage,
): DGTEngineResult {
  return {
    decision: {
      acceptedDGTCandidates: [],
      rejectedDGTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      selectedSkill: null,
      validationLevel,
      escalationStage,
      safeToUseDGT: false,
      ektPhase: null,
      reason,
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
}

function buildResult(
  accepted: DGTCandidate[],
  rejected: DGTCandidate[],
  dominant: DGTCandidate,
  input: DGTEngineInput,
  validationLevel: ValidationLevelId,
  escalationStage: EscalationStage,
): DGTEngineResult {
  // Determine EKT phase (Section 4)
  const stabilized = escalationStage === 'CALM' || escalationStage === 'RISING';
  const ektPhase = resolveEKTPhase(escalationStage, stabilized);

  const promptBlock = buildDGTPromptBlock(dominant, input, validationLevel, escalationStage, ektPhase);

  return {
    decision: {
      acceptedDGTCandidates: accepted,
      rejectedDGTCandidates: rejected,
      dominantProcess: dominant.processId,
      dominantSignal: dominant.signalId,
      selectedSkill: dominant.skillId,
      validationLevel,
      escalationStage,
      safeToUseDGT: true,
      ektPhase,
      reason: `DGT process ${dominant.processId} activated via ${dominant.signalId} (conf: ${dominant.confidence.toFixed(2)}, skill: ${dominant.skillId ?? 'none'})`,
      promptSummary: promptBlock,
    },
    promptBlock,
    activated: true,
  };
}

// ─── Prompt Builder (Section 23) ───────────────────────────────────────────
// Context budget: escalation 1 line, validation 1 line, skill intention 1 line,
// forbidden style 1 line. Max 4 lines + wrapper.

function buildDGTPromptBlock(
  dominant: DGTCandidate,
  input: DGTEngineInput,
  validationLevel: ValidationLevelId,
  escalationStage: EscalationStage,
  ektPhase: EKTPhase | null,
): string {
  const skillIntention = dominant.skillId
    ? getSkillIntention(dominant.skillId)
    : 'support and validate';

  const validationGuidance = getValidationGuidance(validationLevel);
  const forbiddenStyle = getForbiddenStyle(escalationStage, input.userType);

  const lines: string[] = [
    `[DGT_CONTEXT]`,
    `Escalation: ${escalationStage.toLowerCase()} | Validation: ${validationGuidance}`,
    `Skill intention: ${skillIntention}`,
    `Forbidden: ${forbiddenStyle}`,
  ];

  // Kim boundary-first addition (Section 17)
  if (input.userType === 'kim' && isKimBoundaryContext(dominant.signalId, 'kim')) {
    lines.push(`Kim rule: boundary-first, reduce responsibility, self-protection priority`);
  }

  // EKT phase hint if applicable
  if (ektPhase) {
    lines.push(`EKT phase: ${ektPhase.replace('EKT_', '').toLowerCase()} (after stabilization)`);
  }

  lines.push(`[/DGT_CONTEXT]`);

  return lines.join('\n');
}

// ─── Skill intention mapping (Section 7: hidden skills) ────────────────────

function getSkillIntention(skillId: DGTSkillId): string {
  const intentions: Record<DGTSkillId, string> = {
    STOP: 'Do not act on this for the next minute. Step back first.',
    TIPP: 'Slow your body first. Try a slower breath before deciding.',
    ACCEPTS: 'Find one small distraction to get through this moment.',
    IMPROVE: 'Find one tiny thing that could make this moment slightly more bearable.',
    SELF_SOOTHING: 'Be gentle with yourself right now. What would comfort look like?',
    PROS_CONS: 'Before acting, consider what this costs vs what it gives.',
    RADICAL_ACCEPTANCE: 'This is what is real right now. Fighting it adds suffering.',
    TURNING_THE_MIND: 'You can choose to turn toward acceptance, even if it takes many turns.',
    WILLINGNESS: 'Open to this moment without fighting or escaping.',
    URGE_SURFING: 'The urge is a wave. It will rise and fall. Ride it without acting.',
    GROUNDING: 'Come back to your body. Feel your feet, your hands, this moment.',
    PLEASE: 'Check your basics: sleep, food, movement, substances.',
    CHECK_THE_FACTS: 'What do you actually know vs what does your emotion say?',
    OPPOSITE_ACTION: 'The urge says one thing. Try the opposite, gently.',
    PROBLEM_SOLVING: 'One practical step you can take right now.',
    BUILD_MASTERY: 'One small thing you can do that gives a sense of competence.',
    ACCUMULATE_POSITIVES: 'One small pleasant thing, even tiny.',
    COPE_AHEAD: 'Plan for the difficult moment before it arrives.',
    DEAR_MAN: 'Say what happened, say what you need, and keep it short.',
    GIVE: 'Be gentle, interested, validating, easy manner.',
    FAST: 'Be fair, no excessive apologies, stick to values, truthful.',
    WISE_MIND: 'What does the calm center of you know, beyond emotion and logic?',
  };

  return intentions[skillId] ?? 'support and validate';
}

// ─── Validation guidance (Section 8) ───────────────────────────────────────

function getValidationGuidance(level: ValidationLevelId): string {
  const guidance: Record<ValidationLevelId, string> = {
    L1_PRESENCE: 'Be present. Minimal words. Do not interpret. Just be here.',
    L2_ACCURATE_REFLECTION: 'Reflect back what user said. No interpretation. Mirror only.',
    L3_EMOTION_REFLECTION: 'Name the emotion you hear. Do not explain or fix.',
    L4_CONTEXT_VALIDATION: 'Validate given context. This makes sense because...',
    L5_NORMALIZATION: 'Anyone in this situation might feel this. Normalize without minimizing.',
    L6_RADICAL_GENUINENESS: 'Be genuine. Share honest perspective with care and respect.',
  };

  return guidance[level] ?? 'validate first';
}

// ─── Forbidden style per escalation (Section 29) ───────────────────────────

function getForbiddenStyle(escalationStage: EscalationStage, userType: 'elias' | 'kim'): string {
  const base = 'No toxic positivity. No forced mindfulness. No overanalysis.';

  if (escalationStage === 'CRISIS' || escalationStage === 'FLOODING') {
    return `${base} No problem-solving. No deep exploration. No chain analysis. No homework.`;
  }

  if (escalationStage === 'SHUTDOWN') {
    return `${base} No pressure. No questions. No demands. Presence only.`;
  }

  if (userType === 'kim') {
    return `${base} No responsibility loading. No rescue-first. No guilt-based care.`;
  }

  return base;
}
