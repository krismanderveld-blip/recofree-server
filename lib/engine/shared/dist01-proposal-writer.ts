/**
 * DIST01 — Proposal Writer (Phase 3: Route B)
 *
 * Writes accepted/edited proposals to their target documents:
 * - Elias: backpack sections, VSP zones/triggers/recoveryRules/anchor
 * - Kim: kimBackpack sections, Eigen Regie Plan zones/triggers/boundaryRules/anchor
 *
 * Also handles:
 * - Auto-save for eligible high-confidence signals
 * - Updating promotionStatus in the Distillation Store
 *
 * IMPORTANT: This module does NOT use React hooks. It operates on raw data
 * and returns the updated objects. The caller (chat.tsx) is responsible for
 * persisting via SessionMemoryCache / user-context dispatch.
 */
import type { Backpack, VspStructuredPlan, VspTrigger, LifePhaseId } from '@/lib/ai/types';
import type { EigenRegiePlan, EigenRegieTrigger, EigenRegieZoneId } from '@/lib/engine/kim/kerp01-types';
import type { DistillationProposal, TargetDocument, InsertMode } from './dist01-proposal-types';
import type { DistillationStoreData, DistilledSignal, PromotionStatus } from './dist01-types';
import { LocalDeviceTimeService } from '@/lib/core/time';

// ─── Write Result ─────────────────────────────────────────────────────────

export interface ProposalWriteResult {
  success: boolean;
  /** Updated backpack (if modified) */
  updatedBackpack: Backpack | null;
  /** Which field was written */
  writtenField: string;
  /** The text that was actually written */
  writtenText: string;
  /** Error message if failed */
  error?: string;
}

export interface AutoSaveResult {
  /** Number of signals auto-saved this turn */
  autoSavedCount: number;
  /** Updated backpack (if modified) */
  updatedBackpack: Backpack | null;
  /** Updated distillation store (with promotionStatus changes) */
  updatedStore: DistillationStoreData;
  /** IDs of auto-saved signals */
  autoSavedSignalIds: string[];
}

// ─── Zone Mapping ─────────────────────────────────────────────────────────

/** Map generic zone references in signals to VSP zone keys */
type VspZoneKey = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

function inferVspZone(proposal: DistillationProposal): VspZoneKey {
  // Use clinical meaning to infer zone
  const meaning = proposal.clinicalMeaning;
  if (meaning === 'relapse_warning' || meaning === 'avoidance_pattern') return 'red';
  if (meaning === 'early_signal' || meaning === 'shame_pattern') return 'orange';
  if (meaning === 'craving_trigger') return 'yellow';
  if (meaning === 'protective_action' || meaning === 'recovery_value') return 'green';
  return 'yellow'; // default
}

/** Map generic zone references to Eigen Regie zone keys */
function inferEigenRegieZone(proposal: DistillationProposal): EigenRegieZoneId {
  const meaning = proposal.clinicalMeaning;
  if (meaning === 'loss_of_self_direction' || meaning === 'emotional_overload') return 'rood';
  if (meaning === 'boundary_fatigue' || meaning === 'over_responsibility') return 'oranje';
  if (meaning === 'guilt_pattern' || meaning === 'control_pattern') return 'geel';
  if (meaning === 'protective_action' || meaning === 'healthy_boundary') return 'lichtgroen';
  if (meaning === 'autonomy_anchor' || meaning === 'support_source') return 'donkergroen';
  return 'geel'; // default
}

// ─── Backpack Section Mapping ─────────────────────────────────────────────

/** Map targetField to LifePhaseId for Elias backpack */
function mapToLifePhaseId(targetField: string): LifePhaseId | null {
  const mapping: Record<string, LifePhaseId> = {
    levensverhaal: 'adulthood',
    relaties: 'family',
    steunpilaren: 'themes',
    kindertijd: 'childhood',
    adolescentie: 'adolescence',
  };
  return mapping[targetField] ?? null;
}

// ─── Text Formatting ──────────────────────────────────────────────────────

function formatAppendText(existing: string, newText: string, insertMode: InsertMode): string {
  if (!existing.trim()) return newText;
  switch (insertMode) {
    case 'append':
      return `${existing.trimEnd()}\n${newText}`;
    case 'add_note':
      return `${existing.trimEnd()}\n\n📝 ${newText}`;
    case 'add_nuance':
      return `${existing.trimEnd()}\n— ${newText}`;
    default:
      return `${existing.trimEnd()}\n${newText}`;
  }
}

