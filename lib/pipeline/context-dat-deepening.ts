/**
 * context.dat Deepening Layer — LOCAL MODULE
 *
 * Purpose: When nano-interpret detects a person/theme/schema not covered by
 * context.dat, this layer retrieves a BOUNDED fragment from the raw layers.
 * Never retrieves a full layer — always a targeted slice.
 *
 * Triggers (deterministic, no GPT):
 * 1. Nano detects a person not in context.dat keyFigures → fetch that person's
 *    mentions from backpack/logs (max 200 words).
 * 2. Reference to something older than last 3 sessions → fetch that one older
 *    logs.dat session summary.
 * 3. Strongly active schema that needs deepening → fetch that schema's evidence
 *    trail (max 150 words).
 *
 * Each fragment is small; deepening may NOT bring the payload back to ~16k.
 * Hard cap: total deepening additions ≤ 500 tokens.
 */

import type { ContextDat } from './context-dat-distiller';
import type { Backpack, UserDat } from '../ai/types';
import type { LogsDatPlaintext } from '../types/memory/logsDat.types';
import type { ClientNanoInterpretResult as NanoInterpretResult } from './nano-interpret-client';

// ─── Types ────────────────────────────────────────────────────

export interface DeepeningFragment {
  type: 'person' | 'session' | 'schema';
  label: string;
  content: string;
  tokenEstimate: number;
}

