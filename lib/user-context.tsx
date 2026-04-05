import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserType, UrgencyLevel, MoodSliders, Rugzak, ChatMessage, IntakeData } from './ai/types';

// ─── State Types ────────────────────────────────────────────────

interface UserState {
  isLoading: boolean;
  intakeCompleted: boolean;
  userName: string;
  /** IMMUTABLE after intake. No runtime switching. */
  userType: UserType | null;
  startEmotion: string;
  urgency: UrgencyLevel;
  initialContext: string;
  moodSliders: MoodSliders;
  rugzak: Rugzak | null;
  chatHistory: ChatMessage[];
  crisisLevel: number;
  detectedEmotion: string;
  sessionStartTime: string | null;
}

type UserAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'COMPLETE_INTAKE'; payload: IntakeData }
  | { type: 'RESTORE_STATE'; payload: Partial<UserState> }
  | { type: 'UPDATE_MOOD'; payload: Partial<MoodSliders> }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'CLEAR_CHAT_HISTORY' }
  | { type: 'SET_CRISIS_LEVEL'; payload: number }
  | { type: 'SET_DETECTED_EMOTION'; payload: string }
  | { type: 'UPDATE_RUGZAK'; payload: Record<string, string> }
  | { type: 'START_SESSION' }
  | { type: 'RESET' };

interface UserContextValue {
  state: UserState;
  completeIntake: (data: IntakeData) => Promise<void>;
  updateMood: (sliders: Partial<MoodSliders>) => Promise<void>;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setCrisisLevel: (level: number) => void;
  setDetectedEmotion: (emotion: string) => void;
  updateRugzak: (entries: Record<string, string>) => Promise<void>;
  startSession: () => void;
  resetUser: () => Promise<void>;
}

// ─── Storage Keys ───────────────────────────────────────────────

const STORAGE_KEYS = {
  INTAKE: '@recofree_intake',
  MOOD: '@recofree_mood',
  RUGZAK: '@recofree_rugzak',
} as const;

// ─── Initial State ──────────────────────────────────────────────

const initialState: UserState = {
  isLoading: true,
  intakeCompleted: false,
  userName: '',
  userType: null,
  startEmotion: '',
  urgency: 'midden',
  initialContext: '',
  moodSliders: { stemming: 5, craving: 0, overprikkeling: 3, sociaal: 5 },
  rugzak: null,
  chatHistory: [],
  crisisLevel: 0,
  detectedEmotion: 'neutral',
  sessionStartTime: null,
};

