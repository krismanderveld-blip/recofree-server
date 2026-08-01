/**
 * Backpack Wizard Screen
 *
 * A guided flow for filling in the Backpack (life story / bilan).
 * Two entry paths:
 *   1. Upload a document → GPT parses it → pre-fills all fields → user reviews/edits → save
 *   2. Manual fill-in → step through each section → save
 *
 * Respects persona (Elias/Kim) — shows the correct sections for each.
 * Gracefully handles incomplete documents — sections that GPT couldn't extract stay empty.
 * User can always edit any field before saving.
 * Supports both intake (new user) and later access (existing user editing).
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { Backpack, UserType, StageOfChange, UrgencyLevel } from '@/lib/ai/types';
import {
  DEFAULT_BACKPACK_SECTIONS,
  DEFAULT_KIM_BACKPACK_SECTIONS,
  createDefaultKimBackpack,
  STAGE_OF_CHANGE_OPTIONS,
} from '@/lib/ai/types';
import { useColors } from '@/hooks/use-colors';
import { useTranslation } from '@/lib/i18n';
import { pickAndParseBackpackDocument, type BackpackExtractedData } from './backpack-document-upload-client';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep =
  | 'choose_method'       // Upload or manual
  | 'uploading'           // Upload in progress
  | 'review_name'         // Review/edit name + userType
  | 'review_sections'     // Review/edit life-phase sections (Elias) or Kim sections
  | 'review_context'      // Review/edit intake context
  | 'done';               // Saved

interface BackpackWizardScreenProps {
  /** Existing backpack to pre-fill (for editing) */
  existingBackpack?: Backpack | null;
  /** The user type (if known from intake) */
  userType?: UserType;
  /** Called when user saves the wizard result */
  onSave: (backpack: Backpack) => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
}

// ─── Section config for Elias ────────────────────────────────────────────────

const ELIAS_SECTION_CONFIG = [
  { id: 'childhood' as const, label: 'Kindertijd', ageRange: '6–12 jaar', emoji: '🧒', color: '#81C784' },
  { id: 'adolescence' as const, label: 'Adolescentie', ageRange: '12–18 jaar', emoji: '🧑', color: '#4DD0E1' },
  { id: 'adulthood' as const, label: 'Volwassenheid', ageRange: '18–50 jaar', emoji: '👤', color: '#7986CB' },
  { id: 'family' as const, label: 'Familie', ageRange: 'Heel het leven', emoji: '👨‍👩‍👧', color: '#FFD54F' },
  { id: 'themes' as const, label: 'Terugkerende thema\'s', ageRange: 'Door alle fases heen', emoji: '🔄', color: '#CE93D8' },
];

// ─── Section config for Kim ──────────────────────────────────────────────────

