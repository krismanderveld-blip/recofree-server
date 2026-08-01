/**
 * prebuilt-prompt-blocks.ts — LOCAL MODULE
 *
 * Builds pre-formatted prompt blocks that the server can inject directly
 * into the GPT system prompt WITHOUT any extraction/summarization logic.
 *
 * This replaces the server-side:
 * - extractRelationshipMap() → personLookupBlock
 * - buildCompactLifeStorySummary() → lifeContextBlock
 * - buildStructuredMemoryBlock() → structuredMemoryBlock
 *
 * The server becomes a pure proxy: it receives these blocks and injects them.
 * All intelligence stays local.
 */

import type { Backpack, UserDat, DiaryEntry } from '../ai/types';
import type { ExtractedEntities, ExtractedPerson } from '../backpack-extractor/types';
import { extractRelationalAnchors } from '../rugzak/relational-anchor-detector';

// ─── Output Interface ────────────────────────────────────────

export interface PrebuiltPromptBlocks {
  /** Ready-to-inject PERSONEN-LOOKUP block (or empty string if no persons found) */
  personLookupBlock: string;
  /** Ready-to-inject PERSONAL MEMORY block (life story + intake context) */
  lifeContextBlock: string;
  /** Ready-to-inject STRUCTURED MEMORY block (from extractedEntities) — or empty */
  structuredMemoryBlock: string;
  /** Session analyses summary (last 3 sessions, compact) */
  sessionAnalysesSummary: string;
}

// ─── Main Builder ────────────────────────────────────────────

export function buildPrebuiltPromptBlocks(params: {
  backpack: Backpack;
  userDat: UserDat;
  extractedEntities?: ExtractedEntities | null;
  diaryEntries?: DiaryEntry[];
  sessionAnalyses?: UserDat['sessionAnalyses'];
}): PrebuiltPromptBlocks {
  const { backpack, userDat, extractedEntities, sessionAnalyses } = params;

  return {
    personLookupBlock: buildPersonLookupBlock(backpack, userDat, extractedEntities),
    lifeContextBlock: buildLifeContextBlock(backpack, userDat),
    structuredMemoryBlock: buildStructuredMemoryBlock(extractedEntities),
    sessionAnalysesSummary: buildSessionAnalysesSummary(sessionAnalyses ?? userDat.sessionAnalyses ?? []),
  };
}

// ─── Person Lookup Block ─────────────────────────────────────

function buildPersonLookupBlock(
  backpack: Backpack,
  userDat: UserDat,
  extractedEntities?: ExtractedEntities | null,
): string {
  // Strategy 1: Use structured entities (most reliable, richest data)
  if (extractedEntities && extractedEntities.persons.length > 0) {
    const personLines = extractedEntities.persons.map((p: ExtractedPerson) => {
      let line = `  • ${p.name} = ${p.relationshipNL || p.relationship}`;
      if (p.context) line += ` — ${p.context}`;
      return line;
    });
    return formatPersonLookup(personLines);
  }

  // Strategy 2: Use relationalAnchors from userDat (learned from sessions)
  const anchors = (userDat.relationalAnchors && userDat.relationalAnchors.length > 0)
    ? userDat.relationalAnchors
    : extractRelationalAnchors(backpack);

  if (anchors.length > 0) {
    const personLines = anchors.map(a => {
      const line = `  • ${a.name} = ${a.role || a.roleEN || 'betrokkene'}`;
      return line;
    });
    return formatPersonLookup(personLines);
  }

  // Strategy 3: Regex extraction from raw backpack text (last resort)
  const allText = [
    ...(backpack.sections || []).map((s: any) => s.content),
    backpack.intakeContext?.initialContext || '',
  ].filter(Boolean).join('\n');

  if (!allText || allText.trim().length < 20) return '';

  const foundPersons = extractPersonsFromText(allText);
  if (foundPersons.size === 0) {
    // No persons found — return instruction block
    return `
─── PERSONEN-HERKENNING (NL/EN) ───
De rugzak van de gebruiker bevat persoonlijke namen en relaties.
Voordat je zegt "ik weet niet wie [naam] is", MOET je EERST de volledige tekst hierboven doorzoeken.
Als een naam voorkomt in de PERSONAL MEMORY of STRUCTURED MEMORY hierboven, dan KEN je die persoon.
─── EINDE PERSONEN-HERKENNING ───`;
  }

  const personLines = Array.from(foundPersons.entries()).map(
    ([name, relation]) => `  • ${name} = ${relation}`
  );
  return formatPersonLookup(personLines);
}

