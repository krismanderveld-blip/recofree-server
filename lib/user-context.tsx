import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserType, UrgencyLevel, MoodSliders, Rugzak, Backpack, UserDat,
  LifePhaseId, ChatMessage, IntakeData, RugzakInfluence, GuidanceDepth,
} from './ai/types';
import {
  createNewBackpack, createNewUserDat, composeRugzak,
  DEFAULT_BACKPACK_SECTIONS, createDefaultSliders,
} from './ai/types';
import {
  computeRugzakInfluence,
  addMessageToRugzak,
  recordMoodSnapshot,
  recordModuleUsage,
  updateTriggerPatterns,
  startNewSession,
} from './rugzak/engine';

// ─── State Types ────────────────────────────────────────────────

/**
 * UserState — DUAL-STORE architecture.
 *
 * Two separate data sources:
 *   backpack → Stable identity (user-editable only, NEVER auto-modified)
 *   userDat  → Dynamic session memory (system-updated at session end only)
 *
 * The composed `rugzak` is a READ-ONLY view for backward compatibility
 * with engine.ts and state-analyzer.ts. It is NEVER persisted directly.
 */
interface UserState {
  isLoading: boolean;
  intakeCompleted: boolean;
  /** IMMUTABLE after intake. No runtime switching. */
  userType: UserType | null;
  /** Stable identity — NEVER auto-modified */
  backpack: Backpack | null;
  /** Dynamic session memory — updated at session end */
  userDat: UserDat | null;
  /** Composed view for backward compatibility (NEVER persisted) */
  rugzak: Rugzak | null;
  /** Current crisis level (computed per message, not persisted separately) */
  crisisLevel: number;
  /** Current detected emotion (computed per message) */
  detectedEmotion: string;
  /** Session start time (for duration tracking) */
  sessionStartTime: string | null;
  /** Computed influence from Rugzak engine (recalculated per message) */
  influence: RugzakInfluence | null;
}

type UserAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'COMPLETE_INTAKE'; payload: IntakeData }
  | { type: 'RESTORE_STORES'; payload: { backpack: Backpack; userDat: UserDat } }
  | { type: 'UPDATE_BACKPACK'; payload: Backpack }
  | { type: 'UPDATE_USERDAT'; payload: UserDat }
  | { type: 'SET_CRISIS_LEVEL'; payload: number }
  | { type: 'SET_DETECTED_EMOTION'; payload: string }
  | { type: 'SET_INFLUENCE'; payload: RugzakInfluence }
  | { type: 'START_SESSION' }
  | { type: 'END_SESSION'; payload: UserDat }
  | { type: 'RESET' };

interface UserContextValue {
  state: UserState;
  completeIntake: (data: IntakeData) => Promise<void>;
  /** Update mood — writes to userDat and records snapshot */
  updateMood: (sliders: Partial<MoodSliders>) => Promise<void>;
  /** Add a chat message — writes to userDat's persistent chatHistory */
  addChatMessage: (message: ChatMessage) => Promise<void>;
  /** Record module usage in userDat */
  recordModule: (moduleId: string, context: string) => Promise<void>;
  /** Update trigger patterns in userDat */
  updateTriggers: (newTriggers: string[]) => Promise<void>;
  /** Update a life-phase narrative section in backpack (USER action only) */
  updateRugzakSection: (sectionId: LifePhaseId, content: string) => Promise<void>;
  /** Alias for updateRugzakSection (preferred name for dual-store architecture) */
  updateBackpackSection: (sectionId: LifePhaseId, content: string) => Promise<void>;
  /** Recompute Rugzak influence (call on every message) */
  recomputeInfluence: () => void;
  setCrisisLevel: (level: number) => void;
  setDetectedEmotion: (emotion: string) => void;
  startSession: () => Promise<void>;
  /** End the current session — updates userDat with session-end analysis */
  endSessionWithRugzak: (updatedRugzak: Rugzak) => Promise<void>;
  /** End session with explicit userDat update */
  endSessionWithUserDat: (updatedUserDat: UserDat) => Promise<void>;
  resetUser: () => Promise<void>;
  /** Update Stage of Change in backpack (user action) */
  updateStageOfChange: (stage: import('./ai/types').StageOfChange) => Promise<void>;
  /** Update guidance depth preference (user action) */
  updateGuidanceDepth: (depth: GuidanceDepth) => Promise<void>;
  /** Get current guidance depth */
  getGuidanceDepth: () => GuidanceDepth;
  /** Convenience getters */
  getUserName: () => string;
  getMood: () => MoodSliders;
  getChatHistory: () => ChatMessage[];
  getUrgency: () => UrgencyLevel;
  getStartEmotion: () => string;
  getBackpack: () => Backpack | null;
  getUserDat: () => UserDat | null;
}

