/**
 * DIST01 — Continue Wederzijdse Distillatie
 * Type definitions for the Distillation Store (werkgeheugen).
 *
 * Phase 1: Stille Kennisopbouw
 * - Entities (persons, relations)
 * - Signals (triggers, patterns, boundaries, anchor sentences)
 * - Contextual memory (life events, situations, goals)
 *
 * The Distillation Store is a LOCAL, ENCRYPTED intermediate layer
 * between raw user input and the structured documents (backpack, VSP, Eigen Regie Plan).
 * It provides immediate chat continuity without requiring user confirmation.
 */
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';

// ─── Enums ─────────────────────────────────────────────────────────────────

export type DistillationSource =
  | 'chat'
  | 'diary'
  | 'gratitude'
  | 'mood'
  | 'craving_checkin'
  | 'stress_checkin'
  | 'eigen_regie_checkin'
  | 'session_greeting'
  | 'manual_reflection';

export type DistillationConfidence = 'low' | 'medium' | 'high';

export type EntityType = 'person' | 'place' | 'substance' | 'activity' | 'organization';

export type SignalType =
  | 'new_trigger_detected'
  | 'recurring_trigger_detected'
  | 'person_pattern_detected'
  | 'zone_signal_detected'
  | 'boundary_pattern_detected'
  | 'self_care_pattern_detected'
  | 'support_source_detected'
  | 'anchor_sentence_detected'
  | 'risk_pattern_detected'
  | 'protective_pattern_detected'
  | 'life_story_detail_detected';

export type ContextType =
  | 'life_event'
  | 'current_situation'
  | 'goal'
  | 'fear'
  | 'value'
  | 'preference';

export type PromotionStatus =
  | 'in_store'
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'auto_saved'
  | 'suppressed';

// ─── Distilled Entity (persons, relations) ─────────────────────────────────

export interface DistilledEntity {
  id: string;
  persona: RecoFreePersona;
  entityType: EntityType;
  /** Name as mentioned by user (e.g., "Melissa") */
  name: string;
  /** Relationship to user (e.g., "vriendin", "moeder", "therapeut") */
  relation: string | null;
  /** Emotional valence of this entity for the user */
  valence: 'positive' | 'negative' | 'ambivalent' | 'neutral';
  /** First mention timestamp (ISO) */
  firstMentionedAt: string;
  /** Last mention timestamp (ISO) */
  lastMentionedAt: string;
  /** Total number of mentions across all sources */
  mentionCount: number;
  /** Which sources mentioned this entity */
  sources: DistillationSource[];
  /** Session IDs where this entity was mentioned */
  sessionIds: string[];
  /** Max 5 recent context snippets (short excerpts showing how entity was mentioned) */
  contextSnippets: string[];
  /** User has chosen to suppress this entity from being used */
  suppressedByUser: boolean;
}

// ─── Distilled Signal (patterns, triggers, boundaries) ─────────────────────

export interface DistilledSignal {
  id: string;
  persona: RecoFreePersona;
  /** Normalized key for deduplication */
  normalizedPatternKey: string;
  /** What kind of signal this is */
  signalType: SignalType;
  /** Raw user text excerpts (max 5) */
  rawUserTextExcerpts: string[];
  /** Engine-normalized version of the signal */
  normalizedText: string;
  /** How confident the detector is */
  confidence: DistillationConfidence;
  /** First detection timestamp (ISO) */
  firstDetectedAt: string;
  /** Last detection timestamp (ISO) */
  lastDetectedAt: string;
  /** How many times this signal was detected */
  detectionCount: number;
  /** Session IDs where detected */
  detectedAcrossSessionIds: string[];
  /** Local day keys (YYYY-MM-DD) where detected */
  detectedAcrossLocalDayKeys: string[];
  /** Source types where detected */
  sourceTypes: DistillationSource[];
  /** Current promotion status */
  promotionStatus: PromotionStatus;
  /** Whether this signal meets auto-save criteria */
  eligibleForAutoSave: boolean;
  /** User has suppressed this signal */
  suppressedByUser: boolean;
  /** Contradiction with existing document content */
  contradictionFlag: boolean;
}

// ─── Distilled Context (life events, situations, goals) ────────────────────

export interface DistilledContext {
  id: string;
  persona: RecoFreePersona;
  /** What kind of context this is */
  contextType: ContextType;
  /** Short summary (e.g., "Kris werkt als verpleger, nachtdiensten") */
  summary: string;
  /** First mention timestamp (ISO) */
  firstMentionedAt: string;
  /** Last mention timestamp (ISO) */
  lastMentionedAt: string;
  /** Total mention count */
  mentionCount: number;
  /** Sources where this context was mentioned */
  sources: DistillationSource[];
  /** Relevance decay factor (0-1, decreases over time) */
  relevanceDecay: number;
}