const KIM_SECTION_CONFIG = [
  { id: 'my_story' as const, label: 'Mijn verhaal', subtitle: 'Wie ben ik buiten deze relatie?', emoji: '👤', color: '#E57373' },
  { id: 'the_relationship' as const, label: 'De relatie', subtitle: 'Hoe is het geëvolueerd? Wanneer veranderde het?', emoji: '🔗', color: '#81C784' },
  { id: 'the_impact' as const, label: 'De impact', subtitle: 'Wat heeft verslaving gedaan met mijn leven?', emoji: '🌊', color: '#4DD0E1' },
  { id: 'my_boundaries' as const, label: 'Mijn grenzen', subtitle: 'Wat kan ik dragen? Wat heb ik al geprobeerd?', emoji: '🛡️', color: '#FFD54F' },
  { id: 'my_strength' as const, label: 'Mijn kracht', subtitle: 'Waar vind ik kracht?', emoji: '💪', color: '#CE93D8' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BackpackWizardScreen({ existingBackpack, userType: initialUserType, onSave, onCancel }: BackpackWizardScreenProps) {
  const colors = useColors();
  const { t } = useTranslation();

  // ─── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('choose_method');
  const [naam, setNaam] = useState(existingBackpack?.naam ?? '');
  const [currentUserType, setCurrentUserType] = useState<UserType>(existingBackpack?.userType ?? initialUserType ?? 'elias');

  // Elias sections content (indexed by section id)
  const [eliasSections, setEliasSections] = useState<Record<string, string>>(() => {
    if (existingBackpack?.sections) {
      const map: Record<string, string> = {};
      existingBackpack.sections.forEach(s => { map[s.id] = s.content; });
      return map;
    }
    return { childhood: '', adolescence: '', adulthood: '', family: '', themes: '' };
  });

  // Kim sections content
  const [kimSections, setKimSections] = useState<Record<string, string>>(() => {
    if (existingBackpack?.kimBackpack) {
      return { ...existingBackpack.kimBackpack };
    }
    return { my_story: '', the_relationship: '', the_impact: '', my_boundaries: '', my_strength: '' };
  });

  // Intake context
  const [startEmotion, setStartEmotion] = useState(existingBackpack?.intakeContext?.startEmotion ?? '');
  const [urgency, setUrgency] = useState<UrgencyLevel>(existingBackpack?.intakeContext?.urgency ?? 'midden');
  const [initialContext, setInitialContext] = useState(existingBackpack?.intakeContext?.initialContext ?? '');
  const [stageOfChange, setStageOfChange] = useState<StageOfChange>(existingBackpack?.intakeContext?.stageOfChange ?? 'contemplation');

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const sectionConfig = useMemo(() =>
    currentUserType === 'kim' ? KIM_SECTION_CONFIG : ELIAS_SECTION_CONFIG,
    [currentUserType]
  );

  const getSectionContent = useCallback((id: string) => {
    return currentUserType === 'kim' ? (kimSections[id] ?? '') : (eliasSections[id] ?? '');
  }, [currentUserType, kimSections, eliasSections]);

  const setSectionContent = useCallback((id: string, value: string) => {
    if (currentUserType === 'kim') {
      setKimSections(prev => ({ ...prev, [id]: value }));
    } else {
      setEliasSections(prev => ({ ...prev, [id]: value }));
    }
  }, [currentUserType]);

  // ─── Upload flow ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    setUploadError(null);
    setStep('uploading');

    const result = await pickAndParseBackpackDocument();

    if (result.cancelled) {
      setStep('choose_method');
      return;
    }

    if (!result.success || !result.data) {
      setUploadError(result.error || t('backpack.wizard.error.upload'));
      setStep('choose_method');
      return;
    }

    // Apply extracted data
    applyExtractedData(result.data);
    setStep('review_name');
  }, []);

  const applyExtractedData = useCallback((data: BackpackExtractedData) => {
    if (data.naam) setNaam(data.naam);
    if (data.userType) setCurrentUserType(data.userType);

    // Elias sections
    if (data.sections) {
      setEliasSections(prev => ({
        ...prev,
        childhood: data.sections.childhood || prev.childhood,
        adolescence: data.sections.adolescence || prev.adolescence,
        adulthood: data.sections.adulthood || prev.adulthood,
        family: data.sections.family || prev.family,
        themes: data.sections.themes || prev.themes,
      }));
    }

    // Kim sections
    if (data.kimSections) {
      setKimSections(prev => ({
        ...prev,
        my_story: data.kimSections.my_story || prev.my_story,
        the_relationship: data.kimSections.the_relationship || prev.the_relationship,
        the_impact: data.kimSections.the_impact || prev.the_impact,
        my_boundaries: data.kimSections.my_boundaries || prev.my_boundaries,
        my_strength: data.kimSections.my_strength || prev.my_strength,
      }));
    }

    // Intake context
    if (data.intakeContext) {
      if (data.intakeContext.startEmotion) setStartEmotion(data.intakeContext.startEmotion);
      if (data.intakeContext.urgency) setUrgency(data.intakeContext.urgency);
      if (data.intakeContext.initialContext) setInitialContext(data.intakeContext.initialContext);
      if (data.intakeContext.stageOfChange) setStageOfChange(data.intakeContext.stageOfChange as StageOfChange);
    }
  }, []);

  // ─── Manual flow ──────────────────────────────────────────────────────────

  const handleManual = useCallback(() => {
    setStep('review_name');
  }, []);

  // ─── Navigation ───────────────────────────────────────────────────────────

  const nextSection = useCallback(() => {
    if (activeSectionIdx < sectionConfig.length - 1) {
      setActiveSectionIdx(activeSectionIdx + 1);
    } else {
      setStep('review_context');
    }
  }, [activeSectionIdx, sectionConfig.length]);

  const prevSection = useCallback(() => {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx(activeSectionIdx - 1);
    } else {
      setStep('review_name');
    }
  }, [activeSectionIdx]);

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const now = LocalDeviceTimeService.now().utcIso;

      // Build sections array for Elias
      const sections = DEFAULT_BACKPACK_SECTIONS.map(s => ({
        ...s,
        content: eliasSections[s.id] ?? '',
        lastUpdated: (eliasSections[s.id] ?? '').length > 0 ? now : null,
      }));

      // Build kimBackpack
      const kimBackpack = currentUserType === 'kim' ? {
        my_story: kimSections.my_story ?? '',
        the_relationship: kimSections.the_relationship ?? '',
        the_impact: kimSections.the_impact ?? '',
        my_boundaries: kimSections.my_boundaries ?? '',
        my_strength: kimSections.my_strength ?? '',
      } : existingBackpack?.kimBackpack ?? createDefaultKimBackpack();

      const finalBackpack: Backpack = {
        naam: naam.trim(),
        userType: currentUserType,
        sections,
        kimBackpack,
        // Preserve existing VSP and balkmetafoor
        vspSection: existingBackpack?.vspSection,
        balkmetafoor: existingBackpack?.balkmetafoor,
        intakeContext: {
          ...(currentUserType === 'elias' ? { stageOfChange } : {}),
          ...(existingBackpack?.intakeContext?.eigenRegieLevel != null
            ? { eigenRegieLevel: existingBackpack.intakeContext.eigenRegieLevel }
            : {}),
          startEmotion,
          urgency,
          initialContext,
          intakeDate: existingBackpack?.intakeContext?.intakeDate ?? now,
        },
        createdAt: existingBackpack?.createdAt ?? now,
      };

      await onSave(finalBackpack);
      setStep('done');
    } catch (err) {
      if (Platform.OS !== 'web') Alert.alert('Error', 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [naam, currentUserType, eliasSections, kimSections, startEmotion, urgency, initialContext, stageOfChange, existingBackpack, onSave]);

  // ─── Render: Choose Method ────────────────────────────────────────────────

  const renderChooseMethod = () => (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24 }}>
      <View style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 28 }}>{'🎒'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, textAlign: 'center' }}>
          {t('backpack.wizard.choose_method.title')}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
          {t('backpack.wizard.choose_method.description')}
        </Text>
      </View>

      {uploadError && (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14 }}>
          <Text style={{ fontSize: 13, color: '#B91C1C', lineHeight: 18 }}>{uploadError}</Text>
        </View>
      )}

      {/* Upload option */}
      <Pressable onPress={handleUpload} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>{'📄'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                {t('backpack.wizard.upload.title')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 }}>
                {t('backpack.wizard.upload.description')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Manual option */}
      <Pressable onPress={handleManual} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>{'✏️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                {t('backpack.wizard.manual.title')}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 }}>
                {t('backpack.wizard.manual.description')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Cancel */}
      <Pressable onPress={onCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, alignSelf: 'center', marginTop: 8 }]}>
        <Text style={{ fontSize: 14, color: colors.muted }}>{t('backpack.wizard.cancel')}</Text>
      </Pressable>
    </View>
  );

  // ─── Render: Uploading ────────────────────────────────────────────────────

  const renderUploading = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>{t('backpack.wizard.uploading.title')}</Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>
        {t('backpack.wizard.uploading.description')}
      </Text>
    </View>
  );

  // ─── Render: Name + UserType ──────────────────────────────────────────────

  const renderNameStep = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('backpack.wizard.name.title')}
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 24, lineHeight: 18 }}>
        {t('backpack.wizard.name.description')}
      </Text>

      {/* Name */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        {t('backpack.wizard.name.label')}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          fontSize: 16,
          color: colors.foreground,
          marginBottom: 24,
        }}
        placeholder={t('backpack.wizard.name.placeholder')}
        placeholderTextColor={colors.muted}
        value={naam}
        onChangeText={setNaam}
        autoCapitalize="words"
        returnKeyType="done"
      />

      {/* User Type */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        {t('backpack.wizard.name.iam')}
      </Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        <Pressable
          onPress={() => setCurrentUserType('elias')}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{
            backgroundColor: currentUserType === 'elias' ? colors.primary + '15' : colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1.5,
            borderColor: currentUserType === 'elias' ? colors.primary : colors.border,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
              {t('backpack.wizard.name.elias.title')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {t('backpack.wizard.name.elias.description')}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setCurrentUserType('kim')}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{
            backgroundColor: currentUserType === 'kim' ? colors.primary + '15' : colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1.5,
            borderColor: currentUserType === 'kim' ? colors.primary : colors.border,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
              {t('backpack.wizard.name.kim.title')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              {t('backpack.wizard.name.kim.description')}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Next */}
      <Pressable
        onPress={() => { setActiveSectionIdx(0); setStep('review_sections'); }}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
            {t('backpack.wizard.name.next')}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );

  // ─── Render: Section Editor ───────────────────────────────────────────────

  const renderSectionEditor = () => {
    const section = sectionConfig[activeSectionIdx];
    const content = getSectionContent(section.id);
    const progress = `${activeSectionIdx + 1} / ${sectionConfig.length}`;
    const subtitle = currentUserType === 'kim'
      ? (section as typeof KIM_SECTION_CONFIG[number]).subtitle
      : (section as typeof ELIAS_SECTION_CONFIG[number]).ageRange;

    // Get the prompt for this section
    const prompt = currentUserType === 'kim'
      ? DEFAULT_KIM_BACKPACK_SECTIONS.find(s => s.id === section.id)?.subtitle ?? ''
      : DEFAULT_BACKPACK_SECTIONS.find(s => s.id === section.id)?.prompt ?? '';

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Progress bar */}
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
            {sectionConfig.map((s, i) => (
              <View key={s.id} style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= activeSectionIdx ? s.color : colors.border,
              }} />
            ))}
          </View>

          {/* Section header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Text style={{ fontSize: 22 }}>{section.emoji}</Text>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{section.label}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{subtitle}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>{progress}</Text>

          {/* Prompt hint */}
          {prompt ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, fontStyle: 'italic' }}>{prompt}</Text>
            </View>
          ) : null}

          {/* Content field */}
          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
              fontSize: 14,
              color: colors.foreground,
              minHeight: 200,
              textAlignVertical: 'top',
              lineHeight: 20,
            }}
            placeholder={t('backpack.wizard.section.placeholder')}
            placeholderTextColor={colors.muted}
            value={content}
            onChangeText={(text) => setSectionContent(section.id, text)}
            multiline
          />

          {/* Character count */}
          <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 4 }}>
            {content.length} characters
          </Text>

          {/* Navigation */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable onPress={prevSection} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                  {activeSectionIdx === 0 ? t('backpack.wizard.section.back_to_name') : t('backpack.wizard.section.previous')}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={nextSection} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
              <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {activeSectionIdx < sectionConfig.length - 1 ? t('backpack.wizard.section.next') : t('backpack.wizard.section.to_context')}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Skip hint */}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
            {t('backpack.wizard.section.skip_hint')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ─── Render: Intake Context ───────────────────────────────────────────────

  const renderContextStep = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        {t('backpack.wizard.context.title')}
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 24, lineHeight: 18 }}>
        {t('backpack.wizard.context.description')}
      </Text>

      {/* Start emotion */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        {t('backpack.wizard.context.feeling.label')}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          fontSize: 14,
          color: colors.foreground,
          marginBottom: 20,
        }}
        placeholder={t('backpack.wizard.context.feeling.placeholder')}
        placeholderTextColor={colors.muted}
        value={startEmotion}
        onChangeText={setStartEmotion}
      />

      {/* Initial context */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        {t('backpack.wizard.context.why.label')}
      </Text>
      <TextInput
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          fontSize: 14,
          color: colors.foreground,
          minHeight: 80,
          textAlignVertical: 'top',
          lineHeight: 20,
          marginBottom: 20,
        }}
        placeholder={t('backpack.wizard.context.why.placeholder')}
        placeholderTextColor={colors.muted}
        value={initialContext}
        onChangeText={setInitialContext}
        multiline
      />

      {/* Urgency */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        {t('backpack.wizard.context.urgency.label')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {(['laag', 'midden', 'hoog'] as UrgencyLevel[]).map(level => (
          <Pressable
            key={level}
            onPress={() => setUrgency(level)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}
          >
            <View style={{
              backgroundColor: urgency === level ? colors.primary + '15' : colors.surface,
              borderRadius: 10,
              padding: 12,
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: urgency === level ? colors.primary : colors.border,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: urgency === level ? colors.primary : colors.foreground }}>
                {level === 'laag' ? t('backpack.wizard.context.urgency.low') : level === 'midden' ? t('backpack.wizard.context.urgency.medium') : t('backpack.wizard.context.urgency.high')}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Stage of Change (Elias only) */}
      {currentUserType === 'elias' && (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
            {t('backpack.stage_of_change.description')}
          </Text>
          <View style={{ gap: 8, marginBottom: 24 }}>
            {STAGE_OF_CHANGE_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => setStageOfChange(opt.value)}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={{
                  backgroundColor: stageOfChange === opt.value ? colors.primary + '15' : colors.surface,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1.5,
                  borderColor: stageOfChange === opt.value ? colors.primary : colors.border,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: stageOfChange === opt.value ? colors.primary : colors.foreground }}>
                    {t(`backpack.stage.${opt.value}.label`)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t(`backpack.stage.${opt.value}.description`)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Navigation */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={() => { setActiveSectionIdx(sectionConfig.length - 1); setStep('review_sections'); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t('backpack.wizard.context.back')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: '#22C55E', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{t('backpack.wizard.context.save')}</Text>
            )}
          </View>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
        {t('backpack.wizard.context.edit_later')}
      </Text>
    </ScrollView>
  );

  // ─── Render: Done ─────────────────────────────────────────────────────────

  const renderDone = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <Text style={{ fontSize: 48 }}>{'✅'}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>{t('backpack.wizard.done.title')}</Text>
      <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
        {currentUserType === 'elias'
          ? t('backpack.wizard.done.elias')
          : t('backpack.wizard.done.kim')}
      </Text>
      <Pressable onPress={onCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 16 }]}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{t('backpack.wizard.done.close')}</Text>
        </View>
      </Pressable>
    </View>
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  switch (step) {
    case 'choose_method': return renderChooseMethod();
    case 'uploading': return renderUploading();
    case 'review_name': return renderNameStep();
    case 'review_sections': return renderSectionEditor();
    case 'review_context': return renderContextStep();
    case 'done': return renderDone();
    default: return renderChooseMethod();
  }
}
