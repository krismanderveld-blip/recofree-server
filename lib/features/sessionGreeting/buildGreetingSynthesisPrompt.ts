/**
 * Session Greeting V3 — Synthesis Prompt Builder (Redesigned)
 *
 * REDESIGN: Instead of passing disconnected source snippets to GPT,
 * we now build a COHERENT CONTEXT BRIEFING with:
 * 1. Zone framing (GROEN/GEEL/ORANJE sets the emotional tone)
 * 2. Sources presented as a narrative context, not a numbered list
 * 3. Zone-specific tone instructions that tell GPT HOW to greet
 * 4. Anti-hallucination rules remain strict
 *
 * Also provides override prompt builders for CRISIS/FIRST/MISSING/RETURN modes.
 */

import type {
  GreetingSynthesisPromptPayload,
  SelectedSynthesisSource,
  SessionAbsenceResultForPrompt,
  GreetingSynthesisMode,
} from './sessionGreetingV3.types';
import type { SessionAbsenceResult } from './calculateSessionAbsence';
import type { GreetingVspSectionSnapshot } from './sessionGreeting.types';

// ─── Forbidden Patterns ─────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: string[] = [
  'hoe voel je je',
  'hoe gaat het',
  'hoe is het',
  'ik zie dat je',
  'ten eerste',
  'ten tweede',
  'ten derde',
  'punt 1',
  'punt 2',
  'laten we beginnen met',
  'ik merk op dat',
  'samenvattend',
  'om samen te vatten',
  'checklist',
  'inventory',
  'laat me even opsommen',
  // Absence-specific forbidden patterns (blame/relapse assumption)
  'terugval',
  'hervallen',
  'je hebt het opgegeven',
  'je was weg',
  'waar was je',
  'waarom ben je weggebleven',
  'je hebt gefaald',
  'het is mislukt',
  'je bent teruggevallen',
];

// ─── Zone Tone Instructions ──────────────────────────────────────────────────

interface ZoneToneConfig {
  toneInstruction: string;
  openQuestionStyle: string;
}

const ZONE_TONE_MAP: Record<string, ZoneToneConfig> = {
  GROEN: {
    toneInstruction: 'TOON: Warm, open en uitnodigend. De gebruiker voelt zich stabiel — je mag exploreren en positieve elementen benoemen.',
    openQuestionStyle: 'Eindig met een open, uitnodigende vraag die aansluit bij wat de gebruiker deelde.',
  },
  GEEL: {
    toneInstruction: 'TOON: Zacht, erkennend en aandachtig. Er speelt iets bij de gebruiker — erken dat zonder te dramatiseren. Wees aanwezig, niet opgewekt. Negeer NIET wat er leeft.',
    openQuestionStyle: 'Eindig met een zachte, open vraag die ruimte geeft om te delen wat er speelt. Niet pushen, wel uitnodigen.',
  },
  ORANJE: {
    toneInstruction: 'TOON: Direct, grondend en steunend. De gebruiker ervaart spanning — wees concreet en aanwezig. Geen positief-wassing, geen afleiding.',
    openQuestionStyle: 'Eindig met een concrete vraag over het nu-moment: wat heeft de gebruiker nu nodig?',
  },
  ROOD: {
    toneInstruction: 'TOON: Kalm, direct en veilig. De gebruiker is in een acute fase — bied aanwezigheid zonder paniek.',
    openQuestionStyle: 'Stel één concrete vraag over het nu-moment.',
  },
  PAARS: {
    toneInstruction: 'TOON: Kalm, direct en veilig. De gebruiker is in een acute fase — bied aanwezigheid zonder paniek.',
    openQuestionStyle: 'Stel één concrete vraag over het nu-moment.',
  },
};

function getZoneTone(vspZone: string | undefined): ZoneToneConfig {
  const zone = (vspZone ?? 'GROEN').toUpperCase();
  return ZONE_TONE_MAP[zone] ?? ZONE_TONE_MAP['GROEN'];
}

// ─── Synthesis Prompt ───────────────────────────────────────────────────────

