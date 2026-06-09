/**
 * MOOD_TREND_CHART — Types
 * Pure UI feature, no AI interpretation, no server calls.
 * Persona-separated: Elias reads only Elias data, Kim reads only Kim data.
 */

export type MoodTrendPersona = 'elias' | 'kim';

export type MoodTrendRange = 'DAYS_7' | 'DAYS_30';

export type MoodTrendFeatureStatus =
  | 'READY'
  | 'FALLBACK_INSUFFICIENT_CHECKINS'
  | 'NO_DATA'
  | 'BLOCKED_BY_PERSONA_SEPARATION'
  | 'BLOCKED_BY_MISSING_STATE'
  | 'ERROR_INVALID_DATA';

export type EliasMoodMetric = 'craving' | 'frustration' | 'despondency' | 'focus';

export type KimMoodMetric = 'stress' | 'boundaryFatigue' | 'emotionalBurden' | 'selfCare';

export type MoodMetric = EliasMoodMetric | KimMoodMetric;

export interface RawMoodHistoryPoint {
  timestampIso: string;
  value: number;
}

export interface EliasMoodTrendStateDatShape {
  persona: 'elias';
  cravingHistory: RawMoodHistoryPoint[];
  frustrationHistory: RawMoodHistoryPoint[];
  despondencyHistory: RawMoodHistoryPoint[];
  focusHistory: RawMoodHistoryPoint[];
}

export interface KimMoodTrendStateDatShape {
  persona: 'kim';
  stressHistory: RawMoodHistoryPoint[];
  boundaryFatigueHistory: RawMoodHistoryPoint[];
  emotionalBurdenHistory: RawMoodHistoryPoint[];
  selfCareHistory: RawMoodHistoryPoint[];
}

export type MoodTrendStateDatShape =
  | EliasMoodTrendStateDatShape
  | KimMoodTrendStateDatShape;

export interface MoodTrendRuntimeInput {
  persona: MoodTrendPersona;
  range: MoodTrendRange;
  nowIso: string;
  stateDat: MoodTrendStateDatShape;
}

export interface MoodTrendDataPoint {
  x: number;
  y: number;
  timestampIso: string;
  label: string;
  originalValue: number;
}

export interface MoodTrendSeries {
  metric: MoodMetric;
  displayName: string;
  persona: MoodTrendPersona;
  color: string;
  softColor: string;
  points: MoodTrendDataPoint[];
  latestValue: number | null;
  minValue: number;
  maxValue: number;
  enoughData: boolean;
}

export interface MoodTrendChartData {
  featureId: 'MOOD_TREND_CHART';
  persona: MoodTrendPersona;
  range: MoodTrendRange;
  status: MoodTrendFeatureStatus;
  requiredMinimumCheckIns: 3;
  totalCheckInsInRange: number;
  series: MoodTrendSeries[];
  fallbackText: string | null;
  generatedAt: string;
  localOnly: true;
  aiInterpretationUsed: false;
}

export interface MoodTrendChartCardProps {
  persona: MoodTrendPersona;
  initialRange?: MoodTrendRange;
  chartData: MoodTrendChartData;
  onRangeChange: (range: MoodTrendRange) => void;
}

export interface SimpleLineChartProps {
  series: MoodTrendSeries[];
  width: number;
  height: number;
  yMin: number;
  yMax: number;
  showLegend: boolean;
  showLatestValue: boolean;
}

// Color tokens
export const EliasMoodTrendColors: Record<EliasMoodMetric, { color: string; softColor: string }> = {
  craving: { color: '#E57373', softColor: '#FDECEC' },
  frustration: { color: '#F2A65A', softColor: '#FFF1DF' },
  despondency: { color: '#9B8FE8', softColor: '#F0EEFF' },
  focus: { color: '#2196F3', softColor: '#E7F3FE' },
};

export const KimMoodTrendColors: Record<KimMoodMetric, { color: string; softColor: string }> = {
  stress: { color: '#E57373', softColor: '#FDECEC' },
  boundaryFatigue: { color: '#F2A65A', softColor: '#FFF1DF' },
  emotionalBurden: { color: '#9B8FE8', softColor: '#F0EEFF' },
  selfCare: { color: '#7FB9B3', softColor: '#EAF6F4' },
};
