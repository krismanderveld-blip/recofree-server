/**
 * Greeting V4 — Parametric greeting engine for both personas (Elias/Kim).
 *
 * Architecture:
 * 1. collectSources() — gathers 2 most recent time-based entries from combined pool
 *    (mood/diary/gratitude/dagstructuur), sorted by timestamp.
 * 2. buildZoneArc() — determines start/end zone signals for tone.
 * 3. buildGreetingV4Prompt() — composes the system prompt including sources, zone-arc,
 *    and the last 8-10 messages for GPT to summarize inline.
 * 4. callGreetingProxy() — sends to Railway /api/session-greeting (gpt-4o-mini).
 * 5. buildDeterministicFallbackV4() — noodgreep for proxy unreachability.
 *
 * Model: gpt-4o-mini via Railway proxy (/api/session-greeting).
 * Fallback: deterministic, second-person, no raw logs.dat text.
 */

import type { UserDat, DiaryEntry, MoodSnapshot, Backpack, KimMoodSliders, EliasMoodSliders } from '@/lib/ai/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GreetingV4Input {
  backpack: Backpack;
  userDat: UserDat;
  diaryEntries: DiaryEntry[];
  apiBaseUrl: string;
  locale: 'nl' | 'en' | 'fr';
  /** Last 8-10 messages from previous session (user + assistant) */
  previousSessionMessages: Array<{ role: string; content: string; timestamp?: string }>;
  /** Day structure blocks for today (optional) */
  todayDayStructure?: string | null;
  /** Clinical mode (Elias only) */
  clinicalModeActive?: boolean;
}

export interface GreetingV4Result {
  greeting: string;
  debugLog: string;
  usedFallback: boolean;
}

type Persona = 'elias' | 'kim';

interface TimeBasedSource {
  type: 'mood' | 'diary' | 'gratitude' | 'daystructure';
  timestamp: string;
  content: string;
}

interface ZoneArc {
  startSignal: string; // human-readable description of start zone
  endSignal: string;   // derived from last messages weight
  isHeavy: boolean;    // true = voorzichtig openen
}

// ─── Language Maps ──────────────────────────────────────────────────────────

const WARM_DEFAULT: Record<string, (name: string) => string> = {
  nl: (name) => `Hey ${name}, fijn dat je voor RecoFree gekozen hebt. Wat brengt je hier?`,
  en: (name) => `Hey ${name}, great that you chose RecoFree. What brings you here?`,
  fr: (name) => `Hey ${name}, super que tu aies choisi RecoFree. Qu'est-ce qui t'amène ici?`,
};

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function greetingV4(input: GreetingV4Input): Promise<GreetingV4Result> {
  const persona: Persona = input.backpack.userType === 'kim' ? 'kim' : 'elias';
  const userName = input.userDat.naam || input.backpack.naam || 'daar';
  const locale = input.locale || 'nl';

  // ── First session detection: no previous messages AND no mood history → warm default
  const hasHistory = input.previousSessionMessages.length > 0 ||
    input.userDat.moodHistory.length > 0 ||
    input.diaryEntries.length > 0 ||
    (input.userDat.totalSessions ?? 0) > 1;

  if (!hasHistory) {
    const greeting = WARM_DEFAULT[locale]?.(userName) ?? WARM_DEFAULT.nl(userName);
    return {
      greeting,
      debugLog: `[GreetingV4] First session → warm default (locale=${locale})`,
      usedFallback: false,
    };
  }

  // ── Collect sources
  const sources = collectSources(input, persona);

  // ── Build zone arc
  const zoneArc = buildZoneArc(input, persona);

  // ── Build key figures from backpack (persons, relationships, context) + chat logs
  const keyFigures = buildKeyFigures(input.backpack, input.userDat, input.previousSessionMessages);

  // ── Build prompt
  const systemPrompt = buildGreetingV4Prompt({
    persona,
    userName,
    locale,
    sources,
    zoneArc,
    previousMessages: input.previousSessionMessages,
    clinicalModeActive: input.clinicalModeActive ?? false,
    keyFigures,
  });

  // ── Call proxy
  let greeting: string;
  let usedFallback = false;
  try {
    greeting = await callGreetingProxy(input.apiBaseUrl, systemPrompt, userName, input.clinicalModeActive ?? false);
  } catch (error) {
    console.warn('[GreetingV4] Proxy call failed, using deterministic fallback:', error);
    greeting = buildDeterministicFallbackV4(userName, locale, sources, zoneArc);
    usedFallback = true;
  }

  const debugLog = buildDebugLog(persona, locale, sources, zoneArc, usedFallback);

  return { greeting, debugLog, usedFallback };
}

