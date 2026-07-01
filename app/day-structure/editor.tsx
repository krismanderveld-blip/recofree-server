/**
 * Day Structure Editor Screen
 *
 * Shows the current week's day structure with tabs per weekday.
 * Allows editing block times/labels, deleting blocks, and adding new ones.
 * Includes an "End of day (sleep)" button to add/edit the sleep block.
 * Includes "Copy to other days" and "Restart wizard" functionality.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  Alert,
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
  copyToSpecificDays,
  copyActivitiesToSpecificDays,
  resetDayStructure,
  moveBlock,
  getWeekSchemaSnapshot,
  restoreWeekSchemaSnapshot,
  getDocument,
  saveDayBlocks,
} from '@/lib/features/dayStructure/day-structure-service';
import type { WeekSchema } from '@/lib/features/dayStructure/types';
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
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('10:00');
  const [editTimeField, setEditTimeField] = useState<'start' | 'end' | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [addTimeField, setAddTimeField] = useState<'start' | 'end' | null>(null);
  const [showSleepPicker, setShowSleepPicker] = useState(false);
  const [sleepTime, setSleepTime] = useState('22:00');
  const [configured, setConfigured] = useState(false);
  // Copy-day state
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<Weekday[]>([]);
  const [copyOnlyActivities, setCopyOnlyActivities] = useState(false);
  // Undo state
  const [undoSnapshot, setUndoSnapshot] = useState<WeekSchema | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  // Configured days indicator
  const [configuredDays, setConfiguredDays] = useState<Set<Weekday>>(new Set());
  // Copy-from-another-day state
  const [showCopyFromPanel, setShowCopyFromPanel] = useState(false);
  const [copyFromSource, setCopyFromSource] = useState<Weekday | null>(null);
  const [copyFromOnlyActivities, setCopyFromOnlyActivities] = useState(false);

  const loadBlocks = useCallback(async () => {
    const dayBlocks = await getDayBlocks(selectedDay);
    setBlocks(dayBlocks);
    const hasConfig = await isConfigured();
    setConfigured(hasConfig);
    // Set sleep time from existing sleep block
    const sleepBlock = dayBlocks.find((b) => b.kind === 'sleep');
    if (sleepBlock) {
      setSleepTime(sleepBlock.startTime);
    }
    // Load configured days for indicators
    const doc = await getDocument();
    const configured = new Set<Weekday>();
    for (const day of WEEKDAYS) {
      if ((doc.weekSchema[day]?.blocks.length ?? 0) > 0) {
        configured.add(day);
      }
    }
    setConfiguredDays(configured);
  }, [selectedDay]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  /**
   * Get the suggested start time for a new activity:
   * Use the last activity's end time, or wake time, or default
   */
  const getSuggestedStartTime = (): string => {
    const activities = blocks
      .filter((b) => b.kind === 'activity')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (activities.length > 0) {
      return activities[activities.length - 1]!.endTime;
    }
    const wakeBlock = blocks.find((b) => b.kind === 'wake');
    return wakeBlock?.startTime ?? '09:00';
  };

  const addOneHour = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const newH = Math.min((h ?? 0) + 1, 23);
    return `${String(newH).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
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
    setEditStartTime(block.startTime);
    setEditEndTime(block.endTime);
    setEditTimeField(null);
    setShowAddForm(false);
    setShowSleepPicker(false);
    setShowCopyPanel(false);
  };

  const handleSaveEdit = async () => {
    if (!editingBlock) return;
    const result = await editBlock(selectedDay, editingBlock, {
      label: editLabel,
      startTime: editStartTime,
      endTime: editEndTime,
    });
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setEditingBlock(null);
      setEditTimeField(null);
      loadBlocks();
    }
  };

  const handleAddBlock = async () => {
    if (!newLabel.trim()) return;
    const result = await addBlock(selectedDay, {
      label: newLabel.trim(),
      kind: 'activity',
      startTime: newStartTime,
      endTime: newEndTime,
    });
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setNewLabel('');
      setShowAddForm(false);
      setAddTimeField(null);
      loadBlocks();
    }
  };

  const handleShowAddForm = () => {
    const suggested = getSuggestedStartTime();
    setNewStartTime(suggested);
    setNewEndTime(addOneHour(suggested));
    setAddTimeField(null);
    setShowAddForm(true);
    setEditingBlock(null);
    setShowSleepPicker(false);
    setShowCopyPanel(false);
  };

  const handleSaveSleep = async () => {
    const sleepBlock = blocks.find((b) => b.kind === 'sleep');
    if (sleepBlock) {
      const result = await editBlock(selectedDay, sleepBlock.id, {
        label: sleepBlock.label,
        startTime: sleepTime,
        endTime: sleepTime,
      });
      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowSleepPicker(false);
        loadBlocks();
      }
    } else {
      // Add sleep block if it doesn't exist
      const result = await addBlock(selectedDay, {
        label: t('dayStructure.blockKind.sleep') || 'Slapen',
        kind: 'sleep',
        startTime: sleepTime,
        endTime: sleepTime,
      });
      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowSleepPicker(false);
        loadBlocks();
      }
    }
  };

  // ─── Copy Day ─────────────────────────────────────────────────────────────

  const handleShowCopyPanel = () => {
    setCopyTargetDays([]);
    setCopyOnlyActivities(false);
    setShowCopyPanel(true);
    setShowAddForm(false);
    setEditingBlock(null);
    setShowSleepPicker(false);
  };

  const toggleCopyTarget = (day: Weekday) => {
    setCopyTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectWeekdays = () => {
    const weekdays: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    setCopyTargetDays(weekdays.filter((d) => d !== selectedDay));
  };

  const handleSelectWeekend = () => {
    const weekend: Weekday[] = ['saturday', 'sunday'];
    setCopyTargetDays(weekend.filter((d) => d !== selectedDay));
  };

  const handleCopyConfirm = async () => {
    if (copyTargetDays.length === 0) return;
    // Save snapshot for undo
    const snapshot = await getWeekSchemaSnapshot();
    const result = copyOnlyActivities
      ? await copyActivitiesToSpecificDays(selectedDay, copyTargetDays)
      : await copyToSpecificDays(selectedDay, copyTargetDays);
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setUndoSnapshot(snapshot);
      setShowUndoBanner(true);
      setShowCopyPanel(false);
      setCopyTargetDays([]);
      loadBlocks();
    } else {
      Alert.alert(
        t('dayStructure.wizard.copy_week.error_title'),
        result.errors.join('\n') || t('dayStructure.wizard.copy_week.error_generic')
      );
    }
  };

  // ─── Undo ─────────────────────────────────────────────────────────────────

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    const result = await restoreWeekSchemaSnapshot(undoSnapshot);
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setUndoSnapshot(null);
      setShowUndoBanner(false);
      loadBlocks();
    }
  };

  const dismissUndo = () => {
    setUndoSnapshot(null);
    setShowUndoBanner(false);
  };

  // ─── Copy From Another Day ────────────────────────────────────────────────

  const handleShowCopyFromPanel = () => {
    setCopyFromSource(null);
    setCopyFromOnlyActivities(false);
    setShowCopyFromPanel(true);
    setShowAddForm(false);
    setEditingBlock(null);
    setShowSleepPicker(false);
    setShowCopyPanel(false);
  };

  const handleCopyFromConfirm = async () => {
    if (!copyFromSource) return;
    // Save snapshot for undo
    const snapshot = await getWeekSchemaSnapshot();
    const sourceBlocks = await getDayBlocks(copyFromSource);
    let blocksToSave: TimeBlock[];
    if (copyFromOnlyActivities) {
      // Keep existing wake/sleep, replace activities
      const existingNonActivity = blocks.filter((b) => b.kind !== 'activity');
      const sourceActivities = sourceBlocks
        .filter((b) => b.kind === 'activity')
        .map((b) => ({ ...b, id: `${b.id}_copy_${Date.now()}` }));
      blocksToSave = [...existingNonActivity, ...sourceActivities]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((block, index) => ({ ...block, orderIndex: index }));
    } else {
      // Copy all blocks with new IDs
      blocksToSave = sourceBlocks.map((b) => ({ ...b, id: `${b.id}_copy_${Date.now()}` }));
    }
    const result = await saveDayBlocks(selectedDay, blocksToSave);
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setUndoSnapshot(snapshot);
      setShowUndoBanner(true);
      setShowCopyFromPanel(false);
      setCopyFromSource(null);
      loadBlocks();
    } else {
      Alert.alert(
        t('dayStructure.wizard.copy_week.error_title'),
        result.errors.join('\n') || t('dayStructure.wizard.copy_week.error_generic')
      );
    }
  };

  // ─── Restart Wizard ───────────────────────────────────────────────────────

  const handleRestartWizard = () => {
    Alert.alert(
      t('dayStructure.editor.restart_wizard_title'),
      t('dayStructure.editor.restart_wizard_message'),
      [
        { text: t('dayStructure.editor.cancel'), style: 'cancel' },
        {
          text: t('dayStructure.editor.restart_wizard_confirm'),
          style: 'destructive',
          onPress: async () => {
            await resetDayStructure();
            router.replace('/day-structure/wizard');
          },
        },
      ]
    );
  };

  const getDayLabel = (day: Weekday): string => {
    return t(`dayStructure.weekdays.${day}_short`);
  };

  const getDayLabelFull = (day: Weekday): string => {
    return t(`dayStructure.weekdays.${day}`);
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const result = await moveBlock(selectedDay, index, index - 1);
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      loadBlocks();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= blocks.length - 1) return;
    const result = await moveBlock(selectedDay, index, index + 1);
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      loadBlocks();
    }
  };

  const renderBlock = ({ item, index }: { item: TimeBlock; index: number }) => {
    const isEditing = editingBlock === item.id;
    const isPointInTime = item.kind === 'wake' || item.kind === 'sleep';

    if (isEditing) {
      return (
        <View style={[styles.blockCard, { backgroundColor: colors.surface, borderColor: colors.primary, flexDirection: 'column', alignItems: 'stretch' }]}>
          {/* Label edit (not for wake/sleep) */}
          {!isPointInTime && (
            <TextInput
              value={editLabel}
              onChangeText={setEditLabel}
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
              returnKeyType="done"
            />
          )}

          {isPointInTime ? (
            /* Single time picker for wake/sleep */
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, textAlign: 'center' }}>
                {item.kind === 'wake' ? t('dayStructure.wizard.wake.time_label') : t('dayStructure.wizard.sleep.time_label')}
              </Text>
              <View style={{ height: 180 }}>
                <ScrollWheelTimePicker
                  value={editStartTime}
                  onChange={(time) => {
                    setEditStartTime(time);
                    setEditEndTime(time);
                  }}
                />
              </View>
            </View>
          ) : (
            /* Start/End time buttons for activities */
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setEditTimeField(editTimeField === 'start' ? null : 'start')}
                  style={[styles.timeButton, {
                    borderColor: editTimeField === 'start' ? colors.primary : colors.border,
                    flex: 1,
                  }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
                    {t('dayStructure.wizard.activities.start_time')}
                  </Text>
                  <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '600' }}>
                    {editStartTime}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: colors.muted, alignSelf: 'center', fontSize: 16 }}>–</Text>
                <TouchableOpacity
                  onPress={() => setEditTimeField(editTimeField === 'end' ? null : 'end')}
                  style={[styles.timeButton, {
                    borderColor: editTimeField === 'end' ? colors.primary : colors.border,
                    flex: 1,
                  }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
                    {t('dayStructure.wizard.activities.end_time')}
                  </Text>
                  <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '600' }}>
                    {editEndTime}
                  </Text>
                </TouchableOpacity>
              </View>
              {editTimeField === 'start' && (
                <View style={{ height: 180, marginTop: 8 }}>
                  <ScrollWheelTimePicker value={editStartTime} onChange={setEditStartTime} />
                </View>
              )}
              {editTimeField === 'end' && (
                <View style={{ height: 180, marginTop: 8 }}>
                  <ScrollWheelTimePicker value={editEndTime} onChange={setEditEndTime} />
                </View>
              )}
            </View>
          )}

          {/* Save/Cancel buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => { setEditingBlock(null); setEditTimeField(null); }}
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
        {/* Reorder arrows */}
        <View style={{ marginRight: 10, justifyContent: 'center', gap: 2 }}>
          <TouchableOpacity
            onPress={() => handleMoveUp(index)}
            activeOpacity={0.7}
            disabled={index === 0}
            style={{ opacity: index === 0 ? 0.25 : 1 }}
          >
            <IconSymbol name="arrow.up" size={16} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleMoveDown(index)}
            activeOpacity={0.7}
            disabled={index === blocks.length - 1}
            style={{ opacity: index === blocks.length - 1 ? 0.25 : 1 }}
          >
            <IconSymbol name="arrow.down" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
            {item.label || t(`dayStructure.blockKind.${item.kind}`)}
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            {isPointInTime ? item.startTime : `${item.startTime} – ${item.endTime}`}
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
          {/* Restart wizard button in header */}
          <TouchableOpacity onPress={handleRestartWizard} activeOpacity={0.7} style={{ padding: 4 }}>
            <IconSymbol name="arrow.counterclockwise" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Weekday tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, maxHeight: 40 }}>
          {WEEKDAYS.map((day) => (
            <TouchableOpacity
              key={day}
              onPress={() => { setSelectedDay(day); setEditingBlock(null); setShowAddForm(false); setShowSleepPicker(false); setShowCopyPanel(false); setShowCopyFromPanel(false); }}
              style={[
                styles.dayTab,
                {
                  backgroundColor: selectedDay === day ? colors.primary : colors.surface,
                  borderColor: selectedDay === day ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {configuredDays.has(day) && selectedDay !== day && (
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
                )}
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selectedDay === day ? '#fff' : colors.foreground,
                }}>
                  {getDayLabel(day)}
                </Text>
              </View>
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

        {/* Copy day panel */}
        {showCopyPanel && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>
              {t('dayStructure.editor.copy_from', { day: getDayLabelFull(selectedDay) })}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              {t('dayStructure.editor.copy_description')}
            </Text>

            {/* Quick-select buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleSelectWeekdays}
                style={[styles.quickSelectBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500' }}>
                  {t('dayStructure.wizard.copy_week.weekdays_label')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSelectWeekend}
                style={[styles.quickSelectBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '500' }}>
                  {t('dayStructure.wizard.copy_week.weekend_label')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Day checkboxes */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKDAYS.filter((d) => d !== selectedDay).map((day) => {
                const isSelected = copyTargetDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => toggleCopyTarget(day)}
                    style={[
                      styles.copyDayChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: isSelected ? '#fff' : colors.foreground,
                    }}>
                      {getDayLabel(day)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Activities-only toggle */}
            <TouchableOpacity
              onPress={() => setCopyOnlyActivities(!copyOnlyActivities)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                borderColor: copyOnlyActivities ? colors.primary : colors.border,
                backgroundColor: copyOnlyActivities ? colors.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {copyOnlyActivities && (
                  <IconSymbol name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={{ fontSize: 13, color: colors.foreground }}>
                {t('dayStructure.editor.copy_only_activities')}
              </Text>
            </TouchableOpacity>

            {/* Confirm / Cancel */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowCopyPanel(false)}
                style={[styles.actionBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.muted, fontWeight: '500' }}>
                  {t('dayStructure.editor.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyConfirm}
                style={[styles.actionBtn, {
                  backgroundColor: copyTargetDays.length > 0 ? colors.primary : colors.border,
                  borderColor: copyTargetDays.length > 0 ? colors.primary : colors.border,
                }]}
                activeOpacity={0.7}
                disabled={copyTargetDays.length === 0}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {t('dayStructure.editor.copy_confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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

            {/* Time selection buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setAddTimeField(addTimeField === 'start' ? null : 'start')}
                style={[styles.timeButton, {
                  borderColor: addTimeField === 'start' ? colors.primary : colors.border,
                  flex: 1,
                }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
                  {t('dayStructure.wizard.activities.start_time')}
                </Text>
                <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '600' }}>
                  {newStartTime}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: colors.muted, alignSelf: 'center', fontSize: 16 }}>–</Text>
              <TouchableOpacity
                onPress={() => setAddTimeField(addTimeField === 'end' ? null : 'end')}
                style={[styles.timeButton, {
                  borderColor: addTimeField === 'end' ? colors.primary : colors.border,
                  flex: 1,
                }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 2 }}>
                  {t('dayStructure.wizard.activities.end_time')}
                </Text>
                <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: '600' }}>
                  {newEndTime}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inline time picker — only one at a time */}
            {addTimeField === 'start' && (
              <View style={{ height: 180, marginTop: 8 }}>
                <ScrollWheelTimePicker value={newStartTime} onChange={setNewStartTime} />
              </View>
            )}
            {addTimeField === 'end' && (
              <View style={{ height: 180, marginTop: 8 }}>
                <ScrollWheelTimePicker value={newEndTime} onChange={setNewEndTime} />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => { setShowAddForm(false); setAddTimeField(null); }}
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

        {/* Sleep time picker */}
        {showSleepPicker && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, textAlign: 'center', marginBottom: 4 }}>
              {t('dayStructure.wizard.sleep.time_label')}
            </Text>
            <View style={{ height: 180 }}>
              <ScrollWheelTimePicker value={sleepTime} onChange={setSleepTime} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setShowSleepPicker(false)}
                style={[styles.actionBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.muted, fontWeight: '500' }}>
                  {t('dayStructure.editor.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveSleep}
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {t('dayStructure.editor.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Undo banner */}
        {showUndoBanner && undoSnapshot && (
          <View style={[styles.undoBanner, { backgroundColor: colors.foreground }]}>
            <Text style={{ color: colors.background, fontSize: 13, fontWeight: '500', flex: 1 }}>
              {t('dayStructure.editor.undo_message')}
            </Text>
            <TouchableOpacity onPress={handleUndo} activeOpacity={0.7} style={{ marginRight: 12 }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                {t('dayStructure.editor.undo_button')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissUndo} activeOpacity={0.7}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        )}

        {/* Copy-from-another-day panel */}
        {showCopyFromPanel && (
          <View style={[styles.addForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>
              {t('dayStructure.editor.copy_from_title')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              {t('dayStructure.editor.copy_from_description', { day: getDayLabelFull(selectedDay) })}
            </Text>

            {/* Source day selection */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKDAYS.filter((d) => d !== selectedDay).map((day) => {
                const isSelected = copyFromSource === day;
                const hasBlocks = configuredDays.has(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setCopyFromSource(day)}
                    style={[
                      styles.copyDayChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: hasBlocks ? 1 : 0.4,
                      },
                    ]}
                    activeOpacity={0.7}
                    disabled={!hasBlocks}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {hasBlocks && (
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSelected ? '#fff' : colors.success }} />
                      )}
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: isSelected ? '#fff' : colors.foreground,
                      }}>
                        {getDayLabel(day)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Activities-only toggle */}
            <TouchableOpacity
              onPress={() => setCopyFromOnlyActivities(!copyFromOnlyActivities)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                borderColor: copyFromOnlyActivities ? colors.primary : colors.border,
                backgroundColor: copyFromOnlyActivities ? colors.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {copyFromOnlyActivities && (
                  <IconSymbol name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={{ fontSize: 13, color: colors.foreground }}>
                {t('dayStructure.editor.copy_only_activities')}
              </Text>
            </TouchableOpacity>

            {/* Confirm / Cancel */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowCopyFromPanel(false)}
                style={[styles.actionBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.muted, fontWeight: '500' }}>
                  {t('dayStructure.editor.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyFromConfirm}
                style={[styles.actionBtn, {
                  backgroundColor: copyFromSource ? colors.primary : colors.border,
                  borderColor: copyFromSource ? colors.primary : colors.border,
                }]}
                activeOpacity={0.7}
                disabled={!copyFromSource}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {t('dayStructure.editor.copy_confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom action buttons */}
        {!showAddForm && !editingBlock && !showSleepPicker && !showCopyPanel && !showCopyFromPanel && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {/* Add activity button */}
            <TouchableOpacity
              onPress={handleShowAddForm}
              style={[styles.floatingAdd, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <IconSymbol name="plus.circle.fill" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
                {t('dayStructure.editor.add_block')}
              </Text>
            </TouchableOpacity>

            {/* Copy to other days button */}
            <TouchableOpacity
              onPress={handleShowCopyPanel}
              style={[styles.floatingAdd, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <IconSymbol name="doc.on.doc.fill" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>
                {t('dayStructure.editor.copy_day_button')}
              </Text>
            </TouchableOpacity>

            {/* Copy from another day button */}
            <TouchableOpacity
              onPress={handleShowCopyFromPanel}
              style={[styles.floatingAdd, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <IconSymbol name="arrow.down" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>
                {t('dayStructure.editor.copy_from_button')}
              </Text>
            </TouchableOpacity>

            {/* End of day / sleep button */}
            <TouchableOpacity
              onPress={() => { setShowSleepPicker(true); setShowAddForm(false); setEditingBlock(null); setShowCopyPanel(false); setShowCopyFromPanel(false); }}
              style={[styles.floatingAdd, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <IconSymbol name="moon.fill" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>
                {t('dayStructure.wizard.activities.end_day_button')}
              </Text>
            </TouchableOpacity>
          </View>
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
  timeButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
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
  },
  quickSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  copyDayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
});
