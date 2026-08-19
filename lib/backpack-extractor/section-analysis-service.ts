/**
 * BackpackSectionAnalysisService — Per-section GPT analysis with deep extraction.
 * Sends individual Backpack sections to GPT for structured analysis,
 * validates the response, and merges results into user.dat.
 *
 * Architecture:
 * - Client calls this service when a section is saved/changed
 * - Service calls Railway server (which proxies to OpenAI with store:false)
 * - Response is validated client-side
 * - Valid results are merged into user.dat following merge rules
 */

import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionMemoryCache } from '@/lib/crypto/session-memory-cache';
import type {
  BackpackSectionAnalysisResult,
  PersonAnchor,
  RelationEdge,
  LifeStatusFact,
  SchemaSignal,
  ModeSignal,
  SectionAnalysisStatus,
  ManualRefreshReport,
} from './section-analysis-types';

// ── Storage Keys ─────────────────────────────────────────────────────

const SECTION_HASHES_KEY = '@recofree_section_analysis_hashes';
const ANALYSIS_RESULTS_KEY = '@recofree_section_analysis_results';

// ── Hash Management ──────────────────────────────────────────────────

function computeSectionHash(content: string): string {
  // Simple hash: length + first/last chars + content checksum
  let hash = 0;
  const str = content.trim();
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `${str.length}_${Math.abs(hash).toString(36)}`;
}

