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
  Linking,
  type AppStateStatus,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession, runDeferredSessionAnalysis } from '@/lib/rugzak/pipeline';
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
import { initGptSignalEngine } from '@/lib/engine/local-llm/engine-provider';
import { getApiBaseUrl } from '@/constants/oauth';
import { getSessionLifecycleManager, buildDetectionBundle, runMemoryWriteBack, type PipelineResultForMemory } from '@/lib/pipeline/memory/memoryIntegration';
import { sessionInitGreetingStep } from '@/lib/features/sessionGreeting/sessionInitGreetingStep';
import type { MemoryStoresSnapshot } from '@/lib/pipeline/memory/memoryCommitService';
import { createEmptyUserDat } from '@/lib/types/memory/userDat.types';
import { createEmptyStateDat } from '@/lib/types/memory/stateDat.types';
import { createEmptyProjectionsDat } from '@/lib/types/memory/projectionsDat.types';
import { ChatErrorBoundary } from '@/components/chat-error-boundary';
import { colors as dc, spacing, radius, typography, shadows } from '@/constants/design';

const BACKPACK_KEY = '@recofree_backpack';
const USERDAT_KEY = '@recofree_userdat';
const PENDING_CLOSE_KEY = '@recofree_pending_close';
const DIARY_KEY = '@recofree_diary';

// ─── Silence Detection (both personas) ───────────────────────────────
const SILENCE_TIMEOUT_MS = 180_000; // 180 seconds (3 minutes)
const POST_DISCLOSURE_TIMEOUT_MS = 90_000; // 90 seconds (Module 58)

const STILTE_RESPONSES_ELIAS = [
  "Ik ben hier, ook als je even niks zegt.",
  "Soms zijn woorden moeilijk. Ik blijf.",
  "Je hoeft niets te forceren. Ik wacht.",
];

const STILTE_RESPONSES_KIM = [
  "Ik ben hier, ook als jij even stil bent.",
  "Soms zijn woorden moeilijk. Ik blijf bij je.",
  "Er mag stilte zijn. Als je weer wil praten, ben ik er.",
];

const POST_ONTHULLING_RESPONSE_ELIAS =
  "Wat je net deelde getuigt van moed. Het is oké om even stil te vallen. Ik ben er nog.";

const POST_ONTHULLING_RESPONSE_KIM =
  "Je hoeft niet meteen verder. Alles wat je hier deelt, blijft hier.";

