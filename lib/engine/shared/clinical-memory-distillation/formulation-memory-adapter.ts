/**
 * Formulation Memory Adapter — FASE 8E
 * Provides persona-specific memory bridges for Kim/Elias formulation engines.
 * FASE 8L: Bridges now filter by budget selector output when available.
 * No storage, no server, no GPT, no side effects.
 */
import type {
  ClinicalDistillationContext,
  KimMemoryBridge,
  EliasMemoryBridge,
} from './clinical-memory-distillation-types';
import type { ClinicalMemoryBudgetSelectorOutput, ClinicalMemorySelectedItem } from './clinical-memory-budget-selector';
import {
  getKimFormulationMemoryBridge,
  getEliasFormulationMemoryBridge,
} from './clinical-memory-distillation-contract';

/**
 * Get CMD memory for Kim formulation engine.
 * When selectorOutput is provided, only budget-selected items reach the bridge.
 * Returns null if persona is not Kim or context is null.
 */
export function getCMDMemoryForKimFormulation(
  context: ClinicalDistillationContext | null,
  selectorOutput?: ClinicalMemoryBudgetSelectorOutput | null,
): KimMemoryBridge | null {
  if (!context) return null;
  if (context.persona !== 'kim') return null;

  // Without selector output, use full bridge (backward compatible)
  if (!selectorOutput || !selectorOutput.selectedItems?.length) {
    return getKimFormulationMemoryBridge(context);
  }

  // Filter bridge by selected items
  const selectedIds = new Set(selectorOutput.selectedItems.map(i => i.id));
  const selectedKinds = new Set(selectorOutput.selectedItems.map(i => i.kind));
  const fi = context.formulationInput;

  return {
    persona: 'kim',
    relationalPatterns: fi.relationalPatterns.filter(p => selectedIds.has(p.id)),
    erpAnchors: fi.erpAnchors.filter(a => selectedIds.has(a.id)),
    backpackAnchors: fi.backpackAnchors.filter(a => selectedIds.has(a.id)),
    riskMarkers: fi.riskMarkers.filter(r => selectedIds.has(r.id)),
    protectiveFactors: fi.protectiveFactors.filter(p => selectedIds.has(p.id)),
    projectionMarkers: fi.projectionMarkers.filter(p => selectedIds.has(p.id)),
    formulationReadyFacts: fi.memoryFacts.filter(f => selectedIds.has(f.id)),
    formulationReadyHypotheses: fi.memoryHypotheses.filter(h => selectedIds.has(h.id)),
  };
}

/**
 * Get CMD memory for Elias formulation engine.
 * When selectorOutput is provided, only budget-selected items reach the bridge.
 * Returns null if persona is not Elias or context is null.
 */
export function getCMDMemoryForEliasFormulation(
  context: ClinicalDistillationContext | null,
  selectorOutput?: ClinicalMemoryBudgetSelectorOutput | null,
): EliasMemoryBridge | null {
  if (!context) return null;
  if (context.persona !== 'elias') return null;

  // Without selector output, use full bridge (backward compatible)
  if (!selectorOutput || !selectorOutput.selectedItems?.length) {
    return getEliasFormulationMemoryBridge(context);
  }

  // Filter bridge by selected items
  const selectedIds = new Set(selectorOutput.selectedItems.map(i => i.id));
  const fi = context.formulationInput;

  return {
    persona: 'elias',
    recoveryChains: fi.recoveryChains.filter(c => selectedIds.has(c.id)),
    vspAnchors: fi.vspAnchors.filter(a => selectedIds.has(a.id)),
    sobrietySignals: fi.sobrietySignals.filter(s => selectedIds.has(s.id)),
    relapsePlanSignals: fi.relapsePlanSignals.filter(r => selectedIds.has(r.id)),
    riskMarkers: fi.riskMarkers.filter(r => selectedIds.has(r.id)),
    protectiveFactors: fi.protectiveFactors.filter(p => selectedIds.has(p.id)),
    projectionMarkers: fi.projectionMarkers.filter(p => selectedIds.has(p.id)),
    formulationReadyFacts: fi.memoryFacts.filter(f => selectedIds.has(f.id)),
    formulationReadyHypotheses: fi.memoryHypotheses.filter(h => selectedIds.has(h.id)),
  };
}
