/**
 * DominantStateSelector — Server Port (P0)
 *
 * Server-safe port of lib/rugzak/dominant-state-selector.ts.
 * Chooses the SINGLE dominant module per message using the same priority order as the client.
 *
 * PRIORITY ORDER:
 * 1. crisis
 * 2. VSP zone override (PAARS/ROOD/ORANJE for Elias)
 * 3. urgent live trigger from buffer (zoneScore >= 50)
 * 4. extreme slider state (primaryConcern >= 70 OR distress >= 65 & resilience <= 30)
 * 5. repeated session pattern (buffer temporaryRepeats >= 3)
 * 6. long-term user.dat pattern (triggerPatterns count >= 3 & zoneScore >= 30)
 * 7. short module keyword detection (Elias only)
 * 8. StateAnalyzer priority modules
 * 9. default
 *
 * No React Native dependencies. No AsyncStorage. Pure logic.
 */

import type { BufferState, ZoneColor, LiveIntent, ResponseDirection } from './buffer-server';

// ─── Types ──────────────────────────────────────────────────────

type UserType = 'elias' | 'kim';

interface MoodSliders {
  [key: string]: number | null | undefined;
}

interface TriggerPattern {
  trigger: string;
  frequency: number;
  lastSeen: string;
}

export interface DominantState {
  dominantModule: string;
  dominantTrigger: string;
  dominantDirection: ResponseDirection;
  dominantTone: 'crisis' | 'grounding' | 'assertive' | 'warm' | 'containing' | 'exploring';
  selectionReason: string;
  sourceLayer: 'crisis' | 'live_trigger' | 'extreme_slider' | 'session_pattern' | 'userdat_pattern' | 'short_module_keyword' | 'backpack_relevance' | 'default';
  riskScore: number;
}

// ─── Constants ──────────────────────────────────────────────────

const ELIAS_DEFAULT_MODULE = 'E02';
const ELIAS_CRISIS_MODULE = 'E_CRISIS';
const KIM_DEFAULT_MODULE = 'K01';
const KIM_CRISIS_MODULE = 'CRISIS-K01';

// ─── Trigger → Module Mapping (Elias) ───────────────────────────

const ELIAS_TRIGGER_MAP: Record<string, string> = {
  craving: 'E01',
  relapse: 'E01',
  alcohol: 'E01',
  drugs: 'E01',
  anxiety: 'E02',
  fear: 'E02',
  panic: 'E02',
  anger: 'E03',
  frustration: 'E03',
  aggression: 'E03',
  shame: 'E04',
  guilt: 'E04',
  loneliness: 'E05',
  isolation: 'E05',
  loss: 'E05',
  grief: 'E05',
  hope: 'E06',
  motivation: 'E06',
  goals: 'E06',
  relationship: 'E07',
  partner: 'E07',
  family: 'E07',
  acceptance: 'E08',
  selfcare: 'E08',
  // Short modules (M05-M85)
  eenzaamheid: 'M05',
  vertrouwensbreuk: 'M06',
  nabijheid: 'M07',
  slaap: 'M08',
  perfectionisme: 'M09',
  verlies: 'M13',
  overbelasting: 'M16',
  trauma: 'M17',
  afwijzing: 'M19',
  verwerping: 'M20',
};

// ─── Trigger → Module Mapping (Kim) ────────────────────────────

const KIM_TRIGGER_MAP: Record<string, string> = {
  boundary: 'K01',
  grens: 'K01',
  stress: 'K02',
  burden: 'K02',
  belasting: 'K02',
  codependency: 'CDP01',
  codependentie: 'CDP01',
  grief: 'RNW01',
  rouw: 'RNW01',
  isolation: 'ISO01',
  isolatie: 'ISO01',
  hope: 'HOOP-K01',
  hoop: 'HOOP-K01',
  shame: 'SCHAAM-K01',
  schaamte: 'SCHAAM-K01',
  selfcare: 'K06',
  zelfzorg: 'K06',
};

// ─── Slider Helpers ─────────────────────────────────────────────

function getSlider(mood: MoodSliders, key: string): number {
  return ((mood as any)[key] ?? 0);
}

function getInternal(mood: MoodSliders, key: string): number {
  return getSlider(mood, key) * 10; // 0-10 → 0-100
}

function eliasDistress100(mood: MoodSliders): number {
  const craving = getInternal(mood, 'craving');
  const frustration = getInternal(mood, 'frustration');
  const despondency = getInternal(mood, 'despondency');
  return Math.round((craving * 0.4 + frustration * 0.3 + despondency * 0.3));
}