// ─── Source Collector ───────────────────────────────────────────────────────

function collectSources(input: GreetingV4Input, _persona: Persona): TimeBasedSource[] {
  const pool: TimeBasedSource[] = [];

  // Mood snapshots
  for (const snap of input.userDat.moodHistory) {
    if (!snap.timestamp) continue;
    const sliderSummary = formatSliders(snap.sliders);
    if (sliderSummary) {
      pool.push({ type: 'mood', timestamp: snap.timestamp, content: sliderSummary });
    }
  }

  // Diary entries
  for (const entry of input.diaryEntries) {
    if (!entry.timestamp) continue;
    let content = entry.content || '';
    if (entry.moodTag) content = `[${entry.moodTag}] ${content}`;
    if (content.trim()) {
      pool.push({ type: 'diary', timestamp: entry.timestamp, content: content.trim() });
    }
  }

  // Gratitude (from diary entries that have gratitude field)
  for (const entry of input.diaryEntries) {
    if (!entry.timestamp || !entry.gratitude) continue;
    const parts = [entry.gratitude.entry1, entry.gratitude.entry2, entry.gratitude.entry3].filter(Boolean);
    if (parts.length > 0) {
      pool.push({ type: 'gratitude', timestamp: entry.timestamp, content: `Dankbaar voor: ${parts.join(', ')}` });
    }
  }

  // Day structure (today only, single entry)
  if (input.todayDayStructure) {
    pool.push({
      type: 'daystructure',
      timestamp: new Date().toISOString(),
      content: input.todayDayStructure,
    });
  }

  // Sort by timestamp descending (newest first), pick top 2
  pool.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return pool.slice(0, 2);
}

function formatSliders(sliders: any): string {
  if (!sliders) return '';
  const parts: string[] = [];
  // Elias sliders
  if ('stress' in sliders && sliders.stress != null) parts.push(`stress: ${sliders.stress}/10`);
  if ('craving' in sliders && sliders.craving != null) parts.push(`craving: ${sliders.craving}/10`);
  if ('sleep' in sliders && sliders.sleep != null) parts.push(`slaap: ${sliders.sleep}/10`);
  if ('energy' in sliders && sliders.energy != null) parts.push(`energie: ${sliders.energy}/10`);
  if ('distress' in sliders && sliders.distress != null) parts.push(`distress: ${sliders.distress}/10`);
  // Kim sliders
  if ('boundaryFatigue' in sliders && sliders.boundaryFatigue != null) parts.push(`grensmoeheid: ${sliders.boundaryFatigue}/10`);
  if ('emotionalBurden' in sliders && sliders.emotionalBurden != null) parts.push(`emotionele last: ${sliders.emotionalBurden}/10`);
  if ('selfCare' in sliders && sliders.selfCare != null) parts.push(`zelfzorg: ${sliders.selfCare}/10`);
  if ('eigenRegie' in sliders && sliders.eigenRegie != null) parts.push(`eigen regie: ${sliders.eigenRegie}/100`);
  return parts.join(', ');
}

// ─── Zone Arc ───────────────────────────────────────────────────────────────

function buildZoneArc(input: GreetingV4Input, persona: Persona): ZoneArc {
  // Start signal
  let startSignal: string;
  if (persona === 'elias') {
    const vsp = (input.userDat.currentMood as any)?.vsp as string | undefined;
    startSignal = vspToDescription(vsp);
  } else {
    const eigenRegie = (input.userDat.currentMood as KimMoodSliders)?.eigenRegie;
    startSignal = eigenRegieToDescription(eigenRegie);
  }

  // End signal: derive from weight/intensity of last messages
  const endSignal = deriveEndSignalFromMessages(input.previousSessionMessages);
  const isHeavy = isHeavySession(startSignal, endSignal);

  return { startSignal, endSignal, isHeavy };
}

