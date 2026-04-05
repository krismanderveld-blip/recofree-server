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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting } from '@/lib/rugzak/pipeline';
import { EmergencyCard } from '@/components/emergency-card';
import type { ChatMessage, Rugzak } from '@/lib/ai/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

const RUGZAK_KEY = '@recofree_rugzak';

export default function ChatScreen() {
  const {
    state,
    startSession,
    setCrisisLevel,
    getUserName,
    getChatHistory,
  } = useUser();
  const colors = useColors();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const greetingSent = useRef(false);

  const userName = getUserName();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

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
   *
   * Every message goes through:
   * 1. LOAD state (Rugzak from AsyncStorage)
   * 2. ANALYZE state (rule-based, NOT AI)
   * 3. SELECT modules (rule-based, NOT AI)
   * 4. ADJUST behavior (tone, pacing, intensity)
   * 5. CRISIS layer (monitoring, threshold)
   * 6. AI GENERATION (language only)
   * 7. STATE UPDATE (mood, triggers, history)
   *
   * AI DOES NOT DECIDE MODULES OR STATE.
   */
  const handleSend = useCallback(async () => {
    const rawText = inputText.trim();
    if (!rawText || isTyping || !state.rugzak) return;

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
      // Pipeline handles: Analyze → Select Modules → Adjust Behavior → Crisis → AI Gen → State Update
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
  }, [inputText, isTyping, state.rugzak]);

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
      <View className="px-5 py-3 border-b border-border">
        <Text className="text-lg font-bold text-foreground">{companionName}</Text>
        <Text className="text-xs text-muted">
          {isTyping ? 'Typing...' : 'Online'}
        </Text>
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
            isTyping ? (
              <View className="self-start mb-3">
                <Text className="text-xs text-muted mb-1 ml-1">{companionName}</Text>
                <View className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar */}
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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
