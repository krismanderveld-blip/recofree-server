import { useCallback, useRef, useState, useEffect } from 'react';
import { Text, View, ScrollView, Pressable, Alert, Platform, TextInput, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { GUIDANCE_DEPTH_OPTIONS } from '@/lib/ai/types';
import type { GuidanceDepth } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { SoberCounter } from '@/components/sober-counter';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors as dc, spacing, radius, typography, shadows, cardStyles } from '@/constants/design';
import { HomeButton } from '@/components/home-button';
import { DataPrivacySection } from '@/lib/features/exportImport/ui/DataPrivacySection';
import { useExportImportStores } from '@/lib/features/exportImport/hooks/useExportImportStores';
import { loadVspInsightProfile, buildPdfPlainText, saveVspInsightProfile } from '@/lib/features/vspInsight';
import {
  createVspExportDocument,
  saveVspExportLocally,
  shareVspExport,
} from '@/lib/features/vspInsight/vspInsightFileExport';
import {
  nativeVspLocalSaveAdapter,
  nativeVspShareAdapter,
} from '@/lib/features/vspInsight/vspInsightNativeExport';
import { BalkmetafoorCard } from '@/components/profile/BalkmetafoorCard';
import { NotificationPermissionCard } from '@/components/profile/NotificationPermissionCard';
import { ManualDataRefreshButton } from '@/components/profile/ManualDataRefreshButton';
import { createEmptyBalkmetafoor } from '@/lib/types/balkmetafoor.types';
import type { BalkmetafoorData, BalkmetafoorEntry } from '@/lib/types/balkmetafoor.types';
import { useTranslation } from '@/lib/i18n';
import { LocalDeviceTimeService } from "@/lib/core/time";
import { readJson, writeJson } from '@/lib/storage/memory/atomicJsonStore';

