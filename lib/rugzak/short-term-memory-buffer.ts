/**
 * ShortTermMemoryBuffer — Patch A + B + I
 *
 * Session-only live context layer. This is the PRIMARY source for
 * live response generation. It is NOT persisted. It resets at session start.
 *
 * PRIORITY RULE (Patch B):
 *   buffer > sliders > user.dat > backpack
 *
 * The buffer stores:
 * - last 8–12 chat messages (live window)
 * - current dominant emotion (detected from live text)
 * - current dominant trigger guess
 * - current relationship anchor (live, from this session)
 * - current intent (Patch I: venting, reflecting, seeking_action, etc.)
 * - current live zone score (0–100)
 * - current zone color (GREEN/YELLOW/ORANGE/RED/PURPLE)
 * - response direction (stabilize, reflect, direct, contain, crisis)
 * - temporary pattern repeats within session
 *
 * Intent detection (Patch I) uses three layers:
 * 1. Sentence structure (questions, imperatives, exclamations)
 * 2. Emotional tone shifts (escalation, withdrawal, calming)
 * 3. Repetition patterns within the session
 */

import type { ChatMessage, MoodSliders, UserType } from '../ai/types';
import { detectKimTrigger } from '../engine/kim/relational-signals';
import { kimDistressScore } from '../engine/kim/slider-interpretation';
import { eliasDistressScore } from '../engine/elias/slider-interpretation';

// ─── Types ────────────────────────────────────────────────────

export type LiveIntent =
  | 'venting'
  | 'reflecting'
  | 'seeking_action'
  | 'seeking_reassurance'
  | 'testing'
  | 'withdrawing'
  | 'crisis'
  | 'neutral';

export type ZoneColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';

export type ResponseDirection =
  | 'stabilize'
  | 'reflect'
  | 'direct'
  | 'contain'
  | 'crisis_override'
  | 'explore';

export interface TemporaryRepeat {
  /** The repeated word/phrase/theme */
  signal: string;
  /** How many times it appeared in this session */
  count: number;
  /** First occurrence timestamp */
  firstSeen: string;
  /** Last occurrence timestamp */
  lastSeen: string;
}

export interface BufferState {
  sessionId: string;
  recentMessages: ChatMessage[];
  currentEmotion: string;
  currentTriggerGuess: string;
  currentRelationshipAnchor: string;
  currentIntent: LiveIntent;
  currentZoneScore: number;
  currentZoneColor: ZoneColor;
  responseDirection: ResponseDirection;
  temporaryRepeats: TemporaryRepeat[];
  /** Number of user messages processed in this session */
  messageCount: number;
  /** Previous zone score (for decay/shift detection) */
  previousZoneScore: number;
  /** Emotional intensity trajectory within session: rising, stable, falling */
  intensityTrajectory: 'rising' | 'stable' | 'falling';
}

// ─── Constants ────────────────────────────────────────────────

const MAX_BUFFER_MESSAGES = 12;
const MIN_BUFFER_MESSAGES = 8;

// ─── Zone Mapping (Patch E) ──────────────────────────────────

export function scoreToZone(score: number): ZoneColor {
  if (score <= 20) return 'GREEN';
  if (score <= 40) return 'YELLOW';
  if (score <= 60) return 'ORANGE';
  if (score <= 80) return 'RED';
  return 'PURPLE';
}

// ─── Buffer Factory ──────────────────────────────────────────

export function createBuffer(): BufferState {
  return {
    sessionId: `session_${Date.now()}`,
    recentMessages: [],
    currentEmotion: 'neutral',
    currentTriggerGuess: '',
    currentRelationshipAnchor: '',
    currentIntent: 'neutral',
    currentZoneScore: 20,
    currentZoneColor: 'GREEN',
    responseDirection: 'explore',
    temporaryRepeats: [],
    messageCount: 0,
    previousZoneScore: 20,
    intensityTrajectory: 'stable',
  };
}