export interface DeepeningResult {
  fragments: DeepeningFragment[];
  totalTokens: number;
  triggered: boolean;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_DEEPENING_TOKENS = 500;
const MAX_PERSON_WORDS = 200;
const MAX_SCHEMA_WORDS = 150;

// ─── Main Function ────────────────────────────────────────────

export interface DeepeningInput {
  contextDat: ContextDat;
  nanoResult: NanoInterpretResult | null;
  backpack: Backpack;
  userDat: UserDat;
  logsDat: LogsDatPlaintext | null;
  currentMessage: string;
}

/**
 * Determine if deepening is needed and retrieve bounded fragments.
 * Fully deterministic — no GPT calls.
 *
 * Priority ranking (highest first):
 *   1. Crisis/safety-related schemas (verlating, wantrouwen with crisis context)
 *   2. Person references (relational context is therapeutically critical)
 *   3. Schema deepening (active schema not covered by context.dat)
 *   4. Older session references (lowest priority, only if budget remains)
 *
 * Hard cap: total deepening ≤ 500 tokens. Fragments are added in priority
 * order until the cap is reached; remaining candidates are discarded.
 */
export function resolveDeepening(input: DeepeningInput): DeepeningResult {
  const { contextDat, nanoResult, backpack, userDat, logsDat, currentMessage } = input;

  if (!nanoResult) {
    return { fragments: [], totalTokens: 0, triggered: false };
  }

  // ── Collect ALL candidate fragments with priority scores ──
  const candidates: Array<DeepeningFragment & { priority: number }> = [];

  // Priority 1+2: Person references (crisis-related persons get priority 1, others priority 2)
  const mentionedPersons = detectPersonReferences(currentMessage, nanoResult);
  const knownNames = new Set(contextDat.keyFigures.map(kf => kf.name.toLowerCase()));
  const isCrisisContext = detectCrisisContext(currentMessage, nanoResult);

  for (const person of mentionedPersons) {
    if (knownNames.has(person.toLowerCase())) continue;
    const fragment = retrievePersonFragment(person, backpack, logsDat);
    if (fragment) {
      // Crisis-context person references get highest priority
      const priority = isCrisisContext ? 1 : 2;
      candidates.push({ ...fragment, priority });
    }
  }

  // Priority 1 or 3: Schema deepening (crisis-related schemas get priority 1)
  const schemaDeepening = detectSchemaDeepening(nanoResult, contextDat, userDat);
  if (schemaDeepening) {
    const fragment = retrieveSchemaFragment(schemaDeepening, userDat, logsDat);
    if (fragment) {
      const isCrisisSchema = CRISIS_SCHEMAS.has(schemaDeepening);
      const priority = (isCrisisSchema && isCrisisContext) ? 1 : 3;
      candidates.push({ ...fragment, priority });
    }
  }

  // Priority 4: Older session reference (lowest priority)
  const olderSessionRef = detectOlderSessionReference(currentMessage, nanoResult, contextDat);
  if (olderSessionRef) {
    const fragment = retrieveOlderSessionFragment(olderSessionRef, logsDat);
    if (fragment) {
      candidates.push({ ...fragment, priority: 4 });
    }
  }

  // ── Sort by priority (lowest number = highest priority) ──
  candidates.sort((a, b) => a.priority - b.priority);

  // ── Fill up to MAX_DEEPENING_TOKENS ──
  const fragments: DeepeningFragment[] = [];
  let totalTokens = 0;

  for (const candidate of candidates) {
    if (totalTokens + candidate.tokenEstimate > MAX_DEEPENING_TOKENS) {
      continue; // Skip this one, try smaller ones
    }
    const { priority: _p, ...fragment } = candidate;
    fragments.push(fragment);
    totalTokens += fragment.tokenEstimate;
    if (totalTokens >= MAX_DEEPENING_TOKENS) break;
  }

  return {
    fragments,
    totalTokens,
    triggered: fragments.length > 0,
  };
}

// ─── Crisis Context Detection ────────────────────────────────

/** Schemas that are safety-critical and get priority boost in crisis context */
const CRISIS_SCHEMAS = new Set([
  'verlating', 'wantrouwen', 'emotionele_verwaarlozing', 'tekortschieten',
]);

/** Detect if the current message/nano context suggests crisis or safety concern */
function detectCrisisContext(message: string, nanoResult: NanoInterpretResult): boolean {
  const lower = message.toLowerCase();
  const crisisMarkers = [
    'niet meer', 'wil dood', 'geen zin', 'opgeven', 'einde',
    'zelfmoord', 'suïcide', 'pijn', 'wanhoop', 'hopeloos',
    'can\'t go on', 'give up', 'end it', 'hopeless', 'suicide',
  ];
  if (crisisMarkers.some(m => lower.includes(m))) return true;

  // Check nano themes for crisis indicators
  if (nanoResult.themes) {
    const themeText = nanoResult.themes.join(' ').toLowerCase();
    if (crisisMarkers.some(m => themeText.includes(m))) return true;
  }

  return false;
}

// ─── Person Detection & Retrieval ─────────────────────────────

function detectPersonReferences(message: string, nanoResult: NanoInterpretResult): string[] {
  const persons: string[] = [];

  // From nano themes — look for person-like references
  if (nanoResult.themes) {
    for (const theme of nanoResult.themes) {
      // Check if theme contains a capitalized name-like word
      const nameMatch = theme.match(/\b[A-Z][a-zà-ÿ]{1,20}\b/);
      if (nameMatch && !isCommonWord(nameMatch[0])) {
        persons.push(nameMatch[0]);
      }
    }
  }

  // From message itself — capitalized words that look like names
  const messageNames = message.match(/\b[A-Z][a-zà-ÿ]{2,20}\b/g) || [];
  for (const name of messageNames) {
    if (!isCommonWord(name) && !persons.includes(name)) {
      persons.push(name);
    }
  }

  return persons.slice(0, 3); // max 3 person lookups
}

function isCommonWord(word: string): boolean {
  const common = new Set([
    'Het', 'De', 'Een', 'Dit', 'Dat', 'Die', 'Deze', 'Mijn', 'Zijn', 'Haar',
    'The', 'This', 'That', 'When', 'Then', 'But', 'And', 'For', 'With',
    'Ik', 'Hij', 'Zij', 'Wij', 'Als', 'Maar', 'Want', 'Dus', 'Nog',
    'RecoFree', 'Elias', 'Kim', 'Nederland', 'België', 'Vandaag', 'Gisteren',
    'Morgen', 'Misschien', 'Eigenlijk', 'Volgens', 'Daarom', 'Hierdoor',
  ]);
  return common.has(word);
}

function retrievePersonFragment(
  personName: string,
  backpack: Backpack,
  logsDat: LogsDatPlaintext | null,
): DeepeningFragment | null {
  const mentions: string[] = [];
  const lowerName = personName.toLowerCase();

  // Search backpack sections
  if (backpack.sections) {
    for (const section of backpack.sections) {
      if (section.content.toLowerCase().includes(lowerName)) {
        // Extract the sentence(s) containing the name
        const sentences = section.content.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(lowerName)) {
            mentions.push(sentence.trim());
          }
        }
      }
    }
  }

  // Search Kim backpack
  if (backpack.kimBackpack) {
    const kimTexts = Object.values(backpack.kimBackpack).filter(v => typeof v === 'string') as string[];
    for (const text of kimTexts) {
      if (text.toLowerCase().includes(lowerName)) {
        const sentences = text.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(lowerName)) {
            mentions.push(sentence.trim());
          }
        }
      }
    }
  }

  // Search logs.dat narratives
  if (logsDat?.sessions) {
    for (const session of logsDat.sessions.slice(-10)) {
      if (session.compressedNarrative?.toLowerCase().includes(lowerName)) {
        const sentences = session.compressedNarrative.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(lowerName)) {
            mentions.push(sentence.trim());
          }
        }
      }
    }
  }

  if (mentions.length === 0) return null;

  // Truncate to MAX_PERSON_WORDS
  const combined = mentions.join('. ');
  const words = combined.split(/\s+/);
  const truncated = words.length > MAX_PERSON_WORDS
    ? words.slice(0, MAX_PERSON_WORDS).join(' ') + '…'
    : combined;

  return {
    type: 'person',
    label: personName,
    content: truncated,
    tokenEstimate: Math.ceil(truncated.length / 4),
  };
}

