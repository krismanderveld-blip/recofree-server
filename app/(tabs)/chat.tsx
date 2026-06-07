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
  Modal,
  TouchableOpacity,
  ScrollView as RNScrollView,
  type AppStateStatus,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession } from '@/lib/rugzak/pipeline';
import { EmergencyCard } from '@/components/emergency-card';
import type { ChatMessage, Rugzak, Backpack, UserDat, DiaryEntry } from '@/lib/ai/types';
import { composeRugzak } from '@/lib/ai/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { PreChatVsp } from '@/components/prechat-vsp';
import { PreChatEigenRegie } from '@/components/prechat-eigen-regie';
import type { VspLevel } from '@/lib/engine/elias/vsp';
import { loadAndRestoreEliasProjection } from '@/lib/engine/elias/projection';
import { loadAndRestoreKimProjection } from '@/lib/engine/kim/projection';
import { logDebugEvent } from '@/lib/debug/session-logger';
import { ChatErrorBoundary } from '@/components/chat-error-boundary';

const BACKPACK_KEY = '@recofree_backpack';
const USERDAT_KEY = '@recofree_userdat';
const PENDING_CLOSE_KEY = '@recofree_pending_close';
const DIARY_KEY = '@recofree_diary';

type SessionPhase = 'active' | 'ending' | 'completed';

export default function ChatScreenWithBoundary() {
  return (
    <ChatErrorBoundary>
      <ChatScreenInner />
    </ChatErrorBoundary>
  );
}

