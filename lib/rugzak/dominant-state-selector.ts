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
  sourceLayer: 'crisis' | 'live_trigger' | 'extreme_slider' | 'session_pattern' | 'userdat_pattern' | 'short_module_keyword' | 'backpack_relevance' | 'default';
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
 */
export function selectDominantState(
  buffer: BufferState,
  analysis: StateAnalysis,
  mood: MoodSliders,
  userType: UserType,
  triggerPatterns: TriggerPattern[],
  analyzerModules: string[]
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

  // ── PRIORITY 5: LONG-TERM USER.DAT PATTERN ──
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

  // ── PRIORITY 5.5: SHORT MODULE KEYWORD DETECTION (Elias only) ──
  if (userType === 'elias' && buffer.recentMessages && buffer.recentMessages.length > 0) {
    // Check last user message for short module keyword matches
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