// ─── Older Session Detection & Retrieval ──────────────────────

function detectOlderSessionReference(
  message: string,
  nanoResult: NanoInterpretResult,
  contextDat: ContextDat,
): number | null {
  // Check if message references something temporal (weeks ago, earlier, etc.)
  const temporalPatterns = /\b(weken?\s*geleden|maand\s*geleden|eerder|vorige\s*maand|lang\s*geleden|weeks?\s*ago|month\s*ago|earlier|previously)\b/i;
  if (!temporalPatterns.test(message)) return null;

  // If we have more than 3 sessions in logs, there's older content to retrieve
  // Return the index of the 4th-from-last session (first one not in context.dat)
  const coveredDates = new Set(contextDat.sessionSummaries.map(s => s.date.split('T')[0]));

  // We need to know total sessions — but we don't have logsDat here
  // Return a signal that older content should be fetched
  return -1; // signal: fetch oldest available not in context
}

function retrieveOlderSessionFragment(
  _sessionIndex: number,
  logsDat: LogsDatPlaintext | null,
): DeepeningFragment | null {
  if (!logsDat?.sessions || logsDat.sessions.length <= 3) return null;

  // Get the 4th-from-last (first one not already in context.dat)
  const olderSessions = logsDat.sessions.slice(0, -3);
  if (olderSessions.length === 0) return null;

  // Take the most recent of the older ones
  const target = olderSessions[olderSessions.length - 1];
  const content = [
    `Sessie ${target.startedAt?.split('T')[0] || 'onbekend'}:`,
    target.compressedNarrative || '',
    target.discussedTopics?.length ? `Topics: ${target.discussedTopics.join(', ')}` : '',
    target.openEndpoints?.length ? `Open: ${target.openEndpoints.map(e => e.label).join(', ')}` : '',
  ].filter(Boolean).join(' ');

  // Truncate to ~100 words
  const words = content.split(/\s+/);
  const truncated = words.length > 100 ? words.slice(0, 100).join(' ') + '…' : content;

  return {
    type: 'session',
    label: `older-session-${target.startedAt?.split('T')[0] || 'unknown'}`,
    content: truncated,
    tokenEstimate: Math.ceil(truncated.length / 4),
  };
}

