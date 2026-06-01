/**
 * ═══════════════════════════════════════════════════════════════════
 * MBT++ ENGINE — ROUTER (Round 56)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Deterministic routing for MBT++ interventions.
 * Handles:
 * - Safety gating (crisis, VSP, boundary-first)
 * - Mentalizing state → response mode selection
 * - Kim/Elias persona divergence
 * - Cross-engine integration (MBT×ACT, MBT×CBT, MBT×DGT, MBT×Schema)
 * - Anti-repeat logic
 * - Compact prompt builder (4-line context budget)
 *
 * Canon: Sections 9, 12, 13, 14
 * ═══════════════════════════════════════════════════════════════════
 */

import type {
  MBTSignalId,
  MBTProcessId,
  MBTCandidate,
  MBTDecision,
  MBTEngineResult,
  MBTProgress,
  MBTResponseModeId,
  MentalizingStateId,
} from './mbt-types';
import {
  MBT_STATE_SEVERITY,
  MBT_STATE_MAX_DEPTH,
  VSP_TO_MBT_RESPONSE,
  MBT_ROUTING_PRIORITY,
} from './mbt-types';
import { detectMBT } from './mbt-detector';

// ─── Session State (reset per session) ───────────────────────────

let sessionMBTProcessesUsed: MBTProcessId[] = [];

export function resetMBTSessionState(): void {
  sessionMBTProcessesUsed = [];
}

export function getSessionMBTProcessesUsed(): MBTProcessId[] {
  return [...sessionMBTProcessesUsed];
}

// ─── Router Input ────────────────────────────────────────────────

export interface MBTRouterInput {
  userMessage: string;
  userType: 'elias' | 'kim';
  vspLevel: string;
  eigenRegieScore: number | null;
  crisisLevel: number; // 0=none, 1=moderate, 2=high/critical
  resolvedZone: string;
  distressScore: number;
  activeMode: string | null;
  activeSchema: string | null;
  activeACTProcess: string | null;
  activeCBTProcess: string | null;
  activeDGTProcess: string | null;
  stageOfChange: string;
  guidanceDepth: number;
}

// ─── Safety Gating ───────────────────────────────────────────────

/**
 * Routing priorities (Section 13):
 * 1. Crisis safety
 * 2. Boundary safety
 * 3. Relapse prevention
 * 4. Affect regulation
 * 5. Mentalizing restoration
 * 6. Relational perspective-taking
 * 7. Action contract
 * 8. Reflective deepening
 */

function determineSafetyOverride(
  input: MBTRouterInput,
  detectedState: MentalizingStateId,
  candidates: MBTCandidate[],
): MBTResponseModeId | null {
  // Priority 1: Crisis
  if (input.crisisLevel >= 2) {
    return 'CRISIS';
  }

  // Priority 2: Boundary safety (boundary violation detected)
  const hasBoundaryViolation = candidates.some(c => c.signal === 'BOUNDARY_VIOLATION_REPORT');
  if (hasBoundaryViolation) {
    return 'BOUNDARY_FIRST';
  }

  // Priority 3: Relapse prevention (Elias only, high craving)
  if (input.userType === 'elias' && input.distressScore >= 7) {
    return 'RELAPSE_PREVENTION';
  }

  // Priority 4: VSP override (ROOD/RED → crisis, ORANJE/ORANGE → regulate)
  const vspResponse = VSP_TO_MBT_RESPONSE[input.resolvedZone.toUpperCase()];
  if (vspResponse === 'CRISIS') {
    return 'CRISIS';
  }

  // Shutdown state → always regulate first
  if (detectedState === 'M7_SHUTDOWN') {
    return 'REGULATE';
  }

  // High severity states with high distress → regulate first
  if (MBT_STATE_SEVERITY[detectedState] >= 3 && input.distressScore >= 6) {
    return 'REGULATE';
  }

  return null; // No safety override, proceed with normal routing
}

// ─── Kim/Elias Divergence ────────────────────────────────────────

/** Kim-specific signals that get priority boost */
const KIM_PRIORITY_SIGNALS: MBTSignalId[] = [
  'BOUNDARY_VIOLATION_REPORT',
  'CARETAKER_EXHAUSTION',
  'RESCUE_IMPULSE',
  'CONFLICT_ESCALATION',
  'MANIPULATION_FEAR',
  'COMPASSION_VS_SELF_ERASURE' as unknown as MBTSignalId, // mapped via CARETAKER_EXHAUSTION
];