function vspToDescription(vsp: string | undefined | null): string {
  if (!vsp) return 'onbekend (geen VSP-meting)';
  const map: Record<string, string> = {
    'GROEN': 'stabiel en veilig',
    'LICHTGROEN': 'stabiel en veilig',
    'GEEL': 'licht gespannen, maar beheersbaar',
    'ORANJE': 'duidelijk onder druk, verhoogde waakzaamheid',
    'ROOD': 'in nood, hoge spanning',
    'PAARS': 'in crisis',
  };
  return map[vsp.toUpperCase()] || `zone: ${vsp}`;
}

function eigenRegieToDescription(score: number | null | undefined): string {
  if (score == null) return 'onbekend (geen Eigen Regie-meting)';
  if (score >= 75) return 'voelt veel eigen regie, stabiel';
  if (score >= 50) return 'redelijke eigen regie, maar zoekend';
  if (score >= 25) return 'weinig eigen regie, het leven voelt bepaald door de ander';
  return 'nauwelijks eigen regie, sterk afhankelijk van de situatie';
}

function deriveEndSignalFromMessages(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 0) return 'geen vorige sessie beschikbaar';

  // Simple heuristic: check last 3 user messages for heavy indicators
  const userMsgs = messages.filter(m => m.role === 'user').slice(-3);
  if (userMsgs.length === 0) return 'geen gebruikersberichten in vorige sessie';

  const combined = userMsgs.map(m => m.content).join(' ').toLowerCase();
  const heavyIndicators = [
    'moeilijk', 'zwaar', 'bang', 'angstig', 'pijn', 'verdriet', 'huilen',
    'eenzaam', 'wanhoop', 'niet meer', 'opgeven', 'moe van alles',
    'overweldigd', 'paniek', 'crisis', 'terugval', 'drinken', 'gebruiken',
    'difficult', 'scared', 'pain', 'lonely', 'hopeless', 'overwhelmed',
  ];
  const heavyCount = heavyIndicators.filter(w => combined.includes(w)).length;

  if (heavyCount >= 3) return 'de vorige sessie eindigde zwaar en emotioneel beladen';
  if (heavyCount >= 1) return 'de vorige sessie had enige emotionele lading';
  return 'de vorige sessie eindigde relatief stabiel';
}

