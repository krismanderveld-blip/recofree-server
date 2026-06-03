import { Text, View, Pressable, Platform, TextInput, Modal } from 'react-native';
import { useState, useCallback } from 'react';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

/**
 * SoberCounter — Elias only, optional.
 * Shows days clean since sobrietyDate. Tap to edit date.
 * Only renders when userType === 'elias'.
 */
export function SoberCounter() {
  const { state, getUserDat, updateSobrietyDate } = useUser();
  const colors = useColors();
  const userDat = getUserDat();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInput, setDateInput] = useState('');

  // Only show for Elias users
  if (state.userType !== 'elias') return null;

  const sobrietyDate = userDat?.sobrietyDate ?? null;

  const handleOpenPicker = useCallback(() => {
    setDateInput(sobrietyDate ?? new Date().toISOString().slice(0, 10));
    setShowDatePicker(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [sobrietyDate]);

  const handleSave = useCallback(async () => {
    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateInput)) return;

    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) return;

    // Cannot be in the future
    if (parsed.getTime() > Date.now()) return;

    await updateSobrietyDate(dateInput);
    setShowDatePicker(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [dateInput, updateSobrietyDate]);

  const handleClear = useCallback(async () => {
    await updateSobrietyDate(null);
    setShowDatePicker(false);
  }, [updateSobrietyDate]);

  // If no date set, show a subtle "Set clean date" prompt
  if (!sobrietyDate) {
    return (
      <Pressable
        onPress={handleOpenPicker}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <View className="bg-surface rounded-xl px-4 py-3 border border-border flex-row items-center gap-2">
          <Text className="text-sm text-muted">Set your clean date</Text>
          <Text className="text-xs text-muted">→</Text>
        </View>

        <DatePickerModal
          visible={showDatePicker}
          dateInput={dateInput}
          onChangeDate={setDateInput}
          onSave={handleSave}
          onClear={handleClear}
          onClose={() => setShowDatePicker(false)}
          colors={colors}
        />
      </Pressable>
    );
  }

  // Calculate days
  const days = Math.floor(
    (Date.now() - new Date(sobrietyDate).getTime()) / 86400000
  );

  // Format message
  let message: string;
  if (days === 0) {
    message = 'Today is day 1. That counts.';
  } else if (days === 1) {
    message = '1 day clean.';
  } else if (days < 7) {
    message = `${days} days clean.`;
  } else if (days < 30) {
    message = `${days} days clean. Keep going.`;
  } else if (days < 100) {
    message = `${days} days clean. 🔥`;
  } else {
    message = `${days} days clean. 💙`;
  }

  return (
    <>
      <Pressable
        onPress={handleOpenPicker}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <View
          className="rounded-xl px-4 py-3 flex-row items-center gap-2"
          style={{ backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '25' }}
        >
          <Text className="text-base font-semibold" style={{ color: colors.primary }}>
            {message}
          </Text>
        </View>
      </Pressable>

      <DatePickerModal
        visible={showDatePicker}
        dateInput={dateInput}
        onChangeDate={setDateInput}
        onSave={handleSave}
        onClear={handleClear}
        onClose={() => setShowDatePicker(false)}
        colors={colors}
      />
    </>
  );
}

// ─── Date Picker Modal ──────────────────────────────────────────────────────

function DatePickerModal({
  visible,
  dateInput,
  onChangeDate,
  onSave,
  onClear,
  onClose,
  colors,
}: {
  visible: boolean;
  dateInput: string;
  onChangeDate: (text: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.background,
            borderRadius: 16,
            padding: 24,
            width: '85%',
            maxWidth: 320,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
            Clean since
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
            Enter the date you started your recovery (YYYY-MM-DD)
          </Text>

          <TextInput
            value={dateInput}
            onChangeText={onChangeDate}
            placeholder="2024-01-15"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            maxLength={10}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.foreground,
              marginBottom: 16,
            }}
          />

          <Pressable
            onPress={onSave}
            style={({ pressed }) => [{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center' as const,
              opacity: pressed ? 0.85 : 1,
              marginBottom: 8,
            }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save</Text>
          </Pressable>

          <Pressable
            onPress={onClear}
            style={({ pressed }) => [{
              paddingVertical: 10,
              alignItems: 'center' as const,
              opacity: pressed ? 0.6 : 1,
            }]}
          >
            <Text style={{ color: colors.error, fontSize: 13 }}>Remove clean date</Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [{
              paddingVertical: 10,
              alignItems: 'center' as const,
              opacity: pressed ? 0.6 : 1,
            }]}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
