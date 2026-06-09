import { useState, useEffect } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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

type IntakeStep = 1 | 2 | 3;

const URGENCY_LEVELS: { label: string; value: UrgencyLevel; description: string }[] = [
  { label: 'Low', value: 'laag', description: 'I want to explore at my own pace' },
  { label: 'Medium', value: 'midden', description: 'I could use some support' },
  { label: 'High', value: 'hoog', description: 'I need help right now' },
];

/** Zone colors for Eigen Regie intake options */
const EIGEN_REGIE_ZONE_COLORS: Record<string, string> = {
  ROOD: '#EF4444',
  ORANJE: '#F97316',
  GEEL: '#F59E0B',
  'LICHT GROEN': '#84CC16',
  'DONKER GROEN': '#22C55E',
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
  const { completeIntake } = useUser();

  const [step, setStep] = useState<IntakeStep>(1);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [stageOfChange, setStageOfChange] = useState<StageOfChange | null>(null);
  const [eigenRegieLevel, setEigenRegieLevel] = useState<EigenRegieLevel | null>(null);
  const [urgency, setUrgency] = useState<UrgencyLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const canProceedStep1 = name.trim().length >= 2 && selectedType !== null;
  const canProceedStep2 = isKim ? eigenRegieLevel !== null : stageOfChange !== null;
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
    if (step < 3) {
      animateTransition('forward', () => setStep((step + 1) as IntakeStep));
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateTransition('backward', () => setStep((step - 1) as IntakeStep));
    }
  };

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
            {/* Progress Indicator */}
            <View style={styles.progressRow}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={styles.progressBarTrack}>
                  <AnimatedProgressBar active={s <= step} />
                </View>
              ))}
            </View>

            {/* Step 1: Name + User Type */}
            {step === 1 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <View style={styles.heroSection}>
                  <Text style={styles.heroEmoji}>💙</Text>
                  <Text style={styles.heroTitle}>Welcome to RecoFree</Text>
                  <Text style={styles.heroSubtitle}>
                    A safe space for recovery and growth
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>What should I call you?</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Your first name"
                    placeholderTextColor={dc.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    maxLength={30}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Which describes you best?</Text>

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
                      <Text style={styles.optionTitle}>I have an addiction myself</Text>
                      <Text style={styles.optionDescription}>
                        You'll be supported by Elias — direct, honest support for your recovery — from someone who gets it.
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
                      <Text style={styles.optionTitle}>I'm a loved one of someone</Text>
                      <Text style={styles.optionDescription}>
                        You'll be supported by Kim — a direct, honest companion for your well-being.
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleNext}
                    disabled={!canProceedStep1}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: !canProceedStep1 ? 0.4 : pressed ? 0.85 : 1 },
                      pressed && canProceedStep1 && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 2: Stage of Change (Elias) OR Eigen Regie (Kim) */}
            {step === 2 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                {isKim ? (
                  <>
                    <Text style={styles.stepTitle}>
                      In hoeverre wordt jouw leven momenteel bepaald door de ander?
                    </Text>
                    <Text style={styles.stepSubtitle}>
                      Dit helpt Kim begrijpen hoe je er nu voor staat.
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
                    <Text style={styles.stepTitle}>Where are you in your journey?</Text>
                    <Text style={styles.stepSubtitle}>
                      This helps Elias understand how to best support you.
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
                    disabled={!canProceedStep2}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { opacity: !canProceedStep2 ? 0.4 : pressed ? 0.85 : 1 },
                      pressed && canProceedStep2 && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </Pressable>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Back</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Step 3: Urgency (final step — submit) */}
            {step === 3 && (
              <Animated.View style={[styles.flex1, animatedStepStyle]}>
                <Text style={styles.stepTitle}>How urgent does it feel?</Text>
                <Text style={styles.stepSubtitle}>
                  This helps us set the right tone and pace for you.
                </Text>

                <View style={styles.optionsGroup}>
                  {URGENCY_LEVELS.map((level) => (
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
                        {isSubmitting ? 'One moment...' : 'Get Started'}
                      </Text>
                    </Pressable>
                  </Animated.View>
                  <Pressable onPress={handleBack} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Back</Text>
                  </Pressable>
                </View>

                <Text style={styles.privacyNote}>
                  Your data stays on your phone. Nothing is shared without your consent.
                </Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
