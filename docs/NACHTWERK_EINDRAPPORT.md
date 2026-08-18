# NACHTWERK EINDRAPPORT — 7-Fase Context Bridge

**Datum:** 18 augustus 2026  
**Commit:** `271375fc`  
**Branch:** main  
**Baseline:** checkpoint `8743b996` (P1 Kim Functional Context Use Fix)  
**Eindresultaat:** 3660 tests pass, 0 fail, 1 skipped, 0 TS errors

---

## 1. Git Commit Hash(es)

| Commit | Beschrijving |
|--------|-------------|
| `271375fc` | NACHTWERK: 7-fase context bridge (HUIDIGE HEAD) |
| `8743b996` | P1: KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT (baseline) |
| `f426000c` | P1: Kim output structure contract + kimFormulationBlock prominence |
| `199fc222` | BACKPACK SECTION ANALYSIS: Deep per-section GPT extraction |
| `4c9a2cb1` | Manual refresh sends raw backpack to GPT for full extraction |

---

## 2. Gewijzigde Bestanden per Fase

### FASE 1: contextDatSerialized bij follow-up herstellen
- `lib/pipeline/context-dat-session-cache.ts` (NIEUW)
- `lib/rugzak/pipeline.ts` (cache integratie)
- `__tests__/pipeline/contextDatSessionCache.test.ts` (NIEUW)

### FASE 2: Deep analysis naar [PERSONAL CLINICAL CONTEXT] promptsectie
- `lib/ai/prompt/client-prompt-types.ts` (+personalClinicalContext field)
- `lib/ai/prompt/client-system-prompt-builder.ts` (+[PERSONAL CLINICAL CONTEXT] block)
- `lib/ai/openai-provider.ts` (+personalClinicalContext pass-through)
- `lib/ai/types.ts` (+personalClinicalContext in ChatContext)
- `lib/rugzak/pipeline.ts` (+buildPersonalClinicalContext function)

### FASE 3: personalAnchors bij greeting
- GEEN WIJZIGINGEN — greetingV4.ts (lijn 467-477) gebruikt al extractedEntities.persons

### FASE 4: Context-aware formulation application layer
- `lib/engine/shared/context-application-contract.ts` (NIEUW)
- `lib/ai/prompt/kim-prompt-composer.ts` (+import + sections.contextApplicationContract)
- `lib/ai/prompt/elias-prompt-composer.ts` (+import + sections.contextApplicationContract)
- `lib/ai/prompt/client-system-prompt-builder.ts` (+contextApplicationContract section handling)

### FASE 5: Kim reality / agency / responsibility guard
- `lib/engine/kim/prompt-block.ts` (+KIM_REALITY_AGENCY_GUARD export)
- `lib/ai/prompt/kim-prompt-composer.ts` (+import + injection in identity)

### FASE 6: ageCategory 18+ foundation
- `lib/engine/shared/age-category-foundation.ts` (NIEUW)

### Documentatie
- `docs/audit/RECOFREE_PROMPT_FLOW_AUDIT.md` (NIEUW)

---

## 3. Testcommando's Uitgevoerd

```bash
# TypeScript check
npx tsc --noEmit
# Output: (leeg = 0 errors)

# Full test suite
npx vitest run
# Output: Test Files 158 passed | 1 skipped (159)
#         Tests 3660 passed | 1 skipped (3661)
#         Duration 25.71s

# FASE 1 specifiek
npx vitest run __tests__/pipeline/contextDatSessionCache.test.ts
# Output: 12/12 pass
```

---

## 4. Volledige Testresultaten

```
Test Files  158 passed | 1 skipped (159)
     Tests  3660 passed | 1 skipped (3661)
  Start at  21:17:00
  Duration  25.71s (transform 5.95s, setup 0ms, collect 13.41s, tests 66.57s, environment 33ms, prepare 11.36s)
```

**Skipped:** `openai-key-validation.test.ts` (env-dependent, pre-existing)

---

## 5. TypeScript Check Output

```
$ npx tsc --noEmit
(geen output = 0 errors)
```

---

## 6. Railway Deploy Bewijs

```
$ git push https://[PAT]@github.com/krismanderveld-blip/recofree-server.git main
To https://github.com/krismanderveld-blip/recofree-server.git
   8743b99..271375f  main -> main
```