export interface BuildSynthesisPromptInput {
  userName: string;
  selectedSources: SelectedSynthesisSource[];
  absence: SessionAbsenceResult;
  mode: GreetingSynthesisMode;
  vspZone?: string;
  vspSection?: GreetingVspSectionSnapshot;
}

export function buildGreetingSynthesisPromptPayload(
  input: BuildSynthesisPromptInput,
): GreetingSynthesisPromptPayload {
  const { userName, selectedSources, absence, mode, vspZone, vspSection } = input;

  const isReturnMode = mode === 'RETURN_AFTER_ABSENCE';
  const absenceForPrompt: SessionAbsenceResultForPrompt | undefined = isReturnMode
    ? buildAbsenceForPrompt(absence)
    : undefined;

  const zoneTone = getZoneTone(vspZone);

  const synthesisInstruction = isReturnMode
    ? buildReturnAfterAbsenceInstruction(userName, selectedSources, absence, vspZone)
    : buildCoherentSynthesisInstruction(userName, selectedSources, vspZone, zoneTone, vspSection);

  return {
    persona: 'elias',
    userName,
    mode,
    maxSentences: 4,
    selectedSources,
    absence: absenceForPrompt,
    synthesisInstruction,
    openQuestionInstruction: zoneTone.openQuestionStyle,
    forbiddenPatterns: FORBIDDEN_PATTERNS,
    languageRule: 'Schrijf grammaticaal correct, vloeiend Nederlands. Geen afkortingen, geen emoji, geen opsommingen.',
  };
}

function buildAbsenceForPrompt(absence: SessionAbsenceResult): SessionAbsenceResultForPrompt {
  let wordingHint: SessionAbsenceResultForPrompt['wordingHint'];
  if (absence.band === 'LONG_RETURN') {
    wordingHint = 'long_return_soft';
  } else if (absence.band === 'SHORT') {
    wordingHint = 'short_return';
  } else {
    wordingHint = 'return_after_absence';
  }

  return {
    band: absence.band,
    absenceDaysRounded: absence.absenceDaysExact !== null
      ? Math.round(absence.absenceDaysExact * 10) / 10
      : null,
    wordingHint,
  };
}

// ─── Coherent Synthesis Instruction (NEW) ─────────────────────────────────────

function buildCoherentSynthesisInstruction(
  userName: string,
  selectedSources: SelectedSynthesisSource[],
  vspZone: string | undefined,
  zoneTone: ZoneToneConfig,
  vspSection?: GreetingVspSectionSnapshot,
): string {
  const zone = (vspZone ?? 'GROEN').toUpperCase();
  const contextBriefing = buildContextBriefing(selectedSources, zone);
  const vspPersonalContext = buildVspPersonalContext(vspSection, zone);

  return `Je bent Elias. Schrijf een warme, persoonlijke begroeting voor ${userName}.

ZONE: ${zone}
${zoneTone.toneInstruction}

CONTEXT (dit is wat je weet over de gebruiker NU):
${contextBriefing}${vspPersonalContext}

INSTRUCTIES:
- Verweef de context tot ÉÉN vloeiende, menselijke begroeting
- Gebruik MAXIMAAL 3-4 zinnen totaal
- Begin met een persoonlijke opening (gebruik de naam)
- ${zoneTone.openQuestionStyle}
- De begroeting moet aanvoelen als een warm gesprek, NIET als een samenvatting
- De TOON moet passen bij zone ${zone}: ${zone === 'GROEN' ? 'open en warm' : zone === 'GEEL' ? 'erkennend en zacht — er speelt iets' : 'direct en grondend'}
- Noem NOOIT de bronnen expliciet ("ik zie in je dagboek" is verboden)
- Noem NOOIT de zone of kleuren ("je zit in geel" is verboden)
- Verwijs indirect en natuurlijk naar de inhoud
- Geen opsommingen, geen checklist-taal, geen "ten eerste/ten tweede"
- Grammaticaal correct, vloeiend Nederlands
- Geen emoji

VERBODEN ZINNEN:
- "Hoe voel je je?" (te generiek)
- "Hoe gaat het?" (te generiek)
- "Ik zie dat je..." (te klinisch)
- "Laten we beginnen met..." (te gestructureerd)
- Elke zin die klinkt als een inventarisatie of checklist

KRITIEK — GEEN HALLUCINATIE:
- Verwijs ALLEEN naar informatie die EXPLICIET in de CONTEXT hierboven staat
- Verzin NOOIT sessies, gesprekken of activiteiten die niet in de context staan
- Als de context zegt "dagboek van gisteren" mag je ernaar verwijzen; als er GEEN bron over gisteren is, NOEM gisteren dan NIET
- Zeg NOOIT "fijne dag gisteren" of "sessie van gisteren" tenzij dit LETTERLIJK uit de context komt
- Bij twijfel: houd het algemeen en warm zonder specifieke tijdsreferenties

VOORBEELD VAN GOEDE BEGROETING BIJ ZONE ${zone} (ter illustratie, niet kopiëren):
${getZoneExample(userName, zone)}`;
}

