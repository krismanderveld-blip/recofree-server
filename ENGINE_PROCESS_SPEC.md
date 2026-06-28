# `/api/engine-process` — Technische Specificatie

**Doel:** Server-side migratie van de klinische engine. Dit endpoint verplaatst de volledige pre-GPT beslislogica (momenteel client-side in `lib/rugzak/pipeline.ts`) naar de server. De client stuurt ruwe input (sliders, bericht, profiel); de server voert alle klinische stappen uit, roept GPT aan, en retourneert zowel het antwoord als state-patches die de client lokaal persisteert.

**Status:** Specificatie — niet bouwen.

---

## 1. Architectuuroverzicht

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (React Native)                                          │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐   │
│  │ Sliders  │   │ Message  │   │ Local Encrypted Storage  │   │
│  │ (mood)   │   │ (text)   │   │ user.dat / state.dat     │   │
│  └────┬─────┘   └────┬─────┘   │ logs.dat / backpack      │   │
│       │               │         └────────────┬─────────────┘   │
│       └───────┬───────┘                      │                 │
│               ▼                              ▼                 │
│       ┌───────────────────────────────────────────┐            │
│       │  POST /api/engine-process                 │            │
│       │  (EngineProcessRequest)                   │            │
│       └───────────────────────┬───────────────────┘            │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTPS (encrypted transit)
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│  SERVER                                                           │
│                                                                   │
│  1. analyzeState()         → StateAnalysis                        │
│  2. analyzeBackpackRelevance() → triggers, relevance              │
│  3. selectDominantState()  → DominantState                        │
│  4. loopblocker + mid-session re-eval                             │
│  5. getBufferSnapshot()    → BufferSnapshot                       │
│  6. runProjectionLayer()   → projectionContext                    │
│  7. applyRegulation()      → regulationResult                     │
│  8. routeEngineDirective() → engineDirective                      │
│  9. SignalEngine (relevance + context summary)                     │
│  10. relapseIntentDetection → zone escalation                     │
│  11. VSP Insight Layer                                            │
│  12. pastReferenceSearch                                          │
│  13. buildSystemPrompt() + OpenAI call                            │
│  14. clinicalAnnotation (separate gpt-4o call)                    │
│                                                                   │
│  → EngineProcessResponse (response + statePatches)                │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│  CLIENT                                                           │
│  • Toont response in chat UI                                      │
│  • Schrijft statePatches naar lokale encrypted storage             │
│  • Toont emergency overlay indien showEmergency = true            │
│  • Toont clinical tag indien clinicalModeActive                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Request Schema — `EngineProcessRequest`

De client stuurt twee typen requests: **SESSION_INIT** (eerste bericht van een sessie, bevat volledige statische context) en **LIVE_MESSAGE** (vervolgberichten, bevat alleen dynamische data).

### 2.1 Altijd aanwezig (beide typen)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `userType` | `"elias" \| "kim"` | Actieve persona |
| `userName` | `string` | Voornaam gebruiker |
| `message` | `string` | Huidig gebruikersbericht |
| `conversationHistory` | `Array<{ role: "user" \| "assistant"; content: string }>` | Volledige sessie-conversatie (max 20 berichten, recency-weighted) |
| `moodSliders` | `Record<string, number>` | Huidige slider-waarden (0–10 schaal). Elias: craving, frustration, despondency, focus. Kim: stress, boundaryFatigue, emotionalBurden, selfCare |
| `isSessionStart` | `boolean` | `true` = SESSION_INIT, `false` = LIVE_MESSAGE |
| `locale` | `"nl" \| "en" \| "fr"` | Taalvoorkeur gebruiker |
| `country` | `"NL" \| "BE" \| "FR" \| "UK" \| "US"` | Land (bepaalt crisisnummers) |
| `guidanceDepth` | `"light" \| "normal" \| "deep"` | Door gebruiker gekozen begeleidingsdiepte |
| `clinicalModeActive` | `boolean` | Of klinische annotaties gegenereerd moeten worden |