/** Elias-specific signals that get priority boost */
const ELIAS_PRIORITY_SIGNALS: MBTSignalId[] = [
  'CRAVING_AFTER_REJECTION',
  'RELAPSE_SHAME',
  'SHAME_FLOOD',
  'NUMBNESS_DISSOCIATION',
  'ANGER_COVERING_FEAR',
  'SELF_BLAME_LOOP',
];

function applyPersonaDivergence(
  candidates: MBTCandidate[],
  userType: 'elias' | 'kim',
): MBTCandidate[] {
  const prioritySignals = userType === 'kim' ? KIM_PRIORITY_SIGNALS : ELIAS_PRIORITY_SIGNALS;

  return candidates.map(c => {
    if (prioritySignals.includes(c.signal)) {
      return { ...c, confidence: Math.min(1.0, c.confidence * 1.3) };
    }
    return c;
  }).sort((a, b) => b.confidence - a.confidence);
}

// ─── Cross-Engine Integration ────────────────────────────────────

/**
 * MBT×ACT: If ACT is active with values work, MBT deepens perspective
 * MBT×CBT: If CBT is active with distortion, MBT slows certainty
 * MBT×DGT: If DGT is active with validation, MBT supports affect regulation
 * MBT×Schema: If schema mode is active, MBT adjusts mentalizing approach
 */

interface CrossEngineAdjustment {
  boostProcess: MBTProcessId | null;
  blockProcess: MBTProcessId | null;
  adjustResponseMode: MBTResponseModeId | null;
}

function getCrossEngineAdjustment(input: MBTRouterInput): CrossEngineAdjustment {
  const result: CrossEngineAdjustment = {
    boostProcess: null,
    blockProcess: null,
    adjustResponseMode: null,
  };

  // MBT×ACT: Values work active → boost perspective-taking
  if (input.activeACTProcess) {
    result.boostProcess = 'HOLD_MULTIPLE_PERSPECTIVES';
  }

  // MBT×CBT: Distortion active → boost slow-down interpretation
  if (input.activeCBTProcess) {
    result.boostProcess = 'SLOW_DOWN_INTERPRETATION';
  }

  // MBT×DGT: Validation active → support regulation, don't compete
  if (input.activeDGTProcess) {
    // DGT handles validation; MBT should not duplicate
    result.blockProcess = 'VALIDATE_LIVED_EXPERIENCE';
    result.adjustResponseMode = 'REFLECT';
  }

  // MBT×Schema: Vulnerable child mode → regulate first
  if (input.activeMode === 'VULNERABLE_CHILD' || input.activeMode === 'ANGRY_CHILD') {
    result.adjustResponseMode = 'REGULATE';
  }

  // MBT×Schema: Punitive parent → boundary protection
  if (input.activeMode === 'PUNITIVE_PARENT' || input.activeMode === 'DEMANDING_PARENT') {
    result.boostProcess = 'BOUNDARY_PROTECTION';
  }

  return result;
}

// ─── Depth Gating ────────────────────────────────────────────────

/** Processes blocked at low guidance depth */
const DEPTH_BLOCKED_PROCESSES: Record<number, MBTProcessId[]> = {
  1: ['HOLD_MULTIPLE_PERSPECTIVES', 'SEPARATE_FACT_INTERPRETATION', 'RESTORE_MENTALIZING'],
  2: ['HOLD_MULTIPLE_PERSPECTIVES'],
};

// ─── Anti-Repeat Logic ───────────────────────────────────────────

const MAX_SAME_PROCESS_PER_SESSION = 3;

function isProcessOverused(process: MBTProcessId): boolean {
  const count = sessionMBTProcessesUsed.filter(p => p === process).length;
  return count >= MAX_SAME_PROCESS_PER_SESSION;
}

// ─── Main Router ─────────────────────────────────────────────────

