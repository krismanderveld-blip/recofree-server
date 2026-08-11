/**
 * DIST01 Quality Analyzer
 * FASE 9E: Classification only — no runtime, no writeback, no mutation
 */

export type {
  Dist01FailureCategory,
  Dist01RecommendedAction,
  Dist01TargetLayer,
  Dist01QualityScenarioInput,
  Dist01TestResultAnalysis,
  Dist01BatchQualityAnalysis,
  Dist01BatchRecommendedNextPhase,
} from './dist01-test-result-analyzer-types';

export {
  analyzeDist01TestResult,
  analyzeDist01TestBatch,
  mapFailureToRecommendedActions,
  mapFailureToTargetLayers,
  determineAffectedDomains,
  buildDist01QualitySummary,
} from './dist01-test-result-analyzer';
