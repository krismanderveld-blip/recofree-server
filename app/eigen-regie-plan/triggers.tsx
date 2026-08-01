/**
 * KERP01 — Triggers & Boundary Rules Screen
 *
 * Manage triggers (with zone assignment) and boundary rules.
 */

import { useState, useCallback } from 'react';
import { Text, View, ScrollView, TextInput, Pressable, Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { colors as dc } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import type { EigenRegieTrigger, EigenRegieZoneId, EigenRegiePlan } from '@/lib/engine/kim/kerp01-types';
import { DEFAULT_EIGEN_REGIE_PLAN } from '@/lib/engine/kim/kerp01-types';

const ZONE_OPTIONS: { id: EigenRegieZoneId; label: string; color: string }[] = [
  { id: 'lichtgroen', label: 'Lichtgroen', color: '#4ADE80' },
  { id: 'geel', label: 'Geel', color: '#EAB308' },
  { id: 'oranje', label: 'Oranje', color: '#F97316' },
  { id: 'rood', label: 'Rood', color: '#EF4444' },
];

export default function TriggersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getEigenRegiePlan, updateEigenRegiePlan } = useUser();
  const plan = getEigenRegiePlan() ?? DEFAULT_EIGEN_REGIE_PLAN;

  const [triggers, setTriggers] = useState<EigenRegieTrigger[]>([...plan.triggers]);
  const [rules, setRules] = useState<string[]>([...plan.boundaryRules]);
  const [newTriggerText, setNewTriggerText] = useState('');
  const [newTriggerZone, setNewTriggerZone] = useState<EigenRegieZoneId>('geel');
  const [newCounter, setNewCounter] = useState('');
  const [newRule, setNewRule] = useState('');
  const [dirty, setDirty] = useState(false);

  const addTrigger = useCallback(() => {
    const text = newTriggerText.trim();
    if (!text) return;
    const trigger: EigenRegieTrigger = {
      trigger: text,
      lossOfRegiePattern: `Zone: ${newTriggerZone}`,
      healthyResponse: newCounter.trim() || 'Nog niet ingevuld',
    };
    setTriggers(prev => [...prev, trigger]);
    setNewTriggerText('');
    setNewCounter('');
    setDirty(true);
  }, [newTriggerText, newTriggerZone, newCounter]);

  const removeTrigger = useCallback((index: number) => {
    setTriggers(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const addRule = useCallback(() => {
    const text = newRule.trim();
    if (!text) return;
    setRules(prev => [...prev, text]);
    setNewRule('');
    setDirty(true);
  }, [newRule]);

  const removeRule = useCallback((index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const updatedPlan: EigenRegiePlan = {
      ...plan,
      triggers,
      boundaryRules: rules,
      lastUpdated: new Date().toISOString(),
    };
    await updateEigenRegiePlan(updatedPlan);
    setDirty(false);
    if (Platform.OS !== 'web') {
      const Haptics = require('expo-haptics');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [plan, triggers, rules, updateEigenRegiePlan, router]);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, paddingVertical: 8 }]}>
            <Text style={{ fontSize: 16, color: dc.primary }}>{t('kerp.triggers.back')}</Text>
          </Pressable>
          <Text style={[styles.title, { color: dc.textPrimary }]}>{t('kerp.triggers.title')}</Text>

          {/* Triggers Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: dc.textPrimary }]}>{t('kerp.triggers.section_triggers')}</Text>
            <Text style={[styles.sectionDesc, { color: dc.textTertiary }]}>
              Situaties, personen of gevoelens die je richting oud gedrag trekken.
            </Text>

            {triggers.map((trigger, idx) => (
              <View key={idx} style={[styles.triggerCard, { borderLeftColor: ZONE_OPTIONS.find(z => trigger.lossOfRegiePattern.includes(z.id))?.color || '#ccc' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.triggerText, { color: dc.textPrimary }]}>{trigger.trigger}</Text>
                  {trigger.healthyResponse && trigger.healthyResponse !== 'Nog niet ingevuld' && (
                    <Text style={[styles.counterText, { color: dc.textSecondary }]}>↩ {trigger.healthyResponse}</Text>
                  )}
                  <Text style={[styles.triggerMeta, { color: dc.textTertiary }]}>
                    {trigger.lossOfRegiePattern}
                  </Text>
                </View>
                <Pressable onPress={() => removeTrigger(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                  <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add Trigger */}
            <View style={[styles.addSection, { backgroundColor: dc.surfaceKim }]}>
              <TextInput
                value={newTriggerText}
                onChangeText={setNewTriggerText}
                placeholder="Beschrijf de trigger..."
                placeholderTextColor={dc.textTertiary}
                style={[styles.input, { color: dc.textPrimary }]}
                returnKeyType="next"
              />
              <View style={styles.zoneSelector}>
                {ZONE_OPTIONS.map(z => (
                  <Pressable
                    key={z.id}
                    onPress={() => setNewTriggerZone(z.id)}
                    style={({ pressed }) => [
                      styles.zonePill,
                      { backgroundColor: newTriggerZone === z.id ? z.color : '#e0e0e0', opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={[styles.zonePillText, { color: newTriggerZone === z.id ? '#fff' : '#666' }]}>{z.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={newCounter}
                onChangeText={setNewCounter}
                placeholder="Tegenactie (optioneel)..."
                placeholderTextColor={dc.textTertiary}
                style={[styles.input, { color: dc.textPrimary }]}
                returnKeyType="done"
                onSubmitEditing={addTrigger}
              />
              <Pressable onPress={addTrigger} style={({ pressed }) => [styles.addBtn, { backgroundColor: dc.primary, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{t('kerp.triggers.add_trigger')}</Text>
              </Pressable>
            </View>
          </View>

          {/* Boundary Rules Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: dc.textPrimary }]}>{t('kerp.triggers.section_rules')}</Text>
            <Text style={[styles.sectionDesc, { color: dc.textTertiary }]}>
              Concrete afspraken met jezelf over wat je wel en niet doet.
            </Text>

            {rules.map((rule, idx) => (
              <View key={idx} style={styles.ruleItem}>
                <Text style={[styles.ruleText, { color: dc.textPrimary }]}>🛡 {rule}</Text>
                <Pressable onPress={() => removeRule(idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                  <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.addRow}>
              <TextInput
                value={newRule}
                onChangeText={setNewRule}
                placeholder="Bijv. 'Ik drink niet als ik alleen ben'"
                placeholderTextColor={dc.textTertiary}
                style={[styles.addInput, { color: dc.textPrimary }]}
                returnKeyType="done"
                onSubmitEditing={addRule}
              />
              <Pressable onPress={addRule} style={({ pressed }) => [styles.smallAddBtn, { backgroundColor: dc.primary, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>+</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        {dirty && (
          <View style={styles.saveBar}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.saveBtnText}>{t('kerp.triggers.save')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginTop: 12, marginBottom: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 12 },
  triggerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderLeftWidth: 4, borderRadius: 10, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  triggerText: { fontSize: 14, fontWeight: '500' },
  counterText: { fontSize: 12, marginTop: 3 },
  triggerMeta: { fontSize: 11, marginTop: 3 },
  addSection: { padding: 14, borderRadius: 12, gap: 10, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  zoneSelector: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  zonePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  zonePillText: { fontSize: 12, fontWeight: '600' },
  addBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  ruleItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f8f8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 6 },
  ruleText: { flex: 1, fontSize: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  smallAddBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
