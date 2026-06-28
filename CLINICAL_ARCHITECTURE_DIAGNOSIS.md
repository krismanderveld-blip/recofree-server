# RecoFree — Klinische Architectuur Diagnose

**Doel:** Vaststellen waar de klinische logica fysiek draait, wat de gebruiker ziet, en of een Lite/MDR-split via server-side schakelaar mogelijk is.

---

## 1. Waar draait de klinische engine?

### Overzicht per component

| Component | Locatie | Bestand(en) | Draait op |
|-----------|---------|-------------|-----------|
| **Zone-bepaling (Elias)** | `lib/engine/elias/zone.ts` | `computeEliasZone()` | **Client (app-build)** |
| **Zone-bepaling (Kim)** | `lib/engine/kim/zone.ts` | `computeKimZone()` | **Client (app-build)** |
| **Risico-stratificatie** | `lib/rugzak/state-analyzer.ts` | `assessRiskLevel()`, `analyzeState()` | **Client (app-build)** |
| **Module-selectie** | `lib/rugzak/dominant-state-selector.ts` + `pipeline.ts` | `selectDominantState()` | **Client (app-build)** |
| **Decision layer (Elias)** | `lib/engine/elias/decision-layer.ts` | `createEliasDecision()` | **Client (app-build)** |
| **Decision layer (Kim)** | `lib/engine/kim/decision-layer.ts` | `createKimDecision()` | **Client (app-build)** |
| **Crisis-detectie** | `lib/rugzak/pipeline.ts` (lines 2147-2164) + `state-analyzer.ts` | `assessRiskLevel()` → `crisisLevel` | **Client (app-build)** |
| **Orchestration/routing** | `lib/engine/orchestration.ts` | `routeEngineDirective()` | **Client (app-build)** |
| **Signal engine (fears/hopes/triggers)** | `lib/engine/local-llm/gpt-signal-engine.ts` | `detectSignals()` | **Client → Server call** (GPT-4o-mini via `/api/signal-engine`) |
| **Progress tracker (Elias)** | `lib/engine/elias/elias-progress-tracker.ts` | `computeEliasProgress()` | **Client (app-build)** |
| **Progress tracker (Kim)** | `lib/engine/kim/kim-progress-tracker.ts` | `computeKimProgress()` | **Client (app-build)** |
| **Eigen Regie (Kim)** | `lib/engine/kim/eigen-regie.ts` | `processEigenRegie()` | **Client (app-build)** |
| **GPT system prompt bouw** | `server/ai-chat.ts` | `buildSystemPrompt()` | **Server** |
| **GPT API call** | `server/ai-chat.ts` | OpenAI fetch (line 2616+) | **Server** |
| **Guidance depth ceiling** | `server/ai-chat.ts` (lines 1466-1490) | Zone→depth mapping | **Server** |
| **Crisis nummers/fallback** | `server/ai-chat.ts` (lines 467-540) | `buildCrisisFallbackMessage()` | **Server** |
| **Session greeting (V3)** | `server/session-greeting.ts` + `lib/features/sessionGreeting/` | Server endpoint + client fact extraction | **Beide** |

### Samenvatting

**De volledige klinische beslislogica draait CLIENT-SIDE** in de app-build:
- Zone-bepaling
- Risico-stratificatie
- Module-selectie
- Crisis-detectie
- Decision layer

**De server is een "dumb GPT proxy"** die:
- Het system prompt bouwt op basis van data die de client stuurt (zone, module, crisisLevel, riskScore)
- De OpenAI API aanroept
- Een guidance depth ceiling toepast (server-side veiligheidslaag)
- Crisis-nummers injecteert bij hoge crisisLevel

De server doet GEEN eigen zone-berekening, module-selectie, of risico-analyse. Hij ontvangt deze als input van de client.

---

## 2. Wat ziet de gebruiker als klinische beoordeling?

### Altijd zichtbaar (alle gebruikers)

| UI-element | Wat het toont | Bron |
|------------|--------------|------|
| **Mood screen — zone indicator** | "Stabiel" / "Verhoogd" / "Belast" / "Kritiek" met kleur | `distressToZone()` in `mood.tsx` — simpele drempelwaarde op gemiddelde slider scores (7 dagen) |
| **Mood screen — Eigen Regie (Kim)** | Zone + score + betekenis | `processEigenRegie()` — puur op basis van user-input slider |
| **Progress card — trends** | "↓ Afgenomen" / "↑ Toegenomen" / "→ Stabiel" per slider | `computeEliasProgress()` / `computeKimProgress()` — vergelijkt week-over-week gemiddelden |
| **Progress card — sobriety streak** | "X dagen" | Verschil tussen startdatum en vandaag |
| **Emergency overlay** | Hulplijn-nummers (1813, 112) | Getriggerd wanneer `showEmergency = true` (crisisLevel >= 2) |
| **Chat — crisis disclaimer footer** | "RecoFree is geen vervanging voor professionele hulp. Zelfmoordpreventie: 1813" | Altijd zichtbaar |

### Alleen zichtbaar in klinische modus (opt-in via modal)

| UI-element | Wat het toont | Bron |
|------------|--------------|------|
| **Clinical tag onder chatbubble** | Module, Zone, Model, Regulation, Risk score, Triggers, Projection, Intervention, Buffer | `clinicalInfo` object uit pipeline response |
| **`<clinical>` tag in GPT response** | GPT's eigen klinische annotatie | GPT output, geparsed door `parseClinicalTag()` |

