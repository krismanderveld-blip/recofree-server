/**
 * K04-S4 — Betrayal, Trust, Hope & Self-Protection (Kim-only)
 *
 * PURPOSE: Help caregivers process repeated trust erosion, hope exhaustion,
 * hypervigilance as adaptation, and the right to self-protection without guilt.
 *
 * CORE PRINCIPLES:
 * - Trust is rebuilt through consistency, not promises
 * - Hope must remain connected to reality
 * - Hypervigilance is adaptation, not weakness
 * - Boundaries are not punishment
 * - Love does not require self-destruction
 * - Children feel more than we think
 * - Caregivers deserve protection too
 * - You are not responsible for another person's recovery
 *
 * DETECTED STATES: Trust erosion, Hope exhaustion, Hypervigilance,
 * Boundary guilt, Isolation, Child concern, Self-doubt
 *
 * RESPONSE MODES: Validation, Reality anchoring, Boundary permission,
 * Hope recalibration, Child safety, Isolation counter, Stabilization
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type K04S4State =
  | 'trust_erosion'
  | 'hope_exhaustion'
  | 'hypervigilance'
  | 'boundary_guilt'
  | 'isolation'
  | 'child_concern'
  | 'self_doubt'
  | 'none';

export type K04S4ResponseMode =
  | 'validation'
  | 'reality_anchoring'
  | 'boundary_permission'
  | 'hope_recalibration'
  | 'child_safety'
  | 'isolation_counter'
  | 'stabilization'
  | 'none';

export type K04S4Severity = 'mild' | 'moderate' | 'severe';

export interface K04S4DetectionResult {
  activated: boolean;
  primaryState: K04S4State;
  secondaryStates: K04S4State[];
  severity: K04S4Severity;
  signals: string[];
  cyclicPattern: boolean;
  trustErosionDepth: number; // 0-5 scale based on marker density
}

export interface K04S4RoutingResult {
  activated: boolean;
  responseMode: K04S4ResponseMode;
  primaryState: K04S4State;
  severity: K04S4Severity;
  failsafeActive: boolean;
  doNots: string[];
  promptBlock: string | null;
}

export interface K04S4Progress {
  sessionsWithTrustErosion: number;
  sessionsWithHopeExhaustion: number;
  sessionsWithHypervigilance: number;
  sessionsWithBoundaryGuilt: number;
  sessionsWithIsolation: number;
  sessionsWithChildConcern: number;
  cyclicPatternCount: number;
  trustRecoveryTrend: 'rebuilding' | 'eroding' | 'stable' | 'unknown';
  lastResponseMode: K04S4ResponseMode;
}

export function createDefaultK04S4Progress(): K04S4Progress {
  return {
    sessionsWithTrustErosion: 0,
    sessionsWithHopeExhaustion: 0,
    sessionsWithHypervigilance: 0,
    sessionsWithBoundaryGuilt: 0,
    sessionsWithIsolation: 0,
    sessionsWithChildConcern: 0,
    cyclicPatternCount: 0,
    trustRecoveryTrend: 'unknown',
    lastResponseMode: 'none',
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETECTOR — Deterministic marker-based detection
// ════════════════════════════════════════════════════════════════════════════════

const TRUST_EROSION_MARKERS = [
  // EN
  'broken promise', 'lied again', 'cannot trust', 'don\'t believe', 'trust is gone',
  'keeps lying', 'hidden', 'secret', 'found out', 'discovered', 'betrayed',
  'deceived', 'manipulated', 'gaslighted', 'denied it', 'covered up',
  'another lie', 'how many times', 'will it happen again', 'when will it happen',
  'waiting for the next', 'always checking', 'never know the truth',
  // NL
  'gebroken belofte', 'weer gelogen', 'kan niet vertrouwen', 'geloof het niet',
  'vertrouwen is weg', 'blijft liegen', 'verborgen', 'geheim', 'ontdekt',
  'verraden', 'bedrogen', 'gemanipuleerd', 'ontkende het', 'verdoezeld',
  'weer een leugen', 'hoe vaak nog', 'gaat het weer gebeuren', 'wanneer weer',
  'wacht op de volgende', 'altijd controleren', 'weet nooit de waarheid',
  'vertrouwensbreuk', 'betrapt',
];

const HOPE_EXHAUSTION_MARKERS = [
  // EN
  'tired of hoping', 'hope hurts', 'afraid to hope', 'every time i hope',
  'rebuilding again', 'starting over', 'how many times', 'same cycle',
  'promise means nothing', 'heard it before', 'believed them again',
  'fell for it again', 'exhausted from hoping', 'hope feels dangerous',
  'scared to believe', 'tired of rebuilding', 'tired of restarting',
  'carrying hope alone', 'hope costs too much',
  // NL
  'moe van hopen', 'hoop doet pijn', 'bang om te hopen', 'elke keer als ik hoop',
  'weer opnieuw opbouwen', 'opnieuw beginnen', 'hoe vaak nog', 'dezelfde cyclus',
  'belofte betekent niets', 'al eerder gehoord', 'weer geloofd',
  'weer erin getrapt', 'uitgeput van hopen', 'hoop voelt gevaarlijk',
  'bang om te geloven', 'moe van opbouwen', 'moe van herstarten',
  'alleen hoop dragen', 'hoop kost te veel',
];

const HYPERVIGILANCE_MARKERS = [
  // EN
  'always watching', 'cannot relax', 'checking', 'monitoring', 'on guard',
  'stay ready', 'do not trust too much', 'waiting for it', 'something feels off',
  'suspicious', 'scanning', 'can\'t let my guard down', 'always alert',
  'never safe', 'anticipating', 'expecting the worst', 'living beside a storm',
  'clear sky won\'t last', 'temporary peace',
  // NL
  'altijd opletten', 'kan niet ontspannen', 'controleren', 'in de gaten houden',
  'op mijn hoede', 'klaar staan', 'niet te veel vertrouwen', 'wacht erop',
  'iets klopt niet', 'achterdochtig', 'scannen', 'kan niet loslaten',
  'altijd alert', 'nooit veilig', 'anticiperen', 'verwacht het ergste',
  'naast een storm leven', 'rust is tijdelijk', 'waakzaam',
];

const BOUNDARY_GUILT_MARKERS = [
  // EN
  'selfish', 'abandoning them', 'if i step back', 'if i say no',
  'failing them', 'bad partner', 'bad parent', 'should stay',
  'can\'t leave', 'guilt for boundaries', 'feel guilty', 'they need me',
  'who will help them', 'i\'m all they have', 'responsible for them',
  'if something happens', 'blood on my hands', 'can\'t walk away',
  // NL
  'egoïstisch', 'hen in de steek laten', 'als ik afstand neem', 'als ik nee zeg',
  'hen teleurstellen', 'slechte partner', 'slechte ouder', 'moet blijven',
  'kan niet weg', 'schuld over grenzen', 'voel me schuldig', 'ze hebben me nodig',
  'wie helpt hen dan', 'ik ben alles wat ze hebben', 'verantwoordelijk voor hen',
  'als er iets gebeurt', 'bloed aan mijn handen', 'kan niet weglopen',
  'schuldgevoel', 'grenzen stellen voelt fout',
];

const ISOLATION_MARKERS = [
  // EN
  'alone in this', 'no one understands', 'stopped sharing', 'invisible',
  'unseen', 'unheard', 'carrying alone', 'suffer in silence', 'no support',
  'can\'t tell anyone', 'ashamed', 'embarrassed', 'who would believe',
  'isolated', 'lonely', 'cut off', 'no one to talk to',
  // NL
  'alleen hierin', 'niemand begrijpt', 'gestopt met delen', 'onzichtbaar',
  'niet gezien', 'niet gehoord', 'alleen dragen', 'in stilte lijden',
  'geen steun', 'kan het niemand vertellen', 'schaam me', 'beschaamd',
  'wie zou me geloven', 'geïsoleerd', 'eenzaam', 'afgesneden',
  'niemand om mee te praten', 'alleen',
];

const CHILD_CONCERN_MARKERS = [
  // EN
  'children feel', 'kids notice', 'my child', 'the children', 'protecting kids',
  'what about the kids', 'children absorb', 'unstable home', 'family stability',
  'kids are scared', 'children deserve', 'not safe for kids', 'impact on children',
  'my son', 'my daughter', 'the kids see', 'growing up with',
  // NL
  'kinderen voelen', 'kinderen merken', 'mijn kind', 'de kinderen', 'kinderen beschermen',
  'hoe zit het met de kinderen', 'kinderen absorberen', 'instabiel thuis',
  'gezinsstabiliteit', 'kinderen zijn bang', 'kinderen verdienen', 'niet veilig voor kinderen',
  'impact op kinderen', 'mijn zoon', 'mijn dochter', 'de kinderen zien', 'opgroeien met',
];

const SELF_DOUBT_MARKERS = [
  // EN
  'am i overreacting', 'am i controlling', 'why do i check', 'why can\'t i relax',
  'am i the problem', 'maybe it\'s me', 'am i crazy', 'am i too much',
  'maybe i\'m wrong', 'doubt myself', 'second guessing', 'losing my mind',
  'am i paranoid', 'maybe i should trust more', 'am i being unfair',
  // NL
  'overdrijf ik', 'ben ik controlerend', 'waarom controleer ik', 'waarom kan ik niet ontspannen',
  'ben ik het probleem', 'misschien ligt het aan mij', 'ben ik gek', 'ben ik te veel',
  'misschien heb ik ongelijk', 'twijfel aan mezelf', 'word ik gek',
  'ben ik paranoïde', 'moet ik meer vertrouwen', 'ben ik oneerlijk',
];

const CYCLIC_PATTERN_MARKERS = [
  // EN
  'again', 'same cycle', 'keeps happening', 'every time', 'over and over',
  'never ends', 'always the same', 'round and round', 'back to square one',
  'here we go again', 'déjà vu', 'history repeating',
  // NL
  'weer', 'dezelfde cyclus', 'blijft gebeuren', 'elke keer', 'steeds opnieuw',
  'stopt nooit', 'altijd hetzelfde', 'rondjes draaien', 'terug bij af',
  'daar gaan we weer', 'geschiedenis herhaalt', 'in cirkels',
];

function countMarkerHits(text: string, markers: string[]): number {
  let count = 0;
  for (const marker of markers) {
    if (text.includes(marker)) count++;
  }
  return count;
}

// Session state for cyclic pattern detection
let sessionStates: K04S4State[] = [];

export function resetK04S4SessionState(): void {
  sessionStates = [];
}

export function detectK04S4State(
  message: string,
  recentMessages: string[] = [],
): K04S4DetectionResult {
  const text = message.toLowerCase();
  const allText = [text, ...recentMessages.map(m => m.toLowerCase())].join(' ');

  const trustHits = countMarkerHits(text, TRUST_EROSION_MARKERS);
  const hopeHits = countMarkerHits(text, HOPE_EXHAUSTION_MARKERS);
  const vigilanceHits = countMarkerHits(text, HYPERVIGILANCE_MARKERS);
  const guiltHits = countMarkerHits(text, BOUNDARY_GUILT_MARKERS);
  const isolationHits = countMarkerHits(text, ISOLATION_MARKERS);
  const childHits = countMarkerHits(text, CHILD_CONCERN_MARKERS);
  const doubtHits = countMarkerHits(text, SELF_DOUBT_MARKERS);
  const cyclicHits = countMarkerHits(allText, CYCLIC_PATTERN_MARKERS);

  const scores: { state: K04S4State; hits: number }[] = [
    { state: 'trust_erosion', hits: trustHits },
    { state: 'hope_exhaustion', hits: hopeHits },
    { state: 'hypervigilance', hits: vigilanceHits },
    { state: 'boundary_guilt', hits: guiltHits },
    { state: 'isolation', hits: isolationHits },
    { state: 'child_concern', hits: childHits },
    { state: 'self_doubt', hits: doubtHits },
  ];

  // Sort by hits descending
  scores.sort((a, b) => b.hits - a.hits);

  const primaryState = scores[0].hits > 0 ? scores[0].state : 'none' as K04S4State;
  const secondaryStates = scores
    .slice(1)
    .filter(s => s.hits > 0)
    .map(s => s.state);

  const totalHits = scores.reduce((sum, s) => sum + s.hits, 0);
  const activated = totalHits > 0;

  // Determine severity
  let severity: K04S4Severity = 'mild';
  if (totalHits >= 6 || (trustHits >= 4 && hopeHits >= 2)) {
    severity = 'severe';
  } else if (totalHits >= 3 || trustHits >= 2) {
    severity = 'moderate';
  }

  // Cyclic pattern detection
  if (activated) {
    sessionStates.push(primaryState);
  }
  const stateRepeatCount = sessionStates.filter(s => s === primaryState).length;
  const cyclicPattern = cyclicHits >= 2 || stateRepeatCount >= 3;

  // Trust erosion depth (0-5)
  const trustErosionDepth = Math.min(5, Math.floor(trustHits * 1.5 + (cyclicHits > 0 ? 1 : 0)));

  // Collect signal descriptions
  const signals: string[] = [];
  if (trustHits > 0) signals.push(`trust_erosion(${trustHits})`);
  if (hopeHits > 0) signals.push(`hope_exhaustion(${hopeHits})`);
  if (vigilanceHits > 0) signals.push(`hypervigilance(${vigilanceHits})`);
  if (guiltHits > 0) signals.push(`boundary_guilt(${guiltHits})`);
  if (isolationHits > 0) signals.push(`isolation(${isolationHits})`);
  if (childHits > 0) signals.push(`child_concern(${childHits})`);
  if (doubtHits > 0) signals.push(`self_doubt(${doubtHits})`);
  if (cyclicPattern) signals.push('cyclic_pattern');

  return {
    activated,
    primaryState,
    secondaryStates,
    severity,
    signals,
    cyclicPattern,
    trustErosionDepth,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER — Response mode selection, failsafe logic
// ════════════════════════════════════════════════════════════════════════════════

const DO_NOTS = [
  'Do NOT dismiss hypervigilance as paranoia',
  'Do NOT force trust or forgiveness',
  'Do NOT blame the caregiver for self-protection',
  'Do NOT sacrifice reality for hope',
  'Do NOT guilt caregivers into staying',
  'Do NOT minimize repeated betrayal',
  'Do NOT treat boundaries as punishment',
  'Do NOT pressure reconciliation',
  'Do NOT ignore child safety concerns',
];

function selectResponseMode(detection: K04S4DetectionResult): K04S4ResponseMode {
  if (!detection.activated) return 'none';

  // Failsafe: severe → stabilization only
  if (detection.severity === 'severe') return 'stabilization';

  // Child concern always takes priority
  if (detection.primaryState === 'child_concern') return 'child_safety';

  switch (detection.primaryState) {
    case 'trust_erosion':
      return 'validation';
    case 'hope_exhaustion':
      return 'hope_recalibration';
    case 'hypervigilance':
      return 'reality_anchoring';
    case 'boundary_guilt':
      return 'boundary_permission';
    case 'isolation':
      return 'isolation_counter';
    case 'self_doubt':
      return 'validation';
    default:
      return 'none';
  }
}

export function routeK04S4Engine(
  detection: K04S4DetectionResult,
  progress: K04S4Progress | undefined,
): K04S4RoutingResult {
  if (!detection.activated) {
    return {
      activated: false,
      responseMode: 'none',
      primaryState: 'none',
      severity: 'mild',
      failsafeActive: false,
      doNots: [],
      promptBlock: null,
    };
  }

  const responseMode = selectResponseMode(detection);
  const failsafeActive = detection.severity === 'severe';

  const result: K04S4RoutingResult = {
    activated: true,
    responseMode,
    primaryState: detection.primaryState,
    severity: detection.severity,
    failsafeActive,
    doNots: DO_NOTS,
    promptBlock: null,
  };

  result.promptBlock = buildK04S4PromptBlock(result, detection, progress);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ════════════════════════════════════════════════════════════════════════════════

const STATE_GUIDANCE: Record<K04S4State, string> = {
  trust_erosion: `TRUST EROSION detected. Response: Validate the reality of repeated betrayal. "Trust erodes one lie at a time. One broken promise at a time. Your caution is not weakness — it is your nervous system remembering." Do NOT force trust rebuilding. Acknowledge the cost of repeated disappointment.`,
  hope_exhaustion: `HOPE EXHAUSTION detected. Response: Validate the exhaustion of rebuilding. "How many times have you had to rebuild yourself? How tired are you of starting over emotionally? Hope should never require self-destruction." Anchor hope to reality, not promises.`,
  hypervigilance: `HYPERVIGILANCE detected. Response: Validate as adaptation, not pathology. "Your nervous system learned from repetition. Repeated disappointment teaches caution. Repeated betrayal teaches vigilance. This is not weakness — this is adaptation." Do NOT tell them to relax or trust more.`,
  boundary_guilt: `BOUNDARY GUILT detected. Response: Permission and reframe. "A boundary is not punishment. A boundary is not abandonment. A boundary is information: this is where I end, this is what I can carry, this is what I need to remain healthy." You can love someone and still have limits.`,
  isolation: `ISOLATION detected. Response: Counter invisibility. "Your experience matters. Your pain matters. Your exhaustion matters. Your fear matters. Your limits matter. You matter." Actively counter the silence and loneliness caregivers carry.`,
  child_concern: `CHILD CONCERN detected. Response: Prioritize safety without blame. "Children feel more than we think. They understand tension, fear, instability, emotional absence." When safety vs family stability conflict → ALWAYS prioritize child safety. Children should never become emotional shock absorbers.`,
  self_doubt: `SELF-DOUBT detected. Response: Validate the reality beneath the doubt. "It makes sense that trust feels difficult after repeated hurt. Your nervous system did not become cautious without reason." Do NOT immediately challenge — first validate, then gently reality-anchor.`,
  none: '',
};

const CYCLIC_GUIDANCE = `CYCLIC PATTERN DETECTED: The caregiver is describing the fear-promise-relief-hope-trust-disappointment-grief cycle. Acknowledge the exhaustion of repetition. "Eventually the caregiver becomes tired. Not tired of loving. Tired of rebuilding. Tired of restarting emotionally. Tired of carrying hope alone."`;

const FAILSAFE_INSTRUCTIONS = `FAILSAFE ACTIVE (severe trust/hope crisis):
1. Validation only — no processing, no insight work
2. Short sentences — reduce cognitive load
3. Anchor to present safety — "Right now, in this moment, you are here"
4. No pressure to decide anything — boundaries can wait
5. Prioritize emotional stabilization over relational processing
6. If child safety is involved → direct, clear safety guidance`;

const CORE_PRINCIPLES = [
  'Trust is rebuilt through consistency, not promises',
  'Hope must remain connected to reality',
  'Hypervigilance is adaptation, not weakness',
  'Boundaries are not punishment',
  'Love does not require self-destruction',
  'Children feel more than we think',
  'Caregivers deserve protection too',
  'You are not responsible for another person\'s recovery',
  'You do not have to lose yourself to love someone',
];

function buildK04S4PromptBlock(
  routing: K04S4RoutingResult,
  detection: K04S4DetectionResult,
  progress: K04S4Progress | undefined,
): string {
  const lines: string[] = [];
  lines.push('=== K04-S4 BETRAYAL, TRUST, HOPE & SELF-PROTECTION ===');
  lines.push('Core truth: "People do not become guarded without reason."');
  lines.push('Kim never judges the caregiver\'s adaptation to repeated betrayal.');
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

  // Trust erosion depth
  if (detection.trustErosionDepth >= 3) {
    lines.push('');
    lines.push(`DEEP TRUST EROSION (depth: ${detection.trustErosionDepth}/5): This caregiver has experienced significant repeated betrayal. Do not suggest "trying again" or "giving another chance." Focus on the caregiver's right to protect themselves.`);
  }

  // Cyclic pattern
  if (detection.cyclicPattern) {
    lines.push('');
    lines.push(CYCLIC_GUIDANCE);
  }

  // Progress context
  if (progress) {
    if (progress.sessionsWithTrustErosion >= 3) {
      lines.push('');
      lines.push(`RECURRING TRUST EROSION: Detected in ${progress.sessionsWithTrustErosion} sessions. This is a persistent pattern. Consider gently exploring whether the caregiver is ready to examine what staying costs them.`);
    }
    if (progress.sessionsWithHopeExhaustion >= 3) {
      lines.push('');
      lines.push(`RECURRING HOPE EXHAUSTION: Detected in ${progress.sessionsWithHopeExhaustion} sessions. The caregiver may be in chronic hope-disappointment cycling. Validate the exhaustion without removing hope entirely.`);
    }
    if (progress.cyclicPatternCount >= 2) {
      lines.push('');
      lines.push(`CHRONIC CYCLING: The caregiver has described cyclic patterns in ${progress.cyclicPatternCount} sessions. They may be stuck in the fear-promise-hope-disappointment loop. Gently name the pattern if they haven't already.`);
    }
  }

  // Failsafe
  if (routing.failsafeActive) {
    lines.push('');
    lines.push(FAILSAFE_INSTRUCTIONS);
  }

  // Core principles (always include for context)
  lines.push('');
  lines.push('CORE PRINCIPLES:');
  for (const principle of CORE_PRINCIPLES) {
    lines.push(`- ${principle}`);
  }

  // Do NOTs
  lines.push('');
  lines.push('DO NOTs:');
  for (const doNot of DO_NOTS) {
    lines.push(`- ${doNot}`);
  }

  lines.push('=== END K04-S4 ===');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS UPDATE
// ════════════════════════════════════════════════════════════════════════════════

export function updateK04S4Progress(
  current: K04S4Progress | undefined,
  detection: K04S4DetectionResult,
  responseMode: K04S4ResponseMode,
): K04S4Progress {
  const p = current ?? createDefaultK04S4Progress();
  const updated: K04S4Progress = { ...p };

  if (detection.primaryState === 'trust_erosion') updated.sessionsWithTrustErosion++;
  if (detection.primaryState === 'hope_exhaustion') updated.sessionsWithHopeExhaustion++;
  if (detection.primaryState === 'hypervigilance') updated.sessionsWithHypervigilance++;
  if (detection.primaryState === 'boundary_guilt') updated.sessionsWithBoundaryGuilt++;
  if (detection.primaryState === 'isolation') updated.sessionsWithIsolation++;
  if (detection.primaryState === 'child_concern') updated.sessionsWithChildConcern++;

  if (detection.cyclicPattern) updated.cyclicPatternCount++;
  updated.lastResponseMode = responseMode;

  // Trust recovery trend
  const totalTrustSessions = updated.sessionsWithTrustErosion + updated.sessionsWithHopeExhaustion;
  if (totalTrustSessions <= 1) {
    updated.trustRecoveryTrend = 'unknown';
  } else if (updated.cyclicPatternCount >= 3 || updated.sessionsWithTrustErosion >= 5) {
    updated.trustRecoveryTrend = 'eroding';
  } else if (detection.severity === 'mild' && totalTrustSessions >= 4) {
    updated.trustRecoveryTrend = 'rebuilding';
  } else {
    updated.trustRecoveryTrend = 'stable';
  }

  return updated;
}
