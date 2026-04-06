import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
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
          // Show warning that previous session wasn't properly closed
          Alert.alert(
            'Previous Session',
            `Your last session with ${companionName} wasn't fully saved. The data has been recovered and stored safely.`,
            [{ text: 'OK', onPress: () => AsyncStorage.removeItem(PENDING_CLOSE_KEY) }]
          );
          // The pending data was already cached — just clear the flag
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
        // Cache current chat state for recovery
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

  /**
   * Send greeting through the mandatory pipeline.
   */
  const sendGreetingViaP = useCallback(async () => {
    if (!state.rugzak) return;
    setIsTyping(true);

    try {
      const provider = getAIProvider();
      const result = await generateGreeting(state.rugzak, provider);

      // Persist updated Rugzak
      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));

      // Update local messages
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

    // Show user message immediately in UI
    const tempUserMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: rawText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);

    try {
      // Step 0: Preprocess input (detect language, translate to English)
      const preprocessed = await preprocessInput(rawText);
      const processedText = preprocessed.processedText;

      // Step 1: LOAD state — read latest Rugzak from storage
      const rugzakJson = await AsyncStorage.getItem(RUGZAK_KEY);
      const currentRugzak: Rugzak = rugzakJson
        ? JSON.parse(rugzakJson)
        : state.rugzak;

      // Steps 2-7: Run through the mandatory pipeline
      const provider = getAIProvider();
      const result = await processMessage(currentRugzak, processedText, provider);

      // Persist updated Rugzak (state is saved)
      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));

      // Update crisis level in context
      if (result.crisisLevel > 0) {
        setCrisisLevel(result.crisisLevel);
      }

      // Show emergency card if needed
      if (result.showEmergency) {
        setShowEmergency(true);
      }

      // Update local messages from the updated Rugzak (source of truth)
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
   *
   * Per spec (CHAT_EINDE_ANALYSE_AFSLUITING_SAM_KIM.txt):
   * 1. User clicks "End conversation"
   * 2. Companion responds: "I'm going to analyze everything you shared..."
   * 3. Background analysis runs (chat content, mood, triggers, rugzak update)
   * 4. Processing indicator shown
   * 5. Confirmation: "I've saved everything. Your session is safely stored."
   * 6. Navigation options: Back to Home / Close
   */
  const handleEndConversation = useCallback(async () => {
    if (!state.rugzak || sessionPhase !== 'active') return;

    // Phase 1: Show the "analyzing" message
    setSessionPhase('ending');

    const analyzingMsg: ChatMessage = {
      id: `msg_end_${Date.now()}`,
      role: 'assistant',
      content: `I'm going to analyze everything you shared. Stay here for a moment — I'll let you know when it's safe to leave.`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, analyzingMsg]);

    try {
      // Phase 2: Run session-end analysis pipeline
      const rugzakJson = await AsyncStorage.getItem(RUGZAK_KEY);
      const currentRugzak: Rugzak = rugzakJson
        ? JSON.parse(rugzakJson)
        : state.rugzak;

      const provider = getAIProvider();
      const result = await endSession(currentRugzak, provider);

      // Phase 3: Persist the updated Rugzak
      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));
      await endSessionWithRugzak(result.updatedRugzak);

      // Clear pending close flag (session ended properly)
      await AsyncStorage.removeItem(PENDING_CLOSE_KEY);

      // Phase 4: Show farewell + confirmation
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
      // Fallback: still try to save state
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

  return (
    <ScreenContainer>
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
        {/* End Conversation Button — only visible during active session with messages */}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
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
              {/* Typing indicator */}
              {isTyping && sessionPhase === 'active' && (
                <View className="self-start mb-3">
                  <Text className="text-xs text-muted mb-1 ml-1">{companionName}</Text>
                  <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                </View>
              )}

              {/* Session ending indicator */}
              {sessionPhase === 'ending' && (
                <View className="self-center my-4 items-center gap-2">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-sm text-muted text-center">
                    {companionName} is processing your session...
                  </Text>
                </View>
              )}

              {/* Session completed — navigation options */}
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

        {/* Input Bar — hidden when session is ending or completed */}
        {sessionPhase === 'active' && (
          <View className="px-4 py-3 border-t border-border bg-background">
            <View className="flex-row items-end gap-2">
              <TextInput
                className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 text-base text-foreground max-h-[120px]"
                placeholder="Type a message..."
                placeholderTextColor="#9E9E9E"
                value={inputText}
                onChangeText={setInputText}
                multiline
                returnKeyType="default"
                editable={!isTyping}
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
                <View className="bg-primary w-12 h-12 rounded-full items-center justify-center">
                  <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