function formatAppendToList(existing: string[], newText: string): string[] {
  // Avoid duplicates (case-insensitive)
  if (existing.some((item) => item.toLowerCase() === newText.toLowerCase())) {
    return existing;
  }
  return [...existing, newText];
}

// ─── Main Writer ──────────────────────────────────────────────────────────

/**
 * Write a single accepted/edited proposal to its target document.
 * Returns the updated backpack (caller must persist).
 */
export function writeProposalToDocument(
  proposal: DistillationProposal,
  backpack: Backpack,
): ProposalWriteResult {
  const textToWrite = proposal.editedText ?? proposal.proposedUserFacingText;
  const now = LocalDeviceTimeService.now().utcIso;

  try {
    const target = proposal.targetDocument;
    let updatedBackpack = { ...backpack };

    switch (target) {
      // ── Elias: VSP Trigger ──────────────────────────────────────
      case 'vsp_trigger': {
        const vsp = updatedBackpack.vspSection ?? createEmptyVsp();
        const newTrigger: VspTrigger = { trigger: textToWrite, counterThought: '' };
        // Avoid duplicate triggers
        if (!vsp.triggers.some((t) => t.trigger.toLowerCase() === textToWrite.toLowerCase())) {
          vsp.triggers = [...vsp.triggers, newTrigger];
        }
        vsp.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, vspSection: vsp };
        return { success: true, updatedBackpack, writtenField: 'triggers', writtenText: textToWrite };
      }

      // ── Elias: VSP Zone ─────────────────────────────────────────
      case 'vsp_zone': {
        const vsp = updatedBackpack.vspSection ?? createEmptyVsp();
        const zone = inferVspZone(proposal);
        const field = proposal.targetField as 'signals' | 'whatHelps' | 'anchorSentence';
        if (field === 'signals' || field === 'whatHelps') {
          vsp.zones[zone][field] = formatAppendText(vsp.zones[zone][field], textToWrite, proposal.insertMode);
        } else if (field === 'anchorSentence') {
          vsp.zones[zone].anchorSentence = textToWrite;
        }
        vsp.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, vspSection: vsp };
        return { success: true, updatedBackpack, writtenField: `vsp.zones.${zone}.${field}`, writtenText: textToWrite };
      }

      // ── Elias: VSP Recovery Rule ────────────────────────────────
      case 'vsp_recovery_rule': {
        const vsp = updatedBackpack.vspSection ?? createEmptyVsp();
        vsp.recoveryRules = formatAppendToList(vsp.recoveryRules, textToWrite);
        vsp.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, vspSection: vsp };
        return { success: true, updatedBackpack, writtenField: 'recoveryRules', writtenText: textToWrite };
      }

      // ── Elias: VSP Anchor Sentence ──────────────────────────────
      case 'vsp_anchor_sentence': {
        const vsp = updatedBackpack.vspSection ?? createEmptyVsp();
        vsp.mainAnchorSentence = textToWrite;
        vsp.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, vspSection: vsp };
        return { success: true, updatedBackpack, writtenField: 'mainAnchorSentence', writtenText: textToWrite };
      }

      // ── Elias: Backpack (narrative sections) ────────────────────
      case 'backpack': {
        const sectionId = mapToLifePhaseId(proposal.targetField);
        if (sectionId) {
          updatedBackpack = {
            ...updatedBackpack,
            sections: updatedBackpack.sections.map((s) =>
              s.id === sectionId
                ? { ...s, content: formatAppendText(s.content, textToWrite, proposal.insertMode), lastUpdated: now }
                : s
            ),
          };
          return { success: true, updatedBackpack, writtenField: `backpack.${sectionId}`, writtenText: textToWrite };
        }
        return { success: false, updatedBackpack: null, writtenField: proposal.targetField, writtenText: textToWrite, error: `Unknown backpack section: ${proposal.targetField}` };
      }

      // ── Kim: Eigen Regie Trigger ────────────────────────────────
      case 'eigen_regie_trigger': {
        const plan = updatedBackpack.eigenRegiePlan ?? null;
        if (!plan) {
          return { success: false, updatedBackpack: null, writtenField: 'triggers', writtenText: textToWrite, error: 'No Eigen Regie Plan exists yet' };
        }
        const newTrigger: EigenRegieTrigger = { trigger: textToWrite, lossOfRegiePattern: '', healthyResponse: '' };
        if (!plan.triggers.some((t) => t.trigger.toLowerCase() === textToWrite.toLowerCase())) {
          plan.triggers = [...plan.triggers, newTrigger];
        }
        plan.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, eigenRegiePlan: { ...plan } };
        return { success: true, updatedBackpack, writtenField: 'eigen_regie.triggers', writtenText: textToWrite };
      }

      // ── Kim: Eigen Regie Zone ───────────────────────────────────
      case 'eigen_regie_zone': {
        const plan = updatedBackpack.eigenRegiePlan ?? null;
        if (!plan) {
          return { success: false, updatedBackpack: null, writtenField: 'zone', writtenText: textToWrite, error: 'No Eigen Regie Plan exists yet' };
        }
        const zone = inferEigenRegieZone(proposal);
        const field = proposal.targetField as keyof typeof plan.zones[typeof zone];
        const zoneEntry = plan.zones[zone];
        // Handle array fields (signals, bodySignals, thoughts, behaviour, whatHelps, boundaryActions)
        const arrayFields = ['signals', 'bodySignals', 'thoughts', 'behaviour', 'whatHelps', 'boundaryActions'];
        if (arrayFields.includes(field as string)) {
          const arr = (zoneEntry as any)[field] as string[];
          (zoneEntry as any)[field] = formatAppendToList(arr, textToWrite);
        } else if (field === 'anchorSentence' || field === 'contactRule' || field === 'userMeaning') {
          (zoneEntry as any)[field] = textToWrite;
        }
        plan.zones[zone] = zoneEntry;
        plan.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, eigenRegiePlan: { ...plan } };
        return { success: true, updatedBackpack, writtenField: `eigen_regie.zones.${zone}.${field}`, writtenText: textToWrite };
      }

      // ── Kim: Eigen Regie Boundary Rule ──────────────────────────
      case 'eigen_regie_boundary_rule': {
        const plan = updatedBackpack.eigenRegiePlan ?? null;
        if (!plan) {
          return { success: false, updatedBackpack: null, writtenField: 'boundaryRules', writtenText: textToWrite, error: 'No Eigen Regie Plan exists yet' };
        }
        plan.boundaryRules = formatAppendToList(plan.boundaryRules, textToWrite);
        plan.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, eigenRegiePlan: { ...plan } };
        return { success: true, updatedBackpack, writtenField: 'eigen_regie.boundaryRules', writtenText: textToWrite };
      }

      // ── Kim: Eigen Regie Anchor Sentence ────────────────────────
      case 'eigen_regie_anchor_sentence': {
        const plan = updatedBackpack.eigenRegiePlan ?? null;
        if (!plan) {
          return { success: false, updatedBackpack: null, writtenField: 'mainAnchorSentence', writtenText: textToWrite, error: 'No Eigen Regie Plan exists yet' };
        }
        plan.mainAnchorSentence = textToWrite;
        plan.lastUpdated = now;
        updatedBackpack = { ...updatedBackpack, eigenRegiePlan: { ...plan } };
        return { success: true, updatedBackpack, writtenField: 'eigen_regie.mainAnchorSentence', writtenText: textToWrite };
      }

      // ── Kim: Kim Backpack ───────────────────────────────────────
      case 'kimBackpack': {
        const kimBp = updatedBackpack.kimBackpack ?? {
          my_story: '', the_relationship: '', the_impact: '', my_boundaries: '', my_strength: '',
        };
        const field = proposal.targetField as keyof typeof kimBp;
        if (field in kimBp) {
          kimBp[field] = formatAppendText(kimBp[field], textToWrite, proposal.insertMode);
        }
        updatedBackpack = { ...updatedBackpack, kimBackpack: kimBp };
        return { success: true, updatedBackpack, writtenField: `kimBackpack.${field}`, writtenText: textToWrite };
      }

      default:
        return { success: false, updatedBackpack: null, writtenField: target, writtenText: textToWrite, error: `Unknown target document: ${target}` };
    }
  } catch (err) {
    return { success: false, updatedBackpack: null, writtenField: proposal.targetField, writtenText: textToWrite, error: String(err) };
  }
}