function eliasResilience100(mood: MoodSliders): number {
  const focus = getInternal(mood, 'focus');
  return focus; // Focus is the resilience indicator for Elias
}

function eliasPrimaryConcern100(mood: MoodSliders): number {
  const craving = getInternal(mood, 'craving');
  const frustration = getInternal(mood, 'frustration');
  const despondency = getInternal(mood, 'despondency');
  return Math.max(craving, frustration, despondency);
}

function kimDistress100(mood: MoodSliders): number {
  const stress = getInternal(mood, 'stress');
  const boundaryFatigue = getInternal(mood, 'boundaryFatigue');
  const emotionalBurden = getInternal(mood, 'emotionalBurden');
  return Math.round((stress * 0.35 + boundaryFatigue * 0.35 + emotionalBurden * 0.3));
}

function kimResilience100(mood: MoodSliders): number {
  const selfCare = getInternal(mood, 'selfCare');
  return selfCare;
}

function kimPrimaryConcern100(mood: MoodSliders): number {
  const stress = getInternal(mood, 'stress');
  const boundaryFatigue = getInternal(mood, 'boundaryFatigue');
  const emotionalBurden = getInternal(mood, 'emotionalBurden');
  return Math.max(stress, boundaryFatigue, emotionalBurden);
}

function getDistress100(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? eliasDistress100(mood) : kimDistress100(mood);
}

function getResilience100(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? eliasResilience100(mood) : kimResilience100(mood);
}

function getPrimaryConcern100(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? eliasPrimaryConcern100(mood) : kimPrimaryConcern100(mood);
}

// ─── Module Mapping Helpers ─────────────────────────────────────

function getCrisisModule(userType: UserType): string {
  return userType === 'elias' ? ELIAS_CRISIS_MODULE : KIM_CRISIS_MODULE;
}

function getDefaultModule(userType: UserType): string {
  return userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE;
}

function getTriggerModule(trigger: string, userType: UserType): string {
  const map = userType === 'elias' ? ELIAS_TRIGGER_MAP : KIM_TRIGGER_MAP;
  const lower = trigger.toLowerCase();
  // Direct match
  if (map[lower]) return map[lower];
  // Partial match
  for (const [key, module] of Object.entries(map)) {
    if (lower.includes(key) || key.includes(lower)) return module;
  }
  return getDefaultModule(userType);
}

function getSliderModule(mood: MoodSliders, userType: UserType): string {
  if (userType === 'elias') {
    const craving = getInternal(mood, 'craving');
    const frustration = getInternal(mood, 'frustration');
    const despondency = getInternal(mood, 'despondency');
    if (craving >= frustration && craving >= despondency) return 'E01';
    if (frustration >= despondency) return 'E03';
    return 'E05';
  }
  // Kim
  const stress = getInternal(mood, 'stress');
  const boundaryFatigue = getInternal(mood, 'boundaryFatigue');
  const emotionalBurden = getInternal(mood, 'emotionalBurden');
  if (boundaryFatigue >= stress && boundaryFatigue >= emotionalBurden) return 'K01';
  if (stress >= emotionalBurden) return 'K02';
  return 'K02';
}

// ─── Tone Determination ─────────────────────────────────────────

function determineTone(
  zone: ZoneColor,
  intent: LiveIntent,
  direction: ResponseDirection
): DominantState['dominantTone'] {
  if (zone === 'PURPLE' || intent === 'crisis') return 'crisis';
  if (zone === 'RED') return 'grounding';
  if (zone === 'ORANGE') {
    if (intent === 'seeking_action') return 'assertive';
    return 'containing';
  }
  if (zone === 'YELLOW') {
    if (direction === 'direct') return 'assertive';
    return 'warm';
  }
  if (direction === 'explore') return 'exploring';
  return 'warm';
}

// ─── VSP "What Helps" Matcher ───────────────────────────────────

function matchesWhatHelps(userMessage: string, whatHelps: string): boolean {
  if (!whatHelps || whatHelps.trim().length < 3) return false;
  if (!userMessage || userMessage.trim().length < 3) return false;
  const msgLower = userMessage.toLowerCase();
  const phrases = whatHelps
    .split(/[,;.\n]|\b(?:en|and|or|of)\b/i)
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length >= 3);
  for (const phrase of phrases) {
    const keywords = phrase.split(/\s+/).filter(w => w.length >= 3);
    if (phrase.length <= 30 && msgLower.includes(phrase)) return true;
    if (keywords.length >= 2) {
      const matchCount = keywords.filter(kw => msgLower.includes(kw)).length;
      if (matchCount >= Math.ceil(keywords.length * 0.6)) return true;
    } else if (keywords.length === 1 && keywords[0].length >= 5) {
      if (msgLower.includes(keywords[0])) return true;
    }
  }
  return false;
}

