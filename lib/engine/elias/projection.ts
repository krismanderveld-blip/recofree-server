/**
 * Elias Projection Layer — FUTURE LAYER
 *
 * Captures how the user sees their own future: fears, hopes, goals.
 * This layer gives RecoFree a third temporal dimension (future-facing).
 *
 * Architecture:
 *   - Backpack = deep past (stable identity, never modified)
 *   - UserDat  = recent past (session patterns, mood history, triggers)
 *   - Buffer   = present moment (live session state)
 *   - ProjectionDat = future-facing (fears, hopes, goals)
 *
 * Storage: AsyncStorage, local within-device memory only.
 * Key: @recofree_projection_elias
 *
 * Rules:
 *   - NO GPT in signal detection — all detection is deterministic
 *   - NO modification of Backpack
 *   - getProjectionSummary() is a pure function — NOT connected to persistence
 *   - User-confirmed entries are never auto-removed
 *   - Sessions without signal derived from lastReinforcedAt vs session timestamp
 */

// ─── Types (shared, defined here as spec requires) ──────────────

export type ProjectionCategory = 'fear' | 'hope' | 'goal';

export type ProjectionSource =
  | 'user_explicit'     // User typed or selected it directly
  | 'slider_signal'     // Derived from mood/VSP/Eigen Regie pattern
  | 'chat_signal'       // Detected from chat message content
  | 'session_pattern';  // Promoted from repeated session signals

export type ProjectionStrength = 'weak' | 'moderate' | 'strong';

export interface ProjectionEntry {
  readonly id: string;
  readonly category: ProjectionCategory;
  readonly content: string;               // Max 200 chars
  readonly source: ProjectionSource;
  readonly strength: ProjectionStrength;
  readonly decayScore: number;            // 0-100. 100 = fully active. 0 = faded.
  readonly firstSeenAt: string;           // ISO timestamp
  readonly lastReinforcedAt: string;      // ISO timestamp
  readonly reinforcementCount: number;
  readonly isUserConfirmed: boolean;
  readonly isActive: boolean;             // decayScore >= PROJECTION_ACTIVE_THRESHOLD
}

export interface EliasProjection {
  readonly userType: 'elias';
  readonly entries: ProjectionEntry[];
  readonly lastUpdatedAt: string;
  readonly sessionSignalCount: number;
}

export interface ProjectionSessionSummary {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly dominantCategory: ProjectionCategory | null;
  readonly strongestFear: ProjectionEntry | null;
  readonly strongestHope: ProjectionEntry | null;
  readonly activeGoals: ProjectionEntry[];
  readonly newThisSession: number;
  readonly decayedThisSession: number;
}

// ─── Constants ──────────────────────────────────────────────────

export const PROJECTION_ACTIVE_THRESHOLD = 20;
export const PROJECTION_MAX_ACTIVE_ENTRIES = 5;
export const PROJECTION_DECAY_PER_SESSION = -5;
export const PROJECTION_DECAY_FAST = -10;
export const PROJECTION_REINFORCE_ON_SIGNAL = 15;
export const PROJECTION_STRENGTHEN_ON_ZONE_IMPROVEMENT = 10;
export const PROJECTION_MAX_CONTENT_LENGTH = 200;
export const PROJECTION_PROMOTION_THRESHOLD = 2;

// ─── Keyword Maps ───────────────────────────────────────────────

export const FEAR_MARKERS = [
  // English
  'afraid', 'anxiety', 'fear', 'suppose that', 'what if', 'scared',
  'terrified', 'worried', 'dread', 'never better', 'goes wrong', 'fails',
  // Dutch
  'bang', 'angst', 'angstig', 'zorgen', 'bezorgd', 'vrees', 'paniek',
  'stel dat', 'wat als', 'doodsbang', 'schrik', 'ongerust',
  'gaat fout', 'mislukt', 'nooit meer goed',
];

export const HOPE_MARKERS = [
  // English
  'hope', 'would like', 'dream', 'if it works', 'someday',
  'get better', 'wish', 'maybe one day', 'if things change',
  // Dutch
  'hoop', 'zou willen', 'droom', 'als het lukt', 'ooit',
  'beter worden', 'wens', 'misschien op een dag', 'als het verandert',
];

export const GOAL_MARKERS = [
  // English
  'want to', 'going to', 'plan', 'will try', 'goal',
  'target', 'aim', 'intend', 'commit', 'decide',
  // Dutch
  'wil ik', 'ga ik', 'plan', 'ga proberen', 'doel',
  'voornemen', 'van plan', 'besluit', 'neem me voor',
];

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── AsyncStorage Persistence (local within-device memory, AES-256-GCM encrypted) ─────

