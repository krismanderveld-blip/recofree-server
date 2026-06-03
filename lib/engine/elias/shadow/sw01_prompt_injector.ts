/**
 * SW01 Shadow Work — Prompt Injector
 *
 * Builds the prompt block injected into Elias system context when SW01 is active.
 * Includes intervention mode routing (7 modes from section 17).
 *
 * CANON: shadowwork.txt sections 17, 20, 21
 */

import type {
  InterventionMode,
  SW01EngineResult,
  ZuchtShadowState,
  ShadowSignal,
  ShadowLoop,
} from './sw01_shadow_types';
import { requiresContainment, requiresInterruption, allowsDeepExploration, getDepthDescription } from './sw01_zucht_router';
import { detectProjectionIntensity } from './sw01_projection_mapper';
import { getSingleJournalPrompt } from './sw01_journaling_prompts';
import { matchRelapseLoop } from './sw01_relapse_loops';

// ─── Canonical Prompt Block (section 20) ─────────────────────────────────────

const CORE_PROMPT_BLOCK = `SHADOW WORK ACTIVE - ELIAS ONLY
You are operating in RecoFree Shadow Work mode.
Your tone is warm, direct, and psychologically sharp.
You may explicitly name avoidance, self-deception, projection, shame loops, relapse logic, and hidden parts.
Do not humiliate the user.
Do not moralize.
Do not excuse harmful behaviour.
Connect shadow material to zuchtmeter state, trigger pattern, relapse risk, values, and responsibility.
Use journaling as primary exercise.
If zucht is red, do not perform deep excavation; name the loop and contain the next action.
If the user has relapsed, analyse the loop without shame collapse.
If projection is present, separate external reality from inner shadow material.
Never say shadow work is about fixing or deleting a part.
The goal is conscious relationship with the hidden part.`;

// ─── Forbidden Output (section 21) ──────────────────────────────────────────

const FORBIDDEN_BLOCK = `FORBIDDEN OUTPUT (hard rules):
- Never say "This is just your shadow."
- Never say "You are projecting everything."
- Never say "You need to love that part of yourself."
- Never say "Everything happens for a reason."
- Never say "Your addiction was a gift."
- Never say "Just forgive yourself."
- Never say "You are healed now that you understand it."
- Never say "Relapse was necessary."
- Never say "Your desire is wrong."
- Never say "Your anger is bad."
- Never say "Your jealousy is shameful."
- Do not use shadow work as entertainment.
- Do not turn the user into an archetype.
- Do not make spiritual claims as fact.
- Do not force closure or forgiveness.
- Do not open deep childhood material during active crisis (red zucht).`;

// ─── Intervention Mode Selection (section 17) ────────────────────────────────

/**
 * Select the appropriate intervention mode based on signals and zucht state.
 */
export function selectInterventionMode(
  signals: ShadowSignal[],
  zuchtState: ZuchtShadowState,
  projectionIntensity: number,
  hasRelapsed: boolean,
  activeLoop: ShadowLoop | null
): InterventionMode {
  // Priority 1: Post-relapse analysis
  if (hasRelapsed) {
    return 'post_relapse_analysis';
  }

  // Priority 2: Red state containment
  if (requiresContainment(zuchtState)) {
    return 'contained_red_state';
  }

  // Priority 3: Active loop at orange
  if (requiresInterruption(zuchtState) && activeLoop) {
    return 'loop_naming';
  }

  // Priority 4: Strong projection
  if (projectionIntensity >= 0.5) {
    return 'projection_unfolding';
  }

  // Priority 5: Active loop at lower zucht
  if (activeLoop && zuchtState.zucht_color === 'yellow') {
    return 'loop_naming';
  }

  // Priority 6: Deep exploration allowed — check for archetype patterns
  if (allowsDeepExploration(zuchtState) && signals.length > 0) {
    const hasSelfRejection = signals.some(s =>
      s.emotional_layer.includes('self-rejection') || s.emotional_layer.includes('split')
    );
    if (hasSelfRejection) {
      return 'archetype_map';
    }
  }

  // Priority 7: Signals present but no specific mode — direct mirror
  if (signals.length > 0 && signals[0].confidence >= 0.7) {
    return 'direct_mirror';
  }

  // Default: journal prompt (lowest intensity, reflective)
  return 'journal_prompt';
}

// ─── Mode-Specific Direction ─────────────────────────────────────────────────

