import { Text, View, Pressable, Linking, Platform } from 'react-native';
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
    Linking.openURL('tel:1813');
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

      {/* Primary call button — always 1813 */}
      <Pressable
        onPress={handlePrimaryCall}
        style={({ pressed }) => [
          {
            backgroundColor: pressed ? '#C62828' : '#E53935',
            borderRadius: 16,
            paddingVertical: 18,
            paddingHorizontal: 24,
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <IconSymbol name="phone.fill" size={22} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginLeft: 10 }}>
          Bel 1813
        </Text>
      </Pressable>

      {/* Other resources */}
      {content.resources.filter(r => r.number !== '1813').map((resource) => (
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