// ─── Storage Keys ───────────────────────────────────────────────

const BACKPACK_KEY = '@recofree_backpack';
const USERDAT_KEY = '@recofree_userdat';
/** Legacy key — used for migration from monolithic rugzak */
const LEGACY_RUGZAK_KEY = '@recofree_rugzak';

// ─── Initial State ──────────────────────────────────────────────

const initialState: UserState = {
  isLoading: true,
  intakeCompleted: false,
  userType: null,
  backpack: null,
  userDat: null,
  rugzak: null,
  crisisLevel: 0,
  detectedEmotion: 'neutral',
  sessionStartTime: null,
  influence: null,
};

// ─── Persist ────────────────────────────────────────────────────

async function persistBackpack(backpack: Backpack) {
  await AsyncStorage.setItem(BACKPACK_KEY, JSON.stringify(backpack));
}

async function persistUserDat(userDat: UserDat) {
  await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(userDat));
}

// ─── Compose helper ─────────────────────────────────────────────

function composeState(backpack: Backpack, userDat: UserDat): { rugzak: Rugzak; influence: RugzakInfluence } {
  const rugzak = composeRugzak(backpack, userDat);
  const influence = computeRugzakInfluence(rugzak, 0);
  return { rugzak, influence };
}

// ─── Reducer ────────────────────────────────────────────────────

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'COMPLETE_INTAKE': {
      const backpack = createNewBackpack(action.payload);
      const userDat = createNewUserDat(action.payload.userType, action.payload.stageOfChange);
      const { rugzak, influence } = composeState(backpack, userDat);
      return {
        ...state,
        isLoading: false,
        intakeCompleted: true,
        userType: action.payload.userType,
        backpack,
        userDat,
        rugzak,
        influence,
      };
    }

    case 'RESTORE_STORES': {
      const { backpack, userDat } = action.payload;
      const { rugzak, influence } = composeState(backpack, userDat);
      return {
        ...state,
        isLoading: false,
        intakeCompleted: true,
        userType: backpack.userType,
        backpack,
        userDat,
        rugzak,
        influence,
      };
    }

    case 'UPDATE_BACKPACK': {
      if (!state.userDat) return state;
      const { rugzak, influence } = composeState(action.payload, state.userDat);
      return { ...state, backpack: action.payload, rugzak, influence };
    }

    case 'UPDATE_USERDAT': {
      if (!state.backpack) return state;
      const { rugzak, influence } = composeState(state.backpack, action.payload);
      return { ...state, userDat: action.payload, rugzak, influence };
    }

    case 'SET_CRISIS_LEVEL':
      return { ...state, crisisLevel: action.payload };

    case 'SET_DETECTED_EMOTION':
      return { ...state, detectedEmotion: action.payload };

    case 'SET_INFLUENCE':
      return { ...state, influence: action.payload };

    case 'START_SESSION': {
      if (!state.backpack || !state.userDat) return state;
      // startNewSession updates totalSessions and lastSessionDate in the composed rugzak
      // We extract those changes back into userDat
      const composedRugzak = composeRugzak(state.backpack, state.userDat);
      const updatedRugzak = startNewSession(composedRugzak);
      const updatedUserDat: UserDat = {
        ...state.userDat,
        totalSessions: updatedRugzak.totalSessions,
        lastSessionDate: updatedRugzak.lastSessionDate,
      };
      const { rugzak, influence } = composeState(state.backpack, updatedUserDat);
      return {
        ...state,
        sessionStartTime: new Date().toISOString(),
        crisisLevel: 0,
        detectedEmotion: 'neutral',
        userDat: updatedUserDat,
        rugzak,
        influence,
      };
    }

    case 'END_SESSION': {
      if (!state.backpack) return state;
      const { rugzak, influence } = composeState(state.backpack, action.payload);
      return {
        ...state,
        userDat: action.payload,
        rugzak,
        sessionStartTime: null,
        crisisLevel: 0,
        detectedEmotion: 'neutral',
        influence,
      };
    }

    case 'RESET':
      return { ...initialState, isLoading: false };

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // Restore persisted stores on mount (with migration from legacy monolithic rugzak)
  useEffect(() => {
    (async () => {
      try {
        // Try loading the new dual-store format first
        const [backpackJson, userDatJson] = await Promise.all([
          AsyncStorage.getItem(BACKPACK_KEY),
          AsyncStorage.getItem(USERDAT_KEY),
        ]);

        if (backpackJson && userDatJson) {
          // New format exists — restore directly
          const rawBackpack = JSON.parse(backpackJson);
          const rawUserDat = JSON.parse(userDatJson);
          const backpack = migrateBackpack(rawBackpack);
          const userDat = migrateUserDat(rawUserDat, backpack.userType);
          dispatch({ type: 'RESTORE_STORES', payload: { backpack, userDat } });
          return;
        }

        // Check for legacy monolithic rugzak and migrate
        const legacyJson = await AsyncStorage.getItem(LEGACY_RUGZAK_KEY);
        if (legacyJson) {
          const raw = JSON.parse(legacyJson);
          console.log('[UserContext] Migrating legacy Rugzak to dual-store...');

          // Split legacy rugzak into backpack + userDat
          const backpack: Backpack = {
            naam: raw.naam ?? '',
            userType: raw.userType ?? 'elias',
            sections: (raw.sections && raw.sections.length > 0)
              ? raw.sections
              : DEFAULT_BACKPACK_SECTIONS.map((s: any) => ({ ...s })),
    intakeContext: {
              stageOfChange: raw.intakeContext?.stageOfChange ?? 'contemplation' as const,
              startEmotion: raw.intakeContext?.startEmotion ?? '',
              urgency: raw.intakeContext?.urgency ?? 'midden' as const,
              initialContext: raw.intakeContext?.initialContext ?? '',
              intakeDate: raw.intakeContext?.intakeDate ?? new Date().toISOString(),
            },
            createdAt: raw.createdAt ?? new Date().toISOString(),
          };

          const userDat: UserDat = {
            currentMood: raw.currentMood ?? createDefaultSliders(backpack.userType),
            moodHistory: raw.moodHistory ?? [],
            chatHistory: raw.chatHistory ?? [],
            moduleUsage: raw.moduleUsage ?? [],
            triggerPatterns: raw.triggerPatterns ?? [],
            totalSessions: raw.totalSessions ?? 0,
            lastSessionDate: raw.lastSessionDate ?? null,
            sessionAnalyses: [],
            stageOfChange: raw.stageOfChange ?? 'contemplation' as const,
          };

          // Persist both new stores
          await Promise.all([
            persistBackpack(backpack),
            persistUserDat(userDat),
          ]);
          // Remove legacy key
          await AsyncStorage.removeItem(LEGACY_RUGZAK_KEY);
          console.log('[UserContext] Migration complete. Legacy key removed.');

          dispatch({ type: 'RESTORE_STORES', payload: { backpack, userDat } });
          return;
        }

        // No data at all — fresh install
        dispatch({ type: 'SET_LOADING', payload: false });
      } catch (error) {
        console.error('Failed to restore stores:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  // ── Intake ──

  const completeIntake = useCallback(async (data: IntakeData) => {
    if (state.intakeCompleted) {
      console.warn('Intake already completed. userType is immutable.');
      return;
    }
    dispatch({ type: 'COMPLETE_INTAKE', payload: data });
    const backpack = createNewBackpack(data);
    const userDat = createNewUserDat(data.userType, data.stageOfChange);
    await Promise.all([
      persistBackpack(backpack),
      persistUserDat(userDat),
    ]);
  }, [state.intakeCompleted]);

  // ── Mood (writes to userDat + records snapshot) ──

  const updateMood = useCallback(async (sliders: Partial<MoodSliders>) => {
    if (!state.userDat || !state.backpack) return;
    const newMood = { ...state.userDat.currentMood, ...sliders };
    // Use the composed rugzak for the engine function, then extract userDat fields
    const rugzak = composeRugzak(state.backpack, state.userDat);
    const updated = recordMoodSnapshot({ ...rugzak, currentMood: newMood }, newMood);
    const updatedUserDat: UserDat = {
      ...state.userDat,
      currentMood: updated.currentMood,
      moodHistory: updated.moodHistory,
    };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat, state.backpack]);

  // ── Chat Messages (persist in userDat) ──

  const addChatMessage = useCallback(async (message: ChatMessage) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = {
      ...state.userDat,
      chatHistory: [...state.userDat.chatHistory, message],
    };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  // ── Module Usage ──

  const recordModule = useCallback(async (moduleId: string, context: string) => {
    if (!state.userDat || !state.backpack) return;
    const rugzak = composeRugzak(state.backpack, state.userDat);
    const updated = recordModuleUsage(rugzak, moduleId, context);
    const updatedUserDat: UserDat = {
      ...state.userDat,
      moduleUsage: updated.moduleUsage,
    };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat, state.backpack]);

  // ── Trigger Patterns ──

  const updateTriggers = useCallback(async (newTriggers: string[]) => {
    if (!state.userDat || newTriggers.length === 0) return;
    const updatedPatterns = updateTriggerPatterns(state.userDat.triggerPatterns, newTriggers);
    const updatedUserDat: UserDat = {
      ...state.userDat,
      triggerPatterns: updatedPatterns,
    };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  // ── Backpack Section (narrative) — USER ACTION ONLY ──

  const updateRugzakSection = useCallback(async (sectionId: LifePhaseId, content: string) => {
    if (!state.backpack) return;
    const updatedBackpack: Backpack = {
      ...state.backpack,
      sections: state.backpack.sections.map((s) =>
        s.id === sectionId
          ? { ...s, content, lastUpdated: new Date().toISOString() }
          : s
      ),
    };
    dispatch({ type: 'UPDATE_BACKPACK', payload: updatedBackpack });
    await persistBackpack(updatedBackpack);
  }, [state.backpack]);

  // ── Stage of Change (user-editable in Backpack screen) ──

  const updateStageOfChange = useCallback(async (stage: import('./ai/types').StageOfChange) => {
    if (!state.backpack) return;
    const updatedBackpack: Backpack = {
      ...state.backpack,
      intakeContext: {
        ...state.backpack.intakeContext,
        stageOfChange: stage,
      },
    };
    dispatch({ type: 'UPDATE_BACKPACK', payload: updatedBackpack });
    await persistBackpack(updatedBackpack);
    // Also update userDat so the payload builder picks it up
    if (state.userDat) {
      const updatedUserDat = { ...state.userDat, stageOfChange: stage };
      dispatch({ type: 'END_SESSION', payload: updatedUserDat });
      await persistUserDat(updatedUserDat);
    }
  }, [state.backpack, state.userDat]);

  // ── Guidance Depth ──

  const updateGuidanceDepth = useCallback(async (depth: GuidanceDepth) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = { ...state.userDat, guidanceDepth: depth };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const getGuidanceDepth = useCallback((): GuidanceDepth => {
    return state.userDat?.guidanceDepth ?? 'normal';
  }, [state.userDat]);

  // ── Recompute Influence ──

  const recomputeInfluence = useCallback(() => {
    if (!state.rugzak) return;
    const influence = computeRugzakInfluence(state.rugzak, state.crisisLevel);
    dispatch({ type: 'SET_INFLUENCE', payload: influence });
  }, [state.rugzak, state.crisisLevel]);

  // ── Crisis & Emotion ──

  const setCrisisLevel = useCallback((level: number) => {
    dispatch({ type: 'SET_CRISIS_LEVEL', payload: level });
  }, []);

  const setDetectedEmotion = useCallback((emotion: string) => {
    dispatch({ type: 'SET_DETECTED_EMOTION', payload: emotion });
  }, []);

  // ── Session ──

  const startSession = useCallback(async () => {
    dispatch({ type: 'START_SESSION' });
    if (state.backpack && state.userDat) {
      const rugzak = composeRugzak(state.backpack, state.userDat);
      const updated = startNewSession(rugzak);
      const updatedUserDat: UserDat = {
        ...state.userDat,
        totalSessions: updated.totalSessions,
        lastSessionDate: updated.lastSessionDate,
      };
      await persistUserDat(updatedUserDat);
    }
  }, [state.backpack, state.userDat]);

  // ── End Session (backward compat: accepts Rugzak, extracts userDat) ──

  const endSessionWithRugzak = useCallback(async (updatedRugzak: Rugzak) => {
    // Extract userDat fields from the updated rugzak
    const updatedUserDat: UserDat = {
      currentMood: updatedRugzak.currentMood,
      moodHistory: updatedRugzak.moodHistory,
      chatHistory: updatedRugzak.chatHistory,
      moduleUsage: updatedRugzak.moduleUsage,
      triggerPatterns: updatedRugzak.triggerPatterns,
      totalSessions: updatedRugzak.totalSessions,
      lastSessionDate: updatedRugzak.lastSessionDate,
      sessionAnalyses: state.userDat?.sessionAnalyses ?? [],
      stageOfChange: state.userDat?.stageOfChange ?? 'contemplation' as const,
    };
    dispatch({ type: 'END_SESSION', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  // ── End Session (new: accepts UserDat directly) ──

  const endSessionWithUserDat = useCallback(async (updatedUserDat: UserDat) => {
    dispatch({ type: 'END_SESSION', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, []);

  // ── Reset ──

  const resetUser = useCallback(async () => {
    dispatch({ type: 'RESET' });
    await Promise.all([
      AsyncStorage.removeItem(BACKPACK_KEY),
      AsyncStorage.removeItem(USERDAT_KEY),
      AsyncStorage.removeItem(LEGACY_RUGZAK_KEY),
    ]);
  }, []);

  // ── Convenience Getters ──

  const getUserName = useCallback(() => {
    return state.backpack?.naam ?? '';
  }, [state.backpack]);

  const getMood = useCallback(() => {
    return state.userDat?.currentMood ?? createDefaultSliders(state.userType ?? 'elias');
  }, [state.userDat, state.userType]);

  const getChatHistory = useCallback(() => {
    return state.userDat?.chatHistory ?? [];
  }, [state.userDat]);

  const getUrgency = useCallback(() => {
    return state.backpack?.intakeContext.urgency ?? 'midden';
  }, [state.backpack]);

  const getStartEmotion = useCallback(() => {
    return state.backpack?.intakeContext.startEmotion ?? '';
  }, [state.backpack]);

  const getBackpack = useCallback(() => {
    return state.backpack;
  }, [state.backpack]);

  const getUserDat = useCallback(() => {
    return state.userDat;
  }, [state.userDat]);

  return (
    <UserContext.Provider
      value={{
        state,
        completeIntake,
        updateMood,
        addChatMessage,
        recordModule,
        updateTriggers,
        updateRugzakSection,
        updateBackpackSection: updateRugzakSection,
        updateStageOfChange,
        updateGuidanceDepth,
        getGuidanceDepth,
        recomputeInfluence,
        setCrisisLevel,
        setDetectedEmotion,
        startSession,
        endSessionWithRugzak,
        endSessionWithUserDat,
        resetUser,
        getUserName,
        getMood,
        getChatHistory,
        getUrgency,
        getStartEmotion,
        getBackpack,
        getUserDat,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// ─── Migration Helpers ──────────────────────────────────────────

function migrateBackpack(raw: any): Backpack {
  return {
    naam: raw.naam ?? '',
    userType: raw.userType ?? 'elias',
    sections: (raw.sections && raw.sections.length > 0)
      ? raw.sections
      : DEFAULT_BACKPACK_SECTIONS.map((s: any) => ({ ...s })),
    intakeContext: {
      stageOfChange: raw.intakeContext?.stageOfChange ?? 'contemplation' as const,
      startEmotion: raw.intakeContext?.startEmotion ?? '',
      urgency: raw.intakeContext?.urgency ?? 'midden' as const,
      initialContext: raw.intakeContext?.initialContext ?? '',
      intakeDate: raw.intakeContext?.intakeDate ?? new Date().toISOString(),
    },
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function migrateUserDat(raw: any, userType: UserType): UserDat {
  return {
    currentMood: raw.currentMood ?? createDefaultSliders(userType),
    moodHistory: raw.moodHistory ?? [],
    chatHistory: raw.chatHistory ?? [],
    moduleUsage: raw.moduleUsage ?? [],
    triggerPatterns: raw.triggerPatterns ?? [],
    totalSessions: raw.totalSessions ?? 0,
    lastSessionDate: raw.lastSessionDate ?? null,
    sessionAnalyses: raw.sessionAnalyses ?? [],
    stageOfChange: raw.stageOfChange ?? 'contemplation' as const,
    relationalAnchors: raw.relationalAnchors ?? [],
    lastRelationalPattern: raw.lastRelationalPattern ?? null,
  };
}
