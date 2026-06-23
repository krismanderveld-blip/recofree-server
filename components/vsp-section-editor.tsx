import { useState, useCallback } from 'react';
import { Text, View, TextInput, Pressable, Alert, Platform, ScrollView } from 'react-native';
import type { VspStructuredPlan, VspZoneEntry, VspTrigger } from '@/lib/ai/types';
import { DEFAULT_VSP_STRUCTURED_PLAN } from '@/lib/ai/types';
import { useColors } from '@/hooks/use-colors';
import { useTranslation, tStatic } from '@/lib/i18n';

type ZoneKey = 'green' | 'yellow' | 'orange' | 'red' | 'purple';

const ZONE_CONFIG: { key: ZoneKey; label: string; color: string; emoji: string }[] = [
  { key: 'green', label: tStatic('vsp_section_editor.zone_config.green.label'), color: '#22C55E', emoji: tStatic('vsp_section_editor.zone_config.green.emoji') },
  { key: 'yellow', label: tStatic('vsp_section_editor.zone_config.yellow.label'), color: '#EAB308', emoji: tStatic('vsp_section_editor.zone_config.yellow.emoji') },
  { key: 'orange', label: tStatic('vsp_section_editor.zone_config.orange.label'), color: '#F97316', emoji: tStatic('vsp_section_editor.zone_config.orange.emoji') },
  { key: 'red', label: tStatic('vsp_section_editor.zone_config.red.label'), color: '#EF4444', emoji: tStatic('vsp_section_editor.zone_config.red.emoji') },
  { key: 'purple', label: tStatic('vsp_section_editor.zone_config.purple.label'), color: '#8B5CF6', emoji: tStatic('vsp_section_editor.zone_config.purple.emoji') },
];

const FIELD_LABELS: { key: keyof VspZoneEntry; label: string; placeholder: string }[] = [
  { key: 'signals', label: tStatic('vsp_section_editor.field_labels.signals.label'), placeholder: tStatic('vsp_section_editor.field_labels.signals.placeholder') },
  { key: 'whatHelps', label: tStatic('vsp_section_editor.field_labels.what_helps.label'), placeholder: tStatic('vsp_section_editor.field_labels.what_helps.placeholder') },
  { key: 'anchorSentence', label: tStatic('vsp_section_editor.field_labels.anchor_sentence.label'), placeholder: tStatic('vsp_section_editor.field_labels.anchor_sentence.placeholder') },
];

interface VspSectionEditorProps {
  vspPlan: VspStructuredPlan | undefined;
  onSave: (plan: VspStructuredPlan) => Promise<void>;
}