/**
 * Builds personal VSP context from the user's own structured VSP section.
 * This gives GPT access to the user's self-described signals, what helps, and anchor sentence
 * for their current zone — enabling deeply personal, relevant greetings.
 */
function buildVspPersonalContext(vspSection: GreetingVspSectionSnapshot | undefined, zone: string): string {
  if (!vspSection) return '';

  const parts: string[] = [];
  const entry = vspSection.currentZoneEntry;

  if (entry) {
    if (entry.signals && entry.signals.length > 0) {
      parts.push(`\n\nPERSOONLIJKE VSP-SIGNALEN (wat de gebruiker ZELF beschrijft als herkenningspunten in zone ${zone}):\n  ${entry.signals.join('\n  ')}`);
    }
    if (entry.whatHelps && entry.whatHelps.length > 0) {
      parts.push(`\nWAT HELPT (door de gebruiker zelf benoemd voor zone ${zone}):\n  ${entry.whatHelps.join('\n  ')}`);
    }
    if (entry.anchorSentence) {
      parts.push(`\nANKERZIN: "${entry.anchorSentence}"`);
    }
  }

  if (vspSection.mainAnchorSentence && !entry?.anchorSentence) {
    parts.push(`\nALGEMENE ANKERZIN: "${vspSection.mainAnchorSentence}"`);
  }

  if (parts.length === 0) return '';

  const isHighZone = ['ROOD', 'PAARS', 'ORANJE'].includes(zone);

  if (isHighZone) {
    return parts.join('') + `\n\nCRITICAL — VSP ZONE ${zone} ACTIVE:\n- The user is in a HIGH zone. Their safety plan content above is DIRECTLY relevant RIGHT NOW.\n- You MUST incorporate what THEY wrote helps them. Use their own words and phrasing.\n- If they wrote "calling my sponsor" as what helps → mention reaching out to someone.\n- If they wrote an anchor sentence → weave it into your greeting naturally.\n- Do NOT say "your safety plan says..." — but DO use the content directly.\n- This is NOT background context — this is their ACTIVE coping strategy for this exact moment.`;
  }

  return parts.join('') + `\n\nVSP-CONTEXT GUIDANCE:\n- You may subtly reference what the user described as signals or what helps\n- Never mention it literally ("your safety plan says...") — weave it naturally\n- Use it as background knowledge to guide tone and direction\n- If the user mentions "slowing down" as helpful, you might say "take a moment"\n- If the user mentions "being in my head" as a signal, you might ask "what do you feel right now?" (toward body)`;
}

/**
 * Builds a coherent narrative context from selected sources instead of a numbered list.
 */
