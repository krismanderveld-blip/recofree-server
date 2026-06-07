import { useState, useEffect } from 'react';
import { Text, View, Pressable, Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCrisisContentForMessage, type CrisisContent } from '@/lib/crisis/resources';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
    <View className="bg-error/10 border-2 border-error rounded-2xl p-5 mb-4">
      <View className="flex-row items-center mb-3">
        <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#E53935" />
        <Text className="text-lg font-bold text-error ml-2">{content.title}</Text>
      </View>

      <Text className="text-sm text-foreground mb-4 leading-relaxed">
        {content.intro}
      </Text>

      {/* Primary call button — 0800 32 123 (Zelfmoordlijn) */}
      <Pressable
        onPress={handlePrimaryCall}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? '#C62828' : '#E53935',
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
            backgroundColor: pressed ? '#D32F2F' : 'transparent',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#E53935',
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
        <IconSymbol name="paperplane.fill" size={18} color="#E53935" />
        <Text style={{ color: '#E53935', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
          {content.smsButtonText}
        </Text>
      </Pressable>

      {/* Personal emergency contacts */}
      {personalContacts.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 8, letterSpacing: 0.5 }}>
            YOUR CONTACTS
          </Text>
          {personalContacts.map((contact, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleCall(contact.number)}
              style={({ pressed }) => [
                {
                  backgroundColor: pressed ? '#E3F2FD' : '#F5F9FF',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#0a7ea430',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <IconSymbol name="phone.fill" size={18} color="#0a7ea4" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#11181C' }}>{contact.name}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0a7ea4', marginTop: 2 }}>{contact.number}</Text>
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
          <View className="bg-surface rounded-xl p-4 mb-2 border border-border">
            <Text className="text-base font-bold text-foreground">{resource.name}</Text>
            <Text className="text-lg font-bold text-primary mt-1">{resource.number}</Text>
            <Text className="text-xs text-muted mt-1">{resource.description}</Text>
          </View>
        </Pressable>
      ))}

      {onDismiss && (
        <Pressable onPress={onDismiss}>
          <View className="py-2 items-center mt-2">
            <Text className="text-sm text-muted">{content.dismissText}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
