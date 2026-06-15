/**
 * ImportDataSection — UI for importing encrypted .recofree backup.
 * 
 * IMPORTANT: expo-document-picker and expo-file-system are loaded dynamically (lazy)
 * to avoid crashing on APK builds that were compiled before these packages were added.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { importEncryptedRecoFreeBackup } from '../services/importDataService';
import type { ExportImportStores } from '../services/exportImportStores.types';

interface PickedFile {
  uri: string;
  name: string;
}

interface ImportDataSectionProps {
  stores: ExportImportStores;
  appVersion: string;
  onImportSuccess?: () => void;
}

export function ImportDataSection({ stores, appVersion, onImportSuccess }: ImportDataSectionProps) {
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const canImport = !!selectedFile && password.length >= 1 && !loading;

  const handlePickFile = useCallback(async () => {
    try {
      // Dynamic import to avoid crash on APK builds without native module
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setSelectedFile({ uri: asset.uri, name: asset.name });
      setError(null);
      setSuccess(false);
    } catch (err: any) {
      setError('Could not open file picker. Please try again.');
    }
  }, []);

  const handleImportConfirm = useCallback(async () => {
    setShowConfirmModal(false);
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Dynamic import for file system
      const FileSystem = await import('expo-file-system/legacy');
      const envelopeJson = await FileSystem.readAsStringAsync(selectedFile.uri, { encoding: FileSystem.EncodingType.UTF8 });

      const result = await importEncryptedRecoFreeBackup({
        envelopeJson,
        password,
        currentAppVersion: appVersion,
        stores,
      });

      if (result.status === "SUCCESS") {
        setSuccess(true);
        setPassword('');
        setSelectedFile(null);
        onImportSuccess?.();
      } else {
        setError(result.errorMessage ?? "Something went wrong.");
      }
    } catch (err: any) {
      setError(err?.safeMessage ?? err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [selectedFile, password, appVersion, stores, onImportSuccess]);

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-foreground">Import RecoFree backup</Text>
      <Text className="text-sm text-muted leading-relaxed">
        Importing replaces the RecoFree data on this device. Your existing local data will be overwritten after the file is verified.
      </Text>

      <TouchableOpacity
        className="bg-surface border border-border rounded-lg py-3 px-4 items-center"
        onPress={handlePickFile}
        activeOpacity={0.7}
      >
        <Text className="text-foreground font-medium">
          {selectedFile ? selectedFile.name : "Choose backup file"}
        </Text>
      </TouchableOpacity>

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">Password</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); setSuccess(false); }}
          placeholder="Enter backup password"
          placeholderTextColor="#9BA1A6"
          autoComplete="off"
        />
      </View>

      <TouchableOpacity
        className={`rounded-lg py-3 px-4 items-center ${canImport ? 'bg-primary' : 'bg-border'}`}
        onPress={() => setShowConfirmModal(true)}
        disabled={!canImport}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className={`font-semibold ${canImport ? 'text-background' : 'text-muted'}`}>
            Import encrypted backup
          </Text>
        )}
      </TouchableOpacity>

      {success && (
        <Text className="text-sm text-success font-medium">Backup imported successfully.</Text>
      )}
      {error && (
        <Text className="text-sm text-error">{error}</Text>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-2xl p-6 mx-6 max-w-sm w-full gap-4">
            <Text className="text-lg font-semibold text-foreground">Replace local data?</Text>
            <Text className="text-sm text-muted leading-relaxed">
              Importing this backup will replace the RecoFree data currently stored on this device. This cannot be merged. Continue?
            </Text>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text className="text-foreground font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-error rounded-lg py-3 items-center"
                onPress={handleImportConfirm}
                activeOpacity={0.7}
              >
                <Text className="text-background font-semibold">Replace local data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