### 2.2 SESSION_INIT only (statische context, server-side gecached)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `backpack` | `Backpack \| null` | Volledige rugzak (levensverhaal, intake, Kim-specifieke secties). Structuur: `{ naam, userType, lifeStory: [{ id, label, ageRange, content }], kimBackpack?: { my_story, the_relationship, the_impact, my_boundaries, my_strength }, intakeContext: { startEmotion, urgency, initialContext, intakeDate }, createdAt }` |
| `userDat` | `UserDatSummary` | Samenvatting van user.dat (zie §2.4) |
| `diaryEntries` | `Array<{ content, moodTag, timestamp }>` | Laatste 5 dagboekfragmenten |
| `coreWound` | `string \| null` | Kernwond (uit backpack-analyse) |
| `contextLine` | `string \| null` | Eenregelige context voor GPT |
| `relationshipAnchor` | `{ name, role, roleEN? } \| null` | Primaire relatieankerpersoon |
| `stageOfChange` | `string \| null` | Fase van verandering (Prochaska) |
| `relationalPattern` | `{ pattern, schema, confidence } \| null` | Gedetecteerd relationeel patroon |
| `extractedEntities` | `ExtractedEntities \| null` | Gestructureerde entiteiten uit backpack (personen, events, patronen, contexten) |
| `backpackAnalysis` | `BackpackAnalysis \| null` | GPT-4o deep analysis (schemas, modi, triggers, coreBeliefs, copingPatterns) |

### 2.3 LIVE_MESSAGE only (dynamische per-bericht data)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `relevanceScores` | `{ backpackRelevance, diaryRelevance, triggerRelevance, projectionRelevance }` | SignalEngine relevance scores (0–1) voor context gating |
| `contextSummary` | `string \| null` | Gecomprimeerde context (vervangt full backpack in follow-ups) |

### 2.4 `UserDatSummary` (subset van user.dat)

```typescript
interface UserDatSummary {
  totalSessions: number;
  triggerPatterns: Array<{
    trigger: string;
    count: number;
    firstSeen: string;   // ISO timestamp
    lastSeen: string;    // ISO timestamp
  }>;
  moodHistory: Array<{
    sliders: Record<string, number>;
    timestamp: string;   // ISO timestamp
  }>;  // Laatste 14 entries
  moduleUsageSummary: string[];
  lastSessionDate: string | null;
  sessionAnalyses: Array<{
    sessionNumber: number;
    date: string;
    messageCount: number;
    durationMinutes: number;
    dominantEmotion: string;
    themes: string[];
    newTriggers: string[];
    modulesUsed: string[];
    moodDelta: { distressChange: number; resilienceChange: number };
    endRiskLevel: string;
  }>;  // Laatste 10 sessies
  relapseIntentLog?: Array<{
    timestamp: string;
    source: "gpt" | "fallback";
    confidence: number;
    sessionNumber: number;
  }>;  // Laatste 5 events
  repeatingPatterns?: Array<{
    theme: string;
    sessionCount: number;
    progressionDetected: boolean;
  }>;
  guidanceDepth: "light" | "normal" | "deep";
  currentMood: Record<string, number>;
}
```

### 2.5 Optionele velden (beide typen, indien beschikbaar)

| Veld | Type | Beschrijving |
|------|------|-------------|
| `vspSection` | `VspSection \| null` | VSP-data (Elias): per-zone signals, whatHelps, anchorSentence |
| `logsSessions` | `Array<SessionLog>` | Vorige sessie-logs (voor past-reference search) |
| `usedModules` | `string[]` | Modules al gebruikt in huidige sessie (voor loopblocker) |
| `previousZoneScore` | `number` | Vorige zone-score in sessie (voor trajectory) |
| `messageCount` | `number` | Aantal berichten in huidige sessie |

---

## 3. Response Schema — `EngineProcessResponse`

