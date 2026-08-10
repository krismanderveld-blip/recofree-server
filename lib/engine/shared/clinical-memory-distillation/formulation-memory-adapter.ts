/**
 * Formulation Memory Adapter — FASE 8E
 * Provides persona-specific memory bridges for Kim/Elias formulation engines.
 * No storage, no server, no GPT, no side effects.
 */
import type {
  ClinicalDistillationContext,
  KimMemoryBridge,
  EliasMemoryBridge,
} from './clinical-memory-distillation-types';
import {
  getKimFormulationMemoryBridge,
  getEliasFormulationMemoryBridge,
} from './clinical-memory-distillation-contract';

/**
 * Get CMD memory for Kim formulation engine.
 * Returns null if persona is not Kim or context is null.
 */
export function getCMDMemoryForKimFormulation(
  context: ClinicalDistillationContext | null,
): KimMemoryBridge | null {
  if (!context) return null;
  if (context.persona !== 'kim') return null;
  return getKimFormulationMemoryBridge(context);
}

/**
 * Get CMD memory for Elias formulation engine.
 * Returns null if persona is not Elias or context is null.
 */
export function getCMDMemoryForEliasFormulation(
  context: ClinicalDistillationContext | null,
): EliasMemoryBridge | null {
  if (!context) return null;
  if (context.persona !== 'elias') return null;
  return getEliasFormulationMemoryBridge(context);
}

