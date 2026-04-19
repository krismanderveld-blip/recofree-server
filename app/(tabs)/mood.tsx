import { useState, useCallback, useMemo } from 'react';
import { Text, View, ScrollView, Pressable, Platform } from 'react-native';
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
} from '@/lib/engine/kim/eigen-regie';

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

const ZONE_CONFIG = {
  GREEN:  { label: 'Stable', color: '#22C55E', description: 'You\'ve been in a calm, manageable space.' },
  YELLOW: { label: 'Elevated', color: '#F59E0B', description: 'Some tension is building. Stay aware.' },
  ORANGE: { label: 'Strained', color: '#F97316', description: 'Things have been harder lately. That\'s okay to acknowledge.' },
  RED:    { label: 'Critical', color: '#EF4444', description: 'You\'ve been under heavy pressure. Consider reaching out.' },
} as const;

type ZoneKey = keyof typeof ZONE_CONFIG;

// ─── Helpers ────────────────────────────────────────────────────

function getThresholdColor(value: number, key: string, colors: any): string {
  const isPositive = POSITIVE_KEYS.has(key);
  const normalized = isPositive ? 10 - value : value;
  if (normalized >= 7) return colors.error;
  if (normalized >= 4) return colors.warning;
  return colors.success;
}

/** Compute a 0-10 distress score from a single snapshot (higher = worse) */
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

/** Map distress score to zone */
function distressToZone(score: number): ZoneKey {
  if (score >= 7) return 'RED';
  if (score >= 5) return 'ORANGE';
  if (score >= 3) return 'YELLOW';
  return 'GREEN';
}

/** Get snapshots from the last N days */
function recentSnapshots(history: MoodSnapshot[], days: number): MoodSnapshot[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
}

