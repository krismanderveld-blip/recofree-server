import { useState, useCallback, useMemo } from 'react';
import { Text, View, ScrollView, Pressable, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { getSliderConfig, checkInterventions } from '@/lib/ai/types';
import type { MoodSliders, SliderConfig } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';

/** Description and labels per slider key */
const SLIDER_META: Record<string, { description: string; lowLabel: string; highLabel: string }> = {
  // Elias sliders
  craving: { description: 'How strong is the urge right now?', lowLabel: 'None', highLabel: 'Overwhelming' },
  frustration: { description: 'How frustrated do you feel?', lowLabel: 'Calm', highLabel: 'Very frustrated' },
  despondency: { description: 'How hopeless or discouraged do you feel?', lowLabel: 'Hopeful', highLabel: 'Very discouraged' },
  focus: { description: 'How well can you concentrate right now?', lowLabel: 'Scattered', highLabel: 'Very focused' },
  // Kim sliders
  stress: { description: 'How stressed do you feel right now?', lowLabel: 'Relaxed', highLabel: 'Very stressed' },
  boundaryFatigue: { description: 'How exhausted are you from setting boundaries?', lowLabel: 'Energized', highLabel: 'Exhausted' },
  emotionalBurden: { description: 'How heavy does the emotional weight feel?', lowLabel: 'Light', highLabel: 'Overwhelming' },
  selfCare: { description: 'How well are you taking care of yourself?', lowLabel: 'Neglecting', highLabel: 'Very well' },
};

/** Keys where higher = better (not inverted for color) */
const POSITIVE_KEYS = new Set(['focus', 'selfCare']);

function getThresholdColor(value: number, key: string, colors: any): string {
  const isPositive = POSITIVE_KEYS.has(key);
  const normalized = isPositive ? 7 - value : value;
  if (normalized >= 5) return colors.error;
  if (normalized >= 3) return colors.warning;
  return colors.success;
}

export default function MoodScreen() {
  const { state, updateMood, getMood } = useUser();
  const colors = useColors();
  const userType = state.userType ?? 'elias';
  const sliderConfig = useMemo(() => getSliderConfig(userType), [userType]);
  const currentMood = getMood();
  const [localSliders, setLocalSliders] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const sc of sliderConfig) {
      initial[sc.key] = (currentMood as any)?.[sc.key] ?? 0;
    }
    return initial;
  });
  const [saved, setSaved] = useState(false);

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

  // Check intervention alerts
  const interventions = useMemo(
    () => checkInterventions(localSliders as unknown as MoodSliders, userType),
    [localSliders, userType],
  );

  const severeAlerts = interventions.filter((i) => i.level === 'severe');
  const moderateAlerts = interventions.filter((i) => i.level === 'moderate');

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
          <View className="bg-error/10 border border-error rounded-2xl p-4 mb-4">
            <Text className="text-error font-bold text-sm mb-1">High alert</Text>
            <Text className="text-error text-sm">
              {severeAlerts.map((a) => a.label).join(', ')} {severeAlerts.length === 1 ? 'is' : 'are'} at a critical level. Consider reaching out or using the chat.
            </Text>
          </View>
        )}
        {moderateAlerts.length > 0 && severeAlerts.length === 0 && (
          <View className="bg-warning/10 border border-warning rounded-2xl p-4 mb-4">
            <Text className="text-warning font-bold text-sm mb-1">Heads up</Text>
            <Text className="text-warning text-sm">
              {moderateAlerts.map((a) => a.label).join(', ')} {moderateAlerts.length === 1 ? 'is' : 'are'} elevated. Take a moment to check in with yourself.
            </Text>
          </View>
        )}

        {/* Sliders */}
        <View className="gap-5">
          {sliderConfig.map((sc: SliderConfig) => {
            const value = localSliders[sc.key] ?? 0;
            const meta = SLIDER_META[sc.key] ?? { description: '', lowLabel: '0', highLabel: '7' };
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

                {/* Threshold markers */}
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
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View className={`rounded-2xl py-4 items-center ${saved ? 'bg-success' : 'bg-primary'}`}>
              <Text className="text-white text-lg font-bold">
                {saved ? 'Saved!' : 'Save Check-in'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
