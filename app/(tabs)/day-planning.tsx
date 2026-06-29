import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { DayStructureHomeCard } from '@/components/day-structure/home-card';
import { isConfigured } from '@/lib/features/dayStructure/day-structure-service';
import { useTranslation } from '@/lib/i18n';
import { colors as dc, spacing, radius, typography } from '@/constants/design';
import * as Haptics from 'expo-haptics';

export default function DayPlanningScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showLater, setShowLater] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const result = await isConfigured();
        if (active) setConfigured(result);
      })();
      return () => { active = false; };
    }, [])
  );

  // "Straks" (later) — user can dismiss and come back
  if (showLater) {
    return (
      <ScreenContainer className="p-6">
        <View style={styles.laterContainer}>
          <Text style={styles.laterEmoji}>⏰</Text>
          <Text style={styles.laterTitle}>{t('dayStructure.later.title')}</Text>
          <Text style={styles.laterBody}>{t('dayStructure.later.body')}</Text>
          <Pressable
            onPress={() => {
              setShowLater(false);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.laterButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.laterButtonText}>{t('dayStructure.later.open_now')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Not configured yet — show setup prompt with "Straks" option
  if (configured === false) {
    return (
      <ScreenContainer className="p-6">
        <View style={styles.setupContainer}>
          <Text style={styles.setupEmoji}>📋</Text>
          <Text style={styles.setupTitle}>{t('dayStructure.setup.title')}</Text>
          <Text style={styles.setupBody}>{t('dayStructure.setup.body')}</Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/day-structure/wizard');
            }}
            style={({ pressed }) => [styles.setupButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.setupButtonText}>{t('dayStructure.setup.start')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowLater(true);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.laterLink, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={styles.laterLinkText}>{t('dayStructure.setup.later')}</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Configured — show the full DayStructureHomeCard with completion tracking
  return (
    <ScreenContainer className="p-4">
      <DayStructureHomeCard />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  setupEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  setupTitle: {
    ...typography.titleMedium,
    color: dc.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  setupBody: {
    fontSize: 15,
    color: dc.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  setupButton: {
    backgroundColor: dc.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.pill,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterLink: {
    marginTop: spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  laterLinkText: {
    color: dc.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  laterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  laterEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  laterTitle: {
    ...typography.titleMedium,
    color: dc.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  laterBody: {
    fontSize: 15,
    color: dc.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  laterButton: {
    backgroundColor: dc.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: radius.pill,
  },
  laterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