import { readEncrypted, writeEncrypted, removeEncrypted } from '@/lib/crypto/storage-encryption';
import { LocalDeviceTimeService } from "@/lib/core/time";

const ELIAS_PROJECTION_STORAGE_KEY = '@recofree_projection_elias';

/**
 * Load Elias projection from AsyncStorage (local within-device memory).
 * Returns empty projection on missing key or corrupted data — never crashes.
 */
export async function loadEliasProjection(): Promise<EliasProjection> {
  try {
    const raw = await readEncrypted(ELIAS_PROJECTION_STORAGE_KEY);
    if (!raw) {
      return createEmptyEliasProjection();
    }
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (
      parsed &&
      parsed.userType === 'elias' &&
      Array.isArray(parsed.entries) &&
      typeof parsed.lastUpdatedAt === 'string'
    ) {
      return parsed as EliasProjection;
    }
    console.error('[Projection/Elias] Corrupted data in storage, returning empty projection');
    return createEmptyEliasProjection();
  } catch (error) {
    console.error('[Projection/Elias] Failed to load from AsyncStorage:', error);
    return createEmptyEliasProjection();
  }
}

/**
 * Save Elias projection to AsyncStorage (local within-device memory).
 * Silently fails on write error — never crashes.
 */
export async function saveEliasProjection(projection: EliasProjection): Promise<void> {
  try {
    await writeEncrypted(ELIAS_PROJECTION_STORAGE_KEY, JSON.stringify(projection));
  } catch (error) {
    console.error('[Projection/Elias] Failed to save to AsyncStorage:', error);
  }
}

/**
 * Clear Elias projection from AsyncStorage (local within-device memory).
 * For on-device testing/debugging only. Resets in-memory state as well.
 */
export async function clearEliasProjection(): Promise<void> {
  try {
    await removeEncrypted(ELIAS_PROJECTION_STORAGE_KEY);
    currentProjection = createEmptyEliasProjection();
  } catch (error) {
    console.error('[Projection/Elias] Failed to clear AsyncStorage:', error);
  }
}

function createEmptyEliasProjection(): EliasProjection {
  return {
    userType: 'elias',
    entries: [],
    lastUpdatedAt: LocalDeviceTimeService.now().utcIso,
    sessionSignalCount: 0,
  };
}

// ─── Module State (per-session, resets at session start) ────────

let currentProjection: EliasProjection = createEmptyEliasProjection();

let sessionNewCount = 0;
let sessionDecayedCount = 0;

// ─── State Management ───────────────────────────────────────────

/**
 * Reset projection state (synchronous, for tests and immediate resets).
 * Does NOT load from storage — use loadAndRestoreEliasProjection() at session start.
 */
export function resetProjectionState(): void {
  currentProjection = createEmptyEliasProjection();
  sessionNewCount = 0;
  sessionDecayedCount = 0;
}

/**
 * Load persisted projection from AsyncStorage (local within-device memory)
 * and restore it as the active state. Call this at session start.
 * Resets session-specific counters while preserving persisted entries.
 */
export async function loadAndRestoreEliasProjection(): Promise<void> {
  currentProjection = await loadEliasProjection();
  // Reset session-specific counters (entries persist, counters don't)
  currentProjection = {
    ...currentProjection,
    sessionSignalCount: 0,
  };
  sessionNewCount = 0;
  sessionDecayedCount = 0;
}

export function getProjectionState(): EliasProjection {
  return currentProjection;
}

export function loadProjectionState(state: EliasProjection): void {
  currentProjection = state;
  sessionNewCount = 0;
  sessionDecayedCount = 0;
}

// ─── Signal Detection ───────────────────────────────────────────

export interface ProjectionSignalInput {
  message: string;
  vspLevel: string | null;         // 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | null
  distressScore: number;
  resilienceScore: number;
  consecutiveGreenSessions: number; // How many consecutive sessions VSP was GROEN
  zoneImproved: boolean;            // Zone severity decreased this turn
}

export interface ProjectionSignalResult {
  newEntries: ProjectionEntry[];
  reinforcedEntryIds: string[];
  totalSignals: number;
}

/**
 * Detect projection signals from message + sliders + VSP.
 * Deterministic only — NO GPT involvement.
 */
