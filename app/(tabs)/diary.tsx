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
import { fixUnicode } from '@/lib/utils';
import * as Haptics from 'expo-haptics';
import { colors as dc, spacing, radius, typography, shadows, cardStyles } from '@/constants/design';

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

const MOOD_TAG_COLORS: Record<string, string> = {
  Calm: '#3B82F6',
  Sad: '#8B5CF6',
  Anxious: '#F59E0B',
  Angry: '#EF4444',
  Hopeful: '#10B981',
  Exhausted: '#F97316',
  Grateful: '#22C55E',
  Neutral: '#6B7280',
};

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

function TabSelector({ activeTab, onTabChange, colors }: { activeTab: DiaryTab; onTabChange: (tab: DiaryTab) => void; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
      <Pressable
        onPress={() => onTabChange('journal')}
        style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={{
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: 'center',
          backgroundColor: activeTab === 'journal' ? colors.primary : 'transparent',
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: activeTab === 'journal' ? '#fff' : colors.muted,
          }}>
            Journal
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onTabChange('gratitude')}
        style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={{
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: 'center',
          backgroundColor: activeTab === 'gratitude' ? colors.primary : 'transparent',
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: activeTab === 'gratitude' ? '#fff' : colors.muted,
          }}>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

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
      ...(hasGratitude ? { gratitude: { entry1: g1, entry2: g2, entry3: g3 } } : {}),
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

  const filteredEntries = entries.filter((entry) => {
    // Search filter
    if (isSearchActive && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const contentMatch = entry.content.toLowerCase().includes(q);
      const gratitudeMatch = entry.gratitude
        ? [entry.gratitude.entry1, entry.gratitude.entry2, entry.gratitude.entry3]
            .some(g => g.toLowerCase().includes(q))
        : false;
      const moodMatch = entry.moodTag.toLowerCase().includes(q);
      if (!contentMatch && !gratitudeMatch && !moodMatch) return false;
    }
    // Tab filter
    if (activeTab === 'gratitude') {
      return entry.gratitude && (entry.gratitude.entry1 || entry.gratitude.entry2 || entry.gratitude.entry3);
    }
    return entry.content.trim().length > 0;
  });

  const renderEntry = useCallback(({ item }: { item: DiaryEntry }) => {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasGratitude = item.gratitude && (item.gratitude.entry1 || item.gratitude.entry2 || item.gratitude.entry3);

    return (
      <View style={{ ...cardStyles.default, marginBottom: spacing.cardGap }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ ...typography.micro, color: dc.textTertiary }}>{dateStr} at {timeStr}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hasGratitude && (
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '500' }}>Gratitude</Text>
              </View>
            )}
            <View style={{ backgroundColor: (MOOD_TAG_COLORS[item.moodTag] || '#6B7280') + '15', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, color: MOOD_TAG_COLORS[item.moodTag] || '#6B7280', fontWeight: '500' }}>{item.moodTag}</Text>
            </View>
          </View>
        </View>
        {activeTab === 'journal' && item.content.trim() ? (
          <Text style={{ ...typography.bodyMedium, color: dc.textPrimary }} numberOfLines={4}>
            {fixUnicode(item.content)}
          </Text>
        ) : null}
        {activeTab === 'gratitude' && hasGratitude ? (
          <View style={{ marginTop: 4 }}>
            {item.gratitude!.entry1 ? <Text style={{ ...typography.bodyMedium, color: dc.textPrimary, marginBottom: 4 }}>1. {fixUnicode(item.gratitude!.entry1)}</Text> : null}
            {item.gratitude!.entry2 ? <Text style={{ ...typography.bodyMedium, color: dc.textPrimary, marginBottom: 4 }}>2. {fixUnicode(item.gratitude!.entry2)}</Text> : null}
            {item.gratitude!.entry3 ? <Text style={{ ...typography.bodyMedium, color: dc.textPrimary }}>3. {fixUnicode(item.gratitude!.entry3)}</Text> : null}
          </View>
        ) : null}
      </View>
    );
  }, [activeTab, colors]);

  return (
    <ScreenContainer containerClassName="bg-backgroundWarm">
      {/* Tab Selector */}
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} colors={colors} />

      {/* Daily Quote (Journal tab only) */}
      {activeTab === 'journal' && (
        <View style={{ flexDirection: 'row', marginBottom: 16, paddingLeft: 4 }}>
          <Text style={{ fontSize: 28, color: colors.primary, marginRight: 10, marginTop: -4 }}>{"\u201C"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.foreground, fontStyle: 'italic', lineHeight: 18 }}>
              {getDailyQuote().text}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>— {getDailyQuote().author}</Text>
          </View>
        </View>
      )}

      {/* Gratitude Streak (Gratitude tab only) */}
      {activeTab === 'gratitude' && gratitudeStreak > 0 && (
        <Pressable
          onPress={() => { setEditorTab('gratitude'); setShowEditor(true); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{ backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#16A34A' }}>
              {gratitudeStreak === 1 ? '1 day of gratitude' : gratitudeStreak === 2 ? '2 days in a row' : `${gratitudeStreak} days in a row`}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Journal Writing Prompt (Journal tab, inline) */}
      {activeTab === 'journal' && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20, marginBottom: 12 }}>
            {JOURNAL_EXPLANATION}
          </Text>
          <Pressable
            onPress={() => { setEditorTab('journal'); setShowEditor(true); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 14, color: '#9CA3AF' }}>Write whatever comes to mind...</Text>
            </View>
          </Pressable>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6, textAlign: 'right' }}>0 characters</Text>
        </View>
      )}

      {/* Mood Tags (Journal tab) */}
      {activeTab === 'journal' && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 10, letterSpacing: 0.5 }}>
            HOW ARE YOU FEELING?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOOD_TAGS.map((tag) => (
              <View key={tag} style={{ borderRadius: 20, borderWidth: 1, borderColor: MOOD_TAG_COLORS[tag] || colors.border, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, color: MOOD_TAG_COLORS[tag] || colors.foreground, fontWeight: '500' }}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
        <IconSymbol name="house.fill" size={16} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={(text) => { setSearchQuery(text); setIsSearchActive(text.length > 0); }}
          placeholder="Search entries..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.foreground }}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(''); setIsSearchActive(false); }} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
            <Text style={{ fontSize: 18, color: colors.muted, fontWeight: '600' }}>×</Text>
          </Pressable>
        )}
      </View>

      {/* Entry List */}
      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>{activeTab === 'journal' ? '\u{1F4DD}' : '\u{1F64F}'}</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>
              {activeTab === 'journal' ? 'No journal entries yet' : 'No gratitude entries yet'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              {activeTab === 'journal'
                ? 'Tap the writing area above to write your first entry.'
                : 'Tap the + button to record what you are grateful for.'}
            </Text>
          </View>
        }
      />

      {/* Floating Add Button (Gratitude tab) */}
      {activeTab === 'gratitude' && (
        <Pressable
          onPress={() => { setEditorTab('gratitude'); setShowEditor(true); }}
          style={({ pressed }) => [{
            position: 'absolute',
            bottom: 24,
            right: 20,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.9 : 1 }],
          }]}
        >
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 }}>
            <IconSymbol name="plus.circle.fill" size={28} color="#fff" />
          </View>
        </Pressable>
      )}

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet">
        <ScreenContainer edges={['top', 'bottom', 'left', 'right']} className="px-5 pt-4">
          <KeyboardAvoidingView
            behavior="padding"
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Pressable onPress={resetEditor}>
                <Text style={{ fontSize: 15, color: colors.muted }}>Cancel</Text>
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground }}>New Entry</Text>
              <Pressable
                onPress={saveEntry}
                disabled={(!editorText.trim() && !gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()) || isSaving}
                style={({ pressed }) => [{
                  opacity: (!editorText.trim() && !gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()) ? 0.4 : pressed ? 0.7 : 1,
                }]}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Editor Tab Selector */}
            <TabSelector activeTab={editorTab} onTabChange={setEditorTab} colors={colors} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {editorTab === 'journal' ? (
                <View>
                  {/* Stoic Quote */}
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, color: colors.foreground, fontStyle: 'italic', lineHeight: 18 }}>
                      {getDailyQuote().text}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>— {getDailyQuote().author}</Text>
                  </View>

                  <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 }}>
                    {JOURNAL_EXPLANATION}
                  </Text>

                  <TextInput
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      fontSize: 15,
                      color: colors.foreground,
                      minHeight: 180,
                      textAlignVertical: 'top',
                    }}
                    placeholder="Write whatever comes to mind..."
                    placeholderTextColor="#9CA3AF"
                    value={editorText}
                    onChangeText={setEditorText}
                    multiline
                  />
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6, textAlign: 'right' }}>
                    {editorText.length} characters
                  </Text>

                  {/* Mood Tags */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 10, letterSpacing: 0.5 }}>HOW ARE YOU FEELING?</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                          <View style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: editorMood === tag ? colors.primary : (MOOD_TAG_COLORS[tag] || colors.border),
                            backgroundColor: editorMood === tag ? colors.primary : 'transparent',
                          }}>
                            <Text style={{
                              fontSize: 13,
                              fontWeight: '500',
                              color: editorMood === tag ? '#fff' : (MOOD_TAG_COLORS[tag] || colors.foreground),
                            }}>
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
                  <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>
                      {GRATITUDE_EXPLANATION}
                    </Text>
                  </View>

                  <View style={{ gap: 12 }}>
                    {[{ val: gratitude1, set: setGratitude1, n: '1' }, { val: gratitude2, set: setGratitude2, n: '2' }, { val: gratitude3, set: setGratitude3, n: '3' }].map((item) => (
                      <View key={item.n}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: '500' }}>{item.n}.</Text>
                        <TextInput
                          style={{
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            fontSize: 15,
                            color: colors.foreground,
                          }}
                          placeholder="Something I am grateful for today..."
                          placeholderTextColor="#9CA3AF"
                          value={item.val}
                          onChangeText={item.set}
                          returnKeyType={item.n === '3' ? 'done' : 'next'}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 12, fontStyle: 'italic' }}>
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
