/**
 * Elias Recovery Formulation Engine — Contract
 * Pure helper functions. No runtime integration. No server calls. No memory writes.
 * No Kim imports. No pipeline imports. No nano imports.
 */

import type {
  EliasFormulationMode,
  EliasRecoverySeverity,
  EliasRecoveryDomain,
  EliasFormulationLayerId,
  EliasRecoveryFormulationContext,
} from './elias-recovery-formulation-types';

// ── Valid values for validation ──

const VALID_MODES: EliasFormulationMode[] = ['off', 'low', 'medium', 'high', 'safety_blocked', 'insufficient_context', 'acute_recovery_risk'];

const VALID_SEVERITIES: EliasRecoverySeverity[] = ['stable_reflection', 'early_signal', 'active_craving', 'relapse_risk', 'post_relapse', 'escalating_risk', 'acute_safety', 'unknown'];

const VALID_DOMAINS: EliasRecoveryDomain[] = ['craving', 'relapse_prevention', 'post_relapse_repair', 'shame', 'guilt', 'self_hatred', 'avoidance', 'emotional_overload', 'control_loss', 'loneliness', 'boredom', 'grief', 'abandonment_fear', 'relationship_trigger', 'honesty', 'responsibility', 'agency', 'motivation', 'stage_of_change', 'self_compassion', 'body_state', 'sleep', 'support_activation', 'safety', 'unknown'];

const VALID_LAYERS: EliasFormulationLayerId[] = ['facts', 'recovery_severity', 'trigger_chain', 'craving_function', 'emotional_state', 'avoidance_loop', 'shame_loop', 'responsibility_map', 'agency_map', 'stage_of_change', 'support_plan', 'relapse_prevention_step', 'post_relapse_repair', 'body_state', 'time_dynamics', 'core_hypothesis', 'safety_limits'];

// ── Forbidden patterns ──

const FORBIDDEN_PATTERNS = [
  /je kan gewoon stoppen/i,
  /stop gewoon ineens/i,
  /cold turkey is ok/i,
  /drink maar/i,
  /gebruik maar/i,
  /één keer kan geen kwaad/i,
  /je hebt toch al gefaald/i,
  /je bent zwak/i,
  /je bent hopeloos/i,
  /je verdient dit/i,
  /je moet dit alleen kunnen/i,
  /niemand kan je helpen/i,
  /je hoeft het aan niemand te zeggen/i,
  /verstop het/i,
  /lieg erover/i,
  /schaamte bewijst dat je slecht bent/i,
  /terugval betekent dat herstel mislukt is/i,
  /je bent je verslaving/i,
  /je bent alleen je terugval/i,
];

// ── Kim contamination patterns ──

const KIM_CONTAMINATION_PATTERNS = [
  /caregiver/i,
  /dependent_person/i,
  /partnerherstel/i,
  /kindvertrouwen/i,
  /grenzen van naaste/i,
  /herstelvoorwaarden voor de ander/i,
];

// ── 1. createEmptyEliasRecoveryFormulationContext ──

export function createEmptyEliasRecoveryFormulationContext(): EliasRecoveryFormulationContext {
  return {
    schemaVersion: 'elias_recovery_formulation_v1',
    persona: 'elias',
    mode: 'off',
    severity: 'unknown',
    activeDomains: [],
    activeLayers: [],
    facts: [],
    triggerChain: [],
    cravingFunctions: [],
    emotionalStates: [],
    avoidanceLoops: [],
    shameLoops: [],
    responsibilityMap: [],
    agencyMap: [],
    stageOfChange: null,
    supportPlan: [],
    relapsePreventionSteps: [],
    postRelapseRepair: [],
    bodyStateSignals: [],
    timeDynamics: [],
    coreHypothesis: null,
    safetyLimits: [],
    mustMention: [],
    mustAvoid: [],
    maxQuestions: 1,
    endingStyle: 'reflective',
    confidence: 'low',
    createdAtLocal: '',
  };
}

// ── 2. validateEliasRecoveryFormulationContext ──

