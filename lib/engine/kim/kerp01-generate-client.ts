/**
 * KERP01 — Client-side call to AI-powered Eigen Regie Plan generation.
 *
 * Builds the plan prompt on the client and uses the generic Railway minimal proxy.
 */
import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';
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
    const sections = input.lifeStorySections
      .filter((section) => section.content.trim().length > 0)
      .map((section) => `### ${section.title}\n${minimizeAnalysisText(section.content, 4_000).text}`)
      .join('\n\n');
    if (sections.trim().length < 50) {
      return { success: false, error: 'Te weinig informatie in het levensverhaal om een plan te genereren. Vul eerst meer secties in.' };
    }
    const languageRule = input.language === 'en'
      ? 'Write every value in English.'
      : input.language === 'fr'
        ? 'Écris toutes les valeurs en français.'
        : 'Schrijf alle waarden in het Nederlands.';
    const context = [
      input.intakeContext ? `Context: ${minimizeAnalysisText(input.intakeContext, 1_200).text}` : '',
      input.knownTriggers?.length ? `Bekende triggers: ${input.knownTriggers.slice(0, 20).join('; ')}` : '',
      input.knownPatterns?.length ? `Bekende patronen: ${input.knownPatterns.slice(0, 20).join('; ')}` : '',
    ].filter(Boolean).join('\n');
    const result = await callMinimalProxyJson<Omit<GenerateResult, 'success' | 'error'>>({
      persona: 'kim',
      systemPrompt: `Build a Personal Autonomy/Eigen Regie plan for a loved one of someone with addiction. Never diagnose, blame, take sides, or treat the narrator as the person with addiction. ${languageRule} Return only JSON with five zones: donkergroen, lichtgroen, geel, oranje, rood. Each zone contains signals, bodySignals, thoughts, behaviour, whatHelps, boundaryActions and anchorSentence. Also return triggers and mainAnchorSentence.`,
      messages: [{ role: 'user', content: `${context}\n\nLevensverhaal:\n${sections}` }],
      model: 'gpt-4o-2024-08-06',
      maxTokens: 2400,
      temperature: 0.2,
      promptBuildVersion: 'kerp01-plan-client-v2',
    });
    if (!result.zones?.donkergroen || !result.zones?.rood) {
      return { success: false, error: 'AI genereerde een onvolledig plan. Probeer opnieuw.' };
    }
    return {
      success: true,
      zones: result.zones,
      triggers: Array.isArray(result.triggers) ? result.triggers : [],
      mainAnchorSentence: result.mainAnchorSentence ?? '',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[KERP01-Client] Call failed:', msg);
    return {
      success: false,
      error: `Plan generatie mislukt: ${msg}`,
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
