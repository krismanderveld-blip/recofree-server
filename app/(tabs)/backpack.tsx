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
import { fixUnicode } from '@/lib/utils';
import { useUser } from '@/lib/user-context';
import type { LifePhaseId, LifePhaseSection, StageOfChange, KimBackpackSectionId } from '@/lib/ai/types';
import { STAGE_OF_CHANGE_OPTIONS, DEFAULT_KIM_BACKPACK_SECTIONS } from '@/lib/ai/types';
import type { KimBackpackSection } from '@/lib/ai/types';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { VspSectionEditor } from '@/components/vsp-section-editor';
import { VspWizardScreen } from '@/lib/features/vspWizard/VspWizardScreen';
import { colors as dc, spacing, radius, typography, shadows, cardStyles, buttonStyles } from '@/constants/design';

const SECTION_COLORS: Record<LifePhaseId, string> = {
  childhood: '#FF6B6B',
  adolescence: '#4ECDC4',
  adulthood: '#45B7D1',
  family: '#96CEB4',
  themes: '#FFEAA7',
  vsp: '#B39DDB',
};

const SECTION_ICONS: Record<LifePhaseId, string> = {
  childhood: '\u{1F9D2}',
  adolescence: '\u{1F331}',
  adulthood: '\u{1F3E0}',
  family: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}',
  themes: '\u{1F504}',
  vsp: '\u{1F6E1}',
};

const STAGE_COLORS: Record<StageOfChange, string> = {
  precontemplation: '#9CA3AF',
  contemplation: '#F59E0B',
  preparation: '#3B82F6',
  action: '#22C55E',
  maintenance: '#8B5CF6',
};

