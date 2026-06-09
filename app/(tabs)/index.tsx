import { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, Text, View, Pressable, Modal, Platform, Image, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { MilestoneCard } from '@/components/milestone-card';
import { evaluateEliasMilestone } from '@/lib/features/milestone-tracker/elias-milestone-tracker';
import { evaluateKimMilestone } from '@/lib/features/milestone-tracker/kim-milestone-tracker';
import type { MilestoneDefinition, EliasMilestoneTrackerState, KimMilestoneTrackerState } from '@/lib/features/milestone-tracker/milestone-tracker-types';
import { fixUnicode } from '@/lib/utils';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { getSliderConfig } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';
import { colors as dc, spacing, radius, shadows, typography, cardStyles, buttonStyles } from '@/constants/design';

export default function HomeScreen() {
  const router = useRouter();
  const { state, getUserName, getMood, getUserDat, updateMilestoneShown, toggleClinicalMode } = useUser();
  const colors = useColors();
  const userName = getUserName();
  const mood = getMood();
  const userDat = getUserDat();
  const [activeMilestone, setActiveMilestone] = useState<MilestoneDefinition | null>(null);
  const [showClinicalModal, setShowClinicalModal] = useState(false);

  // Easter egg: 5x tap on companion name
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCompanionNameTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setShowClinicalModal(true);
    }
  }, []);

  const handleEnableClinical = useCallback(async () => {
    await toggleClinicalMode(true);
    setShowClinicalModal(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [toggleClinicalMode]);

  const handleDisableClinical = useCallback(async () => {
    await toggleClinicalMode(false);
    setShowClinicalModal(false);
  }, [toggleClinicalMode]);

  const handleDismissMilestone = useCallback(() => {
    setActiveMilestone(null);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  useEffect(() => {
    if (!state.isLoading && !state.intakeCompleted) {
      router.replace('/intake' as Href);
    } else if (!state.isLoading && state.intakeCompleted && state.userDat && !state.userDat.gdprAccepted) {
      router.replace('/gdpr-consent' as Href);
    }
  }, [state.isLoading, state.intakeCompleted, state.userDat?.gdprAccepted]);

  // Milestone check (both personas)
  useEffect(() => {
    if (state.isLoading || !state.intakeCompleted) return;
    const nowIso = new Date().toISOString();
    const sessionId = `home_${Date.now()}`;

    if (state.userType === 'elias') {
      const milestoneState: EliasMilestoneTrackerState = {
        persona: 'elias',
        seenMilestones: (userDat as any)?.milestoneTracker?.seenMilestones ?? [],
        lastCheckedAt: (userDat as any)?.milestoneTracker?.lastCheckedAt ?? null,
        lastDisplayedMilestoneId: (userDat as any)?.milestoneTracker?.lastDisplayedMilestoneId ?? null,
      };
      const result = evaluateEliasMilestone({
        persona: 'elias',
        intakeCompleted: true,
        homeOpenedAt: nowIso,
        homeOpenSessionId: sessionId,
        sobrietyDate: userDat?.sobrietyDate ?? null,
        milestoneState,
      });
      if (result.status === 'ACTIVE' && result.eligibleMilestone) {
        setActiveMilestone(result.eligibleMilestone);
        updateMilestoneShown(new Date().toISOString().slice(0, 10));
      }
    } else if (state.userType === 'kim') {
      const milestoneState: KimMilestoneTrackerState = {
        persona: 'kim',
        seenMilestones: (userDat as any)?.milestoneTracker?.seenMilestones ?? [],
        lastCheckedAt: (userDat as any)?.milestoneTracker?.lastCheckedAt ?? null,
        lastDisplayedMilestoneId: (userDat as any)?.milestoneTracker?.lastDisplayedMilestoneId ?? null,
      };
      const result = evaluateKimMilestone({
        persona: 'kim',
        intakeCompleted: true,
        homeOpenedAt: nowIso,
        homeOpenSessionId: sessionId,
        selfCareHistory: (userDat as any)?.selfCareHistory ?? [],
        milestoneState,
      });
      if (result.status === 'ACTIVE' && result.eligibleMilestone) {
        setActiveMilestone(result.eligibleMilestone);
      }
    }
  }, [state.isLoading, state.intakeCompleted, state.userType, userDat?.sobrietyDate]);

  if (state.isLoading || !state.intakeCompleted) {
    return (
      <ScreenContainer containerClassName="bg-backgroundWarm">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: dc.textMuted, fontSize: 16 }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const isElias = state.userType === 'elias';
  const companionName = isElias ? 'Elias' : 'Kim';
  const sliderConfig = getSliderConfig(state.userType ?? 'elias');
  const isClinicalActive = userDat?.clinicalModeActive ?? false;

  // Sober counter (Elias only, when sobrietyDate is set)
  const sobrietyDays = (() => {
    if (!isElias || !userDat?.sobrietyDate) return null;
    return Math.floor(
      (Date.now() - new Date(userDat.sobrietyDate).getTime()) / 86400000
    );
  })();

  const handleStartChat = () => {
    router.push('/(tabs)/chat' as Href);
  };

  return (
    <ScreenContainer containerClassName="bg-backgroundWarm">
      <ScrollView
        contentContainerStyle={{ paddingTop: spacing.screenTop, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        style={{ paddingHorizontal: spacing.screenHorizontal }}
      >
        {/* Header */}
        <View style={{ marginBottom: spacing.lg }}>
          <Pressable onPress={handleCompanionNameTap}>
            <Text style={styles.greeting}>
              {getTimeGreeting()}, {fixUnicode(userName)}
            </Text>
          </Pressable>
          <Text style={styles.subtitle}>
            {getSubtitle(isElias, mood)}
          </Text>
          {isClinicalActive && (
            <Pressable onPress={() => setShowClinicalModal(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dc.success, marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: dc.success, fontWeight: '700', letterSpacing: 0.5 }}>
                  CLINICAL MODE
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Milestone Card (inline, above hero) */}
        {activeMilestone && (
          <MilestoneCard
            persona={activeMilestone.persona}
            milestoneId={activeMilestone.milestoneId}
            title={activeMilestone.title}
            message={activeMilestone.message}
            ctaLabel={activeMilestone.ctaLabel}
            accentColor={activeMilestone.accentColor}
            softBackgroundColor={activeMilestone.softBackgroundColor}
            onAcknowledge={handleDismissMilestone}
          />
        )}

        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: isElias ? dc.surfaceBlue : dc.surfaceKim }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>
                {companionName} is here.
              </Text>
              <Text style={styles.heroBody}>
                {isElias
                  ? 'Start with what is true right now.'
                  : 'Start with what you are carrying.'}
              </Text>
              <Pressable
                onPress={handleStartChat}
                style={({ pressed }) => [
                  isElias ? styles.ctaElias : styles.ctaKim,
                  { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }], marginTop: 16 },
                ]}
              >
                <Text style={styles.ctaText}>
                  Talk to {companionName}
                </Text>
              </Pressable>
            </View>
            <Image
              source={isElias
                ? require('../../assets/images/elias_avatar.jpg')
                : require('../../assets/images/kim_avatar.jpg')
              }
              style={styles.heroAvatar}
            />
          </View>
        </View>

        {/* Sober Counter Card (Elias only) */}
        {isElias && sobrietyDays !== null && (
          <View style={styles.soberCard}>
            <Text style={styles.soberDays}>
              {sobrietyDays}
            </Text>
            <Text style={styles.soberLabel}>
              {sobrietyDays === 1 ? 'day since last use' : 'days since last use'}
            </Text>
            <Text style={styles.soberMessage}>
              {getSoberMessage(sobrietyDays)}
            </Text>
          </View>
        )}

        {/* Prompt to set sobriety date (Elias only, no date set yet) */}
        {isElias && sobrietyDays === null && (
          <Pressable
            onPress={() => router.push('/(tabs)/profile' as Href)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.promptCard}>
              <Text style={{ fontSize: 15, color: dc.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                Set your sobriety date to start tracking your progress
              </Text>
              <Text style={{ fontSize: 14, color: dc.primary, fontWeight: '600', marginTop: 10 }}>
                Go to Profile →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Mood Summary */}
        <View style={{ marginBottom: spacing.sectionGap }}>
          <Text style={styles.sectionTitle}>How is your system today?</Text>
          <View style={styles.moodRow}>
            {sliderConfig.map((slider) => {
              const value = (mood as any)[slider.key] ?? 0;
              return (
                <MoodMini
                  key={slider.key}
                  label={slider.label}
                  value={value}
                  max={slider.max}
                  invert={slider.key !== 'focus' && slider.key !== 'selfCare'}
                />
              );
            })}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ marginBottom: spacing.sectionGap }}>
          <Pressable
            onPress={() => router.push('/(tabs)/diary' as Href)}
            style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.actionTitle}>Write one honest sentence</Text>
            <Text style={styles.actionBody}>Your diary is waiting.</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/backpack' as Href)}
            style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.85 : 1, marginTop: spacing.cardGap }]}
          >
            <Text style={styles.actionTitle}>Open your Backpack</Text>
            <Text style={styles.actionBody}>Your life story is your identity anchor.</Text>
          </Pressable>
        </View>
      </ScrollView>



      {/* Clinical Mode Modal */}
      <Modal visible={showClinicalModal} transparent animationType="fade" onRequestClose={() => setShowClinicalModal(false)}>
        <Pressable
          onPress={() => setShowClinicalModal(false)}
          style={{ flex: 1, backgroundColor: dc.overlay, justifyContent: 'center', alignItems: 'center' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={styles.modalCard}
          >
            <Text style={{ ...typography.titleSmall, color: dc.textPrimary, marginBottom: 14 }}>
              {isClinicalActive ? 'Disable Clinical Mode?' : 'Enable Clinical Mode?'}
            </Text>
            <Text style={{ ...typography.bodySmall, color: dc.textSecondary, lineHeight: 21, marginBottom: 24 }}>
              {isClinicalActive
                ? 'Clinical annotations will be hidden and standard restrictions will be restored.'
                : 'This mode is intended for clinical demonstration only. Elias and Kim will provide therapeutic annotations and operate without standard restrictions.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowClinicalModal(false)}
                style={({ pressed }) => [{
                  flex: 1,
                  ...buttonStyles.secondary,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ fontWeight: '600', color: dc.textPrimary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={isClinicalActive ? handleDisableClinical : handleEnableClinical}
                style={({ pressed }) => [{
                  flex: 1,
                  ...(isClinicalActive ? { ...buttonStyles.primaryElias, backgroundColor: dc.danger } : buttonStyles.primaryElias),
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ fontWeight: '700', color: dc.textInverse, fontSize: 15 }}>
                  {isClinicalActive ? 'Disable' : 'Enable'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: {
    ...typography.displayMedium,
    color: dc.textPrimary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: dc.textSecondary,
    marginTop: 6,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.sectionGap,
    minHeight: 176,
    borderWidth: 1,
    borderColor: dc.borderSoft,
  },
  heroTitle: {
    ...typography.titleMedium,
    color: dc.textPrimary,
    marginBottom: 6,
  },
  heroBody: {
    ...typography.bodyMedium,
    color: dc.textSecondary,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginLeft: 16,
  },
  ctaElias: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: dc.eliasAccent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  ctaKim: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: dc.kimAccent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  ctaText: {
    ...typography.button,
    color: dc.textInverse,
  },
  soberCard: {
    ...cardStyles.elias,
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: spacing.sectionGap,
  },
  soberDays: {
    fontSize: 48,
    fontWeight: '800',
    color: dc.primary,
    letterSpacing: -2,
  },
  soberLabel: {
    ...typography.bodyMedium,
    color: dc.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  soberMessage: {
    ...typography.bodySmall,
    color: dc.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  promptCard: {
    ...cardStyles.default,
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: dc.textPrimary,
    marginBottom: spacing.sm,
  },
  moodRow: {
    ...cardStyles.default,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  actionCard: {
    ...cardStyles.default,
  },
  actionTitle: {
    ...typography.bodyLarge,
    color: dc.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionBody: {
    ...typography.bodySmall,
    color: dc.textSecondary,
  },
  modalCard: {
    backgroundColor: dc.surface,
    borderRadius: radius.xl,
    padding: 28,
    width: '88%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.medium,
  },
});

function getSoberMessage(days: number): string {
  if (days === 0) return 'Today is day zero. Tomorrow is day one.';
  if (days === 1) return 'The hardest day. You showed up.';
  if (days < 7) return 'Every single day counts. Keep going.';
  if (days < 14) return 'One week behind you. You chose yourself.';
  if (days < 30) return 'Building momentum.\nThis is you, doing the work.';
  if (days < 60) return 'A month of choosing yourself, every single day.';
  if (days < 90) return 'Two months. The fog is lifting.';
  if (days < 180) return 'This is real. You rebuilt something.';
  if (days < 365) return 'Half a year of showing up. Look how far you came.';
  return 'One year and beyond. Remember who you were. Look who you are now.';
}

function MoodMini({ label, value, max = 10, invert = false }: { label: string; value: number; max?: number; invert?: boolean }) {
  const displayValue = Math.round(value);
  const normalized = invert ? max - value : value;
  const ratio = normalized / max;
  const dotColor = ratio >= 0.7 ? dc.moodGreen : ratio >= 0.4 ? dc.moodYellow : dc.moodRed;

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginRight: 4 }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: dc.textPrimary }}>
          {displayValue}
        </Text>
      </View>
      <Text style={{ ...typography.micro, color: dc.textTertiary, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Still here';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getSubtitle(isElias: boolean, mood: any): string {
  if (isElias) {
    const craving = mood?.craving ?? 0;
    if (craving > 7) return 'First we slow the moment down.';
    if (craving > 4) return 'We keep it small today.';
    return 'What do you want to protect today?';
  }
  return 'You do not have to carry everything at once.';
}
