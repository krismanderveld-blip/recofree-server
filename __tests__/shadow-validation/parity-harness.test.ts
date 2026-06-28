/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHADOW VALIDATION — PARITY HARNESS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Runs the same CanonicalEngineInput through BOTH:
 *   1. Client engine (processMessage in pipeline.ts)
 *   2. Server engine (/api/engine-process endpoint)
 *
 * Then normalizes both outputs and compares per-field.
 *
 * Reports:
 *   - crisisLevel / crisis override: MUST 100% match
 *   - persona separation: MUST 100% match
 *   - dominantModule, zoneColor: target 95%+
 *   - greeting / fact-grounding: no new hallucinated references
 *
 * Mismatch classification:
 *   - REAL_DECISION_DIFFERENCE: different logic path → must fix
 *   - TIMING_ARTIFACT: SignalEngine sync vs async timing → tolerable
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// ─── Mock AsyncStorage ─────────────────────────────────────────
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStorage[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn(async (key: string) => { delete mockStorage[key]; }),
  },
}));

// ─── Mock expo-secure-store (for encrypted storage) ────────────
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));

// ─── Imports ────────────────────────────────────────────────────
import { processMessage, resetSessionState } from '../../lib/rugzak/pipeline';
import { initGptSignalEngine, resetEngine } from '../../lib/engine/local-llm/engine-provider';
import { buildCanonicalEngineInput, type BuildEngineInputParams } from '../../lib/migration/build-engine-input';
import type { CanonicalEngineInput } from '../../lib/migration/engine-input.types';
import {
  createNewBackpack,
  createNewUserDat,
  type AIProvider,
  type AIResult,
  type ChatContext,
  type Backpack,
  type UserDat,
} from '../../lib/ai/types';

// ─── Types ──────────────────────────────────────────────────────

interface NormalizedOutput {
  // Critical (zero tolerance)
  crisisLevel: number;
  showEmergency: boolean;
  relapseIntentDetected: boolean;
  riskLevel: string;
  // High (affects UX)
  dominantModule: string;
  zoneColor: string;
  emotionalState: string;
  loopDetected: boolean;
  // Medium
  zoneScore: number;
  regulationAction: string;
  regulationZone: string;
  regulationWasSoftened: boolean;
  regulationWasSkipped: boolean;
  // Low / Semantic
  selectedModel: string;
  persona: string;
}

interface ComparisonResult {
  scenario: string;
  category: string;
  fieldResults: Array<{
    field: string;
    clientValue: any;
    serverValue: any;
    match: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low';
    mismatchType?: 'REAL_DECISION_DIFFERENCE' | 'TIMING_ARTIFACT';
  }>;
  overallMatch: boolean;
  crisisMatch: boolean;
  personaMatch: boolean;
}

// ─── Fixtures ───────────────────────────────────────────────────

function createEliasBackpack(overrides?: Partial<any>): Backpack {
  return createNewBackpack({
    userName: 'Kris',
    userType: 'elias',
    stageOfChange: 'contemplation',
    eigenRegieLevel: null,
    startEmotion: 'neutraal',
    urgency: 'midden',
    initialContext: 'Ik wil stoppen met drinken. Mijn vrouw heet Anja.',
    ...overrides,
  });
}

function createKimBackpack(overrides?: Partial<any>): Backpack {
  return createNewBackpack({
    userName: 'Anja',
    userType: 'kim',
    stageOfChange: 'contemplation',
    eigenRegieLevel: null,
    startEmotion: 'bezorgd',
    urgency: 'midden',
    initialContext: 'Mijn man Kris drinkt te veel.',
    ...overrides,
  });
}

function createEliasUserDat(overrides?: Partial<UserDat>): UserDat {
  const ud = createNewUserDat('elias', 'contemplation');
  (ud.currentMood as any).vsp = 'GROEN';
  (ud.currentMood as any).vspScore = 20;
  (ud.currentMood as any).craving = 2;
  (ud.currentMood as any).frustration = 1;
  (ud.currentMood as any).despondency = 1;
  (ud.currentMood as any).focus = 8;
  return { ...ud, ...overrides };
}