function getModeDirection(mode: InterventionMode, activeLoop: ShadowLoop | null): string {
  switch (mode) {
    case 'direct_mirror':
      return 'MODE: DIRECT MIRROR — The pattern is visible and the user is rationalizing. Name what you see clearly. Be warm but do not collude with avoidance.';
    case 'loop_naming':
      return activeLoop
        ? `MODE: LOOP NAMING — Active loop detected: "${activeLoop.loop_name}". The shadow lie is: "${activeLoop.shadow_lie}". Name the loop directly. The user may not see it yet.`
        : 'MODE: LOOP NAMING — Craving is rising. Name the sequence: trigger → hidden feeling → shadow lie → urge. Be direct.';
    case 'projection_unfolding':
      return 'MODE: PROJECTION UNFOLDING — Another person triggers intense reaction. Separate external reality from inner shadow material. Never accuse the user of "just projecting". Say: "This reaction may be showing us something."';
    case 'archetype_map':
      return 'MODE: ARCHETYPE MAP — A recurring inner role is active. Name the archetype as a pattern, not a diagnosis. Use it as language tool, not label.';
    case 'journal_prompt':
      return 'MODE: JOURNAL PROMPT — User needs structured processing. Offer one focused journaling question. Do not overwhelm with multiple prompts.';
    case 'contained_red_state':
      return 'MODE: CONTAINED RED STATE — Zucht is red. Do NOT open the whole shadow. Name the lie that is trying to control the next action. Keep it short, direct, grounding, and relapse-focused.';
    case 'post_relapse_analysis':
      return 'MODE: POST-RELAPSE ANALYSIS — Relapse has occurred. Do NOT punish. Find the first moment where the loop became active. Analyse without shame collapse. Keep responsibility alive.';
    default:
      return '';
  }
}

// ─── Full Prompt Block Builder ───────────────────────────────────────────────

/**
 * Build the complete SW01 prompt block for injection into Elias system context.
 */
export function buildSW01PromptBlock(
  result: SW01EngineResult
): string {
  if (!result.active) return '';

  const parts: string[] = [
    '─── SW01 SHADOW WORK ───',
    CORE_PROMPT_BLOCK,
    '',
    `CURRENT STATE:`,
    `- Zucht: ${result.zuchtState.zucht_color} (${result.zuchtState.zucht_value}/10)`,
    `- Allowed depth: ${result.zuchtState.allowed_depth}`,
    `- Intervention style: ${result.zuchtState.intervention_style}`,
    `- Confidence: ${result.confidence.toFixed(2)}`,
    `- Projection active: ${result.projectionActive}`,
    '',
    getDepthDescription(result.zuchtState),
    '',
    getModeDirection(result.interventionMode, result.activeLoop),
  ];

  // Add active loop info if present
  if (result.activeLoop) {
    parts.push('');
    parts.push(`ACTIVE LOOP: ${result.activeLoop.loop_name}`);
    parts.push(`- Trigger: ${result.activeLoop.trigger}`);
    parts.push(`- Hidden feeling: ${result.activeLoop.hidden_feeling}`);
    parts.push(`- Shadow lie: "${result.activeLoop.shadow_lie}"`);
    parts.push(`- Suggested intervention: ${result.activeLoop.elias_intervention}`);
  }

  // Add signal info
  if (result.signals.length > 0) {
    const primary = result.signals[0];
    parts.push('');
    parts.push(`DETECTED SHADOW SIGNAL:`);
    parts.push(`- Emotional layer: ${primary.emotional_layer}`);
    parts.push(`- Suspected shadow: ${primary.suspected_shadow}`);
    parts.push(`- Relapse risk: ${primary.relapse_risk}`);
    parts.push(`- Marker: "${primary.marker}"`);
  }

  // Add journal prompt suggestion
  parts.push('');
  parts.push(`JOURNAL PROMPT TO OFFER: "${result.journalPrompt}"`);

  // Add forbidden output
  parts.push('');
  parts.push(FORBIDDEN_BLOCK);
  parts.push('─── END SW01 ───');

  return parts.join('\n');
}

/**
 * Compute the full SW01 engine result from inputs.
 * This is the main entry point called by the pipeline.
 */
export function computeSW01Directive(
  signals: ShadowSignal[],
  zuchtState: ZuchtShadowState,
  userText: string,
  hasRelapsed: boolean
): SW01EngineResult {
  const confidence = signals.length > 0
    ? Math.max(...signals.map(s => s.confidence))
    : 0;

  const projectionIntensity = detectProjectionIntensity(userText);
  const projectionActive = projectionIntensity >= 0.3;

  const activeLoop: ShadowLoop | null = signals.length > 0
    ? matchRelapseLoop(signals[0].emotional_layer, signals[0].suspected_shadow)
    : null;

  const interventionMode = selectInterventionMode(
    signals,
    zuchtState,
    projectionIntensity,
    hasRelapsed,
    activeLoop
  );

  const journalPrompt = getSingleJournalPrompt(
    interventionMode,
    activeLoop?.loop_id ?? null
  );

  const result: SW01EngineResult = {
    active: confidence >= 0.4,
    confidence,
    signals,
    zuchtState,
    interventionMode,
    activeLoop,
    projectionActive,
    promptBlock: '',
    journalPrompt,
  };

  // Build prompt block only if active
  result.promptBlock = result.active ? buildSW01PromptBlock(result) : '';

  return result;
}
