/**
 * ExportDataSection — UI for creating encrypted .recofree backup.
 * 
 * Export flow:
 * - Android: Uses StorageAccessFramework to let user pick a save location (Downloads, etc.)
 * - iOS: Uses StorageAccessFramework / documentDirectory as fallback
 * - No share sheet — file is saved locally only.
 * 
 * IMPORTANT: expo-file-system is loaded dynamically (lazy)
 * to avoid crashing on APK builds that were compiled before the package was added.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEncryptedRecoFreeExport } from '../services/exportDataService';
import type { ExportImportStores } from '../services/exportImportStores.types';
import { useTranslation } from '@/lib/i18n';

const LAST_EXPORT_KEY = '@recofree_last_export_timestamp';

interface ExportDataSectionProps {
  stores: ExportImportStores;
  appVersion: string;
}

export function ExportDataSection({ stores, appVersion }: ExportDataSectionProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_EXPORT_KEY).then((val) => {
      if (val) setLastExportedAt(val);
    });
  }, []);

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 8;
  const canExport = passwordLongEnough && passwordsMatch && !loading;

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const nowIso = new Date().toISOString();
      const result = await createEncryptedRecoFreeExport({
        password,
        nowIso,
        appVersion,
        platform: Platform.OS as "ios" | "android" | "web" | "unknown",
        expoSdkVersion: "54",
        stores,
      });

      // Dynamic import — only loaded when user actually exports
      const FileSystem = await import('expo-file-system/legacy');
      const { StorageAccessFramework } = FileSystem;

      // Ask user to pick a directory to save the file
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        // User cancelled — don't show error, just abort silently
        setLoading(false);
        return;
      }

      // Create the .recofree file in the user-chosen directory
      const fileUri = await StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        result.fileName,
        'application/octet-stream'
      );

      // Write the encrypted content to the file
      await StorageAccessFramework.writeAsStringAsync(fileUri, result.envelopeJson, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Persist last export timestamp
      await AsyncStorage.setItem(LAST_EXPORT_KEY, nowIso);
      setLastExportedAt(nowIso);

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.safeMessage ?? err?.message ?? "Encrypted export could not be created.");
    } finally {
      setLoading(false);
    }
  }, [password, appVersion, stores]);

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-foreground">{t('profile.data_privacy.export.title')}</Text>
      <Text className="text-sm text-muted leading-relaxed">
        {t('profile.data_privacy.export.description')}
      </Text>

      {lastExportedAt && (
        <Text className="text-xs text-muted">
          {t('profile.data_privacy.export.last_exported')}{formatExportDate(lastExportedAt)}
        </Text>
      )}

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">{t('profile.data_privacy.export.password_label')}</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={password}
          onChangeText={(val) => { setPassword(val); setSuccess(false); setError(null); }}
          placeholder={t('profile.data_privacy.export.password_placeholder')}
          placeholderTextColor="#9BA1A6"
          autoComplete="off"
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">{t('profile.data_privacy.export.confirm_label')}</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={confirmPassword}
          onChangeText={(val) => { setConfirmPassword(val); setSuccess(false); setError(null); }}
          placeholder={t('profile.data_privacy.export.confirm_placeholder')}
          placeholderTextColor="#9BA1A6"
          autoComplete="off"
        />
      </View>

      {password.length > 0 && !passwordLongEnough && (
        <Text className="text-xs text-warning">{t('profile.data_privacy.export.password_too_short')}</Text>
      )}
      {confirmPassword.length > 0 && !passwordsMatch && (
        <Text className="text-xs text-error">{t('profile.data_privacy.export.passwords_no_match')}</Text>
      )}

      <Text className="text-xs text-muted italic">
        {t('profile.data_privacy.export.warning')}
      </Text>

      <TouchableOpacity
        className={`rounded-lg py-3 px-4 items-center ${canExport ? 'bg-primary' : 'bg-border'}`}
        onPress={handleExport}
        disabled={!canExport}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className={`font-semibold ${canExport ? 'text-background' : 'text-muted'}`}>
            {t('profile.data_privacy.export.button')}
          </Text>
        )}
      </TouchableOpacity>

      {success && (
        <Text className="text-sm text-success font-medium">{t('profile.data_privacy.export.success')}</Text>
      )}
      {error && (
        <Text className="text-sm text-error">{error}</Text>
      )}

      <Text className="text-xs text-muted">
        {t('profile.data_privacy.export.footer')}
      </Text>
    </View>
  );
}

function formatExportDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
