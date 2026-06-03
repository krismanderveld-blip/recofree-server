import { useEffect, useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Modal, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { getSliderConfig } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  const { state, startSession, getUserName, getMood, getUserDat, updateMilestoneShown } = useUser();
  const colors = useColors();
  const userName = getUserName();
  const mood = getMood();
  const userDat = getUserDat();
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);

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
      90: '90 days. \u{1F499} This is real.',
      180: 'Half a year. You rebuilt something.',
      365: 'One year. \u{1F525} Remember who you were. Look who you are now.',
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
  const greeting = getGreeting(userName, companionName, isElias);
  const sliderConfig = getSliderConfig(state.userType ?? 'elias');

  // Sober counter (Elias only, when sobrietyDate is set)
  const sobrietyDays = (() => {
    if (!isElias || !userDat?.sobrietyDate) return null;
    return Math.floor(
      (Date.now() - new Date(userDat.sobrietyDate).getTime()) / 86400000
    );
  })();

  const handleStartChat = () => {
    startSession();
    router.push('/(tabs)/chat' as Href);
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-sm text-muted mb-1">
            {getTimeGreeting()}, {userName}
          </Text>
          <Text className="text-2xl font-bold text-foreground">
            {companionName} is here for you
          </Text>
        </View>

        {/* Prominent Sober Counter (Elias only) */}
        {isElias && sobrietyDays !== null && (
          <View
            className="rounded-3xl mb-6 items-center py-8 px-6"
            style={{
              backgroundColor: colors.primary + '12',
              borderWidth: 1.5,
              borderColor: colors.primary + '30',
            }}
          >
            <Text style={{ fontSize: 52, fontWeight: '800', color: colors.primary, letterSpacing: -1 }}>
              {sobrietyDays}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary, marginTop: 2, opacity: 0.85 }}>
              {sobrietyDays === 1 ? 'day clean' : 'days clean'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 10, textAlign: 'center', lineHeight: 18 }}>
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
              className="rounded-2xl mb-6 items-center py-5 px-5"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 }}>
                Set your sobriety date to start tracking your progress
              </Text>
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 8 }}>
                Go to Profile →
              </Text>
            </View>
          </Pressable>
        )}

        {/* Greeting Card */}
        <View className="bg-surface rounded-2xl p-5 mb-5 border border-border">
          <Text className="text-base text-foreground leading-relaxed">
            {greeting}
          </Text>
        </View>

        {/* Mood Summary — dynamic based on userType */}
        <View className="bg-surface rounded-2xl p-5 mb-5 border border-border">
          <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
            Your mood
          </Text>
          <View className="flex-row justify-between">
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
        <View className="gap-3">
          <Pressable
            onPress={handleStartChat}
            style={({ pressed }) => [
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View className="bg-primary rounded-2xl p-4 items-center">
              <Text className="text-background font-bold text-base">
                Start conversation with {companionName}
              </Text>
            </View>
          </Pressable>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push('/(tabs)/mood' as Href)}
              className="flex-1"
              style={({ pressed }) => [
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border items-center">
                <IconSymbol name="chart.bar.fill" size={28} color={colors.primary} />
                <Text className="text-foreground font-semibold mt-2 text-sm">Mood</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/diary' as Href)}
              className="flex-1"
              style={({ pressed }) => [
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View className="bg-surface rounded-2xl p-4 border border-border items-center">
                <IconSymbol name="book.fill" size={28} color={colors.primary} />
                <Text className="text-foreground font-semibold mt-2 text-sm">Diary</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Daily Insight */}
        <View className="bg-surface rounded-2xl p-5 mt-5 border border-border">
          <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
            Today's insight
          </Text>
          <Text className="text-base text-foreground leading-relaxed italic">
            {isElias
              ? '"Recovery is not a straight line. Every step counts, even the small ones."'
              : '"Taking care of yourself is not selfish. It\'s necessary."'}
          </Text>
        </View>
      </ScrollView>

      {/* Milestone Modal (Elias only) */}
      {milestoneMessage && (
        <Modal visible transparent animationType="fade" onRequestClose={handleDismissMilestone}>
          <Pressable
            onPress={handleDismissMilestone}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 20,
                padding: 32,
                width: '85%',
                maxWidth: 320,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
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
    </ScreenContainer>
  );
}

function getSoberMessage(days: number): string {
  if (days === 0) return 'Today is day zero. Tomorrow is day one.';
  if (days === 1) return 'The hardest day. You showed up.';
  if (days < 7) return 'Every single day counts. Keep going.';
  if (days < 14) return 'One week behind you. You chose yourself.';
  if (days < 30) return 'Building momentum. This is you, doing the work.';
  if (days < 60) return 'A month of choosing yourself, every single day.';
  if (days < 90) return 'Two months. The fog is lifting.';
  if (days < 180) return 'This is real. You rebuilt something.';
  if (days < 365) return 'Half a year of showing up. Look how far you came.';
  return 'One year and beyond. Remember who you were. Look who you are now.';
}

function MoodMini({ label, value, max = 7, invert = false }: { label: string; value: number; max?: number; invert?: boolean }) {
  const displayValue = Math.round(value);
  const normalized = invert ? max - value : value;
  const ratio = normalized / max;
  const color = ratio >= 0.7 ? '#10B981' : ratio >= 0.4 ? '#F59E0B' : '#EF4444';

  return (
    <View className="items-center flex-1">
      <Text className="text-2xl font-bold" style={{ color }}>
        {displayValue}
      </Text>
      <Text className="text-xs text-muted mt-1 text-center">{label}</Text>
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
        `Hey ${userName}, glad you're here. How are you feeling today?`,
        `Welcome back, ${userName}. Take a moment to just be with yourself.`,
        `${userName}, good that you stopped by. I'm here whenever you need me.`,
      ]
    : [
        `Hello ${userName}, good that you're taking some time for yourself.`,
        `Welcome back, ${userName}. How are you doing — not the other person, but you?`,
        `${userName}, glad you're here. Remember: you matter too.`,
      ];

  const index = new Date().getDate() % greetings.length;
  return greetings[index];
}
