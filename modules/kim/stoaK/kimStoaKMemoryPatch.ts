/**
 * STOA-K — Memory Patch Builder
 * Kim-scoped only — never touches Elias memory.
 * Writes to Kim user.dat, projections.dat, logs.dat.
 */

import type {
  KimStoaDetectionResult,
  KimStoaMemoryPatch,
  KimStoaTheme,
} from './kimStoaK.types';

function buildTriggerPattern(themes: KimStoaTheme[]): string {
  if (themes.includes('control_loop')) return 'controlLoopCaregiver';
  if (themes.includes('cannot_control_loved_one')) return 'controlDistinctionNeed';
  if (themes.includes('letting_go_without_abandoning')) return 'lettingGoExploration';
  if (themes.includes('values_as_compass')) return 'valuesBasedOrientation';
  if (themes.includes('boundaries_as_controllable_action')) return 'boundaryAsOwnAction';
  if (themes.includes('acceptance_without_approval')) return 'acceptanceNotApproval';
  if (themes.includes('responsibility_separation')) return 'responsibilitySeparation';
  return 'stoicReflectionGeneral';
}

function buildProjectionNeeds(themes: KimStoaTheme[]): {
  valueNeed?: string[];
  boundaryNeed?: string[];
} {
  const valueNeed: string[] = [];
  const boundaryNeed: string[] = [];

  if (themes.includes('values_as_compass')) valueNeed.push('values_exploration');
  if (themes.includes('boundaries_as_controllable_action')) boundaryNeed.push('boundary_as_own_action');
  if (themes.includes('control_loop')) valueNeed.push('control_loop_defusion');
  if (themes.includes('letting_go_without_abandoning')) valueNeed.push('letting_go_with_care');
  if (themes.includes('acceptance_without_approval')) valueNeed.push('acceptance_distinction');
  if (themes.includes('responsibility_separation')) boundaryNeed.push('responsibility_clarity');

  return {
    valueNeed: valueNeed.length > 0 ? valueNeed : undefined,
    boundaryNeed: boundaryNeed.length > 0 ? boundaryNeed : undefined,
  };
}

export function buildKimStoaKMemoryPatch(
  result: KimStoaDetectionResult,
  timestamp?: string
): KimStoaMemoryPatch {
  const ts = timestamp || new Date().toISOString();
  const pattern = buildTriggerPattern(result.themes);
  const projections = buildProjectionNeeds(result.themes);

  return {
    kimUserDat: {
      triggerPatterns: [
        {
          pattern,
          lastUpdatedAt: ts,
          frequency: 1,
          sourceModuleId: 'STOA-K',
        },
      ],
    },
    kimProjectionsDat: {
      valueNeed: projections.valueNeed,
      boundaryNeed: projections.boundaryNeed,
    },
    kimLogsDat: {
      event: {
        moduleId: 'STOA-K',
        themes: result.themes,
        responseMode: result.responseMode,
        crisisNumbersShown: result.crisisNumbersToShow,
        timestamp: ts,
      },
    },
  };
}
