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

export interface EliasPromptSections {
  identity: string;
  module?: string;
  regulation?: string;
  interventionContinuity?: string;
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