// Stage labels now come from i18n: profile.stage.<key>

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileScreen() {
  const { state, getUserName, getBackpack, getUserDat, updateGuidanceDepth, getGuidanceDepth, resetUser, updateBalkmetafoor, reloadFromStorage } = useUser();
  const router = useRouter();
  const { t } = useTranslation();
  const userName = getUserName();
  const backpack = getBackpack();
  const userDat = getUserDat();
  const currentDepth = getGuidanceDepth();

  const exportImportStores = useExportImportStores();
  const [vspExportingAction, setVspExportingAction] = useState<'save' | 'share' | null>(null);

  // Balkmetafoor state (Elias only)
  const balkmetafoorData: BalkmetafoorData = backpack?.balkmetafoor ?? createEmptyBalkmetafoor();

  const handleAddDraaglast = useCallback(async (text: string) => {
    const entry: BalkmetafoorEntry = {
      id: `dl_${LocalDeviceTimeService.now().epochMs}`,
      text: text.trim(),
      addedAt: LocalDeviceTimeService.now().utcIso,
      sourceModuleId: 'manual',
    };
    const updated: BalkmetafoorData = {
      ...balkmetafoorData,
      initialized: true,
      initializedAt: balkmetafoorData.initializedAt || LocalDeviceTimeService.now().utcIso,
      lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
      draaglast: [...balkmetafoorData.draaglast, entry],
    };
    await updateBalkmetafoor(updated);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [balkmetafoorData, updateBalkmetafoor]);

  const handleAddDraagkracht = useCallback(async (text: string) => {
    const entry: BalkmetafoorEntry = {
      id: `dk_${LocalDeviceTimeService.now().epochMs}`,
      text: text.trim(),
      addedAt: LocalDeviceTimeService.now().utcIso,
      sourceModuleId: 'manual',
    };
    const updated: BalkmetafoorData = {
      ...balkmetafoorData,
      initialized: true,
      initializedAt: balkmetafoorData.initializedAt || LocalDeviceTimeService.now().utcIso,
      lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
      draagkracht: [...balkmetafoorData.draagkracht, entry],
    };
    await updateBalkmetafoor(updated);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [balkmetafoorData, updateBalkmetafoor]);

  const handleRemoveDraaglast = useCallback(async (id: string) => {
    const updated: BalkmetafoorData = {
      ...balkmetafoorData,
      lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
      draaglast: balkmetafoorData.draaglast.filter(e => e.id !== id),
    };
    await updateBalkmetafoor(updated);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [balkmetafoorData, updateBalkmetafoor]);

  const handleRemoveDraagkracht = useCallback(async (id: string) => {
    const updated: BalkmetafoorData = {
      ...balkmetafoorData,
      lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
      draagkracht: balkmetafoorData.draagkracht.filter(e => e.id !== id),
    };
    await updateBalkmetafoor(updated);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [balkmetafoorData, updateBalkmetafoor]);

  const prepareVspExportDocument = useCallback(async () => {
    const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
    let profile = await loadVspInsightProfile('local_user', persona);
    if (!profile) {
      const now = LocalDeviceTimeService.now().utcIso;
      profile = {
        profileVersion: 'vsp_insight_profile.v1',
        persona,
        userId: 'local_user',
        createdAt: now,
        updatedAt: now,
        selfReportedEarlySigns: [],
        observedEarlySigns: [],
        rationalGreenPattern: { patternId: `${persona}_rational_green`, label: 'Rational Green Pattern', confidence: 0, markers: [], examples: [], firstDetectedAt: null, lastUpdatedAt: null },
        overwhelmPattern: { patternId: `${persona}_overwhelm`, label: 'Overwhelm Pattern', confidence: 0, markers: [], examples: [], firstDetectedAt: null, lastUpdatedAt: null },
        realGreenPattern: { patternId: `${persona}_real_green`, label: 'Real Green Pattern', confidence: 0, markers: [], examples: [], firstDetectedAt: null, lastUpdatedAt: null },
        soothingProfile: { genericOptionsUsed: [], personalizedEffectiveOptions: [], excludedOptions: [] },
        phaseTransitionExamples: [],
        wheelOfChangeHistory: [],
        discrepancyHistory: [],
        lastInsightState: null,
        lastUserReportedZone: null,
        lastMoodSnapshot: null,
        lastSoothingChoiceEvent: null,
      };
      await saveVspInsightProfile('local_user', persona, profile);
    }
    const exportedAt = LocalDeviceTimeService.now().utcIso;
    const plainText = buildPdfPlainText({
      persona,
      profile,
      includeRawUserSelectedExamples: false,
      selectedExampleIds: [],
      exportedAt,
      vspSection: backpack?.vspSection ?? undefined,
    });
    return createVspExportDocument(plainText, persona, exportedAt);
  }, [backpack?.vspSection, state.userType]);

  const handleVspSave = useCallback(async () => {
    setVspExportingAction('save');
    try {
      const document = await prepareVspExportDocument();
      const result = await saveVspExportLocally(document, nativeVspLocalSaveAdapter);
      if (result.status === 'saved') {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('profile.vsp_insight.saved.title'), t('profile.vsp_insight.saved.message', { fileName: result.fileName }));
      }
    } catch (error) {
      console.error('[Profile] VSP local export failed:', error);
      Alert.alert(t('profile.alert.export_failed.title'), t('profile.alert.export_failed.message'));
    } finally {
      setVspExportingAction(null);
    }
  }, [prepareVspExportDocument, t]);

  const handleVspShare = useCallback(async () => {
    setVspExportingAction('share');
    try {
      const document = await prepareVspExportDocument();
      const result = await shareVspExport(document, nativeVspShareAdapter, t('profile.vsp_insight.share_title'));
      if (result.status === 'unavailable') {
        Alert.alert(t('profile.vsp_insight.share_unavailable.title'), t('profile.vsp_insight.share_unavailable.message'));
      }
    } catch (error) {
      console.error('[Profile] VSP share failed:', error);
      Alert.alert(t('profile.alert.export_failed.title'), t('profile.alert.export_failed.message'));
    } finally {
      setVspExportingAction(null);
    }
  }, [prepareVspExportDocument, t]);
  const isElias = state.userType === 'elias';
  const companionName = isElias ? 'Elias' : 'Kim';
  const userTypeLabel = isElias ? t('profile.user_type.elias') : t('profile.user_type.kim');
  const stageOfChange = userDat?.stageOfChange ?? 'contemplation';
  const totalSessions = userDat?.totalSessions ?? 0;
  const moodCheckIns = userDat?.moodHistory?.length ?? 0;

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  // Emergency contacts (max 2)
  const [emergencyContacts, setEmergencyContacts] = useState<{ name: string; number: string }[]>([]);
  const [editingContact, setEditingContact] = useState<{ name: string; number: string } | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);

  useEffect(() => {
    readJson<{ name: string; number: string }[]>('emergencyContacts').then((data) => {
      if (Array.isArray(data)) setEmergencyContacts(data);
    });
  }, []);

  const saveContact = useCallback(async () => {
    if (!editingContact?.name.trim() || !editingContact?.number.trim()) return;
    const updated = [...emergencyContacts, { name: editingContact.name.trim(), number: editingContact.number.trim() }].slice(0, 2);
    setEmergencyContacts(updated);
    await writeJson('emergencyContacts', updated);
    setEditingContact(null);
    setShowContactForm(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [editingContact, emergencyContacts]);

  const removeContact = useCallback(async (index: number) => {
    const updated = emergencyContacts.filter((_, i) => i !== index);
    setEmergencyContacts(updated);
    await writeJson('emergencyContacts', updated);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [emergencyContacts]);

  const handleVersionTap = useCallback(() => {
    const now = LocalDeviceTimeService.now().epochMs;
    if (now - lastTapRef.current > 2000) {
      tapCountRef.current = 0;
    }
    lastTapRef.current = now;
    tapCountRef.current += 1;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push('/dev/debug-log' as any);
    }
  }, [router]);

  const handleDepthChange = useCallback(async (depth: GuidanceDepth) => {
    await updateGuidanceDepth(depth);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [updateGuidanceDepth]);

  const handleResetData = useCallback(() => {
    const doReset = async () => {
      try {
        // Clear ALL AsyncStorage keys (including any not tracked by user-context)
        await AsyncStorage.clear();
        // Reset in-memory state (intakeCompleted → false, backpack → null, etc.)
        await resetUser();
        // Success feedback: haptic confirmation
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Brief toast-like alert on native before navigating, immediate on web
        if (Platform.OS === 'web') {
          router.replace('/intake' as any);
        } else {
          Alert.alert(t('profile.alert.reset_done.title'), t('profile.alert.reset_done.message'), [
            { text: t('profile.alert.reset_done.button.ok'), onPress: () => router.replace('/intake' as any) },
          ]);
        }
      } catch (e) {
        console.error('[Profile] Reset failed:', e);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(t('profile.alert.reset_confirm_web'))) {
        doReset();
      }
    } else {
      Alert.alert(
        t('profile.alert.reset_confirm.title'),
        t('profile.alert.reset_confirm.message'),
        [
          { text: t('profile.emergency_contacts.alert.remove.button.cancel'), style: 'cancel' },
          { text: t('profile.alert.reset_confirm.button.reset'), style: 'destructive', onPress: doReset },
        ],
      );
    }
  }, [resetUser, router]);

  return (
    <ScreenContainer containerClassName="bg-backgroundWarm">
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.screenHorizontal, paddingTop: spacing.screenTop }} showsVerticalScrollIndicator={false}>
        <HomeButton />
        <Text style={{ ...typography.titleLarge, color: dc.textPrimary, marginBottom: spacing.lg }}>{t('profile.title')}</Text>

        {/* User Card */}
        <View style={{ ...cardStyles.default, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: dc.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: dc.primary }}>
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.titleSmall, color: dc.textPrimary }}>{fixUnicode(userName) || t('profile.user_card.default_name')}</Text>
            <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginTop: 2 }}>{userTypeLabel}</Text>
            <Text style={{ ...typography.micro, color: dc.textTertiary, marginTop: 2 }}>
              {companionName}{isElias ? ` · ${t(`profile.stage.${stageOfChange}`)}` : ''} · {totalSessions} {t('profile.user_card.stats.session')}{totalSessions !== 1 ? t('profile.user_card.stats.plural_s') : ''} · {moodCheckIns} check-in{moodCheckIns !== 1 ? t('profile.user_card.stats.plural_s') : ''}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={dc.textTertiary} />
        </View>

        {/* Sober Counter (Elias only) */}
        {isElias && (
          <View style={{ marginBottom: spacing.lg }}>
            <SoberCounter />
          </View>
        )}

        {/* Balkmetafoor — Draaglast/Draagkracht (Elias only) */}
        {isElias && (
          <View style={{ marginBottom: spacing.xl }}>
            <BalkmetafoorCard
              data={balkmetafoorData}
              onAddDraaglast={handleAddDraaglast}
              onAddDraagkracht={handleAddDraagkracht}
              onRemoveDraaglast={handleRemoveDraaglast}
              onRemoveDraagkracht={handleRemoveDraagkracht}
            />
          </View>
        )}

        {/* Guidance Depth */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: spacing.xs, fontWeight: '700', letterSpacing: 0.5 }}>
            {t('profile.guidance_depth.title')}
          </Text>
          <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginBottom: spacing.md, lineHeight: 18 }}>
            {t('profile.guidance_depth.description')}
          </Text>

          <View style={{ gap: spacing.sm }}>
            {([{ value: 'light' as const, label: t('profile.guidance_depth.option.light.label'), description: t('profile.guidance_depth.option.light.description') },
              { value: 'normal' as const, label: t('profile.guidance_depth.option.normal.label'), description: t('profile.guidance_depth.option.normal.description') },
              { value: 'deep' as const, label: t('profile.guidance_depth.option.deep.label'), description: t('profile.guidance_depth.option.deep.description') }]).map((option) => {
              const isActive = option.value === currentDepth;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleDepthChange(option.value)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                >
                  <View style={{
                    ...cardStyles.default,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    ...(isActive ? {
                      backgroundColor: dc.primarySoft,
                      borderWidth: 2,
                      borderColor: dc.primary,
                    } : {}),
                  }}>
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isActive ? dc.primary : dc.border,
                      backgroundColor: isActive ? dc.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isActive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dc.textInverse }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        ...typography.bodyMedium,
                        fontWeight: '600',
                        color: isActive ? dc.primary : dc.textPrimary,
                      }}>
                        {option.label}
                      </Text>
                      <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>{option.description}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: spacing.xs, fontWeight: '700', letterSpacing: 0.5 }}>
            {t('profile.emergency_contacts.title')}
          </Text>
          <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginBottom: spacing.md, lineHeight: 18 }}>
            {t('profile.emergency_contacts.description')}
          </Text>

          {emergencyContacts.map((contact, idx) => (
            <View key={idx} style={{
              ...cardStyles.default,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Pressable
                onPress={() => Linking.openURL(`tel:${contact.number.replace(/\D/g, '')}`)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.textPrimary }}>{contact.name}</Text>
                <Text style={{ ...typography.bodyMedium, fontWeight: '700', color: dc.primary, marginTop: 2 }}>{contact.number}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (confirm(t('profile.emergency_contacts.alert.remove.message_name', { name: contact.name }))) removeContact(idx);
                  } else {
                    Alert.alert(t('profile.emergency_contacts.alert.remove.title'), t('profile.emergency_contacts.alert.remove.message_name', { name: contact.name }), [
                      { text: t('profile.alert.reset_confirm.button.cancel'), style: 'cancel' },
                      { text: t('profile.emergency_contacts.alert.remove.button.remove'), style: 'destructive', onPress: () => removeContact(idx) },
                    ]);
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}
              >
                <Text style={{ fontSize: 18, color: dc.danger }}>×</Text>
              </Pressable>
            </View>
          ))}

          {showContactForm ? (
            <View style={{
              ...cardStyles.default,
              borderColor: dc.primary,
              borderWidth: 2,
            }}>
              <TextInput
                placeholder={t('profile.emergency_contacts.form.name_placeholder')}
                value={editingContact?.name ?? ''}
                onChangeText={(t) => setEditingContact(prev => ({ name: t, number: prev?.number ?? '' }))}
                style={{ ...typography.bodyMedium, borderBottomWidth: 1, borderBottomColor: dc.borderSoft, paddingVertical: 8, marginBottom: 12, color: dc.textPrimary }}
                placeholderTextColor={dc.textMuted}
              />
              <TextInput
                placeholder={t('profile.emergency_contacts.form.number_placeholder')}
                value={editingContact?.number ?? ''}
                onChangeText={(t) => setEditingContact(prev => ({ name: prev?.name ?? '', number: t }))}
                keyboardType="phone-pad"
                style={{ ...typography.bodyMedium, borderBottomWidth: 1, borderBottomColor: dc.borderSoft, paddingVertical: 8, marginBottom: spacing.md, color: dc.textPrimary }}
                placeholderTextColor={dc.textMuted}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => { setShowContactForm(false); setEditingContact(null); }}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.lg, backgroundColor: dc.borderSoft }]}
                >
                  <Text style={{ ...typography.bodySmall, color: dc.textSecondary }}>{t('profile.emergency_contacts.form.button.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={saveContact}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.lg, backgroundColor: dc.primary }]}
                >
                  <Text style={{ ...typography.bodySmall, fontWeight: '600', color: dc.textInverse }}>{t('profile.emergency_contacts.form.button.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : emergencyContacts.length < 2 ? (
            <Pressable
              onPress={() => { setShowContactForm(true); setEditingContact({ name: '', number: '' }); }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <View style={{
                borderRadius: radius.xl,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: dc.primary + '40',
                borderStyle: 'dashed',
                alignItems: 'center',
              }}>
                <Text style={{ ...typography.bodySmall, color: dc.primary, fontWeight: '600' }}>{t('profile.emergency_contacts.button.add')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* VSP Insight Export */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: spacing.xs, fontWeight: '700', letterSpacing: 0.5 }}>
            {t('profile.vsp_insight.title')}
          </Text>
          <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginBottom: spacing.md, lineHeight: 18 }}>
            {t('profile.vsp_insight.description')}
          </Text>
          <Pressable
            onPress={handleVspSave}
            disabled={vspExportingAction !== null}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <View style={{
              ...cardStyles.default,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: vspExportingAction !== null ? 0.6 : 1,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: dc.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{vspExportingAction === 'save' ? '⏳' : '💾'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.primary }}>
                  {vspExportingAction === 'save' ? t('profile.vsp_insight.button.saving') : t('profile.vsp_insight.button.save')}
                </Text>
                <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>{t('profile.vsp_insight.button.save_description')}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={dc.textTertiary} />
            </View>
          </Pressable>
          <Pressable
            onPress={handleVspShare}
            disabled={vspExportingAction !== null}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: spacing.sm }]}
          >
            <View style={{
              ...cardStyles.default,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: vspExportingAction !== null ? 0.6 : 1,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: dc.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{vspExportingAction === 'share' ? '⏳' : '📤'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.primary }}>
                  {vspExportingAction === 'share' ? t('profile.vsp_insight.button.generating') : t('profile.vsp_insight.button.share')}
                </Text>
                <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>{t('profile.vsp_insight.button.share_description')}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={dc.textTertiary} />
            </View>
          </Pressable>
        </View>

        {/* Distillation Proposal History */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: spacing.xs, fontWeight: '700', letterSpacing: 0.5 }}>
            {t('profile.proposal_history.title')}
          </Text>
          <Text style={{ ...typography.bodySmall, color: dc.textSecondary, marginBottom: spacing.md, lineHeight: 18 }}>
            {t('profile.proposal_history.description')}
          </Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/proposal-history' as any); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <View style={{
              ...cardStyles.default,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: dc.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>📝</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.primary }}>
                  {t('profile.proposal_history.button')}
                </Text>
                <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>{t('profile.proposal_history.button_description')}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={dc.textTertiary} />
            </View>
          </Pressable>
        </View>

        {/* Notification Permissions */}
        {Platform.OS !== 'web' && (
          <NotificationPermissionCard />
        )}

        {/* Data & Privacy — Export / Import */}
          <ManualDataRefreshButton />
        <View style={{ marginBottom: spacing.xl }}>
          <DataPrivacySection stores={exportImportStores} appVersion={APP_VERSION} onImportSuccess={reloadFromStorage} />
        </View>

        {/* Reset All Data */}
        <View style={{ marginTop: spacing.md }}>
          <Pressable
            onPress={handleResetData}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <View style={{
              ...cardStyles.default,
              backgroundColor: dc.dangerSoft,
              borderColor: dc.danger + '25',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: dc.danger + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{'🗑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, fontWeight: '600', color: dc.danger }}>{t('profile.reset_data.button.title')}</Text>
                <Text style={{ ...typography.caption, color: dc.textSecondary, marginTop: 2 }}>{t('profile.reset_data.button.description')}</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Version */}
        <Pressable onPress={handleVersionTap} hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }} style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Text style={{ ...typography.micro, color: dc.textMuted }}>v{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
