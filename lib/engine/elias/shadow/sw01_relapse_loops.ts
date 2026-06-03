/**
 * SW01 Shadow Work — Relapse Loops
 *
 * The 8 core shadow relapse loops: recurring sequences where a hidden part
 * uses craving or compulsion to avoid being felt.
 *
 * CANON: shadowwork.txt section 8
 */

import type { ShadowLoop } from './sw01_shadow_types';

// ─── 8 Core Shadow Relapse Loops ─────────────────────────────────────────────

export const SHADOW_RELAPSE_LOOPS: ShadowLoop[] = [
  {
    loop_id: 'shame_numbing',
    loop_name: 'Shame Numbing Loop',
    trigger: 'shame / self-disgust / secrecy',
    hidden_feeling: 'defectiveness, unworthiness',
    shadow_lie: 'I already am this bad, so it does not matter now.',
    urge: 'numbing, use, compulsion, hiding',
    likely_behaviour: 'substance use, bingeing, isolation, secrecy',
    elias_intervention: 'I think shame is trying to make relapse feel logical. That is the trick. Shame tells you that because you feel dirty, you may as well act dirty. That is not truth. That is the loop.',
    journal_prompt: 'What did shame say about me today, and what did craving try to make me do with that sentence?',
  },
  {
    loop_id: 'abandonment_panic',
    loop_name: 'Abandonment Panic Loop',
    trigger: 'feeling unchosen / ignored / replaced / unwanted',
    hidden_feeling: 'panic, dependency, fear of being nothing',
    shadow_lie: 'If I am not wanted now, I am nothing.',
    urge: 'panic contact, numbness, impulsive behaviour',
    likely_behaviour: 'compulsive messaging, substances, emotional collapse, obsessive checking',
    elias_intervention: 'This is not only missing someone. This is the abandoned part trying to take over the whole system. It wants immediate relief. It does not care what tomorrow costs.',
    journal_prompt: 'What did the abandoned part demand today? What did it fear would happen if I did not obey?',
  },
  {
    loop_id: 'control_loss_rebellion',
    loop_name: 'Control-Loss Rebellion Loop',
    trigger: 'feeling controlled / trapped / humiliated / cornered',
    hidden_feeling: 'rage, powerlessness, defiance',
    shadow_lie: 'If I destroy the rules, I am free.',
    urge: 'risky choice, rebellion, sabotage',
    likely_behaviour: 'fuck-it behaviour, defiance, risky use, burning bridges',
    elias_intervention: 'This looks like freedom, but it is not freedom. It is the old rebel proving it cannot be owned, even if it burns your own life to prove it.',
    journal_prompt: 'Where did I confuse rebellion with freedom today?',
  },
  {
    loop_id: 'inner_critic_punishment',
    loop_name: 'Inner Critic Punishment Loop',
    trigger: 'mistake / failure / self-attack',
    hidden_feeling: 'hopelessness, self-hatred, deserved punishment',
    shadow_lie: 'I deserve to fall.',
    urge: 'self-punishment, giving up, continuation of binge',
    likely_behaviour: 'relapse continuation, self-harm, isolation, giving up recovery',
    elias_intervention: 'Your inner critic is not correcting you. It is preparing the relapse. It attacks you until relapse starts to feel deserved.',
    journal_prompt: 'What did the critic say, and how did that voice try to push me toward giving up?',
  },
  {
    loop_id: 'perfectionism_collapse',
    loop_name: 'Perfectionism Collapse Loop',
    trigger: 'high standard / pressure / small failure / identity threat',
    hidden_feeling: 'identity wound, fear of inadequacy',
    shadow_lie: 'If I cannot do it perfectly, I have already failed.',
    urge: 'avoidance, compulsion, collapse, disappearance',
    likely_behaviour: 'procrastination, substance use, withdrawal, performance collapse',
    elias_intervention: 'This is perfectionism using failure as permission to disappear. You are not avoiding the task. You are avoiding the identity wound underneath the task.',
    journal_prompt: 'What did I expect myself to do perfectly, and what feeling appeared when I could not?',
  },
  {
    loop_id: 'intimacy_shame',
    loop_name: 'Intimacy Shame Loop',
    trigger: 'desire / closeness / vulnerability / rejection',
    hidden_feeling: 'shame, fear of exposure, fear of rejection',
    shadow_lie: 'If I am fully seen, I will be rejected.',
    urge: 'withdrawal or compulsive seeking, confusion',
    likely_behaviour: 'porn, avoidance, compulsive dating, emotional shutdown, self-disgust',
    elias_intervention: 'The part that wants closeness and the part that fears exposure are fighting. If you only follow one of them, the other will sabotage the outcome.',
    journal_prompt: 'What did closeness make me afraid of today? What did distance protect me from?',
  },
  {
    loop_id: 'digital_substitution',
    loop_name: 'Digital Substitution Loop',
    trigger: 'emotional discomfort / boredom / loneliness',
    hidden_feeling: 'avoidance, emptiness, need for stimulation',
    shadow_lie: 'This is harmless because it is not my main addiction.',
    urge: 'screen reach, stimulation, time loss',
    likely_behaviour: 'scrolling, gaming, porn, doomscrolling, compulsive checking',
    elias_intervention: 'It may not be the original addiction, but it is still the same avoidance engine. The substance changed. The shadow did not.',
    journal_prompt: 'What emotion did I hand over to my phone today?',
  },
  {
    loop_id: 'existential_void',
    loop_name: 'Existential Void Loop',
    trigger: 'meaninglessness / emptiness / boredom',
    hidden_feeling: 'void, lack of purpose, fear of ordinary life',
    shadow_lie: 'At least this makes me feel something.',
    urge: 'craving for intensity, destructive choice',
    likely_behaviour: 'risky behaviour, substance use, chaos seeking, self-destruction',
    elias_intervention: 'This is not only craving. This is the empty part looking for proof that it is still alive. The problem is that destruction gives intensity, not meaning.',
    journal_prompt: 'Where did I chase intensity because meaning felt absent?',
  },
];

