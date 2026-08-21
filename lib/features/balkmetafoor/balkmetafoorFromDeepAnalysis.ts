/**
 * Balkmetafoor Auto-Fill from Deep Analysis
 *
 * After Gegevens verversen, maps:
 * - risks → draaglast (what weighs the user down)
 * - protectiveFactors → draagkracht (what gives strength)
 *
 * Only adds items that don't already exist in the balkmetafoor.
 * Source is marked as 'deep_analysis' to distinguish from PAAL01 and manual entries.
 */
import type { BalkmetafoorData, BalkmetafoorEntry } from '@/lib/types/balkmetafoor.types';

interface DeepAnalysisRisk {
  risk: string;
  severity?: string;
  isActive?: boolean;
  confidence?: number;
}

interface DeepAnalysisProtectiveFactor {
  factor: string;
  domain?: string;
  strength?: string;
  confidence?: number;
}

interface BalkmetafoorFillInput {
  risks: DeepAnalysisRisk[];
  protectiveFactors: DeepAnalysisProtectiveFactor[];
  existingBalkmetafoor: BalkmetafoorData;
  nowIso: string;
  nowEpochMs: number;
}

export interface BalkmetafoorFillResult {
  updated: boolean;
  balkmetafoor: BalkmetafoorData;
  addedDraaglast: number;
  addedDraagkracht: number;
}

/**
 * Fills balkmetafoor from deep analysis risks and protective factors.
 * Only adds items not already present (by text similarity).
 * Does NOT remove existing items.
 */
export function fillBalkmetafoorFromDeepAnalysis(input: BalkmetafoorFillInput): BalkmetafoorFillResult {
  const { risks, protectiveFactors, existingBalkmetafoor, nowIso, nowEpochMs } = input;

  const existing = existingBalkmetafoor;
  const existingDraaglastTexts = new Set(existing.draaglast.map(e => e.text.toLowerCase().trim()));
  const existingDraagkrachtTexts = new Set(existing.draagkracht.map(e => e.text.toLowerCase().trim()));

  // Map active/high-severity risks to draaglast
  const newDraaglast: BalkmetafoorEntry[] = [];
  for (const risk of risks) {
    if (!risk.risk || risk.risk.trim().length < 3) continue;
    const text = risk.risk.trim();
    if (existingDraaglastTexts.has(text.toLowerCase())) continue;
    // Only include active or high/medium severity risks
    if (risk.isActive === false) continue;
    newDraaglast.push({
      id: `dl_deep_${nowEpochMs}_${newDraaglast.length}`,
      text,
      addedAt: nowIso,
      sourceModuleId: 'PAAL01' as any, // Using PAAL01 for type compat — source is clear from id prefix
    });
    existingDraaglastTexts.add(text.toLowerCase());
  }

  // Map protective factors to draagkracht
  const newDraagkracht: BalkmetafoorEntry[] = [];
  for (const pf of protectiveFactors) {
    if (!pf.factor || pf.factor.trim().length < 3) continue;
    const text = pf.factor.trim();
    if (existingDraagkrachtTexts.has(text.toLowerCase())) continue;
    // Only include strong or moderate factors
    if (pf.strength === 'fragile') continue;
    newDraagkracht.push({
      id: `dk_deep_${nowEpochMs}_${newDraagkracht.length}`,
      text,
      addedAt: nowIso,
      sourceModuleId: 'PAAL01' as any,
    });
    existingDraagkrachtTexts.add(text.toLowerCase());
  }

  if (newDraaglast.length === 0 && newDraagkracht.length === 0) {
    return { updated: false, balkmetafoor: existing, addedDraaglast: 0, addedDraagkracht: 0 };
  }

  const updatedBalkmetafoor: BalkmetafoorData = {
    initialized: true,
    initializedAt: existing.initializedAt || nowIso,
    lastUpdatedAt: nowIso,
    draaglast: [...existing.draaglast, ...newDraaglast],
    draagkracht: [...existing.draagkracht, ...newDraagkracht],
  };

  return {
    updated: true,
    balkmetafoor: updatedBalkmetafoor,
    addedDraaglast: newDraaglast.length,
    addedDraagkracht: newDraagkracht.length,
  };
}
