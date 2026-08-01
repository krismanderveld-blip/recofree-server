/**
 * DIST01 — Proposal Store (Phase 2: Route A)
 *
 * Local encrypted persistence for distillation proposals.
 * Follows the same pattern as dist01-store.ts:
 * - Uses atomicJsonStore (readJson/writeJson) for encrypted storage
 * - Key path: recofree_memory/{persona}/proposals.dat
 *
 * The store provides:
 * - load/save for full proposal state
 * - add/update/remove helpers
 * - query by status, target, signal
 * - expiry management
 * - dedup check
 */
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';
import type {
  DistillationProposal,
  ProposalStoreData,
  ProposalStatus,
  ProposalUserAction,
  TargetDocument,
} from './dist01-proposal-types';
import {
  createEmptyProposalStore,
  PROPOSAL_EXPIRY_MS,
  MAX_PENDING_PROPOSALS,
} from './dist01-proposal-types';
import { readJson, writeJson } from '@/lib/storage/memory/atomicJsonStore';

// ─── Key Path ──────────────────────────────────────────────────────────────

function getProposalKey(persona: RecoFreePersona): string {
  return `recofree_memory/${persona}/proposals.dat`;
}

// ─── Store Interface ───────────────────────────────────────────────────────

export interface ProposalStore {
  load(persona: RecoFreePersona): Promise<ProposalStoreData>;
  save(data: ProposalStoreData): Promise<void>;
  addProposal(store: ProposalStoreData, proposal: DistillationProposal): ProposalStoreData;
  updateProposalStatus(
    store: ProposalStoreData,
    proposalId: string,
    action: ProposalUserAction,
    editedText?: string,
  ): ProposalStoreData;
  getPendingProposals(store: ProposalStoreData): DistillationProposal[];
  getProposalsByTarget(store: ProposalStoreData, target: TargetDocument): DistillationProposal[];
  getProposalBySignalId(store: ProposalStoreData, signalId: string): DistillationProposal | undefined;
  hasRecentProposalForPattern(store: ProposalStoreData, normalizedPatternKey: string): boolean;
  expireOldProposals(store: ProposalStoreData): ProposalStoreData;
  canAddMoreProposals(store: ProposalStoreData): boolean;
}

// ─── Implementation ────────────────────────────────────────────────────────

export function createProposalStore(): ProposalStore {
  return {
    async load(persona) {
      const key = getProposalKey(persona);
      const existing = await readJson<ProposalStoreData>(key);
      if (existing && existing.schemaVersion === 'dist01-proposals.v1') {
        return existing;
      }
      const empty = createEmptyProposalStore(persona);
      await writeJson(key, empty);
      return empty;
    },

    async save(data) {
      const key = getProposalKey(data.persona);
      data.lastUpdatedAt = new Date().toISOString();
      await writeJson(key, data);
    },

    addProposal(store, proposal) {
      // Enforce max pending limit — drop oldest pending if at capacity
      const pending = store.proposals.filter((p) => p.status === 'pending');
      let proposals = [...store.proposals];
      if (pending.length >= MAX_PENDING_PROPOSALS) {
        // Remove oldest pending
        const oldest = pending.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        proposals = proposals.map((p) =>
          p.id === oldest.id ? { ...p, status: 'expired' as ProposalStatus, updatedAt: new Date().toISOString() } : p
        );
      }
      proposals.push(proposal);
      return {
        ...store,
        proposals,
        lastUpdatedAt: new Date().toISOString(),
      };
    },

    updateProposalStatus(store, proposalId, action, editedText) {
      const now = new Date().toISOString();
      const statusMap: Record<ProposalUserAction, ProposalStatus> = {
        accept: 'accepted',
        edit: 'edited',
        dismiss: 'dismissed',
        reject: 'rejected',
      };
      const newStatus = statusMap[action];
      const proposals = store.proposals.map((p) => {
        if (p.id !== proposalId) return p;
        return {
          ...p,
          status: newStatus,
          updatedAt: now,
          editedText: action === 'edit' ? (editedText ?? p.editedText) : p.editedText,
        };
      });
      return {
        ...store,
        proposals,
        lastUpdatedAt: now,
      };
    },

    getPendingProposals(store) {
      return store.proposals.filter((p) => p.status === 'pending');
    },

    getProposalsByTarget(store, target) {
      return store.proposals.filter((p) => p.targetDocument === target);
    },

    getProposalBySignalId(store, signalId) {
      return store.proposals.find((p) => p.signalId === signalId);
    },

    hasRecentProposalForPattern(store, normalizedPatternKey) {
      const now = Date.now();
      // Check if there's any proposal (pending/dismissed) for this pattern in the last 24h
      return store.proposals.some((p) => {
        const status = p.status;
        // Rejected patterns are permanently suppressed
        if (status === 'rejected' && p.repeatedDetection?.normalizedPatternKey === normalizedPatternKey) {
          return true;
        }
        if (p.repeatedDetection?.normalizedPatternKey === normalizedPatternKey) {
          // If pending or dismissed, check if recent (within 24h)
          if (status === 'pending' || status === 'dismissed') {
            const createdTime = new Date(p.createdAt).getTime();
            return now - createdTime < 24 * 60 * 60 * 1000;
          }
        }
        return false;
      });
    },

    expireOldProposals(store) {
      const now = Date.now();
      let changed = false;
      const proposals = store.proposals.map((p) => {
        if (p.status !== 'pending') return p;
        if (p.expiresAt && new Date(p.expiresAt).getTime() <= now) {
          changed = true;
          return { ...p, status: 'expired' as ProposalStatus, updatedAt: new Date().toISOString() };
        }
        // Also expire if older than PROPOSAL_EXPIRY_MS
        if (now - new Date(p.createdAt).getTime() > PROPOSAL_EXPIRY_MS) {
          changed = true;
          return { ...p, status: 'expired' as ProposalStatus, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      if (!changed) return store;
      return {
        ...store,
        proposals,
        lastUpdatedAt: new Date().toISOString(),
      };
    },

    canAddMoreProposals(store) {
      const pending = store.proposals.filter((p) => p.status === 'pending');
      return pending.length < MAX_PENDING_PROPOSALS;
    },
  };
}
