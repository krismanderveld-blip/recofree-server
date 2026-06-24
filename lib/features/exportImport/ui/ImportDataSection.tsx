/**
 * ImportDataSection — UI for importing encrypted .recofree backup.
 * 
 * After a successful import, checks if the imported backpack has a name.
 * If not, shows a name input prompt before completing.
 * 
 * IMPORTANT: expo-document-picker and expo-file-system are loaded dynamically (lazy)
 * to avoid crashing on APK builds that were compiled before these packages were added.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { importEncryptedRecoFreeBackup } from '../services/importDataService';
import type { ExportImportStores } from '../services/exportImportStores.types';
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Post-import name prompt state
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [importedName, setImportedName] = useState('');

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
        // Check if the imported backpack has a name
        const { readEncrypted } = await import('@/lib/crypto/storage-encryption');
        const bpRaw = await readEncrypted('@recofree_backpack');
        const bpNaam = bpRaw ? JSON.parse(bpRaw)?.naam : '';

        if (!bpNaam) {
          // Name is missing — show prompt before completing
          setShowNamePrompt(true);
        } else {
          // Name exists — complete immediately
          setSuccess(true);
          setPassword('');
          setSelectedFile(null);
          onImportSuccess?.();
        }
      } else {
        setError(result.errorMessage ?? "Something went wrong.");
      }
    } catch (err: any) {
      setError(err?.safeMessage ?? err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [selectedFile, password, appVersion, stores, onImportSuccess]);

  const handleNameSave = useCallback(async () => {
    if (!importedName.trim()) return;

    try {
      const { readEncrypted, writeEncrypted } = await import('@/lib/crypto/storage-encryption');

      // Write name to backpack
      const bpRaw = await readEncrypted('@recofree_backpack');
      if (bpRaw) {
        const bp = JSON.parse(bpRaw);
        bp.naam = importedName.trim();
        await writeEncrypted('@recofree_backpack', JSON.stringify(bp));
      }

      // Also update userDat naam backup
      const udRaw = await readEncrypted('@recofree_userdat');
      if (udRaw) {
        const ud = JSON.parse(udRaw);
        ud.naam = importedName.trim();
        await writeEncrypted('@recofree_userdat', JSON.stringify(ud));
      }
    } catch { /* best effort */ }

    setShowNamePrompt(false);
    setImportedName('');
    setSuccess(true);
    setPassword('');
    setSelectedFile(null);
    onImportSuccess?.();
  }, [importedName, onImportSuccess]);

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-foreground">{t('profile.data_privacy.import.title')}</Text>
      <Text className="text-sm text-muted leading-relaxed">
        {t('profile.data_privacy.import.description')}
      </Text>

      <TouchableOpacity
        className="bg-surface border border-border rounded-lg py-3 px-4 items-center"
        onPress={handlePickFile}
        activeOpacity={0.7}
      >
        <Text className="text-foreground font-medium">
          {selectedFile ? selectedFile.name : t('profile.data_privacy.import.button.choose')}
        </Text>
      </TouchableOpacity>

      <View className="gap-2">
        <Text className="text-xs font-medium text-muted uppercase">{t('profile.data_privacy.import.password_label')}</Text>
        <TextInput
          className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
          secureTextEntry
          value={password}
          onChangeText={(val) => { setPassword(val); setError(null); setSuccess(false); }}
          placeholder={t('profile.data_privacy.import.password_placeholder')}
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
            {t('profile.data_privacy.import.button.import')}
          </Text>
        )}
      </TouchableOpacity>

      {success && (
        <Text className="text-sm text-success font-medium">{t('profile.data_privacy.import.success')}</Text>
      )}
      {error && (
        <Text className="text-sm text-error">{error}</Text>
      )}

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-2xl p-6 mx-6 max-w-sm w-full gap-4">
            <Text className="text-lg font-semibold text-foreground">{t('profile.data_privacy.import.confirm.title')}</Text>
            <Text className="text-sm text-muted leading-relaxed">
              {t('profile.data_privacy.import.confirm.message')}
            </Text>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 bg-surface border border-border rounded-lg py-3 items-center"
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text className="text-foreground font-medium">{t('profile.data_privacy.import.confirm.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-error rounded-lg py-3 items-center"
                onPress={handleImportConfirm}
                activeOpacity={0.7}
              >
                <Text className="text-background font-semibold">{t('profile.data_privacy.import.confirm.replace')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-import Name Prompt Modal */}
      <Modal visible={showNamePrompt} transparent animationType="fade">
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-background rounded-2xl p-6 mx-6 max-w-sm w-full gap-4">
            <Text className="text-lg font-semibold text-foreground">{t('profile.data_privacy.import.name_prompt.title')}</Text>
            <Text className="text-sm text-muted leading-relaxed">
              {t('profile.data_privacy.import.name_prompt.message')}
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              value={importedName}
              onChangeText={setImportedName}
              placeholder={t('profile.data_privacy.import.name_prompt.placeholder')}
              placeholderTextColor="#9BA1A6"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleNameSave}
            />
            <TouchableOpacity
              className={`rounded-lg py-3 px-4 items-center ${importedName.trim() ? 'bg-primary' : 'bg-border'}`}
              onPress={handleNameSave}
              disabled={!importedName.trim()}
              activeOpacity={0.7}
            >
              <Text className={`font-semibold ${importedName.trim() ? 'text-background' : 'text-muted'}`}>
                {t('profile.data_privacy.import.name_prompt.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
