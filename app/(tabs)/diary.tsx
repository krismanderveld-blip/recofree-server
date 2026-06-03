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
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { useUser } from '@/lib/user-context';
import * as Haptics from 'expo-haptics';

interface GratitudeData {
  entry1: string;
  entry2: string;
  entry3: string;
}

interface DiaryEntry {
  id: string;
  content: string;
  moodTag: string;
  timestamp: string;
  gratitude?: GratitudeData;
}

const MOOD_TAGS = ['Calm', 'Sad', 'Anxious', 'Angry', 'Hopeful', 'Exhausted', 'Grateful', 'Neutral'];

const STORAGE_KEY = '@recofree_diary';

const GRATITUDE_EXPLANATION =
  'Taking a moment to notice what is good does not mean ignoring what is hard. ' +
  'It means training your mind to hold both. ' +
  'Research shows that people in recovery who practice gratitude regularly ' +
  'experience fewer cravings, better sleep, and stronger relationships. ' +
  'You do not have to feel grateful. You just have to look.';

function GratitudeStreakBadge({ streak, onPress }: { streak: number; onPress: () => void }) {
  if (streak === 0) return null;

  let label: string;
  if (streak === 1) label = '1 day of gratitude';
  else if (streak === 2) label = '2 days in a row';
  else label = `\uD83D\uDD25 ${streak} days in a row`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View className="bg-success/10 rounded-full px-3 py-1.5 flex-row items-center self-start mb-3">
        <Text className="text-xs font-medium text-success">{label}</Text>
      </View>
    </Pressable>
  );
}

export default function DiaryScreen() {
  const colors = useColors();
  const { state } = useUser();
  const gratitudeStreak = state.userDat?.gratitudeStreak ?? 0;
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorMood, setEditorMood] = useState('');
  const [gratitude1, setGratitude1] = useState('');
  const [gratitude2, setGratitude2] = useState('');
  const [gratitude3, setGratitude3] = useState('');
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

  const resetEditor = useCallback(() => {
    setEditorText('');
    setEditorMood('');
    setGratitude1('');
    setGratitude2('');
    setGratitude3('');
    setShowEditor(false);
  }, []);

  const saveEntry = useCallback(async () => {
    const text = editorText.trim();
    if (!text || isSaving) return;
    setIsSaving(true);

    const g1 = gratitude1.trim();
    const g2 = gratitude2.trim();
    const g3 = gratitude3.trim();
    const hasGratitude = g1 || g2 || g3;

    const newEntry: DiaryEntry = {
      id: `diary_${Date.now()}`,
      content: text,
      moodTag: editorMood || 'Neutral',
      timestamp: new Date().toISOString(),
      ...(hasGratitude
        ? { gratitude: { entry1: g1, entry2: g2, entry3: g3 } }
        : {}),
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

    resetEditor();
    setIsSaving(false);
  }, [editorText, editorMood, gratitude1, gratitude2, gratitude3, entries, isSaving, resetEditor]);

  const renderEntry = useCallback(({ item }: { item: DiaryEntry }) => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasGratitude = item.gratitude && (item.gratitude.entry1 || item.gratitude.entry2 || item.gratitude.entry3);

    return (
      <View className="bg-surface rounded-2xl p-5 mb-3 border border-border">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xs text-muted">{dateStr} at {timeStr}</Text>
          <View className="flex-row items-center gap-2">
            {hasGratitude && (
              <View className="bg-success/10 rounded-full px-2 py-1">
                <Text className="text-xs text-success">Gratitude</Text>
              </View>
            )}
            <View className="bg-primary/10 rounded-full px-3 py-1">
              <Text className="text-xs font-medium text-primary">{item.moodTag}</Text>
            </View>
          </View>
        </View>
        <Text className="text-base text-foreground leading-relaxed" numberOfLines={4}>
          {item.content}
        </Text>
        {hasGratitude && (
          <View className="mt-3 pt-3 border-t border-border">
            {item.gratitude!.entry1 ? (
              <Text className="text-sm text-muted mb-1">1. {item.gratitude!.entry1}</Text>
            ) : null}
            {item.gratitude!.entry2 ? (
              <Text className="text-sm text-muted mb-1">2. {item.gratitude!.entry2}</Text>
            ) : null}
            {item.gratitude!.entry3 ? (
              <Text className="text-sm text-muted">3. {item.gratitude!.entry3}</Text>
            ) : null}
          </View>
        )}
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

      {/* Gratitude Streak Badge */}
      <GratitudeStreakBadge streak={gratitudeStreak} onPress={() => setShowEditor(true)} />

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
            <View className="flex-row justify-between items-center mb-4">
              <Pressable onPress={resetEditor}>
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

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
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

              {/* Section 1: Journal Text Input */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
                  Journal
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-2xl px-4 py-4 text-base text-foreground"
                  placeholder="Write whatever comes to mind..."
                  placeholderTextColor="#9E9E9E"
                  value={editorText}
                  onChangeText={setEditorText}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  style={{ minHeight: 120 }}
                />
                <Text className="text-xs text-muted mt-1 text-right">
                  {editorText.length} characters
                </Text>
              </View>

              {/* Section 2: Gratitude */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
                  Gratitude
                </Text>
                <Text className="text-sm text-muted leading-relaxed mb-4">
                  {GRATITUDE_EXPLANATION}
                </Text>
                <View className="gap-3">
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                    placeholder="Something I am grateful for today..."
                    placeholderTextColor="#9E9E9E"
                    value={gratitude1}
                    onChangeText={setGratitude1}
                    returnKeyType="next"
                  />
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                    placeholder="Something I am grateful for today..."
                    placeholderTextColor="#9E9E9E"
                    value={gratitude2}
                    onChangeText={setGratitude2}
                    returnKeyType="next"
                  />
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                    placeholder="Something I am grateful for today..."
                    placeholderTextColor="#9E9E9E"
                    value={gratitude3}
                    onChangeText={setGratitude3}
                    returnKeyType="done"
                  />
                </View>
                <Text className="text-xs text-muted mt-2 italic">
                  Optional — fill in as many or as few as you like.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}
