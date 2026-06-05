/**
 * Engine Trace — Full per-message debug block builder
 *
 * Produces a structured text block per message with the exact format
 * specified in the debug logging spec. Cumulatively stored in memory
 * and exported via Copy All.
 *
 * NO production logic changes. Read-only access to engine state.
 */

import { getProjectionState } from '@/lib/engine/elias/projection';
import { getInterventionState } from '@/lib/engine/elias/intervention-continuity';
import { getSessionCostSummary } from '@/lib/rugzak/cost-control';

// ─── Types ──────────────────────────────────────────────────────

export interface EngineTraceInput {
  messageIndex: number;
  timestamp: string;
  userMessage: string;

  // Pipeline steps status
  pipelineSteps: PipelineStepStatus[];

  // Zone decision
  zoneDecision: {
    vspInput: string | null;
    vspSeverity: number | null;
    computedZone: string;
    computedSeverity: number;
    finalZone: string | null;
    source: string;
    reason: string;
    isBlocked: boolean;
    isCrisis: boolean;
    // Kim-specific crisis fields (only present for Kim users)
    isKimCrisis?: boolean;
    eigenRegieUserInput?: number | null;
  } | null;

  // Regulation
  regulation: {
    action: string;
    effectiveDepth: string;
    userDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
    gptInstruction: string | null;
    resolvedZoneInput: string;
    isFallbackZone: boolean;
  };

  // Module selection
  moduleSelection: {
    dominantModule: string;
    reason: string;
    activeModules: string[];
  };

  // Model routing
  modelRouting: {
    selectedModel: string;
    riskScore: number;
    crisisLevel: number;
  };

  // Intervention continuity (Elias only)
  interventionContinuity: {
    interventionType: string;
    interventionGoal: string;
    linkedZone: string;
    effectivenessScore: number;
    userResponse: string;
    turnsActive: number;
    wasReEvaluated: boolean;
  } | null;

  // Projection entries
  projectionEntries: Array<{
    category: string;
    content: string;
    strength: string;
    decayScore: number;
    source: string;
    action: string;
  }>;

  // Memory layers
  memory: {
    totalSessions: number;
    triggerPatterns: Array<{ trigger: string; count: number; weight?: number }>;
    moduleUsage: Array<{ moduleId: string; count: number }>;
    changedUserDatFields: string[];

    sliders: Record<string, number | string>;
    changedStateFields: string[];

    bufferZone: string;
    bufferEmotionalDirection: string;
    bufferLiveIntent: string;
    bufferDominantState: string;
  };

  // Payload to server
  payload: {
    isSessionStart: boolean;
    fieldsIncluded: string[];
    promptBlocks: Record<string, boolean | string>;
    estimatedTokens: number;
    usedModel: string;
  };

