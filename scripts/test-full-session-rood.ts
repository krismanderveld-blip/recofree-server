/**
 * FULL SESSION TEST: ROOD zone — TWO moments without data reduction.
 * 
 * Tests BOTH critical moments:
 * 1. GREETING: Full personal data → GPT generates personalized greeting
 * 2. FIRST RESPONSE: User replies → GPT makes engine decision using FULL VSP + personal data
 * 
 * Run: npx tsx scripts/test-full-session-rood.ts
 */

import 'dotenv/config';

const TEST_USER_NAME = 'Kris';
const TEST_VSP_ZONE = 'ROOD';

// ─── VSP data (user's own words) ─────────────────────────────────────────────
const VSP_ENTRY = {
  signals: [
    'Trillen in mijn handen',
    'Gedachten razen — ik kan niet stoppen met denken aan gebruik',
    'Ik voel me leeg en wil vluchten',
  ],
  whatHelps: [
    'Wandelen met de hond — minstens 20 minuten buiten',
    'Bellen met mijn sponsor Henk',
    'Ijsblokje in mijn hand houden tot het smelt',
    'De 5-4-3-2-1 grondingsoefening doen',
  ],
  anchorSentence: 'Dit gaat voorbij. Ik heb dit eerder overleefd en ik kan het weer.',
};

const RECOVERY_RULES = [
  'Niet alleen zijn als de craving boven 7 komt',
  'Altijd eerst 10 minuten wachten voor ik een beslissing neem',
];

const TRIGGERS = [
  { trigger: 'Ruzie met partner', counterThought: 'Gebruik lost de ruzie niet op, het maakt het erger' },
  { trigger: 'Vrijdagavond alleen thuis', counterThought: 'Ik kan Henk bellen of naar een meeting gaan' },
];

// ─── Mood + Diary + Gratitude ────────────────────────────────────────────────
const MOOD = { craving: 8, frustration: 6, despondency: 7, focus: 3 };
const DIARY = 'Vandaag was een kloteddag. Ruzie gehad met Lisa over geld. Ze vertrouwt me niet meer sinds de terugval in maart. Ik snap het wel maar het doet zo veel pijn. Nu zit ik alleen thuis en alles trekt.';
const GRATITUDE = [
  'Mijn hond Beau die altijd blij is als ik thuiskom',
  'Dat ik al 47 dagen clean ben',
  'Het telefoontje met mama gisteren',
];

// ─── Backpack / life story context ───────────────────────────────────────────
const LIFE_STORY_SUMMARY = `Kris (34M). Alcoholverslaving sinds 22e. Twee terugvallen (2021, maart 2024). Partner Lisa, relatie onder druk. Hond Beau is anker. Sponsor Henk (AA). Moeder is steunpilaar. Vader afwezig sinds scheiding (Kris was 12). Core wound: verlating. Schema: emotionele verwaarlozing. Stage: actie (47 dagen clean).`;

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

function buildVspBlock(): string {
  return `
═══ PERSOONLIJK VEILIGHEIDSPLAN (VSP) — ZONE ${TEST_VSP_ZONE} ═══

SIGNALEN (wat de gebruiker ZELF herkent bij zone ${TEST_VSP_ZONE}):
  - ${VSP_ENTRY.signals.join('\n  - ')}

WAT HELPT (door de gebruiker ZELF benoemd voor zone ${TEST_VSP_ZONE}):
  - ${VSP_ENTRY.whatHelps.join('\n  - ')}

ANKERZIN (de gebruiker koos deze zin voor zichzelf):
  "${VSP_ENTRY.anchorSentence}"

TRIGGERS & TEGENZINNEN (door gebruiker zelf opgesteld):
${TRIGGERS.map(t => `  - Trigger: "${t.trigger}" → Tegenzin: "${t.counterThought}"`).join('\n')}

HERSTELREGELS (door gebruiker zelf opgesteld):
  - ${RECOVERY_RULES.join('\n  - ')}

═══ VERPLICHTE INSTRUCTIE (VSP ZONE ${TEST_VSP_ZONE}) ═══
De gebruiker zit in zone ${TEST_VSP_ZONE}. Dit is ACUUT.
- Je MOET hun eigen "wat helpt" content DIRECT gebruiken als interventie.
- Gebruik hun EIGEN woorden en formuleringen.
- Als ze "wandelen" schreven → noem bewegen/naar buiten gaan.
- Als ze "bellen met sponsor" schreven → noem contact zoeken.
- Als ze een ankerzin hebben → verweef die LETTERLIJK in je begroeting.
- Zeg NOOIT "je veiligheidsplan zegt..." — maar gebruik de inhoud WEL direct.
- Dit is GEEN achtergrondkennis — dit is hun ACTIEVE copingstrategie voor DIT moment.
═══ EINDE VSP ═══`;
}

