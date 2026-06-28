/**
 * Server-safe Regulation Layer (fully inlined)
 *
 * Combines:
 * 1. Regulation layer (zone → action → micro-intervention)
 * 2. Regulation decay engine (time decay, response decay, overshoot correction)
 *
 * All logic is inlined to avoid any import chain to react-native.
 */

import type { BufferState, ZoneColor } from './buffer-server';
import { scoreToZone } from './buffer-server';

// ─── Types ────────────────────────────────────────────────────
export type RegulationAction = 'reflect' | 'slow_down' | 'regulate' | 'stabilize' | 'ground';
export type GuidanceDepth = 'light' | 'normal' | 'deep';

export interface RegulationResult {
  action: RegulationAction;
  intervention: string | null;
  requiresRegulationTone: boolean;
  gptInstruction: string | null;
  zone: ZoneColor;
  effectiveDepth: GuidanceDepth;
  wasSoftened: boolean;
  wasSkipped: boolean;
}

export interface DecayResult {
  newZoneScore: number;
  newZoneColor: ZoneColor;
  decayApplied: number;
  activeDecayTypes: ('time' | 'response' | 'overshoot')[];
  reason: string;
}

// ─── Zone → Action Mapping ────────────────────────────────────
function zoneToAction(zone: ZoneColor): RegulationAction {
  switch (zone) {
    case 'GREEN': return 'reflect';
    case 'YELLOW': return 'slow_down';
    case 'ORANGE': return 'regulate';
    case 'RED': return 'stabilize';
    case 'PURPLE': return 'ground';
  }
}

// ─── Effective Depth (zone ceiling) ───────────────────────────
function computeEffectiveDepth(zone: ZoneColor, requested: GuidanceDepth): GuidanceDepth {
  if (zone === 'RED' || zone === 'PURPLE') return 'light';
  if (zone === 'ORANGE' && requested === 'deep') return 'normal';
  return requested;
}

// ─── Micro-Interventions ──────────────────────────────────────
const MICRO_INTERVENTIONS: Record<RegulationAction, string | null> = {
  reflect: null,
  slow_down: 'Even rustig. Wat voel je nu?',
  regulate: 'Blijf hier even. Je hoeft nu niets te begrijpen.',
  stabilize: 'Adem rustig. Je bent veilig. Ik blijf hier.',
  ground: 'Kijk om je heen. Noem 3 dingen die je ziet. Ik ga nergens heen.',
};

const SOFTENED_INTERVENTIONS: Record<RegulationAction, string | null> = {
  reflect: null,
  slow_down: null,
  regulate: 'Ik ben hier. Neem je tijd.',
  stabilize: 'Goed. Blijf rustig.',
  ground: 'Ik ga nergens heen. Je bent hier. Dat is genoeg.',
};

// ─── GPT Instructions ─────────────────────────────────────────
const GPT_INSTRUCTIONS: Record<RegulationAction, string> = {
  reflect: '',
  slow_down: 'Respond gently and slowly. Do not ask more than one question. Keep it short.',
  regulate: 'The user is in emotional distress. Respond with maximum 2 short sentences. No analysis. No questions beyond "what do you feel right now?"',
  stabilize: 'CRITICAL: User is in high distress. Respond ONLY with grounding/presence. Maximum 1-2 sentences. No analysis, no reflection, no questions. Just be present.',
  ground: 'EMERGENCY: User is in crisis-level distress. Respond ONLY with immediate grounding. One sentence maximum. Be a calm anchor. Nothing else.',
};

const SOFTENED_GPT_INSTRUCTIONS: Record<RegulationAction, string> = {
  reflect: '',
  slow_down: 'Continue gently. The user is calming. Keep responses short and warm.',
  regulate: 'Continue with gentle presence. Previous message already regulated. Keep it warm, max 2 sentences.',
  stabilize: 'Continue being present. Previous message already stabilized. Stay calm and brief.',
  ground: 'Continue grounding. Previous message already grounded. Stay as calm anchor.',
};

// ─── Anti-Repetition Detection ────────────────────────────────
const REGULATION_MARKERS = [
  'slow down', 'what do you feel right now', 'stay here for a moment',
  'breathe calmly', 'you don\'t need to understand anything right now',
  'just stay here', 'look around', 'name 3 things',
  'i\'m here. take your time', 'good. stay calm', 'i\'m not going anywhere',
  'you are here. that is enough', 'breathe in', 'breathe out',
  'you are safe', 'you don\'t have to', 'take a moment', 'i\'m staying here',
  'rustig', 'adem', 'je bent veilig', 'ik blijf hier', 'neem je tijd',
];

function messageContainsRegulation(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return REGULATION_MARKERS.some(marker => lower.includes(marker));
}

// ─── Depth Adjustment ─────────────────────────────────────────
function adjustInstructionForDepth(
  instruction: string,
  action: RegulationAction,
  depth: GuidanceDepth,
): string {
  if (!instruction) return '';
  if (depth === 'light') {
    return instruction + ' Be very brief, mostly listen.';
  }
  if (depth === 'deep' && (action === 'slow_down' || action === 'regulate')) {
    return instruction + ' After regulation you may briefly reflect (1 sentence).';
  }
  return instruction;
}

