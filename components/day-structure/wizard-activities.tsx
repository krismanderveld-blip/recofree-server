/**
 * Wizard Step: Activities
 *
 * User adds activity blocks between wake and sleep.
 * Uses ScrollWheelTimePicker for start/end time selection.
 * Auto-suggests next start time from previous activity's end time.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScrollWheelTimePicker } from '@/components/day-structure/scroll-wheel-time-picker';
import type { TimeBlock } from '@/lib/features/dayStructure/types';

/**
 * Get the suggested start time for the next activity:
 * - If there are existing activity blocks, use the last one's endTime
 * - Otherwise, use the wake block's startTime (or default '09:00')
 */
function getSuggestedStartTime(draftBlocks: TimeBlock[]): string {
  const activities = draftBlocks
    .filter((b) => b.kind === 'activity')
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (activities.length > 0) {
    return activities[activities.length - 1]!.endTime;
  }

  const wakeBlock = draftBlocks.find((b) => b.kind === 'wake');
  return wakeBlock?.startTime ?? '09:00';
}

/**
 * Add one hour to a time string "HH:mm", capped at 23:59.
 */
function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const newH = Math.min((h ?? 0) + 1, 23);
  return `${String(newH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function WizardActivities() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, addActivityBlock, removeBlock, state } = useWizard();

  const suggestedStart = getSuggestedStartTime(state.draftBlocks);
  const [label, setLabel] = useState('');
  const [startTime, setStartTime] = useState(suggestedStart);
  const [endTime, setEndTime] = useState(addOneHour(suggestedStart));
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

  const activityBlocks = state.draftBlocks.filter((b) => b.kind === 'activity');

  // Update suggested start time when activities change
  useEffect(() => {
    const newSuggested = getSuggestedStartTime(state.draftBlocks);
    setStartTime(newSuggested);
    setEndTime(addOneHour(newSuggested));
  }, [activityBlocks.length]);

  const handleAdd = () => {
    if (!label.trim()) return;
    addActivityBlock(label.trim(), startTime, endTime);
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
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
              {t('dayStructure.wizard.activities.start_time')}
            </Text>
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>
              {startTime}
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
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
              {t('dayStructure.wizard.activities.end_time')}
            </Text>
            <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: '500' }}>
              {endTime}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inline time picker */}
        {showTimePicker === 'start' && (
          <View style={styles.pickerContainer}>
            <ScrollWheelTimePicker value={startTime} onChange={setStartTime} />
          </View>
        )}
        {showTimePicker === 'end' && (
          <View style={styles.pickerContainer}>
            <ScrollWheelTimePicker value={endTime} onChange={setEndTime} />
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

      {/* End of Day Button — navigates to sleep step */}
      <TouchableOpacity
        onPress={handleNext}
        style={[styles.endDayButton, { backgroundColor: colors.primary, marginTop: 16 }]}
        activeOpacity={0.8}
      >
        <IconSymbol name="moon.fill" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
          {t('dayStructure.wizard.activities.end_day_button')}
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
  endDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
});
