# RecoFree Prompt Flow Audit

**Status:** READ-ONLY AUDIT — Zero code changes  
**Date:** 2026-08-18  
**Scope:** Backpack analysis → Greeting → Follow-up → Formulation application

---

## A. Samenvatting (10 regels)

1. **Backpack analysis** heeft twee lagen: basic extraction (server, Railway, gpt-4o-mini) en deep section analysis (client-triggered, Railway, gpt-4o-mini). Beide sturen raw backpack tekst naar GPT.
2. **Greeting** wordt server-led gegenereerd via `/api/session-greeting` met een client-built systemPrompt. De client stuurt backpack, userDat, diaryEntries, moodSliders, VSP level mee.
3. **Follow-up berichten** gaan via de minimal-gpt-proxy route met een client-built prompt die identity + contract + relationalStance + formulationBlock + personalAnchors + CMD memory + context bevat.
4. **contextDatSerialized** wordt ALLEEN gebouwd bij SESSION_INIT of backpack-dirty. Bij gewone follow-up berichten is dit veld undefined.
5. **personalAnchors** gaat WEL mee bij elke follow-up (gebouwd uit extractedEntities.persons).
6. **kimFormulationBlock** gaat apart mee als prominent blok in de prompt (sinds P1 fix).
7. **CMD selected memory** gaat mee als `[SELECTED CLINICAL MEMORY]` blok wanneer CMD flag actief en items geselecteerd.
8. **KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT** dwingt functioneel contextgebruik af — geen vaste zinnen, wel verplicht concrete formulation gebruiken.
9. **Gat:** er is GEEN expliciete laag voor previous-attempt check, communication-exhaustion, one-sided-input guard, of ageCategory-gebaseerde diepte.
10. **Gat:** contextDatSerialized (met schemas, modes, triggers, life status) bereikt GPT NIET bij follow-up berichten — alleen bij session start.

---

## B. Backpack Analysis Prompt Flow

### Laag 1: Basic Extraction (server-side)

| Aspect | Detail |
|--------|--------|
| **File** | `server/backpack-extractor.ts` |
| **Function** | `extractEntitiesFromBackpack(request, sourceHash)` |
| **Trigger** | Client calls `/api/trpc/ai.extractEntities` bij session start als entities leeg |
| **Input** | userName, userType, sections (Elias life phases), kimSections (Kim backpack), intakeContext |
| **Raw backpack** | JA — volledige tekst per sectie gaat naar GPT |
| **Persona** | JA — userType context ("loved one" vs "addiction recovery") |
| **Leeftijd** | NEE — niet meegegeven |
| **Model** | gpt-4o-mini (via invokeLLM → OpenAI fallback) |
| **store:false** | JA (via llm.ts OpenAI provider) |
| **Output** | `{ persons[], events[], patterns[], contexts[] }` |
| **Opslag** | `@recofree_userdat` → `extractedEntities` veld |
| **Hergebruik** | personalAnchors builder leest `extractedEntities.persons` |

### Laag 2: Deep Section Analysis (client-triggered)

| Aspect | Detail |
|--------|--------|
| **File** | `lib/backpack-extractor/section-analysis-service.ts` |
| **Function** | `analyzeBackpackSection(sectionId, sectionTitle, content, persona)` |
| **Trigger** | Backpack save + "Gegevens verversen" knop |
| **Input** | sectionId, sectionTitle, raw content, persona |
| **Raw backpack** | JA — volledige sectie-tekst |
| **Persona** | JA — als context in prompt |
| **Output** | `BackpackSectionAnalysisResult` (persons, relationGraph, lifeStatus, schemas, modes, triggers, protectiveFactors, values, goals, risks) |
| **Opslag** | Merged naar `@recofree_userdat` via merge rules |
| **Hergebruik** | personalAnchors builder, CMD selector, formulation engines |

### Voorbeeld Backpack Analysis Prompt (dummy data):