```typescript
interface EngineProcessResponse {
  // ─── GPT Output ───
  response: string;                    // Therapeutisch antwoord (zonder <clinical> tag)
  clinicalAnnotation?: string;         // <clinical>...</clinical> block (alleen als clinicalModeActive)

  // ─── State Patches (client schrijft lokaal) ───
  statePatches: {
    riskLevel: "low" | "moderate" | "high" | "critical";
    crisisLevel: 0 | 1 | 2;
    emotionalState: "stable" | "vulnerable" | "depleted" | "crisis";
    dominantModule: string;            // E01-E08, K01-K06, of speciale module-IDs
    moduleActivations: Array<{
      id: string;
      confidence: number;
      mode: string;
    }>;
    bufferSnapshot: {
      zoneScore: number;               // 0-100
      zoneColor: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PURPLE";
      liveIntent: "venting" | "reflecting" | "seeking_action" | "seeking_reassurance" | "testing" | "withdrawing" | "crisis" | "neutral";
      intensityTrajectory: "rising" | "stable" | "falling";
      currentEmotion: string;
      responseDirection: "stabilize" | "reflect" | "direct" | "contain" | "crisis_override" | "explore";
      messageCount: number;
    };
    regulationResult?: {
      action: string;
      intervention: string | null;
      zone: string;
      effectiveDepth: string;
      wasSoftened: boolean;
      wasSkipped: boolean;
    };
    moodTrend: "improving" | "stable" | "declining" | "volatile";
    relapseIntentDetected?: boolean;
    projectionUpdates?: Array<{
      category: "fear" | "hope" | "goal";
      content: string;
      strength: number;
      isNew: boolean;
    }>;
    // Nieuwe triggers gedetecteerd in dit bericht
    newTriggers?: string[];
    // Loopblocker status
    loopDetected?: {
      theme: string;
      sessionCount: number;
    };
  };

  // ─── Metadata ───
  advisoryEmotion: string;             // Gedetecteerde emotie (voor UI feedback)
  advisoryConfidence: number;          // 0-1
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  selectedModel: string;               // "gpt-4o" | "gpt-4o-mini"
  showEmergency: boolean;              // true = toon emergency overlay met crisisnummers
  status: "OK" | "CRISIS_MODE" | "BLOCKED_PRECHAT_REQUIRED";
}
```

---

## 4. Server-side Processing Pipeline

De server voert de volgende stappen uit in volgorde. Dit is een directe migratie van de huidige client-side `processMessage()` in `lib/rugzak/pipeline.ts`.

### Stap 1: State Analysis
```
analyzeState(rugzak, message) → StateAnalysis
```
Bepaalt: `riskLevel`, `emotionalState`, `moodTrend`, `activeTriggers`, `tone`, `pacing`, `suggestionIntensity`, `crisisMonitoring`, `priorityModules`.

### Stap 2: Backpack Relevance Analysis
```
analyzeBackpackRelevance(message, backpack, userDat, currentMood, priorityModule) → { triggers, relevance }
```
Selecteert maximaal 2 relevante triggers uit backpack op basis van het huidige bericht.

### Stap 3: Dominant State Selection
```
selectDominantState(buffer, analysis, mood, userType, triggerPatterns, priorityModules, vspContext?) → DominantState
```
Bepaalt de **enkele dominante module** voor dit antwoord. Source layers (prioriteit): `crisis > live_trigger > extreme_slider > session_pattern > userdat_pattern > short_module_keyword > backpack_relevance > default`.

### Stap 4: Loopblocker + Mid-Session Re-evaluation
- **Loopblocker:** Als de geselecteerde module al eerder in de sessie is gebruikt (en het geen crisis is), selecteer een alternatief.
- **Mid-session re-eval (Elias, na 3+ berichten):** Als trajectory `falling` + grounding module → switch naar exploration. Als trajectory `rising` + exploration → switch naar grounding.

### Stap 5: Buffer Snapshot
```
getBufferSnapshot(buffer, dominantState, selectedTriggers) → BufferSnapshot
```
Stabiele snapshot van de sessie-buffer met zone, intent, emotion, trajectory.

### Stap 6: Projection Layer
```
runProjectionLayer({ userType, message, dominantModule, vspLevel, distressScore, resilienceScore, ... }) → ProjectionResult
```
Detecteert toekomstgerichte signalen (fears, hopes, goals) en genereert injectieblok voor GPT.

### Stap 7: Regulation Layer
```
applyRegulation(resolvedZone, guidanceDepth, previousAssistantContent) → RegulationResult
```
Bepaalt of GPT een interventie mag geven, moet softenen, of moet overslaan. Voorkomt herhaling.

### Stap 8: Engine Directive (Zone → Impact)
```
routeEngineDirective({ userType, eliasZone, kimZone }) → EngineDirective
```
Vertaalt zone-berekening naar concrete impact-instructies voor GPT (toon, diepte, focus).

