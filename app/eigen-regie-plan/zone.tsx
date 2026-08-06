/**
 * KERP01 — Zone Detail/Edit Screen
 *
 * Shows and allows editing of a single zone's content:
 * - Label + userMeaning
 * - Signals (body, thought, behaviour)
 * - What helps
 * - Boundary actions
 * - Contact rule
 * - Anchor sentence
 */

import { useState, useCallback, useEffect } from 'react';
import { Text, View, ScrollView, TextInput, Pressable, Alert, Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { useColors } from '@/hooks/use-colors';
import { colors as dc } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import type { EigenRegieZoneId, EigenRegieZoneEntry, EigenRegiePlan } from '@/lib/engine/kim/kerp01-types';
import { DEFAULT_EIGEN_REGIE_PLAN } from '@/lib/engine/kim/kerp01-types';

const ZONE_META: Record<EigenRegieZoneId, { color: string; emoji: string; defaultLabel: string; description: string }> = {
  donkergroen: { color: '#16A34A', emoji: '🌿', defaultLabel: 'Vrij van verslaving', description: 'Je voelt je vrij, stabiel en in balans. Geen drang of craving.' },
  lichtgroen: { color: '#4ADE80', emoji: '🌱', defaultLabel: 'Terug naar verslaving', description: 'Eerste subtiele signalen dat oude patronen terugkomen.' },
  geel: { color: '#EAB308', emoji: '⚖️', defaultLabel: 'Wisselzone', description: 'Spanning tussen oud en nieuw gedrag. Keuzemoment.' },
  oranje: { color: '#F97316', emoji: '🔥', defaultLabel: 'Rond de ander', description: 'Relaties en omgeving triggeren oude patronen.' },
  rood: { color: '#EF4444', emoji: '🚨', defaultLabel: 'Verlies van regie', description: 'Hoog risico. Directe actie nodig om veilig te blijven.' },
};

type FieldKey = 'signals' | 'bodySignals' | 'thoughts' | 'behaviour' | 'whatHelps' | 'boundaryActions';

const LIST_FIELDS: { key: FieldKey; label: string; placeholder: string; emoji: string }[] = [
  { key: 'signals', label: 'Signalen', placeholder: 'Bijv. onrust, slecht slapen, piekeren...', emoji: '📡' },
  { key: 'bodySignals', label: 'Lichaamssignalen', placeholder: 'Bijv. spanning in schouders, buikpijn...', emoji: '🫀' },
  { key: 'thoughts', label: 'Gedachten', placeholder: 'Bijv. "Eén keer kan geen kwaad"...', emoji: '💭' },
  { key: 'behaviour', label: 'Gedrag', placeholder: 'Bijv. terugtrekken, sneller boos worden...', emoji: '🎭' },
  { key: 'whatHelps', label: 'Wat helpt', placeholder: 'Bijv. wandelen, bellen met vriend, ademhaling...', emoji: '💚' },
  { key: 'boundaryActions', label: 'Grensacties', placeholder: 'Bijv. situatie verlaten, nee zeggen...', emoji: '🛡' },
];

export default function ZoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const zoneId = (id || 'donkergroen') as EigenRegieZoneId;
  const meta = ZONE_META[zoneId];
  const router = useRouter();
  const { t } = useTranslation();
  const { getEigenRegiePlan, updateEigenRegiePlan } = useUser();
  const plan = getEigenRegiePlan() ?? DEFAULT_EIGEN_REGIE_PLAN;
  const entry = plan.zones[zoneId];

  // Local editing state
  const [userMeaning, setUserMeaning] = useState(entry.userMeaning);
  const [contactRule, setContactRule] = useState(entry.contactRule);
  const [anchorSentence, setAnchorSentence] = useState(entry.anchorSentence);
  // Connection fields (KERP01 relational stance)
  const [connectionIntent, setConnectionIntent] = useState(entry.connectionIntent);
  const [bridgeSentence, setBridgeSentence] = useState(entry.bridgeSentence);
  const [repairCondition, setRepairCondition] = useState(entry.repairCondition);
  const [safetyException, setSafetyException] = useState(entry.safetyException);
  const [showConnectionSuggestions, setShowConnectionSuggestions] = useState(false);
  const [lists, setLists] = useState<Record<FieldKey, string[]>>({
    signals: [...entry.signals],
    bodySignals: [...entry.bodySignals],
    thoughts: [...entry.thoughts],
    behaviour: [...entry.behaviour],
    whatHelps: [...entry.whatHelps],
    boundaryActions: [...entry.boundaryActions],
  });
  const [newItems, setNewItems] = useState<Record<FieldKey, string>>({
    signals: '', bodySignals: '', thoughts: '', behaviour: '', whatHelps: '', boundaryActions: '',
  });
  const [dirty, setDirty] = useState(false);

  const addItem = useCallback((field: FieldKey) => {
    const text = newItems[field].trim();
    if (!text) return;
    setLists(prev => ({ ...prev, [field]: [...prev[field], text] }));
    setNewItems(prev => ({ ...prev, [field]: '' }));
    setDirty(true);
  }, [newItems]);

  const removeItem = useCallback((field: FieldKey, index: number) => {
    setLists(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const updatedEntry: EigenRegieZoneEntry = {
      ...entry,
      userMeaning,
      contactRule,
      anchorSentence,
      connectionIntent,
      bridgeSentence,
      repairCondition,
      safetyException,
      signals: lists.signals,
      bodySignals: lists.bodySignals,
      thoughts: lists.thoughts,
      behaviour: lists.behaviour,
      whatHelps: lists.whatHelps,
      boundaryActions: lists.boundaryActions,
    };
    const updatedPlan: EigenRegiePlan = {
      ...plan,
      zones: { ...plan.zones, [zoneId]: updatedEntry },
      lastUpdated: new Date().toISOString(),
    };
    await updateEigenRegiePlan(updatedPlan);
    setDirty(false);
    if (Platform.OS !== 'web') {
      const Haptics = require('expo-haptics');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [entry, userMeaning, contactRule, anchorSentence, connectionIntent, bridgeSentence, repairCondition, safetyException, lists, plan, zoneId, updateEigenRegiePlan, router]);

  const handleBack = useCallback(() => {
    if (dirty) {
      Alert.alert('Niet opgeslagen', 'Wil je je wijzigingen opslaan?', [
        { text: 'Verwerpen', style: 'destructive', onPress: () => router.back() },
        { text: 'Opslaan', onPress: handleSave },
      ]);
    } else {
      router.back();
    }
  }, [dirty, router, handleSave]);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ fontSize: 16, color: dc.primary }}>{t('kerp.zone.back')}</Text>
            </Pressable>
            <View style={[styles.zoneBadge, { backgroundColor: meta.color }]}>
              <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
              <Text style={styles.zoneBadgeLabel}>{meta.defaultLabel}</Text>
            </View>
            <Text style={[styles.description, { color: dc.textTertiary }]}>{meta.description}</Text>
          </View>

          {/* User Meaning */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: dc.textSecondary }]}>{t('kerp.zone.meaning_label')}</Text>
            <TextInput
              value={userMeaning}
              onChangeText={(t) => { setUserMeaning(t); setDirty(true); }}
              placeholder="Beschrijf in je eigen woorden..."
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />
          </View>

          {/* List Fields */}
          {LIST_FIELDS.map(field => (
            <View key={field.key} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: dc.textSecondary }]}>
                {field.emoji} {field.label}
              </Text>
              {lists[field.key].map((item, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Text style={[styles.listItemText, { color: dc.textPrimary }]}>{item}</Text>
                  <Pressable onPress={() => removeItem(field.key, idx)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                    <Text style={{ color: '#EF4444', fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.addRow}>
                <TextInput
                  value={newItems[field.key]}
                  onChangeText={(t) => setNewItems(prev => ({ ...prev, [field.key]: t }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={dc.textTertiary}
                  style={[styles.addInput, { color: dc.textPrimary, borderColor: dc.primary + '20' }]}
                  returnKeyType="done"
                  onSubmitEditing={() => addItem(field.key)}
                />
                <Pressable onPress={() => addItem(field.key)} style={({ pressed }) => [styles.addBtn, { backgroundColor: dc.primary, opacity: pressed ? 0.8 : 1 }]}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* Contact Rule */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: dc.textSecondary }]}>{t('kerp.zone.contact_label')}</Text>
            <TextInput
              value={contactRule}
              onChangeText={(t) => { setContactRule(t); setDirty(true); }}
              placeholder="Bijv. 'Bel mijn sponsor als ik langer dan 2 uur in oranje zit'"
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />
          </View>

          {/* Anchor Sentence */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: dc.textSecondary }]}>{t('kerp.zone.anchor_label')}</Text>
            <TextInput
              value={anchorSentence}
              onChangeText={(t) => { setAnchorSentence(t); setDirty(true); }}
              placeholder="Eén zin die je herinnert aan je kracht..."
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              returnKeyType="done"
            />
          </View>

          {/* ═══ Verbinding zonder zelfverlies ═══ */}
          <View style={[styles.section, styles.connectionSection]}>
            <View style={styles.connectionHeader}>
              <Text style={[styles.connectionTitle, { color: dc.textPrimary }]}>
                🤝 Verbinding zonder zelfverlies
              </Text>
              <Pressable
                onPress={() => setShowConnectionSuggestions(!showConnectionSuggestions)}
                style={({ pressed }) => [styles.suggestionBtn, { opacity: pressed ? 0.7 : 1, borderColor: dc.primary + '40' }]}
              >
                <Text style={{ color: dc.primary, fontSize: 13, fontWeight: '500' }}>
                  {showConnectionSuggestions ? 'Verberg voorbeeld' : 'Voorbeeld tonen'}
                </Text>
              </Pressable>
            </View>

            {/* connectionIntent */}
            <Text style={[styles.connectionFieldLabel, { color: dc.textSecondary }]}>
              Wat wil ik beschermen?
            </Text>
            {showConnectionSuggestions && (
              <Text style={[styles.suggestionText, { color: dc.textTertiary }]}>
                Bijv. "Ik wil betrokken blijven zonder mezelf te verliezen."
              </Text>
            )}
            <TextInput
              value={connectionIntent}
              onChangeText={(t) => { setConnectionIntent(t); setDirty(true); }}
              placeholder="Welke verbinding wil ik beschermen in deze zone?"
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />

            {/* bridgeSentence */}
            <Text style={[styles.connectionFieldLabel, { color: dc.textSecondary, marginTop: 14 }]}>
              Wat kan ik zeggen?
            </Text>
            {showConnectionSuggestions && (
              <Text style={[styles.suggestionText, { color: dc.textTertiary }]}>
                Bijv. "Ik wil je begrijpen, maar ik merk dat ik rust nodig heb om dit goed te kunnen bespreken."
              </Text>
            )}
            <TextInput
              value={bridgeSentence}
              onChangeText={(t) => { setBridgeSentence(t); setDirty(true); }}
              placeholder="Een zin om contact open te houden zonder jezelf kwijt te raken"
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />

            {/* repairCondition */}
            <Text style={[styles.connectionFieldLabel, { color: dc.textSecondary, marginTop: 14 }]}>
              Wanneer is contact weer veilig genoeg?
            </Text>
            {showConnectionSuggestions && (
              <Text style={[styles.suggestionText, { color: dc.textTertiary }]}>
                Bijv. "Contact lukt beter wanneer er rust, eerlijkheid en geen druk is."
              </Text>
            )}
            <TextInput
              value={repairCondition}
              onChangeText={(t) => { setRepairCondition(t); setDirty(true); }}
              placeholder="Wat moet er aanwezig zijn om contact opnieuw veilig te maken?"
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />

            {/* safetyException */}
            <Text style={[styles.connectionFieldLabel, { color: dc.textSecondary, marginTop: 14 }]}>
              Wanneer gaat veiligheid voor verbinding?
            </Text>
            {showConnectionSuggestions && (
              <Text style={[styles.suggestionText, { color: dc.textTertiary }]}>
                Bijv. "Bij dreiging, dwang, gevaar of kindonveiligheid kies ik eerst veiligheid en steun."
              </Text>
            )}
            <TextInput
              value={safetyException}
              onChangeText={(t) => { setSafetyException(t); setDirty(true); }}
              placeholder="Wanneer kies ik eerst veiligheid en geen verbinding?"
              placeholderTextColor={dc.textTertiary}
              style={[styles.input, { color: dc.textPrimary, borderColor: dc.primary + '30' }]}
              multiline
              returnKeyType="done"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        {dirty && (
          <View style={styles.saveBar}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.saveBtn, { backgroundColor: dc.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.saveBtnText}>{t('kerp.zone.save')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  backBtn: { paddingVertical: 8 },
  zoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 12 },
  zoneBadgeLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  description: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 44, textAlignVertical: 'top' },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f8f8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 6 },
  listItemText: { flex: 1, fontSize: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  addBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  connectionSection: { marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  connectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  connectionTitle: { fontSize: 16, fontWeight: '700' },
  suggestionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  connectionFieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  suggestionText: { fontSize: 12, fontStyle: 'italic', marginBottom: 6, lineHeight: 16 },
});
