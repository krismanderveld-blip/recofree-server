/**
 * Clinical Memory Distillation — Contract Helpers
 *
 * FASE 8B: Pure helper functions. No runtime integration.
 * No pipeline, no prompt, no server, no memory storage changes.
 * No AsyncStorage. No side effects.
 */
import type {
  ClinicalMemoryPersona,
  ClinicalMemorySourceLayer,
  ClinicalMemoryDataClass,
  ClinicalMemoryUsePermission,
  ClinicalDistillationContext,
  FormulationMemoryInput,
  MemoryFact,
  MemoryHypothesis,
  ProjectionMarker,
  KimMemoryBridge,
  EliasMemoryBridge,
} from './clinical-memory-distillation-types';

// ─── Valid Enums (for validation) ──────────────────────────────────────────
const VALID_PERSONAS: ClinicalMemoryPersona[] = ['elias', 'kim'];

const VALID_SOURCE_LAYERS: ClinicalMemorySourceLayer[] = [
  'backpack', 'vsp', 'eigen_regie_plan', 'user_dat', 'state_dat',
  'context_dat', 'logs_dat', 'projections_dat', 'buffer', 'distillation_dat',
  'module_memory', 'extracted_entities', 'progress_tracker', 'check_in_history',
  'day_structure', 'sobriety', 'relapse_plan', 'diary', 'greeting_summary',
  'formulation_context', 'unknown',
];

const VALID_DATA_CLASSES: ClinicalMemoryDataClass[] = [
  'raw_user_data', 'user_authored_anchor', 'engine_derived_signal',
  'temporary_session_state', 'clinical_distillation', 'ui_progress_data',
  'safety_relevant_data', 'module_routing_data', 'formulation_input_ready',
  'needs_distillation', 'should_not_go_to_gpt', 'user_initiated_only',
  'legacy_server_risk', 'hypothesis_not_fact', 'persona_separated',
  'persona_leakage_risk', 'local_only', 'server_sent', 'gpt_sent',
];

// ─── 1. createEmptyClinicalDistillationContext ─────────────────────────────
export function createEmptyClinicalDistillationContext(
  persona: ClinicalMemoryPersona,
): ClinicalDistillationContext {
  const now = new Date().toISOString();
  const emptyInput: FormulationMemoryInput = {
    persona,
    memoryFacts: [],
    memoryHypotheses: [],
    recurrentPatterns: [],
    recoveryChains: [],
    relationalPatterns: [],
    backpackAnchors: [],
    vspAnchors: [],
    erpAnchors: [],
    riskMarkers: [],
    protectiveFactors: [],
    projectionMarkers: [],
    bufferSignals: [],
    moduleUsageSignals: [],
    progressTrendSignals: [],
    dayStructureSignals: [],
    sobrietySignals: [],
    relapsePlanSignals: [],
    maxPromptTokens: 600,
  };
  return {
    schemaVersion: 'clinical_memory_distillation_v1',
    persona,
    sourceLayersUsed: [],
    dataClasses: [],
    formulationInput: emptyInput,
    shouldRefreshMidSession: false,
    createdAtLocal: now,
    updatedAtLocal: now,
    confidence: 'low',
  };
}

