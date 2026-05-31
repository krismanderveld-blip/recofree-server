# Rapport: Model Routing bij VSP=ROOD & detectSignals() Input

## Vraag 1 — Waarom selecteert model routing `gpt-4o-mini` bij VSP=ROOD?

### Antwoord

**VSP=ROOD is GEEN directe conditie voor `gpt-4o` in de huidige `recommendedModel` logica.**

De model routing in `server/ai-chat.ts` (regels 1213-1247) kent vier upgrade-condities naar `gpt-4o`:

| Conditie | Trigger |
|----------|---------|
| `isSessionStart` | Altijd `gpt-4o` bij eerste bericht |
| `crisisLevel > 0 OR riskScore >= 7 OR isCrisis === true` | Crisis/risico |
| `urgency === 'high' OR urgency === 'hoog'` | Hoge urgentie |
| `dominantModule` in `HIGH_COMPLEXITY_MODULES` | Complex module (E03, E04, K01, K02) |

### Waarom VSP=ROOD niet automatisch `gpt-4o` triggert

1. **VSP=ROOD → severity 4** (in `vsp-resolution.ts`). `isCrisis` wordt alleen `true` bij `finalSeverity >= 5`, wat alleen bij **PAARS** het geval is.

2. **`crisisLevel`** wordt bepaald door de `analyzeState()` risk assessment (`analysis.riskLevel`), NIET door VSP direct:
   - `critical` of `high` → `crisisLevel = 2`
   - `moderate` → `crisisLevel = 1`
   - `low` → `crisisLevel = 0`

3. **`riskScore`** op de server wordt berekend als:
   ```
   riskScore = Math.min(10, crisisLevel * 3 + Math.round(avgDistress))
   ```
   Bij VSP=ROOD maar lage slider-waarden en `crisisLevel = 0`, kan `riskScore < 7` zijn.

4. **`isCrisis`** in de pipeline:
   ```ts
   isCrisis: (elisDecision?.zone.resolved?.isCrisis ?? false) || (kimDecision?.isKimCrisis ?? false)
   ```
   Bij ROOD: `finalSeverity = 4`, dus `isCrisis = false` (threshold is `>= 5`).

### Conclusie

Bij VSP=ROOD + lage sliders + geen urgentie + geen complex module = **alle vier condities zijn `false`** → `gpt-4o-mini`.

### Mogelijke fix (niet geïmplementeerd)

Optie A: Voeg directe VSP-conditie toe aan server routing:
```ts
} else if (input.vspLevel === 'ROOD') {
  selectedModel = 'gpt-4o';
  routingReason = 'VSP ROOD (high relapse risk)';
}
```

Optie B: Verlaag `isCrisis` threshold naar `finalSeverity >= 4` (maar dit verandert ook andere gedragingen).

---

## Vraag 2 — Wat is de exacte input die `detectSignals()` momenteel meekrijgt?

### Antwoord

**`detectSignals()` ontvangt alleen de user message als input. Geen projection entries, geen sliders, geen zone.**

### Huidige call (pipeline.ts, regel 657):

```ts
engine.detectSignals(userMessage)
```

### Interface (signal-engine.ts, regel 67):

```ts
detectSignals(message: string): Promise<SignalDetectionResult>
```

### Prompt die naar GPT-4o-mini gaat (gpt-signal-engine.ts, regel 26-30):

```
Analyze this message and return JSON only:
Message: "{userMessage}"
Return: {"fears": [...], "hopes": [...], "goals": [...], "triggers": [...]}
Max 3 items per category. Only what is clearly present. If nothing detected, use empty arrays.
```

### Wat NIET wordt meegegeven:

| Context | Status | Reden |
|---------|--------|-------|
| Active projection entries | ❌ Niet meegegeven | Projection layer is een apart systeem |
| Zone/VSP level | ❌ Niet meegegeven | SignalContext type bestaat maar is niet gewired |
| Mood sliders | ❌ Niet meegegeven | Idem |
| Buffer snapshot | ❌ Niet meegegeven | Alleen naar GPT-4o payload |
| Diary entries | ❌ Niet meegegeven | Alleen naar `scoreRelevance()` |

### Opmerking over Round 46 wijziging

In Round 46 werd een `SignalContext` type toegevoegd aan de interface (`signal-engine.ts`) met velden `zone`, `vspOrEigenRegie`, `keySliders`, en `userType`. De `detectSignals()` interface accepteert nu optioneel een tweede parameter:

```ts
detectSignals(message: string, context?: SignalContext): Promise<SignalDetectionResult>
```

**Maar de pipeline roept het nog steeds aan zonder context:**
```ts
engine.detectSignals(userMessage)  // geen tweede argument
```

En de `GptSignalEngine` implementatie gebruikt de context niet in de prompt — de prompt is nog steeds alleen message-based (de recovery-specifieke prompt uit Round 46b is niet in de huidige code).

### Conclusie

`detectSignals()` werkt momenteel als een pure message classifier zonder enige context. Active projection entries worden apart verwerkt door de projection layer en komen als `projectionContext` / `projectionDeepening` in de GPT payload — ze worden nooit aan `detectSignals()` meegegeven.

---

## Samenvatting

| Aspect | Huidige staat | Gewenste staat |
|--------|---------------|----------------|
| VSP=ROOD → gpt-4o | ❌ Niet geïmplementeerd | Directe conditie of verlaagde threshold |
| detectSignals() context | Alleen message | + zone, VSP, sliders, userType |
| Projection entries → detectSignals | ❌ Niet gekoppeld | Optioneel: actieve entries als extra context |