export async function getSectionHashes(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SECTION_HASHES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveSectionHashes(hashes: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(SECTION_HASHES_KEY, JSON.stringify(hashes));
}

// ── GPT Analysis Call ────────────────────────────────────────────────

const SECTION_ANALYSIS_PROMPT = `You are a clinical memory extraction engine for a mental health support app.

Analyze the following Backpack section text and extract structured information.

RULES:
- Extract ONLY what is explicitly stated or clearly implied in the text.
- Do NOT invent facts, relationships, or events not supported by the text.
- Mark explicitInSource=true only when the fact is directly stated.
- Mark explicitInSource=false when reasonably inferred but not directly stated.
- Set confidence between 0.0 and 1.0 based on how clear the evidence is.
- Do NOT diagnose. All schemas and modes are signals, not diagnoses.
- Respond ONLY with valid JSON matching the schema below.
- Use Dutch for relationship labels (zoon, dochter, partner, vriendin, ex-partner, moeder, vader, etc.)
- All formulations are WORKING HYPOTHESES, never diagnoses or predictions.
- sourceEvidence must be a short quote or paraphrase from the text (max 150 chars), not a raw dump.
- For triggerChains: map the FULL pathway: event → meaning → emotion → mode → coping → risk.
- For developmentalFormulation: identify HOW early experiences shaped current patterns.
- For contraindications: identify topics/suggestions that would be harmful for THIS person.
- For safeFormulationHints: identify HOW to safely discuss sensitive topics with THIS person.
- Persona-specific fields: only extract relapsePathways/functionOfAddiction for Elias, only caregiverBurdenPathways/functionOfCaregivingPattern for Kim.

PERSONA CONTEXT: {{persona}}
SECTION ID: {{sectionId}}
SECTION TITLE: {{sectionTitle}}

OUTPUT JSON SCHEMA:
{
  "personalAnchors": [{ "name": string, "relationToUser": string (Dutch), "currentRelevance": "high"|"medium"|"low", "emotionallyImportant": boolean, "explicitInSource": boolean, "confidence": 0-1 }],
  "relationGraph": [{ "subjectPerson": string, "relation": string (Dutch, e.g. "moeder van"), "objectPerson": string, "explicitInSource": boolean, "confidence": 0-1 }],
  "lifeEvents": [{ "description": string, "type": "loss"|"trauma"|"achievement"|"transition"|"relapse"|"recovery"|"conflict"|"other", "timePeriod": string|null, "peopleInvolved": string[], "emotionalImpact": "positive"|"negative"|"mixed"|"neutral", "isTriggerSource": boolean }],
  "lifeStatusFacts": [{ "person": string, "status": "alive"|"deceased"|"unknown", "explicitInSource": boolean, "confidence": 0-1 }],
  "schemas": [{ "schema": string, "evidenceType": "explicit"|"inferred", "confidence": 0-1 }],
  "modes": [{ "mode": string, "evidenceType": "explicit"|"inferred", "confidence": 0-1 }],
  "triggers": [{ "trigger": string, "context": string, "severity": "high"|"medium"|"low", "confidence": 0-1 }],
  "protectiveFactors": [{ "factor": string, "domain": "social"|"personal"|"spiritual"|"professional"|"physical", "strength": "strong"|"moderate"|"fragile", "confidence": 0-1 }],
  "values": [{ "value": string, "importance": "core"|"important"|"emerging", "confidence": 0-1 }],
  "goals": [{ "goal": string, "timeframe": "short_term"|"medium_term"|"long_term"|"undefined", "confidence": 0-1 }],
  "risks": [{ "risk": string, "severity": "high"|"medium"|"low", "isActive": boolean, "confidence": 0-1 }],
  "recoveryPatterns": [{ "type": string, "description": string, "confidence": 0-1 }],
  "caregiverPatterns": [{ "type": string, "description": string, "confidence": 0-1 }],
  "developmentalFormulation": [{ "originPhase": "childhood"|"adolescence"|"early_adulthood"|"adulthood"|"unknown", "originContext": string, "learnedPattern": string, "currentManifestation": string, "sourceEvidence": string (max 150 chars quote from text), "confidence": 0-1 }],
  "triggerChains": [{ "triggerEvent": string, "assignedMeaning": string, "emotionalResponse": string, "activatedMode": string, "copingBehavior": string, "riskOutcome": string, "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "relapsePathways": [{ "destabilizer": string, "earlyWarnings": string[], "escalationPattern": string, "relapseEndpoint": string, "protectiveInterrupts": string[], "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "caregiverBurdenPathways": [{ "destabilizer": string, "earlyWarnings": string[], "escalationPattern": string, "burdenEndpoint": string, "protectiveInterrupts": string[], "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "functionOfAddiction": [{ "functionType": "numbing"|"control"|"escape"|"connection"|"identity"|"reward"|"regulation"|"other", "description": string, "underlyingNeed": string, "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "functionOfCaregivingPattern": [{ "functionType": "control"|"safety"|"identity"|"guilt_avoidance"|"love_proof"|"self_worth"|"other", "description": string, "underlyingNeed": string, "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "contraindications": [{ "avoidTopic": string, "reason": string, "appliesTo": string, "severity": "hard"|"soft", "sourceEvidence": string (max 150 chars), "confidence": 0-1 }],
  "safeFormulationHints": [{ "topic": string, "safeFraming": string, "avoidFraming": string, "sourceEvidence": string (max 150 chars), "confidence": 0-1 }]
}

TEXT TO ANALYZE:
`;

export async function analyzeSection(
  sectionId: string,
  sectionTitle: string,
  sectionContent: string,
  persona: 'elias' | 'kim',
): Promise<{ result: BackpackSectionAnalysisResult | null; status: SectionAnalysisStatus }> {
  const statusBase: SectionAnalysisStatus = {
    sectionId,
    status: 'analyzing',
    provider: 'none',
    storeFalse: true,
  };

  if (!sectionContent || sectionContent.trim().length < 10) {
    return {
      result: null,
      status: { ...statusBase, status: 'failed', error: 'section_content_too_short' },
    };
  }

  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const prompt = SECTION_ANALYSIS_PROMPT
      .replace('{{persona}}', persona)
      .replace('{{sectionId}}', sectionId)
      .replace('{{sectionTitle}}', sectionTitle);

    const url = `${apiBaseUrl}/api/minimal-gpt-proxy`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: sectionContent },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      return {
        result: null,
        status: { ...statusBase, status: 'failed', provider: 'openai', error: `http_${response.status}: ${errorText.substring(0, 100)}` },
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        result: null,
        status: { ...statusBase, status: 'failed', provider: 'openai', error: 'empty_response' },
      };
    }

    const parsed = JSON.parse(content);
    const validated = validateAndBuildResult(parsed, sectionId, sectionContent, persona);

    if (!validated) {
      return {
        result: null,
        status: { ...statusBase, status: 'failed', provider: 'openai', error: 'validation_failed' },
      };
    }

    return {
      result: validated,
      status: {
        ...statusBase,
        status: 'success',
        provider: 'openai',
        analyzedAt: validated.analyzedAt,
        anchorsExtracted: validated.personalAnchors.length,
        edgesExtracted: validated.relationGraph.length,
        schemasDetected: validated.schemas.length,
        modesDetected: validated.modes.length,
      },
    };
  } catch (error: any) {
    return {
      result: null,
      status: { ...statusBase, status: 'failed', provider: 'openai', error: error?.message || 'unknown_error' },
    };
  }
}

