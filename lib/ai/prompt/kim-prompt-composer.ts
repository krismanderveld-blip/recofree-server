/**
 * KIM PROMPT COMPOSER
 * 
 * Builds Kim-specific prompt sections from already-determined client-side payload.
 * Does NOT make clinical decisions. Does NOT select modules. Does NOT determine safety.
 * Only composes text from pre-computed inputs.
 */

import type { ClientPromptBuildInput } from './client-prompt-types';

// Kim identity is available client-side
import { KIM_IDENTITY_PROMPT } from '../../engine/kim/prompt-block';

export interface KimPromptSections {
  identity: string;
  relationalStance?: string;
  depthNaming?: string;
  regulation?: string;
  context?: string;
  deepening?: string;
  projection?: string;
}

/**
 * Compose Kim prompt sections from pre-determined input.
 * No module selection. No safety routing. No clinical decisions.
 */
export function composeKimPrompt(input: ClientPromptBuildInput): KimPromptSections {
  const sections: KimPromptSections = {
    identity: KIM_IDENTITY_PROMPT,
  };

  // Relational stance directive (already built by pipeline)
  if (input.relationalStanceDirective) {
    sections.relationalStance = input.relationalStanceDirective;
  }

  // Depth/naming directive (already built by pipeline)
  if (input.depthNamingDirective) {
    sections.depthNaming = input.depthNamingDirective;
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

  return sections;
}
