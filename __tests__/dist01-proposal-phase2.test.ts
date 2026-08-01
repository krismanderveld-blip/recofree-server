/**
 * DIST01 Phase 2 — Route A (Promotie) Tests
 *
 * Tests:
 * 1. Proposal generator routing (Elias + Kim)
 * 2. Confidence thresholds
 * 3. Crisis blocking
 * 4. Dedup logic
 * 5. Timing decisions
 * 6. Proposal store CRUD
 * 7. Expiry management
 */
import { describe, it, expect } from 'vitest';
import {
  generateProposals,
  evaluateProposalTiming,
  ELIAS_ROUTING_RULES,
  KIM_ROUTING_RULES,
  getTargetDocumentLabel,
  getTargetFieldLabel,
} from '@/lib/engine/shared/dist01-proposal-generator';
import {
  generateProposalId,
  createEmptyProposalStore,
  PROPOSAL_EXPIRY_MS,
  PROPOSAL_COOLDOWN_MS,
  MAX_PENDING_PROPOSALS,
} from '@/lib/engine/shared/dist01-proposal-types';
import type {
  DistillationProposal,
  ProposalGeneratorInput,
  ProposalStoreData,
} from '@/lib/engine/shared/dist01-proposal-types';
import type { DistilledSignal } from '@/lib/engine/shared/dist01-types';

// ─── Test Helpers ─────────────────────────────────────────────────────────

