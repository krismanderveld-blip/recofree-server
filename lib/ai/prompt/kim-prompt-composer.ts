/**
 * KIM PROMPT COMPOSER
 * 
 * Builds Kim-specific prompt sections from already-determined client-side payload.
 * Does NOT make clinical decisions. Does NOT select modules. Does NOT determine safety.
 * Only composes text from pre-computed inputs.
 */

import type { ClientPromptBuildInput } from './client-prompt-types';

// Kim identity is available client-side
import { KIM_IDENTITY_PROMPT, KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT, KIM_REALITY_AGENCY_GUARD } from '../../engine/kim/prompt-block';
import { CONTEXT_AWARE_APPLICATION_CONTRACT } from '../../engine/shared/context-application-contract';
import type { KimRelationalFormulationContext } from '../../engine/kim/relational-formulation/kim-relational-formulation-types';

export interface KimPromptSections {
  identity: string;
  relationalStance?: string;
  depthNaming?: string;
  formulationBlock?: string;
  communicationBlock?: string;
  regulation?: string;
  context?: string;
  deepening?: string;
  projection?: string;
  contextApplicationContract?: string;
}

/**
 * Compose Kim prompt sections from pre-determined input.
 * No module selection. No safety routing. No clinical decisions.
 */
export function composeKimPrompt(input: ClientPromptBuildInput): KimPromptSections {
  const sections: KimPromptSections = {
    identity: KIM_IDENTITY_PROMPT + "\n\n" + KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT + "\n\n" + KIM_REALITY_AGENCY_GUARD,
  };

  // Relational stance directive (already built by pipeline)
  if (input.relationalStanceDirective) {
    sections.relationalStance = input.relationalStanceDirective;
  }

  // Depth/naming directive (already built by pipeline)
  if (input.depthNamingDirective) {
    sections.depthNaming = input.depthNamingDirective;
  }

  // Kim formulation block (already built by pipeline)
  if (input.kimFormulationBlock) {
    sections.formulationBlock = input.kimFormulationBlock;
  }

  // K05 communication directive (already selected and built by deterministic engine)
  if (input.k05Context) {
    sections.communicationBlock = input.k05Context;
  }

  // Regulation instruction (already built by regulation engine)
  if (input.regulationInstruction) {
    sections.regulation = input.regulationInstruction;
  }

  // Context summary (already built by pipeline)
  if (input.contextDatSerialized || input.contextSummary) {
    sections.context = input.contextDatSerialized || input.contextSummary;
  }

  // Deepening block (already built by projection/deepening engine)
  if (input.deepeningBlock) {
    sections.deepening = input.deepeningBlock;
  }

  // Projection context
  if (input.projectionContext) {
    sections.projection = input.projectionContext;
  }
  // Context application contract — always active
  sections.contextApplicationContract = CONTEXT_AWARE_APPLICATION_CONTRACT;
  return sections;
}

/**
 * Build a compact Kim Relational Formulation prompt block from a validated context.
 * Token budget: ~200-300 tokens. No raw JSON. Compact structured text.
 * 
 * Returns undefined if context mode is not injectable (off, insufficient_context, safety_blocked).
 */
export function buildKimRelationalFormulationBlock(
  context: KimRelationalFormulationContext
): string | undefined {
  // Only inject for active modes
  if (context.mode !== 'low' && context.mode !== 'medium' && context.mode !== 'high') {
    return undefined;
  }

  const lines: string[] = [];
  lines.push(`[KIM RELATIONAL FORMULATION — mode: ${context.mode}, severity: ${context.severity}]`);

  // Priority 1: mode, severity, domains
  if (context.activeDomains.length > 0) {
    lines.push(`Domains: ${context.activeDomains.join(', ')}`);
  }

  // Priority 2: mustMention
  if (context.mustMention.length > 0) {
    lines.push('Must mention:');
    for (const item of context.mustMention.slice(0, 6)) {
      lines.push(`- ${item}`);
    }
  }

  // Priority 3: mustAvoid
  if (context.mustAvoid.length > 0) {
    lines.push('Must avoid:');
    for (const item of context.mustAvoid.slice(0, 6)) {
      lines.push(`- ${item}`);
    }
  }

  // Priority 4: responsibilityMap
  if (context.responsibilityMap.length > 0) {
    lines.push('Responsibility:');
    for (const item of context.responsibilityMap.slice(0, 3)) {
      lines.push(`- ${item.owner}: ${item.responsibility}`);
    }
  }

  // Priority 5: domainSeparations
  if (context.domainSeparations.length > 0) {
    lines.push('Domain separations:');
    for (const sep of context.domainSeparations.slice(0, 2)) {
      lines.push(`- ${sep.domainA} ≠ ${sep.domainB}: ${sep.distinction}`);
    }
  }

  // Priority 6: repairConditions
  if (context.repairConditions.length > 0) {
    lines.push('Repair conditions:');
    for (const cond of context.repairConditions.slice(0, 3)) {
      lines.push(`- ${cond.condition} (${cond.owner}${cond.nonNegotiable ? ', non-negotiable' : ''})`);
    }
  }

  // Priority 7: coreHypothesis only at high
  if (context.mode === 'high' && context.coreHypothesis) {
    lines.push(`Core hypothesis: ${context.coreHypothesis}`);
  }

  // Ending style and max questions
  lines.push(`Ending style: ${context.endingStyle}`);
  lines.push(`Max questions: ${context.maxQuestions}`);
  lines.push('Ending rule: Vermijd generieke eindvragen zoals "wat heb jij nodig?" of "hoe voelt dat?". Eindig liever met één concrete richting, grenszin of herstelvoorwaarde. Maximaal één vraag, en alleen als die richting geeft.');

  return lines.join('\n');
}
