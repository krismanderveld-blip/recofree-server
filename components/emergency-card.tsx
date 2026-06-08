import { useState, useEffect } from 'react';
import { Text, View, Pressable, Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCrisisContentForMessage, type CrisisContent } from '@/lib/crisis/resources';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors as dc, spacing, radius } from '@/constants/design';
import * as Haptics from 'expo-haptics';

interface EmergencyCardProps {
  visible: boolean;
  onDismiss?: () => void;
  /** Last user message for language detection. If null/undefined, defaults to Dutch. */
  lastUserMessage?: string | null;
}

export function EmergencyCard({ visible, onDismiss, lastUserMessage }: EmergencyCardProps) {
  const [personalContacts, setPersonalContacts] = useState<{ name: string; number: string }[]>([]);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem('emergencyContacts').then((data) => {
      if (data) setPersonalContacts(JSON.parse(data));
    });
  }, [visible]);

  if (!visible) return null;

  const content: CrisisContent = getCrisisContentForMessage(lastUserMessage);

  const handleCall = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Linking.openURL(`tel:${cleaned}`);
    }
  };

  const handlePrimaryCall = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Alert.alert(
      content.callConfirmTitle,
      content.callConfirmMessage,
      [
        { text: content.cancelButton, style: 'cancel' },
        { text: content.confirmButton, style: 'default', onPress: () => Linking.openURL('tel:080032123') },
      ]
    );
  };

  const handleSms = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Linking.openURL('tel:107');
  };

  return (
    <View style={{
      backgroundColor: dc.dangerSoft,
      borderWidth: 2,
      borderColor: dc.danger,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <IconSymbol name="exclamationmark.triangle.fill" size={24} color={dc.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: dc.danger, marginLeft: 8 }}>
          {content.title}
        </Text>
      </View>

      <Text style={{ fontSize: 14, color: dc.textPrimary, marginBottom: spacing.md, lineHeight: 20 }}>
        {content.intro}
      </Text>

      {/* Primary call button — 0800 32 123 (Zelfmoordlijn) */}
      <Pressable
        onPress={handlePrimaryCall}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? '#9A3A3A' : dc.danger,
            borderRadius: 16,
            paddingVertical: 18,
            paddingHorizontal: 24,
            marginBottom: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <IconSymbol name="phone.fill" size={22} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 10 }}>
          {content.callButtonText}
        </Text>
      </Pressable>

      {/* Secondary call button — 107 (CGG) */}
      <Pressable
        onPress={handleSms}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? dc.dangerSoft : 'transparent',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: dc.danger,
            paddingVertical: 12,
            paddingHorizontal: 20,
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <IconSymbol name="paperplane.fill" size={18} color={dc.danger} />
        <Text style={{ color: dc.danger, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
          {content.smsButtonText}
        </Text>
      </Pressable>

      {/* Personal emergency contacts */}
      {personalContacts.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: dc.textMuted, marginBottom: 8, letterSpacing: 0.5 }}>
            YOUR CONTACTS
          </Text>
          {personalContacts.map((contact, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleCall(contact.number)}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? dc.primarySoft : dc.surface,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: dc.borderSoft,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <IconSymbol name="phone.fill" size={18} color={dc.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: dc.textPrimary }}>{contact.name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: dc.primary, marginTop: 2 }}>{contact.number}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Other resources */}
      {content.resources.filter(r => r.number !== '0800 32 123' && r.number !== '107').map((resource) => (
        <Pressable
          key={resource.name}
          onPress={() => handleCall(resource.number)}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={{
            backgroundColor: dc.surface,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: dc.borderSoft,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: dc.textPrimary }}>{resource.name}</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: dc.primary, marginTop: 4 }}>{resource.number}</Text>
            <Text style={{ fontSize: 12, color: dc.textMuted, marginTop: 4 }}>{resource.description}</Text>
          </View>
        </Pressable>
      ))}

      {onDismiss && (
        <Pressable onPress={onDismiss}>
          <View style={{ paddingVertical: 8, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 14, color: dc.textMuted }}>{content.dismissText}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
