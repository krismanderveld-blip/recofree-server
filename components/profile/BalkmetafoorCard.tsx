/**
 * BalkmetafoorCard — Draaglast/Draagkracht visual balance bar
 * Profile feature component. Qualitative, no numeric scoring.
 */

import { View, Text, FlatList, TextInput, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import type { BalkmetafoorData, BalkmetafoorEntry } from "@/src/types/balkmetafoor.types";
import { deriveBalkmetafoorVisualState } from "@/src/types/balkmetafoor.types";
import { useTranslation, tStatic } from '@/lib/i18n';

interface BalkmetafoorCardProps {
  data: BalkmetafoorData;
  onAddDraaglast: (text: string) => void;
  onAddDraagkracht: (text: string) => void;
  onRemoveDraaglast: (id: string) => void;
  onRemoveDraagkracht: (id: string) => void;
}

function BalanceBar({ data }: { data: BalkmetafoorData }) {
  const visualState = deriveBalkmetafoorVisualState(data);

  // Calculate tilt angle (max 15 degrees, purely visual)
  const total = data.draaglast.length + data.draagkracht.length;
  let tiltDeg = 0;
  if (total > 0) {
    const diff = data.draaglast.length - data.draagkracht.length;
    tiltDeg = Math.min(Math.max(diff * 3, -15), 15);
  }

  return (
    <View className="items-center py-4">
      {/* Balance beam */}
      <View
        className="w-64 h-2 bg-border rounded-full"
        style={{ transform: [{ rotate: `${tiltDeg}deg` }] }}
      >
        {/* Fulcrum indicator */}
        <View className="absolute left-1/2 -ml-1 -top-1 w-2 h-4 bg-muted rounded-sm" />
      </View>

      {/* Labels */}
      <View className="flex-row w-64 justify-between mt-3">
        <Text className="text-xs text-muted">
          {tStatic('profile.balkmetafoor.label.draaglast')} ({data.draaglast.length})
        </Text>
        <Text className="text-xs text-muted">
          {tStatic('profile.balkmetafoor.label.draagkracht')} ({data.draagkracht.length})
        </Text>
      </View>

      {/* Visual state description */}
      <Text className="text-xs text-muted mt-2 italic">
        {visualState === "BALANCED" && tStatic('profile.balkmetafoor.state.balanced')}
        {visualState === "LEANING_DRAAGLAST" && tStatic('profile.balkmetafoor.state.leaning_draaglast')}
        {visualState === "LEANING_DRAAGKRACHT" && tStatic('profile.balkmetafoor.state.leaning_draagkracht')}
        {visualState === "EMPTY" && tStatic('profile.balkmetafoor.state.empty')}
      </Text>
    </View>
  );
}

function EntryList({
  entries,
  side,
  onRemove,
}: {
  entries: BalkmetafoorEntry[];
  side: "draaglast" | "draagkracht";
  onRemove: (id: string) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: BalkmetafoorEntry }) => (
      <View className="flex-row items-center justify-between py-2 px-3 bg-surface rounded-lg mb-1">
        <Text className="text-sm text-foreground flex-1">{item.text}</Text>
        <TouchableOpacity
          onPress={() => onRemove(item.id)}
          activeOpacity={0.6}
        >
          <Text className="text-xs text-muted ml-2">{tStatic('profile.balkmetafoor.remove')}</Text>
        </TouchableOpacity>
      </View>
    ),
    [onRemove]
  );

  return (
    <View className="flex-1 px-2">
      <Text className="text-sm font-semibold text-foreground mb-2">
        {side === "draaglast" ? tStatic('profile.balkmetafoor.question.draaglast') : tStatic('profile.balkmetafoor.question.draagkracht')}
      </Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </View>
  );
}

export function BalkmetafoorCard({
  data,
  onAddDraaglast,
  onAddDraagkracht,
  onRemoveDraaglast,
  onRemoveDraagkracht,
}: BalkmetafoorCardProps) {
  const [draaglastInput, setDraaglastInput] = useState("");
  const [draagkrachtInput, setDraagkrachtInput] = useState("");
  const { t } = useTranslation();

  const handleAddDraaglast = useCallback(() => {
    const trimmed = draaglastInput.trim();
    if (trimmed) {
      onAddDraaglast(trimmed);
      setDraaglastInput("");
    }
  }, [draaglastInput, onAddDraaglast]);

  const handleAddDraagkracht = useCallback(() => {
    const trimmed = draagkrachtInput.trim();
    if (trimmed) {
      onAddDraagkracht(trimmed);
      setDraagkrachtInput("");
    }
  }, [draagkrachtInput, onAddDraagkracht]);

  if (!data.initialized) {
    return (
      <View className="bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-sm text-muted text-center">
          {tStatic('profile.balkmetafoor.not_initialized')}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface rounded-2xl p-4 border border-border">
      <Text className="text-base font-semibold text-foreground mb-1 text-center">
        {t('profile.balkmetafoor.title')}
      </Text>
      <Text className="text-xs text-muted text-center mb-3">
        {t('profile.balkmetafoor.subtitle')}
      </Text>

      <BalanceBar data={data} />

      <View className="flex-row mt-4">
        {/* Draaglast side */}
        <View className="flex-1 pr-1">
          <EntryList
            entries={data.draaglast}
            side="draaglast"
            onRemove={onRemoveDraaglast}
          />
          <View className="flex-row items-center mt-2 px-2">
            <TextInput
              className="flex-1 bg-background rounded-lg px-3 py-2 text-sm text-foreground border border-border"
              placeholder={t('profile.balkmetafoor.placeholder.add')}
              placeholderTextColor="#9BA1A6"
              value={draaglastInput}
              onChangeText={setDraaglastInput}
              onSubmitEditing={handleAddDraaglast}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Draagkracht side */}
        <View className="flex-1 pl-1">
          <EntryList
            entries={data.draagkracht}
            side="draagkracht"
            onRemove={onRemoveDraagkracht}
          />
          <View className="flex-row items-center mt-2 px-2">
            <TextInput
              className="flex-1 bg-background rounded-lg px-3 py-2 text-sm text-foreground border border-border"
              placeholder={t('profile.balkmetafoor.placeholder.add')}
              placeholderTextColor="#9BA1A6"
              value={draagkrachtInput}
              onChangeText={setDraagkrachtInput}
              onSubmitEditing={handleAddDraagkracht}
              returnKeyType="done"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
