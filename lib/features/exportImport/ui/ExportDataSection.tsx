/**
 * ExportDataSection — UI for creating encrypted .recofree backup.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createEncryptedRecoFreeExport } from '../services/exportDataService';
import type { ExportImportStores } from '../services/exportImportStores.types';

interface ExportDataSectionProps {
  stores: ExportImportStores;
  appVersion: string;
}

export function ExportDataSection({ stores, appVersion }: ExportDataSectionProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Save file and share
      const fileUri = `${FileSystem.cacheDirectory}${result.fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, result.envelopeJson, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Save RecoFree backup',
          UTI: 'public.data',
        });
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.safeMessage ?? "Encrypted export could not be created.");
    } finally {
      setLoading(false);
    }
  }, [password, appVersion, stores]);

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-foreground">Export your RecoFree data</Text>
      <Text className="text-sm text-muted leading-relaxed">
        Create one encrypted file with your local RecoFree data. The file can only be opened with the password you choose.
      </Text>

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">Password</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setSuccess(false); setError(null); }}
          placeholder="Minimum 8 characters"
          placeholderTextColor="#9BA1A6"
          autoComplete="off"
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">Confirm password</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setSuccess(false); setError(null); }}
          placeholder="Repeat password"
          placeholderTextColor="#9BA1A6"
          autoComplete="off"
        />
      </View>

      {password.length > 0 && !passwordLongEnough && (
        <Text className="text-xs text-warning">Password must be at least 8 characters.</Text>
      )}
      {confirmPassword.length > 0 && !passwordsMatch && (
        <Text className="text-xs text-error">Passwords do not match.</Text>
      )}

      <Text className="text-xs text-muted italic">
        RecoFree cannot recover this password. Keep this file somewhere safe.
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
            Export encrypted backup
          </Text>
        )}
      </TouchableOpacity>

      {success && (
        <Text className="text-sm text-success font-medium">Encrypted export created.</Text>
      )}
      {error && (
        <Text className="text-sm text-error">{error}</Text>
      )}

      <Text className="text-xs text-muted">
        Your export is encrypted on this device. RecoFree cannot recover the password. No server is involved.
      </Text>
    </View>
  );
}