export function routeMBTEngine(
  input: MBTRouterInput,
  progress: MBTProgress,
): MBTEngineResult {
  const emptyResult: MBTEngineResult = {
    decision: {
      acceptedMBTCandidates: [],
      rejectedMBTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      detectedState: 'M0_STABLE_MENTALIZING',
      responseMode: 'REFLECT',
      safeToUseMBT: false,
      reason: 'not_run',
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };

  // ── Gate 1: Message too short ──
  if (input.userMessage.trim().length < 8) {
    return { ...emptyResult, decision: { ...emptyResult.decision, reason: 'message_too_short' } };
  }

  // ── Step 1: Detect mentalizing state + signals ──
  const { state: detectedState, candidates: rawCandidates } = detectMBT(input.userMessage);

  // ── Gate 2: No signals and stable state ──
  if (rawCandidates.length === 0 && detectedState === 'M0_STABLE_MENTALIZING') {
    return { ...emptyResult, decision: { ...emptyResult.decision, detectedState, reason: 'no_signals_stable_state' } };
  }

  // ── Step 2: Apply persona divergence ──
  const personaCandidates = applyPersonaDivergence(rawCandidates, input.userType);

  // ── Step 3: Safety override check ──
  const safetyOverride = determineSafetyOverride(input, detectedState, personaCandidates);

  // ── Step 4: Cross-engine adjustment ──
  const crossEngine = getCrossEngineAdjustment(input);

  // ── Step 5: Filter candidates by depth and anti-repeat ──
  const depthBlocked = DEPTH_BLOCKED_PROCESSES[input.guidanceDepth] ?? [];
  const accepted: MBTCandidate[] = [];
  const rejected: MBTCandidate[] = [];

  for (const candidate of personaCandidates) {
    // Block by depth
    if (depthBlocked.includes(candidate.suggestedProcess)) {
      rejected.push(candidate);
      continue;
    }
    // Block by cross-engine
    if (crossEngine.blockProcess === candidate.suggestedProcess) {
      rejected.push(candidate);
      continue;
    }
    // Block by anti-repeat
    if (isProcessOverused(candidate.suggestedProcess)) {
      rejected.push(candidate);
      continue;
    }
    // Confidence threshold
    if (candidate.confidence < 0.3) {
      rejected.push(candidate);
      continue;
    }
    accepted.push(candidate);
  }

  // ── Step 6: Select dominant process ──
  let dominantProcess: MBTProcessId | null = null;
  let dominantSignal: MBTSignalId | null = null;
  let responseMode: MBTResponseModeId = 'REFLECT';

  if (accepted.length > 0) {
    // Boost cross-engine preferred process
    if (crossEngine.boostProcess) {
      const boosted = accepted.find(c => c.suggestedProcess === crossEngine.boostProcess);
      if (boosted) {
        boosted.confidence = Math.min(1.0, boosted.confidence * 1.2);
        accepted.sort((a, b) => b.confidence - a.confidence);
      }
    }

    dominantProcess = accepted[0].suggestedProcess;
    dominantSignal = accepted[0].signal;
    responseMode = accepted[0].suggestedResponseMode;
  }

  // ── Step 7: Apply safety override to response mode ──
  if (safetyOverride) {
    responseMode = safetyOverride;
  }

  // ── Step 8: Apply cross-engine response mode adjustment ──
  if (crossEngine.adjustResponseMode && !safetyOverride) {
    responseMode = crossEngine.adjustResponseMode;
  }

  // ── Step 9: Apply state-based max depth constraint ──
  const maxDepth = MBT_STATE_MAX_DEPTH[detectedState];
  if (maxDepth === 0 && responseMode !== 'CRISIS') {
    responseMode = 'REGULATE';
  }

  // ── Step 10: Kim boundary-first override ──
  if (input.userType === 'kim') {
    const kimBoundarySignals: MBTSignalId[] = [
      'BOUNDARY_VIOLATION_REPORT',
      'CONFLICT_ESCALATION',
      'CARETAKER_EXHAUSTION',
    ];
    if (accepted.some(c => kimBoundarySignals.includes(c.signal))) {
      responseMode = 'BOUNDARY_FIRST';
    }
  }

  // ── Determine if MBT should activate ──
  const safeToUseMBT = accepted.length > 0 || detectedState !== 'M0_STABLE_MENTALIZING';
  const activated = safeToUseMBT;

  // ── Record process usage ──
  if (dominantProcess && activated) {
    sessionMBTProcessesUsed.push(dominantProcess);
  }

  // ── Build decision ──
  const decision: MBTDecision = {
    acceptedMBTCandidates: accepted.slice(0, 3),
    rejectedMBTCandidates: rejected.slice(0, 3),
    dominantProcess,
    dominantSignal,
    detectedState,
    responseMode,
    safeToUseMBT,
    reason: activated
      ? `state=${detectedState}|mode=${responseMode}|signal=${dominantSignal ?? 'none'}`
      : 'no_activation_needed',
    promptSummary: '',
  };

  // ── Build prompt block ──
  const promptBlock = activated ? buildMBTPromptBlock(decision, input) : '';
  decision.promptSummary = promptBlock.slice(0, 120);

  return {
    decision,
    promptBlock,
    activated,
  };
}

// ─── Prompt Builder (4-line context budget) ──────────────────────

function buildMBTPromptBlock(decision: MBTDecision, input: MBTRouterInput): string {
  const lines: string[] = [];

  // Line 1: Mentalizing state + response mode
  lines.push(
    `[MBT++] State: ${decision.detectedState} | Mode: ${decision.responseMode} | Persona: ${input.userType.toUpperCase()}`
  );

  // Line 2: Dominant process + hint
  if (decision.dominantProcess && decision.acceptedMBTCandidates.length > 0) {
    const hint = decision.acceptedMBTCandidates[0].hint;
    lines.push(`Process: ${decision.dominantProcess} → ${hint}`);
  }

  // Line 3: Response mode instruction
  lines.push(getMBTResponseInstruction(decision.responseMode, input.userType, decision.detectedState));

  // Line 4: Safety/boundary constraint
  lines.push(getMBTConstraint(decision, input));

  return lines.join('\n');
}

function getMBTResponseInstruction(
  mode: MBTResponseModeId,
  userType: 'elias' | 'kim',
  state: MentalizingStateId,
): string {
  const instructions: Record<MBTResponseModeId, string> = {
    REGULATE: 'REGULATE FIRST: Short sentences, body orientation, one question max. No complex analysis until activation lowers.',
    REFLECT: 'REFLECT: Validate experience, name uncertainty when interpreting, connect behavior to possible inner state.',
    CLARIFY: 'CLARIFY: Separate fact from interpretation, offer alternative possibilities without invalidating pain.',
    BOUNDARY_FIRST: userType === 'kim'
      ? 'BOUNDARY-FIRST: Do NOT explore other person motives. Prioritize self-protection and clean boundary.'
      : 'BOUNDARY-FIRST: Prioritize safety planning. Do NOT ask user to empathize with unsafe behavior.',
    VSP_ACTION: 'VSP ACTION: Act before analysis. Move away from access, delay decision, lower body pressure first.',
    RELAPSE_PREVENTION: 'RELAPSE PREVENTION: Keep event specific. Remove moral collapse. Protect next hour from shame-driven second relapse.',
    REPAIR: 'REPAIR: Acknowledge mismatch, drop wrong assumption, ask for corrected meaning, continue without defensiveness.',
    CONTRACT: 'ACTION CONTRACT: Turn insight into one concrete next step. Confirm action anchor, not content summary.',
    CRISIS: 'CRISIS: Safety protocol active. Minimal words, maximum safety. One clear action, one clear question.',
  };

  return instructions[mode];
}

function getMBTConstraint(decision: MBTDecision, input: MBTRouterInput): string {
  const constraints: string[] = [];

  // Not-knowing stance (always)
  constraints.push('Never claim certainty about hidden motives.');

  // State-specific constraints
  if (decision.detectedState === 'M7_SHUTDOWN') {
    constraints.push('No deep analysis. Body orientation only.');
  } else if (decision.detectedState === 'M4_PSYCHIC_EQUIVALENCE' || decision.detectedState === 'M6_TELEOLOGICAL') {
    constraints.push('Gently introduce alternative without arguing.');
  } else if (decision.detectedState === 'M3_COLLAPSED_OTHER') {
    constraints.push('Do not defend the other person. Validate impact first.');
  }

  // Kim-specific
  if (input.userType === 'kim') {
    constraints.push('Never place recovery responsibility on loved one.');
  }

  // Elias-specific
  if (input.userType === 'elias' && input.distressScore >= 5) {
    constraints.push('Max one question. Short sentences under high activation.');
  }

  return constraints.slice(0, 2).join(' ');
}
