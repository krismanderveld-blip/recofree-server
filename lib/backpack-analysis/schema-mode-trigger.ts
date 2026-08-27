/**
 * Schema/Mode Analysis Trigger — Client-side
 *
 * Called at session-start to check if any backpack sections have been modified
 * since their last GPT analysis. If so, triggers the server-side analysis
 * and writes results directly to userDat.schemaTendencies + modeTendencies.
 *
 * Key design decisions:
 * - One-time per change: uses backpackAnalysisTimestamps in userDat to track
 * - Non-blocking: runs in background, never blocks greeting or chat
 * - Supports both Elias (LifePhaseSections) and Kim (KimBackpackSections)
 * - Merges results into existing tendencies (moving average confidence)
 */

import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import { LocalDeviceTimeService } from '@/lib/core/time';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';
import type { Backpack, UserDat } from '@/lib/ai/types';

// ─── Types ────────────────────────────────────────────────────────

interface AnalyzedSchema {
  schemaId: string;
  domain: string;
  confidence: number;
  evidence: string;
  sourceSectionId: string;
}

interface AnalyzedMode {
  modeId: string;
  confidence: number;
  evidence: string;
  sourceSectionId: string;
}

interface AnalysisResult {
  schemas: AnalyzedSchema[];
  modes: AnalyzedMode[];
  analysisTimestamp: string;
  analyzedSectionIds: string[];
}

interface AnalysisOutput {
  updatedUserDat: UserDat;
  analyzedSectionIds: string[];
}

// ─── Main Trigger Function ────────────────────────────────────────

/**
 * Check if any backpack sections need GPT analysis (changed since last analysis).
 * If yes, call the server endpoint and merge results into userDat.
 *
 * @returns Updated userDat with merged schema/mode tendencies, or null if no analysis needed.
 */
export async function triggerBackpackAnalysisIfNeeded(
  backpack: Backpack,
  userDat: UserDat,
): Promise<AnalysisOutput | null> {
  const userType = backpack.userType;
  const timestamps = userDat.backpackAnalysisTimestamps || {};

  // Determine which sections have changed
  const changedSections: Array<{ id: string; label: string; content: string }> = [];

  if (userType === 'elias') {
    // Elias: check LifePhaseSections
    for (const section of backpack.sections || []) {
      if (!section.content || section.content.trim().length < 20) continue;
      const lastAnalyzed = timestamps[section.id];
      const lastUpdated = section.lastUpdated;
      if (!lastUpdated) continue; // Never updated = nothing to analyze
      if (!lastAnalyzed || lastUpdated > lastAnalyzed) {
        changedSections.push({ id: section.id, label: section.label, content: section.content });
      }
    }
  } else {
    // Kim: check KimBackpackSections
    if (backpack.kimBackpack) {
      const kimSectionMeta: Array<{ id: string; label: string; key: keyof NonNullable<Backpack['kimBackpack']> }> = [
        { id: 'my_story', label: 'My Story', key: 'my_story' },
        { id: 'the_relationship', label: 'The Relationship', key: 'the_relationship' },
        { id: 'the_impact', label: 'The Impact', key: 'the_impact' },
        { id: 'my_boundaries', label: 'My Boundaries', key: 'my_boundaries' },
        { id: 'my_strength', label: 'My Strength', key: 'my_strength' },
      ];

      // Kim backpack doesn't have per-section lastUpdated in the kimBackpack object itself.
      // We check if the kimSections array exists on the backpack (for structured Kim sections with lastUpdated).
      // Fallback: check if content differs from what was last analyzed (using timestamp from backpackAnalysisTimestamps).
      const kimSections = (backpack as any).kimSections as Array<{ id: string; title: string; content: string; lastUpdated: string | null }> | undefined;

      if (kimSections && Array.isArray(kimSections)) {
        // Structured Kim sections with lastUpdated
        for (const section of kimSections) {
          if (!section.content || section.content.trim().length < 20) continue;
          const lastAnalyzed = timestamps[section.id];
          const lastUpdated = section.lastUpdated;
          if (!lastUpdated) continue;
          if (!lastAnalyzed || lastUpdated > lastAnalyzed) {
            changedSections.push({ id: section.id, label: section.title || section.id, content: section.content });
          }
        }
      } else {
        // Flat kimBackpack object — check each field
        for (const meta of kimSectionMeta) {
          const content = backpack.kimBackpack[meta.key];
          if (!content || content.trim().length < 20) continue;
          const lastAnalyzed = timestamps[meta.id];
          // Without per-section timestamps, we analyze if never analyzed before
          if (!lastAnalyzed) {
            changedSections.push({ id: meta.id, label: meta.label, content });
          }
        }
      }
    }
  }

  if (changedSections.length === 0) {
    console.log('[SchemaModeTrigger] No sections need analysis — all up to date');
    return null;
  }

  console.log(`[SchemaModeTrigger] ${changedSections.length} sections need analysis:`, changedSections.map(s => s.id));

  // Call the generic minimal proxy with a client-built analysis prompt.
  const analysis = await callAnalyzeEndpoint({
    userType,
    sections: changedSections.map((section) => ({
      ...section,
      content: minimizeAnalysisText(section.content, 6_000).text,
    })),
    changedSectionIds: changedSections.map(s => s.id),
  });

  if (!analysis) {
    console.warn('[SchemaModeTrigger] Server analysis returned null — skipping');
    return null;
  }

  // Merge results into userDat
  const updatedUserDat = mergeAnalysisIntoUserDat(userDat, analysis);

  return {
    updatedUserDat,
    analyzedSectionIds: analysis.analyzedSectionIds,
  };
}