### Stap 9: Signal Engine (GPT-4o-mini)
- `detectSignals()` → fears, hopes, goals, triggers (semantisch)
- `scoreRelevance()` → backpack/diary/trigger/projection relevance scores
- `summarizeContext()` → gecomprimeerde context voor follow-up berichten

### Stap 10: Relapse Intent Detection
- **GPT-path:** `detectRelapseIntent(message)` via SignalEngine
- **Deterministic fallback:** NL/EN/FR keyword markers
- **Zone escalation:** Bij detectie (confidence ≥ 0.6) → minimaal ORANJE

### Stap 11: VSP Insight Layer
```
runVspInsightLayer({ persona, userMessage, recentMessages, moodSliders, selfReportedZone, ... }) → VspInsightResult
```
Framework-selectie (MI/MBT/DGT) op basis van conversatie-inhoud. Muteert NOOIT de safety core.

### Stap 12: Past-Reference Search
```
searchPastReferences(message, logsSessions, userDat) → { found, contextForGPT }
```
Detecteert verwijzingen naar eerdere sessies en injecteert relevant context.

### Stap 13: System Prompt Build + OpenAI Call
```
buildSystemPrompt(input) → systemPrompt
fetch('https://api.openai.com/v1/chat/completions', { model, messages, ... })
```
Bouwt het volledige system prompt op basis van alle voorgaande stappen. Model-selectie: `gpt-4o` bij ORANJE+ of vspLevel ORANJE+, anders `gpt-4o-mini`.

### Stap 14: Clinical Annotation (optioneel)
Aparte `gpt-4o` call (altijd, `store: false`) die een `<clinical>` blok genereert. Alleen uitgevoerd als `clinicalModeActive = true`.

---

## 5. Beveiligingsmodel

### Transit-only principe
De server slaat **geen persoonlijke data persistent op**. Alle verwerking is in-memory per request.

| Aspect | Implementatie |
|--------|--------------|
| **Opslag** | Geen database, geen filesystem writes van gebruikersdata |
| **Session cache** | In-memory, single-user, alleen voor SESSION_INIT → LIVE_MESSAGE optimalisatie. Verwijderd na sessie-einde of timeout (10 min inactiviteit) |
| **OpenAI API** | `store: false` op alle calls — OpenAI bewaart geen data |
| **Transport** | HTTPS verplicht, TLS 1.3 |
| **Logging** | Alleen metadata (model, tokens, latency). Geen berichtinhoud in server logs |
| **Persona guard** | Server valideert `userType` tegen cache; mismatch → cache invalidatie |

### Data die NOOIT de server verlaat (blijft op device)
- Volledige user.dat (alleen `UserDatSummary` subset wordt verstuurd)
- Volledige logs.dat (alleen relevante fragmenten via `logsSessions`)
- Encryptiesleutels
- Biometrische data
- Volledige moodHistory (alleen laatste 14 entries)

### State patches — client-side persistentie
De server retourneert `statePatches` die de client lokaal schrijft naar encrypted storage. De server bewaart deze patches niet. Dit garandeert dat:
1. Alle persoonlijke state op het device blijft
2. De server stateless is (kan horizontaal schalen)
3. Bij device-verlies is er geen server-side backup (privacy by design)

---

## 6. Foutafhandeling

| Scenario | Server response | Client actie |
|----------|----------------|-------------|
| OpenAI timeout (>30s) | `{ status: "ERROR", error: "OPENAI_TIMEOUT" }` | Toon contextual fallback (mood/diary/session-based) |
| OpenAI rate limit | `{ status: "ERROR", error: "RATE_LIMITED", retryAfter: number }` | Wacht en retry |
| Invalid request (Zod validation) | HTTP 400 + validation errors | Log error, toon generieke fallback |
| Crisis detected mid-processing | Verwerk volledig, `showEmergency: true` | Toon emergency overlay onmiddellijk |
| SignalEngine failure | Non-blocking: skip signals, continue pipeline | Geen impact op gebruiker |
| Server crash | HTTP 500 | Client gebruikt contextual deterministic fallback |

---

## 7. Performance Budget

