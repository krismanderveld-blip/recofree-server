/**
 * ELIAS PROMPT COMPOSER
 * 
 * Builds Elias-specific prompt sections from already-determined client-side payload.
 * Does NOT make clinical decisions. Does NOT select modules. Does NOT determine safety.
 * Only composes text from pre-computed inputs.
 */

import type { ClientPromptBuildInput } from './client-prompt-types';

// Elias identity is available client-side
import { ELIAS_IDENTITY_PROMPT } from '../../engine/elias/prompt-block';
import type { EliasRecoveryFormulationContext } from '../../engine/elias/recovery-formulation';

export interface EliasPromptSections {
  identity: string;
  module?: string;
  regulation?: string;
  interventionContinuity?: string;
  formulationBlock?: string;
  context?: string;
  deepening?: string;
  projection?: string;
}

/**
 * Compose Elias prompt sections from pre-determined input.
 * No module selection. No safety routing. No clinical decisions.
 */
export function composeEliasPrompt(input: ClientPromptBuildInput): EliasPromptSections {
  const sections: EliasPromptSections = {
    identity: ELIAS_IDENTITY_PROMPT,
  };

  // Engine directive (module-specific instruction, already selected)
  if (input.engineDirective) {
    sections.module = input.engineDirective;
  }

  // Elias recovery formulation block (already built by pipeline)
  if (input.eliasFormulationBlock) {
    sections.formulationBlock = input.eliasFormulationBlock;
  }

  // Regulation instruction (already built by regulation engine)
  if (input.regulationInstruction) {
    sections.regulation = input.regulationInstruction;
  }

  // Intervention continuity (already built by continuity tracker)
  if (input.interventionContinuityBlock) {
    sections.interventionContinuity = input.interventionContinuityBlock;
  }

  // Context summary (already built by pipeline)
  if (input.contextDatSerialized || input.contextSummary) {
    sections.context = input.contextDatSerialized || input.contextSummary;
  }

  // Deepening block
  if (input.deepeningBlock) {
    sections.deepening = input.deepeningBlock;
  }

  // Projection context
  if (input.projectionContext) {
    sections.projection = input.projectionContext;
  }

  return sections;
}

/**
 * Build a compact Elias Recovery Formulation prompt block from a validated context.
 * Token budget: ~200-300 tokens. No raw JSON. Compact structured text.
 * 
 * Returns undefined if context mode is not injectable (off, insufficient_context, safety_blocked).
 */
export function buildEliasRecoveryFormulationBlock(
  context: EliasRecoveryFormulationContext
): string | undefined {
  // Only inject for active modes
  if (context.mode !== 'low' && context.mode !== 'medium' && context.mode !== 'high' && context.mode !== 'acute_recovery_risk') {
    return undefined;
  }

  const lines: string[] = [];
  lines.push(`[ELIAS RECOVERY FORMULATION — mode: ${context.mode}, severity: ${context.severity}]`);

  // Priority 1: domains
  if (context.activeDomains.length > 0) {
    lines.push(`Domains: ${context.activeDomains.slice(0, 6).join(', ')}`);
  }

  // Priority 2: mustMention
  if (context.mustMention.length > 0) {
    lines.push('Must mention:');
    for (const item of context.mustMention.slice(0, 4)) {
      lines.push(`- ${item}`);
    }
  }

  // Priority 3: mustAvoid
  if (context.mustAvoid.length > 0) {
    lines.push('Must avoid:');
    for (const item of context.mustAvoid.slice(0, 4)) {
      lines.push(`- ${item}`);
    }
  }

  // Priority 4: agencyMap
  if (context.agencyMap.length > 0) {
    lines.push('Agency:');
    for (const item of context.agencyMap.slice(0, 3)) {
      lines.push(`- ${item.possibleAction}`);
    }
  }

  // Priority 5: relapsePreventionSteps
  if (context.relapsePreventionSteps.length > 0) {
    lines.push('Relapse prevention:');
    for (const item of context.relapsePreventionSteps.slice(0, 3)) {
      lines.push(`- ${item.step}`);
    }
  }

  // Priority 6: supportPlan
  if (context.supportPlan.length > 0) {
    lines.push('Support:');
    for (const item of context.supportPlan.slice(0, 3)) {
      lines.push(`- ${item.action}`);
    }
  }

  // Priority 7: triggerChain
  if (context.triggerChain.length > 0) {
    lines.push('Trigger chain:');
    for (const item of context.triggerChain.slice(0, 2)) {
      lines.push(`- ${item.trigger} → ${item.internalResponse} → ${item.riskMovement}`);
    }
  }

  // Priority 8: responsibilityMap
  if (context.responsibilityMap.length > 0) {
    lines.push('Responsibility:');
    for (const item of context.responsibilityMap.slice(0, 3)) {
      const notResp = item.notResponsibleFor?.length ? ` (niet: ${item.notResponsibleFor.slice(0, 2).join(', ')})` : '';
      lines.push(`- ${item.owner}: ${item.responsibility}${notResp}`);
    }
  }

  // Priority 9: coreHypothesis only at high
  if (context.mode === 'high' && context.coreHypothesis) {
    lines.push(`Core hypothesis: ${context.coreHypothesis}`);
  }

  // Safety limits (always if present)
  if (context.safetyLimits.length > 0) {
    lines.push('Safety limits:');
    for (const item of context.safetyLimits.slice(0, 2)) {
      lines.push(`- ${item}`);
    }
  }

  // Ending style and max questions
  lines.push(`Ending style: ${context.endingStyle}`);
  lines.push(`Max questions: ${context.maxQuestions}`);
  lines.push('Ending rule: Vermijd generieke eindvragen. Eindig met één concrete herstelstap, vertraging of steunactie. Maximaal één vraag, en alleen als die richting geeft.');

  return lines.join('\n');
}