```
System: You are a precise clinical entity extractor. Output ONLY valid JSON.

User: You are a clinical entity extractor. Extract ALL structured information from the following personal narrative written by "Kris".
This person is someone dealing with addiction recovery.

[Kindertijd]: Ik ben opgegroeid in Antwerpen. Mijn moeder Ellen was altijd streng maar liefdevol. Mijn vader was afwezig.
[Relaties]: Mijn vriendin Melissa steunt mij enorm. Mijn zoon Jules is 5 jaar.

Respond with a JSON object matching this exact structure: { "persons": [...], "events": [...], "patterns": [...], "contexts": [...] }
```

---

## C. Greeting Prompt Flow

| Aspect | Detail |
|--------|--------|
| **Route** | Pipeline → `callServerEngine()` → `/api/session-greeting` op Railway |
| **Server file** | `server/session-greeting.ts` |
| **Client file** | `lib/rugzak/pipeline.ts` lijn 5095-5170 |
| **Prompt bron** | Client bouwt systemPrompt via server engine input (backpack, userDat, diary, mood, VSP) |
| **Model** | gpt-4o-mini |
| **store:false** | JA |
| **Temperature** | 0.7 |

### Wat bereikt GPT bij greeting:

| Laag | Bereikt GPT? | Via |
|------|-------------|-----|
| Backpack (raw) | JA | serverInput.backpack |
| UserDat | JA | serverInput.userDat |
| Diary entries | JA | serverInput.diaryEntries |
| Mood sliders | JA | serverInput.moodSliders |
| VSP level | JA | serverInput.vspLevel |
| VSP Insight context | JA | vspInsightContext string |
| Prevention plan | JA | serverInput.preventionPlan |
| Personal anchors | NEE — niet apart in greeting |
| CMD memory | NEE — CMD draait niet bij greeting |
| Formulation | NEE — formulation draait niet bij greeting |
| contextDatSerialized | NEE — niet bij server-led greeting |
| Rejected suggestions | NEE — sessie net gestart |
| ageCategory | NEE — bestaat niet |

### Verschil Elias vs Kim bij greeting:

- **Elias:** VSP = Veiligheidsplan, prevention plan = hervalpreventie, modules = RETP/STOA/etc.
- **Kim:** VSP = Eigen Regie Plan, prevention plan = zelfzorgplan, modules = K01/K02/etc.
- Beide ontvangen dezelfde data-structuur maar met persona-specifieke content.

---

## D. Follow-up Message Prompt Flow

| Aspect | Detail |
|--------|--------|
| **Route** | Pipeline → openai-provider → `/api/minimal-gpt-proxy` op Railway |
| **Client file** | `lib/ai/openai-provider.ts` lijn 845-920 |
| **Prompt builder** | `lib/ai/prompt/client-system-prompt-builder.ts` |
| **Composer** | `lib/ai/prompt/kim-prompt-composer.ts` of `elias-prompt-composer.ts` |
| **Model** | gpt-4o-mini (light) of gpt-4o-2024-08-06 (heavy/crisis) via epistemic routing |
| **store:false** | JA (server-side hardcoded) |

### Wat bereikt GPT bij follow-up:

| Laag | Bereikt GPT? | Via | Opmerking |
|------|-------------|-----|-----------|
| Identity + Contract | JA | sections.identity | KIM_IDENTITY + KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT |
| relationalStanceDirective | JA | sections.relationalStance | Stance filter + depth directive |
| kimFormulationBlock | JA | sections.formulationBlock | Prominent apart blok (since P1) |
| eliasFormulationBlock | JA | sections.formulationBlock | Elias recovery formulation |
| personalAnchors | JA | `[PERSONAL ANCHORS]` blok | Max 7 personen, format "Jules: zoon" |
| CMD memory | JA | `[SELECTED CLINICAL MEMORY]` blok | Wanneer flag actief + items geselecteerd |
| rejectedSuggestions | JA | Rejected suggestions blok | Sessie-only |
| contextDatSerialized | **ALLEEN bij SESSION_INIT of backpack-dirty** | sections.context | Bij gewone follow-up = undefined! |
| contextSummary | SOMS | sections.context (fallback) | Alleen als contextDat niet gebouwd |
| Backpack (raw) | NEE | Niet bij minimal proxy | Alleen bij server-led greeting |
| UserDat (raw) | NEE | Niet bij minimal proxy | Alleen extractedEntities → personalAnchors |
| Diary entries | NEE | Niet bij follow-up | Alleen bij greeting |
| Mood sliders | JA (indirect) | Via pipeline analysis → module routing | Niet als apart prompt blok |
| VSP level | JA (indirect) | Via depth resolver | Niet als apart prompt blok |
| schemas/modes/triggers | **NEE bij follow-up** | Zitten in contextDat maar die is undefined | GROOT GAT |
| relationGraph | NEE | Alleen in personalAnchors (basic format) | Geen edge-details naar GPT |
| lifeStatus | NEE | Niet naar GPT | Alleen in user.dat |
| projections.dat | SOMS | projectionContext | Alleen als pipeline het bouwt |
| Conversation history | JA | recentHistory (conversation window) | Laatste N berichten |

