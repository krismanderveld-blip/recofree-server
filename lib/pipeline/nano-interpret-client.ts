/**
 * nano-interpret-client.ts — Client-side nano-interpret caller
 *
 * Sends a client-built semantic prompt through the Railway minimal proxy.
 *
 * Used in the client pipeline BEFORE selectDominantState() to replace
 * keyword-based module detection with semantic understanding.
 */

import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import {
  KIM_CRISIS_MODULE,
  KIM_MODULE_CATALOG,
  KIM_THERAPEUTIC_MODULES,
} from '@/lib/engine/kim/module-catalog';
import { buildNanoSystemPrompt, resolveNanoModuleClient } from '@/lib/pipeline/nano-interpret-routing';

export interface ClientNanoInterpretResult {
  translatedNL: string;
  intent: string;
  themes: string[];
  resolvedModule: string | null;
  matchedTheme: string | null;
}

const KIM_ALLOWED_MODULES = new Set<string>([
  KIM_CRISIS_MODULE,
  ...KIM_MODULE_CATALOG.map((module) => module.id),
  ...KIM_THERAPEUTIC_MODULES.map((module) => module.id),
]);

const SELF_DEVALUATION_EVIDENCE: Readonly<Record<string, RegExp>> = {
  self_disgust: /\b(?:zelfwalg|walg\s+van\s+mezelf|afkeer\s+van\s+mezelf|ik\s+ben\s+vies|disgusted\s+with\s+myself|self[ -]?disgust)\b/i,
  self_hatred: /\b(?:zelfhaat|haat\s+mezelf|ik\s+haat\s+mezelf|hate\s+myself|self[ -]?hatred)\b/i,
  self_hate_at_vulnerability: /\b(?:zelfhaat|haat\s+mezelf|ik\s+haat\s+mezelf|schaam\s+me\s+voor\s+(?:mijn|die)\s+kwetsbaarheid|haat\s+dat\s+ik\s+(?:zo\s+)?kwetsbaar|hate\s+myself|self[ -]?hatred|ashamed\s+of\s+(?:my\s+)?vulnerability)\b/i,
  worthlessness: /\b(?:waardeloos|niets\s+waard|ik\s+beteken\s+niets|nutteloos|worthless|good\s+for\s+nothing)\b/i,
  self_criticism: /\b(?:verwijt\s+mezelf|hard\s+voor\s+mezelf|ik\s+doe\s+alles\s+fout|mijn\s+schuld|self[ -]?criticism|blame\s+myself)\b/i,
};

/**
 * Nano remains advisory. Unsupported self-devaluation themes are removed and
 * Kim may not inherit an Elias module. The client engine remains authoritative.
 */
export function normalizeClientNanoInterpretResult(
  result: ClientNanoInterpretResult,
  userMessage: string,
  persona: 'elias' | 'kim',
): ClientNanoInterpretResult {
  const themes = result.themes.filter((theme) => {
    const requiredEvidence = SELF_DEVALUATION_EVIDENCE[theme];
    return !requiredEvidence || requiredEvidence.test(userMessage);
  });
  const matchedTheme = result.matchedTheme && themes.includes(result.matchedTheme)
    ? result.matchedTheme
    : null;
  const resolvedModule = persona === 'kim' && result.resolvedModule && !KIM_ALLOWED_MODULES.has(result.resolvedModule)
    ? null
    : result.resolvedModule;

  return { ...result, themes, matchedTheme, resolvedModule };
}

/**
 * Call the nano-interpret proxy on Railway.
 * Returns null on failure (caller should fall back to keyword matching).
 * Timeout: 8s (nano is fast, but Railway cold starts can add latency).
 */
export async function callNanoInterpret(
  userMessage: string,
  persona: 'elias' | 'kim',
): Promise<ClientNanoInterpretResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const data = await callMinimalProxyJson<{
      translatedNL?: string;
      intent?: string;
      themes?: string[];
    }>({
      persona,
      systemPrompt: buildNanoSystemPrompt(persona),
      messages: [{ role: 'user', content: userMessage }],
      model: 'gpt-4o-mini',
      maxTokens: 350,
      temperature: 0.1,
      promptBuildVersion: 'nano-interpret-client-v2',
      signal: controller.signal,
    });
    const resolved = resolveNanoModuleClient(Array.isArray(data.themes) ? data.themes : [], persona);

    return normalizeClientNanoInterpretResult({
      translatedNL: data.translatedNL ?? userMessage,
      intent: data.intent ?? 'exploring',
      themes: resolved.themes,
      resolvedModule: resolved.resolvedModule,
      matchedTheme: resolved.matchedTheme,
    }, userMessage, persona);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[NanoInterpretClient] Timeout (8s) — falling back to keyword matching');
    } else {
      console.warn('[NanoInterpretClient] Error:', err.message ?? err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
