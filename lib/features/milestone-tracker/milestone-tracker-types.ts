/**
 * MILESTONE_TRACKER — Types
 * Local, persona-separated milestone display.
 * No gamification, no scores, no streak pressure.
 */

export type MilestonePersona = 'elias' | 'kim';

export type MilestoneFeatureStatus =
  | 'ACTIVE'
  | 'NOT_ELIGIBLE'
  | 'BLOCKED_BY_INTAKE'
  | 'NO_NEW_MILESTONE'
  | 'BLOCKED_BY_PERSONA_SEPARATION'
  | 'DATA_INSUFFICIENT';

export type EliasMilestoneDay = 1 | 7 | 14 | 30 | 60 | 90 | 180 | 365;

export type KimMilestoneKey =
  | 'SELF_CARE_WEEK_1'
  | 'SELF_CARE_MONTH_1'
  | 'SELF_CARE_MONTH_3'
  | 'SELF_CARE_MONTH_6';

export interface SeenMilestoneRecord {
  milestoneId: string;
  persona: MilestonePersona;
  shownAt: string;
  acknowledgedAt?: string;
  homeOpenSessionId: string;
}

export interface EliasMilestoneTrackerState {
  persona: 'elias';
  seenMilestones: SeenMilestoneRecord[];
  lastCheckedAt: string | null;
  lastDisplayedMilestoneId: string | null;
}

export interface KimMilestoneTrackerState {
  persona: 'kim';
  seenMilestones: SeenMilestoneRecord[];
  lastCheckedAt: string | null;
  lastDisplayedMilestoneId: string | null;
}

export interface EliasMilestoneRuntimeInput {
  persona: 'elias';
  intakeCompleted: boolean;
  homeOpenedAt: string;
  homeOpenSessionId: string;
  sobrietyDate: string | null;
  relapseEvents?: Array<{ timestampIso: string; severity?: number }>;
  milestoneState: EliasMilestoneTrackerState;
}

export interface KimMilestoneRuntimeInput {
  persona: 'kim';
  intakeCompleted: boolean;
  homeOpenedAt: string;
  homeOpenSessionId: string;
  selfCareHistory: Array<{ timestampIso: string; completed: boolean; type?: string }>;
  milestoneState: KimMilestoneTrackerState;
}

export type MilestoneRuntimeInput = EliasMilestoneRuntimeInput | KimMilestoneRuntimeInput;

export interface MilestoneDefinition {
  milestoneId: string;
  persona: MilestonePersona;
  label: string;
  thresholdType: 'SOBRIETY_DAYS' | 'SELF_CARE_CONSISTENCY';
  thresholdValue: number;
  title: string;
  message: string;
  ctaLabel: string;
  accentColor: string;
  softBackgroundColor: string;
}

export interface MilestoneEvaluationResult {
  featureId: 'MILESTONE_TRACKER';
  persona: MilestonePersona;
  status: MilestoneFeatureStatus;
  eligibleMilestone: MilestoneDefinition | null;
  calculatedValue: number | null;
  reason: string;
}

export interface MilestoneStoragePatch {
  persona: MilestonePersona;
  storagePath: string;
  seenRecord: SeenMilestoneRecord;
  lastCheckedAt: string;
  lastDisplayedMilestoneId: string;
}

export interface MilestoneCardProps {
  persona: MilestonePersona;
  milestoneId: string;
  title: string;
  message: string;
  ctaLabel: string;
  accentColor: string;
  softBackgroundColor: string;
  onAcknowledge: () => void;
}
