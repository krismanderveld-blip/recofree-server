/**
 * DIST01 Phase 3 — Route B Writer + Auto-Save Tests
 *
 * Tests:
 * 1. writeProposalToDocument — writes to correct target for each document type
 * 2. processAutoSave — auto-saves eligible signals, respects max per turn
 * 3. updateSignalPromotionStatus — updates signal status correctly
 * 4. Edge cases: missing plan, duplicate detection, empty backpack
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeProposalToDocument, processAutoSave, updateSignalPromotionStatus } from '@/lib/engine/shared/dist01-proposal-writer';
import type { DistillationProposal } from '@/lib/engine/shared/dist01-proposal-types';
import type { DistillationStoreData, DistilledSignal } from '@/lib/engine/shared/dist01-types';
import type { Backpack } from '@/lib/ai/types';

// ─── Mock LocalDeviceTimeService ─────────────────────────────────────────
vi.mock('@/lib/core/time', () => ({
  LocalDeviceTimeService: {
    now: () => ({ utcIso: '2026-08-01T10:00:00.000Z', epochMs: 1785340800000 }),
  },
}));

// ─── Test Fixtures ───────────────────────────────────────────────────────

function createTestBackpack(overrides?: Partial<Backpack>): Backpack {
  return {
    userType: 'elias',
    userName: 'Test',
    sections: [
      { id: 'childhood', title: 'Kindertijd', content: 'Existing childhood content', lastUpdated: null },
      { id: 'adolescence', title: 'Adolescentie', content: '', lastUpdated: null },
      { id: 'adulthood', title: 'Volwassenheid', content: 'Some adult content', lastUpdated: null },
      { id: 'family', title: 'Familie', content: '', lastUpdated: null },
      { id: 'themes', title: 'Themas', content: '', lastUpdated: null },
    ],
    vspSection: {
      zones: {
        green: { signals: 'Feeling calm', whatHelps: 'Walking', anchorSentence: '' },
        yellow: { signals: '', whatHelps: '', anchorSentence: '' },
        orange: { signals: '', whatHelps: '', anchorSentence: '' },
        red: { signals: '', whatHelps: '', anchorSentence: '' },
        purple: { signals: '', whatHelps: '', anchorSentence: '' },
      },
      triggers: [{ trigger: 'Existing trigger', counterThought: 'Existing counter' }],
      recoveryRules: ['Existing rule'],
      mainAnchorSentence: '',
      lastUpdated: null,
    },
    eigenRegiePlan: null,
    kimBackpack: null,
    ...overrides,
  } as any;
}

function createKimBackpack(): Backpack {
  return {
    userType: 'kim',
    userName: 'Kim Test',
    sections: [],
    vspSection: null,
    eigenRegiePlan: {
      zones: {
        donkergroen: { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '', contactRule: '', userMeaning: '' },
        lichtgroen: { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '', contactRule: '', userMeaning: '' },
        geel: { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '', contactRule: '', userMeaning: '' },
        oranje: { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '', contactRule: '', userMeaning: '' },
        rood: { signals: [], bodySignals: [], thoughts: [], behaviour: [], whatHelps: [], boundaryActions: [], anchorSentence: '', contactRule: '', userMeaning: '' },
      },
      triggers: [],
      boundaryRules: [],
      mainAnchorSentence: '',
      lastUpdated: null,
    },
    kimBackpack: {
      my_story: 'My existing story',
      the_relationship: '',
      the_impact: '',
      my_boundaries: '',
      my_strength: '',
    },
  } as any;
}

function createTestProposal(overrides?: Partial<DistillationProposal>): DistillationProposal {
  return {
    id: 'prop_test_1',
    persona: 'elias',
    source: 'chat',
    status: 'accepted',
    confidence: 'high',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    expiresAt: '2026-08-08T09:00:00.000Z',
    rawUserTextExcerpt: 'Als ik moe ben drink ik sneller',
    proposedUserFacingText: 'Vermoeidheid als trigger voor gebruik',
    editedText: null,
    targetDocument: 'vsp_trigger',
    targetField: 'triggers',
    insertMode: 'append',
    engineReason: 'new_trigger_detected',
    clinicalMeaning: 'craving_trigger',
    safetyLevel: 'none',
    requiresExplicitConfirmation: true,
    autoSaveAllowed: false,
    userCanEdit: true,
    repeatedDetection: {
      normalizedPatternKey: 'vermoeidheid_trigger',
      detectionCount: 3,
      firstDetectedAt: '2026-07-25T10:00:00.000Z',
      lastDetectedAt: '2026-08-01T09:00:00.000Z',
      detectedAcrossSessionIds: ['s1', 's2', 's3'],
      detectedAcrossLocalDayKeys: ['2026-07-25', '2026-07-28', '2026-08-01'],
      sourceTypes: ['chat'],
      eligibleForAutoSave: false,
      autoSavedAt: null,
      userReviewedAt: null,
    },
    signalId: 'sig_test_1',
    ...overrides,
  };
}

function createTestDistillationStore(overrides?: Partial<DistillationStoreData>): DistillationStoreData {
  return {
    schemaVersion: 'dist01.v1',
    persona: 'elias',
    entities: [],
    signals: [],
    contexts: [],
    lastUpdatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
  };
}

function createTestSignal(overrides?: Partial<DistilledSignal>): DistilledSignal {
  return {
    id: 'sig_auto_1',
    signalType: 'new_trigger_detected',
    normalizedText: 'Stress op werk als trigger',
    normalizedPatternKey: 'stress_werk_trigger',
    confidence: 'high',
    detectionCount: 4,
    firstDetectedAt: '2026-07-20T10:00:00.000Z',
    lastDetectedAt: '2026-08-01T09:00:00.000Z',
    detectedAcrossSessionIds: ['s1', 's2', 's3', 's4'],
    detectedAcrossLocalDayKeys: ['2026-07-20', '2026-07-25', '2026-07-28', '2026-08-01'],
    sourceTypes: ['chat'],
    rawUserTextExcerpts: ['Als ik stress heb op werk...'],
    promotionStatus: 'in_store',
    eligibleForAutoSave: true,
    suppressedByUser: false,
    contradictionFlag: false,
    ...overrides,
  } as any;
}

// ─── Tests: writeProposalToDocument ──────────────────────────────────────

describe('DIST01 Phase 3: writeProposalToDocument', () => {
  it('writes to VSP triggers (Elias)', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal();
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.writtenField).toBe('triggers');
    expect(result.writtenText).toBe('Vermoeidheid als trigger voor gebruik');
    expect(result.updatedBackpack?.vspSection?.triggers).toHaveLength(2);
    expect(result.updatedBackpack?.vspSection?.triggers[1].trigger).toBe('Vermoeidheid als trigger voor gebruik');
  });

  it('avoids duplicate VSP triggers', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({ proposedUserFacingText: 'Existing trigger' });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.vspSection?.triggers).toHaveLength(1); // no duplicate
  });

  it('writes to VSP zone signals', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      targetDocument: 'vsp_zone',
      targetField: 'signals',
      clinicalMeaning: 'early_signal',
      proposedUserFacingText: 'Prikkelbaar worden',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.writtenField).toContain('orange'); // early_signal → orange zone
    expect(result.updatedBackpack?.vspSection?.zones.orange.signals).toContain('Prikkelbaar worden');
  });

  it('writes to VSP recovery rules', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      targetDocument: 'vsp_recovery_rule',
      targetField: 'recoveryRules',
      proposedUserFacingText: 'Wandelen als het moeilijk wordt',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.vspSection?.recoveryRules).toContain('Wandelen als het moeilijk wordt');
    expect(result.updatedBackpack?.vspSection?.recoveryRules).toHaveLength(2);
  });

  it('writes to VSP anchor sentence', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      targetDocument: 'vsp_anchor_sentence',
      targetField: 'mainAnchorSentence',
      proposedUserFacingText: 'Ik kies voor mijn gezondheid',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.vspSection?.mainAnchorSentence).toBe('Ik kies voor mijn gezondheid');
  });

  it('writes to backpack section (levensverhaal → adulthood)', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      targetDocument: 'backpack',
      targetField: 'levensverhaal',
      proposedUserFacingText: 'Werkte 10 jaar in de bouw',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.writtenField).toBe('backpack.adulthood');
    const section = result.updatedBackpack?.sections.find((s: any) => s.id === 'adulthood');
    expect(section?.content).toContain('Werkte 10 jaar in de bouw');
  });

  it('uses editedText when available', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      editedText: 'Aangepaste tekst door gebruiker',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.writtenText).toBe('Aangepaste tekst door gebruiker');
    expect(result.updatedBackpack?.vspSection?.triggers[1].trigger).toBe('Aangepaste tekst door gebruiker');
  });

  it('writes to Kim Eigen Regie triggers', () => {
    const backpack = createKimBackpack();
    const proposal = createTestProposal({
      persona: 'kim',
      targetDocument: 'eigen_regie_trigger',
      targetField: 'triggers',
      proposedUserFacingText: 'Wanneer hij belt voel ik paniek',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.eigenRegiePlan?.triggers).toHaveLength(1);
    expect(result.updatedBackpack?.eigenRegiePlan?.triggers[0].trigger).toBe('Wanneer hij belt voel ik paniek');
  });

  it('writes to Kim Eigen Regie zone', () => {
    const backpack = createKimBackpack();
    const proposal = createTestProposal({
      persona: 'kim',
      targetDocument: 'eigen_regie_zone',
      targetField: 'signals',
      clinicalMeaning: 'loss_of_self_direction',
      proposedUserFacingText: 'Ik vergeet mijn eigen behoeften',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.writtenField).toContain('rood'); // loss_of_self_direction → rood
    expect(result.updatedBackpack?.eigenRegiePlan?.zones.rood.signals).toContain('Ik vergeet mijn eigen behoeften');
  });

  it('writes to Kim Eigen Regie boundary rules', () => {
    const backpack = createKimBackpack();
    const proposal = createTestProposal({
      persona: 'kim',
      targetDocument: 'eigen_regie_boundary_rule',
      targetField: 'boundaryRules',
      proposedUserFacingText: 'Niet na 22:00 meer reageren op berichten',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.eigenRegiePlan?.boundaryRules).toContain('Niet na 22:00 meer reageren op berichten');
  });

  it('writes to Kim backpack (my_story)', () => {
    const backpack = createKimBackpack();
    const proposal = createTestProposal({
      persona: 'kim',
      targetDocument: 'kimBackpack',
      targetField: 'my_story',
      proposedUserFacingText: 'Ik ben opgegroeid in een gezin waar...',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(true);
    expect(result.updatedBackpack?.kimBackpack?.my_story).toContain('Ik ben opgegroeid in een gezin waar...');
    expect(result.updatedBackpack?.kimBackpack?.my_story).toContain('My existing story'); // appended
  });

  it('returns error for missing Eigen Regie Plan', () => {
    const backpack = createTestBackpack(); // Elias backpack, no eigenRegiePlan
    const proposal = createTestProposal({
      targetDocument: 'eigen_regie_trigger',
      targetField: 'triggers',
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No Eigen Regie Plan');
  });

  it('returns error for unknown target document', () => {
    const backpack = createTestBackpack();
    const proposal = createTestProposal({
      targetDocument: 'unknown_doc' as any,
    });
    const result = writeProposalToDocument(proposal, backpack);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown target document');
  });
});

// ─── Tests: processAutoSave ──────────────────────────────────────────────

describe('DIST01 Phase 3: processAutoSave', () => {
  const routingRules = [
    { signalType: 'new_trigger_detected', targetDocument: 'vsp_trigger' as const, targetField: 'triggers', clinicalMeaning: 'craving_trigger', insertMode: 'append' as const },
    { signalType: 'protective_pattern_detected', targetDocument: 'vsp_zone' as const, targetField: 'whatHelps', clinicalMeaning: 'protective_action', insertMode: 'append' as const },
  ];

  it('auto-saves eligible signals', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [createTestSignal()],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(1);
    expect(result.autoSavedSignalIds).toContain('sig_auto_1');
    expect(result.updatedBackpack).not.toBeNull();
    expect(result.updatedBackpack?.vspSection?.triggers).toHaveLength(2);
    // Signal promotionStatus updated
    const updatedSignal = result.updatedStore.signals.find((s) => s.id === 'sig_auto_1');
    expect(updatedSignal?.promotionStatus).toBe('auto_saved');
  });

  it('respects maxAutoSavePerTurn limit', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ id: 'sig_1' }),
        createTestSignal({ id: 'sig_2', normalizedText: 'Tweede trigger', normalizedPatternKey: 'tweede' }),
        createTestSignal({ id: 'sig_3', normalizedText: 'Derde trigger', normalizedPatternKey: 'derde' }),
      ],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(2); // max 2
    expect(result.autoSavedSignalIds).toHaveLength(2);
  });

  it('skips signals that are not eligible for auto-save', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ eligibleForAutoSave: false }),
      ],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(0);
    expect(result.updatedBackpack).toBeNull();
  });

  it('skips suppressed signals', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ suppressedByUser: true }),
      ],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(0);
  });

  it('skips signals with contradictionFlag', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ contradictionFlag: true }),
      ],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(0);
  });

  it('skips signals already promoted', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ promotionStatus: 'proposed' as any }),
      ],
    });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(0);
  });

  it('returns empty result when no eligible signals', () => {
    const backpack = createTestBackpack();
    const store = createTestDistillationStore({ signals: [] });

    const result = processAutoSave(backpack, store, routingRules, 2);

    expect(result.autoSavedCount).toBe(0);
    expect(result.updatedBackpack).toBeNull();
    expect(result.autoSavedSignalIds).toHaveLength(0);
  });
});

// ─── Tests: updateSignalPromotionStatus ──────────────────────────────────

describe('DIST01 Phase 3: updateSignalPromotionStatus', () => {
  it('updates signal promotionStatus to accepted', () => {
    const store = createTestDistillationStore({
      signals: [createTestSignal({ id: 'sig_1', promotionStatus: 'proposed' as any })],
    });

    const result = updateSignalPromotionStatus(store, 'sig_1', 'accepted');

    expect(result.signals[0].promotionStatus).toBe('accepted');
    expect(result.lastUpdatedAt).toBeDefined();
  });

  it('updates signal promotionStatus to rejected', () => {
    const store = createTestDistillationStore({
      signals: [createTestSignal({ id: 'sig_1', promotionStatus: 'proposed' as any })],
    });

    const result = updateSignalPromotionStatus(store, 'sig_1', 'rejected');

    expect(result.signals[0].promotionStatus).toBe('rejected');
  });

  it('does not modify other signals', () => {
    const store = createTestDistillationStore({
      signals: [
        createTestSignal({ id: 'sig_1', promotionStatus: 'in_store' }),
        createTestSignal({ id: 'sig_2', promotionStatus: 'in_store' }),
      ],
    });

    const result = updateSignalPromotionStatus(store, 'sig_1', 'accepted');

    expect(result.signals[0].promotionStatus).toBe('accepted');
    expect(result.signals[1].promotionStatus).toBe('in_store'); // unchanged
  });

  it('handles non-existent signal ID gracefully', () => {
    const store = createTestDistillationStore({
      signals: [createTestSignal({ id: 'sig_1' })],
    });

    const result = updateSignalPromotionStatus(store, 'nonexistent', 'accepted');

    expect(result.signals[0].promotionStatus).toBe('in_store'); // unchanged
  });
});
