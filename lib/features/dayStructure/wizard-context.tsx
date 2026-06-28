/**
 * Dagstructuur Feature — Wizard Context
 *
 * React context for managing the wizard flow state.
 * Transient (not persisted) — only lives during wizard session.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { TimeBlock, Weekday, WizardStep } from './types';
import { createBlock } from './helpers';
import { DEFAULT_WAKE_TIME, DEFAULT_SLEEP_TIME } from './constants';

// ─── State ──────────────────────────────────────────────────────────────────

interface WizardContextState {
  currentStep: WizardStep;
  targetDay: Weekday;
  draftBlocks: TimeBlock[];
  /** Days selected for copy-to-week step. */
  copyTargetDays: Weekday[];
}

const initialState: WizardContextState = {
  currentStep: 'intro',
  targetDay: 'monday',
  draftBlocks: [],
  copyTargetDays: [],
};

// ─── Actions ────────────────────────────────────────────────────────────────

type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_TARGET_DAY'; day: Weekday }
  | { type: 'ADD_BLOCK'; block: TimeBlock }
  | { type: 'REMOVE_BLOCK'; blockId: string }
  | { type: 'UPDATE_BLOCK'; blockId: string; updates: Partial<Omit<TimeBlock, 'id'>> }
  | { type: 'SET_DRAFT_BLOCKS'; blocks: TimeBlock[] }
  | { type: 'SET_COPY_TARGETS'; days: Weekday[] }
  | { type: 'RESET' };

function wizardReducer(state: WizardContextState, action: WizardAction): WizardContextState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_TARGET_DAY':
      return { ...state, targetDay: action.day };
    case 'ADD_BLOCK':
      return { ...state, draftBlocks: [...state.draftBlocks, action.block] };
    case 'REMOVE_BLOCK':
      return {
        ...state,
        draftBlocks: state.draftBlocks
          .filter((b) => b.id !== action.blockId)
          .map((b, i) => ({ ...b, orderIndex: i })),
      };
    case 'UPDATE_BLOCK':
      return {
        ...state,
        draftBlocks: state.draftBlocks.map((b) =>
          b.id === action.blockId ? { ...b, ...action.updates } : b,
        ),
      };
    case 'SET_DRAFT_BLOCKS':
      return { ...state, draftBlocks: action.blocks };
    case 'SET_COPY_TARGETS':
      return { ...state, copyTargetDays: action.days };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

interface WizardContextValue {
  state: WizardContextState;
  goToStep: (step: WizardStep) => void;
  setTargetDay: (day: Weekday) => void;
  addWakeBlock: (startTime?: string) => void;
  addActivityBlock: (label: string, startTime: string, endTime: string) => void;
  addSleepBlock: (startTime?: string) => void;
  removeBlock: (blockId: string) => void;
  updateBlock: (blockId: string, updates: Partial<Omit<TimeBlock, 'id'>>) => void;
  setDraftBlocks: (blocks: TimeBlock[]) => void;
  setCopyTargets: (days: Weekday[]) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function DayStructureWizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const setTargetDay = useCallback((day: Weekday) => {
    dispatch({ type: 'SET_TARGET_DAY', day });
  }, []);

  const addWakeBlock = useCallback((startTime?: string) => {
    const block = createBlock({
      label: '',
      kind: 'wake',
      startTime: startTime ?? DEFAULT_WAKE_TIME,
      endTime: startTime ?? DEFAULT_WAKE_TIME,
      orderIndex: 0,
      notificationProfile: 'alarm',
    });
    dispatch({ type: 'ADD_BLOCK', block });
  }, []);

  const addActivityBlock = useCallback((label: string, startTime: string, endTime: string) => {
    const block = createBlock({
      label,
      kind: 'activity',
      startTime,
      endTime,
      orderIndex: state.draftBlocks.length,
    });
    dispatch({ type: 'ADD_BLOCK', block });
  }, [state.draftBlocks.length]);

  const addSleepBlock = useCallback((startTime?: string) => {
    const block = createBlock({
      label: '',
      kind: 'sleep',
      startTime: startTime ?? DEFAULT_SLEEP_TIME,
      endTime: startTime ?? DEFAULT_SLEEP_TIME,
      orderIndex: state.draftBlocks.length,
      notificationProfile: 'none',
    });
    dispatch({ type: 'ADD_BLOCK', block });
  }, [state.draftBlocks.length]);

  const removeBlock = useCallback((blockId: string) => {
    dispatch({ type: 'REMOVE_BLOCK', blockId });
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<Omit<TimeBlock, 'id'>>) => {
    dispatch({ type: 'UPDATE_BLOCK', blockId, updates });
  }, []);

  const setDraftBlocks = useCallback((blocks: TimeBlock[]) => {
    dispatch({ type: 'SET_DRAFT_BLOCKS', blocks });
  }, []);

  const setCopyTargets = useCallback((days: Weekday[]) => {
    dispatch({ type: 'SET_COPY_TARGETS', days });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: WizardContextValue = {
    state,
    goToStep,
    setTargetDay,
    addWakeBlock,
    addActivityBlock,
    addSleepBlock,
    removeBlock,
    updateBlock,
    setDraftBlocks,
    setCopyTargets,
    reset,
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within DayStructureWizardProvider');
  }
  return context;
}
