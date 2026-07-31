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
import { BackpackWizardScreen } from '@/lib/features/backpackWizard/BackpackWizardScreen';
import { colors as dc, spacing, radius, typography, shadows, cardStyles, buttonStyles } from '@/constants/design';
import { HomeButton } from '@/components/home-button';
import { useTranslation } from '@/lib/i18n';

const SECTION_COLORS: Record<LifePhaseId, string> = {
  childhood: '#FF6B6B',
  adolescence: '#4ECDC4',
  adulthood: '#45B7D1',
  family: '#96CEB4',
  themes: '#FFEAA7',
  vsp: '#B39DDB',
};

const SECTION_ICONS: Record<LifePhaseId, string> = {
  childhood: '🧒',
  adolescence: '🌱',
  adulthood: '🏠',
  family: '👨‍👩‍👧‍👦',
  themes: '🔄',
  vsp: '🛡',
};

const STAGE_COLORS: Record<StageOfChange, string> = {
  precontemplation: '#9CA3AF',
  contemplation: '#F59E0B',
  preparation: '#3B82F6',
  action: '#22C55E',
  maintenance: '#8B5CF6',
};

export default function BackpackScreen() {
  const { state, updateBackpackSection, updateKimBackpackSection, updateStageOfChange, updateVspSection, replaceBackpack, recordRelapseEvent } = useUser();
  const colors = useColors();
  const [expandedSection, setExpandedSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editingSection, setEditingSection] = useState<LifePhaseId | KimBackpackSectionId | null>(null);
  const [editText, setEditText] = useState('');

  const [showVspWizard, setShowVspWizard] = useState(false);
  const [showBackpackWizard, setShowBackpackWizard] = useState(false);
  const { t } = useTranslation();
  const isKim = state.backpack?.userType === 'kim';
  const sections = state.backpack?.sections ?? [];
  const kimData = state.backpack?.kimBackpack;

  const narrativeSections = sections.filter((s) => s.id !== 'vsp');
  const filledCount = isKim
    ? DEFAULT_KIM_BACKPACK_SECTIONS.filter((s) => (kimData?.[s.id] ?? '').trim().length > 0).length
    : narrativeSections.filter((s) => s.content.trim().length > 0).length;
  const totalCount = isKim ? DEFAULT_KIM_BACKPACK_SECTIONS.length : narrativeSections.length;

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
      Alert.alert(t('backpack.alert.saved.title'), t('backpack.alert.saved.message'));
    }
  }, [editText, updateBackpackSection, updateKimBackpackSection, isKim]);

  const handleCancel = useCallback(() => {
    setEditingSection(null);
    setEditText('');
  }, []);

  const handleStageChange = useCallback(async (stage: StageOfChange) => {
    await updateStageOfChange(stage);
    if (Platform.OS !== 'web') {
      Alert.alert(t('backpack.alert.updated.title'), t('backpack.alert.updated.message'));
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
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{t(`backpack.section.${section.id}.label`)}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t(`backpack.section.${section.id}.age_range`)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasContent && (
                  <View style={{ backgroundColor: color + '20', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color, fontWeight: '500' }}>{t('backpack.kim_section.written')}</Text>
                  </View>
                )}
                <Text style={{ color: colors.muted }}>{isExpanded ? '▲' : '▼'}</Text>
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
                  placeholder={t('backpack.kim_section.placeholder')}
                  placeholderTextColor="#9CA3AF"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Pressable onPress={handleCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>{t('backpack.kim_section.cancel')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleSave(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('backpack.kim_section.save')}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{fixUnicode(section.content)}</Text>
                {section.lastUpdated && (
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>{t('backpack.section.last_updated')}{new Date(section.lastUpdated).toLocaleDateString()}</Text>
                )}
                <Pressable onPress={() => handleStartEditElias(section)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '500' }}>{t('backpack.kim_section.edit')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>{t('backpack.elias_section.no_story')}</Text>
                <Pressable onPress={() => handleStartEditElias(section)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('backpack.kim_section.start_writing')}</Text>
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
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{t(`backpack.kim.${section.id}.title`)}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t(`backpack.kim.${section.id}.subtitle`)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasContent && (
                  <View style={{ backgroundColor: section.color + '20', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: section.color, fontWeight: '500' }}>{t('backpack.elias_section.written')}</Text>
                  </View>
                )}
                <Text style={{ color: colors.muted }}>{isExpanded ? '▲' : '▼'}</Text>
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
                  placeholder={t('backpack.elias_section.placeholder')}
                  placeholderTextColor="#9CA3AF"
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Pressable onPress={handleCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>{t('backpack.elias_section.cancel')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleSave(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('backpack.elias_section.save')}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : hasContent ? (
              <View>
                <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 22 }}>{fixUnicode(content)}</Text>
                <Pressable onPress={() => handleStartEditKim(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 12 }]}>
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '500' }}>{t('backpack.elias_section.edit')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>{t('backpack.kim_section.no_story')}</Text>
                <Pressable onPress={() => handleStartEditKim(section.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('backpack.elias_section.start_writing')}</Text>
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
        <HomeButton />
        <Text style={{ ...typography.titleLarge, color: dc.textPrimary, marginBottom: spacing.lg }}>{t('backpack.title')}</Text>
        {/* Description Card */}
        <View style={{ ...cardStyles.default, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodySmall, color: dc.textSecondary, lineHeight: 20 }}>
              {isKim
                ? t('backpack.description.kim')
                : t('backpack.description.elias')}
            </Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dc.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="backpack.fill" size={18} color={dc.primary} />
          </View>
        </View>

        {/* Progress */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>{t('backpack.progress.title')}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{t('backpack.progress.counter', { filled: filledCount, total: totalCount })}</Text>
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
              : narrativeSections.map((s) => (
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
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>{t('backpack.stage_of_change.title')}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
              {t('backpack.stage_of_change.description')}
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
                      {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{'✓'}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isSelected ? stageColor : colors.foreground }}>{t(`backpack.stage.${option.value}.label`)}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t(`backpack.stage.${option.value}.description`)}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Terugval of Herval subsection (Elias only, below Stage of Change) */}
        {!isKim && state.backpack?.userType === 'elias' && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>{t('backpack.relapse.title')}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
              {t('backpack.relapse.description')}
            </Text>
            {/* Herval button */}
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (confirm(t('backpack.relapse.confirm_herval_message'))) {
                    recordRelapseEvent('herval');
                  }
                } else {
                  Alert.alert(
                    t('backpack.relapse.confirm_herval_title'),
                    t('backpack.relapse.confirm_herval_message'),
                    [
                      { text: t('backpack.relapse.cancel'), style: 'cancel' },
                      { text: t('backpack.relapse.confirm'), style: 'destructive', onPress: () => recordRelapseEvent('herval') },
                    ]
                  );
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 8 }]}
            >
              <View style={{
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.error + '60',
                backgroundColor: colors.error + '08',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{'!'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.error }}>{t('backpack.relapse.herval_button')}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('backpack.relapse.herval_description')}</Text>
                </View>
              </View>
            </Pressable>
            {/* Terugval button */}
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (confirm(t('backpack.relapse.confirm_terugval_message'))) {
                    recordRelapseEvent('terugval');
                  }
                } else {
                  Alert.alert(
                    t('backpack.relapse.confirm_terugval_title'),
                    t('backpack.relapse.confirm_terugval_message'),
                    [
                      { text: t('backpack.relapse.cancel'), style: 'cancel' },
                      { text: t('backpack.relapse.confirm'), onPress: () => recordRelapseEvent('terugval') },
                    ]
                  );
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 8 }]}
            >
              <View style={{
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.warning + '60',
                backgroundColor: colors.warning + '08',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{'~'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.warning }}>{t('backpack.relapse.terugval_button')}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('backpack.relapse.terugval_description')}</Text>
                </View>
              </View>
            </Pressable>
            {/* Show last event if exists */}
            {(() => {
              const events = state.userDat?.relapseEvents ?? [];
              const lastEvent = events.length > 0 ? events[events.length - 1] : null;
              if (!lastEvent) return null;
              const dateStr = lastEvent.timestamp.slice(0, 10);
              return (
                <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>
                    {t('backpack.relapse.last_event')}: {lastEvent.type === 'herval'
                      ? t('backpack.relapse.herval_recorded', { date: dateStr })
                      : t('backpack.relapse.terugval_recorded', { date: dateStr })}
                  </Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* Backpack Wizard CTA */}
        <Pressable onPress={() => setShowBackpackWizard(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 16 }]}>
          <View style={{ backgroundColor: '#3B82F620', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#3B82F640' }}>
            <Text style={{ fontSize: 20 }}>{"📝"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t('backpack.wizard.title')}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{t('backpack.wizard.description')}</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.muted }}>{"›"}</Text>
          </View>
        </Pressable>

        {/* Life Phase Sections (VSP excluded — shown separately below as My Safety Plan) */}
        {isKim
          ? DEFAULT_KIM_BACKPACK_SECTIONS.map(renderKimSection)
          : sections.filter(s => s.id !== 'vsp').map(renderEliasSection)}

        {/* My Safety Plan Section (Elias only) — placed after life story sections */}
        {!isKim && state.backpack?.userType === 'elias' && (
          <View style={{ marginTop: 16 }}>
            {/* Wizard button */}
            <Pressable onPress={() => setShowVspWizard(true)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginBottom: 12 }]}>
              <View style={{ backgroundColor: '#8B5CF620', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#8B5CF640' }}>
                <Text style={{ fontSize: 20 }}>{"📄"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t('backpack.vsp.title')}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{t('backpack.vsp.description')}</Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.muted }}>{"›"}</Text>
              </View>
            </Pressable>
            <VspSectionEditor
              vspPlan={state.backpack?.vspSection}
              onSave={updateVspSection}
            />
          </View>
        )}

        {/* Tip */}
        <View style={{ ...cardStyles.default, marginTop: spacing.sm }}>
          <Text style={{ ...typography.bodySmall, color: dc.textTertiary, lineHeight: 20 }}>
            <Text style={{ fontWeight: '600', color: dc.textPrimary }}>{t('backpack.tip.label')}</Text>
            {t('backpack.tip.content')}
          </Text>
        </View>
      </ScrollView>

      {/* Backpack Wizard Modal Overlay */}
      {showBackpackWizard && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 100 }}>
          <BackpackWizardScreen
            existingBackpack={state.backpack ?? undefined}
            userType={state.backpack?.userType ?? 'elias'}
            onSave={async (newBackpack) => {
              await replaceBackpack(newBackpack);
              setShowBackpackWizard(false);
            }}
            onCancel={() => setShowBackpackWizard(false)}
          />
        </View>
      )}

      {/* My Safety Plan Wizard Modal Overlay */}
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
