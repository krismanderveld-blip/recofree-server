/**
 * BackpackEntityExtractor — Server-side LLM Extraction
 *
 * Receives backpack text sections, calls LLM to extract structured entities
 * (persons, events, patterns, contexts), returns them as typed JSON.
 *
 * Called from the client ONLY when backpack content has changed (hash mismatch).
 */

import { z } from 'zod';
import { invokeLLM } from './_core/llm';
import type {
  ExtractedEntities,
  ExtractedPerson,
  ExtractedEvent,
  ExtractedPattern,
  ExtractedContext,
  ExtractionRequest,
} from '../lib/backpack-extractor/types';
import { EXTRACTION_SCHEMA_VERSION } from '../lib/backpack-extractor/types';

// ─── Extraction Prompt ─────────────────────────────────────────

function buildExtractionPrompt(request: ExtractionRequest): string {
  const { userName, userType, sections, kimSections, intakeContext } = request;

  let allText = '';

  // Intake context
  if (intakeContext && intakeContext.trim().length > 0) {
    allText += `[Intake Context]: ${intakeContext.trim()}\n\n`;
  }

  // Life-phase sections (Elias)
  for (const section of sections) {
    if (section.content && section.content.trim().length > 0) {
      allText += `[${section.label}]: ${section.content.trim()}\n\n`;
    }
  }

  // Kim backpack sections
  if (kimSections) {
    const mapping: Array<[string, string]> = [
      ['My Story (Kim perspective)', kimSections.my_story],
      ['The Relationship', kimSections.the_relationship],
      ['The Impact', kimSections.the_impact],
      ['My Boundaries', kimSections.my_boundaries],
      ['My Strength', kimSections.my_strength],
    ];
    for (const [title, content] of mapping) {
      if (content && content.trim().length > 0) {
        allText += `[${title}]: ${content.trim()}\n\n`;
      }
    }
  }

  if (allText.trim().length < 20) {
    return ''; // Not enough content to extract from
  }

  const userTypeContext = userType === 'kim'
    ? 'This person is a loved one (naaste) of someone with addiction. They are NOT the person with the addiction themselves.'
    : 'This person is someone dealing with addiction recovery.';

  return `You are a clinical entity extractor. Extract ALL structured information from the following personal narrative written by "${userName}".

${userTypeContext}

IMPORTANT RULES:
- Extract EVERY person mentioned, no matter how briefly
- Extract EVERY significant event (trauma, loss, turning points, relapses, achievements, conflicts, abuse, neglect)
- Extract EVERY behavioral/relational/emotional pattern you can identify
- Extract contextual information (work, living situation, health, finances)
- Use the EXACT names and relationships as the user wrote them
- Do NOT invent or assume information not stated
- For each person: determine lifeStatus (alive, deceased, unknown). Look for keywords: overleden, gestorven, dood, verloren, died, passed away, RIP, helaas niet meer, is er niet meer. If a date of death is mentioned, include it.
- Emotional valence should reflect how the user FEELS about this person (not objective judgment)
- For Dutch text: keep names in original language, translate relationship types to English for the 'relationship' field but also provide Dutch in 'relationshipNL'
- Source section should reference which section the information came from

TEXT TO ANALYZE:
${allText}

Respond with a JSON object matching this exact structure:
{
  "persons": [{ "name": string, "relationship": string, "relationshipNL": string, "age": string|null, "livingSituation": string|null, "lifeStatus": "alive"|"deceased"|"unknown", "deceasedDate": string|null, "emotionalValence": "positive"|"negative"|"ambivalent"|"neutral", "context": string, "sourceSection": string }],
  "events": [{ "description": string, "type": "trauma"|"loss"|"turning_point"|"relapse"|"achievement"|"conflict"|"abuse"|"neglect"|"other", "timePeriod": string|null, "peopleInvolved": string[], "emotionalImpact": string, "isTriggerSource": boolean, "sourceSection": string }],
  "patterns": [{ "description": string, "type": "relational"|"behavioral"|"emotional"|"coping"|"avoidance"|"schema"|"cycle", "schemaHypothesis": string|null, "frequency": "once"|"recurring"|"chronic", "peopleInvolved": string[], "sourceSection": string }],
  "contexts": [{ "description": string, "type": "work"|"living"|"social"|"health"|"financial"|"legal"|"other", "relevance": string, "sourceSection": string }]
}`;
}

// ─── LLM Call ──────────────────────────────────────────────────