export function VspSectionEditor({ vspPlan, onSave }: VspSectionEditorProps) {
  const colors = useColors();
  const plan = vspPlan ?? DEFAULT_VSP_STRUCTURED_PLAN;

  const [expandedZone, setExpandedZone] = useState<ZoneKey | 'triggers' | 'rules' | null>(null);
  const [editingZone, setEditingZone] = useState<ZoneKey | null>(null);
  const [editingTriggers, setEditingTriggers] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState(false);

  // Zone editing state
  const [zoneSignals, setZoneSignals] = useState('');
  const [zoneWhatHelps, setZoneWhatHelps] = useState('');
  const [zoneAnchor, setZoneAnchor] = useState('');

  // Triggers editing state
  const [triggerList, setTriggerList] = useState<VspTrigger[]>([]);
  const [newTrigger, setNewTrigger] = useState('');
  const [newCounter, setNewCounter] = useState('');

  // Rules editing state
  const [rulesList, setRulesList] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');

  // Main anchor editing state
  const [mainAnchor, setMainAnchor] = useState('');
  const { t } = useTranslation();

  const handleExpandZone = useCallback((zone: ZoneKey | 'triggers' | 'rules') => {
    if (expandedZone === zone) {
      setExpandedZone(null);
      setEditingZone(null);
      setEditingTriggers(false);
      setEditingRules(false);
    } else {
      setExpandedZone(zone);
      setEditingZone(null);
      setEditingTriggers(false);
      setEditingRules(false);
    }
  }, [expandedZone]);

  const startEditZone = useCallback((zone: ZoneKey) => {
    const entry = plan.zones[zone];
    setZoneSignals(entry.signals);
    setZoneWhatHelps(entry.whatHelps);
    setZoneAnchor(entry.anchorSentence);
    setEditingZone(zone);
  }, [plan]);

  const saveZone = useCallback(async (zone: ZoneKey) => {
    const updated: VspStructuredPlan = {
      ...plan,
      zones: {
        ...plan.zones,
        [zone]: { signals: zoneSignals, whatHelps: zoneWhatHelps, anchorSentence: zoneAnchor },
      },
    };
    await onSave(updated);
    setEditingZone(null);
    if (Platform.OS !== 'web') Alert.alert(t('vsp_section_editor.alert.saved.title_3'), t('vsp_section_editor.alert.saved.zone_updated'));
  }, [plan, zoneSignals, zoneWhatHelps, zoneAnchor, onSave]);

  const startEditTriggers = useCallback(() => {
    setTriggerList([...plan.triggers]);
    setEditingTriggers(true);
  }, [plan]);

  const addTrigger = useCallback(() => {
    if (!newTrigger.trim()) return;
    setTriggerList([...triggerList, { trigger: newTrigger.trim(), counterThought: newCounter.trim() }]);
    setNewTrigger('');
    setNewCounter('');
  }, [triggerList, newTrigger, newCounter]);

  const removeTrigger = useCallback((idx: number) => {
    setTriggerList(triggerList.filter((_, i) => i !== idx));
  }, [triggerList]);

  const saveTriggers = useCallback(async () => {
    const updated: VspStructuredPlan = { ...plan, triggers: triggerList };
    await onSave(updated);
    setEditingTriggers(false);
    if (Platform.OS !== 'web') Alert.alert(t('vsp_section_editor.alert.saved.title_2'), t('vsp_section_editor.alert.saved.triggers_updated'));
  }, [plan, triggerList, onSave]);

  const startEditRules = useCallback(() => {
    setRulesList([...plan.recoveryRules]);
    setEditingRules(true);
  }, [plan]);

  const addRule = useCallback(() => {
    if (!newRule.trim()) return;
    setRulesList([...rulesList, newRule.trim()]);
    setNewRule('');
  }, [rulesList, newRule]);

  const removeRule = useCallback((idx: number) => {
    setRulesList(rulesList.filter((_, i) => i !== idx));
  }, [rulesList]);

  const saveRules = useCallback(async () => {
    const updated: VspStructuredPlan = { ...plan, recoveryRules: rulesList };
    await onSave(updated);
    setEditingRules(false);
    if (Platform.OS !== 'web') Alert.alert(t('vsp_section_editor.alert.saved.title'), t('vsp_section_editor.alert.saved.rules_updated'));
  }, [plan, rulesList, onSave]);

  const startEditMainAnchor = useCallback(() => {
    setMainAnchor(plan.mainAnchorSentence);
    setEditingAnchor(true);
  }, [plan]);

  const saveMainAnchor = useCallback(async () => {
    const updated: VspStructuredPlan = { ...plan, mainAnchorSentence: mainAnchor };
    await onSave(updated);
    setEditingAnchor(false);
  }, [plan, mainAnchor, onSave]);

  const hasZoneContent = (zone: ZoneKey) => {
    const e = plan.zones[zone];
    return e.signals.trim() || e.whatHelps.trim() || e.anchorSentence.trim();
  };

  const filledZones = ZONE_CONFIG.filter(z => hasZoneContent(z.key)).length;

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Text style={{ fontSize: 22 }}>{t('vsp_section_editor.header.emoji')}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>{t('vsp_section_editor.header.title')}</Text>
      </View>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
        Your personal early-warning plan per zone. This helps your companion use your own words.
      </Text>

      {/* Progress */}
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
        {ZONE_CONFIG.map(z => (
          <View key={z.key} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: hasZoneContent(z.key) ? z.color : colors.border }} />
        ))}
      </View>

      {/* Zone Accordions */}
      {ZONE_CONFIG.map(zone => {
        const isExpanded = expandedZone === zone.key;
        const isEditing = editingZone === zone.key;
        const entry = plan.zones[zone.key];
        const hasFilled = hasZoneContent(zone.key);

        return (
          <View key={zone.key} style={{ marginBottom: 10 }}>
            <Pressable onPress={() => handleExpandZone(zone.key)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: zone.color,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 18 }}>{zone.emoji}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{zone.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {hasFilled && (
                      <View style={{ backgroundColor: zone.color + '20', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: zone.color, fontWeight: '500' }}>{t('vsp_section_editor.zone.checkmark')}</Text>
                      </View>
                    )}
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{isExpanded ? t('vsp_section_editor.rules.arrow_up') : t('vsp_section_editor.rules.arrow_down')}</Text>
                  </View>
                </View>
              </View>
            </Pressable>

            {isExpanded && (
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, padding: 14, marginTop: -4 }}>
                {isEditing ? (
                  <View style={{ gap: 14 }}>
                    {FIELD_LABELS.map(field => (
                      <View key={field.key}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 6 }}>{field.label}</Text>
                        <TextInput
                          style={{
                            backgroundColor: '#fff',
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 14,
                            color: colors.foreground,
                            minHeight: field.key === 'anchorSentence' ? 50 : 100,
                            textAlignVertical: 'top',
                            lineHeight: 20,
                          }}
                          placeholder={field.placeholder}
                          placeholderTextColor="#9CA3AF"
                          value={field.key === 'signals' ? zoneSignals : field.key === 'whatHelps' ? zoneWhatHelps : zoneAnchor}
                          onChangeText={field.key === 'signals' ? setZoneSignals : field.key === 'whatHelps' ? setZoneWhatHelps : setZoneAnchor}
                          multiline
                        />
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <Pressable onPress={() => setEditingZone(null)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                          <Text style={{ color: colors.foreground, fontWeight: '500' }}>{t('vsp_section_editor.main_anchor.cancel')}</Text>
                        </View>
                      </Pressable>
                      <Pressable onPress={() => saveZone(zone.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                        <View style={{ backgroundColor: zone.color, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('vsp_section_editor.main_anchor.save')}</Text>
                        </View>
                      </Pressable>
                    </View>
                  </View>
                ) : hasFilled ? (
                  <View style={{ gap: 10 }}>
                    {entry.signals.trim() && (
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 2 }}>{t('vsp_section_editor.zone.recognition')}</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 19 }}>{entry.signals}</Text>
                      </View>
                    )}
                    {entry.whatHelps.trim() && (
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 2 }}>{t('vsp_section_editor.zone.what_helps')}</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 19 }}>{entry.whatHelps}</Text>
                      </View>
                    )}
                    {entry.anchorSentence.trim() && (
                      <View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: zone.color, marginBottom: 2 }}>{t('vsp_section_editor.zone.anchor_sentence')}</Text>
                        <Text style={{ fontSize: 13, color: colors.foreground, fontStyle: 'italic', lineHeight: 19 }}>{entry.anchorSentence}</Text>
                      </View>
                    )}
                    <Pressable onPress={() => startEditZone(zone.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 6 }]}>
                      <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                        <Text style={{ color: zone.color, fontWeight: '500', fontSize: 13 }}>{t('vsp_section_editor.main_anchor.edit')}</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>{t('vsp_section_editor.zone.not_filled')}</Text>
                    <Pressable onPress={() => startEditZone(zone.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ backgroundColor: zone.color, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('vsp_section_editor.zone.fill_in')}</Text>
                      </View>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Triggers Section */}
      <View style={{ marginTop: 8, marginBottom: 10 }}>
        <Pressable onPress={() => handleExpandZone('triggers')} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: '#F59E0B',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{t('vsp_section_editor.triggers.emoji')}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t('vsp_section_editor.triggers.title')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {plan.triggers.length > 0 && (
                  <Text style={{ fontSize: 11, color: colors.muted }}>{plan.triggers.length}</Text>
                )}
                <Text style={{ color: colors.muted, fontSize: 12 }}>{expandedZone === 'triggers' ? t('vsp_section_editor.triggers.arrow_up') : t('vsp_section_editor.triggers.arrow_down')}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {expandedZone === 'triggers' && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, padding: 14, marginTop: -4 }}>
            {editingTriggers ? (
              <View style={{ gap: 10 }}>
                {triggerList.map((trig, idx) => (
                  <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{trig.trigger}</Text>
                        {trig.counterThought && <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 2 }}>Counter-thought: {trig.counterThought}</Text>}
                      </View>
                      <Pressable onPress={() => removeTrigger(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
                        <Text style={{ color: '#EF4444', fontSize: 16 }}>{t('vsp_section_editor.rules.remove')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.foreground }}
                    placeholder={t('vsp_section_editor.triggers.placeholder.trigger')}
                    placeholderTextColor="#9CA3AF"
                    value={newTrigger}
                    onChangeText={setNewTrigger}
                  />
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.foreground }}
                    placeholder={t('vsp_section_editor.triggers.placeholder.counter_thought')}
                    placeholderTextColor="#9CA3AF"
                    value={newCounter}
                    onChangeText={setNewCounter}
                  />
                  <Pressable onPress={addTrigger} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('vsp_section_editor.rules.add')}</Text>
                    </View>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <Pressable onPress={() => setEditingTriggers(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>{t('vsp_section_editor.rules.cancel')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={saveTriggers} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: '#F59E0B', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('vsp_section_editor.rules.save')}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : plan.triggers.length > 0 ? (
              <View style={{ gap: 8 }}>
                {plan.triggers.map((trig, idx) => (
                  <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{trig.trigger}</Text>
                    {trig.counterThought && <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 2 }}>Counter-thought: {trig.counterThought}</Text>}
                  </View>
                ))}
                <Pressable onPress={startEditTriggers} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 4 }]}>
                  <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#F59E0B', fontWeight: '500', fontSize: 13 }}>{t('vsp_section_editor.rules.edit')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>{t('vsp_section_editor.triggers.no_triggers')}</Text>
                <Pressable onPress={startEditTriggers} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('vsp_section_editor.triggers.add_triggers')}</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Recovery Rules Section */}
      <View style={{ marginBottom: 10 }}>
        <Pressable onPress={() => handleExpandZone('rules')} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: '#6366F1',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{t('vsp_section_editor.rules.emoji')}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{t('vsp_section_editor.rules.title')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {plan.recoveryRules.length > 0 && (
                  <Text style={{ fontSize: 11, color: colors.muted }}>{plan.recoveryRules.length}</Text>
                )}
                <Text style={{ color: colors.muted, fontSize: 12 }}>{expandedZone === 'rules' ? t('vsp_section_editor.zone.arrow_up') : t('vsp_section_editor.zone.arrow_down')}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {expandedZone === 'rules' && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, padding: 14, marginTop: -4 }}>
            {editingRules ? (
              <View style={{ gap: 10 }}>
                {rulesList.map((r, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }}>{idx + 1}. {r}</Text>
                    <Pressable onPress={() => removeRule(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
                      <Text style={{ color: '#EF4444', fontSize: 16 }}>{t('vsp_section_editor.triggers.remove')}</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TextInput
                    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: colors.foreground }}
                    placeholder={t('vsp_section_editor.rules.placeholder')}
                    placeholderTextColor="#9CA3AF"
                    value={newRule}
                    onChangeText={setNewRule}
                    returnKeyType="done"
                    onSubmitEditing={addRule}
                  />
                  <Pressable onPress={addRule} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('vsp_section_editor.triggers.add')}</Text>
                    </View>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <Pressable onPress={() => setEditingRules(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>{t('vsp_section_editor.triggers.cancel')}</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={saveRules} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                    <View style={{ backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('vsp_section_editor.triggers.save')}</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : plan.recoveryRules.length > 0 ? (
              <View style={{ gap: 6 }}>
                {plan.recoveryRules.map((r, idx) => (
                  <Text key={idx} style={{ fontSize: 13, color: colors.foreground, lineHeight: 19 }}>{idx + 1}. {r}</Text>
                ))}
                <Pressable onPress={startEditRules} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 6 }]}>
                  <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#6366F1', fontWeight: '500', fontSize: 13 }}>{t('vsp_section_editor.triggers.edit')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>{t('vsp_section_editor.rules.no_rules')}</Text>
                <Pressable onPress={startEditRules} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ backgroundColor: '#6366F1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('vsp_section_editor.rules.add_rules')}</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Main Anchor Sentence */}
      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: '#B39DDB' }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#B39DDB', marginBottom: 4 }}>{t('vsp_section_editor.main_anchor.title')}</Text>
        {editingAnchor ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.foreground, lineHeight: 20 }}
              placeholder={t('vsp_section_editor.main_anchor.placeholder')}
              placeholderTextColor="#9CA3AF"
              value={mainAnchor}
              onChangeText={setMainAnchor}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setEditingAnchor(false)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: colors.foreground, fontWeight: '500', fontSize: 12 }}>{t('vsp_section_editor.zone.cancel')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={saveMainAnchor} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
                <View style={{ backgroundColor: '#B39DDB', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{t('vsp_section_editor.zone.save')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : plan.mainAnchorSentence.trim() ? (
          <View>
            <Text style={{ fontSize: 14, color: colors.foreground, fontStyle: 'italic', lineHeight: 20 }}>{plan.mainAnchorSentence}</Text>
            <Pressable onPress={startEditMainAnchor} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8 }]}>
              <Text style={{ color: '#B39DDB', fontWeight: '500', fontSize: 12 }}>{t('vsp_section_editor.zone.edit')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startEditMainAnchor} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ fontSize: 13, color: colors.muted }}>{t('vsp_section_editor.main_anchor.tap_to_enter')}</Text>
          </Pressable>
        )}
      </View>

      {/* Last updated */}
      {plan.lastUpdated && (
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, textAlign: 'right' }}>
          Last updated: {new Date(plan.lastUpdated).toLocaleDateString('en-US')}
        </Text>
      )}
    </View>
  );
}