### Verschil eerste bericht vs follow-up:

| Aspect | Eerste bericht (greeting) | Follow-up bericht |
|--------|--------------------------|-------------------|
| Route | `/api/session-greeting` | `/api/minimal-gpt-proxy` |
| Backpack raw | JA | NEE |
| contextDatSerialized | JA (als gebouwd) | NEE (undefined) |
| personalAnchors | NEE (niet in greeting) | JA |
| Formulation | NEE | JA |
| CMD memory | NEE | JA |
| Conversation history | Leeg | Laatste N berichten |
| Model | gpt-4o-mini | gpt-4o-mini of gpt-4o (epistemic routing) |

---

## E. Welke memorylagen bereiken GPT werkelijk?

| Laag | Bij greeting | Bij follow-up | Opmerking |
|------|-------------|---------------|-----------|
| Backpack raw text | JA | NEE | |
| extractedEntities → personalAnchors | NEE | JA | Max 7 personen |
| contextDatSerialized (schemas, modes, triggers, life status) | JA (session init) | NEE | **GROOT GAT** |
| CMD selected memory | NEE | JA (als flag actief) | |
| Kim formulation (mustMention/mustAvoid) | NEE | JA | |
| Elias formulation | NEE | JA | |
| relationalStanceDirective | NEE | JA | |
| rejectedSuggestions | NEE | JA | |
| Diary entries | JA | NEE | |
| VSP/ERP level | JA (indirect) | JA (indirect via depth) | |
| projections.dat | NEE | SOMS | |
| state.dat | Alleen via contextDat | NEE bij follow-up | |
| logs.dat | Alleen via contextDat | NEE bij follow-up | |

---

## F. Welke memorylagen worden WEL opgeslagen maar NIET toegepast?

| Laag | Opgeslagen in | Bereikt GPT? | Status |
|------|--------------|-------------|--------|
| relationGraph (edges) | user.dat (via section analysis) | NEE | Alleen basic "Jules: zoon" in personalAnchors |
| lifeStatus facts | user.dat (via section analysis) | NEE | Nooit naar GPT |
| schemas (from analysis) | user.dat | Alleen via contextDat bij session init | Niet bij follow-up |
| modes (from analysis) | user.dat | Alleen via contextDat bij session init | Niet bij follow-up |
| triggers (from analysis) | user.dat | Alleen via contextDat bij session init | Niet bij follow-up |
| protectiveFactors | user.dat | NEE | Nooit naar GPT |
| values | user.dat | NEE | Nooit naar GPT |
| goals | user.dat | NEE | Nooit naar GPT |
| risks | user.dat | NEE | Nooit naar GPT |
| state.dat (current emotional state) | AsyncStorage | Alleen via contextDat bij session init | Niet bij follow-up |
| projections.dat (fears/hopes) | AsyncStorage | SOMS via projectionContext | Inconsistent |

---

## G. Waar zit het gat tussen "RecoFree weet het" en "GPT gebruikt het"?

### GAT 1: contextDatSerialized bereikt GPT NIET bij follow-up
De rijkste context (schemas, modes, triggers, life status, state.dat, projections.dat) wordt alleen bij session start gebouwd. Bij follow-up berichten is dit veld `undefined`. GPT mist dus alle schema/mode/trigger informatie na het eerste bericht.