function buildContextBriefing(sources: SelectedSynthesisSource[], zone: string): string {
  if (sources.length === 0) {
    return '  Geen specifieke context beschikbaar.';
  }

  const parts: string[] = [];

  for (const source of sources) {
    switch (source.sourceType) {
      case 'TODAY_MOOD':
        parts.push(`De check-in van vandaag laat zien: ${source.safeAnchor}.`);
        break;
      case 'RECENT_DIARY':
        parts.push(`Uit het dagboek (recent): "${source.safeAnchor}".`);
        break;
      case 'RECENT_GRATITUDE':
        parts.push(`Dankbaarheid (recent): "${source.safeAnchor}".`);
        break;
      case 'BACKPACK_RECENT_UPDATE':
        parts.push(`De rugzak is recent bijgewerkt.`);
        break;
      case 'ACTIVE_HOPE_OR_FEAR':
        parts.push(`Actieve zorg: "${source.safeAnchor}".`);
        break;
      case 'SCHEMA_ROTATION':
        parts.push(`Terugkerend thema: ${source.safeAnchor}.`);
        break;
      case 'LAST_SESSION_SUMMARY':
        parts.push(`Vorige sessie: ${source.safeAnchor}.`);
        break;
      case 'RECURRING_PATTERN':
        parts.push(`Terugkerend patroon over meerdere sessies: ${source.safeAnchor}.`);
        break;
    }
  }

  return parts.map(p => `  ${p}`).join('\n');
}

/**
 * Returns a zone-appropriate example greeting (for illustration in the prompt).
 */
function getZoneExample(userName: string, zone: string): string {
  switch (zone) {
    case 'GEEL':
      return `"${userName}, fijn dat je er bent. Het klinkt alsof er iets speelt — dat mag er zijn. Wil je me vertellen wat er op dit moment door je heen gaat?"`;
    case 'ORANJE':
      return `"${userName}, ik ben hier. Het klinkt alsof het nu zwaar is. Wat heb je op dit moment het meest nodig?"`;
    case 'ROOD':
    case 'PAARS':
      return `"${userName}, ik ben hier bij je. Vertel me wat er nu speelt."`;
    default: // GROEN
      return `"${userName}, fijn dat je er bent. Er klinkt iets door van rust in wat je deelde — mooi om te zien. Waar wil je het vandaag over hebben?"`;
  }
}

// ─── Return After Absence Instruction ─────────────────────────────────────────

function buildReturnAfterAbsenceInstruction(
  userName: string,
  selectedSources: SelectedSynthesisSource[],
  absence: SessionAbsenceResult,
  vspZone: string | undefined,
): string {
  const days = absence.absenceDaysExact !== null
    ? Math.round(absence.absenceDaysExact)
    : 'enkele';
  const isLongReturn = absence.band === 'LONG_RETURN';
  const zone = (vspZone ?? 'GROEN').toUpperCase();
  const zoneTone = getZoneTone(vspZone);

  const toneInstruction = isLongReturn
    ? `TOON: Extra zacht en warm. Geen alarm, geen bezorgdheid, geen verwijt. De gebruiker is er weer — dat is het enige dat telt. Behandel de terugkeer als iets positiefs.`
    : `TOON: Warm en verwelkomend. Erken kort dat het even geleden is, zonder er zwaar aan te tillen.`;

  const contextBriefing = selectedSources.length > 0
    ? `\nCONTEXT (optioneel te verweven als het natuurlijk past):\n${buildContextBriefing(selectedSources, zone)}\n- De afwezigheids-erkenning staat VOOROP, context is secundair`
    : '';

  return `Je bent Elias. ${userName} is terug na ${days} dagen afwezigheid.
ZONE: ${zone}

${toneInstruction}
${zone !== 'GROEN' ? zoneTone.toneInstruction : ''}

INSTRUCTIES:
- Begin met een warme erkenning dat ${userName} er weer is
- Gebruik MAXIMAAL 3-4 zinnen totaal
- Erken de afwezigheid ZONDER te vragen waarom ze weg waren
- Maak GEEN aannames over wat er gebeurd is (geen "terugval", geen "moeilijke periode")
- ${zoneTone.openQuestionStyle}
- De begroeting moet aanvoelen als een vriend die blij is je te zien
${contextBriefing}

ABSOLUUT VERBODEN:
- Vragen waarom ze weg waren ("waar was je?", "waarom ben je weggebleven?")
- Aannames over terugval of falen ("je bent teruggevallen", "het is mislukt")
- Verwijten of schuldgevoel triggeren
- Alarm-toon of bezorgdheid over de afwezigheid
- "Hoe voel je je?" of "Hoe gaat het?"
- Opsommingen of checklist-taal
- Emoji

KRITIEK — GEEN HALLUCINATIE:
- Verwijs ALLEEN naar informatie die EXPLICIET in de CONTEXT hierboven staat
- Verzin NOOIT sessies, gesprekken of activiteiten die niet in de context staan
- Zeg NOOIT "sessie van gisteren" of "vorige keer" tenzij dit LETTERLIJK uit de context komt
- Bij twijfel: houd het algemeen en warm zonder specifieke tijdsreferenties

VOORBEELD (ter illustratie, niet kopiëren):
"${userName}, fijn dat je er weer bent. Het maakt niet uit hoe lang het geweest is — je bent hier, en dat telt. Wat heb je nodig vandaag?"`;
}

