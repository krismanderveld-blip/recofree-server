/**
 * Schema Mode Router — Intervention Routing + Prompt Builder
 * Based on RECOFREE_SCHEMA_MODE_ENGINE_CANON_V1 Sections 12, 13, 14, 15, 16
 *
 * This module:
 * 1. Routes mode/schema decisions to intervention instructions
 * 2. Builds compact prompt injection (need-first, non-diagnostic)
 * 3. Respects context budget (max 5 lines total)
 * 4. Applies safety hierarchy
 *
 * PROMPT BUILDER RULES (Section 15):
 * - Return empty string if no safe validated context
 * - Never exceed schema/mode budget
 * - Prefer need language over labels
 * - Avoid schema names when safety elevated
 * - Include one intervention direction
 * - Include one forbidden response style if relevant
 * - No raw backpack, no unvalidated evidence, no diagnostic phrasing
 */

import {
  ModeId,
  SchemaId,
  ModeDecision,
  SchemaDecision,
  ModeInterventionHint,
  SchemaModeDetectionInput,
  SchemaModeEngineResult,
} from './schema-mode-types';
import { detectModeCandidates, validateModes } from './mode-detector';
import { detectSchemaCandidates, validateSchemas } from './schema-detector';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Mode Intervention Routing (Section 12)
// ═══════════════════════════════════════════════════════════════════════════════

type InterventionRoute = {
  enable: string[];
  disable: string[];
  needStatement: string;
};

