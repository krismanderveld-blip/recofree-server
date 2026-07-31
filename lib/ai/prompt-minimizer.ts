/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RECOFREE — PROMPT MINIMIZATION LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This layer ensures that only locally-approved, minimized intervention text
 * is sent to OpenAI. It strips all forbidden data categories and enforces
 * the language-rendering-only architecture.
 *
 * The server already handles prompt building — this layer validates what
 * the CLIENT sends to the server, ensuring no raw sensitive data leaks.
 *
 * @module prompt-minimizer
 */

import {
  OPENAI_ALLOW_RAW_JOURNAL_UPLOAD,
  OPENAI_ALLOW_RAW_RUGZAK_UPLOAD,
  FORBIDDEN_DATA_CATEGORIES,
} from './gdpr-config';

import type { Backpack, UserDat, ChatMessage } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// MINIMIZATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MinimizedBackpack {
  /** User's first name only (no surname) */
  userName: string;
  /** User type for routing */
  userType: 'elias' | 'kim';
  /** Summarized life context (max 500 chars) */
  contextSummary: string;
  /** Active trigger keywords only (no full descriptions) */
  activeTriggers: string[];
  /** Core wound label (single keyword) */
  coreWound: string | null;
}

export interface MinimizedUserDat {
  /** Current mood snapshot (latest only) */
  currentMood: { score: number; label: string } | null;
  /** Session count (number only) */
  totalSessions: number;
  /** Active trigger patterns (keywords only) */
  triggerKeywords: string[];
  /** Stage of change label */
  stageOfChange: string;
}

export interface MinimizedDiaryEntry {
  /** Date of entry */
  date: string;
  /** Mood tag only */
  moodTag: string;
  /** First 100 chars of content (no full text) */
  preview: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MINIMIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimize backpack data for OpenAI consumption.
 * Strips full life story, keeping only therapeutically relevant keywords.
 */
export function minimizeBackpack(backpack: Backpack | null | undefined): MinimizedBackpack | null {
  if (!backpack) return null;

  // Extract trigger keywords from sections (max 5)
  const triggers: string[] = [];
  if (backpack.sections) {
    for (const section of backpack.sections) {
      if (section.content && section.content.length > 0) {
        // Extract first sentence as context hint (no full content)
        const firstSentence = section.content.split(/[.!?]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 5 && triggers.length < 5) {
          triggers.push(firstSentence.substring(0, 60));
        }
      }
    }
  }

  // Build context summary (max 500 chars from intake context)
  const contextSummary = backpack.intakeContext?.initialContext
    ? backpack.intakeContext.initialContext.substring(0, 500)
    : '';

  return {
    userName: backpack.naam || 'User',
    userType: backpack.userType as 'elias' | 'kim',
    contextSummary,
    activeTriggers: triggers,
    coreWound: null, // Derived locally, not from raw data
  };
}

/**
 * Minimize user.dat for OpenAI consumption.
 * Strips full history, keeping only current state indicators.
 */
export function minimizeUserDat(userDat: UserDat | null | undefined): MinimizedUserDat | null {
  if (!userDat) return null;

  const latestMood = userDat.moodHistory && userDat.moodHistory.length > 0
    ? userDat.moodHistory[userDat.moodHistory.length - 1]
    : null;

  const triggerKeywords = (userDat.triggerPatterns || [])
    .slice(0, 5)
    .map(t => (t as any).trigger || (t as any).keyword || '')
    .filter(Boolean);

  return {
    currentMood: latestMood
      ? { score: (latestMood as any).overallScore ?? 0, label: (latestMood as any).dominantEmotion ?? 'unknown' }
      : null,
    totalSessions: userDat.totalSessions || 0,
    triggerKeywords,
    stageOfChange: userDat.stageOfChange || 'contemplation',
  };
}

/**
 * Minimize diary entries for OpenAI consumption.
 * Only sends date + mood tag + 100-char preview. Never full content.
 */
export function minimizeDiaryEntries(
  entries: Array<{ date?: string; moodTag?: string; content?: string }> | null | undefined,
  maxEntries = 3,
): MinimizedDiaryEntry[] {
  if (!entries || entries.length === 0) return [];

  return entries.slice(-maxEntries).map(entry => ({
    date: entry.date || 'unknown',
    moodTag: entry.moodTag || 'neutral',
    preview: (entry.content || '').substring(0, 100),
  }));
}

/**
 * Minimize conversation history for OpenAI consumption.
 * Keeps only the last N messages (no full session history).
 */
export function minimizeConversationHistory(
  history: ChatMessage[] | null | undefined,
  maxMessages = 10,
): ChatMessage[] {
  if (!history || history.length === 0) return [];
  return history.slice(-maxMessages);
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION — ensures no forbidden data slips through
// ═══════════════════════════════════════════════════════════════════════════

export interface MinimizationValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validate that a payload does not contain forbidden data categories.
 * This is a safety net — should never trigger if minimization is applied correctly.
 */
export function validatePayloadMinimization(payload: Record<string, unknown>): MinimizationValidationResult {
  const violations: string[] = [];

  // Check: raw journal must not be present
  if (!OPENAI_ALLOW_RAW_JOURNAL_UPLOAD) {
    const diaryEntries = payload.diaryEntries as Array<{ content?: string }> | undefined;
    if (diaryEntries && diaryEntries.some(e => e.content && e.content.length > 100)) {
      violations.push('full_journal_history: diary entry content exceeds 100 chars (raw upload detected)');
    }
  }

  // Check: raw rugzak must not be present
  if (!OPENAI_ALLOW_RAW_RUGZAK_UPLOAD) {
    const backpack = payload.backpack as { sections?: Array<{ content?: string }> } | undefined;
    if (backpack?.sections) {
      const totalContent = backpack.sections.reduce((sum, s) => sum + (s.content?.length || 0), 0);
      if (totalContent > 1000) {
        violations.push('full_rugzak_life_story: backpack sections exceed 1000 chars total (raw upload detected)');
      }
    }
  }

  // Check: no complete user profile (full chatHistory)
  const userDat = payload.userDat as { chatHistory?: unknown[] } | undefined;
  if (userDat?.chatHistory && (userDat.chatHistory as unknown[]).length > 20) {
    violations.push('complete_user_profile: userDat contains full chatHistory (>20 messages)');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
