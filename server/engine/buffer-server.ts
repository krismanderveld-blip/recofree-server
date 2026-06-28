/**
 * Server-safe ShortTermMemoryBuffer
 *
 * This module wraps the client buffer logic for server use.
 * The only client-only dependency is LocalDeviceTimeService, which we replace
 * with standard Date.now() / new Date().toISOString().
 *
 * The server maintains an in-memory session cache (Map<sessionId, BufferState>)
 * that expires after 30 minutes of inactivity.
 */

import type { ChatMessage, MoodSliders, UserType } from '../../lib/ai/types';

// ─── Types (inlined to avoid react-native import chain) ────
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
  signal: string;
  count: number;
  firstSeen: string;
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
  messageCount: number;
  previousZoneScore: number;
  intensityTrajectory: 'rising' | 'stable' | 'falling';
  usedModules: string[];
  topicHistory: string[];
  personsDiscussed: string[];
  emotionalArc: string[];
  currentTopic: string;
  moduleSwitchCount: number;
  currentModuleMessageCount: number;
}

// Inlined scoreToZone to avoid importing from client buffer (which has react-native deps)
export function scoreToZone(score: number): ZoneColor {
  if (score <= 20) return 'GREEN';
  if (score <= 40) return 'YELLOW';
  if (score <= 60) return 'ORANGE';
  if (score <= 80) return 'RED';
  return 'PURPLE';
}



// ─── Session Cache ────────────────────────────────────────────
interface CachedSession {
  buffer: BufferState;
  lastAccess: number;
}

const SESSION_CACHE = new Map<string, CachedSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Get or create a buffer for a session. */
export function getSessionBuffer(sessionId: string): BufferState {
  const cached = SESSION_CACHE.get(sessionId);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached.buffer;
  }
  const newBuffer = createServerBuffer(sessionId);
  SESSION_CACHE.set(sessionId, { buffer: newBuffer, lastAccess: Date.now() });
  return newBuffer;
}

/** Update the buffer for a session. */
export function setSessionBuffer(sessionId: string, buffer: BufferState): void {
  SESSION_CACHE.set(sessionId, { buffer, lastAccess: Date.now() });
}

