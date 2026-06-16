/**
 * VSP Backpack Analysis — Client
 *
 * Fire-and-forget call to POST /api/backpack/vsp-analyze after backpack themes change.
 * Non-blocking: failures are logged but never crash the app.
 * store:false — no conversation data persisted.
 */
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import type { VspBackpackProfileCached } from './vsp-backpack-analyzer';
import { buildVspProfileContextBlock } from './vsp-backpack-analyzer';

/**
 * Call server to analyze VSP zones from themes content.
 * Returns structured profile with contextBlock, or null on failure.
 */
export async function callVspBackpackAnalysis(input: {
  themesContent: string;
  sourceHash: string;
}): Promise<VspBackpackProfileCached | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${apiBaseUrl}/api/backpack/vsp-analyze`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ themesContent: input.themesContent, store: false }),
    });

    if (!response.ok) {
      console.error('[VspBackpackClient] Server error:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data?.success || !data?.profile) {
      console.warn('[VspBackpackClient] Unexpected response');
      return null;
    }

    const profile = data.profile as { green: string[]; yellow: string[]; orange: string[]; red: string[]; purple: string[] };
    const contextBlock = buildVspProfileContextBlock(profile);

    return {
      ...profile,
      contextBlock,
      analyzedAt: new Date().toISOString(),
      sourceHash: input.sourceHash,
    };
  } catch (error) {
    console.error('[VspBackpackClient] Network error:', error);
    return null;
  }
}
