/**
 * Day Structure Editor Screen
 *
 * Shows the current week's day structure with tabs per weekday.
 * Allows editing block times/labels, deleting blocks, and adding new ones.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScrollWheelTimePicker } from '@/components/day-structure/scroll-wheel-time-picker';
import * as Haptics from 'expo-haptics';
import type { TimeBlock, Weekday } from '@/lib/features/dayStructure/types';
import { WEEKDAYS } from '@/lib/features/dayStructure/types';
import {
  getDayBlocks,
  deleteBlock,
  editBlock,
  addBlock,
  isConfigured,
} from '@/lib/features/dayStructure/day-structure-service';
import { DayStructureTimeAdapter } from '@/lib/features/dayStructure/time-adapter';

export default function DayStructureEditorScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState<Weekday>(
    DayStructureTimeAdapter.getCurrentWeekday()
  );
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editStartHour, setEditStartHour] = useState(0);
  const [editStartMinute, setEditStartMinute] = useState(0);
  const [editEndHour, setEditEndHour] = useState(0);
  const [editEndMinute, setEditEndMinute] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStartHour, setNewStartHour] = useState(9);
  const [newStartMinute, setNewStartMinute] = useState(0);
  const [newEndHour, setNewEndHour] = useState(10);
  const [newEndMinute, setNewEndMinute] = useState(0);
  const [configured, setConfigured] = useState(false);

  const loadBlocks = useCallback(async () => {
    const dayBlocks = await getDayBlocks(selectedDay);
    setBlocks(dayBlocks);
    const hasConfig = await isConfigured();
    setConfigured(hasConfig);
  }, [selectedDay]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const formatTime = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const parseTime = (time: string): [number, number] => {
    const [h, m] = time.split(':').map(Number);
    return [h || 0, m || 0];
  };

  const handleDelete = async (blockId: string) => {
    await deleteBlock(selectedDay, blockId);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    loadBlocks();
  };

  const handleStartEdit = (block: TimeBlock) => {
    setEditingBlock(block.id);
    setEditLabel(block.label);
    const [sh, sm] = parseTime(block.startTime);
    const [eh, em] = parseTime(block.endTime);
    setEditStartHour(sh);
    setEditStartMinute(sm);
    setEditEndHour(eh);
    setEditEndMinute(em);
  };

  const handleSaveEdit = async () => {
    if (!editingBlock) return;
    const result = await editBlock(selectedDay, editingBlock, {
      label: editLabel,
      startTime: formatTime(editStartHour, editStartMinute),
      endTime: formatTime(editEndHour, editEndMinute),
    });
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setEditingBlock(null);
      loadBlocks();
    }
  };

  const handleAddBlock = async () => {
    if (!newLabel.trim()) return;
    const result = await addBlock(selectedDay, {
      label: newLabel.trim(),
      kind: 'activity',
      startTime: formatTime(newStartHour, newStartMinute),
      endTime: formatTime(newEndHour, newEndMinute),
    });
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setNewLabel('');
      setShowAddForm(false);
      loadBlocks();
    }
  };

  const getDayLabel = (day: Weekday): string => {
    return t(`dayStructure.weekdays.${day}_short`);
  };

  const renderBlock = ({ item }: { item: TimeBlock }) => {
    const isEditing = editingBlock === item.id;

    if (isEditing) {
      const isPointInTime = item.kind === 'wake' || item.kind === 'sleep';
      return (
        <View style={[styles.blockCard, { backgroundColor: colors.surface, borderColor: colors.primary, flexDirection: 'column', alignItems: 'stretch' }]}>
          {!isPointInTime && (
            <TextInput
              value={editLabel}
              onChangeText={setEditLabel}
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
              returnKeyType="done"
            />
          )}
          {isPointInTime ? (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <ScrollWheelTimePicker
                value={formatTime(editStartHour, editStartMinute)}
                onChange={(time) => {
                  const [h, m] = time.split(':').map(Number);
                  setEditStartHour(h!);
                  setEditStartMinute(m!);
                  setEditEndHour(h!);
                  setEditEndMinute(m!);
                }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <ScrollWheelTimePicker
                  value={formatTime(editStartHour, editStartMinute)}
                  onChange={(time) => { const [h, m] = time.split(':').map(Number); setEditStartHour(h!); setEditStartMinute(m!); }}
                />
              </View>
              <Text style={{ color: colors.muted }}>–</Text>
              <View style={{ flex: 1 }}>
                <ScrollWheelTimePicker
                  value={formatTime(editEndHour, editEndMinute)}
                  onChange={(time) => { const [h, m] = time.split(':').map(Number); setEditEndHour(h!); setEditEndMinute(m!); }}
                />
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => setEditingBlock(null)}
              style={[styles.actionBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.muted, fontWeight: '500' }}>
                {t('dayStructure.editor.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveEdit}
              style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {t('dayStructure.editor.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.blockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
            {item.label || t(`dayStructure.blockKind.${item.kind}`)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            {item.kind === 'wake' || item.kind === 'sleep'
              ? item.startTime
              : `${item.startTime} – ${item.endTime}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => handleStartEdit(item)} activeOpacity={0.7}>
            <IconSymbol name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.7}>
            <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!configured) {
    return (
      <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <IconSymbol name="calendar" size={48} color={colors.muted} />
          <Text style={{ fontSize: 17, color: colors.foreground, fontWeight: '600', textAlign: 'center' }}>
            {t('dayStructure.editor.not_configured_title')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            {t('dayStructure.editor.not_configured_body')}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/day-structure/wizard')}
            style={{ backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 8 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {t('dayStructure.editor.go_to_wizard')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, flex: 1 }}>
            {t('dayStructure.editor.title')}
          </Text>
        </View>

        {/* Weekday tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, maxHeight: 40 }}>
          {WEEKDAYS.map((day) => (
            <TouchableOpacity
              key={day}
              onPress={() => { setSelectedDay(day); setEditingBlock(null); setShowAddForm(false); }}
              style={[
                styles.dayTab,
                {
                  backgroundColor: selectedDay === day ? colors.primary : colors.surface,
                  borderColor: selectedDay === day ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: selectedDay === day ? '#fff' : colors.foreground,
              }}>
                {getDayLabel(day)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Block list */}
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.id}
          renderItem={renderBlock}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 14 }}>
                {t('dayStructure.editor.no_blocks')}
              </Text>
            </View>
          }
        />

        {/* Add block form */}
        {showAddForm && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder={t('dayStructure.wizard.activities.label_placeholder')}
              placeholderTextColor={colors.muted}
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <View style={{ flex: 1, height: 150 }}>
                <ScrollWheelTimePicker
                  value={formatTime(newStartHour, newStartMinute)}
                  onChange={(t) => { const [h, m] = t.split(':').map(Number); setNewStartHour(h!); setNewStartMinute(m!); }}
                />
              </View>
              <Text style={{ color: colors.muted }}>–</Text>
              <View style={{ flex: 1, height: 150 }}>
                <ScrollWheelTimePicker
                  value={formatTime(newEndHour, newEndMinute)}
                  onChange={(t) => { const [h, m] = t.split(':').map(Number); setNewEndHour(h!); setNewEndMinute(m!); }}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setShowAddForm(false)}
                style={[styles.actionBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.muted, fontWeight: '500' }}>
                  {t('dayStructure.editor.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddBlock}
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {t('dayStructure.wizard.activities.add_button')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add button */}
        {!showAddForm && !editingBlock && (
          <TouchableOpacity
            onPress={() => setShowAddForm(true)}
            style={[styles.floatingAdd, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
              {t('dayStructure.editor.add_block')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  blockCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  addForm: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  floatingAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
});