function createTestSignal(overrides: Partial<DistilledSignal> = {}): DistilledSignal {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    signalType: 'new_trigger_detected',
    confidence: 'medium',
    normalizedText: 'Stress op het werk',
    normalizedPatternKey: 'stress_op_het_werk',
    rawUserTextExcerpts: ['Als ik stress heb op het werk, wil ik drinken'],
    firstDetectedAt: new Date().toISOString(),
    lastDetectedAt: new Date().toISOString(),
    detectionCount: 2,
    detectedAcrossSessionIds: ['s1', 's2'],
    detectedAcrossLocalDayKeys: ['2026-07-01', '2026-07-02'],
    sourceTypes: ['chat'],
    promotionStatus: 'in_store',
    suppressedByUser: false,
    contradictionFlag: false,
    eligibleForAutoSave: false,
    ...overrides,
  } as DistilledSignal;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('DIST01 Phase 2 — Proposal Generator', () => {
  describe('Routing rules', () => {
    it('should have routing rules for Elias', () => {
      expect(ELIAS_ROUTING_RULES.length).toBeGreaterThan(5);
      const triggerRule = ELIAS_ROUTING_RULES.find((r) => r.signalType === 'new_trigger_detected');
      expect(triggerRule).toBeDefined();
      expect(triggerRule!.targetDocument).toBe('vsp_trigger');
    });

    it('should have routing rules for Kim', () => {
      expect(KIM_ROUTING_RULES.length).toBeGreaterThan(5);
      const triggerRule = KIM_ROUTING_RULES.find((r) => r.signalType === 'new_trigger_detected');
      expect(triggerRule).toBeDefined();
      expect(triggerRule!.targetDocument).toBe('eigen_regie_trigger');
    });
  });

  describe('generateProposals', () => {
    it('should generate a proposal for a medium-confidence signal (Elias)', () => {
      const signal = createTestSignal({ confidence: 'medium', signalType: 'new_trigger_detected' });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(1);
      expect(result.newProposals[0].targetDocument).toBe('vsp_trigger');
      expect(result.newProposals[0].persona).toBe('elias');
      expect(result.newProposals[0].status).toBe('pending');
      expect(result.promotedSignalIds).toContain(signal.id);
    });

    it('should generate a proposal for Kim persona', () => {
      const signal = createTestSignal({ confidence: 'high', signalType: 'boundary_pattern_detected' });
      const input: ProposalGeneratorInput = {
        persona: 'kim',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(1);
      expect(result.newProposals[0].targetDocument).toBe('eigen_regie_boundary_rule');
    });

    it('should NOT generate proposals for low-confidence signals', () => {
      const signal = createTestSignal({ confidence: 'low' });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should NOT generate proposals during crisis (level >= 2)', () => {
      const signal = createTestSignal({ confidence: 'high' });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 2,
        safetyLevel: 'crisis',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should NOT generate proposals for suppressed signals', () => {
      const signal = createTestSignal({ confidence: 'high', suppressedByUser: true });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should NOT generate proposals for signals already proposed', () => {
      const signal = createTestSignal({ confidence: 'high', id: 'sig_existing' });
      const existingProposal = {
        id: 'prop_1',
        signalId: 'sig_existing',
        status: 'pending',
      } as unknown as DistillationProposal;
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [existingProposal],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should NOT generate proposals for signals with contradiction flag', () => {
      const signal = createTestSignal({ confidence: 'high', contradictionFlag: true });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should NOT generate proposals for signals already in target document', () => {
      const signal = createTestSignal({ confidence: 'high', normalizedPatternKey: 'stress_op_het_werk' });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: ['stress_op_het_werk'],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });

    it('should skip signals with promotionStatus !== in_store', () => {
      const signal = createTestSignal({ confidence: 'high', promotionStatus: 'proposed' as any });
      const input: ProposalGeneratorInput = {
        persona: 'elias',
        source: 'chat',
        sessionId: 's_test',
        localDayKey: '2026-07-30',
        crisisLevel: 0,
        safetyLevel: 'none',
        signals: [signal],
        existingProposals: [],
        existingDocumentKeys: [],
      };
      const result = generateProposals(input);
      expect(result.newProposals.length).toBe(0);
    });
  });

  describe('evaluateProposalTiming', () => {
    it('should allow proposals when timing is OK', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 0,
        safetyLevel: 'none',
        pendingProposalCount: 0,
        lastProposalShownAt: null,
      });
      expect(decision.shouldShow).toBe(true);
      expect(decision.reason).toBe('timing_ok');
    });

    it('should block during crisis', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 2,
        safetyLevel: 'crisis',
        pendingProposalCount: 0,
        lastProposalShownAt: null,
      });
      expect(decision.shouldShow).toBe(false);
      expect(decision.reason).toBe('crisis_active');
    });

    it('should block during elevated safety', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 0,
        safetyLevel: 'elevated',
        pendingProposalCount: 0,
        lastProposalShownAt: null,
      });
      expect(decision.shouldShow).toBe(false);
      expect(decision.reason).toBe('safety_elevated');
    });

    it('should block during cooldown', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 0,
        safetyLevel: 'none',
        pendingProposalCount: 0,
        lastProposalShownAt: Date.now() - 1000, // 1 second ago
      });
      expect(decision.shouldShow).toBe(false);
      expect(decision.reason).toBe('cooldown_active');
    });

    it('should allow after cooldown expires', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 0,
        safetyLevel: 'none',
        pendingProposalCount: 0,
        lastProposalShownAt: Date.now() - PROPOSAL_COOLDOWN_MS - 1000,
      });
      expect(decision.shouldShow).toBe(true);
    });

    it('should block when too many pending proposals', () => {
      const decision = evaluateProposalTiming({
        crisisLevel: 0,
        safetyLevel: 'none',
        pendingProposalCount: 3,
        lastProposalShownAt: null,
      });
      expect(decision.shouldShow).toBe(false);
      expect(decision.reason).toBe('too_many_pending');
    });
  });

  describe('Proposal ID generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateProposalId();
      const id2 = generateProposalId();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('prop_')).toBe(true);
    });
  });

  describe('createEmptyProposalStore', () => {
    it('should create a valid empty store', () => {
      const store = createEmptyProposalStore('elias');
      expect(store.schemaVersion).toBe('dist01-proposals.v1');
      expect(store.persona).toBe('elias');
      expect(store.proposals).toEqual([]);
    });
  });

  describe('UI label helpers', () => {
    it('should return correct document labels', () => {
      expect(getTargetDocumentLabel('vsp_trigger')).toBe('Veiligheidsplan — Triggers');
      expect(getTargetDocumentLabel('eigen_regie_zone')).toBe('Eigen Regie Plan — Zone');
      expect(getTargetDocumentLabel('backpack')).toBe('Rugzak');
    });

    it('should return correct field labels', () => {
      expect(getTargetFieldLabel('triggers')).toBe('Triggers');
      expect(getTargetFieldLabel('whatHelps')).toBe('Wat helpt');
      expect(getTargetFieldLabel('recoveryRules')).toBe('Herstelregels');
    });
  });

  describe('Constants', () => {
    it('should have sensible expiry and cooldown values', () => {
      expect(PROPOSAL_EXPIRY_MS).toBeGreaterThan(0);
      expect(PROPOSAL_COOLDOWN_MS).toBeGreaterThan(0);
      expect(MAX_PENDING_PROPOSALS).toBeGreaterThan(0);
      expect(MAX_PENDING_PROPOSALS).toBeLessThanOrEqual(20);
    });
  });
});