const MODE_INTERVENTIONS: Record<ModeId, InterventionRoute> = {
  VULNERABLE_CHILD: {
    enable: ['validation', 'slow response', 'grounding', 'attachment safety', 'self-compassion'],
    disable: ['harsh challenge', 'accountability-first', 'rational debate', 'behavior pressure'],
    needStatement: 'User may need safety, warmth, and non-intrusive presence.',
  },
  ANGRY_CHILD: {
    enable: ['validate protest', 'translate anger into need', 'pause action', 'boundary-safe expression'],
    disable: ['shame', 'side-taking', 'escalation', 'impulsive message encouragement'],
    needStatement: 'User may need to be heard, fairness, and safe expression.',
  },
  IMPULSIVE_CHILD: {
    enable: ['delay', 'urge surfing', 'friction', 'remove access', 'immediate alternative'],
    disable: ['long analysis', 'shame', 'abstract insight only'],
    needStatement: 'User may need containment, delay, and immediate alternative action.',
  },
  HAPPY_CHILD: {
    enable: ['support', 'consolidate'],
    disable: ['dampen positive state'],
    needStatement: 'User is in a positive state. Support without inflating.',
  },
  DETACHED_PROTECTOR: {
    enable: ['low-pressure naming', 'short answer', 'choice', 'grounding'],
    disable: ['forced vulnerability', 'accusation', 'long probing'],
    needStatement: 'User may need low-pressure safety and reconnection at tolerable intensity.',
  },
  AVOIDANT_PROTECTOR: {
    enable: ['micro-step', 'gentle naming', 'preserve choice'],
    disable: ['moral pressure', 'all-or-nothing plan'],
    needStatement: 'User may need a tolerable approach and agency.',
  },
  COMPLIANT_SURRENDERER: {
    enable: ['agency', 'boundary language', 'own preference', 'slow decision'],
    disable: ['praise obedience', 'assume agreement is readiness'],
    needStatement: 'User may need permission to disagree and set boundaries.',
  },
  OVERCOMPENSATOR: {
    enable: ['respectful challenge', 'protected need inquiry', 'values redirection'],
    disable: ['power struggle', 'humiliation', 'sarcasm'],
    needStatement: 'User may need dignity and shame reduction beneath the control.',
  },
  PUNITIVE_PARENT: {
    enable: ['externalize self-critical voice', 'interrupt self-punishment', 'self-compassion', 'safety scan'],
    disable: ['guilt', 'shame', 'agreement with attack', 'intense schema exploration during crisis'],
    needStatement: 'User may need protection from self-attack and compassion.',
  },
  DEMANDING_PARENT: {
    enable: ['realistic standards', 'minimum viable step', 'imperfection tolerance', 'pacing'],
    disable: ['pressure', 'no excuses tone', 'productivity as worth'],
    needStatement: 'User may need permission to be human and sustainable standards.',
  },
  HEALTHY_ADULT: {
    enable: ['collaborative planning', 'values check', 'boundaries', 'repair', 'agency consolidation'],
    disable: ['praise inflation', 'dependency-forming tone'],
    needStatement: 'User is showing agency. Support without replacing their Healthy Adult.',
  },
  CAREGIVER_SELF: {
    enable: ['support self-care', 'validate boundaries'],
    disable: ['add responsibility', 'guilt'],
    needStatement: 'User is caring for themselves. Consolidate this.',
  },
  BOUNDARY_SELF: {
    enable: ['affirm boundary', 'support limit-setting'],
    disable: ['undermine boundary', 'guilt'],
    needStatement: 'User is setting boundaries. Affirm and support.',
  },
  CRISIS_COLLAPSE: {
    enable: ['immediate safety', 'stabilization', 'grounding', 'one safe step'],
    disable: ['analysis', 'challenge', 'accountability', 'long-term planning'],
    needStatement: 'User may be in crisis. Prioritize safety and stabilization.',
  },
  RELAPSE_SEEKING: {
    enable: ['urge surfing', 'delay contract', 'remove access', 'relapse prevention', 'immediate alternative'],
    disable: ['shame', 'long analysis', 'abstract reflection only'],
    needStatement: 'User may be seeking relapse. Use containment and immediate alternatives.',
  },
  RELAPSE_JUSTIFYING: {
    enable: ['motivational interviewing', 'values discrepancy', 'explore ambivalence', 'autonomy support'],
    disable: ['moral lecture', 'shame', 'confrontation without capacity'],
    needStatement: 'User may be rationalizing use. Explore ambivalence without shaming.',
  },
  SHAME_SPIRAL: {
    enable: ['shame reduction', 'separate person from behavior', 'self-compassion', 'safety scan'],
    disable: ['accountability-first', 'moral pressure', 'labels'],
    needStatement: 'User may be in shame spiral. Reduce shame before any planning.',
  },
  RELATIONAL_PANIC: {
    enable: ['attachment stabilization', 'emotional containment', 'grounding', 'fact check if stable'],
    disable: ['premature CBT reframing', 'dismissal', 'forced independence'],
    needStatement: 'User may fear losing connection. Stabilize attachment first.',
  },
  RESCUE_MODE: {
    enable: ['separate care from responsibility', 'boundary support', 'reduce burden', 'support network'],
    disable: ['make user carry recovery', 'reinforce hypervigilance'],
    needStatement: 'User may be overresponsible. Support boundaries and relief.',
  },
  CONTROL_MODE: {
    enable: ['validate fear', 'separate checking from safety', 'controllable actions', 'Eigen Regie reset'],
    disable: ['surveillance', 'proof-seeking', 'promise control over relapse'],
    needStatement: 'User may be trying to control through monitoring. Validate fear, redirect to self.',
  },
  EXHAUSTED_CAREGIVER: {
    enable: ['validate exhaustion', 'reduce tasks', 'boundary support', 'external support'],
    disable: ['add responsibility', 'moral duty language'],
    needStatement: 'User may be depleted. Validate and reduce burden.',
  },
  MORAL_INJURY: {
    enable: ['repair', 'accountability without self-destruction', 'values reconnection', 'compassion'],
    disable: ['shame', 'punishment', 'dismissal of guilt'],
    needStatement: 'User may be in values pain. Support repair without self-destruction.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Schema Intervention Routing (Section 13)
// ═══════════════════════════════════════════════════════════════════════════════

type SchemaInterventionRoute = {
  intervention: string;
  forbidden: string;
};

const SCHEMA_INTERVENTIONS: Record<SchemaId, SchemaInterventionRoute> = {
  ABANDONMENT_INSTABILITY: {
    intervention: 'Validate attachment fear. Slow urgent action. Self-anchoring.',
    forbidden: 'Avoid false reassurance or dismissal of fear.',
  },
  MISTRUST_ABUSE: {
    intervention: 'Respect caution. Identify safe facts. Boundary support.',
    forbidden: 'Do not argue trust into existence.',
  },
  EMOTIONAL_DEPRIVATION: {
    intervention: 'Validate unmet need. Name care need. Encourage real support.',
    forbidden: 'Do not overpromise AI presence.',
  },
  DEFECTIVENESS_SHAME: {
    intervention: 'Reduce shame. Separate person from behavior. Self-compassion.',
    forbidden: 'Avoid labels. Safety scan if intense.',
  },
  SOCIAL_ISOLATION: {
    intervention: 'Validate isolation. Small connection step.',
    forbidden: 'Avoid forced exposure.',
  },
  DEPENDENCE_INCOMPETENCE: {
    intervention: 'Micro-agency. One doable step.',
    forbidden: 'Avoid rescuing.',
  },
  VULNERABILITY_TO_HARM: {
    intervention: 'Grounding. Concrete safety plan.',
    forbidden: 'Probability check only if stable.',
  },
  ENMESHMENT_UNDEVELOPED_SELF: {
    intervention: 'Self-definition. Boundaries. One autonomous choice.',
    forbidden: 'Avoid reinforcing enmeshment.',
  },
  FAILURE: {
    intervention: 'Process over outcome. Minimum viable step.',
    forbidden: 'Avoid success pressure.',
  },
  ENTITLEMENT_GRANDIOSITY: {
    intervention: 'Firm boundary. Consequence awareness. Dignity without enabling.',
    forbidden: 'Avoid power struggle.',
  },
  INSUFFICIENT_SELF_CONTROL: {
    intervention: 'Delay. Friction. Coping skill. Environment change.',
    forbidden: 'Avoid shame about willpower.',
  },
  SUBJUGATION: {
    intervention: 'Agency. Boundary language. Permission to disagree.',
    forbidden: 'Avoid reinforcing compliance.',
  },
  SELF_SACRIFICE: {
    intervention: 'Distinguish care from self-erasure. Rest as responsibility.',
    forbidden: 'Avoid guilt about self-care.',
  },
  APPROVAL_SEEKING: {
    intervention: 'Values over approval. Internal anchor.',
    forbidden: 'Avoid external validation as reward.',
  },
  NEGATIVITY_PESSIMISM: {
    intervention: 'Validate history. Next controllable step.',
    forbidden: 'No toxic positivity.',
  },
  EMOTIONAL_INHIBITION: {
    intervention: 'Normalize emotion. Small feeling label. Body check.',
    forbidden: 'Avoid forcing emotional expression.',
  },
  UNRELENTING_STANDARDS: {
    intervention: 'Sustainable standards. Pacing. Recovery without perfection.',
    forbidden: 'Avoid reinforcing perfectionism.',
  },
  PUNITIVENESS: {
    intervention: 'Soften judgment. Accountability without cruelty.',
    forbidden: 'Safety scan if self-directed.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Prompt Builder (Section 15)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build compact prompt injection from mode and schema decisions.
 * Respects context budget: max ~5 lines total.
 * Returns empty string if nothing safe to inject.
 */
function buildPromptInjection(
  modeDecision: ModeDecision,
  schemaDecision: SchemaDecision,
  isCrisis: boolean
): string {
  const lines: string[] = [];

  // ── Dominant mode line ──
  if (modeDecision.dominantMode) {
    const route = MODE_INTERVENTIONS[modeDecision.dominantMode];
    if (route) {
      lines.push(`PATTERN CONTEXT: ${route.needStatement}`);

      // Intervention direction (max 2 items from enable)
      const enableItems = route.enable.slice(0, 3).join(', ');
      lines.push(`ENABLE: ${enableItems}.`);

      // Forbidden style (max 1 item from disable)
      if (route.disable.length > 0) {
        const disableItems = route.disable.slice(0, 2).join(', ');
        lines.push(`AVOID: ${disableItems}.`);
      }
    }
  }

  // ── Supporting modes (max 1 additional) ──
  if (modeDecision.acceptedModes.length >= 2 && !isCrisis) {
    const supporting = modeDecision.acceptedModes[1];
    const route = MODE_INTERVENTIONS[supporting.modeId];
    if (route && supporting.allowedForPrompt) {
      lines.push(`ALSO PRESENT: ${route.needStatement}`);
    }
  }

  // ── Schema context (only if safe to explore and not in crisis) ──
  if (schemaDecision.safeToExplore && schemaDecision.dominantSchema) {
    const schemaRoute = SCHEMA_INTERVENTIONS[schemaDecision.dominantSchema];
    if (schemaRoute) {
      lines.push(`UNDERLYING PATTERN: ${schemaRoute.intervention} ${schemaRoute.forbidden}`);
    }
  }

  // Return empty if nothing meaningful
  if (lines.length === 0) return '';

  // Wrap in section markers
  return `═══ SCHEMA/MODE CONTEXT (deterministic engine) ═══\n${lines.join('\n')}\n═══ END SCHEMA/MODE CONTEXT ═══`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Main Engine Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

/** Session-level tracking of activated modes (reset per session) */
let sessionActivatedModes: ModeId[] = [];
/** Session-level tracking of activated schemas (reset per session) */
let sessionActivatedSchemas: SchemaId[] = [];

export function resetSchemaModeSessionState(): void {
  sessionActivatedModes = [];
  sessionActivatedSchemas = [];
}

/**
 * Run the full Schema/Mode engine pipeline:
 * 1. Detect mode candidates (deterministic markers)
 * 2. Validate mode candidates (safety hierarchy, multi-signal rule)
 * 3. Detect schema candidates (deterministic markers)
 * 4. Validate schema candidates (repetition rule, safety override)
 * 5. Route to interventions
 * 6. Build compact prompt injection
 */
export function runSchemaModeEngine(input: SchemaModeDetectionInput): SchemaModeEngineResult {
  // Step 1-2: Mode detection and validation
  const modeCandidates = detectModeCandidates(input);
  const modeDecision = validateModes(modeCandidates, input);

  // Step 3-4: Schema detection and validation
  const schemaCandidates = detectSchemaCandidates(input);
  const schemaDecision = validateSchemas(schemaCandidates, input);

  // Step 5-6: Build prompt injection
  const promptInjection = buildPromptInjection(modeDecision, schemaDecision, input.isCrisis);

  // Track activated modes and schemas for this session
  const activated = modeDecision.dominantMode !== null || schemaDecision.dominantSchema !== null;
  if (modeDecision.dominantMode && !sessionActivatedModes.includes(modeDecision.dominantMode)) {
    sessionActivatedModes.push(modeDecision.dominantMode);
  }
  if (schemaDecision.dominantSchema && !sessionActivatedSchemas.includes(schemaDecision.dominantSchema)) {
    sessionActivatedSchemas.push(schemaDecision.dominantSchema);
  }

  // Build prompt summaries for decisions
  const modePromptSummary = modeDecision.dominantMode
    ? MODE_INTERVENTIONS[modeDecision.dominantMode]?.needStatement ?? ''
    : '';
  const schemaPromptSummary = schemaDecision.dominantSchema && schemaDecision.safeToExplore
    ? SCHEMA_INTERVENTIONS[schemaDecision.dominantSchema]?.intervention ?? ''
    : '';

  return {
    modeDecision: { ...modeDecision, promptSummary: modePromptSummary },
    schemaDecision: { ...schemaDecision, promptSummary: schemaPromptSummary },
    promptInjection,
    activated,
    sessionActivatedModes: [...sessionActivatedModes],
    sessionActivatedSchemas: [...sessionActivatedSchemas],
  };
}

/**
 * Get current session activated modes (for trace data).
 */
export function getSessionActivatedModes(): ModeId[] {
  return [...sessionActivatedModes];
}

/**
 * Get current session activated schemas (for decay logic).
 */
export function getSessionActivatedSchemas(): SchemaId[] {
  return [...sessionActivatedSchemas];
}