// ── Validation ───────────────────────────────────────────────────────

function validateAndBuildResult(
  raw: any,
  sectionId: string,
  sectionContent: string,
  persona: 'elias' | 'kim',
): BackpackSectionAnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const sectionHash = computeSectionHash(sectionContent);
  const now = new Date().toISOString();

  // Validate and filter anchors
  const personalAnchors: PersonAnchor[] = (raw.personalAnchors || [])
    .filter((a: any) => a?.name && a?.relationToUser && typeof a.confidence === 'number')
    .map((a: any) => ({
      name: String(a.name),
      relationToUser: String(a.relationToUser),
      currentRelevance: ['high', 'medium', 'low'].includes(a.currentRelevance) ? a.currentRelevance : 'medium',
      emotionallyImportant: Boolean(a.emotionallyImportant),
      explicitInSource: Boolean(a.explicitInSource),
      confidence: Math.max(0, Math.min(1, Number(a.confidence))),
      sourceSectionId: sectionId,
      sourceType: 'backpack_section' as const,
    }));

  // Validate relation graph
  const relationGraph: RelationEdge[] = (raw.relationGraph || [])
    .filter((e: any) => e?.subjectPerson && e?.relation && e?.objectPerson)
    .map((e: any) => ({
      subjectPerson: String(e.subjectPerson),
      relation: String(e.relation),
      objectPerson: String(e.objectPerson),
      explicitInSource: Boolean(e.explicitInSource),
      confidence: Math.max(0, Math.min(1, Number(e.confidence || 0.5))),
      sourceSectionId: sectionId,
    }));

  // Validate life status facts
  const lifeStatusFacts: LifeStatusFact[] = (raw.lifeStatusFacts || [])
    .filter((f: any) => f?.person && ['alive', 'deceased', 'unknown'].includes(f?.status))
    .map((f: any) => ({
      person: String(f.person),
      status: f.status as 'alive' | 'deceased' | 'unknown',
      explicitInSource: Boolean(f.explicitInSource),
      confidence: Math.max(0, Math.min(1, Number(f.confidence || 0.5))),
      sourceSectionId: sectionId,
    }));

  // Validate schemas (discard unsupported)
  const validSchemas = [
    'abandonment', 'mistrust_abuse', 'emotional_deprivation', 'defectiveness_shame',
    'dependence_incompetence', 'vulnerability', 'enmeshment', 'subjugation',
    'self_sacrifice', 'unrelenting_standards', 'entitlement', 'insufficient_self_control',
    'approval_seeking', 'negativity_pessimism', 'emotional_inhibition', 'punitiveness',
  ];
  const schemas: SchemaSignal[] = (raw.schemas || [])
    .filter((s: any) => validSchemas.includes(s?.schema))
    .map((s: any) => ({
      schema: s.schema,
      evidenceType: s.evidenceType === 'explicit' ? 'explicit' : 'inferred',
      confidence: Math.max(0, Math.min(1, Number(s.confidence || 0.5))),
      sourceSectionId: sectionId,
      doNotDiagnose: true as const,
    }));

  // Validate modes (discard unsupported)
  const validModes = [
    'vulnerable_child', 'angry_child', 'impulsive_child', 'compliant_surrender',
    'detached_protector', 'overcontroller', 'punitive_parent', 'demanding_parent', 'healthy_adult',
  ];
  const modes: ModeSignal[] = (raw.modes || [])
    .filter((m: any) => validModes.includes(m?.mode))
    .map((m: any) => ({
      mode: m.mode,
      evidenceType: m.evidenceType === 'explicit' ? 'explicit' : 'inferred',
      confidence: Math.max(0, Math.min(1, Number(m.confidence || 0.5))),
      sourceSectionId: sectionId,
      doNotDiagnose: true as const,
    }));

  // Count unsupported facts discarded
  const unsupportedFactsDiscarded =
    ((raw.schemas || []).length - schemas.length) +
    ((raw.modes || []).length - modes.length);

  return {
    persona,
    sectionId,
    sectionHash,
    analyzedAt: now,
    personalAnchors,
    relationGraph,
    lifeEvents: (raw.lifeEvents || []).filter((e: any) => e?.description).map((e: any) => ({
      description: String(e.description),
      type: ['loss', 'trauma', 'achievement', 'transition', 'relapse', 'recovery', 'conflict', 'other'].includes(e.type) ? e.type : 'other',
      timePeriod: e.timePeriod || null,
      peopleInvolved: Array.isArray(e.peopleInvolved) ? e.peopleInvolved.map(String) : [],
      emotionalImpact: ['positive', 'negative', 'mixed', 'neutral'].includes(e.emotionalImpact) ? e.emotionalImpact : 'neutral',
      isTriggerSource: Boolean(e.isTriggerSource),
      sourceSectionId: sectionId,
    })),
    lifeStatusFacts,
    schemas,
    modes,
    triggers: (raw.triggers || []).filter((t: any) => t?.trigger).map((t: any) => ({
      trigger: String(t.trigger),
      context: String(t.context || ''),
      severity: ['high', 'medium', 'low'].includes(t.severity) ? t.severity : 'medium',
      confidence: Math.max(0, Math.min(1, Number(t.confidence || 0.5))),
      sourceSectionId: sectionId,
    })),
    protectiveFactors: (raw.protectiveFactors || []).filter((p: any) => p?.factor).map((p: any) => ({
      factor: String(p.factor),
      domain: ['social', 'personal', 'spiritual', 'professional', 'physical'].includes(p.domain) ? p.domain : 'personal',
      strength: ['strong', 'moderate', 'fragile'].includes(p.strength) ? p.strength : 'moderate',
      confidence: Math.max(0, Math.min(1, Number(p.confidence || 0.5))),
      sourceSectionId: sectionId,
    })),
    values: (raw.values || []).filter((v: any) => v?.value).map((v: any) => ({
      value: String(v.value),
      importance: ['core', 'important', 'emerging'].includes(v.importance) ? v.importance : 'important',
      confidence: Math.max(0, Math.min(1, Number(v.confidence || 0.5))),
      sourceSectionId: sectionId,
    })),
    goals: (raw.goals || []).filter((g: any) => g?.goal).map((g: any) => ({
      goal: String(g.goal),
      timeframe: ['short_term', 'medium_term', 'long_term', 'undefined'].includes(g.timeframe) ? g.timeframe : 'undefined',
      confidence: Math.max(0, Math.min(1, Number(g.confidence || 0.5))),
      sourceSectionId: sectionId,
    })),
    risks: (raw.risks || []).filter((r: any) => r?.risk).map((r: any) => ({
      risk: String(r.risk),
      severity: ['high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium',
      isActive: Boolean(r.isActive),
      confidence: Math.max(0, Math.min(1, Number(r.confidence || 0.5))),
      sourceSectionId: sectionId,
    })),
    recoveryPatterns: persona === 'elias' ? (raw.recoveryPatterns || []).filter((p: any) => p?.type && p?.description).map((p: any) => ({
      type: String(p.type),
      description: String(p.description),
      confidence: Math.max(0, Math.min(1, Number(p.confidence || 0.5))),
      sourceSectionId: sectionId,
    })) : [],
    caregiverPatterns: persona === 'kim' ? (raw.caregiverPatterns || []).filter((p: any) => p?.type && p?.description).map((p: any) => ({
      type: String(p.type),
      description: String(p.description),
      confidence: Math.max(0, Math.min(1, Number(p.confidence || 0.5))),
      sourceSectionId: sectionId,
    })) : [],
    confidenceSummary: {
      overallConfidence: personalAnchors.length > 0
        ? personalAnchors.reduce((sum, a) => sum + a.confidence, 0) / personalAnchors.length
        : 0,
      explicitFactCount: personalAnchors.filter(a => a.explicitInSource).length + relationGraph.filter(e => e.explicitInSource).length,
      inferredFactCount: personalAnchors.filter(a => !a.explicitInSource).length + relationGraph.filter(e => !e.explicitInSource).length,
      unsupportedFactsDiscarded,
    },
    warnings: [],
  };
}

