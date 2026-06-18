/**
 * Live Diary Timestamp Test
 * 
 * Sends a SESSION_INIT with a diary entry timestamped YESTERDAY.
 * Validates that the GPT greeting uses "gisteren" (not "vandaag").
 */

import superjson from 'superjson';

const API_BASE = 'http://127.0.0.1:3000';

async function callChat(payload: any): Promise<any> {
  const serialized = superjson.serialize(payload);
  const url = `${API_BASE}/api/trpc/ai.chat`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serialized),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const data = await response.json();
  let result: any;
  if (data?.result?.data) {
    try {
      result = superjson.deserialize(data.result.data);
    } catch {
      result = data.result.data.json ?? data.result.data;
    }
  } else {
    result = data;
  }
  return result;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  DIARY TIMESTAMP TEST — Greeting must say "gisteren" for yesterday entry   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Create a timestamp for YESTERDAY (25 hours ago to be safe)
  const yesterdayTs = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  console.log(`Diary entry timestamp: ${yesterdayTs} (25 hours ago = YESTERDAY)`);
  console.log(`Current time: ${new Date().toISOString()}\n`);

  const payload = {
    userType: 'elias',
    userName: 'Kris',
    message: '',  // Empty for session start
    conversationHistory: [],
    moodSliders: { stress: 4, craving: 3, mood: 6, energy: 5 },
    isSessionStart: true,
    activeModules: ['E01'],
    crisisLevel: 0,
    isCrisis: false,
    detectedEmotion: 'neutral',
    therapeuticStance: 'supportive',
    sessionDurationMinutes: 1440, // Not a short return
    urgency: 'low',
    startEmotion: 'rustig',
    guidanceDepth: 'normal',
    dominantModule: 'E01',
    riskScore: 1,
    selectedTriggers: [],
    stageOfChange: 'action',
    backpack: {
      naam: 'Kris',
      userType: 'elias',
      lifeStory: [
        { id: '1', label: 'Kindertijd', ageRange: '0-12', content: 'Opgegroeid in Gent.' },
        { id: '2', label: 'Volwassenheid', ageRange: '18+', content: 'Werk als timmerman. Partner: Lies.' },
      ],
      intakeContext: {
        startEmotion: 'rustig',
        urgency: 'low',
        initialContext: 'Ik wil werken aan mijn herstel.',
        intakeDate: '2025-11-01',
      },
      createdAt: '2025-11-01T10:00:00Z',
    },
    // DIARY ENTRIES — one from YESTERDAY with a clear activity
    diaryEntries: [
      {
        content: 'Vandaag een fijne wandeling gemaakt in het park met Lies. De zon scheen en ik voelde me rustig.',
        moodTag: 'positief',
        timestamp: yesterdayTs,
      },
    ],
    userDat: {
      totalSessions: 5,
      triggerPatterns: [],
      moodHistory: [],
      moduleUsageSummary: [],
      lastSessionDate: yesterdayTs,
      sessionAnalyses: [],
    },
    backpackEmpty: false,
  };

  console.log('Sending SESSION_INIT with diary entry from yesterday...\n');
  const result = await callChat(payload);

  console.log('─'.repeat(80));
  console.log('FULL GPT GREETING RESPONSE:');
  console.log('─'.repeat(80));
  console.log(result?.response ?? '[NO RESPONSE]');
  console.log('─'.repeat(80));
  console.log(`\nModel: ${result?.selectedModel ?? 'N/A'}`);
  console.log(`Token usage: ${JSON.stringify(result?.tokenUsage ?? 'N/A')}`);

  // Analysis
  const response = (result?.response ?? '').toLowerCase();
  
  const checks = {
    'Uses "gisteren" when referencing the diary entry': /gisteren/.test(response),
    'Does NOT say "vandaag" for the diary content': !/vandaag.*wandeling|wandeling.*vandaag/.test(response),
    'References the walk/park content': /wandeling|park|zon/.test(response),
    'Addresses user by name (Kris)': /kris/i.test(response),
  };

  console.log('\nTIMESTAMP CHECKS:');
  let allPassed = true;
  for (const [label, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✅' : '❌'} ${label}`);
    if (!passed) allPassed = false;
  }

  // Extra check: does it contain "vandaag" at all? (mood sliders are today, so that's OK)
  if (/vandaag/.test(response)) {
    console.log(`\n  ℹ️  Note: Response contains "vandaag" — checking if it's only for mood sliders (acceptable):`);
    const vandaagContext = response.match(/.{0,40}vandaag.{0,40}/g);
    if (vandaagContext) {
      for (const ctx of vandaagContext) {
        const isDiaryRelated = /wandeling|park|zon|schreef/.test(ctx);
        console.log(`    ${isDiaryRelated ? '❌ DIARY-RELATED' : '✅ mood/generic'}: "...${ctx}..."`);
        if (isDiaryRelated) allPassed = false;
      }
    }
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`RESULT: ${allPassed ? '✅ TIMESTAMP FIX CONFIRMED — "gisteren" used correctly' : '❌ TIMESTAMP ISSUE PERSISTS'}`);
  console.log('═'.repeat(80));
}

main().catch(console.error);
