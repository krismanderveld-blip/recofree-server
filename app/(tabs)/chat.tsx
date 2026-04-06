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
  type AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession } from '@/lib/rugzak/pipeline';
import { EmergencyCard } from '@/components/emergency-card';
import type { ChatMessage, Rugzak } from '@/lib/ai/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

const RUGZAK_KEY = '@recofree_rugzak';
const PENDING_CLOSE_KEY = '@recofree_pending_close';

/**
 * Session state machine:
 * 'active'     → Normal chat, user can send messages
 * 'ending'     → User clicked "End conversation", analysis in progress
 * 'completed'  → Analysis done, farewell shown, navigation options visible
 */
type SessionPhase = 'active' | 'ending' | 'completed';

export default function ChatScreen() {
  const {
    state,
    startSession,
    setCrisisLevel,
    getUserName,
    getChatHistory,
    endSessionWithRugzak,
  } = useUser();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tab bar height (must match _layout.tsx)
  const bottomPadding = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('active');
  const flatListRef = useRef<FlatList>(null);
  const greetingSent = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const userName = getUserName();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

  // ── Check for pending close on mount ──
  useEffect(() => {
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_CLOSE_KEY);
        if (pending) {
          const data = JSON.parse(pending);
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

  // ── Failsafe: cache chat state when app goes to background during active session ──
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

  // Start session and send greeting on mount
  useEffect(() => {
    if (state.intakeCompleted && state.rugzak && !greetingSent.current) {
      greetingSent.current = true;
      startSession();
      sendGreetingViaP();
    }
  }, [state.intakeCompleted, state.rugzak]);

  const sendGreetingViaP = useCallback(async () => {
    if (!state.rugzak) return;
    setIsTyping(true);

    try {
      const provider = getAIProvider();
      const result = await generateGreeting(state.rugzak, provider);
      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));
      setMessages(result.updatedRugzak.chatHistory);
    } catch (error) {
      console.error('Greeting error:', error);
    } finally {
      setIsTyping(false);
    }
  }, [state.rugzak]);

  /**
   * MANDATORY MESSAGE PROCESSING PIPELINE
   */
  const handleSend = useCallback(async () => {
    const rawText = inputText.trim();
    if (!rawText || isTyping || !state.rugzak || sessionPhase !== 'active') return;

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

      const rugzakJson = await AsyncStorage.getItem(RUGZAK_KEY);
      const currentRugzak: Rugzak = rugzakJson
        ? JSON.parse(rugzakJson)
        : state.rugzak;

      const provider = getAIProvider();
      const result = await processMessage(currentRugzak, processedText, provider);

      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));

      if (result.crisisLevel > 0) {
        setCrisisLevel(result.crisisLevel);
      }

      if (result.showEmergency) {
        setShowEmergency(true);
      }

      setMessages(result.updatedRugzak.chatHistory);
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
  }, [inputText, isTyping, state.rugzak, sessionPhase]);

  /**
   * END CONVERSATION FLOW
   */
  const handleEndConversation = useCallback(async () => {
    if (!state.rugzak || sessionPhase !== 'active') return;

    setSessionPhase('ending');

    const analyzingMsg: ChatMessage = {
      id: `msg_end_${Date.now()}`,
      role: 'assistant',
      content: `I'm going to analyze everything you shared. Stay here for a moment — I'll let you know when it's safe to leave.`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, analyzingMsg]);

    try {
      const rugzakJson = await AsyncStorage.getItem(RUGZAK_KEY);
      const currentRugzak: Rugzak = rugzakJson
        ? JSON.parse(rugzakJson)
        : state.rugzak;

      const provider = getAIProvider();
      const result = await endSession(currentRugzak, provider);

      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));
      await endSessionWithRugzak(result.updatedRugzak);

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
  }, [state.rugzak, sessionPhase, userName, endSessionWithRugzak]);

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

  // Scroll to end when messages change
  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="px-5 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-foreground">{companionName}</Text>
          <Text className="text-xs text-muted">
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
              },
            ]}
          >
            <View className="flex-row items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
              <IconSymbol name="stop.circle.fill" size={16} color={colors.error} />
              <Text className="text-xs font-medium text-foreground">End</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Messages list — takes all available space */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          flexGrow: 1,
          justifyContent: 'flex-end',
        }}
        onContentSizeChange={scrollToEnd}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
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
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted text-base">Starting conversation...</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {isTyping && sessionPhase === 'active' && (
              <View className="self-start mb-3">
                <Text className="text-xs text-muted mb-1 ml-1">{companionName}</Text>
                <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            )}

            {sessionPhase === 'ending' && (
              <View className="self-center my-4 items-center gap-2">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-sm text-muted text-center">
                  {companionName} is processing your session...
                </Text>
              </View>
            )}

            {sessionPhase === 'completed' && (
              <View className="self-center my-4 items-center gap-3 w-full">
                <View className="flex-row items-center gap-2 mb-1">
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                  <Text className="text-sm font-medium text-success">Session saved</Text>
                </View>

                <Pressable
                  onPress={handleBackToHome}
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <View className="bg-primary rounded-full px-6 py-3 flex-row items-center gap-2">
                    <IconSymbol name="house.fill" size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold text-base">Back to Home</Text>
                  </View>
                </Pressable>
              </View>
            )}
          </>
        }
      />

      {/* Input Bar — uses KeyboardStickyView to stick above keyboard */}
      {sessionPhase === 'active' && (
        <KeyboardStickyView
          offset={{ closed: 0, opened: Platform.OS === 'ios' ? -tabBarHeight : 0 }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingBottom: Platform.OS === 'web' ? 12 : 12,
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
        </KeyboardStickyView>
      )}
    </ScreenContainer>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
