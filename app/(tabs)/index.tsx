import { useEffect } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export default function HomeScreen() {
  const router = useRouter();
  const { state, startSession, getUserName, getMood } = useUser();
  const colors = useColors();

  const userName = getUserName();
  const mood = getMood();

  // Redirect to intake if not completed
  useEffect(() => {
    if (!state.isLoading && !state.intakeCompleted) {
      router.replace('/intake' as Href);
    }
  }, [state.isLoading, state.intakeCompleted]);

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

  const handleStartChat = () => {
    startSession();
    router.push('/(tabs)/chat' as Href);
  };

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-sm text-muted mb-1">
            {getTimeGreeting()}, {userName}
          </Text>
          <Text className="text-2xl font-bold text-foreground">
            {companionName} is here for you
          </Text>
        </View>

        {/* Greeting Card */}
        <View className="bg-surface rounded-2xl p-5 mb-5 border border-border">
          <Text className="text-base text-foreground leading-relaxed">
            {greeting}
          </Text>
        </View>

        {/* Mood Summary — reads from Rugzak */}
        <View className="bg-surface rounded-2xl p-5 mb-5 border border-border">
          <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
            Your mood
          </Text>
          <View className="flex-row justify-between">
            <MoodMini label="Mood" value={mood.stemming} />
            <MoodMini label="Craving" value={mood.craving} invert />
            <MoodMini label="Stimuli" value={mood.overprikkeling} invert />
            <MoodMini label="Social" value={mood.sociaal} />
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
            <View className="bg-primary rounded-2xl p-5 flex-row items-center">
              <IconSymbol name="bubble.left.fill" size={24} color="#FFFFFF" />
              <View className="ml-4 flex-1">
                <Text className="text-white text-lg font-bold">Start Chat</Text>
                <Text className="text-white/70 text-sm">
                  Talk to {companionName}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
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
    </ScreenContainer>
  );
}

function MoodMini({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const displayValue = Math.round(value);
  const normalizedValue = invert ? 10 - value : value;
  const color = normalizedValue >= 7 ? '#43A047' : normalizedValue >= 4 ? '#FB8C00' : '#E53935';

  return (
    <View className="items-center">
      <Text className="text-2xl font-bold" style={{ color }}>
        {displayValue}
      </Text>
      <Text className="text-xs text-muted mt-1">{label}</Text>
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
