/**
 * Wizard Step: Copy Week
 *
 * Allows user to copy the configured day to other weekdays.
 * Includes quick-toggle buttons for "Weekdays" and "Weekend" groups.
 * Then saves the full week schema and navigates back.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { WEEKDAYS } from '@/lib/features/dayStructure/types';
import type { Weekday } from '@/lib/features/dayStructure/types';
import { createEmptyWeekSchema, copyDayBlocks } from '@/lib/features/dayStructure/helpers';
import { saveWeekSchema } from '@/lib/features/dayStructure/day-structure-service';
import {
  scheduleAllNotifications,
} from '@/lib/features/dayStructure/notification-service';
import { enableBell } from '@/lib/features/dayStructure/permission-service';
import { IconSymbol } from '@/components/ui/icon-symbol';

const WEEKDAY_GROUP: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WEEKEND_GROUP: Weekday[] = ['saturday', 'sunday'];

export function WizardCopyWeek() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { state, goToStep } = useWizard();

  const [selectedDays, setSelectedDays] = useState<Weekday[]>(
    WEEKDAYS.filter((d) => d !== state.targetDay),
  );
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: Weekday) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // Group toggle helpers
  const toggleGroup = (group: Weekday[]) => {
    const selectableDays = group.filter((d) => d !== state.targetDay);
    const allSelected = selectableDays.every((d) => selectedDays.includes(d));

    if (allSelected) {
      // Deselect all in group
      setSelectedDays((prev) => prev.filter((d) => !selectableDays.includes(d)));
    } else {
      // Select all in group
      setSelectedDays((prev) => {
        const without = prev.filter((d) => !selectableDays.includes(d));
        return [...without, ...selectableDays];
      });
    }
  };

  const isGroupFullySelected = (group: Weekday[]) => {
    const selectableDays = group.filter((d) => d !== state.targetDay);
    return selectableDays.length > 0 && selectableDays.every((d) => selectedDays.includes(d));
  };

  const isGroupPartiallySelected = (group: Weekday[]) => {
    const selectableDays = group.filter((d) => d !== state.targetDay);
    return selectableDays.some((d) => selectedDays.includes(d)) && !isGroupFullySelected(group);
  };

  const handleBack = () => {
    goToStep('review');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build week schema
      const weekSchema = createEmptyWeekSchema();

      // Set the target day
      weekSchema[state.targetDay] = {
        weekday: state.targetDay,
        blocks: state.draftBlocks,
      };

      // Copy to selected days
      for (const day of selectedDays) {
        weekSchema[day] = {
          weekday: day,
          blocks: copyDayBlocks(state.draftBlocks),
        };
      }

      // Save
      const result = await saveWeekSchema(weekSchema);
      if (!result.success) {
        // Translate error keys to user-friendly messages, deduplicate
        const uniqueErrors = [...new Set(result.errors)];
        const translatedErrors = uniqueErrors.map((key) => t(key) || key);
        Alert.alert(
          t('dayStructure.wizard.copy_week.error_title'),
          translatedErrors.join('\n'),
        );
        setSaving(false);
        return;
      }

      // Enable notifications
      await enableBell();
      await scheduleAllNotifications(weekSchema);

      // Navigate back to home
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[DayStructure/Wizard] Save failed:', error);
      Alert.alert(
        t('dayStructure.wizard.copy_week.error_title'),
        t('dayStructure.wizard.copy_week.error_generic'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      {/* Header */}
      <TouchableOpacity onPress={handleBack} style={{ marginBottom: 16 }} activeOpacity={0.7}>
        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('dayStructure.wizard.copy_week.title')}
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 20, lineHeight: 22 }}>
        {t('dayStructure.wizard.copy_week.description')}
      </Text>

      {/* Group Toggle Buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => toggleGroup(WEEKDAY_GROUP)}
          style={[
            styles.groupButton,
            {
              backgroundColor: isGroupFullySelected(WEEKDAY_GROUP)
                ? colors.primary
                : isGroupPartiallySelected(WEEKDAY_GROUP)
                  ? colors.primary + '30'
                  : colors.surface,
              borderColor: isGroupFullySelected(WEEKDAY_GROUP)
                ? colors.primary
                : colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: isGroupFullySelected(WEEKDAY_GROUP) ? '#fff' : colors.foreground,
          }}>
            {t('dayStructure.wizard.copy_week.weekdays_label')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => toggleGroup(WEEKEND_GROUP)}
          style={[
            styles.groupButton,
            {
              backgroundColor: isGroupFullySelected(WEEKEND_GROUP)
                ? colors.primary
                : isGroupPartiallySelected(WEEKEND_GROUP)
                  ? colors.primary + '30'
                  : colors.surface,
              borderColor: isGroupFullySelected(WEEKEND_GROUP)
                ? colors.primary
                : colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: isGroupFullySelected(WEEKEND_GROUP) ? '#fff' : colors.foreground,
          }}>
            {t('dayStructure.wizard.copy_week.weekend_label')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Day Selection */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {WEEKDAYS.map((day) => {
          const isSource = day === state.targetDay;
          const isSelected = selectedDays.includes(day);

          return (
            <TouchableOpacity
              key={day}
              onPress={() => !isSource && toggleDay(day)}
              disabled={isSource}
              activeOpacity={0.7}
              style={[
                styles.dayRow,
                {
                  backgroundColor: isSource
                    ? colors.primary + '15'
                    : isSelected
                      ? colors.surface
                      : 'transparent',
                  borderColor: isSource
                    ? colors.primary
                    : isSelected
                      ? colors.border
                      : colors.border + '50',
                },
              ]}
            >
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: isSource || isSelected ? colors.primary : 'transparent',
                  borderColor: isSource || isSelected ? colors.primary : colors.muted,
                },
              ]}>
                {(isSource || isSelected) && (
                  <IconSymbol name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={{ fontSize: 15, color: colors.foreground, marginLeft: 12, fontWeight: isSource ? '600' : '400' }}>
                {t(`dayStructure.weekdays.${day}`)}
                {isSource ? ` (${t('dayStructure.wizard.copy_week.source_label')})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Save Button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={[
          { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
          saving && { opacity: 0.6 },
        ]}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {saving ? t('dayStructure.wizard.copy_week.saving') : t('dayStructure.wizard.copy_week.save_button')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  groupButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
