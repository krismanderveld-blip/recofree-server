/**
 * Wizard Step: Activities
 *
 * User adds activity blocks between wake and sleep.
 * Uses ScrollWheelTimePicker for start/end time selection.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScrollWheelTimePicker } from '@/components/day-structure/scroll-wheel-time-picker';
import type { TimeBlock } from '@/lib/features/dayStructure/types';

export function WizardActivities() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, addActivityBlock, removeBlock, state } = useWizard();

  const [label, setLabel] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

  const activityBlocks = state.draftBlocks.filter((b) => b.kind === 'activity');

  const formatTime = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const handleAdd = () => {
    if (!label.trim()) return;
    const start = formatTime(startHour, startMinute);
    const end = formatTime(endHour, endMinute);
    addActivityBlock(label.trim(), start, end);
    setLabel('');
    setShowTimePicker(null);
  };

  const handleNext = () => {
    goToStep('sleep');
  };

  const handleBack = () => {
    goToStep('wake');
  };

  const renderBlock = ({ item }: { item: TimeBlock }) => (
    <View style={[styles.blockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{item.label}</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {item.startTime} – {item.endTime}
        </Text>
      </View>
      <TouchableOpacity onPress={() => removeBlock(item.id)} activeOpacity={0.7}>
        <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 24 }}>
      {/* Header */}
      <TouchableOpacity onPress={handleBack} style={{ marginBottom: 16 }} activeOpacity={0.7}>
        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('dayStructure.wizard.activities.title')}
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 20, lineHeight: 22 }}>
        {t('dayStructure.wizard.activities.description')}
      </Text>

      {/* Add Activity Form */}
      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('dayStructure.wizard.activities.label_placeholder')}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          returnKeyType="done"
        />

        {/* Time selection buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => setShowTimePicker(showTimePicker === 'start' ? null : 'start')}
            style={[styles.timeButton, {
              borderColor: showTimePicker === 'start' ? colors.primary : colors.border,
              flex: 1,
            }]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>
              {formatTime(startHour, startMinute)}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colors.muted, alignSelf: 'center' }}>–</Text>
          <TouchableOpacity
            onPress={() => setShowTimePicker(showTimePicker === 'end' ? null : 'end')}
            style={[styles.timeButton, {
              borderColor: showTimePicker === 'end' ? colors.primary : colors.border,
              flex: 1,
            }]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>
              {formatTime(endHour, endMinute)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inline time picker */}
        {showTimePicker === 'start' && (
          <View style={styles.pickerContainer}>
            <ScrollWheelTimePicker
              initialHour={startHour}
              initialMinute={startMinute}
              onTimeChange={(h, m) => { setStartHour(h); setStartMinute(m); }}
            />
          </View>
        )}
        {showTimePicker === 'end' && (
          <View style={styles.pickerContainer}>
            <ScrollWheelTimePicker
              initialHour={endHour}
              initialMinute={endMinute}
              onTimeChange={(h, m) => { setEndHour(h); setEndMinute(m); }}
            />
          </View>
        )}

        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: colors.primary + '15' }]}
          activeOpacity={0.7}
        >
          <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>
            {t('dayStructure.wizard.activities.add_button')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Activity List */}
      <FlatList
        data={activityBlocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
        style={{ flex: 1, marginTop: 16 }}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 14 }}>
            {t('dayStructure.wizard.activities.empty')}
          </Text>
        }
      />

      {/* Next Button */}
      <TouchableOpacity
        onPress={handleNext}
        style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {t('dayStructure.wizard.next')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  timeButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerContainer: {
    height: 180,
    marginVertical: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
