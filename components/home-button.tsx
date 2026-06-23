import { Pressable, Text, View, Platform, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors as dc, typography } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

/**
 * A simple home button that navigates back to the home screen.
 * Place at the top-left of every sub-screen (mood, diary, backpack, chat, profile).
 */
export function HomeButton() {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/(tabs)/' as Href);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={styles.icon}>{t('home_button.icon')}</Text>
      <Text style={styles.label}>{t('home_button.label')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
    color: dc.primary,
    marginRight: 6,
    fontWeight: '600',
  },
  label: {
    ...typography.bodySmall,
    color: dc.primary,
    fontWeight: '600',
  },
});
