# RecoFree Lite — B2C Build Specificatie

**Doel:** Specificatie voor een gestripte B2C-versie van RecoFree die als welzijns-app (coach/gesprekspartner) op de markt kan zonder MDR Klasse IIa certificering. Dit document definieert wat er WEL, NIET, en AANGEPAST in de Lite build zit.

**Status:** Specificatie — niet bouwen.

---

## 1. Positionering & Juridisch Kader

### Framing

| Aspect | RecoFree Full (MDR) | RecoFree Lite (B2C) |
|--------|---------------------|---------------------|
| Positionering | Therapeutisch hulpmiddel | Welzijns-coach / gesprekspartner |
| Taalgebruik | "therapeut", "behandeling", "interventie" | "coach", "gesprekspartner", "ondersteuning" |
| Claims | Klinische effectiviteit | Emotionele ondersteuning, zelfhulp |
| Doelgroep | Onder begeleiding van zorgprofessional | Zelfstandig gebruik door consument |
| Regulering | MDR Klasse IIa | Geen medisch hulpmiddel — welzijnscategorie |
| Verantwoordelijkheid | Gedeeld met zorgverlener | Volledig bij gebruiker (disclaimer) |

### Juridische vereisten Lite

1. **Geen diagnostische claims** — de app mag geen uitspraken doen over diagnoses, stoornissen, of klinische toestanden.
2. **Geen behandelrelatie** — de AI is een "digitale gesprekspartner", geen therapeut.
3. **Disclaimer verplicht** — bij eerste gebruik en in instellingen: "RecoFree is geen vervanging voor professionele hulp."
4. **Crisisverwijzing passief** — bij detectie van suïcidaliteit/crisis: doorverwijzing naar hulplijnen, GEEN actieve de-escalatie.
5. **Geen klinische annotaties** — `<clinical>` tags worden niet gegenereerd of getoond.

---

## 2. Component-analyse: Wat blijft, wat gaat, wat verandert

### 2.1 BEHOUDEN (ongewijzigd in Lite)

Deze componenten bevatten geen klinische logica en kunnen direct worden overgenomen.

| Component | Bestanden | Reden |
|-----------|-----------|-------|
| Chat UI (shell) | `app/(tabs)/chat.tsx` (UI-laag) | Conversatie-interface is generiek |
| Dagboek | `app/(tabs)/diary.tsx` | Puur lokale opslag, geen engine-imports |
| Mood screen (slider UI) | `app/(tabs)/mood.tsx` (UI-laag) | Slider-invoer is self-report |
| i18n systeem | `lib/i18n/`, locale bestanden | Taalondersteuning is generiek |
| Auth & onboarding | `app/onboarding/`, auth hooks | Gebruikersbeheer is generiek |
| UI componenten | `components/` (alle) | Design system is generiek |
| Navigatie | `app/(tabs)/_layout.tsx`, router | Tab-structuur is generiek |
| Encrypted storage | `lib/storage/` | Privacy-laag is generiek |
| Theme & styling | `theme.config.js`, NativeWind | Visueel ontwerp is generiek |
| Intake flow | `app/intake/` | Kennismaking is generiek (wel taal aanpassen) |

### 2.2 VERWIJDEREN (niet in Lite build)

Deze componenten bevatten de klinische IP die beschermd moet worden.