/** Compute overall trend from an array of distress scores */
function computeTrend(scores: number[]): { arrow: string; label: string; color: string } {
  if (scores.length < 2) return { arrow: '—', label: 'Not enough data yet', color: '#9BA1A6' };

  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;

  if (Math.abs(diff) < 0.5) return { arrow: '→', label: 'Stable', color: '#9BA1A6' };
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

  // ── Eigen Regie (Kim only) ──
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

  // ── Recognition data ──
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
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">How are you feeling?</Text>
          <Text className="text-sm text-muted mt-1">
            Adjust the sliders to reflect your current state (0–10).
          </Text>
        </View>

        {/* Intervention Alerts */}
        {severeAlerts.length > 0 && (
          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.error + '20', borderWidth: 1, borderColor: colors.error }}
          >
            <Text style={{ color: colors.error }} className="font-bold text-sm mb-1">High alert</Text>
            <Text style={{ color: colors.foreground }} className="text-sm">
              {severeAlerts.map((a) => a.label).join(', ')} {severeAlerts.length === 1 ? 'is' : 'are'} at a critical level. Consider reaching out or using the chat.
            </Text>
          </View>
        )}
        {moderateAlerts.length > 0 && severeAlerts.length === 0 && (
          <View
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.warning + '20', borderWidth: 1, borderColor: colors.warning }}
          >
            <Text style={{ color: colors.warning }} className="font-bold text-sm mb-1">Heads up</Text>
            <Text style={{ color: colors.foreground }} className="text-sm">
              {moderateAlerts.map((a) => a.label).join(', ')} {moderateAlerts.length === 1 ? 'is' : 'are'} elevated. Take a moment to check in with yourself.
            </Text>
          </View>
        )}

        {/* Sliders */}
        <View className="gap-5">
          {sliderConfig.map((sc: SliderConfig) => {
            const value = localSliders[sc.key] ?? 0;
            const meta = SLIDER_META[sc.key] ?? { description: '', lowLabel: '0', highLabel: '10' };
            const sliderColor = getThresholdColor(value, sc.key, colors);

            return (
              <View key={sc.key} className="bg-surface rounded-2xl p-5 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-lg font-bold text-foreground">{sc.label}</Text>
                  <Text className="text-2xl font-bold" style={{ color: sliderColor }}>
                    {Math.round(value)}
                  </Text>
                </View>
                <Text className="text-sm text-muted mb-4">{meta.description}</Text>

                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={sc.min}
                  maximumValue={sc.max}
                  step={1}
                  value={value}
                  onValueChange={(v: number) => handleSliderChange(sc.key, v)}
                  minimumTrackTintColor={sliderColor}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={sliderColor}
                />

                <View className="flex-row justify-between mt-1">
                  <Text className="text-xs text-muted">{meta.lowLabel}</Text>
                  <Text className="text-xs text-muted">{meta.highLabel}</Text>
                </View>

                <View className="flex-row justify-between mt-2 px-1">
                  {sc.thresholds.map((t) => (
                    <View key={t.level} className="items-center">
                      <View
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            t.level === 'severe' ? colors.error
                            : t.level === 'moderate' ? colors.warning
                            : colors.muted,
                        }}
                      />
                      <Text className="text-[10px] text-muted mt-0.5">{t.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Save Button */}
        <View className="mt-6">
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View className={`rounded-2xl py-4 items-center ${saved ? 'bg-success' : 'bg-primary'}`}>
              <Text className="text-white text-lg font-bold">
                {saved ? 'Saved!' : 'Save Check-in'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ─── EIGEN REGIE (Kim only) ─── */}
        {isKim && eigenRegieResult && (
          <View className="mt-10">
            <Text className="text-lg font-bold text-foreground mb-2">Eigen Regie</Text>
            <Text className="text-sm text-muted mb-4">{EIGEN_REGIE_QUESTION}</Text>

            {/* Slider */}
            <View className="bg-surface rounded-2xl p-5 border border-border">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-muted">{EIGEN_REGIE_SLIDER_LABELS.min}</Text>
                <Text className="text-xs text-muted">{EIGEN_REGIE_SLIDER_LABELS.max}</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={eigenRegieInput}
                onValueChange={v => { setEigenRegieInput(Math.round(v)); setEigenRegieSaved(false); }}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text className="text-center text-2xl font-bold text-foreground mt-2">
                {eigenRegieInput}%
              </Text>
            </View>

            {/* Zone + Meaning */}
            <View className="bg-surface rounded-2xl p-5 border border-border mt-3">
              <Text className="text-sm font-semibold text-foreground mb-1">
                {eigenRegieResult.zone}
              </Text>
              <Text className="text-sm text-muted leading-relaxed">
                {eigenRegieResult.meaning}
              </Text>
            </View>

            {/* Save */}
            <View className="mt-3">
              <Pressable
                onPress={handleEigenRegieSave}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <View className={`rounded-2xl py-3 items-center ${eigenRegieSaved ? 'bg-success' : 'bg-primary'}`}>
                  <Text className="text-white text-base font-bold">
                    {eigenRegieSaved ? 'Opgeslagen!' : 'Sla reflectie op'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* ─── RECOGNITION SECTION ─── */}
        <View className="mt-10">
          <Text className="text-lg font-bold text-foreground mb-4">Your Pattern</Text>

          {!hasRecognitionData ? (
            <View className="bg-surface rounded-2xl p-5 border border-border">
              <Text className="text-sm text-muted text-center">
                Save a few check-ins to start seeing your patterns here.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {/* Dominant Zone Card */}
              <View
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: ZONE_CONFIG[dominantZone].color + '12',
                  borderWidth: 1,
                  borderColor: ZONE_CONFIG[dominantZone].color + '40',
                }}
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ZONE_CONFIG[dominantZone].color }}
                  />
                  <Text
                    className="text-base font-bold"
                    style={{ color: ZONE_CONFIG[dominantZone].color }}
                  >
                    {ZONE_CONFIG[dominantZone].label}
                  </Text>
                  <Text className="text-xs text-muted">last 7 days</Text>
                </View>
                <Text className="text-sm text-foreground leading-relaxed">
                  {ZONE_CONFIG[dominantZone].description}
                </Text>
              </View>

              {/* Trend */}
              <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center gap-3">
                <Text className="text-2xl" style={{ color: trend.color }}>{trend.arrow}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: trend.color }}>
                    {trend.label}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">
                    Based on {last7Days.length} check-in{last7Days.length !== 1 ? 's' : ''} this week
                  </Text>
                </View>
              </View>

              {/* Top Triggers */}
              {topTriggers.length > 0 && (
                <View className="bg-surface rounded-2xl p-4 border border-border">
                  <Text className="text-xs font-semibold text-muted mb-3 uppercase tracking-wide">
                    Recurring triggers
                  </Text>
                  <View className="gap-2">
                    {topTriggers.map((t, i) => (
                      <View key={`${t.trigger}-${i}`} className="flex-row items-center gap-2">
                        <View
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: colors.warning }}
                        />
                        <Text className="text-sm text-foreground">{t.trigger}</Text>
                        <Text className="text-xs text-muted">({t.count}x)</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Timeline Toggle */}
              <Pressable
                onPress={() => setShowTimeline(!showTimeline)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="flex-row justify-center items-center gap-2 py-2">
                  <Text className="text-xs text-muted">
                    {showTimeline ? 'Hide timeline' : 'Show timeline'}
                  </Text>
                  <Text className="text-xs text-muted">{showTimeline ? '▲' : '▼'}</Text>
                </View>
              </Pressable>

              {/* Timeline (secondary, collapsible) */}
              {showTimeline && (
                <View className="gap-2">
                  {recentTimeline.map((snapshot, index) => (
                    <TimelineEntry
                      key={`${snapshot.timestamp}-${index}`}
                      snapshot={snapshot}
                      sliderConfig={sliderConfig}
                      colors={colors}
                    />
                  ))}
                  {recentTimeline.length === 0 && (
                    <Text className="text-xs text-muted text-center py-2">No entries yet.</Text>
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

// ─── Timeline Entry (compact) ───────────────────────────────────

function TimelineEntry({
  snapshot,
  sliderConfig,
  colors,
}: {
  snapshot: MoodSnapshot;
  sliderConfig: SliderConfig[];
  colors: any;
}) {
  return (
    <View className="bg-surface rounded-xl p-3 border border-border flex-row items-center gap-3">
      <Text className="text-xs text-muted w-16">{formatTimestamp(snapshot.timestamp)}</Text>
      <View className="flex-1 flex-row gap-2">
        {sliderConfig.map((sc) => {
          const value = (snapshot.sliders as any)[sc.key] ?? 0;
          const barColor = getThresholdColor(value, sc.key, colors);
          return (
            <View key={sc.key} className="flex-1">
              <View className="h-1.5 rounded-full" style={{ backgroundColor: colors.border }}>
                <View
                  className="h-1.5 rounded-full"
                  style={{
                    backgroundColor: barColor,
                    width: `${Math.max((value / sc.max) * 100, 5)}%`,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
