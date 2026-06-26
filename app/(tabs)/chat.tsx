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
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession } from '@/lib/rugzak/pipeline';
import { EmergencyCard } from '@/components/emergency-card';
import { getPrimarySuicideLine, getEmergencyNumber } from '@/lib/crisis/resources';
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
import { sessionInitGreetingStep, type SessionInitGreetingInput } from '@/lib/features/sessionGreeting/sessionInitGreetingStep';
import type { MemoryStoresSnapshot } from '@/lib/pipeline/memory/memoryCommitService';
import { createEmptyUserDat } from '@/lib/types/memory/userDat.types';
import { createEmptyStateDat } from '@/lib/types/memory/stateDat.types';
import { createEmptyProjectionsDat } from '@/lib/types/memory/projectionsDat.types';
import { migrateSessionAnalysesToLogsDat } from '@/lib/pipeline/memory/migrateSessionAnalysesToLogsDat';
import { ChatErrorBoundary } from '@/components/chat-error-boundary';
import { colors as dc, spacing, radius, typography, shadows } from '@/constants/design';
import { triggerBackpackAnalysisIfNeeded } from '@/lib/backpack-analysis/schema-mode-trigger';
import { useTranslation } from '@/lib/i18n';

const BACKPACK_KEY = '@recofree_backpack';
const USERDAT_KEY = '@recofree_userdat';
// PENDING_CLOSE_KEY removed — no longer needed (one path to session-end, no fallback markers)
const DIARY_KEY = '@recofree_diary';

