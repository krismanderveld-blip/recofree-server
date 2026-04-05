import { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';

interface DiaryEntry {
  id: string;
  content: string;
  moodTag: string;
  timestamp: string;
}

const MOOD_TAGS = ['Calm', 'Sad', 'Anxious', 'Angry', 'Hopeful', 'Exhausted', 'Grateful', 'Neutral'];

const STORAGE_KEY = '@recofree_diary';

export default function DiaryScreen() {
  const colors = useColors();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorMood, setEditorMood] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load entries on mount
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) setEntries(JSON.parse(json));
      } catch (error) {
        console.error('Failed to load diary:', error);
      }
    })();
  }, []);

  const saveEntry = useCallback(async () => {
    const text = editorText.trim();
    if (!text || isSaving) return;
    setIsSaving(true);

    const newEntry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      content: text,
      moodTag: editorMood || 'Neutral',
      timestamp: new Date().toISOString(),
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to save diary entry:', error);
    }

    setEditorText('');
    setEditorMood('');
    setShowEditor(false);
    setIsSaving(false);
  }, [editorText, editorMood, entries, isSaving]);

  const renderEntry = useCallback(({ item }: { item: DiaryEntry }) => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View className="bg-surface rounded-2xl p-5 mb-3 border border-border">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xs text-muted">{dateStr} at {timeStr}</Text>
          <View className="bg-primary/10 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-primary">{item.moodTag}</Text>
          </View>
        </View>
        <Text className="text-base text-foreground leading-relaxed" numberOfLines={4}>
          {item.content}
        </Text>
      </View>
    );
  }, []);

  return (
    <ScreenContainer className="px-5 pt-2">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-2xl font-bold text-foreground">Diary</Text>
          <Text className="text-sm text-muted">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowEditor(true)}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] },
          ]}
        >
          <View className="bg-primary w-12 h-12 rounded-full items-center justify-center">
            <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      {/* Entry List */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-4">📝</Text>
            <Text className="text-lg font-semibold text-foreground mb-1">No entries yet</Text>
            <Text className="text-sm text-muted text-center">
              Tap the + button to write your first diary entry.
            </Text>
          </View>
        }
      />

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet">
        <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5 pt-4">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Pressable onPress={() => { setShowEditor(false); setEditorText(''); setEditorMood(''); }}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
              <Text className="text-lg font-bold text-foreground">New Entry</Text>
              <Pressable
                onPress={saveEntry}
                disabled={!editorText.trim() || isSaving}
                style={({ pressed }) => [
                  { opacity: !editorText.trim() ? 0.4 : pressed ? 0.7 : 1 },
                ]}
              >
                <Text className="text-base font-bold text-primary">
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Mood Tag Selection */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
                How are you feeling?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {MOOD_TAGS.map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => setEditorMood(tag)}
                    style={({ pressed }) => [
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View
                      className={`rounded-full px-3 py-2 border ${
                        editorMood === tag
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          editorMood === tag ? 'text-primary font-medium' : 'text-foreground'
                        }`}
                      >
                        {tag}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Text Input */}
            <TextInput
              className="flex-1 bg-surface border border-border rounded-2xl px-4 py-4 text-base text-foreground"
              placeholder="Write whatever comes to mind..."
              placeholderTextColor="#9E9E9E"
              value={editorText}
              onChangeText={setEditorText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <Text className="text-xs text-muted mt-2 text-right mb-4">
              {editorText.length} characters
            </Text>
          </KeyboardAvoidingView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}
