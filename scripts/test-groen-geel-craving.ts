/**
 * Live test: GROEN + GEEL zones with craving data
 * Proves that personal data is used even at low-risk zones
 */

import { buildGreetingSynthesisPromptPayload } from '../lib/features/sessionGreeting/buildGreetingSynthesisPrompt';
import type { SelectedSynthesisSource } from '../lib/features/sessionGreeting/sessionGreetingV3.types';
import type { GreetingVspSectionSnapshot } from '../lib/features/sessionGreeting/sessionGreeting.types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('No OPENAI_API_KEY'); process.exit(1); }

async function callGPT(systemPrompt: string, userName: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      store: false,
      temperature: 0.7,
      max_tokens: 1590,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a personal greeting for ${userName}. Follow the language instruction in the system prompt exactly.` },
      ],
    }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── GROEN TEST ─────────────────────────────────────────────────────────────

async function testGroen() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST: GROEN zone — craving 3/10, stable mood');
  console.log('═══════════════════════════════════════════════════════════\n');

  const vspSection: GreetingVspSectionSnapshot = {
    currentZoneEntry: {
      signals: ['Ik voel me rustig', 'Ik heb geen trek', 'Ik slaap goed'],
      whatHelps: ['Yoga in de ochtend', 'Koken voor vrienden', 'Lezen voor het slapen'],
      anchorSentence: 'Ik verdien dit nieuwe leven',
    },
  };

  const sources: SelectedSynthesisSource[] = [
    { sourceType: 'TODAY_MOOD', safeAnchor: 'Craving: 3/10 (laag), Frustration: 2/10 (laag), Despondency: 1/10 (laag), Focus: 8/10 (hoog/positief)', relevanceScore: 0.8 },
    { sourceType: 'RECENT_DIARY', safeAnchor: 'Vandaag een goede dag gehad. Heb gekookt voor mijn buurvrouw Maria. Voelde me nuttig en verbonden. De avond was rustig, geen trek gehad.', relevanceScore: 0.7 },
    { sourceType: 'RECENT_GRATITUDE', safeAnchor: 'Dankbaar voor: 1) Mijn gezondheid 2) Het telefoontje met Anja gisteren 3) De zon vandaag', relevanceScore: 0.6 },
  ];

  const payload = buildGreetingSynthesisPromptPayload({
    userName: 'Marieke',
    vspZone: 'GROEN',
    selectedSources: sources,
    vspSection,
    mode: 'SYNTHESIS',
    absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0, absenceHoursExact: 0, lastSessionStartedAt: null, thresholdDays: 3, reason: 'recent' },
  });

  console.log('PROMPT (first 500 chars):');
  console.log(payload.synthesisInstruction.slice(0, 500));
  console.log('\n---\n');

  const greeting = await callGPT(payload.synthesisInstruction, 'Marieke');
  console.log('GPT GREETING (GROEN):');
  console.log(greeting);
  console.log('\n---\n');

  // Check: does it reference personal data?
  const checks = [
    { label: 'Noemt koken/buurvrouw Maria', pass: /kook|Maria|buurvrouw/i.test(greeting) },
    { label: 'Noemt Anja (zus)', pass: /Anja/i.test(greeting) },
    { label: 'Noemt yoga/lezen/vrienden', pass: /yoga|lezen|vrienden|koken/i.test(greeting) },
    { label: 'Noemt ankerzin of variant', pass: /verdien|nieuwe leven/i.test(greeting) },
    { label: 'Geen "hoe voel je je"', pass: !/hoe voel je je/i.test(greeting) },
    { label: 'Geen generiek advies', pass: !/neem contact op|zoek hulp|praat met iemand/i.test(greeting) },
  ];

  console.log('CHECKS:');
  let passed = 0;
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
    if (c.pass) passed++;
  }
  console.log(`\n  Score: ${passed}/${checks.length}`);
  return passed;
}

// ─── GEEL TEST ─────────────────────────────────────────────────────────────

async function testGeel() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST: GEEL zone — craving 5/10, elevated mood');
  console.log('═══════════════════════════════════════════════════════════\n');

  const vspSection: GreetingVspSectionSnapshot = {
    currentZoneEntry: {
      signals: ['Lichte onrust', 'Slechter slapen', 'Meer piekeren over geld'],
      whatHelps: ['Bellen met mijn zus Anja', 'Hardlopen in het Vondelpark', 'Journaling voor het slapen'],
      anchorSentence: 'Eén dag tegelijk, ik kan dit',
    },
  };

  const sources: SelectedSynthesisSource[] = [
    { sourceType: 'TODAY_MOOD', safeAnchor: 'Craving: 5/10 (verhoogd), Frustration: 4/10 (licht verhoogd), Despondency: 3/10 (normaal), Focus: 5/10 (gemiddeld)', relevanceScore: 0.85 },
    { sourceType: 'RECENT_DIARY', safeAnchor: 'Slecht geslapen vannacht. Lag te piekeren over de huur. Overdag wel even hardgelopen maar voelde me niet lekker. Avond was moeilijk, trek gehad maar niet toegegeven.', relevanceScore: 0.8 },
    { sourceType: 'RECENT_GRATITUDE', safeAnchor: 'Dankbaar voor: 1) Dat ik niet heb toegegeven aan de trek 2) Het rondje hardlopen 3) Mijn kat Pixel die naast me lag', relevanceScore: 0.6 },
  ];

  const payload = buildGreetingSynthesisPromptPayload({
    userName: 'Marieke',
    vspZone: 'GEEL',
    selectedSources: sources,
    vspSection,
    mode: 'SYNTHESIS',
    absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0, absenceHoursExact: 0, lastSessionStartedAt: null, thresholdDays: 3, reason: 'recent' },
  });

  console.log('PROMPT (first 500 chars):');
  console.log(payload.synthesisInstruction.slice(0, 500));
  console.log('\n---\n');

  const greeting = await callGPT(payload.synthesisInstruction, 'Marieke');
  console.log('GPT GREETING (GEEL):');
  console.log(greeting);
  console.log('\n---\n');

  // Check: does it reference personal data?
  const checks = [
    { label: 'Noemt craving/trek', pass: /craving|trek/i.test(greeting) },
    { label: 'Noemt hardlopen/Vondelpark', pass: /hardlop|Vondelpark|lopen/i.test(greeting) },
    { label: 'Noemt Anja (zus) of journaling', pass: /Anja|journal/i.test(greeting) },
    { label: 'Noemt slapen/piekeren/huur', pass: /sla[ap]|pieker|huur/i.test(greeting) },
    { label: 'Noemt kat Pixel of niet toegegeven', pass: /Pixel|niet toegegeven|weerstand/i.test(greeting) },
    { label: 'Noemt ankerzin of variant', pass: /één dag|eén dag|dag tegelijk|ik kan dit/i.test(greeting) },
    { label: 'Geen "hoe voel je je"', pass: !/hoe voel je je/i.test(greeting) },
    { label: 'Geen generiek advies', pass: !/neem contact op|zoek hulp|praat met iemand/i.test(greeting) },
  ];

  console.log('CHECKS:');
  let passed = 0;
  for (const c of checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
    if (c.pass) passed++;
  }
  console.log(`\n  Score: ${passed}/${checks.length}`);
  return passed;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main() {
  const groenScore = await testGroen();
  const geelScore = await testGeel();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`TOTAAL: GROEN ${groenScore}/6 | GEEL ${geelScore}/8`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
