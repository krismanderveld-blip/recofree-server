/**
 * Test: Add temporary logging to see the EXACT system prompt sent to GPT-4o.
 * We call the server's buildSystemPrompt indirectly by adding a console.log in ai-chat.ts.
 * Instead, let's just import and call generateAIResponse with logging.
 */
import superjson from 'superjson';

const API_URL = 'http://127.0.0.1:3000/api/trpc/ai.chat';

// Test with a specific question about Jules
const inputPayload = {
  userType: 'elias',
  userName: 'Kris',
  message: 'Wie is Jules?',
  conversationHistory: [
    { role: 'assistant', content: 'Hallo Kris, welkom terug.' },
  ],
  moodSliders: { craving: 3, frustration: 5, despondency: 4, focus: 6 },
  activeModules: ['module_001'],
  crisisLevel: 0,
  detectedEmotion: 'neutraal',
  therapeuticStance: 'warm-supportive',
  sessionDurationMinutes: 2,
  urgency: 'midden',
  startEmotion: 'onzeker',
  // Test 1: isSessionStart = true (backpack sent)
  isSessionStart: true,
  backpack: {
    naam: 'Kris',
    userType: 'elias',
    lifeStory: [
      {
        id: 'childhood',
        label: 'Kindertijd',
        ageRange: '0-12',
        content: 'Ik ben opgegroeid in een klein dorp bij mijn moeder Anna. Mijn vader was vaak afwezig door zijn werk.',
      },
      {
        id: 'family',
        label: 'Gezin & Relaties',
        ageRange: 'heden',
        content: 'Jules is mijn zoon. Hij is 8 jaar oud en het belangrijkste in mijn leven. Melissa is mijn vriendin. Zij steunt mij enorm in mijn herstel. Mijn zus heet Laura.',
      },
      {
        id: 'themes',
        label: 'Rode draden & themas',
        ageRange: 'doorlopend',
        content: 'Eenzaamheid is een terugkerend thema. Ik heb moeite met vertrouwen.',
      },
    ],
    intakeContext: {
      startEmotion: 'onzeker',
      urgency: 'midden',
      initialContext: 'Ik wil werken aan mijn herstel van alcoholverslaving',
      intakeDate: '2025-01-01T00:00:00.000Z',
    },
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  userDat: {
    totalSessions: 5,
    triggerPatterns: [
      { trigger: 'eenzaamheid', count: 4, firstSeen: '2025-01-15', lastSeen: '2025-03-01' },
      { trigger: 'conflict met collega', count: 2, firstSeen: '2025-02-01', lastSeen: '2025-03-15' },
    ],
    moodHistory: [
      { sliders: { craving: 3, frustration: 5, despondency: 4, focus: 6 }, timestamp: '2025-03-01T10:00:00Z' },
    ],
    moduleUsageSummary: ['module_001', 'module_005'],
    lastSessionDate: '2025-03-01T10:00:00Z',
    sessionAnalyses: [],
  },
};

console.log('=== TEST: Asking "Wie is Jules?" with full backpack ===');
const serialized = superjson.serialize(inputPayload);

try {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serialized),
  });
  console.log('Response status:', res.status);
  const text = await res.text();
  const data = JSON.parse(text);
  let result;
  if (data?.result?.data) {
    try {
      result = superjson.deserialize(data.result.data);
    } catch {
      result = data.result.data.json ?? data.result.data;
    }
  } else {
    result = data;
  }
  console.log('\n=== GPT-4o RESPONSE ===');
  console.log(result?.response);
  console.log('\nDoes it mention "zoon" (son)?', result?.response?.includes('zoon'));
  console.log('Does it mention "Jules"?', result?.response?.includes('Jules'));
} catch (e) {
  console.log('Error:', e.message);
}

// Test 2: isSessionStart = false (no backpack sent) — follow-up
console.log('\n\n=== TEST 2: Follow-up "Wie is Melissa?" WITHOUT backpack ===');
const followUpPayload = {
  ...inputPayload,
  message: 'Wie is Melissa?',
  isSessionStart: false,
  backpack: undefined,
  userDat: undefined,
  diaryEntries: undefined,
  conversationHistory: [
    { role: 'assistant', content: 'Hallo Kris, welkom terug.' },
    { role: 'user', content: 'Wie is Jules?' },
    { role: 'assistant', content: 'Jules is jouw zoon. Hij is 8 jaar oud.' },
  ],
};
delete followUpPayload.backpack;
delete followUpPayload.userDat;

const serialized2 = superjson.serialize(followUpPayload);
try {
  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serialized2),
  });
  const text2 = await res2.text();
  const data2 = JSON.parse(text2);
  let result2;
  if (data2?.result?.data) {
    try {
      result2 = superjson.deserialize(data2.result.data);
    } catch {
      result2 = data2.result.data.json ?? data2.result.data;
    }
  }
  console.log('\n=== GPT-4o RESPONSE (follow-up) ===');
  console.log(result2?.response);
  console.log('\nDoes it mention "vriendin"?', result2?.response?.includes('vriendin'));
} catch (e) {
  console.log('Error:', e.message);
}