export default function BackpackScreen() {
  const { state, updateBackpackSection, updateKimBackpackSection, updateStageOfChange, updateVspSection } = useUser();
  const colors = useColors();
  const [expandedSection, setExpandedSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editingSection, setEditingSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editText, setEditText] = useState('');

  const [showVspWizard, setShowVspWizard] = useState(false);
  const isKim = state.backpack?.userType === 'kim';
  const sections = state.backpack?.sections ?? [];
  const kimData = state.backpack?.kimBackpack;

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

  const renderEliasSection = (section: LifePhaseSection) => {
    const isExpanded = expandedSection === section.id;
    const isEditing = editingSection === section.id;
    const hasContent = section.content.trim().length > 0;
    const color = SECTION_COLORS[section.id];
    const icon = SECTION_ICONS[section.id];

    return (
      <View key={section.id} style={{ marginBottom: 12 }}>
        <Pressable
          onPress={() => handleExpand(section.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: color,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{section.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{section.ageRange}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasContent && (
                  <View style={{ backgroundColor: color + '20', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color, fontWeight: '500' }}>Written</Text>
                  </View>
                )}
                <Text style={{ color: colors.muted }}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 16, marginTop: -4 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: 'italic', lineHeight: 18 }}>{section.prompt}</Text>
            </View>

            {isEditing ? (
              <View>
                <TextInput
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, fontSize: 15, color: colors.foreground, minHeight: 160, textAlignVertical: 'top', lineHeight: 24 }}
                  placeholder="Write your story here... Take your time."
                  placeholderTextColor="#9CA3AF"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Pressable onPress={handleCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleSave(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{fixUnicode(section.content)}</Text>
                {section.lastUpdated && (
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>Last updated: {new Date(section.lastUpdated).toLocaleDateString()}</Text>
                )}
                <Pressable onPress={() => handleStartEditElias(section)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '500' }}>Edit</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>No story written yet for this phase.</Text>
                <Pressable onPress={() => handleStartEditElias(section)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Start Writing</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderKimSection = (section: KimBackpackSection) => {
    const isExpanded = expandedSection === section.id;
    const isEditing = editingSection === section.id;
    const content = kimData?.[section.id] ?? '';
    const hasContent = content.trim().length > 0;

    return (
      <View key={section.id} style={{ marginBottom: 12 }}>
        <Pressable
          onPress={() => handleExpand(section.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: section.color,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{section.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{section.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{section.subtitle}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasContent && (
                  <View style={{ backgroundColor: section.color + '20', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: section.color, fontWeight: '500' }}>Written</Text>
                  </View>
                )}
                <Text style={{ color: colors.muted }}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 16, marginTop: -4 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: 'italic', lineHeight: 18 }}>{section.subtitle}</Text>
            </View>

            {isEditing ? (
              <View>
                <TextInput
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, fontSize: 15, color: colors.foreground, minHeight: 160, textAlignVertical: 'top', lineHeight: 24 }}
                  placeholder="Write your story here... Take your time."
                  placeholderTextColor="#9CA3AF"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Pressable onPress={handleCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleSave(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{fixUnicode(content)}</Text>
                <Pressable onPress={() => handleStartEditKim(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '500' }}>Edit</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>No story written yet for this section.</Text>
                <Pressable onPress={() => handleStartEditKim(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Start Writing</Text>
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
    <ScreenContainer containerClassName="bg-backgroundWarm">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.screenHorizontal, paddingTop: spacing.screenTop }}>
        <Text style={{ ...typography.titleLarge, color: dc.textPrimary, marginBottom: spacing.lg }}>Your Story</Text>
        {/* Description Card */}
        <View style={{ ...cardStyles.default, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodySmall, color: dc.textSecondary, lineHeight: 20 }}>
              {isKim
                ? 'Your personal story as a loved one — it helps Kim truly understand your situation. Write at your own pace. Everything stays on your device and is NEVER modified by the system.'
                : 'Your life story is your identity anchor — it helps your companion truly know you. Write at your own pace. Everything stays on your device and is NEVER modified by the system.'}
            </Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dc.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="backpack.fill" size={18} color={dc.primary} />
          </View>
        </View>

        {/* Progress */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>Progress</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{filledCount} of {totalCount} sections</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {isKim
              ? DEFAULT_KIM_BACKPACK_SECTIONS.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: (kimData?.[s.id] ?? '').trim().length > 0 ? colors.primary : colors.border,
                    }}
                  />
                ))
              : sections.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: s.content.trim().length > 0 ? colors.primary : colors.border,
                    }}
                  />
                ))}
          </View>
        </View>

        {/* Stage of Change */}
        {!isKim && state.backpack?.userType === 'elias' && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>Stage of Change</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
              Where are you in your journey? This helps your companion adjust their approach.
            </Text>
            {STAGE_OF_CHANGE_OPTIONS.map((option) => {
              const isSelected = currentStage === option.value;
              const stageColor = STAGE_COLORS[option.value];
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleStageChange(option.value)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 8 }]}
                >
                  <View style={{
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? stageColor : colors.border,
                    backgroundColor: isSelected ? stageColor + '12' : '#fff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: isSelected ? stageColor : 'transparent',
                      borderWidth: isSelected ? 0 : 2,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{'\u2713'}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isSelected ? stageColor : colors.foreground }}>{option.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{option.description}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* VSP Section (Elias only) */}
        {!isKim && state.backpack?.userType === 'elias' && (
          <View>
            {/* Wizard button */}
            <Pressable onPress={() => setShowVspWizard(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 12 }]}>
              <View style={{ backgroundColor: '#8B5CF620', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#8B5CF640' }}>
                <Text style={{ fontSize: 20 }}>{"\u{1F4C4}"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>VSP Wizard</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Upload een document of vul stap voor stap in</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.muted }}>{"\u{203A}"}</Text>
              </View>
            </Pressable>
            <VspSectionEditor
              vspPlan={state.backpack?.vspSection}
              onSave={updateVspSection}
            />
          </View>
        )}

        {/* Life Phase Sections */}
        {isKim
          ? DEFAULT_KIM_BACKPACK_SECTIONS.map(renderKimSection)
          : sections.map(renderEliasSection)}

        {/* Tip */}
        <View style={{ ...cardStyles.default, marginTop: spacing.sm }}>
          <Text style={{ ...typography.bodySmall, color: dc.textTertiary, lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: dc.textPrimary }}>Tip: </Text>
            You can always come back to add or edit your story. Your backpack is sent in full to your companion at the start of each conversation — it is never summarized or reduced. Only you can change it.
          </Text>
        </View>
      </ScrollView>

      {/* VSP Wizard Modal Overlay */}
      {showVspWizard && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 100 }}>
          <VspWizardScreen
            existingPlan={state.backpack?.vspSection}
            onSave={async (plan) => {
              await updateVspSection(plan);
            }}
            onCancel={() => setShowVspWizard(false)}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