// ─── Intent Detection (Patch I — 3 layers) ──────────────────

/**
 * Layer 1: Sentence structure analysis.
 * Detects intent from how the sentence is constructed.
 */
function detectIntentFromStructure(text: string): LiveIntent | null {
  const lower = text.toLowerCase().trim();
  const sentences = lower.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Crisis signals override everything
  if (/\b(want to die|kill myself|end it all|suicide|can'?t go on|don'?t want to (live|be here|exist))\b/.test(lower)) {
    return 'crisis';
  }
  if (/\b(wil dood|maak me dood|zelfmoord|kan niet meer|wil er niet meer zijn)\b/.test(lower)) {
    return 'crisis';
  }

  // Imperatives / action requests
  if (/^(help|geef|zeg|vertel|doe|leer|show|give|tell|teach|do)\b/.test(lower)) {
    return 'seeking_action';
  }
  if (/\b(wat (moet|kan) ik|what (should|can) i|how (do|can) i)\b/.test(lower)) {
    return 'seeking_action';
  }

  // Questions seeking reassurance
  if (/\b(is (dat|dit|het) normaal|is (that|this|it) normal|ben ik (gek|slecht)|am i (crazy|bad|wrong))\b/.test(lower)) {
    return 'seeking_reassurance';
  }
  if (/\b(vind je|denk je|think you|do you think)\b/.test(lower)) {
    return 'seeking_reassurance';
  }

  // Reflective questions (why, what if)
  if (/^(waarom|why|hoe komt|how come|wat als|what if)\b/.test(lower)) {
    return 'reflecting';
  }

  // Testing / challenging
  if (/\b(maar jij bent|but you'?re|je bent maar|you'?re just|snap je|do you (even|really))\b/.test(lower)) {
    return 'testing';
  }

  // Short exclamations / venting
  if (sentences.length === 1 && lower.length < 40 && /[!]/.test(text)) {
    return 'venting';
  }

  // Long unstructured text = venting
  if (lower.length > 200 && sentences.length <= 3) {
    return 'venting';
  }

  // Very short responses = possible withdrawing
  if (lower.length < 10 && !/\?/.test(lower)) {
    return 'withdrawing';
  }

  return null;
}

/**
 * Layer 2: Emotional tone shift detection.
 * Compares current message intensity against session trajectory.
 */
function detectIntentFromToneShift(
  text: string,
  previousMessages: ChatMessage[],
  currentTrajectory: 'rising' | 'stable' | 'falling'
): LiveIntent | null {
  const intensity = computeTextIntensity(text);
  const recentUserMsgs = previousMessages
    .filter((m) => m.role === 'user')
    .slice(-3);

  if (recentUserMsgs.length < 2) return null;

  const prevIntensities = recentUserMsgs.map((m) => computeTextIntensity(m.content));
  const avgPrev = prevIntensities.reduce((a, b) => a + b, 0) / prevIntensities.length;

  // Sharp escalation: calm → intense
  if (intensity > avgPrev + 30 && intensity >= 60) {
    return 'venting';
  }

  // Sharp de-escalation: intense → short/flat
  if (intensity < avgPrev - 25 && intensity < 30) {
    return 'withdrawing';
  }

  // Sustained high intensity across messages
  if (currentTrajectory === 'rising' && intensity >= 50) {
    return 'venting';
  }

  return null;
}

/**
 * Layer 3: Repetition pattern detection within session.
 * If the user keeps saying the same thing in different ways → seeking_reassurance.
 */
function detectIntentFromRepetition(
  temporaryRepeats: TemporaryRepeat[]
): LiveIntent | null {
  // If 3+ different signals are repeated 2+ times → seeking_reassurance
  const significantRepeats = temporaryRepeats.filter((r) => r.count >= 2);
  if (significantRepeats.length >= 3) {
    return 'seeking_reassurance';
  }

  // If one signal is repeated 4+ times → testing or venting
  const highRepeat = temporaryRepeats.find((r) => r.count >= 4);
  if (highRepeat) {
    return 'testing';
  }

  return null;
}

