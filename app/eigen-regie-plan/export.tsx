/**
 * KERP01 Export Screen — Share the Eigen Regie Plan with a therapist.
 *
 * Shows a preview of the formatted plan and allows sharing via the system share sheet
 * or copying to clipboard.
 */

import { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, Alert, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useTranslation } from '@/lib/i18n';
import { useUser } from '@/lib/user-context';
import { exportEigenRegiePlanAsText } from '@/lib/engine/kim/kerp01-export';
import { DEFAULT_EIGEN_REGIE_PLAN } from '@/lib/engine/kim/kerp01-types';

export default function ExportScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { state } = useUser();
  const backpack = state.backpack;
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const plan = backpack?.eigenRegiePlan ?? DEFAULT_EIGEN_REGIE_PLAN;
    const text = exportEigenRegiePlanAsText(plan, backpack?.naam ?? undefined);
    setExportText(text);
  }, [backpack]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: use navigator.share or fallback to copy
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ text: exportText, title: 'Eigen Regie Plan' });
        } else {
          await handleCopy();
          Alert.alert('Gekopieerd', 'Het plan is naar je klembord gekopieerd.');
        }
        return;
      }

      // Native: write to temp file and share
      const fileUri = `${FileSystem.cacheDirectory}eigen-regie-plan.txt`;
      await FileSystem.writeAsStringAsync(fileUri, exportText, { encoding: FileSystem.EncodingType.UTF8 });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Deel Eigen Regie Plan',
          UTI: 'public.plain-text',
        });
      } else {
        await handleCopy();
        Alert.alert('Gekopieerd', 'Delen is niet beschikbaar. Het plan is naar je klembord gekopieerd.');
      }
    } catch (error) {
      console.error('[KERP01 Export] Share failed:', error);
      Alert.alert('Fout', 'Kon het plan niet delen. Probeer het opnieuw.');
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.backText, { color: colors.primary }]}>{t('kerp.export.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{t('kerp.export.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.actionBtnText}>{t('kerp.export.share_button')}</Text>
        </Pressable>
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
            {copied ? '✓ Gekopieerd!' : '📋 Kopieer naar klembord'}
          </Text>
        </Pressable>
      </View>

      {/* Preview */}
      <View style={styles.previewLabel}>
        <Text style={[styles.previewLabelText, { color: colors.muted }]}>{t('kerp.export.preview_label')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewText, { color: colors.foreground }]} selectable>
            {exportText}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, fontWeight: '500' },
  title: { fontSize: 18, fontWeight: '700' },
  actions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  previewLabel: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  previewLabelText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  previewText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
});
