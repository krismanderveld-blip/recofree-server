/**
 * K05 — Communication Skills Module (Kim Only)
 *
 * Canon: RECOFREE_K05_COMMUNICATION_SKILLS_KIM_MANUS_READY
 *
 * Core principle: "Healthy communication protects both people.
 * Kim communicates with care. Kim keeps boundaries. Kim does not disappear."
 *
 * Communication framework: Observation → Feeling → Boundary → Request → Next step.
 * Boundary-first.
 *
 * This module provides:
 * 1. Communication context detection (timing, intoxication, escalation, ghosting, reassurance loops)
 * 2. Communication mode routing (de-escalation, boundary language, repair, pause)
 * 3. Timing matrix evaluation (good/bad time to talk)
 * 4. Prompt injection block builder
 * 5. Session state and progress tracking
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type K05CommunicationContext =
  | 'INTOXICATION_PRESENT'
  | 'ESCALATION_ACTIVE'
  | 'GHOSTING_RESPONSE'
  | 'REASSURANCE_LOOP'
  | 'LYING_CONFRONTATION'
  | 'REPAIR_NEEDED'
  | 'BOUNDARY_SETTING'
  | 'TIMING_BAD'
  | 'TIMING_GOOD';

export type K05CommunicationMode =
  | 'PAUSE_CONVERSATION'
  | 'DE_ESCALATE'
  | 'BOUNDARY_LANGUAGE'
  | 'REPAIR_FLOW'
  | 'REGULATE_FIRST'
  | 'CALM_CONFRONTATION'
  | 'HEALTHY_CONTACT'
  | 'FRAMEWORK_GUIDE';

export interface K05Signal {
  context: K05CommunicationContext;
  confidence: number;
  evidence: string;
}

export interface K05DetectionResult {
  signals: K05Signal[];
  dominantContext: K05CommunicationContext | null;
  dominantConfidence: number;
  timingAssessment: 'GOOD' | 'BAD' | 'NEUTRAL';
}

export interface K05Decision {
  activated: boolean;
  communicationMode: K05CommunicationMode;
  dominantContext: K05CommunicationContext | null;
  timingAssessment: 'GOOD' | 'BAD' | 'NEUTRAL';
  reason: string;
  intoxicationBlock: boolean;
  frameworkSuggested: boolean;
}

export interface K05EngineResult {
  activated: boolean;
  decision: K05Decision;
  promptBlock: string | null;
}

export interface K05Progress {
  communicationTriggersDetected: string[];
  repairPatternsUsed: string[];
  escalationPatternsDetected: number;
  lastCommunicationMode: string | null;
  lastSessionDate: string | null;
  timingViolationCount: number;
}

export interface K05EngineInput {
  message: string;
  userType: string;
  vspLevel: string;
  crisisLevel: number;
  frustrationScore: number;
  eigenRegieScore: number | null;
  sessionMessageCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export function createDefaultK05Progress(): K05Progress {
  return {
    communicationTriggersDetected: [],
    repairPatternsUsed: [],
    escalationPatternsDetected: 0,
    lastCommunicationMode: null,
    lastSessionDate: null,
    timingViolationCount: 0,
  };
}

// ─── Communication Markers (deterministic detection) ─────────────────────

const INTOXICATION_MARKERS = [
  'drunk', 'drinking', 'high', 'using', 'intoxicated', 'wasted',
  'under the influence', 'been drinking', 'smells like alcohol',
  'stoned', 'on something', 'not sober',
  // Dutch
  'dronken', 'aan het drinken', 'high', 'gebruikt', 'beschonken',
  'onder invloed', 'heeft gedronken', 'ruikt naar alcohol',
  'stoned', 'niet nuchter', 'bezopen',
];

const ESCALATION_MARKERS = [
  'shouting', 'screaming', 'yelling', 'fight', 'fighting', 'argument',
  'exploded', 'blew up', 'lost it', 'cant take it', 'had enough',
  'going to say everything', 'send the message', 'ultimatum',
  'going to confront', 'cant hold back', 'going to explode',
  // Dutch
  'schreeuwen', 'gillen', 'ruzie', 'gevecht', 'ontploft',
  'klapte', 'verloor het', 'kan het niet meer', 'heb er genoeg van',
  'ga alles zeggen', 'stuur het bericht', 'ultimatum',
  'ga confronteren', 'kan me niet inhouden', 'ga ontploffen',
];

const GHOSTING_RESPONSE_MARKERS = [
  'not responding', 'disappeared', 'gone silent', 'ignoring',
  'no contact', 'radio silence', 'ghosting', 'vanished',
  'wont answer', 'not picking up', 'blocked me',
  // Dutch
  'reageert niet', 'verdwenen', 'stil', 'negeert',
  'geen contact', 'radiostilte', 'weg', 'neemt niet op',
  'heeft me geblokkeerd', 'geen antwoord',
];

const REASSURANCE_LOOP_MARKERS = [
  'promise me', 'tell me it will be ok', 'are you sure',
  'do you think', 'what if it happens again', 'just tell me',
  'say it again', 'i need to hear', 'reassure me',
  'will it be fine', 'is it going to be ok',
  // Dutch
  'beloof me', 'zeg dat het goed komt', 'weet je het zeker',
  'denk je', 'wat als het weer gebeurt', 'zeg het nog eens',
  'ik moet het horen', 'stel me gerust', 'komt het goed',
];

const LYING_CONFRONTATION_MARKERS = [
  'lying', 'lied', 'not telling the truth', 'caught',
  'found out', 'hiding something', 'denying', 'covering up',
  'i dont believe', 'not being honest', 'confronted',
  // Dutch
  'liegt', 'gelogen', 'vertelt niet de waarheid', 'betrapt',
  'ontdekt', 'verbergt iets', 'ontkent', 'verdoezelt',
  'ik geloof het niet', 'niet eerlijk', 'geconfronteerd',
];

const REPAIR_MARKERS = [
  'want to repair', 'after the fight', 'after argument',
  'make it right', 'fix this', 'apologize', 'sorry for',
  'how do we move forward', 'what happened', 'what hurt',
  'want to talk about what happened', 'need to reconnect',
  // Dutch
  'wil herstellen', 'na de ruzie', 'na het gevecht',
  'goed maken', 'oplossen', 'excuses', 'sorry voor',
  'hoe gaan we verder', 'wat is er gebeurd', 'wat deed pijn',
  'wil praten over wat er gebeurde', 'weer verbinden',
];

const BOUNDARY_SETTING_MARKERS = [
  'need to set a boundary', 'how do i say no', 'cant keep doing this',
  'need to tell them', 'want to communicate', 'difficult conversation',
  'how do i bring this up', 'need to talk about',
  'want to say something but', 'afraid to say',
  // Dutch
  'moet een grens stellen', 'hoe zeg ik nee', 'kan dit niet blijven doen',
  'moet het zeggen', 'wil communiceren', 'moeilijk gesprek',
  'hoe breng ik dit ter sprake', 'moet praten over',
  'wil iets zeggen maar', 'bang om te zeggen',
];

const BAD_TIMING_MARKERS = [
  'right now', 'in the middle of', 'while drunk', 'while high',
  'during a fight', 'while shouting', 'in panic', 'flooding',
  'cant think straight', 'too emotional', 'too angry',
  // Dutch
  'nu meteen', 'midden in', 'terwijl dronken', 'terwijl high',
  'tijdens een ruzie', 'terwijl schreeuwen', 'in paniek', 'overstroomd',
  'kan niet helder denken', 'te emotioneel', 'te boos',
];

// ─── Detector ──────────────────────────────────────────────────────────────

function detectContext(message: string, markers: string[]): { found: boolean; evidence: string } {
  const lower = message.toLowerCase();
  const match = markers.find(m => lower.includes(m));
  return match ? { found: true, evidence: match } : { found: false, evidence: '' };
}

export function detectK05CommunicationContext(message: string): K05DetectionResult {
  const signals: K05Signal[] = [];

  const contexts: Array<{ id: K05CommunicationContext; markers: string[]; baseConfidence: number }> = [
    { id: 'INTOXICATION_PRESENT', markers: INTOXICATION_MARKERS, baseConfidence: 0.90 },
    { id: 'ESCALATION_ACTIVE', markers: ESCALATION_MARKERS, baseConfidence: 0.85 },
    { id: 'GHOSTING_RESPONSE', markers: GHOSTING_RESPONSE_MARKERS, baseConfidence: 0.75 },
    { id: 'REASSURANCE_LOOP', markers: REASSURANCE_LOOP_MARKERS, baseConfidence: 0.70 },
    { id: 'LYING_CONFRONTATION', markers: LYING_CONFRONTATION_MARKERS, baseConfidence: 0.80 },
    { id: 'REPAIR_NEEDED', markers: REPAIR_MARKERS, baseConfidence: 0.75 },
    { id: 'BOUNDARY_SETTING', markers: BOUNDARY_SETTING_MARKERS, baseConfidence: 0.75 },
    { id: 'TIMING_BAD', markers: BAD_TIMING_MARKERS, baseConfidence: 0.80 },
  ];

  for (const ctx of contexts) {
    const result = detectContext(message, ctx.markers);
    if (result.found) {
      signals.push({ context: ctx.id, confidence: ctx.baseConfidence, evidence: result.evidence });
    }
  }

  // Sort by confidence descending
  signals.sort((a, b) => b.confidence - a.confidence);

  // Assess timing
  let timingAssessment: 'GOOD' | 'BAD' | 'NEUTRAL' = 'NEUTRAL';
  if (signals.some(s => s.context === 'INTOXICATION_PRESENT' || s.context === 'TIMING_BAD' || s.context === 'ESCALATION_ACTIVE')) {
    timingAssessment = 'BAD';
  } else if (signals.some(s => s.context === 'REPAIR_NEEDED' || s.context === 'BOUNDARY_SETTING')) {
    timingAssessment = 'GOOD';
  }

  return {
    signals,
    dominantContext: signals.length > 0 ? signals[0].context : null,
    dominantConfidence: signals.length > 0 ? signals[0].confidence : 0,
    timingAssessment,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────

// Session state tracking
let sessionK05ModesUsed: K05CommunicationMode[] = [];

export function resetK05SessionState(): void {
  sessionK05ModesUsed = [];
}

export function getSessionK05ModesUsed(): K05CommunicationMode[] {
  return [...sessionK05ModesUsed];
}

function resolveCommunicationMode(
  context: K05CommunicationContext | null,
  vspLevel: string,
  crisisLevel: number,
  frustrationScore: number,
): K05CommunicationMode {
  // Crisis/intoxication override: always pause
  if (crisisLevel >= 2 || vspLevel === 'ROOD' || vspLevel === 'PAARS') {
    return 'PAUSE_CONVERSATION';
  }

  if (!context) return 'FRAMEWORK_GUIDE';

  switch (context) {
    case 'INTOXICATION_PRESENT':
      return 'PAUSE_CONVERSATION';
    case 'ESCALATION_ACTIVE':
      return frustrationScore >= 7 ? 'PAUSE_CONVERSATION' : 'DE_ESCALATE';
    case 'GHOSTING_RESPONSE':
      return 'HEALTHY_CONTACT';
    case 'REASSURANCE_LOOP':
      return 'REGULATE_FIRST';
    case 'LYING_CONFRONTATION':
      return 'CALM_CONFRONTATION';
    case 'REPAIR_NEEDED':
      return 'REPAIR_FLOW';
    case 'BOUNDARY_SETTING':
      return 'BOUNDARY_LANGUAGE';
    case 'TIMING_BAD':
      return 'PAUSE_CONVERSATION';
    case 'TIMING_GOOD':
      return 'FRAMEWORK_GUIDE';
    default:
      return 'FRAMEWORK_GUIDE';
  }
}

export function routeK05Engine(input: K05EngineInput, progress: K05Progress): K05EngineResult {
  // ─── Gate: Kim only ──────────────────────────────────────────────────────
  if (input.userType !== 'kim') {
    return {
      activated: false,
      decision: {
        activated: false,
        communicationMode: 'FRAMEWORK_GUIDE',
        dominantContext: null,
        timingAssessment: 'NEUTRAL',
        reason: 'K05 is Kim-only module',
        intoxicationBlock: false,
        frameworkSuggested: false,
      },
      promptBlock: null,
    };
  }

  // ─── Detect communication context ───────────────────────────────────────
  const detection = detectK05CommunicationContext(input.message);

  if (detection.signals.length === 0) {
    return {
      activated: false,
      decision: {
        activated: false,
        communicationMode: 'FRAMEWORK_GUIDE',
        dominantContext: null,
        timingAssessment: 'NEUTRAL',
        reason: 'No K05 communication context detected',
        intoxicationBlock: false,
        frameworkSuggested: false,
      },
      promptBlock: null,
    };
  }

  // ─── Resolve communication mode ─────────────────────────────────────────
  const communicationMode = resolveCommunicationMode(
    detection.dominantContext,
    input.vspLevel,
    input.crisisLevel,
    input.frustrationScore,
  );

  // ─── Intoxication block ─────────────────────────────────────────────────
  const intoxicationBlock = detection.signals.some(s => s.context === 'INTOXICATION_PRESENT');

  // ─── Framework suggested when boundary/repair context ───────────────────
  const frameworkSuggested = (
    detection.dominantContext === 'BOUNDARY_SETTING' ||
    detection.dominantContext === 'REPAIR_NEEDED' ||
    detection.dominantContext === 'LYING_CONFRONTATION'
  );

  // ─── Track session usage ────────────────────────────────────────────────
  sessionK05ModesUsed.push(communicationMode);

  // ─── Build prompt block ─────────────────────────────────────────────────
  const promptBlock = buildK05PromptBlock(
    detection.dominantContext!,
    communicationMode,
    detection.timingAssessment,
    intoxicationBlock,
    frameworkSuggested,
  );

  const decision: K05Decision = {
    activated: true,
    communicationMode,
    dominantContext: detection.dominantContext,
    timingAssessment: detection.timingAssessment,
    reason: `K05 context=${detection.dominantContext} conf=${detection.dominantConfidence.toFixed(2)} mode=${communicationMode}`,
    intoxicationBlock,
    frameworkSuggested,
  };

  return {
    activated: true,
    decision,
    promptBlock,
  };
}

// ─── Prompt Builder ────────────────────────────────────────────────────────
// Budget: max 6 lines + wrapper. Compact injection for GPT context window.

function buildK05PromptBlock(
  context: K05CommunicationContext,
  mode: K05CommunicationMode,
  timing: 'GOOD' | 'BAD' | 'NEUTRAL',
  intoxicationBlock: boolean,
  frameworkSuggested: boolean,
): string {
  const lines: string[] = [
    `[K05_COMMUNICATION_SKILLS]`,
    `Context: ${formatContext(context)} | Mode: ${formatMode(mode)} | Timing: ${timing}`,
  ];

  if (intoxicationBlock) {
    lines.push(`INTOXICATION RULE: Never have serious conversations during intoxication. Pause. "I want this conversation, but not while substances are involved."`);
  }

  if (frameworkSuggested) {
    lines.push(`Framework: Observation → Feeling → Boundary → Request → Next step. Avoid "You always/never..." language.`);
  }

  // Mode-specific guidance
  const guidance = getModeGuidance(mode);
  if (guidance) {
    lines.push(guidance);
  }

  // Forbidden behaviors
  lines.push(`Forbidden: rescue-first, therapist role, guilt compliance, emotional surrender, detective obsession, humiliation, contempt, self-erasure.`);

  lines.push(`[/K05_COMMUNICATION_SKILLS]`);
  return lines.join('\n');
}

function formatContext(context: K05CommunicationContext): string {
  const map: Record<K05CommunicationContext, string> = {
    'INTOXICATION_PRESENT': 'intoxication detected → pause all serious conversation',
    'ESCALATION_ACTIVE': 'escalation active → de-escalate, slower voice, one topic',
    'GHOSTING_RESPONSE': 'ghosting/silence → regulate Kim, one healthy contact, no chasing',
    'REASSURANCE_LOOP': 'reassurance loop → validate fear, redirect to action/boundary',
    'LYING_CONFRONTATION': 'lying/denial → calm confrontation, clear, short, non-shaming',
    'REPAIR_NEEDED': 'repair needed → calm, recognize hurt, accountability, next step',
    'BOUNDARY_SETTING': 'boundary setting → clarity + compassion + boundary',
    'TIMING_BAD': 'bad timing → delay conversation, regulate first',
    'TIMING_GOOD': 'good timing → proceed with framework',
  };
  return map[context] ?? context;
}

function formatMode(mode: K05CommunicationMode): string {
  const map: Record<K05CommunicationMode, string> = {
    'PAUSE_CONVERSATION': 'pause conversation, delay until safe',
    'DE_ESCALATE': 'de-escalate: slower, shorter, one topic, pauses',
    'BOUNDARY_LANGUAGE': 'boundary language: "I care AND I need boundaries"',
    'REPAIR_FLOW': 'repair: calm → recognize hurt → accountability → next step',
    'REGULATE_FIRST': 'regulate Kim first, then address content',
    'CALM_CONFRONTATION': 'calm confrontation: clear, short, non-shaming, boundary-aware',
    'HEALTHY_CONTACT': 'one healthy contact attempt: "I care. Reach out when ready."',
    'FRAMEWORK_GUIDE': 'guide through: Observation → Feeling → Boundary → Request → Next step',
  };
  return map[mode] ?? mode;
}

function getModeGuidance(mode: K05CommunicationMode): string | null {
  switch (mode) {
    case 'PAUSE_CONVERSATION':
      return `Say: "I want this conversation, but not right now." Question: "Is this the right moment or just the strongest emotion?"`;
    case 'DE_ESCALATE':
      return `Use: slower voice, shorter sentences, one topic, pauses. Say: "I want to understand, not fight." Avoid: stacking complaints, old resentment, sarcasm, contempt.`;
    case 'BOUNDARY_LANGUAGE':
      return `Say: "I care about you AND I still need boundaries." "I want to help, but not in ways that hurt me." Avoid: "I'll fix this" / "My needs don't matter."`;
    case 'REPAIR_FLOW':
      return `Flow: calm → recognize hurt → accountability → next step. Questions: "What happened?" "What hurt?" "What do we need now?" Repair is slow, specific, behavioral.`;
    case 'REGULATE_FIRST':
      return `Regulate Kim's nervous system first. Then: "I understand the fear. Let's focus on what we actually know." Avoid: repeating reassurance endlessly.`;
    case 'CALM_CONFRONTATION':
      return `Say: "I care about you, and I do not believe what I am hearing." Clear, short, non-shaming, boundary-aware. Avoid: interrogation, detective mode, humiliation.`;
    case 'HEALTHY_CONTACT':
      return `One healthy message: "I care about you. Reach out when ready." Then stop. Question: "Am I trying to reconnect or calm my panic?" Avoid: 20 messages, panic pursuit, begging.`;
    case 'FRAMEWORK_GUIDE':
      return `Guide Kim through: 1. Observation ("When X happens...") 2. Feeling ("I feel...") 3. Boundary ("I need...") 4. Request ("I want...") 5. Next step ("We can...")`;
    default:
      return null;
  }
}