// ─── Inactivity Auto-Close ───────────────────────────────────────────
const INACTIVITY_AUTO_CLOSE_MS = 600_000; // 10 minutes (600 seconds) — auto-close + full write-back

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
  const { t, locale, language, country } = useTranslation();
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
      setMessages([]);
      setSessionPhase('active');
      setIsTyping(false);
      setShowScrollButton(false);
    }
  }, [state.intakeCompleted]);

  // ── Inactivity Auto-Close refs ───────────────────────────────────
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityEndTriggeredRef = useRef(false);
  const handleEndConversationRef = useRef<(() => Promise<void>) | null>(null);
  const logsDatSessionsRef = useRef<any[]>([]);
  const isElias = state.userType === 'elias';

  // ── 10-Minute Inactivity Auto-Close Timer ─────────────────────────────
  // After 10 minutes of no user interaction, trigger the EXACT SAME full
  // endSession chain as a normal close. No timeout race, no pending-close
  // fallback. One path to session-end, inactivity is just a trigger.
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    // Don't start if session is not active or already ended
    if (sessionPhase !== 'active' || inactivityEndTriggeredRef.current) return;
    // Only start if there are messages (session has started)
    if (messages.length <= 1) return;

    inactivityTimerRef.current = setTimeout(async () => {
      if (inactivityEndTriggeredRef.current || sessionPhase !== 'active') return;
      inactivityEndTriggeredRef.current = true;

      console.log('[Chat] Inactivity auto-close triggered (10 minutes) — running full endSession chain');
      logDebugEvent('session_auto_end', { trigger: 'inactivity_10min', messageCount: messages.length });

      // Call the exact same handleEndConversation logic via ref
      if (handleEndConversationRef.current) {
        await handleEndConversationRef.current();
      }
    }, INACTIVITY_AUTO_CLOSE_MS);
  }, [sessionPhase, messages]);

  // Start/reset inactivity timer when session is active and messages change
  useEffect(() => {
    if (sessionPhase === 'active' && messages.length > 1) {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [sessionPhase, messages.length, resetInactivityTimer]);

  // Clean up inactivity timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, []);

  // Reset inactivity timer on text input change (user is typing)
  useEffect(() => {
    if (!inputText) return;
    resetInactivityTimer();
  }, [inputText, resetInactivityTimer]);

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
    await writeEncrypted(USERDAT_KEY, JSON.stringify(updated));
  }, [getUserDat]);

  // ── Pre-chat gate: VSP/Self-Direction ALWAYS shown at every chat start ──
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

  // ── Pending close recovery removed ──
  // No longer needed: inactivity + background now run the full endSession chain.
  // No PENDING_CLOSE_KEY markers are written, so nothing to recover.

  // ── Auto-end session when app stays in background for 10 minutes ──
  // Uses timestamp-based check: records when app went to background,
  // then on foreground return checks if 10+ minutes elapsed.
  // setTimeout does NOT work in background on mobile (JS thread is suspended).
  const autoEndTriggeredRef = useRef(false);
  const backgroundStartTimeRef = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      // Going to background: record timestamp
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive') &&
        sessionPhase === 'active' &&
        messages.length > 1 &&
        !autoEndTriggeredRef.current &&
        state.backpack &&
        state.userDat
      ) {
        backgroundStartTimeRef.current = Date.now();
      }
      // Returning to foreground: check elapsed time
      if (
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        const startTime = backgroundStartTimeRef.current;
        backgroundStartTimeRef.current = null;
        // Check if 10+ minutes elapsed while in background
        if (
          startTime &&
          !autoEndTriggeredRef.current &&
          sessionPhase === 'active' &&
          (Date.now() - startTime) >= INACTIVITY_AUTO_CLOSE_MS
        ) {
          autoEndTriggeredRef.current = true;
          console.log('[Chat] Background auto-close triggered (10+ min in background) — running full endSession chain');
          logDebugEvent('session_auto_end', { trigger: 'app_background_10min', messageCount: messages.length, elapsedMs: Date.now() - startTime });

          if (handleEndConversationRef.current) {
            await handleEndConversationRef.current();
          }
          // Reset for fresh session after auto-end
          autoEndTriggeredRef.current = false;
          greetingSent.current = false;
          setPreChatDone(false);
          setSessionPhase('active');
          setMessages([]);
          setShowEmergency(false);
          setShowRestoreToast(true);
          setTimeout(() => setShowRestoreToast(false), 3500);
        }
      }
      appStateRef.current = nextState;
    });
    return () => {
      subscription.remove();
    };
  }, [sessionPhase, messages, state.backpack, state.userDat]);

  // Load previous session messages on mount (collapsed, for continuity)
  // Only the PREVIOUS session is shown — older sessions are archived.
  const [previousSessionMessages, setPreviousSessionMessages] = useState<ChatMessage[]>([]);
  const [showPreviousSession, setShowPreviousSession] = useState(false);
  const [migrationTaps, setMigrationTaps] = useState<number[]>([]);

  const handleMigrationTrigger = async () => {
    try {
      const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
      const udJson = await readEncrypted(USERDAT_KEY);
      if (!udJson) {
        Alert.alert(t('chat.migration.title'), t('chat.migration.no_userdat'));
        return;
      }
      const ud = JSON.parse(udJson);
      const sessionAnalyses = ud.sessionAnalyses || [];
      if (sessionAnalyses.length === 0) {
        Alert.alert(t('chat.migration.title'), t('chat.migration.no_analyses'));
        return;
      }
      const result = await migrateSessionAnalysesToLogsDat(persona, sessionAnalyses);
      if (result.alreadyDone) {
        Alert.alert(t('chat.migration.title'), t('chat.migration.already_done'));
      } else if (result.error) {
        Alert.alert(t('chat.migration.title'), t('chat.migration.failed_retry'));
      } else {
        Alert.alert(t('chat.migration.title'), t('chat.migration.success'));
      }
    } catch (err) {
      console.error('[Migration] Unexpected error:', err);
      Alert.alert(t('chat.migration.title'), t('chat.migration.failed_unexpected'));
    }
  };

  // Load previous session messages from storage.
  // Re-runs when state.userDat changes (e.g. after import restores data).
  const userDatRef = state.userDat;
  useEffect(() => {
    (async () => {
      try {
        const udJson = await readEncrypted(USERDAT_KEY);
        if (udJson) {
          const ud = JSON.parse(udJson);
          const history: ChatMessage[] = ud.chatHistory ?? [];
          if (history.length > 0) {
            const lastSessionDate = ud.lastSessionDate;
            if (lastSessionDate) {
              const prevMsgs = history.filter((m: ChatMessage) => {
                const msgDate = m.timestamp?.slice(0, 10);
                return msgDate && msgDate <= lastSessionDate;
              });
              setPreviousSessionMessages(prevMsgs.slice(-30));
            }
          }
        }
      } catch (e) {
        console.warn('[Chat] Could not load previous session:', e);
      }
    })();
  }, [userDatRef]);

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
          // Fire-and-forget: trigger GPT backpack analysis for changed sections
          // Non-blocking — runs in background, persists results to userDat
          if (state.backpack && state.userDat) {
            triggerBackpackAnalysisIfNeeded(state.backpack, state.userDat)
              .then(async (result) => {
                if (result) {
                  await writeEncrypted(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
                  console.log('[Chat] Backpack schema/mode analysis completed for sections:', result.analyzedSectionIds);
                }
              })
              .catch((err) => console.warn('[Chat] Backpack analysis failed (non-blocking):', err));
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
      const bpJson = await readEncrypted(BACKPACK_KEY);
      const udJson = await readEncrypted(USERDAT_KEY);
      if (bpJson) backpack = JSON.parse(bpJson);
      if (udJson) userDat = JSON.parse(udJson);
    } catch (e) {
      console.error('Failed to read stores from AsyncStorage:', e);
    }
    // Fallback to React state if AsyncStorage read fails
    if (!backpack) backpack = getBackpack();
    if (!userDat) userDat = getUserDat();
    if (!backpack || !userDat) return;
    // Override clinicalModeActive from React state (avoids race condition where
    // storage write hasn't completed yet but React state is already updated)
    const reactUserDat = getUserDat();
    if (reactUserDat?.clinicalModeActive && !userDat.clinicalModeActive) {
      userDat = { ...userDat, clinicalModeActive: true };
    }
    console.log('[Chat] sendGreeting — backpack sections:', backpack.sections?.length, 'filled:', backpack.sections?.filter((s: any) => s.content?.trim().length > 0).length);
    setIsTyping(true);
    try {
      // Load diary entries for session-start context
      let diaryEntries: DiaryEntry[] = [];
      try {
        const diaryJson = await readEncrypted(DIARY_KEY);
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
          // Load last session summary from logs.dat via lifecycle manager
          let lastSessionSummary: SessionInitGreetingInput['lastSessionSummary'] = null;
          let allSessions: SessionInitGreetingInput['allSessions'] = undefined;
          try {
            const lifecycleMgr = getSessionLifecycleManager();
            const stores = lifecycleMgr.getStores();
            const persona = (state.userType === 'elias' ? 'elias' : 'kim') as any;
            const logsDat = await stores.logsDatStore.load(persona);
            if (logsDat && logsDat.sessions.length > 0) {
              const lastSession = logsDat.sessions[logsDat.sessions.length - 1];
              lastSessionSummary = {
                compressedNarrative: lastSession.compressedNarrative ?? '',
                discussedTopics: lastSession.discussedTopics ?? [],
                unresolvedTensions: (lastSession.openEndpoints ?? []).map((ep) => ep.label),
                suggestedFollowUp: (lastSession.openEndpoints ?? []).filter((ep) => ep.category === 'follow_up').map((ep) => ep.label),
                emotionalArc: (lastSession.emotionalThemes ?? []).map((t) => t.label).join(', ') || undefined,
                turnCount: lastSession.moduleTrace?.reduce((sum, m) => sum + m.count, 0) ?? undefined,
              };
              // Pass all sessions for cross-session pattern detection
              allSessions = logsDat.sessions;
              logsDatSessionsRef.current = logsDat.sessions;
            }
            // ── Transfer Diagnostic Point 5: Greeting read from logs.dat ──
            logDebugEvent('transfer_5_greeting_read', {
              success: true,
              logsDatSessionCount: logsDat?.sessions?.length ?? 0,
              hasLastSessionSummary: lastSessionSummary !== null,
              readFrom: `recofree_memory/${(state.userType === 'elias' ? 'elias' : 'kim')}/logs.dat`,
              sessionAnalysesCount: '(separate store: @recofree_userdat — NOT read here)',
            });
          } catch (logsErr) {
            console.warn('[Chat] Could not load logs.dat for greeting context:', logsErr);
            logDebugEvent('transfer_5_greeting_read', {
              success: false,
              error: logsErr instanceof Error ? logsErr.message : String(logsErr),
              logsDatSessionCount: 0,
              readFrom: `recofree_memory/${(state.userType === 'elias' ? 'elias' : 'kim')}/logs.dat`,
              sessionAnalysesCount: '(separate store: @recofree_userdat)',
            });
          }

          // Generate VSP Insight context for clinical annotation
          let vspInsightCtx: string | null = null;
          try {
            const vspLevel = (userDat?.currentMood as any)?.vsp as string | undefined;
            if (vspLevel) {
              const { runVspInsightLayer } = await import('@/src/features/vspInsight/vspInsightPipelineLayer');
              const vspResult = runVspInsightLayer({
                persona: (state.userType === 'elias' ? 'elias' : 'kim') as any,
                userMessage: '',
                recentMessages: [],
                moodSliders: {},
                selfReportedZone: vspLevel as any,
                sessionTurnCount: 0,
                safetyCore: {
                  finalZone: vspLevel as any,
                  userReportedZone: vspLevel as any,
                  safetyOverrideActive: false,
                  crisisDetected: false,
                  relapseIntentDetected: false,
                  modelRoutingDecision: 'gpt-4o',
                  activeSafetyModuleId: null,
                },
                profile: null,
              });
              if (vspResult.active) {
                vspInsightCtx = vspResult.contextString;
              }
            }
          } catch (vspErr) {
            console.warn('[Chat] VSP Insight for greeting failed:', vspErr);
          }

          // Load previous session messages for greeting context (last 5)
          let prevMsgsForGreeting: Array<{ role: string; content: string; timestamp?: string }> = [];
          try {
            const udJsonForPrev = await readEncrypted(USERDAT_KEY);
            if (udJsonForPrev) {
              const udPrev = JSON.parse(udJsonForPrev);
              const history: ChatMessage[] = udPrev.chatHistory ?? [];
              const lastSessionDate = udPrev.lastSessionDate;
              if (history.length > 0 && lastSessionDate) {
                const prevMsgs = history.filter((m: ChatMessage) => {
                  const msgDate = m.timestamp?.slice(0, 10);
                  return msgDate && msgDate <= lastSessionDate;
                });
                prevMsgsForGreeting = prevMsgs.slice(-5).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
              }
            }
          } catch (prevErr) {
            console.warn('[Chat] Could not load previous msgs for greeting:', prevErr);
          }

          const greetingResult = await sessionInitGreetingStep({
            backpack,
            userDat,
            diaryEntries,
            apiBaseUrl: apiUrl,
            timezone: 'Europe/Amsterdam',
            clinicalModeActive: userDat?.clinicalModeActive ?? false,
            lastSessionSummary,
            allSessions,
            vspInsightContext: vspInsightCtx,
            previousSessionMessages: prevMsgsForGreeting,
            locale: locale as 'nl' | 'en' | 'fr',
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
          clinicalInfo: {
            module: 'SESSION_GREETING_V3',
            zone: 'SESSION_START',
            model: 'gpt-4o-mini',
            source: 'greeting-engine',
          },
        };
        // Append to chatHistory and persist
        userDat.chatHistory = [...(userDat.chatHistory || []), greetingMsg];
        userDat.totalSessions = (userDat.totalSessions ?? 0) + 1;
        userDat.lastSessionDate = new Date().toISOString().slice(0, 10);
        await writeEncrypted(USERDAT_KEY, JSON.stringify(userDat));
        setMessages([greetingMsg]);
        logDebugEvent('session_start', {
          userType: state.userType ?? 'unknown',
          sessionNumber: userDat.totalSessions,
          greetingEngine: true,
        });
      } else {
        // Fallback: use existing pipeline greeting
        const result = await generateGreeting(backpack, provider, userDat, diaryEntries, { locale: locale as 'nl' | 'en' | 'fr', country: (country || 'BE') as 'NL' | 'BE' | 'FR' | 'UK' | 'US' });
        // Only persist userDat (backpack is NEVER modified by the system)
        await writeEncrypted(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
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

      // ── Initialize Memory Lifecycle Buffer ──────────────────────────
      // This MUST happen after greeting so that lifecycleManager.endSession()
      // can write to logs.dat. Without this, endSession returns "no active buffer".
      try {
        const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
        const apiBase = getApiBaseUrl();
        const lifecycleManager = getSessionLifecycleManager();
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const localUserId = backpack.naam ?? 'anonymous';
        await lifecycleManager.startSession(persona, sessionId, localUserId, apiBase);
        console.log(`[Chat] Memory lifecycle buffer initialized: ${sessionId}`);
      } catch (lifecycleErr) {
        // Non-critical: session works without lifecycle buffer, but logs.dat won't be written
        console.warn('[Chat] Memory lifecycle startSession failed (non-critical):', lifecycleErr);
      }

      // Reset inactivity end flag for new session
      inactivityEndTriggeredRef.current = false;
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

    // Reset inactivity timer on user send
    resetInactivityTimer();

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
      const preprocessed = await preprocessInput(rawText, locale as 'nl' | 'en' | 'fr');
      const processedText = preprocessed.processedText;
      // Load latest userDat from storage (may have been updated by greeting)
      const userDatJson = await readEncrypted(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      // Read backpack from AsyncStorage to ensure latest version (avoids stale closure)
      let backpack: Backpack = state.backpack!;
      try {
        const bpJson = await readEncrypted(BACKPACK_KEY);
        if (bpJson) backpack = JSON.parse(bpJson);
      } catch (e) {
        console.warn('Could not read backpack from AsyncStorage, using state:', e);
      }
      const provider = getAIProvider();
      // FOLLOW-UP MESSAGE: isSessionStart = false, no diary entries
      const result = await processMessage(backpack, processedText, provider, currentUserDat, { isSessionStart: false, diaryEntries: [], logsSessions: logsDatSessionsRef.current, locale: locale as 'nl' | 'en' | 'fr', country: (country || 'BE') as 'NL' | 'BE' | 'FR' | 'UK' | 'US' });
      // DEFENSIVE GUARD: if processMessage returns null/undefined (should never happen,
      // but observed 'undefined is not a function' crash on device — root cause unconfirmed,
      // likely Metro bundler module resolution issue or stale closure. This guardrail
      // prevents a hard crash and shows a recoverable error message instead.)
      if (!result || typeof result.response !== 'string') {
        throw new Error(`processMessage returned invalid result: ${JSON.stringify(result?.response ?? 'undefined')}`);
      }
      // Only persist userDat (backpack is NEVER modified)
      await writeEncrypted(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
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
          psychoEducationActivation: result.psychoEducationActivation ?? null,
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
          const turnId = bundle.context.turnId;
          stores.sessionBufferStore.appendMessage(buffer, {
            turnId,
            role: 'user',
            text: processedText,
            timestampIso: new Date().toISOString(),
          });
          const updatedBuffer = stores.sessionBufferStore.getBuffer();
          if (updatedBuffer) {
            stores.sessionBufferStore.appendMessage(updatedBuffer, {
              turnId,
              role: 'assistant',
              text: (result.response ?? '').slice(0, 200),
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
        // ── INCREMENTAL LOGS.DAT WRITE (after every turn) ──────────────
        // Write raw session messages to logs.dat IMMEDIATELY so data is never
        // lost even if endSession() never runs (app killed, crash, etc.).
        // This is the "0-3 maanden" strategy: raw berichten, geen GPT nodig.
        try {
          const currentBuffer = stores.sessionBufferStore.getBuffer();
          if (currentBuffer && currentBuffer.compactMessages.length > 0) {
            const rawMsgs = currentBuffer.compactMessages
              .filter(m => m.role === 'user')
              .slice(-10)
              .map(m => m.text.slice(0, 300));
            const rawNarrative = rawMsgs.length > 0
              ? `Sessie-inhoud (${currentBuffer.compactMessages.length} berichten): ${rawMsgs.join(' | ')}`
              : `Sessie met ${currentBuffer.compactMessages.length} berichten`;
            const incrementalSummary: any = {
              summaryId: `incremental_${currentBuffer.sessionId}`,
              sessionId: currentBuffer.sessionId,
              persona,
              startedAt: currentBuffer.startedAt,
              endedAt: new Date().toISOString(),
              createdAt: currentBuffer.startedAt,
              summaryModel: 'gpt-4o-mini',
              summarySchemaVersion: 'session_summary.v1',
              compressedNarrative: rawNarrative.slice(0, 1500),
              discussedTopics: [],
              emotionalThemes: [],
              breakthroughs: [],
              relapseOrRiskEvents: [{eventType: 'none', description: '', severity: 0}],
              openEndpoints: [],
              extractedCandidates: { fears: [], hopes: [], triggers: [], schemaTendencies: [], modeTendencies: [] },
              moduleTrace: [],
              zoneTrace: [],
              inputTokenEstimate: 0,
              outputTokenEstimate: 0,
            };
            await stores.logsDatStore.upsertCurrentSession(persona, incrementalSummary as any);
          }
        } catch (incrErr) {
          // Non-critical: if incremental write fails, endSession will still try
          console.warn('[IncrementalLogsDat] Write failed (non-critical):', incrErr);
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
      // ── CRASH REPORTER: Full stack trace on screen ──
      const err = error as Error;
      const stack = err?.stack ?? 'No stack trace available';
      // Extract the most useful info: first 5 stack frames
      const stackLines = stack.split('\n').slice(0, 8).join('\n');
      const crashReport = [
        `⚠️ PIPELINE CRASH REPORT`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Error: ${err?.message ?? 'Unknown'}`,
        `Type: ${err?.name ?? 'Unknown'}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Stack trace:`,
        stackLines,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Timestamp: ${new Date().toISOString()}`,
        `Session phase: ${sessionPhase}`,
        `Has backpack: ${!!state.backpack}`,
        `Has userDat: ${!!state.userDat}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📸 SCREENSHOT DIT BERICHT`,
        `en stuur het naar de developer.`,
      ].join('\n');
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: crashReport,
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
      content: `Ik ga alles wat je gedeeld hebt analyseren. Blijf nog even — ik laat je weten wanneer je veilig kunt afsluiten.`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, analyzingMsg]);
    try {
      const userDatJson = await readEncrypted(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      const backpack = state.backpack!;
      const provider = getAIProvider();
      // Attach diary entries for gratitude streak calculation
      let diaryForSession: DiaryEntry[] = [];
      try {
        const diaryJson = await readEncrypted(DIARY_KEY);
        if (diaryJson) diaryForSession = JSON.parse(diaryJson);
      } catch (_e) { /* ignore */ }
      const userDatWithDiary = { ...currentUserDat, _sessionDiaryEntries: diaryForSession } as any;
      const result = await endSession(backpack, provider, userDatWithDiary);
      // Only persist userDat (backpack is NEVER modified)
      await writeEncrypted(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      await endSessionWithUserDat(result.updatedUserDat);
      const confirmationMsg: ChatMessage = {
        id: `msg_confirm_${Date.now()}`,
        role: 'assistant',
        content: result.farewell + '\n\nAlles is opgeslagen. Je sessie is veilig bewaard. Je kunt de app nu sluiten of teruggaan naar het startscherm.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmationMsg]);
      setSessionPhase('completed');
      // Debug: log session end
      logDebugEvent('session_end', {
        messageCount: result.updatedUserDat.chatHistory.length,
        durationMs: 0, // not tracked currently
      });
      // ── Transfer Diagnostic Point 1: Session-end detected ──
      logDebugEvent('transfer_1_session_end_detected', {
        trigger: 'manual',
        messageCount: result.updatedUserDat.chatHistory.length,
        sessionAnalysesCountBefore: (result.updatedUserDat.sessionAnalyses || []).length,
        writtenTo: '@recofree_userdat → sessionAnalyses[]',
      });
      // ── Memory Lifecycle: End Session ──────────────────────────────────
      // Generates session summary via GPT-4o-mini and appends to logs.dat (encrypted)
      try {
        const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
        const apiBase = getApiBaseUrl();
        const lifecycleManager = getSessionLifecycleManager();
        // ── Transfer Diagnostic Point 2: Buffer status before endSession ──
        const bufferBeforeEnd = lifecycleManager.getStores().sessionBufferStore.getBuffer();
        logDebugEvent('transfer_2_buffer_status', {
          bufferExists: bufferBeforeEnd !== null,
          bufferMessageCount: bufferBeforeEnd?.compactMessages?.length ?? 0,
          bufferSessionId: bufferBeforeEnd?.sessionId ?? 'none',
        });
        // Pass current messages as fallback in case buffer was never initialized
        const chatHistoryForFallback = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
        // Pass PAD A legacy data so unified writer can enrich fallback
        const legacySessionData = result.sessionSummary ? {
          themes: result.sessionSummary.themes,
          dominantEmotion: result.sessionSummary.dominantEmotion,
          modulesUsed: result.sessionSummary.modulesUsed,
          messageCount: result.sessionSummary.messageCount,
          durationMinutes: result.sessionSummary.durationMinutes,
        } : undefined;
        const endResult = await lifecycleManager.endSession(persona, apiBase, chatHistoryForFallback, legacySessionData);
        // ── Transfer Diagnostic Point 4: Lifecycle result ──
        // (no __DEV__ guard — works on device APK)
        console.log(`[SessionLifecycle] endSession result: summarized=${endResult.summarized}, sessionId=${endResult.sessionId}`);
        logDebugEvent('memory_session_end', {
          sessionId: endResult.sessionId,
          summarized: endResult.summarized,
          error: endResult.error ?? null,
        });
        logDebugEvent('transfer_4_lifecycle_result', {
          sessionId: endResult.sessionId,
          summarized: endResult.summarized,
          error: endResult.error ?? null,
          writtenTo: `recofree_memory/${persona}/logs.dat`,
        });
      } catch (lifecycleErr) {
        // Non-critical: session ends even if memory lifecycle fails
        console.warn('[SessionLifecycle] endSession error (non-critical):', lifecycleErr);
        logDebugEvent('transfer_4_lifecycle_result', {
          sessionId: 'unknown',
          summarized: false,
          error: lifecycleErr instanceof Error ? lifecycleErr.message : String(lifecycleErr),
          writtenTo: 'FAILED',
        });
      }
    } catch (error) {
      console.error('End session error:', error);
      const fallbackMsg: ChatMessage = {
        id: `msg_fallback_${Date.now()}`,
        role: 'assistant',
        content: `${userName}, je sessie is opgeslagen. Er ging iets mis tijdens de analyse, maar je gesprek is veilig bewaard. Je kunt de app nu sluiten.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setSessionPhase('completed');
    }
  }, [state.backpack, state.userDat, sessionPhase, userName, endSessionWithUserDat]);

  // Keep ref in sync so inactivity/background timers can call the same function
  handleEndConversationRef.current = handleEndConversation;

  const handleBackToHome = useCallback(() => {
    // Reset session state so next Chat tab focus triggers a fresh greeting
    greetingSent.current = false;
    setPreChatDone(false);
    setSessionPhase('active');
    setMessages([]);
    setShowEmergency(false);
    router.replace('/(tabs)');
  }, [router]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isElias = state.userType === 'elias';
    // Parse clinical tag from assistant messages (GPT-generated, may be absent)
    const { visibleContent, clinicalAnnotation } = parseClinicalTag(item.content, isUser);
    // Build clinical display: prefer GPT annotation (rich), fallback to local engine metadata
    const showClinical = !isUser && state.userDat?.clinicalModeActive;
    const localInfo = item.clinicalInfo
      ? `\n---\nModule: ${item.clinicalInfo.module} | Zone: ${item.clinicalInfo.zone} | Model: ${item.clinicalInfo.model}${item.clinicalInfo.regulation ? ` | Reg: ${item.clinicalInfo.regulation}` : ''}${item.clinicalInfo.riskScore != null ? ` | Risk: ${item.clinicalInfo.riskScore}` : ''}${item.clinicalInfo.source ? `\nSource: ${item.clinicalInfo.source}` : ''}${item.clinicalInfo.triggers ? `\nTriggers: ${item.clinicalInfo.triggers}` : ''}${item.clinicalInfo.projection ? `\nProjection: ${item.clinicalInfo.projection}` : ''}${item.clinicalInfo.intervention ? `\nIntervention: ${item.clinicalInfo.intervention}` : ''}${item.clinicalInfo.buffer ? `\nBuffer: ${item.clinicalInfo.buffer}` : ''}`
      : '';
    const clinicalDisplay = clinicalAnnotation
      ? clinicalAnnotation + localInfo
      : localInfo || null;

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
          {showClinical && clinicalDisplay && (
            <ClinicalTag annotation={clinicalDisplay} />
          )}
        </View>
        <Text style={{ ...typography.micro, color: dc.textMuted, marginTop: 4, textAlign: isUser ? 'right' : 'left', marginHorizontal: 4 }}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  }, [companionName, state.userType, state.userDat?.clinicalModeActive]);

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

  // Bottom padding (no tab bar anymore)
  const bottomPadding = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 8);

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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => router.push('/(tabs)/' as Href)}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginRight: 14 }]}
            >
              <Text style={{ fontSize: 20, color: dc.textInverse, fontWeight: '600' }}>{t('chat.header.back')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const now = Date.now();
                const newTaps = migrationTaps.filter(t => now - t < 3000);
                newTaps.push(now);
                setMigrationTaps(newTaps);
                if (newTaps.length >= 5) {
                  setMigrationTaps([]);
                  handleMigrationTrigger();
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={{ ...typography.titleSmall, color: dc.textInverse }}>
                {companionName}
              </Text>
              <Text style={{ ...typography.micro, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {isTyping ? t('chat.header.typing') : t('chat.header.online')}
              </Text>
            </Pressable>
          </View>
          {/* End Session button — forces full protocol */}
          {sessionPhase === 'active' && messages.length > 1 && (
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                handleEndConversation();
              }}
              style={({ pressed }) => [{
                opacity: pressed ? 0.6 : 1,
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)',
              }]}
            >
              <Text style={{ fontSize: 13, color: dc.textInverse, fontWeight: '600' }}>{t('chat.header.end_button')}</Text>
            </Pressable>
          )}
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
          extraData={state.userDat?.clinicalModeActive}
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
                      {showPreviousSession ? t('chat.history.hide') : t('chat.history.show', { count: previousSessionMessages.length })}
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
                        <Text style={{ fontSize: 11, color: colors.muted }}>{t('chat.history.end_marker')}</Text>
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
                <Text style={{ color: colors.muted, fontSize: 16 }}>{t('chat.empty.starting')}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {showEmergency && (
                <EmergencyCard
                  visible={showEmergency}
                  onDismiss={() => setShowEmergency(false)}
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
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 22 }}>{t('chat.scroll_to_bottom')}</Text>
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
              paddingBottom: Platform.OS === 'android' && keyboardVisible ? 8 : bottomPadding + 8,
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
                placeholder={t('chat.input.placeholder')}
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

        {/* Fixed crisis disclaimer at bottom — dynamic per country */}
        <CrisisFooter language={language} country={country} insetBottom={insets.bottom} />
      </View>

      {/* First-chat disclaimer modal — not skipable */}
      <Modal visible={!firstChatSeen} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, maxHeight: '80%' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: colors.foreground }}>
              {t('chat.modal.title')}
            </Text>
            <RNScrollView style={{ maxHeight: 300 }}>
              <Text style={{ color: colors.foreground, lineHeight: 22 }}>
                {t('chat.modal.body', { companionName })}
              </Text>
            </RNScrollView>
            <TouchableOpacity
              onPress={dismissFirstChatDisclaimer}
              style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                {t('chat.modal.button')}
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
      keyboardVerticalOffset={isIOS ? 0 : -bottomPadding}
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
  const { t } = useTranslation();

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
          {expanded ? t('chat.clinical.expanded') : t('chat.clinical.collapsed')}{isFallback ? t('chat.clinical.fallback_warning') : ''}{vspFramework ? ` · VSP: ${vspFramework}` : ''}
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 6, backgroundColor: colors.background, borderRadius: 8, padding: 10 }}>
          {vspFramework && (
            <View style={{ marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text selectable style={{ fontSize: 11, fontWeight: '700', color: '#1565C0' }}>
                VSP-Framework: <Text style={{ fontWeight: '600', color: vspFramework === 'DGT' ? '#E65100' : vspFramework === 'MBT' ? '#6A1B9A' : '#2E7D32' }}>{vspFramework}</Text>
              </Text>
            </View>
          )}
          <Text selectable style={{ fontSize: 12, color: colors.muted, lineHeight: 17, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {otherLines}
          </Text>
          {signalsValue && signalsValue !== 'none' && (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text selectable style={{ fontSize: 11, fontWeight: '700', color: '#E65100' }}>
                Signals: <Text style={{ fontWeight: '400', color: colors.foreground }}>{signalsValue}</Text>
              </Text>
            </View>
          )}
          {signalsValue === 'none' && (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text selectable style={{ fontSize: 11, color: colors.muted, fontStyle: 'italic' }}>
                Signals: none
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Dynamic crisis footer — shows country-specific numbers */
function CrisisFooter({ language, country, insetBottom }: { language: string; country: string | null; insetBottom: number }) {
  const effectiveCountry = (country || 'BE') as import('@/lib/i18n/i18n-provider').SupportedCountry;
  const effectiveLang = language === 'nl' ? 'nl' as const : language === 'fr' ? 'fr' as const : 'en' as const;
  const suicideLine = getPrimarySuicideLine(effectiveCountry, effectiveLang);
  const emergencyNum = getEmergencyNumber(effectiveCountry);

  const disclaimer = effectiveLang === 'nl'
    ? 'RecoFree is geen vervanging voor professionele hulp.'
    : effectiveLang === 'fr'
      ? "RecoFree ne remplace pas l'aide professionnelle."
      : 'RecoFree is not a substitute for professional help.';

  const emergencyLabel = effectiveLang === 'nl'
    ? 'Noodgevallen'
    : effectiveLang === 'fr'
      ? 'Urgences'
      : 'Emergency';

  return (
    <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', paddingTop: 6, paddingBottom: insetBottom + 12, paddingHorizontal: 16 }}>
      {disclaimer}{' '}
      <Text
        style={{ color: '#E53935', fontWeight: 'bold', textDecorationLine: 'underline' }}
        onPress={() => Linking.openURL(`tel:${suicideLine.number.replace(/[^0-9+]/g, '')}`)}
      >
        {suicideLine.name}: {suicideLine.number}
      </Text>
      {' '}(24/7, {effectiveLang === 'nl' ? 'gratis, anoniem' : effectiveLang === 'fr' ? 'gratuit, anonyme' : 'free, anonymous'}) |{' '}
      <Text
        style={{ color: '#E53935', fontWeight: 'bold', textDecorationLine: 'underline' }}
        onPress={() => Linking.openURL(`tel:${emergencyNum}`)}
      >
        {emergencyLabel}: {emergencyNum}
      </Text>
    </Text>
  );
}
