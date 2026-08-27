import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import { LocalDeviceTimeService } from '@/lib/core/time';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';
import type {
  ExtractedContext,
  ExtractedEntities,
  ExtractedEvent,
  ExtractedPattern,
  ExtractedPerson,
  ExtractionRequest,
} from './types';
import { EXTRACTION_SCHEMA_VERSION } from './types';

export function buildClientExtractionPrompt(request: ExtractionRequest): string {
  const chunks: string[] = [];
  if (request.intakeContext.trim()) {
    chunks.push(`[Intake Context]: ${minimizeAnalysisText(request.intakeContext, 1_500).text}`);
  }
  for (const section of request.sections) {
    if (section.content.trim()) chunks.push(`[${section.label}]: ${minimizeAnalysisText(section.content, 6_000).text}`);
  }
  if (request.kimSections) {
    const entries: Array<[string, string]> = [
      ['My Story (Kim perspective)', request.kimSections.my_story],
      ['The Relationship', request.kimSections.the_relationship],
      ['The Impact', request.kimSections.the_impact],
      ['My Boundaries', request.kimSections.my_boundaries],
      ['My Strength', request.kimSections.my_strength],
    ];
    for (const [label, content] of entries) {
      if (content.trim()) chunks.push(`[${label}]: ${minimizeAnalysisText(content, 6_000).text}`);
    }
  }
  if (chunks.join('\n').trim().length < 20) return '';
  const personaRule = request.userType === 'kim'
    ? 'The narrator is a loved one of someone with addiction, not the person with addiction.'
    : 'The narrator is describing their own addiction recovery context.';
  return `Extract structured facts from this minimized narrative. ${personaRule}
Do not diagnose, infer unstated facts, or merge the two personas. Preserve explicitly written names and relationships.
Return ONLY JSON with this exact shape:
{"persons":[{"name":"","relationship":"","relationshipNL":"","age":null,"livingSituation":null,"emotionalValence":"positive|negative|ambivalent|neutral","context":"","sourceSection":""}],"events":[{"description":"","type":"trauma|loss|turning_point|relapse|achievement|conflict|abuse|neglect|other","timePeriod":null,"peopleInvolved":[],"emotionalImpact":"","isTriggerSource":false,"sourceSection":""}],"patterns":[{"description":"","type":"relational|behavioral|emotional|coping|avoidance|schema|cycle","schemaHypothesis":null,"frequency":"once|recurring|chronic","peopleInvolved":[],"sourceSection":""}],"contexts":[{"description":"","type":"work|living|social|health|financial|legal|other","relevance":"","sourceSection":""}]}
MINIMIZED NARRATIVE:\n${chunks.join('\n\n')}`;
}

export async function extractEntitiesClient(
  request: ExtractionRequest,
  sourceHash: string,
): Promise<ExtractedEntities | null> {
  const prompt = buildClientExtractionPrompt(request);
  if (!prompt) return emptyEntities(sourceHash);
  try {
    const parsed = await callMinimalProxyJson<Record<string, unknown>>({
      persona: request.userType,
      systemPrompt: 'You are a precise entity extraction formatter. Output only valid JSON matching the requested shape.',
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4o-mini',
      maxTokens: 1800,
      temperature: 0,
      promptBuildVersion: 'backpack-entity-extraction-client-v2',
    });
    return {
      persons: validatePersons(parsed.persons),
      events: validateEvents(parsed.events),
      patterns: validatePatterns(parsed.patterns),
      contexts: validateContexts(parsed.contexts),
      extractedAt: LocalDeviceTimeService.now().utcIso,
      sourceHash,
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
    };
  } catch (error) {
    console.error('[BackpackExtractor] Minimal-proxy extraction failed:', error);
    return null;
  }
}

function emptyEntities(sourceHash: string): ExtractedEntities {
  return { persons: [], events: [], patterns: [], contexts: [], extractedAt: LocalDeviceTimeService.now().utcIso, sourceHash, schemaVersion: EXTRACTION_SCHEMA_VERSION };
}

function records(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function validatePersons(raw: unknown): ExtractedPerson[] {
  return records(raw).map((item) => ({
    name: String(item.name ?? ''), relationship: String(item.relationship ?? ''),
    relationshipNL: String(item.relationshipNL ?? item.relationship ?? ''), age: item.age ? String(item.age) : null,
    livingSituation: item.livingSituation ? String(item.livingSituation) : null,
    emotionalValence: oneOf(item.emotionalValence, ['positive', 'negative', 'ambivalent', 'neutral'] as const, 'neutral'),
    context: String(item.context ?? ''), sourceSection: String(item.sourceSection ?? ''),
  })).filter((item) => item.name.length > 0);
}

function validateEvents(raw: unknown): ExtractedEvent[] {
  return records(raw).map((item) => ({
    description: String(item.description ?? ''),
    type: oneOf(item.type, ['trauma', 'loss', 'turning_point', 'relapse', 'achievement', 'conflict', 'abuse', 'neglect', 'other'] as const, 'other'),
    timePeriod: item.timePeriod ? String(item.timePeriod) : null,
    peopleInvolved: Array.isArray(item.peopleInvolved) ? item.peopleInvolved.map(String) : [],
    emotionalImpact: String(item.emotionalImpact ?? ''), isTriggerSource: Boolean(item.isTriggerSource),
    sourceSection: String(item.sourceSection ?? ''),
  })).filter((item) => item.description.length > 0);
}

function validatePatterns(raw: unknown): ExtractedPattern[] {
  return records(raw).map((item) => ({
    description: String(item.description ?? ''),
    type: oneOf(item.type, ['relational', 'behavioral', 'emotional', 'coping', 'avoidance', 'schema', 'cycle'] as const, 'behavioral'),
    schemaHypothesis: item.schemaHypothesis ? String(item.schemaHypothesis) : null,
    frequency: oneOf(item.frequency, ['once', 'recurring', 'chronic'] as const, 'once'),
    peopleInvolved: Array.isArray(item.peopleInvolved) ? item.peopleInvolved.map(String) : [],
    sourceSection: String(item.sourceSection ?? ''),
  })).filter((item) => item.description.length > 0);
}

function validateContexts(raw: unknown): ExtractedContext[] {
  return records(raw).map((item) => ({
    description: String(item.description ?? ''),
    type: oneOf(item.type, ['work', 'living', 'social', 'health', 'financial', 'legal', 'other'] as const, 'other'),
    relevance: String(item.relevance ?? ''), sourceSection: String(item.sourceSection ?? ''),
  })).filter((item) => item.description.length > 0);
}