| Component | Bestanden | Reden voor verwijdering |
|-----------|-----------|------------------------|
| Zone-bepaling (Elias) | `lib/engine/elias/zone.ts` | Klinische risico-classificatie |
| Zone-bepaling (Kim) | `lib/engine/kim/zone.ts` | Klinische risico-classificatie |
| Risico-stratificatie | `lib/rugzak/state-analyzer.ts` | Klinische beoordeling |
| Module-selectie | `lib/rugzak/dominant-state-selector.ts` | Therapeutische routing |
| Decision layer (Elias) | `lib/engine/elias/decision-layer.ts` | Klinische beslislogica |
| Decision layer (Kim) | `lib/engine/kim/decision-layer.ts` | Klinische beslislogica |
| Crisis-detectie (engine) | `lib/rugzak/pipeline.ts` (crisis-secties) | Actieve crisis-interventie |
| Volledige pipeline | `lib/rugzak/pipeline.ts` | Orchestratie van klinische stappen |
| Regulation layer | `lib/rugzak/regulation-layer.ts` | Therapeutische dosering |
| Projection layer | `lib/rugzak/projection-layer.ts` | Klinische voorspelling |
| Signal engine | `lib/engine/local-llm/gpt-signal-engine.ts` | Klinische signaaldetectie |
| Schema/Mode engine | `lib/engine/shared/schema-mode-*.ts` | Schematherapie-logica |
| ACT/CGT/DGT/MBT engines | `lib/engine/shared/act-*.ts`, `cgt-*.ts`, etc. | Therapeutische methoden |
| VSP Insight layer | `lib/engine/shared/vsp-insight-*.ts` | Klinische framework-selectie |
| Relapse intent detection | `lib/engine/elias/relapse-intent-*.ts` | Klinische detectie |
| Intervention continuity | `lib/engine/elias/intervention-*.ts` | Therapeutische continuïteit |
| Clinical mode UI | Clinical tag dropdown, `parseClinicalTag()` | Klinische annotaties |
| Alle module-specifieke detectors | `lib/engine/elias/*.ts`, `lib/engine/kim/*.ts` (detectors/routers) | Therapeutische modules |
| Backpack relevance analyzer | `lib/rugzak/backpack-relevance-analyzer.ts` | Klinische context-weging |
| Progress tracker (klinisch) | `lib/engine/elias/elias-progress-tracker.ts`, `lib/engine/kim/kim-progress-tracker.ts` | Klinische voortgangsanalyse |

### 2.3 AANPASSEN (in Lite met wijzigingen)

| Component | Huidige functie | Lite-aanpassing |
|-----------|-----------------|-----------------|
| **Mood screen — zone indicator** | `distressToZone()` toont "Stabiel/Verhoogd/Belast/Kritiek" | **Behouden** — dit is self-report visualisatie, geen diagnose. Label aanpassen naar welzijns-taal: "Rustig / Gespannen / Zwaar / Overweldigd" |
| **Progress card** | Gebruikt `computeEliasProgress()` / `computeKimProgress()` met klinische logica | **Vereenvoudigen** — alleen statistische trends tonen (week-over-week slider gemiddelden), geen module-badges, geen klinische interpretatie |
| **Chat — GPT prompt** | Volledige therapeutische system prompt met modules, zones, interventies | **Vervangen** — vereenvoudigd welzijns-prompt (zie §4) |
| **Chat — crisis response** | Actieve de-escalatie + doorverwijzing + emergency overlay | **Passief** — alleen doorverwijzing naar hulplijnen, geen actieve interventie |
| **Emergency overlay** | Getriggerd door `crisisLevel >= 2` uit engine | **Vereenvoudigd** — getriggerd door keyword-detectie (simpele woordenlijst), toont alleen nummers |
| **Intake — taal** | "Wat brengt je hier?" (therapeutisch) | "Vertel iets over jezelf" (kennismaking, coach-framing) |
| **Backpack** | Levensverhaal met klinische secties | **Behouden structuur**, maar GPT-instructie verandert: geen schema-analyse, alleen empathische context |
| **Session greeting** | Fact-grounded greeting met engine-bronnen | **Vereenvoudigen** — greeting op basis van tijdstip + laatste dagboek + naam, zonder engine-bronnen |
| **openai-provider.ts** | Bouwt 60+ veld payload met klinische context | **Strippen** — alleen basis-velden: userType, userName, message, conversationHistory, moodSliders, backpack (SESSION_INIT), locale |

---

## 3. Architectuur Lite

### 3.1 Vereenvoudigd dataflow

```
┌─────────────────────────────────────────────────┐
│  CLIENT (Lite)                                  │
│                                                 │
│  Sliders → Mood screen (self-report visualisatie)│
│  Message → Simplified payload builder           │
│  Backpack → Context (empathisch, niet klinisch) │
│  Diary → Lokale opslag + optionele GPT-context  │
│                                                 │
│  POST /api/lite-chat                            │
│  { userType, userName, message, history,        │
│    moodSliders, backpack?, diary?, locale }      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│  SERVER (Lite endpoint)                            │
│                                                    │
│  1. Simpele keyword crisis-check                   │
│     → Bij match: passieve doorverwijzing in prompt │
│  2. Build welzijns-prompt (geen modules/zones)     │
│  3. OpenAI call (gpt-4o-mini default)              │
│  4. Return { response, showCrisisInfo }            │
└────────────────────────────────────────────────────┘
```

### 3.2 Wat de server NIET doet in Lite

- Geen `analyzeState()`
- Geen `selectDominantState()`
- Geen `applyRegulation()`
- Geen `routeEngineDirective()`
- Geen SignalEngine calls
- Geen relapse intent detection
- Geen zone-berekening
- Geen module-selectie
- Geen klinische annotaties
- Geen guidance depth ceiling (altijd "light" impliciet)

