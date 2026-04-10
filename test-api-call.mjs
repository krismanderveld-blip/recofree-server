/**
 * Test script: simulates the exact fetch the OpenAI provider does
 * to verify if the server correctly receives backpack data.
 */
import superjson from 'superjson';

const API_URL = 'http://127.0.0.1:3000/api/trpc/ai.chat';

const testBackpack = {
  naam: 'Kris',
  userType: 'elias',
  lifeStory: [
    {
      id: 'childhood',
      label: 'Kindertijd',
      ageRange: '0-12',
      content: 'Ik ben opgegroeid in een klein dorp. Mijn moeder heette Anna. Mijn vader was vaak afwezig.',
    },
    {
      id: 'family',
      label: 'Gezin & Relaties',
      ageRange: 'heden',
      content: 'Jules is mijn zoon. Melissa is mijn vriendin. Zij steunen mij enorm.',
    },
  ],
  intakeContext: {
    startEmotion: 'onzeker',
    urgency: 'midden',
    initialContext: 'Ik wil werken aan mijn herstel',
    intakeDate: '2025-01-01T00:00:00.000Z',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
};

const testUserDat = {
  totalSessions: 3,
  triggerPatterns: [
    { trigger: 'eenzaamheid', count: 2, firstSeen: '2025-01-01', lastSeen: '2025-03-01' },
  ],
  moodHistory: [
    { sliders: { craving: 3, frustration: 5, despondency: 4, focus: 6 }, timestamp: '2025-03-01T10:00:00Z' },
  ],
  moduleUsageSummary: ['module_001'],
  lastSessionDate: '2025-03-01T10:00:00Z',
  sessionAnalyses: [],
};

const inputPayload = {
  userType: 'elias',
  userName: 'Kris',
  message: '',
  conversationHistory: [],
  moodSliders: { craving: 3, frustration: 5, despondency: 4, focus: 6 },
  activeModules: ['module_001'],
  crisisLevel: 0,
  detectedEmotion: 'onzeker',
  therapeuticStance: 'warm-supportive',
  sessionDurationMinutes: 0,
  urgency: 'midden',
  startEmotion: 'onzeker',
  isSessionStart: true,
  backpack: testBackpack,
  userDat: testUserDat,
  diaryEntries: [
    { content: 'Vandaag voelde ik me beter', moodTag: 'hoopvol', timestamp: '2025-03-01T08:00:00Z' },
  ],
};

// Method 1: Raw superjson (what the provider currently does)
console.log('=== METHOD 1: Raw superjson.serialize + JSON.stringify ===');
const serialized = superjson.serialize(inputPayload);
console.log('Serialized keys:', Object.keys(serialized));
console.log('Has json?', !!serialized.json);
console.log('Backpack in json?', !!(serialized.json && serialized.json.backpack));
if (serialized.json && serialized.json.backpack) {
  console.log('Backpack lifeStory count:', serialized.json.backpack.lifeStory?.length);
  console.log('Backpack naam:', serialized.json.backpack.naam);
}

try {
  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serialized),
  });
  console.log('Response status:', res1.status);
  const text1 = await res1.text();
  console.log('Response body (first 500 chars):', text1.slice(0, 500));
  
  if (res1.ok) {
    try {
      const data = JSON.parse(text1);
      if (data?.result?.data) {
        const result = superjson.deserialize(data.result.data);
        console.log('Deserialized result:', JSON.stringify(result, null, 2).slice(0, 500));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
} catch (e) {
  console.log('Fetch error:', e.message);
}

// Method 2: tRPC batch format (wrapped in "0")
console.log('\n=== METHOD 2: tRPC batch format {"0": superjson} ===');
const batchBody = { "0": serialized };

try {
  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchBody),
  });
  console.log('Response status:', res2.status);
  const text2 = await res2.text();
  console.log('Response body (first 500 chars):', text2.slice(0, 500));

  if (res2.ok) {
    try {
      const data = JSON.parse(text2);
      // tRPC batch response is an array
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.result?.data) {
        const result = superjson.deserialize(item.result.data);
        console.log('Deserialized result:', JSON.stringify(result, null, 2).slice(0, 500));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
} catch (e) {
  console.log('Fetch error:', e.message);
}
