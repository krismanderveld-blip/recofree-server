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
import { pickAndParseBackpackDocument, type BackpackExtractedData } from './backpack-document-upload-client';

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
  { id: 'childhood' as const, label: 'Childhood', ageRange: '6–12 years', emoji: '🧒', color: '#81C784' },
  { id: 'adolescence' as const, label: 'Adolescence', ageRange: '12–18 years', emoji: '🧑', color: '#4DD0E1' },
  { id: 'adulthood' as const, label: 'Adulthood', ageRange: '18–50 years', emoji: '👤', color: '#7986CB' },
  { id: 'family' as const, label: 'Family', ageRange: 'Throughout life', emoji: '👨‍👩‍👧', color: '#FFD54F' },
  { id: 'themes' as const, label: 'Recurring Themes', ageRange: 'Across all phases', emoji: '🔄', color: '#CE93D8' },
];

// ─── Section config for Kim ──────────────────────────────────────────────────

const KIM_SECTION_CONFIG = [
  { id: 'my_story' as const, label: 'My Story', subtitle: 'Who am I outside of this relationship?', emoji: '👤', color: '#E57373' },
  { id: 'the_relationship' as const, label: 'The Relationship', subtitle: 'How did it evolve? When did it change?', emoji: '🔗', color: '#81C784' },
  { id: 'the_impact' as const, label: 'The Impact', subtitle: 'What has addiction done to my life?', emoji: '🌊', color: '#4DD0E1' },
  { id: 'my_boundaries' as const, label: 'My Boundaries', subtitle: 'What can I carry? What have I tried?', emoji: '🛡️', color: '#FFD54F' },
  { id: 'my_strength' as const, label: 'My Strength', subtitle: 'Where do I find strength?', emoji: '💪', color: '#CE93D8' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function BackpackWizardScreen({ existingBackpack, userType: initialUserType, onSave, onCancel }: BackpackWizardScreenProps) {
  const colors = useColors();

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
      setUploadError(result.error || 'Something went wrong while processing the document.');
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
      const now = new Date().toISOString();

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
        <Text style={{ fontSize: 28 }}>{'\u{1F392}'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, textAlign: 'center' }}>
          Fill in your Backpack
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
          Your life story helps the AI understand you better. You can upload a document or fill it in step by step.
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
            <Text style={{ fontSize: 24 }}>{'\u{1F4C4}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                Upload life story document
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 }}>
                Upload your bilan or life story (Word or text). Fields will be filled in automatically.
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
            <Text style={{ fontSize: 24 }}>{'\u{270F}\u{FE0F}'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                Fill in manually
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 }}>
                Fill in your story step by step per life phase. You can skip sections and come back later.
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Cancel */}
      <Pressable onPress={onCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, alignSelf: 'center', marginTop: 8 }]}>
        <Text style={{ fontSize: 14, color: colors.muted }}>Cancel</Text>
      </Pressable>
    </View>
  );

  // ─── Render: Uploading ────────────────────────────────────────────────────

  const renderUploading = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>Processing document...</Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>
        Your life story is being read and the sections will be filled in automatically. This may take a moment.
      </Text>
    </View>
  );

  // ─── Render: Name + UserType ──────────────────────────────────────────────

  const renderNameStep = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        About you
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 24, lineHeight: 18 }}>
        This helps the AI address you personally and understand your perspective.
      </Text>

      {/* Name */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        Your first name
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
        placeholder="Your name"
        placeholderTextColor={colors.muted}
        value={naam}
        onChangeText={setNaam}
        autoCapitalize="words"
        returnKeyType="done"
      />

      {/* User Type */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        I am...
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
              Someone in recovery
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              I deal with addiction myself and want support in my recovery.
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
              A loved one
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
              Someone close to me deals with addiction and I need support too.
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
            Next: Life story sections
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
            placeholder="Write your story here..."
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
                  {activeSectionIdx === 0 ? 'Back to name' : 'Previous'}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={nextSection} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
              <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                  {activeSectionIdx < sectionConfig.length - 1 ? 'Next section' : 'To context'}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Skip hint */}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
            Nothing for this section? Leave it empty and continue.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ─── Render: Intake Context ───────────────────────────────────────────────

  const renderContextStep = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 8 }}>
        Your current situation
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 24, lineHeight: 18 }}>
        This helps the AI understand where you are right now. You can update this later.
      </Text>

      {/* Start emotion */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        How are you feeling right now?
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
        placeholder="e.g. anxious, hopeful, exhausted..."
        placeholderTextColor={colors.muted}
        value={startEmotion}
        onChangeText={setStartEmotion}
      />

      {/* Initial context */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        Why are you here? (in your own words)
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
        placeholder="What brings you to this app?"
        placeholderTextColor={colors.muted}
        value={initialContext}
        onChangeText={setInitialContext}
        multiline
      />

      {/* Urgency */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
        How urgent does it feel?
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
                {level === 'laag' ? 'Low' : level === 'midden' ? 'Medium' : 'High'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Stage of Change (Elias only) */}
      {currentUserType === 'elias' && (
        <>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
            Where are you in your change process?
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
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{opt.description}</Text>
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
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Back</Text>
          </View>
        </Pressable>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: '#22C55E', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Save Backpack</Text>
            )}
          </View>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
        You can always edit your backpack later.
      </Text>
    </ScrollView>
  );

  // ─── Render: Done ─────────────────────────────────────────────────────────

  const renderDone = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <Text style={{ fontSize: 48 }}>{'\u2705'}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>Backpack saved!</Text>
      <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
        {currentUserType === 'elias'
          ? 'Elias now knows your story and can guide you more personally.'
          : 'Kim now knows your story and can support you more personally.'}
      </Text>
      <Pressable onPress={onCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 16 }]}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Close</Text>
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