// ─── Main Regulation Function ─────────────────────────────────
export function applyRegulation(
  zone: ZoneColor,
  guidanceDepth: GuidanceDepth = 'normal',
  previousAssistantMessage?: string | null,
): RegulationResult {
  const action = zoneToAction(zone);
  const effectiveDepth = computeEffectiveDepth(zone, guidanceDepth);

  if (action === 'reflect') {
    return {
      action,
      intervention: null,
      requiresRegulationTone: false,
      gptInstruction: null,
      zone,
      effectiveDepth,
      wasSoftened: false,
      wasSkipped: false,
    };
  }

  const previousHadRegulation = previousAssistantMessage
    ? messageContainsRegulation(previousAssistantMessage)
    : false;

  if (previousHadRegulation) {
    if (action === 'slow_down') {
      return {
        action,
        intervention: null,
        requiresRegulationTone: true,
        gptInstruction: adjustInstructionForDepth(SOFTENED_GPT_INSTRUCTIONS[action], action, effectiveDepth),
        zone,
        effectiveDepth,
        wasSoftened: false,
        wasSkipped: true,
      };
    }
    return {
      action,
      intervention: SOFTENED_INTERVENTIONS[action],
      requiresRegulationTone: true,
      gptInstruction: adjustInstructionForDepth(SOFTENED_GPT_INSTRUCTIONS[action], action, effectiveDepth),
      zone,
      effectiveDepth,
      wasSoftened: true,
      wasSkipped: false,
    };
  }

  return {
    action,
    intervention: MICRO_INTERVENTIONS[action],
    requiresRegulationTone: true,
    gptInstruction: adjustInstructionForDepth(GPT_INSTRUCTIONS[action], action, effectiveDepth),
    zone,
    effectiveDepth,
    wasSoftened: false,
    wasSkipped: false,
  };
}

export function requiresPreRegulation(zone: ZoneColor): boolean {
  return zone === 'ORANGE' || zone === 'RED' || zone === 'PURPLE';
}

// ─── Decay Engine ─────────────────────────────────────────────

function computeTimeDecay(buffer: BufferState): number {
  if (!buffer.currentTriggerGuess && buffer.currentIntent === 'neutral') {
    if (buffer.currentZoneScore <= 40) return -2;
    if (buffer.currentZoneScore <= 60) return -3;
    return -4;
  }
  if (buffer.currentIntent !== 'crisis' && buffer.currentIntent !== 'venting') {
    return -2;
  }
  return 0;
}

function computeResponseDecay(buffer: BufferState): number {
  const drop = buffer.previousZoneScore - buffer.currentZoneScore;
  if (buffer.intensityTrajectory === 'falling') {
    if (drop >= 20) return -10;
    if (drop >= 10) return -7;
    return -5;
  }
  if (buffer.intensityTrajectory === 'stable' && drop >= 10) {
    return -5;
  }
  return 0;
}

function computeOvershootCorrection(buffer: BufferState): number {
  const drop = buffer.previousZoneScore - buffer.currentZoneScore;
  if (buffer.previousZoneScore >= 60 && buffer.currentZoneScore <= 35 && drop >= 25) {
    return -20;
  }
  if (buffer.previousZoneScore >= 50 && buffer.currentZoneScore <= 30 && drop >= 20) {
    return -15;
  }
  return 0;
}

export function applyDecayServer(buffer: BufferState): DecayResult {
  const activeTypes: ('time' | 'response' | 'overshoot')[] = [];
  const reasons: string[] = [];
  let totalDecay = 0;

  if (buffer.messageCount <= 1) {
    return {
      newZoneScore: buffer.currentZoneScore,
      newZoneColor: buffer.currentZoneColor,
      decayApplied: 0,
      activeDecayTypes: [],
      reason: 'First message — no decay applied',
    };
  }

  if (buffer.currentIntent === 'crisis' || buffer.currentZoneColor === 'PURPLE') {
    return {
      newZoneScore: buffer.currentZoneScore,
      newZoneColor: buffer.currentZoneColor,
      decayApplied: 0,
      activeDecayTypes: [],
      reason: 'Crisis active — decay suspended',
    };
  }

  const timeDecay = computeTimeDecay(buffer);
  if (timeDecay < 0) {
    totalDecay += timeDecay;
    activeTypes.push('time');
    reasons.push(`time decay: ${timeDecay}`);
  }

  const responseDecay = computeResponseDecay(buffer);
  if (responseDecay < 0) {
    totalDecay += responseDecay;
    activeTypes.push('response');
    reasons.push(`response decay: ${responseDecay}`);
  }

  const overshootDecay = computeOvershootCorrection(buffer);
  if (overshootDecay < 0) {
    totalDecay += overshootDecay;
    activeTypes.push('overshoot');
    reasons.push(`overshoot correction: ${overshootDecay}`);
  }

  const newScore = Math.max(0, buffer.currentZoneScore + totalDecay);
  return {
    newZoneScore: newScore,
    newZoneColor: scoreToZone(newScore),
    decayApplied: totalDecay,
    activeDecayTypes: activeTypes,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No decay conditions met',
  };
}

export function applyDecayToBufferServer(buffer: BufferState, decay: DecayResult): BufferState {
  if (decay.decayApplied === 0) return buffer;
  return {
    ...buffer,
    currentZoneScore: decay.newZoneScore,
    currentZoneColor: decay.newZoneColor,
  };
}
