/**
 * DIST01 — Proposal Generator (Phase 2: Route A — Promotie)
 *
 * Deterministic engine that decides WHEN and WHAT to propose to the user.
 * Runs POST-GPT, after the detector has updated the Distillation Store.
 *
 * Rules:
 * 1. Only propose signals with confidence medium or high
 * 2. Never propose during crisis (crisisLevel >= 2) or elevated safety
 * 3. Never propose suppressed signals
 * 4. Never propose signals that already exist in target document (dedup)
 * 5. Never propose if a recent proposal for the same pattern exists
 * 6. Respect cooldown between proposals
 * 7. Respect max pending proposals limit
 * 8. Route to correct target document based on persona + signal type
 */
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';
import type { DistilledSignal, DistillationConfidence } from './dist01-types';
import { normalizePatternKey } from './dist01-types';
import type {
  DistillationProposal,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
  ProposalTimingDecision,
  RoutingRule,
  TargetDocument,
  ClinicalMeaning,
  InsertMode,
  SafetyLevel,
  RepeatedDetectionMeta,
} from './dist01-proposal-types';
import {
  generateProposalId,
  PROPOSAL_EXPIRY_MS,
  PROPOSAL_COOLDOWN_MS,
} from './dist01-proposal-types';

// ─── Routing Tables ───────────────────────────────────────────────────────

/**
 * Elias routing rules: signal type → target document + field + meaning
 */
const ELIAS_ROUTING_RULES: RoutingRule[] = [
  // Triggers → VSP triggers
  { signalType: 'new_trigger_detected', targetDocument: 'vsp_trigger', targetField: 'triggers', clinicalMeaning: 'craving_trigger', insertMode: 'append', minConfidence: 'medium' },
  { signalType: 'recurring_trigger_detected', targetDocument: 'vsp_trigger', targetField: 'triggers', clinicalMeaning: 'craving_trigger', insertMode: 'append', minConfidence: 'medium' },
  // Zone signals → VSP zone
  { signalType: 'zone_signal_detected', targetDocument: 'vsp_zone', targetField: 'signals', clinicalMeaning: 'early_signal', insertMode: 'append', minConfidence: 'medium' },
  // Risk patterns → VSP zone (orange/red)
  { signalType: 'risk_pattern_detected', targetDocument: 'vsp_zone', targetField: 'signals', clinicalMeaning: 'relapse_warning', insertMode: 'append', minConfidence: 'high' },
  // Protective patterns → VSP zone (green)
  { signalType: 'protective_pattern_detected', targetDocument: 'vsp_zone', targetField: 'whatHelps', clinicalMeaning: 'protective_action', insertMode: 'append', minConfidence: 'medium' },
  // Self-care → VSP recovery rules
  { signalType: 'self_care_pattern_detected', targetDocument: 'vsp_recovery_rule', targetField: 'recoveryRules', clinicalMeaning: 'protective_action', insertMode: 'append', minConfidence: 'medium' },
  // Support → Backpack
  { signalType: 'support_source_detected', targetDocument: 'backpack', targetField: 'steunpilaren', clinicalMeaning: 'support_need', insertMode: 'append', minConfidence: 'medium' },
  // Anchor sentences → VSP anchor
  { signalType: 'anchor_sentence_detected', targetDocument: 'vsp_anchor_sentence', targetField: 'mainAnchorSentence', clinicalMeaning: 'stabilizing_sentence', insertMode: 'append', minConfidence: 'medium' },
  // Life story → Backpack
  { signalType: 'life_story_detail_detected', targetDocument: 'backpack', targetField: 'levensverhaal', clinicalMeaning: 'identity_detail', insertMode: 'append', minConfidence: 'medium' },
  // Person patterns → Backpack
  { signalType: 'person_pattern_detected', targetDocument: 'backpack', targetField: 'relaties', clinicalMeaning: 'identity_detail', insertMode: 'add_note', minConfidence: 'medium' },
  // Boundary patterns (Elias) → VSP recovery rules
  { signalType: 'boundary_pattern_detected', targetDocument: 'vsp_recovery_rule', targetField: 'recoveryRules', clinicalMeaning: 'protective_action', insertMode: 'append', minConfidence: 'medium' },
];

/**
 * Kim routing rules: signal type → target document + field + meaning
 */
