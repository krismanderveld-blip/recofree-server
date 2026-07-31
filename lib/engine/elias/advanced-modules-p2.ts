/**
 * Elias Advanced Modules Phase 2 — Pipeline Integration Layer
 *
 * Consolidates FALE01, VERG01, ROUW01, IDEN01, ZINK01 detection and prompt building
 * into a single import point for pipeline.ts.
 *
 * Pipeline order: runs at priority 5.6 (after existing advanced modules at 5e5)
 *
 * Routing rules:
 *   - FALE01 has HIGHEST priority when active relapse is detected
 *   - VERG01 activates when shame/guilt/forgiveness markers detected
 *   - ROUW01 activates when grief/loss markers detected
 *   - IDEN01 activates when identity confusion markers detected
 *   - ZINK01 activates when meaning/purpose vacuum markers detected
 *   - Priority: FALE01 > VERG01 > ROUW01 > IDEN01 > ZINK01
 *   - Only ONE module activates per message (highest priority wins)
 *   - Crisis protocol always overrides all modules
 *   - All modules are Elias-only, never Kim
 */

import { RELAPSE_MARKERS_NL, RELAPSE_MARKERS_EN } from '@/lib/engine/elias/modules/fale01/fale01-detector';
import { FORGIVENESS_MARKERS_NL, FORGIVENESS_MARKERS_EN } from '@/lib/engine/elias/modules/verg01/verg01-detector';
import { GRIEF_MARKERS_NL, GRIEF_MARKERS_EN } from '@/lib/engine/elias/modules/rouw01/rouw01-detector';
import { IDENTITY_MARKERS_NL, IDENTITY_MARKERS_EN } from '@/lib/engine/elias/modules/iden01/iden01-detector';
import { MEANING_MARKERS_NL, MEANING_MARKERS_EN } from '@/lib/engine/elias/modules/zink01/zink01-detector';

import { buildFALE01FullPromptBlock } from '@/lib/engine/elias/modules/fale01/fale01-prompt';
import { buildVERG01FullPromptBlock } from '@/lib/engine/elias/modules/verg01/verg01-prompt';
import { buildROUW01FullPromptBlock } from '@/lib/engine/elias/modules/rouw01/rouw01-prompt';
import { buildIDEN01FullPromptBlock } from '@/lib/engine/elias/modules/iden01/iden01-prompt';
import { buildZINK01FullPromptBlock } from '@/lib/engine/elias/modules/zink01/zink01-prompt';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdvancedModuleP2Id = 'FALE01' | 'VERG01' | 'ROUW01' | 'IDEN01' | 'ZINK01' | 'NONE';

export interface EliasAdvancedP2Result {
  fale01Active: boolean;
  verg01Active: boolean;
  rouw01Active: boolean;
  iden01Active: boolean;
  zink01Active: boolean;
  fale01PromptBlock: string | null;
  verg01PromptBlock: string | null;
  rouw01PromptBlock: string | null;
  iden01PromptBlock: string | null;
  zink01PromptBlock: string | null;
  primaryModule: AdvancedModuleP2Id;
  confidence: number;
}

export interface EliasAdvancedP2Input {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  crisisLevel: number;
  intakeCompleted: boolean;
  /** Cross-module flags */
  relapseActive?: boolean;
  shameLevel?: number;
  guiltLevel?: number;
  griefLevel?: number;
  meaningVacuumDetected?: boolean;
}

// ─── Quick Gate (cheap pre-filter) ─────────────────────────────────────────────

const ALL_MARKERS_P2 = [
  ...RELAPSE_MARKERS_NL, ...RELAPSE_MARKERS_EN,
  ...FORGIVENESS_MARKERS_NL, ...FORGIVENESS_MARKERS_EN,
  ...GRIEF_MARKERS_NL, ...GRIEF_MARKERS_EN,
  ...IDENTITY_MARKERS_NL, ...IDENTITY_MARKERS_EN,
  ...MEANING_MARKERS_NL, ...MEANING_MARKERS_EN,
];

/**
 * Cheap pre-filter: returns true if any P2 advanced module marker is present.
 * Use this to avoid running the full detection logic on every message.
 */
export function hasAdvancedModuleP2Markers(message: string): boolean {
  const lower = message.toLowerCase();
  return ALL_MARKERS_P2.some(marker => lower.includes(marker));
}

// ─── Detection Logic ────────────────────────────────────────────────────────────

interface DetectionScore {
  module: AdvancedModuleP2Id;
  score: number;
  markers: string[];
}

function detectModule(message: string, markersNL: string[], markersEN: string[]): { score: number; markers: string[] } {
  const lower = message.toLowerCase();
  const matched: string[] = [];

  for (const m of markersNL) {
    if (lower.includes(m)) matched.push(m);
  }
  for (const m of markersEN) {
    if (lower.includes(m)) matched.push(m);
  }

  // Scoring: 1 marker = 0.5, 2 = 0.7, 3+ = 0.85
  let score = 0;
  if (matched.length >= 3) score = 0.85;
  else if (matched.length === 2) score = 0.7;
  else if (matched.length === 1) score = 0.5;

  return { score, markers: matched };
}

