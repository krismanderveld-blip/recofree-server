import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/lib/user-context';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession } from '@/lib/rugzak/pipeline';
import { EmergencyCard } from '@/components/emergency-card';
import type { ChatMessage, Rugzak, Backpack, UserDat, DiaryEntry } from '@/lib/ai/types';
import { composeRugzak } from '@/lib/ai/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

const BACKPACK_KEY = '@recofree_backpack';
const USERDAT_KEY = '@recofree_userdat';
const PENDING_CLOSE_KEY = '@recofree_pending_close';
const DIARY_KEY = '@recofree_diary';

type SessionPhase = 'active' | 'ending' | 'completed';

export default function ChatScreen() {
  const {
    state,
    startSession,
    setCrisisLevel,
    getUserName,
    getChatHistory,
    getBackpack,
    getUserDat,
    endSessionWithRugzak,
    endSessionWithUserDat,
  } = useUser();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('active');
  const flatListRef = useRef<FlatList>(null);
  const greetingSent = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const userName = getUserName();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

  // ── Track keyboard visibility + scroll to end ──
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // ── Check for pending close on mount ──
  useEffect(() => {
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_CLOSE_KEY);
        if (pending) {
          Alert.alert(
            'Previous Session',
            `Your last session with ${companionName} wasn't fully saved. The data has been recovered and stored safely.`,
            [{ text: 'OK', onPress: () => AsyncStorage.removeItem(PENDING_CLOSE_KEY) }]
          );
        }
      } catch (e) {
        console.error('Error checking pending close:', e);
      }
    })();
  }, []);

  // ── Failsafe: cache chat state when app goes to background ──
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive') &&
        sessionPhase === 'active' &&
        messages.length > 0
      ) {
        try {
          await AsyncStorage.setItem(
            PENDING_CLOSE_KEY,
            JSON.stringify({
              timestamp: new Date().toISOString(),
              messageCount: messages.length,
              lastMessage: messages[messages.length - 1]?.content?.slice(0, 100),
            })
          );
        } catch (e) {
          console.error('Failsafe cache error:', e);
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [sessionPhase, messages]);

  // Load messages from Rugzak on mount
  useEffect(() => {
    const history = getChatHistory();
    setMessages(history);
  }, []);

  // Start session and send greeting ONLY when Chat tab gains focus.
  // This prevents the greeting from firing during intake/backpack fill
  // (Expo Router mounts all tabs simultaneously).
  useFocusEffect(
    useCallback(() => {
      if (state.intakeCompleted && state.backpack && state.userDat && !greetingSent.current) {
        // Don't fire greeting if backpack sections are all empty
        // (happens right after intake, before user fills life story sections)
        const hasContent = state.backpack.sections?.some(
          (s: any) => s.content && s.content.trim().length > 0
        );
        if (!hasContent) return;
        greetingSent.current = true;
        startSession();
        sendGreetingViaP();
      }
    }, [state.intakeCompleted, state.backpack, state.userDat])
  );

  const sendGreetingViaP = useCallback(async () => {
    // Read DIRECTLY from AsyncStorage to avoid stale closure issues.
    // React state may not yet reflect the latest persisted backpack.
    let backpack: Backpack | null = null;
    let userDat: UserDat | null = null;
    try {
      const bpJson = await AsyncStorage.getItem(BACKPACK_KEY);
      const udJson = await AsyncStorage.getItem(USERDAT_KEY);
      if (bpJson) backpack = JSON.parse(bpJson);
      if (udJson) userDat = JSON.parse(udJson);
    } catch (e) {
      console.error('Failed to read stores from AsyncStorage:', e);
    }
    // Fallback to React state if AsyncStorage read fails
    if (!backpack) backpack = getBackpack();
    if (!userDat) userDat = getUserDat();
    if (!backpack || !userDat) return;
    console.log('[Chat] sendGreeting — backpack sections:', backpack.sections?.length, 'filled:', backpack.sections?.filter((s: any) => s.content?.trim().length > 0).length);
    setIsTyping(true);
    try {
      // Load diary entries for session-start context
      let diaryEntries: DiaryEntry[] = [];
      try {
        const diaryJson = await AsyncStorage.getItem(DIARY_KEY);
        if (diaryJson) {
          const allEntries: DiaryEntry[] = JSON.parse(diaryJson);
          // Send last 10 diary entries (most recent first)
          diaryEntries = allEntries.slice(0, 10);
        }
      } catch (e) {
        console.warn('Could not load diary for AI context:', e);
      }

      const provider = getAIProvider();
      // SESSION START: send full backpack + userDat + diary entries
      const result = await generateGreeting(backpack, provider, userDat, diaryEntries);
      // Only persist userDat (backpack is NEVER modified by the system)
      await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      setMessages(result.updatedUserDat.chatHistory);
    } catch (error) {
      console.error('Greeting error:', error);
    } finally {
      setIsTyping(false);
    }
  }, [getBackpack, getUserDat]);

  const handleSend = useCallback(async () => {
    const rawText = inputText.trim();
    if (!rawText || isTyping || !state.backpack || !state.userDat || sessionPhase !== 'active') return;

    setInputText('');
    Keyboard.dismiss();

    const tempUserMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: rawText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);

    try {
      const preprocessed = await preprocessInput(rawText);
      const processedText = preprocessed.processedText;
      // Load latest userDat from storage (may have been updated by greeting)
      const userDatJson = await AsyncStorage.getItem(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      // Read backpack from AsyncStorage to ensure latest version (avoids stale closure)
      let backpack: Backpack = state.backpack!;
      try {
        const bpJson = await AsyncStorage.getItem(BACKPACK_KEY);
        if (bpJson) backpack = JSON.parse(bpJson);
      } catch (e) {
        console.warn('Could not read backpack from AsyncStorage, using state:', e);
      }
      const provider = getAIProvider();
      // FOLLOW-UP MESSAGE: isSessionStart = false, no diary entries
      const result = await processMessage(backpack, processedText, provider, currentUserDat, { isSessionStart: false, diaryEntries: [] });
      // Only persist userDat (backpack is NEVER modified)
      await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      if (result.crisisLevel > 0) setCrisisLevel(result.crisisLevel);
      if (result.showEmergency) setShowEmergency(true);
      setMessages(result.updatedUserDat.chatHistory);
    } catch (error) {
      console.error('Pipeline error:', error);
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm still here with you. Something went wrong — please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, state.backpack, state.userDat, sessionPhase]);

  const handleEndConversation = useCallback(async () => {
    if (!state.backpack || !state.userDat || sessionPhase !== 'active') return;
    setSessionPhase('ending');
    const analyzingMsg: ChatMessage = {
      id: `msg_end_${Date.now()}`,
      role: 'assistant',
      content: `I'm going to analyze everything you shared. Stay here for a moment — I'll let you know when it's safe to leave.`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, analyzingMsg]);
    try {
      const userDatJson = await AsyncStorage.getItem(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      const backpack = state.backpack!;
      const provider = getAIProvider();
      const result = await endSession(backpack, provider, currentUserDat);
      // Only persist userDat (backpack is NEVER modified)
      await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      await endSessionWithUserDat(result.updatedUserDat);
      await AsyncStorage.removeItem(PENDING_CLOSE_KEY);
      const confirmationMsg: ChatMessage = {
        id: `msg_confirm_${Date.now()}`,
        role: 'assistant',
        content: result.farewell + '\n\nI\'ve saved everything. Your session is safely stored. You can close the app now, or go back to the home screen.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmationMsg]);
      setSessionPhase('completed');
    } catch (error) {
      console.error('End session error:', error);
      const fallbackMsg: ChatMessage = {
        id: `msg_fallback_${Date.now()}`,
        role: 'assistant',
        content: `${userName}, I've saved your session. Something went wrong during analysis, but your conversation is safely stored. You can close the app now.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setSessionPhase('completed');
    }
  }, [state.backpack, state.userDat, sessionPhase, userName, endSessionWithUserDat]);

  const handleBackToHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`mb-3 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
        {!isUser && (
          <Text className="text-xs text-muted mb-1 ml-1">{companionName}</Text>
        )}
        <View
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary rounded-br-sm'
              : 'bg-surface border border-border rounded-bl-sm'
          }`}
        >
          <Text
            className={`text-base leading-relaxed ${
              isUser ? 'text-white' : 'text-foreground'
            }`}
          >
            {item.content}
          </Text>
        </View>
        <Text className={`text-xs text-muted mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  }, [companionName]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Tab bar height calculation
  const bottomTabPadding = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomTabPadding;

  /**
   * KEYBOARD STRATEGY:
   *
   * Android with softwareKeyboardLayoutMode: "resize":
   *   The system automatically resizes the window when the keyboard opens.
   *   We do NOT need KeyboardAvoidingView at all — the flex layout naturally
   *   pushes the input bar up because the window shrinks.
   *   We just need to make sure the input bar is at the bottom of a flex:1 container.
   *
   * iOS:
   *   The window does NOT resize. We need KeyboardAvoidingView with behavior="padding"
   *   to push content up. The keyboardVerticalOffset accounts for the tab bar.
   *
   * Web:
   *   No special handling needed.
   */
  const isIOS = Platform.OS === 'ios';

  const chatContent = (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Safe area for top only */}
      <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.foreground }}>
              {companionName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {sessionPhase === 'ending'
                ? `${companionName} is processing your session...`
                : sessionPhase === 'completed'
                ? 'Session completed'
                : isTyping
                ? 'Typing...'
                : 'Online'}
            </Text>
          </View>
          {sessionPhase === 'active' && messages.length > 1 && !isTyping && (
            <Pressable
              onPress={handleEndConversation}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                },
              ]}
            >
              <IconSymbol name="stop.circle.fill" size={16} color={colors.error} />
              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.foreground }}>End</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Messages + Input: flex:1 container */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 8,
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}
          onContentSizeChange={scrollToEnd}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={isIOS}
          ListHeaderComponent={
            showEmergency ? (
              <EmergencyCard
                visible={showEmergency}
                onDismiss={() => setShowEmergency(false)}
              />
            ) : null
          }
          ListEmptyComponent={
            !isTyping ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>Starting conversation...</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {isTyping && sessionPhase === 'active' && (
                <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4, marginLeft: 4 }}>
                    {companionName}
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      borderBottomLeftRadius: 4,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                </View>
              )}
              {sessionPhase === 'ending' && (
                <View style={{ alignSelf: 'center', marginVertical: 16, alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>
                    {companionName} is processing your session...
                  </Text>
                </View>
              )}
              {sessionPhase === 'completed' && (
                <View style={{ alignSelf: 'center', marginVertical: 16, alignItems: 'center', gap: 12, width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.success }}>Session saved</Text>
                  </View>
                  <Pressable
                    onPress={handleBackToHome}
                    style={({ pressed }) => [
                      {
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                        backgroundColor: colors.primary,
                        borderRadius: 24,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      },
                    ]}
                  >
                    <IconSymbol name="house.fill" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Back to Home</Text>
                  </Pressable>
                </View>
              )}
            </>
          }
        />

        {/* Input Bar — sits at the bottom of the flex container */}
        {sessionPhase === 'active' && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 10,
              // On Android with softwareKeyboardLayoutMode:resize, the system shrinks the window.
              // When keyboard is open, the tab bar is hidden, so we only need small padding.
              // When closed, we need tabBarHeight to clear the tab bar.
              paddingBottom: Platform.OS === 'android' && keyboardVisible ? 8 : tabBarHeight,
              backgroundColor: colors.background,
              borderTopWidth: 0.5,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: colors.foreground,
                  maxHeight: 120,
                }}
                placeholder="Type a message..."
                placeholderTextColor={colors.muted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                returnKeyType="default"
                editable={!isTyping}
                onFocus={scrollToEnd}
              />
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || isTyping}
                style={({ pressed }) => [
                  {
                    opacity: !inputText.trim() || isTyping ? 0.4 : pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: colors.primary,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  // Both iOS and Android need KeyboardAvoidingView.
  // Android: softwareKeyboardLayoutMode is set to "pan" (not "resize") to avoid
  // conflicts with KAV. KAV with behavior="padding" handles the offset.
  // iOS: behavior="padding" (standard).
  // Web: no special handling needed.
  if (Platform.OS === 'web') {
    return chatContent;
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={isIOS ? 0 : -tabBarHeight}
    >
      {chatContent}
    </KeyboardAvoidingView>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