export function detectProjectionSignals(input: ProjectionSignalInput): ProjectionSignalResult {
  const newEntries: ProjectionEntry[] = [];
  const reinforcedIds: string[] = [];
  const now = LocalDeviceTimeService.now().utcIso;
  let signalCount = 0;

  // ── VSP Signals ──
  if (input.vspLevel === 'ROOD' || input.vspLevel === 'PAARS') {
    const existingFear = findMatchingEntry('fear', ['relapse', 'crisis', 'fall back']);
    if (existingFear) {
      reinforceEntry(existingFear.id);
      reinforcedIds.push(existingFear.id);
    } else {
      const entry = createEntry({
        category: 'fear',
        content: 'Fear of relapse or crisis',
        source: 'slider_signal',
        strength: 'strong',
        decayScore: 80,
      });
      newEntries.push(entry);
      addEntry(entry);
    }
    signalCount++;
  }

  if (input.consecutiveGreenSessions >= 3) {
    // Reinforce active hope entries
    const activeHopes = currentProjection.entries.filter(e => e.category === 'hope' && e.isActive);
    for (const hope of activeHopes) {
      reinforceEntry(hope.id);
      reinforcedIds.push(hope.id);
    }
    if (activeHopes.length > 0) signalCount++;
  }

  // ── Mood Slider Signals ──
  if (input.distressScore > 7 && input.resilienceScore < 3) {
    const activeFears = currentProjection.entries.filter(e => e.category === 'fear' && e.isActive);
    for (const fear of activeFears) {
      reinforceEntry(fear.id);
      reinforcedIds.push(fear.id);
    }
    if (activeFears.length > 0) signalCount++;
  }

  // ── Chat Message Signals ──
  const messageLower = input.message.toLowerCase();

  const detectedFear = FEAR_MARKERS.find(m => messageLower.includes(m));
  if (detectedFear) {
    const existing = findMatchingEntryByKeyword('fear', detectedFear);
    if (existing) {
      reinforceEntry(existing.id);
      reinforcedIds.push(existing.id);
    } else {
      const content = extractProjectionContent(input.message, detectedFear, 'fear');
      const entry = createEntry({
        category: 'fear',
        content,
        source: 'chat_signal',
        strength: 'weak',
        decayScore: 40,
      });
      newEntries.push(entry);
      addEntry(entry);
    }
    signalCount++;
  }

  const detectedHope = HOPE_MARKERS.find(m => messageLower.includes(m));
  if (detectedHope) {
    const existing = findMatchingEntryByKeyword('hope', detectedHope);
    if (existing) {
      reinforceEntry(existing.id);
      reinforcedIds.push(existing.id);
    } else {
      const content = extractProjectionContent(input.message, detectedHope, 'hope');
      const entry = createEntry({
        category: 'hope',
        content,
        source: 'chat_signal',
        strength: 'weak',
        decayScore: 40,
      });
      newEntries.push(entry);
      addEntry(entry);
    }
    signalCount++;
  }

  const detectedGoal = GOAL_MARKERS.find(m => messageLower.includes(m));
  if (detectedGoal) {
    const existing = findMatchingEntryByKeyword('goal', detectedGoal);
    if (existing) {
      reinforceEntry(existing.id);
      reinforcedIds.push(existing.id);
    } else {
      const content = extractProjectionContent(input.message, detectedGoal, 'goal');
      const entry = createEntry({
        category: 'goal',
        content,
        source: 'chat_signal',
        strength: 'weak',
        decayScore: 40,
      });
      newEntries.push(entry);
      addEntry(entry);
    }
    signalCount++;
  }

  // ── Zone Improvement → Strengthen Hope ──
  if (input.zoneImproved) {
    const activeHopes = currentProjection.entries.filter(e => e.category === 'hope' && e.isActive);
    for (const hope of activeHopes) {
      strengthenHopeOnZoneImprovement(hope.id);
      reinforcedIds.push(hope.id);
    }
    if (activeHopes.length > 0) signalCount++;
  }

  // Update session signal count
  currentProjection = {
    ...currentProjection,
    sessionSignalCount: currentProjection.sessionSignalCount + signalCount,
    lastUpdatedAt: now,
  };
  sessionNewCount += newEntries.length;

  return {
    newEntries,
    reinforcedEntryIds: [...new Set(reinforcedIds)],
    totalSignals: signalCount,
  };
}

// ─── Decay Engine (called at session end) ───────────────────────

export interface DecayResult {
  decayedEntries: number;
  removedEntries: number;
  strengthenedEntries: number;
}

