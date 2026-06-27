# RecoFree — Greeting Architectuur: Hoe de Begroeting Tot Stand Komt

**Doel:** Documenteren hoe de huidige greeting werkt, zonder iets te wijzigen. Referentie voor herontwerp.

---

## 1. Trigger & Moment

De greeting wordt gegenereerd wanneer de **Chat-tab focus krijgt** in de app, onder de volgende voorwaarden:

| Voorwaarde | Toelichting |
|---|---|
| `preChatDone === true` | De pre-chat gate (VSP-thermometer keuze) is voltooid |
| `greetingSent === false` | Er is nog geen greeting in deze sessie verstuurd |
| Backpack + UserDat bestaan | Basisdata is geladen |

**Volgorde ten opzichte van de hoofd-engine:**

```
1. Gebruiker opent Chat-tab
2. Pre-chat gate (VSP-thermometer) → preChatDone = true
3. ──► GREETING wordt gegenereerd (sessionInitGreetingStep)
4. startSession() wordt aangeroepen (sessie-lifecycle begint)
5. Hoofd-engine (pipeline.ts processMessage) wacht op eerste gebruikersbericht
```

De greeting loopt **VÓÓR** de hoofd-engine. De pipeline (`processMessage`) wordt pas actief wanneer de gebruiker daadwerkelijk een bericht typt. De greeting is een apart pad dat rechtstreeks naar een eigen server-endpoint gaat (`/api/session-greeting`), niet via de reguliere chat-pipeline.

**Bestand:** `app/(tabs)/chat.tsx` (focus hook ~regel 368-420, greeting-prep ~regel 521-668)

---

## 2. Bronnen

De greeting put uit de volgende bronnen, die allemaal vóór de engine-call worden opgehaald in `chat.tsx`:

| Bron | Wat wordt geladen | Bestand |
|---|---|---|
| **logs.dat** (via lifecycle manager) | `lastSessionSummary` (narrative, topics, tensions, follow-up, emotionalArc) + `allSessions` (alle sessie-logs) | `chat.tsx` regels 516-537 |
| **chatHistory** (vorige sessie) | Laatste 5 berichten uit de vorige sessie (raw user/assistant messages) | `chat.tsx` regels 589-607 |
| **UserDat** | Sessie-statistieken, schemaTendencies, mood sliders, backpack-analyse, schemaRotationState | `sessionInitGreetingStep.ts` → `adaptUserDat()` |
| **Backpack** | Naam, levensverhaal (niet direct in greeting, wel voor naam-extractie) | `sessionInitGreetingStep.ts` → `adaptUserDat()` |
| **StateDat** (mood/sliders) | Huidige mood-waarden, VSP-zone, moodLastUpdatedAt | `sessionInitGreetingStep.ts` → `adaptStateDat()` |
| **Diary entries** | Laatste 10 dagboek-entries (gefilterd op type: journal + gratitude) | `chat.tsx` regels 448-456 |
| **Projections.dat** | Actieve angsten/hoop met decay-scores | `sessionInitGreetingStep.ts` → `adaptProjectionsDat()` |
| **VSP-sectie** (uit Backpack) | Signalen, wat helpt, ankerzin, triggers, tegenzinnen, herstelregels per zone | `sessionInitGreetingStep.ts` → `adaptVspSection()` |
| **VSP Insight Context** | Optionele klinische context-string | `chat.tsx` regels 557-587 |

---

## 3. Voorrang/Selectie — Hoe wordt bepaald welke bron gebruikt wordt?

De selectie verloopt in **drie stappen**:

### Stap A: Kandidaten scoren (`buildGreetingSynthesisCandidates.ts`)

Elke bron wordt een **kandidaat** met een relevance-score. Er zijn 8 mogelijke kandidaat-types:

