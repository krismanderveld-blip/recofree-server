import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserType, UrgencyLevel, MoodSliders, Rugzak, LifePhaseId,
  ChatMessage, IntakeData, RugzakInfluence,
} from './ai/types';
import { createNewRugzak, DEFAULT_RUGZAK_SECTIONS, createDefaultSliders } from './ai/types';
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
 * UserState — the Rugzak IS the state.
 *
 * There is no separate moodSliders or chatHistory on UserState.
 * Everything lives inside the Rugzak. The Rugzak is the single
 * source of truth for the entire system.
 */
interface UserState {
  isLoading: boolean;
  intakeCompleted: boolean;
  /** IMMUTABLE after intake. No runtime switching. */
  userType: UserType | null;
  /** The Rugzak IS the state system. All data lives here. */
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
  | { type: 'RESTORE_RUGZAK'; payload: Rugzak }
  | { type: 'UPDATE_RUGZAK'; payload: Rugzak }
  | { type: 'SET_CRISIS_LEVEL'; payload: number }
  | { type: 'SET_DETECTED_EMOTION'; payload: string }
  | { type: 'SET_INFLUENCE'; payload: RugzakInfluence }
  | { type: 'START_SESSION' }
  | { type: 'RESET' };

interface UserContextValue {
  state: UserState;
  completeIntake: (data: IntakeData) => Promise<void>;
  /** Update mood — writes to Rugzak and records snapshot */
  updateMood: (sliders: Partial<MoodSliders>) => Promise<void>;
  /** Add a chat message — writes to Rugzak's persistent chatHistory */
  addChatMessage: (message: ChatMessage) => Promise<void>;
  /** Record module usage in Rugzak */
  recordModule: (moduleId: string, context: string) => Promise<void>;
  /** Update trigger patterns in Rugzak */
  updateTriggers: (newTriggers: string[]) => Promise<void>;
  /** Update a life-phase narrative section */
  updateRugzakSection: (sectionId: LifePhaseId, content: string) => Promise<void>;
  /** Recompute Rugzak influence (call on every message) */
  recomputeInfluence: () => void;
  setCrisisLevel: (level: number) => void;
  setDetectedEmotion: (emotion: string) => void;
  startSession: () => Promise<void>;
  resetUser: () => Promise<void>;
  /** Convenience getters that read from Rugzak */
  getUserName: () => string;
  getMood: () => MoodSliders;
  getChatHistory: () => ChatMessage[];
  getUrgency: () => UrgencyLevel;
  getStartEmotion: () => string;
}

// ─── Storage Keys ───────────────────────────────────────────────

const STORAGE_KEY = '@recofree_rugzak';

// ─── Default Mood ───────────────────────────────────────────────

// Default mood is created dynamically based on userType via createDefaultSliders()

// ─── Initial State ──────────────────────────────────────────────

const initialState: UserState = {
  isLoading: true,
  intakeCompleted: false,
  userType: null,
  rugzak: null,
  crisisLevel: 0,
  detectedEmotion: 'neutral',
  sessionStartTime: null,
  influence: null,
};

// ─── Persist ────────────────────────────────────────────────────

async function persistRugzak(rugzak: Rugzak) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rugzak));
}