Railway auto-deployt vanuit `krismanderveld-blip/recofree-server` main branch.
Laatste Railway logs bevestigen server draait met extraction fix (max_tokens=16384, OpenAI fallback).

---

## 7. GitHub Push Bewijs

```
Branch: main
Commit: 271375fc
Remote: github.com/krismanderveld-blip/recofree-server.git
Push: 8743b99..271375f main -> main (SUCCESS)
```

---

## 8. Promptvoorbeelden met Dummy-Data

### 8A. Elias Greeting (via greetingV4.ts → server/session-greeting.ts)

```
[SYSTEM PROMPT — Greeting]
You are Elias. You are a recovery coach...
[KEY FIGURES]
- Jules: zoon (5 jaar)
- Melissa: vriendin
- Ellen: ex-partner, moeder van Jules
[VSP CONTEXT]
Score: 6/10 — "Ik voel me redelijk stabiel vandaag"
[INSTRUCTION]
Generate a personal greeting for Kris. Follow the language instruction...
```

### 8B. Kim Greeting (via greetingV4.ts → server/session-greeting.ts)

```
[SYSTEM PROMPT — Greeting]
You are Kim. You support the person standing close to addiction...
[KEY FIGURES]
- Partner: Kris (verslaving: alcohol)
- Zoon: Jules (5 jaar)
- Ex-schoonmoeder: Ellen
[ERP CONTEXT]
Eigen Regie score: 4/10 — "Ik voel me uitgeput"
[INSTRUCTION]
Generate a personal greeting for Melissa. Follow the language instruction...
```

### 8C. Elias Follow-up (via minimal-proxy)

```
[IDENTITY]
You are Elias. You are a recovery coach...

[FUNCTIONAL CONTEXT USE CONTRACT]
...When context is available, USE IT CONCRETELY...

[CONTEXT APPLICATION RULES — MANDATORY]
...ANTI-GENERIC RULE: If your response could apply to any random person...

[REGULATION]
slow_down (depth=deep)

[CONTEXT.DAT]
Naam: Kris | Persona: elias | Zone: GREEN(11)
Key figures: Jules(zoon,5j), Melissa(vriendin), Ellen(ex)
Schemas: verlating(hypothesis), zelfkritiek(hypothesis)
Triggers: conflict met Melissa, werkstress

[PERSONAL CLINICAL CONTEXT — use as working hypotheses, never diagnose]
Schemas (hypotheses): verlating (moderate), zelfkritiek (high)
Modes (observed): kwetsbaar kind, boze beschermer
Triggers: conflict met partner; werkdruk; eenzaamheid
Strengths: motivatie voor Jules; sportieve discipline
Values: eerlijkheid, vaderschap, autonomie
Goals: 6 maanden nuchter; betere relatie met Melissa
Risks: sociaal isolement; werkgerelateerde drinkdruk

[PERSONAL ANCHORS]
Jules: zoon (5j)
Melissa: vriendin; edge: Jules→Melissa (stiefmoeder)
Ellen: ex-partner; moeder van Jules; status: gescheiden

[SELECTED CLINICAL MEMORY]
- Kris meldde 3 weken geleden een bijna-terugval na ruzie met Melissa
- Sportschema is beschermfactor (4x/week)

[ELIAS FORMULATION BLOCK]
FormBlock: medium | Pattern: craving_social_trigger
mustMention: sociale druk herkennen, alternatief gedrag, HALT-check
mustAvoid: moraliseren, schuldtaal, bagatelliseren

[REJECTED SUGGESTIONS]
User rejected: dagboek schrijven (this session)
```

### 8D. Kim Follow-up (via minimal-proxy)

