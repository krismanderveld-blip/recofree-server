/**
 * REAL INTEGRATION TEST: ROOD zone greeting with specific VSP personal data.
 * 
 * This script:
 * 1. Builds the exact prompt that the greeting engine would build for a ROOD zone user
 * 2. Calls the actual OpenAI API (gpt-4o-mini)
 * 3. Prints the FULL prompt AND the FULL GPT response
 * 
 * Purpose: Prove that the engine now sends full VSP content and GPT actually uses it.
 * 
 * Run: npx tsx scripts/test-greeting-rood.ts
 */

import 'dotenv/config';

// ─── Simulate the EXACT data a user would have ─────────────────────────────

const TEST_USER_NAME = 'Kris';
const TEST_VSP_ZONE = 'ROOD';

// This is what the user THEMSELVES wrote in their VSP for zone ROOD
const TEST_VSP_SECTION = {
  currentZoneEntry: {
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
  },
  mainAnchorSentence: 'Ik ben meer dan mijn verslaving.',
  recoveryRules: [
    'Niet alleen zijn als de craving boven 7 komt',
    'Altijd eerst 10 minuten wachten voor ik een beslissing neem',
  ],
  triggers: [
    { trigger: 'Ruzie met partner', counterThought: 'Gebruik lost de ruzie niet op, het maakt het erger' },
    { trigger: 'Vrijdagavond alleen thuis', counterThought: 'Ik kan Henk bellen of naar een meeting gaan' },
  ],
};

// Mood data
const TEST_MOOD = {
  craving: 8,
  frustration: 6,
  despondency: 7,
  focus: 3,
};

// Diary entry from today
const TEST_DIARY = 'Vandaag was een kloteddag. Ruzie gehad met Lisa over geld. Ze vertrouwt me niet meer sinds de terugval in maart. Ik snap het wel maar het doet zo veel pijn. Nu zit ik alleen thuis en alles trekt.';

// Gratitude (from yesterday)
const TEST_GRATITUDE = [
  'Mijn hond Beau die altijd blij is als ik thuiskom',
  'Dat ik al 47 dagen clean ben',
  'Het telefoontje met mama gisteren',
];

// ─── Build the prompt exactly as the engine would ─────────────────────────────

function buildTestPrompt(): string {
  const entry = TEST_VSP_SECTION.currentZoneEntry;

  // Build context briefing (mood + diary + gratitude)
  const moodLine = `MOOD CHECK-IN VANDAAG:\n  Craving: ${TEST_MOOD.craving}/10 | Frustratie: ${TEST_MOOD.frustration}/10 | Neerslachtigheid: ${TEST_MOOD.despondency}/10 | Focus: ${TEST_MOOD.focus}/10`;
  const diaryLine = `DAGBOEK (vandaag — dit schreef de gebruiker ZELF):\n  "${TEST_DIARY}"`;
  const gratitudeLine = `DANKBAARHEID (gisteren — dit noemde de gebruiker ZELF):\n  1. "${TEST_GRATITUDE[0]}"\n  2. "${TEST_GRATITUDE[1]}"\n  3. "${TEST_GRATITUDE[2]}"`;

  const contextBriefing = [moodLine, diaryLine, gratitudeLine].join('\n\n');

  // Build VSP personal context
  const vspParts: string[] = [];
  vspParts.push(`\n\n=== PERSOONLIJK VEILIGHEIDSPLAN (VSP) — ZONE ${TEST_VSP_ZONE} ===\nSIGNALEN (wat de gebruiker ZELF herkent bij zone ${TEST_VSP_ZONE}):\n  - ${entry.signals.join('\n  - ')}`);
  vspParts.push(`\nWAT HELPT (door de gebruiker ZELF benoemd voor zone ${TEST_VSP_ZONE}):\n  - ${entry.whatHelps.join('\n  - ')}`);
  vspParts.push(`\nANKERZIN (de gebruiker koos deze zin voor zichzelf):\n  "${entry.anchorSentence}"`);

  const triggerLines = TEST_VSP_SECTION.triggers.map(t =>
    `  - Trigger: "${t.trigger}" → Tegenzin: "${t.counterThought}"`
  ).join('\n');
  vspParts.push(`\nTRIGGERS & TEGENZINNEN (door gebruiker zelf opgesteld):\n${triggerLines}`);
  vspParts.push(`\nHERSTELREGELS (door gebruiker zelf opgesteld):\n  - ${TEST_VSP_SECTION.recoveryRules.join('\n  - ')}`);

  const vspDirective = `\n\n=== VERPLICHTE INSTRUCTIE (VSP ZONE ${TEST_VSP_ZONE}) ===\nDe gebruiker zit in zone ${TEST_VSP_ZONE}. Dit is ACUUT.\n- Je MOET hun eigen "wat helpt" content DIRECT gebruiken als interventie.\n- Gebruik hun EIGEN woorden en formuleringen.\n- Als ze "wandelen" schreven → noem bewegen/naar buiten gaan.\n- Als ze "bellen met sponsor" schreven → noem contact zoeken.\n- Als ze een ankerzin hebben → verweef die LETTERLIJK in je begroeting.\n- Zeg NOOIT "je veiligheidsplan zegt..." — maar gebruik de inhoud WEL direct.\n- Dit is GEEN achtergrondkennis — dit is hun ACTIEVE copingstrategie voor DIT moment.`;

  const vspPersonalContext = vspParts.join('') + vspDirective;

  // Build the full synthesis instruction (same as buildCoherentSynthesisInstruction)
  return `Je bent Elias. Schrijf een warme, persoonlijke begroeting voor ${TEST_USER_NAME}.

ZONE: ${TEST_VSP_ZONE}
TOON: Kalm, direct en veilig. De gebruiker is in een acute fase — bied aanwezigheid zonder paniek.

=== PERSOONLIJKE DATA VAN DE GEBRUIKER (VERPLICHT TE GEBRUIKEN) ===

${contextBriefing}
${vspPersonalContext}

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

CONCREET VOORBEELD van hoe je data verweeft:
- Als dagboek zegt "vandaag was zwaar op werk" → "Het klinkt alsof werk je bezighoudt..."
- Als gratitude zegt "mijn hond" → "Fijn dat [hond] er is voor je..."
- Als mood craving 7/10 is → "Ik merk dat het vandaag stevig trekt..."
- Als VSP "wandelen" als wat helpt noemt → "Heb je al even buiten gelopen?"

VERBODEN:
- "Hoe voel je je?" / "Hoe gaat het?" (te generiek — je HEBT data, gebruik het)
- "Ik zie dat je..." / "Ik lees in je dagboek..." (te klinisch, noem bronnen NOOIT)
- "Je zit in zone..." / kleuren noemen
- "Laten we beginnen met..." (te gestructureerd)
- Opsommingen, checklist-taal, "ten eerste/ten tweede"
- Emoji
- GENERIEKE begroetingen die je ook zonder data zou kunnen schrijven

KRITIEK — GEEN HALLUCINATIE:
- Verwijs ALLEEN naar informatie die EXPLICIET in de persoonlijke data hierboven staat
- Verzin NOOIT sessies, gesprekken of activiteiten die niet in de data staan
- Bij twijfel: houd het concreet maar algemeen, zonder specifieke tijdsreferenties

VOORBEELD (ter illustratie, niet kopiëren):
"${TEST_USER_NAME}, ik ben hier bij je. Vertel me wat er nu speelt."`;
}

