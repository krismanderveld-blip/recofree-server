import { useCallback } from 'react';
import { Text, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { colors as dc, radius, shadows, spacing, typography } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

/**
 * GDPR Consent Screen
 *
 * Mandatory screen shown after intake if user.dat does not contain gdprAccepted: true.
 * NOT skipable — user must accept to continue.
 */
export default function GdprConsentScreen() {
  const router = useRouter();
  const { acceptGdpr } = useUser();
  const { t } = useTranslation();

  const handleAccept = useCallback(async () => {
    await acceptGdpr();
    router.replace('/(tabs)' as Href);
  }, [acceptGdpr, router]);

  return (
    <ScreenContainer
      edges={['top', 'bottom', 'left', 'right']}
      containerClassName="bg-background"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>{t('gdpr_consent.header.emoji')}</Text>
            <Text style={styles.title}>{t('gdpr_consent.header.title')}</Text>
            <Text style={styles.subtitle}>
              {t('gdpr_consent.header.subtitle')}
            </Text>
          </View>

          {/* Content Card */}
          <View style={styles.card}>
            <Text style={styles.body}>
              {t('gdpr_consent.card.body1')}
            </Text>

            <View style={styles.bulletList}>
              {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{t(`gdpr_consent.privacy_points.${idx}`)}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.body, { marginTop: 16 }]}>
              {t('gdpr_consent.card.body2')}
            </Text>
          </View>

          {/* Contact info */}
          <Text style={styles.contact}>
            {t('gdpr_consent.contact_text')}
          </Text>

          {/* Accept Button */}
          <Pressable
            onPress={handleAccept}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.buttonText}>{t('gdpr_consent.button.accept')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// Privacy points are now rendered reactively with t() inside the component

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.screenBottom,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  headerEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.titleMedium.fontSize,
    lineHeight: typography.titleMedium.lineHeight,
    fontWeight: typography.titleMedium.fontWeight,
    color: dc.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontWeight: typography.bodyMedium.fontWeight,
    color: dc.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: dc.surface,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: dc.borderSoft,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  body: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: dc.textPrimary,
  },
  bulletList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dc.primary,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: dc.textSecondary,
  },
  contact: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
    color: dc.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: dc.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.soft,
    shadowColor: dc.primary,
    shadowOpacity: 0.15,
  },
  buttonText: {
    color: dc.textInverse,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    fontWeight: '700',
  },
});
