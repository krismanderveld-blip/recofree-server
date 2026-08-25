/**
 * DominantStateSelector — Patch C
 *
 * Chooses the SINGLE dominant live driver for the next response.
 * Only ONE dominant module per message. Support signals may modify tone
 * but may NOT create multi-focus responses.
 *
 * PRIORITY ORDER:
 * 1. crisis
 * 2. urgent live trigger from current session (buffer)
 * 3. extreme slider state
 * 4. repeated session pattern (buffer temporaryRepeats)
 * 5. long-term user.dat pattern
 * 6. backpack relevance
 *
 * If two candidates conflict:
 * - choose the one with higher live score
 * - if equal, choose the one with stronger risk impact
 * - if still equal, choose the simpler stabilizing option
 */

import type { MoodSliders, UserType, TriggerPattern } from '../ai/types';
import type { BufferState, ZoneColor, LiveIntent, ResponseDirection } from './short-term-memory-buffer';
import type { StateAnalysis } from './state-analyzer';
import {
  kimTriggerToModule,
  kimSliderToModule,
  KIM_DEFAULT_MODULE,
  KIM_CRISIS_MODULE,
  kimDistress100,
  kimResilience100,
  kimPrimaryConcern100,
} from '../engine/kim/module-catalog';
import {
  eliasDistress100,
  eliasResilience100,
  eliasPrimaryConcern100,
} from '../engine/elias/slider-interpretation';
import {
  eliasTriggerToModule,
  eliasSliderToModule,
  ELIAS_DEFAULT_MODULE,
  ELIAS_CRISIS_MODULE,
} from '../engine/elias/module-catalog';
import { detectShortModuleTrigger } from '../engine/elias/short-module-detector';
import { SHORT_MODULE_TAG_MAP } from '../engine/elias/short-module-routing';
import type { ClientNanoInterpretResult } from '../pipeline/nano-interpret-client';

// ─── Output Types ────────────────────────────────────────────

export interface DominantState {
  /** The single dominant module for this response */
  dominantModule: string;
  /** The dominant trigger driving this response (may be empty) */
  dominantTrigger: string;
  /** The dominant response direction */
  dominantDirection: ResponseDirection;
  /** The dominant tone for GPT */
  dominantTone: 'crisis' | 'grounding' | 'assertive' | 'warm' | 'containing' | 'exploring';
  /** Why this was selected (for debugging/logging) */
  selectionReason: string;
  /** The source layer that won (for priority tracking) */
  sourceLayer: 'crisis' | 'live_trigger' | 'extreme_slider' | 'session_pattern' | 'userdat_pattern' | 'short_module_keyword' | 'backpack_relevance' | 'nano_interpret' | 'default';
  /** Risk score on 0-100 scale */
  riskScore: number;
}

// ─── Slider Helpers (Patch D: 0–100 internal) ────────────────

function getInternal(mood: MoodSliders, key: string): number {
  return ((mood as any)[key] ?? 0) * 10; // Patch D
}

function getDistress100(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasDistress100(mood);
  return kimDistress100(mood);
}

function getResilience100(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasResilience100(mood);
  return kimResilience100(mood);
}

function getPrimaryConcern100(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasPrimaryConcern100(mood);
  return kimPrimaryConcern100(mood);
}

// ─── Module Mapping ──────────────────────────────────────────

function getCrisisModule(userType: UserType): string {
  return userType === 'elias' ? ELIAS_CRISIS_MODULE : KIM_CRISIS_MODULE;
}

function getTriggerModule(trigger: string, userType: UserType): string {
  if (userType === 'elias') {
    // First try the standard Elias trigger-to-module mapping
    const standardModule = eliasTriggerToModule(trigger);
    // If it returned the default module, check if the trigger matches a short module tag
    if (standardModule === ELIAS_DEFAULT_MODULE && trigger in SHORT_MODULE_TAG_MAP) {
      return SHORT_MODULE_TAG_MAP[trigger];
    }
    return standardModule;
  }
  return kimTriggerToModule(trigger);
}

function getSliderModule(mood: MoodSliders, userType: UserType): string {
  if (userType === 'elias') return eliasSliderToModule(mood);
  return kimSliderToModule(mood);
}

function getDefaultModule(userType: UserType): string {
  return userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE;
}

function hasExplicitEliasCraving(message: string | undefined): boolean {
  if (!message) return false;
  return /\b(?:craving|zucht|trek\s+in\s+(?:drank|alcohol)|drang\s+om\s+te\s+drinken|wil\s+drinken|want\s+to\s+drink|urge\s+to\s+drink|envie\s+de\s+boire)\b/i.test(message);
}

// ─── Tone from Zone + Intent ─────────────────────────────────

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
  // GREEN
  if (direction === 'explore') return 'exploring';
  return 'warm';
}

