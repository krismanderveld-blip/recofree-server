/**
 * CLIENT SYSTEM PROMPT BUILDER
 * 
 * Central function: buildClientSystemPrompt(input) → ClientBuiltPromptResult
 * 
 * Uses persona-prompt-composer to build sections.
 * Assembles into a single system prompt string.
 * 
 * Does NOT:
 * - Select modules
 * - Determine safety
 * - Read memory
 * - Make clinical decisions
 * 
 * Only uses already-determined input from pipeline.
 */

import type { ClientPromptBuildInput, ClientBuiltPromptResult } from './client-prompt-types';
import { composePersonaPrompt } from './persona-prompt-composer';
import { estimateTokenBudget } from './prompt-token-budget';
import { redactDebugMetadata, isDebugOnlySection } from './prompt-redaction-guards';

/**
 * Build a client-side system prompt from pre-determined pipeline output.
 * This is a MIRROR build for debug comparison — not yet the active route.
 */
export function buildClientSystemPrompt(input: ClientPromptBuildInput): ClientBuiltPromptResult {
  const sections = composePersonaPrompt(input);
  const includedSections: string[] = [];
  const omittedSections: string[] = [];

  // Assemble prompt from sections
  const promptParts: string[] = [];

  // Identity (always included)
  if (sections.identity) {
    promptParts.push(sections.identity);
    includedSections.push('identity');
  }

  // Kim-specific sections
  if (input.persona === 'kim') {
    const kimSections = sections as import('./kim-prompt-composer').KimPromptSections;
    if (kimSections.relationalStance) {
      promptParts.push(kimSections.relationalStance);
      includedSections.push('relationalStance');
    } else {
      omittedSections.push('relationalStance');
    }
    if (kimSections.depthNaming) {
      promptParts.push(kimSections.depthNaming);
      includedSections.push('depthNaming');
    } else {
      omittedSections.push('depthNaming');
    }
    if (kimSections.formulationBlock) {
      promptParts.push(kimSections.formulationBlock);
      includedSections.push('formulationBlock');
    } else {
      omittedSections.push('formulationBlock');
    }
  }

  // Elias-specific sections
  if (input.persona === 'elias') {
    const eliasSections = sections as import('./elias-prompt-composer').EliasPromptSections;
    if (eliasSections.module) {
      promptParts.push(eliasSections.module);
      includedSections.push('module');
    } else {
      omittedSections.push('module');
    }
    if (eliasSections.formulationBlock) {
      promptParts.push(eliasSections.formulationBlock);
      includedSections.push('eliasFormulationBlock');
    } else {
      omittedSections.push('eliasFormulationBlock');
    }
    if (eliasSections.interventionContinuity) {
      promptParts.push(eliasSections.interventionContinuity);
      includedSections.push('interventionContinuity');
    } else {
      omittedSections.push('interventionContinuity');
    }
  }

  // Shared sections
  if (sections.regulation) {
    promptParts.push(sections.regulation);
    includedSections.push('regulation');
  } else {
    omittedSections.push('regulation');
  }

  if (sections.context) {
    promptParts.push(sections.context);
    includedSections.push('context');
  } else {
    omittedSections.push('context');
  }

  if (sections.deepening) {
    promptParts.push(sections.deepening);
    includedSections.push('deepening');
  } else {
    omittedSections.push('deepening');
  }

  if (sections.projection) {
    promptParts.push(sections.projection);
    includedSections.push('projection');
  } else {
    omittedSections.push('projection');
  if (sections.contextApplicationContract) {
    promptParts.push(sections.contextApplicationContract);
    includedSections.push('contextApplicationContract');
  } else {
    omittedSections.push('contextApplicationContract');
  }
  }

  // Personal Anchors (confirmed key figures — always included when available)
  if (input.personalAnchors) {
    const anchorBlock = [
      '[PERSONAL ANCHORS — confirmed facts]',
      input.personalAnchors,
      '',
      'These are confirmed relationships. Use them as facts, not hypotheses.',
      'Do not hedge or ask for confirmation when the user asks about these people.',
    ].join('\n');
    promptParts.push(anchorBlock);
    includedSections.push('personalAnchors');
  } else {
    omittedSections.push('personalAnchors');
  }

  // Rejected Suggestions (session-only, prevents repetition)
  if (input.rejectedSuggestionsBlock) {
    promptParts.push(input.rejectedSuggestionsBlock);
    includedSections.push('rejectedSuggestions');
  } else {
    omittedSections.push('rejectedSuggestions');
  }

  // CMD Selected Memory Summary (behind feature flag, only when non-empty)
  // Personal Clinical Context (deep analysis: schemas, modes, triggers, values, goals)
  if (input.personalClinicalContext) {
    const clinicalCtxBlock = [
      '[PERSONAL CLINICAL CONTEXT — use as working hypotheses, never diagnose]',
      input.personalClinicalContext,
      '',
      'Rules:',
      '- These are clinical working hypotheses, NOT diagnoses.',
      '- Use them to improve timing, depth, and relevance of your response.',
      '- Never label the user with schema/mode names.',
      '- Never say "your schema" or "your mode" — describe the pattern in plain language.',
      '- Protective factors and values are strengths to build on.',
      '- Goals guide the direction of therapeutic work.',
      '- Risks require careful, non-alarmist attention.',
    ].join('\n');
    promptParts.push(clinicalCtxBlock);
    includedSections.push('personalClinicalContext');
  } else {
    omittedSections.push('personalClinicalContext');
  }

  // CMD Selected Memory Summary (behind feature flag, only when non-empty)
  if (input.cmdMemorySummary) {
    const cmdBlock = [
      '[SELECTED CLINICAL MEMORY]',
      input.cmdMemorySummary,
      '',
      'Rules:',
      '- Treat hypotheses as hypotheses, not facts.',
      '- Do not mention memory, CMD, selector, DIST01 or internal systems to the user.',
      '- Use this only to improve timing, tone, relevance and formulation.',
      '- Do not overrule safety instructions.',
      '- Do not diagnose.',
      '- Do not add treatment claims.',
    ].join('\n');
    promptParts.push(cmdBlock);
    includedSections.push('cmdMemorySummary');
  } else {
    omittedSections.push('cmdMemorySummary');
  }

  // Join and redact debug metadata
  const rawPrompt = promptParts.join('\n\n');
  const { cleanedPrompt } = redactDebugMetadata(rawPrompt);

  // Token budget estimation
  const budget = estimateTokenBudget(cleanedPrompt);

  return {
    systemPrompt: cleanedPrompt,
    promptBuildVersion: 'client_mirror_v1',
    persona: input.persona,
    estimatedPromptSize: budget.estimatedPromptSize,
    budgetWarnings: budget.budgetWarnings,
    debug: {
      includedSections,
      omittedSections,
      effectiveDepth: input.effectiveDepth,
      maxFormulationMode: input.maxFormulationMode,
    },
  };
}
