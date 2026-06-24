/**
 * MOOD_TREND_CHART — Kim Implementation
 * Reads only Kim state.dat. No AI, no server calls.
 */

import {
  type MoodTrendRuntimeInput,
  type MoodTrendChartData,
  type MoodTrendSeries,
  type MoodTrendDataPoint,
  type MoodMetric,
  type MoodTrendPersona,
  type MoodTrendRange,
  type RawMoodHistoryPoint,
  type KimMoodTrendStateDatShape,
  KimMoodTrendColors,
  type KimMoodMetric,
} from './mood-trend-types';
import { tStatic } from '@/lib/i18n';

export function buildKimMoodTrendChartData(input: MoodTrendRuntimeInput): MoodTrendChartData {
  // Persona separation guard
  if (input.persona !== 'kim' || input.stateDat.persona !== 'kim') {
    return {
      featureId: 'MOOD_TREND_CHART',
      persona: input.persona,
      range: input.range,
      status: 'BLOCKED_BY_PERSONA_SEPARATION',
      requiredMinimumCheckIns: 3,
      totalCheckInsInRange: 0,
      series: [],
      fallbackText: tStatic('mood_trend_chart_card.fallback.persona_mismatch'),
      generatedAt: input.nowIso,
      localOnly: true,
      aiInterpretationUsed: false,
    };
  }

  const state = input.stateDat as KimMoodTrendStateDatShape;
  const windowStartIso = getWindowStartIso(input.nowIso, input.range);

  const rawSeries: MoodTrendSeries[] = [
    mapMetricToSeries('stress', tStatic('mood.slider.stress.title'), 'kim', state.stressHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('boundaryFatigue', tStatic('mood.slider.boundaryFatigue.title'), 'kim', state.boundaryFatigueHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('emotionalBurden', tStatic('mood.slider.emotionalBurden.title'), 'kim', state.emotionalBurdenHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('selfCare', tStatic('mood.slider.selfCare.title'), 'kim', state.selfCareHistory, windowStartIso, input.nowIso),
  ];

  return finalizeMoodTrendChartData('kim', input.range, rawSeries, input.nowIso);
}

function getWindowStartIso(nowIso: string, range: MoodTrendRange): string {
  const now = new Date(nowIso);
  const days = range === 'DAYS_7' ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return start.toISOString();
}

function mapMetricToSeries(
  metric: MoodMetric,
  displayName: string,
  persona: MoodTrendPersona,
  history: RawMoodHistoryPoint[],
  fromIso: string,
  toIso: string
): MoodTrendSeries {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();

  const filtered = (history || [])
    .filter((point) => {
      const t = new Date(point.timestampIso).getTime();
      return !Number.isNaN(t) && t >= from && t <= to;
    })
    .filter((point) => typeof point.value === 'number' && point.value >= 0 && point.value <= 10)
    .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());

  const denominator = Math.max(to - from, 1);

  const points: MoodTrendDataPoint[] = filtered.map((point) => {
    const t = new Date(point.timestampIso).getTime();
    return {
      x: (t - from) / denominator,
      y: point.value / 10,
      timestampIso: point.timestampIso,
      label: formatPointLabel(point.timestampIso),
      originalValue: point.value,
    };
  });

  const colors = KimMoodTrendColors[metric as KimMoodMetric];

  return {
    metric,
    displayName,
    persona,
    color: colors.color,
    softColor: colors.softColor,
    points,
    latestValue: points.length > 0 ? points[points.length - 1].originalValue : null,
    minValue: 0,
    maxValue: 10,
    enoughData: points.length >= 3,
  };
}

function finalizeMoodTrendChartData(
  persona: MoodTrendPersona,
  range: MoodTrendRange,
  series: MoodTrendSeries[],
  nowIso: string
): MoodTrendChartData {
  const totalCheckInsInRange = Math.max(...series.map((s) => s.points.length), 0);
  const anySeriesHasEnoughData = series.some((s) => s.points.length >= 3);

  if (totalCheckInsInRange === 0) {
    return {
      featureId: 'MOOD_TREND_CHART',
      persona,
      range,
      status: 'NO_DATA',
      requiredMinimumCheckIns: 3,
      totalCheckInsInRange,
      series,
      fallbackText: tStatic('mood_trend_chart_card.fallback.no_data'),
      generatedAt: nowIso,
      localOnly: true,
      aiInterpretationUsed: false,
    };
  }

  if (!anySeriesHasEnoughData) {
    return {
      featureId: 'MOOD_TREND_CHART',
      persona,
      range,
      status: 'FALLBACK_INSUFFICIENT_CHECKINS',
      requiredMinimumCheckIns: 3,
      totalCheckInsInRange,
      series,
      fallbackText: tStatic('mood_trend_chart_card.fallback.insufficient'),
      generatedAt: nowIso,
      localOnly: true,
      aiInterpretationUsed: false,
    };
  }

  return {
    featureId: 'MOOD_TREND_CHART',
    persona,
    range,
    status: 'READY',
    requiredMinimumCheckIns: 3,
    totalCheckInsInRange,
    series,
    fallbackText: null,
    generatedAt: nowIso,
    localOnly: true,
    aiInterpretationUsed: false,
  };
}

function formatPointLabel(timestampIso: string): string {
  const d = new Date(timestampIso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