// ─── VSP "What Helps" Matcher ────────────────────────────────

/**
 * Check if the user's message references something from their VSP "what helps" content.
 * Uses keyword extraction and fuzzy matching to detect when the user mentions
 * their own coping strategies.
 */
function matchesWhatHelps(userMessage: string, whatHelps: string): boolean {
  if (!whatHelps || whatHelps.trim().length < 3) return false;
  if (!userMessage || userMessage.trim().length < 3) return false;
  
  const msgLower = userMessage.toLowerCase();
  
  // Split whatHelps into meaningful phrases (by comma, semicolon, period, newline, or 'en'/'and')
  const phrases = whatHelps
    .split(/[,;.\n]|\b(?:en|and|or|of)\b/i)
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length >= 3);
  
  // Check if any phrase from "what helps" appears in the user message
  for (const phrase of phrases) {
    // Extract key words (3+ chars) from the phrase
    const keywords = phrase.split(/\s+/).filter(w => w.length >= 3);
    
    // If the full phrase is short enough, check direct inclusion
    if (phrase.length <= 30 && msgLower.includes(phrase)) {
      return true;
    }
    
    // If 2+ keywords from a phrase appear in the message, consider it a match
    if (keywords.length >= 2) {
      const matchCount = keywords.filter(kw => msgLower.includes(kw)).length;
      if (matchCount >= Math.ceil(keywords.length * 0.6)) {
        return true;
      }
    } else if (keywords.length === 1 && keywords[0].length >= 5) {
      // Single long keyword (like "wandelen", "sponsor", "ademhaling")
      if (msgLower.includes(keywords[0])) {
        return true;
      }
    }
  }
  
  return false;
}

// ─── Main Selector ───────────────────────────────────────────

/**
 * Select the single dominant state for the next response.
 *
 * @param buffer - The ShortTermMemoryBuffer (live session context)
 * @param analysis - StateAnalyzer output (slider-based analysis)
 * @param mood - Current mood sliders
 * @param userType - 'elias' or 'kim'
 * @param triggerPatterns - Long-term trigger patterns from user.dat
 * @param analyzerModules - Priority modules from StateAnalyzer
 * @param vspContext - Optional VSP context: the user's selected zone and what helps them
 */