// ─── Server Call ──────────────────────────────────────────────────

async function callAnalyzeEndpoint(input: {
  userType: 'elias' | 'kim';
  sections: Array<{ id: string; label: string; content: string }>;
  changedSectionIds: string[];
}): Promise<AnalysisResult | null> {
  try {
    const sectionText = input.sections
      .filter((section) => input.changedSectionIds.includes(section.id))
      .map((section) => `[${section.label} (${section.id})]: ${section.content}`)
      .join('\n\n');
    const personaContext = input.userType === 'kim'
      ? 'The narrator is a loved one of someone with addiction. Never attribute the addiction to the narrator.'
      : 'The narrator is describing their own addiction recovery context.';
    const parsed = await callMinimalProxyJson<{ schemas?: unknown[]; modes?: unknown[] }>({
      persona: input.userType,
      systemPrompt: `You format schema-therapy working hypotheses. ${personaContext} Never diagnose. Use only explicit textual evidence. Return only JSON with schemas and modes.`,
      messages: [{ role: 'user', content: `For each supported item return schemaId/modeId, confidence 0.3..0.95, short evidence and sourceSectionId.\n${sectionText}` }],
      model: 'gpt-4o-mini',
      maxTokens: 1400,
      temperature: 0,
      promptBuildVersion: 'schema-mode-trigger-client-v2',
    });
    const schemas = normalizeSchemas(parsed.schemas, input.changedSectionIds);
    const modes = normalizeModes(parsed.modes, input.changedSectionIds);
    console.log(`[SchemaModeTrigger] Analysis received: ${schemas.length} schemas, ${modes.length} modes`);
    return {
      schemas,
      modes,
      analysisTimestamp: LocalDeviceTimeService.now().utcIso,
      analyzedSectionIds: input.changedSectionIds,
    };
  } catch (error) {
    console.error('[SchemaModeTrigger] Minimal-proxy error:', error);
    return null;
  }
}