// ── Merge to user.dat ────────────────────────────────────────────────

export async function mergeAnalysisToUserDat(
  analysisResult: BackpackSectionAnalysisResult,
): Promise<void> {
  const USERDAT_KEY = '@recofree_userdat';
  try {
    const raw = await AsyncStorage.getItem(USERDAT_KEY);
    const userDat = raw ? JSON.parse(raw) : {};

    // Ensure extractedEntities exists
    if (!userDat.extractedEntities) {
      userDat.extractedEntities = { persons: [], events: [], patterns: [], contexts: [] };
    }

    // Merge personalAnchors → extractedEntities.persons
    const existingPersons: any[] = userDat.extractedEntities.persons || [];
    for (const anchor of analysisResult.personalAnchors) {
      const existingIdx = existingPersons.findIndex(
        (p: any) => p.name?.toLowerCase() === anchor.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        const existing = existingPersons[existingIdx];
        // Rule 1: Explicit beats inferred
        // Rule 2: Higher confidence wins
        // Rule 3: null never overwrites known
        if (anchor.explicitInSource || anchor.confidence > (existing.confidence || 0)) {
          existingPersons[existingIdx] = {
            ...existing,
            name: anchor.name,
            relationship: anchor.relationToUser,
            relationshipNL: anchor.relationToUser,
            emotionalValence: anchor.emotionallyImportant ? 'positive' : 'neutral',
            confidence: anchor.confidence,
            sourceSection: `[${analysisResult.sectionId}]`,
            explicitInSource: anchor.explicitInSource,
          };
        }
      } else {
        existingPersons.push({
          name: anchor.name,
          relationship: anchor.relationToUser,
          relationshipNL: anchor.relationToUser,
          emotionalValence: anchor.emotionallyImportant ? 'positive' : 'neutral',
          confidence: anchor.confidence,
          sourceSection: `[${analysisResult.sectionId}]`,
          explicitInSource: anchor.explicitInSource,
        });
      }
    }
    userDat.extractedEntities.persons = existingPersons;

    // Store relation graph
    if (!userDat.relationGraph) userDat.relationGraph = [];
    for (const edge of analysisResult.relationGraph) {
      const exists = userDat.relationGraph.some(
        (e: any) => e.subjectPerson === edge.subjectPerson && e.objectPerson === edge.objectPerson && e.relation === edge.relation
      );
      if (!exists) {
        userDat.relationGraph.push(edge);
      } else {
        // Rule 5: vague never removes edge — only update if higher confidence
        const idx = userDat.relationGraph.findIndex(
          (e: any) => e.subjectPerson === edge.subjectPerson && e.objectPerson === edge.objectPerson
        );
        if (idx >= 0 && edge.confidence > (userDat.relationGraph[idx].confidence || 0)) {
          userDat.relationGraph[idx] = edge;
        }
      }
    }

    // Store life status facts
    if (!userDat.lifeStatusFacts) userDat.lifeStatusFacts = [];
    for (const fact of analysisResult.lifeStatusFacts) {
      const existingIdx = userDat.lifeStatusFacts.findIndex(
        (f: any) => f.person?.toLowerCase() === fact.person.toLowerCase()
      );
      if (existingIdx >= 0) {
        const existing = userDat.lifeStatusFacts[existingIdx];
        // Rule 4: unknown never overwrites deceased/alive
        if (fact.status === 'unknown' && existing.status !== 'unknown') continue;
        if (fact.confidence > (existing.confidence || 0) || fact.explicitInSource) {
          userDat.lifeStatusFacts[existingIdx] = fact;
        }
      } else {
        userDat.lifeStatusFacts.push(fact);
      }
    }

    // Store schemas (persona-separated)
    if (!userDat.schemas) userDat.schemas = [];
    for (const schema of analysisResult.schemas) {
      const exists = userDat.schemas.some((s: any) => s.schema === schema.schema);
      if (!exists) {
        userDat.schemas.push(schema);
      } else {
        const idx = userDat.schemas.findIndex((s: any) => s.schema === schema.schema);
        if (idx >= 0 && schema.confidence > (userDat.schemas[idx].confidence || 0)) {
          userDat.schemas[idx] = schema;
        }
      }
    }

    // Store modes
    if (!userDat.modes) userDat.modes = [];
    for (const mode of analysisResult.modes) {
      const exists = userDat.modes.some((m: any) => m.mode === mode.mode);
      if (!exists) {
        userDat.modes.push(mode);
      } else {
        const idx = userDat.modes.findIndex((m: any) => m.mode === mode.mode);
        if (idx >= 0 && mode.confidence > (userDat.modes[idx].confidence || 0)) {
          userDat.modes[idx] = mode;
        }
      }
    }

    // Store triggers, protectiveFactors, values, goals, risks
    if (!userDat.triggers) userDat.triggers = [];
    for (const t of analysisResult.triggers) {
      if (!userDat.triggers.some((x: any) => x.trigger === t.trigger)) {
        userDat.triggers.push(t);
      }
    }

    if (!userDat.protectiveFactors) userDat.protectiveFactors = [];
    for (const p of analysisResult.protectiveFactors) {
      if (!userDat.protectiveFactors.some((x: any) => x.factor === p.factor)) {
        userDat.protectiveFactors.push(p);
      }
    }

    if (!userDat.values) userDat.values = [];
    for (const v of analysisResult.values) {
      if (!userDat.values.some((x: any) => x.value === v.value)) {
        userDat.values.push(v);
      }
    }

    if (!userDat.goals) userDat.goals = [];
    for (const g of analysisResult.goals) {
      if (!userDat.goals.some((x: any) => x.goal === g.goal)) {
        userDat.goals.push(g);
      }
    }

    if (!userDat.risks) userDat.risks = [];
    for (const r of analysisResult.risks) {
      if (!userDat.risks.some((x: any) => x.risk === r.risk)) {
        userDat.risks.push(r);
      }
    }

    // Store persona-specific patterns
    if (analysisResult.persona === 'elias') {
      if (!userDat.recoveryPatterns) userDat.recoveryPatterns = [];
      for (const p of analysisResult.recoveryPatterns) {
        if (!userDat.recoveryPatterns.some((x: any) => x.type === p.type && x.description === p.description)) {
          userDat.recoveryPatterns.push(p);
        }
      }
    } else {
      if (!userDat.caregiverPatterns) userDat.caregiverPatterns = [];
      for (const p of analysisResult.caregiverPatterns) {
        if (!userDat.caregiverPatterns.some((x: any) => x.type === p.type && x.description === p.description)) {
          userDat.caregiverPatterns.push(p);
        }
      }
    }

    // Store last analysis timestamp
    userDat.lastSectionAnalysis = analysisResult.analyzedAt;
    userDat.sectionAnalysisPersona = analysisResult.persona;

    // ── FASE 6: Merge 8 new clinical formulation fields ──────────────

    // Helper: deduplicate by primary key, higher confidence wins for exact duplicates
    function mergeHypothesisArray(
      existing: any[],
      incoming: any[],
      primaryKey: string,
      secondaryKey?: string,
    ): any[] {
      const result = [...existing];
      for (const item of incoming) {
        if (!item || !item[primaryKey]) continue;
        const matchIdx = result.findIndex((e: any) => {
          if (secondaryKey) {
            return e[primaryKey] === item[primaryKey] && e[secondaryKey] === item[secondaryKey];
          }
          return e[primaryKey] === item[primaryKey];
        });
        if (matchIdx >= 0) {
          // Exact duplicate: higher confidence wins, sourceEvidence preserved
          if (item.confidence > (result[matchIdx].confidence || 0)) {
            result[matchIdx] = item;
          }
          // Otherwise: keep existing (richer info not overwritten by poorer)
        } else {
          // Different claim: keep both (conflicting hypotheses coexist)
          result.push(item);
        }
      }
      return result;
    }

    // developmentalFormulation (shared, deduplicate by originContext)
    if (Array.isArray(analysisResult.developmentalFormulation) && analysisResult.developmentalFormulation.length > 0) {
      if (!userDat.developmentalFormulation) userDat.developmentalFormulation = [];
      userDat.developmentalFormulation = mergeHypothesisArray(
        userDat.developmentalFormulation, analysisResult.developmentalFormulation, 'originContext'
      );
    }

    // triggerChains (shared, deduplicate by triggerEvent + copingBehavior)
    if (Array.isArray(analysisResult.triggerChains) && analysisResult.triggerChains.length > 0) {
      if (!userDat.triggerChains) userDat.triggerChains = [];
      userDat.triggerChains = mergeHypothesisArray(
        userDat.triggerChains, analysisResult.triggerChains, 'triggerEvent', 'copingBehavior'
      );
    }

    // relapsePathways (Elias only, deduplicate by destabilizer)
    if (analysisResult.persona === 'elias' && Array.isArray(analysisResult.relapsePathways) && analysisResult.relapsePathways.length > 0) {
      if (!userDat.relapsePathways) userDat.relapsePathways = [];
      userDat.relapsePathways = mergeHypothesisArray(
        userDat.relapsePathways, analysisResult.relapsePathways, 'destabilizer'
      );
    }

    // caregiverBurdenPathways (Kim only, deduplicate by destabilizer)
    if (analysisResult.persona === 'kim' && Array.isArray(analysisResult.caregiverBurdenPathways) && analysisResult.caregiverBurdenPathways.length > 0) {
      if (!userDat.caregiverBurdenPathways) userDat.caregiverBurdenPathways = [];
      userDat.caregiverBurdenPathways = mergeHypothesisArray(
        userDat.caregiverBurdenPathways, analysisResult.caregiverBurdenPathways, 'destabilizer'
      );
    }

    // functionOfAddiction (Elias only, deduplicate by functionType)
    if (analysisResult.persona === 'elias' && Array.isArray(analysisResult.functionOfAddiction) && analysisResult.functionOfAddiction.length > 0) {
      if (!userDat.functionOfAddiction) userDat.functionOfAddiction = [];
      userDat.functionOfAddiction = mergeHypothesisArray(
        userDat.functionOfAddiction, analysisResult.functionOfAddiction, 'functionType'
      );
    }

    // functionOfCaregivingPattern (Kim only, deduplicate by functionType)
    if (analysisResult.persona === 'kim' && Array.isArray(analysisResult.functionOfCaregivingPattern) && analysisResult.functionOfCaregivingPattern.length > 0) {
      if (!userDat.functionOfCaregivingPattern) userDat.functionOfCaregivingPattern = [];
      userDat.functionOfCaregivingPattern = mergeHypothesisArray(
        userDat.functionOfCaregivingPattern, analysisResult.functionOfCaregivingPattern, 'functionType'
      );
    }

    // contraindications (shared, deduplicate by avoidTopic + appliesTo)
    if (Array.isArray(analysisResult.contraindications) && analysisResult.contraindications.length > 0) {
      if (!userDat.contraindications) userDat.contraindications = [];
      userDat.contraindications = mergeHypothesisArray(
        userDat.contraindications, analysisResult.contraindications, 'avoidTopic', 'appliesTo'
      );
    }

    // safeFormulationHints (shared, deduplicate by topic)
    if (Array.isArray(analysisResult.safeFormulationHints) && analysisResult.safeFormulationHints.length > 0) {
      if (!userDat.safeFormulationHints) userDat.safeFormulationHints = [];
      userDat.safeFormulationHints = mergeHypothesisArray(
        userDat.safeFormulationHints, analysisResult.safeFormulationHints, 'topic'
      );
    }

    // ── CHECKPOINT 1: Deep analysis field counts BEFORE write ──
    const cp1 = {
      schemas: Array.isArray(userDat.schemas) ? userDat.schemas.length : 0,
      modes: Array.isArray(userDat.modes) ? userDat.modes.length : 0,
      triggers: Array.isArray(userDat.triggers) ? userDat.triggers.length : 0,
      protectiveFactors: Array.isArray(userDat.protectiveFactors) ? userDat.protectiveFactors.length : 0,
      values: Array.isArray(userDat.values) ? userDat.values.length : 0,
      goals: Array.isArray(userDat.goals) ? userDat.goals.length : 0,
      risks: Array.isArray(userDat.risks) ? userDat.risks.length : 0,
      recoveryPatterns: Array.isArray(userDat.recoveryPatterns) ? userDat.recoveryPatterns.length : 0,
      developmentalFormulation: Array.isArray(userDat.developmentalFormulation) ? userDat.developmentalFormulation.length : 0,
      triggerChains: Array.isArray(userDat.triggerChains) ? userDat.triggerChains.length : 0,
      contraindications: Array.isArray(userDat.contraindications) ? userDat.contraindications.length : 0,
      safeFormulationHints: Array.isArray(userDat.safeFormulationHints) ? userDat.safeFormulationHints.length : 0,
      totalKeys: Object.keys(userDat).length,
    };
    console.log('[CHECKPOINT-1] mergeAnalysisToUserDat BEFORE write:', JSON.stringify(cp1));

    await AsyncStorage.setItem(USERDAT_KEY, JSON.stringify(userDat));
    // CRITICAL: Also update SessionMemoryCache so the chat pipeline reads fresh data.
    // Without this, handleSend() reads stale userDat from SessionMemoryCache
    // and buildPersonalClinicalContext() returns undefined (ClinicalCtx=false).
    try {
      await SessionMemoryCache.set(USERDAT_KEY, JSON.stringify(userDat));
    } catch (cacheErr) {
      console.warn('[SectionAnalysis] SessionMemoryCache sync failed (non-blocking):', cacheErr);
    }

    // ── CHECKPOINT 2: Read back from BOTH stores to verify write ──
    try {
      const asyncRaw = await AsyncStorage.getItem(USERDAT_KEY);
      const cacheRaw = await SessionMemoryCache.get(USERDAT_KEY);
      const asyncUd = asyncRaw ? JSON.parse(asyncRaw) : {};
      const cacheUd = cacheRaw ? JSON.parse(cacheRaw) : {};
      const cp2async = {
        schemas: Array.isArray(asyncUd.schemas) ? asyncUd.schemas.length : 0,
        modes: Array.isArray(asyncUd.modes) ? asyncUd.modes.length : 0,
        triggers: Array.isArray(asyncUd.triggers) ? asyncUd.triggers.length : 0,
        totalKeys: Object.keys(asyncUd).length,
      };
      const cp2cache = {
        schemas: Array.isArray(cacheUd.schemas) ? cacheUd.schemas.length : 0,
        modes: Array.isArray(cacheUd.modes) ? cacheUd.modes.length : 0,
        triggers: Array.isArray(cacheUd.triggers) ? cacheUd.triggers.length : 0,
        totalKeys: Object.keys(cacheUd).length,
      };
      console.log('[CHECKPOINT-2] AsyncStorage readback:', JSON.stringify(cp2async));
      console.log('[CHECKPOINT-2] SessionMemoryCache readback:', JSON.stringify(cp2cache));
    } catch (cp2Err) {
      console.warn('[CHECKPOINT-2] Readback failed:', cp2Err);
    }
  } catch (error) {
    console.error('[SectionAnalysis] Merge to user.dat failed:', error);
  }
}

