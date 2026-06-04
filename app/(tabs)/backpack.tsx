import { useState, useCallback } from 'react';
import {
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import type { LifePhaseId, LifePhaseSection, StageOfChange, KimBackpackSectionId } from '@/lib/ai/types';
import { STAGE_OF_CHANGE_OPTIONS, DEFAULT_KIM_BACKPACK_SECTIONS } from '@/lib/ai/types';
import type { KimBackpackSection } from '@/lib/ai/types';
import { useColors } from '@/hooks/use-colors';

const SECTION_COLORS: Record<LifePhaseId, string> = {
  childhood: '#FF6B6B',
  adolescence: '#4ECDC4',
  adulthood: '#45B7D1',
  family: '#96CEB4',
  themes: '#FFEAA7',
};

const SECTION_ICONS: Record<LifePhaseId, string> = {
  childhood: '\u{1F9D2}',
  adolescence: '\u{1F331}',
  adulthood: '\u{1F3E0}',
  family: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
  themes: '\u{1F504}',
};

const STAGE_COLORS: Record<StageOfChange, string> = {
  precontemplation: '#9CA3AF',
  contemplation: '#F59E0B',
  preparation: '#3B82F6',
  action: '#22C55E',
  maintenance: '#8B5CF6',
};

export default function BackpackScreen() {
  const { state, updateBackpackSection, updateKimBackpackSection, updateStageOfChange } = useUser();
  const colors = useColors();
  const [expandedSection, setExpandedSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editingSection, setEditingSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editText, setEditText] = useState('');

  const isKim = state.backpack?.userType === 'kim';
  const sections = state.backpack?.sections ?? [];
  const kimData = state.backpack?.kimBackpack;

  // Progress calculation
  const filledCount = isKim
    ? DEFAULT_KIM_BACKPACK_SECTIONS.filter((s) => (kimData?.[s.id] ?? '').trim().length > 0).length
    : sections.filter((s) => s.content.trim().length > 0).length;
  const totalCount = isKim ? DEFAULT_KIM_BACKPACK_SECTIONS.length : sections.length;

  const currentStage: StageOfChange = state.backpack?.intakeContext?.stageOfChange ?? 'contemplation';

  const handleExpand = useCallback((sectionId: LifePhaseId | KimBackpackSectionId) => {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
      setEditingSection(null);
    } else {
      setExpandedSection(sectionId);
      setEditingSection(null);
    }
  }, [expandedSection]);

  const handleStartEditElias = useCallback((section: LifePhaseSection) => {
    setEditingSection(section.id);
    setEditText(section.content);
  }, []);

  const handleStartEditKim = useCallback((sectionId: KimBackpackSectionId) => {
    setEditingSection(sectionId);
    setEditText(kimData?.[sectionId] ?? '');
  }, [kimData]);

  const handleSave = useCallback(async (sectionId: LifePhaseId | KimBackpackSectionId) => {
    if (isKim) {
      await updateKimBackpackSection(sectionId as KimBackpackSectionId, editText);
    } else {
      await updateBackpackSection(sectionId as LifePhaseId, editText);
    }
    setEditingSection(null);
    if (Platform.OS !== 'web') {
      Alert.alert('Saved', 'Your story has been saved.');
    }
  }, [editText, updateBackpackSection, updateKimBackpackSection, isKim]);

  const handleCancel = useCallback(() => {
    setEditingSection(null);
    setEditText('');
  }, []);

  const handleStageChange = useCallback(async (stage: StageOfChange) => {
    await updateStageOfChange(stage);
    if (Platform.OS !== 'web') {
      Alert.alert('Updated', 'Your stage of change has been updated.');
    }
  }, [updateStageOfChange]);

  // ── Elias Section Renderer ──
  const renderEliasSection = (section: LifePhaseSection) => {
    const isExpanded = expandedSection === section.id;
    const isEditing = editingSection === section.id;
    const hasContent = section.content.trim().length > 0;
    const color = SECTION_COLORS[section.id];
    const icon = SECTION_ICONS[section.id];

    return (
      <View key={section.id} className="mb-4">
        <Pressable
          onPress={() => handleExpand(section.id)}
          style={({ pressed }) => [
            { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View
            className="bg-surface border border-border rounded-2xl p-4"
            style={{ borderLeftWidth: 4, borderLeftColor: color }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 gap-3">
                <Text className="text-2xl">{icon}</Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {section.label}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">{section.ageRange}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                {hasContent && (
                  <View style={{ backgroundColor: `${color}22` }} className="rounded-full px-2 py-0.5">
                    <Text style={{ color }} className="text-xs font-medium">Written</Text>
                  </View>
                )}
                <Text className="text-muted text-lg">{isExpanded ? '\u25B2' : '\u25BC'}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View className="bg-surface/50 border border-border border-t-0 rounded-b-2xl px-4 py-4 -mt-2">
            <View className="bg-background rounded-xl p-3 mb-3 border border-border">
              <Text className="text-sm text-muted italic leading-relaxed">
                {section.prompt}
              </Text>
            </View>

            {isEditing ? (
              <View>
                <TextInput
                  className="bg-background border border-border rounded-xl p-4 text-base text-foreground min-h-[160px]"
                  placeholder="Write your story here... Take your time."
                  placeholderTextColor="#9E9E9E"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  textAlignVertical="top"
                  style={{ lineHeight: 24 }}
                />
                <View className="flex-row gap-3 mt-3">
                  <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.7 : 1, flex: 1 },
                    ]}
                  >
                    <View className="bg-surface border border-border rounded-xl py-3 items-center">
                      <Text className="text-foreground font-medium">Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSave(section.id)}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.7 : 1, flex: 1 },
                    ]}
                  >
                    <View className="bg-primary rounded-xl py-3 items-center">
                      <Text className="text-white font-semibold">Save</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text className="text-base text-foreground leading-relaxed">
                  {section.content}
                </Text>
                {section.lastUpdated && (
                  <Text className="text-xs text-muted mt-2">
                    Last updated: {new Date(section.lastUpdated).toLocaleDateString()}
                  </Text>
                )}
                <Pressable
                  onPress={() => handleStartEditElias(section)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}
                >
                  <View className="bg-surface border border-border rounded-xl py-2.5 items-center">
                    <Text className="text-primary font-medium">Edit</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-muted text-sm mb-3">
                  No story written yet for this phase.
                </Text>
                <Pressable
                  onPress={() => handleStartEditElias(section)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-primary rounded-xl px-6 py-3">
                    <Text className="text-white font-semibold">Start Writing</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Kim Section Renderer ──
  const renderKimSection = (section: KimBackpackSection) => {
    const isExpanded = expandedSection === section.id;
    const isEditing = editingSection === section.id;
    const content = kimData?.[section.id] ?? '';
    const hasContent = content.trim().length > 0;

    return (
      <View key={section.id} className="mb-4">
        <Pressable
          onPress={() => handleExpand(section.id)}
          style={({ pressed }) => [
            { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <View
            className="bg-surface border border-border rounded-2xl p-4"
            style={{ borderLeftWidth: 4, borderLeftColor: section.color }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 gap-3">
                <Text className="text-2xl">{section.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {section.title}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">{section.subtitle}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                {hasContent && (
                  <View style={{ backgroundColor: `${section.color}22` }} className="rounded-full px-2 py-0.5">
                    <Text style={{ color: section.color }} className="text-xs font-medium">Written</Text>
                  </View>
                )}
                <Text className="text-muted text-lg">{isExpanded ? '\u25B2' : '\u25BC'}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View className="bg-surface/50 border border-border border-t-0 rounded-b-2xl px-4 py-4 -mt-2">
            <View className="bg-background rounded-xl p-3 mb-3 border border-border">
              <Text className="text-sm text-muted italic leading-relaxed">
                {section.subtitle}
              </Text>
            </View>

            {isEditing ? (
              <View>
                <TextInput
                  className="bg-background border border-border rounded-xl p-4 text-base text-foreground min-h-[160px]"
                  placeholder="Write your story here... Take your time."
                  placeholderTextColor="#9E9E9E"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  textAlignVertical="top"
                  style={{ lineHeight: 24 }}
                />
                <View className="flex-row gap-3 mt-3">
                  <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.7 : 1, flex: 1 },
                    ]}
                  >
                    <View className="bg-surface border border-border rounded-xl py-3 items-center">
                      <Text className="text-foreground font-medium">Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSave(section.id)}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.7 : 1, flex: 1 },
                    ]}
                  >
                    <View className="bg-primary rounded-xl py-3 items-center">
                      <Text className="text-white font-semibold">Save</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text className="text-base text-foreground leading-relaxed">
                  {content}
                </Text>
                <Pressable
                  onPress={() => handleStartEditKim(section.id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}
                >
                  <View className="bg-surface border border-border rounded-xl py-2.5 items-center">
                    <Text className="text-primary font-medium">Edit</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-muted text-sm mb-3">
                  No story written yet for this section.
                </Text>
                <Pressable
                  onPress={() => handleStartEditKim(section.id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="bg-primary rounded-xl px-6 py-3">
                    <Text className="text-white font-semibold">Start Writing</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground">My Backpack</Text>
          <Text className="text-sm text-muted mt-1 leading-relaxed">
            {isKim
              ? 'Your personal story as a loved one \u2014 it helps Kim truly understand your situation. Write at your own pace. Everything stays on your device and is NEVER modified by the system.'
              : 'Your life story is your identity anchor \u2014 it helps your companion truly know you. Write at your own pace. Everything stays on your device and is NEVER modified by the system.'}
          </Text>
        </View>

        {/* Progress */}
        <View className="bg-surface border border-border rounded-2xl p-4 mb-6">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-foreground">Progress</Text>
            <Text className="text-sm text-muted">{filledCount} of {totalCount} sections</Text>
          </View>
          <View className="flex-row gap-1.5">
            {isKim
              ? DEFAULT_KIM_BACKPACK_SECTIONS.map((s) => (
                  <View
                    key={s.id}
                    className="flex-1 h-2 rounded-full"
                    style={{
                      backgroundColor: (kimData?.[s.id] ?? '').trim().length > 0
                        ? s.color
                        : colors.border,
                    }}
                  />
                ))
              : sections.map((s) => (
                  <View
                    key={s.id}
                    className="flex-1 h-2 rounded-full"
                    style={{
                      backgroundColor: s.content.trim().length > 0
                        ? SECTION_COLORS[s.id]
                        : colors.border,
                    }}
                  />
                ))}
          </View>
        </View>

        {/* Stage of Change — Elias only */}
        {!isKim && state.backpack?.userType === 'elias' && (
        <View className="bg-surface border border-border rounded-2xl p-4 mb-6">
          <Text className="text-base font-semibold text-foreground mb-1">Stage of Change</Text>
          <Text className="text-xs text-muted mb-3 leading-relaxed">
            Where are you in your journey? This helps your companion adjust their approach.
          </Text>
          {STAGE_OF_CHANGE_OPTIONS.map((option) => {
            const isSelected = currentStage === option.value;
            const stageColor = STAGE_COLORS[option.value];
            return (
              <Pressable
                key={option.value}
                onPress={() => handleStageChange(option.value)}
                style={({ pressed }) => [
                  { opacity: pressed ? 0.8 : 1, marginBottom: 8 },
                ]}
              >
                <View
                  className="rounded-xl p-3 border"
                  style={{
                    borderColor: isSelected ? stageColor : colors.border,
                    backgroundColor: isSelected ? `${stageColor}15` : 'transparent',
                    borderWidth: isSelected ? 2 : 1,
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-5 h-5 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? stageColor : 'transparent',
                        borderWidth: isSelected ? 0 : 2,
                        borderColor: colors.border,
                      }}
                    >
                      {isSelected && (
                        <Text className="text-white text-xs font-bold">{'\u2713'}</Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isSelected ? stageColor : colors.foreground }}
                      >
                        {option.label}
                      </Text>
                      <Text className="text-xs text-muted mt-0.5">{option.description}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        )}

        {/* Sections — Kim or Elias */}
        {isKim
          ? DEFAULT_KIM_BACKPACK_SECTIONS.map(renderKimSection)
          : sections.map(renderEliasSection)}

        {/* Tip */}
        <View className="bg-surface border border-border rounded-2xl p-4 mt-2">
          <Text className="text-sm text-muted leading-relaxed">
            <Text className="font-semibold text-foreground">Tip: </Text>
            You can always come back to add or edit your story. Your backpack is
            sent in full to your companion at the start of each conversation —
            it is never summarized or reduced. Only you can change it.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
