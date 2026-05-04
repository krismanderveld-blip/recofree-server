/**
 * Pre-Chat VSP Thermometer — Elias Only
 *
 * This component BLOCKS the chat screen until the user submits their VSP level.
 * It is the input validation layer that ensures the pipeline never receives vsp: null.
 *
 * RULES:
 * - No default selection. User MUST actively choose.
 * - No auto-submit. User must tap confirm.
 * - Only user-keuze fills VSP. No system defaults.
 * - After submission: chat screen proceeds to greeting/pipeline.
 */

import { useState } from 'react';
import { Text, View, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { VSP_OPTIONS, type VspLevel } from '@/lib/engine/elias/vsp';
import { useColors } from '@/hooks/use-colors';

interface PreChatVspProps {
  /** Called when user confirms their VSP selection */
  onSubmit: (level: VspLevel) => void;
  /** User's display name for personalization */
  userName: string;
}

export function PreChatVsp({ onSubmit, userName }: PreChatVspProps) {
  const colors = useColors();
  const [selected, setSelected] = useState<VspLevel | null>(null);

  const handleSelect = (level: VspLevel) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelected(level);
  };

  const handleConfirm = () => {
    if (!selected) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSubmit(selected);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Header */}
      <View style={{ marginBottom: 32, alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
          Hoe voel je je nu, {userName}?
        </Text>
        <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
          Kies het niveau dat het beste bij je past op dit moment.
        </Text>
      </View>

      {/* VSP Options (thermometer) */}
      <View style={{ gap: 10 }}>
        {VSP_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? option.color : colors.border,
                  backgroundColor: isSelected ? `${option.color}15` : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              {/* Color indicator dot */}
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: option.color,
                  marginRight: 12,
                }}
              />
              {/* Label */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: isSelected ? '600' : '500', color: colors.foreground }}>
                  {option.label}
                </Text>
              </View>
              {/* Selection indicator */}
              {isSelected && (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: option.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Confirm button */}
      <Pressable
        onPress={handleConfirm}
        disabled={!selected}
        style={({ pressed }) => [
          {
            marginTop: 28,
            alignSelf: 'center',
            backgroundColor: selected ? colors.primary : colors.border,
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 24,
            opacity: !selected ? 0.5 : pressed ? 0.8 : 1,
            transform: [{ scale: pressed && selected ? 0.97 : 1 }],
          },
        ]}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          Bevestigen
        </Text>
      </Pressable>
    </View>
  );
}
