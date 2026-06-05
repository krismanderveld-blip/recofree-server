/**
 * Pre-Chat VSP Thermometer — Elias Only (V2 Design)
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
import { Text, View, Pressable, Platform, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { VSP_OPTIONS, type VspLevel } from '@/lib/engine/elias/vsp';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PreChatVspProps {
  /** Called when user confirms their VSP selection */
  onSubmit: (level: VspLevel) => void;
  /** User's display name for personalization */
  userName: string;
}

const VSP_DESCRIPTIONS: Record<VspLevel, string> = {
  GROEN: 'Everything feels manageable.',
  GEEL: 'Some stress, but I can handle it.',
  ORANJE: 'Things are getting harder.',
  ROOD: 'I need support now.',
  PAARS: "I've relapsed.",
};

const VSP_ICONS: Record<VspLevel, string> = {
  GROEN: '\u{1F7E2}',
  GEEL: '\u{1F7E1}',
  ORANJE: '\u{1F7E0}',
  ROOD: '\u{1F534}',
  PAARS: '\u{1F7E3}',
};

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
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
      {/* Header */}
      <View style={{ marginBottom: 24, alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
          Hoe voel je je nu, {userName}?
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
          Kies het niveau dat het beste bij je past op dit moment.
        </Text>
      </View>

      {/* VSP Options */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ gap: 10 }}>
          {VSP_OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            const isRelapse = option.value === 'PAARS';

            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelect(option.value)}
                style={({ pressed }) => [{
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                }]}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  borderWidth: isRelapse ? 2 : isSelected ? 2 : 1,
                  borderColor: isRelapse
                    ? (isSelected ? '#DC2626' : '#FCA5A5')
                    : (isSelected ? option.color : colors.border),
                  backgroundColor: isRelapse
                    ? (isSelected ? '#FEF2F2' : '#FFF5F5')
                    : (isSelected ? `${option.color}10` : '#fff'),
                }}>
                  {/* Icon */}
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isRelapse ? '#FEE2E2' : `${option.color}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 16 }}>{VSP_ICONS[option.value]}</Text>
                  </View>

                  {/* Text */}
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: isRelapse ? '#DC2626' : colors.foreground,
                    }}>
                      {option.label}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: isRelapse ? '#B91C1C' : colors.muted,
                      marginTop: 2,
                    }}>
                      {VSP_DESCRIPTIONS[option.value]}
                    </Text>
                  </View>

                  {/* Chevron */}
                  <IconSymbol name="chevron.right" size={16} color={isRelapse ? '#DC2626' : colors.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirm button - fixed at bottom */}
      {selected && (
        <View style={{ position: 'absolute', bottom: 32, left: 20, right: 20 }}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [{
              backgroundColor: selected === 'PAARS' ? '#DC2626' : colors.primary,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }]}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Bevestigen
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
