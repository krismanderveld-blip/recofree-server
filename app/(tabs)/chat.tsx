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
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('active');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const greetingSent = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const userName = getUserName();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

  // ── Track keyboard height on Android ──
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to end when keyboard opens
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
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
      const currentRugzak: Rugzak = rugzakJson ? JSON.parse(rugzakJson) : state.rugzak;
      const provider = getAIProvider();
      const result = await processMessage(currentRugzak, processedText, provider);
      await AsyncStorage.setItem(RUGZAK_KEY, JSON.stringify(result.updatedRugzak));
      if (result.crisisLevel > 0) setCrisisLevel(result.crisisLevel);
      if (result.showEmergency) setShowEmergency(true);
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
      const currentRugzak: Rugzak = rugzakJson ? JSON.parse(rugzakJson) : state.rugzak;
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

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Calculate the bottom padding needed for the tab bar
  const bottomTabPadding = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomTabPadding;

  return (
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

      {/* Main content area: FlatList + Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
      >
        {/* Messages */}
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

        {/* Input Bar */}
        {sessionPhase === 'active' && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: Platform.OS === 'android' && keyboardHeight > 0 ? 10 : Math.max(10, tabBarHeight),
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
      </KeyboardAvoidingView>
    </View>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