// ─── Main Runner ────────────────────────────────────────────────────────────────

/**
 * Run the Elias advanced module P2 detection pipeline.
 * Detects FALE01, VERG01, ROUW01, IDEN01, ZINK01 in parallel, then selects highest-priority.
 * Only ONE module activates per message.
 * Elias-only: returns empty result for Kim users.
 */
export function runEliasAdvancedModulesP2(input: EliasAdvancedP2Input): EliasAdvancedP2Result {
  const emptyResult: EliasAdvancedP2Result = {
    fale01Active: false,
    verg01Active: false,
    rouw01Active: false,
    iden01Active: false,
    zink01Active: false,
    fale01PromptBlock: null,
    verg01PromptBlock: null,
    rouw01PromptBlock: null,
    iden01PromptBlock: null,
    zink01PromptBlock: null,
    primaryModule: 'NONE',
    confidence: 0,
  };

  // Gate: Elias only
  if (input.userType !== 'elias') return emptyResult;

  // Gate: intake must be completed
  if (!input.intakeCompleted) return emptyResult;

  // Gate: crisis blocks advanced modules
  if (input.crisisLevel >= 2) return emptyResult;

  const combinedText = `${input.latestUserMessage} ${input.recentMessages.join(' ')}`;

  // Quick gate: skip expensive detection if no markers present
  if (!hasAdvancedModuleP2Markers(combinedText)) return emptyResult;

  // Detect all modules
  const scores: DetectionScore[] = [];

  // FALE01 — Relapse/failure
  const fale01 = detectModule(combinedText, RELAPSE_MARKERS_NL, RELAPSE_MARKERS_EN);
  if (fale01.score >= 0.5) {
    scores.push({ module: 'FALE01', score: fale01.score, markers: fale01.markers });
  }

  // VERG01 — Self-forgiveness
  const verg01 = detectModule(combinedText, FORGIVENESS_MARKERS_NL, FORGIVENESS_MARKERS_EN);
  if (verg01.score >= 0.5) {
    scores.push({ module: 'VERG01', score: verg01.score, markers: verg01.markers });
  }

  // ROUW01 — Grief/loss
  const rouw01 = detectModule(combinedText, GRIEF_MARKERS_NL, GRIEF_MARKERS_EN);
  if (rouw01.score >= 0.5) {
    scores.push({ module: 'ROUW01', score: rouw01.score, markers: rouw01.markers });
  }

  // IDEN01 — Identity
  const iden01 = detectModule(combinedText, IDENTITY_MARKERS_NL, IDENTITY_MARKERS_EN);
  if (iden01.score >= 0.5) {
    scores.push({ module: 'IDEN01', score: iden01.score, markers: iden01.markers });
  }

  // ZINK01 — Meaning/purpose
  const zink01 = detectModule(combinedText, MEANING_MARKERS_NL, MEANING_MARKERS_EN);
  if (zink01.score >= 0.5) {
    scores.push({ module: 'ZINK01', score: zink01.score, markers: zink01.markers });
  }

  if (scores.length === 0) return emptyResult;

  // Priority routing: FALE01 > VERG01 > ROUW01 > IDEN01 > ZINK01
  const PRIORITY: Record<AdvancedModuleP2Id, number> = {
    'FALE01': 5,
    'VERG01': 4,
    'ROUW01': 3,
    'IDEN01': 2,
    'ZINK01': 1,
    'NONE': 0,
  };

  // Sort by priority (desc), then by score (desc)
  scores.sort((a, b) => {
    const pDiff = PRIORITY[b.module] - PRIORITY[a.module];
    if (pDiff !== 0) return pDiff;
    return b.score - a.score;
  });

  const winner = scores[0];
  const result: EliasAdvancedP2Result = { ...emptyResult };
  result.primaryModule = winner.module;
  result.confidence = winner.score;

  switch (winner.module) {
    case 'FALE01':
      result.fale01Active = true;
      result.fale01PromptBlock = buildFALE01FullPromptBlock();
      break;
    case 'VERG01':
      result.verg01Active = true;
      result.verg01PromptBlock = buildVERG01FullPromptBlock();
      break;
    case 'ROUW01':
      result.rouw01Active = true;
      result.rouw01PromptBlock = buildROUW01FullPromptBlock();
      break;
    case 'IDEN01':
      result.iden01Active = true;
      result.iden01PromptBlock = buildIDEN01FullPromptBlock();
      break;
    case 'ZINK01':
      result.zink01Active = true;
      result.zink01PromptBlock = buildZINK01FullPromptBlock();
      break;
  }

  console.log(`[Pipeline] EliasAdvancedP2: primary=${winner.module} | confidence=${winner.score.toFixed(2)} | markers=[${winner.markers.slice(0, 3).join(', ')}]`);

  return result;
}
