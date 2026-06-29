/**
 * Wizard Step: Review
 *
 * Shows the complete day structure for review before saving.
 * User can delete individual blocks or proceed to copy-to-week.
 */

import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { TimeBlock } from '@/lib/features/dayStructure/types';
import * as Haptics from 'expo-haptics';

function BlockKindIcon({ kind, color }: { kind: string; color: string }) {
  switch (kind) {
    case 'wake':
      return <IconSymbol name="clock.fill" size={18} color={color} />;
    case 'sleep':
      return <IconSymbol name="moon.fill" size={18} color={color} />;
    default:
      return <IconSymbol name="list.bullet" size={18} color={color} />;
  }
}

export function WizardReview() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, state, removeBlock } = useWizard();

  const sortedBlocks = [...state.draftBlocks].sort((a, b) => {
    const aMin = parseInt(a.startTime.split(':')[0]!) * 60 + parseInt(a.startTime.split(':')[1]!);
    const bMin = parseInt(b.startTime.split(':')[0]!) * 60 + parseInt(b.startTime.split(':')[1]!);
    return aMin - bMin;
  });

  const handleBack = () => {
    goToStep('sleep');
  };

  const handleConfirm = () => {
    goToStep('copy_week');
  };

  const handleDelete = (block: TimeBlock) => {
    const label = block.kind === 'wake'
      ? t('dayStructure.block_kind.wake')
      : block.kind === 'sleep'
        ? t('dayStructure.block_kind.sleep')
        : block.label;

    Alert.alert(
      t('dayStructure.wizard.review.delete_title'),
      t('dayStructure.wizard.review.delete_message', { label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            removeBlock(block.id);
          },
        },
      ],
    );
  };

  const getBlockLabel = (block: TimeBlock): string => {
    if (block.kind === 'wake') return t('dayStructure.block_kind.wake');
    if (block.kind === 'sleep') return t('dayStructure.block_kind.sleep');
    return block.label;
  };

  const renderBlock = ({ item }: { item: TimeBlock }) => (
    <View style={[styles.blockRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <BlockKindIcon kind={item.kind} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
          {getBlockLabel(item)}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {item.startTime}{item.kind !== 'wake' && item.kind !== 'sleep' ? ` – ${item.endTime}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: item.notificationProfile === 'alarm' ? colors.warning + '20' : item.notificationProfile === 'push' ? colors.primary + '15' : colors.surface }]}>
        <Text style={{ fontSize: 11, color: item.notificationProfile === 'alarm' ? colors.warning : item.notificationProfile === 'push' ? colors.primary : colors.muted }}>
          {item.notificationProfile === 'alarm'
            ? t('dayStructure.notification_profile.alarm')
            : item.notificationProfile === 'push'
              ? t('dayStructure.notification_profile.push')
              : t('dayStructure.notification_profile.none')}
        </Text>
      </View>
      {/* Delete button */}
      <TouchableOpacity
        onPress={() => handleDelete(item)}
        activeOpacity={0.6}
        style={styles.deleteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <IconSymbol name="xmark.circle.fill" size={20} color={colors.error + '90'} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 24 }}>
      {/* Header */}
      <TouchableOpacity onPress={handleBack} style={{ marginBottom: 16 }} activeOpacity={0.7}>
        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('dayStructure.wizard.review.title')}
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 20, lineHeight: 22 }}>
        {t('dayStructure.wizard.review.description')}
      </Text>

      {/* Block List */}
      <FlatList
        data={sortedBlocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8 }}
      />

      {/* Confirm Button */}
      <TouchableOpacity
        onPress={handleConfirm}
        style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {t('dayStructure.wizard.review.confirm_button')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteButton: {
    marginLeft: 10,
    padding: 2,
  },
});