// ─── Reducer ────────────────────────────────────────────────────

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'COMPLETE_INTAKE': {
      const rugzak = createNewRugzak(action.payload);
      return {
        ...state,
        isLoading: false,
        intakeCompleted: true,
        userType: action.payload.userType,
        rugzak,
        influence: computeRugzakInfluence(rugzak, 0),
      };
    }

    case 'RESTORE_RUGZAK':
      return {
        ...state,
        isLoading: false,
        intakeCompleted: true,
        userType: action.payload.userType,
        rugzak: action.payload,
        influence: computeRugzakInfluence(action.payload, 0),
      };

    case 'UPDATE_RUGZAK':
      return {
        ...state,
        rugzak: action.payload,
      };

    case 'SET_CRISIS_LEVEL':
      return { ...state, crisisLevel: action.payload };

    case 'SET_DETECTED_EMOTION':
      return { ...state, detectedEmotion: action.payload };

    case 'SET_INFLUENCE':
      return { ...state, influence: action.payload };

    case 'START_SESSION':
      if (!state.rugzak) return state;
      return {
        ...state,
        sessionStartTime: new Date().toISOString(),
        crisisLevel: 0,
        detectedEmotion: 'neutral',
        rugzak: startNewSession(state.rugzak),
      };

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

  // Restore persisted Rugzak on mount (with migration for older versions)
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const raw = JSON.parse(json);
          // Migrate: ensure all required fields exist (older persisted data may lack them)
          const rugzak: Rugzak = {
            naam: raw.naam ?? '',
            userType: raw.userType ?? 'elias',
            sections: (raw.sections && raw.sections.length > 0)
              ? raw.sections
              : DEFAULT_RUGZAK_SECTIONS.map((s: any) => ({ ...s })),
            currentMood: raw.currentMood ?? createDefaultSliders(raw.userType ?? 'elias'),
            moodHistory: raw.moodHistory ?? [],
            chatHistory: raw.chatHistory ?? [],
            moduleUsage: raw.moduleUsage ?? [],
            triggerPatterns: raw.triggerPatterns ?? [],
            intakeContext: raw.intakeContext ?? {
              startEmotion: '',
              urgency: 'midden' as const,
              initialContext: '',
              intakeDate: new Date().toISOString(),
            },
            lastSessionDate: raw.lastSessionDate ?? null,
            totalSessions: raw.totalSessions ?? 0,
            createdAt: raw.createdAt ?? new Date().toISOString(),
          };
          // Re-persist the migrated version
          await persistRugzak(rugzak);
          dispatch({ type: 'RESTORE_RUGZAK', payload: rugzak });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Failed to restore Rugzak:', error);
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
    const rugzak = createNewRugzak(data);
    await persistRugzak(rugzak);
  }, [state.intakeCompleted]);

  // ── Mood (writes to Rugzak + records snapshot) ──

  const updateMood = useCallback(async (sliders: Partial<MoodSliders>) => {
    if (!state.rugzak) return;
    const newMood = { ...state.rugzak.currentMood, ...sliders };
    const updated = recordMoodSnapshot({ ...state.rugzak, currentMood: newMood }, newMood);
    dispatch({ type: 'UPDATE_RUGZAK', payload: updated });
    await persistRugzak(updated);
  }, [state.rugzak]);

  // ── Chat Messages (persist in Rugzak) ──

  const addChatMessage = useCallback(async (message: ChatMessage) => {
    if (!state.rugzak) return;
    const updated = addMessageToRugzak(state.rugzak, message);
    dispatch({ type: 'UPDATE_RUGZAK', payload: updated });
    await persistRugzak(updated);
  }, [state.rugzak]);

  // ── Module Usage ──

  const recordModule = useCallback(async (moduleId: string, context: string) => {
    if (!state.rugzak) return;
    const updated = recordModuleUsage(state.rugzak, moduleId, context);
    dispatch({ type: 'UPDATE_RUGZAK', payload: updated });
    await persistRugzak(updated);
  }, [state.rugzak]);

  // ── Trigger Patterns ──

  const updateTriggers = useCallback(async (newTriggers: string[]) => {
    if (!state.rugzak || newTriggers.length === 0) return;
    const updatedPatterns = updateTriggerPatterns(state.rugzak.triggerPatterns, newTriggers);
    const updated: Rugzak = { ...state.rugzak, triggerPatterns: updatedPatterns };
    dispatch({ type: 'UPDATE_RUGZAK', payload: updated });
    await persistRugzak(updated);
  }, [state.rugzak]);

  // ── Rugzak Section (narrative) ──

  const updateRugzakSection = useCallback(async (sectionId: LifePhaseId, content: string) => {
    if (!state.rugzak) return;
    const updated: Rugzak = {
      ...state.rugzak,
      sections: state.rugzak.sections.map((s) =>
        s.id === sectionId
          ? { ...s, content, lastUpdated: new Date().toISOString() }
          : s
      ),
    };
    dispatch({ type: 'UPDATE_RUGZAK', payload: updated });
    await persistRugzak(updated);
  }, [state.rugzak]);

  // ── Recompute Influence (call on every message) ──

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
    if (state.rugzak) {
      const updated = startNewSession(state.rugzak);
      await persistRugzak(updated);
    }
  }, [state.rugzak]);

  // ── Reset ──

  const resetUser = useCallback(async () => {
    dispatch({ type: 'RESET' });
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Convenience Getters (read from Rugzak) ──

  const getUserName = useCallback(() => {
    return state.rugzak?.naam ?? '';
  }, [state.rugzak]);

  const getMood = useCallback(() => {
    return state.rugzak?.currentMood ?? createDefaultSliders(state.userType ?? 'elias');
  }, [state.rugzak]);

  const getChatHistory = useCallback(() => {
    return state.rugzak?.chatHistory ?? [];
  }, [state.rugzak]);

  const getUrgency = useCallback(() => {
    return state.rugzak?.intakeContext.urgency ?? 'midden';
  }, [state.rugzak]);

  const getStartEmotion = useCallback(() => {
    return state.rugzak?.intakeContext.startEmotion ?? '';
  }, [state.rugzak]);

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
        recomputeInfluence,
        setCrisisLevel,
        setDetectedEmotion,
        startSession,
        resetUser,
        getUserName,
        getMood,
        getChatHistory,
        getUrgency,
        getStartEmotion,
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
