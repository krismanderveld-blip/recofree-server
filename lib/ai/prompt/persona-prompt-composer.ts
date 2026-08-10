/**
 * PERSONA PROMPT COMPOSER
 * 
 * Routes to Kim or Elias composer based on already-determined persona.
 * Does NOT determine persona. Does NOT infer persona from text.
 */

import type { ClientPromptBuildInput } from './client-prompt-types';
import { composeKimPrompt, type KimPromptSections } from './kim-prompt-composer';
import { composeEliasPrompt, type EliasPromptSections } from './elias-prompt-composer';

export type ComposedSections = KimPromptSections | EliasPromptSections;

/**
 * Route to the correct persona composer.
 * Persona must already be determined — this function does NOT infer it.
 */
export function composePersonaPrompt(input: ClientPromptBuildInput): ComposedSections {
  if (input.persona === 'kim') {
    return composeKimPrompt(input);
  }
  return composeEliasPrompt(input);
}