### Niet zichtbaar voor gebruiker (puur intern)

| Component | Wat het doet | Waarom onzichtbaar |
|-----------|-------------|-------------------|
| Zone-bepaling (engine) | ROOD/ORANJE/GEEL/LICHTGROEN/GROEN | Wordt NIET direct getoond; alleen indirect via mood screen's eigen `distressToZone()` |
| Module-selectie | E01-E08, K01-K08 | Onzichtbaar tenzij clinical mode |
| Risico-stratificatie | low/moderate/high/critical | Onzichtbaar; bepaalt alleen GPT-gedrag |
| Decision layer | dominantModule + zone + regulation | Onzichtbaar tenzij clinical mode |
| Guidance depth ceiling | light/normal/deep | Onzichtbaar; beperkt alleen GPT-diepgang |
| Signal engine | fears/hopes/triggers/goals | Onzichtbaar; voedt alleen GPT context |

### Belangrijk onderscheid

De **mood screen zone** ("Stabiel"/"Verhoogd"/"Belast"/"Kritiek") is **NIET dezelfde** als de engine zone (ROOD/ORANJE/GEEL/LICHTGROEN/GROEN). De mood screen berekent een simpel gemiddelde van slider scores over 7 dagen met vaste drempels (≥7=RED, ≥5=ORANGE, ≥3=YELLOW, <3=GREEN). Dit is een **visualisatie van user-input**, geen klinische beoordeling.

---

## 3. Lite vs MDR via server-side schakelaar — haalbaarheid

### Huidige architectuur maakt dit MOEILIJK

**Probleem:** De klinische logica zit in de app-build (`lib/engine/`, `lib/rugzak/`). Eén app-build bevat altijd alle code. Een server-side schakelaar kan de client-side logica niet verwijderen of uitschakelen.

### Wat WEL kan met een server-side schakelaar

| Feature | Lite (server flag) | MDR (server flag) |
|---------|-------------------|-------------------|
| GPT system prompt | Welzijns-framing, geen klinische termen | Klinische termen, therapeutische instructies |
| Guidance depth ceiling | Altijd "light" | Volledige ceiling logica |
| Crisis response | Doorverwijzing naar noodnummers (passief) | Actieve de-escalatie + doorverwijzing |
| `<clinical>` tag in GPT output | Niet genereren | Genereren voor clinician interface |
| Signal engine (`/api/signal-engine`) | Uitgeschakeld of beperkt | Volledig actief |
| Module-specifieke GPT instructies | Generiek "coaching" prompt | Volledige therapeutische module prompts |

### Wat NIET kan zonder aparte build

| Feature | Waarom niet via server flag |
|---------|---------------------------|
| Zone-bepaling verwijderen | Draait client-side, altijd in de build |
| Module-selectie verwijderen | Draait client-side |
| Decision layer verwijderen | Draait client-side |
| Progress tracker verwijderen | Draait client-side, direct in UI |
| Clinical mode toggle verwijderen | UI component in app-build |

### Aanbevolen architectuur voor Lite/MDR split

**Optie A: Feature flag in app-build (eenvoudigst)**
```
const APP_MODE = process.env.EXPO_PUBLIC_APP_MODE; // 'lite' | 'mdr'

// In pipeline:
if (APP_MODE === 'lite') {
  // Skip decision layer, use simple module
  // Skip zone computation, use fixed "coaching" mode
  // Crisis = alleen doorverwijzing
}
```
→ Eén codebase, twee builds (via environment variable bij build-time)

**Optie B: Server-side mode (gedeeltelijk)**
- Server ontvangt `appMode: 'lite' | 'mdr'` van client
- Lite: server geeft generiek coaching-prompt, geen klinische annotaties
- MDR: server geeft volledige therapeutische prompt
- Client-side engine draait nog steeds, maar output wordt genegeerd in Lite
- Mood screen zone-indicator is onschuldig genoeg voor Lite (het is user-input visualisatie)

**Optie C: Twee aparte builds met shared core**
- `lib/engine/` alleen in MDR-build
- Lite-build heeft vereenvoudigde pipeline zonder zone/module/decision
- Meest schone scheiding maar meer onderhoud

### Conclusie

Een **server-side schakelaar** kan de GPT-output (prompt, depth, klinische annotaties) volledig controleren. De client-side engine (zone, module, decision) draait nog steeds maar is **onzichtbaar voor de gebruiker** in normale modus. De mood screen zone-indicator is geen klinische beoordeling maar een simpele visualisatie van eigen slider-input.

**Voor MDR-certificering** is de relevante vraag: maakt de app klinische claims op basis van de engine output? In de huidige staat:
- Mood screen: toont "Stabiel/Verhoogd/Belast/Kritiek" — dit is een **self-report visualisatie**, geen diagnose
- Chat: GPT-output wordt gestuurd door de engine — dit IS klinisch relevant
- Progress card: toont trends — dit is **statistische samenvatting van eigen input**

De server-side schakelaar is voldoende om de **GPT-gestuurde therapeutische interactie** (het klinisch relevante deel) uit te schakelen voor Lite, terwijl de self-report visualisaties (mood screen, progress) onschuldig genoeg zijn om in beide modes te bestaan.
