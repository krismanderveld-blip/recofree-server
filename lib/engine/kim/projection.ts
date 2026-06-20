/**
 * Kim Projection Layer — FUTURE LAYER (Kim variant)
 *
 * Same architecture as Elias projection, but signals are derived from
 * Eigen Regie instead of VSP.
 *
 * Storage: AsyncStorage, local within-device memory only.
 * Key: @recofree_projection_kim
 *
 * Rules:
 *   - NO GPT in signal detection — all detection is deterministic
 *   - NO modification of Backpack
 *   - getKimProjectionSummary() is a pure function — NOT connected to persistence
 *   - User-confirmed entries are never auto-removed
 *   - Eigen Regie signals do NOT affect EliasProjection (strict separation)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ProjectionCategory,
  ProjectionSource,
  ProjectionStrength,
  ProjectionEntry,
  ProjectionSessionSummary,
} from '../elias/projection';

import {
  PROJECTION_ACTIVE_THRESHOLD,
  PROJECTION_MAX_ACTIVE_ENTRIES,
  PROJECTION_DECAY_PER_SESSION,
  PROJECTION_DECAY_FAST,
  PROJECTION_REINFORCE_ON_SIGNAL,
  PROJECTION_STRENGTHEN_ON_ZONE_IMPROVEMENT,
  PROJECTION_MAX_CONTENT_LENGTH,
  FEAR_MARKERS,
  HOPE_MARKERS,
  GOAL_MARKERS,
} from '../elias/projection';

// ─── Kim Projection Type ────────────────────────────────────────

export interface KimProjection {
  readonly userType: 'kim';
  readonly entries: ProjectionEntry[];
  readonly lastUpdatedAt: string;
  readonly sessionSignalCount: number;
}

// ─── AsyncStorage Persistence (local within-device memory, AES-256-GCM encrypted) ─────

import { readEncrypted, writeEncrypted, removeEncrypted } from '@/lib/crypto/storage-encryption';

const KIM_PROJECTION_STORAGE_KEY = '@recofree_projection_kim';

/**
 * Load Kim projection from AsyncStorage (local within-device memory).
 * Returns empty projection on missing key or corrupted data — never crashes.
 */
export async function loadKimProjection(): Promise<KimProjection> {
  try {
    const raw = await readEncrypted(KIM_PROJECTION_STORAGE_KEY);
    if (!raw) {
      return createEmptyKimProjection();
    }
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (
      parsed &&
      parsed.userType === 'kim' &&
      Array.isArray(parsed.entries) &&
      typeof parsed.lastUpdatedAt === 'string'
    ) {
      return parsed as KimProjection;
    }
    console.error('[Projection/Kim] Corrupted data in storage, returning empty projection');
    return createEmptyKimProjection();
  } catch (error) {
    console.error('[Projection/Kim] Failed to load from AsyncStorage:', error);
    return createEmptyKimProjection();
  }
}

/**
 * Save Kim projection to AsyncStorage (local within-device memory).
 * Silently fails on write error — never crashes.
 */
export async function saveKimProjection(projection: KimProjection): Promise<void> {
  try {
    await writeEncrypted(KIM_PROJECTION_STORAGE_KEY, JSON.stringify(projection));
  } catch (error) {
    console.error('[Projection/Kim] Failed to save to AsyncStorage:', error);
  }
}

/**
 * Clear Kim projection from AsyncStorage (local within-device memory).
 * For on-device testing/debugging only. Resets in-memory state as well.
 */
export async function clearKimProjection(): Promise<void> {
  try {
    await removeEncrypted(KIM_PROJECTION_STORAGE_KEY);
    currentProjection = createEmptyKimProjection();
  } catch (error) {
    console.error('[Projection/Kim] Failed to clear AsyncStorage:', error);
  }
}

function createEmptyKimProjection(): KimProjection {
  return {
    userType: 'kim',
    entries: [],
    lastUpdatedAt: new Date().toISOString(),
    sessionSignalCount: 0,
  };
}

// ─── Module State (per-session, resets at session start) ────────

let currentProjection: KimProjection = createEmptyKimProjection();

let sessionNewCount = 0;
let sessionDecayedCount = 0;
let sessionReinforcedIds: Set<string> = new Set();

// ─── State Management ───────────────────────────────────────────

/**
 * Reset Kim projection state (synchronous, for tests and immediate resets).
 * Does NOT load from storage — use loadAndRestoreKimProjection() at session start.
 */
export function resetKimProjectionState(): void {
  currentProjection = createEmptyKimProjection();
  sessionNewCount = 0;
  sessionDecayedCount = 0;
  sessionReinforcedIds = new Set();
}

/**
 * Load persisted Kim projection from AsyncStorage (local within-device memory)
 * and restore it as the active state. Call this at session start.
 * Resets session-specific counters while preserving persisted entries.
 */
