/**
 * Elias Advanced Modules Phase 3 — Pipeline Integration Layer
 *
 * Consolidates TERV01 and MI02 detection and prompt building
 * into a single import point for pipeline.ts.
 *
 * Pipeline order: runs at priority 5.7 (after P2 at 5.6)
 *
 * Routing rules:
 *   - TERV01 activates ONLY after a completed PAARS session + stabilization
 *   - MI02 activates on deep ambivalence (builds on MI01, does not replace it)
 *   - TERV01 has priority over MI02 when both could activate
 *   - Crisis protocol always overrides both modules
 *   - Both modules are Elias-only, never Kim
 *   - TERV01 never activates DURING an active PAARS session
 */

import { detectTERV01 } from '@/modules/elias/terv01/terv01-detector';
import { buildTERV01PromptPayload } from '@/modules/elias/terv01/terv01-prompt';
import { detectMI02 } from '@/modules/elias/mi02/mi02-detector';
import { buildMI02PromptPayload } from '@/modules/elias/mi02/mi02-prompt';
import type { TERV01RuntimeInput } from '@/modules/elias/terv01/terv01-types';
import type { MI02RuntimeInput } from '@/modules/elias/mi02/mi02-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdvancedModuleP3Id = 'TERV01' | 'MI02' | 'NONE';

export interface EliasAdvancedP3Result {
  terv01Active: boolean;
  mi02Active: boolean;
  terv01PromptBlock: string | null;
  mi02PromptBlock: string | null;
  primaryModule: AdvancedModuleP3Id;
  confidence: number;
  responseMode: string | null;
}

export interface EliasAdvancedP3Input {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  crisisLevel: number;
  intakeCompleted: boolean;
  // TERV01-specific
  currentZone: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
  previousZone: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
  previousSessionEnded: boolean;
  previousSessionId: string | null;
  stabilizationCompleted: boolean;
  relapseConfirmed: boolean;
  relapseLikely: boolean;
  userRegulationLevel: number;
  shameIntensity: number;
  medicalRisk: number;
  safetyRisk: number;
  chainDataCompleteness: number;
  triggerKnown: boolean;
  thoughtKnown: boolean;
  feelingKnown: boolean;
  behaviorKnown: boolean;
  usePointKnown: boolean;
  // MI02-specific
  directAmbivalenceMarker: boolean;
  changeTalkPresent: boolean;
  sustainTalkPresent: boolean;
  adviceResistance: boolean;
  externalMotivationDominant: boolean;
  readinessScoreAvailable: boolean;
  readinessScore?: number;
  sessionMixedSignalsCount: number;
  mi01PreviouslyActive: boolean;
  cravingIntensity: number;
}

// ─── Main Runner ────────────────────────────────────────────────────────────────

/**
 * Run the Elias advanced module P3 detection pipeline.
 * Detects TERV01 and MI02, selects highest-priority.
 * Only ONE module activates per message.
 * Elias-only: returns empty result for Kim users.
 */
export function runEliasAdvancedModulesP3(input: EliasAdvancedP3Input): EliasAdvancedP3Result {
  const emptyResult: EliasAdvancedP3Result = {
    terv01Active: false,
    mi02Active: false,
    terv01PromptBlock: null,
    mi02PromptBlock: null,
    primaryModule: 'NONE',
    confidence: 0,
    responseMode: null,
  };

  // Gate: Elias only
  if (input.userType !== 'elias') return emptyResult;

  // Gate: intake must be completed
  if (!input.intakeCompleted) return emptyResult;

  // Gate: crisis blocks advanced modules
  if (input.crisisLevel >= 2) return emptyResult;

  // ── TERV01 Detection ──
  const terv01Input: TERV01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: 'elias',
    currentZone: input.currentZone,
    previousZone: input.previousZone,
    previousSessionEnded: input.previousSessionEnded,
    previousSessionId: input.previousSessionId,
    stabilizationCompleted: input.stabilizationCompleted,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: 'nl',
    detectedMarkers: [],
    crisisProtocolStatus: input.crisisLevel >= 2 ? 'ACTIVE' : input.crisisLevel === 1 ? 'MONITOR' : 'CLEAR',
    medicalRisk: input.medicalRisk,
    safetyRisk: input.safetyRisk,
    relapseConfirmed: input.relapseConfirmed,
    relapseLikely: input.relapseLikely,
    userRequestsAnalysis: true,
    userRegulationLevel: input.userRegulationLevel,
    shameIntensity: input.shameIntensity,
    chainDataCompleteness: input.chainDataCompleteness,
    triggerKnown: input.triggerKnown,
    thoughtKnown: input.thoughtKnown,
    feelingKnown: input.feelingKnown,
    behaviorKnown: input.behaviorKnown,
    usePointKnown: input.usePointKnown,
    timestampIso: LocalDeviceTimeService.now().utcIso,
  };

  const terv01Result = detectTERV01(terv01Input);

  // TERV01 has priority over MI02 when active
  if (terv01Result.activationStatus === 'ACTIVE') {
    const payload = buildTERV01PromptPayload(terv01Input, terv01Result);
    console.log(`[Pipeline] EliasAdvancedP3: primary=TERV01 | confidence=${terv01Result.confidenceScore.toFixed(2)} | mode=${terv01Result.responseMode}`);
    return {
      terv01Active: true,
      mi02Active: false,
      terv01PromptBlock: payload?.fullPrompt ?? null,
      mi02PromptBlock: null,
      primaryModule: 'TERV01',
      confidence: terv01Result.confidenceScore,
      responseMode: terv01Result.responseMode,
    };
  }

  // ── MI02 Detection ──
  const mi02Input: MI02RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: 'elias',
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: 'nl',
    detectedMarkers: [],
    crisisProtocolStatus: input.crisisLevel >= 2 ? 'ACTIVE' : input.crisisLevel === 1 ? 'MONITOR' : 'CLEAR',
    medicalRisk: input.medicalRisk,
    safetyRisk: input.safetyRisk,
    paarsZoneActive: input.currentZone === 'PAARS',
    cravingIntensity: input.cravingIntensity,
    userRegulationLevel: input.userRegulationLevel,
    directAmbivalenceMarker: input.directAmbivalenceMarker,
    changeTalkPresent: input.changeTalkPresent,
    sustainTalkPresent: input.sustainTalkPresent,
    adviceResistance: input.adviceResistance,
    externalMotivationDominant: input.externalMotivationDominant,
    readinessScoreAvailable: input.readinessScoreAvailable,
    readinessScore: input.readinessScore,
    sessionMixedSignalsCount: input.sessionMixedSignalsCount,
    mi01PreviouslyActive: input.mi01PreviouslyActive,
    timestampIso: LocalDeviceTimeService.now().utcIso,
  };

  const mi02Result = detectMI02(mi02Input);

  if (mi02Result.activationStatus === 'ACTIVE') {
    const payload = buildMI02PromptPayload(mi02Result);
    console.log(`[Pipeline] EliasAdvancedP3: primary=MI02 | confidence=${mi02Result.confidenceScore.toFixed(2)} | mode=${mi02Result.responseMode} | oars=${mi02Result.oarsTechnique}`);
    return {
      terv01Active: false,
      mi02Active: true,
      terv01PromptBlock: null,
      mi02PromptBlock: payload?.fullPrompt ?? null,
      primaryModule: 'MI02',
      confidence: mi02Result.confidenceScore,
      responseMode: mi02Result.responseMode,
    };
  }

  return emptyResult;
}
