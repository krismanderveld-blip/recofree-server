/**
 * Kim Cluster 3 — Memory Patch Builder
 * Kim-scoped only. Never writes Elias memory. Never writes server memory.
 */

import type {
  KimCluster3ModuleId,
  KimCluster3DetectionResult,
  KimCluster3MemoryPatch,
  KimCluster3TriggerPatternPatch,
  KimCluster3ProjectionPatch,
  KimCluster3RuntimeInput,
} from './kimCluster3.types';

// ─── Trigger pattern mappings ──────────────────────────────

const TRIGGER_PATTERNS: Record<KimCluster3ModuleId, Array<{ id: string; label: string; normalizedLabel: string }>> = {
  'ROL-K01': [
    { id: 'careRoleDropEmotionWave', label: 'Emotiegolf na wegvallen zorgrol', normalizedLabel: 'careRoleDropEmotionWave' },
    { id: 'suppressedAngerAfterCare', label: 'Onderdrukte woede na zorgen', normalizedLabel: 'suppressedAngerAfterCare' },
    { id: 'identityLossWithoutCareRole', label: 'Identiteitsverlies zonder zorgrol', normalizedLabel: 'identityLossWithoutCareRole' },
  ],
  'VETR02-K': [
    { id: 'silenceFeelsUnsafe', label: 'Stilte voelt onveilig', normalizedLabel: 'silenceFeelsUnsafe' },
    { id: 'admissionTriggersOldFear', label: 'Opname triggert oude angst', normalizedLabel: 'admissionTriggersOldFear' },
    { id: 'partnerAbsenceHypervigilance', label: 'Hyperwaakzaamheid bij afwezigheid', normalizedLabel: 'partnerAbsenceHypervigilance' },
    { id: 'checkingPhoneLoop', label: 'Telefoon-check loop', normalizedLabel: 'checkingPhoneLoop' },
    { id: 'calmFeelsUntrustworthy', label: 'Rust voelt onbetrouwbaar', normalizedLabel: 'calmFeelsUntrustworthy' },
  ],
  'LEUGEN-K01': [
    { id: 'detectiveRoleLoop', label: 'Detective-rol loop', normalizedLabel: 'detectiveRoleLoop' },
    { id: 'chronicLyingBetrayalPain', label: 'Pijn door chronisch liegen', normalizedLabel: 'chronicLyingBetrayalPain' },
    { id: 'hopeTrustSplit', label: 'Gespleten tussen hoop en wantrouwen', normalizedLabel: 'hopeTrustSplit' },
  ],
};

const PROJECTIONS: Record<KimCluster3ModuleId, Array<{ id: string; kind: 'fear' | 'concern' | 'identity_need' | 'boundary_need'; label: string; normalizedLabel: string; decayScoreInitial: number }>> = {
  'ROL-K01': [
    { id: 'needIdentityBeyondCareRole', kind: 'identity_need', label: 'Nood aan identiteit buiten zorgrol', normalizedLabel: 'needIdentityBeyondCareRole', decayScoreInitial: 0.80 },
    { id: 'fearEmotionsOverwhelm', kind: 'fear', label: 'Angst dat emoties overweldigen', normalizedLabel: 'fearEmotionsOverwhelm', decayScoreInitial: 0.78 },
    { id: 'guiltForFeelingRelief', kind: 'concern', label: 'Schuldgevoel over opluchting', normalizedLabel: 'guiltForFeelingRelief', decayScoreInitial: 0.72 },
  ],
  'VETR02-K': [
    { id: 'fearSomethingWillGoWrongInSilence', kind: 'fear', label: 'Angst dat er iets misgaat in stilte', normalizedLabel: 'fearSomethingWillGoWrongInSilence', decayScoreInitial: 0.82 },
    { id: 'fearCannotTrustCalm', kind: 'fear', label: 'Angst om rust te vertrouwen', normalizedLabel: 'fearCannotTrustCalm', decayScoreInitial: 0.86 },
    { id: 'fearAbsenceMeansDanger', kind: 'fear', label: 'Afwezigheid = gevaar', normalizedLabel: 'fearAbsenceMeansDanger', decayScoreInitial: 0.74 },
  ],
  'LEUGEN-K01': [
    { id: 'needClarityWithoutControl', kind: 'boundary_need', label: 'Nood aan helderheid zonder controle', normalizedLabel: 'needClarityWithoutControl', decayScoreInitial: 0.80 },
    { id: 'fearCannotBelieveAnything', kind: 'fear', label: 'Angst niets meer te kunnen geloven', normalizedLabel: 'fearCannotBelieveAnything', decayScoreInitial: 0.84 },
    { id: 'needBoundariesBasedOnBehavior', kind: 'boundary_need', label: 'Grenzen op basis van gedrag, niet bewijs', normalizedLabel: 'needBoundariesBasedOnBehavior', decayScoreInitial: 0.76 },
  ],
};

export function buildKimCluster3MemoryPatch(
  result: KimCluster3DetectionResult,
  input: KimCluster3RuntimeInput
): KimCluster3MemoryPatch | null {
  if (input.persona !== 'kim') return null;
  if (result.activationStatus !== 'ACTIVE') return null;

  const now = input.timestampIso || new Date().toISOString();
  const moduleId = result.moduleId;

  const triggerPatterns: KimCluster3TriggerPatternPatch[] = (TRIGGER_PATTERNS[moduleId] || []).map(tp => ({
    triggerId: tp.id,
    label: tp.label,
    normalizedLabel: tp.normalizedLabel,
    theme: result.themes[0] || 'suppressed_emotions_after_care_role',
    firstDetectedAt: now,
    lastUpdatedAt: now,
    frequencyIncrement: 1 as const,
    sourceModuleId: moduleId,
  }));

  const projections: KimCluster3ProjectionPatch[] = (PROJECTIONS[moduleId] || []).map(p => ({
    projectionId: p.id,
    kind: p.kind,
    label: p.label,
    normalizedLabel: p.normalizedLabel,
    decayScoreInitial: p.decayScoreInitial,
    sourceModuleId: moduleId,
    firstDetectedAt: now,
    lastUpdatedAt: now,
  }));

  return {
    persona: 'kim',
    moduleId,
    storageTargets: ['user.dat', 'projections.dat', 'logs.dat'],
    triggerPatterns,
    projections,
    logEntry: {
      logId: `${moduleId}-${input.sessionId}-${input.turnId}`,
      sessionId: input.sessionId,
      turnId: input.turnId,
      timestampIso: now,
      moduleId,
      responseMode: result.responseMode,
      matchedMarkers: result.matchedMarkers,
      themes: result.themes,
      crisisNumbersShown: result.crisisNumbersToShow,
      storePolicy: 'local_kim_scoped_only',
      rawTextStored: false,
    },
  };
}
