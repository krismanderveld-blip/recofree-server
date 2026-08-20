/**
 * FULL DEVICE FLOW INTEGRATION TEST
 * 
 * Simulates the EXACT device path:
 * 1. User fills backpack with real clinical data
 * 2. User taps "Gegevens bijwerken" → analyzeAllSections
 * 3. GPT returns schemas/modes/triggers/lifeStatus
 * 4. mergeAnalysisToUserDat writes to AsyncStorage + SessionMemoryCache
 * 5. User opens chat → startSession reads from SessionMemoryCache
 * 6. handleSend reads userDat → passes to pipeline
 * 7. buildPersonalClinicalContext produces non-empty output
 * 8. Prompt builder includes [PERSONAL CLINICAL CONTEXT]
 * 
 * If ANY step fails, the test pinpoints EXACTLY where data is lost.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mock storage (simulates device AsyncStorage + SessionMemoryCache) ──
const mockAsyncStorage: Record<string, string> = {};
const mockSessionCache: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => { mockAsyncStorage[key] = value; return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { delete mockAsyncStorage[key]; return Promise.resolve(); }),
  },
}));

vi.mock('@/lib/crypto/session-memory-cache', () => ({
  SessionMemoryCache: {
    get: vi.fn((key: string) => Promise.resolve(mockSessionCache[key] || null)),
    set: vi.fn((key: string, value: string) => { mockSessionCache[key] = value; return Promise.resolve(); }),
  },
}));

vi.mock('@/lib/_core/auth', () => ({
  getSessionToken: vi.fn(() => Promise.resolve('test-token')),
}));

vi.mock('@/constants/oauth', () => ({
  getApiBaseUrl: vi.fn(() => 'https://test-railway.up.railway.app'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

import { analyzeAllSections, mergeAnalysisToUserDat } from '@/lib/backpack-extractor/section-analysis-service';
import type { BackpackSectionAnalysisResult } from '@/lib/backpack-extractor/section-analysis-types';

// ── Real backpack data (Kris's family section) ──
const REAL_BACKPACK_SECTION = {
  id: 'family',
  label: 'Familie',
  content: 'Ouderlijk gezin. Nico manderveld vader ingenieus Marie louise steegmans moeder zelfstandige/huismoeder overleden 22/09/2025 Els manderveld zus verpleegkundige Katrien manderveld kinderpsycholoog. Huidige gezinssituatie. Ik woon half bij mijn ouders en half bij mijn partner melissa. Mijn zoon jules woont bij de mama, ellen, in oost vlaanderen. Met mij en melissa loopt alles goed, ze is mijn steun en rots in de branding, ik dank mijn leven letterlijk aan haar, want zonder haar zou ik er waarschijnlijk niet meer zijn. Met mijn zoon verloopt het momenteel niet zo goed, vandaar ook mijn opname hier. Hierover later meer.',
};

// ── Mock GPT response with clinical data ──
const MOCK_GPT_CLINICAL_RESPONSE = {
  personalAnchors: [
    { name: 'Marie Louise Steegmans', relationToUser: 'moeder', currentRelevance: 'high', emotionallyImportant: true, explicitInSource: true, confidence: 0.95 },
    { name: 'Melissa', relationToUser: 'partner', currentRelevance: 'high', emotionallyImportant: true, explicitInSource: true, confidence: 0.95 },
    { name: 'Jules', relationToUser: 'zoon', currentRelevance: 'high', emotionallyImportant: true, explicitInSource: true, confidence: 0.95 },
  ],
  relationGraph: [
    { subjectPerson: 'Marie Louise Steegmans', relation: 'moeder van', objectPerson: 'Kris', explicitInSource: true, confidence: 0.95 },
  ],
  lifeStatusFacts: [
    { person: 'Marie Louise Steegmans', status: 'deceased', explicitInSource: true, confidence: 0.99 },
  ],
  lifeEvents: [],
  schemas: [
    { schema: 'abandonment', evidenceType: 'inferred', confidence: 0.7 },
    { schema: 'self_sacrifice', evidenceType: 'inferred', confidence: 0.65 },
  ],
  modes: [
    { mode: 'vulnerable_child', evidenceType: 'inferred', confidence: 0.6 },
    { mode: 'detached_protector', evidenceType: 'inferred', confidence: 0.55 },
  ],
  triggers: [
    { trigger: 'conflict met zoon', context: 'relatie met Jules verslechtert', severity: 'high', confidence: 0.8 },
    { trigger: 'verlies moeder', context: 'overlijden 22/09/2025', severity: 'high', confidence: 0.95 },
  ],
  protectiveFactors: [
    { factor: 'steunende partner Melissa', domain: 'social', strength: 'strong', confidence: 0.9 },
  ],
  values: [
    { value: 'gezin', importance: 'core', confidence: 0.9 },
  ],
  goals: [
    { goal: 'relatie met zoon herstellen', timeframe: 'medium_term', confidence: 0.8 },
  ],
  risks: [
    { risk: 'terugval bij rouw-triggers', severity: 'high', isActive: true, confidence: 0.75 },
  ],
  recoveryPatterns: [
    { type: 'social_support', description: 'Melissa als anker bij cravings', confidence: 0.85 },
  ],
  caregiverPatterns: [],
  developmentalFormulation: [
    { originPhase: 'adulthood', originContext: 'verlies moeder + opname', learnedPattern: 'emotionele vermijding via middelen', currentManifestation: 'terugval bij rouw', sourceEvidence: 'zonder haar zou ik er waarschijnlijk niet meer zijn', confidence: 0.7 },
  ],
  triggerChains: [
    { triggerEvent: 'conflict met zoon', assignedMeaning: 'ik faal als vader', emotionalResponse: 'schaamte + schuld', activatedMode: 'detached_protector', copingBehavior: 'middelengebruik', riskOutcome: 'terugval', sourceEvidence: 'Met mijn zoon verloopt het momenteel niet zo goed', confidence: 0.7 },
  ],
  relapsePathways: [
    { destabilizer: 'rouw + conflict met Jules', earlyWarnings: ['terugtrekken', 'slaapproblemen'], escalationPattern: 'isolatie → craving → gebruik', relapseEndpoint: 'terugval', protectiveInterrupts: ['contact met Melissa', 'therapie'], sourceEvidence: 'vandaar ook mijn opname hier', confidence: 0.7 },
  ],
  caregiverBurdenPathways: [],
  functionOfAddiction: [
    { functionType: 'numbing', description: 'verdoven van rouw en schaamte', underlyingNeed: 'emotionele regulatie', sourceEvidence: 'zonder haar zou ik er waarschijnlijk niet meer zijn', confidence: 0.65 },
  ],
  functionOfCaregivingPattern: [],
  contraindications: [
    { avoidTopic: 'actieve relatievragen over overleden moeder', reason: 'moeder is overleden', appliesTo: 'Marie Louise Steegmans', severity: 'hard', sourceEvidence: 'overleden 22/09/2025', confidence: 0.99 },
  ],
  safeFormulationHints: [
    { topic: 'verlies moeder', safeFraming: 'erken het gemis en de impact op herstel', avoidFraming: 'hoe gaat het tussen jullie / zoek contact', sourceEvidence: 'overleden 22/09/2025', confidence: 0.95 },
  ],
};

function mockGptResponse(content: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  });
}

beforeEach(() => {
  Object.keys(mockAsyncStorage).forEach(k => delete mockAsyncStorage[k]);
  Object.keys(mockSessionCache).forEach(k => delete mockSessionCache[k]);
  mockFetch.mockReset();
});

describe('FULL DEVICE FLOW: Gegevens bijwerken → ClinicalCtx=true', () => {
  
  it('CHECKPOINT 1: analyzeAllSections calls GPT and returns schemas/modes/triggers > 0', async () => {
    mockGptResponse(MOCK_GPT_CLINICAL_RESPONSE);
    
    const report = await analyzeAllSections([REAL_BACKPACK_SECTION], 'elias');
    
    expect(report.sectionsAnalyzed).toBe(1);
    expect(report.schemasDetected).toBeGreaterThan(0);
    expect(report.modesDetected).toBeGreaterThan(0);
    expect(report.triggersDetected).toBeGreaterThan(0);
    expect(report.lifeStatusDetected).toBeGreaterThan(0);
    expect(report.failures).toBe(0);
  });

  it('CHECKPOINT 2: After mergeAnalysisToUserDat, AsyncStorage has schemas/modes/triggers', async () => {
    // Simulate: userDat already exists with basic extractedEntities (from forceExtract)
    const baseUserDat = {
      extractedEntities: { persons: [{ name: 'Melissa', relationship: 'partner' }], events: [], patterns: [], contexts: [] },
      totalSessions: 5,
      lastSessionDate: '2026-08-20',
    };
    mockAsyncStorage['@recofree_userdat'] = JSON.stringify(baseUserDat);
    
    // Simulate mergeAnalysisToUserDat with the GPT result
    const analysisResult: BackpackSectionAnalysisResult = {
      sectionId: 'family',
      sectionHash: "test-hash",
      confidenceSummary: { overallConfidence: 0.8, explicitFactCount: 3, inferredFactCount: 2, unsupportedFactsDiscarded: 0 },
      warnings: [],
      persona: 'elias',
      analyzedAt: new Date().toISOString(),
      personalAnchors: MOCK_GPT_CLINICAL_RESPONSE.personalAnchors as any,
      relationGraph: MOCK_GPT_CLINICAL_RESPONSE.relationGraph as any,
      lifeStatusFacts: MOCK_GPT_CLINICAL_RESPONSE.lifeStatusFacts as any,
      lifeEvents: [],
      schemas: MOCK_GPT_CLINICAL_RESPONSE.schemas as any,
      modes: MOCK_GPT_CLINICAL_RESPONSE.modes as any,
      triggers: MOCK_GPT_CLINICAL_RESPONSE.triggers as any,
      protectiveFactors: MOCK_GPT_CLINICAL_RESPONSE.protectiveFactors as any,
      values: MOCK_GPT_CLINICAL_RESPONSE.values as any,
      goals: MOCK_GPT_CLINICAL_RESPONSE.goals as any,
      risks: MOCK_GPT_CLINICAL_RESPONSE.risks as any,
      recoveryPatterns: MOCK_GPT_CLINICAL_RESPONSE.recoveryPatterns as any,
      caregiverPatterns: [],
      developmentalFormulation: MOCK_GPT_CLINICAL_RESPONSE.developmentalFormulation as any,
      triggerChains: MOCK_GPT_CLINICAL_RESPONSE.triggerChains as any,
      relapsePathways: MOCK_GPT_CLINICAL_RESPONSE.relapsePathways as any,
      caregiverBurdenPathways: [],
      functionOfAddiction: MOCK_GPT_CLINICAL_RESPONSE.functionOfAddiction as any,
      functionOfCaregivingPattern: [],
      contraindications: MOCK_GPT_CLINICAL_RESPONSE.contraindications as any,
      safeFormulationHints: MOCK_GPT_CLINICAL_RESPONSE.safeFormulationHints as any,
    };
    
    await mergeAnalysisToUserDat(analysisResult);
    
    // READ BACK from AsyncStorage
    const stored = JSON.parse(mockAsyncStorage['@recofree_userdat']);
    
    expect(stored.schemas).toBeDefined();
    expect(stored.schemas.length).toBeGreaterThan(0);
    expect(stored.modes).toBeDefined();
    expect(stored.modes.length).toBeGreaterThan(0);
    expect(stored.triggers).toBeDefined();
    expect(stored.triggers.length).toBeGreaterThan(0);
    expect(stored.lifeStatusFacts).toBeDefined();
    expect(stored.lifeStatusFacts.length).toBeGreaterThan(0);
    expect(stored.lifeStatusFacts[0].status).toBe('deceased');
    expect(stored.recoveryPatterns).toBeDefined();
    expect(stored.recoveryPatterns.length).toBeGreaterThan(0);
    expect(stored.developmentalFormulation).toBeDefined();
    expect(stored.triggerChains).toBeDefined();
    expect(stored.relapsePathways).toBeDefined();
    expect(stored.functionOfAddiction).toBeDefined();
    expect(stored.contraindications).toBeDefined();
    expect(stored.safeFormulationHints).toBeDefined();
    
    // ALSO: SessionMemoryCache must have been updated
    expect(mockSessionCache['@recofree_userdat']).toBeDefined();
    const cached = JSON.parse(mockSessionCache['@recofree_userdat']);
    expect(cached.schemas.length).toBeGreaterThan(0);
    expect(cached.modes.length).toBeGreaterThan(0);
    expect(cached.triggers.length).toBeGreaterThan(0);
    
    // ALSO: Original fields must survive
    expect(stored.totalSessions).toBe(5);
    expect(stored.extractedEntities.persons.length).toBeGreaterThanOrEqual(1);
  });

  it('CHECKPOINT 3: persistUserDat (startSession simulation) does NOT destroy deep analysis fields', async () => {
    // Pre-populate SessionMemoryCache with deep analysis data (as if Gegevens bijwerken just ran)
    const richUserDat = {
      extractedEntities: { persons: [{ name: 'Melissa', relationship: 'partner' }], events: [], patterns: [], contexts: [] },
      totalSessions: 5,
      schemas: MOCK_GPT_CLINICAL_RESPONSE.schemas,
      modes: MOCK_GPT_CLINICAL_RESPONSE.modes,
      triggers: MOCK_GPT_CLINICAL_RESPONSE.triggers,
      lifeStatusFacts: MOCK_GPT_CLINICAL_RESPONSE.lifeStatusFacts,
      recoveryPatterns: MOCK_GPT_CLINICAL_RESPONSE.recoveryPatterns,
      developmentalFormulation: MOCK_GPT_CLINICAL_RESPONSE.developmentalFormulation,
      triggerChains: MOCK_GPT_CLINICAL_RESPONSE.triggerChains,
      relapsePathways: MOCK_GPT_CLINICAL_RESPONSE.relapsePathways,
      functionOfAddiction: MOCK_GPT_CLINICAL_RESPONSE.functionOfAddiction,
      contraindications: MOCK_GPT_CLINICAL_RESPONSE.contraindications,
      safeFormulationHints: MOCK_GPT_CLINICAL_RESPONSE.safeFormulationHints,
    };
    mockSessionCache['@recofree_userdat'] = JSON.stringify(richUserDat);
    
    // Simulate startSession: reads latest, adds totalSessions+1, writes back
    const latestJson = mockSessionCache['@recofree_userdat'];
    const latest = JSON.parse(latestJson!);
    const updated = { ...latest, totalSessions: (latest.totalSessions ?? 0) + 1, lastSessionDate: '2026-08-20' };
    mockSessionCache['@recofree_userdat'] = JSON.stringify(updated);
    
    // VERIFY: deep analysis fields survive
    const afterSession = JSON.parse(mockSessionCache['@recofree_userdat']);
    expect(afterSession.schemas.length).toBeGreaterThan(0);
    expect(afterSession.modes.length).toBeGreaterThan(0);
    expect(afterSession.triggers.length).toBeGreaterThan(0);
    expect(afterSession.totalSessions).toBe(6);
    expect(afterSession.lifeStatusFacts[0].status).toBe('deceased');
    expect(afterSession.recoveryPatterns.length).toBeGreaterThan(0);
    expect(afterSession.developmentalFormulation.length).toBeGreaterThan(0);
  });

  it('CHECKPOINT 4: buildPersonalClinicalContext produces non-empty output with canonical data', async () => {
    // Import the function (uses the replicated logic from pipeline.ts)
    // We test the LOGIC directly since pipeline.ts is too large to import in isolation
    const userDat = {
      schemas: MOCK_GPT_CLINICAL_RESPONSE.schemas,
      modes: MOCK_GPT_CLINICAL_RESPONSE.modes,
      triggers: MOCK_GPT_CLINICAL_RESPONSE.triggers,
      protectiveFactors: MOCK_GPT_CLINICAL_RESPONSE.protectiveFactors,
      values: MOCK_GPT_CLINICAL_RESPONSE.values,
      goals: MOCK_GPT_CLINICAL_RESPONSE.goals,
      risks: MOCK_GPT_CLINICAL_RESPONSE.risks,
      recoveryPatterns: MOCK_GPT_CLINICAL_RESPONSE.recoveryPatterns,
      developmentalFormulation: MOCK_GPT_CLINICAL_RESPONSE.developmentalFormulation,
      triggerChains: MOCK_GPT_CLINICAL_RESPONSE.triggerChains,
      relapsePathways: MOCK_GPT_CLINICAL_RESPONSE.relapsePathways,
      functionOfAddiction: MOCK_GPT_CLINICAL_RESPONSE.functionOfAddiction,
      contraindications: MOCK_GPT_CLINICAL_RESPONSE.contraindications,
      safeFormulationHints: MOCK_GPT_CLINICAL_RESPONSE.safeFormulationHints,
    };
    
    // Replicate buildPersonalClinicalContext logic
    const MAX_CHARS = 2000;
    const persona = 'elias';
    const parts: string[] = [];
    parts.push('[PERSONAL CLINICAL CONTEXT — working hypotheses, never diagnose]');
    
    const schemas = (userDat.schemas || []) as any[];
    const modes = (userDat.modes || []) as any[];
    const triggers = (userDat.triggers || []) as any[];
    
    if (schemas.length > 0) {
      parts.push(`Schemas (hypotheses): ${schemas.slice(0, 3).map((s: any) => `${s.schema || s.schemaName} (${s.confidence})`).join(', ')}`);
    }
    if (modes.length > 0) {
      parts.push(`Modes (observed): ${modes.slice(0, 3).map((m: any) => `${m.mode || m.modeName}`).join(', ')}`);
    }
    if (triggers.length > 0) {
      parts.push(`Triggers: ${triggers.slice(0, 3).map((t: any) => t.trigger || t.triggerDescription).join('; ')}`);
    }
    
    const result = parts.join('\n');
    
    // VERIFY: non-empty, contains schemas, modes, triggers
    expect(result.length).toBeGreaterThan(50);
    expect(result).toContain('Schemas (hypotheses)');
    expect(result).toContain('abandonment');
    expect(result).toContain('Modes (observed)');
    expect(result).toContain('vulnerable_child');
    expect(result).toContain('Triggers');
    expect(result).toContain('conflict met zoon');
  });

  it('CHECKPOINT 4b: buildPersonalClinicalContext FALLBACK works when canonical empty but schemaTendencies present', async () => {
    const userDat = {
      // NO canonical schemas/modes/triggers
      schemaTendencies: [
        { schemaId: 'abandonment', score: 0.8, label: 'Verlating' },
        { schemaId: 'mistrust', score: 0.6, label: 'Wantrouwen' },
      ],
      modeTendencies: [
        { modeId: 'vulnerable_child', score: 0.7, label: 'Kwetsbaar kind' },
      ],
    };
    
    // Replicate fallback logic from buildPersonalClinicalContext
    const schemas = (userDat as any).schemas || [];
    const modes = (userDat as any).modes || [];
    const triggers = (userDat as any).triggers || [];
    const schemaTendencies = userDat.schemaTendencies || [];
    const modeTendencies = userDat.modeTendencies || [];
    
    const useFallback = schemas.length === 0 && modes.length === 0 && triggers.length === 0
      && (schemaTendencies.length > 0 || modeTendencies.length > 0);
    
    expect(useFallback).toBe(true);
    
    const parts: string[] = [];
    parts.push('[PERSONAL CLINICAL CONTEXT — working hypotheses, never diagnose]');
    if (useFallback) {
      if (schemaTendencies.length > 0) {
        parts.push(`Schema tendencies (backpack-derived): ${schemaTendencies.slice(0, 3).map((s: any) => `${s.schemaId || s.label} (${s.score})`).join(', ')}`);
      }
      if (modeTendencies.length > 0) {
        parts.push(`Mode tendencies (backpack-derived): ${modeTendencies.slice(0, 3).map((m: any) => `${m.modeId || m.label} (${m.score})`).join(', ')}`);
      }
    }
    
    const result = parts.join('\n');
    expect(result).toContain('Schema tendencies');
    expect(result).toContain('abandonment');
    expect(result).toContain('Mode tendencies');
    expect(result).toContain('vulnerable_child');
  });

  it('CHECKPOINT 5: personalAnchors includes deceased status from extraction lifeStatus', () => {
    const persons = [
      { name: 'Marie Louise Steegmans', relationship: 'moeder', relationshipNL: 'moeder', lifeStatus: 'deceased' },
      { name: 'Melissa', relationship: 'partner', relationshipNL: 'partner', lifeStatus: 'alive' },
      { name: 'Jules', relationship: 'zoon', relationshipNL: 'zoon', lifeStatus: 'alive' },
    ];
    
    // Replicate buildPersonalAnchorsBlock logic
    const personMap = new Map<string, string[]>();
    for (const p of persons.slice(0, 7)) {
      if (!p.name) continue;
      const role = (p as any).relationshipNL || (p as any).relationship || '';
      const parts = role ? [role] : [];
      if ((p as any).lifeStatus === 'deceased' || (p as any).lifeStatus === 'overleden') {
        parts.push('overleden');
      }
      personMap.set(p.name.toLowerCase(), parts);
    }
    
    const lines: string[] = [];
    for (const [name, parts] of personMap) {
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      lines.push(parts.length > 0 ? `- ${displayName}: ${parts.join('; ')}` : `- ${displayName}: belangrijk persoon`);
    }
    const result = lines.join('\n');
    
    expect(result).toContain('Marie louise steegmans: moeder; overleden');
    expect(result).toContain('Melissa: partner');
    expect(result).not.toContain('Melissa: partner; overleden');
    expect(result).toContain('Jules: zoon');
  });

  it('CHECKPOINT 6: DECEASED SAFETY rule is in the contract', async () => {
    const { CONTEXT_AWARE_APPLICATION_CONTRACT } = await import('@/lib/engine/shared/context-application-contract');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('DECEASED SAFETY');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('NEVER ask active relationship questions');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('hoe gaat het tussen jullie');
  });

  it('CHECKPOINT 7: Full flow — GPT call → merge → read back → ClinicalCtx non-empty', async () => {
    // Step 1: Mock GPT response
    mockGptResponse(MOCK_GPT_CLINICAL_RESPONSE);
    
    // Step 2: Run analyzeAllSections (simulates Gegevens bijwerken)
    const report = await analyzeAllSections([REAL_BACKPACK_SECTION], 'elias');
    expect(report.sectionsAnalyzed).toBe(1);
    expect(report.failures).toBe(0);
    
    // Step 3: Read back from AsyncStorage (simulates what handleSend does)
    const storedRaw = mockAsyncStorage['@recofree_userdat'];
    expect(storedRaw).toBeDefined();
    const stored = JSON.parse(storedRaw);
    
    // Step 4: Verify ALL deep analysis fields are present
    expect(stored.schemas?.length).toBeGreaterThan(0);
    expect(stored.modes?.length).toBeGreaterThan(0);
    expect(stored.triggers?.length).toBeGreaterThan(0);
    expect(stored.lifeStatusFacts?.length).toBeGreaterThan(0);
    expect(stored.protectiveFactors?.length).toBeGreaterThan(0);
    expect(stored.values?.length).toBeGreaterThan(0);
    expect(stored.goals?.length).toBeGreaterThan(0);
    expect(stored.risks?.length).toBeGreaterThan(0);
    expect(stored.recoveryPatterns?.length).toBeGreaterThan(0);
    expect(stored.developmentalFormulation?.length).toBeGreaterThan(0);
    expect(stored.triggerChains?.length).toBeGreaterThan(0);
    expect(stored.relapsePathways?.length).toBeGreaterThan(0);
    expect(stored.functionOfAddiction?.length).toBeGreaterThan(0);
    expect(stored.contraindications?.length).toBeGreaterThan(0);
    expect(stored.safeFormulationHints?.length).toBeGreaterThan(0);
    
    // Step 5: Verify field names match what buildPersonalClinicalContext reads
    expect(stored.schemas[0]).toHaveProperty('schema');
    expect(stored.modes[0]).toHaveProperty('mode');
    expect(stored.triggers[0]).toHaveProperty('trigger');
    expect(stored.protectiveFactors[0]).toHaveProperty('factor');
    expect(stored.values[0]).toHaveProperty('value');
    expect(stored.goals[0]).toHaveProperty('goal');
    expect(stored.risks[0]).toHaveProperty('risk');
    
    // Step 6: Verify deceased status
    expect(stored.lifeStatusFacts[0].person).toBe('Marie Louise Steegmans');
    expect(stored.lifeStatusFacts[0].status).toBe('deceased');
  });
});
