import { useCallback, useRef, useState } from 'react';
import { Text, View, ScrollView, Pressable, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { GUIDANCE_DEPTH_OPTIONS } from '@/lib/ai/types';
import type { GuidanceDepth } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

const STAGE_LABELS: Record<string, string> = {
  precontemplation: 'Precontemplation',
  contemplation: 'Contemplation',
  preparation: 'Preparation',
  action: 'Action',
  maintenance: 'Maintenance',
};

// Use the version from app.config.ts (via expo-constants) for consistency with publish page
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileScreen() {
  const { state, getUserName, getBackpack, getUserDat, updateGuidanceDepth, getGuidanceDepth } = useUser();
  const colors = useColors();
  const router = useRouter();
  const userName = getUserName();
  const backpack = getBackpack();
  const userDat = getUserDat();
  const currentDepth = getGuidanceDepth();

  const isElias = state.userType === 'elias';
  const companionName = isElias ? 'Elias' : 'Kim';
  const userTypeLabel = isElias ? 'Personal recovery' : 'Supporting a loved one';
  const stageOfChange = userDat?.stageOfChange ?? 'contemplation';
  const totalSessions = userDat?.totalSessions ?? 0;
  const moodCheckIns = userDat?.moodHistory?.length ?? 0;


  // 5-tap activation for debug screen
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleVersionTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current > 2000) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push('/dev/debug-log' as any);
    }
  }, [router]);

  const handleDepthChange = useCallback(async (depth: GuidanceDepth) => {
    await updateGuidanceDepth(depth);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [updateGuidanceDepth]);

  const handleResetData = useCallback(() => {
    const doReset = async () => {
      try {
        await AsyncStorage.clear();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        if (Platform.OS === 'web') {
          window.location.reload();
        } else {
          Alert.alert('Data Cleared', 'All data has been reset. Please restart the app.', [{ text: 'OK' }]);
        }
      } catch (e) {
        console.error('[Profile] Reset failed:', e);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        doReset();
      }
    } else {
      Alert.alert(
        'Reset All Data',
        'This will permanently delete all your data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: doReset },
        ],
      );
    }
  }, []);

  return (
    <ScreenContainer className="px-5 pt-2">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">Profile</Text>
        </View>

        {/* User Card */}
        <View className="bg-surface rounded-2xl p-5 mb-4 border border-border">
          <View className="flex-row items-center gap-4">
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary + '20' }}
            >
              <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                {userName ? userName.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground">{userName || 'User'}</Text>
              <Text className="text-sm text-muted mt-0.5">{userTypeLabel}</Text>
              <Text className="text-xs text-muted mt-0.5">
                {companionName}{isElias ? ` · ${STAGE_LABELS[stageOfChange] ?? stageOfChange}` : ''} · {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {moodCheckIns} check-in{moodCheckIns !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Guidance Depth ─── */}
        <View className="bg-surface rounded-2xl p-5 mb-4 border border-border">
          <Text className="text-sm font-semibold text-muted mb-1 uppercase tracking-wide">
            Guidance Depth
          </Text>
          <Text className="text-xs text-muted mb-4">
            Choose how intensely the conversation goes. You can change this anytime.
          </Text>

          <View className="gap-2">
            {GUIDANCE_DEPTH_OPTIONS.map((option) => {
              const isActive = option.value === currentDepth;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleDepthChange(option.value)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View
                    className="rounded-xl p-4 flex-row items-center gap-3"
                    style={{
                      backgroundColor: isActive ? colors.primary + '12' : 'transparent',
                      borderWidth: 1,
                      borderColor: isActive ? colors.primary + '40' : colors.border,
                    }}
                  >
                    <View
                      className="w-5 h-5 rounded-full items-center justify-center"
                      style={{
                        borderWidth: 2,
                        borderColor: isActive ? colors.primary : colors.border,
                        backgroundColor: isActive ? colors.primary : 'transparent',
                      }}
                    >
                      {isActive && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isActive ? colors.primary : colors.foreground }}
                      >
                        {option.label}
                      </Text>
                      <Text className="text-xs text-muted mt-0.5">{option.description}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>


        {/* Danger Zone */}
        <View className="mt-8">
          <Pressable
            onPress={handleResetData}
            style={({ pressed }) => [
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: colors.error + '10', borderWidth: 1, borderColor: colors.error + '30' }}
            >
              <Text className="font-semibold text-sm" style={{ color: colors.error }}>
                Reset All Data
              </Text>
            </View>
          </Pressable>
          <Text className="text-xs text-muted text-center mt-2">
            Permanently deletes all data and restarts the intake process.
          </Text>
        </View>

        {/* Version number — tap 5x to open debug screen */}
        <Pressable onPress={handleVersionTap} hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text className="text-xs text-muted">v{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
