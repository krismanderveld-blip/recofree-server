/**
 * Bug 1 Verification: isCrisis=true → gpt-4o model selection
 *
 * Verifies that when isCrisis=true is sent in the payload (from ResolvedEliasZone),
 * the server-side model routing selects gpt-4o even when crisisLevel=0 and riskScore<7.
 *
 * This tests the model routing logic extracted from server/ai-chat.ts.
 */
import { describe, it, expect } from 'vitest';

// ─── Extract model routing logic from server/ai-chat.ts ──────
// Replicated here for unit testing (same logic as lines 1193-1209 in server/ai-chat.ts)

const ELIAS_HIGH_COMPLEXITY_MODULES = ['relational', 'trauma', 'grief', 'attachment'];
const KIM_HIGH_COMPLEXITY_MODULES = ['boundary-repair', 'detachment', 'self-worth'];

interface ModelRoutingInput {
  isSessionStart: boolean;
  crisisLevel: number;
  riskScore: number;
  isCrisis?: boolean;
  urgency: string;
  dominantModule: string;
  activeModules: string[];
}

function selectModel(input: ModelRoutingInput): { model: 'gpt-4o' | 'gpt-4o-mini'; reason: string } {
  const riskScore = input.riskScore ?? 0;
  const crisisLevel = input.crisisLevel ?? 0;
  const dominantModuleForRouting = (input.dominantModule || input.activeModules[0] || '').toLowerCase();
  const urgencyForRouting = (input.urgency || '').toLowerCase();

  const HIGH_COMPLEXITY_MODULES = [
    ...ELIAS_HIGH_COMPLEXITY_MODULES,
    ...KIM_HIGH_COMPLEXITY_MODULES,
  ];

  let selectedModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini';
  let routingReason = 'default (low complexity)';

  if (input.isSessionStart) {
    selectedModel = 'gpt-4o';
    routingReason = 'SESSION_INIT (first impression)';
  } else if (crisisLevel > 0 || riskScore >= 7 || input.isCrisis === true) {
    selectedModel = 'gpt-4o';
    routingReason = `crisis/risk (crisis=${crisisLevel}, risk=${riskScore}, isCrisis=${input.isCrisis ?? false})`;
  } else if (urgencyForRouting === 'high' || urgencyForRouting === 'hoog') {
    selectedModel = 'gpt-4o';
    routingReason = `high urgency (${input.urgency})`;
  } else if (HIGH_COMPLEXITY_MODULES.some(m => dominantModuleForRouting.includes(m))) {
    selectedModel = 'gpt-4o';
    routingReason = `complex module (${dominantModuleForRouting})`;
  }

  return { model: selectedModel, reason: routingReason };
}

// ─── Tests ───────────────────────────────────────────────────

describe('isCrisis model routing', () => {
  it('isCrisis=true selects gpt-4o even when crisisLevel=0 and riskScore=0', () => {
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 0,
      isCrisis: true,
      urgency: 'midden',
      dominantModule: 'emotional-awareness',
      activeModules: ['emotional-awareness'],
    });
    expect(result.model).toBe('gpt-4o');
    expect(result.reason).toContain('isCrisis=true');
  });

  it('isCrisis=false with low risk stays on gpt-4o-mini', () => {
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 3,
      isCrisis: false,
      urgency: 'midden',
      dominantModule: 'emotional-awareness',
      activeModules: ['emotional-awareness'],
    });
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('isCrisis=undefined with low risk stays on gpt-4o-mini', () => {
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 3,
      urgency: 'midden',
      dominantModule: 'emotional-awareness',
      activeModules: ['emotional-awareness'],
    });
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('crisisLevel=2 still selects gpt-4o (existing behavior preserved)', () => {
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 2,
      riskScore: 0,
      isCrisis: false,
      urgency: 'midden',
      dominantModule: 'emotional-awareness',
      activeModules: ['emotional-awareness'],
    });
    expect(result.model).toBe('gpt-4o');
  });

  it('riskScore=7 still selects gpt-4o (existing behavior preserved)', () => {
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 7,
      isCrisis: false,
      urgency: 'midden',
      dominantModule: 'emotional-awareness',
      activeModules: ['emotional-awareness'],
    });
    expect(result.model).toBe('gpt-4o');
  });

  it('VSP=PAARS scenario: isCrisis=true with crisisLevel=0 → gpt-4o', () => {
    // This simulates the case where VSP is PAARS (severity 5, isCrisis=true)
    // but the text-based crisisLevel detection didn't fire (crisisLevel=0).
    // The isCrisis flag from ResolvedEliasZone should still trigger gpt-4o.
    const result = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 4,
      isCrisis: true,
      urgency: 'laag',
      dominantModule: 'craving-management',
      activeModules: ['craving-management'],
    });
    expect(result.model).toBe('gpt-4o');
    expect(result.reason).toContain('isCrisis=true');
  });
});