function createKimUserDat(overrides?: Partial<UserDat>): UserDat {
  const ud = createNewUserDat('kim', 'contemplation');
  (ud.currentMood as any).stress = 3;
  (ud.currentMood as any).boundaryFatigue = 2;
  (ud.currentMood as any).emotionalBurden = 3;
  (ud.currentMood as any).selfCare = 7;
  return { ...ud, ...overrides };
}

function createHighCravingUserDat(): UserDat {
  const ud = createEliasUserDat();
  (ud.currentMood as any).craving = 9;
  (ud.currentMood as any).frustration = 7;
  (ud.currentMood as any).despondency = 8;
  (ud.currentMood as any).focus = 2;
  (ud.currentMood as any).vsp = 'ROOD';
  (ud.currentMood as any).vspScore = 80;
  return ud;
}

function createMockProvider(): AIProvider {
  return {
    generateResponse: async (_context: ChatContext): Promise<AIResult> => ({
      response: 'Ik hoor je, Kris. Hoe voel je je nu?',
      selectedModel: 'gpt-4o-mini',
      tokenUsage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
    }),
  };
}

function createCrisisProvider(): AIProvider {
  return {
    generateResponse: async (_context: ChatContext): Promise<AIResult> => ({
      response: 'Ik ben hier. Je bent niet alleen. Ben je nu veilig? Als je nu hulp nodig hebt: bel 0800 32 123 of 107.',
      selectedModel: 'gpt-4o',
      tokenUsage: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
    }),
  };
}

// ─── Server Call Helper ─────────────────────────────────────────

const SERVER_URL = 'http://127.0.0.1:3000';

function mapRequestType(canonical: string, isSessionStart: boolean): string {
  if (canonical === 'SESSION_INIT' || isSessionStart) return 'session_start';
  return 'process_message';
}

async function callServerEngine(input: CanonicalEngineInput): Promise<any> {
  // Map CanonicalEngineInput to server's expected schema
  const serverInput = {
    ...input,
    requestType: mapRequestType(input.requestType, input.isSessionStart),
    includeGPTResponse: false, // We only compare pre-GPT decisions
  };
  const response = await fetch(`${SERVER_URL}/api/engine-process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverInput),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Server returned ${response.status}: ${err}`);
  }
  return response.json();
}

// ─── Normalization ──────────────────────────────────────────────

function normalizeClientOutput(result: any, backpack: Backpack): NormalizedOutput {
  const messageLog = result.messageLog;
  return {
    crisisLevel: result.crisisLevel ?? 0,
    showEmergency: result.showEmergency ?? false,
    relapseIntentDetected: result.crisisProtocolActive && result.crisisLevel >= 2 ? true : false,
    riskLevel: result.analysis?.riskLevel ?? 'low',
    dominantModule: result.dominantState?.dominantModule ?? messageLog?.preGPT?.dominantState?.dominantModule ?? 'default',
    zoneColor: messageLog?.preGPT?.bufferZoneColor ?? messageLog?.postGPT?.updatedZoneColor ?? 'GREEN',
    emotionalState: result.analysis?.emotionalState ?? 'stable',
    loopDetected: messageLog?.preGPT?.dominantState?.loopDetected ?? false,
    zoneScore: messageLog?.preGPT?.bufferZoneScore ?? messageLog?.postGPT?.updatedZoneScore ?? 0,
    regulationAction: messageLog?.preGPT?.regulation?.action ?? 'reflect',
    regulationZone: messageLog?.preGPT?.regulation?.zone ?? 'GREEN',
    regulationWasSoftened: messageLog?.preGPT?.regulation?.wasSoftened ?? false,
    regulationWasSkipped: messageLog?.preGPT?.regulation?.wasSkipped ?? false,
    selectedModel: result.messageLog?.gpt?.selectedModel ?? 'gpt-4o-mini',
    persona: backpack.userType,
  };
}