export function selectDominantState(
  buffer: BufferState,
  analysis: StateAnalysis,
  mood: MoodSliders,
  userType: UserType,
  triggerPatterns: TriggerPattern[],
  analyzerModules: string[],
  vspContext?: { vspLevel: string | null; whatHelps: string | null; userMessage: string },
  nanoInterpret?: ClientNanoInterpretResult,
): DominantState {
  const distress = getDistress100(mood, userType);
  const resilience = getResilience100(mood, userType);
  const primaryConcern = getPrimaryConcern100(mood, userType);

  // ── PRIORITY 1: CRISIS ──
  if (buffer.currentIntent === 'crisis' || analysis.riskLevel === 'critical' || buffer.currentZoneColor === 'PURPLE') {
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
  // When user explicitly selects a high zone (ROOD/PAARS) in pre-chat VSP,
  // force appropriate module regardless of slider state.
  if (vspContext?.vspLevel && userType === 'elias') {
    const vspZone = vspContext.vspLevel.toUpperCase();
    
    // PAARS = crisis/relapse → force crisis module
    if (vspZone === 'PAARS' || vspZone === 'PURPLE') {
      return {
        dominantModule: getCrisisModule(userType),
        dominantTrigger: buffer.currentTriggerGuess || 'vsp_crisis',
        dominantDirection: 'crisis_override',
        dominantTone: 'crisis',
        selectionReason: `VSP zone PURPLE selected: user indicated crisis/relapse state`,
        sourceLayer: 'crisis',
        riskScore: 90,
      };
    }
    
    // ROOD = not safe alone → force grounding (E05) or craving (E01) based on content
    if (vspZone === 'ROOD' || vspZone === 'RED') {
      // Check if user message mentions something from their "what helps" → support that
      const whatHelpsMatch = vspContext.whatHelps && vspContext.userMessage
        ? matchesWhatHelps(vspContext.userMessage, vspContext.whatHelps)
        : false;
      
      // If user is already doing what helps them, support it (E08 = acceptance/support)
      if (whatHelpsMatch) {
        return {
          dominantModule: 'E08',
          dominantTrigger: buffer.currentTriggerGuess || 'vsp_self_help',
          dominantDirection: 'stabilize',
          dominantTone: 'grounding',
          selectionReason: `VSP RED + user mentions their own coping strategy → support mode`,
          sourceLayer: 'crisis',
          riskScore: 75,
        };
      }
      
      // Default RED: grounding module
      const redModule = buffer.currentTriggerGuess === 'craving' ? 'E01' : 'E05';
      return {
        dominantModule: redModule,
        dominantTrigger: buffer.currentTriggerGuess || 'vsp_red_zone',
        dominantDirection: 'stabilize',
        dominantTone: 'grounding',
        selectionReason: `VSP zone RED selected: user indicated not safe alone → grounding`,
        sourceLayer: 'crisis',
        riskScore: 75,
      };
    }
    
    // ORANJE = active intervention needed → containing module
    if (vspZone === 'ORANJE' || vspZone === 'ORANGE') {
      // Check if user mentions their coping strategy
      const whatHelpsMatch = vspContext.whatHelps && vspContext.userMessage
        ? matchesWhatHelps(vspContext.userMessage, vspContext.whatHelps)
        : false;
      
      if (whatHelpsMatch) {
        return {
          dominantModule: 'E08',
          dominantTrigger: buffer.currentTriggerGuess || 'vsp_self_help',
          dominantDirection: buffer.responseDirection,
          dominantTone: 'containing',
          selectionReason: `VSP ORANGE + user mentions their own coping strategy → support mode`,
          sourceLayer: 'live_trigger',
          riskScore: 55,
        };
      }
      // Don't override for ORANGE if no whatHelps match — let normal priority flow handle it
    }
  }

  // Explicit craving is a deterministic recovery signal. Nano may enrich it,
  // but a timeout or semantic miss may never route it away from E01.
  if (userType === 'elias' && hasExplicitEliasCraving(vspContext?.userMessage)) {
    return {
      dominantModule: 'E01',
      dominantTrigger: 'craving',
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: 'Explicit craving detected from raw user message',
      sourceLayer: 'live_trigger',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── PRIORITY 2: NANO-INTERPRET (primary semantic detection) ──
  // The nano is the first and primary module detection layer.
  // It understands nuances, context, and intent that no keyword or slider can capture.
  // Everything below is fallback for when nano is unavailable (proxy timeout/error).
  if (nanoInterpret?.resolvedModule) {
    return {
      dominantModule: nanoInterpret.resolvedModule,
      dominantTrigger: buffer.currentTriggerGuess || '',
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `nano-interpret: theme=${nanoInterpret.matchedTheme}, intent=${nanoInterpret.intent}`,
      sourceLayer: 'nano_interpret',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FALLBACK LAYERS (only reached when nano is unavailable)
  // ──────────────────────────────────────────────────────────────────────────

  // ── FALLBACK 1: URGENT LIVE TRIGGER FROM BUFFER ──
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

  // ── FALLBACK 2: EXTREME SLIDER STATE ──
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

  // ── FALLBACK 3: REPEATED SESSION PATTERN (buffer) ──
  const significantRepeats = buffer.temporaryRepeats.filter((r) => r.count >= 3);
  if (significantRepeats.length > 0) {
    // Pick the most repeated signal
    const topRepeat = significantRepeats.sort((a, b) => b.count - a.count)[0];
    const trigger = topRepeat.signal;
    const module = getTriggerModule(trigger, userType) || analyzerModules[0] || getDefaultModule(userType);
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

  // ── FALLBACK 4: LONG-TERM USER.DAT PATTERN ──
  // Only if buffer doesn't have strong live signals
  const strongPatterns = triggerPatterns.filter((p) => p.count >= 3);
  if (strongPatterns.length > 0 && buffer.currentZoneScore >= 30) {
    const topPattern = strongPatterns.sort((a, b) => b.count - a.count)[0];
    const module = getTriggerModule(topPattern.trigger, userType) || analyzerModules[0] || getDefaultModule(userType);
    return {
      dominantModule: module,
      dominantTrigger: topPattern.trigger,
      dominantDirection: buffer.responseDirection,
      dominantTone: determineTone(buffer.currentZoneColor, buffer.currentIntent, buffer.responseDirection),
      selectionReason: `User.dat pattern: "${topPattern.trigger}" (${topPattern.count} historical occurrences)`,
      sourceLayer: 'userdat_pattern',
      riskScore: buffer.currentZoneScore,
    };
  }

  // ── FALLBACK 5: SHORT MODULE KEYWORD DETECTION (Elias only) ──
  if (userType === 'elias' && buffer.recentMessages && buffer.recentMessages.length > 0) {
    const lastUserMsg = buffer.recentMessages
      .filter((m: { role: string }) => m.role === 'user')
      .pop();
    if (lastUserMsg) {
      const shortModuleId = detectShortModuleTrigger(lastUserMsg.content || '');
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

  // ── FALLBACK 6: BACKPACK RELEVANCE / ANALYZER MODULES ──
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
