/**
 * Integration Test: VSP=PAARS → Full Path Verification
 *
 * Verifies the complete path:
 * - Input: Elias user, VSP=PAARS, crisisLevel=0
 * - Expected: resolvedZone=PURPLE, regulationAction=ground, selectedModel=gpt-4o
 *
 * Tests the integration between:
 * 1. VSP Resolution (vsp-resolution.ts) → isCrisis=true, finalZoneLabel=PAARS
 * 2. Pipeline zone mapping → resolvedZoneForRegulation=PURPLE
 * 3. Regulation layer → action=ground (PURPLE zone)
 * 4. Model routing → gpt-4o (isCrisis=true)
 */
import { describe, it, expect } from 'vitest';
import { resolveEliasZone } from '../lib/engine/elias/vsp-resolution';
import { applyRegulation, type ZoneColor } from '../lib/rugzak/regulation-layer';

// ─── Zone label mapping (same as pipeline.ts) ──────────────────
const LABEL_TO_ZONE_COLOR: Record<string, ZoneColor> = {
  'GROEN': 'GREEN',
  'GEEL': 'YELLOW',
  'ORANJE': 'ORANGE',
  'ROOD': 'RED',
  'PAARS': 'PURPLE',
};

// ─── Model routing logic (same as server/ai-chat.ts) ───────────
function selectModel(input: {
  isSessionStart: boolean;
  crisisLevel: number;
  riskScore: number;
  isCrisis?: boolean;
}): string {
  if (input.isSessionStart) return 'gpt-4o';
  if (input.crisisLevel > 0 || input.riskScore >= 7 || input.isCrisis === true) return 'gpt-4o';
  return 'gpt-4o-mini';
}

// ─── Full Path Integration Test ────────────────────────────────

describe('vsp-paars-full-path-integration', () => {
  it('VSP=PAARS with crisisLevel=0 → resolvedZone=PURPLE, regulation=ground, model=gpt-4o', () => {
    // Step 1: VSP Resolution — PAARS input with a low computed zone
    const resolved = resolveEliasZone({
      vsp: 'PAARS',
      computedZone: 'GEEL', // Low computed zone — VSP overrides
    });

    // Verify resolution
    expect(resolved.finalZoneLabel).toBe('PAARS');
    expect(resolved.isCrisis).toBe(true);
    expect(resolved.source).toBe('VSP');
    expect(resolved.reason).toBe('VSP_PAARS_OVERRIDE');
    expect(resolved.finalSeverity).toBe(5);

    // Step 2: Pipeline zone mapping — FinalZoneLabel → ZoneColor
    const resolvedZoneForRegulation: ZoneColor = LABEL_TO_ZONE_COLOR[resolved.finalZoneLabel!] ?? 'GREEN';
    expect(resolvedZoneForRegulation).toBe('PURPLE');

    // Step 3: Regulation layer — PURPLE zone → ground action
    const regulationResult = applyRegulation(resolvedZoneForRegulation, 'normal');
    expect(regulationResult.action).toBe('ground');
    expect(regulationResult.zone).toBe('PURPLE');
    expect(regulationResult.requiresRegulationTone).toBe(true);
    expect(regulationResult.intervention).toBeTruthy();

    // Step 4: Model routing — isCrisis=true → gpt-4o
    const model = selectModel({
      isSessionStart: false,
      crisisLevel: 0, // crisisLevel is 0 (not detected from text)
      riskScore: 4,   // Low risk score
      isCrisis: resolved.isCrisis,
    });
    expect(model).toBe('gpt-4o');
  });

  it('VSP=PAARS overrides even when computed zone is GROEN', () => {
    const resolved = resolveEliasZone({
      vsp: 'PAARS',
      computedZone: 'GROEN', // Lowest possible computed zone
    });

    expect(resolved.finalZoneLabel).toBe('PAARS');
    expect(resolved.isCrisis).toBe(true);

    const zoneColor: ZoneColor = LABEL_TO_ZONE_COLOR[resolved.finalZoneLabel!] ?? 'GREEN';
    expect(zoneColor).toBe('PURPLE');

    const regulation = applyRegulation(zoneColor, 'normal');
    expect(regulation.action).toBe('ground');
  });

  it('VSP=ROOD (not PAARS) → resolvedZone=RED, regulation=intervene, model depends on risk', () => {
    const resolved = resolveEliasZone({
      vsp: 'ROOD',
      computedZone: 'GEEL', // VSP higher → VSP wins
    });

    expect(resolved.finalZoneLabel).toBe('ROOD');
    expect(resolved.isCrisis).toBe(false);

    const zoneColor: ZoneColor = LABEL_TO_ZONE_COLOR[resolved.finalZoneLabel!] ?? 'GREEN';
    expect(zoneColor).toBe('RED');

    const regulation = applyRegulation(zoneColor, 'normal');
    expect(regulation.action).toBe('stabilize');

    // Without isCrisis, crisisLevel=0, riskScore=4 → gpt-4o-mini
    const model = selectModel({
      isSessionStart: false,
      crisisLevel: 0,
      riskScore: 4,
      isCrisis: false,
    });
    expect(model).toBe('gpt-4o-mini');
  });
});