// ─── 2. validateClinicalDistillationContext ────────────────────────────────
export function validateClinicalDistillationContext(
  context: ClinicalDistillationContext,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // Schema version
  if (context.schemaVersion !== 'clinical_memory_distillation_v1') {
    errors.push('schemaVersion must be clinical_memory_distillation_v1');
  }

  // Persona
  if (!VALID_PERSONAS.includes(context.persona)) {
    errors.push(`persona must be one of: ${VALID_PERSONAS.join(', ')}`);
  }

  // Source layers
  for (const layer of context.sourceLayersUsed) {
    if (!VALID_SOURCE_LAYERS.includes(layer)) {
      errors.push(`invalid sourceLayer: ${layer}`);
    }
  }

  // Data classes
  for (const dc of context.dataClasses) {
    if (!VALID_DATA_CLASSES.includes(dc)) {
      errors.push(`invalid dataClass: ${dc}`);
    }
  }

  // FormulationInput
  if (!context.formulationInput) {
    errors.push('formulationInput is required');
  } else {
    const fi = context.formulationInput;

    // maxPromptTokens
    if (fi.maxPromptTokens <= 0 || fi.maxPromptTokens > 1200) {
      errors.push('maxPromptTokens must be > 0 and <= 1200');
    }

    // Cross-persona: RecoveryChain only Elias
    if (context.persona === 'kim' && fi.recoveryChains.length > 0) {
      errors.push('RecoveryChain not allowed in Kim context');
    }

    // Cross-persona: RelationalPattern only Kim
    if (context.persona === 'elias' && fi.relationalPatterns.length > 0) {
      errors.push('RelationalPattern not allowed in Elias context');
    }

    // Cross-persona: VSPAnchor only Elias
    if (context.persona === 'kim' && fi.vspAnchors.length > 0) {
      errors.push('VSPAnchor not allowed in Kim context');
    }

    // Cross-persona: ERPAnchor only Kim
    if (context.persona === 'elias' && fi.erpAnchors.length > 0) {
      errors.push('ERPAnchor not allowed in Elias context');
    }

    // Cross-persona: SobrietySignal only Elias
    if (context.persona === 'kim' && fi.sobrietySignals.length > 0) {
      errors.push('SobrietySignal not allowed in Kim context');
    }

    // Cross-persona: RelapsePlanSignal only Elias
    if (context.persona === 'kim' && fi.relapsePlanSignals.length > 0) {
      errors.push('RelapsePlanSignal not allowed in Kim context');
    }

    // ProjectionMarker cannot be MemoryFact
    for (const pm of fi.projectionMarkers) {
      if (fi.memoryFacts.some(f => f.id === pm.id)) {
        errors.push(`ProjectionMarker ${pm.id} cannot also be a MemoryFact`);
      }
    }

    // MemoryHypothesis cannot be confirmed_by_user
    for (const h of fi.memoryHypotheses) {
      if (h.certainty === 'confirmed_by_user') {
        errors.push(`MemoryHypothesis ${h.id} cannot have certainty confirmed_by_user`);
      }
    }

    // BufferSignal constraints
    for (const bs of fi.bufferSignals) {
      if (bs.sessionOnly !== true) {
        errors.push(`BufferSignal ${bs.id} sessionOnly must be true`);
      }
      if (bs.shouldPersistRaw !== false) {
        errors.push(`BufferSignal ${bs.id} shouldPersistRaw must be false`);
      }
    }

    // should_not_go_to_gpt items must not be in prompt-eligible arrays
    for (const fact of fi.memoryFacts) {
      if (fact.usePermissions.includes('may_not_use_in_gpt') &&
          (fact.usePermissions.includes('may_use_in_prompt') || fact.usePermissions.includes('may_use_in_formulation'))) {
        errors.push(`MemoryFact ${fact.id} has may_not_use_in_gpt but also prompt-eligible permission`);
      }
    }

    // usePermissions must exist on all items that have them
    for (const fact of fi.memoryFacts) {
      if (!Array.isArray(fact.usePermissions)) {
        errors.push(`MemoryFact ${fact.id} missing usePermissions`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── 3. isProjectionSafeForFormulation ─────────────────────────────────────
export function isProjectionSafeForFormulation(marker: ProjectionMarker): boolean {
  return (
    marker.sourceLayer === 'projections_dat' &&
    (marker.certainty === 'projection' || marker.certainty === 'hypothesis') &&
    typeof marker.userConfirmed === 'boolean' &&
    marker.usePermissions.includes('may_use_only_as_hypothesis') &&
    marker.usePermissions.includes('may_not_use_as_fact')
  );
}

// ─── 4. isMemoryFactPromptEligible ────────────────────────────────────────
export function isMemoryFactPromptEligible(fact: MemoryFact): boolean {
  const hasPromptPermission =
    fact.usePermissions.includes('may_use_in_prompt') ||
    fact.usePermissions.includes('may_use_in_formulation');
  const notBlocked = !fact.usePermissions.includes('may_not_use_in_gpt');
  const highCertainty =
    fact.certainty === 'confirmed_by_user' ||
    fact.certainty === 'high_confidence_inference';
  const hasEvidence = fact.evidence.length > 0;
  return hasPromptPermission && notBlocked && highCertainty && hasEvidence;
}

// ─── 5. isHypothesisPromptEligible ────────────────────────────────────────
export function isHypothesisPromptEligible(hypothesis: MemoryHypothesis): boolean {
  const hasHypothesisPermission = hypothesis.usePermissions.includes('may_use_only_as_hypothesis');
  const notDirectPrompt =
    !hypothesis.usePermissions.includes('may_use_in_prompt') ||
    hypothesis.usePermissions.includes('may_use_only_as_hypothesis');
  const hasConfirmationFlag = typeof hypothesis.needsUserConfirmation === 'boolean';
  const validCertainty =
    hypothesis.certainty === 'hypothesis' ||
    hypothesis.certainty === 'projection' ||
    hypothesis.certainty === 'low_confidence_inference' ||
    hypothesis.certainty === 'medium_confidence_inference';
  return hasHypothesisPermission && notDirectPrompt && hasConfirmationFlag && validCertainty;
}

// ─── 6. getClinicalDistillationPromptBudget ───────────────────────────────
export function getClinicalDistillationPromptBudget(context: ClinicalDistillationContext): number {
  const budget = context.formulationInput?.maxPromptTokens ?? 600;
  if (budget <= 0) return 600;
  if (budget > 1200) return 1200;
  return budget;
}

// ─── 7. getKimFormulationMemoryBridge ─────────────────────────────────────
export function getKimFormulationMemoryBridge(context: ClinicalDistillationContext): KimMemoryBridge | null {
  if (context.persona !== 'kim') return null;
  const fi = context.formulationInput;
  return {
    persona: 'kim',
    relationalPatterns: fi.relationalPatterns,
    erpAnchors: fi.erpAnchors,
    backpackAnchors: fi.backpackAnchors,
    riskMarkers: fi.riskMarkers,
    protectiveFactors: fi.protectiveFactors,
    projectionMarkers: fi.projectionMarkers,
    formulationReadyFacts: fi.memoryFacts.filter(f => isMemoryFactPromptEligible(f)),
    formulationReadyHypotheses: fi.memoryHypotheses.filter(h => isHypothesisPromptEligible(h)),
  };
}

// ─── 8. getEliasFormulationMemoryBridge ───────────────────────────────────
export function getEliasFormulationMemoryBridge(context: ClinicalDistillationContext): EliasMemoryBridge | null {
  if (context.persona !== 'elias') return null;
  const fi = context.formulationInput;
  return {
    persona: 'elias',
    recoveryChains: fi.recoveryChains,
    vspAnchors: fi.vspAnchors,
    sobrietySignals: fi.sobrietySignals,
    relapsePlanSignals: fi.relapsePlanSignals,
    riskMarkers: fi.riskMarkers,
    protectiveFactors: fi.protectiveFactors,
    projectionMarkers: fi.projectionMarkers,
    formulationReadyFacts: fi.memoryFacts.filter(f => isMemoryFactPromptEligible(f)),
    formulationReadyHypotheses: fi.memoryHypotheses.filter(h => isHypothesisPromptEligible(h)),
  };
}

// ─── 9. classifyMemoryLayerForCMD ─────────────────────────────────────────
export function classifyMemoryLayerForCMD(layer: ClinicalMemorySourceLayer): ClinicalMemoryDataClass[] {
  switch (layer) {
    case 'projections_dat':
      return ['hypothesis_not_fact', 'engine_derived_signal', 'persona_separated'];
    case 'buffer':
      return ['temporary_session_state', 'local_only', 'persona_separated'];
    case 'backpack':
      return ['raw_user_data', 'user_authored_anchor', 'needs_distillation'];
    case 'distillation_dat':
      return ['clinical_distillation', 'engine_derived_signal', 'gpt_sent'];
    case 'day_structure':
      return ['ui_progress_data', 'needs_distillation'];
    case 'extracted_entities':
      return ['engine_derived_signal', 'persona_leakage_risk'];
    case 'logs_dat':
      return ['clinical_distillation', 'persona_separated', 'local_only'];
    case 'user_dat':
      return ['engine_derived_signal', 'formulation_input_ready', 'persona_separated'];
    case 'state_dat':
      return ['engine_derived_signal', 'safety_relevant_data', 'persona_separated'];
    case 'vsp':
      return ['user_authored_anchor', 'formulation_input_ready', 'persona_separated'];
    case 'eigen_regie_plan':
      return ['user_authored_anchor', 'formulation_input_ready', 'persona_separated'];
    case 'context_dat':
      return ['clinical_distillation', 'gpt_sent', 'persona_separated'];
    case 'module_memory':
      return ['module_routing_data', 'local_only', 'persona_separated'];
    case 'diary':
      return ['raw_user_data', 'user_authored_anchor', 'persona_leakage_risk'];
    case 'sobriety':
      return ['safety_relevant_data', 'local_only', 'persona_separated'];
    case 'relapse_plan':
      return ['safety_relevant_data', 'formulation_input_ready', 'persona_separated'];
    case 'greeting_summary':
      return ['clinical_distillation', 'gpt_sent'];
    case 'formulation_context':
      return ['formulation_input_ready', 'gpt_sent', 'persona_separated'];
    case 'progress_tracker':
      return ['ui_progress_data', 'needs_distillation'];
    case 'check_in_history':
      return ['engine_derived_signal', 'safety_relevant_data'];
    default:
      return ['needs_distillation'];
  }
}

// ─── 10. getAllowedUsePermissionsForSource ─────────────────────────────────
export function getAllowedUsePermissionsForSource(layer: ClinicalMemorySourceLayer): ClinicalMemoryUsePermission[] {
  switch (layer) {
    case 'buffer':
      return ['may_use_in_formulation', 'may_use_for_safety', 'may_not_use_in_gpt'];
    case 'projections_dat':
      return ['may_use_only_as_hypothesis', 'may_not_use_as_fact'];
    case 'backpack':
      return ['may_use_in_formulation', 'may_use_in_prompt', 'may_use_for_greeting'];
    case 'day_structure':
      return ['may_use_in_formulation', 'may_use_only_if_recent'];
    case 'logs_dat':
      return ['may_use_in_formulation', 'may_use_for_greeting', 'may_use_only_if_recent'];
    case 'user_dat':
      return ['may_use_in_formulation', 'may_use_in_prompt', 'may_use_for_routing', 'may_use_for_safety'];
    case 'state_dat':
      return ['may_use_in_formulation', 'may_use_in_prompt', 'may_use_for_routing', 'may_use_for_safety'];
    case 'vsp':
      return ['may_use_in_formulation', 'may_use_in_prompt', 'may_use_for_safety'];
    case 'eigen_regie_plan':
      return ['may_use_in_formulation', 'may_use_in_prompt'];
    case 'distillation_dat':
      return ['may_use_in_formulation', 'may_use_in_prompt', 'may_use_for_greeting'];
    case 'extracted_entities':
      return ['may_use_in_formulation', 'may_use_in_prompt'];
    case 'sobriety':
      return ['may_use_in_formulation', 'may_use_for_greeting', 'may_use_for_safety'];
    case 'relapse_plan':
      return ['may_use_in_formulation', 'may_use_for_safety'];
    case 'diary':
      return ['may_use_in_formulation', 'may_use_only_if_recent'];
    default:
      return ['unknown'];
  }
}