// ─── Distillation Store (complete state) ───────────────────────────────────

export interface DistillationStoreData {
  /** Schema version for future migrations */
  schemaVersion: 'dist01.v1';
  /** Which persona this store belongs to */
  persona: RecoFreePersona;
  /** All extracted entities (persons, places, etc.) */
  entities: DistilledEntity[];
  /** All detected signals (triggers, patterns, etc.) */
  signals: DistilledSignal[];
  /** All contextual memory items */
  contexts: DistilledContext[];
  /** Last updated timestamp (ISO) */
  lastUpdatedAt: string;
}

// ─── Detector Input/Output ─────────────────────────────────────────────────

export interface DetectorInput {
  /** The user's text to analyze */
  userText: string;
  /** Where this text came from */
  source: DistillationSource;
  /** Current persona */
  persona: RecoFreePersona;
  /** Current session ID */
  sessionId: string;
  /** Local day key (YYYY-MM-DD) */
  localDayKey: string;
  /** User's name (for filtering self-references) */
  userName: string;
}

export interface DetectorOutput {
  /** Newly detected or updated entities */
  entities: DetectedEntity[];
  /** Newly detected signals */
  signals: DetectedSignal[];
  /** Newly detected context items */
  contexts: DetectedContext[];
}

/** A freshly detected entity (before merge with store) */
export interface DetectedEntity {
  entityType: EntityType;
  name: string;
  relation: string | null;
  valence: 'positive' | 'negative' | 'ambivalent' | 'neutral';
  contextSnippet: string;
  confidence: DistillationConfidence;
}

/** A freshly detected signal (before merge with store) */
export interface DetectedSignal {
  signalType: SignalType;
  rawUserTextExcerpt: string;
  normalizedText: string;
  confidence: DistillationConfidence;
}

/** A freshly detected context item (before merge with store) */
export interface DetectedContext {
  contextType: ContextType;
  summary: string;
  confidence: DistillationConfidence;
}

// ─── Context Injection Output ──────────────────────────────────────────────

export interface DistillationContextForChat {
  /** Known persons with their relations (for continuity: "Hoe gaat het met Melissa?") */
  knownPersons: Array<{
    name: string;
    relation: string | null;
    valence: 'positive' | 'negative' | 'ambivalent' | 'neutral';
    lastMentionedAt: string;
    mentionCount: number;
  }>;
  /** Recent context items relevant to current conversation */
  recentContext: Array<{
    summary: string;
    contextType: ContextType;
    relevance: number;
  }>;
  /** High-confidence signals that inform the chat */
  activeSignals: Array<{
    normalizedText: string;
    signalType: SignalType;
    detectionCount: number;
  }>;
  /** Serialized text block for GPT prompt injection */
  serializedForPrompt: string;
}

// ─── Utility ───────────────────────────────────────────────────────────────

/** Generate a unique ID for store items */
export function generateDistillationId(): string {
  return `dist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create an empty Distillation Store */
export function createEmptyDistillationStore(persona: RecoFreePersona): DistillationStoreData {
  return {
    schemaVersion: 'dist01.v1',
    persona,
    entities: [],
    signals: [],
    contexts: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Normalize a pattern key for deduplication.
 * Removes punctuation, lowercases, removes stopwords, sorts remaining words.
 */
export function normalizePatternKey(text: string): string {
  const stopwords = new Set([
    'ik', 'je', 'jij', 'hij', 'zij', 'we', 'ze', 'het', 'de', 'een', 'en',
    'of', 'maar', 'als', 'dan', 'dat', 'dit', 'die', 'wat', 'wie', 'waar',
    'wanneer', 'hoe', 'er', 'is', 'was', 'ben', 'bent', 'zijn', 'wordt',
    'werd', 'heeft', 'had', 'kan', 'kon', 'wil', 'zou', 'moet', 'mag',
    'niet', 'geen', 'wel', 'ook', 'nog', 'al', 'om', 'te', 'van', 'voor',
    'met', 'op', 'in', 'aan', 'bij', 'naar', 'uit', 'door', 'over', 'na',
    'tot', 'mijn', 'jouw', 'zijn', 'haar', 'ons', 'hun',
    // English stopwords
    'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'that', 'this',
    'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should',
    'not', 'no', 'also', 'to', 'of', 'for', 'with', 'on', 'in', 'at',
    'by', 'from', 'about', 'into', 'through', 'after', 'before',
  ]);

  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopwords.has(w))
    .sort()
    .join(' ');

  return cleaned;
}
