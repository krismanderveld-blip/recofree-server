/**
 * Day Structure Wizard Screen
 *
 * Multi-step wizard for setting up the weekly day structure.
 * Steps: intro → wake → activities → sleep → review → copy_week
 *
 * Features a persistent "Save" button that allows saving partial progress
 * at any step (even if not fully configured).
 */

import React, { useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, Alert, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
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
import { STORAGE_KEYS } from '@/lib/features/dayStructure/types';
import type { TimeBlock, WizardStep, Weekday } from '@/lib/features/dayStructure/types';
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';

// ─── Draft persistence ──────────────────────────────────────────────────────

interface WizardDraft {
  currentStep: WizardStep;
  targetDay: Weekday;
  draftBlocks: TimeBlock[];
  savedAt: string;
}

async function saveDraft(draft: WizardDraft): Promise<void> {
  await writeEncrypted(STORAGE_KEYS.WIZARD_DRAFT, JSON.stringify(draft));
}

async function loadDraft(): Promise<WizardDraft | null> {
  const raw = await readEncrypted(STORAGE_KEYS.WIZARD_DRAFT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WizardDraft;
  } catch {
    return null;
  }
}

// ─── Wizard Content ─────────────────────────────────────────────────────────

function WizardContent() {
  const { state, goToStep, setDraftBlocks, setTargetDay } = useWizard();
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  // Load draft on mount
  useEffect(() => {
    (async () => {
      const draft = await loadDraft();
      if (draft && draft.draftBlocks.length > 0) {
        setDraftBlocks(draft.draftBlocks);
        setTargetDay(draft.targetDay);
        goToStep(draft.currentStep);
      }
    })();
  }, []);

  // Save partial progress
  const handleSave = useCallback(async () => {
    const draft: WizardDraft = {
      currentStep: state.currentStep,
      targetDay: state.targetDay,
      draftBlocks: state.draftBlocks,
      savedAt: new Date().toISOString(),
    };
    await saveDraft(draft);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [state, router]);

  // Show save button on all steps except intro
  const showSaveButton = state.currentStep !== 'intro';

  return (
    <View style={{ flex: 1 }}>
      {/* Step content */}
      <View style={{ flex: 1 }}>
        {renderStep(state.currentStep)}
      </View>

      {/* Persistent Save button */}
      {showSaveButton && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, { borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.saveButtonText, { color: colors.muted }]}>
              {t('dayStructure.wizard.save_and_exit')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function renderStep(step: WizardStep) {
  switch (step) {
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

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DayStructureWizardScreen() {
  return (
    <DayStructureWizardProvider>
      <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
        <WizardContent />
      </ScreenContainer>
    </DayStructureWizardProvider>
  );
}

const styles = StyleSheet.create({
  saveContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
