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
  /** Modules already used in this session (loopblocker: prevents same module twice) */
  usedModules: string[];
  // ─── Content-Aware Tracking (enriched by engine_signals) ───
  /** Topics discussed this session (most recent last) */
  topicHistory: string[];
  /** Persons mentioned this session (deduplicated by name) */
  personsDiscussed: string[];
  /** Emotional arc: sequence of emotional shifts this session */
  emotionalArc: string[];
  /** Current dominant topic (latest from topicHistory) */
  currentTopic: string;
  /** Module switch count this session */
  moduleSwitchCount: number;
  /** How many messages the current module has been active */
  currentModuleMessageCount: number;
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
    usedModules: [],
    topicHistory: [],
    personsDiscussed: [],
    emotionalArc: [],
    currentTopic: '',
    moduleSwitchCount: 0,
    currentModuleMessageCount: 0,
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
  if (/\b(want to die|kill me|end my life|can'?t take it anymore|don'?t want to exist)\b/.test(lower)) {
    return 'crisis';
  }

  // Imperatives / action requests
  if (/^(help|show|give|tell|teach|do)\b/.test(lower)) {
    return 'seeking_action';
  }
  if (/\b(what (should|can) i|how (do|can) i)\b/.test(lower)) {
    return 'seeking_action';
  }

  // Questions seeking reassurance
  if (/\b(is (that|this|it) normal|am i (crazy|bad|wrong))\b/.test(lower)) {
    return 'seeking_reassurance';
  }
  if (/\b(think you|do you think)\b/.test(lower)) {
    return 'seeking_reassurance';
  }

  // Reflective questions (why, what if)
  if (/^(why|how come|what if)\b/.test(lower)) {
    return 'reflecting';
  }

  // Testing / challenging
  if (/\b(but you'?re|you'?re just|do you (even|really))\b/.test(lower)) {
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

  // Emotional intensity keywords (EN + NL)
  const highIntensity = /\b(no more|can'?t|won'?t|hate|scared|dead|pain|hurt|never|always|hopeless|worthless|desperate|bang|doodsbang|pijn|haat|nooit|altijd|hopeloos|waardeloos|wanhopig|dood|kapot|niet meer|kan niet meer|wil niet meer)\b/;
  if (highIntensity.test(lower)) score += 20;

  const medIntensity = /\b(difficult|hard|tough|sad|angry|frustrated|tired|exhausted|overwhelmed|stressed|moeilijk|zwaar|verdrietig|boos|gefrustreerd|moe|uitgeput|overweldigd|gestrest|angst|paniek|drang|verlaten|in de steek|eenzaam)\b/;
  if (medIntensity.test(lower)) score += 10;

  const lowIntensity = /\b(good|better|calm|ok|fine|okay|peaceful|relaxed|goed|beter|rustig|oké|prima|vredig|ontspannen)\b/;
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
  if (/\b(want to die|suicide|kill myself|can'?t go on|end it)\b/.test(lower)) return 'crisis';
  if (/\b(numb|empty|don'?t feel|feel nothing)\b/.test(lower)) return 'dissociated';

  // High intensity
  if (/\b(angry|furious|rage|enraged)\b/.test(lower)) return 'angry';
  if (/\b(scared|afraid|terrified|panic|anxious|fear)\b/.test(lower)) return 'fearful';
  if (/\b(hopeless|desperate|despair)\b/.test(lower)) return 'hopeless';

  // Medium intensity
  if (/\b(sad|crying|tears|grief)\b/.test(lower)) return 'sad';
  if (/\b(lonely|alone|isolated)\b/.test(lower)) return 'lonely';
  if (/\b(guilt|shame|ashamed)\b/.test(lower)) return 'guilty';
  if (/\b(tired|exhausted|drained|burnt out)\b/.test(lower)) return 'exhausted';
  if (/\b(stressed|overwhelmed)\b/.test(lower)) return 'overwhelmed';
  if (/\b(craving|urge|longing|desire)\b/.test(lower)) return 'craving';
  if (/\b(frustrated|irritated|annoyed)\b/.test(lower)) return 'frustrated';

  // Positive
  if (/\b(happy|proud|grateful|hopeful)\b/.test(lower)) return 'hopeful';
  if (/\b(better|calm|good|ok|peaceful)\b/.test(lower)) return 'calm';

  return 'neutral';
}

// ─── Trigger Guess from Text ─────────────────────────────────

function detectTriggerGuess(text: string, userType: UserType): string {
  const lower = text.toLowerCase();

  if (userType === 'elias') {
    if (/\b(craving|urge|longing|want to (drink|use|smoke)|trek|drang|zucht|wil (drinken|gebruiken|roken|scoren)|terugval|verlangen)\b/.test(lower)) return 'craving';
    if (/\b(lonely|alone|isolated|no one|alleen|eenzaam|niemand|in de steek|verlaten|ge[ïi]soleerd)\b/.test(lower)) return 'isolation';
    if (/\b(conflict|fight|argument|clash|ruzie|botsing|conflict)\b/.test(lower)) return 'conflict';
    if (/\b(bored|boredom|emptiness|nothing to do|verveling|verveeld|leegte|niets te doen)\b/.test(lower)) return 'boredom';
    if (/\b(stress|pressure|deadline|work|druk|spanning|werk)\b/.test(lower)) return 'stress';
    if (/\b(sleep|insomnia|nightmare|slaap|slapeloosheid|nachtmerrie)\b/.test(lower)) return 'sleep_disruption';
    if (/\b(memory|flashback|past|trauma|herinnering|verleden)\b/.test(lower)) return 'trauma_memory';
    if (/\b(bang|angst|paniek|scared|afraid|fear|angstig)\b/.test(lower)) return 'fear';
  } else {
    // Kim — delegated to kimEngine relational-signals
    return detectKimTrigger(lower);
  }

  return '';
}

// ─── Relationship Anchor from Text ───────────────────────────

function detectLiveAnchor(text: string): string {
  const lower = text.toLowerCase();

  // Relationship words
  const roles = /\b(my\s+)(husband|wife|son|daughter|mother|father|brother|sister|partner|friend|child|grandma|grandpa|ex)\b/;
  const roleMatch = lower.match(roles);
  if (roleMatch) return roleMatch[2];

  // Proper names (capitalized words that aren't sentence starters)
  const namePattern = /(?:^|\.\s+)?(?:(?:my|his|her)\s+)?([A-Z][a-z]{2,})\b/g;
  const names: string[] = [];
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1];
    // Filter common non-name words
    if (!/^(The|This|That|What|When|Where|How|Why|But|And|Also|Just|Still|Even)$/.test(name)) {
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
    { pattern: /\b(lonely|alone|isolated)\b/g, signal: 'isolation' },
    { pattern: /\b(scared|afraid|anxious|fear)\b/g, signal: 'fear' },
    { pattern: /\b(angry|furious|rage)\b/g, signal: 'anger' },
    { pattern: /\b(guilt|shame|ashamed)\b/g, signal: 'guilt_shame' },
    { pattern: /\b(hopeless|pointless|meaningless)\b/g, signal: 'hopelessness' },
    { pattern: /\b(tired|exhausted|drained)\b/g, signal: 'exhaustion' },
    { pattern: /\b(craving|urge|longing)\b/g, signal: 'craving' },
    { pattern: /\b(powerless|helpless)\b/g, signal: 'powerlessness' },
    { pattern: /\b(again|always|every time)\b/g, signal: 'recurrence' },
    { pattern: /\b(boundary|too much)\b/g, signal: 'boundary_strain' },
    { pattern: /\b(no one|nobody|understands)\b/g, signal: 'misunderstood' },
    { pattern: /\b(can'?t|impossible|unable)\b/g, signal: 'inability' },
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

  // Combination amplification: when BOTH text intensity AND slider distress are
  // elevated, the risk is compounded (e.g. craving language + high distress sliders).
  // This addresses the underestimation of combined signals.
  if (textIntensity >= 30 && sliderDistress >= 40 && hasTrigger) {
    // Strong combination: emotional text + elevated sliders + active trigger
    score += 12;
  } else if (textIntensity >= 30 && sliderDistress >= 40) {
    // Moderate combination: emotional text + elevated sliders (no trigger word)
    score += 8;
  }

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
    usedModules: current.usedModules,
    // Content-aware fields (preserved, enriched by signal-router after LLM response)
    topicHistory: current.topicHistory,
    personsDiscussed: current.personsDiscussed,
    emotionalArc: current.emotionalArc,
    currentTopic: current.currentTopic,
    moduleSwitchCount: current.moduleSwitchCount,
    currentModuleMessageCount: current.currentModuleMessageCount + 1,
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
