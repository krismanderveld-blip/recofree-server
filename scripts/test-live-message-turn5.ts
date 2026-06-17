/**
 * LIVE TEST: Turn 5+ in conversation
 * Tests that GPT uses personal data (VSP wat-helpt, partner Melissa, diary)
 * even deep into the conversation, not just first 2 messages.
 * 
 * Simulates: user says "veel stress gehad vandaag" at turn 5
 * Expected: GPT references Melissa, specific VSP wat-helpt strategies, diary content
 */

// We test via direct GPT call simulating what the server builds
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set');
  process.exit(1);
}

// Simulate what the server builds for turn 5+
async function testTurn5LiveMessage() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  LIVE TEST: Turn 5+ — "veel stress gehad vandaag"');
  console.log('═══════════════════════════════════════════════════════\n');

  // This is what the server now builds for EVERY turn (not just first 2)
  const selectiveRelevanceBlock = `
═══ PERSOONLIJKE CONTEXT (VERPLICHT TE GEBRUIKEN) ═══
Deze data is door de gebruiker ZELF verstrekt. Je MOET het actief gebruiken in je antwoord.
Geef NOOIT generiek advies als je specifieke persoonlijke data hebt.
Noem ALTIJD namen, specifieke activiteiten, en concrete details uit deze context.
CORE WOUND: Ik ben niet goed genoeg
  → VERPLICHT: Wees je bewust van dit onderliggende patroon. Verwijs ernaar wanneer de gebruiker emotioneel beladen taal gebruikt.
RELEVANT CONTEXT UIT LEVENSVERHAAL:
  "Na de scheiding van mijn ex voelde ik me compleet verloren. Melissa heeft me daar doorheen geholpen."
  → VERPLICHT: Dit is persoonlijke context. Gebruik het ACTIEF in je antwoord — niet als achtergrond.
RELATIE-ANKER: Melissa (partner)
  → VERPLICHT: Noem deze persoon bij NAAM wanneer relevant. Dit is iemand die de gebruiker kent — gebruik het.
RELATIONEEL PATROON: Vermijding bij conflict
  Schema: Emotionele verwaarlozing
  → VERPLICHT: Noem dit patroon wanneer je het herkent in wat de gebruiker zegt.
STAGE: Voorbereiding — Overweegt verandering, zoekt informatie
DAGBOEK VAN DE GEBRUIKER (ZELF geschreven):
  [2026-06-16] (stressed): Vandaag weer ruzie gehad met mijn baas. Voelde me klein en machteloos. Melissa zei dat ik voor mezelf moet opkomen maar ik weet niet hoe.
  [2026-06-15] (anxious): Slecht geslapen, steeds maar piekeren over geld. De hypotheek is te hoog.
  → VERPLICHT: Refereer aan specifieke dagboek-inhoud wanneer de gebruiker over gerelateerde thema's praat.
RELATIEKAART:
  - Melissa: partner, steunend, woont samen
  - Baas (Jan): werkgever, bron van stress en conflict
  - Moeder: afstandelijk, weinig contact
  → VERPLICHT: Gebruik namen uit deze kaart wanneer je over relaties praat. Noem ALTIJD de specifieke naam, niet "je partner" of "iemand".
═══ EINDE PERSOONLIJKE CONTEXT ═══`;

  const vspStructuredSection = `
=== PERSOONLIJK VEILIGHEIDSPLAN (door de gebruiker ZELF geschreven) ===
=== VERPLICHTE INSTRUCTIE (ZONE GEEL) ===
Hieronder staat het PERSOONLIJK veiligheidsplan van de gebruiker — door HEN ZELF geschreven.
Je MOET deze content ACTIEF gebruiken in je antwoorden:
- Refereer aan hun signalen als je patronen herkent in wat ze zeggen.
- Verwijs naar hun "wat helpt" als je een suggestie doet.
- Gebruik hun ankerzin als grondingstechniek wanneer passend.
- Zeg NOOIT "je veiligheidsplan zegt..." — verweef het NATUURLIJK.
- Dit is GEEN achtergrondkennis — dit is hun ACTIEVE zelfhulp-strategie.

ZONE GEEL — Signalen: piekeren, slecht slapen, prikkelbaar, terugtrekken
Wat helpt: hardlopen in het park, ademhalingsoefening 4-7-8, bellen met Melissa, journaling voor het slapen
Ankerzin: "Ik mag er zijn, ook als het moeilijk is"
=== EINDE PERSOONLIJK VEILIGHEIDSPLAN ===`;

  // Build the full system prompt as the server would
  const systemPrompt = `Je bent Elias, een empathische AI-begeleider voor herstel en persoonlijke groei.
Je kent deze gebruiker. Gebruik hun persoonlijke context ACTIEF.

De gebruiker heet Kris. Spreek hem bij naam aan.

${selectiveRelevanceBlock}

${vspStructuredSection}

=== MANDATORY BEHAVIORAL INSTRUCTIONS ===
These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: stress=8, craving=3, frustration=7, despondency=5
- Safety Plan Zone: GEEL ⚠️ ELEVATED RISK
- Urgency level: medium
- Risk score: 4/10

RESPONSE RULES:
- You KNOW Kris. Use the context above to inform your response.
- BUT: refer ONLY to what you ACTUALLY know. Fabricate NOTHING.
- NAAM-REGEL (ABSOLUUT): Spreek Kris ALTIJD bij naam aan in ELKE respons. Niet "je" of "jij" als eerste aanspreking — begin met hun naam of gebruik hun naam minstens 1x per antwoord.
- VSP-STRATEGIE-REGEL (ABSOLUUT): Als er een VSP/veiligheidsplan hierboven staat, MOET je in ELKE respons minstens 1 specifieke strategie uit "wat helpt" noemen wanneer de gebruiker emotioneel beladen taal gebruikt (stress, craving, angst, boosheid, verdriet, overweldiging). Noem de strategie CONCREET (bv. "hardlopen in het park", "bellen met Melissa", "ademhaling 4-7-8") — NOOIT generiek ("een wandeling" of "even ademen").
- ANKERZIN-REGEL (ABSOLUUT): Als er een ankerzin in het VSP staat EN de gebruiker is overweldigd, in paniek, of zegt "ik weet niet meer wat ik moet doen" / "ik kan niet meer" / "het is te veel" → CITEER de ankerzin LETTERLIJK in je antwoord. Verweef het natuurlijk, bv: "Weet je nog wat je zelf hebt opgeschreven? '[ankerzin]'. Dat geldt nu ook."
- DAGBOEK-REGEL (ABSOLUUT): Als er dagboek-entries hierboven staan EN het huidige gespreksthema overlapt met een dagboek-entry (bv. werk/baas, relatie, slaap, geld) → VERWIJS expliciet naar die specifieke entry. Bv: "Je schreef gisteren dat [concrete inhoud uit dagboek]. Herken je dat nu ook?" Nooit generiek verwijzen ("je dagboek") — altijd de INHOUD citeren.
- STEUNPERSOON-REGEL (ABSOLUUT): Als er een steunpersoon staat in het VSP "wat helpt" (bv. "bellen met Melissa") EN de gebruiker emotioneel beladen taal gebruikt → NOEM die steunpersoon bij NAAM als concrete optie. Bv: "Heb je al overwogen om Melissa te bellen? Zij staat in je plan als iemand die helpt."
- Respond in Dutch
- Keep responses concise (3-6 sentences)
- Never diagnose, never prescribe
- Do NOT use bullet points — speak naturally
- Be genuine, not performative`;

  // Simulate conversation history (turns 1-4 already happened)
  const conversationHistory = [
    { role: 'assistant', content: 'Hey Kris, welkom terug. Ik zie dat je stress hoog staat vandaag. Hoe is het met je?' },
    { role: 'user', content: 'Gaat wel, beetje druk op werk' },
    { role: 'assistant', content: 'Dat klinkt als een volle dag. Werk kan soms veel energie kosten. Wat speelt er het meest?' },
    { role: 'user', content: 'Mijn baas weer, altijd hetzelfde' },
    { role: 'assistant', content: 'Jan weer... Ik weet dat die situatie je raakt. Je schreef er gisteren ook over in je dagboek. Wat gebeurde er vandaag?' },
    { role: 'user', content: 'Hij deed weer neerbuigend, voor de hele afdeling. Ik zei niks.' },
    { role: 'assistant', content: 'Dat klinkt pijnlijk, Kris. Voor de hele afdeling — dat raakt aan dat gevoel van klein gemaakt worden. Hoe voel je je nu?' },
    // Turn 5 — the test message:
    { role: 'user', content: 'Veel stress gehad vandaag. Ik weet niet meer wat ik moet doen.' },
  ];

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  console.log('Calling GPT-4o-mini with turn 5 message: "Veel stress gehad vandaag. Ik weet niet meer wat ik moet doen."');
  console.log('Expected: References Melissa, hardlopen, ademhaling, Jan/baas, dagboek, ankerzin\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const gptResponse = data.choices?.[0]?.message?.content ?? 'NO RESPONSE';

  console.log('═══ GPT RESPONSE (Turn 5) ═══');
  console.log(gptResponse);
  console.log('═══ END RESPONSE ═══\n');

  // Validation checks
  const checks = [
    { name: 'Noemt Melissa bij naam', pass: /melissa/i.test(gptResponse) },
    { name: 'Noemt Jan/baas', pass: /jan|baas/i.test(gptResponse) },
    { name: 'Noemt hardlopen OF ademhaling OF journaling', pass: /hardlop|ademhal|4-7-8|journal/i.test(gptResponse) },
    { name: 'Noemt ankerzin of variant', pass: /mag er zijn|moeilijk/i.test(gptResponse) },
    { name: 'Referentie naar dagboek/gisteren', pass: /dagboek|gisteren|schreef|opkomen/i.test(gptResponse) },
    { name: 'Geen generiek advies (wandeling/ademen zonder context)', pass: !/een wandeling|even ademen|probeer te ontspannen/i.test(gptResponse) || /hardlop|ademhal|4-7-8/i.test(gptResponse) },
    { name: 'Noemt naam Kris', pass: /kris/i.test(gptResponse) },
    { name: 'Geen "hoe voel je je" als afsluiter', pass: !/hoe voel je je\??$/i.test(gptResponse.trim()) },
  ];

  console.log('VALIDATIE:');
  let passed = 0;
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌';
    console.log(`  ${icon} ${c.name}`);
    if (c.pass) passed++;
  }
  console.log(`\nScore: ${passed}/${checks.length}`);

  // ═══ TEST 2: Relatie-context test ═══
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  LIVE TEST 2: Turn 5+ — relatie-context (Melissa)');
  console.log('═══════════════════════════════════════════════════════\n');

  const messages2 = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'assistant' as const, content: 'Hey Kris, welkom terug. Hoe gaat het met je vandaag?' },
    { role: 'user' as const, content: 'Het gaat niet zo lekker' },
    { role: 'assistant' as const, content: 'Dat hoor ik, Kris. Wil je vertellen wat er speelt?' },
    { role: 'user' as const, content: 'Ruzie gehad thuis' },
    { role: 'assistant' as const, content: 'Ruzie thuis raakt altijd diep. Met wie had je ruzie?' },
    { role: 'user' as const, content: 'Met mijn partner. Ze begrijpt niet wat ik doormaak.' },
  ];

  console.log('Calling GPT-4o-mini: "Met mijn partner. Ze begrijpt niet wat ik doormaak."');
  console.log('Expected: GPT MUST name Melissa (not "je partner"), reference the relational pattern\n');

  const response2 = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages2,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  const data2 = await response2.json();
  const gptResponse2 = data2.choices?.[0]?.message?.content ?? 'NO RESPONSE';

  console.log('═══ GPT RESPONSE (Relatie-context) ═══');
  console.log(gptResponse2);
  console.log('═══ END RESPONSE ═══\n');

  const checks2 = [
    { name: 'Noemt Melissa bij naam (niet "je partner")', pass: /melissa/i.test(gptResponse2) },
    { name: 'Referentie naar vermijdingspatroon', pass: /vermijd|conflict|terugtrek|opkomen/i.test(gptResponse2) },
    { name: 'Geen generiek "dat klinkt moeilijk" zonder context', pass: !/dat klinkt moeilijk|dat is zwaar/i.test(gptResponse2) || /melissa|vermijd|dagboek/i.test(gptResponse2) },
    { name: 'Noemt naam Kris', pass: /kris/i.test(gptResponse2) },
    { name: 'Referentie naar dagboek (Melissa zei opkomen)', pass: /opkomen|voor jezelf|dagboek|melissa.*zei/i.test(gptResponse2) },
  ];

  console.log('VALIDATIE:');
  let passed2 = 0;
  for (const c of checks2) {
    const icon = c.pass ? '✅' : '❌';
    console.log(`  ${icon} ${c.name}`);
    if (c.pass) passed2++;
  }
  console.log(`\nScore: ${passed2}/${checks2.length}`);

  console.log(`\n\n═══ TOTAAL: Test 1: ${passed}/${checks.length}, Test 2: ${passed2}/${checks2.length} ═══`);
}

testTurn5LiveMessage().catch(console.error);