function buildGreetingPrompt(): string {
  return `Je bent Elias, een warme, persoonlijke begeleider voor ${TEST_USER_NAME}.

ZONE: ${TEST_VSP_ZONE}
TOON: Kalm, direct en veilig. De gebruiker is in een acute fase — bied aanwezigheid zonder paniek.

=== PERSOONLIJKE DATA VAN DE GEBRUIKER (VERPLICHT TE GEBRUIKEN) ===

MOOD CHECK-IN VANDAAG:
  Craving: ${MOOD.craving}/10 | Frustratie: ${MOOD.frustration}/10 | Neerslachtigheid: ${MOOD.despondency}/10 | Focus: ${MOOD.focus}/10

DAGBOEK (vandaag — dit schreef de gebruiker ZELF):
  "${DIARY}"

DANKBAARHEID (gisteren — dit noemde de gebruiker ZELF):
  1. "${GRATITUDE[0]}"
  2. "${GRATITUDE[1]}"
  3. "${GRATITUDE[2]}"

${buildVspBlock()}

LEVENSVERHAAL (compact):
${LIFE_STORY_SUMMARY}

=== EINDE PERSOONLIJKE DATA ===

KERNINSTRUCTIE:
Je MOET minstens één concreet element uit de bovenstaande persoonlijke data ACTIEF verwerken in je begroeting.
Dit is GEEN optionele context — dit is het DOEL van deze begroeting: de gebruiker laten voelen dat je HEN kent.

HOE:
- Verweef de persoonlijke data tot ÉÉN vloeiende, menselijke begroeting
- Gebruik MAXIMAAL 4-5 zinnen totaal
- Begin met een persoonlijke opening (gebruik de naam)
- Stel één concrete vraag over het nu-moment.
- De begroeting moet aanvoelen als een warm gesprek met iemand die je KENT
- De TOON moet passen bij zone ${TEST_VSP_ZONE}: rustig, aanwezig, en direct verwijzend naar hun copingstrategie

VERBODEN:
- "Hoe voel je je?" / "Hoe gaat het?" (te generiek — je HEBT data, gebruik het)
- "Ik zie dat je..." / "Ik lees in je dagboek..." (te klinisch, noem bronnen NOOIT)
- "Je zit in zone..." / kleuren noemen
- Opsommingen, checklist-taal
- Emoji
- GENERIEKE begroetingen die je ook zonder data zou kunnen schrijven`;
}