// ─── Auto-Save Logic ──────────────────────────────────────────────────────

/**
 * Process auto-save for eligible signals.
 * Signals become eligible when: detectionCount >= 3 AND across 2+ sessions/days.
 * Auto-save writes directly without user confirmation (but can be undone later).
 *
 * Returns updated backpack and store.
 */
export function processAutoSave(
  backpack: Backpack,
  store: DistillationStoreData,
  routingRules: Array<{ signalType: string; targetDocument: TargetDocument; targetField: string; clinicalMeaning: string; insertMode: InsertMode }>,
  maxAutoSavePerTurn: number = 2,
): AutoSaveResult {
  const eligibleSignals = store.signals.filter(
    (s) => s.eligibleForAutoSave && s.promotionStatus === 'in_store' && !s.suppressedByUser && !s.contradictionFlag
  );

  if (eligibleSignals.length === 0) {
    return { autoSavedCount: 0, updatedBackpack: null, updatedStore: store, autoSavedSignalIds: [] };
  }

  let currentBackpack = { ...backpack };
  const autoSavedIds: string[] = [];
  const now = LocalDeviceTimeService.now().utcIso;

  // Process up to maxAutoSavePerTurn signals
  for (const signal of eligibleSignals.slice(0, maxAutoSavePerTurn)) {
    // Find routing rule for this signal
    const rule = routingRules.find((r) => r.signalType === signal.signalType);
    if (!rule) continue;

    // Build a minimal proposal-like object for the writer
    const pseudoProposal: DistillationProposal = {
      id: `auto_${signal.id}`,
      persona: store.persona as any,
      source: signal.sourceTypes[0] ?? 'chat',
      status: 'accepted',
      confidence: signal.confidence,
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      rawUserTextExcerpt: signal.rawUserTextExcerpts[0] ?? '',
      proposedUserFacingText: signal.normalizedText,
      editedText: null,
      targetDocument: rule.targetDocument,
      targetField: rule.targetField,
      insertMode: rule.insertMode as InsertMode,
      engineReason: signal.signalType,
      clinicalMeaning: rule.clinicalMeaning as any,
      safetyLevel: 'none',
      requiresExplicitConfirmation: false,
      autoSaveAllowed: true,
      userCanEdit: true,
      repeatedDetection: {
        normalizedPatternKey: signal.normalizedPatternKey,
        detectionCount: signal.detectionCount,
        firstDetectedAt: signal.firstDetectedAt,
        lastDetectedAt: signal.lastDetectedAt,
        detectedAcrossSessionIds: signal.detectedAcrossSessionIds,
        detectedAcrossLocalDayKeys: signal.detectedAcrossLocalDayKeys,
        sourceTypes: signal.sourceTypes,
        eligibleForAutoSave: true,
        autoSavedAt: now,
        userReviewedAt: null,
      },
      signalId: signal.id,
    };

    const result = writeProposalToDocument(pseudoProposal, currentBackpack);
    if (result.success && result.updatedBackpack) {
      currentBackpack = result.updatedBackpack;
      autoSavedIds.push(signal.id);
    }
  }

  // Update promotionStatus for auto-saved signals
  const updatedSignals = store.signals.map((s) => {
    if (autoSavedIds.includes(s.id)) {
      return { ...s, promotionStatus: 'auto_saved' as PromotionStatus };
    }
    return s;
  });

  const updatedStore: DistillationStoreData = {
    ...store,
    signals: updatedSignals,
    lastUpdatedAt: now,
  };

  return {
    autoSavedCount: autoSavedIds.length,
    updatedBackpack: autoSavedIds.length > 0 ? currentBackpack : null,
    updatedStore,
    autoSavedSignalIds: autoSavedIds,
  };
}

// ─── Promotion Status Updater ─────────────────────────────────────────────

/**
 * Update a signal's promotionStatus in the store after a proposal action.
 */
export function updateSignalPromotionStatus(
  store: DistillationStoreData,
  signalId: string,
  newStatus: PromotionStatus,
): DistillationStoreData {
  return {
    ...store,
    signals: store.signals.map((s) =>
      s.id === signalId ? { ...s, promotionStatus: newStatus } : s
    ),
    lastUpdatedAt: new Date().toISOString(),
  };
}

// ─── Helper: Empty VSP ───────────────────────────────────────────────────

function createEmptyVsp(): VspStructuredPlan {
  return {
    zones: {
      green: { signals: '', whatHelps: '', anchorSentence: '' },
      yellow: { signals: '', whatHelps: '', anchorSentence: '' },
      orange: { signals: '', whatHelps: '', anchorSentence: '' },
      red: { signals: '', whatHelps: '', anchorSentence: '' },
      purple: { signals: '', whatHelps: '', anchorSentence: '' },
    },
    triggers: [],
    recoveryRules: [],
    mainAnchorSentence: '',
    lastUpdated: null,
  };
}