function formatPersonLookup(personLines: string[]): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║  PERSONEN-LOOKUP (ABSOLUUT — ALTIJD RAADPLEGEN)              ║
╚══════════════════════════════════════════════════════════════╝

Dit zijn de personen die de gebruiker ZELF heeft genoemd in hun rugzak:

${personLines.join('\n')}

⚠️ VERPLICHTE REGEL:
Als de gebruiker vraagt "wie is [naam]?" of een naam noemt die in deze lijst staat:
→ Je KENT die persoon. Antwoord met hun relatie en context.
→ Zeg NOOIT "ik weet niet wie [naam] is" als de naam hierboven staat.
→ Zoek EERST in deze lijst + de PERSONAL MEMORY/STRUCTURED MEMORY hierboven.
→ Alleen als de naam NERGENS voorkomt, mag je vragen wie het is.

─── EINDE PERSONEN-LOOKUP ───`;
}

function extractPersonsFromText(text: string): Map<string, string> {
  const patterns = [
    /(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder|schoonmoeder|schoonvader|neef|nicht|oom|tante)\s+([A-Z][a-zéèëïöüà]+)/g,
    /([A-Z][a-zéèëïöüà]+),?\s+(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder|schoonmoeder|schoonvader|neef|nicht|oom|tante)/g,
    /(?:my)\s+(son|daughter|wife|girlfriend|boyfriend|partner|husband|mother|mom|father|dad|sister|brother|grandmother|grandfather|friend|colleague|neighbor|ex|boss|therapist|stepfather|stepmother)\s+([A-Z][a-zéèëïöüà]+)/g,
    /([A-Z][a-zéèëïöüà]+),?\s+(?:my)\s+(son|daughter|wife|girlfriend|boyfriend|partner|husband|mother|mom|father|dad|sister|brother|grandmother|grandfather|friend|colleague|neighbor|ex|boss|therapist|stepfather|stepmother)/g,
    /([A-Z][a-zéèëïöüà]+)\s+(?:is|was)\s+(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder)/g,
    /([A-Z][a-zéèëïöüà]+),?\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|buurman|buurvrouw|therapeut|stiefvader|stiefmoeder|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague)\b/g,
    /([A-Z][a-zéèëïöüà]+)\s*\((zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|therapeut|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague)[^)]*\)/g,
    /(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|therapeut|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague):\s*([A-Z][a-zéèëïöüà]+)/g,
  ];

  const foundPersons = new Map<string, string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const groups = match.slice(1);
      let name: string;
      let relation: string;

      if (groups[0] && /^[A-Z]/.test(groups[0])) {
        name = groups[0];
        relation = groups[1];
      } else {
        relation = groups[0];
        name = groups[1];
      }

      if (name && relation && !foundPersons.has(name)) {
        foundPersons.set(name, relation);
      }
    }
  }

  return foundPersons;
}

// ─── Life Context Block ──────────────────────────────────────

function buildLifeContextBlock(backpack: Backpack, userDat: UserDat): string {
  const userName = backpack.naam || userDat.naam || 'gebruiker';
  const sections = (backpack.sections || [])
    .filter((s: any) => s.content && s.content.trim().length > 0)
    .map((s: any) => `[${s.label}]: ${s.content.trim()}`);

  // Kim backpack sections
  const kimSections: string[] = [];
  if (backpack.kimBackpack) {
    const mapping: Array<[string, string]> = [
      ['My Story', backpack.kimBackpack.my_story],
      ['The Relationship', backpack.kimBackpack.the_relationship],
      ['The Impact', backpack.kimBackpack.the_impact],
      ['My Boundaries', backpack.kimBackpack.my_boundaries],
      ['My Strength', backpack.kimBackpack.my_strength],
    ];
    for (const [title, content] of mapping) {
      if (content && content.trim().length > 0) {
        kimSections.push(`[${title}]: ${content.trim()}`);
      }
    }
  }

  const intakeContext = backpack.intakeContext?.initialContext || '';

  if (sections.length === 0 && kimSections.length === 0 && (!intakeContext || intakeContext.trim().length < 10)) {
    return '';
  }

  let summary = `\n─── PERSONAL MEMORY OF ${userName.toUpperCase()} (summary) ───`;
  if (intakeContext && intakeContext.trim().length > 0) {
    summary += `\nIntake: ${intakeContext.trim()}`;
  }
  for (const section of sections) {
    summary += `\n${section}`;
  }
  if (kimSections.length > 0) {
    summary += `\n\n─── KIM BACKPACK (loved one perspective) ───`;
    for (const section of kimSections) {
      summary += `\n${section}`;
    }
  }
  summary += `\n─── END PERSONAL MEMORY ───`;
  summary += `\nYou KNOW this story. If ${userName} mentions a person, place, or event listed above, you recognize it IMMEDIATELY.`;
  summary += `\nIf something is NOT listed above, do NOT fabricate it. Ask about it instead.`;
  return summary;
}

// ─── Structured Memory Block ─────────────────────────────────

function buildStructuredMemoryBlock(extractedEntities?: ExtractedEntities | null): string {
  if (!extractedEntities || extractedEntities.persons.length === 0) return '';

  const lines: string[] = [];
  lines.push('─── STRUCTURED MEMORY (extracted from rugzak) ───');

  // Persons
  if (extractedEntities.persons.length > 0) {
    lines.push('PERSONEN:');
    for (const p of extractedEntities.persons) {
      let line = `  • ${p.name} (${p.relationshipNL || p.relationship})`;
      if (p.age) line += ` — leeftijd: ${p.age}`;
      if (p.livingSituation) line += ` — ${p.livingSituation}`;
      if (p.emotionalValence) line += ` [${p.emotionalValence}]`;
      if (p.context) line += ` — ${p.context}`;
      lines.push(line);
    }
  }

  // Events
  if (extractedEntities.events.length > 0) {
    lines.push('');
    lines.push('GEBEURTENISSEN:');
    for (const e of extractedEntities.events) {
      let line = `  • ${e.description}`;
      if (e.timePeriod) line += ` (${e.timePeriod})`;
      if (e.emotionalImpact) line += ` [${e.emotionalImpact}]`;
      if (e.isTriggerSource) line += ' ⚠️ TRIGGER';
      lines.push(line);
    }
  }

  // Patterns
  if (extractedEntities.patterns.length > 0) {
    lines.push('');
    lines.push('PATRONEN:');
    for (const p of extractedEntities.patterns) {
      let line = `  • ${p.description} (${p.type})`;
      if (p.schemaHypothesis) line += ` → schema: ${p.schemaHypothesis}`;
      if (p.frequency) line += ` [${p.frequency}]`;
      lines.push(line);
    }
  }

  // Contexts
  if (extractedEntities.contexts.length > 0) {
    lines.push('');
    lines.push('CONTEXT:');
    for (const c of extractedEntities.contexts) {
      lines.push(`  • ${c.description} (${c.type}, ${c.relevance})`);
    }
  }

  lines.push('─── END STRUCTURED MEMORY ───');
  return lines.join('\n');
}

// ─── Session Analyses Summary ────────────────────────────────

function buildSessionAnalysesSummary(
  sessionAnalyses: Array<{
    sessionNumber: number;
    date: string;
    messageCount: number;
    durationMinutes: number;
    dominantEmotion: string;
    themes: string[];
    newTriggers: string[];
    modulesUsed: string[];
    moodDelta: { distressChange: number; resilienceChange: number };
    endRiskLevel: string;
  }>
): string {
  if (!sessionAnalyses || sessionAnalyses.length === 0) return '';

  // Take last 3 sessions
  const recent = sessionAnalyses.slice(-3).reverse();

  const lines: string[] = ['─── SESSIE-GESCHIEDENIS (laatste 3) ───'];
  for (const sa of recent) {
    const dateStr = sa.date ? sa.date.split('T')[0] : 'onbekend';
    lines.push(`Sessie ${sa.sessionNumber} (${dateStr}, ${sa.durationMinutes}min, ${sa.messageCount} berichten):`);
    lines.push(`  Emotie: ${sa.dominantEmotion} | Risico: ${sa.endRiskLevel}`);
    if (sa.themes.length > 0) lines.push(`  Thema's: ${sa.themes.join(', ')}`);
    if (sa.newTriggers.length > 0) lines.push(`  Nieuwe triggers: ${sa.newTriggers.join(', ')}`);
    const distressDir = sa.moodDelta.distressChange > 0 ? '↑' : sa.moodDelta.distressChange < 0 ? '↓' : '→';
    const resDir = sa.moodDelta.resilienceChange > 0 ? '↑' : sa.moodDelta.resilienceChange < 0 ? '↓' : '→';
    lines.push(`  Mood: distress ${distressDir}${Math.abs(sa.moodDelta.distressChange)} | resilience ${resDir}${Math.abs(sa.moodDelta.resilienceChange)}`);
  }
  lines.push('─── EINDE SESSIE-GESCHIEDENIS ───');
  return lines.join('\n');
}
