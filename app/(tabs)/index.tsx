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
import { useTranslation } from '@/lib/i18n';
import { LocalDeviceTimeService } from "@/lib/core/time";
// Day Structure moved to its own tab (day-planning)

export default function HomeScreen() {
  const router = useRouter();
  const { state, getUserName, getMood, getUserDat, updateMilestoneShown, toggleClinicalMode } = useUser();
  const colors = useColors();
  const { t } = useTranslation();
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
    const nowIso = LocalDeviceTimeService.now().utcIso;
    const sessionId = `home_${LocalDeviceTimeService.now().epochMs}`;

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
        updateMilestoneShown(LocalDeviceTimeService.now().utcIso.slice(0, 10));
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
          <Text style={{ color: dc.textMuted, fontSize: 16 }}>{t('home.loading')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const isElias = state.userType === 'elias';
  const companionName = isElias ? 'Elias' : 'Kim';
  const isClinicalActive = userDat?.clinicalModeActive ?? false;

  // Sober counter (Elias only, when sobrietyDate is set)
  const sobrietyDays = (() => {
    if (!isElias || !userDat?.sobrietyDate) return null;
    return Math.floor(
      (LocalDeviceTimeService.now().epochMs - new Date(userDat.sobrietyDate).getTime()) / 86400000
    );
  })();

  return (
    <ScreenContainer containerClassName="bg-backgroundWarm">
      <ScrollView
        contentContainerStyle={{ paddingTop: spacing.screenTop, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        style={{ paddingHorizontal: spacing.screenHorizontal }}
      >
        {/* Header with greeting */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Pressable onPress={handleCompanionNameTap}>
              <Text style={styles.greeting}>
                {getTimeGreeting(t)}, {fixUnicode(userName)}
              </Text>
            </Pressable>
            <Text style={styles.subtitle}>
              {getSubtitle(isElias, mood, t)}
            </Text>
            {isClinicalActive && (
              <Pressable onPress={() => setShowClinicalModal(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dc.success, marginRight: 6 }} />
                  <Text style={{ fontSize: 11, color: dc.success, fontWeight: '700', letterSpacing: 0.5 }}>
                    {t('home.clinical_mode.badge')}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Milestone Card */}
        {activeMilestone && (
          <MilestoneCard
            persona={activeMilestone.persona}
            milestoneId={activeMilestone.milestoneId}
            title={t(`${activeMilestone.i18nKey}.title`)}
            message={t(`${activeMilestone.i18nKey}.message`)}
            ctaLabel={t(`${activeMilestone.i18nKey}.cta`)}
            accentColor={activeMilestone.accentColor}
            softBackgroundColor={activeMilestone.softBackgroundColor}
            onAcknowledge={handleDismissMilestone}
          />
        )}

        {/* Sobriety Counter Card (Elias only) */}
        {isElias && sobrietyDays !== null && (
          <View style={styles.soberCard}>
            <View style={styles.soberCircle}>
              <Text style={styles.soberDaysNumber}>{sobrietyDays}</Text>
              <Text style={styles.soberDaysLabel}>{t('home.sober_counter.days_label')}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 20 }}>
              <Text style={styles.soberTitle}>
                {t('home.sober_counter.title', { sobrietyDays: String(sobrietyDays) })}
              </Text>
              <Text style={styles.soberMessage}>
                {getSoberMessage(sobrietyDays, t)}
              </Text>
              <View style={styles.soberCta}>
                <Text style={{ fontSize: 14, color: dc.primary, fontWeight: '600' }}>
                  {t('home.sober_counter.cta', { userName: fixUnicode(userName) })}
                </Text>
              </View>
            </View>
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
                {t('home.prompt.set_sobriety_date')}
              </Text>
              <Text style={{ fontSize: 14, color: dc.primary, fontWeight: '600', marginTop: 10 }}>
                {t('home.prompt.go_to_profile')}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Two cards side by side: Mood + Chat */}
        <View style={styles.dualRow}>
          {/* Mood Card */}
          <Pressable
            onPress={() => router.push('/(tabs)/mood' as Href)}
            style={({ pressed }) => [styles.dualCard, styles.dualCardLeft, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.dualCardIcon}>
              <Text style={{ fontSize: 28 }}>{t('home.mood_card.icon')}</Text>
            </View>
            <Text style={styles.dualCardTitle}>{t('home.mood_card.title')}</Text>
            <Text style={styles.dualCardBody}>{t('home.mood_card.body')}</Text>
            <View style={[styles.dualCardCta, { backgroundColor: dc.success }]}>
              <Text style={styles.dualCardCtaText}>{t('home.mood_card.cta')}</Text>
            </View>
          </Pressable>

          {/* Chat Card */}
          <Pressable
            onPress={() => router.push('/(tabs)/chat' as Href)}
            style={({ pressed }) => [styles.dualCard, styles.dualCardRight, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Image
              source={isElias
                ? require('../../assets/images/elias_avatar.jpg')
                : require('../../assets/images/kim_avatar.jpg')
              }
              style={styles.dualCardAvatar}
            />
            <Text style={styles.dualCardTitle}>{t('home.chat_card.title', { companionName })}</Text>
            <Text style={styles.dualCardBody}>{t('home.chat_card.body')}</Text>
            <View style={[styles.dualCardCta, { backgroundColor: dc.eliasAccent }]}>
              <Text style={styles.dualCardCtaText}>{t('home.chat_card.cta', { companionName })}</Text>
            </View>
          </Pressable>
        </View>

        {/* My Diary Card */}
        <Pressable
          onPress={() => router.push('/(tabs)/diary' as Href)}
          style={({ pressed }) => [styles.navCard, { backgroundColor: dc.diaryAccentSoft, borderColor: dc.secondaryMuted, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.navCardIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={{ fontSize: 22 }}>{t('home.diary_card.icon')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>{t('home.diary_card.title')}</Text>
            <Text style={styles.navCardBody}>{t('home.diary_card.body')}</Text>
            <Text style={[styles.navCardCta, { color: dc.diaryAccent }]}>{t('home.diary_card.cta')}</Text>
          </View>
                    <Text style={styles.navCardChevron}>{t('home.diary_card.chevron')}</Text>
        </Pressable>
        {/* My Backpack Card */}
        <Pressable
          onPress={() => router.push('/(tabs)/backpack' as Href)}
          style={({ pressed }) => [styles.navCard, { backgroundColor: dc.backpackAccentSoft, borderColor: dc.eliasAccentMuted, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.navCardIcon, { backgroundColor: '#E8E0F0' }]}>
            <Text style={{ fontSize: 22 }}>{t('home.backpack_card.icon')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>{t('home.backpack_card.title')}</Text>
            <Text style={styles.navCardBody}>{t('home.backpack_card.body')}</Text>
            <Text style={[styles.navCardCta, { color: dc.backpackAccent }]}>{t('home.backpack_card.cta')}</Text>
          </View>
                    <Text style={styles.navCardChevron}>{t('home.backpack_card.chevron')}</Text>
        </Pressable>
        {/* Day Planning Card */}
        <Pressable
          onPress={() => router.push('/(tabs)/day-planning' as Href)}
          style={({ pressed }) => [styles.navCard, { backgroundColor: '#E3F2FD', borderColor: dc.borderSoft, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.navCardIcon, { backgroundColor: '#BBDEFB' }]}>
            <Text style={{ fontSize: 22 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>{t('dayStructure.tab.title')}</Text>
            <Text style={styles.navCardBody}>{t('dayStructure.tab.body')}</Text>
          </View>
          <Text style={styles.navCardChevron}>›</Text>
        </Pressable>
        {/* My Profile Card */}
        <Pressable
          onPress={() => router.push('/(tabs)/profile' as Href)}
          style={({ pressed }) => [styles.navCard, { backgroundColor: dc.surface, borderColor: dc.borderSoft, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.navCardIcon, { backgroundColor: dc.backgroundWarm }]}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: dc.textSecondary }}>
              {(userName ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>{t('home.profile_card.title')}</Text>
            <Text style={styles.navCardBody}>{t('home.profile_card.body')}</Text>
          </View>
          <Text style={styles.navCardChevron}>{t('home.profile_card.chevron')}</Text>
        </Pressable>
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
              {isClinicalActive ? t('home.clinical_modal.title_disable') : t('home.clinical_modal.title_enable')}
            </Text>
            <Text style={{ ...typography.bodySmall, color: dc.textSecondary, lineHeight: 21, marginBottom: 24 }}>
              {isClinicalActive
                ? t('home.clinical_modal.body_disable')
                : t('home.clinical_modal.body_enable')}
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
                <Text style={{ fontWeight: '600', color: dc.textPrimary, fontSize: 15 }}>{t('home.clinical_modal.cancel')}</Text>
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
                  {isClinicalActive ? t('home.clinical_modal.confirm_disable') : t('home.clinical_modal.confirm_enable')}
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

  // Sobriety card
  soberCard: {
    ...cardStyles.large,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  soberCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: dc.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dc.surface,
  },
  soberDaysNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: dc.primary,
    letterSpacing: -1,
  },
  soberDaysLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: dc.primary,
    marginTop: -2,
  },
  soberTitle: {
    ...typography.titleSmall,
    color: dc.textPrimary,
    marginBottom: 4,
  },
  soberMessage: {
    ...typography.bodySmall,
    color: dc.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  soberCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: dc.primarySoft,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  promptCard: {
    ...cardStyles.default,
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  // Dual card row (Mood + Chat)
  dualRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: spacing.sectionGap,
  },
  dualCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    ...shadows.soft,
  },
  dualCardLeft: {
    backgroundColor: dc.moodGreenSoft,
    borderColor: dc.secondaryMuted,
  },
  dualCardRight: {
    backgroundColor: dc.eliasAccentSoft,
    borderColor: dc.eliasAccentMuted,
  },
  dualCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: dc.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dualCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
  },
  dualCardTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: dc.textPrimary,
    marginBottom: 4,
  },
  dualCardBody: {
    ...typography.bodySmall,
    color: dc.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  dualCardCta: {
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  dualCardCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: dc.textInverse,
  },
  // Full-width nav cards
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    marginBottom: spacing.cardGap,
    ...shadows.soft,
  },
  navCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navCardTitle: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: dc.textPrimary,
    marginBottom: 2,
  },
  navCardBody: {
    ...typography.bodySmall,
    color: dc.textSecondary,
    lineHeight: 19,
  },
  navCardCta: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  navCardChevron: {
    fontSize: 28,
    color: dc.textTertiary,
    fontWeight: '300',
    marginLeft: 8,
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

function getSoberMessage(days: number, t: (key: string) => string): string {
  if (days === 0) return t('home.sober_message.0');
  if (days === 1) return t('home.sober_message.1');
  if (days < 7) return t('home.sober_message.7');
  if (days < 14) return t('home.sober_message.14');
  if (days < 30) return t('home.sober_message.30');
  if (days < 60) return t('home.sober_message.60');
  if (days < 90) return t('home.sober_message.90');
  if (days < 180) return t('home.sober_message.180');
  if (days < 365) return t('home.sober_message.365');
  return t('home.sober_message.beyond');
}

function getTimeGreeting(t: (key: string) => string): string {
  const hour = LocalDeviceTimeService.getCurrentLocalHour();
  if (hour < 6) return t('home.greeting.still_here');
  if (hour < 12) return t('home.greeting.morning');
  if (hour < 18) return t('home.greeting.afternoon');
  return t('home.greeting.evening');
}

function getSubtitle(isElias: boolean, mood: any, t: (key: string) => string): string {
  if (isElias) {
    const craving = mood?.craving ?? 0;
    if (craving > 7) return t('home.subtitle.elias.craving_high');
    if (craving > 4) return t('home.subtitle.elias.craving_med');
    return t('home.subtitle.elias.default');
  }
  return t('home.subtitle.kim.default');
}