/**
 * Apply projection decay at session end.
 * Same timing as UserDat promotion.
 */
export async function applyProjectionDecay(sessionTimestamp: string): Promise<DecayResult> {
  let decayed = 0;
  let removed = 0;
  let strengthened = 0;

  const updatedEntries: ProjectionEntry[] = [];

  for (const entry of currentProjection.entries) {
    let newDecayScore = entry.decayScore;

    // Calculate sessions without signal from lastReinforcedAt
    const lastReinforced = new Date(entry.lastReinforcedAt).getTime();
    const sessionTime = new Date(sessionTimestamp).getTime();
    // Approximate sessions without signal: 1 session ≈ 1 day (conservative)
    const daysSinceReinforced = Math.floor((sessionTime - lastReinforced) / (24 * 60 * 60 * 1000));
    const sessionsWithoutSignal = daysSinceReinforced;

    if (sessionsWithoutSignal >= 3) {
      newDecayScore += PROJECTION_DECAY_FAST; // -10
      decayed++;
    } else if (!wasReinforcedThisSession(entry.id)) {
      newDecayScore += PROJECTION_DECAY_PER_SESSION; // -5
      decayed++;
    } else {
      // Was reinforced this session — already handled by signal detection
      strengthened++;
    }

    // Clamp to 0-100
    newDecayScore = Math.max(0, Math.min(100, newDecayScore));
    const isActive = newDecayScore >= PROJECTION_ACTIVE_THRESHOLD;

    // Remove entries at 0 that are not user-confirmed
    if (newDecayScore === 0 && !entry.isUserConfirmed) {
      removed++;
      continue; // Don't add to updatedEntries
    }

    // Track deactivation
    if (entry.isActive && !isActive) {
      sessionDecayedCount++;
    }

    updatedEntries.push({
      ...entry,
      decayScore: newDecayScore,
      isActive,
    });
  }

  currentProjection = {
    ...currentProjection,
    entries: updatedEntries,
    lastUpdatedAt: sessionTimestamp,
  };

  // Persist after decay (local within-device memory)
  await saveEliasProjection(currentProjection);

  return { decayedEntries: decayed, removedEntries: removed, strengthenedEntries: strengthened };
}

// ─── GPT Injection ──────────────────────────────────────────────

/**
 * Build the projection context block for GPT system prompt injection.
 * Returns null if no active entries exist.
 * Maximum PROJECTION_MAX_ACTIVE_ENTRIES entries, sorted by strength DESC, decayScore DESC.
 */
export function buildProjectionContext(): string | null {
  const activeEntries = currentProjection.entries
    .filter(e => e.isActive)
    .sort((a, b) => {
      const strengthOrder = { strong: 3, moderate: 2, weak: 1 };
      const sDiff = strengthOrder[b.strength] - strengthOrder[a.strength];
      if (sDiff !== 0) return sDiff;
      return b.decayScore - a.decayScore;
    })
    .slice(0, PROJECTION_MAX_ACTIVE_ENTRIES);

  if (activeEntries.length === 0) return null;

  const fears = activeEntries.filter(e => e.category === 'fear');
  const hopes = activeEntries.filter(e => e.category === 'hope');
  const goals = activeEntries.filter(e => e.category === 'goal');

  let block = 'FUTURE PERSPECTIVE:\n';

  if (fears.length > 0) {
    block += fears.map(f => `- Active fear: ${f.content} (strength: ${f.strength})`).join('\n') + '\n';
  }
  if (hopes.length > 0) {
    block += hopes.map(h => `- Active hope: ${h.content} (strength: ${h.strength})`).join('\n') + '\n';
  }
  if (goals.length > 0) {
    block += goals.map(g => `- Active goal: ${g.content} (strength: ${g.strength})`).join('\n') + '\n';
  }

  block += '- Instruction: Use this as background context. Do not mention unless relevant.\n';
  block += '  If the user themselves refers to the future: deepen carefully.\n';
  block += '  If the user deflects: respect this fully, do not force.';

  return block;
}

// ─── Session Summary (pure function) ────────────────────────────

