/**
 * Live End-to-End Test Script
 * 
 * Calls the actual server tRPC endpoint (ai.chat) with:
 * 1. Elias SESSION_INIT + LIVE_MESSAGE with WILSKRACHT01 trigger
 * 2. Kim SESSION_INIT + LIVE_MESSAGE with BEHE-K01 trigger
 * 
 * Reports full GPT responses and context usage.
 */

import superjson from 'superjson';

const API_BASE = 'http://127.0.0.1:3000';

interface ChatPayload {
  userType: 'elias' | 'kim';
  userName: string;
  message: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  moodSliders: Record<string, number>;
  isSessionStart: boolean;
  activeModules: string[];
  crisisLevel: number;
  isCrisis?: boolean;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;
  guidanceDepth?: 'light' | 'normal' | 'deep';
  dominantModule?: string;
  riskScore?: number;
  selectedTriggers?: Array<{ trigger: string; score: number }>;
  bufferSnapshot?: any;
  psychoEducationContext?: string | null;
  steunpilarenContext?: string | null;
  selfAcceptanceContext?: string | null;
  kimPatternSupportContext?: string | null;
  // SESSION_INIT fields
  backpack?: any;
  userDat?: any;
  stageOfChange?: string;
  [key: string]: any;
}

async function callChat(payload: ChatPayload): Promise<any> {
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

async function testElias() {
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 1: ELIAS — WILSKRACHT01 TRIGGER');
  console.log('═'.repeat(80));
  console.log('Message: "ik had sterker moeten zijn, ik heb weer gefaald."');
  console.log('Expected: paard/ruiter metaphor, fast impulse vs slow control, no blame\n');

  // Step 1: SESSION_INIT
  console.log('[1/2] Sending SESSION_INIT...');
  const sessionInitPayload: ChatPayload = {
    userType: 'elias',
    userName: 'Kris',
    message: 'ik had sterker moeten zijn, ik heb weer gefaald.',
    conversationHistory: [],
    moodSliders: { stress: 7, craving: 6, mood: 3, energy: 3 },
    isSessionStart: true,
    activeModules: ['WILSKRACHT01'],
    crisisLevel: 0,
    isCrisis: false,
    detectedEmotion: 'shame',
    therapeuticStance: 'validating',
    sessionDurationMinutes: 0,
    urgency: 'medium',
    startEmotion: 'schaamte',
    guidanceDepth: 'normal',
    dominantModule: 'WILSKRACHT01',
    riskScore: 3,
    selectedTriggers: [{ trigger: 'self-blame', score: 0.9 }],
    stageOfChange: 'action',
    // Psycho-education context from pipeline (simulating what the pipeline would produce)
    psychoEducationContext: '[PSYCHO-EDUCATIE WILSKRACHT01] mode=FULL_EXPLANATION confidence=0.92 markers=[sterker moeten zijn,gefaald]',
    // Minimal backpack for SESSION_INIT
    backpack: {
      naam: 'Kris',
      userType: 'elias',
      lifeStory: [
        { id: '1', label: 'Kindertijd', ageRange: '0-12', content: 'Opgegroeid in Antwerpen, vader dronk veel.' },
        { id: '2', label: 'Adolescentie', ageRange: '12-18', content: 'Eerste gebruik op 15. Vrienden die ook gebruikten.' },
        { id: '3', label: 'Volwassenheid', ageRange: '18+', content: 'Relatie met Melissa. Twee kinderen. Werk als loodgieter. Sponsor Henk.' },
      ],
      intakeContext: {
        startEmotion: 'schaamte',
        urgency: 'medium',
        initialContext: 'Ik heb weer gedronken na 3 maanden clean. Ik voel me waardeloos.',
        intakeDate: '2025-12-01',
      },
      createdAt: '2025-12-01T10:00:00Z',
    },
    userDat: {
      totalSessions: 8,
      triggerPatterns: [
        { trigger: 'werkstress', count: 4, firstSeen: '2025-12-05', lastSeen: '2026-01-10' },
        { trigger: 'ruzie met Melissa', count: 3, firstSeen: '2025-12-08', lastSeen: '2026-01-05' },
      ],
      moodHistory: [
        { sliders: { stress: 7, craving: 6, mood: 3, energy: 3 }, timestamp: '2026-01-15T10:00:00Z' },
      ],
      moduleUsageSummary: ['WILSKRACHT01', 'AUTOPILOT01'],
      lastSessionDate: '2026-01-10',
      sessionAnalyses: [],
    },
    bufferSnapshot: {
      zone: 'GEEL',
      emotionalDirection: 'declining',
      liveIntent: 'self-blame processing',
      dominantState: 'shame-guilt',
    },
  };

  const sessionResult = await callChat(sessionInitPayload);
  console.log('[SESSION_INIT] Response received.');
  console.log(`[SESSION_INIT] Token usage: ${JSON.stringify(sessionResult?.tokenUsage ?? 'N/A')}`);

  // Step 2: LIVE_MESSAGE (follow-up turn simulating the actual trigger)
  console.log('\n[2/2] Sending LIVE_MESSAGE with WILSKRACHT01 context...');
  const livePayload: ChatPayload = {
    userType: 'elias',
    userName: 'Kris',
    message: 'ik had sterker moeten zijn, ik heb weer gefaald.',
    conversationHistory: [
      { role: 'assistant', content: sessionResult?.response ?? 'Hoi Kris, fijn dat je er bent.' },
      { role: 'user', content: 'ik had sterker moeten zijn, ik heb weer gefaald.' },
    ],
    moodSliders: { stress: 7, craving: 6, mood: 3, energy: 3 },
    isSessionStart: false,
    activeModules: ['WILSKRACHT01'],
    crisisLevel: 0,
    isCrisis: false,
    detectedEmotion: 'shame',
    therapeuticStance: 'validating',
    sessionDurationMinutes: 2,
    urgency: 'medium',
    startEmotion: 'schaamte',
    guidanceDepth: 'normal',
    dominantModule: 'WILSKRACHT01',
    riskScore: 3,
    selectedTriggers: [{ trigger: 'self-blame', score: 0.9 }],
    // PsychoEducation context — this is the key field
    psychoEducationContext: '[PSYCHO-EDUCATIE WILSKRACHT01] mode=FULL_EXPLANATION confidence=0.92 markers=[sterker moeten zijn,gefaald] continuity=active',
    bufferSnapshot: {
      zone: 'GEEL',
      emotionalDirection: 'declining',
      liveIntent: 'self-blame processing',
      dominantState: 'shame-guilt',
    },
  };

  const liveResult = await callChat(livePayload);

  console.log('\n' + '─'.repeat(80));
  console.log('FULL GPT RESPONSE (ELIAS — WILSKRACHT01):');
  console.log('─'.repeat(80));
  console.log(liveResult?.response ?? '[NO RESPONSE]');
  console.log('─'.repeat(80));
  console.log(`Token usage: ${JSON.stringify(liveResult?.tokenUsage ?? 'N/A')}`);
  console.log(`Model: ${liveResult?.selectedModel ?? 'N/A'}`);

  // Analysis
  const response = (liveResult?.response ?? '').toLowerCase();
  const checks = {
    'Contains impulse/fast system language': /impuls|snel|automatisch|fast|quick|reflex/.test(response),
    'Contains control/slow system language': /controle|bewust|langzaam|nadenken|slow|rider|ruiter/.test(response),
    'No blame/shame reinforcement': !/zwak|waardeloos|falen|schuld.*jouw|je bent.*slecht/.test(response),
    'Offers earlier-signal step': /signaal|eerder|moment.*voor|eerste.*teken|herken/.test(response),
    'Addresses user by name (Kris)': /kris/i.test(response),
    'No diagnosis language': !/diagnos|stoornis|dsm|patholog/.test(response),
  };

  console.log('\nCHECKS:');
  let allPassed = true;
  for (const [label, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✅' : '❌'} ${label}`);
    if (!passed) allPassed = false;
  }
  console.log(`\nOVERALL: ${allPassed ? '✅ ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'}`);

  return { response: liveResult?.response, checks, allPassed };
}

async function testKim() {
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 2: KIM — BEHE-K01 TRIGGER');
  console.log('═'.repeat(80));
  console.log('Message: "ik controleer alles, ik ben moe van het controleren."');
  console.log('Expected: acknowledges control as coping, explores cost, no blame\n');

  // Step 1: SESSION_INIT
  console.log('[1/2] Sending SESSION_INIT...');
  const sessionInitPayload: ChatPayload = {
    userType: 'kim',
    userName: 'Anja',
    message: 'ik controleer alles, ik ben moe van het controleren.',
    conversationHistory: [],
    moodSliders: { stress: 8, worry: 7, mood: 3, energy: 2 },
    isSessionStart: true,
    activeModules: ['BEHE-K01'],
    crisisLevel: 0,
    isCrisis: false,
    detectedEmotion: 'exhaustion',
    therapeuticStance: 'validating',
    sessionDurationMinutes: 0,
    urgency: 'medium',
    startEmotion: 'uitputting',
    guidanceDepth: 'normal',
    dominantModule: 'BEHE-K01',
    riskScore: 2,
    selectedTriggers: [{ trigger: 'control-exhaustion', score: 0.88 }],
    // Kim pattern support context from pipeline
    kimPatternSupportContext: '[KIM_PATTERN_SUPPORT BEHE-K01] intervention=NAMING_WITHOUT_BLAME confidence=0.88 markers=[controleer alles,moe van het controleren]',
    // Minimal backpack for SESSION_INIT
    backpack: {
      naam: 'Anja',
      userType: 'kim',
      lifeStory: [],
      kimBackpack: {
        my_story: 'Mijn man Jan drinkt al 5 jaar. Ik probeer alles onder controle te houden voor de kinderen.',
        the_relationship: 'We zijn 12 jaar samen. Twee kinderen: Lotte (8) en Tim (5).',
        the_impact: 'Ik slaap slecht, controleer zijn telefoon, ruik aan zijn adem als hij thuiskomt.',
        my_boundaries: 'Ik heb gezegd dat als hij weer drinkt, ik wegga. Maar ik doe het nooit.',
        my_strength: 'Ik ben sterk voor de kinderen. Ik werk fulltime en houd alles draaiende.',
      },
      intakeContext: {
        startEmotion: 'uitputting',
        urgency: 'medium',
        initialContext: 'Ik ben moe van het controleren. Ik check alles maar het helpt niet.',
        intakeDate: '2026-01-01',
      },
      createdAt: '2026-01-01T10:00:00Z',
    },
    userDat: {
      totalSessions: 5,
      triggerPatterns: [
        { trigger: 'controlegedrag', count: 3, firstSeen: '2026-01-02', lastSeen: '2026-01-12' },
      ],
      moodHistory: [
        { sliders: { stress: 8, worry: 7, mood: 3, energy: 2 }, timestamp: '2026-01-15T10:00:00Z' },
      ],
      moduleUsageSummary: ['BEHE-K01'],
      lastSessionDate: '2026-01-12',
      sessionAnalyses: [],
    },
    bufferSnapshot: {
      zone: 'ORANJE',
      emotionalDirection: 'stable-low',
      liveIntent: 'control-exhaustion processing',
      dominantState: 'caregiver-burnout',
    },
  };

  const sessionResult = await callChat(sessionInitPayload);
  console.log('[SESSION_INIT] Response received.');
  console.log(`[SESSION_INIT] Token usage: ${JSON.stringify(sessionResult?.tokenUsage ?? 'N/A')}`);

  // Step 2: LIVE_MESSAGE
  console.log('\n[2/2] Sending LIVE_MESSAGE with BEHE-K01 context...');
  const livePayload: ChatPayload = {
    userType: 'kim',
    userName: 'Anja',
    message: 'ik controleer alles, ik ben moe van het controleren.',
    conversationHistory: [
      { role: 'assistant', content: sessionResult?.response ?? 'Hoi Anja, fijn dat je er bent.' },
      { role: 'user', content: 'ik controleer alles, ik ben moe van het controleren.' },
    ],
    moodSliders: { stress: 8, worry: 7, mood: 3, energy: 2 },
    isSessionStart: false,
    activeModules: ['BEHE-K01'],
    crisisLevel: 0,
    isCrisis: false,
    detectedEmotion: 'exhaustion',
    therapeuticStance: 'validating',
    sessionDurationMinutes: 2,
    urgency: 'medium',
    startEmotion: 'uitputting',
    guidanceDepth: 'normal',
    dominantModule: 'BEHE-K01',
    riskScore: 2,
    selectedTriggers: [{ trigger: 'control-exhaustion', score: 0.88 }],
    // Kim pattern support context — this is the key field
    kimPatternSupportContext: '[KIM_PATTERN_SUPPORT BEHE-K01] intervention=NAMING_WITHOUT_BLAME confidence=0.88 markers=[controleer alles,moe van het controleren] continuity=active',
    bufferSnapshot: {
      zone: 'ORANJE',
      emotionalDirection: 'stable-low',
      liveIntent: 'control-exhaustion processing',
      dominantState: 'caregiver-burnout',
    },
  };

  const liveResult = await callChat(livePayload);

  console.log('\n' + '─'.repeat(80));
  console.log('FULL GPT RESPONSE (KIM — BEHE-K01):');
  console.log('─'.repeat(80));
  console.log(liveResult?.response ?? '[NO RESPONSE]');
  console.log('─'.repeat(80));
  console.log(`Token usage: ${JSON.stringify(liveResult?.tokenUsage ?? 'N/A')}`);
  console.log(`Model: ${liveResult?.selectedModel ?? 'N/A'}`);

  // Analysis
  const response = (liveResult?.response ?? '').toLowerCase();
  const checks = {
    'Acknowledges control as coping (not blame)': /veilig|bescherm|probeer|zorg|grip|houvast|coping/.test(response),
    'Explores cost/exhaustion': /kost|moe|uitput|zwaar|energie|prijs|vermoei/.test(response),
    'No blame or labeling': !/controlerend|manipulatief|toxic|politie|codependent/.test(response),
    'No diagnosis': !/diagnos|stoornis|dsm|patholog/.test(response),
    'Addresses user by name (Anja)': /anja/i.test(response),
    'No Elias-scoped content': !/herval|craving|wilskracht|verslaving.*jij|jouw.*gebruik/.test(response),
  };

  console.log('\nCHECKS:');
  let allPassed = true;
  for (const [label, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✅' : '❌'} ${label}`);
    if (!passed) allPassed = false;
  }
  console.log(`\nOVERALL: ${allPassed ? '✅ ALL CHECKS PASSED' : '⚠️ SOME CHECKS FAILED'}`);

  return { response: liveResult?.response, checks, allPassed };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  LIVE END-TO-END VALIDATION — RecoFree PsychoEducation + Kim Patterns      ║');
  console.log('║  Testing actual GPT responses (not mocked)                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  try {
    const elias = await testElias();
    const kim = await testKim();

    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Test 1 (Elias WILSKRACHT01): ${elias.allPassed ? '✅ PASSED' : '⚠️ ISSUES'}`);
    console.log(`Test 2 (Kim BEHE-K01):       ${kim.allPassed ? '✅ PASSED' : '⚠️ ISSUES'}`);
    console.log('═'.repeat(80));
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
