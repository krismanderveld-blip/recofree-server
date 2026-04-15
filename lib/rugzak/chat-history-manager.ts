/**
 * ChatHistory Manager — Engine Spec V2 Step 3
 *
 * Manages chat history to prevent unbounded growth in AsyncStorage.
 *
 * RULES:
 * - Keep the last N sessions of full chat messages in the active chatHistory
 * - Archive older sessions as compressed summaries (messageCount, themes, date range)
 * - The active chatHistory is what gets sent to GPT via the conversation window
 * - Archived sessions are stored separately and can be referenced but not sent to GPT
 *
 * LIMITS:
 * - MAX_ACTIVE_SESSIONS: 3 (keep full messages from last 3 sessions)
 * - MAX_ACTIVE_MESSAGES: 100 (hard cap on total messages in active history)
 * - MAX_ARCHIVED_SESSIONS: 20 (keep summaries of last 20 older sessions)
 */

import type { ChatMessage } from '../ai/types';

// ─── Configuration ──────────────────────────────────────────────

const MAX_ACTIVE_MESSAGES = 100;
const MAX_ARCHIVED_SESSIONS = 20;

// ─── Types ──────────────────────────────────────────────────────

export interface ArchivedSession {
  sessionNumber: number;
  startDate: string;
  endDate: string;
  messageCount: number;
  userMessageCount: number;
  /** Key themes discussed (max 5) */
  themes: string[];
  /** First user message as preview */
  preview: string;
}

export interface ChatHistoryState {
  /** Active messages — full content, sent to GPT via conversation window */
  activeMessages: ChatMessage[];
  /** Archived sessions — summaries only, not sent to GPT */
  archivedSessions: ArchivedSession[];
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Trim the active chat history to stay within MAX_ACTIVE_MESSAGES.
 * Oldest messages beyond the limit are archived as a session summary.
 */
export function trimChatHistory(
  chatHistory: ChatMessage[],
  existingArchives: ArchivedSession[] = [],
  sessionNumber: number = 0,
): ChatHistoryState {
  if (chatHistory.length <= MAX_ACTIVE_MESSAGES) {
    return {
      activeMessages: chatHistory,
      archivedSessions: existingArchives,
    };
  }

  // Calculate how many messages to archive
  const excessCount = chatHistory.length - MAX_ACTIVE_MESSAGES;

  // Take the oldest messages to archive
  const toArchive = chatHistory.slice(0, excessCount);
  const toKeep = chatHistory.slice(excessCount);

  // Create archive summary from the trimmed messages
  const archive = createArchiveSummary(toArchive, sessionNumber);

  // Add to archives, respecting the max limit
  let updatedArchives = [...existingArchives, archive];
  if (updatedArchives.length > MAX_ARCHIVED_SESSIONS) {
    updatedArchives = updatedArchives.slice(updatedArchives.length - MAX_ARCHIVED_SESSIONS);
  }

  return {
    activeMessages: toKeep,
    archivedSessions: updatedArchives,
  };
}

/**
 * Archive the current session's chat history at session end.
 * Called from endSession in pipeline.ts.
 *
 * This takes the full chatHistory, keeps only the last MAX_ACTIVE_MESSAGES,
 * and archives the rest.
 */
export function archiveSessionHistory(
  chatHistory: ChatMessage[],
  existingArchives: ArchivedSession[] = [],
  sessionNumber: number = 0,
): ChatHistoryState {
  return trimChatHistory(chatHistory, existingArchives, sessionNumber);
}

/**
 * Get a text summary of archived sessions for context.
 * This can be included in the system prompt if needed,
 * but is NOT sent as conversation history.
 */
export function getArchiveSummaryText(archives: ArchivedSession[]): string {
  if (archives.length === 0) return '';

  const lines = archives.map((a) => {
    const date = new Date(a.startDate).toLocaleDateString();
    const themes = a.themes.length > 0 ? a.themes.join(', ') : 'general conversation';
    return `Session ${a.sessionNumber} (${date}): ${a.messageCount} messages, themes: ${themes}`;
  });

  return `Previous sessions summary:\n${lines.join('\n')}`;
}

// ─── Internal Helpers ───────────────────────────────────────────

function createArchiveSummary(
  messages: ChatMessage[],
  sessionNumber: number,
): ArchivedSession {
  const userMessages = messages.filter((m) => m.role === 'user');
  const timestamps = messages
    .map((m) => m.timestamp)
    .filter(Boolean)
    .sort();

  // Extract simple themes from user messages
  const allUserText = userMessages.map((m) => m.content).join(' ').toLowerCase();
  const themes = extractSimpleThemes(allUserText);

  return {
    sessionNumber,
    startDate: timestamps[0] || new Date().toISOString(),
    endDate: timestamps[timestamps.length - 1] || new Date().toISOString(),
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    themes: themes.slice(0, 5),
    preview: userMessages[0]?.content?.slice(0, 100) || '',
  };
}

function extractSimpleThemes(text: string): string[] {
  const themes: string[] = [];
  const themeKeywords: Record<string, string[]> = {
    'craving': ['craving', 'urge', 'want to use', 'temptation', 'verlangen'],
    'relapse': ['relapse', 'used again', 'slipped', 'terugval'],
    'family': ['family', 'partner', 'children', 'parents', 'mother', 'father', 'gezin', 'ouders'],
    'work': ['work', 'job', 'boss', 'colleague', 'werk', 'baan'],
    'emotions': ['angry', 'sad', 'anxious', 'scared', 'lonely', 'boos', 'verdrietig', 'bang'],
    'progress': ['better', 'progress', 'proud', 'achievement', 'milestone', 'trots', 'vooruitgang'],
    'boundaries': ['boundary', 'boundaries', 'say no', 'grenzen', 'nee zeggen'],
    'self-care': ['self-care', 'exercise', 'sleep', 'eating', 'zelfzorg', 'bewegen', 'slapen'],
    'triggers': ['trigger', 'triggered', 'situation', 'stress', 'spanning'],
    'relationships': ['relationship', 'friend', 'trust', 'relatie', 'vertrouwen'],
  };

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      themes.push(theme);
    }
  }

  return themes;
}
