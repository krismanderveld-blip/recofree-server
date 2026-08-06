/**
 * K04 — Emotional Regulation for Caregivers (Kim-only)
 *
 * PURPOSE: Help caregivers regulate emotional overload without suppressing emotions.
 * Not emotional control through avoidance, but emotional stability through awareness,
 * pacing, and healthy response patterns.
 *
 * CORE PRINCIPLE: "You are allowed to feel deeply without drowning in what you feel."
 *
 * DETECTED STATES: Overwhelm, Anger, Guilt, Fear, Emotional Numbness
 * MICROTOOLS: The Pause, Name the Emotion, Body Check, What Is Yours?, Lower the Temperature
 *
 * FAILSAFE: If emotional overload becomes severe → reduce complexity, shorten reflections,
 * focus on stabilization, grounding first, no difficult relational processing during overload.
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type K04EmotionalState =
  | 'overwhelm'
  | 'anger'
  | 'guilt'
  | 'fear'
  | 'emotional_numbness'
  | 'none';

export type K04Microtool =
  | 'the_pause'
  | 'name_the_emotion'
  | 'body_check'
  | 'what_is_yours'
  | 'lower_the_temperature';

export type K04ResponseMode =
  | 'grounding'
  | 'validation'
  | 'boundary_restoration'
  | 'pacing'
  | 'gentle_reconnection'
  | 'stabilization'
  | 'none';

export type K04Severity = 'mild' | 'moderate' | 'severe';

export interface K04DetectionResult {
  activated: boolean;
  primaryState: K04EmotionalState;
  secondaryStates: K04EmotionalState[];
  severity: K04Severity;
  signals: string[];
  loopingDetected: boolean;
  burnoutSignals: number;
}

export interface K04RoutingResult {
  activated: boolean;
  responseMode: K04ResponseMode;
  selectedMicrotool: K04Microtool | null;
  primaryState: K04EmotionalState;
  severity: K04Severity;
  failsafeActive: boolean;
  doNots: string[];
  promptBlock: string | null;
}

export interface K04Progress {
  sessionsWithOverwhelm: number;
  sessionsWithAnger: number;
  sessionsWithGuilt: number;
  sessionsWithFear: number;
  sessionsWithNumbness: number;
  burnoutIndicatorCount: number;
  lastMicrotoolUsed: K04Microtool | null;
  emotionalStabilityTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export function createDefaultK04Progress(): K04Progress {
  return {
    sessionsWithOverwhelm: 0,
    sessionsWithAnger: 0,
    sessionsWithGuilt: 0,
    sessionsWithFear: 0,
    sessionsWithNumbness: 0,
    burnoutIndicatorCount: 0,
    lastMicrotoolUsed: null,
    emotionalStabilityTrend: 'unknown',
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETECTOR — Deterministic marker-based detection
// ════════════════════════════════════════════════════════════════════════════════

const OVERWHELM_MARKERS = [
  // EN
  'cannot do this anymore', 'too much', 'everything feels', 'drowning',
  'overwhelmed', 'flooding', 'falling apart', 'breaking down', 'can\'t cope',
  'can\'t handle', 'at my limit', 'emotional overload', 'crying all the time',
  'can\'t stop crying', 'it never ends', 'exhausted from feeling',
  // NL
  'kan niet meer', 'te veel', 'alles voelt', 'verdrinken', 'overspoeld',
  'overbelast', 'val uit elkaar', 'instorten', 'kan het niet aan',
  'aan mijn limiet', 'emotioneel overbelast', 'huil de hele tijd',
  'kan niet stoppen met huilen', 'het stopt nooit', 'uitgeput van voelen',
  'ik red het niet', 'het is me te veel',
];

const ANGER_MARKERS = [
  // EN
  'resentment', 'furious', 'explosive', 'rage', 'so angry', 'fed up',
  'sick of this', 'hate this', 'want to scream', 'unfair', 'why do i bother',
  'done with this', 'had enough', 'boiling inside', 'lost my temper',
  // NL
  'woede', 'woedend', 'razend', 'kwaad', 'zo boos', 'zat', 'klaar mee',
  'haat dit', 'wil schreeuwen', 'oneerlijk', 'waarom doe ik moeite',
  'ik ben er klaar mee', 'genoeg gehad', 'kook van binnen', 'ontploft',
  'frustratie', 'gefrustreerd',
];

const GUILT_MARKERS = [
  // EN
  'my fault', 'should have', 'i failed', 'blame myself', 'if only i',
  'responsible for', 'could have prevented', 'let them down', 'not enough',
  'bad partner', 'bad parent', 'should have fixed', 'guilt', 'guilty',
  // NL
  'mijn schuld', 'had moeten', 'ik heb gefaald', 'geef mezelf de schuld',
  'als ik maar', 'verantwoordelijk voor', 'had kunnen voorkomen',
  'teleurgesteld', 'niet genoeg', 'slechte partner', 'slechte ouder',
  'had moeten oplossen', 'schuld', 'schuldig', 'schuldgevoel',
];

const FEAR_MARKERS = [
  // EN
  'afraid', 'terrified', 'scared', 'fear of relapse', 'fear of losing',
  'what if they', 'panic', 'dread', 'worried sick', 'can\'t sleep thinking',
  'fear of collapse', 'losing them', 'something terrible', 'worst case',
  // NL
  'bang', 'doodsbang', 'angst', 'bang voor terugval', 'bang om te verliezen',
  'wat als', 'paniek', 'vrees', 'ziek van zorgen', 'kan niet slapen',
  'bang voor instorting', 'hen verliezen', 'iets ergs', 'ergste scenario',
  'ongerust', 'angstig',
];

const NUMBNESS_MARKERS = [
  // EN
  'feel nothing', 'empty', 'numb', 'shutdown', 'disconnected', 'hollow',
  'don\'t care anymore', 'flat', 'no energy', 'going through motions',
  'emotionally dead', 'checked out', 'can\'t feel', 'switched off',
  // NL
  'voel niets', 'leeg', 'verdoofd', 'afgesloten', 'losgekoppeld', 'hol',
  'kan me niet meer schelen', 'vlak', 'geen energie', 'op automatische piloot',
  'emotioneel dood', 'uitgeschakeld', 'kan niet voelen', 'afgestompt',
  'gevoelloos',
];

const BURNOUT_INDICATORS = [
  // EN
  'exhausted', 'burned out', 'burnout', 'can\'t keep going', 'running on empty',
  'nothing left', 'depleted', 'no reserves', 'breaking point',
  // NL
  'uitgeput', 'opgebrand', 'burnout', 'kan niet doorgaan', 'leeg',
  'niets meer over', 'uitgehold', 'geen reserves', 'breekpunt', 'op',
];

const LOOPING_INDICATORS = [
  // EN
  'again', 'same thing', 'keeps happening', 'every time', 'stuck in',
  'going in circles', 'never changes', 'always the same',
  // NL
  'weer', 'hetzelfde', 'blijft gebeuren', 'elke keer', 'vast in',
  'in cirkels', 'verandert nooit', 'altijd hetzelfde', 'steeds opnieuw',
];

function countMarkerHits(text: string, markers: string[]): number {
  let count = 0;
  for (const marker of markers) {
    if (text.includes(marker)) count++;
  }
  return count;
}

// Session state for looping detection
let sessionEmotionalStates: K04EmotionalState[] = [];

export function resetK04SessionState(): void {
  sessionEmotionalStates = [];
}

export function detectK04EmotionalState(
  message: string,
  recentMessages: string[] = [],
): K04DetectionResult {
  const text = message.toLowerCase();
  const allText = [text, ...recentMessages.map(m => m.toLowerCase())].join(' ');

  const overwhelmHits = countMarkerHits(text, OVERWHELM_MARKERS);
  const angerHits = countMarkerHits(text, ANGER_MARKERS);
  const guiltHits = countMarkerHits(text, GUILT_MARKERS);
  const fearHits = countMarkerHits(text, FEAR_MARKERS);
  const numbnessHits = countMarkerHits(text, NUMBNESS_MARKERS);
  const burnoutHits = countMarkerHits(allText, BURNOUT_INDICATORS);
  const loopingHits = countMarkerHits(allText, LOOPING_INDICATORS);

  const scores: { state: K04EmotionalState; hits: number }[] = [
    { state: 'overwhelm', hits: overwhelmHits },
    { state: 'anger', hits: angerHits },
    { state: 'guilt', hits: guiltHits },
    { state: 'fear', hits: fearHits },
    { state: 'emotional_numbness', hits: numbnessHits },
  ];

  // Sort by hits descending
  scores.sort((a, b) => b.hits - a.hits);

  const primaryState = scores[0].hits > 0 ? scores[0].state : 'none' as K04EmotionalState;
  const secondaryStates = scores
    .slice(1)
    .filter(s => s.hits > 0)
    .map(s => s.state);

  const totalHits = scores.reduce((sum, s) => sum + s.hits, 0);
  const activated = totalHits > 0;

  // Determine severity
  let severity: K04Severity = 'mild';
  if (totalHits >= 5 || burnoutHits >= 3) {
    severity = 'severe';
  } else if (totalHits >= 3 || burnoutHits >= 2) {
    severity = 'moderate';
  }

  // Looping detection: same primary state 3+ times in session
  if (activated) {
    sessionEmotionalStates.push(primaryState);
  }
  const stateCount = sessionEmotionalStates.filter(s => s === primaryState).length;
  const loopingDetected = loopingHits >= 2 || stateCount >= 3;

  // Collect signal descriptions
  const signals: string[] = [];
  if (overwhelmHits > 0) signals.push(`overwhelm(${overwhelmHits})`);
  if (angerHits > 0) signals.push(`anger(${angerHits})`);
  if (guiltHits > 0) signals.push(`guilt(${guiltHits})`);
  if (fearHits > 0) signals.push(`fear(${fearHits})`);
  if (numbnessHits > 0) signals.push(`numbness(${numbnessHits})`);
  if (burnoutHits > 0) signals.push(`burnout(${burnoutHits})`);
  if (loopingDetected) signals.push('looping');

  return {
    activated,
    primaryState,
    secondaryStates,
    severity,
    signals,
    loopingDetected,
    burnoutSignals: burnoutHits,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER — Response mode selection, microtool assignment, failsafe logic
// ════════════════════════════════════════════════════════════════════════════════

const DO_NOTS = [
  'Do NOT shame emotions',
  'Do NOT force positivity',
  'Do NOT minimize pain',
  'Do NOT encourage emotional suppression',
  'Do NOT guilt caregivers into staying',
  'Do NOT pressure forgiveness',
];

function selectResponseMode(detection: K04DetectionResult): K04ResponseMode {
  if (!detection.activated) return 'none';

  // Failsafe: severe overload → stabilization only
  if (detection.severity === 'severe') return 'stabilization';

  switch (detection.primaryState) {
    case 'overwhelm':
      return 'grounding';
    case 'anger':
      return 'validation';
    case 'guilt':
      return 'boundary_restoration';
    case 'fear':
      return 'pacing';
    case 'emotional_numbness':
      return 'gentle_reconnection';
    default:
      return 'none';
  }
}

function selectMicrotool(detection: K04DetectionResult): K04Microtool | null {
  if (!detection.activated) return null;

  // Severe → always Lower the Temperature first
  if (detection.severity === 'severe') return 'lower_the_temperature';

  // Looping → The Pause to break the cycle
  if (detection.loopingDetected) return 'the_pause';

  switch (detection.primaryState) {
    case 'overwhelm':
      return 'body_check';
    case 'anger':
      return 'the_pause';
    case 'guilt':
      return 'what_is_yours';
    case 'fear':
      return 'name_the_emotion';
    case 'emotional_numbness':
      return 'body_check';
    default:
      return null;
  }
}

export function routeK04Engine(
  detection: K04DetectionResult,
  progress: K04Progress | undefined,
): K04RoutingResult {
  if (!detection.activated) {
    return {
      activated: false,
      responseMode: 'none',
      selectedMicrotool: null,
      primaryState: 'none',
      severity: 'mild',
      failsafeActive: false,
      doNots: [],
      promptBlock: null,
    };
  }

  const responseMode = selectResponseMode(detection);
  const selectedMicrotool = selectMicrotool(detection);
  const failsafeActive = detection.severity === 'severe';

  const result: K04RoutingResult = {
    activated: true,
    responseMode,
    selectedMicrotool,
    primaryState: detection.primaryState,
    severity: detection.severity,
    failsafeActive,
    doNots: DO_NOTS,
    promptBlock: null,
  };

  result.promptBlock = buildK04PromptBlock(result, detection, progress);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ════════════════════════════════════════════════════════════════════════════════

const MICROTOOL_PROMPTS: Record<K04Microtool, string> = {
  the_pause: 'Use THE PAUSE: "Before reacting, can we slow this down for one moment? What emotion is strongest right now?"',
  name_the_emotion: 'Use NAME THE EMOTION: "If you had to give this feeling one word, what would it be?"',
  body_check: 'Use BODY CHECK: "Where do you feel this most in your body?"',
  what_is_yours: 'Use WHAT IS YOURS: "What part belongs to you? And what part belongs to the situation or the other person?"',
  lower_the_temperature: 'Use LOWER THE TEMPERATURE: Guide slow breathing, suggest pausing conversations, postpone conflict when overwhelmed. Temporary emotional distance without emotional abandonment.',
};

const STATE_GUIDANCE: Record<K04EmotionalState, string> = {
  overwhelm: 'OVERWHELM detected. Response: slow pacing, grounding, emotional normalization, reduce urgency. Do not add complexity.',
  anger: 'ANGER detected. Response: validate without escalating, separate hurt from attack, slow emotional interpretation. "Sometimes anger is pain wearing armor."',
  guilt: 'GUILT detected. Response: challenge unrealistic responsibility, restore emotional balance, reduce overfunctioning. "You can care deeply without carrying responsibility for choices that are not yours."',
  fear: 'FEAR detected. Response: grounding, reality orientation, emotional pacing. Do not dismiss the fear but anchor to present reality.',
  emotional_numbness: 'EMOTIONAL NUMBNESS detected. Response: gentle reconnection, reduce shame, normalize emotional exhaustion. Do not force feeling.',
  none: '',
};

const FAILSAFE_INSTRUCTIONS = `FAILSAFE ACTIVE (severe overload):
1. Reduce complexity — short sentences only
2. Shorten reflections — max 2-3 sentences per response
3. Focus on stabilization — no processing, no insight work
4. Grounding first — body, breath, present moment
5. NO difficult relational processing during overload`;

function buildK04PromptBlock(
  routing: K04RoutingResult,
  detection: K04DetectionResult,
  progress: K04Progress | undefined,
): string {
  const lines: string[] = [];
  lines.push('=== K04 EMOTIONAL REGULATION FOR CAREGIVERS ===');
  lines.push(`Core principle: "You are allowed to feel deeply without drowning in what you feel."`);
  lines.push(`Kim does not try to remove difficult emotions. Kim helps the caregiver carry emotions safely.`);
  lines.push('');

  // State guidance
  lines.push(`Primary state: ${detection.primaryState} (severity: ${detection.severity})`);
  if (detection.secondaryStates.length > 0) {
    lines.push(`Secondary states: ${detection.secondaryStates.join(', ')}`);
  }
  lines.push(STATE_GUIDANCE[detection.primaryState]);
  lines.push('');

  // Response mode
  lines.push(`Response mode: ${routing.responseMode}`);

  // Microtool
  if (routing.selectedMicrotool) {
    lines.push('');
    lines.push(MICROTOOL_PROMPTS[routing.selectedMicrotool]);
  }

  // Looping
  if (detection.loopingDetected) {
    lines.push('');
    lines.push('LOOPING DETECTED: The caregiver is repeating the same emotional pattern. Gently acknowledge the loop without judgment, then offer a different angle or microtool.');
  }

  // Burnout
  if (detection.burnoutSignals >= 2) {
    lines.push('');
    lines.push(`BURNOUT SIGNALS (${detection.burnoutSignals}): Caregiver shows signs of burnout. Prioritize rest, boundary setting, and self-care. Do not add tasks or expectations.`);
  }

  // Progress context
  if (progress && progress.burnoutIndicatorCount >= 3) {
    lines.push('');
    lines.push(`RECURRING BURNOUT PATTERN: This caregiver has shown burnout signals in ${progress.burnoutIndicatorCount} sessions. Consider suggesting professional support or respite care.`);
  }

  // Failsafe
  if (routing.failsafeActive) {
    lines.push('');
    lines.push(FAILSAFE_INSTRUCTIONS);
  }

  // Do NOTs
  lines.push('');
  lines.push('DO NOTs:');
  for (const doNot of DO_NOTS) {
    lines.push(`- ${doNot}`);
  }

  lines.push('');
  lines.push('RELATIONAL CONNECTION LAYER:');
  lines.push('Regulation is not just calming down. Regulation serves to prevent contact from being further damaged.');
  lines.push('Frame regulation as:');
  lines.push('- "First settle, then speak."');
  lines.push('- "Do not respond from flooding."');
  lines.push('- "Pausing the conversation can protect connection."');
  lines.push('- "Calm is a prerequisite for hearing each other."');
  lines.push('FORBIDDEN: avoiding conflict as default, blaming the other as regulation tool, confirming the user in anger without a bridge to calm.');
  lines.push('Regulation is preparation for a better conversation, not avoidance of conversation.');
  lines.push('');
  lines.push('=== END K04 ===');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS UPDATE
// ════════════════════════════════════════════════════════════════════════════════

export function updateK04Progress(
  current: K04Progress | undefined,
  detection: K04DetectionResult,
  microtoolUsed: K04Microtool | null,
): K04Progress {
  const p = current ?? createDefaultK04Progress();

  const updated: K04Progress = { ...p };

  if (detection.primaryState === 'overwhelm') updated.sessionsWithOverwhelm++;
  if (detection.primaryState === 'anger') updated.sessionsWithAnger++;
  if (detection.primaryState === 'guilt') updated.sessionsWithGuilt++;
  if (detection.primaryState === 'fear') updated.sessionsWithFear++;
  if (detection.primaryState === 'emotional_numbness') updated.sessionsWithNumbness++;

  if (detection.burnoutSignals >= 2) updated.burnoutIndicatorCount++;

  if (microtoolUsed) updated.lastMicrotoolUsed = microtoolUsed;

  // Trend: compare last 3 sessions severity pattern (simplified)
  const totalSessions = updated.sessionsWithOverwhelm + updated.sessionsWithAnger +
    updated.sessionsWithGuilt + updated.sessionsWithFear + updated.sessionsWithNumbness;
  if (totalSessions <= 2) {
    updated.emotionalStabilityTrend = 'unknown';
  } else if (updated.burnoutIndicatorCount >= 3) {
    updated.emotionalStabilityTrend = 'declining';
  } else if (detection.severity === 'mild' && totalSessions >= 5) {
    updated.emotionalStabilityTrend = 'improving';
  } else {
    updated.emotionalStabilityTrend = 'stable';
  }

  return updated;
}
