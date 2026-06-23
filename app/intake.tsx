import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import type { UserType, UrgencyLevel, StageOfChange, EigenRegieLevel } from '@/lib/ai/types';
import { STAGE_OF_CHANGE_OPTIONS, EIGEN_REGIE_INTAKE_OPTIONS } from '@/lib/ai/types';
import { colors as dc, radius, shadows, spacing, typography } from '@/constants/design';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from '@/lib/i18n';

type IntakeStep = 0 | 1 | 2 | 3 | 4;

// Urgency levels are computed inside the component using t() for proper reactivity

/** Zone colors for Eigen Regie intake options */
const EIGEN_REGIE_ZONE_COLORS: Record<string, string> = {
  RED: '#EF4444',
  ORANGE: '#F97316',
  YELLOW: '#F59E0B',
  'LIGHT GREEN': '#84CC16',
  'DARK GREEN': '#22C55E',
};

/** Animated progress bar segment with width transition */
function AnimatedProgressBar({ active }: { active: boolean }) {
  const width = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    width.value = withTiming(active ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%` as any,
  }));

  return <Animated.View style={[styles.progressBarFill, fillStyle]} />;
}

export default function IntakeScreen() {
  const router = useRouter();
  const { completeIntake, reloadFromStorage } = useUser();

  const [step, setStep] = useState<IntakeStep>(0);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [stageOfChange, setStageOfChange] = useState<StageOfChange | null>(null);
  const [eigenRegieLevel, setEigenRegieLevel] = useState<EigenRegieLevel | null>(null);
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImportFlow, setShowImportFlow] = useState(false);
  const [importFile, setImportFile] = useState<{ uri: string; name: string } | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importDiagLog, setImportDiagLog] = useState<string | null>(null);
  const [diagCopied, setDiagCopied] = useState(false);

  // Pulse animation for submit button
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isSubmitting) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 200 });
    }
  }, [isSubmitting, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  const isKim = selectedType === 'kim';
  const canProceedStep0 = selectedCountry !== null;
  const canProceedStep1 = true; // Language always has a default
  const canProceedStep2 = name.trim().length >= 2 && selectedType !== null;
  const canProceedStep3 = isKim ? eigenRegieLevel !== null : stageOfChange !== null;
  const canSubmit = urgency !== null;

  // Animation shared values
  const fadeAnim = useSharedValue(1);
  const slideAnim = useSharedValue(0);

  const animatedStepStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateX: slideAnim.value }],
  }));

  const animateTransition = (direction: 'forward' | 'backward', callback: () => void) => {
    const slideOut = direction === 'forward' ? -20 : 20;
    const slideIn = direction === 'forward' ? 20 : -20;

    fadeAnim.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    slideAnim.value = withTiming(slideOut, { duration: 120, easing: Easing.out(Easing.cubic) });

    setTimeout(() => {
      callback();
      slideAnim.value = slideIn;
      fadeAnim.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      slideAnim.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    }, 130);
  };

  const handleNext = () => {
    if (step < 4) {
      animateTransition('forward', () => setStep((step + 1) as IntakeStep));
    }
  };

  const handleBack = () => {
    if (step > 0) {
      animateTransition('backward', () => setStep((step - 1) as IntakeStep));
    }
  };

  // Track whether import succeeded so the diag overlay can show "Continue" button
  const [importNavReady, setImportNavReady] = useState(false);
  // Name prompt after import when backpack has no name
  const [importNamePrompt, setImportNamePrompt] = useState(false);
  const [importName, setImportName] = useState('');
  const { t, language, setLanguage, setCountry } = useTranslation();

  // ── Import from backup ──
  const handleImportPickFile = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setImportFile({ uri: asset.uri, name: asset.name });
      setImportError(null);
    } catch {
      setImportError(t('intake.import.error.file_picker'));
    }
  }, [t]);

  const urgencyLevels = useMemo(() => [
    { label: t('intake.urgency.low.label'), value: 'laag' as UrgencyLevel, description: t('intake.urgency.low.description') },
    { label: t('intake.urgency.medium.label'), value: 'midden' as UrgencyLevel, description: t('intake.urgency.medium.description') },
    { label: t('intake.urgency.high.label'), value: 'hoog' as UrgencyLevel, description: t('intake.urgency.high.description') },
  ], [t]);

  const handleImportExecute = useCallback(async () => {
    if (!importFile || !importPassword) return;
    setImportLoading(true);
    setImportError(null);
    setDiagCopied(false);
    setImportNavReady(false);

    // Show overlay IMMEDIATELY with initial message (before any async work)
    setImportDiagLog('• Starting import...\n');

    // Helper to update the on-screen log in real-time
    const appendDiag = (line: string) => {
      setImportDiagLog((prev) => (prev ?? '') + line + '\n');
    };

    try {
      appendDiag('• Loading modules...');
      const { clearImportDiag, logImportDiag, formatImportDiag } = await import('@/lib/debug/import-diagnostics');
      clearImportDiag();
      logImportDiag('Modules: import-diagnostics loaded', 'OK');

      const FileSystem = await import('expo-file-system/legacy');
      logImportDiag('Modules: expo-file-system loaded', 'OK');

      const { importEncryptedRecoFreeBackup } = await import('@/lib/features/exportImport/services/importDataService');
      logImportDiag('Modules: importDataService loaded', 'OK');

      const { createExportImportStoresAdapter } = await import('@/lib/features/exportImport/hooks/useExportImportStores');
      const stores = createExportImportStoresAdapter();
      logImportDiag('Modules: stores adapter created', 'OK');
      appendDiag('✓ Modules loaded');

      logImportDiag('Reading file from disk', 'INFO');
      appendDiag('• Reading file...');
      const envelopeJson = await FileSystem.readAsStringAsync(importFile.uri, { encoding: FileSystem.EncodingType.UTF8 });
      logImportDiag('File read', 'OK', `${envelopeJson.length} chars`);
      appendDiag(`✓ File read (${envelopeJson.length} chars)`);

      logImportDiag('Decrypting + writing to storage', 'INFO');
      appendDiag('• Decrypting + writing to storage...');
      const result = await importEncryptedRecoFreeBackup({
        envelopeJson,
        password: importPassword,
        currentAppVersion: '1.0.0',
        stores,
      });
      logImportDiag('importEncryptedRecoFreeBackup returned', result.status === 'SUCCESS' ? 'OK' : 'FAIL',
        `status=${result.status}${result.errorMessage ? ', error=' + result.errorMessage : ''}`);

      if (result.status === 'SUCCESS') {
        appendDiag(`✓ Import OK (status=${result.status})`);
        appendDiag('• Calling reloadFromStorage...');
        logImportDiag('Calling reloadFromStorage', 'INFO');
        try {
          await reloadFromStorage();
          logImportDiag('reloadFromStorage completed', 'OK');
          appendDiag('✓ reloadFromStorage completed');
          // Check if naam is missing — show prompt
          const { readEncrypted } = await import('@/lib/crypto/storage-encryption');
          const bpRaw = await readEncrypted('@recofree_backpack');
          const bpNaam = bpRaw ? JSON.parse(bpRaw)?.naam : '';
          if (!bpNaam) {
            setImportNamePrompt(true);
            appendDiag('⚠ Name missing — prompting user');
          }
        } catch (reloadErr: any) {
          logImportDiag('reloadFromStorage THREW', 'FAIL', reloadErr?.message ?? 'unknown');
          appendDiag(`✗ reloadFromStorage THREW: ${reloadErr?.message ?? 'unknown'}`);
          appendDiag(`   stack: ${reloadErr?.stack ?? 'none'}`);
        }
        // Do NOT navigate automatically — let user see the log and press Continue
        logImportDiag('Import complete — waiting for user to press Continue', 'OK');
        appendDiag('\n✓ IMPORT COMPLETE — press Continue to proceed');
        setImportNavReady(true);
      } else {
        logImportDiag('Import returned non-SUCCESS', 'FAIL', result.errorMessage ?? 'no message');
        appendDiag(`✗ IMPORT FAILED: ${result.errorMessage ?? 'unknown'}`);
      }

      // Replace the running log with the full formatted diagnostics
      setImportDiagLog(formatImportDiag());
    } catch (err: any) {
      const msg = err?.message ?? 'unknown';
      const stack = err?.stack ?? '';
      appendDiag(`\n✗ UNCAUGHT ERROR: ${msg}`);
      appendDiag(`   stack: ${stack}`);
      setImportError(msg);
      // Try to get the formatted log if the module was loaded
      try {
        const { logImportDiag: log2, formatImportDiag: fmt2 } = await import('@/lib/debug/import-diagnostics');
        log2('UNCAUGHT ERROR', 'FAIL', `${msg}\n${stack}`);
        setImportDiagLog(fmt2());
      } catch {
        // Module didn't load — keep the appendDiag output which is already showing
      }
    } finally {
      setImportLoading(false);
    }
  }, [importFile, importPassword, reloadFromStorage, router]);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !selectedType || !urgency) return;
    if (!isKim && !stageOfChange) return;
    if (isKim && !eigenRegieLevel) return;
    setIsSubmitting(true);
    try {
      await completeIntake({
        userName: name.trim(),
        userType: selectedType,
        stageOfChange: isKim ? null : stageOfChange,
        eigenRegieLevel: isKim ? eigenRegieLevel : null,
        startEmotion: '',
        urgency,
        initialContext: '',
      });
      router.replace('/gdpr-consent');
    } catch (error) {
      console.error('Intake error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer
      edges={['top', 'bottom', 'left', 'right']}
      containerClassName="bg-background"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Progress Indicator — hidden on country/language steps */}
            {step > 1 && (
              <View style={styles.progressRow}>
                {[2, 3, 4].map((s) => (
                  <View key={s} style={styles.progressBarTrack}>
                    <AnimatedProgressBar active={s <= step} />
                  </View>
                ))}
              </View>
            )}

            {/* Step 0: Country Selection */}
            {step === 0 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <View style={styles.heroSection}>
                  <Text style={styles.heroEmoji}>📍</Text>
                  <Text style={styles.heroTitle}>{t('intake.country.title')}</Text>
                  <Text style={styles.heroSubtitle}>{t('intake.country.subtitle')}</Text>
                </View>

                <View style={styles.optionsGroup}>
                  {(['BE', 'NL', 'FR', 'UK', 'US'] as const).map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => { setSelectedCountry(c); setCountry(c); }}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          selectedCountry === c && styles.optionCardSelectedElias,
                        ]}
                      >
                        <Text style={styles.optionTitle}>
                          {c === 'BE' ? '🇧🇪' : c === 'NL' ? '🇳🇱' : c === 'FR' ? '🇫🇷' : c === 'UK' ? '🇬🇧' : '🇺🇸'}{' '}
                          {t(`intake.country.option.${c}`)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep0}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: !canProceedStep0 ? 0.4 : pressed ? 0.85 : 1 },
                      pressed && canProceedStep0 && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>{t('intake.country.button.continue')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 1: Language Selection */}
            {step === 1 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <View style={styles.heroSection}>
                  <Text style={styles.heroEmoji}>🌍</Text>
                  <Text style={styles.heroTitle}>{t('intake.lang.title')}</Text>
                  <Text style={styles.heroSubtitle}>{t('intake.lang.subtitle')}</Text>
                </View>

                <View style={styles.optionsGroup}>
                  {(['nl', 'en', 'fr'] as const).map((lang) => (
                    <Pressable
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          language === lang && styles.optionCardSelectedElias,
                        ]}
                      >
                        <Text style={styles.optionTitle}>
                          {lang === 'nl' ? '🇳🇱' : lang === 'en' ? '🇬🇧' : '🇫🇷'}{' '}
                          {t(`intake.lang.option.${lang}`)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleNext}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: pressed ? 0.85 : 1 },
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>{t('intake.lang.button.continue')}</Text>
                  </Pressable>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>{t('intake.step3.button.back')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 2: Name + User Type */}
            {step === 2 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <View style={styles.heroSection}>
                  <Text style={styles.heroEmoji}>{t('intake.step1.hero.emoji')}</Text>
                  <Text style={styles.heroTitle}>{t('intake.step1.hero.title')}</Text>
                  <Text style={styles.heroSubtitle}>
                    {t('intake.step1.hero.subtitle')}
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('intake.step1.name.label')}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('intake.import_diag.name_prompt.placeholder')}
                    placeholderTextColor={dc.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    maxLength={30}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('intake.step1.type.label')}</Text>

                  <Pressable
                    onPress={() => setSelectedType('elias')}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionCard,
                        selectedType === 'elias' && styles.optionCardSelectedElias,
                      ]}
                    >
                      <Text style={styles.optionTitle}>{t('intake.step1.type.elias.title')}</Text>
                      <Text style={styles.optionDescription}>
                        {t('intake.step1.type.elias.description')}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedType('kim')}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionCard,
                        selectedType === 'kim' && styles.optionCardSelectedKim,
                      ]}
                    >
                      <Text style={styles.optionTitle}>{t('intake.step1.type.kim.title')}</Text>
                      <Text style={styles.optionDescription}>
                        {t('intake.step1.type.kim.description')}
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep2}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: !canProceedStep2 ? 0.4 : pressed ? 0.85 : 1 },
                      pressed && canProceedStep2 && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>{t('intake.step2.button.next')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowImportFlow(true)}
                    style={({ pressed }) => [
                      styles.ghostButton,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={styles.ghostButtonText}>{t('intake.step1.button.import')}</Text>
                  </Pressable>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>{t('intake.step3.button.back')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 3: Stage of Change (Elias) OR Eigen Regie (Kim) */}
            {step === 3 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                {isKim ? (
                  <>
                    <Text style={styles.stepTitle}>
                      {t('intake.step2.kim.title')}
                    </Text>
                    <Text style={styles.stepSubtitle}>
                      {t('intake.step2.kim.subtitle')}
                    </Text>

                    <View style={styles.optionsGroup}>
                      {EIGEN_REGIE_INTAKE_OPTIONS.map((option) => {
                        const zoneColor = EIGEN_REGIE_ZONE_COLORS[option.zone] ?? dc.textMuted;
                        const isSelected = eigenRegieLevel === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => setEigenRegieLevel(option.value)}
                            style={({ pressed }) => [
                              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                            ]}
                          >
                            <View
                              style={[
                                styles.optionCard,
                                {
                                  borderColor: isSelected ? zoneColor : dc.borderSoft,
                                  backgroundColor: isSelected ? zoneColor + '10' : dc.surface,
                                },
                              ]}
                            >
                              <View style={styles.zoneRow}>
                                <View style={[styles.zoneDot, { backgroundColor: zoneColor }]} />
                                <Text style={[styles.zoneLabel, { color: zoneColor }]}>
                                  {option.zone}
                                </Text>
                              </View>
                              <Text style={styles.optionDescription}>{option.label}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.stepTitle}>{t('intake.step2.elias.title')}</Text>
                    <Text style={styles.stepSubtitle}>
                      {t('intake.step2.elias.subtitle')}
                    </Text>

                    <View style={styles.optionsGroup}>
                      {STAGE_OF_CHANGE_OPTIONS.map((option) => (
                        <Pressable
                          key={option.value}
                          onPress={() => setStageOfChange(option.value)}
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                          ]}
                        >
                          <View
                            style={[
                              styles.optionCard,
                              stageOfChange === option.value && styles.optionCardSelectedElias,
                            ]}
                          >
                            <Text style={styles.optionTitle}>{option.label}</Text>
                            <Text style={styles.optionDescription}>{option.description}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep3}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: !canProceedStep3 ? 0.4 : pressed ? 0.85 : 1 },
                      pressed && canProceedStep3 && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>{t('intake.step1.button.next')}</Text>
                  </Pressable>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>{t('intake.step3.button.back')}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 4: Urgency (final step — submit) */}
            {step === 4 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <Text style={styles.stepTitle}>{t('intake.step3.title')}</Text>
                <Text style={styles.stepSubtitle}>
                  {t('intake.step3.subtitle')}
                </Text>

                <View style={styles.optionsGroup}>
                  {urgencyLevels.map((level) => (
                    <Pressable
                      key={level.value}
                      onPress={() => setUrgency(level.value)}
                      style={({ pressed }) => [
                        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.optionCard,
                          urgency === level.value && styles.optionCardSelectedElias,
                        ]}
                      >
                        <Text style={styles.optionTitle}>{level.label}</Text>
                        <Text style={styles.optionDescription}>{level.description}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.bottomActions}>
                  <Animated.View style={isSubmitting ? pulseStyle : undefined}>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={!canSubmit || isSubmitting}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1 },
                        pressed && canSubmit && { transform: [{ scale: 0.97 }] },
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? t('intake.step3.button.submitting') : t('intake.step3.button.submit')}
                      </Text>
                    </Pressable>
                  </Animated.View>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>{t('intake.step2.button.back')}</Text>
                  </Pressable>
                </View>

                <Text style={styles.privacyNote}>
                  {t('intake.step3.privacy_note')}
                </Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Import Backup Modal */}
      <Modal visible={showImportFlow} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={[styles.optionCard, { backgroundColor: dc.background, borderColor: dc.border, marginHorizontal: 24, maxWidth: 380, width: '90%', padding: 24 }]}>
            <Text style={[styles.heroTitle, { fontSize: 20, marginBottom: 8 }]}>{t('intake.import_modal.title')}</Text>
            <Text style={[styles.optionDescription, { marginBottom: 20, textAlign: 'center' }]}>
              {t('intake.import_modal.description')}
            </Text>

            {/* File picker */}
            <Pressable
              onPress={handleImportPickFile}
              style={({ pressed }) => [
                styles.textInput,
                { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: importFile ? dc.textPrimary : dc.textMuted, fontSize: 14 }}>
                {importFile ? importFile.name : t('intake.import_modal.file_picker.placeholder')}
              </Text>
            </Pressable>

            {/* Password */}
            <TextInput
              style={[styles.textInput, { marginTop: 12 }]}
              secureTextEntry
              value={importPassword}
              onChangeText={(t) => { setImportPassword(t); setImportError(null); }}
              placeholder={t('intake.import_modal.password.placeholder')}
              placeholderTextColor={dc.textMuted}
              autoComplete="off"
              returnKeyType="done"
            />

            {/* Error */}
            {importError && (
              <Text style={{ color: dc.danger, fontSize: 13, marginTop: 8 }}>{importError}</Text>
            )}

            {/* Import button */}
            <Pressable
              onPress={handleImportExecute}
              disabled={!importFile || !importPassword || importLoading}
              style={({ pressed }) => [
                styles.primaryButton,
                { marginTop: 16, opacity: (!importFile || !importPassword || importLoading) ? 0.4 : pressed ? 0.85 : 1 },
                pressed && importFile && importPassword && !importLoading && { transform: [{ scale: 0.97 }] },
              ]}
            >
              {importLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('intake.import_modal.button.submit')}</Text>
              )}
            </Pressable>

            {/* Cancel */}
            <Pressable
              onPress={() => { setShowImportFlow(false); setImportError(null); setImportFile(null); setImportPassword(''); }}
              style={({ pressed }) => [styles.ghostButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.ghostButtonText}>{t('intake.import_modal.button.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─── IMPORT DIAGNOSTICS OVERLAY ─── */}
      {importDiagLog && (
        <Modal visible={true} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', padding: 16, paddingTop: 60 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
              {t('intake.import_diag.title')}
            </Text>
            <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 12 }}>
              {importNavReady ? t('intake.import_diag.subtitle.success') : t('intake.import_diag.subtitle.pending')}
            </Text>
            <ScrollView style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#e0e0e0', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16 }} selectable>
                {importDiagLog}
              </Text>
            </ScrollView>
            <View style={{ gap: 10 }}>
              {/* Name prompt — shown when import succeeded but name is empty */}
              {importNavReady && importNamePrompt && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                    {t('intake.import_diag.name_prompt.title')}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#444' }}
                    value={importName}
                    onChangeText={setImportName}
                    placeholder={t('intake.step1.name.placeholder')}
                    placeholderTextColor="#666"
                    autoFocus
                    returnKeyType="done"
                  />
                </View>
              )}
              {/* Continue button — only shown when import succeeded */}
              {importNavReady && (
                <Pressable
                  onPress={async () => {
                    // Save name if provided
                    if (importName.trim()) {
                      try {
                        const { readEncrypted, writeEncrypted } = await import('@/lib/crypto/storage-encryption');
                        const bpRaw = await readEncrypted('@recofree_backpack');
                        if (bpRaw) {
                          const bp = JSON.parse(bpRaw);
                          bp.naam = importName.trim();
                          await writeEncrypted('@recofree_backpack', JSON.stringify(bp));
                        }
                        // Also update userDat naam backup
                        const udRaw = await readEncrypted('@recofree_userdat');
                        if (udRaw) {
                          const ud = JSON.parse(udRaw);
                          ud.naam = importName.trim();
                          await writeEncrypted('@recofree_userdat', JSON.stringify(ud));
                        }
                        // Reload to pick up the name
                        await reloadFromStorage();
                      } catch { /* best effort */ }
                    }
                    setImportDiagLog(null);
                    router.replace('/(tabs)' as any);
                  }}
                  disabled={importNamePrompt && !importName.trim()}
                  style={({ pressed }) => [{
                    backgroundColor: (importNamePrompt && !importName.trim()) ? '#555' : '#16a34a',
                    borderRadius: 8, paddingVertical: 14, alignItems: 'center' as const,
                    opacity: (importNamePrompt && !importName.trim()) ? 0.5 : pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('intake.import_diag.button.continue')}</Text>
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={async () => {
                    try {
                      await Clipboard.setStringAsync(importDiagLog);
                      setDiagCopied(true);
                      setTimeout(() => setDiagCopied(false), 2000);
                    } catch { /* clipboard not available */ }
                  }}
                  style={({ pressed }) => [{
                    flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 14, alignItems: 'center' as const,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {diagCopied ? t('intake.import_diag.button.copied') : t('intake.import_diag.button.copy')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setImportDiagLog(null)}
                  style={({ pressed }) => [{
                    flex: 1, backgroundColor: '#333', borderRadius: 8, paddingVertical: 14, alignItems: 'center' as const,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{t('intake.import_diag.button.close')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: dc.background,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: dc.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 48,
    backgroundColor: dc.background,
    paddingBottom: spacing.screenBottom,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  progressBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: dc.sliderTrack,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: dc.primary,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: typography.titleLarge.fontSize,
    fontWeight: typography.titleLarge.fontWeight as any,
    color: dc.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight as any,
    color: dc.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: dc.textTertiary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: dc.surface,
    borderWidth: 1.5,
    borderColor: dc.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: typography.bodyMedium.fontSize,
    color: dc.textPrimary,
  },
  optionCard: {
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: dc.borderSoft,
    backgroundColor: dc.surface,
    ...shadows.soft,
  },
  optionCardSelectedElias: {
    borderColor: dc.eliasAccent,
    backgroundColor: dc.eliasAccentSoft,
  },
  optionCardSelectedKim: {
    borderColor: dc.kimAccent,
    backgroundColor: dc.kimAccentSoft,
  },
  optionTitle: {
    fontSize: typography.titleSmall.fontSize,
    fontWeight: typography.titleSmall.fontWeight as any,
    color: dc.textPrimary,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.bodySmall.fontWeight as any,
    color: dc.textSecondary,
    lineHeight: 20,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoneLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  optionsGroup: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: typography.titleMedium.fontSize,
    fontWeight: typography.titleMedium.fontWeight as any,
    color: dc.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  stepSubtitle: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight as any,
    color: dc.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  bottomActions: {
    marginTop: 'auto' as any,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: dc.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.soft,
    shadowColor: dc.primary,
    shadowOpacity: 0.15,
  },
  primaryButtonText: {
    color: dc.textInverse,
    fontSize: typography.button.fontSize,
    fontWeight: '700',
  },
  ghostButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: dc.textTertiary,
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '500',
  },
  privacyNote: {
    fontSize: typography.caption.fontSize,
    color: dc.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
