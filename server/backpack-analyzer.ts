/**
 * BackpackAnalyzer — Server-side GPT Analysis for Schema/Mode Candidates
 *
 * Receives changed backpack sections, calls LLM to identify:
 * - Young schema candidates (with domain, confidence, evidence)
 * - Mode candidates (with confidence, evidence)
 *
 * Called from the client ONLY when a backpack section has been modified
 * (section.lastUpdated > lastAnalysisTimestamp). Runs once per change, not per session.
 *
 * Supports both Elias (addiction recovery) and Kim (loved one/naaste) personas.
 */

import { z } from 'zod';
import { invokeLLM } from './_core/llm';

// ─── Types ────────────────────────────────────────────────────────

export interface AnalyzedSchema {
  schemaId: string;
  domain: string;
  confidence: number;
  evidence: string;
  sourceSectionId: string;
}

export interface AnalyzedMode {
  modeId: string;
  confidence: number;
  evidence: string;
  sourceSectionId: string;
}

export interface BackpackAnalysisResult {
  schemas: AnalyzedSchema[];
  modes: AnalyzedMode[];
  analysisTimestamp: string;
  analyzedSectionIds: string[];
}

// ─── Zod Schema for tRPC ──────────────────────────────────────────

export const analyzeBackpackInputSchema = z.object({
  userName: z.string(),
  userType: z.enum(['elias', 'kim']),
  sections: z.array(z.object({
    id: z.string(),
    label: z.string(),
    content: z.string(),
  })),
  changedSectionIds: z.array(z.string()),
});

export type AnalyzeBackpackInput = z.infer<typeof analyzeBackpackInputSchema>;

// ─── Prompt Builders ──────────────────────────────────────────────

function buildEliasAnalysisPrompt(userName: string, sections: AnalyzeBackpackInput['sections']): string {
  let sectionText = '';
  for (const section of sections) {
    if (section.content && section.content.trim().length > 0) {
      sectionText += `[${section.label} (${section.id})]: ${section.content.trim()}\n\n`;
    }
  }

  if (sectionText.trim().length < 30) return '';

  return `You are a clinical schema therapist analyzing a personal narrative written by "${userName}" who is in addiction recovery.

Analyze the following life story sections and identify:
1. **Young Schema candidates** — recurring maladaptive patterns from Jeffrey Young's Schema Therapy model
2. **Mode candidates** — schema modes (child modes, parent modes, coping modes, healthy adult)

IMPORTANT RULES:
- Only identify schemas/modes that have CLEAR textual evidence in the narrative
- Confidence must be between 0.3 and 0.95 (never 1.0 — this is hypothesis, not diagnosis)
- Each schema must include the specific domain (Disconnection & Rejection, Impaired Autonomy, Impaired Limits, Other-Directedness, Overvigilance & Inhibition)
- Use standard Young schema IDs: abandonment, mistrust_abuse, emotional_deprivation, defectiveness, social_isolation, dependence, vulnerability, enmeshment, failure, entitlement, insufficient_self_control, subjugation, self_sacrifice, approval_seeking, negativity, emotional_inhibition, unrelenting_standards, punitiveness
- Use standard mode IDs: vulnerable_child, angry_child, impulsive_child, happy_child, punitive_parent, demanding_parent, detached_protector, compliant_surrenderer, overcompensator, bully_attack, healthy_adult
- Include the source section ID for traceability
- Do NOT invent evidence — quote or paraphrase actual content

SECTIONS TO ANALYZE:
${sectionText}

Respond with a JSON object:
{
  "schemas": [{ "schemaId": string, "domain": string, "confidence": number, "evidence": string, "sourceSectionId": string }],
  "modes": [{ "modeId": string, "confidence": number, "evidence": string, "sourceSectionId": string }]
}`;
}

function buildKimAnalysisPrompt(userName: string, sections: AnalyzeBackpackInput['sections']): string {
  let sectionText = '';
  for (const section of sections) {
    if (section.content && section.content.trim().length > 0) {
      sectionText += `[${section.label} (${section.id})]: ${section.content.trim()}\n\n`;
    }
  }

  if (sectionText.trim().length < 30) return '';

  return `You are a clinical schema therapist analyzing a personal narrative written by "${userName}" who is a loved one (naaste) of someone with addiction.

This person is NOT the one with the addiction — they are affected by someone else's addiction. Their patterns often involve caretaking, boundary erosion, codependency, and emotional suppression.

Analyze the following sections and identify:
1. **Young Schema candidates** — recurring maladaptive patterns relevant to loved ones of addicts
2. **Mode candidates** — schema modes active in this person's coping with the situation

IMPORTANT RULES:
- Only identify schemas/modes that have CLEAR textual evidence in the narrative
- Confidence must be between 0.3 and 0.95 (never 1.0 — this is hypothesis, not diagnosis)
- Common schemas for loved ones: self_sacrifice, subjugation, emotional_deprivation, abandonment, enmeshment, unrelenting_standards, emotional_inhibition, approval_seeking, dependence, defectiveness
- Common modes for loved ones: vulnerable_child, punitive_parent, demanding_parent, compliant_surrenderer, detached_protector, overcompensator, healthy_adult
- Each schema must include the specific domain
- Include the source section ID for traceability
- Do NOT invent evidence — quote or paraphrase actual content

SECTIONS TO ANALYZE:
${sectionText}

Respond with a JSON object:
{
  "schemas": [{ "schemaId": string, "domain": string, "confidence": number, "evidence": string, "sourceSectionId": string }],
  "modes": [{ "modeId": string, "confidence": number, "evidence": string, "sourceSectionId": string }]
}`;
}

