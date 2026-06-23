/**
 * MoodTrendChartCard — SVG line chart for mood trends
 * Uses react-native-svg. No AI, no server calls, no gamification.
 * Persona-separated: Elias shows craving/frustration/despondency/focus,
 * Kim shows stress/boundaryFatigue/emotionalBurden/selfCare.
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';
import { Pressable } from 'react-native';

import type {
  MoodTrendChartCardProps,
  MoodTrendChartData,
  MoodTrendPersona,
  MoodTrendRange,
  MoodTrendSeries,
  SimpleLineChartProps,
} from '@/lib/features/mood-trend/mood-trend-types';
import { useTranslation, tStatic } from '@/lib/i18n';

// ─── SimpleLineChart ────────────────────────────────────────────────────────

function SimpleLineChart({ series, width, height, showLegend, showLatestValue }: SimpleLineChartProps) {
  const padding = 24;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const toX = (x: number) => padding + x * chartWidth;
  const toY = (y: number) => padding + (1 - y) * chartHeight;

  const renderableSeries = series.filter((s) => s.points.length >= 2);

  return (
    <View accessible accessibilityLabel={tStatic('mood_trend_chart_card.accessibility_label')}>
      <Svg width={width} height={height}>
        {/* Grid lines at 0, 5, 10 */}
        {[0, 0.5, 1].map((yGrid) => (
          <Line
            key={`grid-${yGrid}`}
            x1={padding}
            x2={padding + chartWidth}
            y1={toY(yGrid)}
            y2={toY(yGrid)}
            stroke="#EEF3F7"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {[0, 5, 10].map((val) => (
          <React.Fragment key={`label-${val}`}>
            {/* Using SVG text would require react-native-svg Text, use RN overlay instead */}
          </React.Fragment>
        ))}

        {/* Series lines and dots */}
        {renderableSeries.map((s) => {
          const pointsStr = s.points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ');
          return (
            <React.Fragment key={s.metric}>
              <Polyline
                points={pointsStr}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.points.map((p) => (
                <Circle
                  key={`${s.metric}-${p.timestampIso}`}
                  cx={toX(p.x)}
                  cy={toY(p.y)}
                  r={3}
                  fill={s.color}
                />
              ))}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Y-axis text labels overlay */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'space-between', paddingVertical: padding - 6 }]} pointerEvents="none">
        <Text style={styles.axisLabel}>{tStatic('mood_trend_chart_card.axis_label.10')}</Text>
        <Text style={styles.axisLabel}>{tStatic('mood_trend_chart_card.axis_label.5')}</Text>
        <Text style={styles.axisLabel}>{tStatic('mood_trend_chart_card.axis_label.0')}</Text>
      </View>

      {/* Legend */}
      {showLegend && (
        <View style={styles.legendContainer}>
          {series.map((s) => (
            <View key={s.metric} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.displayName}</Text>
              {showLatestValue && s.latestValue !== null && (
                <Text style={styles.legendValue}>{s.latestValue}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Range Toggle ───────────────────────────────────────────────────────────

function MoodTrendRangeToggle({
  persona,
  value,
  onChange,
}: {
  persona: MoodTrendPersona;
  value: MoodTrendRange;
  onChange: (range: MoodTrendRange) => void;
}) {
  const activeColor = persona === 'elias' ? '#E7F3FE' : '#FFF1DF';
  const activeTextColor = persona === 'elias' ? '#1565C0' : '#B96E1E';

  return (
    <View style={styles.toggleContainer}>
      <Pressable
        onPress={() => onChange('DAYS_7')}
        style={[
          styles.toggleButton,
          value === 'DAYS_7' && { backgroundColor: activeColor },
        ]}
      >
        <Text style={[styles.toggleText, value === 'DAYS_7' && { color: activeTextColor, fontWeight: '600' }]}>
          7 days
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('DAYS_30')}
        style={[
          styles.toggleButton,
          value === 'DAYS_30' && { backgroundColor: activeColor },
        ]}
      >
        <Text style={[styles.toggleText, value === 'DAYS_30' && { color: activeTextColor, fontWeight: '600' }]}>
          30 days
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Fallback ───────────────────────────────────────────────────────────────

function MoodTrendTextFallback({
  text,
  checkInCount,
}: {
  persona: MoodTrendPersona;
  status: string;
  text: string | null;
  checkInCount: number;
}) {
  return (
    <View style={styles.fallbackContainer}>
      <Text style={styles.fallbackText}>{text || tStatic('mood_trend_chart_card.fallback.no_data')}</Text>
      {checkInCount > 0 && (
        <Text style={styles.fallbackCount}>
          {checkInCount} check-in{checkInCount !== 1 ? tStatic('mood_trend_chart_card.fallback.check_in_plural') : ''} recorded
        </Text>
      )}
    </View>
  );
}

// ─── Main Card ──────────────────────────────────────────────────────────────

export function MoodTrendChartCard({ persona, chartData, onRangeChange }: MoodTrendChartCardProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 72, 360);

  const title = persona === 'elias' ? t('mood_trend_chart_card.title.elias') : t('mood_trend_chart_card.title.kim');
  const subtitle =
    persona === 'elias'
      ? t('mood_trend_chart_card.subtitle.elias')
      : t('mood_trend_chart_card.subtitle.kim');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <MoodTrendRangeToggle
          persona={persona}
          value={chartData.range}
          onChange={onRangeChange}
        />
      </View>

      {chartData.status === 'READY' ? (
        <SimpleLineChart
          series={chartData.series}
          width={chartWidth}
          height={180}
          yMin={0}
          yMax={10}
          showLegend={true}
          showLatestValue={true}
        />
      ) : (
        <MoodTrendTextFallback
          persona={persona}
          status={chartData.status}
          text={chartData.fallbackText}
          checkInCount={chartData.totalCheckInsInRange}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF3F7',
    shadowColor: '#1F2933',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2933',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#7B8794',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F7F9FB',
    borderRadius: 16,
    height: 36,
    alignItems: 'center',
    padding: 3,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 13,
  },
  toggleText: {
    fontSize: 13,
    color: '#7B8794',
  },
  axisLabel: {
    fontSize: 10,
    color: '#7B8794',
    paddingLeft: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#52606D',
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2933',
  },
  fallbackContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: '#7B8794',
    textAlign: 'center',
  },
  fallbackCount: {
    fontSize: 12,
    color: '#9AA5B1',
    marginTop: 8,
  },
});
