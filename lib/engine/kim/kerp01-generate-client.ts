/**
 * KERP01 — Client-side call to AI-powered Eigen Regie Plan generation.
 *
 * Calls the server endpoint `/api/trpc/ai.generateEigenRegiePlan`
 * following the same pattern as `lib/backpack-extractor/client.ts`.
 */
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import type { EigenRegiePlan, EigenRegieZoneEntry, EigenRegieTrigger } from './kerp01-types';

interface LifeStorySection {
  title: string;
  content: string;
}

interface GenerateInput {
  lifeStorySections: LifeStorySection[];
  knownTriggers?: string[];
  knownPatterns?: string[];
  intakeContext?: string;
  userName?: string;
  language?: 'nl' | 'en' | 'fr';
}

interface ZoneProposal {
  signals: string[];
  bodySignals: string[];
  thoughts: string[];
  behaviour: string[];
  whatHelps: string[];
  boundaryActions: string[];
  anchorSentence: string;
}

interface GenerateResult {
  success: boolean;
  zones?: {
    donkergroen: ZoneProposal;
    lichtgroen: ZoneProposal;
    geel: ZoneProposal;
    oranje: ZoneProposal;
    rood: ZoneProposal;
  };
  triggers?: Array<{
    lossOfRegiePattern: string;
    healthyResponse: string;
    boundaryRule: string;
  }>;
  mainAnchorSentence?: string;
  error?: string;
}

/**
 * Call the server-side KERP01 generation endpoint.
 * Returns a GenerateResult with zone proposals on success, or error message on failure.
 */
export async function callGenerateEigenRegiePlan(input: GenerateInput): Promise<GenerateResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${apiBaseUrl}/api/trpc/ai.generateEigenRegiePlan`;
    console.log('[KERP01-Client] Calling generation endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        json: input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[KERP01-Client] Server error:', response.status, errorText.substring(0, 200));
      return {
        success: false,
        error: `Server fout (${response.status}). Probeer later opnieuw.`,
      };
    }

    const data = await response.json();
    const result = data?.result?.data?.json;

    if (!result) {
      console.error('[KERP01-Client] Unexpected response structure:', JSON.stringify(data).substring(0, 200));
      return {
        success: false,
        error: 'Onverwacht antwoord van server.',
      };
    }

    return result as GenerateResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[KERP01-Client] Call failed:', msg);
    return {
      success: false,
      error: `Verbindingsfout: ${msg}`,
    };
  }
}

/**
 * Convert AI-generated zone proposals into the EigenRegiePlan format.
 * This maps the server response into the plan structure the wizard uses.
 */
export function convertProposalToPlan(result: GenerateResult): Partial<EigenRegiePlan> | null {
  if (!result.success || !result.zones) return null;

  const zoneIds = ['donkergroen', 'lichtgroen', 'geel', 'oranje', 'rood'] as const;
  const zones: Record<string, EigenRegieZoneEntry> = {};

  const zoneLabels: Record<string, string> = {
    donkergroen: 'Vrij van verslaving',
    lichtgroen: 'Terug naar verslaving',
    geel: 'Wisselzone',
    oranje: 'Rond de ander',
    rood: 'Verlies van regie',
  };

  for (const id of zoneIds) {
    const proposal = result.zones[id];
    if (!proposal) continue;
    zones[id] = {
      label: zoneLabels[id] || id,
      userMeaning: '',
      signals: proposal.signals || [],
      bodySignals: proposal.bodySignals || [],
      thoughts: proposal.thoughts || [],
      behaviour: proposal.behaviour || [],
      whatHelps: proposal.whatHelps || [],
      boundaryActions: proposal.boundaryActions || [],
      contactRule: '',
      anchorSentence: proposal.anchorSentence || '',
      connectionIntent: '',
      bridgeSentence: '',
      repairCondition: '',
      safetyException: '',
    };
  }

  const triggers: EigenRegieTrigger[] = (result.triggers || []).map(t => ({
    trigger: t.lossOfRegiePattern || '',
    lossOfRegiePattern: t.lossOfRegiePattern || '',
    healthyResponse: t.healthyResponse || '',
  }));

  const boundaryRules = (result.triggers || [])
    .map(t => t.boundaryRule)
    .filter(Boolean);

  return {
    zones: zones as EigenRegiePlan['zones'],
    triggers,
    boundaryRules,
    mainAnchorSentence: result.mainAnchorSentence || '',
  };
}