---

## 4. GPT Prompt — Lite versie

### 4.1 System prompt structuur

```
Je bent {persona_naam}, een empathische digitale gesprekspartner voor mensen die
{persona_context}.

KERNREGELS:
1. Je bent een COACH en GESPREKSPARTNER, geen therapeut.
2. Je geeft ONDERSTEUNING, geen behandeling.
3. Je stelt geen diagnoses en maakt geen klinische beoordelingen.
4. Je gebruikt warme, toegankelijke taal — geen jargon.
5. Je verwijst naar professionele hulp wanneer iemand aangeeft in crisis te zijn.
6. Je geeft NOOIT medisch advies.

STIJL:
- Empathisch en validerend
- Kort en bondig (max 3-4 zinnen per antwoord tenzij gebruiker meer vraagt)
- Vraagstellend — help de gebruiker zelf na te denken
- Geen labels, geen categorisaties, geen "ik merk dat je in fase X zit"

CONTEXT OVER DE GEBRUIKER:
{backpack_samenvatting — alleen feitelijke context, geen klinische interpretatie}

MOOD CONTEXT:
{huidige slider-waarden in natuurlijke taal: "Je gaf aan dat je craving een 7/10 is"}

{indien crisis_keywords_detected}
BELANGRIJK: De gebruiker lijkt in nood. Verwijs empathisch naar:
- Zelfmoordpreventie: 113 Zelfmoordpreventie (0900-0113) / 1813 (BE)
- Crisis: 112
Geef GEEN therapeutische interventie. Zeg dat je er bent, en verwijs door.
{/indien}
```

### 4.2 Persona-specifiek

**Elias (Lite):**
> "een empathische digitale gesprekspartner voor mensen die werken aan hun relatie met middelengebruik of gedragspatronen"

**Kim (Lite):**
> "een empathische digitale gesprekspartner voor naasten van mensen met verslavingsproblematiek"

### 4.3 Wat NIET in het Lite prompt zit

- Geen module-instructies (E01-E08, K01-K06)
- Geen zone-gebaseerde toon/diepte-aanpassingen
- Geen therapeutische methode-selectie (MI, MBT, DGT, ACT, CGT)
- Geen schema/mode-detectie
- Geen interventie-continuïteit
- Geen regulation layer instructies
- Geen projection layer (fears/hopes/goals tracking)
- Geen STOA-injecties
- Geen loopblocker/language recovery directives

---

## 5. Pricing & Usage Limits

### 5.1 Gekozen model (besloten, niet geïmplementeerd)

| Tier | Prijs | Limiet | GPT Model | Features |
|------|-------|--------|-----------|----------|
| **Trial** | Gratis (14 dagen) | Onbeperkt | gpt-4o-mini | Volledige Lite ervaring |
| **Freemium** | Gratis | 5 chats/maand | gpt-4o-mini | Basis coaching |
| **Pay-per-chat** | €1/chat | Onbeperkt | gpt-4o | Premium model per gesprek |
| **Premium** | €35/maand | Onbeperkt | gpt-4o | Volledige toegang, prioriteit |

### 5.2 Server-side implementatie vereisten

- **Usage counter:** Per-user chat count per kalendermaand (server-side, niet manipuleerbaar)
- **Tier check:** Bij elke `/api/lite-chat` request: controleer tier + remaining chats
- **Model routing:** Freemium → gpt-4o-mini, Pay-per-chat/Premium → gpt-4o
- **Payment integration:** Stripe/Mollie voor €1 per-chat en €35/maand subscriptie
- **Trial expiry:** 14 dagen na account-creatie, automatische overgang naar freemium

---

## 6. Shared vs. Separate Codebase

### 6.1 Aanbevolen aanpak: Feature flag + build-time stripping

```typescript
// app.config.ts
const APP_MODE = process.env.EXPO_PUBLIC_APP_MODE as 'lite' | 'mdr'; // Build-time

// Conditionele imports (tree-shaken bij build)
if (APP_MODE === 'mdr') {
  const { processMessage } = require('@/lib/rugzak/pipeline');
  // ... volledige engine
}
```

### 6.2 Gedeelde code (één codebase, beide builds)

