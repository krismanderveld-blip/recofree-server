/**
 * MOOD_TREND_CHART — Elias Implementation
 * Reads only Elias state.dat. No AI, no server calls.
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
  type EliasMoodTrendStateDatShape,
  EliasMoodTrendColors,
  type EliasMoodMetric,
} from './mood-trend-types';
import { tStatic } from '@/lib/i18n';

export function buildEliasMoodTrendChartData(input: MoodTrendRuntimeInput): MoodTrendChartData {
  // Persona separation guard
  if (input.persona !== 'elias' || input.stateDat.persona !== 'elias') {
    return {
      featureId: 'MOOD_TREND_CHART',
      persona: input.persona,
      range: input.range,
      status: 'BLOCKED_BY_PERSONA_SEPARATION',
      requiredMinimumCheckIns: 3,
      totalCheckInsInRange: 0,
      series: [],
      fallbackText: 'Mood trend is unavailable for this persona.',
      generatedAt: input.nowIso,
      localOnly: true,
      aiInterpretationUsed: false,
    };
  }

  const state = input.stateDat as EliasMoodTrendStateDatShape;
  const windowStartIso = getWindowStartIso(input.nowIso, input.range);

  const rawSeries: MoodTrendSeries[] = [
    mapMetricToSeries('craving', tStatic('mood.slider.craving.title'), 'elias', state.cravingHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('frustration', tStatic('mood.slider.frustration.title'), 'elias', state.frustrationHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('despondency', tStatic('mood.slider.despondency.title'), 'elias', state.despondencyHistory, windowStartIso, input.nowIso),
    mapMetricToSeries('focus', tStatic('mood.slider.focus.title'), 'elias', state.focusHistory, windowStartIso, input.nowIso),
  ];

  return finalizeMoodTrendChartData('elias', input.range, rawSeries, input.nowIso);
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

  const colors = EliasMoodTrendColors[metric as EliasMoodMetric];

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