/**
 * Combined intent detection: merges all 3 layers.
 * Priority: crisis > structure > tone shift > repetition > neutral
 */
function detectLiveIntent(
  text: string,
  previousMessages: ChatMessage[],
  temporaryRepeats: TemporaryRepeat[],
  trajectory: 'rising' | 'stable' | 'falling'
): LiveIntent {
  // Layer 1: Structure (includes crisis detection)
  const structureIntent = detectIntentFromStructure(text);
  if (structureIntent === 'crisis') return 'crisis';

  // Layer 2: Tone shift
  const toneIntent = detectIntentFromToneShift(text, previousMessages, trajectory);

  // Layer 3: Repetition
  const repetitionIntent = detectIntentFromRepetition(temporaryRepeats);

  // Priority merge
  if (structureIntent) return structureIntent;
  if (toneIntent) return toneIntent;
  if (repetitionIntent) return repetitionIntent;

  return 'neutral';
}

// ─── Text Intensity Scoring ──────────────────────────────────

/**
 * Compute emotional intensity of text on 0–100 scale.
 * Uses word count, punctuation, emotional keywords, caps.
 */
function computeTextIntensity(text: string): number {
  let score = 20; // baseline
  const lower = text.toLowerCase();

  // Length factor
  if (text.length > 200) score += 10;
  if (text.length > 400) score += 10;
  if (text.length < 15) score -= 10;

  // Exclamation marks
  const exclamations = (text.match(/!/g) || []).length;
  score += Math.min(exclamations * 5, 15);

  // ALL CAPS words
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  score += Math.min(capsWords * 8, 20);

  // Emotional intensity keywords (Dutch + English)
  const highIntensity = /\b(niet meer|kan niet|wil niet|haat|bang|dood|pijn|hurt|hate|scared|pain|can'?t|won'?t|never|always|hopeless|worthless|desperate)\b/;
  if (highIntensity.test(lower)) score += 20;

  const medIntensity = /\b(moeilijk|zwaar|lastig|verdrietig|boos|frustrated|angry|sad|tired|exhausted|overwhelmed|stressed)\b/;
  if (medIntensity.test(lower)) score += 10;

  const lowIntensity = /\b(goed|beter|rustig|ok|fine|better|calm|okay|good)\b/;
  if (lowIntensity.test(lower)) score -= 10;

  // Repetition of words (same word 3+ times)
  const words = lower.split(/\s+/);
  const wordCounts: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 3) wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  const repeatedWords = Object.values(wordCounts).filter((c) => c >= 3).length;
  if (repeatedWords > 0) score += 10;

  return Math.max(0, Math.min(100, score));
}

// ─── Emotion Detection from Text ─────────────────────────────