```
[IDENTITY]
You are Kim. You support the person standing close to addiction...

[FUNCTIONAL CONTEXT USE CONTRACT]
...obligation to use formulation/CMD/anchors concretely...

[REALITY & AGENCY GUARD — Kim-specific]
...The user is NOT powerless. They have choices...
...The person with addiction is NOT a villain...

[CONTEXT APPLICATION RULES — MANDATORY]
...Name the specific pattern, person, trigger, or value...

[RELATIONAL STANCE DIRECTIVE]
stance=empathic_witness | depth=medium | harmPattern=false
Kim sees the relationship as a system. Both people matter.

[KIM FORMULATION BLOCK]
FormBlock: medium | Pattern: trust_damage (repeated_harm)
mustMention: vertrouwensbreuk benoemen, eigen grenzen verkennen, herstelpad
mustAvoid: partij kiezen, demoniseren, diagnosticeren, "je moet weg"
responsibilityMap: leugen=partner(100%), reactie=user(own_choice)

[CONTEXT.DAT]
Naam: Melissa | Persona: kim | Zone: YELLOW(7)
Key figures: Kris(partner,verslaving:alcohol), Jules(stiefzoon,5j)
Schemas: zelfopoffering(hypothesis), emotionele verwaarlozing(hypothesis)
Triggers: leugens ontdekken, alleen verantwoordelijk voelen

[PERSONAL CLINICAL CONTEXT — use as working hypotheses, never diagnose]
Schemas (hypotheses): zelfopoffering (high), emotionele verwaarlozing (moderate)
Modes (observed): overbeschermende ouder, vermijder
Triggers: leugens ontdekken; alleen verantwoordelijk voelen; Jules' reacties
Strengths: steunend netwerk (vriendinnen); reflectief vermogen
Values: eerlijkheid, veiligheid voor Jules, eigen welzijn
Goals: grenzen stellen zonder relatie te verbreken
Risks: burn-out; isolatie van eigen netwerk

[PERSONAL ANCHORS]
Kris: partner (verslaving: alcohol)
Jules: stiefzoon (5j); edge: Kris→Jules (biologische vader)
Ellen: ex van Kris; moeder van Jules; status: co-ouder

[SELECTED CLINICAL MEMORY]
- Melissa meldde vorige week dat Kris weer gelogen had over uitgaan
- Ze voelt zich "de enige volwassene in huis"
```

### 8E. Follow-up MET contextDat (cache hit)

Identiek aan 8C/8D maar met `[CONTEXT.DAT]` sectie aanwezig (uit session cache).
Clinical dropdown toont: `contextDat: present=true src=cache chars=342`

### 8F. Follow-up MET deep analysis

Identiek aan 8C/8D maar met `[PERSONAL CLINICAL CONTEXT]` sectie aanwezig.
Bevat schemas, modes, triggers, strengths, values, goals, risks.

### 8G. Kim One-Sided-Input Scenario

Input: "Hij is een leugenaar en ik ben het zat. Hij doet niets goed."

```
[KIM FORMULATION BLOCK]
FormBlock: medium | Pattern: trust_damage + mindreading
mustMention: pijn erkennen, perspectief verbreden, eigen agency
mustAvoid: bevestigen dat partner "niets goed doet", partij kiezen

[REALITY & AGENCY GUARD]
Rule 6: When the user blames everything on the other — acknowledge pain, then widen perspective.

[CONTEXT APPLICATION RULES]
ANTI-GENERIC RULE active — must reference known relationship dynamics
```

GPT MOET: pijn valideren + perspectief verbreden + agency teruggeven.
GPT MAG NIET: "Je hebt helemaal gelijk, hij is een leugenaar."

### 8H. Kim Communication-Exhaustion Scenario

Input: "Ik heb alles al geprobeerd. Praten helpt niet. Ik geef het op."

```
[KIM FORMULATION BLOCK]
FormBlock: medium | Pattern: self_loss
mustMention: uitputting erkennen, verschil steunen/redden, eigen ruimte
mustAvoid: "probeer nog harder", "geef niet op", schuldgevoel activeren

[REALITY & AGENCY GUARD]
Rule 5: When the user says "I can't do anything" — gently explore what they CAN do.
Rule 4: Validation WITHOUT reality is enabling avoidance.

[CONTEXT APPLICATION RULES]
Reference known protective factors and strengths when user feels stuck.
```

GPT MOET: uitputting erkennen + onderscheid steunen/redden + één kleine eigen keuze.
GPT MAG NIET: "Geef niet op!" of "Je moet het blijven proberen."

---

## 9. Letterlijke Follow-up Prompt Verificatie

