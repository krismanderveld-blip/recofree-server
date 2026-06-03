/**
 * K03 — Self-Care With Shadow Layer (Elias + Kim)
 *
 * PURPOSE: Light but psychologically informed self-care support that activates
 * when selfCare <= 3. Includes a micro shadow-work layer that detects when
 * self-neglect is connected to shame, self-punishment, body rejection, hidden
 * guilt, old abandonment, or a disowned part that does not feel worthy of care.
 *
 * TWO LEVELS:
 * 1. Immediate light self-care (one small body-level action)
 * 2. Gentle recognition of the hidden emotional pattern underneath self-neglect
 *
 * K03 always stabilises before exploring.
 * K03 is NOT K06 — it does not open full shadow processing.
 * K03 may prepare the user for K06 but must not replace K06.
 *
 * CORE PRINCIPLE:
 * "Small care that makes the next moment more bearable, while gently noticing
 * the part of the user that resists being cared for."
 *
 * SHADOW PARTS: Punisher, Disappearing One, Numb Protector, Rebel Against Care,
 * Exhausted Caretaker, Ashamed Body, Old Neglected Child
 *
 * RESPONSE LEVELS: Level 1 (selfCare=3), Level 2 (selfCare=2), Level 3 (selfCare=0-1)
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type K03ShadowPart =
  | 'punisher'
  | 'disappearing_one'
  | 'numb_protector'
  | 'rebel_against_care'
  | 'exhausted_caretaker'
  | 'ashamed_body'
  | 'old_neglected_child'
  | 'none';

export type K03ResponseLevel = 'level_1' | 'level_2' | 'level_3';

export type K03EKTPhase = 'verheldering' | 'spiegel' | 'contract' | 'exit' | 'none';

export type K03InterventionMode =
  | 'practical_only'         // no shadow indicators, pure body care
  | 'care_with_shadow'       // shadow indicator present, include micro-reflection
  | 'craving_stabilize'      // selfCare <= 3 AND craving >= 6
  | 'relapse_combine'        // selfCare <= 3 AND craving >= 8
  | 'collapse_minimal'       // selfCare <= 1, smallest possible action
  | 'safety_handoff'         // acute risk detected, hand to safety module
  | 'k06_referral'           // user ready for deeper work, refer to K06
  | 'none';

export type K03Severity = 'low' | 'moderate' | 'severe' | 'collapse';

export interface K03DetectionResult {
  activated: boolean;
  selfCareLevel: number;
  responseLevel: K03ResponseLevel;
  severity: K03Severity;
  shadowIndicatorDetected: boolean;
  primaryShadowPart: K03ShadowPart;
  secondaryShadowParts: K03ShadowPart[];
  cravingInteraction: boolean;
  moodInteraction: boolean;
  relapseRiskInteraction: boolean;
  safetyRiskDetected: boolean;
  signals: string[];
}

export interface K03RoutingResult {
  activated: boolean;
  interventionMode: K03InterventionMode;
  responseLevel: K03ResponseLevel;
  severity: K03Severity;
  ektPhase: K03EKTPhase;
  primaryShadowPart: K03ShadowPart;
  doNots: string[];
  promptBlock: string | null;
}

export interface K03Progress {
  sessionsActivated: number;
  sessionsWithShadow: number;
  sessionsAtLevel3: number;
  shadowPartsDetected: string[];
  lastShadowPart: K03ShadowPart;
  lastResponseLevel: K03ResponseLevel;
  lastInterventionMode: K03InterventionMode;
  k06ReferralsMade: number;
  consecutiveLowCare: number;
}

export function createDefaultK03Progress(): K03Progress {
  return {
    sessionsActivated: 0,
    sessionsWithShadow: 0,
    sessionsAtLevel3: 0,
    shadowPartsDetected: [],
    lastShadowPart: 'none',
    lastResponseLevel: 'level_1',
    lastInterventionMode: 'none',
    k06ReferralsMade: 0,
    consecutiveLowCare: 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETECTOR — Deterministic marker-based detection
// ════════════════════════════════════════════════════════════════════════════════

// Shadow indicator language markers (NL + EN)
const SHAME_MARKERS = [
  // EN
  'i am disgusting', 'i am pathetic', 'i am weak', 'ashamed', 'shame',
  'i let myself go', 'i am a mess', 'look at me', 'can\'t look at myself',
  'hate myself', 'i am worthless', 'i am nothing', 'i am garbage',
  // NL
  'ik ben walgelijk', 'ik ben zielig', 'ik ben zwak', 'schaam me', 'schaamte',
  'ik laat mezelf gaan', 'ik ben een puinhoop', 'kijk naar me', 'kan niet naar mezelf kijken',
  'haat mezelf', 'ik ben waardeloos', 'ik ben niets', 'ik ben afval',
];

const SELF_PUNISHMENT_MARKERS = [
  // EN
  'i deserve this', 'punishing myself', 'i don\'t deserve care', 'i don\'t deserve',
  'should suffer', 'earned this pain', 'this is what i get', 'i did this to myself',
  'don\'t deserve food', 'don\'t deserve rest', 'don\'t deserve help',
  // NL
  'ik verdien dit', 'mezelf straffen', 'ik verdien geen zorg', 'ik verdien het niet',
  'moet lijden', 'heb deze pijn verdiend', 'dit is wat ik krijg', 'heb dit aan mezelf te danken',
  'verdien geen eten', 'verdien geen rust', 'verdien geen hulp',
];

const BODY_REJECTION_MARKERS = [
  // EN
  'hate my body', 'disgusted by my body', 'can\'t look in mirror', 'body is enemy',
  'don\'t want to touch', 'feel dirty', 'can\'t shower', 'body doesn\'t matter',
  'don\'t want to eat', 'body is disgusting', 'ugly', 'repulsive',
  // NL
  'haat mijn lichaam', 'walg van mijn lichaam', 'kan niet in spiegel kijken',
  'lichaam is vijand', 'wil niet aanraken', 'voel me vies', 'kan niet douchen',
  'lichaam doet er niet toe', 'wil niet eten', 'lichaam is walgelijk', 'lelijk', 'afstotelijk',
];

const DISAPPEARING_MARKERS = [
  // EN
  'i don\'t exist', 'invisible', 'no one notices', 'disappearing', 'fading',
  'i don\'t matter', 'nobody cares', 'might as well not be here', 'erased',
  'taking up space', 'shouldn\'t be here', 'want to disappear',
  // NL
  'ik besta niet', 'onzichtbaar', 'niemand merkt het', 'verdwijnen', 'vervagen',
  'ik doe er niet toe', 'niemand geeft om mij', 'kan net zo goed weg', 'uitgewist',
  'neem ruimte in', 'zou hier niet moeten zijn', 'wil verdwijnen',
];

const NUMBNESS_MARKERS = [
  // EN
  'feel nothing', 'numb', 'empty', 'don\'t care anymore', 'nothing matters',
  'can\'t feel', 'switched off', 'dead inside', 'hollow', 'flat',
  'what\'s the point', 'pointless',
  // NL
  'voel niets', 'verdoofd', 'leeg', 'maakt niet meer uit', 'niets doet ertoe',
  'kan niets voelen', 'uitgeschakeld', 'dood van binnen', 'hol', 'vlak',
  'wat heeft het voor zin', 'zinloos',
];

const REBEL_MARKERS = [
  // EN
  'don\'t tell me', 'i don\'t need help', 'leave me alone', 'stop trying',
  'care is pointless', 'nothing works', 'i don\'t want advice', 'just stop',
  'i\'ll handle it myself', 'don\'t patronize', 'not your problem',
  // NL
  'zeg me niet', 'ik heb geen hulp nodig', 'laat me met rust', 'stop met proberen',
  'zorg is zinloos', 'niets werkt', 'ik wil geen advies', 'stop gewoon',
  'ik doe het zelf wel', 'betuttel me niet', 'niet jouw probleem',
];

const CARETAKER_EXHAUSTION_MARKERS = [
  // EN
  'everyone else first', 'can\'t stop caring', 'if i stop', 'they need me',
  'guilty for resting', 'selfish to rest', 'have to keep going for them',
  'can\'t rest while they', 'my needs can wait', 'only exist for others',
  // NL
  'iedereen eerst', 'kan niet stoppen met zorgen', 'als ik stop', 'ze hebben me nodig',
  'schuldig voor rust', 'egoïstisch om te rusten', 'moet doorgaan voor hen',
  'kan niet rusten terwijl zij', 'mijn behoeften kunnen wachten', 'besta alleen voor anderen',
];

const OLD_NEGLECT_MARKERS = [
  // EN
  'never learned', 'no one cared for me', 'always had to do it alone',
  'never expected care', 'don\'t know how to be cared for', 'not used to',
  'never had anyone', 'always been alone', 'care feels foreign', 'don\'t trust care',
  // NL
  'nooit geleerd', 'niemand zorgde voor mij', 'altijd alleen moeten doen',
  'nooit zorg verwacht', 'weet niet hoe het is om verzorgd te worden', 'niet gewend',
  'nooit iemand gehad', 'altijd alleen geweest', 'zorg voelt vreemd', 'vertrouw zorg niet',
];

// Safety risk markers
const SAFETY_RISK_MARKERS = [
  // EN
  'want to die', 'end it all', 'kill myself', 'overdose', 'self-harm',
  'cutting', 'hurting myself', 'not safe', 'in danger', 'being hurt',
  // NL
  'wil dood', 'er een einde aan maken', 'mezelf doden', 'overdosis', 'zelfbeschadiging',
  'snijden', 'mezelf pijn doen', 'niet veilig', 'in gevaar', 'word geslagen',
];

function countMarkerHits(text: string, markers: string[]): number {
  let count = 0;
  for (const marker of markers) {
    if (text.includes(marker)) count++;
  }
  return count;
}

// Session state
let sessionActivations: number[] = [];

export function resetK03SessionState(): void {
  sessionActivations = [];
}

export function detectK03State(
  message: string,
  selfCare: number,
  craving: number,
  mood: number,
  recentMessages: string[] = [],
): K03DetectionResult {
  // K03 only activates when selfCare <= 3
  if (selfCare > 3) {
    return {
      activated: false,
      selfCareLevel: selfCare,
      responseLevel: 'level_1',
      severity: 'low',
      shadowIndicatorDetected: false,
      primaryShadowPart: 'none',
      secondaryShadowParts: [],
      cravingInteraction: false,
      moodInteraction: false,
      relapseRiskInteraction: false,
      safetyRiskDetected: false,
      signals: [],
    };
  }

  const text = message.toLowerCase();
  const allText = [text, ...recentMessages.map(m => m.toLowerCase())].join(' ');

  // Detect shadow parts
  const shameHits = countMarkerHits(allText, SHAME_MARKERS);
  const punishmentHits = countMarkerHits(allText, SELF_PUNISHMENT_MARKERS);
  const bodyRejectionHits = countMarkerHits(allText, BODY_REJECTION_MARKERS);
  const disappearingHits = countMarkerHits(allText, DISAPPEARING_MARKERS);
  const numbnessHits = countMarkerHits(allText, NUMBNESS_MARKERS);
  const rebelHits = countMarkerHits(allText, REBEL_MARKERS);
  const caretakerHits = countMarkerHits(allText, CARETAKER_EXHAUSTION_MARKERS);
  const oldNeglectHits = countMarkerHits(allText, OLD_NEGLECT_MARKERS);
  const safetyHits = countMarkerHits(text, SAFETY_RISK_MARKERS);

  // Shadow part scoring
  const partScores: { part: K03ShadowPart; hits: number }[] = [
    { part: 'punisher', hits: punishmentHits + shameHits },
    { part: 'disappearing_one', hits: disappearingHits },
    { part: 'numb_protector', hits: numbnessHits },
    { part: 'rebel_against_care', hits: rebelHits },
    { part: 'exhausted_caretaker', hits: caretakerHits },
    { part: 'ashamed_body', hits: bodyRejectionHits },
    { part: 'old_neglected_child', hits: oldNeglectHits },
  ];

  partScores.sort((a, b) => b.hits - a.hits);

  const primaryShadowPart = partScores[0].hits > 0 ? partScores[0].part : 'none' as K03ShadowPart;
  const secondaryShadowParts = partScores
    .slice(1)
    .filter(s => s.hits > 0)
    .map(s => s.part);

  const totalShadowHits = partScores.reduce((sum, s) => sum + s.hits, 0);
  const shadowIndicatorDetected = totalShadowHits > 0;

  // Response level based on selfCare value
  let responseLevel: K03ResponseLevel = 'level_1';
  if (selfCare <= 1) responseLevel = 'level_3';
  else if (selfCare <= 2) responseLevel = 'level_2';

  // Severity
  let severity: K03Severity = 'low';
  if (selfCare <= 1 || safetyHits > 0) severity = 'collapse';
  else if (selfCare <= 2 && totalShadowHits >= 3) severity = 'severe';
  else if (selfCare <= 2 || totalShadowHits >= 2) severity = 'moderate';

  // Interactions
  const cravingInteraction = craving >= 6;
  const moodInteraction = mood <= 3;
  const relapseRiskInteraction = craving >= 8;
  const safetyRiskDetected = safetyHits > 0;

  // Track session
  sessionActivations.push(selfCare);

  // Collect signals
  const signals: string[] = [];
  signals.push(`selfCare(${selfCare})`);
  if (shameHits > 0) signals.push(`shame(${shameHits})`);
  if (punishmentHits > 0) signals.push(`self_punishment(${punishmentHits})`);
  if (bodyRejectionHits > 0) signals.push(`body_rejection(${bodyRejectionHits})`);
  if (disappearingHits > 0) signals.push(`disappearing(${disappearingHits})`);
  if (numbnessHits > 0) signals.push(`numbness(${numbnessHits})`);
  if (rebelHits > 0) signals.push(`rebel(${rebelHits})`);
  if (caretakerHits > 0) signals.push(`caretaker_exhaustion(${caretakerHits})`);
  if (oldNeglectHits > 0) signals.push(`old_neglect(${oldNeglectHits})`);
  if (cravingInteraction) signals.push(`craving_interaction(${craving})`);
  if (moodInteraction) signals.push(`mood_interaction(${mood})`);
  if (relapseRiskInteraction) signals.push('relapse_risk');
  if (safetyRiskDetected) signals.push('safety_risk');

  return {
    activated: true,
    selfCareLevel: selfCare,
    responseLevel,
    severity,
    shadowIndicatorDetected,
    primaryShadowPart,
    secondaryShadowParts,
    cravingInteraction,
    moodInteraction,
    relapseRiskInteraction,
    safetyRiskDetected,
    signals,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER — Intervention mode selection
// ════════════════════════════════════════════════════════════════════════════════

const DO_NOTS = [
  'Do NOT frame self-neglect as moral failure',
  'Do NOT say "you failed to take care of yourself"',
  'Do NOT say "you let yourself go"',
  'Do NOT say "you should know better"',
  'Do NOT say "just do it"',
  'Do NOT say "you are sabotaging yourself"',
  'Do NOT say "your shadow is the problem"',
  'Do NOT say "you are being lazy"',
  'Do NOT turn self-care into productivity',
  'Do NOT give more than one primary action',
  'Do NOT push deep trauma work',
  'Do NOT force journaling or routines',
  'Do NOT ask multiple questions at once',
  'Do NOT use heavy shadow language when user is unstable',
  'Do NOT use crisis tone without crisis indicators',
  'Do NOT diagnose the user',
  'Do NOT imply moral failure',
  'Do NOT force positivity',
];

function selectInterventionMode(detection: K03DetectionResult): K03InterventionMode {
  if (!detection.activated) return 'none';

  // Safety first
  if (detection.safetyRiskDetected) return 'safety_handoff';

  // Collapse level
  if (detection.responseLevel === 'level_3') return 'collapse_minimal';

  // Relapse risk interaction
  if (detection.relapseRiskInteraction) return 'relapse_combine';

  // Craving interaction
  if (detection.cravingInteraction) return 'craving_stabilize';

  // Shadow indicator present
  if (detection.shadowIndicatorDetected) return 'care_with_shadow';

  // Default: practical only
  return 'practical_only';
}

function selectEKTPhase(detection: K03DetectionResult): K03EKTPhase {
  if (!detection.activated) return 'none';

  // Level 3 (collapse) → no EKT, just minimal care
  if (detection.responseLevel === 'level_3') return 'none';

  // Shadow present + shame → spiegel softly
  if (detection.shadowIndicatorDetected &&
      (detection.primaryShadowPart === 'punisher' || detection.primaryShadowPart === 'ashamed_body')) {
    return 'spiegel';
  }

  // Rebel or numb → verheldering (identify what's blocking)
  if (detection.primaryShadowPart === 'rebel_against_care' || detection.primaryShadowPart === 'numb_protector') {
    return 'verheldering';
  }

  // Default when shadow present → contract (agree on one action)
  if (detection.shadowIndicatorDetected) return 'contract';

  // Practical only → contract
  return 'contract';
}

export function routeK03Engine(
  detection: K03DetectionResult,
  progress: K03Progress | undefined,
  persona: 'elias' | 'kim',
): K03RoutingResult {
  if (!detection.activated) {
    return {
      activated: false,
      interventionMode: 'none',
      responseLevel: 'level_1',
      severity: 'low',
      ektPhase: 'none',
      primaryShadowPart: 'none',
      doNots: [],
      promptBlock: null,
    };
  }

  const interventionMode = selectInterventionMode(detection);
  const ektPhase = selectEKTPhase(detection);

  const result: K03RoutingResult = {
    activated: true,
    interventionMode,
    responseLevel: detection.responseLevel,
    severity: detection.severity,
    ektPhase,
    primaryShadowPart: detection.primaryShadowPart,
    doNots: DO_NOTS,
    promptBlock: null,
  };

  result.promptBlock = buildK03PromptBlock(result, detection, progress, persona);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ════════════════════════════════════════════════════════════════════════════════

const SHADOW_PART_GUIDANCE: Record<K03ShadowPart, string> = {
  punisher: 'SHADOW PART: The Punisher. User withholds care as punishment, feels they deserve neglect. Response: reduce shame, reject punishment as care logic, offer minimal body action. "There is a punishing tone in this. We do not obey it right now. Three sips of water. Not because you earned it, but because your body needs it."',
  disappearing_one: 'SHADOW PART: The Disappearing One. User stops taking up space, hides, becomes passive, feels invisible. Response: name disappearance gently, offer visible body action. "A part of you may be trying to disappear. We do not force you to be loud. We only bring you back by one small action: feet on the floor."',
  numb_protector: 'SHADOW PART: The Numb Protector. User feels empty, cannot care, says nothing matters, avoids feeling by neglecting body. Response: do not demand emotion, use body-level care. "If feeling is too much or too far away, we do not chase it. We care for the body first. Water, warmth, or clean shirt."',
  rebel_against_care: 'SHADOW PART: The Rebel Against Care. User rejects care because it feels fake, weak, pointless, or imposed. Response: avoid control language, offer care as autonomy. "Then we do not make it a routine. No system. No lecture. Just one act you choose because nobody gets to decide your collapse for you."',
  exhausted_caretaker: 'SHADOW PART: The Exhausted Caretaker. User cares for everyone else, cannot stop, feels guilty resting. Response: preserve without blaming. "The caretaker part is overactive. It may believe stopping is abandonment. Ten minutes of rest is not abandonment. It is keeping you from disappearing."',
  ashamed_body: 'SHADOW PART: The Ashamed Body. User rejects hygiene, food, mirror, touch, clothing, body presence, feels disgust toward own body. Response: avoid body positivity, use neutral care. "You do not have to like your body to care for it. Neutral care is enough. Rinse your face or change one piece of clothing."',
  old_neglected_child: 'SHADOW PART: The Old Neglected Child. User neglects themselves in ways that echo old neglect, does not expect care, does not ask for help. Response: avoid forced inner-child language, name old pattern softly. "Something in this feels older than today. We do not have to open it now. But today, one small act of care interrupts the old pattern."',
  none: '',
};

const RESPONSE_LEVEL_GUIDANCE: Record<K03ResponseLevel, string> = {
  level_1: 'RESPONSE LEVEL 1 (selfCare=3): Low care, still reachable. Acknowledge low self-care, offer one stabilising action, include light shadow reflection if indicators present, avoid heavy processing. Keep tone calm and practical.',
  level_2: 'RESPONSE LEVEL 2 (selfCare=2): Severe neglect, reduced capacity. Reduce shame strongly, choose body-level action, no complex questions, no multi-step plan, shadow reflection must be very short. Maximum one sentence of reflection.',
  level_3: 'RESPONSE LEVEL 3 (selfCare=0-1): Near total neglect, possible collapse. Safety scan quietly, no pressure, smallest action possible, no motivational tone, check physical safety. Shadow layer only if it does not increase load. Short sentences only.',
};

const INTERVENTION_MODE_GUIDANCE: Record<K03InterventionMode, string> = {
  practical_only: 'MODE: Practical Only. No shadow indicators detected. Offer one concrete body-level care action. Keep it simple and shame-free. No reflection needed.',
  care_with_shadow: 'MODE: Care With Shadow. Shadow indicator detected. Structure: (1) One immediate care action, (2) One gentle shadow micro-reflection naming the resisting part, (3) One low-pressure follow-up. Do NOT go deeper unless user asks.',
  craving_stabilize: 'MODE: Craving Stabilize. selfCare <= 3 AND craving >= 6. Stabilise body BEFORE craving analysis. "Before we analyse the craving, we take care of the body for one minute." Notice whether craving is partly covering shame, hunger, exhaustion, or body neglect.',
  relapse_combine: 'MODE: Relapse Combine. selfCare <= 3 AND craving >= 8. Combine with relapse-risk support. Do not keep response purely light if relapse is imminent. Body stabilisation + relapse awareness simultaneously.',
  collapse_minimal: 'MODE: Collapse Minimal. selfCare <= 1. Check physical safety first. Smallest possible action. No motivational tone. No analysis. "We make this very small. Are you physically safe where you are? If yes: put one hand on your chest or stomach and breathe out once."',
  safety_handoff: 'MODE: Safety Handoff. Acute risk detected. Hand over to safety module. K03 shadow layer pauses during acute safety handling.',
  k06_referral: 'MODE: K06 Referral. User ready for deeper shadow work. selfCare >= 4, safety stable. "This pattern may belong in deeper shadow work, but not before your body is back above the floor."',
  none: '',
};

const EKT_PHASE_GUIDANCE: Record<K03EKTPhase, string> = {
  verheldering: 'EKT VERHELDERING: Identify which care area is lowest. Identify whether resistance is practical or emotional. Ask one simple question maximum. "Which one is lowest right now: water, food, hygiene, rest, or contact?"',
  spiegel: 'EKT SPIEGEL: Reflect the pattern gently. Name the resisting part without confrontation. "It makes sense that care drops when everything feels too much. There may also be a part of you that learned not to expect care."',
  contract: 'EKT CONTRACT: Agree on one small care action. No long commitment. Include one sentence of shadow awareness if useful. "One action only: drink water now. Then come back. We do not need to solve the deeper part yet."',
  exit: 'EKT EXIT: Close with one next step. No heavy emotional unpacking. "That was enough for this step. The part that resisted care does not need to disappear. It just does not get to decide everything."',
  none: '',
};

const NO_SHAME_REFRAMES = [
  'This is a care drop.',
  'This is depletion.',
  'This may be protection.',
  'This may be shame speaking.',
  'This may be an old pattern.',
  'This does not need punishment.',
  'One small act is enough for now.',
  'We do not need to earn basic care.',
  'The body can receive care before the mind agrees.',
];

function buildK03PromptBlock(
  routing: K03RoutingResult,
  detection: K03DetectionResult,
  progress: K03Progress | undefined,
  persona: 'elias' | 'kim',
): string {
  const lines: string[] = [];

  lines.push('═══ K03 SELF-CARE WITH SHADOW LAYER ═══');
  lines.push(`Persona: ${persona.toUpperCase()}`);
  lines.push(`Self-care level: ${detection.selfCareLevel}/10`);
  lines.push(`Response level: ${routing.responseLevel}`);
  lines.push(`Intervention mode: ${routing.interventionMode}`);
  lines.push(`Severity: ${routing.severity}`);
  lines.push('');

  // Response level guidance
  lines.push(RESPONSE_LEVEL_GUIDANCE[routing.responseLevel]);
  lines.push('');

  // Intervention mode guidance
  if (routing.interventionMode !== 'none') {
    lines.push(INTERVENTION_MODE_GUIDANCE[routing.interventionMode]);
    lines.push('');
  }

  // Shadow part guidance
  if (routing.primaryShadowPart !== 'none') {
    lines.push(SHADOW_PART_GUIDANCE[routing.primaryShadowPart]);
    lines.push('');
  }

  // EKT phase
  if (routing.ektPhase !== 'none') {
    lines.push(EKT_PHASE_GUIDANCE[routing.ektPhase]);
    lines.push('');
  }

  // Persona-specific guidance
  if (persona === 'elias') {
    lines.push('ELIAS RESPONSE STRUCTURE:');
    lines.push('1. Reduce shame first (frame as depletion/protection/collapse, NOT laziness)');
    lines.push('2. One immediate body-level action');
    lines.push('3. One shadow micro-reflection (if shadow indicator present)');
    lines.push('4. One low-pressure follow-up');
    lines.push('');
    lines.push('ELIAS SHADOW LANGUAGE: "There may be a part of you that does not want care right now. We do not fight it. We just notice it."');
  } else {
    lines.push('KIM RESPONSE STRUCTURE:');
    lines.push('1. Protect from disappearing into other person\'s crisis');
    lines.push('2. Frame self-care as preservation, not selfishness');
    lines.push('3. One immediate care action for the user themselves');
    lines.push('4. One non-shaming reflection on self-erasure (if shadow indicator present)');
    lines.push('5. One safe follow-up');
    lines.push('');
    lines.push('KIM SHADOW LANGUAGE: "A part of you may believe that resting means failing them. We do not have to obey that part immediately."');
  }
  lines.push('');

  // Interaction context
  if (detection.cravingInteraction) {
    lines.push(`CRAVING INTERACTION: Craving is elevated (${detection.selfCareLevel <= 3 ? 'active' : 'background'}). Stabilise body BEFORE craving analysis. "Craving gets louder when the body is empty."`);
    lines.push('');
  }
  if (detection.moodInteraction) {
    lines.push('MOOD INTERACTION: Mood is low. Use softer tone, smaller actions. Do NOT suggest planning, exercise, routine rebuilding, or heavy reflection.');
    lines.push('');
  }

  // Progress context
  if (progress && progress.consecutiveLowCare >= 3) {
    lines.push(`PATTERN ALERT: User has had ${progress.consecutiveLowCare} consecutive sessions with low self-care. This is a persistent pattern, not a one-time dip. Acknowledge the pattern without shaming.`);
    lines.push('');
  }

  // No-shame reframes
  lines.push('ALLOWED REFRAMES (use one if appropriate):');
  for (const reframe of NO_SHAME_REFRAMES) {
    lines.push(`- "${reframe}"`);
  }
  lines.push('');

  // Shadow-work language rules
  lines.push('SHADOW LANGUAGE RULES:');
  lines.push('Preferred: "a part of you", "the part that resists care", "the part that does not believe care is safe", "an old pattern", "a protective response"');
  lines.push('Avoid as first-line: "shadow self", "trauma response", "inner child wound", "self-sabotage", "pathology", "dysfunction"');
  lines.push('');

  // K06 handoff conditions
  lines.push('K06 HANDOFF: Only if user explicitly wants deeper work AND selfCare >= 4 AND safety stable AND craving not acute AND user not in collapse.');
  lines.push('');

  // Do-nots
  lines.push('DO NOT:');
  for (const doNot of routing.doNots.slice(0, 8)) {
    lines.push(`- ${doNot}`);
  }
  lines.push('');

  // Output rules
  lines.push('OUTPUT RULES: Provide ONE action only. Keep shadow work as micro-layer. Stabilise before reflecting. Reflect only one hidden part at a time. Return to body after reflection. Keep language concrete.');
  lines.push('═══ END K03 ═══');

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS UPDATE
// ════════════════════════════════════════════════════════════════════════════════

export function updateK03Progress(
  existing: K03Progress | undefined,
  detection: K03DetectionResult,
  routing: K03RoutingResult,
): K03Progress {
  const prev = existing ?? createDefaultK03Progress();

  const updated: K03Progress = {
    sessionsActivated: prev.sessionsActivated + (detection.activated ? 1 : 0),
    sessionsWithShadow: prev.sessionsWithShadow + (detection.shadowIndicatorDetected ? 1 : 0),
    sessionsAtLevel3: prev.sessionsAtLevel3 + (detection.responseLevel === 'level_3' ? 1 : 0),
    shadowPartsDetected: [...prev.shadowPartsDetected],
    lastShadowPart: detection.primaryShadowPart,
    lastResponseLevel: detection.responseLevel,
    lastInterventionMode: routing.interventionMode,
    k06ReferralsMade: prev.k06ReferralsMade + (routing.interventionMode === 'k06_referral' ? 1 : 0),
    consecutiveLowCare: detection.activated ? prev.consecutiveLowCare + 1 : 0,
  };

  // Track unique shadow parts
  if (detection.primaryShadowPart !== 'none' && !updated.shadowPartsDetected.includes(detection.primaryShadowPart)) {
    updated.shadowPartsDetected.push(detection.primaryShadowPart);
  }

  return updated;
}
