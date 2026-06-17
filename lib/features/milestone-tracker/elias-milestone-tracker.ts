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
    title: 'Day 1. The hardest one.',
    message: 'You\'re here. That\'s all that was needed today.',
    ctaLabel: 'I\'m here',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_7',
    persona: 'elias',
    label: 'Day 7',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 7,
    title: 'One week of choosing differently.',
    message: 'Seven days of choosing again and again. Not perfect, but present.',
    ctaLabel: 'Quietly forward',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_14',
    persona: 'elias',
    label: 'Day 14',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 14,
    title: 'Two weeks. The body remembers.',
    message: 'Your nervous system is starting to create space. That doesn\'t always feel good. But it\'s movement.',
    ctaLabel: 'I feel it',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_30',
    persona: 'elias',
    label: 'Day 30',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 30,
    title: 'Thirty days. A month of choosing.',
    message: 'One month doesn\'t mean it got easier. It means you kept choosing, even on the hard days.',
    ctaLabel: 'I choose again',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_60',
    persona: 'elias',
    label: 'Day 60',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 60,
    title: 'Two months. The fog is lifting.',
    message: 'Sixty days of recovery. Not every day felt like progress. But you\'re here, and that\'s enough.',
    ctaLabel: 'I\'m here',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_90',
    persona: 'elias',
    label: 'Day 90',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 90,
    title: 'Ninety days. This is real.',
    message: 'Three months of recovery doesn\'t need applause. It does deserve recognition: you\'ve built something.',
    ctaLabel: 'I acknowledge this',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_180',
    persona: 'elias',
    label: 'Day 180',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 180,
    title: 'Half a year of choosing differently.',
    message: 'Six months of recovery doesn\'t need big words. It deserves a quiet acknowledgment: you\'ve built something that needs protecting.',
    ctaLabel: 'Protect what grows',
    accentColor: '#2196F3',
    softBackgroundColor: '#E7F3FE',
  },
  {
    milestoneId: 'ELIAS_SOBRIETY_DAY_365',
    persona: 'elias',
    label: 'Day 365',
    thresholdType: 'SOBRIETY_DAYS',
    thresholdValue: 365,
    title: 'A year of recovery space.',
    message: 'A year doesn\'t mean everything is over. It means there\'s a full year in which recovery found its place, again and again.',
    ctaLabel: 'Carry this gently',
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
