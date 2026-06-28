/**
 * Wizard Step: Copy Week
 *
 * Allows user to copy the configured day to other weekdays.
 * Then saves the full week schema and navigates back.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { WEEKDAYS } from '@/lib/features/dayStructure/types';
import type { Weekday, WeekSchema } from '@/lib/features/dayStructure/types';
import { createEmptyWeekSchema, copyDayBlocks } from '@/lib/features/dayStructure/helpers';
import { saveWeekSchema } from '@/lib/features/dayStructure/day-structure-service';
import {
  scheduleAllNotifications,
} from '@/lib/features/dayStructure/notification-service';
import { enableBell } from '@/lib/features/dayStructure/permission-service';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
        Alert.alert(
          t('dayStructure.wizard.copy_week.error_title'),
          result.errors.join('\n'),
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
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 24, lineHeight: 22 }}>
        {t('dayStructure.wizard.copy_week.description')}
      </Text>

      {/* Day Selection */}
      <View style={{ gap: 8, marginBottom: 32 }}>
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
      </View>

      {/* Save Button */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[
            { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
            saving && { opacity: 0.6 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {saving ? t('dayStructure.wizard.copy_week.saving') : t('dayStructure.wizard.copy_week.save_button')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