// ─── Schema Deepening ─────────────────────────────────────────

function detectSchemaDeepening(
  nanoResult: NanoInterpretResult,
  contextDat: ContextDat,
  _userDat: UserDat,
): string | null {
  // Check if nano themes mention a schema-related concept not well-covered in context
  if (!nanoResult.themes) return null;

  const schemaKeywords: Record<string, string[]> = {
    'verlating': ['verlaten', 'alleen', 'achterlaten', 'in de steek', 'abandonment'],
    'wantrouwen': ['vertrouwen', 'misbruik', 'bedrog', 'mistrust'],
    'emotionele_verwaarlozing': ['verwaarlozing', 'onzichtbaar', 'niet gezien', 'neglect'],
    'tekortschieten': ['falen', 'niet goed genoeg', 'incompetent', 'defectiveness'],
    'afhankelijkheid': ['afhankelijk', 'niet alleen kunnen', 'dependence'],
    'onderwerping': ['onderwerpen', 'opofferen', 'subjugation'],
    'zelfopoffering': ['opofferen', 'voor anderen', 'self-sacrifice'],
    'strenge_normen': ['perfect', 'moeten', 'normen', 'unrelenting standards'],
  };

  const contextSchemaIds = new Set(contextDat.schemas.map(s => s.schemaId));

  for (const theme of nanoResult.themes) {
    const lower = theme.toLowerCase();
    for (const [schemaId, keywords] of Object.entries(schemaKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        // If this schema is NOT in context.dat top 5, it needs deepening
        if (!contextSchemaIds.has(schemaId)) {
          return schemaId;
        }
      }
    }
  }

  return null;
}

function retrieveSchemaFragment(
  schemaId: string,
  userDat: UserDat,
  logsDat: LogsDatPlaintext | null,
): DeepeningFragment | null {
  const evidence: string[] = [];

  // From userDat schemaTendencies
  const schema = (userDat.schemaTendencies || []).find(
    (s: any) => s.schemaId === schemaId
  );
  if (schema) {
    evidence.push(`Schema "${(schema as any).schemaName || schemaId}" — frequentie: ${(schema as any).frequency || 0}, confidence: ${((schema as any).confidence || 0).toFixed(2)}`);
    if ((schema as any).copingStyle) {
      evidence.push(`Copingstijl: ${(schema as any).copingStyle}`);
    }
  }

  // From logs.dat — find sessions where this schema was discussed
  if (logsDat?.sessions) {
    for (const session of logsDat.sessions.slice(-10)) {
      const narrative = session.compressedNarrative?.toLowerCase() || '';
      const topics = (session.discussedTopics || []).join(' ').toLowerCase();
      if (narrative.includes(schemaId) || topics.includes(schemaId)) {
        evidence.push(`Sessie ${session.startedAt?.split('T')[0]}: ${session.compressedNarrative?.split('.')[0] || ''}`);
      }
    }
  }

  if (evidence.length === 0) return null;

  const combined = evidence.join('. ');
  const words = combined.split(/\s+/);
  const truncated = words.length > MAX_SCHEMA_WORDS
    ? words.slice(0, MAX_SCHEMA_WORDS).join(' ') + '…'
    : combined;

  return {
    type: 'schema',
    label: schemaId,
    content: truncated,
    tokenEstimate: Math.ceil(truncated.length / 4),
  };
}

// ─── Serializer ───────────────────────────────────────────────

/**
 * Serialize deepening fragments into a compact text block for GPT injection.
 */
export function serializeDeepeningForGPT(result: DeepeningResult): string {
  if (!result.triggered || result.fragments.length === 0) return '';

  const lines: string[] = ['[DEEPENING — targeted context]'];
  for (const fragment of result.fragments) {
    const typeLabel = fragment.type === 'person' ? 'PERSOON' : fragment.type === 'session' ? 'SESSIE' : 'SCHEMA';
    lines.push(`[${typeLabel}: ${fragment.label}]`);
    lines.push(fragment.content);
    lines.push('');
  }
  return lines.join('\n');
}
