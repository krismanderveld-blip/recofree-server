import { Text, View, Pressable, Linking } from 'react-native';
import { getCrisisContentForMessage, type CrisisContent } from '@/lib/crisis/resources';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
      Linking.openURL(`tel:${cleaned}`);
    }
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

      {content.resources.map((resource) => (
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
