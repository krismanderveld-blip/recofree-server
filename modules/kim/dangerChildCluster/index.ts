/**
 * Kim Cluster 2: GEVAAR-K01 + KIND-K01
 * Dangerous situations & child safety in addiction context
 */

export type {
  KimCluster2ModuleId,
  KimDangerCategory,
  KimChildSafetyCategory,
  KimCluster2ActivationStatus,
  KimCluster2ResponseMode,
  FixedBelgianCrisisNumber,
  KimCluster2RuntimeInput,
  KimCluster2DetectionResult,
  KimCluster2PromptPayload,
  KimCluster2MemoryPatch,
  KimCluster2TriggerPatternPatch,
  KimCluster2ProjectionPatch,
  KimCluster2LogEntryPatch,
} from './kimDangerChildCluster.types';

export {
  scanMarkers,
  detectGevaarK01,
  detectKindK01,
  resolveCluster2Priority,
} from './kimDangerChildDetector';

export {
  buildGevaarK01Payload,
  buildKindK01Payload,
} from './kimDangerChildPayloads';

export {
  buildDangerChildMemoryPatch,
} from './kimDangerChildMemoryPatch';

export {
  filterDangerChildOutput,
} from './kimDangerChildSafetyFilter';
