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

type DiaryTab = 'journal' | 'gratitude';

const MOOD_TAGS = ['Calm', 'Sad', 'Anxious', 'Angry', 'Hopeful', 'Exhausted', 'Grateful', 'Neutral'];

const STORAGE_KEY = '@recofree_diary';

const STOIC_QUOTES = [
  { text: '"You have power over your mind, not outside events. Realize this, and you will find strength."', author: 'Marcus Aurelius' },
  { text: '"We suffer more often in imagination than in reality."', author: 'Seneca' },
  { text: '"The happiness of your life depends upon the quality of your thoughts."', author: 'Marcus Aurelius' },
  { text: '"It is not what happens to you, but how you react to it that matters."', author: 'Epictetus' },
  { text: '"No man is free who is not master of himself."', author: 'Epictetus' },
  { text: '"Begin at once to live, and count each separate day as a separate life."', author: 'Seneca' },
  { text: '"The best revenge is not to be like your enemy."', author: 'Marcus Aurelius' },
  { text: '"Waste no more time arguing about what a good man should be. Be one."', author: 'Marcus Aurelius' },
  { text: '"He who fears death will never do anything worthy of a living man."', author: 'Seneca' },
  { text: '"First say to yourself what you would be; and then do what you have to do."', author: 'Epictetus' },
  { text: '"The soul becomes dyed with the colour of its thoughts."', author: 'Marcus Aurelius' },
  { text: '"Difficulties strengthen the mind, as labor does the body."', author: 'Seneca' },
  { text: '"Man is not worried by real problems so much as by his imagined anxieties about real problems."', author: 'Epictetus' },
  { text: '"Very little is needed to make a happy life; it is all within yourself, in your way of thinking."', author: 'Marcus Aurelius' },
  { text: '"If it is not right, do not do it. If it is not true, do not say it."', author: 'Marcus Aurelius' },
];

function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const dayIndex = Math.floor(now.getTime() / (1000 * 60 * 60 * 24)) % STOIC_QUOTES.length;
  return STOIC_QUOTES[dayIndex];
}

const JOURNAL_EXPLANATION =
  'Writing like the Stoics — what could you control today, what not? What happened, and how did you respond?';

const GRATITUDE_EXPLANATION =
  'Your brain automatically looks for danger and problems. Writing three things that were good trains your mind to notice what is good too. Not because everything is fine — but because both exist.';

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