// ─── Short Module Keyword Detection (Elias only) ────────────────

const SHORT_MODULE_KEYWORDS: Record<string, string> = {
  'eenzaam': 'M05',
  'alleen': 'M05',
  'vertrouwen': 'M06',
  'nabijheid': 'M07',
  'dichtbij': 'M07',
  'slaap': 'M08',
  'slapen': 'M08',
  'insomnia': 'M08',
  'perfect': 'M09',
  'falen': 'M09',
  'verlies': 'M13',
  'dood': 'M13',
  'overbelast': 'M16',
  'uitgeput': 'M16',
  'trauma': 'M17',
  'misbruik': 'M17',
  'afgewezen': 'M19',
  'afwijzing': 'M19',
  'verworpen': 'M20',
  'waardeloos': 'M20',
};

function detectShortModuleKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [keyword, moduleId] of Object.entries(SHORT_MODULE_KEYWORDS)) {
    if (lower.includes(keyword)) return moduleId;
  }
  return null;
}

// ─── Main Selector ──────────────────────────────────────────────

export interface DominantStateSelectorInput {
  buffer: BufferState;
  stateAnalysis: { riskLevel: string; priorityModules: string[] };
  mood: MoodSliders;
  userType: UserType;
  triggerPatterns: TriggerPattern[];
  vspContext?: { vspLevel: string | null; whatHelps: string | null; userMessage: string };
}

