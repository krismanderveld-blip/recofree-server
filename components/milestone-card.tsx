/**
 * MilestoneCard — Displays a single milestone acknowledgment card.
 * No gamification, no badges, no confetti, no sound, no share.
 * One card at a time, highest unseen milestone only.
 */

import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MilestoneCardProps } from '@/lib/features/milestone-tracker/milestone-tracker-types';

export function MilestoneCard({
  title,
  message,
  ctaLabel,
  accentColor,
  softBackgroundColor,
  onAcknowledge,
}: MilestoneCardProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onAcknowledge();
  };

  return (
    <View style={[styles.card, { backgroundColor: softBackgroundColor, borderColor: accentColor + '33' }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.cta,
          { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
      >
        <Text style={[styles.ctaText, { color: accentColor }]}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2933',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#52616B',
    marginBottom: 16,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
