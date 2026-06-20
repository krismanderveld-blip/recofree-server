/**
 * DataPrivacySection — Container for Export + Import sections in profile.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { ExportDataSection } from './ExportDataSection';
import { ImportDataSection } from './ImportDataSection';
import type { ExportImportStores } from '../services/exportImportStores.types';

interface DataPrivacySectionProps {
  stores: ExportImportStores;
  appVersion: string;
  onImportSuccess?: () => void;
}

export function DataPrivacySection({ stores, appVersion, onImportSuccess }: DataPrivacySectionProps) {
  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text className="text-xl font-bold text-foreground">Data & Privacy</Text>
        <Text className="text-sm text-muted">
          Manage your local RecoFree data. All operations happen on this device only.
        </Text>
      </View>

      <View className="bg-surface rounded-2xl p-5 border border-border">
        <ExportDataSection stores={stores} appVersion={appVersion} />
      </View>

      <View className="bg-surface rounded-2xl p-5 border border-border">
        <ImportDataSection stores={stores} appVersion={appVersion} onImportSuccess={onImportSuccess} />
      </View>
    </View>
  );
}
