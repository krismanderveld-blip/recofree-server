/**
 * RETP Router — Emotie → Thema → Interventie
 *
 * Based on the RETP protocol from RECOFREE_ELIAS_V102_FULL_PLUS_STOA_RETP.json.
 *
 * Flow:
 *   1. Detect primary emotion from message + zone + sliders + active mode
 *   2. Map emotion to intervention themes (ordered A→B→C: kalmte, kijk, kleine daad)
 *   3. If theme references a STOA session → suggest that session ID to STOA selector
 *   4. Safety gating: RETP never activates at crisisLevel >= 2
 *
 * RULES:
 *   - Exactly ONE primary emotion per turn
 *   - If ambiguous, default to 'eenzaamheid' or 'stress' (per RETP spec)
 *   - Direction over result: richting boven resultaat
 *   - Only for Elias users
 */

// ─── Types ───────────────────────────────────────────────────────

export type RetpEmotion =
  | 'schaamte'
  | 'schuld'
  | 'woede'
  | 'verdriet'
  | 'eenzaamheid'
  | 'stress'
  | 'verlangen'
  | 'dofheid'
  | 'hoop';

export interface RetpTheme {
  /** Intervention name (e.g., "Stoa 6", "Adem 4-6-8", "Zelfcompassie") */
  intervention: string;
  /** Priority order: A=calm, B=perspective, C=micro-action */
  priority: 'A' | 'B' | 'C';
  /** If this references a STOA session, the session ID (1-15) */
  stoaSessionId: number | null;
}

export interface RetpRouterInput {
  /** Current user message */
  message: string;
  /** Resolved zone color (GREEN/YELLOW/ORANGE/RED/PURPLE) */
  zoneColor: string;
  /** Current crisis level (0=none, 1=elevated, 2=active crisis) */
  crisisLevel: number;
  /** Emotional state from state analyzer */
  emotionalState: string;
  /** Active mode from schema/mode engine (if any) */
  activeMode: string | null;
  /** Distress score (0-10) */
  distressScore: number;
  /** Candidate signals from signal engine */
  candidateSignals?: {
    fears: { keyword: string; confidence: number }[];
    hopes: { keyword: string; confidence: number }[];
    goals: { keyword: string; confidence: number }[];
    triggers: { keyword: string; confidence: number }[];
  };
}

export interface RetpRouterResult {
  /** Whether RETP routing was activated */
  activated: boolean;
  /** Detected primary emotion (null if not activated) */
  primaryEmotion: RetpEmotion | null;
  /** Ordered intervention themes (A, B, C) */
  themes: RetpTheme[];
  /** Suggested STOA session IDs from RETP themes (for STOA selector boost) */
  suggestedStoaSessionIds: number[];
  /** Reason for activation or non-activation */
  reason: string;
}

// ─── RETP Theme Data (from V102 JSON) ────────────────────────────

/**
 * Emotion → Themes mapping.
 * Each emotion maps to ordered interventions (A=kalmte, B=kijk, C=kleine daad).
 * STOA references are parsed to session IDs.
 */
