import { useState, useEffect } from 'react';
import { Text, View, Pressable, Linking, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCrisisContent, getPrimarySuicideLine, getEmergencyNumber, type CrisisContent, type CrisisResource } from '@/lib/crisis/resources';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors as dc, spacing, radius } from '@/constants/design';
import * as Haptics from 'expo-haptics';

interface EmergencyCardProps {
  visible: boolean;
  onDismiss?: () => void;
}

export function EmergencyCard({ visible, onDismiss }: EmergencyCardProps) {
  const [personalContacts, setPersonalContacts] = useState<{ name: string; number: string }[]>([]);
  const { language, country, t } = useTranslation();

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem('emergencyContacts').then((data) => {
      if (data) setPersonalContacts(JSON.parse(data));
    });
  }, [visible]);

  if (!visible) return null;

  const effectiveCountry = country || 'BE';
  const effectiveLang = language === 'nl' ? 'nl' : language === 'fr' ? 'fr' : 'en';
  const content: CrisisContent = getCrisisContent(effectiveCountry, effectiveLang);
  const primaryLine = getPrimarySuicideLine(effectiveCountry, effectiveLang);

  const handleCall = (number: string, isText?: boolean) => {
    if (isText) {
      // For text-based resources (SMS lines, websites), open URL if it looks like one
      if (number.includes('.')) {
        Linking.openURL(`https://${number}`);
      }
      return;
    }
    const cleaned = number.replace(/[^0-9+]/g, '');
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
    const confirmTitle = effectiveLang === 'nl'
      ? `Wil je ${primaryLine.number} bellen?`
      : effectiveLang === 'fr'
        ? `Voulez-vous appeler le ${primaryLine.number} ?`
        : `Do you want to call ${primaryLine.number}?`;
    const confirmMsg = effectiveLang === 'nl'
      ? `Je wordt doorverbonden met ${primaryLine.name} (24/7, gratis, anoniem).`
      : effectiveLang === 'fr'
        ? `Vous serez connecté(e) à ${primaryLine.name} (24/7, gratuit, anonyme).`
        : `You will be connected to ${primaryLine.name} (24/7, free, anonymous).`;
    const confirmBtn = effectiveLang === 'nl' ? 'Bevestig' : effectiveLang === 'fr' ? 'Confirmer' : 'Confirm';
    const cancelBtn = effectiveLang === 'nl' ? 'Annuleer' : effectiveLang === 'fr' ? 'Annuler' : 'Cancel';

    Alert.alert(
      confirmTitle,
      confirmMsg,
      [
        { text: cancelBtn, style: 'cancel' },
        { text: confirmBtn, style: 'default', onPress: () => {
          const cleaned = primaryLine.number.replace(/[^0-9+]/g, '');
          Linking.openURL(`tel:${cleaned}`);
        }},
      ]
    );
  };

  // Separate primary suicide line from other resources for layout
  const primaryResource = content.resources.find(r => r.category === 'SUICIDE_CRISIS_LINE' || r.category === 'SUICIDE_PREVENTION_LINE' || r.category === 'SUICIDE_AND_CRISIS_LIFELINE' || r.category === 'SAMARITANS');
  const otherResources = content.resources.filter(r => r !== primaryResource);

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

      {/* Primary call button — suicide/crisis line */}
      {primaryResource && !primaryResource.isText && (
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
            {effectiveLang === 'nl' ? 'Bel' : effectiveLang === 'fr' ? 'Appeler' : 'Call'} {primaryLine.number}
          </Text>
        </Pressable>
      )}

      {/* Personal emergency contacts */}
      {personalContacts.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: dc.textMuted, marginBottom: 8, letterSpacing: 0.5 }}>
            {effectiveLang === 'nl' ? 'JOUW CONTACTEN' : effectiveLang === 'fr' ? 'VOS CONTACTS' : 'YOUR CONTACTS'}
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
      {otherResources.map((resource) => (
        <Pressable
          key={resource.number}
          onPress={() => handleCall(resource.number, resource.isText)}
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
