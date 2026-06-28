/**
 * Wizard Step: Intro
 *
 * Explains what the day structure is and why it helps.
 * Single CTA to start configuring.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

export function WizardIntro() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep } = useWizard();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
        <IconSymbol name="clock.fill" size={40} color={colors.primary} />
      </View>

      <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground, textAlign: 'center', marginBottom: 12 }}>
        {t('dayStructure.wizard.intro.title')}
      </Text>

      <Text style={{ fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 24, marginBottom: 32, maxWidth: 320 }}>
        {t('dayStructure.wizard.intro.description')}
      </Text>

      <TouchableOpacity
        onPress={() => goToStep('wake')}
        style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {t('dayStructure.wizard.intro.start_button')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
