/**
 * Kim Relational Formulation Engine — Contract Helpers
 * Pure functions, no runtime integration, no side effects.
 */

import type {
  KimFormulationMode,
  KimRelationalSeverity,
  KimRelationalDomain,
  KimFormulationLayerId,
  KimRelationalFormulationContext,
} from './kim-relational-formulation-types';

// ── Valid value sets ──

const VALID_MODES: KimFormulationMode[] = [
  'off', 'low', 'medium', 'high', 'safety_blocked', 'insufficient_context',
];

const VALID_SEVERITIES: KimRelationalSeverity[] = [
  'single_event', 'repeated_pattern', 'chronic_pattern',
  'escalating_pattern', 'acute_safety', 'unknown',
];

const VALID_DOMAINS: KimRelationalDomain[] = [
  'trust', 'honesty', 'intimacy', 'affection', 'sexual_pressure',
  'addiction_recovery', 'relationship_repair', 'child_trust',
  'caregiving_load', 'boundary_pressure', 'self_loss', 'grief',
  'shame', 'anger', 'control', 'avoidance', 'communication',
  'safety', 'unknown',
];

const VALID_LAYERS: KimFormulationLayerId[] = [
  'facts', 'pattern_severity', 'caregiver_impact', 'dependent_hypotheses',
  'causal_chain', 'feedback_loop', 'behavior_functions', 'role_shift',
  'domain_separation', 'responsibility_map', 'counter_hypotheses',
  'time_dynamics', 'core_hypothesis', 'safety_limits', 'repair_conditions',
];

const FORBIDDEN_DECISION_PATTERNS: RegExp[] = [
  /je moet weggaan/i,
  /je moet blijven/i,
  /hij is narcistisch/i,
  /hij manipuleert je/i,
  /hij liegt dus hij houdt niet van je/i,
  /vergeef hem/i,
  /vertrouw hem opnieuw/i,
  /jij bent verantwoordelijk voor zijn herstel/i,
  /jij moet zijn gebruik stoppen/i,
  /kinderen moeten hem opnieuw vertrouwen/i,
  /seks hoort erbij/i,
  /je moet seks hebben/i,
  /als je van hem houdt dan/i,
];

// ── 1. createEmptyKimRelationalFormulationContext ──

export function createEmptyKimRelationalFormulationContext(): KimRelationalFormulationContext {
  return {
    schemaVersion: 'kim_relational_formulation_v1',
    persona: 'kim',
    mode: 'off',
    severity: 'unknown',
    activeDomains: [],
    activeLayers: [],
    facts: [],
    caregiverImpacts: [],
    dependentHypotheses: [],
    causalChains: [],
    feedbackLoops: [],
    behaviorFunctions: [],
    roleShifts: [],
    domainSeparations: [],
    responsibilityMap: [],
    counterHypotheses: [],
    timeDynamics: [],
    coreHypothesis: null,
    safetyLimits: [],
    repairConditions: [],
    mustMention: [],
    mustAvoid: [],
    maxQuestions: 1,
    endingStyle: 'reflective',
    confidence: 'low',
    createdAtLocal: new Date().toISOString(),
  };
}

// ── 2. validateKimRelationalFormulationContext ──