| Metric | Target | Huidige baseline (client-side) |
|--------|--------|-------------------------------|
| Total latency (P95) | < 4000ms | ~2500ms (client engine) + ~1500ms (GPT) |
| Engine processing (server) | < 500ms | ~200ms (client-side, single-threaded) |
| GPT call (gpt-4o-mini) | < 2000ms | ~1200ms gemiddeld |
| GPT call (gpt-4o) | < 4000ms | ~2500ms gemiddeld |
| Clinical annotation | < 1500ms | ~800ms (parallel met response delivery) |
| Payload size (request) | < 50KB (SESSION_INIT), < 10KB (LIVE_MESSAGE) | ~35KB / ~8KB huidig |
| Payload size (response) | < 15KB | ~5KB huidig |

---

## 8. Migratiestrategie

### Fase 1: Dual-mode (feature flag)
```typescript
const ENGINE_MODE = process.env.EXPO_PUBLIC_ENGINE_MODE; // 'client' | 'server'
```
- Client-side engine blijft intact
- Nieuwe `/api/engine-process` endpoint parallel beschikbaar
- Feature flag bepaalt welke path actief is
- A/B testing mogelijk op response kwaliteit

### Fase 2: Validatie
- Vergelijk client-side en server-side output voor dezelfde inputs
- Monitoring op: zone-berekening consistency, module-selectie agreement, crisis-detectie recall
- Minimaal 100 sessies dual-mode voordat client-side wordt uitgeschakeld

### Fase 3: Client-side removal
- Verwijder `lib/engine/` en `lib/rugzak/` uit de Lite build
- MDR build behoudt client-side als fallback
- Lite build wordt afhankelijk van server-side engine

---

## 9. Verschil met huidige `/api/trpc/ai.chat`

| Aspect | Huidig (`ai.chat`) | Nieuw (`engine-process`) |
|--------|--------------------|-----------------------|
| Engine logica | Client-side (app-build) | Server-side |
| Server rol | "Dumb GPT proxy" — bouwt prompt, roept OpenAI | Volledige klinische pipeline + GPT |
| Client stuurt | Pre-computed: zone, module, riskScore, bufferSnapshot, regulationResult, engineDirective, 60+ velden | Ruwe input: sliders, bericht, profiel-subset |
| Server retourneert | `{ response, advisoryEmotion, advisoryConfidence, tokenUsage, selectedModel }` | `{ response, statePatches, clinicalAnnotation, showEmergency, status, ... }` |
| State management | Client berekent + persisteert alles | Server berekent, client persisteert (patches) |
| IP-bescherming | Klinische logica in app-build (reverse-engineerable) | Klinische logica server-side (beschermd) |
| Offline capability | Volledig (engine draait lokaal) | Geen (server vereist) |
| Payload grootte | Groot (60+ velden, veel redundantie) | Klein (ruwe input only) |

---

## 10. Open vragen voor implementatie

1. **Offline fallback:** Moet de Lite build een minimale client-side fallback hebben voor wanneer de server onbereikbaar is? Of is "geen verbinding = geen chat" acceptabel?

2. **Session state synchronisatie:** Bij meerdere devices (toekomstig): hoe synchroniseren statePatches? Opties: (a) device is master, geen sync; (b) server slaat encrypted patches tijdelijk op voor sync.

3. **Rate limiting:** Per-user rate limits op engine-process? Huidige pricing model (5 gratis/maand, €1/extra) vereist server-side counting.

4. **Caching strategie:** Moet de server SESSION_INIT data cachen voor de duur van een sessie (zoals nu), of elke request volledig stateless verwerken?

5. **Clinical annotation kosten:** Aparte gpt-4o call per bericht is ~$0.01 extra. Alleen voor premium users? Of alleen in clinical mode?

---

## 11. Relatie tot RecoFree Lite

Dit endpoint is de **enabler** voor de Lite/MDR split:

- **Lite build:** Geen `lib/engine/`, geen `lib/rugzak/`. Stuurt ruwe input naar `/api/engine-process` met `appMode: "lite"`. Server past vereenvoudigd prompt toe (welzijns-framing, geen klinische termen, guidance depth altijd "light").
- **MDR build:** Kan kiezen tussen client-side engine (offline) of server-side engine (online). Volledige klinische pipeline in beide gevallen.

De server-side engine maakt het mogelijk om klinische IP te beschermen (niet in de app-build) terwijl de Lite versie toch intelligente, contextbewuste responses kan geven zonder de volledige therapeutische module-structuur bloot te leggen.
