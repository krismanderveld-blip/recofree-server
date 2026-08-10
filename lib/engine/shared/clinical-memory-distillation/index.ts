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

export {
  mapConfidenceToClinicalMemoryCertainty,
  mapTimestampToFreshness,
  mapZoneToVSPZone,
  mapTrend,
  truncateAnchorText,
} from './clinical-memory-distillation-mappers';

export {
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
  buildRiskAndProtectiveMarkersFromDistillationInput,
  buildClinicalDistillationContextFromParts,
} from './clinical-memory-distillation-builders';

export type {
  ProjectionInput,
  BackpackSectionInput,
  VSPSignalInput,
  ERPFieldInput,
  MoodHistoryInput,
  ModuleUsageInput,
  TriggerPatternInput,
  SchemaTendencyInput,
  ModeTendencyInput,
  DistillationSignalInput,
  DayStructureCompletionInput,
  RelapsePlanInput,
} from './clinical-memory-distillation-builders';

export {
  buildCMDFromDist01,
  mapDist01EntityToMemory,
  mapDist01SignalToCMD,
  mapDist01ContextToCMD,
  createDist01EvidenceItem,
  classifyDist01Domain,
  inferDist01UsePermissions,
  shouldSkipDist01Item,
  buildRecoveryChainCandidatesFromDist01,
  buildRelationalPatternCandidatesFromDist01,
  buildDist01CMDContextParts,
} from './dist01-cmd-bridge';

export type {
  Dist01BridgeEntityInput,
  Dist01BridgeSignalInput,
  Dist01BridgeContextInput,
  Dist01CmdBridgeInput,
  Dist01CmdBridgeOutput,
} from './dist01-cmd-bridge';
