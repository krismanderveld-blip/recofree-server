/**
 * STOA Engine — Fase 5 (Elias only)
 *
 * 15 Stoic sessions with deterministic trigger matching.
 * Activated when context fits: zone, VSP, dominant module, projections, signals.
 *
 * RULES:
 *   - Max 1 STOA session per chat session (anti-repeat within session)
 *   - Cross-session tracking via user.dat.stoaSessionsUsed (cooldown: 3 sessions)
 *   - Only activates for Elias users (Kim has no STOA)
 *   - Selection is deterministic (no GPT call)
 *   - Result is an injection block for the system prompt
 */

// ─── Types ───────────────────────────────────────────────────────

export interface StoaSession {
  id: number;
  title: string;
  /** Dutch title from V102 JSON */
  titleNL: string;
  /** When this session should activate — contextual trigger description */
  triggerContext: string;
  /** Keywords/signals that match this session */
  triggerKeywords: string[];
  /** Zone conditions where this session is appropriate (null = any zone) */
  validZones: string[] | null;
  /** VSP conditions (null = any VSP) */
  validVsp: string[] | null;
  /** The therapeutic protocol/instruction block for GPT */
  protocol: string;
}

export interface StoaEngineInput {
  /** Current user message */
  message: string;
  /** Resolved zone color (GREEN/YELLOW/ORANGE/RED/PURPLE) */
  zoneColor: string;
  /** VSP level (GROEN/GEEL/ORANJE/ROOD/PAARS) or null */
  vspLevel: string | null;
  /** Dominant module from pipeline */
  dominantModule: string;
  /** Distress score (0-10) */
  distressScore: number;
  /** Active projection entries (fears/hopes/goals) */
  activeProjections: Array<{ category: string; content: string; strength: number }>;
  /** Signal engine candidate signals */
  candidateSignals?: {
    fears: { keyword: string; confidence: number }[];
    hopes: { keyword: string; confidence: number }[];
    goals: { keyword: string; confidence: number }[];
    triggers: { keyword: string; confidence: number }[];
  };
  /** Sessions already used in previous sessions (for cooldown) */
  stoaSessionsUsed: Array<{ sessionId: number; usedAtSession: number }>;
  /** Current session number */
  currentSessionNumber: number;
}

export interface StoaEngineResult {
  /** Whether a STOA session was selected */
  activated: boolean;
  /** The selected session (null if not activated) */
  selectedSession: StoaSession | null;
  /** The injection block for the system prompt (null if not activated) */
  injectionBlock: string | null;
  /** Reason for selection or non-selection */
  reason: string;
}

// ─── Session Data (15 STOA Sessions from V102) ───────────────────

