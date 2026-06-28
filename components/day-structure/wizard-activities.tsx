/**
 * Wizard Step: Activities
 *
 * User adds activity blocks between wake and sleep.
 * Can add multiple activities with label + time range.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { useWizard } from '@/lib/features/dayStructure/wizard-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { TimeBlock } from '@/lib/features/dayStructure/types';

export function WizardActivities() {
  const { t } = useTranslation();
  const colors = useColors();
  const { goToStep, addActivityBlock, removeBlock, state } = useWizard();

  const [label, setLabel] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const activityBlocks = state.draftBlocks.filter((b) => b.kind === 'activity');

  const handleAdd = () => {
    if (!label.trim() || !startTime || !endTime) return;
    addActivityBlock(label.trim(), startTime, endTime);
    setLabel('');
    setStartTime('');
    setEndTime('');
  };

  const handleNext = () => {
    goToStep('sleep');
  };

  const handleBack = () => {
    goToStep('wake');
  };

  const renderBlock = ({ item }: { item: TimeBlock }) => (
    <View style={[styles.blockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{item.label}</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {item.startTime} – {item.endTime}
        </Text>
      </View>
      <TouchableOpacity onPress={() => removeBlock(item.id)} activeOpacity={0.7}>
        <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
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
        {t('dayStructure.wizard.activities.title')}
      </Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 20, lineHeight: 22 }}>
        {t('dayStructure.wizard.activities.description')}
      </Text>

      {/* Add Activity Form */}
      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('dayStructure.wizard.activities.label_placeholder')}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          returnKeyType="next"
        />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="09:00"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            style={[styles.timeInput, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
            maxLength={5}
          />
          <Text style={{ color: colors.muted, alignSelf: 'center' }}>–</Text>
          <TextInput
            value={endTime}
            onChangeText={setEndTime}
            placeholder="10:00"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            style={[styles.timeInput, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
            maxLength={5}
          />
        </View>
        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: colors.primary + '15' }]}
          activeOpacity={0.7}
        >
          <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>
            {t('dayStructure.wizard.activities.add_button')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Activity List */}
      <FlatList
        data={activityBlocks}
        keyExtractor={(item) => item.id}
        renderItem={renderBlock}
        style={{ flex: 1, marginTop: 16 }}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 14 }}>
            {t('dayStructure.wizard.activities.empty')}
          </Text>
        }
      />

      {/* Next Button */}
      <TouchableOpacity
        onPress={handleNext}
        style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
          {t('dayStructure.wizard.next')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  timeInput: {
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
});
