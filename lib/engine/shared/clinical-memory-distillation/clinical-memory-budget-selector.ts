/**
 * FASE 8K: Clinical Memory Budget Selector
 *
 * Pure deterministic selector that chooses which CMD items may go to formulation/prompt.
 * Respects maxPromptTokens budget, persona separation, safety priority, and prompt eligibility.
 *
 * Engine beslist. GPT formuleert.
 */

import type {
  ClinicalMemoryPersona,
  ClinicalMemoryDomain,
  ClinicalMemoryCertainty,
  ClinicalMemorySourceLayer,
  ClinicalMemoryUsePermission,
  FormulationMemoryInput,
  MemoryFact,
  MemoryHypothesis,
  ProjectionMarker,
  RecurrentPattern,
  RecoveryChain,
  RelationalPattern,
  BackpackAnchor,
  VSPAnchor,
  ERPAnchor,
  RiskMarker,
  ProtectiveFactor,
  BufferSignal,
  ModuleUsageSignal,
  ProgressTrendSignal,
  DayStructureSignal,
  SobrietySignal,
  RelapsePlanSignal,
} from './clinical-memory-distillation-types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClinicalMemoryItemKind =
  | 'memory_fact'
  | 'memory_hypothesis'
  | 'recurrent_pattern'
  | 'recovery_chain'
  | 'relational_pattern'
  | 'backpack_anchor'
  | 'vsp_anchor'
  | 'erp_anchor'
  | 'risk_marker'
  | 'protective_factor'
  | 'projection_marker'
  | 'buffer_signal'
  | 'module_usage_signal'
  | 'progress_trend_signal'
  | 'day_structure_signal'
  | 'sobriety_signal'
  | 'relapse_plan_signal';

export interface ClinicalMemoryBudgetSelectorInput {
  persona: ClinicalMemoryPersona;
  formulationInput: FormulationMemoryInput;
  maxPromptTokens?: number;
  currentZone?: string | null;
  stressLevel?: number | null;
  cravingLevel?: number | null;
  nowLocal: string;
}

export interface ClinicalMemorySelectedItem {
  id: string;
  kind: ClinicalMemoryItemKind;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain | 'unknown';
  text: string;
  score: number;
  estimatedTokens: number;
  certainty: ClinicalMemoryCertainty | 'unknown';
  sourceLayer?: ClinicalMemorySourceLayer;
  selectedReason: string;
  isHypothesis: boolean;
  isSafetyRelevant: boolean;
  isPromptEligible: boolean;
}

export interface ClinicalMemoryBudgetSelectorOutput {
  persona: ClinicalMemoryPersona;
  maxPromptTokens: number;
  estimatedTokens: number;
  selectedItems: ClinicalMemorySelectedItem[];
  excludedItems: { id: string; kind: string; reason: string }[];
  warnings: string[];
  safetyItemsIncluded: number;
  hypothesisItemsIncluded: number;
  rawItemsExcluded: number;
  personaLeakageBlocked: number;
}

interface ScoringContext {
  persona: ClinicalMemoryPersona;
  currentZone?: string | null;
  stressLevel?: number | null;
  cravingLevel?: number | null;
  nowLocal: string;
}

// ─── 1. selectClinicalMemoryForPrompt ──────────────────────────────────────────