const RETP_THEMES: Record<RetpEmotion, RetpTheme[]> = {
  schaamte: [
    { intervention: 'Stoa 6: Shame without hiding', priority: 'A', stoaSessionId: 6 },
    { intervention: 'Stoa 3: Guilt that won\'t leave', priority: 'B', stoaSessionId: 3 },
    { intervention: 'Zelfcompassie', priority: 'C', stoaSessionId: null },
  ],
  schuld: [
    { intervention: 'Stoa 10: Forgiving yourself before others do', priority: 'A', stoaSessionId: 10 },
    { intervention: 'ACT-waarden', priority: 'B', stoaSessionId: null },
  ],
  woede: [
    { intervention: 'DGT-distractie 15m', priority: 'A', stoaSessionId: null },
    { intervention: 'Stoa 1: The urge to fix everything', priority: 'B', stoaSessionId: 1 },
    { intervention: 'MBT-perspectief', priority: 'C', stoaSessionId: null },
  ],
  verdriet: [
    { intervention: 'Stoa 7: Grief without closure', priority: 'A', stoaSessionId: 7 },
    { intervention: 'Stoa 13: What remains if no one comes back?', priority: 'B', stoaSessionId: 13 },
    { intervention: 'Narratief schrijven', priority: 'C', stoaSessionId: null },
  ],
  eenzaamheid: [
    { intervention: 'Stoa 9: Being alone without being lonely', priority: 'A', stoaSessionId: 9 },
    { intervention: 'Stoa 13: What remains if no one comes back?', priority: 'B', stoaSessionId: 13 },
    { intervention: 'Sociale micro-actie', priority: 'C', stoaSessionId: null },
  ],
  stress: [
    { intervention: 'Adem 4-6-8', priority: 'A', stoaSessionId: null },
    { intervention: 'Stoa 2: Sitting with discomfort', priority: 'B', stoaSessionId: 2 },
    { intervention: 'Prikkelreset', priority: 'C', stoaSessionId: null },
  ],
  verlangen: [
    { intervention: 'Stoa 8: Craving as a messenger', priority: 'A', stoaSessionId: 8 },
    { intervention: 'Exposure met keuze', priority: 'B', stoaSessionId: null },
  ],
  dofheid: [
    { intervention: 'Stoa 14: Presence without meaning', priority: 'A', stoaSessionId: 14 },
    { intervention: 'Lichaamsactivatie 5 min', priority: 'B', stoaSessionId: null },
  ],
  hoop: [
    { intervention: 'Stoa 12: The fear of hoping again', priority: 'A', stoaSessionId: 12 },
    { intervention: 'Waardenstap 1x', priority: 'B', stoaSessionId: null },
  ],
};

// ─── Emotion Detection (deterministic text markers) ──────────────

interface EmotionMarker {
  emotion: RetpEmotion;
  keywords: string[];
  /** Zone boost: if user is in this zone, boost this emotion's score */
  zoneBoost?: string[];
  /** Mode boost: if this mode is active, boost this emotion */
  modeBoost?: string[];
}

const EMOTION_MARKERS: EmotionMarker[] = [
  {
    emotion: 'schaamte',
    keywords: ['schaam', 'shame', 'embarrass', 'humiliat', 'disgrace', 'worthless', 'pathetic', 'loser', 'failure as a person'],
    zoneBoost: ['ORANGE', 'RED'],
    modeBoost: ['vulnerable_child', 'defective_child'],
  },
  {
    emotion: 'schuld',
    keywords: ['schuld', 'guilt', 'blame', 'my fault', 'sorry', 'forgive', 'caused', 'ruined', 'damaged', 'hurt them'],
    zoneBoost: ['YELLOW', 'ORANGE'],
    modeBoost: ['punitive_parent', 'compliant_surrenderer'],
  },
  {
    emotion: 'woede',
    keywords: ['woed', 'anger', 'angry', 'furious', 'rage', 'pissed', 'hate', 'unfair', 'injustice', 'frustrated'],
    zoneBoost: ['ORANGE', 'RED'],
    modeBoost: ['angry_child', 'bully_attack'],
  },
  {
    emotion: 'verdriet',
    keywords: ['verdriet', 'sad', 'grief', 'loss', 'mourn', 'cry', 'tears', 'miss', 'gone', 'died', 'lost'],
    zoneBoost: ['YELLOW', 'ORANGE'],
    modeBoost: ['vulnerable_child', 'lonely_child'],
  },
  {
    emotion: 'eenzaamheid',
    keywords: ['eenzaam', 'lonely', 'alone', 'isolated', 'no one', 'nobody', 'abandoned', 'left out', 'disconnected'],
    zoneBoost: ['YELLOW', 'ORANGE'],
    modeBoost: ['lonely_child', 'abandoned_child'],
  },
  {
    emotion: 'stress',
    keywords: ['stress', 'overwhelm', 'pressure', 'too much', 'can\'t cope', 'panic', 'anxious', 'anxiety', 'nervous', 'tense'],
    zoneBoost: ['ORANGE', 'RED'],
    modeBoost: ['overcontroller', 'demanding_parent'],
  },
  {
    emotion: 'verlangen',
    keywords: ['verlang', 'craving', 'crave', 'want to use', 'urge', 'tempt', 'need it', 'just one', 'relapse', 'slip'],
    zoneBoost: ['ORANGE', 'RED'],
    modeBoost: ['impulsive_child', 'undisciplined_child'],
  },
  {
    emotion: 'dofheid',
    keywords: ['dof', 'numb', 'empty', 'flat', 'nothing', 'don\'t feel', 'blank', 'autopilot', 'going through motions', 'meaningless'],
    zoneBoost: ['GREEN', 'YELLOW'],
    modeBoost: ['detached_protector', 'detached_self_soother'],
  },
  {
    emotion: 'hoop',
    keywords: ['hoop', 'hope', 'better', 'future', 'forward', 'progress', 'improve', 'dream', 'goal', 'want to change'],
    zoneBoost: ['GREEN'],
    modeBoost: ['healthy_adult', 'happy_child'],
  },
];