/** Clean expired sessions (call periodically). */
export function cleanExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, cached] of SESSION_CACHE) {
    if (now - cached.lastAccess > SESSION_TTL_MS) {
      SESSION_CACHE.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

// Run cleanup every 5 minutes
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// ─── Server Buffer Factory ────────────────────────────────────
function createServerBuffer(sessionId: string): BufferState {
  return {
    sessionId,
    recentMessages: [],
    currentEmotion: 'neutral',
    currentTriggerGuess: '',
    currentRelationshipAnchor: '',
    currentIntent: 'neutral' as LiveIntent,
    currentZoneScore: 20,
    currentZoneColor: 'GREEN' as ZoneColor,
    responseDirection: 'explore' as ResponseDirection,
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

// ─── Constants ────────────────────────────────────────────────
const MAX_BUFFER_MESSAGES = 12;

// ─── Server-safe updateBuffer ─────────────────────────────────
/**
 * Update the buffer with a new user message.
 * This is a server-safe version that uses Date.now() instead of LocalDeviceTimeService.
 */
export function updateBufferServer(
  buffer: BufferState,
  userMessage: string,
  allMessages: ChatMessage[],
  mood: MoodSliders,
  userType: UserType,
): BufferState {
  // 1. Update recent messages window (max 12)
  const recentMessages = allMessages.slice(-MAX_BUFFER_MESSAGES);

  // 2. Update temporary repeats
  const temporaryRepeats = updateTemporaryRepeats(buffer.temporaryRepeats, userMessage);

  // 3. Compute text intensity
  const textIntensity = computeTextIntensity(userMessage);

  // 4. Compute trajectory
  const trajectory = computeTrajectory(textIntensity, buffer.recentMessages);

  // 5. Detect live intent (3 layers)
  const currentIntent = detectLiveIntent(userMessage, buffer.recentMessages, temporaryRepeats, trajectory);

  // 6. Compute zone score from sliders + text + buffer context (aligned with client formula)
  const hasTrigger = detectTriggerGuess(userMessage, userType) !== '';
  const zoneScore = computeZoneScore(mood, textIntensity, buffer.currentZoneScore, userType, hasTrigger, currentIntent, trajectory);
  const currentZoneColor = scoreToZone(zoneScore);

  // 7. Determine response direction
  const responseDirection = determineResponseDirection(currentZoneColor, currentIntent, buffer.responseDirection);

  // 8. Detect emotion
  const currentEmotion = detectEmotionFromText(userMessage);

  // 9. Detect trigger guess
  const currentTriggerGuess = detectTriggerGuess(userMessage, userType);

  return {
    ...buffer,
    recentMessages,
    currentEmotion,
    currentTriggerGuess,
    currentIntent,
    currentZoneScore: zoneScore,
    currentZoneColor,
    responseDirection,
    temporaryRepeats,
    messageCount: buffer.messageCount + 1,
    previousZoneScore: buffer.currentZoneScore,
    intensityTrajectory: trajectory,
  };
}

// ─── Helper Functions (server-safe, no LocalDeviceTimeService) ─

function updateTemporaryRepeats(
  existing: TemporaryRepeat[],
  text: string,
): TemporaryRepeat[] {
  const lower = text.toLowerCase();
  const now = new Date().toISOString(); // Server-safe replacement

  // Extract significant patterns
  const significantPatterns = [
    /\b(scared|afraid|fear|panic|anxious|bang|angst|paniek)\b/,
    /\b(angry|frustrated|rage|boos|gefrustreerd|woede)\b/,
    /\b(sad|hopeless|worthless|verdrietig|hopeloos|waardeloos)\b/,
    /\b(craving|using|drink|drugs|drang|gebruik|drinken)\b/,
    /\b(alone|lonely|isolated|alleen|eenzaam|geïsoleerd)\b/,
    /\b(tired|exhausted|can'?t|moe|uitgeput|kan niet)\b/,
    /\b(help|need|want|hulp|nodig|wil)\b/,
  ];

  const updated = [...existing];
  for (const pattern of significantPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const signal = match[0];
      const existingRepeat = updated.find((r) => r.signal === signal);
      if (existingRepeat) {
        existingRepeat.count++;
        existingRepeat.lastSeen = now;
      } else {
        updated.push({ signal, count: 1, firstSeen: now, lastSeen: now });
      }
    }
  }
  return updated;
}

function computeTextIntensity(text: string): number {
  let score = 20;
  const lower = text.toLowerCase();

  if (text.length > 200) score += 10;
  if (text.length > 400) score += 10;
  if (text.length < 15) score -= 10;

  const exclamations = (text.match(/!/g) || []).length;
  score += Math.min(exclamations * 5, 15);

  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  score += Math.min(capsWords * 8, 20);

  const highIntensity = /\b(no more|can'?t|won'?t|hate|scared|dead|pain|hurt|never|always|hopeless|worthless|desperate|bang|doodsbang|pijn|haat|nooit|altijd|hopeloos|waardeloos|wanhopig|dood|kapot|niet meer|kan niet meer|wil niet meer)\b/;
  if (highIntensity.test(lower)) score += 20;

  const medIntensity = /\b(difficult|hard|tough|sad|angry|frustrated|tired|exhausted|overwhelmed|stressed|moeilijk|zwaar|verdrietig|boos|gefrustreerd|moe|uitgeput|overweldigd|gestrest|angst|paniek|drang|verlaten|in de steek|eenzaam)\b/;
  if (medIntensity.test(lower)) score += 10;

  const lowIntensity = /\b(good|better|calm|ok|fine|okay|peaceful|relaxed|goed|beter|rustig|oké|prima|vredig|ontspannen)\b/;
  if (lowIntensity.test(lower)) score -= 10;

  const words = lower.split(/\s+/);
  const wordCounts: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 3) wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  const repeatedWords = Object.values(wordCounts).filter((c) => c >= 3).length;
  if (repeatedWords > 0) score += 10;

  return Math.max(0, Math.min(100, score));
}

function computeTrajectory(
  currentIntensity: number,
  previousMessages: ChatMessage[],
): 'rising' | 'stable' | 'falling' {
  if (previousMessages.length < 2) return 'stable';
  const recentUser = previousMessages.filter((m) => m.role === 'user').slice(-3);
  if (recentUser.length < 2) return 'stable';
  const prevIntensities = recentUser.map((m) => computeTextIntensity(m.content));
  const avg = prevIntensities.reduce((a, b) => a + b, 0) / prevIntensities.length;
  if (currentIntensity > avg + 10) return 'rising';
  if (currentIntensity < avg - 10) return 'falling';
  return 'stable';
}

function detectLiveIntent(
  text: string,
  previousMessages: ChatMessage[],
  temporaryRepeats: TemporaryRepeat[],
  trajectory: 'rising' | 'stable' | 'falling',
): LiveIntent {
  const lower = text.toLowerCase().trim();

  // Crisis override
  if (/\b(want to die|kill myself|end it all|suicide|can'?t go on|don'?t want to (live|be here|exist))\b/.test(lower)) {
    return 'crisis';
  }

  // Imperatives / action requests
  if (/^(help|show|give|tell|teach|do)\b/.test(lower)) return 'seeking_action';
  if (/\b(what (should|can) i|how (do|can) i)\b/.test(lower)) return 'seeking_action';

  // Reassurance
  if (/\b(is (that|this|it) normal|am i (crazy|bad|wrong))\b/.test(lower)) return 'seeking_reassurance';

  // Reflective
  if (/^(why|how come|what if)\b/.test(lower)) return 'reflecting';

  // Tone shift
  const intensity = computeTextIntensity(text);
  const recentUser = previousMessages.filter((m) => m.role === 'user').slice(-3);
  if (recentUser.length >= 2) {
    const prevAvg = recentUser.map((m) => computeTextIntensity(m.content)).reduce((a, b) => a + b, 0) / recentUser.length;
    if (intensity > prevAvg + 30 && intensity >= 60) return 'venting';
    if (intensity < prevAvg - 25 && intensity < 30) return 'withdrawing';
  }
  if (trajectory === 'rising' && intensity >= 50) return 'venting';

  // Repetition
  const significantRepeats = temporaryRepeats.filter((r) => r.count >= 2);
  if (significantRepeats.length >= 3) return 'seeking_reassurance';
  if (temporaryRepeats.find((r) => r.count >= 4)) return 'testing';

  return 'neutral';
}

function computeZoneScore(
  mood: MoodSliders,
  textIntensity: number,
  previousScore: number,
  userType: UserType,
  hasTrigger: boolean = false,
  intent: LiveIntent = 'neutral',
  trajectory: 'rising' | 'stable' | 'falling' = 'stable',
): number {
  // Slider distress: AVERAGE of distress sliders (aligned with client formula)
  // Client uses eliasDistressScore = avg(craving, frustration, despondency) * 10
  // Client uses kimDistressScore = avg(stress, boundaryFatigue, emotionalBurden) * 10
  let sliderDistress: number;
  if (userType === 'elias') {
    const m = mood as any;
    const craving = (m.craving ?? 0);
    const frustration = (m.frustration ?? 0);
    const despondency = (m.despondency ?? 0);
    sliderDistress = ((craving + frustration + despondency) / 3) * 10;
  } else {
    const m = mood as any;
    const stress = (m.stress ?? 0);
    const boundaryFatigue = (m.boundaryFatigue ?? 0);
    const emotionalBurden = (m.emotionalBurden ?? 0);
    sliderDistress = ((stress + boundaryFatigue + emotionalBurden) / 3) * 10;
  }

  // Weighted combination: aligned with client (Patch B)
  // Live text intensity: 40% weight
  // Slider distress: 25% weight
  // Previous zone momentum: 20% weight
  // Trigger/intent boost: 15% weight
  let score = textIntensity * 0.40 + sliderDistress * 0.25 + previousScore * 0.20;

  // Trigger boost
  if (hasTrigger) score += 10;

  // Combination amplification
  if (textIntensity >= 30 && sliderDistress >= 40 && hasTrigger) {
    score += 12;
  } else if (textIntensity >= 30 && sliderDistress >= 40) {
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

function determineResponseDirection(
  zone: ZoneColor,
  intent: LiveIntent,
  previousDirection: ResponseDirection,
): ResponseDirection {
  // Crisis always overrides
  if (zone === 'PURPLE' || intent === 'crisis') return 'crisis_override';
  if (zone === 'RED') return 'contain';
  if (zone === 'ORANGE') return 'stabilize';

  // For lower zones, follow intent
  if (intent === 'seeking_action') return 'direct';
  if (intent === 'reflecting') return 'reflect';
  if (intent === 'venting') return 'stabilize';
  if (intent === 'withdrawing') return 'explore';

  // Default: maintain previous or explore
  if (zone === 'YELLOW') return 'reflect';
  return previousDirection || 'explore';
}

function detectEmotionFromText(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(want to die|suicide|kill myself|can'?t go on|end it)\b/.test(lower)) return 'crisis';
  if (/\b(numb|empty|don'?t feel|feel nothing)\b/.test(lower)) return 'dissociated';
  if (/\b(angry|furious|rage|enraged|boos|woedend)\b/.test(lower)) return 'angry';
  if (/\b(scared|afraid|terrified|panic|anxious|fear|bang|angstig)\b/.test(lower)) return 'fearful';
  if (/\b(hopeless|desperate|despair|hopeloos|wanhopig)\b/.test(lower)) return 'hopeless';
  if (/\b(sad|crying|tears|grief|verdrietig|huilen|rouw)\b/.test(lower)) return 'sad';
  if (/\b(frustrated|stuck|trapped|gefrustreerd|vast|opgesloten)\b/.test(lower)) return 'frustrated';
  if (/\b(ashamed|guilty|shame|schaam|schuld)\b/.test(lower)) return 'ashamed';
  if (/\b(lonely|alone|isolated|eenzaam|alleen)\b/.test(lower)) return 'lonely';
  if (/\b(good|happy|better|calm|peaceful|goed|blij|beter|rustig)\b/.test(lower)) return 'positive';
  return 'neutral';
}

function detectTriggerGuess(text: string, userType: UserType): string {
  const lower = text.toLowerCase();
  if (userType === 'elias') {
    if (/\b(craving|drang|drink|alcohol|drugs|gebruik|terugval|relapse)\b/.test(lower)) return 'substance_craving';
    if (/\b(lonely|alone|eenzaam|alleen|niemand)\b/.test(lower)) return 'isolation';
    if (/\b(angry|boos|conflict|ruzie|fight)\b/.test(lower)) return 'interpersonal_conflict';
    if (/\b(bored|verveel|nothing to do|niks te doen)\b/.test(lower)) return 'boredom';
    if (/\b(stressed|pressure|deadline|werk|work)\b/.test(lower)) return 'stress';
  } else {
    if (/\b(boundary|grens|too much|te veel|overbelast)\b/.test(lower)) return 'boundary_violation';
    if (/\b(guilt|schuld|should|moet)\b/.test(lower)) return 'caregiver_guilt';
    if (/\b(alone|alleen|no support|geen steun)\b/.test(lower)) return 'lack_of_support';
    if (/\b(relapse|terugval|using again|weer gebruik)\b/.test(lower)) return 'loved_one_relapse';
  }
  return '';
}

// ─── Buffer Snapshot (for GPT payload) ────────────────────────
export interface BufferSnapshot {
  sessionId: string;
  messageCount: number;
  currentEmotion: string;
  currentTriggerGuess: string;
  currentRelationshipAnchor: string;
  currentIntent: LiveIntent;
  currentZoneScore: number;
  currentZoneColor: ZoneColor;
  responseDirection: ResponseDirection;
  intensityTrajectory: 'rising' | 'stable' | 'falling';
  temporaryRepeats: TemporaryRepeat[];
  usedModules: string[];
  topicHistory: string[];
  personsDiscussed: string[];
  emotionalArc: string[];
  currentTopic: string;
}

export function getBufferSnapshotServer(buffer: BufferState): BufferSnapshot {
  return {
    sessionId: buffer.sessionId,
    messageCount: buffer.messageCount,
    currentEmotion: buffer.currentEmotion,
    currentTriggerGuess: buffer.currentTriggerGuess,
    currentRelationshipAnchor: buffer.currentRelationshipAnchor,
    currentIntent: buffer.currentIntent,
    currentZoneScore: buffer.currentZoneScore,
    currentZoneColor: buffer.currentZoneColor,
    responseDirection: buffer.responseDirection,
    intensityTrajectory: buffer.intensityTrajectory,
    temporaryRepeats: buffer.temporaryRepeats,
    usedModules: buffer.usedModules,
    topicHistory: buffer.topicHistory,
    personsDiscussed: buffer.personsDiscussed,
    emotionalArc: buffer.emotionalArc,
    currentTopic: buffer.currentTopic,
  };
}
