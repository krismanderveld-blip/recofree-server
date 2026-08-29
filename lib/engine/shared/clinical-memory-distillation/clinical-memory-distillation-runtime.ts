/**
 * Clinical Memory Distillation — Runtime Assembler
 * FASE 8E: Builds CMD context from pre-loaded memory objects.
 * Activated only behind EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION=true.
 * No storage reads, no storage writes, no server, no GPT, no side effects.
 */
import type {
  ClinicalMemoryPersona,
  ClinicalMemorySourceLayer,
  ClinicalDistillationContext,
  KimMemoryBridge,
  EliasMemoryBridge,
} from './clinical-memory-distillation-types';
import type { ClinicalMemoryBudgetSelectorOutput } from './clinical-memory-budget-selector';
import {
  validateClinicalDistillationContext,
  getKimFormulationMemoryBridge,
  getEliasFormulationMemoryBridge,
} from './clinical-memory-distillation-contract';
import { selectClinicalMemoryForPrompt } from './clinical-memory-budget-selector';
import {
  buildProjectionMarkersFromProjectionsDat,
  buildBackpackAnchorsFromBackpack,
  buildVSPAnchorsFromVspProfile,
  buildERPAnchorsFromEigenRegiePlan,
  buildProgressTrendSignalsFromStateDat,
  buildDayStructureSignals,
  buildSobrietySignals,
  buildRelapsePlanSignals,
  buildModuleUsageSignalsFromUserDat,
  buildRecurrentPatternsFromUserDat,
  buildClinicalDistillationContextFromParts,
} from './clinical-memory-distillation-builders';
import type {
  BackpackSectionInput,
  VSPSignalInput,
  ERPFieldInput,
  MoodHistoryInput,
  ModuleUsageInput,
  TriggerPatternInput,
  SchemaTendencyInput,
  ModeTendencyInput,
  CaregiverPatternInput,
  RelapsePlanInput,
  DayStructureCompletionInput,
  ProjectionInput,
} from './clinical-memory-distillation-builders';
import {
  buildCMDFromDist01,
  buildRecoveryChainCandidatesFromDist01,
  buildRelationalPatternCandidatesFromDist01,
} from './dist01-cmd-bridge';
import type { Dist01BridgeEntityInput, Dist01BridgeSignalInput, Dist01BridgeContextInput } from './dist01-cmd-bridge';

// ─── Runtime Input (pre-loaded memory objects, NOT storage reads) ──────────
export interface CMDRuntimeInput {
  persona: ClinicalMemoryPersona;
  backpackSections?: BackpackSectionInput[] | null;
  vspSignals?: VSPSignalInput[] | null;
  erpFields?: ERPFieldInput[] | null;
  projectionFears?: ProjectionInput[] | null;
  projectionHopes?: ProjectionInput[] | null;
  moodHistory?: MoodHistoryInput[] | null;
  currentZone?: string | null;
  dayStructureCompletion?: DayStructureCompletionInput | null;
  soberDays?: number | null;
  relapseEvents?: number | null;
  recentRelapse?: boolean;
  relapsePlanAvailable?: boolean;
  relapsePlans?: RelapsePlanInput[] | null;
  moduleUsage?: ModuleUsageInput[] | null;
  triggerPatterns?: TriggerPatternInput[] | null;
  schemaTendencies?: SchemaTendencyInput[] | null;
  modeTendencies?: ModeTendencyInput[] | null;
  caregiverPatterns?: CaregiverPatternInput[] | null;
  dist01Entities?: Dist01BridgeEntityInput[] | null;
  dist01Signals?: Dist01BridgeSignalInput[] | null;
  dist01Contexts?: Dist01BridgeContextInput[] | null;
  nowLocal: string;
  maxPromptTokens?: number;
}