// Keywords that indicate a deep disclosure (Module 58)
const DISCLOSURE_KEYWORDS = [
  'ik schaam me', 'ik schaam mij',
  'ik heb iets slechts gedaan', 'ik heb iets ergs gedaan',
  'ik ben bang dat je me verafschuwt', 'je zal me haten',
  'ik durf het niet te zeggen', 'ik heb iets vreselijks gedaan',
  'niemand mag dit weten', 'ik voel me vies',
  'ik walg van mezelf', 'ik ben een slecht mens',
];

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
  const [showRestoreToast, setShowRestoreToast] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isUserScrolledUp = useRef(false);
  const prevMessagesLength = useRef(0);
  const greetingSent = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const userName = getUserName();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

  // ── Initialize GptSignalEngine once at mount ──────────────────────────
  useEffect(() => {
    const url = getApiBaseUrl();
    if (url) initGptSignalEngine(url);
  }, []);

  // Reset chat state when user data is cleared (e.g. after Reset All Data)
  useEffect(() => {
    if (!state.intakeCompleted) {
      greetingSent.current = false;
      silenceFiredRef.current = false;
      disclosureDetectedRef.current = false;
      setMessages([]);
      setSessionPhase('active');
      setIsTyping(false);
      setShowScrollButton(false);
    }
  }, [state.intakeCompleted]);

  // ── Silence Detection (both personas) ──────────────────────────────
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceFiredRef = useRef(false);
  const disclosureDetectedRef = useRef(false);
  const isElias = state.userType === 'elias';

  /** Check if the last user message contains disclosure keywords (Module 58) */
  const checkForDisclosure = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    return DISCLOSURE_KEYWORDS.some((kw) => lower.includes(kw));
  }, []);

  /** Reset the silence timer — called on every user interaction */
  const resetSilenceTimer = useCallback(() => {
    // Clear existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    // Don't restart if already fired this silence moment
    if (silenceFiredRef.current) return;
    // Don't start if crisis level >= 2
    if (state.crisisLevel >= 2) return;

    // Determine timeout: 90s if disclosure detected, else 20s
    const timeout = disclosureDetectedRef.current
      ? POST_DISCLOSURE_TIMEOUT_MS
      : SILENCE_TIMEOUT_MS;

    silenceTimerRef.current = setTimeout(() => {
      // Guard: only fire if not already fired
      if (silenceFiredRef.current) return;
      // Guard: crisis check at fire time
      if (state.crisisLevel >= 2) return;
      silenceFiredRef.current = true;

      let response: string;
      if (disclosureDetectedRef.current) {
        // Module 58: post-disclosure response
        response = isElias ? POST_ONTHULLING_RESPONSE_ELIAS : POST_ONTHULLING_RESPONSE_KIM;
      } else {
        // Normal silence: pick random from persona-specific list
        const list = isElias ? STILTE_RESPONSES_ELIAS : STILTE_RESPONSES_KIM;
        response = list[Math.floor(Math.random() * list.length)];
      }

      // Personalize with name if known
      if (userName) {
        response = response.replace(/^([^,\.]+)/, `$1, ${userName}`);
      }

      const silenceMsg: ChatMessage = {
        id: `msg_silence_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, silenceMsg]);
    }, timeout);
  }, [isElias, userName, state.crisisLevel]);

  // Start/reset silence timer when session becomes active and greeting is sent
  useEffect(() => {
    if (sessionPhase !== 'active') return;
    // Only start after greeting is sent (messages > 0)
    if (messages.length === 0) return;
    // If AI is typing, don't start timer
    if (isTyping) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }
    // Check last message context
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && !lastMsg.id.startsWith('msg_silence_')) {
      // AI just responded — reset silence state for next silence moment
      silenceFiredRef.current = false;
      // Check if the last USER message before this AI response was a disclosure
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      disclosureDetectedRef.current = lastUserMsg ? checkForDisclosure(lastUserMsg.content) : false;
      resetSilenceTimer();
    }
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [sessionPhase, messages.length, isTyping, resetSilenceTimer, checkForDisclosure]);

  // Reset silence timer on text input change (user is typing)
  useEffect(() => {
    if (!inputText) return;
    // User is actively typing — reset timer and silence state
    silenceFiredRef.current = false;
    disclosureDetectedRef.current = false;
    resetSilenceTimer();
  }, [inputText, resetSilenceTimer]);

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
        if (!isUserScrolledUp.current) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
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
  // If the previous session was saved with needsFullAnalysis: true (timeout fallback),
  // run the deferred session-end analysis on the previous chatHistory before the new greeting.
  useEffect(() => {
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_CLOSE_KEY);
        if (pending) {
          const pendingData = JSON.parse(pending);
          await AsyncStorage.removeItem(PENDING_CLOSE_KEY);

          // Run deferred analysis if the previous session needs it
          if (pendingData.needsFullAnalysis) {
            try {
              const bpJson = await AsyncStorage.getItem(BACKPACK_KEY);
              const udJson = await AsyncStorage.getItem(USERDAT_KEY);
              if (bpJson && udJson) {
                const backpack = JSON.parse(bpJson);
                const userDat = JSON.parse(udJson);
                const analyzedUserDat = runDeferredSessionAnalysis(backpack, userDat);
                await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(analyzedUserDat));
                console.log('[Chat] Deferred session analysis completed for previous session');
              }
            } catch (analysisErr) {
              console.warn('[Chat] Deferred analysis failed (non-blocking):', analysisErr);
            }
          }

          // Show non-intrusive toast
          setShowRestoreToast(true);
          setTimeout(() => setShowRestoreToast(false), 3500);
        }
      } catch (e) {
        console.error('Error checking pending close:', e);
      }
    })();
  }, []);

  // ── Auto-end session when app goes to background ──
  const autoEndTriggeredRef = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive') &&
        sessionPhase === 'active' &&
        messages.length > 1 &&
        !autoEndTriggeredRef.current &&
        state.backpack &&
        state.userDat
      ) {
        // Auto-end the session silently in the background with 10s timeout
        autoEndTriggeredRef.current = true;
        const endSessionWithTimeout = async () => {
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
          // Race: endSession vs 10s timeout
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
          const resultOrNull = await Promise.race([
            endSession(backpack, provider, userDatWithDiary).catch(() => null),
            timeoutPromise,
          ]);
          if (resultOrNull && 'updatedUserDat' in resultOrNull) {
            // Full session end succeeded within 10s
            await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(resultOrNull.updatedUserDat));
            await endSessionWithUserDat(resultOrNull.updatedUserDat);
            await AsyncStorage.removeItem(PENDING_CLOSE_KEY);
            logDebugEvent('session_auto_end', {
              trigger: 'app_background',
              messageCount: resultOrNull.updatedUserDat.chatHistory.length,
            });
            // Memory Lifecycle: end session on background
            try {
              const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
              const apiBase = getApiBaseUrl();
              const lifecycleManager = getSessionLifecycleManager();
              await lifecycleManager.endSession(persona, apiBase);
            } catch (_memErr) {
              // Non-critical
            }
          } else {
            // Timeout or error: lightweight local save (pending close marker)
            // Full analysis will happen at next session start
            await AsyncStorage.setItem(
              PENDING_CLOSE_KEY,
              JSON.stringify({
                timestamp: new Date().toISOString(),
                messageCount: messages.length,
                lastMessage: messages[messages.length - 1]?.content?.slice(0, 100),
                needsFullAnalysis: true,
              })
            );
            logDebugEvent('session_auto_end', {
              trigger: 'app_background_timeout_fallback',
              messageCount: messages.length,
            });
          }
        };
        try {
          await endSessionWithTimeout();
        } catch (e) {
          console.error('[Chat] Auto-end session error (background):', e);
          try {
            await AsyncStorage.setItem(
              PENDING_CLOSE_KEY,
              JSON.stringify({
                timestamp: new Date().toISOString(),
                messageCount: messages.length,
                lastMessage: messages[messages.length - 1]?.content?.slice(0, 100),
                needsFullAnalysis: true,
              })
            );
          } catch (_e2) { /* ignore */ }
        }
      }
      // When app returns to foreground after auto-end, reset for fresh session
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active' &&
        autoEndTriggeredRef.current
      ) {
        autoEndTriggeredRef.current = false;
        greetingSent.current = false;
        setPreChatDone(false);
        setSessionPhase('active');
        setMessages([]);
        setShowEmergency(false);
        silenceFiredRef.current = false;
        disclosureDetectedRef.current = false;
        // Show restore toast
        setShowRestoreToast(true);
        setTimeout(() => setShowRestoreToast(false), 3500);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [sessionPhase, messages, state.backpack, state.userDat, endSessionWithUserDat]);

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
  // RESET: If session was completed, reset for fresh start on next focus.
  useFocusEffect(
    useCallback(() => {
      // If session was completed (user ended chat), reset for a fresh start
      if (sessionPhase === 'completed') {
        greetingSent.current = false;
        setPreChatDone(false);
        setSessionPhase('active');
        setMessages([]);
        setShowEmergency(false);
        silenceFiredRef.current = false;
        disclosureDetectedRef.current = false;
        return; // Will re-trigger on next focus after preChatDone is set
      }
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
    }, [state.intakeCompleted, state.backpack, state.userDat, preChatDone, sessionPhase])
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

      // ── Module 98: Verwaarlozing Detectie ──────────────────────────
      // Track engagement: check if user had diary entries, slider changes, or backpack additions
      // since last session. If not, increment counter; if yes, reset to 0.
      const lastSession = userDat.lastSessionDate;
      const hasDiaryEngagement = diaryEntries.length > 0 && lastSession
        ? diaryEntries.some((e) => e.timestamp && e.timestamp > lastSession)
        : false;
      const hasSliderEngagement = userDat.moodHistory.length > 0 && lastSession
        ? userDat.moodHistory.some((s: any) => s.timestamp && s.timestamp > lastSession)
        : false;
      const hasBackpackEngagement = backpack.sections.some(
        (s) => s.lastUpdated && lastSession && s.lastUpdated > lastSession
      );
      const hadEngagement = hasDiaryEngagement || hasSliderEngagement || hasBackpackEngagement;
      if (hadEngagement) {
        userDat.consecutiveSessionsWithoutEngagement = 0;
      } else if (userDat.totalSessions > 0) {
        // Only increment if this is not the very first session
        userDat.consecutiveSessionsWithoutEngagement = (userDat.consecutiveSessionsWithoutEngagement ?? 0) + 1;
      }

      // Check trigger condition: 3+ sessions without engagement AND total sessions > 4
      let triggerModule98 = false;
      if (
        userDat.totalSessions > 4 &&
        userDat.consecutiveSessionsWithoutEngagement >= 3
      ) {
        triggerModule98 = true;
      }
      if (triggerModule98) {
        console.log('[Chat] Module 98 triggered: consecutiveSessionsWithoutEngagement =', userDat.consecutiveSessionsWithoutEngagement);
      }

      // ── Module 93: Reactivatie na stilstand ─────────────────────
      // When user returns after 3+ days of inactivity, flag for warm welcome back
      let triggerModule93 = false;
      if (userDat.lastSessionDate && userDat.totalSessions > 0) {
        const lastDate = new Date(userDat.lastSessionDate).getTime();
        const now = Date.now();
        const daysSinceLastSession = (now - lastDate) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSession >= 3) {
          triggerModule93 = true;
        }
      }
      if (triggerModule93) {
        console.log('[Chat] Module 93 triggered: user returned after 3+ days of inactivity');
      }

      const provider = getAIProvider();

      // ── Session Greeting Engine: deterministic anchor selection + GPT greeting ──
      let greetingText: string | null = null;
      try {
        const apiUrl = getApiBaseUrl();
        if (apiUrl) {
          const greetingResult = await sessionInitGreetingStep({
            backpack,
            userDat,
            diaryEntries,
            apiBaseUrl: apiUrl,
            timezone: 'Europe/Amsterdam',
            clinicalModeActive: userDat?.clinicalModeActive ?? false,
          });
          greetingText = greetingResult.greeting;
          console.log(greetingResult.debugLog);
        }
      } catch (greetingErr) {
        console.warn('[Chat] Session Greeting Engine failed, falling back to pipeline greeting:', greetingErr);
      }

      // If greeting engine produced a result, use it directly
      if (greetingText) {
        const greetingMsg: ChatMessage = {
          id: `msg_greeting_${Date.now()}`,
          role: 'assistant',
          content: greetingText,
          timestamp: new Date().toISOString(),
        };
        // Append to chatHistory and persist
        userDat.chatHistory = [...(userDat.chatHistory || []), greetingMsg];
        userDat.totalSessions = (userDat.totalSessions ?? 0) + 1;
        userDat.lastSessionDate = new Date().toISOString().slice(0, 10);
        await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(userDat));
        setMessages([greetingMsg]);
        logDebugEvent('session_start', {
          userType: state.userType ?? 'unknown',
          sessionNumber: userDat.totalSessions,
          greetingEngine: true,
        });
      } else {
        // Fallback: use existing pipeline greeting
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
          greetingEngine: false,
        });
      }
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

    // Reset silence detection on user send
    silenceFiredRef.current = false;
    disclosureDetectedRef.current = checkForDisclosure(rawText);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

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
          activeModules: result.moduleActivations ?? [],
          k06Status: result.k06Status ?? 'NOT_RUN',
          crisisProtocolActive: result.crisisProtocolActive ?? false,
        });
        if (result.crisisLevel > 0) {
          logDebugEvent('crisis_detected', {
            level: result.crisisLevel,
            riskScore: result.messageLog.preGPT.dominantState.riskScore,
            source: result.messageLog.preGPT.dominantState.sourceLayer,
          });
        }
      }
      // ── Memory Write-Back Step ──────────────────────────────────────────
      // Execute after all pipeline detections are complete (step 16 → 17)
      try {
        const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
        const memoryInput: PipelineResultForMemory = {
          userMessage: processedText,
          persona,
          sessionId: `session_${Date.now()}`,
          localUserId: 'local_user',
          candidateSignals: result.candidateSignals ? {
            fears: (result.candidateSignals.fears || []).map((f: any) => ({ label: f.keyword || f.label || f, confidence: f.confidence ?? 0.5 })),
            hopes: (result.candidateSignals.hopes || []).map((h: any) => ({ label: h.keyword || h.label || h, confidence: h.confidence ?? 0.5 })),
            goals: (result.candidateSignals.goals || []).map((g: any) => ({ label: g.keyword || g.label || g, confidence: g.confidence ?? 0.5 })),
            triggers: (result.candidateSignals.triggers || []).map((t: any) => ({ label: t.keyword || t.label || t, confidence: t.confidence ?? 0.5 })),
          } : null,
          schemaModeResult: result.schemaModeResult?.activated ? {
            activated: true,
            modeDecision: {
              acceptedModes: result.schemaModeResult.modeDecision?.acceptedModes ?? [],
              dominantMode: result.schemaModeResult.modeDecision?.dominantMode ?? null,
            },
            schemaDecision: {
              acceptedSchemas: result.schemaModeResult.schemaDecision?.acceptedSchemas ?? [],
              dominantSchema: result.schemaModeResult.schemaDecision?.dominantSchema ?? null,
              dominantDomain: result.schemaModeResult.schemaDecision?.dominantDomain ?? null,
            },
          } : null,
          bufferSnapshot: result.bufferSnapshot ? {
            zoneColor: result.bufferSnapshot.zoneColor,
            zoneScore: result.bufferSnapshot.zoneScore,
          } : null,
          activeModule: result.dominantState ? {
            moduleId: result.dominantState.dominantModule,
            confidence: 0.8,
            responseMode: result.dominantState.dominantDirection,
          } : null,
          moodSliders: result.messageLog?.preGPT?.dominantState ? {} : null,
          moduleActivations: result.moduleActivations,
        };
        const bundle = buildDetectionBundle(memoryInput);
        // Build current stores snapshot (in-memory defaults for now)
        const lifecycleManager = getSessionLifecycleManager();
        const stores = lifecycleManager.getStores();
        const currentStores: MemoryStoresSnapshot = {
          userDat: await stores.userDatStore.load(persona, 'local_user'),
          stateDat: await stores.stateDatStore.load(persona),
          projectionsDat: await stores.projectionsDatStore.load(persona),
          sessionBuffer: stores.sessionBufferStore.getBuffer(),
        };
        const writeResult = runMemoryWriteBack(bundle, currentStores);
        // Persist updated stores
        await stores.userDatStore.save(writeResult.updatedStores.userDat);
        await stores.stateDatStore.save(writeResult.updatedStores.stateDat);
        await stores.projectionsDatStore.save(writeResult.updatedStores.projectionsDat);
        // Update session buffer with turn snapshot
        const buffer = stores.sessionBufferStore.getBuffer();
        if (buffer) {
          stores.sessionBufferStore.appendMessage(buffer, {
            role: 'user',
            text: processedText,
            timestampIso: new Date().toISOString(),
          });
          const updatedBuffer = stores.sessionBufferStore.getBuffer();
          if (updatedBuffer) {
            stores.sessionBufferStore.appendMessage(updatedBuffer, {
              role: 'assistant',
              text: result.response.slice(0, 200),
              timestampIso: new Date().toISOString(),
            });
          }
          stores.sessionBufferStore.appendTurnSnapshot(stores.sessionBufferStore.getBuffer()!, {
            turnId: bundle.context.turnId,
            timestampIso: bundle.context.timestampIso,
            inputHash: bundle.context.inputHash,
            zone: bundle.zoneDecision ?? undefined,
            activeModule: bundle.activeModule ?? undefined,
            detectedCounts: {
              fears: bundle.fears.length,
              hopes: bundle.hopes.length,
              triggers: bundle.triggers.length,
              schemaTendencies: bundle.schemaTendencies.length,
              modeTendencies: bundle.modeTendencies.length,
            },
            changedFields: writeResult.commitResult.changedFields,
          });
        }
        // Debug log
        if (__DEV__) {
          console.log(writeResult.debugLog);
          logDebugEvent('memory_write_back', {
            planId: writeResult.plan.planId,
            patchCount: writeResult.plan.patches.length,
            changedFields: writeResult.commitResult.changedFields,
          });
        }
      } catch (memErr) {
        // Memory write-back is non-critical — log and continue
        console.warn('[MemoryWriteBack] Error (non-critical):', memErr);
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
      // ── Memory Lifecycle: End Session ──────────────────────────────────
      // Generates session summary via GPT-4o-mini and appends to logs.dat (encrypted)
      try {
        const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
        const apiBase = getApiBaseUrl();
        const lifecycleManager = getSessionLifecycleManager();
        const endResult = await lifecycleManager.endSession(persona, apiBase);
        if (__DEV__) {
          console.log(`[SessionLifecycle] endSession result: summarized=${endResult.summarized}, sessionId=${endResult.sessionId}`);
          logDebugEvent('memory_session_end', {
            sessionId: endResult.sessionId,
            summarized: endResult.summarized,
            error: endResult.error ?? null,
          });
        }
      } catch (lifecycleErr) {
        // Non-critical: session ends even if memory lifecycle fails
        console.warn('[SessionLifecycle] endSession error (non-critical):', lifecycleErr);
      }
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
    // Reset session state so next Chat tab focus triggers a fresh greeting
    greetingSent.current = false;
    setPreChatDone(false);
    setSessionPhase('active');
    setMessages([]);
    setShowEmergency(false);
    silenceFiredRef.current = false;
    disclosureDetectedRef.current = false;
    router.replace('/(tabs)');
  }, [router]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isElias = state.userType === 'elias';
    // Parse clinical tag from assistant messages
    const { visibleContent, clinicalAnnotation } = parseClinicalTag(item.content, isUser);

    const bubbleStyle = isUser
      ? {
          alignSelf: 'flex-end' as const,
          maxWidth: '84%' as unknown as number,
          backgroundColor: dc.surface,
          borderColor: dc.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          borderTopRightRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 14,
          ...shadows.soft,
        }
      : {
          alignSelf: 'flex-start' as const,
          maxWidth: '84%' as unknown as number,
          backgroundColor: isElias ? dc.eliasAccentSoft : dc.kimAccentSoft,
          borderColor: isElias ? '#DCEEFE' : dc.kimAccentMuted,
          borderWidth: 1,
          borderRadius: radius.lg,
          borderTopLeftRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 14,
        };

    return (
      <View style={{ marginBottom: 14, alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '84%' }}>
        {!isUser && (
          <Text style={{ ...typography.micro, color: dc.textTertiary, marginBottom: 4, marginLeft: 4 }}>
            {companionName}
          </Text>
        )}
        <View style={bubbleStyle}>
          <Text
            selectable={true}
            style={{
              ...typography.chat,
              color: dc.textPrimary,
            }}
          >
            {visibleContent}
          </Text>
          {clinicalAnnotation && (
            <ClinicalTag annotation={clinicalAnnotation} />
          )}
        </View>
        <Text style={{ ...typography.micro, color: dc.textMuted, marginTop: 4, textAlign: isUser ? 'right' : 'left', marginHorizontal: 4 }}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  }, [companionName, state.userType]);

  const scrollToEnd = useCallback(() => {
    if (isUserScrolledUp.current) return;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Auto-scroll only when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      scrollToEnd();
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, scrollToEnd]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrolledUp.current = true;
    setShowScrollButton(true);
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    // If user scrolls back to within 50px of bottom, re-enable auto-scroll
    if (distanceFromBottom < 50) {
      isUserScrolledUp.current = false;
      setShowScrollButton(false);
    }
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
    <View style={{ flex: 1, backgroundColor: dc.background }}>
      {/* Safe area for top only */}
      <View style={{ paddingTop: insets.top, backgroundColor: isElias ? dc.eliasAccent : dc.kimAccentDeep }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.screenHorizontal,
            paddingVertical: 14,
            borderBottomWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isElias ? dc.eliasAccent : dc.kimAccentDeep,
          }}
        >
          <View>
            <Text style={{ ...typography.titleSmall, color: dc.textInverse }}>
              {companionName}
            </Text>
            <Text style={{ ...typography.micro, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {isTyping ? 'Typing...' : 'Online'}
            </Text>
          </View>
          {/* End button removed — session auto-ends when app goes to background */}
        </View>
      </View>

      {/* Restore toast */}
      {showRestoreToast && (
        <View style={{
          position: 'absolute',
          top: insets.top + 60,
          left: 24,
          right: 24,
          zIndex: 100,
          backgroundColor: 'rgba(34, 197, 94, 0.95)',
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 16,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            Vorige sessie veilig opgeslagen
          </Text>
        </View>
      )}

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
          onContentSizeChange={() => { /* auto-scroll handled by messages.length effect */ }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          scrollEventThrottle={100}
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
              {showEmergency && (
                <EmergencyCard
                  visible={showEmergency}
                  onDismiss={() => setShowEmergency(false)}
                  lastUserMessage={messages.filter(m => m.role === 'user').pop()?.content ?? null}
                />
              )}
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
              {/* Session ending/completed UI removed — auto-end happens silently in background */}
            </>
          }
        />

        {/* Scroll-to-bottom FAB */}
        {showScrollButton && (
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              isUserScrolledUp.current = false;
              setShowScrollButton(false);
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 16,
              bottom: sessionPhase === 'active' ? 90 : 60,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 0.9,
              transform: [{ scale: pressed ? 0.92 : 1 }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
              zIndex: 10,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 22 }}>↓</Text>
          </Pressable>
        )}

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
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: dc.surface,
                  borderWidth: 1,
                  borderColor: dc.borderSoft,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.inputPadding,
                  paddingVertical: 14,
                  ...typography.chat,
                  color: dc.textPrimary,
                  maxHeight: 120,
                }}
                placeholder="Type a message..."
                placeholderTextColor={dc.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                returnKeyType="default"
                editable={!isTyping}
                onFocus={() => { if (!isUserScrolledUp.current) scrollToEnd(); }}
              />
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || isTyping}
                style={({ pressed }) => [
                  {
                    opacity: !inputText.trim() || isTyping ? 0.4 : pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <View
                  style={{
                    backgroundColor: state.userType === 'elias' ? dc.eliasAccent : dc.kimAccent,
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.soft,
                  }}
                >
                  <IconSymbol name="paperplane.fill" size={20} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Fixed crisis disclaimer at bottom */}
        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', paddingTop: 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}>
          RecoFree is geen vervanging voor professionele hulp.{' '}
          <Text
            style={{ color: '#E53935', fontWeight: 'bold', textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('tel:080032123')}
          >
            Zelfmoordlijn: 0800 32 123
          </Text>
          {' '}(24/7, gratis, anoniem) |{' '}
          <Text
            style={{ color: '#E53935', fontWeight: 'bold', textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('tel:1712')}
          >
            1712
          </Text>
          {' '}(huiselijk geweld) |{' '}
          <Text
            style={{ color: '#E53935', fontWeight: 'bold', textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('tel:112')}
          >
            Noodgevallen: 112
          </Text>
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
  const annotation = match[1].trim();
  // Always show clinical annotations (even fallback) — clinician needs to see compliance status
  return { visibleContent, clinicalAnnotation: annotation };
}

function ClinicalTag({ annotation }: { annotation: string }) {
  const [expanded, setExpanded] = useState(false);
  const colors = useColors();

  // Show fallback annotation when model did not comply (visible to clinician)
  const isFallback = annotation.includes('[not annotated') || annotation.includes('model did not comply');

  // Parse Signals line and VSP-Framework line from annotation
  const lines = annotation.split('\n');
  const signalsLine = lines.find(l => l.startsWith('Signals:'));
  const vspFrameworkLine = lines.find(l => l.startsWith('VSP-Framework:'));
  const vspFramework = vspFrameworkLine ? vspFrameworkLine.replace('VSP-Framework:', '').trim() : null;
  const otherLines = lines.filter(l => !l.startsWith('Signals:') && !l.startsWith('VSP-Framework:')).join('\n');
  const signalsValue = signalsLine ? signalsLine.replace('Signals:', '').trim() : null;

  return (
    <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6 }}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: isFallback ? '#B71C1C' : '#2E7D32' }}>
          {expanded ? '⚕ clinical ▼' : '⚕ clinical ▶'}{isFallback ? ' ⚠' : ''}{vspFramework ? ` · VSP: ${vspFramework}` : ''}
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 6, backgroundColor: colors.background, borderRadius: 8, padding: 10 }}>
          {vspFramework && (
            <View style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1565C0' }}>
                VSP-Framework: <Text style={{ fontWeight: '600', color: vspFramework === 'DGT' ? '#E65100' : vspFramework === 'MBT' ? '#6A1B9A' : '#2E7D32' }}>{vspFramework}</Text>
              </Text>
            </View>
          )}
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