export async function loadAndRestoreKimProjection(): Promise<void> {
  currentProjection = await loadKimProjection();
  currentProjection = {
    ...currentProjection,
    sessionSignalCount: 0,
  };
  sessionNewCount = 0;
  sessionDecayedCount = 0;
  sessionReinforcedIds = new Set();
}

export function getKimProjectionState(): KimProjection {
  return currentProjection;
}

export function loadKimProjectionState(state: KimProjection): void {
  currentProjection = state;
  sessionNewCount = 0;
  sessionDecayedCount = 0;
  sessionReinforcedIds = new Set();
}

// ─── Signal Detection ───────────────────────────────────────────

export interface KimProjectionSignalInput {
  message: string;
  eigenRegieScore: number | null;       // 0-100 scale
  consecutiveHighRegieSessions: number; // How many consecutive sessions ER > 70
  distressScore: number;
  resilienceScore: number;
  zoneImproved: boolean;
}

export interface KimProjectionSignalResult {
  newEntries: ProjectionEntry[];
  reinforcedEntryIds: string[];
  totalSignals: number;
}

/**
 * Detect Kim projection signals from message + Eigen Regie + sliders.
 * Deterministic only — NO GPT involvement.
 */
export function detectKimProjectionSignals(input: KimProjectionSignalInput): KimProjectionSignalResult {
  const newEntries: ProjectionEntry[] = [];
  const reinforcedIds: string[] = [];
  const now = new Date().toISOString();
  let signalCount = 0;

  // ── Eigen Regie Signals ──
  if (input.eigenRegieScore !== null && input.eigenRegieScore < 30) {
    const existingFear = findMatchingEntry('fear', ['control', 'autonomy', 'losing control']);
    if (existingFear) {
      reinforceEntry(existingFear.id);
      reinforcedIds.push(existingFear.id);
    } else {
      const entry = createEntry({
        category: 'fear',
        content: 'Fear of losing control',
        source: 'slider_signal',
        strength: 'strong',
        decayScore: 80,
      });
      newEntries.push(entry);
      addEntry(entry);
    }
    signalCount++;
  }

  if (input.consecutiveHighRegieSessions >= 2) {
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

export interface KimDecayResult {
  decayedEntries: number;
  removedEntries: number;
  strengthenedEntries: number;
}

/**
 * Apply Kim projection decay at session end.
 */
export async function applyKimProjectionDecay(sessionTimestamp: string): Promise<KimDecayResult> {
  let decayed = 0;
  let removed = 0;
  let strengthened = 0;

  const updatedEntries: ProjectionEntry[] = [];

  for (const entry of currentProjection.entries) {
    let newDecayScore = entry.decayScore;

    const lastReinforced = new Date(entry.lastReinforcedAt).getTime();
    const sessionTime = new Date(sessionTimestamp).getTime();
    const daysSinceReinforced = Math.floor((sessionTime - lastReinforced) / (24 * 60 * 60 * 1000));
    const sessionsWithoutSignal = daysSinceReinforced;

    if (sessionsWithoutSignal >= 3) {
      newDecayScore += PROJECTION_DECAY_FAST; // -10
      decayed++;
    } else if (!sessionReinforcedIds.has(entry.id)) {
      newDecayScore += PROJECTION_DECAY_PER_SESSION; // -5
      decayed++;
    } else {
      strengthened++;
    }

    newDecayScore = Math.max(0, Math.min(100, newDecayScore));
    const isActive = newDecayScore >= PROJECTION_ACTIVE_THRESHOLD;

    if (newDecayScore === 0 && !entry.isUserConfirmed) {
      removed++;
      continue;
    }

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
  await saveKimProjection(currentProjection);

  return { decayedEntries: decayed, removedEntries: removed, strengthenedEntries: strengthened };
}

// ─── GPT Injection ──────────────────────────────────────────────

/**
 * Build the Kim projection context block for GPT system prompt injection.
 * Returns null if no active entries exist.
 */
export function buildKimProjectionContext(): string | null {
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

  let block = 'FUTURE PERSPECTIVE (KIM):\n';

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

export function getKimProjectionSummary(): ProjectionSessionSummary {
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
  const now = new Date().toISOString();
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
  const now = new Date().toISOString();
  return {
    id: `kproj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
  const sentences = message.split(/[.!?]+/);
  const relevantSentence = sentences.find(s => s.toLowerCase().includes(keyword));
  if (relevantSentence) {
    return relevantSentence.trim().slice(0, PROJECTION_MAX_CONTENT_LENGTH);
  }
  const prefixes: Record<ProjectionCategory, string> = {
    fear: 'Fear related to: ',
    hope: 'Hope related to: ',
    goal: 'Goal related to: ',
  };
  return `${prefixes[category]}${keyword}`;
}