const KIM_ROUTING_RULES: RoutingRule[] = [
  // Zone signals → Eigen Regie zone
  { signalType: 'zone_signal_detected', targetDocument: 'eigen_regie_zone', targetField: 'signals', clinicalMeaning: 'loss_of_self_direction', insertMode: 'append', minConfidence: 'medium' },
  // Triggers → Eigen Regie triggers
  { signalType: 'new_trigger_detected', targetDocument: 'eigen_regie_trigger', targetField: 'triggers', clinicalMeaning: 'emotional_overload', insertMode: 'append', minConfidence: 'medium' },
  { signalType: 'recurring_trigger_detected', targetDocument: 'eigen_regie_trigger', targetField: 'triggers', clinicalMeaning: 'emotional_overload', insertMode: 'append', minConfidence: 'medium' },
  // Boundary patterns → Eigen Regie boundary rules
  { signalType: 'boundary_pattern_detected', targetDocument: 'eigen_regie_boundary_rule', targetField: 'boundaryRules', clinicalMeaning: 'healthy_boundary', insertMode: 'append', minConfidence: 'medium' },
  // Risk patterns → Eigen Regie zone
  { signalType: 'risk_pattern_detected', targetDocument: 'eigen_regie_zone', targetField: 'signals', clinicalMeaning: 'boundary_fatigue', insertMode: 'append', minConfidence: 'high' },
  // Protective patterns → Eigen Regie zone (whatHelps)
  { signalType: 'protective_pattern_detected', targetDocument: 'eigen_regie_zone', targetField: 'whatHelps', clinicalMeaning: 'protective_action', insertMode: 'append', minConfidence: 'medium' },
  // Self-care → Eigen Regie zone (whatHelps)
  { signalType: 'self_care_pattern_detected', targetDocument: 'eigen_regie_zone', targetField: 'whatHelps', clinicalMeaning: 'protective_action', insertMode: 'append', minConfidence: 'medium' },
  // Support → Kim Backpack
  { signalType: 'support_source_detected', targetDocument: 'kimBackpack', targetField: 'my_strength', clinicalMeaning: 'support_source', insertMode: 'append', minConfidence: 'medium' },
  // Anchor sentences → Eigen Regie anchor
  { signalType: 'anchor_sentence_detected', targetDocument: 'eigen_regie_anchor_sentence', targetField: 'mainAnchorSentence', clinicalMeaning: 'autonomy_anchor', insertMode: 'append', minConfidence: 'medium' },
  // Life story → Kim Backpack
  { signalType: 'life_story_detail_detected', targetDocument: 'kimBackpack', targetField: 'my_story', clinicalMeaning: 'loss_of_self_direction', insertMode: 'append', minConfidence: 'medium' },
  // Person patterns → Kim Backpack (the_relationship)
  { signalType: 'person_pattern_detected', targetDocument: 'kimBackpack', targetField: 'the_relationship', clinicalMeaning: 'over_responsibility', insertMode: 'add_note', minConfidence: 'medium' },
];

// ─── Confidence Ordering ──────────────────────────────────────────────────

const CONFIDENCE_ORDER: Record<DistillationConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function meetsMinConfidence(actual: DistillationConfidence, required: DistillationConfidence): boolean {
  return CONFIDENCE_ORDER[actual] >= CONFIDENCE_ORDER[required];
}

// ─── Timing Decision ──────────────────────────────────────────────────────

/**
 * Decide whether it's appropriate to show a proposal right now.
 * Based on spec section 12 timing rules.
 */
export function evaluateProposalTiming(input: {
  crisisLevel: number;
  safetyLevel: SafetyLevel;
  pendingProposalCount: number;
  lastProposalShownAt: number | null;
}): ProposalTimingDecision {
  const { crisisLevel, safetyLevel, pendingProposalCount, lastProposalShownAt } = input;

  // Never during crisis
  if (crisisLevel >= 2) {
    return { shouldShow: false, reason: 'crisis_active' };
  }

  // Never during elevated safety
  if (safetyLevel === 'elevated' || safetyLevel === 'crisis') {
    return { shouldShow: false, reason: 'safety_elevated' };
  }

  // Cooldown check
  if (lastProposalShownAt !== null) {
    const elapsed = Date.now() - lastProposalShownAt;
    if (elapsed < PROPOSAL_COOLDOWN_MS) {
      return { shouldShow: false, reason: 'cooldown_active' };
    }
  }

  // Don't overwhelm with too many pending
  if (pendingProposalCount >= 3) {
    return { shouldShow: false, reason: 'too_many_pending' };
  }

  return { shouldShow: true, reason: 'timing_ok' };
}

// ─── Proposal Generator ───────────────────────────────────────────────────

/**
 * Generate proposals from signals in the Distillation Store.
 * Called POST-GPT after detector has run and store is updated.
 */
