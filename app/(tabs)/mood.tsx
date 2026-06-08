import { useState, useCallback, useMemo } from 'react';
import { Text, View, ScrollView, Pressable, Platform, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { getSliderConfig, checkInterventions } from '@/lib/ai/types';
import type { MoodSliders, MoodSnapshot, SliderConfig } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';
import {
  processEigenRegie,
  EIGEN_REGIE_QUESTION,
  EIGEN_REGIE_SLIDER_LABELS,
  type EigenRegieZone,
} from '@/lib/engine/kim/eigen-regie';
import { colors as dc, spacing, radius, typography, shadows, cardStyles, buttonStyles } from '@/constants/design';

// ─── Constants ──────────────────────────────────────────────────

const SLIDER_META: Record<string, { description: string; lowLabel: string; highLabel: string }> = {
  craving: { description: 'How strong is the urge right now?', lowLabel: 'None', highLabel: 'Overwhelming' },
  frustration: { description: 'How frustrated do you feel?', lowLabel: 'Calm', highLabel: 'Very frustrated' },
  despondency: { description: 'How hopeless or discouraged do you feel?', lowLabel: 'Hopeful', highLabel: 'Very discouraged' },
  focus: { description: 'How well can you concentrate right now?', lowLabel: 'Scattered', highLabel: 'Very focused' },
  stress: { description: 'How stressed do you feel right now?', lowLabel: 'Relaxed', highLabel: 'Very stressed' },
  boundaryFatigue: { description: 'How exhausted are you from setting boundaries?', lowLabel: 'Energized', highLabel: 'Exhausted' },
  emotionalBurden: { description: 'How heavy does the emotional weight feel?', lowLabel: 'Light', highLabel: 'Overwhelming' },
  selfCare: { description: 'How well are you taking care of yourself?', lowLabel: 'Neglecting', highLabel: 'Very well' },
};

const POSITIVE_KEYS = new Set(['focus', 'selfCare']);

const EIGEN_REGIE_ZONE_COLORS: Record<EigenRegieZone, string> = {
  ROOD: dc.moodRed,
  ORANJE: dc.moodOrange,
  GEEL: dc.moodYellow,
  LICHTGROEN: dc.moodGreen,
  GROEN: dc.success,
};

const ZONE_CONFIG = {
  GREEN:  { label: 'Stable', color: dc.moodGreen, description: 'You\'ve been in a calm, manageable space.' },
  YELLOW: { label: 'Elevated', color: dc.moodYellow, description: 'Some tension is building. Stay aware.' },
  ORANGE: { label: 'Strained', color: dc.moodOrange, description: 'Things have been harder lately. That\'s okay to acknowledge.' },
  RED:    { label: 'Critical', color: dc.moodRed, description: 'You\'ve been under heavy pressure. Consider reaching out.' },
} as const;

type ZoneKey = keyof typeof ZONE_CONFIG;

// ─── Helpers ────────────────────────────────────────────────────

function getThresholdColor(value: number, key: string): string {
  const isPositive = POSITIVE_KEYS.has(key);
  const normalized = isPositive ? 10 - value : value;
  if (normalized >= 7) return dc.moodRed;
  if (normalized >= 4) return dc.moodYellow;
  return dc.moodGreen;
}

function snapshotDistress(snapshot: MoodSnapshot, sliderConfig: SliderConfig[]): number {
  let total = 0;
  let count = 0;
  for (const sc of sliderConfig) {
    const val = (snapshot.sliders as any)[sc.key] ?? 0;
    const isPositive = POSITIVE_KEYS.has(sc.key);
    total += isPositive ? (sc.max - val) : val;
    count++;
  }
  return count > 0 ? total / count : 0;
}

function distressToZone(score: number): ZoneKey {
  if (score >= 7) return 'RED';
  if (score >= 5) return 'ORANGE';
  if (score >= 3) return 'YELLOW';
  return 'GREEN';
}

function recentSnapshots(history: MoodSnapshot[], days: number): MoodSnapshot[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
}

function computeTrend(scores: number[]): { arrow: string; label: string; color: string } {
  if (scores.length < 2) return { arrow: '—', label: 'Not enough data yet', color: '#9CA3AF' };
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (Math.abs(diff) < 0.5) return { arrow: '→', label: 'Stable', color: '#9CA3AF' };
  if (diff < 0) return { arrow: '↑', label: 'Improving', color: '#22C55E' };
  return { arrow: '↓', label: 'Needs attention', color: '#EF4444' };
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return `${Math.floor(diffDays)} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Screen ────────────────────────────────────────────────

export default function MoodScreen() {
  const { state, updateMood, getMood, getUserDat, updateEigenRegie } = useUser();
  const colors = useColors();
  const userType = state.userType ?? 'elias';
  const sliderConfig = useMemo(() => getSliderConfig(userType), [userType]);
  const currentMood = getMood();
  const userDat = getUserDat();
  const moodHistory = useMemo(() => userDat?.moodHistory ?? [], [userDat]);
  const triggerPatterns = useMemo(() => userDat?.triggerPatterns ?? [], [userDat]);

  const [localSliders, setLocalSliders] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const sc of sliderConfig) {
      initial[sc.key] = (currentMood as any)?.[sc.key] ?? 0;
    }
    return initial;
  });
  const [saved, setSaved] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // Eigen Regie (Kim only)
  const isKim = userType === 'kim';
  const [eigenRegieInput, setEigenRegieInput] = useState(() => {
    if (isKim && currentMood && 'eigenRegie' in currentMood && currentMood.eigenRegie != null) {
      return currentMood.eigenRegie as number;
    }
    return 50;
  });
  const [eigenRegieSaved, setEigenRegieSaved] = useState(false);
  const eigenRegieResult = useMemo(
    () => isKim ? processEigenRegie(eigenRegieInput) : null,
    [eigenRegieInput, isKim],
  );

  const handleEigenRegieSave = useCallback(async () => {
    await updateEigenRegie(eigenRegieInput);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEigenRegieSaved(true);
    setTimeout(() => setEigenRegieSaved(false), 2000);
  }, [eigenRegieInput, updateEigenRegie]);

  const handleSliderChange = useCallback((key: string, value: number) => {
    setLocalSliders((prev) => ({ ...prev, [key]: Math.round(value) }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    await updateMood(localSliders as unknown as MoodSliders);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [localSliders, updateMood]);

  const interventions = useMemo(
    () => checkInterventions(localSliders as unknown as MoodSliders, userType),
    [localSliders, userType],
  );
  const severeAlerts = interventions.filter((i) => i.level === 'severe');
  const moderateAlerts = interventions.filter((i) => i.level === 'moderate');

  // Recognition data
  const last7Days = useMemo(() => recentSnapshots(moodHistory, 7), [moodHistory]);
  const distressScores = useMemo(
    () => last7Days.map((s) => snapshotDistress(s, sliderConfig)),
    [last7Days, sliderConfig],
  );
  const avgDistress = useMemo(
    () => distressScores.length > 0 ? distressScores.reduce((a, b) => a + b, 0) / distressScores.length : 0,
    [distressScores],
  );
  const dominantZone = useMemo(() => distressToZone(avgDistress), [avgDistress]);
  const trend = useMemo(() => computeTrend(distressScores), [distressScores]);
  const topTriggers = useMemo(
    () => [...triggerPatterns]
      .sort((a, b) => (b.weight ?? b.count * 10) - (a.weight ?? a.count * 10))
      .slice(0, 3),
    [triggerPatterns],
  );

  const hasRecognitionData = last7Days.length >= 1;
  const recentTimeline = useMemo(
    () => [...moodHistory].reverse().slice(0, 15),
    [moodHistory],
  );

  return (
    <ScreenContainer containerClassName="bg-backgroundWarm">
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.screenHorizontal, paddingTop: spacing.screenTop }} showsVerticalScrollIndicator={false}>
        <Text style={{ ...typography.titleLarge, color: dc.textPrimary, marginBottom: spacing.lg }}>How are you?</Text>
        {/* Intervention Alerts */}
        {severeAlerts.length > 0 && (
          <View style={{ backgroundColor: dc.dangerSoft, borderRadius: radius.xl, padding: spacing.cardPadding, marginBottom: spacing.cardGap, borderWidth: 1, borderColor: '#F3B8B8' }}>
            <Text style={{ color: dc.danger, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>High alert</Text>
            <Text style={{ ...typography.bodySmall, color: dc.textPrimary }}>
              {severeAlerts.map((a) => a.label).join(', ')} {severeAlerts.length === 1 ? 'is' : 'are'} at a critical level.
            </Text>
          </View>
        )}
        {moderateAlerts.length > 0 && severeAlerts.length === 0 && (
          <View style={{ backgroundColor: dc.warningSoft, borderRadius: radius.xl, padding: spacing.cardPadding, marginBottom: spacing.cardGap, borderWidth: 1, borderColor: dc.moodYellow }}>
            <Text style={{ color: dc.warning, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>Heads up</Text>
            <Text style={{ ...typography.bodySmall, color: dc.textPrimary }}>
              {moderateAlerts.map((a) => a.label).join(', ')} {moderateAlerts.length === 1 ? 'is' : 'are'} elevated.
            </Text>
          </View>
        )}

        {/* Slider Cards */}
        {sliderConfig.map((sc: SliderConfig) => {
          const value = localSliders[sc.key] ?? 0;
          const meta = SLIDER_META[sc.key] ?? { description: '', lowLabel: '0', highLabel: '10' };
          const sliderColor = getThresholdColor(value, sc.key);

          return (
            <View
              key={sc.key}
              style={{
                ...cardStyles.default,
                marginBottom: spacing.cardGap,
              }}
            >
              {/* Title + Value */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ ...typography.bodyLarge, fontWeight: '600', color: dc.textPrimary }}>{sc.label}</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: sliderColor }}>
                  {Math.round(value)}
                </Text>
              </View>
              <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginBottom: 16 }}>{meta.description}</Text>

              {/* Slider */}
              <Slider
                style={{ width: '100%', height: 36 }}
                minimumValue={sc.min}
                maximumValue={sc.max}
                step={1}
                value={value}
                onValueChange={(v: number) => handleSliderChange(sc.key, v)}
                minimumTrackTintColor={sliderColor}
                maximumTrackTintColor={colors.border}
                thumbTintColor={sliderColor}
              />

              {/* Labels + Threshold Dots */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ ...typography.micro, color: dc.textTertiary }}>{meta.lowLabel}</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {sc.thresholds.map((t) => (
                    <Text key={t.level} style={{ ...typography.micro, color: dc.textTertiary }}>{t.value}</Text>
                  ))}
                </View>
                <Text style={{ ...typography.micro, color: dc.textTertiary }}>{meta.highLabel}</Text>
              </View>
            </View>
          );
        })}

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [{
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            marginTop: spacing.sm,
          }]}
        >
          <View style={{
            ...buttonStyles.primaryElias,
            backgroundColor: saved ? dc.success : dc.primary,
          }}>
            <Text style={{ ...typography.button, color: dc.textInverse }}>
              {saved ? 'Saved!' : 'Save Check-in'}
            </Text>
          </View>
        </Pressable>

        {/* Eigen Regie (Kim only) */}
        {isKim && eigenRegieResult && (
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>Eigen Regie</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>{EIGEN_REGIE_QUESTION}</Text>

            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>{EIGEN_REGIE_SLIDER_LABELS.min}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{EIGEN_REGIE_SLIDER_LABELS.max}</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={eigenRegieInput}
                onValueChange={v => { setEigenRegieInput(Math.round(v)); setEigenRegieSaved(false); }}
                minimumTrackTintColor={EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone]}
                maximumTrackTintColor={colors.border}
                thumbTintColor={EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone]}
              />
              <Text style={{ textAlign: 'center', fontSize: 24, fontWeight: '800', marginTop: 8, color: EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone] }}>
                {eigenRegieInput}%
              </Text>
            </View>

            <View style={{ borderRadius: 16, padding: 20, marginTop: 12, backgroundColor: EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone] + '12', borderWidth: 1, borderColor: EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone] + '40' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: EIGEN_REGIE_ZONE_COLORS[eigenRegieResult.zone], marginBottom: 4 }}>
                {eigenRegieResult.zone}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                {eigenRegieResult.meaning}
              </Text>
            </View>

            <Pressable
              onPress={handleEigenRegieSave}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, marginTop: 12 }]}
            >
              <View style={{ backgroundColor: eigenRegieSaved ? '#10B981' : colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {eigenRegieSaved ? 'Saved!' : 'Save reflection'}
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Recognition Section */}
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 16 }}>Your Pattern</Text>

          {!hasRecognitionData ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
                Save a few check-ins to start seeing your patterns here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {/* Dominant Zone */}
              <View style={{ borderRadius: 16, padding: 20, backgroundColor: ZONE_CONFIG[dominantZone].color + '12', borderWidth: 1, borderColor: ZONE_CONFIG[dominantZone].color + '40' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ZONE_CONFIG[dominantZone].color }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: ZONE_CONFIG[dominantZone].color }}>
                    {ZONE_CONFIG[dominantZone].label}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>last 7 days</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>
                  {ZONE_CONFIG[dominantZone].description}
                </Text>
              </View>

              {/* Trend */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24, color: trend.color }}>{trend.arrow}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: trend.color }}>{trend.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    Based on {last7Days.length} check-in{last7Days.length !== 1 ? 's' : ''} this week
                  </Text>
                </View>
              </View>

              {/* Top Triggers */}
              {topTriggers.length > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 12, letterSpacing: 0.5 }}>
                    RECURRING TRIGGERS
                  </Text>
                  {topTriggers.map((t, i) => (
                    <View key={`${t.trigger}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                      <Text style={{ fontSize: 13, color: colors.foreground }}>{t.trigger}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>({t.count}x)</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Timeline Toggle */}
              <Pressable onPress={() => setShowTimeline(!showTimeline)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{showTimeline ? 'Hide timeline' : 'Show timeline'}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{showTimeline ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {showTimeline && (
                <View style={{ gap: 8 }}>
                  {recentTimeline.map((snapshot, index) => (
                    <TimelineEntry key={`${snapshot.timestamp}-${index}`} snapshot={snapshot} sliderConfig={sliderConfig} colors={colors} />
                  ))}
                  {recentTimeline.length === 0 && (
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 8 }}>No entries yet.</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Timeline Entry ─────────────────────────────────────────────

function TimelineEntry({ snapshot, sliderConfig, colors }: { snapshot: MoodSnapshot; sliderConfig: SliderConfig[]; colors: any }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 11, color: colors.muted, width: 60 }}>{formatTimestamp(snapshot.timestamp)}</Text>
      <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
        {sliderConfig.map((sc) => {
          const value = (snapshot.sliders as any)[sc.key] ?? 0;
          const barColor = getThresholdColor(value, sc.key);
          return (
            <View key={sc.key} style={{ flex: 1 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: barColor, width: `${Math.max((value / sc.max) * 100, 5)}%` }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