// ─── Override Prompt Builders ────────────────────────────────────────────────

export function buildCrisisOverridePrompt(userName: string, craving: number, vspZone?: string): string {
  const zone = (vspZone ?? 'ROOD').toUpperCase();
  return `Je bent Elias. ${userName} heeft een hoge craving (${craving}/10) ingevuld. Zone: ${zone}.

Schrijf een korte, directe begroeting (2-3 zinnen):
- Erken dat het zwaar is ZONDER te dramatiseren
- Bied aanwezigheid ("ik ben hier")
- Stel één concrete vraag over het nu-moment
- Geen opsommingen, geen checklist, geen "hoe voel je je"
- Grammaticaal correct Nederlands, geen emoji`;
}

export function buildFirstSessionOverridePrompt(
  userName: string | null,
  vspZone?: string,
  vspSection?: GreetingVspSectionSnapshot,
): string {
  const name = userName || 'daar';
  const zone = (vspZone ?? '').toUpperCase();

  // If the user already filled in their VSP section AND selected a zone, use it
  const hasVspContent = vspSection?.currentZoneEntry &&
    (vspSection.currentZoneEntry.signals.length > 0 || vspSection.currentZoneEntry.anchorSentence);

  if (hasVspContent && zone && zone !== 'GROEN') {
    // First session but user already filled VSP + selected non-green zone
    const signals = vspSection!.currentZoneEntry!.signals.slice(0, 2).join(', ');
    const anchor = vspSection!.currentZoneEntry!.anchorSentence;
    const whatHelps = vspSection!.currentZoneEntry!.whatHelps.slice(0, 2).join(', ');

    return `Je bent Elias. Dit is de EERSTE sessie van ${name}. De gebruiker heeft zone ${zone} gekozen.

Beschikbare context uit het persoonlijk veiligheidsplan:
- Signalen bij ${zone}: ${signals || 'niet ingevuld'}
- Wat helpt bij ${zone}: ${whatHelps || 'niet ingevuld'}
- Ankerzin: ${anchor || 'niet ingevuld'}

Schrijf een warme welkomstbegroeting (3-4 zinnen):
- Verwelkom ${name} persoonlijk — dit is hun eerste keer
- Erken dat ze ${zone} hebben gekozen (zonder te dramatiseren)
- Refereer subtiel aan hun eigen signalen of ankerzin als die er zijn
- Sluit af met één open vraag die aansluit bij hun huidige staat
- Toon: warm, veilig, erkennend. Geen opsommingen, geen checklist
- Grammaticaal correct Nederlands, geen emoji
- VERBODEN: "hoe voel je je", "hoe gaat het", opsommingen, nummers`;
  }

  // Default first session: warm welcome, invite to explore
  return `Je bent Elias. Dit is de ALLEREERSTE sessie van ${name}. Ze kennen je nog niet.

Dit is het belangrijkste moment: de eerste 5 minuten bepalen of iemand terugkomt.

Schrijf een warme, persoonlijke welkomstbegroeting (3-4 zinnen):
- Begin met een warme verwelkoming die ${name} bij naam noemt
- Maak duidelijk dat dit HUN plek is — veilig, zonder oordeel, op hun tempo
- Nodig uit om te vertellen wat hen hier brengt, of gewoon te zijn
- De toon is: alsof je een vriend verwelkomt die voor het eerst langskomt. Warm, laagdrempelig, geen therapeutentaal
- NIET vragen "hoe voel je je" of "hoe gaat het" — dat is te generiek
- NIET verwijzen naar functies, rugzak, of VSP — dat komt later
- Geen opsommingen, geen checklist, geen emoji
- Grammaticaal correct Nederlands
- Max 4 zinnen, eindig met één open vraag die uitnodigt zonder te pushen`;
}