function isHeavySession(startSignal: string, endSignal: string): boolean {
  const heavyStart = startSignal.includes('druk') || startSignal.includes('nood') ||
    startSignal.includes('crisis') || startSignal.includes('nauwelijks') ||
    startSignal.includes('weinig eigen regie');
  const heavyEnd = endSignal.includes('zwaar') || endSignal.includes('beladen');
  return heavyStart || heavyEnd;
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

interface PromptBuildInput {
  persona: Persona;
  userName: string;
  locale: 'nl' | 'en' | 'fr';
  sources: TimeBasedSource[];
  zoneArc: ZoneArc;
  previousMessages: Array<{ role: string; content: string }>;
  clinicalModeActive: boolean;
  /** Key figures from backpack: persons, context, relational anchors */
  keyFigures?: string;
}

function buildGreetingV4Prompt(input: PromptBuildInput): string {
  const { persona, userName, locale, sources, zoneArc, previousMessages, keyFigures } = input;
  const companionName = persona === 'elias' ? 'Elias' : 'Kim';

  const langInstruction = getLanguageInstruction(locale);

  // Source section
  let sourceSection = '';
  if (sources.length > 0) {
    sourceSection = `\n## RECENTE BRONDATA (gebruik als context, NIET letterlijk citeren)\n`;
    for (const src of sources) {
      sourceSection += `- [${src.type}] ${src.content}\n`;
    }
  }

  // Previous messages for inline summary
  let messagesSection = '';
  if (previousMessages.length > 0) {
    const last10 = previousMessages.slice(-10);
    messagesSection = `\n## VORIGE SESSIE — LAATSTE BERICHTEN (vat samen in 1 zin voor de greeting)\n`;
    for (const msg of last10) {
      const role = msg.role === 'user' ? userName : companionName;
      messagesSection += `${role}: ${msg.content.slice(0, 200)}\n`;
    }
  }

  // Key figures section (persons, relationships, context from backpack)
  let keyFiguresSection = '';
  if (keyFigures) {
    keyFiguresSection = `\n## WIE IS ${userName.toUpperCase()}? (kernfiguren en context — gebruik als achtergrond)\n${keyFigures}\n`;
  }

  // Zone arc section
  const zoneSection = `\n## ZONE-BOOG (stuurt je toon en slotvraag)
- Startsignaal: ${zoneArc.startSignal}
- Eindsignaal vorige sessie: ${zoneArc.endSignal}
- Interpretatie: ${zoneArc.isHeavy
    ? 'ZWAAR — open voorzichtig, check hoe het nu gaat, bied ruimte. Slotvraag: specifiek op het onderwerp, bv "Hoe gaat het nu met [naam/situatie]?"'
    : 'STABIEL — warme open vraag die AANSLUIT op de vorige sessie. Verwijs naar het concrete onderwerp of de persoon die besproken werd. Geen generieke "Waar wil je het over hebben?"'
  }
- NOOIT de technische zone-term of kleur hardop noemen (geen "oranje", "zone", "VSP", "Eigen Regie").`;

  // Main prompt
  const prompt = `Je bent ${companionName}, een warme, persoonlijke AI-begeleider in de RecoFree app.
Je schrijft een opening voor een nieuwe sessie met ${userName}.

## INSTRUCTIES
1. Gebruik de brondata en de samenvatting van de vorige sessie om een persoonlijke, warme greeting te schrijven.
2. De greeting moet NATUURLIJK klinken — alsof een goede vriend/begeleider de draad oppakt.
3. Verwijs NOOIT letterlijk naar ruwe scores/getallen ("je stress was 7/10"). Vertaal naar menselijke taal.
4. GEBRUIK WEL de namen van personen uit de kernfiguren-sectie. Zeg "Ellen" of "Jules", NIET "een belangrijk persoon" of "iemand".
5. Eindig met een open vraag die SPECIFIEK aansluit op het onderwerp van de vorige sessie. NIET de generieke "Waar wil je het vandaag over hebben?" als je al een richting hebt voorgesteld.
6. Vrije lengte zolang het natuurlijk klinkt. Knip NOOIT af als dat halve informatie oplevert.
7. Als er weinig brondata is: houd het kort en warm, stel een open vraag.
8. Zelfde data → zelfde greeting. Geen kunstmatige variatie.
${keyFiguresSection}${sourceSection}${messagesSection}${zoneSection}

## TAAL
${langInstruction}
Schrijf de VOLLEDIGE greeting in deze taal. Als brondata in een andere taal is, vertaal naar de doeltaal.

## VERBODEN
- Geen emoji
- Geen technische termen (zone, VSP, slider, score, Eigen Regie)
- Geen derde persoon ("${userName} voelt zich...")
- Geen letterlijke citaten uit brondata
- Geen "Welkom terug" of "Goedemorgen/middag" tenzij het echt past bij het tijdstip`;

  return prompt;
}

function getLanguageInstruction(locale: string): string {
  switch (locale) {
    case 'nl': return 'Antwoord UITSLUITEND in het Nederlands.';
    case 'en': return 'Answer EXCLUSIVELY in English.';
    case 'fr': return 'Réponds EXCLUSIVEMENT en français.';
    default: return 'Antwoord UITSLUITEND in het Nederlands.';
  }
}

// ─── Proxy Call ─────────────────────────────────────────────────────────────

async function callGreetingProxy(
  apiBaseUrl: string,
  systemPrompt: string,
  userName: string,
  clinicalModeActive: boolean,
): Promise<string> {
  const url = `${apiBaseUrl}/api/session-greeting`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ systemPrompt, userName, clinicalModeActive }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Greeting proxy error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { success: boolean; greeting: string };
    if (!data.success || !data.greeting) {
      throw new Error('Invalid response from greeting proxy');
    }

    return data.greeting;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Deterministic Fallback ─────────────────────────────────────────────────

function buildDeterministicFallbackV4(
  userName: string,
  locale: string,
  sources: TimeBasedSource[],
  zoneArc: ZoneArc,
): string {
  // Build a natural second-person greeting without raw data
  const templates = getFallbackTemplates(locale);

  if (zoneArc.isHeavy) {
    // Heavy zone → careful opening
    return templates.heavy(userName);
  }

  // If we have a diary/mood source, reference it vaguely
  const hasDiary = sources.some(s => s.type === 'diary');
  const hasMood = sources.some(s => s.type === 'mood');

  if (hasDiary) {
    return templates.withDiary(userName);
  }
  if (hasMood) {
    return templates.withMood(userName);
  }

  // Generic warm opening
  return templates.generic(userName);
}

interface FallbackTemplates {
  heavy: (name: string) => string;
  withDiary: (name: string) => string;
  withMood: (name: string) => string;
  generic: (name: string) => string;
}

function getFallbackTemplates(locale: string): FallbackTemplates {
  switch (locale) {
    case 'en':
      return {
        heavy: (name) => `${name}, good to see you. I noticed things were heavier last time. How are you doing right now?`,
        withDiary: (name) => `Hey ${name}, good that you're here. I saw you wrote something recently. Would you like to pick up from there?`,
        withMood: (name) => `Hey ${name}, good to have you back. How are you feeling today?`,
        generic: (name) => `Hey ${name}, good that you're here. What would you like to talk about today?`,
      };
    case 'fr':
      return {
        heavy: (name) => `${name}, content de te voir. J'ai remarqué que c'était plus lourd la dernière fois. Comment tu vas maintenant?`,
        withDiary: (name) => `Hey ${name}, bien que tu sois là. J'ai vu que tu as écrit quelque chose récemment. Tu veux reprendre à partir de là?`,
        withMood: (name) => `Hey ${name}, content de te retrouver. Comment tu te sens aujourd'hui?`,
        generic: (name) => `Hey ${name}, bien que tu sois là. De quoi voudrais-tu parler aujourd'hui?`,
      };
    default: // nl
      return {
        heavy: (name) => `${name}, fijn dat je er bent. Ik merkte dat het vorige keer zwaarder was. Hoe gaat het nu met je?`,
        withDiary: (name) => `Hey ${name}, goed dat je er bent. Ik zag dat je recent iets hebt opgeschreven. Wil je daar verder over praten?`,
        withMood: (name) => `Hey ${name}, fijn je weer te zien. Hoe voel je je vandaag?`,
        generic: (name) => `Hey ${name}, goed dat je er bent. Waar wil je het vandaag over hebben?`,
      };
  }
}

// ─── Key Figures Builder ────────────────────────────────────────────────────

/**
 * Build a concise key figures summary from backpack data (persons, relationships,
 * relational anchors, and contextual info). This gives the greeting GPT awareness
 * of WHO the user is and who matters in their life.
 */
function buildKeyFigures(
  backpack: Backpack,
  userDat: UserDat,
  previousMessages?: Array<{ role: string; content: string }>,
): string | undefined {
  const lines: string[] = [];
  const knownNames = new Set<string>();

  // 1. Extracted entities (persons) from backpack analysis
  const entities = userDat.extractedEntities;
  if (entities?.persons && entities.persons.length > 0) {
    for (const person of entities.persons.slice(0, 8)) {
      let line = `- ${person.name}: ${person.relationshipNL || person.relationship}`;
      if (person.context) line += ` (${person.context.slice(0, 80)})`;
      lines.push(line);
      knownNames.add(person.name.toLowerCase());
    }
  }

  // 2. Relational anchors (from user.dat — may have persons not in extractedEntities)
  const anchors = userDat.relationalAnchors;
  if (anchors && anchors.length > 0) {
    for (const anchor of anchors) {
      if (!knownNames.has(anchor.name.toLowerCase())) {
        lines.push(`- ${anchor.name}: ${anchor.role}`);
        knownNames.add(anchor.name.toLowerCase());
      }
    }
  }

  // 3. Persons mentioned in previous session chat logs (not yet in extractedEntities/anchors)
  if (previousMessages && previousMessages.length > 0) {
    const chatPersons = extractPersonsFromChatLogs(previousMessages, knownNames);
    for (const cp of chatPersons) {
      lines.push(`- ${cp.name}: (genoemd in vorige sessie) ${cp.context}`);
      knownNames.add(cp.name.toLowerCase());
    }
  }

  // 4. Key context from backpack analysis (triggers, core beliefs)
  const analysis = userDat.backpackAnalysis;
  if (analysis) {
    if (analysis.triggers && analysis.triggers.length > 0) {
      lines.push(`- Triggers: ${analysis.triggers.slice(0, 4).join(', ')}`);
    }
  }

  // 5. Intake context (brief)
  if (backpack.intakeContext?.initialContext) {
    const ctx = backpack.intakeContext.initialContext.slice(0, 120);
    lines.push(`- Eerste context: ${ctx}`);
  }

  if (lines.length === 0) return undefined;
  return lines.join('\n');
}

// ─── Chat Log Person Extractor ──────────────────────────────────────────────

/**
 * Extract person names mentioned in chat logs that aren't already known.
 * Uses capitalized word detection (Dutch/English names start with uppercase).
 * Returns up to 4 new persons with surrounding context.
 */
function extractPersonsFromChatLogs(
  messages: Array<{ role: string; content: string }>,
  knownNames: Set<string>,
): Array<{ name: string; context: string }> {
  const found = new Map<string, string>(); // name → context snippet

  // Common Dutch/English words that look like names but aren't
  const skipWords = new Set([
    'ik', 'je', 'jij', 'hij', 'zij', 'we', 'wij', 'het', 'de', 'een', 'maar', 'ook',
    'dat', 'dit', 'die', 'wat', 'hoe', 'wel', 'niet', 'nog', 'dan', 'als', 'met',
    'voor', 'naar', 'van', 'bij', 'uit', 'aan', 'door', 'over', 'tot', 'kan',
    'elias', 'kim', 'recofree', 'recobase', 'hey', 'hoi', 'dag', 'ja', 'nee',
    'goed', 'fijn', 'oké', 'okay', 'thanks', 'dank', 'sorry',
    'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
    'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus',
    'september', 'oktober', 'november', 'december',
  ]);

  // Only scan user messages (assistant messages may echo names)
  const userMsgs = messages.filter(m => m.role === 'user');

  for (const msg of userMsgs) {
    // Match capitalized words that could be names (2+ chars, not common words)
    const namePattern = /(?:^|[,;!?]\s+|\s)([A-Z][a-z\u00e0-\u00ff]{1,15})(?=\s|[.,;!?]|$)/g;
    let match: RegExpExecArray | null;
    while ((match = namePattern.exec(msg.content)) !== null) {
      const candidate = match[1];
      const lower = candidate.toLowerCase();
      if (skipWords.has(lower)) continue;
      if (knownNames.has(lower)) continue;
      if (found.has(lower)) continue;

      // Extract surrounding context (up to 60 chars around the name)
      const idx = match.index;
      const start = Math.max(0, idx - 20);
      const end = Math.min(msg.content.length, idx + candidate.length + 40);
      const context = msg.content.slice(start, end).replace(/\n/g, ' ').trim();
      found.set(lower, context);

      if (found.size >= 4) break;
    }
    if (found.size >= 4) break;
  }

  return Array.from(found.entries()).map(([name, context]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    context,
  }));
}

// ─── Debug Log ──────────────────────────────────────────────────────────────

function buildDebugLog(
  persona: Persona,
  locale: string,
  sources: TimeBasedSource[],
  zoneArc: ZoneArc,
  usedFallback: boolean,
): string {
  const lines = [
    `[GreetingV4] persona=${persona}, locale=${locale}, fallback=${usedFallback}`,
    `  sources: ${sources.length} (${sources.map(s => s.type).join(', ') || 'none'})`,
    `  zone-arc: start="${zoneArc.startSignal}", end="${zoneArc.endSignal}", heavy=${zoneArc.isHeavy}`,
  ];
  return lines.join('\n');
}
