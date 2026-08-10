/**
 * Clinical Memory Distillation — Public Exports
 * FASE 8B: Contract only. No runtime integration.
 */
export type {
  ClinicalMemoryPersona,
  ClinicalMemorySourceLayer,
  ClinicalMemoryDataClass,
  ClinicalMemoryCertainty,
  ClinicalMemoryFreshness,
  ClinicalMemoryDomain,
  ClinicalMemoryUsePermission,
  MemoryEvidenceItem,
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
  FormulationMemoryInput,
  ClinicalDistillationContext,
  KimMemoryBridge,
  EliasMemoryBridge,
} from './clinical-memory-distillation-types';

export {
  createEmptyClinicalDistillationContext,
  validateClinicalDistillationContext,
  isProjectionSafeForFormulation,
  isMemoryFactPromptEligible,
  isHypothesisPromptEligible,
  getClinicalDistillationPromptBudget,
  getKimFormulationMemoryBridge,
  getEliasFormulationMemoryBridge,
  classifyMemoryLayerForCMD,
  getAllowedUsePermissionsForSource,
} from './clinical-memory-distillation-contract';