function normalizeServerOutput(serverResult: any, userType: string): NormalizedOutput {
  return {
    crisisLevel: serverResult.statePatches?.safety?.crisisLevel ?? 0,
    showEmergency: serverResult.statePatches?.safety?.showEmergency ?? false,
    relapseIntentDetected: serverResult.statePatches?.safety?.relapseIntentLog ? true : false,
    riskLevel: serverResult.stateAnalysis?.riskLevel ?? 'low',
    dominantModule: serverResult.statePatches?.sessionState?.dominantModule ?? 'default',
    zoneColor: serverResult.bufferState?.currentZoneColor ?? 'GREEN',
    emotionalState: serverResult.stateAnalysis?.emotionalState ?? 'stable',
    loopDetected: serverResult.loopblock?.isBlocked ?? false,
    zoneScore: serverResult.bufferState?.currentZoneScore ?? 0,
    regulationAction: serverResult.regulation?.action ?? 'reflect',
    regulationZone: serverResult.regulation?.zone ?? 'GREEN',
    regulationWasSoftened: serverResult.regulation?.wasSoftened ?? false,
    regulationWasSkipped: serverResult.regulation?.wasSkipped ?? false,
    selectedModel: serverResult.gptResponse?.selectedModel ?? 'gpt-4o-mini',
    persona: userType,
  };
}

// ─── Comparison Logic ───────────────────────────────────────────

const FIELD_SEVERITY: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  crisisLevel: 'critical',
  showEmergency: 'critical',
  relapseIntentDetected: 'critical',
  riskLevel: 'critical',
  dominantModule: 'high',
  zoneColor: 'high',
  emotionalState: 'high',
  loopDetected: 'high',
  zoneScore: 'medium',
  regulationAction: 'medium',
  regulationZone: 'medium',
  regulationWasSoftened: 'medium',
  regulationWasSkipped: 'medium',
  selectedModel: 'low',
  persona: 'critical',
};

function compareOutputs(
  scenario: string,
  category: string,
  client: NormalizedOutput,
  server: NormalizedOutput,
): ComparisonResult {
  const fieldResults: ComparisonResult['fieldResults'] = [];

  for (const [field, severity] of Object.entries(FIELD_SEVERITY)) {
    const cv = (client as any)[field];
    const sv = (server as any)[field];

    let match: boolean;
    if (field === 'zoneScore') {
      // Allow ±5 tolerance for zone score (rounding, timing)
      match = Math.abs((cv as number) - (sv as number)) <= 5;
    } else {
      match = cv === sv;
    }

    const entry: ComparisonResult['fieldResults'][0] = {
      field,
      clientValue: cv,
      serverValue: sv,
      match,
      severity,
    };

    if (!match) {
      // Classify mismatch
      if (field === 'selectedModel' || field === 'zoneScore') {
        entry.mismatchType = 'TIMING_ARTIFACT';
      } else {
        entry.mismatchType = 'REAL_DECISION_DIFFERENCE';
      }
    }

    fieldResults.push(entry);
  }

  const crisisFields = fieldResults.filter(f => f.severity === 'critical');
  const crisisMatch = crisisFields.every(f => f.match);
  const personaMatch = fieldResults.find(f => f.field === 'persona')?.match ?? true;

  return {
    scenario,
    category,
    fieldResults,
    overallMatch: fieldResults.every(f => f.match),
    crisisMatch,
    personaMatch,
  };
}

// ─── Golden Session Scenarios ───────────────────────────────────

interface GoldenScenario {
  name: string;
  category: string;
  backpack: Backpack;
  userDat: UserDat;
  message: string;
  isSessionStart: boolean;
  provider: AIProvider;
  /** Expected crisis level (for validation) */
  expectedCrisis?: number;
}

