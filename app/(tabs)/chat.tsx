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
import { ScreenContainer } from '@/components/screen-container';
import { useUser } from '@/lib/user-context';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { assessCrisis } from '@/lib/crisis/detector';
import { getModuleRecommendations } from '@/lib/modules/module-system';
import { EmergencyCard } from '@/components/emergency-card';
import type { ChatMessage, ChatContext } from '@/lib/ai/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

export default function ChatScreen() {
  const { state, addChatMessage, startSession, setCrisisLevel } = useUser();
  const colors = useColors();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Start session on mount if not started
  useEffect(() => {
    if (!state.sessionStartTime) {
      startSession();
    }
  }, []);

  // Auto-send initial greeting on first session
  useEffect(() => {
    if (state.chatHistory.length === 0 && state.intakeCompleted && !isTyping) {
      sendGreeting();
    }
  }, [state.sessionStartTime]);

  const sendGreeting = useCallback(async () => {
    if (!state.userType) return;
    setIsTyping(true);

    const provider = getAIProvider();
    const context: ChatContext = {
      userType: state.userType,
      userName: state.userName,
      currentMessage: '',
      conversationHistory: [],
      moodSliders: state.moodSliders,
      rugzak: state.rugzak || { naam: state.userName, userType: state.userType, entries: {} },
      activeModules: [],
      crisisLevel: state.crisisLevel,
      detectedEmotion: state.detectedEmotion,
      therapeuticStance: 'open',
      sessionDurationMinutes: 0,
      urgency: state.urgency,
      startEmotion: state.startEmotion,
    };

    try {
      const result = await provider.generateResponse(context);
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(aiMessage);
    } catch (error) {
      console.error('Greeting error:', error);
    } finally {
      setIsTyping(false);
    }
  }, [state]);

  const handleSend = useCallback(async () => {
    const rawText = inputText.trim();
    if (!rawText || isTyping || !state.userType) return;

    setInputText('');

    // Step 1: Preprocess input (detect language, translate to English)
    const preprocessed = await preprocessInput(rawText);
    const processedText = preprocessed.processedText;

    // Step 2: Add user message (show original text in UI)
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: rawText,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMessage);

    // Step 3: Crisis detection (on processed English text)
    const crisisAssessment = assessCrisis(processedText, state.moodSliders);
    if (crisisAssessment.level > state.crisisLevel) {
      setCrisisLevel(crisisAssessment.level);
    }

    // Show emergency card for level 2 crisis
    if (crisisAssessment.level >= 2) {
      setShowEmergency(true);
    }

    // Step 4: Module recommendations (on processed English text)
    const moduleRecs = getModuleRecommendations(
      state.userType,
      processedText,
      state.moodSliders
    );
    const activeModuleIds = moduleRecs.slice(0, 3).map((r) => r.module.id);

    // Step 5: Generate AI response
    setIsTyping(true);

    const sessionStart = state.sessionStartTime ? new Date(state.sessionStartTime) : new Date();
    const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

    const provider = getAIProvider();
    const context: ChatContext = {
      userType: state.userType,
      userName: state.userName,
      currentMessage: processedText, // English text for AI processing
      conversationHistory: [...state.chatHistory, userMessage],
      moodSliders: state.moodSliders,
      rugzak: state.rugzak || { naam: state.userName, userType: state.userType, entries: {} },
      activeModules: activeModuleIds,
      crisisLevel: crisisAssessment.level,
      detectedEmotion: state.detectedEmotion,
      therapeuticStance: crisisAssessment.level >= 2 ? 'crisis' : 'open',
      sessionDurationMinutes: sessionMinutes,
      urgency: state.urgency,
      startEmotion: state.startEmotion,
    };

    try {
      const result = await provider.generateResponse(context);
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(aiMessage);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: 'Something went wrong. I\'m still here — please try again.',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(errorMessage);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, state]);

  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

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
          data={state.chatHistory}
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