export async function extractEntitiesFromBackpack(
  request: ExtractionRequest,
  sourceHash: string
): Promise<ExtractedEntities> {
  const prompt = buildExtractionPrompt(request);

  if (!prompt) {
    // Not enough content — return empty entities
    return {
      persons: [],
      events: [],
      patterns: [],
      contexts: [],
      extractedAt: new Date().toISOString(),
      sourceHash,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
    };
  }

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a precise clinical entity extractor. Output ONLY valid JSON. No markdown, no explanation, no code blocks. Just the JSON object.',
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

    // Parse the JSON response (strip potential markdown code blocks)
    const cleanJson = responseText
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Validate and sanitize
    const entities: ExtractedEntities = {
      persons: validatePersons(parsed.persons ?? []),
      events: validateEvents(parsed.events ?? []),
      patterns: validatePatterns(parsed.patterns ?? []),
      contexts: validateContexts(parsed.contexts ?? []),
      extractedAt: new Date().toISOString(),
      sourceHash,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
    };

    console.log(`[BackpackExtractor] Extracted: ${entities.persons.length} persons, ${entities.events.length} events, ${entities.patterns.length} patterns, ${entities.contexts.length} contexts`);

    return entities;
  } catch (error) {
    console.error('[BackpackExtractor] Extraction failed:', error);
    // Return empty entities on failure — don't block the session
    return {
      persons: [],
      events: [],
      patterns: [],
      contexts: [],
      extractedAt: new Date().toISOString(),
      sourceHash,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
    };
  }
}

// ─── Validation Helpers ────────────────────────────────────────

function validatePersons(raw: unknown[]): ExtractedPerson[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map(p => ({
      name: String(p.name ?? ''),
      relationship: String(p.relationship ?? ''),
      relationshipNL: String(p.relationshipNL ?? p.relationship ?? ''),
      age: p.age ? String(p.age) : null,
      livingSituation: p.livingSituation ? String(p.livingSituation) : null,
      emotionalValence: validateValence(p.emotionalValence),
      context: String(p.context ?? ''),
      sourceSection: String(p.sourceSection ?? ''),
    }))
    .filter(p => p.name.length > 0);
}

function validateEvents(raw: unknown[]): ExtractedEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(e => ({
      description: String(e.description ?? ''),
      type: validateEventType(e.type),
      timePeriod: e.timePeriod ? String(e.timePeriod) : null,
      peopleInvolved: Array.isArray(e.peopleInvolved) ? e.peopleInvolved.map(String) : [],
      emotionalImpact: String(e.emotionalImpact ?? ''),
      isTriggerSource: Boolean(e.isTriggerSource),
      sourceSection: String(e.sourceSection ?? ''),
    }))
    .filter(e => e.description.length > 0);
}

function validatePatterns(raw: unknown[]): ExtractedPattern[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map(p => ({
      description: String(p.description ?? ''),
      type: validatePatternType(p.type),
      schemaHypothesis: p.schemaHypothesis ? String(p.schemaHypothesis) : null,
      frequency: validateFrequency(p.frequency),
      peopleInvolved: Array.isArray(p.peopleInvolved) ? p.peopleInvolved.map(String) : [],
      sourceSection: String(p.sourceSection ?? ''),
    }))
    .filter(p => p.description.length > 0);
}

function validateContexts(raw: unknown[]): ExtractedContext[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map(c => ({
      description: String(c.description ?? ''),
      type: validateContextType(c.type),
      relevance: String(c.relevance ?? ''),
      sourceSection: String(c.sourceSection ?? ''),
    }))
    .filter(c => c.description.length > 0);
}

// ─── Enum Validators ───────────────────────────────────────────

const VALID_VALENCES = ['positive', 'negative', 'ambivalent', 'neutral'] as const;
function validateValence(v: unknown): ExtractedPerson['emotionalValence'] {
  return VALID_VALENCES.includes(v as any) ? (v as ExtractedPerson['emotionalValence']) : 'neutral';
}

const VALID_EVENT_TYPES = ['trauma', 'loss', 'turning_point', 'relapse', 'achievement', 'conflict', 'abuse', 'neglect', 'other'] as const;
function validateEventType(t: unknown): ExtractedEvent['type'] {
  return VALID_EVENT_TYPES.includes(t as any) ? (t as ExtractedEvent['type']) : 'other';
}

const VALID_PATTERN_TYPES = ['relational', 'behavioral', 'emotional', 'coping', 'avoidance', 'schema', 'cycle'] as const;
function validatePatternType(t: unknown): ExtractedPattern['type'] {
  return VALID_PATTERN_TYPES.includes(t as any) ? (t as ExtractedPattern['type']) : 'behavioral';
}

const VALID_FREQUENCIES = ['once', 'recurring', 'chronic'] as const;
function validateFrequency(f: unknown): ExtractedPattern['frequency'] {
  return VALID_FREQUENCIES.includes(f as any) ? (f as ExtractedPattern['frequency']) : 'once';
}

const VALID_CONTEXT_TYPES = ['work', 'living', 'social', 'health', 'financial', 'legal', 'other'] as const;
function validateContextType(t: unknown): ExtractedContext['type'] {
  return VALID_CONTEXT_TYPES.includes(t as any) ? (t as ExtractedContext['type']) : 'other';
}

// ─── Zod Schema for tRPC ───────────────────────────────────────

export const extractionInputSchema = z.object({
  userName: z.string(),
  userType: z.enum(['elias', 'kim']),
  sections: z.array(z.object({
    id: z.string(),
    label: z.string(),
    content: z.string(),
  })),
  kimSections: z.object({
    my_story: z.string(),
    the_relationship: z.string(),
    the_impact: z.string(),
    my_boundaries: z.string(),
    my_strength: z.string(),
  }).optional(),
  intakeContext: z.string(),
  sourceHash: z.string(),
});

export type ExtractionInput = z.infer<typeof extractionInputSchema>;
