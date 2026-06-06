import { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, Text, View, Pressable, Modal, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { getSliderConfig } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { state, getUserName, getMood, getUserDat, updateMilestoneShown, toggleClinicalMode } = useUser();
  const colors = useColors();
  const userName = getUserName();
  const mood = getMood();
  const userDat = getUserDat();
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
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
    setMilestoneMessage(null);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  useEffect(() => {
    if (!state.isLoading && !state.intakeCompleted) {
      router.replace('/intake' as Href);
    }
  }, [state.isLoading, state.intakeCompleted]);

  // Milestone check (Elias only)
  useEffect(() => {
    if (state.isLoading || !state.intakeCompleted) return;
    if (state.userType !== 'elias') return;
    const sobrietyDate = userDat?.sobrietyDate;
    if (!sobrietyDate) return;

    const days = Math.floor(
      (Date.now() - new Date(sobrietyDate).getTime()) / 86400000
    );
    const MILESTONES: Record<number, string> = {
      1: 'Day 1. The hardest one. You showed up.',
      7: '7 days. One week of choosing yourself.',
      30: '30 days. A month of showing up every day.',
      90: '90 days. This is real.',
      180: 'Half a year. You rebuilt something.',
      365: 'One year. Remember who you were. Look who you are now.',
    };

    const today = new Date().toISOString().slice(0, 10);
    const lastShown = userDat?.lastMilestoneShown ?? null;
    if (MILESTONES[days] && lastShown !== today) {
      setMilestoneMessage(MILESTONES[days]);
      updateMilestoneShown(today);
    }
  }, [state.isLoading, state.intakeCompleted, state.userType, userDat?.sobrietyDate, userDat?.lastMilestoneShown]);

  if (state.isLoading || !state.intakeCompleted) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted text-base">Loading...</Text>
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
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-5">
          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>
            {getTimeGreeting()}, {fixUnicode(userName)}
          </Text>
          <Pressable onPress={handleCompanionNameTap}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>
              {companionName} is here for you
            </Text>
          </Pressable>
          {isClinicalActive && (
            <Pressable onPress={() => setShowClinicalModal(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700', letterSpacing: 0.5 }}>
                  CLINICAL MODE
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Sober Counter Card (Elias only) */}
        {isElias && sobrietyDays !== null && (
          <View
            style={{
              borderRadius: 24,
              marginBottom: 20,
              alignItems: 'center',
              paddingVertical: 32,
              paddingHorizontal: 24,
              backgroundColor: '#E3F2FD',
            }}
          >
            <Text style={{ fontSize: 56, fontWeight: '800', color: colors.primary, letterSpacing: -2 }}>
              {sobrietyDays}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary, marginTop: 2 }}>
              {sobrietyDays === 1 ? 'day clean' : 'days clean'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 12, textAlign: 'center', lineHeight: 18 }}>
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
            <View
              style={{
                borderRadius: 20,
                marginBottom: 20,
                alignItems: 'center',
                paddingVertical: 24,
                paddingHorizontal: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
                Set your sobriety date to start tracking your progress
              </Text>
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 8 }}>
                Go to Profile →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Greeting Bubble */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
            <IconSymbol name="heart.fill" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>
              {getGreeting(userName, companionName, isElias)}
            </Text>
          </View>
        </View>

        {/* Mood Summary Row */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 12, letterSpacing: 0.5 }}>
            YOUR MOOD
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {sliderConfig.map((slider) => {
              const value = (mood as any)[slider.key] ?? 0;
              return (
                <MoodMini
                  key={slider.key}
                  label={slider.label}
                  value={value}
                  max={slider.max}
                  invert={slider.key !== 'focus' && slider.key !== 'selfCare'}
                  primaryColor={colors.primary}
                />
              );
            })}
          </View>
        </View>

        {/* Start Conversation CTA */}
        <Pressable
          onPress={handleStartChat}
          style={({ pressed }) => [{
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          }]}
        >
          <View style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconSymbol name="bubble.left.fill" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              Start conversation with {companionName}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Milestone Modal */}
      {milestoneMessage && (
        <Modal visible transparent animationType="fade" onRequestClose={handleDismissMilestone}>
          <Pressable
            onPress={handleDismissMilestone}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          >
            <View style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 32,
              width: '85%',
              maxWidth: 320,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>{"\u{1F389}"}</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground, textAlign: 'center', lineHeight: 24 }}>
                {milestoneMessage}
              </Text>
              <Pressable
                onPress={handleDismissMilestone}
                style={({ pressed }) => [{
                  marginTop: 24,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Thank you</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Clinical Mode Modal */}
      <Modal visible={showClinicalModal} transparent animationType="fade" onRequestClose={() => setShowClinicalModal(false)}>
        <Pressable
          onPress={() => setShowClinicalModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 28,
              width: '88%',
              maxWidth: 340,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 14 }}>
              {isClinicalActive ? 'Disable Clinical Mode?' : 'Enable Clinical Mode?'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 24 }}>
              {isClinicalActive
                ? 'Clinical annotations will be hidden and standard restrictions will be restored.'
                : 'This mode is intended for clinical demonstration only. Elias and Kim will provide therapeutic annotations and operate without standard restrictions.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowClinicalModal(false)}
                style={({ pressed }) => [{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center' as const,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ fontWeight: '600', color: colors.foreground, fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={isClinicalActive ? handleDisableClinical : handleEnableClinical}
                style={({ pressed }) => [{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center' as const,
                  backgroundColor: isClinicalActive ? colors.error : colors.primary,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>
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

function MoodMini({ label, value, max = 10, invert = false, primaryColor }: { label: string; value: number; max?: number; invert?: boolean; primaryColor: string }) {
  const displayValue = Math.round(value);
  const normalized = invert ? max - value : value;
  const ratio = normalized / max;
  const dotColor = ratio >= 0.7 ? '#10B981' : ratio >= 0.4 ? '#F59E0B' : '#EF4444';

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginRight: 4 }} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: primaryColor }}>
          {displayValue}
        </Text>
      </View>
      <Text style={{ fontSize: 10, color: '#6B7280', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getGreeting(userName: string, companion: string, isElias: boolean): string {
  const greetings = isElias
    ? [
        `${userName}, good that you stopped by. I'm here whenever you need me.`,
        `Hey ${userName}, glad you're here. How are you feeling today?`,
        `Welcome back, ${userName}. Take a moment to just be with yourself.`,
      ]
    : [
        `Hello ${userName}, good that you're taking some time for yourself.`,
        `Welcome back, ${userName}. How are you doing — not the other person, but you?`,
        `${userName}, glad you're here. Remember: you matter too.`,
      ];

  const index = new Date().getDate() % greetings.length;
  return greetings[index];
}