export function validateKimRelationalFormulationContext(
  context: unknown
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!context || typeof context !== 'object') {
    return { ok: false, errors: ['context must be a non-null object'] };
  }

  const ctx = context as Record<string, unknown>;

  // schemaVersion
  if (ctx.schemaVersion !== 'kim_relational_formulation_v1') {
    errors.push('schemaVersion must be exactly "kim_relational_formulation_v1"');
  }

  // persona
  if (ctx.persona !== 'kim') {
    errors.push('persona must be exactly "kim"');
  }

  // Elias contamination
  if (ctx.persona === 'elias') {
    errors.push('Elias contamination detected: persona cannot be "elias"');
  }

  // mode
  if (!VALID_MODES.includes(ctx.mode as KimFormulationMode)) {
    errors.push(`mode "${ctx.mode}" is not valid. Must be one of: ${VALID_MODES.join(', ')}`);
  }

  // severity
  if (!VALID_SEVERITIES.includes(ctx.severity as KimRelationalSeverity)) {
    errors.push(`severity "${ctx.severity}" is not valid. Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  // activeDomains
  if (!Array.isArray(ctx.activeDomains)) {
    errors.push('activeDomains must be an array');
  } else {
    for (const d of ctx.activeDomains as string[]) {
      if (!VALID_DOMAINS.includes(d as KimRelationalDomain)) {
        errors.push(`activeDomains contains invalid domain: "${d}"`);
      }
    }
  }

  // activeLayers
  if (!Array.isArray(ctx.activeLayers)) {
    errors.push('activeLayers must be an array');
  } else {
    for (const l of ctx.activeLayers as string[]) {
      if (!VALID_LAYERS.includes(l as KimFormulationLayerId)) {
        errors.push(`activeLayers contains invalid layer: "${l}"`);
      }
    }
  }

  // maxQuestions
  if (ctx.maxQuestions !== 0 && ctx.maxQuestions !== 1) {
    errors.push('maxQuestions must be 0 or 1');
  }

  // arrays exist
  const requiredArrays = [
    'facts', 'caregiverImpacts', 'dependentHypotheses', 'causalChains',
    'feedbackLoops', 'behaviorFunctions', 'roleShifts', 'domainSeparations',
    'responsibilityMap', 'counterHypotheses', 'timeDynamics', 'safetyLimits',
    'repairConditions', 'mustMention', 'mustAvoid',
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(ctx[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  // Forbidden decision/diagnostic language in mustMention
  if (Array.isArray(ctx.mustMention)) {
    for (const item of ctx.mustMention as string[]) {
      for (const pattern of FORBIDDEN_DECISION_PATTERNS) {
        if (pattern.test(item)) {
          errors.push(`mustMention contains forbidden language: "${item}"`);
        }
      }
    }
  }

  // Forbidden language in mustAvoid
  if (Array.isArray(ctx.mustAvoid)) {
    for (const item of ctx.mustAvoid as string[]) {
      for (const pattern of FORBIDDEN_DECISION_PATTERNS) {
        if (pattern.test(item)) {
          errors.push(`mustAvoid contains forbidden language: "${item}"`);
        }
      }
    }
  }

  // Forbidden language in coreHypothesis
  if (typeof ctx.coreHypothesis === 'string') {
    for (const pattern of FORBIDDEN_DECISION_PATTERNS) {
      if (pattern.test(ctx.coreHypothesis)) {
        errors.push(`coreHypothesis contains forbidden language: "${ctx.coreHypothesis}"`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── 3. isKimFormulationSafetyBlocked ──

export function isKimFormulationSafetyBlocked(
  context: KimRelationalFormulationContext
): boolean {
  return (
    context.mode === 'safety_blocked' ||
    context.severity === 'acute_safety' ||
    context.activeDomains.includes('safety')
  );
}

// ── 4. getKimFormulationDepthLevel ──

export function getKimFormulationDepthLevel(
  context: KimRelationalFormulationContext
): 'none' | 'low' | 'medium' | 'high' {
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
    default:
      return 'none';
  }
}

// ── 5. getAllowedKimFormulationLayers ──

export function getAllowedKimFormulationLayers(
  mode: KimFormulationMode,
  safetyActive: boolean = false
): KimFormulationLayerId[] {
  switch (mode) {
    case 'off':
    case 'insufficient_context':
      return [];
    case 'safety_blocked':
      return ['safety_limits'];
    case 'low':
      return ['facts', 'pattern_severity', 'caregiver_impact', 'responsibility_map'];
    case 'medium':
      return [
        'facts', 'pattern_severity', 'caregiver_impact', 'dependent_hypotheses',
        'causal_chain', 'feedback_loop', 'domain_separation', 'responsibility_map',
        'time_dynamics', 'repair_conditions',
      ];
    case 'high': {
      const allLayers: KimFormulationLayerId[] = [
        'facts', 'pattern_severity', 'caregiver_impact', 'dependent_hypotheses',
        'causal_chain', 'feedback_loop', 'behavior_functions', 'role_shift',
        'domain_separation', 'responsibility_map', 'counter_hypotheses',
        'time_dynamics', 'core_hypothesis', 'repair_conditions',
      ];
      if (safetyActive) {
        allLayers.push('safety_limits');
      }
      return allLayers;
    }
    default:
      return [];
  }
}
