/**
 * DIST01 — Distillation Store
 *
 * Encrypted local persistence layer for the distillation data.
 * Follows the same pattern as userDatStore.ts:
 * - Uses atomicJsonStore (readJson/writeJson) for encrypted storage
 * - Key path: recofree_memory/{persona}/distillation.dat
 * - Automatically encrypted via SessionMemoryCache (same as user.dat, state.dat)
 *
 * The store provides:
 * - load/save for full store state
 * - merge helpers for entities, signals, and contexts
 * - deduplication on merge
 * - size limits (max 100 entities, 200 signals, 50 contexts)
 */
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';
import type {
  DistillationStoreData,
  DistilledEntity,
  DistilledSignal,
  DistilledContext,
  DetectedEntity,
  DetectedSignal,
  DetectedContext,
  DistillationSource,
} from './dist01-types';
import {
  createEmptyDistillationStore,
  generateDistillationId,
  normalizePatternKey,
} from './dist01-types';
import { readJson, writeJson } from '@/lib/storage/memory/atomicJsonStore';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_ENTITIES = 100;
const MAX_SIGNALS = 200;
const MAX_CONTEXTS = 50;
const MAX_CONTEXT_SNIPPETS_PER_ENTITY = 5;
const MAX_RAW_EXCERPTS_PER_SIGNAL = 5;
const MAX_SESSION_IDS_PER_SIGNAL = 10;

// ─── Key Path ──────────────────────────────────────────────────────────────

function getDistillationKey(persona: RecoFreePersona): string {
  return `recofree_memory/${persona}/distillation.dat`;
}

// ─── Store Interface ───────────────────────────────────────────────────────

export interface DistillationStore {
  load(persona: RecoFreePersona): Promise<DistillationStoreData>;
  save(data: DistillationStoreData): Promise<void>;
  mergeDetections(
    store: DistillationStoreData,
    entities: DetectedEntity[],
    signals: DetectedSignal[],
    contexts: DetectedContext[],
    source: DistillationSource,
    sessionId: string,
    localDayKey: string,
  ): DistillationStoreData;
  getEntity(store: DistillationStoreData, name: string): DistilledEntity | undefined;
  getSignalsByType(store: DistillationStoreData, signalType: string): DistilledSignal[];
  getRecentEntities(store: DistillationStoreData, limit?: number): DistilledEntity[];
  getHighConfidenceSignals(store: DistillationStoreData): DistilledSignal[];
}

// ─── Implementation ────────────────────────────────────────────────────────

