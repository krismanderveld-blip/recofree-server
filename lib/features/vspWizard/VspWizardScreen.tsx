/**
 * VSP Wizard Screen
 *
 * A guided flow for filling in the VSP (Vroegsignaleringsplan).
 * Two entry paths:
 *   1. Upload a document → GPT parses it → pre-fills all fields → user reviews/edits → save
 *   2. Manual fill-in → step through each zone → save
 *
 * Gracefully handles incomplete documents — zones that GPT couldn't extract stay empty.
 * User can always edit any field before saving.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import type { VspStructuredPlan, VspZoneEntry, VspTrigger } from '@/lib/ai/types';
import { DEFAULT_VSP_STRUCTURED_PLAN } from '@/lib/ai/types';
import { useColors } from '@/hooks/use-colors';
import { pickAndParseVspDocument } from './vsp-document-upload-client';

// ─── Types ───────────────────────────────────────────────────────────────────

type ZoneKey = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

type WizardStep =
  | 'choose_method'   // Upload or manual
  | 'uploading'       // Upload in progress
  | 'review_zones'    // Review/edit parsed zones
  | 'review_triggers' // Review/edit triggers
  | 'review_rules'    // Review/edit recovery rules
  | 'done';           // Saved

interface VspWizardScreenProps {
  existingPlan?: VspStructuredPlan;
  onSave: (plan: VspStructuredPlan) => Promise<void>;
  onCancel: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONE_CONFIG: { key: ZoneKey; label: string; dutchLabel: string; color: string; emoji: string }[] = [
  { key: 'green', label: 'Green', dutchLabel: 'Stable & present', color: '#22C55E', emoji: '🟢' },
  { key: 'yellow', label: 'Yellow', dutchLabel: 'First warning signs', color: '#EAB308', emoji: '🟡' },
  { key: 'orange', label: 'Orange', dutchLabel: 'Active intervention', color: '#F97316', emoji: '🟠' },
  { key: 'red', label: 'Red', dutchLabel: 'Not safe alone', color: '#EF4444', emoji: '🔴' },
  { key: 'purple', label: 'Purple', dutchLabel: 'Crisis / relapse', color: '#8B5CF6', emoji: '🟣' },
];

const FIELD_CONFIG: { key: keyof VspZoneEntry; label: string; placeholder: string; lines: number }[] = [
  { key: 'signals', label: 'How do I recognize myself?', placeholder: 'Describe your signals, thoughts, and behavior in this zone...', lines: 4 },
  { key: 'whatHelps', label: 'What helps?', placeholder: 'What actions and strategies help you in this zone...', lines: 4 },
  { key: 'anchorSentence', label: 'My anchor sentence', placeholder: 'One sentence that reminds you of what matters...', lines: 2 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function VspWizardScreen({ existingPlan, onSave, onCancel }: VspWizardScreenProps) {
  const colors = useColors();
  const [step, setStep] = useState<WizardStep>('choose_method');
  const [plan, setPlan] = useState<VspStructuredPlan>(existingPlan ?? { ...DEFAULT_VSP_STRUCTURED_PLAN });
  const [activeZoneIdx, setActiveZoneIdx] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Upload flow ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    setUploadError(null);
    setStep('uploading');

    const result = await pickAndParseVspDocument();

    if (result.cancelled) {
      setStep('choose_method');
      return;
    }

    if (!result.success || !result.vspPlan) {
      setUploadError(result.error || 'Something went wrong while processing.');
      setStep('choose_method');
      return;
    }

    // Check if any zones actually have content
    const filledZones = Object.values(result.vspPlan.zones || {}).filter(
      (z: any) => z && (z.signals || z.whatHelps || z.anchorSentence)
    ).length;
    if (filledZones === 0 && (!result.vspPlan.triggers || result.vspPlan.triggers.length === 0)) {
      setUploadError('The document was processed but no safety plan fields could be recognized. Try filling in manually or use a different document.');
      setStep('choose_method');
      return;
    }

    setPlan(result.vspPlan);
    setActiveZoneIdx(0);
    setStep('review_zones');
  }, []);

  // ─── Manual flow ─────────────────────────────────────────────────────────

  const handleManual = useCallback(() => {
    setActiveZoneIdx(0);
    setStep('review_zones');
  }, []);

  // ─── Zone editing ────────────────────────────────────────────────────────

  const updateZoneField = useCallback((zone: ZoneKey, field: keyof VspZoneEntry, value: string) => {
    setPlan(prev => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zone]: { ...prev.zones[zone], [field]: value },
      },
    }));
  }, []);

  const nextZone = useCallback(() => {
    if (activeZoneIdx < ZONE_CONFIG.length - 1) {
      setActiveZoneIdx(activeZoneIdx + 1);
    } else {
      setStep('review_triggers');
    }
  }, [activeZoneIdx]);

  const prevZone = useCallback(() => {
    if (activeZoneIdx > 0) {
      setActiveZoneIdx(activeZoneIdx - 1);
    }
  }, [activeZoneIdx]);

  // ─── Triggers editing ────────────────────────────────────────────────────

  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerCounter, setNewTriggerCounter] = useState('');

  const addTrigger = useCallback(() => {
    if (!newTriggerName.trim()) return;
    setPlan(prev => ({
      ...prev,
      triggers: [...prev.triggers, { trigger: newTriggerName.trim(), counterThought: newTriggerCounter.trim() }],
    }));
    setNewTriggerName('');
    setNewTriggerCounter('');
  }, [newTriggerName, newTriggerCounter]);

  const removeTrigger = useCallback((idx: number) => {
    setPlan(prev => ({
      ...prev,
      triggers: prev.triggers.filter((_, i) => i !== idx),
    }));
  }, []);

  // ─── Rules editing ───────────────────────────────────────────────────────

  const [newRule, setNewRule] = useState('');

  const addRule = useCallback(() => {
    if (!newRule.trim()) return;
    setPlan(prev => ({
      ...prev,
      recoveryRules: [...prev.recoveryRules, newRule.trim()],
    }));
    setNewRule('');
  }, [newRule]);

  const removeRule = useCallback((idx: number) => {
    setPlan(prev => ({
      ...prev,
      recoveryRules: prev.recoveryRules.filter((_, i) => i !== idx),
    }));
  }, []);

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const finalPlan: VspStructuredPlan = {
        ...plan,
        lastUpdated: new Date().toISOString(),
      };
      await onSave(finalPlan);
      setStep('done');
    } catch (err) {
      if (Platform.OS !== 'web') Alert.alert('Error', 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [plan, onSave]);

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderChooseMethod = () => (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24 }}>
      <View style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 28 }}>{'\u{1F6E1}'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.foreground, textAlign: 'center' }}>
          My Safety Plan
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
          You can upload an existing safety plan document or fill it in manually. Not everything needs to be filled — enter what you have.
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
                Upload document
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 }}>
                Upload your safety plan (PDF, Word, or text). Fields will be filled in automatically.
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
                Fill in your plan step by step per zone. You can skip zones.
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

  const renderUploading = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>Processing document...</Text>
      <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 }}>
        Your document is being read and the fields will be filled in automatically. This may take a moment.
      </Text>
    </View>
  );

  const renderZoneEditor = () => {
    const zone = ZONE_CONFIG[activeZoneIdx];
    const entry = plan.zones[zone.key];
    const progress = `${activeZoneIdx + 1} / ${ZONE_CONFIG.length}`;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Progress bar */}
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
          {ZONE_CONFIG.map((z, i) => (
            <View key={z.key} style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= activeZoneIdx ? z.color : colors.border,
            }} />
          ))}
        </View>

        {/* Zone header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Text style={{ fontSize: 22 }}>{zone.emoji}</Text>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{zone.label}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{zone.dutchLabel}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 20 }}>{progress}</Text>

        {/* Fields */}
        {FIELD_CONFIG.map(field => (
          <View key={field.key} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
              {field.label}
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
                minHeight: field.lines * 28,
                textAlignVertical: 'top',
                lineHeight: 20,
              }}
              placeholder={field.placeholder}
              placeholderTextColor={colors.muted}
              value={entry[field.key]}
              onChangeText={(text) => updateZoneField(zone.key, field.key, text)}
              multiline
            />
          </View>
        ))}

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {activeZoneIdx > 0 && (
            <Pressable onPress={prevZone} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Previous</Text>
              </View>
            </Pressable>
          )}
          <Pressable onPress={nextZone} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
            <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
                {activeZoneIdx < ZONE_CONFIG.length - 1 ? 'Next zone' : 'To triggers'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Skip hint */}
        <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
          Nothing for this zone? Leave the fields empty and continue.
        </Text>
      </ScrollView>
    );
  };

  const renderTriggersEditor = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
        My core triggers
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20, lineHeight: 18 }}>
        What situations or feelings can throw you off balance? Add a counter-thought as an anchor.
      </Text>

      {/* Existing triggers */}
      {plan.triggers.map((t, idx) => (
        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t.trigger}</Text>
              {t.counterThought ? (
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4, fontStyle: 'italic' }}>
                  Counter-thought: {t.counterThought}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => removeTrigger(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
              <Text style={{ fontSize: 18, color: colors.error }}>×</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Add new trigger */}
      <View style={{ gap: 10, marginTop: 8 }}>
        <TextInput
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: colors.foreground,
          }}
          placeholder="Trigger (e.g. Loss of control)"
          placeholderTextColor={colors.muted}
          value={newTriggerName}
          onChangeText={setNewTriggerName}
        />
        <TextInput
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: colors.foreground,
          }}
          placeholder="Counter-thought (optional)"
          placeholderTextColor={colors.muted}
          value={newTriggerCounter}
          onChangeText={setNewTriggerCounter}
        />
        <Pressable onPress={addTrigger} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ backgroundColor: colors.primary + '15', borderRadius: 10, padding: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>+ Add trigger</Text>
          </View>
        </Pressable>
      </View>

      {/* Main anchor sentence */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>
          My most important sentence
        </Text>
        <TextInput
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: colors.foreground,
            minHeight: 50,
            textAlignVertical: 'top',
          }}
          placeholder="One sentence that captures everything..."
          placeholderTextColor={colors.muted}
          value={plan.mainAnchorSentence}
          onChangeText={(text) => setPlan(prev => ({ ...prev, mainAnchorSentence: text }))}
          multiline
        />
      </View>

      {/* Navigation */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Pressable onPress={() => { setActiveZoneIdx(ZONE_CONFIG.length - 1); setStep('review_zones'); }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Back</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setStep('review_rules')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>To recovery rules</Text>
          </View>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
        No triggers? Just continue.
      </Text>
    </ScrollView>
  );

  const renderRulesEditor = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
        My recovery rules
      </Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 20, lineHeight: 18 }}>
        Personal rules that help you protect your recovery.
      </Text>

      {/* Existing rules */}
      {plan.recoveryRules.map((rule, idx) => (
        <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.foreground, flex: 1, lineHeight: 20 }}>{rule}</Text>
          <Pressable onPress={() => removeRule(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
            <Text style={{ fontSize: 18, color: colors.error }}>×</Text>
          </Pressable>
        </View>
      ))}

      {/* Add new rule */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            fontSize: 14,
            color: colors.foreground,
          }}
          placeholder="New recovery rule..."
          placeholderTextColor={colors.muted}
          value={newRule}
          onChangeText={setNewRule}
          returnKeyType="done"
          onSubmitEditing={addRule}
        />
        <Pressable onPress={addRule} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 12, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, color: '#fff', fontWeight: '700' }}>+</Text>
          </View>
        </Pressable>
      </View>

      {/* Navigation */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <Pressable onPress={() => setStep('review_triggers')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Back</Text>
          </View>
        </Pressable>
        <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
          <View style={{ backgroundColor: '#22C55E', borderRadius: 12, padding: 14, alignItems: 'center' }}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Save</Text>
            )}
          </View>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>
        No recovery rules? Just save.
      </Text>
    </ScrollView>
  );

  const renderDone = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      <Text style={{ fontSize: 48 }}>{'\u2705'}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>Saved!</Text>
      <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
        Your safety plan has been saved. Elias uses this to guide you better in your own words.
      </Text>
      <Pressable onPress={onCancel} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 16 }]}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Close</Text>
        </View>
      </Pressable>
    </View>
  );

  // ─── Main render ─────────────────────────────────────────────────────────

  switch (step) {
    case 'choose_method': return renderChooseMethod();
    case 'uploading': return renderUploading();
    case 'review_zones': return renderZoneEditor();
    case 'review_triggers': return renderTriggersEditor();
    case 'review_rules': return renderRulesEditor();
    case 'done': return renderDone();
    default: return renderChooseMethod();
  }
}