function buildFirstResponsePrompt(greeting: string): string {
  return `Je bent Elias, een warme, persoonlijke begeleider voor ${TEST_USER_NAME}.
Je hebt zojuist een begroeting gegeven en ${TEST_USER_NAME} heeft geantwoord.

=== VOLLEDIGE PERSOONLIJKE CONTEXT (VERPLICHT — GEEN REDUCTIE) ===

LEVENSVERHAAL:
${LIFE_STORY_SUMMARY}

MOOD CHECK-IN VANDAAG:
  Craving: ${MOOD.craving}/10 | Frustratie: ${MOOD.frustration}/10 | Neerslachtigheid: ${MOOD.despondency}/10 | Focus: ${MOOD.focus}/10

DAGBOEK (vandaag):
  "${DIARY}"

DANKBAARHEID (gisteren):
  1. "${GRATITUDE[0]}"
  2. "${GRATITUDE[1]}"
  3. "${GRATITUDE[2]}"

${buildVspBlock()}

CORE WOUND: Verlating (vader weg op 12-jarige leeftijd)
STAGE OF CHANGE: Actie (47 dagen clean)
RELATIONAL PATTERN: Vermijding bij conflict → isolatie → craving-escalatie

=== EINDE PERSOONLIJKE CONTEXT ===

=== VERPLICHTE INSTRUCTIE VOOR EERSTE RESPONS ===
Dit is de EERSTE respons na de begroeting. De gebruiker heeft net geantwoord.
Je MOET in je antwoord:
1. De VSP "wat helpt" content DIRECT als interventie aanbieden (niet als achtergrond)
2. Concreet verwijzen naar hun eigen copingstrategieën
3. De ankerzin verwerken als het past
4. Therapiekeuze baseren op de VOLLEDIGE context (niet alleen het bericht)
5. Module-keuze verantwoorden op basis van zone + triggers + levensverhaal

VERBODEN:
- Generieke adviezen die je ook zonder VSP zou geven
- "Heb je al aan je veiligheidsplan gedacht?" (te klinisch)
- Kleuren/zones noemen
- Opsommingen
=== EINDE INSTRUCTIE ===

CONVERSATIE:
Elias: "${greeting}"
${TEST_USER_NAME}: "Ja het gaat echt niet. Ik zit hier te trillen en kan alleen maar denken aan drinken. Lisa is weg en ik weet niet wat ik moet doen."

Geef nu je therapeutische respons. Maximaal 5-6 zinnen. Gebruik de persoonlijke data.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALL OPENAI
// ═══════════════════════════════════════════════════════════════════════════════

async function callGPT(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      store: false,
      temperature: 0.7,
      max_tokens: 350,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  FULL SESSION TEST: ROOD ZONE — BEIDE MOMENTEN              ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log('║  Moment 1: Greeting (alle data → GPT)                       ║');
  console.log('║  Moment 2: Eerste respons (alle data → GPT engine decision) ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ─── MOMENT 1: GREETING ─────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MOMENT 1: GREETING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔄 Calling GPT-4o-mini for greeting...');

  const greetingPrompt = buildGreetingPrompt();
  const greeting = await callGPT(greetingPrompt, `Generate a personal greeting for ${TEST_USER_NAME}. Follow all instructions exactly.`);

  console.log('');
  console.log('┌─── GPT GREETING OUTPUT ───────────────────────────────────────┐');
  console.log('');
  console.log(greeting);
  console.log('');
  console.log('└───────────────────────────────────────────────────────────────┘');
  console.log('');

  // Verify greeting
  const greetingChecks = [
    { label: 'Verwijst naar wandelen/buiten/hond/Beau', test: /wandel|buiten|hond|Beau/i.test(greeting) },
    { label: 'Verwijst naar craving/trek/trekt', test: /crav|trek|trekt|stevig/i.test(greeting) },
    { label: 'Verwijst naar ruzie/Lisa/partner/pijn', test: /ruzie|Lisa|partner|pijn/i.test(greeting) },
    { label: 'GEEN "hoe voel je je" / "hoe gaat het"', test: !/hoe voel je je|hoe gaat het/i.test(greeting) },
  ];

  console.log('📊 GREETING VERIFICATIE:');
  let g_pass = 0;
  for (const c of greetingChecks) {
    const ok = c.test ? '✅' : '❌';
    if (c.test) g_pass++;
    console.log(`  ${ok} ${c.label}`);
  }
  console.log(`  Score: ${g_pass}/${greetingChecks.length}`);
  console.log('');

  // ─── MOMENT 2: FIRST RESPONSE ──────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  MOMENT 2: EERSTE RESPONS NA GREETING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  User zegt: "Ja het gaat echt niet. Ik zit hier te trillen en kan`);
  console.log(`  alleen maar denken aan drinken. Lisa is weg en ik weet niet wat`);
  console.log(`  ik moet doen."`);
  console.log('');
  console.log('🔄 Calling GPT-4o-mini for first engine response...');

  const responsePrompt = buildFirstResponsePrompt(greeting);
  const firstResponse = await callGPT(responsePrompt, 'Respond therapeutically. Follow all instructions exactly.');

  console.log('');
  console.log('┌─── GPT FIRST RESPONSE OUTPUT ─────────────────────────────────┐');
  console.log('');
  console.log(firstResponse);
  console.log('');
  console.log('└───────────────────────────────────────────────────────────────┘');
  console.log('');

  // Verify first response uses VSP "wat helpt" content
  const responseChecks = [
    { label: 'Noemt wandelen/buiten/hond/Beau (VSP wat helpt)', test: /wandel|buiten|hond|Beau/i.test(firstResponse) },
    { label: 'Noemt sponsor/Henk/bellen (VSP wat helpt)', test: /sponsor|Henk|bel/i.test(firstResponse) },
    { label: 'Noemt ijsblokje/grounding (VSP wat helpt)', test: /ijs|grond|5.*4.*3|zintuig/i.test(firstResponse) },
    { label: 'Noemt ankerzin of "gaat voorbij"/"overleefd"', test: /voorbij|overleefd|meer dan mijn/i.test(firstResponse) },
    { label: 'Noemt 10 minuten wachten (herstelregel)', test: /10 minuten|wacht|even wachten/i.test(firstResponse) },
    { label: 'Verwijst naar trillen (signaal herkenning)', test: /tril/i.test(firstResponse) },
    { label: 'GEEN generiek "adem diep in" zonder VSP-basis', test: !/adem.*diep|deep.*breath/i.test(firstResponse) || /ijs|grond|wandel|Henk/i.test(firstResponse) },
    { label: 'GEEN "heb je aan je veiligheidsplan gedacht"', test: !/veiligheidsplan/i.test(firstResponse) },
  ];

  console.log('📊 EERSTE RESPONS VERIFICATIE — Gebruikt GPT de VSP "wat helpt"?');
  let r_pass = 0;
  for (const c of responseChecks) {
    const ok = c.test ? '✅' : '❌';
    if (c.test) r_pass++;
    console.log(`  ${ok} ${c.label}`);
  }
  console.log(`  Score: ${r_pass}/${responseChecks.length}`);
  console.log('');

  // ─── FINAL VERDICT ──────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  EINDOORDEEL');
  console.log('═══════════════════════════════════════════════════════════════════');
  const totalPass = g_pass + r_pass;
  const totalChecks = greetingChecks.length + responseChecks.length;
  console.log(`  Totaal: ${totalPass}/${totalChecks} checks geslaagd`);
  console.log('');
  if (g_pass >= 3 && r_pass >= 4) {
    console.log('  ✅ BEIDE MOMENTEN WERKEN: GPT gebruikt persoonlijke VSP data actief.');
    console.log('  ✅ De "wat helpt" content wordt als INTERVENTIE aangeboden, niet als achtergrond.');
  } else if (g_pass >= 3) {
    console.log('  ⚠️  Greeting werkt, maar eerste respons gebruikt onvoldoende VSP data.');
  } else if (r_pass >= 4) {
    console.log('  ⚠️  Eerste respons werkt, maar greeting is te generiek.');
  } else {
    console.log('  ❌ BEIDE MOMENTEN FALEN: GPT negeert de persoonlijke data.');
  }
  console.log('');
}

main().catch(console.error);
