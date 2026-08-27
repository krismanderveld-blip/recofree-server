/**
 * BackpackDeepAnalysis — Client
 *
 * Fire-and-forget client-built analysis through the Railway minimal proxy.
 * Non-blocking: failures are logged but never crash the app or block the UI.
 */

import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import { LocalDeviceTimeService } from '@/lib/core/time';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';

export interface BackpackAnalysisResult {
  schemas: Array<{ name: string; confidence: number; evidence: string }>;
  modi: Array<{ name: string; confidence: number; evidence: string }>;
  triggers: string[];
  coreBeliefs: string[];
  copingPatterns: string[];
  analysisVersion: number;
  analyzedAt: string;
  previousAnalyzedAt: string | null;
}

/**
 * Fire-and-forget: trigger backpack deep analysis on the server.
 * Returns the analysis result on success, null on failure.
 * Non-blocking — failures are logged but don't crash the app.
 */
export async function callBackpackAnalysis(
  _userId: string,
  backpackText: string,
  persona: 'elias' | 'kim',
): Promise<BackpackAnalysisResult | null> {
  try {
    const minimized = minimizeAnalysisText(backpackText, 12_000).text;
    const data = await callMinimalProxyJson<Partial<BackpackAnalysisResult>>({
      persona,
      systemPrompt: `Analyze the minimized narrative as working hypotheses, never diagnoses. Return only JSON with schemas, modi, triggers, coreBeliefs, copingPatterns. Each schema/mode item has name, confidence 0..1 and short evidence. Preserve persona separation.`,
      messages: [{ role: 'user', content: minimized }],
      model: 'gpt-4o-2024-08-06',
      maxTokens: 2000,
      temperature: 0,
      promptBuildVersion: 'backpack-schema-mode-analysis-client-v2',
    });
    const analysis: BackpackAnalysisResult = {
      schemas: normalizeNamedItems(data.schemas),
      modi: normalizeNamedItems(data.modi),
      triggers: normalizeStrings(data.triggers),
      coreBeliefs: normalizeStrings(data.coreBeliefs),
      copingPatterns: normalizeStrings(data.copingPatterns),
      analysisVersion: 1,
      analyzedAt: typeof data.analyzedAt === 'string' ? data.analyzedAt : LocalDeviceTimeService.now().utcIso,
      previousAnalyzedAt: null,
    };
    console.log(`[BackpackAnalysis] Success: ${analysis.schemas.length} schemas, ${analysis.triggers.length} triggers`);
    return analysis;
  } catch (error) {
    console.error('[BackpackAnalysis] Minimal-proxy error:', error);
    return null;
  }
}

function normalizeStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
}

function normalizeNamedItems(raw: unknown): Array<{ name: string; confidence: number; evidence: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      evidence: String(item.evidence ?? '').slice(0, 240),
    }))
    .filter((item) => item.name.length > 0)
    .slice(0, 30);
}