| Kandidaat-type | Base score | Valence | Timestamp-bron |
|---|---|---|---|
| `TODAY_MOOD` | 0.75-0.95 (afhankelijk van interpretatie) | positive/negative/neutral | `moodLastUpdatedAt` |
| `RECENT_DIARY` | Lineair 0.3-1.0 op basis van leeftijd (max 3 dagen) | Inferred uit content | `latestEntryCreatedAt` |
| `RECENT_GRATITUDE` | Lineair 0.3-1.0 op basis van leeftijd (max 3 dagen) | Altijd positive | `latestEntryCreatedAt` |
| `BACKPACK_RECENT_UPDATE` | 0.85 (vast) | Neutral | `backpackLastUpdatedAt` |
| `ACTIVE_HOPE_OR_FEAR` | min(decayScore, 0.90) | Negative | `lastReinforcedAt` |
| `SCHEMA_ROTATION` | 0.65 (vast, elke 4e sessie) | Neutral | Geen timestamp |
| `LAST_SESSION_SUMMARY` | 0.85-0.90 (afhankelijk van open loops) | Neutral | `recentSessionDigests[0].endedAt` |
| `RECURRING_PATTERN` | max 0.85 (confidence × 0.90) | Neutral | Geen timestamp |

**Zone-modifier:** Elke score wordt vermenigvuldigd met een zone-factor:
- GROEN: alles ×1.0
- GEEL: positive ×0.55, negative ×1.25
- ORANJE: positive ×0.35, negative ×1.40
- ROOD/PAARS: positive ×0.20, negative ×1.50

**Recency bonus (timestamp-based):** Na zone-modifier worden de kandidaten gerangschikt op timestamp (meest recent eerst). De top-3 krijgen een bonus:
- Rang 1 (meest recent): **+0.20**
- Rang 2: +0.08
- Rang 3: +0.02

Dit is het mechanisme dat bedoeld is om de meest recente bron te laten domineren.

### Stap B: Bronnen selecteren (`selectGreetingSynthesisSources.ts`)

Na scoring worden maximaal **3 bronnen** geselecteerd:

1. **CONTINUITY RULE:** `LAST_SESSION_SUMMARY` wordt ALTIJD als eerste geselecteerd wanneer eligible (niet competitief — dit is de recente fix)
2. De overige eligible kandidaten worden gesorteerd op `relevanceScore` (aflopend)
3. De top-2 resterende worden toegevoegd (tot max 3 totaal)
4. **Balance rule:** nooit meer dan 1 positieve bron als er al een negatieve is

### Stap C: Override-check (`resolveGreetingOverride.ts`)

Vóór de normale synthese wordt gecontroleerd of een override-modus van toepassing is:

| Override | Conditie | Effect |
|---|---|---|
| `CRISIS_OVERRIDE` | Craving ≥ drempel OF zone ORANJE/ROOD/PAARS | Vaste crisis-prompt, geen synthese |
| `FIRST_SESSION` | Geen eerdere sessies | Welkomst-prompt voor nieuwe gebruiker |
| `RETURN_AFTER_ABSENCE` | ≥3 dagen afwezig | Aangepaste selectie (max 2 bronnen, andere prioriteit) |
| `MISSING_DATA` | Geen verse sliders/diary/gratitude/backpack/logs | Generieke prompt |

**Prioriteit:** CRISIS > FIRST_SESSION > RETURN_AFTER_ABSENCE > MISSING_DATA > SYNTHESIS (normaal)

---

## 4. Wat gaat er naar het taalmodel?

Het taalmodel (GPT-4o-mini) ontvangt **één system prompt** die volledig client-side is opgebouwd. De server voegt niets toe aan de context.

**De prompt bevat (in volgorde):**