export interface CMDRuntimeOutput {
  enabled: boolean;
  context: ClinicalDistillationContext | null;
  selectorOutput: ClinicalMemoryBudgetSelectorOutput | null;
  validation: { ok: boolean; errors: string[] };
  skippedLayers: { layer: ClinicalMemorySourceLayer; reason: string }[];
  warnings: string[];
}

// ─── Main Runtime Assembler ───────────────────────────────────────────────
export function buildClinicalMemoryDistillationRuntimeContext(input: CMDRuntimeInput): CMDRuntimeOutput {
  const { persona, nowLocal } = input;
  const skippedLayers: { layer: ClinicalMemorySourceLayer; reason: string }[] = [];
  const warnings: string[] = [];

  // Build projections
  const projectionMarkers = buildProjectionMarkersFromProjectionsDat({
    persona,
    fears: input.projectionFears ?? [],
    hopes: input.projectionHopes ?? [],
    nowLocal,
  });
  if (!input.projectionFears && !input.projectionHopes) {
    skippedLayers.push({ layer: 'projections_dat', reason: 'not_available' });
  }

  // Build backpack anchors
  const backpackAnchors = buildBackpackAnchorsFromBackpack({
    persona,
    sections: input.backpackSections ?? [],
    nowLocal,
  });
  if (!input.backpackSections) {
    skippedLayers.push({ layer: 'backpack', reason: 'not_available' });
  }

  // Build VSP anchors (Elias only)
  const vspAnchors = buildVSPAnchorsFromVspProfile({
    persona,
    signals: input.vspSignals ?? [],
  });
  if (!input.vspSignals && persona === 'elias') {
    skippedLayers.push({ layer: 'vsp', reason: 'not_available' });
  }

  // Build ERP anchors (Kim only)
  const erpAnchors = buildERPAnchorsFromEigenRegiePlan({
    persona,
    fields: input.erpFields ?? [],
  });
  if (!input.erpFields && persona === 'kim') {
    skippedLayers.push({ layer: 'eigen_regie_plan', reason: 'not_available' });
  }

  // Build progress trends
  const progressTrendSignals = buildProgressTrendSignalsFromStateDat({
    persona,
    moodHistory: input.moodHistory ?? [],
    currentZone: input.currentZone ?? undefined,
    nowLocal,
  });
  if (!input.moodHistory) {
    skippedLayers.push({ layer: 'state_dat', reason: 'not_available' });
  }

  // Build day structure
  const dayStructureSignals = buildDayStructureSignals({
    persona,
    completion: input.dayStructureCompletion ?? null,
    nowLocal,
  });
  if (!input.dayStructureCompletion) {
    skippedLayers.push({ layer: 'day_structure', reason: 'not_available' });
  }

  // Build sobriety (Elias only)
  const sobrietySignals = buildSobrietySignals({
    persona,
    soberDays: input.soberDays ?? null,
    relapseEvents: input.relapseEvents ?? null,
    recentRelapse: input.recentRelapse ?? false,
    relapsePlanAvailable: input.relapsePlanAvailable ?? false,
  });
  if (persona === 'elias' && input.soberDays === undefined && input.soberDays === null) {
    skippedLayers.push({ layer: 'sobriety', reason: 'not_available' });
  }

  // Build relapse plan (Elias only)
  const relapsePlanSignals = buildRelapsePlanSignals({
    persona,
    plans: input.relapsePlans ?? [],
  });
  if (!input.relapsePlans && persona === 'elias') {
    skippedLayers.push({ layer: 'relapse_plan', reason: 'not_available' });
  }

  // Build module usage
  const moduleUsageSignals = buildModuleUsageSignalsFromUserDat({
    persona,
    moduleUsage: input.moduleUsage ?? [],
  });

  // Build recurrent patterns
  const recurrentPatterns = buildRecurrentPatternsFromUserDat({
    persona,
    triggerPatterns: input.triggerPatterns ?? [],
    schemaTendencies: input.schemaTendencies ?? [],
    modeTendencies: input.modeTendencies ?? [],
    caregiverPatterns: input.caregiverPatterns ?? [],
  });

  // Build DIST01 bridge output
  let dist01RiskMarkers = [] as any[];
  let dist01ProtectiveFactors = [] as any[];
  let dist01MemoryFacts = [] as any[];
  let dist01MemoryHypotheses = [] as any[];
  let dist01RecurrentPatterns = [] as any[];
  let recoveryChains = [] as any[];
  let relationalPatterns = [] as any[];

  if (input.dist01Entities || input.dist01Signals || input.dist01Contexts) {
    // Filter null/undefined/invalid items from DIST01 arrays (defensive)
    const safeEntities = (input.dist01Entities ?? []).filter((e): e is Dist01BridgeEntityInput => e != null && typeof e === 'object');
    const safeSignals = (input.dist01Signals ?? []).filter((s): s is Dist01BridgeSignalInput => s != null && typeof s === 'object');
    const safeContexts = (input.dist01Contexts ?? []).filter((c): c is Dist01BridgeContextInput => c != null && typeof c === 'object');
    const dist01Output = buildCMDFromDist01({
      persona,
      entities: safeEntities,
      signals: safeSignals,
      contexts: safeContexts,
      nowLocal,
    });
    dist01RiskMarkers = dist01Output.riskMarkers;
    dist01ProtectiveFactors = dist01Output.protectiveFactors;
    dist01MemoryFacts = dist01Output.memoryFacts;
    dist01MemoryHypotheses = dist01Output.memoryHypotheses;
    dist01RecurrentPatterns = dist01Output.recurrentPatterns;

    // Recovery chains (Elias only)
    recoveryChains = buildRecoveryChainCandidatesFromDist01({
      persona,
      signals: safeSignals,
      nowLocal,
    });

    // Relational patterns (Kim only)
    relationalPatterns = buildRelationalPatternCandidatesFromDist01({
      persona,
      signals: safeSignals,
      nowLocal,
    });
  } else {
    skippedLayers.push({ layer: 'distillation_dat', reason: 'not_available' });
  }

  // Assemble context
  const context = buildClinicalDistillationContextFromParts({
    persona,
    projectionMarkers,
    backpackAnchors,
    vspAnchors,
    erpAnchors,
    recurrentPatterns: [...recurrentPatterns, ...dist01RecurrentPatterns],
    riskMarkers: dist01RiskMarkers,
    protectiveFactors: dist01ProtectiveFactors,
    moduleUsageSignals,
    progressTrendSignals,
    dayStructureSignals,
    sobrietySignals,
    relapsePlanSignals,
    memoryFacts: dist01MemoryFacts,
    memoryHypotheses: dist01MemoryHypotheses,
    nowLocal,
    maxPromptTokens: input.maxPromptTokens,
  });

  // Inject recovery chains and relational patterns manually (not in buildClinicalDistillationContextFromParts)
  if (recoveryChains.length > 0 && persona === 'elias') {
    context.formulationInput.recoveryChains = recoveryChains;
  }
  if (relationalPatterns.length > 0 && persona === 'kim') {
    context.formulationInput.relationalPatterns = relationalPatterns;
  }

  // Validate
  const validation = validateClinicalDistillationContext(context);
  if (!validation.ok) {
    warnings.push(`CMD validation failed: ${validation.errors.length} errors`);
    return { enabled: true, context: null, selectorOutput: null, validation, skippedLayers, warnings };
  }

  // Run budget selector
  let selectorOutput: ClinicalMemoryBudgetSelectorOutput | null = null;
  try {
    selectorOutput = selectClinicalMemoryForPrompt({
      persona,
      formulationInput: context.formulationInput,
      maxPromptTokens: input.maxPromptTokens,
      currentZone: input.currentZone,
      nowLocal,
    });
  } catch (e) {
    warnings.push('CMD selector failed — formulation continues without budget selection');
  }

  return { enabled: true, context, selectorOutput, validation, skippedLayers, warnings };
}