export function selectDominantStateServer(input: DominantStateSelectorInput): DominantState {
  const { buffer, stateAnalysis, mood, userType, triggerPatterns, vspContext } = input;
  const distress = getDistress100(mood, userType);
  const resilience = getResilience100(mood, userType);
  const primaryConcern = getPrimaryConcern100(mood, userType);
  const analyzerModules = stateAnalysis.priorityModules || [];

  // ── PRIORITY 1: CRISIS ──
  if (buffer.currentIntent === 'crisis' || stateAnalysis.riskLevel === 'critical' || buffer.currentZoneColor === 'PURPLE') {
    return {
      dominantModule: getCrisisModule(userType),
      dominantTrigger: buffer.currentTriggerGuess || 'crisis',
      dominantDirection: 'crisis_override',
      dominantTone: 'crisis',
      selectionReason: 'Crisis detected: intent, risk level, or zone is PURPLE',
      sourceLayer: 'crisis',
      riskScore: Math.max(buffer.currentZoneScore, 90),
    };
  }

  // ── PRIORITY 1.5: VSP ZONE OVERRIDE (Elias only) ──
  if (vspContext?.vspLevel && userType === 'elias') {
    const vspZone = vspContext.vspLevel.toUpperCase();

    if (vspZone === 'PAARS' || vspZone === 'PURPLE') {
      return {
        dominantModule: getCrisisModule(userType),
        dominantTrigger: buffer.currentTriggerGuess || 'vsp_crisis',
        dominantDirection: 'crisis_override',
        dominantTone: 'crisis',
        selectionReason: 'VSP zone PURPLE selected: user indicated crisis/relapse state',
        sourceLayer: 'crisis',
        riskScore: 90,
      };
    }

    if (vspZone === 'ROOD' || vspZone === 'RED') {
      const whatHelpsMatch = vspContext.whatHelps && vspContext.userMessage
        ? matchesWhatHelps(vspContext.userMessage, vspContext.whatHelps)
        : false;
      if (whatHelpsMatch) {
        return {
          dominantModule: 'E08',
          dominantTrigger: buffer.currentTriggerGuess || 'vsp_self_help',
          dominantDirection: 'stabilize',
          dominantTone: 'grounding',
          selectionReason: 'VSP RED + user mentions their own coping strategy → support mode',
          sourceLayer: 'crisis',
          riskScore: 75,
        };
      }
      const redModule = buffer.currentTriggerGuess === 'craving' ? 'E01' : 'E05';
      return {
        dominantModule: redModule,
        dominantTrigger: buffer.currentTriggerGuess || 'vsp_red_zone',
        dominantDirection: 'stabilize',
        dominantTone: 'grounding',
        selectionReason: 'VSP zone RED selected: user indicated not safe alone → grounding',
        sourceLayer: 'crisis',
        riskScore: 75,
      };
    }

    if (vspZone === 'ORANJE' || vspZone === 'ORANGE') {
      const whatHelpsMatch = vspContext.whatHelps && vspContext.userMessage
        ? matchesWhatHelps(vspContext.userMessage, vspContext.whatHelps)
        : false;
      if (whatHelpsMatch) {
        return {
          dominantModule: 'E08',
          dominantTrigger: buffer.currentTriggerGuess || 'vsp_self_help',
          dominantDirection: buffer.responseDirection,
          dominantTone: 'containing',
          selectionReason: 'VSP ORANGE + user mentions their own coping strategy → support mode',
          sourceLayer: 'live_trigger',
          riskScore: 55,
        };
      }
    }
  }

  // ── PRIORITY 2: URGENT LIVE TRIGGER FROM BUFFER ──
  if (buffer.currentTriggerGuess && buffer.currentZoneScore >= 50) {
    const module = getTriggerModule(buffer.currentTriggerGuess, userType);
    return {
      dominantModule: module,
      dominantTrigger: buffer.currentTriggerGuess,
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `Live trigger "${buffer.currentTriggerGuess}" with zone score ${buffer.currentZoneScore}`,
      sourceLayer: 'live_trigger',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── PRIORITY 3: EXTREME SLIDER STATE ──
  if (primaryConcern >= 70 || (distress >= 65 && resilience <= 30)) {
    const module = getSliderModule(mood, userType);
    const score = Math.max(distress, primaryConcern);
    return {
      dominantModule: module,
      dominantTrigger: buffer.currentTriggerGuess || '',
      dominantDirection: score >= 70 ? 'stabilize' : buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `Extreme slider: primary concern ${primaryConcern}, distress ${Math.round(distress)}, resilience ${Math.round(resilience)}`,
      sourceLayer: 'extreme_slider',
      riskScore: Math.round(score),
    };
  }

  // ── PRIORITY 4: REPEATED SESSION PATTERN (buffer) ──
  const significantRepeats = buffer.temporaryRepeats.filter(r => r.count >= 3);
  if (significantRepeats.length > 0) {
    const topRepeat = significantRepeats.sort((a, b) => b.count - a.count)[0];
    const trigger = topRepeat.signal;
    const module = getTriggerModule(trigger, userType);
    return {
      dominantModule: module,
      dominantTrigger: trigger,
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `Session pattern: "${trigger}" repeated ${topRepeat.count}x in session`,
      sourceLayer: 'session_pattern',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── PRIORITY 5: LONG-TERM USER.DAT PATTERN ──
  const strongPatterns = triggerPatterns.filter(p => p.frequency >= 3);
  if (strongPatterns.length > 0 && buffer.currentZoneScore >= 30) {
    const topPattern = strongPatterns.sort((a, b) => b.frequency - a.frequency)[0];
    const module = getTriggerModule(topPattern.trigger, userType);
    return {
      dominantModule: module,
      dominantTrigger: topPattern.trigger,
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `User.dat pattern: "${topPattern.trigger}" (${topPattern.frequency} historical occurrences)`,
      sourceLayer: 'userdat_pattern',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── PRIORITY 5.5: SHORT MODULE KEYWORD DETECTION (Elias only) ──
  if (userType === 'elias' && buffer.recentMessages && buffer.recentMessages.length > 0) {
    const lastUserMsg = buffer.recentMessages
      .filter((m: { role: string }) => m.role === 'user')
      .pop();
    if (lastUserMsg) {
      const shortModuleId = detectShortModuleKeyword(lastUserMsg.content || '');
      if (shortModuleId) {
        return {
          dominantModule: shortModuleId,
          dominantTrigger: buffer.currentTriggerGuess || '',
          dominantDirection: buffer.responseDirection,
          dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
          selectionReason: `Short module keyword match: ${shortModuleId}`,
          sourceLayer: 'short_module_keyword',
          riskScore: buffer.currentZoneScore,
        };
      }
    }
  }

  // ── PRIORITY 6: BACKPACK RELEVANCE / ANALYZER MODULES ──
  if (analyzerModules.length > 0) {
    return {
      dominantModule: analyzerModules[0],
      dominantTrigger: buffer.currentTriggerGuess || '',
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `StateAnalyzer module: ${analyzerModules[0]}`,
      sourceLayer: 'backpack_relevance',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── DEFAULT ──
  return {
    dominantModule: getDefaultModule(userType),
    dominantTrigger: '',
    dominantDirection: buffer.responseDirection,
    dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
    selectionReason: 'Default: no strong signals detected',
    sourceLayer: 'default',
    riskScore: buffer.currentZoneScore,
  };
}