// ─── Reducer ────────────────────────────────────────────────────

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'COMPLETE_INTAKE': {
      const { userName, userType, startEmotion, urgency, initialContext } = action.payload;
      return {
        ...state,
        intakeCompleted: true,
        userName,
        userType,
        startEmotion,
        urgency,
        initialContext,
        rugzak: {
          naam: userName,
          userType,
          entries: {
            intake_emotie: startEmotion,
            intake_urgentie: urgency,
            intake_context: initialContext,
            intake_datum: new Date().toISOString(),
          },
        },
      };
    }

    case 'RESTORE_STATE':
      return { ...state, ...action.payload, isLoading: false };

    case 'UPDATE_MOOD':
      return {
        ...state,
        moodSliders: { ...state.moodSliders, ...action.payload },
      };

    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatHistory: [...state.chatHistory, action.payload],
      };

    case 'CLEAR_CHAT_HISTORY':
      return { ...state, chatHistory: [] };

    case 'SET_CRISIS_LEVEL':
      return { ...state, crisisLevel: action.payload };

    case 'SET_DETECTED_EMOTION':
      return { ...state, detectedEmotion: action.payload };

    case 'UPDATE_RUGZAK':
      if (!state.rugzak) return state;
      return {
        ...state,
        rugzak: {
          ...state.rugzak,
          entries: { ...state.rugzak.entries, ...action.payload },
        },
      };

    case 'START_SESSION':
      return {
        ...state,
        sessionStartTime: new Date().toISOString(),
        chatHistory: [],
        crisisLevel: 0,
        detectedEmotion: 'neutral',
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

  // Restore persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [intakeJson, moodJson, rugzakJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.INTAKE),
          AsyncStorage.getItem(STORAGE_KEYS.MOOD),
          AsyncStorage.getItem(STORAGE_KEYS.RUGZAK),
        ]);

        const restored: Partial<UserState> = {};

        if (intakeJson) {
          const intake: IntakeData = JSON.parse(intakeJson);
          restored.intakeCompleted = true;
          restored.userName = intake.userName;
          restored.userType = intake.userType;
          restored.startEmotion = intake.startEmotion;
          restored.urgency = intake.urgency;
          restored.initialContext = intake.initialContext;
        }

        if (moodJson) {
          restored.moodSliders = JSON.parse(moodJson);
        }

        if (rugzakJson) {
          restored.rugzak = JSON.parse(rugzakJson);
        }

        dispatch({ type: 'RESTORE_STATE', payload: restored });
      } catch (error) {
        console.error('Failed to restore user state:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  /**
   * Complete intake and permanently assign user type.
   * userType is IMMUTABLE after this call.
   */
  const completeIntake = useCallback(async (data: IntakeData) => {
    // Guard: if intake is already completed, do nothing (immutable userType)
    if (state.intakeCompleted) {
      console.warn('Intake already completed. userType is immutable.');
      return;
    }

    dispatch({ type: 'COMPLETE_INTAKE', payload: data });

    // Persist intake data
    await AsyncStorage.setItem(STORAGE_KEYS.INTAKE, JSON.stringify(data));

    // Persist initial rugzak
    const rugzak: Rugzak = {
      naam: data.userName,
      userType: data.userType,
      entries: {
        intake_emotie: data.startEmotion,
        intake_urgentie: data.urgency,
        intake_context: data.initialContext,
        intake_datum: new Date().toISOString(),
      },
    };
    await AsyncStorage.setItem(STORAGE_KEYS.RUGZAK, JSON.stringify(rugzak));
  }, [state.intakeCompleted]);

  const updateMood = useCallback(async (sliders: Partial<MoodSliders>) => {
    dispatch({ type: 'UPDATE_MOOD', payload: sliders });
    const current = state.moodSliders;
    const updated = { ...current, ...sliders };
    await AsyncStorage.setItem(STORAGE_KEYS.MOOD, JSON.stringify(updated));
  }, [state.moodSliders]);

  const addChatMessage = useCallback((message: ChatMessage) => {
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  }, []);

  const clearChatHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_CHAT_HISTORY' });
  }, []);

  const setCrisisLevel = useCallback((level: number) => {
    dispatch({ type: 'SET_CRISIS_LEVEL', payload: level });
  }, []);

  const setDetectedEmotion = useCallback((emotion: string) => {
    dispatch({ type: 'SET_DETECTED_EMOTION', payload: emotion });
  }, []);

  const updateRugzak = useCallback(async (entries: Record<string, string>) => {
    dispatch({ type: 'UPDATE_RUGZAK', payload: entries });
    if (state.rugzak) {
      const updated = { ...state.rugzak, entries: { ...state.rugzak.entries, ...entries } };
      await AsyncStorage.setItem(STORAGE_KEYS.RUGZAK, JSON.stringify(updated));
    }
  }, [state.rugzak]);

  const startSession = useCallback(() => {
    dispatch({ type: 'START_SESSION' });
  }, []);

  const resetUser = useCallback(async () => {
    dispatch({ type: 'RESET' });
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.INTAKE,
      STORAGE_KEYS.MOOD,
      STORAGE_KEYS.RUGZAK,
    ]);
  }, []);

  return (
    <UserContext.Provider
      value={{
        state,
        completeIntake,
        updateMood,
        addChatMessage,
        clearChatHistory,
        setCrisisLevel,
        setDetectedEmotion,
        updateRugzak,
        startSession,
        resetUser,
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
