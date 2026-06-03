/**
 * SW01 Shadow Work — Journaling Prompts
 *
 * Journaling is the primary exercise in this module.
 * 5 journaling protocols: daily shadow check, trigger journal,
 * projection journal, relapse loop journal, post-relapse journal.
 *
 * CANON: shadowwork.txt section 16
 */

import type { InterventionMode, ZuchtShadowState } from './sw01_shadow_types';

// ─── Journal Protocol Types ──────────────────────────────────────────────────

export type JournalProtocol =
  | 'daily_shadow_check'
  | 'trigger_journal'
  | 'projection_journal'
  | 'relapse_loop_journal'
  | 'post_relapse_journal';

export interface JournalPromptSet {
  protocol: JournalProtocol;
  title: string;
  prompts: string[];
}

// ─── 5 Journaling Protocols ──────────────────────────────────────────────────

const DAILY_SHADOW_CHECK: JournalPromptSet = {
  protocol: 'daily_shadow_check',
  title: 'Daily Shadow Check',
  prompts: [
    'What feeling did I avoid today?',
    'What did I do instead of feeling it?',
    'What part of me benefited from avoiding it?',
    'What did that part try to protect?',
    'What did that protection cost me?',
    'What would responsibility look like without self-hatred?',
  ],
};

const TRIGGER_JOURNAL: JournalPromptSet = {
  protocol: 'trigger_journal',
  title: 'Trigger Journal',
  prompts: [
    'Trigger: What happened?',
    'Reaction: What did I feel immediately?',
    'Body: Where did I feel it physically?',
    'Story: What did my mind say this meant about me?',
    'Shadow: Which hidden part was touched?',
    'Craving: Did zucht rise? From what level to what level?',
    'Urge: What did I want to do?',
    'Truth: What was the direct truth I did not want to admit?',
    'Choice: What is one next action that does not obey the shadow blindly?',
  ],
};

const PROJECTION_JOURNAL: JournalPromptSet = {
  protocol: 'projection_journal',
  title: 'Projection Journal',
  prompts: [
    'Person: Who triggered me?',
    'Charge: What was the emotional charge: anger, attraction, envy, disgust, fear, admiration?',
    'Mirror: What quality in them do I reject, fear, want, or secretly recognize?',
    'Boundary: What part is genuinely about their behaviour?',
    'Shadow: What part is about my own hidden material?',
    'Pattern: Where have I felt this before?',
    'Recovery: How could this projection become information instead of relapse fuel?',
  ],
};

const RELAPSE_LOOP_JOURNAL: JournalPromptSet = {
  protocol: 'relapse_loop_journal',
  title: 'Relapse Loop Journal',
  prompts: [
    'Before: What happened before craving rose?',
    'Hidden feeling: What feeling did I not want to feel?',
    'Shadow sentence: What sentence did the shadow whisper?',
    'Permission: How did craving make acting out sound reasonable?',
    'Behaviour: What did I do or almost do?',
    'After: What did I feel after?',
    'Pattern name: Which loop was this?',
    'Repair: What is the smallest honest repair now?',
  ],
};

const POST_RELAPSE_JOURNAL: JournalPromptSet = {
  protocol: 'post_relapse_journal',
  title: 'Post-Relapse Journal (not punishment — pattern recovery)',
  prompts: [
    'What was the first moment where the loop started?',
    'What did I ignore?',
    'Which part of me took over?',
    'What did that part believe it was solving?',
    'What did the behaviour actually solve?',
    'What did it make worse?',
    'What needs repair now?',
    'What must Elias watch with me next time?',
  ],
};

// ─── All Protocols ───────────────────────────────────────────────────────────

export const ALL_JOURNAL_PROTOCOLS: JournalPromptSet[] = [
  DAILY_SHADOW_CHECK,
  TRIGGER_JOURNAL,
  PROJECTION_JOURNAL,
  RELAPSE_LOOP_JOURNAL,
  POST_RELAPSE_JOURNAL,
];

// ─── Protocol Selection ──────────────────────────────────────────────────────

/**
 * Select the most appropriate journal protocol based on intervention mode and zucht state.
 */
export function selectJournalProtocol(
  interventionMode: InterventionMode,
  zuchtState: ZuchtShadowState,
  hasRelapsed: boolean,
  projectionActive: boolean
): JournalProtocol {
  // Post-relapse always takes priority
  if (hasRelapsed || interventionMode === 'post_relapse_analysis') {
    return 'post_relapse_journal';
  }

  // Projection active
  if (projectionActive || interventionMode === 'projection_unfolding') {
    return 'projection_journal';
  }

  // Loop naming or high zucht
  if (interventionMode === 'loop_naming' || zuchtState.zucht_color === 'orange') {
    return 'relapse_loop_journal';
  }

  // Containment at red — use trigger journal (shorter, more focused)
  if (interventionMode === 'contained_red_state' || zuchtState.zucht_color === 'red') {
    return 'trigger_journal';
  }

  // Default: daily shadow check (green/yellow, reflective)
  return 'daily_shadow_check';
}

/**
 * Get the prompt set for a specific protocol.
 */
export function getJournalPrompts(protocol: JournalProtocol): JournalPromptSet {
  return ALL_JOURNAL_PROTOCOLS.find(p => p.protocol === protocol) ?? DAILY_SHADOW_CHECK;
}

/**
 * Get a single focused journal prompt for the current context.
 * Used when Elias wants to offer one question rather than a full protocol.
 */
export function getSingleJournalPrompt(
  interventionMode: InterventionMode,
  loopId: string | null
): string {
  switch (interventionMode) {
    case 'direct_mirror':
      return 'What part of me is protecting itself right now, and what is it protecting me from?';
    case 'loop_naming':
      return loopId
        ? `Write this one sentence: The part of me that wanted to use was trying to protect me from...`
        : 'What feeling appeared just before the urge?';
    case 'projection_unfolding':
      return 'What quality in them do I reject, fear, want, or secretly recognize in myself?';
    case 'archetype_map':
      return 'Which inner role took over, and what did it believe it was solving?';
    case 'journal_prompt':
      return 'What feeling did I avoid today, and what did I do instead?';
    case 'contained_red_state':
      return 'What is the lie that is trying to control the next action?';
    case 'post_relapse_analysis':
      return 'What was the first moment where the loop started, and what did I ignore?';
    default:
      return 'What part of me do I keep trying to prove is not really mine?';
  }
}

// ─── Chapter Reflection Questions (section 22) ───────────────────────────────

export const CHAPTER_REFLECTIONS: Record<string, string> = {
  definition: 'What part of me do I keep trying to prove is not really mine?',
  emotion: 'What feeling do I turn into craving before I let myself name it?',
  projection: 'Who triggers me most, and what might that reaction reveal?',
  relapse: 'Which shadow loop has been most active lately?',
  zuchtmeter: 'At what zucht level does my shadow start negotiating?',
  intimacy: 'What does closeness make me afraid of?',
  technology: 'What emotion do I most often hand over to a screen?',
  existential: 'Who would I have to become if I stopped organizing life around coping?',
  integration: 'What hidden part can I acknowledge without obeying it?',
};