export function selectClinicalMemoryForPrompt(
  input: ClinicalMemoryBudgetSelectorInput
): ClinicalMemoryBudgetSelectorOutput {
  const { persona, formulationInput, currentZone, stressLevel, cravingLevel, nowLocal } = input;

  // Hard max budget
  const rawMax = input.maxPromptTokens ?? formulationInput.maxPromptTokens ?? 600;
  const maxPromptTokens = Math.min(rawMax, 1200);

  const output: ClinicalMemoryBudgetSelectorOutput = {
    persona,
    maxPromptTokens,
    estimatedTokens: 0,
    selectedItems: [],
    excludedItems: [],
    warnings: [],
    safetyItemsIncluded: 0,
    hypothesisItemsIncluded: 0,
    rawItemsExcluded: 0,
    personaLeakageBlocked: 0,
  };

  // Normalize all items to candidates
  const candidates = normalizeFormulationInputToCandidates(formulationInput, persona);

  const scoringCtx: ScoringContext = { persona, currentZone, stressLevel, cravingLevel, nowLocal };

  // Filter and score
  const eligible: ClinicalMemorySelectedItem[] = [];

  for (const candidate of candidates) {
    // Persona check
    if (!isClinicalMemoryItemAllowedForPersona(candidate, persona)) {
      output.excludedItems.push({ id: candidate.id, kind: candidate.kind, reason: 'persona_incompatible' });
      output.personaLeakageBlocked++;
      continue;
    }

    // Prompt eligibility
    if (!isClinicalMemoryItemPromptEligible(candidate)) {
      output.excludedItems.push({ id: candidate.id, kind: candidate.kind, reason: candidate.isPromptEligible ? 'raw_or_unsafe' : 'not_prompt_eligible' });
      output.rawItemsExcluded++;
      continue;
    }

    // Score
    candidate.score = scoreClinicalMemoryItem(candidate, scoringCtx);
    eligible.push(candidate);
  }

  // Sort by score descending
  eligible.sort((a, b) => b.score - a.score);

  // Select within budget
  let usedTokens = 0;
  for (const item of eligible) {
    if (usedTokens + item.estimatedTokens > maxPromptTokens) {
      output.excludedItems.push({ id: item.id, kind: item.kind, reason: 'budget_exceeded' });
      continue;
    }
    output.selectedItems.push(item);
    usedTokens += item.estimatedTokens;

    if (item.isSafetyRelevant) output.safetyItemsIncluded++;
    if (item.isHypothesis) output.hypothesisItemsIncluded++;
  }

  output.estimatedTokens = usedTokens;
  return output;
}

// ─── 2. scoreClinicalMemoryItem ────────────────────────────────────────────────

export function scoreClinicalMemoryItem(
  candidate: ClinicalMemorySelectedItem,
  context: ScoringContext
): number {
  let score = 0;

  // Base priority by kind
  switch (candidate.kind) {
    case 'risk_marker':
      score += candidate.isSafetyRelevant ? 100 : 60;
      break;
    case 'vsp_anchor':
      score += context.persona === 'elias' ? 90 : 0;
      break;
    case 'relapse_plan_signal':
      score += context.persona === 'elias' ? 85 : 0;
      break;
    case 'recovery_chain':
      score += context.persona === 'elias' ? 80 : 0;
      break;
    case 'relational_pattern':
      score += context.persona === 'kim' ? 80 : 0;
      break;
    case 'erp_anchor':
      score += context.persona === 'kim' ? 75 : 0;
      break;
    case 'day_structure_signal':
      score += 70;
      break;
    case 'progress_trend_signal':
      score += 65;
      break;
    case 'protective_factor':
      score += 55;
      break;
    case 'recurrent_pattern':
      score += 50;
      break;
    case 'backpack_anchor':
      score += 45;
      break;
    case 'memory_fact':
      score += 45;
      break;
    case 'sobriety_signal':
      score += 40;
      break;
    case 'memory_hypothesis':
      score += 25;
      break;
    case 'projection_marker':
      score += 15;
      break;
    case 'module_usage_signal':
      score += 10;
      break;
    case 'buffer_signal':
      score += 5;
      break;
  }

  // Zone modifiers
  const zone = context.currentZone;
  if (zone === 'red' || zone === 'purple') {
    if (candidate.isSafetyRelevant) score += 30;
  } else if (zone === 'orange') {
    if (candidate.isSafetyRelevant) score += 15;
  }

  // Craving modifier
  if (context.cravingLevel != null && context.cravingLevel >= 7) {
    const cravingDomains: string[] = ['craving', 'relapse_risk', 'substance_use'];
    if (cravingDomains.includes(candidate.domain)) score += 25;
  }

  // Stress modifier
  if (context.stressLevel != null && context.stressLevel >= 7) {
    const stressDomains: string[] = ['emotional_overload', 'body_state', 'sleep'];
    if (stressDomains.includes(candidate.domain)) score += 20;
  }

  // Freshness modifier (simplified based on sourceLayer)
  if (candidate.sourceLayer === 'buffer') {
    score += 20; // current session
  } else if (candidate.sourceLayer === 'distillation_dat' || candidate.sourceLayer === 'state_dat') {
    score += 15; // recent persistent
  } else if (candidate.sourceLayer === 'user_dat') {
    score += 5; // older persistent
  }

  // Certainty modifiers
  switch (candidate.certainty) {
    case 'confirmed_by_user':
      score += 20;
      break;
    case 'high_confidence_inference':
      score += 10;
      break;
    case 'medium_confidence_inference':
      score -= 5;
      break;
    case 'low_confidence_inference':
      score -= 20;
      break;
    case 'projection':
      score -= 10;
      break;
    case 'unknown':
      score -= 15;
      break;
  }

  // Hypothesis penalty (unless safety)
  if (candidate.isHypothesis && !candidate.isSafetyRelevant) {
    score -= 10;
  }

  return score;
}