export const STOA_SESSIONS: StoaSession[] = [
  {
    id: 1,
    title: 'The urge to fix everything',
    titleNL: 'De drang om alles te repareren',
    triggerContext: 'During recovery obsession — user tries to control/fix everything at once',
    triggerKeywords: ['fix', 'control', 'everything', 'repair', 'perfect', 'obsess', 'must do', 'all at once', 'overwhelm', 'too much'],
    validZones: ['YELLOW', 'ORANGE'],
    validVsp: ['GEEL', 'ORANJE'],
    protocol: `STOA SESSION 1: The urge to fix everything
You sense that the user is trying to control or repair everything at once.
Approach: Gently name the pattern. Not everything needs fixing right now.
Key insight: "What if you don't need to fix anything today? What if being here is enough?"
Tone: Calm, grounding. Do NOT add more tasks. Help them release the pressure.
Use Stoic principle: Focus only on what is within your control. Let go of the rest.`,
  },
  {
    id: 2,
    title: 'The illusion that time solves things',
    titleNL: 'De illusie dat tijd alles oplost',
    triggerContext: 'During waiting without action — user believes time alone will heal',
    triggerKeywords: ['wait', 'time', 'eventually', 'someday', 'later', 'patience', 'will pass', 'just need time', 'not ready yet'],
    validZones: ['GREEN', 'YELLOW'],
    validVsp: ['GROEN', 'GEEL'],
    protocol: `STOA SESSION 2: The illusion that time solves things
The user seems to believe that waiting is enough — that time will resolve their struggle.
Approach: Respectfully challenge this. Time without intention is not healing.
Key insight: "Time doesn't heal. What you do WITH time does."
Tone: Gentle but direct. Not confrontational, but honest.
Use Stoic principle: Action aligned with virtue, not passive waiting.`,
  },
  {
    id: 3,
    title: 'Self-image after relapse',
    titleNL: 'Zelfbeeld na terugval',
    triggerContext: 'During self-image crisis — user struggles with identity after relapse',
    triggerKeywords: ['relapse', 'failed', 'failure', 'weak', 'worthless', 'who am I', 'identity', 'shame', 'disgusted', 'self-image', 'loser'],
    validZones: ['ORANGE', 'RED'],
    validVsp: ['ORANJE', 'ROOD'],
    protocol: `STOA SESSION 3: Self-image after relapse
The user is in a self-image crisis after a relapse or perceived failure.
Approach: Separate the act from the person. You are not your relapse.
Key insight: "A relapse is an event, not an identity. You are still here. That matters."
Tone: Warm, firm, stabilizing. Do NOT minimize the relapse, but refuse to let it define them.
Use Stoic principle: You are not your worst moment. Character is built through response, not perfection.`,
  },
  {
    id: 4,
    title: 'The paradox of proximity',
    titleNL: 'De paradox van nabijheid',
    triggerContext: 'During isolation pressure — user feels alone despite being surrounded',
    triggerKeywords: ['alone', 'lonely', 'isolated', 'no one understands', 'disconnect', 'invisible', 'surrounded but alone', 'proximity', 'distance'],
    validZones: ['YELLOW', 'ORANGE'],
    validVsp: null,
    protocol: `STOA SESSION 4: The paradox of proximity
The user feels isolated — perhaps surrounded by people but deeply alone.
Approach: Validate the loneliness without trying to fix it. Name the paradox.
Key insight: "Being near people and feeling alone is one of the hardest forms of loneliness."
Tone: Deeply empathic, present. Do NOT suggest 'just reach out to someone.'
Use Stoic principle: True connection requires vulnerability. Proximity alone is not presence.`,
  },
  {
    id: 5,
    title: 'Recovery without reward',
    titleNL: 'Herstel zonder beloning',
    triggerContext: 'When no recognition despite effort — user feels recovery is thankless',
    triggerKeywords: ['no reward', 'thankless', 'no one notices', 'effort', 'recognition', 'invisible progress', 'why bother', 'pointless', 'unappreciated'],
    validZones: ['GREEN', 'YELLOW'],
    validVsp: ['GROEN', 'GEEL'],
    protocol: `STOA SESSION 5: Recovery without reward
The user feels that their recovery effort goes unnoticed or unrewarded.
Approach: Acknowledge the frustration. Recovery is often invisible to others.
Key insight: "The reward of recovery is not applause. It's the quiet return of yourself."
Tone: Validating, philosophical. Help them find intrinsic meaning.
Use Stoic principle: Virtue is its own reward. External validation is not within your control.`,
  },
  {
    id: 6,
    title: 'Shame beyond words',
    titleNL: 'Schaamte voorbij woorden',
    triggerContext: 'During unnameable shame — user cannot articulate their shame',
    triggerKeywords: ['shame', 'can\'t say', 'unspeakable', 'too much', 'disgusting', 'dirty', 'unforgivable', 'secret', 'hide', 'buried'],
    validZones: ['ORANGE', 'RED'],
    validVsp: ['ORANJE', 'ROOD'],
    protocol: `STOA SESSION 6: Shame beyond words
The user is carrying shame they cannot fully articulate.
Approach: Do NOT push them to name it. Create space. Shame shrinks in witnessed presence.
Key insight: "You don't have to name it for me to be here with you in it."
Tone: Extremely gentle, patient, unhurried. No probing questions.
Use Stoic principle: What happened to you is not who you are. Shame is a feeling, not a fact.`,
  },
  {
    id: 7,
    title: 'Loss of who you thought you would become',
    titleNL: 'Verlies van wie je dacht te worden',
    triggerContext: 'During loss of future self-image — grieving the life they expected',
    triggerKeywords: ['future', 'dream', 'supposed to be', 'lost', 'never', 'career', 'potential', 'wasted', 'could have been', 'life plan'],
    validZones: ['YELLOW', 'ORANGE'],
    validVsp: null,
    protocol: `STOA SESSION 7: Loss of who you thought you would become
The user is grieving the future self they expected to be.
Approach: Honor the grief. This is a real loss — the loss of a possible life.
Key insight: "Grieving who you thought you'd be is as real as any other loss."
Tone: Compassionate, spacious. Allow the grief without rushing to hope.
Use Stoic principle: Accept what is. The only life available is the one from here forward.`,
  },
  {
    id: 8,
    title: 'Craving is not desire',
    titleNL: 'Craving is geen verlangen',
    triggerContext: 'During confusion between desire and craving — user conflates the two',
    triggerKeywords: ['craving', 'want', 'desire', 'need', 'urge', 'hunger', 'miss it', 'body wants', 'pull', 'automatic'],
    validZones: ['YELLOW', 'ORANGE', 'RED'],
    validVsp: ['GEEL', 'ORANJE', 'ROOD'],
    protocol: `STOA SESSION 8: Craving is not desire
The user confuses craving (compulsive pull) with genuine desire (conscious want).
Approach: Help them distinguish. Craving is the body's noise. Desire is the soul's direction.
Key insight: "Craving screams. Desire whispers. Can you hear the difference right now?"
Tone: Clear, grounding, slightly Socratic. Help them observe without acting.
Use Stoic principle: Distinguish between impulse and reasoned choice. The wise person observes the urge without obeying it.`,
  },
  {
    id: 9,
    title: 'The silence of others is not condemnation',
    titleNL: 'De stilte van anderen is geen veroordeling',
    triggerContext: 'During silence from a loved one — user interprets silence as rejection',
    triggerKeywords: ['silence', 'not responding', 'ignoring', 'abandoned', 'ghosted', 'no reply', 'they don\'t care', 'rejection', 'shut out'],
    validZones: ['YELLOW', 'ORANGE'],
    validVsp: null,
    protocol: `STOA SESSION 9: The silence of others is not condemnation
The user interprets someone's silence as rejection or judgment.
Approach: Gently separate observation from interpretation. Silence has many meanings.
Key insight: "Their silence may not be about you at all. What story are you telling yourself?"
Tone: Curious, warm, non-judgmental. Help them hold uncertainty.
Use Stoic principle: We suffer more in imagination than in reality. Others' actions are not within our control.`,
  },
  {
    id: 10,
    title: 'You are not responsible for another\'s pain',
    titleNL: 'Je bent niet verantwoordelijk voor andermans pijn',
    triggerContext: 'During projective guilt — user takes on others\' suffering as their fault',
    triggerKeywords: ['my fault', 'responsible', 'hurt them', 'guilt', 'caused', 'blame', 'their pain', 'because of me', 'damage', 'broken'],
    validZones: null,
    validVsp: null,
    protocol: `STOA SESSION 10: You are not responsible for another's pain
The user carries guilt for another person's suffering.
Approach: Distinguish responsibility from compassion. Caring is not the same as causing.
Key insight: "You can care deeply about someone's pain without being the cause of it."
Tone: Steady, clear, compassionate. Do NOT dismiss their concern, but reframe ownership.
Use Stoic principle: We are responsible for our own actions and intentions, not for others' emotions.`,
  },
  {
    id: 11,
    title: 'The utility of failure',
    titleNL: 'Het nut van falen',
    triggerContext: 'During self-condemnation — user sees only failure, no learning',
    triggerKeywords: ['failed', 'failure', 'useless', 'nothing works', 'keep failing', 'can\'t do anything', 'incompetent', 'stupid', 'mistake'],
    validZones: ['YELLOW', 'ORANGE'],
    validVsp: ['GEEL', 'ORANJE'],
    protocol: `STOA SESSION 11: The utility of failure
The user is trapped in self-condemnation after perceived failures.
Approach: Reframe failure as data, not verdict. Every failure contains information.
Key insight: "Failure is not the opposite of progress. It's part of it."
Tone: Encouraging but not dismissive. Acknowledge the pain, then offer perspective.
Use Stoic principle: The obstacle is the way. Every setback teaches what the next attempt needs.`,
  },
  {
    id: 12,
    title: 'Trust without proof',
    titleNL: 'Vertrouwen zonder bewijs',
    triggerContext: 'During decision fatigue — user cannot decide without certainty',
    triggerKeywords: ['decide', 'decision', 'uncertain', 'don\'t know', 'proof', 'guarantee', 'what if', 'trust', 'risk', 'afraid to choose'],
    validZones: ['GREEN', 'YELLOW'],
    validVsp: ['GROEN', 'GEEL'],
    protocol: `STOA SESSION 12: Trust without proof
The user is paralyzed by the need for certainty before acting.
Approach: Normalize uncertainty. No decision comes with a guarantee.
Key insight: "You will never have proof that it will work. You only have the courage to try."
Tone: Empowering, steady. Help them tolerate ambiguity.
Use Stoic principle: Focus on what you can control (your choice, your effort), not the outcome.`,
  },
  {
    id: 13,
    title: 'What remains if no one comes back?',
    titleNL: 'Wat blijft er als niemand terugkomt?',
    triggerContext: 'During existential abandonment — user faces the possibility of permanent loss',
    triggerKeywords: ['abandoned', 'no one', 'left', 'gone', 'never come back', 'alone forever', 'lost everyone', 'empty', 'existential', 'what\'s left'],
    validZones: ['ORANGE', 'RED'],
    validVsp: ['ORANJE', 'ROOD'],
    protocol: `STOA SESSION 13: What remains if no one comes back?
The user faces existential abandonment — the fear or reality that people won't return.
Approach: Do NOT offer false hope. Sit with the question. Help them find what remains.
Key insight: "Even if they don't come back — you remain. And that is not nothing."
Tone: Deeply present, unhurried, existential. No platitudes.
Use Stoic principle: Your worth does not depend on others' presence. You exist independently of their choices.`,
  },
  {
    id: 14,
    title: 'Presence without meaning',
    titleNL: 'Aanwezigheid zonder betekenis',
    triggerContext: 'During meaninglessness without crisis — user feels empty but not in danger',
    triggerKeywords: ['meaningless', 'pointless', 'empty', 'why', 'no purpose', 'going through motions', 'numb', 'flat', 'nothing matters', 'autopilot'],
    validZones: ['GREEN', 'YELLOW'],
    validVsp: ['GROEN', 'GEEL'],
    protocol: `STOA SESSION 14: Presence without meaning
The user feels meaningless — not in crisis, but flat and purposeless.
Approach: Do NOT rush to assign meaning. Sometimes presence itself is the practice.
Key insight: "You don't need a reason to be here. Being here IS the reason, for now."
Tone: Quiet, philosophical, accepting. No forced optimism.
Use Stoic principle: Meaning is not found, it is created through daily action aligned with values.`,
  },
  {
    id: 15,
    title: 'Starting over every day',
    titleNL: 'Elke dag opnieuw beginnen',
    triggerContext: 'During restarting recovery — user feels exhausted by the daily restart',
    triggerKeywords: ['start over', 'again', 'every day', 'exhausted', 'tired', 'same thing', 'repetition', 'cycle', 'groundhog', 'never ends'],
    validZones: null,
    validVsp: null,
    protocol: `STOA SESSION 15: Starting over every day
The user is exhausted by the daily restart of recovery.
Approach: Normalize the fatigue. Recovery IS daily. That's not failure — it's the nature of it.
Key insight: "Every morning you choose again. That's not weakness. That's the deepest form of strength."
Tone: Warm, steady, normalizing. Help them see the daily restart as practice, not punishment.
Use Stoic principle: Each day is a new life. The Stoic begins again every morning without resentment.`,
  },
];

