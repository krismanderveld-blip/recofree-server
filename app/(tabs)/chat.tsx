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
import { SessionMemoryCache } from '@/lib/crypto/session-memory-cache';
import { useRouter, useFocusEffect, useNavigation, type Href } from 'expo-router';
import { useUser } from '@/lib/user-context';
import { fixUnicode } from '@/lib/utils';
import { getAIProvider } from '@/lib/ai';
import { preprocessInput } from '@/lib/ai/preprocessor';
import { processMessage, generateGreeting, endSession, resetSessionState } from '@/lib/rugzak/pipeline';
import { clearSessionInitCache } from '@/lib/ai/openai-provider';
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
// DISABLED: Signal engine removed (4 redundant API calls per message)
// import { initGptSignalEngine } from '@/lib/engine/local-llm/engine-provider';
import { getApiBaseUrl } from '@/constants/oauth';
import { getSessionLifecycleManager, buildDetectionBundle, runMemoryWriteBack, type PipelineResultForMemory } from '@/lib/pipeline/memory/memoryIntegration';
import { greetingV4, type GreetingV4Input } from '@/lib/features/greetingV4/greetingV4';
import type { MemoryStoresSnapshot } from '@/lib/pipeline/memory/memoryCommitService';
import { createEmptyUserDat } from '@/lib/types/memory/userDat.types';
import { createEmptyStateDat } from '@/lib/types/memory/stateDat.types';
import { createEmptyProjectionsDat } from '@/lib/types/memory/projectionsDat.types';
import { migrateSessionAnalysesToLogsDat } from '@/lib/pipeline/memory/migrateSessionAnalysesToLogsDat';
import { ChatErrorBoundary } from '@/components/chat-error-boundary';
import { colors as dc, spacing, radius, typography, shadows } from '@/constants/design';
import { triggerBackpackAnalysisIfNeeded } from '@/lib/backpack-analysis/schema-mode-trigger';
import { hasBackpackChangedSinceExtraction, forceExtract } from '@/lib/backpack-extractor/extractor';
import { callExtractionEndpoint } from '@/lib/backpack-extractor/client';
import { useTranslation } from '@/lib/i18n';
import { LocalDeviceTimeService } from "@/lib/core/time";
import { getTodayBlocks } from '@/lib/features/dayStructure';
import { extractBalkmetafoorItemsFromResponse } from '@/lib/features/balkmetafoor/balkmetafoorChatFeed';
import { DistillationProposalCard } from '@/components/distillation/ProposalCard';
import { createProposalStore } from '@/lib/engine/shared/dist01-proposal-store';
import type { DistillationProposal, ProposalUserAction } from '@/lib/engine/shared/dist01-proposal-types';
import { writeProposalToDocument, processAutoSave, updateSignalPromotionStatus } from '@/lib/engine/shared/dist01-proposal-writer';
import { createDistillationStore } from '@/lib/engine/shared/dist01-store';
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
  const [pendingProposals, setPendingProposals] = useState<DistillationProposal[]>([]);
  const [autoSaveToast, setAutoSaveToast] = useState<{ count: number; texts: string[]; targetDocument: string } | null>(null);

  const userName = getUserName();
  const { t, locale, language, country } = useTranslation();
  const companionName = state.userType === 'elias' ? 'Elias' : 'Kim';

  // ── Initialize GptSignalEngine once at mount ──────────────────────────
  useEffect(() => {
    // DISABLED: GptSignalEngine was making 4 extra OpenAI API calls per message
    // (detectSignals, scoreRelevance, summarizeContext, detectRelapseIntent).
    // The deterministic engine + nano interpret handle all this locally.
    // Relapse detection uses the deterministic fallback (NL/EN/FR markers).
    // const url = getApiBaseUrl();
    // if (url) initGptSignalEngine(url);
    // Register diary key with session memory cache (backpack/userdat registered in user-context)
    SessionMemoryCache.registerKeys([DIARY_KEY]);
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

  // ── V3 Greeting Session-Init tracking ───────────────────────────────
  // When V3 greeting engine is used, generateGreeting() is skipped, so the server
  // sessionCache is never populated. The first follow-up message MUST be sent as
  // isSessionStart=true to initialize the server cache with correct persona data.
  const v3GreetingUsedRef = useRef(false);

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
    // Start timer even with just the greeting message (messages.length >= 1)
    // This ensures greeting-only sessions still get auto-closed after inactivity
    if (messages.length < 1) return;

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
    if (sessionPhase === 'active' && messages.length > 0) {
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
    await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(updated));
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
        backgroundStartTimeRef.current = LocalDeviceTimeService.now().epochMs;
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
          (LocalDeviceTimeService.now().epochMs - startTime) >= INACTIVITY_AUTO_CLOSE_MS
        ) {
          autoEndTriggeredRef.current = true;
          console.log('[Chat] Background auto-close triggered (10+ min in background) — running full endSession chain');
          logDebugEvent('session_auto_end', { trigger: 'app_background_10min', messageCount: messages.length, elapsedMs: LocalDeviceTimeService.now().epochMs - startTime });

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
      const udJson = await SessionMemoryCache.get(USERDAT_KEY);
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
        const udJson = await SessionMemoryCache.get(USERDAT_KEY);
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
          // Unlock memory cache: decrypt all registered keys into memory for this session
          await SessionMemoryCache.unlock();
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
                  await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
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
      const bpJson = await SessionMemoryCache.get(BACKPACK_KEY);
      const udJson = await SessionMemoryCache.get(USERDAT_KEY);
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
    // ── SESSION-START EXTRACTION GUARANTEE ──────────────────────────────────
    // If backpack has manual changes that haven't been extracted yet, or if
    // extractedEntities is empty, run extraction SYNCHRONOUSLY before greeting.
    // This ensures user.dat is always fed before the greeting is built.
    // Auto-fill changes (vice-versa from user.dat) are skipped — user.dat is already the source.
    try {
      const entitiesEmpty = !userDat.extractedEntities || userDat.extractedEntities.persons.length === 0;
      const backpackHasContent = backpack.sections.some((s: any) => s.content?.trim().length > 10);
      if (backpackHasContent && entitiesEmpty) {
        // BLOCKING only when entities are truly empty (first time) — greeting needs this data
        console.log('[Chat] Session-start: extractedEntities empty but backpack has content → forcing extraction (blocking)');
        const entities = await forceExtract(backpack, callExtractionEndpoint);
        if (entities) {
          userDat = { ...userDat, extractedEntities: entities };
          await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(userDat));
          console.log('[Chat] Session-start: extraction complete, user.dat fed with', entities.persons.length, 'persons');
        }
      } else if (backpackHasContent) {
        // NON-BLOCKING: entities exist, check for changes in background (don't delay greeting)
        hasBackpackChangedSinceExtraction(backpack).then(async (hasChanged) => {
          if (hasChanged) {
            console.log('[Chat] Session-start: backpack changed since last extraction → background re-extraction');
            const entities = await forceExtract(backpack, callExtractionEndpoint);
            if (entities) {
              const udJson = await SessionMemoryCache.get(USERDAT_KEY);
              if (udJson) {
                const ud = JSON.parse(udJson);
                ud.extractedEntities = entities;
                await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(ud));
                console.log('[Chat] Background re-extraction complete:', entities.persons.length, 'persons');
              }
            }
          }
        }).catch((err) => console.warn('[Chat] Background extraction check failed:', err));
      }
    } catch (extractErr) {
      // Non-blocking: if extraction fails, continue with whatever entities exist
      console.warn('[Chat] Session-start extraction check failed (non-blocking):', extractErr);
    }

    console.log('[Chat] sendGreeting — backpack sections:', backpack.sections?.length, 'filled:', backpack.sections?.filter((s: any) => s.content?.trim().length > 0).length);
    setIsTyping(true);
    try {
      // Load diary entries for session-start context
      let diaryEntries: DiaryEntry[] = [];
      try {
        const diaryJson = await SessionMemoryCache.get(DIARY_KEY);
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
        const now = LocalDeviceTimeService.now().epochMs;
        const daysSinceLastSession = (now - lastDate) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSession >= 3) {
          triggerModule93 = true;
        }
      }
      if (triggerModule93) {
        console.log('[Chat] Module 93 triggered: user returned after 3+ days of inactivity');
      }

      const provider = getAIProvider();

      // ── Greeting V4: parametric greeting via Railway proxy ──
      let greetingText: string | null = null;
      try {
        const apiUrl = getApiBaseUrl();
        if (apiUrl) {
          // Load logs.dat sessions for logsDatSessionsRef (used by per-message pipeline)
          try {
            const lifecycleMgr = getSessionLifecycleManager();
            const stores = lifecycleMgr.getStores();
            const persona = (state.userType === 'elias' ? 'elias' : 'kim') as any;
            const logsDat = await stores.logsDatStore.load(persona);
            if (logsDat && logsDat.sessions.length > 0) {
              logsDatSessionsRef.current = logsDat.sessions;
            }
            logDebugEvent('transfer_5_greeting_read', {
              success: true,
              logsDatSessionCount: logsDat?.sessions?.length ?? 0,
              hasLastSessionSummary: logsDat?.sessions?.length > 0,
              readFrom: `recofree_memory/${persona}/logs.dat`,
              sessionAnalysesCount: '(separate store)',
            });
          } catch (logsErr) {
            console.warn('[Chat] Could not load logs.dat for greeting context:', logsErr);
            logDebugEvent('transfer_5_greeting_read', {
              success: false,
              error: logsErr instanceof Error ? logsErr.message : String(logsErr),
              logsDatSessionCount: 0,
              readFrom: `recofree_memory/${state.userType === 'elias' ? 'elias' : 'kim'}/logs.dat`,
              sessionAnalysesCount: '(separate store)',
            });
          }

          // Load previous session messages (last 10) for V4 inline summary
          let prevMsgsForGreeting: Array<{ role: string; content: string; timestamp?: string }> = [];
          try {
            const udJsonForPrev = await SessionMemoryCache.get(USERDAT_KEY);
            if (udJsonForPrev) {
              const udPrev = JSON.parse(udJsonForPrev);
              const history: ChatMessage[] = udPrev.chatHistory ?? [];
              const lastSessionDate = udPrev.lastSessionDate;
              if (history.length > 0 && lastSessionDate) {
                const prevMsgs = history.filter((m: ChatMessage) => {
                  const msgDate = m.timestamp?.slice(0, 10);
                  return msgDate && msgDate <= lastSessionDate;
                });
                prevMsgsForGreeting = prevMsgs.slice(-10).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
              }
            }
          } catch (prevErr) {
            console.warn('[Chat] Could not load previous msgs for greeting:', prevErr);
          }

          // Load today's day structure for greeting context
          let todayDayStructureCtx: string | null = null;
          try {
            const todayBlocks = await getTodayBlocks();
            if (todayBlocks.length > 0) {
              todayDayStructureCtx = todayBlocks.map(b => {
                if (b.kind === 'wake') return `Opstaan: ${b.startTime}`;
                if (b.kind === 'sleep') return `Slapen: ${b.startTime}`;
                return `${b.label}: ${b.startTime} \u2013 ${b.endTime}`;
              }).join(', ');
            }
          } catch { /* non-fatal */ }

          // Call Greeting V4
          const greetingResult = await greetingV4({
            backpack,
            userDat,
            diaryEntries,
            apiBaseUrl: apiUrl,
            locale: locale as 'nl' | 'en' | 'fr',
            previousSessionMessages: prevMsgsForGreeting,
            todayDayStructure: todayDayStructureCtx,
            clinicalModeActive: userDat?.clinicalModeActive ?? false,
          });
          greetingText = greetingResult.greeting;
          console.log(greetingResult.debugLog);
        }
      } catch (greetingErr) {
        console.warn('[Chat] Greeting V4 failed, falling back to pipeline greeting:', greetingErr);
      }

      // If greeting engine produced a result, use it directly
      if (greetingText) {
        // V3 greeting bypasses generateGreeting() which normally calls resetSessionState().
        // We must reset pipeline state manually AND mark that the first follow-up message
        // needs to be sent as SESSION_INIT to populate the server's sessionCache.
        resetSessionState();
        clearSessionInitCache();
        v3GreetingUsedRef.current = true;
        console.log('[Chat] V4 greeting used — pipeline state reset, first follow-up will be SESSION_INIT');

        const greetingMsg: ChatMessage = {
          id: `msg_greeting_${LocalDeviceTimeService.now().epochMs}`,
          role: 'assistant',
          content: greetingText,
          timestamp: LocalDeviceTimeService.now().utcIso,
          clinicalInfo: {
            module: 'SESSION_GREETING_V4',
            zone: 'SESSION_START',
            model: 'gpt-4o-mini',
            source: 'greeting-v4',
          },
        };
        // Append to chatHistory and persist
        userDat.chatHistory = [...(userDat.chatHistory || []), greetingMsg];
        userDat.totalSessions = (userDat.totalSessions ?? 0) + 1;
        userDat.lastSessionDate = LocalDeviceTimeService.now().utcIso.slice(0, 10);
        await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(userDat));
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
        await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
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
        const sessionId = `session_${LocalDeviceTimeService.now().epochMs}_${Math.random().toString(36).slice(2, 8)}`;
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
        id: `msg_err_${LocalDeviceTimeService.now().epochMs}`,
        role: 'assistant',
        content: `[DEBUG] Greeting failed: ${(error as Error)?.message ?? 'Unknown error'}`,
        timestamp: LocalDeviceTimeService.now().utcIso,
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
      id: `msg_${LocalDeviceTimeService.now().epochMs}`,
      role: 'user',
      content: rawText,
      timestamp: LocalDeviceTimeService.now().utcIso,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);

    try {
      const preprocessed = await preprocessInput(rawText, locale as 'nl' | 'en' | 'fr');
      const processedText = preprocessed.processedText;
      // Load latest userDat from storage (may have been updated by greeting)
      const userDatJson = await SessionMemoryCache.get(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      // Read backpack from AsyncStorage to ensure latest version (avoids stale closure)
      let backpack: Backpack = state.backpack!;
      try {
        const bpJson = await SessionMemoryCache.get(BACKPACK_KEY);
        if (bpJson) backpack = JSON.parse(bpJson);
      } catch (e) {
        console.warn('Could not read backpack from AsyncStorage, using state:', e);
      }
      const provider = getAIProvider();
      // If V3 greeting was used, the first follow-up MUST be sent as SESSION_INIT
      // to populate the server's sessionCache with the correct persona/userType data.
      // Without this, the server uses stale cache from a previous session (potentially
      // a different persona, causing Kim↔Elias cross-contamination).
      const forceSessionInit = v3GreetingUsedRef.current;
      if (forceSessionInit) {
        v3GreetingUsedRef.current = false;
        console.log('[Chat] First message after V3 greeting — sending as SESSION_INIT to populate server cache');
      }
      // Build day structure context for AI awareness
      let dayStructureCtx: string | null = null;
      try {
        const todayBlocks = await getTodayBlocks();
        if (todayBlocks.length > 0) {
          dayStructureCtx = todayBlocks.map(b => {
            if (b.kind === 'wake') return `- Opstaan: ${b.startTime}`;
            if (b.kind === 'sleep') return `- Slapen: ${b.startTime}`;
            return `- ${b.label}: ${b.startTime} \u2013 ${b.endTime}`;
          }).join('\n');
        }
      } catch { /* non-fatal */ }
      const result = await processMessage(backpack, processedText, provider, currentUserDat, { isSessionStart: forceSessionInit, diaryEntries: forceSessionInit ? (await (async () => { try { const dj = await SessionMemoryCache.get(DIARY_KEY); return dj ? JSON.parse(dj) : []; } catch { return []; } })()) : [], logsSessions: logsDatSessionsRef.current, locale: locale as 'nl' | 'en' | 'fr', country: (country || 'BE') as 'NL' | 'BE' | 'FR' | 'UK' | 'US', dayStructureContext: dayStructureCtx });
      // DEFENSIVE GUARD: if processMessage returns null/undefined (should never happen,
      // but observed 'undefined is not a function' crash on device — root cause unconfirmed,
      // likely Metro bundler module resolution issue or stale closure. This guardrail
      // prevents a hard crash and shows a recoverable error message instead.)
      if (!result || typeof result.response !== 'string') {
        throw new Error(`processMessage returned invalid result: ${JSON.stringify(result?.response ?? 'undefined')}`);
      }
      // Only persist userDat (backpack is NEVER modified)
      await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      if (result.crisisLevel > 0) setCrisisLevel(result.crisisLevel);
      if (result.showEmergency) setShowEmergency(true);
      // Show only current session messages: append the new user+assistant pair to existing messages
      // The pipeline returns full chatHistory (including old sessions), but UI only shows current session
      const fullHistory = result.updatedUserDat.chatHistory;
      // Current session = messages after the last greeting (first assistant msg in this session)
      // Simpler: just append the AI response to current messages (user msg already added optimistically)
      const aiResponse = fullHistory[fullHistory.length - 1];
      // Patch k05Override info into clinicalInfo for clinical mode display
      if (result.k05OverrideLog || result.safetyFilterLog) {
        aiResponse.clinicalInfo = { ...aiResponse.clinicalInfo!,

          k05Override: result.k05OverrideLog,
          safetyFilters: result.safetyFilterLog,
        };
      }
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
          sessionId: `session_${LocalDeviceTimeService.now().epochMs}`,
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
            timestampIso: LocalDeviceTimeService.now().utcIso,
          });
          const updatedBuffer = stores.sessionBufferStore.getBuffer();
          if (updatedBuffer) {
            stores.sessionBufferStore.appendMessage(updatedBuffer, {
              turnId,
              role: 'assistant',
              text: (result.response ?? '').slice(0, 200),
              timestampIso: LocalDeviceTimeService.now().utcIso,
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
        // ── IMMEDIATE LOGS.DAT WRITE (after every turn) ─────────────────
        // Write full session summary to logs.dat IMMEDIATELY so data is NEVER
        // lost regardless of how the user leaves (back-button, tab-switch, kill).
        // The endSession GPT-call can later UPGRADE this entry with richer narrative.
        try {
          const currentBuffer = stores.sessionBufferStore.getBuffer();
          if (currentBuffer && currentBuffer.compactMessages.length > 0) {
            // Extract user messages for narrative
            const userMsgs = currentBuffer.compactMessages
              .filter(m => m.role === 'user')
              .slice(-10)
              .map(m => m.text.slice(0, 300));
            const narrative = userMsgs.length > 0
              ? `Sessie-inhoud (${currentBuffer.compactMessages.length} berichten): ${userMsgs.join(' | ')}`
              : `Sessie met ${currentBuffer.compactMessages.length} berichten`;

            // Extract topics from user messages (words > 4 chars, top 5)
            const combined = userMsgs.join(' ').toLowerCase();
            const words = combined.split(/\s+/).filter(w => w.length > 4);
            const freq = new Map<string, number>();
            for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
            const topics = [...freq.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([word]) => word);

            // Extract module trace from buffer turn snapshots
            const moduleTrace = currentBuffer.turnSnapshots
              .filter(s => s.activeModule)
              .map(s => ({
                moduleId: s.activeModule!.moduleId,
                responseMode: s.activeModule!.responseMode || 'default',
                count: 1,
              }));

            // Extract zone trace from buffer turn snapshots
            const zoneTrace = currentBuffer.turnSnapshots
              .filter(s => s.zone)
              .map(s => ({
                zone: s.zone!.zone,
                count: 1,
              }));

            const liveSummary: any = {
              summaryId: `live_${currentBuffer.sessionId}`,
              sessionId: currentBuffer.sessionId,
              persona,
              startedAt: currentBuffer.startedAt,
              endedAt: bundle.context.timestampIso,
              createdAt: currentBuffer.startedAt,
              summaryModel: 'local_live',
              summarySchemaVersion: 'session_summary.v1',
              compressedNarrative: narrative.slice(0, 1500),
              discussedTopics: topics,
              emotionalThemes: [],
              breakthroughs: [],
              relapseOrRiskEvents: [{eventType: 'none', description: '', severity: 0}],
              openEndpoints: [],
              extractedCandidates: { fears: [], hopes: [], triggers: [], schemaTendencies: [], modeTendencies: [] },
              moduleTrace,
              zoneTrace,
              inputTokenEstimate: 0,
              outputTokenEstimate: 0,
            };
            await stores.logsDatStore.upsertCurrentSession(persona, liveSummary as any, bundle.context.timestampIso);
            logDebugEvent('memory_logsdat_turn_write', {
              success: true,
              messageCount: currentBuffer.compactMessages.length,
              topicCount: topics.length,
              persona,
              sessionId: currentBuffer.sessionId,
            });
          }
        } catch (incrErr) {
          console.warn('[LiveLogsDat] Write failed (non-critical):', incrErr);
          logDebugEvent('memory_logsdat_turn_write', {
            success: false,
            error: String(incrErr),
            persona,
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
      // ── Balkmetafoor Auto-Init + Chat Feed (PAAL01) ──────────────────────
      // When PAAL01 activates with FIRST_USE_INTRODUCTION, auto-initialize balkmetafoor.
      // When PAAL01 activates with QUALITATIVE reflection, parse draaglast/draagkracht from AI response.
      try {
        if (result.paal01Activation && state.userType === 'elias') {
          const currentBp = getBackpack();
          const currentBalk = currentBp?.balkmetafoor ?? { initialized: false, initializedAt: null, lastUpdatedAt: null, draaglast: [], draagkracht: [] };
          // Auto-init on first use
          if (result.paal01Activation.triggerContext === 'FIRST_USE_INTRODUCTION' && !currentBalk.initialized) {
            // Direct backpack update via SessionMemoryCache (hooks not callable here)
            const updatedBalk = {
              ...currentBalk,
              initialized: true,
              initializedAt: LocalDeviceTimeService.now().utcIso,
              lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
            };
            // Update backpack directly via user-context dispatch
            if (currentBp) {
              const updatedBackpack = { ...currentBp, balkmetafoor: updatedBalk };
              await SessionMemoryCache.set(BACKPACK_KEY, JSON.stringify(updatedBackpack));
              console.log('[Balkmetafoor] Auto-initialized via PAAL01 FIRST_USE_INTRODUCTION');
            }
          }
          // Chat feed: extract draaglast/draagkracht items from AI response
          if (result.paal01Activation.triggerContext === 'STABLE_REFLECTION' ||
              result.paal01Activation.triggerContext === 'PERIODIC_UPDATE_INVITATION') {
            const aiText = result.response ?? '';
            const balkItems = extractBalkmetafoorItemsFromResponse(aiText);
            if (balkItems.draaglast.length > 0 || balkItems.draagkracht.length > 0) {
              const now = LocalDeviceTimeService.now();
              const updatedBalk = {
                ...currentBalk,
                initialized: true,
                initializedAt: currentBalk.initializedAt || now.utcIso,
                lastUpdatedAt: now.utcIso,
                draaglast: [
                  ...currentBalk.draaglast,
                  ...balkItems.draaglast.map((text, i) => ({
                    id: `dl_paal01_${now.epochMs}_${i}`,
                    text,
                    addedAt: now.utcIso,
                    sourceModuleId: 'PAAL01' as const,
                  })),
                ],
                draagkracht: [
                  ...currentBalk.draagkracht,
                  ...balkItems.draagkracht.map((text, i) => ({
                    id: `dk_paal01_${now.epochMs}_${i}`,
                    text,
                    addedAt: now.utcIso,
                    sourceModuleId: 'PAAL01' as const,
                  })),
                ],
              };
              if (currentBp) {
                const updatedBackpack = { ...currentBp, balkmetafoor: updatedBalk };
                await SessionMemoryCache.set(BACKPACK_KEY, JSON.stringify(updatedBackpack));
                console.log(`[Balkmetafoor] Chat feed: +${balkItems.draaglast.length} draaglast, +${balkItems.draagkracht.length} draagkracht`);
              }
            }
          }
        }
      } catch (balkErr) {
        console.warn('[Balkmetafoor] Auto-init/feed error (non-critical):', balkErr);
      }
      // ── DIST01 Phase 2: Show proposals in chat ──────────────────────────
      if (result.distillationProposals && result.distillationProposals.length > 0) {
        setPendingProposals(result.distillationProposals);
      }

      // ── DIST01 Phase 3: Show auto-save toast notification ──────────────
      if (result.autoSavedInfo && result.autoSavedInfo.count > 0) {
        setAutoSaveToast(result.autoSavedInfo);
        setTimeout(() => setAutoSaveToast(null), 4000);
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
        `Timestamp: ${LocalDeviceTimeService.now().utcIso}`,
        `Session phase: ${sessionPhase}`,
        `Has backpack: ${!!state.backpack}`,
        `Has userDat: ${!!state.userDat}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📸 SCREENSHOT DIT BERICHT`,
        `en stuur het naar de developer.`,
      ].join('\n');
      const errorMsg: ChatMessage = {
        id: `msg_${LocalDeviceTimeService.now().epochMs + 1}`,
        role: 'assistant',
        content: crashReport,
        timestamp: LocalDeviceTimeService.now().utcIso,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, state.backpack, state.userDat, sessionPhase]);

  // ── DIST01 Phase 3: Handle proposal user actions (Route B — write to target) ──
  const handleProposalAction = useCallback(async (proposalId: string, action: ProposalUserAction, editedText?: string) => {
    try {
      const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
      const proposalStoreApi = createProposalStore();
      let proposalData = await proposalStoreApi.load(persona);
      proposalData = proposalStoreApi.updateProposalStatus(proposalData, proposalId, action, editedText);
      await proposalStoreApi.save(proposalData);
      // Remove from pending UI
      setPendingProposals((prev) => prev.filter((p) => p.id !== proposalId));
      logDebugEvent('dist01_proposal_action', { proposalId, action, persona });

      // ── Route B: Write accepted/edited proposals to target documents ──
      if (action === 'accept' || action === 'edit') {
        const proposal = proposalData.proposals.find((p) => p.id === proposalId);
        if (proposal && state.backpack) {
          // Apply editedText to proposal for the writer
          const proposalToWrite = editedText ? { ...proposal, editedText } : proposal;
          const writeResult = writeProposalToDocument(proposalToWrite, state.backpack);
          if (writeResult.success && writeResult.updatedBackpack) {
            // Persist updated backpack (narrative/verhaal)
            await SessionMemoryCache.set(BACKPACK_KEY, JSON.stringify(writeResult.updatedBackpack));
            console.log(`[DIST01] Route B: Written to ${writeResult.writtenField}: "${writeResult.writtenText.slice(0, 50)}"`);
            // Feed user.dat (analysis: personen, schemas, triggers) from updated backpack
            // This is a manual change (user accepted/edited proposal) → extraction should run
            forceExtract(writeResult.updatedBackpack, callExtractionEndpoint)
              .then(async (entities) => {
                if (entities) {
                  const udJson = await SessionMemoryCache.get(USERDAT_KEY);
                  if (udJson) {
                    const ud = JSON.parse(udJson);
                    ud.extractedEntities = entities;
                    await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(ud));
                    console.log(`[DIST01] Route B: user.dat fed with ${entities.persons.length} persons after proposal write`);
                  }
                }
              })
              .catch((err) => console.warn('[DIST01] Route B extraction failed (non-blocking):', err));
            // Update signal promotionStatus in distillation store
            if (proposal.signalId) {
              const distStore = createDistillationStore();
              let distData = await distStore.load(persona);
              distData = updateSignalPromotionStatus(distData, proposal.signalId, 'accepted');
              await distStore.save(distData);
            }
          } else {
            console.warn(`[DIST01] Route B write failed: ${writeResult.error}`);
          }
        }
      } else if (action === 'reject') {
        // Update signal promotionStatus to 'rejected' (suppresses future proposals for this pattern)
        const proposal = proposalData.proposals.find((p) => p.id === proposalId);
        if (proposal?.signalId) {
          const distStore = createDistillationStore();
          let distData = await distStore.load(persona);
          distData = updateSignalPromotionStatus(distData, proposal.signalId, 'rejected');
          // Also suppress the signal
          distData = {
            ...distData,
            signals: distData.signals.map((s) =>
              s.id === proposal.signalId ? { ...s, suppressedByUser: true } : s
            ),
          };
          await distStore.save(distData);
        }
      }
    } catch (err) {
      console.warn('[DIST01] Proposal action failed:', err);
    }
  }, [state.userType, state.backpack]);

  const handleEndConversation = useCallback(async () => {
    if (!state.backpack || !state.userDat || sessionPhase !== 'active') return;
    setSessionPhase('ending');
    const analyzingMsg: ChatMessage = {
      id: `msg_end_${LocalDeviceTimeService.now().epochMs}`,
      role: 'assistant',
      content: `Ik ga alles wat je gedeeld hebt analyseren. Blijf nog even — ik laat je weten wanneer je veilig kunt afsluiten.`,
      timestamp: LocalDeviceTimeService.now().utcIso,
    };
    setMessages((prev) => [...prev, analyzingMsg]);
    try {
      const userDatJson = await SessionMemoryCache.get(USERDAT_KEY);
      const currentUserDat: UserDat = userDatJson ? JSON.parse(userDatJson) : state.userDat!;
      const backpack = state.backpack!;
      const provider = getAIProvider();
      // Attach diary entries for gratitude streak calculation
      let diaryForSession: DiaryEntry[] = [];
      try {
        const diaryJson = await SessionMemoryCache.get(DIARY_KEY);
        if (diaryJson) diaryForSession = JSON.parse(diaryJson);
      } catch (_e) { /* ignore */ }
      const userDatWithDiary = { ...currentUserDat, _sessionDiaryEntries: diaryForSession } as any;
      const result = await endSession(backpack, provider, userDatWithDiary);
      // Only persist userDat (backpack is NEVER modified)
      await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(result.updatedUserDat));
      await endSessionWithUserDat(result.updatedUserDat);
      const confirmationMsg: ChatMessage = {
        id: `msg_confirm_${LocalDeviceTimeService.now().epochMs}`,
        role: 'assistant',
        content: result.farewell + '\n\nAlles is opgeslagen. Je sessie is veilig bewaard. Je kunt de app nu sluiten of teruggaan naar het startscherm.',
        timestamp: LocalDeviceTimeService.now().utcIso,
      };
      setMessages((prev) => [...prev, confirmationMsg]);
      setSessionPhase('completed');
      // Lock memory cache: flush dirty entries to encrypted storage and clear RAM
      await SessionMemoryCache.lock();
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
        id: `msg_fallback_${LocalDeviceTimeService.now().epochMs}`,
        role: 'assistant',
        content: `${userName}, je sessie is opgeslagen. Er ging iets mis tijdens de analyse, maar je gesprek is veilig bewaard. Je kunt de app nu sluiten.`,
        timestamp: LocalDeviceTimeService.now().utcIso,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setSessionPhase('completed');
    }
  }, [state.backpack, state.userDat, sessionPhase, userName, endSessionWithUserDat]);

  // Keep ref in sync so inactivity/background timers can call the same function
  handleEndConversationRef.current = handleEndConversation;

  // ── Quiet session close (back-button / tab-switch) ──────────────────────
  // Writes full summary to logs.dat WITHOUT UI feedback (no farewell, no analyzing msg).
  // Uses GPT with 5s timeout; falls back to buffer-based summary on timeout/failure.
  // Does NOT call the rugzak endSession (no farewell, no userDat promotion).
  // Respects concurrency lock: if handleEndConversation already ran, this is a no-op.
  const closeSessionQuietlyRef = useRef<(() => Promise<void>) | null>(null);
  const closeSessionQuietly = useCallback(async () => {
    // Only close if session was active and has messages
    if (sessionPhase !== 'active' || messages.length < 1) return;
    try {
      const persona = (state.userType === 'elias' ? 'elias' : 'kim') as 'elias' | 'kim';
      const apiBase = getApiBaseUrl();
      const lifecycleManager = getSessionLifecycleManager();
      const buffer = lifecycleManager.getStores().sessionBufferStore.getBuffer();

      // Build chatHistory fallback from current messages
      const chatHistoryForFallback = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));

      logDebugEvent('transfer_1_session_end_detected', {
        trigger: 'quiet_close',
        messageCount: messages.length,
        sessionAnalysesCountBefore: 0,
        writtenTo: `recofree_memory/${persona}/logs.dat`,
      });
      logDebugEvent('transfer_2_buffer_status', {
        bufferExists: buffer !== null,
        bufferMessageCount: buffer?.compactMessages?.length ?? 0,
        bufferSessionId: buffer?.sessionId ?? 'none',
      });

      // GPT with 5s timeout — if it takes longer, fallback kicks in automatically
      // (the lifecycle endSession already has internal fallback, but we add a race
      //  to ensure navigation is never blocked for more than 5s)
      const QUIET_CLOSE_TIMEOUT_MS = 5000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('quiet_close_timeout')), QUIET_CLOSE_TIMEOUT_MS)
      );

      const endResult = await Promise.race([
        lifecycleManager.endSession(persona, apiBase, chatHistoryForFallback),
        timeoutPromise,
      ]).catch(async (err) => {
        // Timeout or error: force buffer-fallback write
        console.warn('[QuietClose] GPT timed out or failed, forcing buffer fallback:', err?.message);
        // The concurrency lock may already be set by the timed-out call.
        // If so, the incremental write is already the best we have.
        // If not, try one more time with a very short apiBase that will fail fast.
        return { sessionId: buffer?.sessionId ?? 'unknown', summarized: false, error: err?.message };
      });

      console.log(`[QuietClose] endSession result: sessionId=${(endResult as any).sessionId}, summarized=${(endResult as any).summarized}`);
      logDebugEvent('transfer_4_lifecycle_result', {
        sessionId: (endResult as any).sessionId ?? 'unknown',
        summarized: (endResult as any).summarized ?? false,
        error: (endResult as any).error ?? null,
        writtenTo: `recofree_memory/${persona}/logs.dat`,
      });
    } catch (err) {
      console.warn('[QuietClose] Non-critical error:', err);
    }
    // Lock memory cache: flush dirty entries to encrypted storage and clear RAM
    await SessionMemoryCache.lock();
  }, [sessionPhase, messages, state.userType]);
  closeSessionQuietlyRef.current = closeSessionQuietly;

  // ── Tab-switch / blur listener ──────────────────────────────────────────
  // When the user switches to another tab, the 'blur' event fires.
  // We trigger the quiet close to ensure logs.dat gets a full summary.
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      // Fire-and-forget: quiet close runs in background
      // The concurrency lock prevents double-writes if back-button already triggered it
      if (closeSessionQuietlyRef.current) {
        closeSessionQuietlyRef.current();
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleBackToHome = useCallback(() => {
    // Reset session state so next Chat tab focus triggers a fresh greeting
    greetingSent.current = false;
    setPreChatDone(false);
    setSessionPhase('active');
    setMessages([]);
    setShowEmergency(false);
    router.replace('/(tabs)');
  }, [router]);

  // Clinical mode: confirm schema/mode tendency
  const handleConfirmTendency = useCallback(async (type: 'mode' | 'schema', id: string) => {
    try {
      const { applyClinicalAcknowledgment } = await import('@/lib/engine/shared/tendency-confirmation');
      const udJson = await SessionMemoryCache.get(USERDAT_KEY);
      if (!udJson) return;
      const userDat = JSON.parse(udJson) as UserDat;
      const now = LocalDeviceTimeService.now().utcIso;
      if (type === 'mode') {
        const { tendencies } = applyClinicalAcknowledgment(
          userDat.modeTendencies ?? [],
          'modeId',
          id,
          now,
        );
        userDat.modeTendencies = tendencies;
      } else {
        const { tendencies } = applyClinicalAcknowledgment(
          userDat.schemaTendencies ?? [],
          'schemaId',
          id,
          now,
        );
        userDat.schemaTendencies = tendencies;
      }
      await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(userDat));
      console.log(`[Clinical] Acknowledged ${type}: ${id}`);
    } catch (e) {
      console.warn('[Clinical] Failed to confirm tendency:', e);
    }
  }, []);
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isElias = state.userType === 'elias';
    // Parse clinical tag from assistant messages (GPT-generated, may be absent)
    const { visibleContent, clinicalAnnotation } = parseClinicalTag(item.content, isUser);
    // Build clinical display: prefer GPT annotation (rich), fallback to local engine metadata
    const showClinical = !isUser && state.userDat?.clinicalModeActive;
    const localInfo = item.clinicalInfo
     ? `\n---\nModule: ${item.clinicalInfo.module} | Zone: ${item.clinicalInfo.zone} | Model: ${item.clinicalInfo.model}${item.clinicalInfo.regulation ? ` | Reg: ${item.clinicalInfo.regulation}` : ''}${item.clinicalInfo.riskScore != null ? ` | Risk: ${item.clinicalInfo.riskScore}` : ''}${item.clinicalInfo.source ? `\nSource: ${item.clinicalInfo.source}` : ''}${item.clinicalInfo.triggers ? `\nTriggers: ${item.clinicalInfo.triggers}` : ''}${item.clinicalInfo.projection ? `\nProjection: ${item.clinicalInfo.projection}` : ''}${item.clinicalInfo.intervention ? `\nIntervention: ${item.clinicalInfo.intervention}` : ''}${item.clinicalInfo.buffer ? `\nBuffer: ${item.clinicalInfo.buffer}` : ''}${item.clinicalInfo.k05Override?.fired ? `\n⚡ K05 Override: ${item.clinicalInfo.k05Override.method} (L1: boundary=${item.clinicalInfo.k05Override.layer1?.boundary}, repair=${item.clinicalInfo.k05Override.layer1?.repair})` : ''}${item.clinicalInfo.safetyFilters?.length ? `\n🛡️ Safety Filters: ${item.clinicalInfo.safetyFilters.map((f: any) => f.filter + (f.module ? '/' + f.module : '') + '(' + f.categories.join(',') + ')').join('; ')}` : ''}`
      : '';
    const cmdLine = item.clinicalInfo?.cmd ? `\nCMD: ${item.clinicalInfo.cmd}` : '';
    const formulationLine = item.clinicalInfo?.formulation ? `\nFormulation: ${item.clinicalInfo.formulation}` : '';
    const routeLine = item.clinicalInfo?.route ? `\nRoute: ${item.clinicalInfo.route}` : '';
    const epistemicLine = item.clinicalInfo?.epistemic ? `\nEpistemic: ${item.clinicalInfo.epistemic}` : '';
    const modelRouteLine = item.clinicalInfo?.modelRoute ? `\nModelRoute: ${item.clinicalInfo.modelRoute}` : '';
    const costLine = item.clinicalInfo?.cost ? `\nCost: ${item.clinicalInfo.cost}` : '';
    const clinicalDisplay = clinicalAnnotation
      ? clinicalAnnotation + localInfo + cmdLine + formulationLine + routeLine + epistemicLine + modelRouteLine + costLine
      : (localInfo || cmdLine || formulationLine || routeLine || epistemicLine || modelRouteLine || costLine) ? (localInfo + cmdLine + formulationLine + routeLine + epistemicLine + modelRouteLine + costLine) : null;

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
            <ClinicalTag annotation={clinicalDisplay} schemaModeResult={item.schemaModeResult} onConfirmTendency={handleConfirmTendency} />
          )}
        </View>
        <Text style={{ ...typography.micro, color: dc.textMuted, marginTop: 4, textAlign: isUser ? 'right' : 'left', marginHorizontal: 4 }}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  }, [companionName, state.userType, state.userDat?.clinicalModeActive, handleConfirmTendency]);

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
              onPress={async () => {
                // Trigger quiet session close before navigating away
                if (closeSessionQuietlyRef.current) {
                  await closeSessionQuietlyRef.current();
                }
                router.push('/(tabs)/' as Href);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginRight: 14 }]}
            >
              <Text style={{ fontSize: 20, color: dc.textInverse, fontWeight: '600' }}>{t('chat.header.back')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const now = LocalDeviceTimeService.now().epochMs;
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

      {/* Auto-save toast notification */}
      {autoSaveToast && (
        <View style={{
          position: 'absolute',
          top: insets.top + 60,
          left: 24,
          right: 24,
          zIndex: 100,
          backgroundColor: colors.primary + 'F2',
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
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
            {t('distillation.auto_save.toast', { document: autoSaveToast.targetDocument })}
          </Text>
          {autoSaveToast.texts[0] && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
              {t('distillation.auto_save.toast_detail', { text: autoSaveToast.texts[0].slice(0, 40) })}
            </Text>
          )}
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
              {/* DIST01 Phase 2: Proposal cards */}
              {pendingProposals.length > 0 && !isTyping && pendingProposals.map((proposal) => (
                <DistillationProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAction={handleProposalAction}
                />
              ))}
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

function ClinicalTag({ annotation, schemaModeResult, onConfirmTendency }: {
  annotation: string;
  schemaModeResult?: { dominantMode?: string | null; dominantSchema?: string | null; acceptedModes?: string[]; acceptedSchemas?: string[] };
  onConfirmTendency?: (type: 'mode' | 'schema', id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
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

  // Collect unique modes/schemas from this message's detection
  const detectedModes = schemaModeResult?.acceptedModes?.length ? schemaModeResult.acceptedModes : (schemaModeResult?.dominantMode ? [schemaModeResult.dominantMode] : []);
  const detectedSchemas = schemaModeResult?.acceptedSchemas?.length ? schemaModeResult.acceptedSchemas : (schemaModeResult?.dominantSchema ? [schemaModeResult.dominantSchema] : []);
  const hasDetections = detectedModes.length > 0 || detectedSchemas.length > 0;

  const handleConfirm = (type: 'mode' | 'schema', id: string) => {
    if (confirmedIds.has(`${type}:${id}`)) return;
    setConfirmedIds(prev => new Set([...prev, `${type}:${id}`]));
    onConfirmTendency?.(type, id);
  };

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
          {/* Schema/Mode Confirmation Section */}
          {hasDetections && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#4A148C', marginBottom: 4 }}>
                Schema/Mode Detectie:
              </Text>
              {detectedModes.map(mode => (
                <View key={`mode-${mode}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: colors.foreground, flex: 1 }}>
                    Mode: {mode}{schemaModeResult?.dominantMode === mode ? ' ★' : ''}
                  </Text>
                  <Pressable
                    onPress={() => handleConfirm('mode', mode)}
                    style={({ pressed }) => [{
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
                      backgroundColor: confirmedIds.has(`mode:${mode}`) ? '#C8E6C9' : '#E3F2FD',
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '600', color: confirmedIds.has(`mode:${mode}`) ? '#2E7D32' : '#1565C0' }}>
                      {confirmedIds.has(`mode:${mode}`) ? '✓ Bevestigd' : 'Bevestig'}
                    </Text>
                  </Pressable>
                </View>
              ))}
              {detectedSchemas.map(schema => (
                <View key={`schema-${schema}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: colors.foreground, flex: 1 }}>
                    Schema: {schema}{schemaModeResult?.dominantSchema === schema ? ' ★' : ''}
                  </Text>
                  <Pressable
                    onPress={() => handleConfirm('schema', schema)}
                    style={({ pressed }) => [{
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
                      backgroundColor: confirmedIds.has(`schema:${schema}`) ? '#C8E6C9' : '#E3F2FD',
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '600', color: confirmedIds.has(`schema:${schema}`) ? '#2E7D32' : '#1565C0' }}>
                      {confirmedIds.has(`schema:${schema}`) ? '✓ Bevestigd' : 'Bevestig'}
                    </Text>
                  </Pressable>
                </View>
              ))}
              <Text style={{ fontSize: 9, color: colors.muted, marginTop: 4, fontStyle: 'italic' }}>
                Bevestiging = +2 acknowledgment score (meervoudige verificatie vereist voor confirmed status)
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
