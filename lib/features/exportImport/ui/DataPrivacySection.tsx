/**
 * DataPrivacySection — Container for Export + Import sections in profile.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { ExportDataSection } from './ExportDataSection';
import { ImportDataSection } from './ImportDataSection';
import type { ExportImportStores } from '../services/exportImportStores.types';
import { useTranslation } from '@/lib/i18n';

interface DataPrivacySectionProps {
  stores: ExportImportStores;
  appVersion: string;
  onImportSuccess?: () => void;
}

export function DataPrivacySection({ stores, appVersion, onImportSuccess }: DataPrivacySectionProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-8">
      <View className="gap-2">
        <Text className="text-xl font-bold text-foreground">{t('profile.data_privacy.title')}</Text>
        <Text className="text-sm text-muted">
          {t('profile.data_privacy.subtitle')}
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