// ─── LLM Call ─────────────────────────────────────────────────────

export async function analyzeBackpackForSchemas(input: AnalyzeBackpackInput): Promise<BackpackAnalysisResult> {
  const { userName, userType, sections, changedSectionIds } = input;

  // Only analyze sections that actually changed
  const sectionsToAnalyze = sections.filter(s =>
    changedSectionIds.includes(s.id) && s.content && s.content.trim().length > 0
  );

  if (sectionsToAnalyze.length === 0) {
    return {
      schemas: [],
      modes: [],
      analysisTimestamp: new Date().toISOString(),
      analyzedSectionIds: [],
    };
  }

  const prompt = userType === 'kim'
    ? buildKimAnalysisPrompt(userName, sectionsToAnalyze)
    : buildEliasAnalysisPrompt(userName, sectionsToAnalyze);

  if (!prompt) {
    return {
      schemas: [],
      modes: [],
      analysisTimestamp: new Date().toISOString(),
      analyzedSectionIds: changedSectionIds,
    };
  }

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a precise clinical schema analyst. Output ONLY valid JSON. No markdown, no explanation, no code blocks. Just the JSON object.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    // Parse JSON (strip potential markdown code blocks)
    const cleanJson = responseText
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    const schemas = validateSchemas(parsed.schemas ?? [], changedSectionIds);
    const modes = validateModes(parsed.modes ?? [], changedSectionIds);

    console.log(`[BackpackAnalyzer] ${userType} analysis: ${schemas.length} schemas, ${modes.length} modes from ${sectionsToAnalyze.length} sections`);

    return {
      schemas,
      modes,
      analysisTimestamp: new Date().toISOString(),
      analyzedSectionIds: changedSectionIds,
    };
  } catch (error) {
    console.error('[BackpackAnalyzer] Analysis failed:', error);
    return {
      schemas: [],
      modes: [],
      analysisTimestamp: new Date().toISOString(),
      analyzedSectionIds: changedSectionIds,
    };
  }
}

// ─── Validation Helpers ───────────────────────────────────────────

const VALID_SCHEMA_IDS = [
  'abandonment', 'mistrust_abuse', 'emotional_deprivation', 'defectiveness',
  'social_isolation', 'dependence', 'vulnerability', 'enmeshment', 'failure',
  'entitlement', 'insufficient_self_control', 'subjugation', 'self_sacrifice',
  'approval_seeking', 'negativity', 'emotional_inhibition', 'unrelenting_standards',
  'punitiveness',
] as const;

const VALID_MODE_IDS = [
  'vulnerable_child', 'angry_child', 'impulsive_child', 'happy_child',
  'punitive_parent', 'demanding_parent', 'detached_protector',
  'compliant_surrenderer', 'overcompensator', 'bully_attack', 'healthy_adult',
] as const;

const VALID_DOMAINS = [
  'Disconnection & Rejection',
  'Impaired Autonomy & Performance',
  'Impaired Limits',
  'Other-Directedness',
  'Overvigilance & Inhibition',
] as const;

function validateSchemas(raw: unknown[], validSectionIds: string[]): AnalyzedSchema[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map(s => ({
      schemaId: String(s.schemaId ?? '').toLowerCase().replace(/\s+/g, '_'),
      domain: String(s.domain ?? 'Unknown'),
      confidence: Math.min(0.95, Math.max(0.1, Number(s.confidence) || 0.5)),
      evidence: String(s.evidence ?? '').substring(0, 500),
      sourceSectionId: String(s.sourceSectionId ?? validSectionIds[0] ?? ''),
    }))
    .filter(s => s.schemaId.length > 0 && s.evidence.length > 0);
}

function validateModes(raw: unknown[], validSectionIds: string[]): AnalyzedMode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .map(m => ({
      modeId: String(m.modeId ?? '').toLowerCase().replace(/\s+/g, '_'),
      confidence: Math.min(0.95, Math.max(0.1, Number(m.confidence) || 0.5)),
      evidence: String(m.evidence ?? '').substring(0, 500),
      sourceSectionId: String(m.sourceSectionId ?? validSectionIds[0] ?? ''),
    }))
    .filter(m => m.modeId.length > 0 && m.evidence.length > 0);
}
