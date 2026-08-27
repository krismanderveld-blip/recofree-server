/**
 * VSP Backpack Analysis — Client
 *
 * Fire-and-forget client-built minimal-proxy analysis after backpack themes change.
 * Non-blocking: failures are logged but never crash the app.
 * store:false — no conversation data persisted.
 */
import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import type { VspBackpackProfileCached } from './vsp-backpack-analyzer';
import { buildVspProfileContextBlock } from './vsp-backpack-analyzer';
import { LocalDeviceTimeService } from "@/lib/core/time";
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';

type VspProfile = { green: string[]; yellow: string[]; orange: string[]; red: string[]; purple: string[] };

const VSP_PROFILE_PROMPT = `Extract only user-written personal signals for GREEN, YELLOW, ORANGE, RED and PURPLE VSP zones.
Never diagnose or invent. Return only JSON with string arrays: green, yellow, orange, red, purple.
Each phrase must contain at most 10 words. Use an empty array when a zone has no evidence.`;

function normalizeProfile(value: unknown): VspProfile | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const normalize = (key: keyof VspProfile) => Array.isArray(record[key])
    ? record[key].filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20)
    : [];
  return {
    green: normalize('green'),
    yellow: normalize('yellow'),
    orange: normalize('orange'),
    red: normalize('red'),
    purple: normalize('purple'),
  };
}

/**
 * Analyze VSP zones through the generic minimal proxy.
 * Returns structured profile with contextBlock, or null on failure.
 */
export async function callVspBackpackAnalysis(input: {
  themesContent: string;
  sourceHash: string;
}): Promise<VspBackpackProfileCached | null> {
  try {
    const minimized = minimizeAnalysisText(input.themesContent, 6_000).text;
    const raw = await callMinimalProxyJson<unknown>({
      persona: 'elias',
      systemPrompt: VSP_PROFILE_PROMPT,
      messages: [{ role: 'user', content: `Recurring themes:\n${minimized}` }],
      model: 'gpt-4o-mini',
      maxTokens: 1_500,
      temperature: 0,
      promptBuildVersion: 'vsp-backpack-profile-v2-client',
    });
    const profile = normalizeProfile(raw);
    if (!profile) {
      console.warn('[VspBackpackClient] Unexpected response');
      return null;
    }
    const contextBlock = buildVspProfileContextBlock(profile);

    return {
      ...profile,
      contextBlock,
      analyzedAt: LocalDeviceTimeService.now().utcIso,
      sourceHash: input.sourceHash,
    };
  } catch (error) {
    console.error('[VspBackpackClient] Minimal proxy error:', error);
    return null;
  }
}