export function createDistillationStore(): DistillationStore {
  return {
    async load(persona) {
      const key = getDistillationKey(persona);
      const existing = await readJson<DistillationStoreData>(key);
      if (existing && existing.schemaVersion === 'dist01.v1') {
        return existing;
      }
      // Initialize empty
      const empty = createEmptyDistillationStore(persona);
      await writeJson(key, empty);
      return empty;
    },

    async save(data) {
      const key = getDistillationKey(data.persona);
      data.lastUpdatedAt = new Date().toISOString();
      await writeJson(key, data);
    },

    mergeDetections(store, entities, signals, contexts, source, sessionId, localDayKey) {
      const now = new Date().toISOString();
      let updatedEntities = [...store.entities];
      let updatedSignals = [...store.signals];
      let updatedContexts = [...store.contexts];

      // ── Merge Entities ──────────────────────────────────────────────
      for (const detected of entities) {
        const existingIdx = updatedEntities.findIndex(
          (e) => e.name.toLowerCase() === detected.name.toLowerCase() && e.entityType === detected.entityType
        );

        if (existingIdx >= 0) {
          // Update existing entity
          const existing = updatedEntities[existingIdx];
          updatedEntities[existingIdx] = {
            ...existing,
            lastMentionedAt: now,
            mentionCount: existing.mentionCount + 1,
            // Update relation if new one is more specific
            relation: detected.relation || existing.relation,
            // Update valence if new detection is not neutral
            valence: detected.valence !== 'neutral' ? detected.valence : existing.valence,
            // Add source if new
            sources: existing.sources.includes(source) ? existing.sources : [...existing.sources, source],
            // Add session if new
            sessionIds: existing.sessionIds.includes(sessionId)
              ? existing.sessionIds
              : [...existing.sessionIds.slice(-9), sessionId],
            // Add context snippet (max 5)
            contextSnippets: [
              detected.contextSnippet,
              ...existing.contextSnippets,
            ].slice(0, MAX_CONTEXT_SNIPPETS_PER_ENTITY),
          };
        } else {
          // New entity
          updatedEntities.push({
            id: generateDistillationId(),
            persona: store.persona,
            entityType: detected.entityType,
            name: detected.name,
            relation: detected.relation,
            valence: detected.valence,
            firstMentionedAt: now,
            lastMentionedAt: now,
            mentionCount: 1,
            sources: [source],
            sessionIds: [sessionId],
            contextSnippets: [detected.contextSnippet],
            suppressedByUser: false,
          });
        }
      }

      // ── Merge Signals ───────────────────────────────────────────────
      for (const detected of signals) {
        const normalizedKey = normalizePatternKey(detected.normalizedText);
        const existingIdx = updatedSignals.findIndex(
          (s) => s.normalizedPatternKey === normalizedKey && s.signalType === detected.signalType
        );

        if (existingIdx >= 0) {
          // Update existing signal
          const existing = updatedSignals[existingIdx];
          const newDetectionCount = existing.detectionCount + 1;
          const newSessionIds = existing.detectedAcrossSessionIds.includes(sessionId)
            ? existing.detectedAcrossSessionIds
            : [...existing.detectedAcrossSessionIds.slice(-MAX_SESSION_IDS_PER_SIGNAL + 1), sessionId];
          const newDayKeys = existing.detectedAcrossLocalDayKeys.includes(localDayKey)
            ? existing.detectedAcrossLocalDayKeys
            : [...existing.detectedAcrossLocalDayKeys.slice(-9), localDayKey];
          const newSourceTypes = existing.sourceTypes.includes(source)
            ? existing.sourceTypes
            : [...existing.sourceTypes, source];

          // Auto-save eligibility: 3+ detections across 2+ sessions/days
          const uniqueSessions = new Set(newSessionIds).size;
          const uniqueDays = new Set(newDayKeys).size;
          const eligibleForAutoSave = newDetectionCount >= 3 && (uniqueSessions >= 2 || uniqueDays >= 2);

          updatedSignals[existingIdx] = {
            ...existing,
            lastDetectedAt: now,
            detectionCount: newDetectionCount,
            detectedAcrossSessionIds: newSessionIds,
            detectedAcrossLocalDayKeys: newDayKeys,
            sourceTypes: newSourceTypes,
            // Upgrade confidence if detected more
            confidence: newDetectionCount >= 3 ? 'high' : newDetectionCount >= 2 ? 'medium' : existing.confidence,
            // Add raw excerpt
            rawUserTextExcerpts: [
              detected.rawUserTextExcerpt,
              ...existing.rawUserTextExcerpts,
            ].slice(0, MAX_RAW_EXCERPTS_PER_SIGNAL),
            eligibleForAutoSave,
          };
        } else {
          // New signal
          updatedSignals.push({
            id: generateDistillationId(),
            persona: store.persona,
            normalizedPatternKey: normalizedKey,
            signalType: detected.signalType,
            rawUserTextExcerpts: [detected.rawUserTextExcerpt],
            normalizedText: detected.normalizedText,
            confidence: detected.confidence,
            firstDetectedAt: now,
            lastDetectedAt: now,
            detectionCount: 1,
            detectedAcrossSessionIds: [sessionId],
            detectedAcrossLocalDayKeys: [localDayKey],
            sourceTypes: [source],
            promotionStatus: 'in_store',
            eligibleForAutoSave: false,
            suppressedByUser: false,
            contradictionFlag: false,
          });
        }
      }

      // ── Merge Contexts ──────────────────────────────────────────────
      for (const detected of contexts) {
        const normalizedKey = normalizePatternKey(detected.summary);
        const existingIdx = updatedContexts.findIndex(
          (c) => normalizePatternKey(c.summary) === normalizedKey && c.contextType === detected.contextType
        );

        if (existingIdx >= 0) {
          // Update existing context
          const existing = updatedContexts[existingIdx];
          updatedContexts[existingIdx] = {
            ...existing,
            lastMentionedAt: now,
            mentionCount: existing.mentionCount + 1,
            sources: existing.sources.includes(source) ? existing.sources : [...existing.sources, source],
            relevanceDecay: 1.0, // Reset decay on re-mention
          };
        } else {
          // New context
          updatedContexts.push({
            id: generateDistillationId(),
            persona: store.persona,
            contextType: detected.contextType,
            summary: detected.summary,
            firstMentionedAt: now,
            lastMentionedAt: now,
            mentionCount: 1,
            sources: [source],
            relevanceDecay: 1.0,
          });
        }
      }

      // ── Enforce limits (drop oldest by lastMentionedAt) ─────────────
      if (updatedEntities.length > MAX_ENTITIES) {
        updatedEntities.sort((a, b) => b.lastMentionedAt.localeCompare(a.lastMentionedAt));
        updatedEntities = updatedEntities.slice(0, MAX_ENTITIES);
      }
      if (updatedSignals.length > MAX_SIGNALS) {
        updatedSignals.sort((a, b) => b.lastDetectedAt.localeCompare(a.lastDetectedAt));
        updatedSignals = updatedSignals.slice(0, MAX_SIGNALS);
      }
      if (updatedContexts.length > MAX_CONTEXTS) {
        updatedContexts.sort((a, b) => b.lastMentionedAt.localeCompare(a.lastMentionedAt));
        updatedContexts = updatedContexts.slice(0, MAX_CONTEXTS);
      }

      return {
        ...store,
        entities: updatedEntities,
        signals: updatedSignals,
        contexts: updatedContexts,
        lastUpdatedAt: now,
      };
    },

    getEntity(store, name) {
      return store.entities.find(
        (e) => e.name.toLowerCase() === name.toLowerCase() && !e.suppressedByUser
      );
    },

    getSignalsByType(store, signalType) {
      return store.signals.filter(
        (s) => s.signalType === signalType && !s.suppressedByUser
      );
    },

    getRecentEntities(store, limit = 10) {
      return store.entities
        .filter((e) => !e.suppressedByUser)
        .sort((a, b) => b.lastMentionedAt.localeCompare(a.lastMentionedAt))
        .slice(0, limit);
    },

    getHighConfidenceSignals(store) {
      return store.signals.filter(
        (s) => s.confidence === 'high' && !s.suppressedByUser && s.promotionStatus === 'in_store'
      );
    },
  };
}
