/**
 * BackpackDeepAnalysis — Client
 *
 * Fire-and-forget call to POST /api/backpack/analyze after each backpack save.
 * Non-blocking: failures are logged but never crash the app or block the UI.
 */

import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';

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
  userId: string,
  backpackText: string
): Promise<BackpackAnalysisResult | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${apiBaseUrl}/api/backpack/analyze`;

    console.log('[BackpackAnalysis] Triggering deep analysis...');

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        userId,
        backpackText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackpackAnalysis] Server error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();

    if (data?.success && data?.analysis) {
      console.log(`[BackpackAnalysis] Success: ${data.analysis.schemas?.length ?? 0} schemas, ${data.analysis.triggers?.length ?? 0} triggers`);
      return data.analysis as BackpackAnalysisResult;
    }

    console.warn('[BackpackAnalysis] Unexpected response format:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error) {
    console.error('[BackpackAnalysis] Network error:', error);
    return null;
  }
}
