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
import { sanitizeSliders } from './engine/shared/slider-sanitize';
import { checkAndExtract, saveExtractedEntities } from './backpack-extractor/extractor';
import { applyAutoConfirmation } from './engine/shared/tendency-confirmation';
import { callExtractionEndpoint } from './backpack-extractor/client';
import { callBackpackAnalysis } from './backpack-analysis/client';
import { checkAndAnalyzeVspProfile } from './backpack-extractor/vsp-backpack-analyzer';
import { callVspBackpackAnalysis } from './backpack-extractor/vsp-backpack-client';

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
  /** Update a Kim backpack section (Kim users only) */
  updateKimBackpackSection: (sectionId: import('./ai/types').KimBackpackSectionId, content: string) => Promise<void>;
  /** Update the structured VSP section (Elias only) */
  updateVspSection: (vspPlan: import('./ai/types').VspStructuredPlan) => Promise<void>;
  /** Update the balkmetafoor data (Elias only) */
  updateBalkmetafoor: (balkmetafoor: import('@/src/types/balkmetafoor.types').BalkmetafoorData) => Promise<void>;
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
  /** Reload backpack + userDat from AsyncStorage (e.g. after import) */
  reloadFromStorage: () => Promise<void>;
  /** Update Stage of Change in backpack (user action) */
  updateStageOfChange: (stage: import('./ai/types').StageOfChange) => Promise<void>;
  /** Update guidance depth preference (user action) */
  updateGuidanceDepth: (depth: GuidanceDepth) => Promise<void>;
  /** Get current guidance depth */
  getGuidanceDepth: () => GuidanceDepth;
  /** Record Eigen Regie daily reflection (Kim users only) */
  updateEigenRegie: (userInput: number) => Promise<void>;
  /** Get Eigen Regie history */
  getEigenRegieHistory: () => import('./ai/types').EigenRegieEntry[];
  /** Update sobriety date (Elias users only). */
  updateSobrietyDate: (date: string | null) => Promise<void>;
  /** Update last milestone shown date. */
  updateMilestoneShown: (date: string) => Promise<void>;
  /** Accept GDPR consent — stores acceptance in userDat */
  acceptGdpr: () => Promise<void>;
  /** Toggle Clinical Mode (easter egg). */
  toggleClinicalMode: (active: boolean) => Promise<void>;
  /** Update VSP level (Elias users only). Must be called before pipeline start. */
  updateVsp: (level: import('./engine/elias/vsp').VspLevel) => Promise<void>;
  /** Get current VSP level (null if not yet submitted this session) */
  getVsp: () => import('./engine/elias/vsp').VspLevel | null;
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
      const userDat = createNewUserDat(action.payload.userType, action.payload.stageOfChange ?? undefined, action.payload.eigenRegieLevel);
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
          // Re-persist if migration sanitized any entries (idempotent)
          const originalHistory = rawUserDat.moodHistory ?? [];
          const needsRepersist = originalHistory.some((entry: any) =>
            entry?.sliders && Object.keys(entry.sliders).length !== Object.keys(sanitizeSliders(entry.sliders)).length
          );
          if (needsRepersist) {
            await persistUserDat(userDat);
          }
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
            stoaSessionsUsed: [],
            modeTendencies: [],
             schemaTendencies: [],
             actProgress: undefined,
              cgtProgress: undefined,
               dgtProgress: undefined,
               mbtProgress: undefined,
                ko1Progress: undefined,
                k05Progress: undefined,
                k02Progress: undefined,
                k04Progress: undefined,
                k04s4Progress: undefined,
                k06Progress: undefined,
                k01Progress: undefined,
                k03Progress: undefined,
                sw01Progress: undefined,
                gratitudeStreak: 0,
                lastGratitudeDate: null,
                sobrietyDate: null,
                lastMilestoneShown: null,
                clinicalModeActive: false,
                consecutiveSessionsWithoutEngagement: 0,
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

  // ── Backpack Entity Extraction (fire-and-forget on content change) ──

  const triggerExtractionIfNeeded = (updatedBackpack: Backpack) => {
    // Non-blocking: run extraction in background, persist result to userDat
    checkAndExtract(updatedBackpack, callExtractionEndpoint).then((entities) => {
      if (entities && state.userDat) {
        const updatedUserDat = { ...state.userDat, extractedEntities: entities };
        dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
        persistUserDat(updatedUserDat);
      }
    }).catch((err) => {
      console.warn('[UserContext] Extraction failed (non-blocking):', err);
    });

    // Fire-and-forget: trigger backpack deep analysis (GPT-4o) for schema/mode/trigger detection
    const backpackText = updatedBackpack.sections.map(s => `${s.label}: ${s.content}`).join('\n');
    const kimText = updatedBackpack.kimBackpack
      ? Object.entries(updatedBackpack.kimBackpack).map(([k, v]) => `${k}: ${v}`).join('\n')
      : '';
    const fullText = kimText ? `${backpackText}\n\n--- Kim ---\n${kimText}` : backpackText;
    const userId = state.userDat?.userName || 'anonymous';

    callBackpackAnalysis(userId, fullText).then((analysis) => {
      if (analysis && state.userDat) {
        const previousAnalyzedAt = state.userDat.backpackAnalysis?.analyzedAt ?? null;
        const now = new Date().toISOString();
        let updatedUserDat = {
          ...state.userDat,
          backpackAnalysis: { ...analysis, previousAnalyzedAt },
        };

        // Route schemas → schemaTendencies (confidence ≥ 0.35)
        const schemas = (analysis.schemas || []).filter((s: any) => s.confidence >= 0.35);
        if (schemas.length > 0) {
          const existingTendencies = [...(updatedUserDat.schemaTendencies || [])];
          for (const schema of schemas) {
            const schemaId = (schema.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const existingIdx = existingTendencies.findIndex((s: any) => s.schemaId === schemaId);
            if (existingIdx >= 0) {
              // Update existing: moving average confidence, increment frequency
              const existing = existingTendencies[existingIdx];
              existingTendencies[existingIdx] = {
                ...existing,
                frequency: (existing.frequency || 0) + 1,
                lastSeen: now,
                lastUpdatedAt: now,
                confidence: Math.round(((existing.confidence || 0.5) * 0.7 + schema.confidence * 0.3) * 1000) / 1000,
              };
            } else {
              // New schema tendency
              existingTendencies.push({
                schemaId,
                domain: schema.domain || 'unknown',
                frequency: 1,
                lastSeen: now,
                copingStyle: null,
                firstDetectedAt: now,
                lastUpdatedAt: now,
                confidence: schema.confidence,
              });
            }
          }
          // Apply auto-confirmation to schemas meeting threshold (freq≥5 AND conf≥0.7)
          updatedUserDat = { ...updatedUserDat, schemaTendencies: applyAutoConfirmation(existingTendencies, now) };
        }

        // Route modi → modeTendencies (confidence ≥ 0.35)
        const modi = (analysis.modi || []).filter((m: any) => m.confidence >= 0.35);
        if (modi.length > 0) {
          const existingModes = [...(updatedUserDat.modeTendencies || [])];
          for (const mode of modi) {
            const modeId = (mode.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const existingIdx = existingModes.findIndex((m: any) => m.modeId === modeId);
            if (existingIdx >= 0) {
              const existing = existingModes[existingIdx];
              existingModes[existingIdx] = {
                ...existing,
                frequency: (existing.frequency || 0) + 1,
                lastSeen: now,
                lastUpdatedAt: now,
                confidence: Math.round(((existing.confidence || 0.5) * 0.7 + mode.confidence * 0.3) * 1000) / 1000,
              };
            } else {
              existingModes.push({
                modeId,
                frequency: 1,
                lastSeen: now,
                effectiveInterventions: [],
                firstDetectedAt: now,
                lastUpdatedAt: now,
                confidence: mode.confidence,
              });
            }
          }
          // Apply auto-confirmation to modes meeting threshold (freq≥5 AND conf≥0.7)
          updatedUserDat = { ...updatedUserDat, modeTendencies: applyAutoConfirmation(existingModes, now) };
        }

        // Route triggers → triggerPatterns (frequency upsert)
        const triggers = analysis.triggers || [];
        if (triggers.length > 0) {
          const existingTriggers = [...(updatedUserDat.triggerPatterns || [])];
          for (const triggerLabel of triggers) {
            const normalized = (typeof triggerLabel === 'string' ? triggerLabel : triggerLabel.label || '').toLowerCase().trim();
            if (!normalized) continue;
            const existingIdx = existingTriggers.findIndex((t) => t.trigger.toLowerCase() === normalized);
            if (existingIdx >= 0) {
              const existing = existingTriggers[existingIdx];
              existingTriggers[existingIdx] = {
                ...existing,
                count: (existing.count || 0) + 1,
                lastSeen: now,
                lastUpdatedAt: now,
              };
            } else {
              existingTriggers.push({
                trigger: normalized,
                count: 1,
                weight: 10,
                firstSeen: now,
                lastSeen: now,
                firstDetectedAt: now,
                lastUpdatedAt: now,
              });
            }
          }
          updatedUserDat = { ...updatedUserDat, triggerPatterns: existingTriggers };
        }

        console.log(`[BackpackAnalysis] Routed to user.dat: ${schemas.length} schemas → schemaTendencies, ${modi.length} modi → modeTendencies, ${triggers.length} triggers → triggerPatterns`);
        dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
        persistUserDat(updatedUserDat);
      }
    }).catch((err) => {
      console.warn('[UserContext] BackpackAnalysis failed (non-blocking):', err);
    });

    // Fire-and-forget: VSP zone analysis from recurring themes (Elias only)
    const themesSection = updatedBackpack.sections.find((s: any) =>
      s.id === 'recurringThemes' || (s.label && s.label.toLowerCase().includes('recurring'))
    );
    if (themesSection?.content) {
      checkAndAnalyzeVspProfile(themesSection.content, callVspBackpackAnalysis)
        .catch((err) => console.warn('[UserContext] VSP backpack analysis failed:', err));
    }
  };

  // ── Intake ──

  const completeIntake = useCallback(async (data: IntakeData) => {
    if (state.intakeCompleted) {
      console.warn('Intake already completed. userType is immutable.');
      return;
    }
    dispatch({ type: 'COMPLETE_INTAKE', payload: data });
    const backpack = createNewBackpack(data);
    const userDat = createNewUserDat(data.userType, data.stageOfChange ?? undefined, data.eigenRegieLevel);
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
    // Fire-and-forget: trigger extraction if content changed
    triggerExtractionIfNeeded(updatedBackpack);
  }, [state.backpack]);

  // ── Kim Backpack Section — USER ACTION ONLY ──

  const updateKimBackpackSection = useCallback(async (sectionId: import('./ai/types').KimBackpackSectionId, content: string) => {
    if (!state.backpack) return;
    const currentKim = state.backpack.kimBackpack ?? {
      my_story: '',
      the_relationship: '',
      the_impact: '',
      my_boundaries: '',
      my_strength: '',
    };
    const updatedBackpack: Backpack = {
      ...state.backpack,
      kimBackpack: {
        ...currentKim,
        [sectionId]: content,
      },
    };
    dispatch({ type: 'UPDATE_BACKPACK', payload: updatedBackpack });
    await persistBackpack(updatedBackpack);
    // Fire-and-forget: trigger extraction if content changed
    triggerExtractionIfNeeded(updatedBackpack);
  }, [state.backpack]);

  // ── VSP Structured Plan — USER ACTION ONLY ──

  const updateVspSection = useCallback(async (vspPlan: import('./ai/types').VspStructuredPlan) => {
    if (!state.backpack) return;
    const updatedBackpack: Backpack = {
      ...state.backpack,
      vspSection: { ...vspPlan, lastUpdated: new Date().toISOString() },
    };
    dispatch({ type: 'UPDATE_BACKPACK', payload: updatedBackpack });
    await persistBackpack(updatedBackpack);
    // Fire-and-forget: trigger extraction if content changed
    triggerExtractionIfNeeded(updatedBackpack);
  }, [state.backpack]);

  // ── Balkmetafoor (Elias only, qualitative draaglast/draagkracht) ──

  const updateBalkmetafoor = useCallback(async (balkmetafoor: import('@/src/types/balkmetafoor.types').BalkmetafoorData) => {
    if (!state.backpack) return;
    const updatedBackpack: Backpack = {
      ...state.backpack,
      balkmetafoor,
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

  // ── Eigen Regie (Kim only) ──

  const updateEigenRegie = useCallback(async (userInput: number) => {
    if (!state.userDat) return;
    const entry: import('./ai/types').EigenRegieEntry = {
      userInput,
      timestamp: new Date().toISOString(),
    };
    const history = [...(state.userDat.eigenRegieHistory ?? []), entry];
    // Dual write: eigenRegieHistory (storage) + currentMood.eigenRegie (current state)
    const updatedMood = { ...state.userDat.currentMood, eigenRegie: userInput };
    const updatedUserDat: UserDat = { ...state.userDat, eigenRegieHistory: history, currentMood: updatedMood };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const getEigenRegieHistory = useCallback(() => {
    return state.userDat?.eigenRegieHistory ?? [];
  }, [state.userDat]);

  // ── VSP (Elias only) ──

  const updateVsp = useCallback(async (level: import('./engine/elias/vsp').VspLevel) => {
    if (!state.userDat) return;
    // VSP level → numeric score mapping for server payload
    const VSP_SCORE_MAP: Record<string, number> = { GROEN: 1, GEEL: 2, ORANJE: 3, ROOD: 4, PAARS: 5 };
    const vspScore = VSP_SCORE_MAP[level] ?? null;
    // Write VSP string + numeric score to currentMood
    const updatedMood = { ...state.userDat.currentMood, vsp: level, vspScore };
    const updatedUserDat: UserDat = { ...state.userDat, currentMood: updatedMood };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const getVsp = useCallback((): import('./engine/elias/vsp').VspLevel | null => {
    if (!state.userDat) return null;
    const mood = state.userDat.currentMood;
    if ('vsp' in mood) {
      return (mood as import('./ai/types').EliasMoodSliders).vsp;
    }
    return null;
  }, [state.userDat]);

  // ── Guidance Depth ──

  const updateGuidanceDepth = useCallback(async (depth: GuidanceDepth) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = { ...state.userDat, guidanceDepth: depth };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const updateSobrietyDate = useCallback(async (date: string | null) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = { ...state.userDat, sobrietyDate: date };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const updateMilestoneShown = useCallback(async (date: string) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = { ...state.userDat, lastMilestoneShown: date };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const toggleClinicalMode = useCallback(async (active: boolean) => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = { ...state.userDat, clinicalModeActive: active };
    dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  const acceptGdpr = useCallback(async () => {
    if (!state.userDat) return;
    const updatedUserDat: UserDat = {
      ...state.userDat,
      gdprAccepted: true,
      gdprAcceptedAt: new Date().toISOString(),
      gdprVersion: '1.0',
    };
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
      stoaSessionsUsed: state.userDat?.stoaSessionsUsed ?? [],
      modeTendencies: state.userDat?.modeTendencies ?? [],
      schemaTendencies: state.userDat?.schemaTendencies ?? [],
      actProgress: state.userDat?.actProgress ?? undefined,
      cgtProgress: state.userDat?.cgtProgress ?? undefined,
      dgtProgress: state.userDat?.dgtProgress ?? undefined,
      mbtProgress: state.userDat?.mbtProgress ?? undefined,
      ko1Progress: state.userDat?.ko1Progress ?? undefined,
      k05Progress: state.userDat?.k05Progress ?? undefined,
      k02Progress: state.userDat?.k02Progress ?? undefined,
      k04Progress: state.userDat?.k04Progress ?? undefined,
      k04s4Progress: state.userDat?.k04s4Progress ?? undefined,
      k06Progress: state.userDat?.k06Progress ?? undefined,
      k01Progress: state.userDat?.k01Progress ?? undefined,
      k03Progress: state.userDat?.k03Progress ?? undefined,
      sw01Progress: state.userDat?.sw01Progress ?? undefined,
      gratitudeStreak: state.userDat?.gratitudeStreak ?? 0,
      lastGratitudeDate: state.userDat?.lastGratitudeDate ?? null,
      sobrietyDate: state.userDat?.sobrietyDate ?? null,
      lastMilestoneShown: state.userDat?.lastMilestoneShown ?? null,
      clinicalModeActive: state.userDat?.clinicalModeActive ?? false,
      consecutiveSessionsWithoutEngagement: state.userDat?.consecutiveSessionsWithoutEngagement ?? 0,
    };
    dispatch({ type: 'END_SESSION', payload: updatedUserDat });
    await persistUserDat(updatedUserDat);
  }, [state.userDat]);

  // ── End Session (new: accepts UserDat directly) ──

  const endSessionWithUserDat = useCallback(async (updatedUserDat: UserDat) => {
    // Reset VSP/eigenRegie in currentMood so next session starts with a clean thermometer
    const resetMood = { ...updatedUserDat.currentMood };
    if ('vsp' in resetMood) {
      (resetMood as any).vsp = null;
    }
    if ('eigenRegie' in resetMood) {
      (resetMood as any).eigenRegie = null;
    }
    const finalUserDat: UserDat = { ...updatedUserDat, currentMood: resetMood };
    dispatch({ type: 'END_SESSION', payload: finalUserDat });
    await persistUserDat(finalUserDat);
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

  const reloadFromStorage = useCallback(async () => {
    const [backpackJson, userDatJson] = await Promise.all([
      AsyncStorage.getItem(BACKPACK_KEY),
      AsyncStorage.getItem(USERDAT_KEY),
    ]);
    if (backpackJson && userDatJson) {
      const backpack = migrateBackpack(JSON.parse(backpackJson));
      const userDat = migrateUserDat(JSON.parse(userDatJson), backpack.userType);
      dispatch({ type: 'RESTORE_STORES', payload: { backpack, userDat } });
    }
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
        updateKimBackpackSection,
        updateVspSection,
        updateBalkmetafoor,
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
        reloadFromStorage,
        getUserName,
        getMood,
        getChatHistory,
        getUrgency,
        getStartEmotion,
        getBackpack,
        getUserDat,
        updateEigenRegie,
        getEigenRegieHistory,
        updateSobrietyDate,
        updateMilestoneShown,
        acceptGdpr,
        toggleClinicalMode,
        updateVsp,
        getVsp,
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
    kimBackpack: raw.kimBackpack ?? undefined,
    vspSection: raw.vspSection ?? undefined,
  };
}

function migrateUserDat(raw: any, userType: UserType): UserDat {
  // Sanitize existing moodHistory entries: strip non-numeric keys (e.g. vsp string)
  const rawHistory = raw.moodHistory ?? [];
  let sanitizedCount = 0;
  const cleanHistory = rawHistory.map((entry: any) => {
    if (!entry?.sliders) return entry;
    const sanitized = sanitizeSliders(entry.sliders);
    if (Object.keys(sanitized).length !== Object.keys(entry.sliders).length) {
      sanitizedCount++;
    }
    return { ...entry, sliders: sanitized };
  });
  if (sanitizedCount > 0) {
    console.log(`[MIGRATION] Sanitized ${sanitizedCount} moodHistory entries (stripped string VSPs)`);
  }

  return {
    currentMood: raw.currentMood ?? createDefaultSliders(userType),
    moodHistory: cleanHistory,
    chatHistory: raw.chatHistory ?? [],
    moduleUsage: raw.moduleUsage ?? [],
    triggerPatterns: raw.triggerPatterns ?? [],
    totalSessions: raw.totalSessions ?? 0,
    lastSessionDate: raw.lastSessionDate ?? null,
    sessionAnalyses: raw.sessionAnalyses ?? [],
    stageOfChange: raw.stageOfChange ?? 'contemplation' as const,
    eigenRegieHistory: raw.eigenRegieHistory ?? [],
    relationalAnchors: raw.relationalAnchors ?? [],
    lastRelationalPattern: raw.lastRelationalPattern ?? null,
    stoaSessionsUsed: raw.stoaSessionsUsed ?? [],
    modeTendencies: raw.modeTendencies ?? [],
    schemaTendencies: raw.schemaTendencies ?? [],
    actProgress: raw.actProgress ?? undefined,
    cgtProgress: raw.cgtProgress ?? undefined,
    dgtProgress: raw.dgtProgress ?? undefined,
    mbtProgress: raw.mbtProgress ?? undefined,
    ko1Progress: raw.ko1Progress ?? undefined,
    k05Progress: raw.k05Progress ?? undefined,
    k02Progress: raw.k02Progress ?? undefined,
    k04Progress: raw.k04Progress ?? undefined,
    k04s4Progress: raw.k04s4Progress ?? undefined,
    k06Progress: raw.k06Progress ?? undefined,
    k01Progress: raw.k01Progress ?? undefined,
    k03Progress: raw.k03Progress ?? undefined,
    sw01Progress: raw.sw01Progress ?? undefined,
    gratitudeStreak: raw.gratitudeStreak ?? 0,
    lastGratitudeDate: raw.lastGratitudeDate ?? null,
    sobrietyDate: raw.sobrietyDate ?? null,
    lastMilestoneShown: raw.lastMilestoneShown ?? null,
    clinicalModeActive: raw.clinicalModeActive ?? false,
    guidanceDepth: raw.guidanceDepth ?? 'normal',
    consecutiveSessionsWithoutEngagement: raw.consecutiveSessionsWithoutEngagement ?? 0,
    repeatingPatterns: raw.repeatingPatterns ?? [],
    gdprAccepted: raw.gdprAccepted ?? undefined,
    gdprAcceptedAt: raw.gdprAcceptedAt ?? undefined,
    gdprVersion: raw.gdprVersion ?? undefined,
    firstChatSeen: raw.firstChatSeen ?? undefined,
    backpackAnalysis: raw.backpackAnalysis ?? undefined,
    extractedEntities: raw.extractedEntities ?? undefined,
  };
}