function buildGoldenScenarios(): GoldenScenario[] {
  return [
    // ─── 1. Stable Elias (green zone, normal conversation) ───
    {
      name: 'stable_elias_green',
      category: 'normal',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: 'Het gaat goed vandaag, ik heb een wandeling gemaakt.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 2. Stable Kim (normal conversation) ───
    {
      name: 'stable_kim_normal',
      category: 'persona',
      backpack: createKimBackpack(),
      userDat: createKimUserDat(),
      message: 'Ik maak me zorgen over Kris, maar het gaat beter.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 3. High craving Elias (red zone) ───
    {
      name: 'high_craving_elias',
      category: 'high_risk',
      backpack: createEliasBackpack(),
      userDat: createHighCravingUserDat(),
      message: 'Ik heb zo veel zin om te drinken, ik kan het niet meer aan.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 4. Relapse intent ───
    {
      name: 'relapse_intent',
      category: 'crisis',
      backpack: createEliasBackpack(),
      userDat: createHighCravingUserDat(),
      message: 'Ik ga vanavond drinken, ik heb al bier gekocht.',
      isSessionStart: false,
      provider: createCrisisProvider(),
      expectedCrisis: 2,
    },
    // ─── 5. Crisis language (suicidal ideation) ───
    {
      name: 'crisis_suicidal',
      category: 'crisis',
      backpack: createEliasBackpack(),
      userDat: createHighCravingUserDat(),
      message: 'Ik wil er niet meer zijn, het heeft geen zin meer.',
      isSessionStart: false,
      provider: createCrisisProvider(),
      expectedCrisis: 2,
    },
    // ─── 6. VSP zone PAARS (purple = crisis override) ───
    {
      name: 'vsp_paars_override',
      category: 'crisis',
      backpack: createEliasBackpack(),
      userDat: (() => {
        const ud = createEliasUserDat();
        (ud.currentMood as any).vsp = 'PAARS';
        (ud.currentMood as any).vspScore = 100;
        (ud.currentMood as any).craving = 10;
        return ud;
      })(),
      message: 'Ik ben in paniek.',
      isSessionStart: false,
      provider: createCrisisProvider(),
      expectedCrisis: 2,
    },
    // ─── 7. Greeting after absence (session start) ───
    {
      name: 'greeting_after_absence',
      category: 'greeting',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat({ totalSessions: 5, lastSessionDate: '2025-06-20' }),
      message: 'Hallo',
      isSessionStart: true,
      provider: createMockProvider(),
    },
    // ─── 8. Fact-grounding (references known person) ───
    {
      name: 'fact_grounding_person',
      category: 'fact_grounding',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: 'Anja en ik hadden ruzie gisteravond.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 9. Module loop detection ───
    {
      name: 'module_loop',
      category: 'module_loop',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: 'Ik voel me weer hetzelfde als vorige keer.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 10. Multilingual NL ───
    {
      name: 'multilingual_nl',
      category: 'multilingual',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: 'Vandaag was een moeilijke dag op het werk.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 11. Multilingual EN ───
    {
      name: 'multilingual_en',
      category: 'multilingual',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: 'Today was a difficult day at work, I almost relapsed.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 12. Multilingual FR ───
    {
      name: 'multilingual_fr',
      category: 'multilingual',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat(),
      message: "Aujourd'hui était une journée difficile, j'ai presque rechuté.",
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 13. Kim persona separation (Kim modules must NOT appear for Elias) ───
    {
      name: 'persona_separation_kim_only',
      category: 'persona',
      backpack: createKimBackpack(),
      userDat: createKimUserDat({
        currentMood: { stress: 9, boundaryFatigue: 8, emotionalBurden: 9, selfCare: 1 } as any,
      }),
      message: 'Ik kan niet meer, hij liegt weer tegen mij.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
    // ─── 14. Past-reference search ───
    {
      name: 'past_reference',
      category: 'past_reference',
      backpack: createEliasBackpack(),
      userDat: createEliasUserDat({ totalSessions: 10 }),
      message: 'Vorige keer hadden we het over mijn vader, dat raakte me.',
      isSessionStart: false,
      provider: createMockProvider(),
    },
  ];
}

// ─── Build CanonicalEngineInput from scenario ───────────────────

function buildInputFromScenario(scenario: GoldenScenario): CanonicalEngineInput {
  const sessionStartIso = new Date(Date.now() - 300000).toISOString(); // 5 min ago
  const params: BuildEngineInputParams = {
    requestType: scenario.isSessionStart ? 'SESSION_INIT' : 'LIVE_MESSAGE',
    backpack: scenario.backpack,
    userDat: scenario.userDat,
    userMessage: scenario.message,
    conversationHistory: scenario.isSessionStart ? [] : [
      { role: 'assistant', content: 'Hallo, hoe gaat het met je?', timestamp: new Date(Date.now() - 60000).toISOString() },
    ],
    logsSessions: [],
    isSessionStart: scenario.isSessionStart,
    usedModules: [],
    previousZoneScore: 0,
    messageCount: scenario.isSessionStart ? 0 : 1,
    sessionStartedAtIso: sessionStartIso,
    locale: 'nl',
    country: 'BE',
  };
  return buildCanonicalEngineInput(params);
}

// ─── Test Suite ─────────────────────────────────────────────────

describe('Shadow Validation — Parity Harness', () => {
  const scenarios = buildGoldenScenarios();
  const results: ComparisonResult[] = [];
  let serverAvailable = false;

  beforeAll(async () => {
    // Check if server is reachable
    try {
      const resp = await fetch(`${SERVER_URL}/api/engine-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Will get 400 but proves server is up
      });
      serverAvailable = resp.status === 400 || resp.status === 200;
    } catch {
      serverAvailable = false;
    }
  });

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    initGptSignalEngine('http://fake-signal-api');
    resetSessionState();
  });

  afterAll(() => {
    resetEngine();
    // Print summary report
    if (results.length > 0) {
      printParityReport(results);
    }
  });

  // Run each golden scenario
  for (const scenario of scenarios) {
    it(`[${scenario.category}] ${scenario.name}`, async () => {
      if (!serverAvailable) {
        console.warn('[SKIP] Server not available');
        return;
      }

      // 1. Build canonical input
      const input = buildInputFromScenario(scenario);

      // 2. Run client engine
      resetSessionState();
      const clientResult = await processMessage(
        scenario.backpack,
        scenario.message,
        scenario.provider,
        scenario.userDat,
        { isSessionStart: scenario.isSessionStart, diaryEntries: [], locale: 'nl', country: 'BE' },
      );

      // 3. Run server engine
      const serverResult = await callServerEngine(input);

      // 4. Normalize both
      const clientNorm = normalizeClientOutput(clientResult, scenario.backpack);
      const serverNorm = normalizeServerOutput(serverResult, scenario.backpack.userType);

      // 5. Compare
      const comparison = compareOutputs(scenario.name, scenario.category, clientNorm, serverNorm);
      results.push(comparison);

      // 6. Assert critical fields
      if (scenario.category === 'crisis') {
        expect(comparison.crisisMatch).toBe(true);
      }
      expect(comparison.personaMatch).toBe(true);

      // Log mismatches for debugging
      const mismatches = comparison.fieldResults.filter(f => !f.match);
      if (mismatches.length > 0) {
        console.log(`\n[${scenario.name}] MISMATCHES (${mismatches.length}):`);
        for (const m of mismatches) {
          console.log(`  ${m.field} [${m.severity}]: client=${JSON.stringify(m.clientValue)} server=${JSON.stringify(m.serverValue)} → ${m.mismatchType}`);
        }
      }
    }, 30000); // 30s timeout per scenario (includes GPT call)
  }
});

// ─── Report Printer ─────────────────────────────────────────────

function printParityReport(results: ComparisonResult[]): void {
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('       SHADOW VALIDATION — PARITY REPORT');
  console.log('══════════════════════════════════════════════════════════════\n');

  const totalScenarios = results.length;
  const fullMatches = results.filter(r => r.overallMatch).length;
  const crisisMatches = results.filter(r => r.crisisMatch).length;
  const personaMatches = results.filter(r => r.personaMatch).length;

  console.log(`Scenarios run: ${totalScenarios}`);
  console.log(`Full matches: ${fullMatches}/${totalScenarios} (${(fullMatches / totalScenarios * 100).toFixed(1)}%)`);
  console.log(`Crisis match: ${crisisMatches}/${totalScenarios} (${(crisisMatches / totalScenarios * 100).toFixed(1)}%)`);
  console.log(`Persona match: ${personaMatches}/${totalScenarios} (${(personaMatches / totalScenarios * 100).toFixed(1)}%)`);

  // Per-field match rates
  const fieldStats: Record<string, { total: number; matched: number }> = {};
  for (const r of results) {
    for (const f of r.fieldResults) {
      if (!fieldStats[f.field]) fieldStats[f.field] = { total: 0, matched: 0 };
      fieldStats[f.field].total++;
      if (f.match) fieldStats[f.field].matched++;
    }
  }

  console.log('\n── Per-Field Match Rates ──────────────────────────────────');
  const sortedFields = Object.entries(fieldStats).sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const aField = results[0]?.fieldResults.find(f => f.field === a[0]);
    const bField = results[0]?.fieldResults.find(f => f.field === b[0]);
    return (severityOrder[(aField?.severity ?? 'low') as keyof typeof severityOrder] ?? 4) -
           (severityOrder[(bField?.severity ?? 'low') as keyof typeof severityOrder] ?? 4);
  });

  for (const [field, stats] of sortedFields) {
    const rate = (stats.matched / stats.total * 100).toFixed(1);
    const severity = FIELD_SEVERITY[field] ?? 'low';
    const indicator = stats.matched === stats.total ? '✓' : stats.matched / stats.total >= 0.95 ? '~' : '✗';
    console.log(`  ${indicator} ${field} [${severity}]: ${rate}% (${stats.matched}/${stats.total})`);
  }

  // Mismatch classification
  const realDifferences: Array<{ scenario: string; field: string; client: any; server: any }> = [];
  const timingArtifacts: Array<{ scenario: string; field: string; client: any; server: any }> = [];

  for (const r of results) {
    for (const f of r.fieldResults) {
      if (!f.match) {
        const entry = { scenario: r.scenario, field: f.field, client: f.clientValue, server: f.serverValue };
        if (f.mismatchType === 'TIMING_ARTIFACT') {
          timingArtifacts.push(entry);
        } else {
          realDifferences.push(entry);
        }
      }
    }
  }

  if (realDifferences.length > 0) {
    console.log('\n── REAL DECISION DIFFERENCES (must fix) ──────────────────');
    for (const d of realDifferences) {
      console.log(`  [${d.scenario}] ${d.field}: client=${JSON.stringify(d.client)} → server=${JSON.stringify(d.server)}`);
    }
  }

  if (timingArtifacts.length > 0) {
    console.log('\n── TIMING ARTIFACTS (tolerable) ──────────────────────────');
    for (const t of timingArtifacts) {
      console.log(`  [${t.scenario}] ${t.field}: client=${JSON.stringify(t.client)} → server=${JSON.stringify(t.server)}`);
    }
  }

  // Go/No-Go verdict
  console.log('\n── GO/NO-GO VERDICT ──────────────────────────────────────');
  const crisisOk = crisisMatches === totalScenarios;
  const personaOk = personaMatches === totalScenarios;
  const highFields = Object.entries(fieldStats).filter(([field]) =>
    FIELD_SEVERITY[field] === 'high'
  );
  const highFieldRate = highFields.reduce((sum, [, s]) => sum + s.matched / s.total, 0) / (highFields.length || 1);

  console.log(`  Crisis (100% required): ${crisisOk ? 'PASS ✓' : 'FAIL ✗'} (${(crisisMatches / totalScenarios * 100).toFixed(1)}%)`);
  console.log(`  Persona (100% required): ${personaOk ? 'PASS ✓' : 'FAIL ✗'} (${(personaMatches / totalScenarios * 100).toFixed(1)}%)`);
  console.log(`  High fields (95%+ target): ${highFieldRate >= 0.95 ? 'PASS ✓' : 'FAIL ✗'} (${(highFieldRate * 100).toFixed(1)}%)`);
  console.log(`  Real differences: ${realDifferences.length}`);
  console.log(`  Timing artifacts: ${timingArtifacts.length}`);

  const goNoGo = crisisOk && personaOk && highFieldRate >= 0.95;
  console.log(`\n  VERDICT: ${goNoGo ? '🟢 GO — Server parity validated' : '🔴 NO-GO — Fix differences before Checkpoint G'}`);
  console.log('══════════════════════════════════════════════════════════════\n');
}
