/**
 * LocalSignalEngine — model-agnostic interface for on-device signal detection.
 * No implementation here, only types and contracts.
 */

import type { ProjectionEntry } from '@/lib/engine/elias/projection';
import type { BufferSnapshot } from '@/lib/rugzak/short-term-memory-buffer';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface SignalInput {
  currentMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  bufferSnapshot: BufferSnapshot;
  moodSliders: Record<string, number>;
  projectionEntries: ProjectionEntry[];
  userDatSummary: {
    totalSessions: number;
    recentTriggers: string[];
    dominantModules: string[];
  };
}

export interface ContextInput {
  message: string;
  backpackSections: Array<{ label: string; content: string }>;
  recentDiary: Array<{ content: string; moodTag: string }>;
  triggerPatterns: Array<{ trigger: string; count: number }>;
}

export interface ContextData {
  backpackSections: Array<{ label: string; content: string }>;
  sessionAnalyses: Array<{ dominantEmotion: string; themes: string[] }>;
  projectionEntries: ProjectionEntry[];
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface CandidateSignals {
  fears: Array<{ keyword: string; confidence: number }>;
  hopes: Array<{ keyword: string; confidence: number }>;
  goals: Array<{ keyword: string; confidence: number }>;
  triggers: Array<{ keyword: string; confidence: number }>;
}

export interface RelevanceMap {
  backpackRelevance: number;      // 0-1
  diaryRelevance: number;         // 0-1
  triggerRelevance: number;       // 0-1
  projectionRelevance: number;    // 0-1
}

export interface ContextSummary {
  dominantTheme: string;
  urgencyHint: 'low' | 'medium' | 'high';
  suggestedFocus: string;
}

// ─── The Interface — model-agnostic ──────────────────────────────────────────

export interface LocalSignalEngine {
  detectSignals(input: SignalInput): Promise<CandidateSignals>;
  scoreRelevance(context: ContextInput): Promise<RelevanceMap>;
  summarizeContext(data: ContextData): Promise<ContextSummary>;
  isReady(): boolean;
}