function detectEmotionFromText(text: string): string {
  const lower = text.toLowerCase();

  // Crisis emotions
  if (/\b(wil dood|suicide|kill myself|can'?t go on|end it)\b/.test(lower)) return 'crisis';
  if (/\b(numb|leeg|empty|niets voelen|don'?t feel)\b/.test(lower)) return 'dissociated';

  // High intensity
  if (/\b(boos|woedend|angry|furious|rage|kwaad)\b/.test(lower)) return 'angry';
  if (/\b(bang|angst|scared|afraid|terrified|paniek)\b/.test(lower)) return 'fearful';
  if (/\b(wanhoop|hopeless|desperate|hopeloos)\b/.test(lower)) return 'hopeless';

  // Medium intensity
  if (/\b(verdrietig|sad|huilen|crying|tranen|tears)\b/.test(lower)) return 'sad';
  if (/\b(eenzaam|lonely|alleen|alone|isolated)\b/.test(lower)) return 'lonely';
  if (/\b(schuld|guilt|schaam|shame|ashamed)\b/.test(lower)) return 'guilty';
  if (/\b(moe|tired|uitgeput|exhausted|op)\b/.test(lower)) return 'exhausted';
  if (/\b(gestrest|stressed|overweldigd|overwhelmed)\b/.test(lower)) return 'overwhelmed';
  if (/\b(craving|trek|zucht|urge|verlangen)\b/.test(lower)) return 'craving';
  if (/\b(gefrustreerd|frustrated|irritated|geïrriteerd)\b/.test(lower)) return 'frustrated';

  // Positive
  if (/\b(blij|happy|trots|proud|dankbaar|grateful|hopeful|hoopvol)\b/.test(lower)) return 'hopeful';
  if (/\b(beter|better|rustig|calm|goed|good|ok)\b/.test(lower)) return 'calm';

  return 'neutral';
}

// ─── Trigger Guess from Text ─────────────────────────────────

function detectTriggerGuess(text: string, userType: UserType): string {
  const lower = text.toLowerCase();

  if (userType === 'elias') {
    if (/\b(craving|trek|zucht|urge|verlangen|wil (drinken|gebruiken|roken))\b/.test(lower)) return 'craving';
    if (/\b(alleen|lonely|eenzaam|niemand|alone|isolated)\b/.test(lower)) return 'isolation';
    if (/\b(ruzie|conflict|fight|argument|botsing)\b/.test(lower)) return 'conflict';
    if (/\b(verveel|bored|leegte|emptiness|niets te doen)\b/.test(lower)) return 'boredom';
    if (/\b(stress|druk|pressure|deadline|werk|work)\b/.test(lower)) return 'stress';
    if (/\b(slapen|sleep|insomnia|nachtmerrie|nightmare)\b/.test(lower)) return 'sleep_disruption';
    if (/\b(herinnering|memory|flashback|vroeger|past)\b/.test(lower)) return 'trauma_memory';
  } else {
    // Kim — delegated to kimEngine relational-signals
    return detectKimTrigger(lower);
  }

  return '';
}

// ─── Relationship Anchor from Text ───────────────────────────

function detectLiveAnchor(text: string): string {
  const lower = text.toLowerCase();

  // Dutch relationship words
  const dutchRoles = /\b(mijn\s+)(man|vrouw|zoon|dochter|moeder|vader|broer|zus|partner|vriend|vriendin|kind|oma|opa|ex)\b/;
  const dutchMatch = lower.match(dutchRoles);
  if (dutchMatch) return dutchMatch[2];

  // English relationship words
  const englishRoles = /\b(my\s+)(husband|wife|son|daughter|mother|father|brother|sister|partner|friend|child|grandma|grandpa|ex)\b/;
  const englishMatch = lower.match(englishRoles);
  if (englishMatch) return englishMatch[2];

  // Proper names (capitalized words that aren't sentence starters)
  const namePattern = /(?:^|\.\s+)?(?:(?:mijn|my|zijn|haar|his|her)\s+)?([A-Z][a-z]{2,})\b/g;
  const names: string[] = [];
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1];
    // Filter common non-name words
    if (!/^(The|This|That|What|When|Where|How|Why|But|And|Also|Just|Still|Even|Het|Dit|Dat|Wat|Waar|Hoe|Maar|Ook|Nog)$/.test(name)) {
      names.push(name);
    }
  }
  if (names.length > 0) return names[0];

  return '';
}

// ─── Temporary Repeat Tracking ───────────────────────────────

function updateTemporaryRepeats(
  existing: TemporaryRepeat[],
  text: string
): TemporaryRepeat[] {
  const lower = text.toLowerCase();
  const now = new Date().toISOString();

  // Extract significant words/phrases to track
  const significantPatterns = [
    // Emotional themes
    { pattern: /\b(alleen|lonely|eenzaam|alone)\b/g, signal: 'isolation' },
    { pattern: /\b(bang|scared|angst|afraid)\b/g, signal: 'fear' },
    { pattern: /\b(boos|angry|kwaad|furious)\b/g, signal: 'anger' },
    { pattern: /\b(schuld|guilt|schaam|shame)\b/g, signal: 'guilt_shame' },
    { pattern: /\b(hopeloos|hopeless|zinloos|pointless)\b/g, signal: 'hopelessness' },
    { pattern: /\b(moe|tired|uitgeput|exhausted)\b/g, signal: 'exhaustion' },
    { pattern: /\b(craving|trek|zucht|urge)\b/g, signal: 'craving' },
    { pattern: /\b(machteloos|powerless|hulpeloos|helpless)\b/g, signal: 'powerlessness' },
    { pattern: /\b(weer|again|altijd|always|elke keer|every time)\b/g, signal: 'recurrence' },
    { pattern: /\b(grens|boundary|te veel|too much)\b/g, signal: 'boundary_strain' },
    { pattern: /\b(niemand|no one|nobody|begrijpt|understands)\b/g, signal: 'misunderstood' },
    { pattern: /\b(kan niet|can'?t|lukt niet|impossible)\b/g, signal: 'inability' },
  ];

  const updated = [...existing];

  for (const { pattern, signal } of significantPatterns) {
    if (pattern.test(lower)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;

      const existingRepeat = updated.find((r) => r.signal === signal);
      if (existingRepeat) {
        existingRepeat.count += 1;
        existingRepeat.lastSeen = now;
      } else {
        updated.push({
          signal,
          count: 1,
          firstSeen: now,
          lastSeen: now,
        });
      }
    }
  }

  return updated;
}

// ─── Zone Score Computation ──────────────────────────────────

/**
 * Compute the live zone score (0–100) from multiple inputs.
 * This is the LIVE score — it changes every message.
 *
 * Inputs (Patch D: all on 0–100 internal scale):
 * - text intensity
 * - slider-derived distress (slider * 10)
 * - trigger activation
 * - session trajectory
 * - previous zone score (for momentum)
 */
function computeZoneScore(
  textIntensity: number,
  sliderDistress: number,
  hasTrigger: boolean,
  trajectory: 'rising' | 'stable' | 'falling',
  previousZone: number,
  intent: LiveIntent
): number {
  // Weighted combination: buffer-first (Patch B)
  // Live text intensity: 40% weight (buffer wins)
  // Slider distress: 25% weight
  // Previous zone momentum: 20% weight
  // Trigger/intent boost: 15% weight
  let score = textIntensity * 0.40 + sliderDistress * 0.25 + previousZone * 0.20;

  // Trigger boost
  if (hasTrigger) score += 10;

  // Intent modifiers
  if (intent === 'crisis') score += 25;
  if (intent === 'venting') score += 10;
  if (intent === 'withdrawing') score += 5;
  if (intent === 'seeking_reassurance') score += 5;

  // Trajectory momentum
  if (trajectory === 'rising') score += 5;
  if (trajectory === 'falling') score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Response Direction ──────────────────────────────────────

function determineResponseDirection(
  zone: ZoneColor,
  intent: LiveIntent,
  trajectory: 'rising' | 'stable' | 'falling'
): ResponseDirection {
  // Crisis always overrides
  if (intent === 'crisis' || zone === 'PURPLE') return 'crisis_override';

  // RED zone: contain and stabilize
  if (zone === 'RED') {
    if (intent === 'seeking_action') return 'direct';
    return 'contain';
  }

  // ORANGE zone: stabilize first, then maybe direct
  if (zone === 'ORANGE') {
    if (intent === 'seeking_action') return 'direct';
    if (intent === 'venting') return 'contain';
    if (trajectory === 'rising') return 'stabilize';
    return 'stabilize';
  }

  // YELLOW zone: reflect or explore
  if (zone === 'YELLOW') {
    if (intent === 'reflecting') return 'reflect';
    if (intent === 'seeking_action') return 'direct';
    if (intent === 'venting') return 'reflect';
    return 'explore';
  }

  // GREEN zone: explore freely
  if (intent === 'reflecting') return 'reflect';
  if (intent === 'seeking_action') return 'direct';
  return 'explore';
}

// ─── Intensity Trajectory ────────────────────────────────────

function computeTrajectory(
  currentIntensity: number,
  recentMessages: ChatMessage[]
): 'rising' | 'stable' | 'falling' {
  const userMsgs = recentMessages.filter((m) => m.role === 'user').slice(-4);
  if (userMsgs.length < 2) return 'stable';

  const intensities = userMsgs.map((m) => computeTextIntensity(m.content));
  const avgPrev = intensities.slice(0, -1).reduce((a, b) => a + b, 0) / (intensities.length - 1);

  if (currentIntensity > avgPrev + 15) return 'rising';
  if (currentIntensity < avgPrev - 15) return 'falling';
  return 'stable';
}

// ─── Slider Distress (Patch D: 0–100 internal) ──────────────

function computeSliderDistress(mood: MoodSliders, userType: UserType): number {
  const get = (key: string): number => ((mood as any)[key] ?? 0) * 10; // Patch D: slider * 10

  if (userType === 'elias') {
    return eliasDistressScore(mood) * 10;
  }
  // Kim — delegated to kimEngine slider-interpretation (×10 for 0–100 internal scale)
  return kimDistressScore(mood) * 10;
}

// ─── Main Buffer Update Function ─────────────────────────────

/**
 * Update the ShortTermMemoryBuffer with a new user message.
 *
 * This is called BEFORE every GPT call. The buffer becomes the
 * primary source for live response generation (Patch B).
 *
 * @param buffer - Current buffer state (or null for first message)
 * @param userMessage - The new user message text
 * @param allMessages - All messages in the session so far (for window)
 * @param mood - Current mood sliders
 * @param userType - 'elias' or 'kim'
 * @returns Updated buffer state
 */
export function updateBuffer(
  buffer: BufferState | null,
  userMessage: string,
  allMessages: ChatMessage[],
  mood: MoodSliders,
  userType: UserType
): BufferState {
  const current = buffer ?? createBuffer();

  // 1. Update recent messages window (8–12)
  const recentMessages = allMessages.slice(-MAX_BUFFER_MESSAGES);

  // 2. Update temporary repeats
  const temporaryRepeats = updateTemporaryRepeats(current.temporaryRepeats, userMessage);

  // 3. Compute text intensity
  const textIntensity = computeTextIntensity(userMessage);

  // 4. Compute trajectory
  const trajectory = computeTrajectory(textIntensity, current.recentMessages);

  // 5. Detect live intent (3 layers — Patch I)
  const intent = detectLiveIntent(userMessage, current.recentMessages, temporaryRepeats, trajectory);

  // 6. Detect emotion from text
  const emotion = detectEmotionFromText(userMessage);

  // 7. Detect trigger guess
  const triggerGuess = detectTriggerGuess(userMessage, userType);

  // 8. Detect live relationship anchor
  const anchor = detectLiveAnchor(userMessage);

  // 9. Compute slider distress (Patch D: 0–100)
  const sliderDistress = computeSliderDistress(mood, userType);

  // 10. Compute zone score (buffer-first weighting — Patch B)
  const zoneScore = computeZoneScore(
    textIntensity,
    sliderDistress,
    triggerGuess !== '',
    trajectory,
    current.currentZoneScore,
    intent
  );

  // 11. Map to zone color (Patch E)
  const zoneColor = scoreToZone(zoneScore);

  // 12. Determine response direction
  const direction = determineResponseDirection(zoneColor, intent, trajectory);

  return {
    sessionId: current.sessionId,
    recentMessages,
    currentEmotion: emotion !== 'neutral' ? emotion : current.currentEmotion,
    currentTriggerGuess: triggerGuess || current.currentTriggerGuess,
    currentRelationshipAnchor: anchor || current.currentRelationshipAnchor,
    currentIntent: intent,
    currentZoneScore: zoneScore,
    currentZoneColor: zoneColor,
    responseDirection: direction,
    temporaryRepeats,
    messageCount: current.messageCount + 1,
    previousZoneScore: current.currentZoneScore,
    intensityTrajectory: trajectory,
  };
}

// ─── Buffer Snapshot for GPT Payload ─────────────────────────

/**
 * STABLE snapshot structure sent to GPT payload.
 * This is the ONLY buffer data that enters the GPT call.
 *
 * Fields are fixed and typed — no dynamic ad-hoc additions.
 * DominantState is included because it was computed from the buffer.
 */
export interface BufferSnapshot {
  /** Last N relevant messages from the buffer window */
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Pre-GPT dominant state (decision variable for current response) */
  dominantState: {
    dominantModule: string;
    dominantTrigger: string;
    dominantDirection: string;
    dominantTone: string;
    riskScore: number;
    selectionReason: string;
    sourceLayer: string;
  } | null;
  /** Selected triggers (max 2, from backpack relevance) */
  selectedTriggers: Array<{ trigger: string; score: number }>;
  /** Current zone score (0–100) */
  zoneScore: number;
  /** Current zone color (GREEN/YELLOW/ORANGE/RED/PURPLE) */
  zoneColor: ZoneColor;
  /** Live intent detected from user message */
  liveIntent: LiveIntent;
  /** Intensity trajectory within session */
  intensityTrajectory: 'rising' | 'stable' | 'falling';
  /** Current detected emotion from text */
  currentEmotion: string;
  /** Current relationship anchor if relevant (empty string if none) */
  currentRelationshipAnchor: string;
  /** Response direction computed from zone + intent */
  responseDirection: ResponseDirection;
  /** Number of user messages processed in this session */
  messageCount: number;
}

/**
 * Build a stable BufferSnapshot from the buffer state.
 *
 * dominantState and selectedTriggers are injected externally
 * (they come from DominantStateSelector and BackpackRelevanceAnalyzer,
 * not from the buffer itself).
 */
export function getBufferSnapshot(
  buffer: BufferState,
  dominantState?: BufferSnapshot['dominantState'],
  selectedTriggers?: BufferSnapshot['selectedTriggers'],
): BufferSnapshot {
  // Get recent messages in a clean format
  const targetSize = buffer.messageCount <= 10 ? MIN_BUFFER_MESSAGES : MAX_BUFFER_MESSAGES;
  const recentMsgs = buffer.recentMessages.slice(-targetSize);

  return {
    recentMessages: recentMsgs.map((m) => ({ role: m.role, content: m.content })),
    dominantState: dominantState ?? null,
    selectedTriggers: selectedTriggers ?? [],
    zoneScore: buffer.currentZoneScore,
    zoneColor: buffer.currentZoneColor,
    liveIntent: buffer.currentIntent,
    intensityTrajectory: buffer.intensityTrajectory,
    currentEmotion: buffer.currentEmotion,
    currentRelationshipAnchor: buffer.currentRelationshipAnchor,
    responseDirection: buffer.responseDirection,
    messageCount: buffer.messageCount,
  };
}

// ─── Buffer Message Window ───────────────────────────────────

/**
 * Get the recent messages from the buffer for the GPT conversation window.
 * Returns 8–12 messages depending on session length.
 */
export function getBufferMessages(buffer: BufferState): ChatMessage[] {
  const targetSize = buffer.messageCount <= 10 ? MIN_BUFFER_MESSAGES : MAX_BUFFER_MESSAGES;
  return buffer.recentMessages.slice(-targetSize);
}