// ─── 3. estimateClinicalMemoryTokens ───────────────────────────────────────────

export function estimateClinicalMemoryTokens(text: string): number {
  if (!text) return 1;
  return Math.max(1, Math.ceil(text.length / 4));
}

// ─── 4. compressClinicalMemoryText ─────────────────────────────────────────────

export function compressClinicalMemoryText(text: string, maxChars: number): string {
  if (!text) return '';
  // Remove excessive whitespace
  let compressed = text.replace(/\s+/g, ' ').trim();
  if (compressed.length <= maxChars) return compressed;
  // Hard truncate at safe boundary
  const truncated = compressed.slice(0, maxChars);
  // Find last safe ending (sentence end, comma, space)
  const lastSafe = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf(', '),
    truncated.lastIndexOf(' ')
  );
  if (lastSafe > maxChars * 0.5) {
    return truncated.slice(0, lastSafe + 1).trim();
  }
  return truncated.trim();
}

// ─── 5. isClinicalMemoryItemAllowedForPersona ──────────────────────────────────

export function isClinicalMemoryItemAllowedForPersona(
  candidate: ClinicalMemorySelectedItem,
  persona: ClinicalMemoryPersona
): boolean {
  if (persona === 'kim') {
    // Kim blocks Elias-specific items
    const kimBlocked: ClinicalMemoryItemKind[] = ['recovery_chain', 'vsp_anchor', 'sobriety_signal', 'relapse_plan_signal'];
    if (kimBlocked.includes(candidate.kind)) return false;
  }
  if (persona === 'elias') {
    // Elias blocks Kim-specific items
    const eliasBlocked: ClinicalMemoryItemKind[] = ['relational_pattern', 'erp_anchor'];
    if (eliasBlocked.includes(candidate.kind)) return false;
  }
  // Block items with wrong persona
  if (candidate.persona !== persona && candidate.persona !== 'kim' && candidate.persona !== 'elias') {
    return false;
  }
  return true;
}

// ─── 6. isClinicalMemoryItemPromptEligible ─────────────────────────────────────

export function isClinicalMemoryItemPromptEligible(
  candidate: ClinicalMemorySelectedItem
): boolean {
  // Already marked not eligible
  if (!candidate.isPromptEligible) return false;
  return true;
}

// ─── 7. normalizeFormulationInputToCandidates ──────────────────────────────────