### GAT 2: Deep analysis resultaten (relationGraph, lifeStatus, protectiveFactors, values, goals, risks) bereiken GPT NOOIT
De section analysis extraheert deze data en slaat ze op in user.dat, maar er is geen prompt-sectie die ze naar GPT stuurt.

### GAT 3: Geen previous-attempt check
Er is geen mechanisme dat checkt of GPT dezelfde suggestie al eerder heeft gegeven (behalve de rejected suggestion guard die alleen expliciet afgewezen suggesties blokkeert).

### GAT 4: Geen communication-exhaustion check
Er is geen detectie van "de gebruiker heeft dit al 5x gezegd en GPT herhaalt steeds hetzelfde."

### GAT 5: Geen one-sided-input guard
Er is geen mechanisme dat GPT waarschuwt dat het alleen het perspectief van één partij hoort.

### GAT 6: Geen ageCategory-gebaseerde communicatiediepte
Leeftijd/ageCategory wordt nergens geëxtraheerd of gebruikt voor communicatiestijl-aanpassing.

### GAT 7: Greeting mist personalAnchors
De greeting kent de personen niet (personalAnchors wordt alleen bij follow-up meegegeven, niet bij greeting).

---

## H. Exacte File Paths en Functies

| Functie | File | Lijn |
|---------|------|------|
| Backpack basic extraction prompt | `server/backpack-extractor.ts` | `buildExtractionPrompt()` |
| Backpack section analysis prompt | `lib/backpack-extractor/section-analysis-service.ts` | `SECTION_ANALYSIS_PROMPT` |
| Greeting server route | `server/session-greeting.ts` | `registerSessionGreetingRoute()` |
| Greeting pipeline | `lib/rugzak/pipeline.ts` | lijn 4881-5170 |
| Follow-up prompt builder | `lib/ai/prompt/client-system-prompt-builder.ts` | `buildClientSystemPrompt()` |
| Kim prompt composer | `lib/ai/prompt/kim-prompt-composer.ts` | `composeKimPrompt()` |
| Elias prompt composer | `lib/ai/prompt/elias-prompt-composer.ts` | `composeEliasPrompt()` |
| Kim formulation block builder | `lib/ai/prompt/kim-prompt-composer.ts` | `buildKimRelationalFormulationBlock()` |
| PersonalAnchors builder | `lib/rugzak/pipeline.ts` | `buildPersonalAnchorsBlock()` |
| Minimal proxy route (openai-provider) | `lib/ai/openai-provider.ts` | lijn 845-920 |
| Context.dat distiller | `lib/pipeline/context-dat-distiller.ts` | `distillContextDat()` |
| Context.dat serializer | `lib/pipeline/context-dat-distiller.ts` | `serializeContextDatForGPT()` |
| CMD budget selector | `lib/engine/shared/clinical-memory-distillation/` | `selectClinicalMemoryForPrompt()` |
| Functional context use contract | `lib/engine/kim/prompt-block.ts` | `KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT` |

---

## I. Conclusie: Wat moet later gebouwd worden (niet nu bouwen)

1. **contextDat bij follow-up:** Cache contextDatSerialized na session init en stuur het mee bij elke follow-up (of herbouw het periodiek).
2. **Deep analysis → prompt:** Bouw een prompt-sectie die relationGraph edges, lifeStatus, protectiveFactors, values, goals naar GPT stuurt.
3. **personalAnchors bij greeting:** Stuur personalAnchors ook mee bij de greeting prompt.
4. **Previous-attempt tracker:** Houd bij welke concrete suggesties GPT al heeft gegeven en blokkeer herhaling.
5. **Communication-exhaustion detector:** Detecteer wanneer dezelfde thema's herhaald worden zonder voortgang.
6. **One-sided-input guard:** Voeg een prompt-instructie toe die GPT waarschuwt dat het alleen één perspectief hoort.
7. **ageCategory extraction + communicatiediepte:** Extraheer leeftijd uit backpack en pas communicatiestijl aan.
8. **Schemas/modes/triggers bij follow-up:** Zorg dat deze data niet alleen bij session init maar ook bij follow-up berichten GPT bereikt.

---

**Geen code gewijzigd. Geen bestanden aangemaakt (behalve dit rapport). Geen tests aangepast.**