export function generateProposals(input: ProposalGeneratorInput): ProposalGeneratorOutput {
  const {
    persona,
    source,
    sessionId,
    localDayKey,
    crisisLevel,
    safetyLevel,
    signals,
    existingProposals,
    existingDocumentKeys,
  } = input;

  // ── Safety gate: no proposals during crisis ──
  if (crisisLevel >= 2 || safetyLevel === 'crisis' || safetyLevel === 'elevated') {
    return { newProposals: [], promotedSignalIds: [] };
  }

  // ── Select routing table based on persona ──
  const routingRules = persona === 'elias' ? ELIAS_ROUTING_RULES : KIM_ROUTING_RULES;

  const newProposals: DistillationProposal[] = [];
  const promotedSignalIds: string[] = [];

  // ── Process each eligible signal ──
  for (const signal of signals) {
    // Skip suppressed signals
    if (signal.suppressedByUser) continue;

    // Skip signals already proposed or accepted
    if (signal.promotionStatus !== 'in_store') continue;

    // Skip low confidence
    if (signal.confidence === 'low') continue;

    // Skip signals with contradiction flag
    if (signal.contradictionFlag) continue;

    // Find matching routing rule
    const rule = routingRules.find(
      (r) => r.signalType === signal.signalType && meetsMinConfidence(signal.confidence, r.minConfidence)
    );
    if (!rule) continue;

    // ── Dedup: check if this pattern already has a proposal ──
    const hasExistingProposal = existingProposals.some(
      (p) =>
        p.signalId === signal.id ||
        (p.repeatedDetection?.normalizedPatternKey === signal.normalizedPatternKey &&
          (p.status === 'pending' || p.status === 'rejected'))
    );
    if (hasExistingProposal) continue;

    // ── Dedup: check if this pattern already exists in the target document ──
    const normalizedKey = signal.normalizedPatternKey || normalizePatternKey(signal.normalizedText);
    const existsInDocument = existingDocumentKeys.some(
      (docKey) => docKey === normalizedKey || docKey === signal.normalizedText.toLowerCase()
    );
    if (existsInDocument) continue;

    // ── Build repeated detection metadata ──
    const repeatedDetection: RepeatedDetectionMeta = {
      normalizedPatternKey: signal.normalizedPatternKey,
      detectionCount: signal.detectionCount,
      firstDetectedAt: signal.firstDetectedAt,
      lastDetectedAt: signal.lastDetectedAt,
      detectedAcrossSessionIds: signal.detectedAcrossSessionIds,
      detectedAcrossLocalDayKeys: signal.detectedAcrossLocalDayKeys,
      sourceTypes: signal.sourceTypes,
      eligibleForAutoSave: signal.eligibleForAutoSave,
      autoSavedAt: null,
      userReviewedAt: null,
    };

    // ── Create proposal ──
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + PROPOSAL_EXPIRY_MS).toISOString();

    const proposal: DistillationProposal = {
      id: generateProposalId(),
      persona,
      source,
      status: 'pending',
      confidence: signal.confidence,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      rawUserTextExcerpt: signal.rawUserTextExcerpts[0] || signal.normalizedText,
      proposedUserFacingText: signal.normalizedText,
      editedText: null,
      targetDocument: rule.targetDocument,
      targetField: rule.targetField,
      insertMode: rule.insertMode,
      engineReason: signal.signalType,
      clinicalMeaning: rule.clinicalMeaning,
      safetyLevel,
      requiresExplicitConfirmation: true,
      autoSaveAllowed: signal.eligibleForAutoSave,
      userCanEdit: true,
      repeatedDetection,
      signalId: signal.id,
    };

    newProposals.push(proposal);
    promotedSignalIds.push(signal.id);
  }

  return { newProposals, promotedSignalIds };
}

// ─── Target Document Labels (for UI) ─────────────────────────────────────

const TARGET_DOCUMENT_LABELS: Record<TargetDocument, string> = {
  backpack: 'Rugzak',
  vsp_zone: 'Veiligheidsplan — Zone',
  vsp_trigger: 'Veiligheidsplan — Triggers',
  vsp_recovery_rule: 'Veiligheidsplan — Herstelregels',
  vsp_anchor_sentence: 'Veiligheidsplan — Ankerzin',
  kimBackpack: 'Mijn Rugzak',
  eigen_regie_zone: 'Eigen Regie Plan — Zone',
  eigen_regie_trigger: 'Eigen Regie Plan — Triggers',
  eigen_regie_boundary_rule: 'Eigen Regie Plan — Grensregels',
  eigen_regie_anchor_sentence: 'Eigen Regie Plan — Ankerzin',
};

export function getTargetDocumentLabel(target: TargetDocument): string {
  return TARGET_DOCUMENT_LABELS[target] || target;
}

// ─── Target Field Labels (for UI) ────────────────────────────────────────

const TARGET_FIELD_LABELS: Record<string, string> = {
  triggers: 'Triggers',
  signals: 'Signalen',
  whatHelps: 'Wat helpt',
  recoveryRules: 'Herstelregels',
  mainAnchorSentence: 'Ankerzin',
  anchorSentence: 'Ankerzin',
  levensverhaal: 'Levensverhaal',
  relaties: 'Relaties',
  steunpilaren: 'Steunpilaren',
  my_story: 'Mijn verhaal',
  the_relationship: 'De relatie',
  my_boundaries: 'Mijn grenzen',
  my_strength: 'Mijn kracht',
  boundaryRules: 'Grensregels',
  bodySignals: 'Lichaamssignalen',
  thoughts: 'Gedachten',
  behaviour: 'Gedrag',
  boundaryActions: 'Grensacties',
  contactRule: 'Contactregel',
};

export function getTargetFieldLabel(field: string): string {
  return TARGET_FIELD_LABELS[field] || field;
}

// ─── Export routing rules for testing and auto-save ─────────────────────────────

export { ELIAS_ROUTING_RULES, KIM_ROUTING_RULES };

/**
 * Get routing rules for a specific persona (used by auto-save and pipeline).
 */
export function getRoutingRulesForPersona(persona: RecoFreePersona): RoutingRule[] {
  return persona === 'kim' ? KIM_ROUTING_RULES : ELIAS_ROUTING_RULES;
}