function ChatScreenInner() {
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
    updateVsp,
    getVsp,
    updateEigenRegie,
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

  // ── First-chat disclaimer modal (one-time, not skipable) ──
  const [firstChatSeen, setFirstChatSeen] = useState<boolean>(true); // default true to avoid flash
  useEffect(() => {
    (async () => {
      const ud = await getUserDat();
      if (!ud?.firstChatSeen) setFirstChatSeen(false);
    })();
  }, []);
  const dismissFirstChatDisclaimer = useCallback(async () => {
    setFirstChatSeen(true);
    const ud = await getUserDat();
    const updated = { ...ud, firstChatSeen: true } as UserDat;
    await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(updated));
  }, [getUserDat]);

  // ── Pre-chat gate: VSP/Eigen Regie ALWAYS shown at every chat start ──
  // The thermometer is both engine-input and a self-reflection mirror for the user.
  // It must appear at the start of every new session, regardless of prior submissions.
  const [preChatDone, setPreChatDone] = useState<boolean>(false);

  const handleVspSubmit = useCallback(async (level: VspLevel) => {
    await updateVsp(level);
    setPreChatDone(true);
  }, [updateVsp]);

  const handleEigenRegieSubmit = useCallback(async (value: number) => {
    await updateEigenRegie(value);
    setPreChatDone(true);
  }, [updateEigenRegie]);

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

  // Load previous session messages on mount (collapsed, for continuity)
  // Only the PREVIOUS session is shown — older sessions are archived.
  const [previousSessionMessages, setPreviousSessionMessages] = useState<ChatMessage[]>([]);
  const [showPreviousSession, setShowPreviousSession] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const udJson = await AsyncStorage.getItem(USERDAT_KEY);
        if (udJson) {
          const ud = JSON.parse(udJson);
          const history: ChatMessage[] = ud.chatHistory ?? [];
          if (history.length > 0) {
            // Find the session boundary: the last greeting (first assistant message after a gap)
            // Simple heuristic: find the last assistant message that looks like a greeting
            // Better: use lastSessionDate to split
            const lastSessionDate = ud.lastSessionDate;
            if (lastSessionDate) {
              // Previous session = messages from the last completed session
              // These are messages that occurred before today's session start
              const prevMsgs = history.filter((m: ChatMessage) => {
                const msgDate = m.timestamp?.slice(0, 10);
                return msgDate && msgDate <= lastSessionDate;
              });
              // Keep only the last 30 messages from previous session to limit memory
              setPreviousSessionMessages(prevMsgs.slice(-30));
            }
          }
        }
      } catch (e) {
        console.warn('[Chat] Could not load previous session:', e);
      }
    })();
  }, []);

  // Start session and send greeting ONLY when Chat tab gains focus.
  // This prevents the greeting from firing during intake/backpack fill
  // (Expo Router mounts all tabs simultaneously).
  // GUARD: For Elias users, greeting is blocked until VSP is submitted.
  useFocusEffect(
    useCallback(() => {
      if (!preChatDone) return; // Pre-chat gate: required input not yet submitted
      if (state.intakeCompleted && state.backpack && state.userDat && !greetingSent.current) {
        // Greeting is always allowed regardless of backpack content.
        // Backpack is optional — users should not be blocked from chatting.
        greetingSent.current = true;
        // Clear messages for a fresh session view (pipeline still sends full history to GPT)
        setMessages([]);
        startSession();
        // Restore projection state from AsyncStorage BEFORE sending greeting
        // Must await so projection entries are loaded before first pipeline run
        (async () => {
          try {
            if (state.userType === 'elias') {
              await loadAndRestoreEliasProjection();
            } else {
              await loadAndRestoreKimProjection();
            }
          } catch (e) {
            console.error('[Chat] Failed to restore projection state, continuing with empty projection:', e);
          }
          sendGreetingViaP();
        })();
      }
    }, [state.intakeCompleted, state.backpack, state.userDat, preChatDone])
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
      // Only show the greeting message (last item in chatHistory), not old session messages
      const greeting = result.updatedUserDat.chatHistory.slice(-1);
      setMessages(greeting);
      // Debug: log session start
      logDebugEvent('session_start', {
        userType: state.userType ?? 'unknown',
        sessionNumber: result.updatedUserDat.totalSessions,
      });
    } catch (error) {
      console.error('Greeting error:', error);
      // Show the error to the user so we can debug on device
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `[DEBUG] Greeting failed: ${(error as Error)?.message ?? 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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
      // Show only current session messages: append the new user+assistant pair to existing messages
      // The pipeline returns full chatHistory (including old sessions), but UI only shows current session
      const fullHistory = result.updatedUserDat.chatHistory;
      // Current session = messages after the last greeting (first assistant msg in this session)
      // Simpler: just append the AI response to current messages (user msg already added optimistically)
      const aiResponse = fullHistory[fullHistory.length - 1];
      setMessages((prev) => [...prev, aiResponse]);
      // Debug logging (only in __DEV__)
      if (result.messageLog) {
        logDebugEvent('message_processed', {
          messageIndex: result.messageLog.messageIndex,
          zone: result.messageLog.preGPT.bufferZoneColor,
          model: result.messageLog.gpt.selectedModel ?? 'unknown',
          estimatedTokens: result.messageLog.gpt.tokenUsage?.totalTokens ?? 0,
          dominantModule: result.messageLog.preGPT.dominantState.dominantModule,
          riskScore: result.messageLog.preGPT.dominantState.riskScore,
          activeBlocks: [
            'identity',
            result.messageLog.preGPT.regulation.hasIntervention ? 'regulation' : null,
            result.dominantState?.dominantTrigger ? 'backpack' : null,
            'projection',
            'intervention_continuity',
          ].filter(Boolean),
        });
        if (result.crisisLevel > 0) {
          logDebugEvent('crisis_detected', {
            level: result.crisisLevel,
            riskScore: result.messageLog.preGPT.dominantState.riskScore,
            source: result.messageLog.preGPT.dominantState.sourceLayer,
          });
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `[DEBUG] Pipeline error: ${(error as Error)?.message ?? 'Unknown error'}`,
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
      // Attach diary entries for gratitude streak calculation
      let diaryForSession: DiaryEntry[] = [];
      try {
        const diaryJson = await AsyncStorage.getItem(DIARY_KEY);
        if (diaryJson) diaryForSession = JSON.parse(diaryJson);
      } catch (_e) { /* ignore */ }
      const userDatWithDiary = { ...currentUserDat, _sessionDiaryEntries: diaryForSession } as any;
      const result = await endSession(backpack, provider, userDatWithDiary);
      // Only persist userDat (backpack is NEVER modified)
      await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      await endSessionWithUserDat(result.updatedUserDat);
      await AsyncStorage.removeItem(PENDING_CLOSE_KEY);
      const confirmationMsg: ChatMessage = {
        id: `msg_confirm_${Date.now()}`,
        role: 'assistant',
        content: result.farewell + '\n\nIk heb alles opgeslagen. Je sessie is veilig bewaard. Je kunt de app nu sluiten of teruggaan naar het startscherm.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmationMsg]);
      setSessionPhase('completed');
      // Debug: log session end
      logDebugEvent('session_end', {
        messageCount: result.updatedUserDat.chatHistory.length,
        durationMs: 0, // not tracked currently
      });
    } catch (error) {
      console.error('End session error:', error);
      const fallbackMsg: ChatMessage = {
        id: `msg_fallback_${Date.now()}`,
        role: 'assistant',
        content: `${userName}, ik heb je sessie opgeslagen. Er ging iets mis tijdens de analyse, maar je gesprek is veilig bewaard. Je kunt de app nu sluiten.`,
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
    // Parse clinical tag from assistant messages
    const { visibleContent, clinicalAnnotation } = parseClinicalTag(item.content, isUser);

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
            {visibleContent}
          </Text>
          {clinicalAnnotation && (
            <ClinicalTag annotation={clinicalAnnotation} />
          )}
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

  // ── PRE-CHAT GATE: show required input before chat can start ──
  if (!preChatDone) {
    if (state.userType === 'elias') {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <PreChatVsp onSubmit={handleVspSubmit} userName={userName} />
        </View>
      );
    }
    if (state.userType === 'kim') {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          <PreChatEigenRegie onSubmit={handleEigenRegieSubmit} userName={userName} />
        </View>
      );
    }
  }

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
            <>
              {previousSessionMessages.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Pressable
                    onPress={() => setShowPreviousSession(!showPreviousSession)}
                    style={({ pressed }) => [{
                      opacity: pressed ? 0.7 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 8,
                      gap: 6,
                    }]}
                  >
                    <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '500' }}>
                      {showPreviousSession ? 'Hide previous session ▲' : `Previous session (${previousSessionMessages.length} messages) ▼`}
                    </Text>
                  </Pressable>
                  {showPreviousSession && (
                    <View style={{ opacity: 0.6, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 12, marginTop: 8 }}>
                      {previousSessionMessages.map((msg) => (
                        <View key={msg.id} style={{ marginBottom: 8, maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <View
                            style={{
                              borderRadius: 12,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              backgroundColor: msg.role === 'user' ? colors.primary : colors.surface,
                              borderWidth: msg.role === 'user' ? 0 : 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text
                              style={{ fontSize: 13, color: msg.role === 'user' ? '#FFFFFF' : colors.foreground }}
                              numberOfLines={3}
                            >
                              {msg.content.replace(/<clinical>[\s\S]*?<\/clinical>/g, '').trim()}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <View style={{ alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.muted }}>— End of previous session —</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
              {showEmergency && (
                <EmergencyCard
                  visible={showEmergency}
                  onDismiss={() => setShowEmergency(false)}
                  lastUserMessage={messages.filter(m => m.role === 'user').pop()?.content ?? null}
                />
              )}
            </>
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

        {/* Fixed crisis disclaimer at bottom */}
        <Text style={{ fontSize: 11, color: '#999', textAlign: 'center', paddingVertical: 4 }}>
          RecoFree is not a substitute for professional help.{"\n"}
          Crisis? Call 0800 32 123 (24/7) or 107.
        </Text>
      </View>

      {/* First-chat disclaimer modal — not skipable */}
      <Modal visible={!firstChatSeen} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, maxHeight: '80%' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: colors.foreground }}>
              Before we begin
            </Text>
            <RNScrollView style={{ maxHeight: 300 }}>
              <Text style={{ color: colors.foreground, lineHeight: 22 }}>
                {companionName} is an AI companion, not a therapist or doctor.
                {'\n\n'}
                {'\u2022'} RecoFree does not replace professional mental health care.
                {'\n'}
                {'\u2022'} RecoFree never provides diagnoses or medical advice.
                {'\n'}
                {'\u2022'} RecoFree is not a replacement for a psychologist or psychiatrist.
                {'\n'}
                {'\u2022'} Sometimes professional help is the better choice — and that is okay.
                {'\n'}
                {'\u2022'} In case of crisis, always contact a professional or call 0800 32 123.
                {'\n'}
                {'\u2022'} Your conversations are private and stay on your device.
              </Text>
            </RNScrollView>
            <TouchableOpacity
              onPress={dismissFirstChatDisclaimer}
              style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                I understand
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

// ─── Clinical Mode: parse <clinical>...</clinical> from response ───

function parseClinicalTag(content: string, isUser: boolean): { visibleContent: string; clinicalAnnotation: string | null } {
  const fixed = fixUnicode(content);
  if (isUser) return { visibleContent: fixed, clinicalAnnotation: null };
  const match = fixed.match(/<clinical>([\s\S]*?)<\/clinical>/);
  if (!match) return { visibleContent: fixed, clinicalAnnotation: null };
  const visibleContent = fixed.replace(/<clinical>[\s\S]*?<\/clinical>/, '').trim();
  return { visibleContent, clinicalAnnotation: match[1].trim() };
}

function ClinicalTag({ annotation }: { annotation: string }) {
  const [expanded, setExpanded] = useState(false);
  const colors = useColors();

  // Hide clinical tag when not annotated or during crisis
  if (
    annotation.includes('[not annotated') ||
    annotation.includes('model did not comply')
  ) {
    return null;
  }

  // Parse Signals line from annotation
  const lines = annotation.split('\n');
  const signalsLine = lines.find(l => l.startsWith('Signals:'));
  const otherLines = lines.filter(l => !l.startsWith('Signals:')).join('\n');
  const signalsValue = signalsLine ? signalsLine.replace('Signals:', '').trim() : null;

  return (
    <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6 }}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>
          {expanded ? '⚕ clinical ▼' : '⚕ clinical ▶'}
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 6, backgroundColor: colors.background, borderRadius: 8, padding: 10 }}>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {otherLines}
          </Text>
          {signalsValue && signalsValue !== 'none' && (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#E65100' }}>
                Signals: <Text style={{ fontWeight: '400', color: colors.foreground }}>{signalsValue}</Text>
              </Text>
            </View>
          )}
          {signalsValue === 'none' && (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontStyle: 'italic' }}>
                Signals: none
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
