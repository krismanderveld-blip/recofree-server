/**
 * Wizard Step: Wake
 *
 * User sets their wake-up time. Simple time picker with alarm toggle.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { DEFAULT_WAKE_TIME } from '@/lib/features/dayStructure/constants';
import { IconSymbol } from '@/components/ui/icon-symbol';

export function WizardWake() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, addWakeBlock, state } = useWizard();

  const existingWake = state.draftBlocks.find((b) => b.kind === 'wake');
  const [wakeTime, setWakeTime] = useState(existingWake?.startTime ?? DEFAULT_WAKE_TIME);

  const handleNext = () => {
    if (!existingWake) {
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

      {/* Time Input */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <IconSymbol name="clock.fill" size={28} color={colors.primary} />
        </View>

        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>
          {t('dayStructure.wizard.wake.time_label')}
        </Text>

        <TextInput
          value={wakeTime}
          onChangeText={setWakeTime}
          placeholder="07:00"
          placeholderTextColor={colors.muted}
          keyboardType="numbers-and-punctuation"
          style={{
            fontSize: 36,
            fontWeight: '700',
            color: colors.foreground,
            textAlign: 'center',
            minWidth: 140,
            paddingVertical: 8,
            borderBottomWidth: 2,
            borderBottomColor: colors.primary,
          }}
          maxLength={5}
        />
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
