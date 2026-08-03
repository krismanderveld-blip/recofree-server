/**
 * DIST01 — Proposal Types (Phase 2: Route A — Promotie)
 *
 * Data model for explicit proposals shown to the user when the detector
 * finds a signal with medium/high confidence that should be routed to
 * an existing structure document (backpack, VSP, Eigen Regie Plan).
 *
 * Lifecycle: detected → pending → [user action] → accepted / edited / rejected / dismissed / expired
 */
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';
import type { DistillationSource, DistillationConfidence, SignalType } from './dist01-types';

// ─── Target Documents ─────────────────────────────────────────────────────

export type EliasTargetDocument =
  | 'backpack'
  | 'vsp_zone'
  | 'vsp_trigger'
  | 'vsp_recovery_rule'
  | 'vsp_anchor_sentence';

export type KimTargetDocument =
  | 'kimBackpack'
  | 'eigen_regie_zone'
  | 'eigen_regie_trigger'
  | 'eigen_regie_boundary_rule'
  | 'eigen_regie_anchor_sentence'
  | 'kim_grenzenplan'
  | 'kim_steunplan'
  | 'kim_patroonkaart';

export type TargetDocument = EliasTargetDocument | KimTargetDocument;

// ─── Insert Mode ──────────────────────────────────────────────────────────

export type InsertMode = 'append' | 'add_note' | 'add_nuance';

// ─── Safety Level ─────────────────────────────────────────────────────────

export type SafetyLevel = 'none' | 'mild' | 'elevated' | 'crisis';

// ─── Clinical Meaning ─────────────────────────────────────────────────────

export type EliasClinicalMeaning =
  | 'craving_trigger'
  | 'relapse_warning'
  | 'early_signal'
  | 'protective_action'
  | 'support_need'
  | 'identity_detail'
  | 'shame_pattern'
  | 'avoidance_pattern'
  | 'recovery_value'
  | 'stabilizing_sentence';

export type KimEigenRegieMeaning =
  | 'loss_of_self_direction'
  | 'boundary_fatigue'
  | 'over_responsibility'
  | 'self_care_loss'
  | 'emotional_overload'
  | 'control_pattern'
  | 'guilt_pattern'
  | 'healthy_boundary'
  | 'protective_action'
  | 'support_source'
  | 'autonomy_anchor';

export type ClinicalMeaning = EliasClinicalMeaning | KimEigenRegieMeaning;

// ─── Proposal Status ──────────────────────────────────────────────────────

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'edited'
  | 'rejected'
  | 'dismissed'
  | 'expired';

// ─── Repeated Detection Metadata ──────────────────────────────────────────

export interface RepeatedDetectionMeta {
  normalizedPatternKey: string;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  detectedAcrossSessionIds: string[];
  detectedAcrossLocalDayKeys: string[];
  sourceTypes: DistillationSource[];
  eligibleForAutoSave: boolean;
  autoSavedAt: string | null;
  userReviewedAt: string | null;
}

// ─── Proposal (Route A — explicit proposal) ──────────────────────────────

export interface DistillationProposal {
  id: string;
  persona: RecoFreePersona;
  source: DistillationSource;
  status: ProposalStatus;
  confidence: DistillationConfidence;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;

  /** Raw user text that triggered the detection */
  rawUserTextExcerpt: string;
  /** Engine-proposed text for the target document */
  proposedUserFacingText: string;
  /** User-edited text (if status is 'edited') */
  editedText: string | null;

  /** Where this proposal should be written */
  targetDocument: TargetDocument;
  /** Which field in the target document */
  targetField: string;
  /** How to insert (append, add_note, add_nuance) */
  insertMode: InsertMode;

  /** Why the engine detected this */
  engineReason: SignalType;
  /** Clinical/eigen-regie meaning */
  clinicalMeaning: ClinicalMeaning;
  /** Current safety level */
  safetyLevel: SafetyLevel;

  /** Whether user must explicitly confirm before writing */
  requiresExplicitConfirmation: boolean;
  /** Whether auto-save is allowed for this proposal (Route B) */
  autoSaveAllowed: boolean;
  /** User can always edit */
  userCanEdit: true;

  /** Repeated detection metadata (for Route B tracking) */
  repeatedDetection: RepeatedDetectionMeta | null;

  /** Signal ID in the Distillation Store (for cross-reference) */
  signalId: string | null;
}

// ─── Proposal Store Data ──────────────────────────────────────────────────

export interface ProposalStoreData {
  schemaVersion: 'dist01-proposals.v1';
  persona: RecoFreePersona;
  proposals: DistillationProposal[];
  lastUpdatedAt: string;
}

// ─── Proposal Generator Input ─────────────────────────────────────────────

export interface ProposalGeneratorInput {
  persona: RecoFreePersona;
  source: DistillationSource;
  sessionId: string;
  localDayKey: string;
  /** Current crisis level from pipeline (0=none, 1=elevated, 2=crisis) */
  crisisLevel: number;
  /** Current safety level */
  safetyLevel: SafetyLevel;
  /** Signals from the Distillation Store (after merge) */
  signals: import('./dist01-types').DistilledSignal[];
  /** Existing proposals (for dedup) */
  existingProposals: DistillationProposal[];
  /** Existing document content keys (for dedup against documents) */
  existingDocumentKeys: string[];
}

// ─── Proposal Generator Output ────────────────────────────────────────────

export interface ProposalGeneratorOutput {
  /** New proposals to add to the store */
  newProposals: DistillationProposal[];
  /** Signal IDs that were promoted to 'proposed' status */
  promotedSignalIds: string[];
}

// ─── Routing Table Entry ──────────────────────────────────────────────────

export interface RoutingRule {
  signalType: SignalType;
  targetDocument: TargetDocument;
  targetField: string;
  clinicalMeaning: ClinicalMeaning;
  insertMode: InsertMode;
  /** Minimum confidence required to generate a proposal */
  minConfidence: DistillationConfidence;
}

// ─── UI Action Types ──────────────────────────────────────────────────────

export type ProposalUserAction =
  | 'accept'    // Toevoegen — write to document as-is
  | 'edit'      // Aanpassen — user edits, then write
  | 'dismiss'   // Niet nu — may be proposed again later
  | 'reject';   // Niet bewaren — suppress this pattern

// ─── Timing Decision ──────────────────────────────────────────────────────

export interface ProposalTimingDecision {
  shouldShow: boolean;
  reason: string;
}

// ─── Utility ──────────────────────────────────────────────────────────────

export function generateProposalId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyProposalStore(persona: RecoFreePersona): ProposalStoreData {
  return {
    schemaVersion: 'dist01-proposals.v1',
    persona,
    proposals: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

/** Expiry duration for pending proposals: 7 days */
export const PROPOSAL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximum pending proposals at any time */
export const MAX_PENDING_PROPOSALS = 20;

/** Cooldown between proposals shown to user (ms) — 3 minutes */
export const PROPOSAL_COOLDOWN_MS = 3 * 60 * 1000;
