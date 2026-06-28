/**
 * Day Structure Wizard Screen
 *
 * Multi-step wizard for setting up the weekly day structure.
 * Steps: intro → wake → activities → sleep → review → copy_week
 */

import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import {
  DayStructureWizardProvider,
  useWizard,
} from '@/lib/features/dayStructure/wizard-context';
import { WizardIntro } from '@/components/day-structure/wizard-intro';
import { WizardWake } from '@/components/day-structure/wizard-wake';
import { WizardActivities } from '@/components/day-structure/wizard-activities';
import { WizardSleep } from '@/components/day-structure/wizard-sleep';
import { WizardReview } from '@/components/day-structure/wizard-review';
import { WizardCopyWeek } from '@/components/day-structure/wizard-copy-week';

function WizardContent() {
  const { state } = useWizard();

  switch (state.currentStep) {
    case 'intro':
      return <WizardIntro />;
    case 'wake':
      return <WizardWake />;
    case 'activities':
      return <WizardActivities />;
    case 'sleep':
      return <WizardSleep />;
    case 'review':
      return <WizardReview />;
    case 'copy_week':
      return <WizardCopyWeek />;
    default:
      return <WizardIntro />;
  }
}

export default function DayStructureWizardScreen() {
  return (
    <DayStructureWizardProvider>
      <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
        <WizardContent />
      </ScreenContainer>
    </DayStructureWizardProvider>
  );
}
