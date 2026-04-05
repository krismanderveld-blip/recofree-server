import { useState, useCallback } from 'react';
import { Text, View, ScrollView, Pressable, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import type { MoodSliders } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';

interface SliderConfig {
  key: keyof MoodSliders;
  label: string;
  description: string;
  lowLabel: string;
  highLabel: string;
  invert: boolean;
}

const SLIDERS: SliderConfig[] = [
  {
    key: 'stemming',
    label: 'Mood',
    description: 'How is your overall mood right now?',
    lowLabel: 'Very low',
    highLabel: 'Very good',
    invert: false,
  },
  {
    key: 'craving',
    label: 'Craving',
    description: 'How strong is the urge right now?',
    lowLabel: 'None',
    highLabel: 'Very strong',
    invert: true,
  },
  {
    key: 'overprikkeling',
    label: 'Overstimulation',
    description: 'How overwhelmed do you feel?',
    lowLabel: 'Calm',
    highLabel: 'Very overwhelmed',
    invert: true,
  },
  {
    key: 'sociaal',
    label: 'Social',
    description: 'How connected do you feel to others?',
    lowLabel: 'Isolated',
    highLabel: 'Very connected',
    invert: false,
  },
];

export default function MoodScreen() {
  const { updateMood, getMood } = useUser();
  const colors = useColors();
  const currentMood = getMood();
  const [localSliders, setLocalSliders] = useState<MoodSliders>({ ...currentMood });
  const [saved, setSaved] = useState(false);

  const handleSliderChange = useCallback((key: keyof MoodSliders, value: number) => {
    setLocalSliders((prev: MoodSliders) => ({ ...prev, [key]: Math.round(value) }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    await updateMood(localSliders);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [localSliders, updateMood]);

  const getSliderColor = (value: number, invert: boolean): string => {
    const normalized = invert ? 10 - value : value;
    if (normalized >= 7) return colors.success;
    if (normalized >= 4) return colors.warning;
    return colors.error;
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">How are you feeling?</Text>
          <Text className="text-sm text-muted mt-1">
            Adjust the sliders to reflect your current state.
          </Text>
        </View>

        {/* Sliders */}
        <View className="gap-5">
          {SLIDERS.map((slider) => {
            const value = localSliders[slider.key];
            const sliderColor = getSliderColor(value, slider.invert);

            return (
              <View key={slider.key} className="bg-surface rounded-2xl p-5 border border-border">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-lg font-bold text-foreground">{slider.label}</Text>
                  <Text className="text-2xl font-bold" style={{ color: sliderColor }}>
                    {Math.round(value)}
                  </Text>
                </View>
                <Text className="text-sm text-muted mb-4">{slider.description}</Text>

                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={10}
                  step={1}
                  value={value}
                  onValueChange={(v: number) => handleSliderChange(slider.key, v)}
                  minimumTrackTintColor={sliderColor}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={sliderColor}
                />

                <View className="flex-row justify-between mt-1">
                  <Text className="text-xs text-muted">{slider.lowLabel}</Text>
                  <Text className="text-xs text-muted">{slider.highLabel}</Text>
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
                {saved ? 'Saved!' : 'Save'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
