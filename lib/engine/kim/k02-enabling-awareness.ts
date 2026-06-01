/**
 * K02 — Enabling Awareness Module (Kim Only)
 *
 * Canon: K02_ENABLING_AWARENESS_KIM_BOUNDARY_FIRST_FINAL_CANON_MANUS_READY
 *
 * Core principle: "Je hoeft jezelf niet kwijt te raken om iemand anders lief te hebben."
 *
 * K02 helps the partner recognize where care, love and involvement silently shift
 * into enabling, rescuing, controlling, excusing, or self-loss.
 *
 * K02 does NOT blame the partner. K02 makes visible.
 *
 * Primary intervention: awareness (bewustwording)
 * Secondary intervention: first microboundary
 * Structural boundary restoration → K03
 * Emotional regulation around guilt/fear/panic → K04
 *
 * Position: KO1 → K02 → K03 → K04
 * Orientation: Boundary First
 * Therapeutic layers: Motivational Interviewing, MBT, ACT, relational dynamics,
 *   validation without confirming self-loss, gentle reality check
 *
 * This module provides:
 * 1. Boundary flag detection (self-loss, guilt, rescuing, control-as-care, hypervigilance, abandonment fear)
 * 2. Five intervention states (soft awareness, clear reality check, guilt containment, boundary warning, escalate K04)
 * 3. Routing logic with K03/K04 routing
 * 4. Prompt injection block builder
 * 5. Session state and progress tracking
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type K02AwarenessLevel = 'none' | 'emerging' | 'clear' | 'integrated';

export type K02GuildIntensity = 'low' | 'medium' | 'high' | 'overwhelming';

export type K02SelfLossLevel = 'low' | 'medium' | 'high' | 'severe';

export type K02BoundaryReadiness = 'none' | 'microboundary' | 'restoration_ready' | 'overwhelmed';

export type K02RouteRecommendation = 'stay_k02' | 'route_k03_boundary_restoration' | 'route_k04_emotional_regulation' | 'safety_override';

export type K02BoundaryFlagId =
  | 'SELF_LOSS'
  | 'GUILT'
  | 'RESCUING'
  | 'CONTROL_AS_CARE'
  | 'HYPERVIGILANCE'
  | 'ABANDONMENT_FEAR';

export type K02InterventionState =
  | 'SOFT_AWARENESS'
  | 'CLEAR_REALITY_CHECK'
  | 'GUILT_CONTAINMENT'
  | 'BOUNDARY_WARNING'
  | 'ESCALATE_K04';

export interface K02Signal {
  flagId: K02BoundaryFlagId;
  confidence: number;
  evidence: string;
}

export interface K02DetectionResult {
  signals: K02Signal[];
  dominantFlag: K02BoundaryFlagId | null;
  dominantConfidence: number;
  guiltIntensity: K02GuildIntensity;
  selfLossLevel: K02SelfLossLevel;
}

export interface K02Decision {
  activated: boolean;
  interventionState: K02InterventionState;
  dominantFlag: K02BoundaryFlagId | null;
  awarenessLevel: K02AwarenessLevel;
  boundaryReadiness: K02BoundaryReadiness;
  routeRecommendation: K02RouteRecommendation;
  reason: string;
}

export interface K02EngineResult {
  activated: boolean;
  decision: K02Decision;
  promptBlock: string | null;
}

export interface K02Progress {
  awarenessLevel: K02AwarenessLevel;
  dominantFlags: K02BoundaryFlagId[];
  guiltIntensity: K02GuildIntensity;
  selfLossLevel: K02SelfLossLevel;
  microboundaryAttempted: boolean;
  lastSessionDate: string | null;
  sessionCount: number;
}

export interface K02EngineInput {
  message: string;
  userType: string;
  eigenRegieScore: number | null;
  crisisLevel: number;
  stressScore: number;
  boundaryFatigueScore: number;
  emotionalBurdenScore: number;
  sessionMessageCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export function createDefaultK02Progress(): K02Progress {
  return {
    awarenessLevel: 'none',
    dominantFlags: [],
    guiltIntensity: 'low',
    selfLossLevel: 'low',
    microboundaryAttempted: false,
    lastSessionDate: null,
    sessionCount: 0,
  };
}

// ─── Boundary Flag Markers (deterministic detection) ─────────────────────

const SELF_LOSS_MARKERS = [
  // Dutch (primary)
  'ik weet niet meer wie ik ben', 'alles draait rond hem', 'alles draait rond haar',
  'ik heb geen ruimte meer', 'ik cijfer mezelf weg', 'ik kan niet meer ontspannen',
  'ik leef op zijn stemming', 'ik leef op haar stemming', 'ik besta niet meer',
  'ik ben mezelf kwijt', 'ik heb geen eigen leven', 'wie ben ik nog',
  'ik doe niets meer voor mezelf', 'ik vergeet mezelf',
  // English
  'i dont know who i am anymore', 'everything revolves around him', 'everything revolves around her',
  'i have no space left', 'i erase myself', 'i cant relax anymore',
  'i live on his mood', 'i live on her mood', 'i dont exist anymore',
  'i lost myself', 'i have no life of my own', 'who am i anymore',
  'i do nothing for myself', 'i forget myself',
];

const GUILT_MARKERS = [
  // Dutch (primary)
  'ik voel me schuldig', 'ik ben egoistisch', 'ik laat hem vallen', 'ik laat haar vallen',
  'ik kan dit niet maken', 'wat als er iets gebeurt door mij', 'het is mijn schuld',
  'ik ben een slecht mens', 'ik mag niet klagen', 'ik moet sterk blijven',
  'als ik grenzen stel ben ik egoistisch', 'als ik loslaat gebeurt er iets ergs',
  'als ik stop met redden laat ik hem vallen', 'als ik stop met redden laat ik haar vallen',
  'ik verdien dit niet', 'schuldig',
  // English
  'i feel guilty', 'im selfish', 'im letting him down', 'im letting her down',
  'i cant do this', 'what if something happens because of me', 'its my fault',
  'im a bad person', 'i shouldnt complain', 'i must stay strong',
  'if i set boundaries im selfish', 'if i let go something bad will happen',
  'if i stop rescuing i abandon him', 'if i stop rescuing i abandon her',
  'i dont deserve this', 'guilty',
];

const RESCUING_MARKERS = [
  // Dutch (primary)
  'ik los het altijd op', 'ik betaal het wel', 'ik verzin excuses',
  'ik vang alles op', 'ik blijf toch gaan', 'ik controleer omdat ik moet',
  'ik red hem', 'ik red haar', 'ik neem het over', 'ik maak het goed',
  'ik bescherm tegen gevolgen', 'ik dek het af', 'ik lieg voor hem',
  'ik lieg voor haar', 'ik regel alles', 'ik houd alles draaiend',
  // English
  'i always fix it', 'i pay for it', 'i make excuses',
  'i catch everything', 'i keep going anyway', 'i control because i have to',
  'i rescue him', 'i rescue her', 'i take over', 'i make it right',
  'i protect from consequences', 'i cover it up', 'i lie for him',
  'i lie for her', 'i arrange everything', 'i keep everything running',
];

const CONTROL_AS_CARE_MARKERS = [
  // Dutch (primary)
  'ik check zijn telefoon', 'ik check haar telefoon', 'ik controleer waar hij is',
  'ik controleer waar zij is', 'ik moet weten of hij gebruikt', 'ik moet weten of zij gebruikt',
  'anders loopt het mis', 'ik doe het uit liefde', 'ik moet alles in de gaten houden',
  'ik scan alles', 'ik controleer zijn geld', 'ik controleer haar geld',
  // English
  'i check his phone', 'i check her phone', 'i monitor where he is',
  'i monitor where she is', 'i need to know if he uses', 'i need to know if she uses',
  'otherwise it goes wrong', 'i do it out of love', 'i have to watch everything',
  'i scan everything', 'i control his money', 'i control her money',
];

const HYPERVIGILANCE_MARKERS = [
  // Dutch (primary)
  'ik scan alles', 'ik voel het meteen', 'ik slaap niet meer',
  'ik let op elk teken', 'ik ben altijd alert', 'ik kan niet stoppen met checken',
  'ik lig wakker', 'ik luister of hij thuiskomt', 'ik luister of zij thuiskomt',
  'ik ruik aan zijn adem', 'ik ruik aan haar adem', 'ik zoek bewijs',
  // English
  'i scan everything', 'i feel it immediately', 'i cant sleep anymore',
  'i watch for every sign', 'im always alert', 'i cant stop checking',
  'i lie awake', 'i listen if he comes home', 'i listen if she comes home',
  'i smell his breath', 'i smell her breath', 'i look for evidence',
];

const ABANDONMENT_FEAR_MARKERS = [
  // Dutch (primary)
  'als ik stop ben ik hem kwijt', 'als ik stop ben ik haar kwijt',
  'dan kiest hij zeker voor gebruik', 'dan kiest zij zeker voor gebruik',
  'dan ben ik de schuldige', 'ik ben bang dat alles instort',
  'als ik verander verlies ik hem', 'als ik verander verlies ik haar',
  'als ik loslaat is het voorbij', 'hij verlaat me', 'zij verlaat me',
  'ik ben bang alleen te zijn', 'zonder mij gaat hij dood', 'zonder mij gaat zij dood',
  // English
  'if i stop i lose him', 'if i stop i lose her',
  'then he will choose drugs', 'then she will choose drugs',
  'then im the guilty one', 'im afraid everything will collapse',
  'if i change i lose him', 'if i change i lose her',
  'if i let go its over', 'he will leave me', 'she will leave me',
  'im afraid to be alone', 'without me he will die', 'without me she will die',
];

// ─── Detector ──────────────────────────────────────────────────────────────

function detectFlag(message: string, markers: string[]): { found: boolean; evidence: string; matchCount: number } {
  const lower = message.toLowerCase();
  let matchCount = 0;
  let firstEvidence = '';
  for (const m of markers) {
    if (lower.includes(m)) {
      matchCount++;
      if (!firstEvidence) firstEvidence = m;
    }
  }
  return { found: matchCount > 0, evidence: firstEvidence, matchCount };
}

export function detectK02BoundaryFlags(message: string): K02DetectionResult {
  const signals: K02Signal[] = [];

  const flags: Array<{ id: K02BoundaryFlagId; markers: string[]; baseConfidence: number }> = [
    { id: 'SELF_LOSS', markers: SELF_LOSS_MARKERS, baseConfidence: 0.85 },
    { id: 'GUILT', markers: GUILT_MARKERS, baseConfidence: 0.80 },
    { id: 'RESCUING', markers: RESCUING_MARKERS, baseConfidence: 0.80 },
    { id: 'CONTROL_AS_CARE', markers: CONTROL_AS_CARE_MARKERS, baseConfidence: 0.75 },
    { id: 'HYPERVIGILANCE', markers: HYPERVIGILANCE_MARKERS, baseConfidence: 0.75 },
    { id: 'ABANDONMENT_FEAR', markers: ABANDONMENT_FEAR_MARKERS, baseConfidence: 0.80 },
  ];

  for (const f of flags) {
    const result = detectFlag(message, f.markers);
    if (result.found) {
      // Boost confidence with multiple matches
      const confidence = Math.min(f.baseConfidence + (result.matchCount - 1) * 0.05, 0.95);
      signals.push({ flagId: f.id, confidence, evidence: result.evidence });
    }
  }

  // Sort by confidence descending
  signals.sort((a, b) => b.confidence - a.confidence);

  // Determine guilt intensity
  const guiltSignal = signals.find(s => s.flagId === 'GUILT');
  const guiltMatchCount = guiltSignal ? detectFlag(message, GUILT_MARKERS).matchCount : 0;
  let guiltIntensity: K02GuildIntensity = 'low';
  if (guiltMatchCount >= 3) guiltIntensity = 'overwhelming';
  else if (guiltMatchCount >= 2) guiltIntensity = 'high';
  else if (guiltMatchCount >= 1) guiltIntensity = 'medium';

  // Determine self-loss level
  const selfLossSignal = signals.find(s => s.flagId === 'SELF_LOSS');
  const selfLossMatchCount = selfLossSignal ? detectFlag(message, SELF_LOSS_MARKERS).matchCount : 0;
  let selfLossLevel: K02SelfLossLevel = 'low';
  if (selfLossMatchCount >= 3) selfLossLevel = 'severe';
  else if (selfLossMatchCount >= 2) selfLossLevel = 'high';
  else if (selfLossMatchCount >= 1) selfLossLevel = 'medium';

  return {
    signals,
    dominantFlag: signals.length > 0 ? signals[0].flagId : null,
    dominantConfidence: signals.length > 0 ? signals[0].confidence : 0,
    guiltIntensity,
    selfLossLevel,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────

// Session state tracking
let sessionK02FlagsUsed: K02BoundaryFlagId[] = [];
let sessionK02InterventionStates: K02InterventionState[] = [];

export function resetK02SessionState(): void {
  sessionK02FlagsUsed = [];
  sessionK02InterventionStates = [];
}

export function getSessionK02FlagsUsed(): K02BoundaryFlagId[] {
  return [...sessionK02FlagsUsed];
}

export function getSessionK02InterventionStates(): K02InterventionState[] {
  return [...sessionK02InterventionStates];
}

function resolveInterventionState(
  detection: K02DetectionResult,
  input: K02EngineInput,
): K02InterventionState {
  // Escalate to K04 if overwhelmed
  if (detection.guiltIntensity === 'overwhelming' || input.emotionalBurdenScore >= 9 || input.crisisLevel >= 2) {
    return 'ESCALATE_K04';
  }

  // Boundary warning if self-loss severe or burnout
  if (detection.selfLossLevel === 'severe' || input.boundaryFatigueScore >= 8) {
    return 'BOUNDARY_WARNING';
  }

  // Guilt containment if guilt is primary driver
  if (detection.guiltIntensity === 'high' || (detection.dominantFlag === 'GUILT' && detection.dominantConfidence >= 0.80)) {
    return 'GUILT_CONTAINMENT';
  }

  // Clear reality check if rescuing/control pattern visible and user can tolerate
  if ((detection.dominantFlag === 'RESCUING' || detection.dominantFlag === 'CONTROL_AS_CARE') && input.stressScore < 8) {
    return 'CLEAR_REALITY_CHECK';
  }

  // Default: soft awareness
  return 'SOFT_AWARENESS';
}

function resolveAwarenessLevel(progress: K02Progress, detection: K02DetectionResult): K02AwarenessLevel {
  // If user already has integrated awareness from previous sessions
  if (progress.awarenessLevel === 'integrated') return 'integrated';
  if (progress.awarenessLevel === 'clear' && detection.signals.length > 0) return 'clear';
  if (progress.sessionCount >= 3 && detection.signals.length > 0) return 'clear';
  if (progress.sessionCount >= 1 && detection.signals.length > 0) return 'emerging';
  if (detection.signals.length > 0) return 'emerging';
  return progress.awarenessLevel;
}

function resolveBoundaryReadiness(detection: K02DetectionResult, input: K02EngineInput): K02BoundaryReadiness {
  if (detection.guiltIntensity === 'overwhelming' || input.emotionalBurdenScore >= 9) return 'overwhelmed';
  if (detection.selfLossLevel === 'severe' && input.boundaryFatigueScore >= 7) return 'restoration_ready';
  if (detection.signals.length >= 2 && input.stressScore < 7) return 'microboundary';
  if (detection.signals.length >= 1) return 'microboundary';
  return 'none';
}

function resolveRouteRecommendation(
  interventionState: K02InterventionState,
  detection: K02DetectionResult,
  input: K02EngineInput,
): K02RouteRecommendation {
  // Safety override
  if (input.crisisLevel >= 3) return 'safety_override';

  // Escalate to K04
  if (interventionState === 'ESCALATE_K04') return 'route_k04_emotional_regulation';

  // Route to K03 if boundary restoration ready and awareness is clear
  if (interventionState === 'BOUNDARY_WARNING' && detection.selfLossLevel === 'severe') {
    return 'route_k03_boundary_restoration';
  }

  // Stay in K02
  return 'stay_k02';
}

export function routeK02Engine(input: K02EngineInput, progress: K02Progress): K02EngineResult {
  // ─── Gate: Kim only ──────────────────────────────────────────────────────
  if (input.userType !== 'kim') {
    return {
      activated: false,
      decision: {
        activated: false,
        interventionState: 'SOFT_AWARENESS',
        dominantFlag: null,
        awarenessLevel: 'none',
        boundaryReadiness: 'none',
        routeRecommendation: 'stay_k02',
        reason: 'K02 is Kim-only module',
      },
      promptBlock: null,
    };
  }

  // ─── Detect boundary flags ──────────────────────────────────────────────
  const detection = detectK02BoundaryFlags(input.message);

  if (detection.signals.length === 0) {
    return {
      activated: false,
      decision: {
        activated: false,
        interventionState: 'SOFT_AWARENESS',
        dominantFlag: null,
        awarenessLevel: progress.awarenessLevel,
        boundaryReadiness: 'none',
        routeRecommendation: 'stay_k02',
        reason: 'No K02 boundary flags detected',
      },
      promptBlock: null,
    };
  }

  // ─── Resolve intervention state ─────────────────────────────────────────
  const interventionState = resolveInterventionState(detection, input);

  // ─── Resolve awareness level ────────────────────────────────────────────
  const awarenessLevel = resolveAwarenessLevel(progress, detection);

  // ─── Resolve boundary readiness ─────────────────────────────────────────
  const boundaryReadiness = resolveBoundaryReadiness(detection, input);

  // ─── Resolve route recommendation ──────────────────────────────────────
  const routeRecommendation = resolveRouteRecommendation(interventionState, detection, input);

  // ─── Track session usage ────────────────────────────────────────────────
  if (detection.dominantFlag) {
    sessionK02FlagsUsed.push(detection.dominantFlag);
  }
  sessionK02InterventionStates.push(interventionState);

  // ─── Build prompt block ─────────────────────────────────────────────────
  const promptBlock = buildK02PromptBlock(
    detection,
    interventionState,
    awarenessLevel,
    boundaryReadiness,
    routeRecommendation,
  );

  const decision: K02Decision = {
    activated: true,
    interventionState,
    dominantFlag: detection.dominantFlag,
    awarenessLevel,
    boundaryReadiness,
    routeRecommendation,
    reason: `K02 flag=${detection.dominantFlag} conf=${detection.dominantConfidence.toFixed(2)} state=${interventionState} route=${routeRecommendation}`,
  };

  return {
    activated: true,
    decision,
    promptBlock,
  };
}

// ─── Prompt Builder ────────────────────────────────────────────────────────
// Budget: max 7 lines + wrapper. Compact injection for GPT context window.

function buildK02PromptBlock(
  detection: K02DetectionResult,
  interventionState: K02InterventionState,
  awarenessLevel: K02AwarenessLevel,
  boundaryReadiness: K02BoundaryReadiness,
  routeRecommendation: K02RouteRecommendation,
): string {
  const lines: string[] = [
    `[K02_ENABLING_AWARENESS]`,
    `Core: "Je hoeft jezelf niet kwijt te raken om iemand anders lief te hebben."`,
    `Flag: ${formatFlag(detection.dominantFlag!)} | State: ${formatInterventionState(interventionState)} | Guilt: ${detection.guiltIntensity} | Self-loss: ${detection.selfLossLevel}`,
    `Response formula: 1) See intent 2) Name pattern gently 3) Separate love from fear/guilt 4) Boundary First 5) Offer microboundary or reflective question`,
  ];

  // Add intervention-specific guidance
  const guidance = getInterventionGuidance(interventionState);
  if (guidance) {
    lines.push(guidance);
  }

  // Add forbidden behaviors
  lines.push(`Forbidden: Never blame partner. Never push to leave. Never make partner responsible for recovery of dependent. Never use guilt to maintain compliance.`);

  // Route recommendation
  if (routeRecommendation !== 'stay_k02') {
    lines.push(`Route: ${formatRoute(routeRecommendation)}`);
  }

  lines.push(`[/K02_ENABLING_AWARENESS]`);
  return lines.join('\n');
}

function formatFlag(flag: K02BoundaryFlagId): string {
  const map: Record<K02BoundaryFlagId, string> = {
    'SELF_LOSS': 'self-loss detected → make visible where partner disappears, offer microboundary',
    'GUILT': 'guilt driving behavior → normalize guilt, distinguish from responsibility, slow down',
    'RESCUING': 'rescuing pattern → validate intent, name cost, separate love from rescue',
    'CONTROL_AS_CARE': 'control-as-care → validate fear underneath, show exhaustion cost of control',
    'HYPERVIGILANCE': 'hypervigilance → validate fear, show system exhaustion, first pause',
    'ABANDONMENT_FEAR': 'abandonment fear → validate fear of loss, show self-loss paradox',
  };
  return map[flag] ?? flag;
}

function formatInterventionState(state: K02InterventionState): string {
  const map: Record<K02InterventionState, string> = {
    'SOFT_AWARENESS': 'Soft awareness: validate → softly name pattern → one reflective question → offer microboundary',
    'CLEAR_REALITY_CHECK': 'Clear reality check: validate intent → name cost → separate love from responsibility → boundary-first frame',
    'GUILT_CONTAINMENT': 'Guilt containment: normalize guilt → distinguish guilt from responsibility → slow down decision → suggest K04 if escalates',
    'BOUNDARY_WARNING': 'Boundary warning: warm but direct → no blame → identify risk of continued self-erasure → route toward K03',
    'ESCALATE_K04': 'Escalate K04: pause insight work → regulate first → route to K04 Emotional Regulation',
  };
  return map[state] ?? state;
}

function getInterventionGuidance(state: K02InterventionState): string | null {
  switch (state) {
    case 'SOFT_AWARENESS':
      return `Tone: warm, exploratory. Ask: "Where did your own needs go in all of this?"`;
    case 'CLEAR_REALITY_CHECK':
      return `Tone: warm but clear. Name: "This form of helping may cost more than it gives."`;
    case 'GUILT_CONTAINMENT':
      return `Tone: containing, normalizing. Say: "Guilt arriving when you stop carrying does not mean you are wrong."`;
    case 'BOUNDARY_WARNING':
      return `Tone: warm but direct. Warn: "If you keep absorbing everything, your exhaustion becomes part of the system."`;
    case 'ESCALATE_K04':
      return `Tone: regulating. Say: "We don't need to think harder right now. First, let your system settle."`;
    default:
      return null;
  }
}

function formatRoute(route: K02RouteRecommendation): string {
  const map: Record<K02RouteRecommendation, string> = {
    'stay_k02': 'Stay in K02',
    'route_k03_boundary_restoration': 'Route to K03 Boundary Restoration (boundaries need structural work)',
    'route_k04_emotional_regulation': 'Route to K04 Emotional Regulation (regulate before insight)',
    'safety_override': 'SAFETY OVERRIDE: Stop insight work, prioritize immediate safety',
  };
  return map[route] ?? route;
}
