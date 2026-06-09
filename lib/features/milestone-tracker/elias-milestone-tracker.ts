/**
 * ELIAS MILESTONE TRACKER
 * Evaluates sobriety milestones for Elias persona only.
 * No gamification, no pressure, no streak language.
 */

import type {
  EliasMilestoneRuntimeInput,
  MilestoneDefinition,
  MilestoneEvaluationResult,
  MilestoneStoragePatch,
  SeenMilestoneRecord,
} from './milestone-tracker-types';

export const EliasMilestones: MilestoneDefinition[] = [
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_1',
    persona: 'elias',
    label: 'Day 1',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 1,
    title: 'Dag 1. De moeilijkste.',
    message: 'Je bent er. Dat is alles wat vandaag nodig was.',
    ctaLabel: 'Ik ben er',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_7',
    persona: 'elias',
    label: 'Day 7',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 7,
    title: 'Eén week anders gekozen.',
    message: 'Zeven dagen waarin je telkens opnieuw koos. Niet perfect, maar aanwezig.',
    ctaLabel: 'Rustig verder',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_14',
    persona: 'elias',
    label: 'Day 14',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 14,
    title: 'Twee weken. Het lichaam herinnert zich.',
    message: 'Je zenuwstelsel begint ruimte te maken. Dat voelt niet altijd goed. Maar het is beweging.',
    ctaLabel: 'Ik voel het',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_30',
    persona: 'elias',
    label: 'Day 30',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 30,
    title: 'Dertig dagen. Een maand van kiezen.',
    message: 'Eén maand betekent niet dat het makkelijk werd. Het betekent dat je bleef kiezen, ook op de moeilijke dagen.',
    ctaLabel: 'Ik kies opnieuw',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_60',
    persona: 'elias',
    label: 'Day 60',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 60,
    title: 'Twee maanden. De mist trekt op.',
    message: 'Zestig dagen herstel. Niet elke dag voelde als vooruitgang. Maar je bent hier, en dat is genoeg.',
    ctaLabel: 'Ik ben hier',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_90',
    persona: 'elias',
    label: 'Day 90',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 90,
    title: 'Negentig dagen. Dit is echt.',
    message: 'Drie maanden herstel vraagt geen applaus. Het verdient wel erkenning: je hebt iets opgebouwd.',
    ctaLabel: 'Ik erken dit',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_180',
    persona: 'elias',
    label: 'Day 180',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 180,
    title: 'Een half jaar anders gekozen.',
    message: 'Een half jaar herstel vraagt geen grote woorden. Het verdient wel een rustige erkenning: je hebt iets opgebouwd dat bescherming nodig heeft.',
    ctaLabel: 'Bescherm wat groeit',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_365',
    persona: 'elias',
    label: 'Day 365',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 365,
    title: 'Een jaar herstelruimte.',
    message: 'Een jaar betekent niet dat alles voorbij is. Het betekent dat er een volledig jaar bestaat waarin herstel telkens opnieuw een plaats kreeg.',
    ctaLabel: 'Neem dit rustig mee',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
];

export function calculateFullDaysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

export function evaluateEliasMilestone(
  input: EliasMilestoneRuntimeInput
): MilestoneEvaluationResult {
  if (!input.intakeCompleted) {
    return {
      featureId: 'MILESTONE_TRACKER',
      persona: 'elias',
      status: 'BLOCKED_BY_INTAKE',
      eligibleMilestone: null,
      calculatedValue: null,
      reason: 'Intake incomplete.',
    };
  }

  if (!input.sobrietyDate) {
    return {
      featureId: 'MILESTONE_TRACKER',
      persona: 'elias',
      status: 'DATA_INSUFFICIENT',
      eligibleMilestone: null,
      calculatedValue: null,
      reason: 'No sobrietyDate available.',
    };
  }

  const soberDays = calculateFullDaysBetween(input.sobrietyDate, input.homeOpenedAt);
  const seenIds = new Set(input.milestoneState.seenMilestones.map(m => m.milestoneId));

  const eligible = EliasMilestones
    .filter(m => soberDays >= m.thresholdValue)
    .filter(m => !seenIds.has(m.milestoneId))
    .sort((a, b) => b.thresholdValue - a.thresholdValue)[0] || null;

  return {
    featureId: 'MILESTONE_TRACKER',
    persona: 'elias',
    status: eligible ? 'ACTIVE' : 'NO_NEW_MILESTONE',
    eligibleMilestone: eligible,
    calculatedValue: soberDays,
    reason: eligible
      ? 'Unseen Elias sobriety milestone reached.'
      : 'No unseen Elias milestone reached.',
  };
}

export function buildEliasMilestoneStoragePatch(
  input: EliasMilestoneRuntimeInput,
  result: MilestoneEvaluationResult
): MilestoneStoragePatch | null {
  if (result.status !== 'ACTIVE' || result.eligibleMilestone === null) return null;

  const seenRecord: SeenMilestoneRecord = {
    milestoneId: result.eligibleMilestone.milestoneId,
    persona: 'elias',
    shownAt: input.homeOpenedAt,
    homeOpenSessionId: input.homeOpenSessionId,
  };

  return {
    persona: 'elias',
    storagePath: 'local://recofree/personas/elias/user.dat.milestoneTracker',
    seenRecord,
    lastCheckedAt: input.homeOpenedAt,
    lastDisplayedMilestoneId: result.eligibleMilestone.milestoneId,
  };
}