| Categorie | Bestanden |
|-----------|-----------|
| UI componenten | `components/*` |
| Navigatie | `app/(tabs)/_layout.tsx`, router config |
| Auth | `hooks/use-auth.ts`, OAuth flow |
| Storage | `lib/storage/*` (encrypted read/write) |
| i18n | `lib/i18n/*`, locale bestanden |
| Theme | `theme.config.js`, NativeWind config |
| Diary | `app/(tabs)/diary.tsx` |
| Chat UI shell | `app/(tabs)/chat.tsx` (UI-laag, niet de engine-aanroepen) |
| Intake UI | `app/intake/*` (met taal-aanpassing) |
| Backpack structuur | `lib/ai/types.ts` (type definities) |

### 6.3 MDR-only code (niet in Lite build)

| Categorie | Bestanden |
|-----------|-----------|
| Engine (Elias) | `lib/engine/elias/*` |
| Engine (Kim) | `lib/engine/kim/*` |
| Engine (shared) | `lib/engine/shared/*` |
| Rugzak pipeline | `lib/rugzak/*` |
| Signal engine | `lib/engine/local-llm/*` |
| Clinical mode UI | Clinical tag parsing, debug overlay |
| Progress tracker (klinisch) | Engine-based progress computation |

### 6.4 Lite-specifieke code (niet in MDR build)

| Categorie | Beschrijving |
|-----------|-------------|
| Lite payload builder | Vereenvoudigde versie van `openai-provider.ts` |
| Lite crisis check | Keyword-based (geen engine), passieve doorverwijzing |
| Lite progress card | Statistisch (slider trends), geen module-badges |
| Lite greeting | Tijdstip + naam + laatste dagboek, geen engine-bronnen |
| Usage/billing hooks | Chat counter, tier check, payment triggers |

---

## 7. Crisis Handling — Lite vs. MDR

| Aspect | MDR (Full) | Lite (B2C) |
|--------|-----------|------------|
| **Detectie** | Multi-layer: engine crisis detection + relapse intent (GPT + deterministic) + zone escalation | Simpele keyword-lijst (NL/EN/FR) |
| **Response** | Actieve de-escalatie: grounding oefening, validatie, veiligheidsplan, doorverwijzing | Passief: "Ik hoor dat het zwaar is. Neem contact op met [hulplijn]." |
| **Emergency overlay** | Volledig: crisisnummers + "bel nu" knop + timer | Minimaal: crisisnummers als tekst in chat |
| **Escalatie** | Zone → PAARS, model → gpt-4o, regulation → crisis_override | Geen escalatie, alleen doorverwijzing |
| **Opvolging** | Volgende sessie: greeting refereert aan crisis, verhoogde monitoring | Geen opvolging (geen state tracking van crisis) |
| **Juridisch** | Zorgplicht (MDR) | Informatieplicht (welzijns-app) |

### Lite crisis keywords (voorbeeld)

```typescript
const CRISIS_KEYWORDS_NL = [
  'zelfmoord', 'suïcide', 'doodwens', 'niet meer willen leven',
  'einde maken', 'van een brug', 'pillen slikken', 'mezelf iets aandoen',
  'geen uitweg', 'het is voorbij', 'niemand zal me missen',
];
// + EN/FR equivalenten
```

---

## 8. Migratie-checklist (wanneer gebouwd wordt)

### Fase 1: Codebase voorbereiding
- [ ] Feature flag `EXPO_PUBLIC_APP_MODE` toevoegen aan build config
- [ ] Conditionele imports voor engine-code
- [ ] Tree-shaking valideren: Lite build bevat geen `lib/engine/` of `lib/rugzak/`
- [ ] Lite payload builder schrijven (subset van `openai-provider.ts`)

### Fase 2: Server-side Lite endpoint
- [ ] `/api/lite-chat` endpoint (vereenvoudigd, geen engine)
- [ ] Welzijns system prompt (§4)
- [ ] Keyword crisis check
- [ ] Usage counter + tier check middleware
- [ ] Model routing (mini vs 4o op basis van tier)

### Fase 3: UI aanpassingen
- [ ] Mood screen labels: "Stabiel/Verhoogd/Belast/Kritiek" → "Rustig/Gespannen/Zwaar/Overweldigd"
- [ ] Progress card: verwijder module-badges, behoud slider-trends
- [ ] Intake flow: coach-framing taal
- [ ] Clinical mode toggle: verwijderen uit Lite
- [ ] Emergency overlay: vereenvoudigen naar tekst-only
- [ ] Session greeting: vereenvoudigen (geen engine-bronnen)

### Fase 4: Billing integratie
- [ ] Stripe/Mollie integratie
- [ ] Trial timer (14 dagen)
- [ ] Chat counter (server-side)
- [ ] Paywall UI (bij limiet bereikt)
- [ ] Premium upgrade flow

