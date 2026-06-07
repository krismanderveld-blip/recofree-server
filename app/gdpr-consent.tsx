import { useCallback } from 'react';
import { Text, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';

/**
 * GDPR Consent Screen
 * 
 * Mandatory screen shown after intake if user.dat does not contain gdprAccepted: true.
 * NOT skipable — user must accept to continue.
 */
export default function GdprConsentScreen() {
  const router = useRouter();
  const { acceptGdpr } = useUser();
  const colors = useColors();

  const handleAccept = useCallback(async () => {
    await acceptGdpr();
    router.replace('/(tabs)' as Href);
  }, [acceptGdpr, router]);

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Before you begin
            </Text>
          </View>

          {/* Content */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.body, { color: colors.foreground }]}>
              RecoFree uses AI technology (OpenAI) to process conversations.
            </Text>

            <View style={styles.bulletList}>
              <Text style={[styles.bullet, { color: colors.foreground }]}>
                {'\u2022'} Your name is replaced by an anonymous placeholder before reaching OpenAI.
              </Text>
              <Text style={[styles.bullet, { color: colors.foreground }]}>
                {'\u2022'} Conversations are not stored by OpenAI (store: false).
              </Text>
              <Text style={[styles.bullet, { color: colors.foreground }]}>
                {'\u2022'} OpenAI has signed a Data Processing Agreement (GDPR-compliant).
              </Text>
            </View>

            <Text style={[styles.body, { color: colors.foreground, marginTop: 16 }]}>
              Your personal data stays on your device. RecoFree does not store personal data on external servers.
            </Text>

            <Text style={[styles.contact, { color: colors.muted }]}>
              Questions: privacy@recofree.app
            </Text>
          </View>

          {/* Accept Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>I understand and agree</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 32,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletList: {
    marginTop: 16,
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    paddingLeft: 4,
  },
  contact: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