```
1. Persona-instructie: "Je bent Elias. Schrijf een warme, persoonlijke begroeting voor [naam]."
2. ZONE: [huidige zone]
3. Toon-instructie (zone-specifiek)
4. Zone-overgang blok (als zone veranderd is t.o.v. vorige sessie)
5. === PERSOONLIJKE DATA VAN DE GEBRUIKER ===
   - VORIGE SESSIE: [letterlijke berichten OF logs.dat narrative]
   - MOOD CHECK-IN: [slider-interpretatie]
   - DAGBOEK: [letterlijke tekst]
   - DANKBAARHEID: [letterlijke tekst]
   - etc. (afhankelijk van geselecteerde bronnen)
6. VSP Persoonlijke Context (signalen, wat helpt, ankerzin, triggers)
   === EINDE PERSOONLIJKE DATA ===
7. KERNINSTRUCTIE: "De VORIGE SESSIE is je PRIMAIRE bron..."
8. VERPLICHTE ELEMENTEN: [namen, plaatsen, activiteiten uit de data]
9. HOE-instructies (max 4-5 zinnen, toon, open vraag)
10. VERBODEN patronen (hoe voel je je, opsommingen, emoji, etc.)
11. ANTI-HALLUCINATIE regels
12. === CRITICAL LANGUAGE OVERRIDE === [taal-instructie]
```

**Wat de server doet (`server/session-greeting.ts`):**
- Ontvangt: `systemPrompt`, `userName`, `clinicalModeActive`, `vspInsightContext`
- Stuurt naar OpenAI: model `gpt-4o-mini`, temperature 0.7, max_tokens 1590, store: false
- User message: simpele instructie "schrijf een persoonlijke begroeting"
- Retourneert de model-output ongewijzigd

**Belangrijk:** De server herbouwt GEEN context. Alles wat GPT ziet is client-side samengesteld.

---

## 5. De grens model vs. logica

| Aspect | Wie bepaalt | Hoe |
|---|---|---|
| Welke bronnen beschikbaar zijn | **Code** (deterministic) | `buildGreetingSynthesisCandidates` + freshness checks |
| Welke bronnen geselecteerd worden | **Code** (deterministic) | `selectGreetingSynthesisSources` (score + CONTINUITY RULE) |
| Welke zone-toon geldt | **Code** (deterministic) | `ZONE_TONE_MAP` lookup op basis van VSP-zone |
| Of er een override is | **Code** (deterministic) | `resolveGreetingOverride` (crisis/first/absence/missing) |
| De exacte formulering van de greeting | **Model** (GPT-4o-mini) | Vrije generatie binnen de prompt-constraints |
| Welke elementen benoemd worden | **Model** (gestuurd) | Prompt zegt "VERPLICHT" maar model kan negeren |
| De taal | **Code** (hard override) | `=== CRITICAL LANGUAGE OVERRIDE ===` aan einde prompt |

**Samengevat:** Code bepaalt WAT er naar het model gaat en in welke volgorde/prioriteit. Het model bepaalt HOE het geformuleerd wordt. Er is geen harde afdwinging dat het model alle verplichte elementen daadwerkelijk gebruikt — het is instructie-gebaseerd, niet constraint-gebaseerd.

---

## 6. Bestaande bescherming op de output

### `enforceGreetingOutputRulesV3()` (in `buildGreetingSynthesisPrompt.ts`)

Na ontvangst van de model-output wordt een validatie uitgevoerd die controleert op:

| Check | Wat het doet |
|---|---|
| Zin-telling | Max 6 zinnen |
| Forbidden patterns | "hoe voel je je", "hoe gaat het", "ik zie dat je", opsommingen, zone-namen, etc. |
| Emoji | Geen emoji toegestaan |
| Lijst-formatting | Geen bullet points of nummering |
| Inventory-taal | Geen "samenvattend", "checklist" etc. |
| Blame/relapse | Geen "terugval", "je hebt gefaald", "waar was je" |

### Wat gebeurt er bij een overtreding?

```typescript
if (!validation.valid) {
  console.warn(`[SessionGreetingV3] Output rejected: ${validation.reason}. Using raw output anyway.`);
  // In V3 we still use the output but log the violation
}
```

**De output wordt ALTIJD getoond aan de gebruiker, ook bij een overtreding.** De validatie is logging-only — er is geen retry, geen fallback, geen blokkering. De greeting gaat ongefilterd naar het scherm.

---

## 7. Samenvatting dataflow