export function getProjectionSummary(): ProjectionSessionSummary {
  const entries = currentProjection.entries;
  const active = entries.filter(e => e.isActive);

  const categoryCounts: Record<ProjectionCategory, number> = { fear: 0, hope: 0, goal: 0 };
  for (const e of active) {
    categoryCounts[e.category]++;
  }

  let dominantCategory: ProjectionCategory | null = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat as ProjectionCategory;
    }
  }

  const activeFears = active.filter(e => e.category === 'fear');
  const activeHopes = active.filter(e => e.category === 'hope');
  const activeGoals = active.filter(e => e.category === 'goal');

  const strongestFear = activeFears.length > 0
    ? activeFears.sort((a, b) => b.decayScore - a.decayScore)[0]
    : null;
  const strongestHope = activeHopes.length > 0
    ? activeHopes.sort((a, b) => b.decayScore - a.decayScore)[0]
    : null;

  return {
    totalEntries: entries.length,
    activeEntries: active.length,
    dominantCategory,
    strongestFear,
    strongestHope,
    activeGoals,
    newThisSession: sessionNewCount,
    decayedThisSession: sessionDecayedCount,
  };
}

// ─── Internal Helpers ───────────────────────────────────────────

let sessionReinforcedIds: Set<string> = new Set();

function wasReinforcedThisSession(id: string): boolean {
  return sessionReinforcedIds.has(id);
}

function findMatchingEntry(category: ProjectionCategory, keywords: string[]): ProjectionEntry | undefined {
  return currentProjection.entries.find(e =>
    e.category === category &&
    keywords.some(kw => e.content.toLowerCase().includes(kw))
  );
}

function findMatchingEntryByKeyword(category: ProjectionCategory, keyword: string): ProjectionEntry | undefined {
  return currentProjection.entries.find(e =>
    e.category === category &&
    e.content.toLowerCase().includes(keyword)
  );
}

function reinforceEntry(id: string): void {
  const now = LocalDeviceTimeService.now().utcIso;
  currentProjection = {
    ...currentProjection,
    entries: currentProjection.entries.map(e =>
      e.id === id
        ? {
            ...e,
            lastReinforcedAt: now,
            reinforcementCount: e.reinforcementCount + 1,
            decayScore: Math.min(100, e.decayScore + PROJECTION_REINFORCE_ON_SIGNAL),
            isActive: true,
            strength: e.reinforcementCount + 1 >= 5 ? 'strong' : e.reinforcementCount + 1 >= 3 ? 'moderate' : e.strength,
          }
        : e
    ),
  };
  sessionReinforcedIds.add(id);
}

function strengthenHopeOnZoneImprovement(id: string): void {
  currentProjection = {
    ...currentProjection,
    entries: currentProjection.entries.map(e =>
      e.id === id
        ? {
            ...e,
            decayScore: Math.min(100, e.decayScore + PROJECTION_STRENGTHEN_ON_ZONE_IMPROVEMENT),
            isActive: true,
          }
        : e
    ),
  };
  sessionReinforcedIds.add(id);
}

function createEntry(params: {
  category: ProjectionCategory;
  content: string;
  source: ProjectionSource;
  strength: ProjectionStrength;
  decayScore: number;
}): ProjectionEntry {
  const now = LocalDeviceTimeService.now().utcIso;
  return {
    id: `proj_${LocalDeviceTimeService.now().epochMs}_${Math.random().toString(36).slice(2, 8)}`,
    category: params.category,
    content: params.content.slice(0, PROJECTION_MAX_CONTENT_LENGTH),
    source: params.source,
    strength: params.strength,
    decayScore: params.decayScore,
    firstSeenAt: now,
    lastReinforcedAt: now,
    reinforcementCount: 1,
    isUserConfirmed: params.source === 'user_explicit',
    isActive: params.decayScore >= PROJECTION_ACTIVE_THRESHOLD,
  };
}

function addEntry(entry: ProjectionEntry): void {
  currentProjection = {
    ...currentProjection,
    entries: [...currentProjection.entries, entry],
  };
}

function extractProjectionContent(message: string, keyword: string, category: ProjectionCategory): string {
  // Extract the sentence containing the keyword (up to 200 chars)
  const sentences = message.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => s.toLowerCase().includes(keyword));
  if (relevantSentence) {
    return relevantSentence.trim().slice(0, PROJECTION_MAX_CONTENT_LENGTH);
  }
  // Fallback: use the keyword itself with category prefix
  const prefixes: Record<ProjectionCategory, string> = {
    fear: 'Fear related to: ',
    hope: 'Hope related to: ',
    goal: 'Goal related to: ',
  };
  return `${prefixes[category]}${keyword}`;
}

// Reset session-specific tracking (call at session start alongside resetProjectionState)
export function resetSessionTracking(): void {
  sessionReinforcedIds = new Set();
  sessionNewCount = 0;
  sessionDecayedCount = 0;
}
