/**
 * Day Structure Home Card
 *
 * Displays on the home screen. Shows:
 * - Current/next block info
 * - Bell toggle
 * - Progress for today with completion checkboxes
 * - CTA to configure if not set up
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/lib/i18n';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { BellState, TimeBlock } from '@/lib/features/dayStructure/types';
import {
  loadBellState,
  toggleBell,
  getDocument,
  getCompletion,
  toggleBlockCompletion,
} from '@/lib/features/dayStructure';
import {
  scheduleAllNotifications,
  cancelAllNotifications,
} from '@/lib/features/dayStructure/notification-service';
import { DayStructureTimeAdapter } from '@/lib/features/dayStructure/time-adapter';
import * as Haptics from 'expo-haptics';

export function DayStructureHomeCard() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  const [bellState, setBellState] = useState<BellState>('not_configured');
  const [isConfigured, setIsConfigured] = useState(false);
  const [todayBlocks, setTodayBlocks] = useState<TimeBlock[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentBlock, setCurrentBlock] = useState<TimeBlock | null>(null);

  const loadData = useCallback(async () => {
    try {
      const doc = await getDocument();
      const schema = doc.weekSchema;
      if (!schema) {
        setIsConfigured(false);
        return;
      }

      // Get today's weekday using the shared time adapter
      const now = new Date();
      const today = DayStructureTimeAdapter.getCurrentWeekday();

      const daySchema = schema[today];
      if (!daySchema || daySchema.blocks.length === 0) {
        setIsConfigured(false);
        return;
      }

      setIsConfigured(true);
      const sortedBlocks = [...daySchema.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
      setTodayBlocks(sortedBlocks);

      // Load bell state
      const bell = await loadBellState();
      setBellState(bell);

      // Load completion
      const localDayKey = DayStructureTimeAdapter.getCurrentLocalDayKey();
      const completion = await getCompletion(localDayKey);
      setCompletedIds(completion.completedBlockIds);

      // Find current block
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const active = daySchema.blocks.find((b) => {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        const start = (sh ?? 0) * 60 + (sm ?? 0);
        const end = (eh ?? 0) * 60 + (em ?? 0);
        // Point-in-time blocks (wake/sleep): match if within 30 min after
        if (start === end) {
          return nowMinutes >= start && nowMinutes < start + 30;
        }
        if (end > start) {
          return nowMinutes >= start && nowMinutes < end;
        }
        // Midnight crossing
        return nowMinutes >= start || nowMinutes < end;
      });
      setCurrentBlock(active ?? null);
    } catch (error) {
      console.error('[DayStructure/HomeCard] Load error:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBellToggle = async () => {
    const newState = await toggleBell({ isConfigured });
    setBellState(newState);

    // Schedule or cancel notifications based on new state
    if (newState === 'enabled') {
      const doc = await getDocument();
      if (doc.weekSchema) {
        await scheduleAllNotifications(doc.weekSchema);
      }
    } else if (newState === 'disabled') {
      await cancelAllNotifications();
    }
  };

  const handleToggleBlock = async (blockId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const localDayKey = DayStructureTimeAdapter.getCurrentLocalDayKey();
    const updated = await toggleBlockCompletion(localDayKey, blockId);
    setCompletedIds(updated.completedBlockIds);
  };

  const handleOpenWizard = () => {
    router.push('/day-structure/wizard');
  };

  const handleOpenEditor = () => {
    router.push('/day-structure/editor');
  };

  // ─── Not Configured State ─────────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <TouchableOpacity
        onPress={handleOpenWizard}
        activeOpacity={0.8}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <IconSymbol name="clock.fill" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
              {t('dayStructure.home_card.setup_title')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {t('dayStructure.home_card.setup_description')}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </View>
      </TouchableOpacity>
    );
  }

  // ─── Configured State ─────────────────────────────────────────────────────
  const bellIcon = bellState === 'enabled' ? 'bell.fill' : 'bell.slash.fill';
  const bellColor = bellState === 'enabled' ? colors.primary : bellState === 'denied' ? colors.error : colors.muted;
  const totalBlocks = todayBlocks.length;
  const completedCount = completedIds.length;
  const allDone = totalBlocks > 0 && completedCount >= totalBlocks;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
          <IconSymbol name="calendar" size={20} color={colors.primary} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.foreground, marginLeft: 10 }}>
          {t('dayStructure.home_card.title')}
        </Text>

        {/* Bell Toggle */}
        <TouchableOpacity
          onPress={handleBellToggle}
          activeOpacity={0.7}
          style={[styles.bellButton, { backgroundColor: bellColor + '15' }]}
        >
          <IconSymbol name={bellIcon} size={18} color={bellColor} />
        </TouchableOpacity>

        {/* Edit Button */}
        <TouchableOpacity onPress={handleOpenEditor} activeOpacity={0.7} style={{ marginLeft: 8 }}>
          <IconSymbol name="pencil" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Block Checklist */}
      <View style={{ gap: 6, marginBottom: 10 }}>
        {todayBlocks.map((block) => {
          const isCompleted = completedIds.includes(block.id);
          const isCurrent = currentBlock?.id === block.id;
          const blockLabel = block.label || t(`dayStructure.block_kind.${block.kind}`);
          const timeDisplay = block.kind === 'wake' || block.kind === 'sleep'
            ? block.startTime
            : `${block.startTime} – ${block.endTime}`;

          return (
            <TouchableOpacity
              key={block.id}
              onPress={() => handleToggleBlock(block.id)}
              activeOpacity={0.7}
              style={[
                styles.blockRow,
                {
                  backgroundColor: isCurrent ? colors.primary + '08' : 'transparent',
                  borderColor: isCurrent ? colors.primary + '30' : 'transparent',
                },
              ]}
            >
              {/* Checkbox */}
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: isCompleted ? colors.success : 'transparent',
                  borderColor: isCompleted ? colors.success : colors.muted + '80',
                },
              ]}>
                {isCompleted && (
                  <IconSymbol name="checkmark" size={10} color="#fff" />
                )}
              </View>

              {/* Block info */}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[
                  { fontSize: 14, color: colors.foreground },
                  isCompleted && { textDecorationLine: 'line-through', color: colors.muted },
                ]}>
                  {blockLabel}
                </Text>
              </View>

              {/* Time */}
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {timeDisplay}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Progress Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: allDone ? colors.success : colors.primary,
                width: totalBlocks > 0 ? `${(completedCount / totalBlocks) * 100}%` : '0%',
              },
            ]}
          />
        </View>
        <Text style={{ fontSize: 12, color: allDone ? colors.success : colors.muted, marginLeft: 8, fontWeight: allDone ? '600' : '400' }}>
          {allDone ? t('dayStructure.home_card.all_done') : `${completedCount}/${totalBlocks}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
