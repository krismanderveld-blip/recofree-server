/**
 * Wizard Step: Wake
 *
 * User sets their wake-up time using a scroll-wheel time picker.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { DEFAULT_WAKE_TIME } from '@/lib/features/dayStructure/constants';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScrollWheelTimePicker } from './scroll-wheel-time-picker';

export function WizardWake() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, addWakeBlock, updateBlock, state } = useWizard();

  const existingWake = state.draftBlocks.find((b) => b.kind === 'wake');
  const [wakeTime, setWakeTime] = useState(existingWake?.startTime ?? DEFAULT_WAKE_TIME);

  const handleNext = () => {
    if (existingWake) {
      updateBlock(existingWake.id, { startTime: wakeTime, endTime: wakeTime });
    } else {
      addWakeBlock(wakeTime);
    }
    goToStep('activities');
  };

  const handleBack = () => {
    goToStep('intro');
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      {/* Header */}
      <TouchableOpacity onPress={handleBack} style={{ marginBottom: 16 }} activeOpacity={0.7}>
        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('dayStructure.wizard.wake.title')}
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 32, lineHeight: 22 }}>
        {t('dayStructure.wizard.wake.description')}
      </Text>

      {/* Scroll Wheel Time Picker */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <IconSymbol name="clock.fill" size={28} color={colors.primary} />
        </View>

        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>
          {t('dayStructure.wizard.wake.time_label')}
        </Text>

        <ScrollWheelTimePicker value={wakeTime} onChange={setWakeTime} />
      </View>

      {/* Next Button */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          onPress={handleNext}
          style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {t('dayStructure.wizard.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