// ─── Session-level anti-repeat state ─────────────────────────────

let sessionStoaActivated = false;
let sessionStoaSessionId: number | null = null;

export function resetStoaSessionState(): void {
  sessionStoaActivated = false;
  sessionStoaSessionId = null;
}

export function getStoaSessionState(): { activated: boolean; sessionId: number | null } {
  return { activated: sessionStoaActivated, sessionId: sessionStoaSessionId };
}

// ─── Cooldown check ──────────────────────────────────────────────

const STOA_COOLDOWN_SESSIONS = 3;

function isOnCooldown(
  sessionId: number,
  stoaSessionsUsed: Array<{ sessionId: number; usedAtSession: number }>,
  currentSessionNumber: number,
): boolean {
  const lastUse = stoaSessionsUsed.find(u => u.sessionId === sessionId);
  if (!lastUse) return false;
  return (currentSessionNumber - lastUse.usedAtSession) < STOA_COOLDOWN_SESSIONS;
}

// ─── Keyword matching ────────────────────────────────────────────

function computeKeywordScore(message: string, session: StoaSession): number {
  const lower = message.toLowerCase();
  let score = 0;
  for (const kw of session.triggerKeywords) {
    if (lower.includes(kw.toLowerCase())) {
      score += 1;
    }
  }
  return score;
}