function TabSelector({ activeTab, onTabChange }: { activeTab: DiaryTab; onTabChange: (tab: DiaryTab) => void }) {
  return (
    <View className="flex-row bg-surface rounded-xl p-1 mb-4 border border-border">
      <Pressable
        onPress={() => onTabChange('journal')}
        style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
      >
        <View
          className={`py-2.5 rounded-lg items-center ${
            activeTab === 'journal' ? 'bg-primary' : ''
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              activeTab === 'journal' ? 'text-background' : 'text-muted'
            }`}
          >
            Journal
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onTabChange('gratitude')}
        style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
      >
        <View
          className={`py-2.5 rounded-lg items-center ${
            activeTab === 'gratitude' ? 'bg-primary' : ''
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              activeTab === 'gratitude' ? 'text-background' : 'text-muted'
            }`}
          >
            Gratitude
          </Text>
        </View>
      </Pressable>
    </View>
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
  const [activeTab, setActiveTab] = useState<DiaryTab>('journal');
  const [editorTab, setEditorTab] = useState<DiaryTab>('journal');

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
    setEditorTab('journal');
  }, []);

  const saveEntry = useCallback(async () => {
    const text = editorText.trim();
    const g1 = gratitude1.trim();
    const g2 = gratitude2.trim();
    const g3 = gratitude3.trim();
    const hasGratitude = g1 || g2 || g3;
    const hasJournal = text.length > 0;

    if (!hasJournal && !hasGratitude) return;
    if (isSaving) return;
    setIsSaving(true);

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

  // Filter entries based on active tab
  const filteredEntries = entries.filter((entry) => {
    if (activeTab === 'gratitude') {
      return entry.gratitude && (entry.gratitude.entry1 || entry.gratitude.entry2 || entry.gratitude.entry3);
    }
    return entry.content.trim().length > 0;
  });

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
        {activeTab === 'journal' && item.content.trim() ? (
          <Text className="text-base text-foreground leading-relaxed" numberOfLines={4}>
            {item.content}
          </Text>
        ) : null}
        {activeTab === 'gratitude' && hasGratitude ? (
          <View className="mt-1">
            {item.gratitude!.entry1 ? (
              <Text className="text-sm text-foreground mb-1">1. {item.gratitude!.entry1}</Text>
            ) : null}
            {item.gratitude!.entry2 ? (
              <Text className="text-sm text-foreground mb-1">2. {item.gratitude!.entry2}</Text>
            ) : null}
            {item.gratitude!.entry3 ? (
              <Text className="text-sm text-foreground">3. {item.gratitude!.entry3}</Text>
            ) : null}
          </View>
        ) : null}
        {activeTab === 'journal' && hasGratitude ? (
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
        ) : null}
      </View>
    );
  }, [activeTab]);

  return (
    <ScreenContainer className="px-5 pt-2">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-2xl font-bold text-foreground">Diary</Text>
          <Text className="text-sm text-muted">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setEditorTab(activeTab);
            setShowEditor(true);
          }}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] },
          ]}
        >
          <View className="bg-primary w-12 h-12 rounded-full items-center justify-center">
            <IconSymbol name="plus.circle.fill" size={28} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>

      {/* Tab Selector */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Gratitude Streak Badge (only on gratitude tab) */}
      {activeTab === 'gratitude' && (
        <GratitudeStreakBadge streak={gratitudeStreak} onPress={() => { setEditorTab('gratitude'); setShowEditor(true); }} />
      )}

      {/* Entry List */}
      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-4">{activeTab === 'journal' ? '📝' : '🙏'}</Text>
            <Text className="text-lg font-semibold text-foreground mb-1">
              {activeTab === 'journal' ? 'No journal entries yet' : 'No gratitude entries yet'}
            </Text>
            <Text className="text-sm text-muted text-center">
              {activeTab === 'journal'
                ? 'Tap the + button to write your first journal entry.'
                : 'Tap the + button to record what you are grateful for.'}
            </Text>
          </View>
        }
      />

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet">
        <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5 pt-4">
          <KeyboardAvoidingView
            behavior="padding"
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Pressable onPress={resetEditor}>
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
              <Text className="text-lg font-bold text-foreground">New Entry</Text>
              <Pressable
                onPress={saveEntry}
                disabled={(!editorText.trim() && !gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()) || isSaving}
                style={({ pressed }) => [
                  { opacity: (!editorText.trim() && !gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()) ? 0.4 : pressed ? 0.7 : 1 },
                ]}
              >
                <Text className="text-base font-bold text-primary">
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Editor Tab Selector */}
            <TabSelector activeTab={editorTab} onTabChange={setEditorTab} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {editorTab === 'journal' ? (
                <View>
                  {/* Stoic Quote (rotates daily) */}
                  <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
                    <Text className="text-sm text-foreground italic leading-relaxed">
                      {getDailyQuote().text}
                    </Text>
                    <Text className="text-xs text-muted mt-2">— {getDailyQuote().author}</Text>
                  </View>

                  {/* Journal Explanation */}
                  <Text className="text-sm text-muted leading-relaxed mb-4">
                    {JOURNAL_EXPLANATION}
                  </Text>

                  {/* Journal Text Input */}
                  <TextInput
                    className="bg-surface border border-border rounded-2xl px-4 py-4 text-base text-foreground"
                    placeholder="Write whatever comes to mind..."
                    placeholderTextColor="#9E9E9E"
                    value={editorText}
                    onChangeText={setEditorText}
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 180 }}
                  />
                  <Text className="text-xs text-muted mt-1 text-right">
                    {editorText.length} characters
                  </Text>

                  {/* Mood Tag Selector */}
                  <View className="mt-4">
                    <Text className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">How are you feeling?</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {MOOD_TAGS.map((tag) => (
                        <Pressable
                          key={tag}
                          onPress={() => {
                            setEditorMood(editorMood === tag ? '' : tag);
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                        >
                          <View
                            className={`px-3 py-1.5 rounded-full border ${
                              editorMood === tag
                                ? 'bg-primary border-primary'
                                : 'bg-surface border-border'
                            }`}
                          >
                            <Text
                              className={`text-sm ${
                                editorMood === tag ? 'text-background font-semibold' : 'text-foreground'
                              }`}
                            >
                              {tag}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View>
                  {/* Gratitude Explanation */}
                  <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
                    <Text className="text-sm text-foreground leading-relaxed">
                      {GRATITUDE_EXPLANATION}
                    </Text>
                  </View>

                  {/* Gratitude Fields */}
                  <View className="gap-3">
                    <View>
                      <Text className="text-xs text-muted mb-1.5 font-medium">1.</Text>
                      <TextInput
                        className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                        placeholder="Something I am grateful for today..."
                        placeholderTextColor="#9E9E9E"
                        value={gratitude1}
                        onChangeText={setGratitude1}
                        returnKeyType="next"
                      />
                    </View>
                    <View>
                      <Text className="text-xs text-muted mb-1.5 font-medium">2.</Text>
                      <TextInput
                        className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                        placeholder="Something I am grateful for today..."
                        placeholderTextColor="#9E9E9E"
                        value={gratitude2}
                        onChangeText={setGratitude2}
                        returnKeyType="next"
                      />
                    </View>
                    <View>
                      <Text className="text-xs text-muted mb-1.5 font-medium">3.</Text>
                      <TextInput
                        className="bg-surface border border-border rounded-xl px-4 py-3 text-base text-foreground"
                        placeholder="Something I am grateful for today..."
                        placeholderTextColor="#9E9E9E"
                        value={gratitude3}
                        onChangeText={setGratitude3}
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  <Text className="text-xs text-muted mt-3 italic">
                    Optional — fill in as many or as few as you like.
                  </Text>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}