// ─── Primary Emotion Detection ───────────────────────────────────

function detectPrimaryEmotion(input: RetpRouterInput): RetpEmotion | null {
  const lower = input.message.toLowerCase();
  const scores: Record<RetpEmotion, number> = {
    schaamte: 0,
    schuld: 0,
    woede: 0,
    verdriet: 0,
    eenzaamheid: 0,
    stress: 0,
    verlangen: 0,
    dofheid: 0,
    hoop: 0,
  };

  for (const marker of EMOTION_MARKERS) {
    // Keyword matching
    let keywordHits = 0;
    for (const kw of marker.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        keywordHits++;
      }
    }
    if (keywordHits === 0) continue;

    scores[marker.emotion] += keywordHits;

    // Zone boost (+0.5 per matching zone)
    if (marker.zoneBoost && marker.zoneBoost.includes(input.zoneColor)) {
      scores[marker.emotion] += 0.5;
    }

    // Mode boost (+0.5 if active mode matches)
    if (marker.modeBoost && input.activeMode && marker.modeBoost.includes(input.activeMode)) {
      scores[marker.emotion] += 0.5;
    }
  }

  // Distress-based boost for verlangen (craving is often slider-driven)
  if (input.distressScore >= 6) {
    scores.verlangen += 0.3;
    scores.stress += 0.3;
  }

  // EmotionalState-based fallback boost
  if (input.emotionalState === 'depleted') {
    scores.dofheid += 0.3;
    scores.verdriet += 0.2;
  } else if (input.emotionalState === 'vulnerable') {
    scores.eenzaamheid += 0.2;
    scores.verdriet += 0.2;
  }

  // Find highest scoring emotion
  let best: RetpEmotion | null = null;
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores) as [RetpEmotion, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }

  // Minimum threshold: at least 1 keyword hit (score >= 1)
  if (bestScore < 1) return null;

  return best;
}

// ─── Main Router ─────────────────────────────────────────────────

/**
 * Route the current emotional context through RETP protocol.
 *
 * Returns:
 * - The detected primary emotion
 * - Ordered intervention themes (A→B→C)
 * - Suggested STOA session IDs (for boosting in STOA selector)
 *
 * Safety: NEVER activates at crisisLevel >= 2.
 */
export function routeRetp(input: RetpRouterInput): RetpRouterResult {
  // Safety gating: no RETP during active crisis
  if (input.crisisLevel >= 2) {
    return {
      activated: false,
      primaryEmotion: null,
      themes: [],
      suggestedStoaSessionIds: [],
      reason: 'crisis_level_too_high',
    };
  }

  // Detect primary emotion
  const primaryEmotion = detectPrimaryEmotion(input);

  if (!primaryEmotion) {
    return {
      activated: false,
      primaryEmotion: null,
      themes: [],
      suggestedStoaSessionIds: [],
      reason: 'no_primary_emotion_detected',
    };
  }

  // Get themes for this emotion
  const themes = RETP_THEMES[primaryEmotion];

  // Extract suggested STOA session IDs
  const suggestedStoaSessionIds = themes
    .filter(t => t.stoaSessionId !== null)
    .map(t => t.stoaSessionId as number);

  return {
    activated: true,
    primaryEmotion,
    themes,
    suggestedStoaSessionIds,
    reason: `emotion_${primaryEmotion}_detected`,
  };
}