function matchesProjections(
  session: StoaSession,
  projections: Array<{ category: string; content: string; strength: number }>,
): number {
  let score = 0;
  for (const proj of projections) {
    const projLower = proj.content.toLowerCase();
    for (const kw of session.triggerKeywords) {
      if (projLower.includes(kw.toLowerCase())) {
        score += proj.strength * 0.5;
        break; // one match per projection is enough
      }
    }
  }
  return score;
}

function matchesSignals(
  session: StoaSession,
  signals: StoaEngineInput['candidateSignals'],
): number {
  if (!signals) return 0;
  let score = 0;
  const allSignals = [
    ...signals.fears.map(s => s.keyword),
    ...signals.hopes.map(s => s.keyword),
    ...signals.goals.map(s => s.keyword),
    ...signals.triggers.map(s => s.keyword),
  ];
  for (const sig of allSignals) {
    const sigLower = sig.toLowerCase();
    for (const kw of session.triggerKeywords) {
      if (sigLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(sigLower)) {
        score += 0.5;
        break;
      }
    }
  }
  return score;
}

// ─── Zone/VSP validation ─────────────────────────────────────────

/** Map English zone colors to Dutch VSP levels for comparison */
const ZONE_TO_VSP: Record<string, string> = {
  'GREEN': 'GROEN',
  'YELLOW': 'GEEL',
  'ORANGE': 'ORANJE',
  'RED': 'ROOD',
  'PURPLE': 'PAARS',
};