```
┌─────────────────────────────────────────────────────────────────┐
│ chat.tsx (UI)                                                    │
│                                                                  │
│  1. Laad: logs.dat, diary, chatHistory, VSP, mood               │
│  2. Roep sessionInitGreetingStep() aan                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ sessionInitGreetingStep.ts (adapter)                             │
│                                                                  │
│  3. adaptLogsDat(): raw berichten > logs.dat narrative           │
│  4. adaptStateDat(): mood sliders + zone                        │
│  5. adaptDiaryMetadata(): laatste diary entries                  │
│  6. adaptVspSection(): signalen, wat helpt, ankerzin            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ sessionGreetingEngineV3.ts (deterministic engine)                │
│                                                                  │
│  7. resolveGreetingOverride() → crisis/first/absence/normal     │
│  8. buildGreetingSynthesisCandidates() → 8 kandidaten + scores  │
│  9. Recency bonus toepassen (timestamp-ranked)                  │
│ 10. selectGreetingSynthesisSources() → max 3 bronnen            │
│     (LAST_SESSION_SUMMARY altijd eerst als eligible)            │
│ 11. buildGreetingSynthesisPromptPayload() → volledige prompt    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server: /api/session-greeting                                    │
│                                                                  │
│ 12. Ontvangt: systemPrompt + userName                           │
│ 13. Stuurt naar GPT-4o-mini (temp 0.7, max 1590 tokens)        │
│ 14. Retourneert model-output ongewijzigd                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Terug in sessionInitGreetingStep.ts                              │
│                                                                  │
│ 15. enforceGreetingOutputRulesV3() → validatie (logging-only)   │
│ 16. Return greeting naar chat.tsx                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ chat.tsx (UI)                                                    │
│                                                                  │
│ 17. Greeting wordt direct in chatHistory geplaatst en getoond   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Relevante bestanden

| Bestand | Rol |
|---|---|
| `app/(tabs)/chat.tsx` | Trigger, data-laden, greeting invoegen in UI |
| `lib/features/sessionGreeting/sessionInitGreetingStep.ts` | Adapter: legacy stores → engine input, server-call, output-check |
| `lib/features/sessionGreeting/sessionGreetingEngineV3.ts` | Deterministische engine: override-check, scoring, selectie, prompt-bouw |
| `lib/features/sessionGreeting/buildGreetingSynthesisCandidates.ts` | Kandidaat-scoring met zone-modifiers en recency bonus |
| `lib/features/sessionGreeting/selectGreetingSynthesisSources.ts` | Bron-selectie (CONTINUITY RULE + balance) |
| `lib/features/sessionGreeting/buildGreetingSynthesisPrompt.ts` | Prompt-constructie + output-validatie (logging-only) |
| `lib/features/sessionGreeting/resolveGreetingOverride.ts` | Override-modus detectie (crisis/first/absence/missing) |
| `lib/features/sessionGreeting/calculateSessionAbsence.ts` | Afwezigheid-berekening (NONE/SHORT/RETURN/LONG_RETURN) |
| `server/session-greeting.ts` | Server-endpoint: prompt → GPT-4o-mini → response |

---

## 9. Bekende zwaktes (observatie, geen fix)

1. **Output-validatie is niet-blokkerend:** Overtredingen worden gelogd maar de greeting wordt altijd getoond. GPT kan de instructies negeren.
2. **"VERPLICHTE ELEMENTEN" zijn niet afdwingbaar:** Het model kan kiezen om ze te negeren. Er is geen post-hoc check of de genoemde elementen daadwerkelijk in de output staan.
3. **`previousSessionMessages` kan leeg zijn:** Als de vorige sessie geen berichten had (of de chatHistory is gewist), valt `adaptLogsDat` terug op logs.dat narrative — die een GPT-samenvatting is en kan afwijken van wat de gebruiker echt zei.
4. **Recency bonus werkt alleen als timestamps beschikbaar zijn:** `SCHEMA_ROTATION` en `RECURRING_PATTERN` hebben geen timestamp en krijgen dus nooit een recency bonus.
5. **Temperature 0.7:** Geeft het model ruimte voor variatie, maar ook voor het negeren van instructies.

---

*Document gegenereerd op basis van code-lezing. Geen wijzigingen aangebracht.*
