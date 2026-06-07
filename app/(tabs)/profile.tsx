import { useCallback, useRef, useState, useEffect } from 'react';
import { Text, View, ScrollView, Pressable, Alert, Platform, TextInput, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';
import { GUIDANCE_DEPTH_OPTIONS } from '@/lib/ai/types';
import type { GuidanceDepth } from '@/lib/ai/types';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { SoberCounter } from '@/components/sober-counter';
import { IconSymbol } from '@/components/ui/icon-symbol';

const STAGE_LABELS: Record<string, string> = {
  precontemplation: 'Precontemplation',
  contemplation: 'Contemplation',
  preparation: 'Preparation',
  action: 'Action',
  maintenance: 'Maintenance',
};

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileScreen() {
  const { state, getUserName, getBackpack, getUserDat, updateGuidanceDepth, getGuidanceDepth } = useUser();
  const colors = useColors();
  const router = useRouter();
  const userName = getUserName();
  const backpack = getBackpack();
  const userDat = getUserDat();
  const currentDepth = getGuidanceDepth();

  const isElias = state.userType === 'elias';
  const companionName = isElias ? 'Elias' : 'Kim';
  const userTypeLabel = isElias ? 'Personal recovery' : 'Supporting a loved one';
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
    AsyncStorage.getItem('emergencyContacts').then((data) => {
      if (data) setEmergencyContacts(JSON.parse(data));
    });
  }, []);

  const saveContact = useCallback(async () => {
    if (!editingContact?.name.trim() || !editingContact?.number.trim()) return;
    const updated = [...emergencyContacts, { name: editingContact.name.trim(), number: editingContact.number.trim() }].slice(0, 2);
    setEmergencyContacts(updated);
    await AsyncStorage.setItem('emergencyContacts', JSON.stringify(updated));
    setEditingContact(null);
    setShowContactForm(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [editingContact, emergencyContacts]);

  const removeContact = useCallback(async (index: number) => {
    const updated = emergencyContacts.filter((_, i) => i !== index);
    setEmergencyContacts(updated);
    await AsyncStorage.setItem('emergencyContacts', JSON.stringify(updated));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [emergencyContacts]);

  const handleVersionTap = useCallback(() => {
    const now = Date.now();
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
        await AsyncStorage.clear();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        if (Platform.OS === 'web') {
          window.location.reload();
        } else {
          Alert.alert('Data Cleared', 'All data has been reset. Please restart the app.', [{ text: 'OK' }]);
        }
      } catch (e) {
        console.error('[Profile] Reset failed:', e);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        doReset();
      }
    } else {
      Alert.alert(
        'Reset All Data',
        'This will permanently delete all your data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: doReset },
        ],
      );
    }
  }, []);

  return (
    <ScreenContainer className="px-5 pt-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <View style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.primary + '18',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primary }}>
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{fixUnicode(userName) || 'User'}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{userTypeLabel}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {companionName}{isElias ? ` · ${STAGE_LABELS[stageOfChange] ?? stageOfChange}` : ''} · {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {moodCheckIns} check-in{moodCheckIns !== 1 ? 's' : ''}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </View>

        {/* Sober Counter (Elias only) */}
        {isElias && (
          <View style={{ marginBottom: 20 }}>
            <SoberCounter />
          </View>
        )}

        {/* Guidance Depth */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 4, letterSpacing: 0.5 }}>
            GUIDANCE DEPTH
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
            Choose how intensely the conversation goes. You can change this anytime.
          </Text>

          <View style={{ gap: 8 }}>
            {GUIDANCE_DEPTH_OPTIONS.map((option) => {
              const isActive = option.value === currentDepth;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleDepthChange(option.value)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={{
                    borderRadius: 14,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: isActive ? colors.primary + '08' : '#fff',
                    borderWidth: isActive ? 2 : 1,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}>
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isActive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: isActive ? colors.primary : colors.foreground,
                      }}>
                        {option.label}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{option.description}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 4, letterSpacing: 0.5 }}>
            EMERGENCY CONTACTS
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>
            Add up to 2 personal contacts shown during a crisis (e.g. family, sponsor).
          </Text>

          {emergencyContacts.map((contact, idx) => (
            <View key={idx} style={{
              borderRadius: 14,
              padding: 16,
              marginBottom: 8,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Pressable
                onPress={() => Linking.openURL(`tel:${contact.number.replace(/\D/g, '')}`)}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{contact.name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: 2 }}>{contact.number}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (confirm(`Remove ${contact.name}?`)) removeContact(idx);
                  } else {
                    Alert.alert('Remove contact', `Remove ${contact.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeContact(idx) },
                    ]);
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}
              >
                <Text style={{ fontSize: 18, color: colors.error }}>×</Text>
              </Pressable>
            </View>
          ))}

          {showContactForm ? (
            <View style={{
              borderRadius: 14,
              padding: 16,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: colors.primary,
            }}>
              <TextInput
                placeholder="Name (e.g. Dad, Sister)"
                value={editingContact?.name ?? ''}
                onChangeText={(t) => setEditingContact(prev => ({ name: t, number: prev?.number ?? '' }))}
                style={{ fontSize: 14, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, marginBottom: 12, color: colors.foreground }}
                placeholderTextColor={colors.muted}
              />
              <TextInput
                placeholder="Phone number"
                value={editingContact?.number ?? ''}
                onChangeText={(t) => setEditingContact(prev => ({ name: prev?.name ?? '', number: t }))}
                keyboardType="phone-pad"
                style={{ fontSize: 14, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, marginBottom: 16, color: colors.foreground }}
                placeholderTextColor={colors.muted}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => { setShowContactForm(false); setEditingContact(null); }}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: colors.border + '40' }]}
                >
                  <Text style={{ fontSize: 14, color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveContact}
                  style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: colors.primary }]}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : emergencyContacts.length < 2 ? (
            <Pressable
              onPress={() => { setShowContactForm(true); setEditingContact({ name: '', number: '' }); }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderWidth: 1,
                borderColor: colors.primary + '40',
                borderStyle: 'dashed',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>+ Add emergency contact</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Reset All Data */}
        <View style={{ marginTop: 16 }}>
          <Pressable
            onPress={handleResetData}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <View style={{
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 20,
              backgroundColor: colors.error + '08',
              borderWidth: 1,
              borderColor: colors.error + '25',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.error + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{'\u{1F5D1}'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.error }}>Reset All Data</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Permanently deletes all data and restarts the intake process.</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Version */}
        <Pressable onPress={handleVersionTap} hitSlop={{ top: 20, bottom: 20, left: 40, right: 40 }} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>v{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
