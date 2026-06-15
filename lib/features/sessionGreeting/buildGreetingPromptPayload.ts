/**
 * Builds the GPT prompt payload for greeting generation.
 * Max 800 tokens. Engine decides the anchor, GPT only formulates the greeting.
 */

import type { SelectedGreetingAnchor, GreetingUserDatSnapshot } from './sessionGreeting.types';

const MAX_GREETING_PROMPT_TOKENS = 800;

export interface GreetingPromptPayload {
  systemPrompt: string;
  estimatedTokens: number;
}

export function buildGreetingPromptPayload(
  anchor: SelectedGreetingAnchor,
  userDat: GreetingUserDatSnapshot | null,
): GreetingPromptPayload {
  const userName = userDat?.userName ?? 'daar';
  const anchorType = anchor.anchorType;
  const payload = anchor.payload ?? {};

  let anchorInstruction = '';

  switch (anchorType) {
    case 'FIRST_SESSION':
      anchorInstruction = `Dit is de allereerste sessie van ${userName}. Verwelkom hen warm en persoonlijk. Stel jezelf kort voor als Elias. Vraag hoe het met hen gaat en wat hen hier brengt. Houd het kort en uitnodigend.`;
      break;

    case 'CRISIS_OR_HIGH_CRAVING':
      anchorInstruction = `${userName} heeft aangegeven in crisis te zijn of hoge craving te ervaren (craving=${payload.craving ?? '?'}, zone=${payload.vspZone ?? '?'}). Begin direct met erkenning van hun moeilijke moment. Vraag wat ze nu nodig hebben. Wees kalm, niet alarmerend.`;
      break;

    case 'ACTIVE_PROJECTION_FEAR':
      anchorInstruction = `${userName} heeft een actieve angst: "${payload.fearLabel ?? '?'}". Refereer hier subtiel aan zonder het te benoemen als diagnose. Vraag hoe het vandaag met hen gaat in relatie tot dit thema. Wees voorzichtig en warm.`;
      break;

    case 'TODAY_MOOD_SLIDERS':
      anchorInstruction = `${userName} heeft vandaag hun stemming ingevuld. Opvallend: ${payload.notableMetric ?? '?'} = ${payload.notableValue ?? '?'}/10. Refereer hier kort aan. Vraag hoe ze zich nu voelen. Niet interpreteren, alleen erkennen.`;
      break;

    case 'RECENT_DIARY':
      anchorInstruction = `${userName} heeft recent een dagboeknotitie geschreven. Anker: "${payload.latestSafeAnchor ?? ''}". Refereer hier subtiel aan als opening. Vraag hoe het nu met hen gaat. Citeer niet letterlijk.`;
      break;

    case 'RECENT_GRATITUDE':
      anchorInstruction = `${userName} heeft recent iets in hun dankbaarheidsdagboek geschreven. Anker: "${payload.latestSafeAnchor ?? ''}". Gebruik dit als positieve opening. Vraag hoe het vandaag gaat. Wees warm.`;
      break;

    case 'BACKPACK_RECENT_UPDATE':
      anchorInstruction = `${userName} heeft recent hun rugzak bijgewerkt. Erken dat ze actief bezig zijn met hun verhaal. Vraag wat hen bezighoudt vandaag.`;
      break;

    case 'SCHEMA_ROTATION':
      anchorInstruction = `Thema voor deze sessie: schema "${payload.schemaName ?? '?'}". Open het gesprek met een zachte, niet-confronterende vraag die dit thema raakt. Benoem het schema NIET bij naam. Vraag hoe ${userName} zich vandaag voelt in relatie tot dit thema.`;
      break;

    case 'MISSING_DATA_INVITATION':
      anchorInstruction = buildMissingDataInstruction(userName, payload);
      break;

    default:
      anchorInstruction = `Begroet ${userName} warm en vraag hoe het met hen gaat.`;
  }

  const systemPrompt = buildSystemPromptForGreeting(userName, anchorInstruction);
  const estimatedTokens = Math.ceil(systemPrompt.length / 4);

  return { systemPrompt, estimatedTokens };
}

function buildMissingDataInstruction(userName: string, payload: Record<string, unknown>): string {
  const missing: string[] = [];
  if (payload.missingSlidersToday) missing.push('stemming invullen');
  if (payload.diaryOlderThan3Days) missing.push('dagboek bijwerken');
  if (payload.gratitudeOlderThan3Days) missing.push('dankbaarheidsdagboek');

  if (missing.length === 0) {
    return `Begroet ${userName} warm en vraag hoe het met hen gaat.`;
  }

  const suggestion = missing[0];
  return `Begroet ${userName} warm. Nodig hen subtiel uit om hun ${suggestion} bij te werken — niet dwingend, als zachte suggestie. Vraag eerst hoe het met hen gaat.`;
}

function buildSystemPromptForGreeting(userName: string, anchorInstruction: string): string {
  return `Je bent Elias, een warme en empathische therapeutische begeleider in de RecoFree app.

TAAK: Genereer een persoonlijke begroeting voor ${userName} bij het starten van een nieuwe sessie.

ANKER-INSTRUCTIE (door de engine bepaald — volg dit exact):
${anchorInstruction}

REGELS:
- Maximaal 3 zinnen
- Gebruik de naam "${userName}" in de eerste zin
- Toon: warm, persoonlijk, niet-oordelend
- Eindig met een open vraag
- Geen diagnose-taal, geen schema-namen, geen technische termen
- Schrijf in het Nederlands
- Geen emoji
- Geen "Welkom terug" als het de eerste sessie is

ANTI-FABRICATIE:
- Refereer ALLEEN aan informatie uit de anker-instructie
- Verzin NIETS over de gebruiker
- Als je twijfelt: stel een open vraag`;
}

/**
 * Validates and enforces output rules on the generated greeting.
 */
export function enforceGreetingOutputRules(
  rawGreeting: string,
  userName: string,
): { greeting: string; violations: string[] } {
  const violations: string[] = [];
  let greeting = rawGreeting.trim();

  // Remove markdown formatting
  greeting = greeting.replace(/[*_`#]/g, '');

  // Check max sentence count (roughly: split on . ! ?)
  const sentences = greeting.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 4) {
    violations.push(`Too many sentences: ${sentences.length} (max 3-4)`);
    // Truncate to first 3 sentences
    const truncated = greeting.match(/[^.!?]*[.!?]/g);
    if (truncated && truncated.length > 3) {
      greeting = truncated.slice(0, 3).join('').trim();
    }
  }

  // Check for userName presence
  if (!greeting.toLowerCase().includes(userName.toLowerCase())) {
    violations.push(`userName "${userName}" not found in greeting`);
  }

  // Check for emoji
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(greeting)) {
    violations.push('Contains emoji');
    greeting = greeting.replace(emojiRegex, '').trim();
  }

  // Check for schema names (should not appear)
  const schemaNames = ['verlating', 'instabiliteit', 'minderwaardigheid', 'wantrouwen', 'afhankelijkheid', 'mislukking', 'onderwerping', 'zelfopoffering', 'emotionele inhibitie', 'onverbiddelijke normen'];
  for (const name of schemaNames) {
    if (greeting.toLowerCase().includes(name)) {
      violations.push(`Contains schema name: "${name}"`);
    }
  }

  return { greeting, violations };
}
