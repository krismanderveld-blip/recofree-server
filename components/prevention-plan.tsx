/**
 * PreventionPlan — Terugval-preventieplan component
 * An editable form in the backpack where users fill in their relapse prevention plan.
 * This plan is automatically sent to Elias when a herval/terugval event is reported.
 */
import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { useTranslation } from '@/lib/i18n';

interface PreventionPlanData {
  warningSigns: string;
  copingStrategies: string;
  supportContacts: string;
  safeActivities: string;
  motivation: string;
}

interface PreventionPlanProps {
  plan: PreventionPlanData | undefined;
  onSave: (plan: PreventionPlanData) => Promise<void>;
}

export function PreventionPlan({ plan, onSave }: PreventionPlanProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warningSigns, setWarningSigns] = useState(plan?.warningSigns ?? '');
  const [copingStrategies, setCopingStrategies] = useState(plan?.copingStrategies ?? '');
  const [supportContacts, setSupportContacts] = useState(plan?.supportContacts ?? '');
  const [safeActivities, setSafeActivities] = useState(plan?.safeActivities ?? '');
  const [motivation, setMotivation] = useState(plan?.motivation ?? '');

  const hasContent = warningSigns || copingStrategies || supportContacts || safeActivities || motivation;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    await onSave({ warningSigns, copingStrategies, supportContacts, safeActivities, motivation });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
    setIsSaving(false);
  }, [warningSigns, copingStrategies, supportContacts, safeActivities, motivation, onSave]);

  const fields = [
    { key: 'warningSigns', value: warningSigns, setter: setWarningSigns, label: t('backpack.prevention.warning_signs'), placeholder: t('backpack.prevention.warning_signs_placeholder') },
    { key: 'copingStrategies', value: copingStrategies, setter: setCopingStrategies, label: t('backpack.prevention.coping_strategies'), placeholder: t('backpack.prevention.coping_strategies_placeholder') },
    { key: 'supportContacts', value: supportContacts, setter: setSupportContacts, label: t('backpack.prevention.support_contacts'), placeholder: t('backpack.prevention.support_contacts_placeholder') },
    { key: 'safeActivities', value: safeActivities, setter: setSafeActivities, label: t('backpack.prevention.safe_activities'), placeholder: t('backpack.prevention.safe_activities_placeholder') },
    { key: 'motivation', value: motivation, setter: setMotivation, label: t('backpack.prevention.motivation'), placeholder: t('backpack.prevention.motivation_placeholder') },
  ];

  return (
    <View style={{ marginBottom: 16, padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>{t('backpack.prevention.title')}</Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('backpack.prevention.subtitle')}</Text>
        </View>
        <Pressable
          onPress={() => setIsEditing(!isEditing)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 8 }]}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
            {isEditing ? t('backpack.prevention.cancel') : t('backpack.prevention.edit')}
          </Text>
        </Pressable>
      </View>

      {/* Fields */}
      {isEditing ? (
        <View style={{ gap: 12 }}>
          {fields.map((field) => (
            <View key={field.key}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  color: colors.foreground,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          ))}
          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [{
              opacity: pressed || isSaving ? 0.7 : 1,
              backgroundColor: colors.primary,
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
              marginTop: 4,
            }]}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
              {isSaving ? t('backpack.prevention.saving') : t('backpack.prevention.save')}
            </Text>
          </Pressable>
        </View>
      ) : hasContent ? (
        <View style={{ gap: 10 }}>
          {fields.map((field) => field.value ? (
            <View key={field.key}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 2 }}>{field.label}</Text>
              <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{field.value}</Text>
            </View>
          ) : null)}
        </View>
      ) : (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>{t('backpack.prevention.empty')}</Text>
          <Pressable
            onPress={() => setIsEditing(true)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + '15', borderRadius: 8 }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{t('backpack.prevention.start')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
