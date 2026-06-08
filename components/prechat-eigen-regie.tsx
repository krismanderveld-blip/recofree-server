/**
 * Pre-Chat Eigen Regie — Kim Only
 *
 * This component BLOCKS the chat screen until the Kim user submits their
 * daily Eigen Regie reflection. It is the input validation layer that ensures
 * the pipeline never receives eigenRegie: null.
 *
 * RULES:
 * - No default value. User MUST actively set the slider.
 * - No auto-submit. User must tap confirm.
 * - Only user-keuze fills eigenRegie. No system defaults.
 * - After submission: chat screen proceeds to greeting/pipeline.
 */

import { useState } from 'react';
import { Text, View, Pressable, Platform, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import {
  EIGEN_REGIE_QUESTION,
  EIGEN_REGIE_SLIDER_LABELS,
  processEigenRegie,
  type EigenRegieZone,
} from '@/lib/engine/kim/eigen-regie';

/** Fixed color per Eigen Regie zone */
const ZONE_COLORS: Record<EigenRegieZone, string> = {
  ROOD: '#EF4444',
  ORANJE: '#F97316',
  GEEL: '#F59E0B',
  LICHTGROEN: '#84CC16',
  GROEN: '#22C55E',
};

interface PreChatEigenRegieProps {
  /** Called when user confirms their Eigen Regie value */
  onSubmit: (value: number) => void;
  /** User's display name for personalization */
  userName: string;
}

export function PreChatEigenRegie({ onSubmit, userName }: PreChatEigenRegieProps) {
  const colors = useColors();
  // null = user has not interacted with slider yet (no default!)
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const result = sliderValue !== null ? processEigenRegie(sliderValue) : null;
  const zoneColor = result ? ZONE_COLORS[result.zone] : colors.border;

  const handleSliderChange = (value: number) => {
    if (!hasInteracted) setHasInteracted(true);
    setSliderValue(Math.round(value));
  };

  const handleConfirm = () => {
    if (sliderValue === null) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSubmit(sliderValue);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
            Hoe was je dag, {userName}?
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
            {EIGEN_REGIE_QUESTION}
          </Text>
        </View>

        {/* Slider */}
        <View style={{ marginBottom: 24 }}>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={sliderValue ?? 50}
            onValueChange={handleSliderChange}
            minimumTrackTintColor={hasInteracted ? zoneColor : colors.border}
            maximumTrackTintColor={colors.border}
            thumbTintColor={hasInteracted ? zoneColor : colors.muted}
            style={{ width: '100%', height: 40 }}
          />
          {/* Slider labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: colors.muted, maxWidth: '45%' }}>
              {EIGEN_REGIE_SLIDER_LABELS.min}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, maxWidth: '45%', textAlign: 'right' }}>
              {EIGEN_REGIE_SLIDER_LABELS.max}
            </Text>
          </View>
        </View>

        {/* Result card (only shown after interaction) */}
        {hasInteracted && result && (
          <View
            style={{
              backgroundColor: `${zoneColor}15`,
              borderWidth: 1,
              borderColor: zoneColor,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: zoneColor,
                  marginRight: 8,
                }}
              />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                {result.zone}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>
              {result.meaning}
            </Text>
          </View>
        )}

        {/* Confirm button — inside ScrollView so always reachable */}
        <Pressable
          onPress={handleConfirm}
          disabled={!hasInteracted}
          style={({ pressed }) => [
            {
              alignSelf: 'center',
              backgroundColor: hasInteracted ? colors.primary : colors.border,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 24,
              opacity: !hasInteracted ? 0.5 : pressed ? 0.8 : 1,
              transform: [{ scale: pressed && hasInteracted ? 0.97 : 1 }],
              marginTop: 8,
            },
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            Bevestigen
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