function isZoneValid(session: StoaSession, zoneColor: string): boolean {
  if (!session.validZones) return true; // null = any zone
  return session.validZones.includes(zoneColor);
}

function isVspValid(session: StoaSession, vspLevel: string | null): boolean {
  if (!session.validVsp) return true; // null = any VSP
  if (!vspLevel) return true; // no VSP submitted = don't filter
  return session.validVsp.includes(vspLevel);
}

// ─── Main Selector ───────────────────────────────────────────────

/**
 * Select the best STOA session for the current context.
 *
 * Selection algorithm:
 * 1. Filter by zone validity
 * 2. Filter by VSP validity
 * 3. Filter by cooldown (cross-session)
 * 4. Filter by within-session anti-repeat
 * 5. Score remaining candidates by keyword + projection + signal match
 * 6. Select highest scoring candidate (minimum threshold: 2)
 */
export function selectStoaSession(input: StoaEngineInput): StoaEngineResult {
  // Guard: only Elias, and only once per session
  if (sessionStoaActivated) {
    return { activated: false, selectedSession: null, injectionBlock: null, reason: 'already_activated_this_session' };
  }

  // Filter candidates
  const candidates: Array<{ session: StoaSession; score: number }> = [];

  for (const session of STOA_SESSIONS) {
    // Zone filter
    if (!isZoneValid(session, input.zoneColor)) continue;

    // VSP filter
    if (!isVspValid(session, input.vspLevel)) continue;

    // Cooldown filter
    if (isOnCooldown(session.id, input.stoaSessionsUsed, input.currentSessionNumber)) continue;

    // Score calculation
    const keywordScore = computeKeywordScore(input.message, session);
    const projectionScore = matchesProjections(session, input.activeProjections);
    const signalScore = matchesSignals(session, input.candidateSignals);

    const totalScore = keywordScore + projectionScore + signalScore;

    if (totalScore >= 2) {
      candidates.push({ session, score: totalScore });
    }
  }

  if (candidates.length === 0) {
    return { activated: false, selectedSession: null, injectionBlock: null, reason: 'no_matching_session' };
  }

  // Sort by score descending, pick best
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Mark as activated for this session
  sessionStoaActivated = true;
  sessionStoaSessionId = best.session.id;

  // Build injection block
  const injectionBlock = `
═══ STOA SESSION ${best.session.id}: ${best.session.title.toUpperCase()} ═══
${best.session.protocol}
═══ END STOA SESSION ═══`;

  return {
    activated: true,
    selectedSession: best.session,
    injectionBlock,
    reason: `matched_session_${best.session.id}_score_${best.score.toFixed(1)}`,
  };
}