// ─── Loop Detection ──────────────────────────────────────────────────────────

/**
 * Match a shadow signal to the most likely relapse loop based on emotional layer.
 */
export function matchRelapseLoop(emotionalLayer: string, suspectedShadow: string): ShadowLoop | null {
  const normalized = `${emotionalLayer} ${suspectedShadow}`.toLowerCase();

  if (normalized.includes('shame') || normalized.includes('defective') || normalized.includes('hidden self')) {
    return SHADOW_RELAPSE_LOOPS[0]; // shame_numbing
  }
  if (normalized.includes('abandon') || normalized.includes('orphan') || normalized.includes('needy')) {
    return SHADOW_RELAPSE_LOOPS[1]; // abandonment_panic
  }
  if (normalized.includes('rage') || normalized.includes('control') || normalized.includes('rebel') || normalized.includes('destroyer')) {
    return SHADOW_RELAPSE_LOOPS[2]; // control_loss_rebellion
  }
  if (normalized.includes('self-attack') || normalized.includes('critic') || normalized.includes('punishment')) {
    return SHADOW_RELAPSE_LOOPS[3]; // inner_critic_punishment
  }
  if (normalized.includes('perfecti') || normalized.includes('failure') || normalized.includes('inadequa')) {
    return SHADOW_RELAPSE_LOOPS[4]; // perfectionism_collapse
  }
  if (normalized.includes('intima') || normalized.includes('sexual') || normalized.includes('exposure') || normalized.includes('rejection')) {
    return SHADOW_RELAPSE_LOOPS[5]; // intimacy_shame
  }
  if (normalized.includes('digital') || normalized.includes('avoidant') || normalized.includes('substitut') || normalized.includes('stimulat')) {
    return SHADOW_RELAPSE_LOOPS[6]; // digital_substitution
  }
  if (normalized.includes('void') || normalized.includes('existential') || normalized.includes('emptiness') || normalized.includes('intensity') || normalized.includes('meaning')) {
    return SHADOW_RELAPSE_LOOPS[7]; // existential_void
  }

  return null;
}

/**
 * Get a loop by its ID.
 */
export function getLoopById(loopId: string): ShadowLoop | null {
  return SHADOW_RELAPSE_LOOPS.find(l => l.loop_id === loopId) ?? null;
}