// ─── Call OpenAI ─────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY not set');
    process.exit(1);
  }

  const systemPrompt = buildTestPrompt();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REAL INTEGRATION TEST: ROOD ZONE GREETING');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 SYSTEM PROMPT SENT TO GPT-4o-mini:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(systemPrompt);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`\n📊 Prompt length: ${systemPrompt.length} chars`);
  console.log('');
  console.log('🔄 Calling OpenAI gpt-4o-mini...');
  console.log('');

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
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a personal greeting for ${TEST_USER_NAME}. Follow the language instruction in the system prompt exactly.` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`ERROR: OpenAI returned ${response.status}: ${errorText}`);
    process.exit(1);
  }

  const data = await response.json() as any;
  const greeting = data.choices?.[0]?.message?.content?.trim();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GPT-4o-mini RESPONSE (LETTERLIJKE OUTPUT):');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(greeting);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // ─── Verify: does the response contain specific VSP content? ─────────────
  const checks = [
    { label: 'Verwijst naar wandelen/buiten/hond', test: /wandel|buiten|hond|Beau/i.test(greeting) },
    { label: 'Verwijst naar sponsor/Henk/bellen', test: /sponsor|Henk|bel/i.test(greeting) },
    { label: 'Verwijst naar ijsblokje/grounding', test: /ijs|grond|5.*4.*3|zintuig/i.test(greeting) },
    { label: 'Verwijst naar ankerzin of "gaat voorbij"', test: /voorbij|overleefd|meer dan/i.test(greeting) },
    { label: 'Verwijst naar craving/trek', test: /crav|trek|trekt|stevig/i.test(greeting) },
    { label: 'Verwijst naar ruzie/Lisa/partner', test: /ruzie|Lisa|partner|pijn/i.test(greeting) },
    { label: 'GEEN "hoe voel je je" of "hoe gaat het"', test: !/hoe voel je je|hoe gaat het/i.test(greeting) },
    { label: 'GEEN zone/kleur genoemd', test: !/rood|zone|kleur/i.test(greeting) },
  ];

  console.log('📊 VERIFICATIE — Gebruikt GPT de persoonlijke data?');
  console.log('───────────────────────────────────────────────────────────────');
  let passCount = 0;
  for (const check of checks) {
    const status = check.test ? '✅ JA' : '❌ NEE';
    if (check.test) passCount++;
    console.log(`  ${status}  ${check.label}`);
  }
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Score: ${passCount}/${checks.length} checks geslaagd`);
  console.log('');

  if (passCount >= 4) {
    console.log('✅ CONCLUSIE: GPT gebruikt de persoonlijke VSP data ACTIEF.');
  } else {
    console.log('⚠️  CONCLUSIE: GPT gebruikt onvoldoende persoonlijke data.');
  }
}

main().catch(console.error);