export function buildMissingDataOverridePrompt(userName: string): string {
  return `Je bent Elias. ${userName} komt terug maar heeft vandaag nog niets ingevuld (geen sliders, geen dagboek).

Schrijf een warme, uitnodigende begroeting (2-3 zinnen):
- Verwelkom ${userName} bij naam — fijn dat ze er zijn
- Nodig subtiel uit om te delen wat er speelt, ZONDER te verwijzen naar sliders of dagboek
- De toon is: blij om ze te zien, nieuwsgierig naar hoe het gaat, zonder druk
- NIET dwingend, NIET verplichtend, NIET verwijzen naar "check-in" of "invullen"
- VERBODEN: "hoe voel je je", "hoe gaat het", opsommingen, emoji
- Grammaticaal correct Nederlands
- Max 3 zinnen, eindig met één open vraag`;
}

// ─── Output Safety Filter ───────────────────────────────────────────────────

export interface GreetingOutputValidation {
  valid: boolean;
  reason: string;
}

/**
 * Validates GPT output against safety rules.
 * Rejects:
 * - More than 5 sentences
 * - Contains forbidden patterns
 * - Contains emoji
 * - Contains numbered lists or bullet points
 * - Is empty or too short
 * - Contains blame/relapse assumptions (absence-specific)
 */
export function enforceGreetingOutputRulesV3(output: string): GreetingOutputValidation {
  if (!output || output.trim().length < 10) {
    return { valid: false, reason: 'Output too short or empty' };
  }

  const trimmed = output.trim();

  // Check sentence count (rough: split on . ! ?)
  const sentences = trimmed
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 5);
  if (sentences.length > 5) {
    return { valid: false, reason: `Too many sentences: ${sentences.length} (max 5)` };
  }

  // Check forbidden patterns
  const lower = trimmed.toLowerCase();
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lower.includes(pattern)) {
      return { valid: false, reason: `Contains forbidden pattern: "${pattern}"` };
    }
  }

  // Check emoji (basic range)
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(trimmed)) {
    return { valid: false, reason: 'Contains emoji' };
  }

  // Check numbered lists or bullet points
  if (/^\s*[\d]+[.)]\s/m.test(trimmed) || /^\s*[-•*]\s/m.test(trimmed)) {
    return { valid: false, reason: 'Contains list formatting (bullets or numbers)' };
  }

  // Check inventory-style language
  const inventoryPatterns = [
    /ik\s+(?:zie|merk|constateer)\s+(?:dat|het\s+volgende)/i,
    /(?:ten\s+eerste|ten\s+tweede|ten\s+derde)/i,
    /(?:punt\s+\d|stap\s+\d)/i,
    /laat\s+me\s+(?:even\s+)?(?:opsommen|samenvatten)/i,
  ];
  for (const pattern of inventoryPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Contains inventory/checklist language' };
    }
  }

  // Check blame/relapse assumption patterns
  const blamePatterns = [
    /je\s+(?:hebt|bent)\s+(?:het\s+)?(?:opgegeven|gefaald|teruggevallen)/i,
    /(?:het\s+is|dat\s+is)\s+mislukt/i,
    /waarom\s+(?:ben|was)\s+je\s+(?:weg|weggebleven)/i,
    /waar\s+was\s+je/i,
  ];
  for (const pattern of blamePatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Contains blame or relapse assumption' };
    }
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Returns the forbidden patterns list for external use (e.g., tests).
 */
export function getForbiddenPatterns(): string[] {
  return [...FORBIDDEN_PATTERNS];
}