function normalizeRecords(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function normalizeSchemas(raw: unknown, sectionIds: string[]): AnalyzedSchema[] {
  return normalizeRecords(raw).map((item) => ({
    schemaId: String(item.schemaId ?? '').toLowerCase().replace(/\s+/g, '_'),
    domain: String(item.domain ?? 'Unknown'),
    confidence: Math.min(0.95, Math.max(0.1, Number(item.confidence) || 0.5)),
    evidence: String(item.evidence ?? '').slice(0, 500),
    sourceSectionId: String(item.sourceSectionId ?? sectionIds[0] ?? ''),
  })).filter((item) => item.schemaId.length > 0 && item.evidence.length > 0);
}

function normalizeModes(raw: unknown, sectionIds: string[]): AnalyzedMode[] {
  return normalizeRecords(raw).map((item) => ({
    modeId: String(item.modeId ?? '').toLowerCase().replace(/\s+/g, '_'),
    confidence: Math.min(0.95, Math.max(0.1, Number(item.confidence) || 0.5)),
    evidence: String(item.evidence ?? '').slice(0, 500),
    sourceSectionId: String(item.sourceSectionId ?? sectionIds[0] ?? ''),
  })).filter((item) => item.modeId.length > 0 && item.evidence.length > 0);
}

// ─── Merge Logic ──────────────────────────────────────────────────

function mergeAnalysisIntoUserDat(userDat: UserDat, analysis: AnalysisResult): UserDat {
  const now = analysis.analysisTimestamp;
  let updated = { ...userDat };

  // 1. Update backpackAnalysisTimestamps
  const timestamps = { ...(updated.backpackAnalysisTimestamps || {}) };
  for (const sectionId of analysis.analyzedSectionIds) {
    timestamps[sectionId] = now;
  }
  updated.backpackAnalysisTimestamps = timestamps;

  // 2. Merge schemas → schemaTendencies
  if (analysis.schemas.length > 0) {
    const existingTendencies = [...(updated.schemaTendencies || [])];

    for (const schema of analysis.schemas) {
      if (schema.confidence < 0.3) continue; // Skip low-confidence

      const existingIdx = existingTendencies.findIndex(s => s.schemaId === schema.schemaId);
      if (existingIdx >= 0) {
        // Update existing: moving average confidence, increment frequency
        const existing = existingTendencies[existingIdx];
        existingTendencies[existingIdx] = {
          ...existing,
          frequency: (existing.frequency || 0) + 1,
          lastSeen: now,
          lastUpdatedAt: now,
          domain: schema.domain || existing.domain,
          confidence: Math.round(((existing.confidence || 0.5) * 0.6 + schema.confidence * 0.4) * 1000) / 1000,
        };
      } else {
        // New schema tendency
        existingTendencies.push({
          schemaId: schema.schemaId,
          domain: schema.domain,
          frequency: 1,
          lastSeen: now,
          copingStyle: null,
          firstDetectedAt: now,
          lastUpdatedAt: now,
          confidence: schema.confidence,
        });
      }
    }

    // Auto-confirm schemas meeting threshold (freq≥5 AND conf≥0.7)
    updated.schemaTendencies = existingTendencies.map(s => {
      if (!s.confirmed && (s.frequency || 0) >= 5 && (s.confidence || 0) >= 0.7) {
        return { ...s, confirmed: true, confirmedAt: now };
      }
      return s;
    });
  }

  // 3. Merge modes → modeTendencies
  if (analysis.modes.length > 0) {
    const existingModes = [...(updated.modeTendencies || [])];

    for (const mode of analysis.modes) {
      if (mode.confidence < 0.3) continue; // Skip low-confidence

      const existingIdx = existingModes.findIndex(m => m.modeId === mode.modeId);
      if (existingIdx >= 0) {
        const existing = existingModes[existingIdx];
        existingModes[existingIdx] = {
          ...existing,
          frequency: (existing.frequency || 0) + 1,
          lastSeen: now,
          lastUpdatedAt: now,
          confidence: Math.round(((existing.confidence || 0.5) * 0.6 + mode.confidence * 0.4) * 1000) / 1000,
        };
      } else {
        existingModes.push({
          modeId: mode.modeId,
          frequency: 1,
          lastSeen: now,
          effectiveInterventions: [],
          firstDetectedAt: now,
          lastUpdatedAt: now,
          confidence: mode.confidence,
        });
      }
    }

    // Auto-confirm modes meeting threshold (freq≥5 AND conf≥0.7)
    updated.modeTendencies = existingModes.map(m => {
      if (!m.confirmed && (m.frequency || 0) >= 5 && (m.confidence || 0) >= 0.7) {
        return { ...m, confirmed: true, confirmedAt: now };
      }
      return m;
    });
  }

  return updated;
}