export function normalizeFormulationInputToCandidates(
  input: FormulationMemoryInput,
  persona: ClinicalMemoryPersona
): ClinicalMemorySelectedItem[] {
  const candidates: ClinicalMemorySelectedItem[] = [];
  const MAX_TEXT_CHARS = 200;

  // MemoryFacts
  for (const item of input.memoryFacts ?? []) {
    if (!item || !item.text) continue;
    const text = compressClinicalMemoryText(item.text, MAX_TEXT_CHARS);
    if (!text) continue;
    const isHyp = item.certainty !== 'confirmed_by_user' && item.certainty !== 'high_confidence_inference';
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'memory_fact',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'unknown',
      sourceLayer: item.sourceLayer,
      selectedReason: 'memory_fact',
      isHypothesis: isHyp,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible && !!item.evidence?.length,
    });
  }

  // MemoryHypotheses
  for (const item of input.memoryHypotheses ?? []) {
    if (!item || !item.hypothesis) continue;
    const text = compressClinicalMemoryText(item.hypothesis, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'memory_hypothesis',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'unknown',
      sourceLayer: item.sourceLayer,
      selectedReason: 'hypothesis',
      isHypothesis: true,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // RecurrentPatterns
  for (const item of input.recurrentPatterns ?? []) {
    if (!item || !item.pattern) continue;
    const text = compressClinicalMemoryText(Array.isArray(item.pattern) ? item.pattern.join(', ') : String(item.pattern), MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'recurrent_pattern',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'unknown',
      sourceLayer: item.sourceLayers?.[0],
      selectedReason: 'recurrent_pattern',
      isHypothesis: item.certainty !== 'confirmed_by_user',
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // RecoveryChains (Elias only)
  for (const item of input.recoveryChains ?? []) {
    if (!item || !item.chain?.length) continue;
    const text = compressClinicalMemoryText(item.chain.join(' → '), MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'recovery_chain',
      persona: item.persona ?? persona,
      domain: 'relapse_risk',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'medium_confidence_inference',
      sourceLayer: undefined,
      selectedReason: 'recovery_chain',
      isHypothesis: item.certainty !== 'confirmed_by_user',
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // RelationalPatterns (Kim only)
  for (const item of input.relationalPatterns ?? []) {
    if (!item || !item.pattern?.length) continue;
    const text = compressClinicalMemoryText(Array.isArray(item.pattern) ? item.pattern.join(', ') : String(item.pattern), MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'relational_pattern',
      persona: item.persona ?? persona,
      domain: item.activeDomains?.[0] ?? 'trust',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'medium_confidence_inference',
      sourceLayer: undefined,
      selectedReason: 'relational_pattern',
      isHypothesis: item.certainty !== 'confirmed_by_user',
      isSafetyRelevant: item.harmRepeated === true,
      isPromptEligible: !notEligible,
    });
  }

  // BackpackAnchors
  for (const item of input.backpackAnchors ?? []) {
    if (!item || !item.anchorText) continue;
    const text = compressClinicalMemoryText(item.anchorText, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'backpack_anchor',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'confirmed_by_user',
      sourceLayer: item.sourceLayer,
      selectedReason: 'backpack_anchor',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // VSPAnchors
  for (const item of input.vspAnchors ?? []) {
    if (!item || !item.signal) continue;
    const text = compressClinicalMemoryText(item.signal, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    const isSafety = item.zone === 'red' || item.zone === 'purple' || item.zone === 'orange';
    candidates.push({
      id: item.id,
      kind: 'vsp_anchor',
      persona: item.persona ?? persona,
      domain: 'relapse_risk',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.confidence as ClinicalMemoryCertainty ?? 'high_confidence_detection',
      sourceLayer: item.sourceLayer ?? 'vsp',
      selectedReason: 'vsp_anchor',
      isHypothesis: false,
      isSafetyRelevant: isSafety,
      isPromptEligible: !notEligible,
    });
  }

  // ERPAnchors
  for (const item of input.erpAnchors ?? []) {
    if (!item || !item.signal) continue;
    const text = compressClinicalMemoryText(item.signal, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'erp_anchor',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.confidence as ClinicalMemoryCertainty ?? 'high_confidence_detection',
      sourceLayer: item.sourceLayer ?? 'eigen_regie_plan',
      selectedReason: 'erp_anchor',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // RiskMarkers
  for (const item of input.riskMarkers ?? []) {
    if (!item || !item.risk) continue;
    const text = compressClinicalMemoryText(item.risk, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    const isSafety = item.severity === 'high' || item.severity === 'acute';
    candidates.push({
      id: item.id,
      kind: 'risk_marker',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'high_confidence_inference',
      sourceLayer: undefined,
      selectedReason: `risk_${item.severity}`,
      isHypothesis: false,
      isSafetyRelevant: isSafety,
      isPromptEligible: !notEligible,
    });
  }

  // ProtectiveFactors
  for (const item of input.protectiveFactors ?? []) {
    if (!item || !item.factor) continue;
    const text = compressClinicalMemoryText(item.factor, MAX_TEXT_CHARS);
    if (!text) continue;
    const notEligible = hasBlockingPermission(item.usePermissions);
    candidates.push({
      id: item.id,
      kind: 'protective_factor',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'high_confidence_inference',
      sourceLayer: undefined,
      selectedReason: 'protective_factor',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // ProjectionMarkers
  for (const item of input.projectionMarkers ?? []) {
    if (!item || !item.text) continue;
    const text = compressClinicalMemoryText(item.text, MAX_TEXT_CHARS);
    if (!text) continue;
    const hasHypPerm = item.usePermissions?.includes('may_use_only_as_hypothesis');
    const notEligible = hasBlockingPermission(item.usePermissions) || !hasHypPerm;
    candidates.push({
      id: item.id,
      kind: 'projection_marker',
      persona: item.persona ?? persona,
      domain: 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'projection',
      sourceLayer: item.sourceLayer ?? 'projections_dat',
      selectedReason: `projection_${item.projectionType}`,
      isHypothesis: true,
      isSafetyRelevant: false,
      isPromptEligible: !notEligible,
    });
  }

  // BufferSignals
  for (const item of input.bufferSignals ?? []) {
    if (!item || !item.signal) continue;
    // Buffer signals are raw — always excluded
    candidates.push({
      id: item.id,
      kind: 'buffer_signal',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text: '',
      score: 0,
      estimatedTokens: 0,
      certainty: 'low_confidence_inference',
      sourceLayer: 'buffer',
      selectedReason: 'buffer_raw',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: false,
    });
  }

  // ModuleUsageSignals
  for (const item of input.moduleUsageSignals ?? []) {
    if (!item || !item.moduleId) continue;
    const text = `module ${item.moduleId} used`;
    candidates.push({
      id: item.id,
      kind: 'module_usage_signal',
      persona: item.persona ?? persona,
      domain: 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'high_confidence_inference',
      sourceLayer: undefined,
      selectedReason: 'module_usage',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: true,
    });
  }

  // ProgressTrendSignals
  for (const item of input.progressTrendSignals ?? []) {
    if (!item || !item.direction) continue;
    const text = compressClinicalMemoryText(`${item.domain ?? 'general'}: ${item.direction}`, MAX_TEXT_CHARS);
    if (!text) continue;
    candidates.push({
      id: item.id,
      kind: 'progress_trend_signal',
      persona: item.persona ?? persona,
      domain: item.domain ?? 'unknown',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: item.certainty ?? 'medium_confidence_inference',
      sourceLayer: undefined,
      selectedReason: `trend_${item.direction}`,
      isHypothesis: false,
      isSafetyRelevant: item.direction === 'worsening',
      isPromptEligible: true,
    });
  }

  // DayStructureSignals
  for (const item of input.dayStructureSignals ?? []) {
    if (!item || !item.pattern) continue;
    const text = `dagstructuur: ${item.pattern}`;
    candidates.push({
      id: item.id,
      kind: 'day_structure_signal',
      persona: item.persona ?? persona,
      domain: 'day_structure',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'high_confidence_inference',
      sourceLayer: undefined,
      selectedReason: `day_structure_${item.pattern}`,
      isHypothesis: false,
      isSafetyRelevant: item.pattern === 'structure_collapsed',
      isPromptEligible: true,
    });
  }

  // SobrietySignals
  for (const item of input.sobrietySignals ?? []) {
    if (!item) continue;
    const text = `nuchterheid: ${item.soberDays ?? 0} dagen`;
    candidates.push({
      id: item.id,
      kind: 'sobriety_signal',
      persona: item.persona ?? persona,
      domain: 'sobriety',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'confirmed_by_user',
      sourceLayer: undefined,
      selectedReason: 'sobriety',
      isHypothesis: false,
      isSafetyRelevant: false,
      isPromptEligible: true,
    });
  }

  // RelapsePlanSignals
  for (const item of input.relapsePlanSignals ?? []) {
    if (!item) continue;
    const planText = [item.trigger, item.plannedAction, item.supportAction].filter(Boolean).join('; ') || 'terugvalpreventieplan actief';
    const text = compressClinicalMemoryText(planText, MAX_TEXT_CHARS);
    candidates.push({
      id: item.id,
      kind: 'relapse_plan_signal',
      persona: item.persona ?? persona,
      domain: 'relapse_risk',
      text,
      score: 0,
      estimatedTokens: estimateClinicalMemoryTokens(text),
      certainty: 'high_confidence_inference',
      sourceLayer: item.sourceLayer ?? 'relapse_plan',
      selectedReason: 'relapse_plan',
      isHypothesis: false,
      isSafetyRelevant: true,
      isPromptEligible: true,
    });
  }

  return candidates;
}

// ─── 8. buildSelectedCMDMemorySummary ──────────────────────────────────────────

export function buildSelectedCMDMemorySummary(
  output: ClinicalMemoryBudgetSelectorOutput
): string {
  if (!output.selectedItems.length) return '';

  const groups: Record<string, string[]> = {
    'Risico/veiligheid': [],
    'Terugkerende patronen': [],
    'Ankers': [],
    'Beschermende factoren': [],
    'Hypotheses/toekomst': [],
  };

  for (const item of output.selectedItems) {
    const label = item.isHypothesis ? `[hypothese] ${item.text}` : item.text;

    if (item.isSafetyRelevant || item.kind === 'risk_marker') {
      groups['Risico/veiligheid'].push(label);
    } else if (item.kind === 'recurrent_pattern' || item.kind === 'recovery_chain' || item.kind === 'relational_pattern') {
      groups['Terugkerende patronen'].push(label);
    } else if (item.kind === 'erp_anchor' || item.kind === 'vsp_anchor' || item.kind === 'backpack_anchor') {
      groups['Ankers'].push(label);
    } else if (item.kind === 'protective_factor') {
      groups['Beschermende factoren'].push(label);
    } else if (item.isHypothesis || item.kind === 'projection_marker' || item.kind === 'memory_hypothesis') {
      const projLabel = item.kind === 'projection_marker'
        ? `[${item.selectedReason.includes('fear') ? 'toekomstangst' : 'toekomsthoop'}] ${item.text}`
        : label;
      groups['Hypotheses/toekomst'].push(projLabel);
    } else {
      // Other items go to patterns
      groups['Terugkerende patronen'].push(label);
    }
  }

  const parts: string[] = [];
  for (const [heading, items] of Object.entries(groups)) {
    if (items.length > 0) {
      parts.push(`${heading}: ${items.join('; ')}`);
    }
  }

  return parts.join('\n');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hasBlockingPermission(permissions?: ClinicalMemoryUsePermission[]): boolean {
  if (!permissions) return false;
  return permissions.includes('may_not_use_in_gpt');
}