export function validateEliasRecoveryFormulationContext(context: EliasRecoveryFormulationContext): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // Schema version
  if (context.schemaVersion !== 'elias_recovery_formulation_v1') {
    errors.push('schemaVersion must be elias_recovery_formulation_v1');
  }

  // Persona
  if (context.persona !== 'elias') {
    errors.push('persona must be elias');
  }

  // Mode
  if (!VALID_MODES.includes(context.mode)) {
    errors.push(`invalid mode: ${context.mode}`);
  }

  // Severity
  if (!VALID_SEVERITIES.includes(context.severity)) {
    errors.push(`invalid severity: ${context.severity}`);
  }

  // Domains
  for (const d of context.activeDomains) {
    if (!VALID_DOMAINS.includes(d)) {
      errors.push(`invalid domain: ${d}`);
    }
  }

  // Layers
  for (const l of context.activeLayers) {
    if (!VALID_LAYERS.includes(l)) {
      errors.push(`invalid layer: ${l}`);
    }
  }

  // maxQuestions
  if (context.maxQuestions !== 0 && context.maxQuestions !== 1) {
    errors.push(`maxQuestions must be 0 or 1, got ${context.maxQuestions}`);
  }

  // Arrays exist
  if (!Array.isArray(context.facts)) errors.push('facts must be array');
  if (!Array.isArray(context.triggerChain)) errors.push('triggerChain must be array');
  if (!Array.isArray(context.cravingFunctions)) errors.push('cravingFunctions must be array');
  if (!Array.isArray(context.mustMention)) errors.push('mustMention must be array');
  if (!Array.isArray(context.mustAvoid)) errors.push('mustAvoid must be array');
  if (!Array.isArray(context.responsibilityMap)) errors.push('responsibilityMap must be array');
  if (!Array.isArray(context.agencyMap)) errors.push('agencyMap must be array');
  if (!Array.isArray(context.supportPlan)) errors.push('supportPlan must be array');
  if (!Array.isArray(context.relapsePreventionSteps)) errors.push('relapsePreventionSteps must be array');

  // Kim contamination check
  const textToCheck = [
    ...context.mustMention,
    context.coreHypothesis || '',
    ...context.mustAvoid,
  ].join(' ');
  for (const pattern of KIM_CONTAMINATION_PATTERNS) {
    if (pattern.test(textToCheck)) {
      errors.push(`Kim contamination detected: ${pattern.source}`);
    }
  }

  // Forbidden content check (unsafe addiction advice)
  const contentToCheck = [
    ...context.mustMention,
    context.coreHypothesis || '',
  ].join(' ');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(contentToCheck)) {
      errors.push(`forbidden content in mustMention/coreHypothesis: ${pattern.source}`);
    }
  }

  // Structural validation for sub-items
  for (const cf of context.cravingFunctions) {
    if (typeof cf.explanationNotExcuse !== 'boolean') {
      errors.push('cravingFunction.explanationNotExcuse must be boolean');
    }
  }
  for (const rm of context.responsibilityMap) {
    if (!rm.owner) {
      errors.push('responsibilityMap item requires owner');
    }
  }
  for (const am of context.agencyMap) {
    if (!am.timeWindow) {
      errors.push('agencyMap item requires timeWindow');
    }
  }
  if (context.stageOfChange) {
    if (!context.stageOfChange.stage || !context.stageOfChange.evidence || !context.stageOfChange.confidence) {
      errors.push('stageOfChange requires stage, evidence, and confidence');
    }
  }
  for (const sp of context.supportPlan) {
    if (!sp.target || !sp.urgency) {
      errors.push('supportPlan item requires target and urgency');
    }
  }
  for (const rp of context.relapsePreventionSteps) {
    if (!rp.purpose || !rp.urgency) {
      errors.push('relapsePreventionStep requires purpose and urgency');
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── 3. isEliasFormulationSafetyBlocked ──

export function isEliasFormulationSafetyBlocked(context: EliasRecoveryFormulationContext): boolean {
  return (
    context.mode === 'safety_blocked' &&
    context.severity === 'acute_safety' &&
    context.activeDomains.includes('safety')
  );
}

// ── 4. isEliasFormulationAcuteRecoveryRisk ──

export function isEliasFormulationAcuteRecoveryRisk(context: EliasRecoveryFormulationContext): boolean {
  return (
    context.mode === 'acute_recovery_risk' &&
    ['active_craving', 'relapse_risk', 'escalating_risk', 'post_relapse'].includes(context.severity) &&
    (context.activeDomains.includes('craving') || context.activeDomains.includes('relapse_prevention') || context.activeDomains.includes('safety'))
  );
}

// ── 5. getEliasFormulationDepthLevel ──

export function getEliasFormulationDepthLevel(context: EliasRecoveryFormulationContext): 'none' | 'low' | 'medium' | 'high' | 'safety' {
  switch (context.mode) {
    case 'off':
    case 'safety_blocked':
    case 'insufficient_context':
      return 'none';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'acute_recovery_risk':
      return 'safety';
    default:
      return 'none';
  }
}

// ── 6. getAllowedEliasFormulationLayers ──

export function getAllowedEliasFormulationLayers(mode: EliasFormulationMode, safetyActive?: boolean): EliasFormulationLayerId[] {
  switch (mode) {
    case 'off':
    case 'insufficient_context':
      return [];
    case 'safety_blocked':
      return ['safety_limits'];
    case 'acute_recovery_risk':
      return ['facts', 'recovery_severity', 'trigger_chain', 'craving_function', 'agency_map', 'support_plan', 'relapse_prevention_step', 'safety_limits'];
    case 'low':
      return ['facts', 'recovery_severity', 'emotional_state', 'responsibility_map', 'agency_map'];
    case 'medium':
      return ['facts', 'recovery_severity', 'trigger_chain', 'craving_function', 'emotional_state', 'avoidance_loop', 'shame_loop', 'responsibility_map', 'agency_map', 'stage_of_change', 'relapse_prevention_step', 'support_plan', 'time_dynamics'];
    case 'high': {
      const allLayers: EliasFormulationLayerId[] = ['facts', 'recovery_severity', 'trigger_chain', 'craving_function', 'emotional_state', 'avoidance_loop', 'shame_loop', 'responsibility_map', 'agency_map', 'stage_of_change', 'support_plan', 'relapse_prevention_step', 'post_relapse_repair', 'body_state', 'time_dynamics', 'core_hypothesis'];
      if (safetyActive) {
        allLayers.push('safety_limits');
      }
      return allLayers;
    }
    default:
      return [];
  }
}
