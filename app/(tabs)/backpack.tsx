import { useState } from 'react';
import {
  Text,
  View,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface RugzakEntry {
  key: string;
  value: string;
}

export default function BackpackScreen() {
  const { state, updateRugzak } = useUser();
  const colors = useColors();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const rugzak = state.rugzak;
  const entries: RugzakEntry[] = rugzak
    ? Object.entries(rugzak.entries).map(([key, value]) => ({ key, value }))
    : [];

  const handleAddEntry = async () => {
    const trimmedKey = newKey.trim();
    const trimmedValue = newValue.trim();

    if (!trimmedKey || !trimmedValue) {
      if (Platform.OS === 'web') {
        alert('Please fill in both fields.');
      } else {
        Alert.alert('Missing info', 'Please fill in both fields.');
      }
      return;
    }

    await updateRugzak({ [trimmedKey]: trimmedValue });
    setNewKey('');
    setNewValue('');
    setShowAddForm(false);
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (value: string): string => {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {}
    return value;
  };

  const getCategoryIcon = (key: string): string => {
    if (key.startsWith('intake_')) return '🌱';
    if (key.includes('emotie') || key.includes('emotion')) return '💚';
    if (key.includes('context') || key.includes('note')) return '📝';
    if (key.includes('datum') || key.includes('date')) return '📅';
    if (key.includes('urgentie') || key.includes('urgency')) return '⚡';
    return '🎒';
  };

  const renderEntry = ({ item }: { item: RugzakEntry }) => {
    const isDate = item.key.includes('datum') || item.key.includes('date');
    const displayValue = isDate ? formatDate(item.value) : item.value;
    const icon = getCategoryIcon(item.key);

    return (
      <View className="bg-surface border border-border rounded-xl p-4 mb-3">
        <View className="flex-row items-center mb-1">
          <Text className="text-base mr-2">{icon}</Text>
          <Text className="text-xs text-muted uppercase tracking-wider flex-1">
            {formatLabel(item.key)}
          </Text>
        </View>
        <Text className="text-base text-foreground leading-relaxed ml-7">
          {displayValue}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="px-5 pt-4">
      {/* Header */}
      <View className="mb-5">
        <Text className="text-2xl font-bold text-foreground">Backpack</Text>
        <Text className="text-sm text-muted mt-1">
          Your personal context — what {state.userType === 'elias' ? 'Elias' : 'Kim'} knows about you
        </Text>
      </View>

      {/* User Info Card */}
      {rugzak && (
        <View className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
          <View className="flex-row items-center">
            <View className="bg-primary w-10 h-10 rounded-full items-center justify-center mr-3">
              <Text className="text-white text-lg font-bold">
                {rugzak.naam?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground">{rugzak.naam}</Text>
              <Text className="text-xs text-muted capitalize">
                {rugzak.userType === 'elias' ? 'Recovery journey' : 'Supporting a loved one'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Entries List */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-4xl mb-3">🎒</Text>
            <Text className="text-base text-muted text-center">
              Your backpack is empty.{'\n'}Complete the intake to get started.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="mt-2">
            {showAddForm ? (
              <View className="bg-surface border border-border rounded-xl p-4">
                <Text className="text-sm font-semibold text-foreground mb-3">Add a note</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-base text-foreground mb-2"
                  placeholder="Label (e.g., 'personal goal')"
                  placeholderTextColor="#9E9E9E"
                  value={newKey}
                  onChangeText={setNewKey}
                />
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-base text-foreground mb-3"
                  placeholder="Content"
                  placeholderTextColor="#9E9E9E"
                  value={newValue}
                  onChangeText={setNewValue}
                  multiline
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      setShowAddForm(false);
                      setNewKey('');
                      setNewValue('');
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}
                  >
                    <View className="bg-surface border border-border rounded-lg py-3 items-center">
                      <Text className="text-sm text-muted font-semibold">Cancel</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={handleAddEntry}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}
                  >
                    <View className="bg-primary rounded-lg py-3 items-center">
                      <Text className="text-sm text-white font-semibold">Save</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowAddForm(true)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View className="flex-row items-center justify-center py-3 bg-surface border border-border border-dashed rounded-xl">
                  <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
                  <Text className="text-sm text-primary font-semibold ml-2">Add a note</Text>
                </View>
              </Pressable>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}
