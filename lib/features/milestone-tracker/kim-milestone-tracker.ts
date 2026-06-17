/**
 * KIM MILESTONE TRACKER
 * Evaluates self-care consistency milestones for Kim persona only.
 * No gamification, no pressure, no streak language.
 */

import type {
  KimMilestoneRuntimeInput,
  MilestoneDefinition,
  MilestoneEvaluationResult,
  MilestoneStoragePatch,
  SeenMilestoneRecord,
} from './milestone-tracker-types';

export const KimMilestones: MilestoneDefinition[] = [
  {
    milestoneId: 'KIM_SELF_CARE_WEEK_1',
    persona: 'kim',
    label: 'Week 1',
    thresholdType: 'SELF_CARE_CONSISTENCY',
    thresholdValue: 7,
    title: 'A week of not forgetting yourself.',
    message: 'A week of self-care isn\'t a score. It\'s a signal that your capacity also gets a place.',
    ctaLabel: 'Gently forward',
    accentColor: '#F2A65A',
    softBackgroundColor: '#FFF1DF',
  },
  {
    milestoneId: 'KIM_SELF_CARE_MONTH_1',
    persona: 'kim',
    label: 'Month 1',
    thresholdType: 'SELF_CARE_CONSISTENCY',
    thresholdValue: 30,
    title: 'A month of guarding your capacity.',
    message: 'A month of attention for yourself doesn\'t mean caring got easier. It means you didn\'t completely disappear from view.',
    ctaLabel: 'Take space',
    accentColor: '#F2A65A',
    softBackgroundColor: '#FFF1DF',
  },
  {
    milestoneId: 'KIM_SELF_CARE_MONTH_3',
    persona: 'kim',
    label: 'Month 3',
    thresholdType: 'SELF_CARE_CONSISTENCY',
    thresholdValue: 90,
    title: 'Three months with yourself included.',
    message: 'Three months of self-care isn\'t an obligation you had to get right. It\'s a trace of care that also returns to you.',
    ctaLabel: 'Don\'t carry alone',
    accentColor: '#F2A65A',
    softBackgroundColor: '#FFF1DF',
  },
  {
    milestoneId: 'KIM_SELF_CARE_MONTH_6',
    persona: 'kim',
    label: 'Month 6',
    thresholdType: 'SELF_CARE_CONSISTENCY',
    thresholdValue: 180,
    title: 'Six months of boundaries and care.',
    message: 'Six months of attention to your capacity deserves quiet recognition. Not because you cared perfectly, but because you kept counting too.',
    ctaLabel: 'Preserve your capacity',
    accentColor: '#F2A65A',
    softBackgroundColor: '#FFF1DF',
  },
];

export function calculateConsistentSelfCareDays(
  selfCareHistory: Array<{ timestampIso: string; completed: boolean }>,
  nowIso: string
): number {
  const completedDates = new Set(
    selfCareHistory
      .filter(entry => entry.completed)
      .map(entry => entry.timestampIso.slice(0, 10))
  );

  let count = 0;
  const now = new Date(nowIso);
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (completedDates.has(key)) count += 1;
    else break;
  }
  return count;
}

export function evaluateKimMilestone(
  input: KimMilestoneRuntimeInput
): MilestoneEvaluationResult {
  if (!input.intakeCompleted) {
    return {
      featureId: 'MILESTONE_TRACKER',
      persona: 'kim',
      status: 'BLOCKED_BY_INTAKE',
      eligibleMilestone: null,
      calculatedValue: null,
      reason: 'Intake incomplete.',
    };
  }

  const consistentDays = calculateConsistentSelfCareDays(
    input.selfCareHistory,
    input.homeOpenedAt
  );
  const seenIds = new Set(input.milestoneState.seenMilestones.map(m => m.milestoneId));

  const eligible = KimMilestones
    .filter(m => consistentDays >= m.thresholdValue)
    .filter(m => !seenIds.has(m.milestoneId))
    .sort((a, b) => b.thresholdValue - a.thresholdValue)[0] || null;

  return {
    featureId: 'MILESTONE_TRACKER',
    persona: 'kim',
    status: eligible ? 'ACTIVE' : 'NO_NEW_MILESTONE',
    eligibleMilestone: eligible,
    calculatedValue: consistentDays,
    reason: eligible
      ? 'Unseen Kim self-care milestone reached.'
      : 'No unseen Kim milestone reached.',
  };
}

export function buildKimMilestoneStoragePatch(
  input: KimMilestoneRuntimeInput,
  result: MilestoneEvaluationResult
): MilestoneStoragePatch | null {
  if (result.status !== 'ACTIVE' || result.eligibleMilestone === null) return null;

  const seenRecord: SeenMilestoneRecord = {
    milestoneId: result.eligibleMilestone.milestoneId,
    persona: 'kim',
    shownAt: input.homeOpenedAt,
    homeOpenSessionId: input.homeOpenSessionId,
  };

  return {
    persona: 'kim',
    storagePath: 'local://recofree/personas/kim/user.dat.milestoneTracker',
    seenRecord,
    lastCheckedAt: input.homeOpenedAt,
    lastDisplayedMilestoneId: result.eligibleMilestone.milestoneId,
  };
}