### Fase 5: Juridisch & compliance
- [ ] Disclaimer teksten (NL/EN/FR)
- [ ] Privacy policy update (welzijns-app framing)
- [ ] Terms of Service (geen medische claims)
- [ ] App Store review: categorie "Health & Fitness" of "Lifestyle", NIET "Medical"
- [ ] Verwijder alle tekst die "therapie", "behandeling", "diagnose" bevat uit Lite UI

---

## 9. Wat de gebruiker ZIET in Lite vs. MDR

### Lite gebruikerservaring

1. **Onboarding:** "Welkom bij RecoFree. Ik ben {Elias/Kim}, je digitale gesprekspartner."
2. **Intake:** Korte kennismaking (naam, situatie, wat je zoekt) — geen klinische intake
3. **Chat:** Empathisch gesprek, validatie, reflectieve vragen, praktische tips
4. **Mood:** Sliders invullen, zone-indicator ("Rustig" t/m "Overweldigd"), 7-daagse trend
5. **Dagboek:** Vrij schrijven, mood-tag, terugkijken
6. **Voortgang:** "Je stress is deze week afgenomen" (statistisch), sobriety counter
7. **Crisis:** "Ik hoor dat het zwaar is. Bel 113 Zelfmoordpreventie (0900-0113)."

### Wat Lite NIET toont

- Geen klinische tags onder chatberichten
- Geen module-badges ("E03 — Schematherapie actief")
- Geen zone-kleuren (ROOD/ORANJE/GEEL/GROEN/PAARS)
- Geen therapeutische interventie-labels
- Geen "klinische modus" toggle
- Geen actieve de-escalatie bij crisis
- Geen guidance depth keuze (impliciet altijd "light")

---

## 10. Risico-analyse

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| Lite gebruiker in echte crisis, alleen passieve doorverwijzing | Hoog | Duidelijke disclaimer + altijd crisisnummers zichtbaar in footer |
| Klinische IP lekt via Lite prompt | Middel | Lite prompt bevat GEEN module-namen, zone-logica, of therapeutische methoden |
| Gebruiker verwacht therapie, krijgt coaching | Middel | Onboarding maakt expliciet: "Ik ben een gesprekspartner, geen therapeut" |
| App Store rejection (medische claims) | Hoog | Alle tekst screenen op klinische termen vóór submission |
| Lite te "dom" — gebruiker haakt af | Middel | GPT-4o (premium) geeft kwalitatief goede empathische responses ook zonder engine |
| Reverse engineering van MDR build | Laag | Server-side engine (§11 ENGINE_PROCESS_SPEC) beschermt IP |
| GDPR compliance | Middel | Alle data lokaal + encrypted, server transit-only, geen persistent storage |

---

## 11. Relatie tot ENGINE_PROCESS_SPEC

De twee specificaties zijn complementair:

- **ENGINE_PROCESS_SPEC** beschrijft hoe de klinische engine naar de server verhuist → beschermt IP
- **RECOFREE_LITE_SPEC** beschrijft wat de Lite build bevat → geen klinische logica nodig

Wanneer beide geïmplementeerd zijn:
- **Lite build** stuurt simpele requests naar `/api/lite-chat` (geen engine, welzijns-prompt)
- **MDR build** stuurt ruwe input naar `/api/engine-process` (volledige klinische pipeline server-side)
- **Klinische IP** zit uitsluitend server-side → niet reverse-engineerable uit app-builds
- **Eén server** bedient beide: routing op basis van `appMode` header

---

## 12. Samenvatting beslissingen

| Beslissing | Keuze | Rationale |
|-----------|-------|-----------|
| Codebase | Eén repo, feature flag | Minder onderhoud, gedeelde UI |
| Engine in Lite | Geen (server-side welzijns-prompt) | IP-bescherming + simpliciteit |
| Crisis in Lite | Passieve doorverwijzing | Juridisch veilig zonder MDR |
| Mood screen | Behouden (self-report) | Geen klinische claim, gebruikerswaarde |
| Dagboek | Behouden (ongewijzigd) | Geen engine-dependency |
| Progress | Vereenvoudigd (alleen trends) | Geen module-logica nodig |
| Pricing | 14d trial → freemium → pay-per-chat → premium | Gevalideerd model |
| GPT model | mini (free) / 4o (betaald) | Kosten-kwaliteit balans |
| Taal | NL/EN/FR (bestaand i18n) | Marktbereik Benelux + FR |