  // Token usage
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

export interface PipelineStepStatus {
  step: string;
  status: 'passed' | 'blocked' | 'skipped';
  reason: string;
}

// ─── Storage ────────────────────────────────────────────────────

const traceBlocks: string[] = [];

export function clearTraceBlocks(): void {
  traceBlocks.length = 0;
}

export function getTraceBlocks(): readonly string[] {
  return traceBlocks;
}

export function getTraceBlockCount(): number {
  return traceBlocks.length;
}

export function getFullTraceExport(): string {
  if (traceBlocks.length === 0) return '(No messages traced yet)';
  return traceBlocks.join('\n\n');
}

// ─── Builder ────────────────────────────────────────────────────

export function buildTraceBlock(input: EngineTraceInput): string {
  const lines: string[] = [];

  lines.push(`═══ MESSAGE #${input.messageIndex} — ${input.timestamp} ═══`);
  lines.push('');

  // Pipeline steps
  lines.push('PIPELINE STEPS:');
  for (const step of input.pipelineSteps) {
    lines.push(`  ${step.step}: [${step.status}] — ${step.reason}`);
  }
  lines.push('');

  // Zone decision
  lines.push('ZONE BESLISSING:');
  if (input.zoneDecision) {
    const zd = input.zoneDecision;
    lines.push(`  VSP input: ${zd.vspInput ?? 'null'} → severity: ${zd.vspSeverity ?? 'N/A'}`);
    lines.push(`  Computed zone: ${zd.computedZone} → severity: ${zd.computedSeverity}`);
    lines.push(`  Finale zone: ${zd.finalZone ?? 'null'} — source: ${zd.source}`);
    lines.push(`  Reden: ${zd.reason}`);
    lines.push(`  isBlocked: ${zd.isBlocked}`);
    lines.push(`  isCrisis: ${zd.isCrisis}`);
    if (zd.isKimCrisis !== undefined) {
      lines.push(`  isKimCrisis: ${zd.isKimCrisis}`);
      lines.push(`  eigenRegie.userInput: ${zd.eigenRegieUserInput ?? 'null'}`);
    }
  } else {
    lines.push('  (geen Elias zone beslissing — Kim user)');
  }
  lines.push('');

  // Regulation
  lines.push('REGULATION:');
  const reg = input.regulation;
  lines.push(`  zoneInput: ${reg.resolvedZoneInput}${reg.isFallbackZone ? ' (FALLBACK buffer zone)' : ' (resolved engine zone)'}`);
  lines.push(`  action: ${reg.action}`);
  lines.push(`  effectiveDepth: ${reg.effectiveDepth}`);
  lines.push(`  userDepth: ${reg.userDepth}`);
  lines.push(`  wasSoftened: ${reg.wasSoftened}`);
  lines.push(`  wasSkipped: ${reg.wasSkipped}`);
  lines.push(`  gptInstruction: ${reg.gptInstruction ?? 'null'}`);
  lines.push('');

  // Module selection
  lines.push('MODULE SELECTIE:');
  const ms = input.moduleSelection;
  lines.push(`  dominantModule: ${ms.dominantModule}`);
  lines.push(`  reden: ${ms.reason}`);
  lines.push(`  activeModules: [${ms.activeModules.join(', ')}]`);
  lines.push('');

  // Model routing
  lines.push('MODEL ROUTING:');
  const mr = input.modelRouting;
  lines.push(`  selectedModel: ${mr.selectedModel}`);
  lines.push(`  riskScore: ${mr.riskScore}`);
  lines.push(`  crisisLevel: ${mr.crisisLevel}`);
  lines.push('');

  // Intervention continuity
  lines.push('INTERVENTION CONTINUITY:');
  if (input.interventionContinuity) {
    const ic = input.interventionContinuity;
    lines.push(`  interventionType: ${ic.interventionType}`);
    lines.push(`  interventionGoal: ${ic.interventionGoal}`);
    lines.push(`  linkedZone: ${ic.linkedZone}`);
    lines.push(`  effectivenessScore: ${ic.effectivenessScore}`);
    lines.push(`  userResponse: ${ic.userResponse}`);
    lines.push(`  turnsActive: ${ic.turnsActive}`);
    lines.push(`  wasReEvaluated: ${ic.wasReEvaluated}`);
  } else {
    lines.push('  (niet actief)');
  }
  lines.push('');

  // Projection
  lines.push('PROJECTION:');
  if (input.projectionEntries.length > 0) {
    for (const entry of input.projectionEntries) {
      lines.push(`  - category: ${entry.category}`);
      lines.push(`    content: ${entry.content}`);
      lines.push(`    strength: ${entry.strength}`);
      lines.push(`    decayScore: ${entry.decayScore}`);
      lines.push(`    source: ${entry.source}`);
      lines.push(`    actie: ${entry.action}`);
    }
  } else {
    lines.push('  (geen actieve entries)');
  }
  lines.push('');

  // Memory layers
  lines.push('GEHEUGENLAGEN SNAPSHOT:');
  const mem = input.memory;
  lines.push('  user.dat:');
  lines.push(`    totalSessions: ${mem.totalSessions}`);
  lines.push(`    triggerPatterns: [${mem.triggerPatterns.map(t => `${t.trigger}(${t.count}x, w=${t.weight ?? 0})`).join(', ')}]`);
  lines.push(`    moduleUsage: [${mem.moduleUsage.map(m => `${m.moduleId}(${m.count}x)`).join(', ')}]`);
  lines.push(`    gewijzigde velden: [${mem.changedUserDatFields.join(', ') || 'geen'}]`);
  lines.push('');
  lines.push('  state.dat (currentMood):');
  for (const [key, val] of Object.entries(mem.sliders)) {
    lines.push(`    ${key}: ${val}`);
  }
  lines.push(`    gewijzigde velden: [${mem.changedStateFields.join(', ') || 'geen'}]`);
  lines.push('');
  lines.push('  buffer (ShortTermMemoryBuffer):');
  lines.push(`    zone: ${mem.bufferZone}`);
  lines.push(`    emotionalDirection: ${mem.bufferEmotionalDirection}`);
  lines.push(`    liveIntent: ${mem.bufferLiveIntent}`);
  lines.push(`    dominantState: ${mem.bufferDominantState}`);
  lines.push('');

  // Active projections snapshot
  lines.push('  projections:');
  try {
    const projState = getProjectionState();
    const activeEntries = projState.entries.filter(e => e.isActive);
    if (activeEntries.length > 0) {
      for (const e of activeEntries) {
        lines.push(`    - [${e.category}] "${e.content}" decay=${e.decayScore} last=${e.lastReinforcedAt}`);
      }
    } else {
      lines.push('    (geen actieve entries)');
    }
  } catch {
    lines.push('    (projection state niet beschikbaar)');
  }
  lines.push('');

  // Payload to server
  lines.push('PAYLOAD NAAR SERVER:');
  const pl = input.payload;
  lines.push(`  isSessionStart: ${pl.isSessionStart}`);
  lines.push(`  Velden meegestuurd: [${pl.fieldsIncluded.join(', ')}]`);
  lines.push('  Prompt blocks geïnjecteerd:');
  for (const [block, val] of Object.entries(pl.promptBlocks)) {
    lines.push(`    ${block}: ${val}`);
  }
  lines.push(`  Geschatte tokens: ${pl.estimatedTokens}`);
  lines.push(`  Gebruikt model: ${pl.usedModel}`);
  lines.push('');

  // Tokens
  lines.push('TOKENS:');
  if (input.tokens) {
    lines.push(`  promptTokens: ${input.tokens.promptTokens}`);
    lines.push(`  completionTokens: ${input.tokens.completionTokens}`);
    lines.push(`  totalTokens: ${input.tokens.totalTokens}`);
  } else {
    lines.push('  (niet beschikbaar)');
  }
  lines.push('');
  lines.push(`═══ END MESSAGE #${input.messageIndex} ═══`);

  const block = lines.join('\n');
  traceBlocks.push(block);
  return block;
}