// ── Full Backpack Analysis (Manual Refresh) ──────────────────────────

export async function analyzeAllSections(
  sections: Array<{ id: string; label: string; content: string }>,
  persona: 'elias' | 'kim',
): Promise<ManualRefreshReport> {
  const startTime = Date.now();
  const hashes = await getSectionHashes();
  const report: ManualRefreshReport = {
    sectionsAnalyzed: 0,
    sectionsSkipped: 0,
    anchorsBuilt: 0,
    relationEdgesBuilt: 0,
    schemasDetected: 0,
    modesDetected: 0,
    failures: 0,
    provider: 'openai',
    storeFalse: true,
    totalDurationMs: 0,
  };

  for (const section of sections) {
    if (!section.content || section.content.trim().length < 10) {
      report.sectionsSkipped++;
      continue;
    }

    const currentHash = computeSectionHash(section.content);
    if (hashes[section.id] === currentHash) {
      report.sectionsSkipped++;
      continue;
    }

    const { result, status } = await analyzeSection(section.id, section.label, section.content, persona);

    if (result && status.status === 'success') {
      await mergeAnalysisToUserDat(result);
      hashes[section.id] = currentHash;
      report.sectionsAnalyzed++;
      report.anchorsBuilt += result.personalAnchors.length;
      report.relationEdgesBuilt += result.relationGraph.length;
      report.schemasDetected += result.schemas.length;
      report.modesDetected += result.modes.length;
    } else {
      report.failures++;
    }
  }

  await saveSectionHashes(hashes);
  report.totalDurationMs = Date.now() - startTime;
  return report;
}

// ── Analyze Single Changed Section ───────────────────────────────────

export async function analyzeSectionIfChanged(
  sectionId: string,
  sectionTitle: string,
  sectionContent: string,
  persona: 'elias' | 'kim',
): Promise<SectionAnalysisStatus> {
  const hashes = await getSectionHashes();
  const currentHash = computeSectionHash(sectionContent);

  if (hashes[sectionId] === currentHash) {
    return { sectionId, status: 'success', provider: 'none', storeFalse: true };
  }

  const { result, status } = await analyzeSection(sectionId, sectionTitle, sectionContent, persona);

  if (result && status.status === 'success') {
    await mergeAnalysisToUserDat(result);
    hashes[sectionId] = currentHash;
    await saveSectionHashes(hashes);
  }

  return status;
}