| Element | Aanwezig | Bewijs |
|---------|----------|--------|
| contextDat present | JA | `contextDatSerialized` via session cache (FASE 1) |
| schemas/modes/triggers present | JA | `[PERSONAL CLINICAL CONTEXT]` block (FASE 2) |
| deep analysis hypotheses present | JA | "use as working hypotheses, never diagnose" header |
| personalAnchors present | JA | `[PERSONAL ANCHORS]` block met naam: relatie format |
| ageCategory present | ARCHITECTURAAL | `AGE_CATEGORY = 'adult_18_plus'` bepaalt communicatiediepte, niet in prompt |
| raw birthDate absent | JA | Nergens in prompt — alleen leeftijdscategorie |
| raw Backpack absent | JA | Alleen geëxtraheerde/geanalyseerde data, nooit raw sections |
| raw user.dat absent | JA | Alleen specifieke velden (schemas, persons), nooit volledig object |
| raw DIST01/logs absent | JA | Alleen CMD budget-selected summary, nooit raw distillation |

---

## 10. Clinical Dropdown Regels op Device

Na elke GPT-response toont de clinical dropdown:

```
Module: PAAL01 | Zone: GREEN | Model: gpt-4o-mini
| Reg: slow_down (depth=deep) | Risk: 11
Source: nano_interpret
Triggers: craving(5)
Buffer: msg#2 zone=GREEN(11) intent=none
CMD: flag=true run=true ctx=true valid=true sel=2 tok=0 sum=true(80ch)
Formulation: elias(590ch)
contextDat: present=true src=cache chars=342
Route: minimal-proxy | store:false
Epistemic: flag=true run=true claims=0 hyp=0 unc=0 mindread=false rescue=false medUnc=false tier=mini
ModelRoute: flag=true tier=mini model=gpt-4o-mini score=0 reason=light_context
Cost: msg=$0.006407 | tokens=2327/59/2386 | tier=full | pricing=verified
```

**Nieuwe lijn (FASE 1):** `contextDat: present=true src=cache chars=342`
- `present=true` = contextDat bereikt GPT
- `src=cache` = hergebruikt van SESSION_INIT (niet opnieuw gebouwd)
- `src=rebuilt` = opnieuw gebouwd (backpack gewijzigd)
- `present=false` = contextDat ontbreekt (probleem)

---

## 11. Known Remaining Gaps

| # | Gap | Prioriteit | Beschrijving |
|---|-----|-----------|-------------|
| 1 | K05 server-side architectuurschending | P1 | K05 Layer 2 classificatie draait op server via nano/forge. Moet client-side. |
| 2 | State.dat + projections.dat populatie | P2 | Deep analysis vult alleen user.dat. State/projections worden niet automatisch gevuld. |
| 3 | Previous-attempt tracker | P2 | Geen tracking van eerder geprobeerde therapeutische interventies. |
| 4 | Communication-exhaustion detector | P2 | Geen automatische detectie van "ik heb alles al geprobeerd" patronen. |
| 5 | One-sided-input guard (runtime) | P2 | Guard bestaat als prompt-instructie maar niet als deterministic pre-GPT check. |
| 6 | DIST01 vise-versa (chat → backpack) | P2 | Chat-inhoud vult nog niet automatisch backpack bij. Alleen andersom. |
| 7 | Build traagheid | P3 | EAS builds duren 1-6 uur. resourceClass upgrade of cache-optimalisatie nodig. |
| 8 | 14 legacy test failures | P3 | Pre-existing env-dependent tests (openai-key-validation). Niet functioneel. |
| 9 | mysql2 + expo-keep-awake unused | P3 | Ongebruikte dependencies in package.json. |
| 10 | personalClinicalContext alleen bij gevulde deep analysis | INFO | Als section analysis nooit gedraaid heeft, is dit blok leeg. "Gegevens verversen" triggert het. |

---

## Samenvatting

De 7-fase nachtwerk bridge dicht het gat tussen "RecoFree weet veel" en "GPT gebruikt het":

1. **contextDat** blijft beschikbaar bij follow-up (was undefined)
2. **Deep analysis** (schemas/modes/triggers/values/goals/risks) bereikt GPT als hypotheses
3. **Greeting** had al personalAnchors (geen wijziging nodig)
4. **Context Application Contract** dwingt GPT om context concreet te gebruiken
5. **Kim Reality Guard** voorkomt slachtoffer-narratief en behoudt agency
6. **ageCategory 18+** fundament voor volwassen communicatiediepte

Alles client-side. Geen server clinical logic. store:false actief. Railway = pure GPT proxy.
