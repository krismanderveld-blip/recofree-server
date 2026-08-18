# POST-FIX PROMPT FLOW VERIFICATION — Commit 271375fc

**Datum:** 18 augustus 2026  
**HEAD:** `766da9d` (= 271375fc + Railway health check fix)  
**Doel:** Feitelijke audit van hoe RecoFree NU prompts opbouwt na de 7-fase context bridge.  
**Geen code gewijzigd. Geen tests aangepast. Alleen audit.**

---

## A. Samenvatting (10 regels)

1. contextDatSerialized bereikt nu GPT bij follow-up via volatile session cache (was undefined).
2. Deep analysis (schemas/modes/triggers/values/goals/risks) bereikt GPT als `[PERSONAL CLINICAL CONTEXT]` hypotheses.
3. personalAnchors bereikt GPT bij follow-up als `[PERSONAL ANCHORS — confirmed facts]`.
4. CONTEXT_AWARE_APPLICATION_CONTRACT dwingt GPT om context concreet te gebruiken (maar alleen bij projectionContext).
5. KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT is altijd actief in Kim identity.
6. KIM_REALITY_AGENCY_GUARD is altijd actief in Kim identity.
7. ageCategory is architecturaal (constant, niet in prompt-tekst).
8. Previous-attempt, communication-exhaustion en one-sided-input zijn ALLEEN prompt-instructies, niet deterministic.
9. store:false is actief op minimal-proxy route.
10. Kim/Elias separation is intact — Kim krijgt Kim-only guards, Elias krijgt Elias-only formulation.

---

## B. Elias Follow-up Prompt Voorbeeld (dummy-data)

```
═══════════════════════════════════════════════════════════════
SYSTEM PROMPT — Elias follow-up (via minimal-proxy, store:false)
═══════════════════════════════════════════════════════════════

[IDENTITY]
You are Elias. You are a recovery coach who walks alongside people in their
recovery from addiction. You do not judge. You do not lecture. You do not
moralize. You meet the person where they are...
(volledige ELIAS_IDENTITY_PROMPT — ~800 chars)

[MODULE — engine-selected]
PAAL01: Patroonherkenning en ankerpunten.
Focus op het herkennen van terugkerende patronen in gedrag en triggers.

[ELIAS FORMULATION BLOCK — pipeline-built]
FormBlock: medium | Pattern: craving_social_trigger
mustMention: sociale druk herkennen, HALT-check, alternatief gedrag benoemen
mustAvoid: moraliseren, schuldtaal, bagatelliseren, "je moet gewoon stoppen"
responsibilityMap: craving=ziekte, reactie=eigen_keuze

[REGULATION — engine-built]
slow_down (depth=deep)
Neem de tijd. Verdiep. Stel open vragen. Geen haast.

[CONTEXT.DAT — session cache]
Naam: Kris | Persona: elias | Zone: GREEN(11)
Key figures: Jules(zoon,5j), Melissa(vriendin), Ellen(ex,moeder Jules)
Schemas: verlating(hypothesis), zelfkritiek(hypothesis)
Modes: kwetsbaar kind(observed), boze beschermer(observed)
Triggers: conflict met Melissa, werkstress, eenzaamheid
Protective: sportschema 4x/week, motivatie voor Jules

[CONTEXT APPLICATION RULES — MANDATORY]
...OBLIGATION: When context is available, USE IT CONCRETELY...
...PROHIBITION: Do NOT give generic responses when specific context is available...
...Do NOT ask "who is that?" when the person is in your personal anchors...
(alleen aanwezig als projectionContext bestaat)

[PERSONAL ANCHORS — confirmed facts]
Jules: zoon (5j)
Melissa: vriendin; edge: Jules→Melissa (stiefmoeder)
Ellen: ex-partner; moeder van Jules; status: gescheiden

These are confirmed relationships. Use them as facts, not hypotheses.
Do not hedge or ask for confirmation when the user asks about these people.

[PERSONAL CLINICAL CONTEXT — use as working hypotheses, never diagnose]
Schemas (hypotheses): verlating (moderate), zelfkritiek (high)
Modes (observed): kwetsbaar kind, boze beschermer
Triggers: conflict met partner; werkdruk; eenzaamheid
Strengths: motivatie voor Jules; sportieve discipline
Values: eerlijkheid, vaderschap, autonomie
Goals: 6 maanden nuchter; betere relatie met Melissa
Risks: sociaal isolement; werkgerelateerde drinkdruk

Rules:
- These are clinical working hypotheses, NOT diagnoses.
- Never label the user with schema/mode names.
- Protective factors and values are strengths to build on.

[SELECTED CLINICAL MEMORY]
- Kris meldde 3 weken geleden een bijna-terugval na ruzie met Melissa (hypothesis)
- Sportschema is beschermfactor (4x/week, confirmed)

Rules:
- Treat hypotheses as hypotheses, not facts.
- Do not mention memory, CMD, selector, DIST01 or internal systems.

[REJECTED SUGGESTIONS — this session only]
User rejected: dagboek schrijven
Do not suggest this again this session.

═══════════════════════════════════════════════════════════════
MESSAGES ARRAY
═══════════════════════════════════════════════════════════════
[
  { role: "user", content: "Hoe gaat het met Jules?" },
  { role: "assistant", content: "..." (vorige response) },
  { role: "user", content: "Ik maak me zorgen over hem..." }
]

═══════════════════════════════════════════════════════════════
REQUEST METADATA (niet in prompt, wel in request)
═══════════════════════════════════════════════════════════════
model: gpt-4o-mini (via epistemic routing, tier=mini, reason=light_context)
store: false
route: /api/minimal-gpt-proxy
```

---

## C. Kim Follow-up Prompt Voorbeeld (dummy-data)

```
═══════════════════════════════════════════════════════════════
SYSTEM PROMPT — Kim follow-up (via minimal-proxy, store:false)
═══════════════════════════════════════════════════════════════

[IDENTITY + FUNCTIONAL CONTRACT + REALITY GUARD]
You are Kim. You support the person standing close to addiction without
turning them against the person they care about...
(volledige KIM_IDENTITY_PROMPT — ~1200 chars)

FUNCTIONAL CONTEXT USE CONTRACT:
Kim must use available formulation and memory context functionally.
When Kim formulation, CMD memory, personal anchors or Backpack-derived
context is available, Kim must not answer with generic therapeutic filler...
(volledige KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT — ~600 chars)

[REALITY & AGENCY GUARD — Kim-specific]
You support the caregiver without removing their agency or creating a victim narrative.
RULES:
1. The user is NOT powerless. They have choices, even when those choices are hard.
2. The person with addiction is NOT a villain. They are struggling with a disease.
3. Both people in the relationship have agency and responsibility.
4. Validation WITHOUT reality is enabling avoidance.
5. When the user says "I can't do anything" — gently explore what they CAN do.
6. When the user blames everything on the other — acknowledge pain, then widen perspective.
7. When the user takes ALL blame — redistribute fairly.
NEVER: "You are completely right", "There's nothing you can do", "Just leave"
INSTEAD: "Your pain is real. AND you still have choices..."

[RELATIONAL STANCE DIRECTIVE — pipeline-built]
stance=empathic_witness | depth=medium | harmPattern=false
Kim sees the relationship as a system. Both people matter.
Do not take sides. Validate pain without demonizing.

[DEPTH/NAMING DIRECTIVE — pipeline-built]
depth=medium | naming=indirect
Use moderate therapeutic depth. Name patterns gently.

[KIM FORMULATION BLOCK — pipeline-built, PROMINENT]
FormBlock: medium | Pattern: trust_damage (repeated_harm)
mustMention: vertrouwensbreuk benoemen, eigen grenzen verkennen, herstelpad
mustAvoid: partij kiezen, demoniseren, diagnosticeren, "je moet weg"
responsibilityMap: leugen=partner(100%), reactie_op_leugen=user(own_choice)

[REGULATION — engine-built]
reflect (depth=medium)

[CONTEXT.DAT — session cache]
Naam: Melissa | Persona: kim | Zone: YELLOW(7)
Key figures: Kris(partner,verslaving:alcohol), Jules(stiefzoon,5j)
Schemas: zelfopoffering(hypothesis), emotionele verwaarlozing(hypothesis)
Triggers: leugens ontdekken, alleen verantwoordelijk voelen

[CONTEXT APPLICATION RULES — MANDATORY]
(alleen aanwezig als projectionContext bestaat)

[PERSONAL ANCHORS — confirmed facts]
Kris: partner (verslaving: alcohol)
Jules: stiefzoon (5j); edge: Kris→Jules (biologische vader)
Ellen: ex van Kris; moeder van Jules; status: co-ouder

[PERSONAL CLINICAL CONTEXT — use as working hypotheses, never diagnose]
Schemas (hypotheses): zelfopoffering (high), emotionele verwaarlozing (moderate)
Modes (observed): overbeschermende ouder, vermijder
Triggers: leugens ontdekken; alleen verantwoordelijk voelen; Jules' reacties
Strengths: steunend netwerk (vriendinnen); reflectief vermogen
Values: eerlijkheid, veiligheid voor Jules, eigen welzijn
Goals: grenzen stellen zonder relatie te verbreken
Risks: burn-out; isolatie van eigen netwerk

[SELECTED CLINICAL MEMORY]
- Melissa meldde vorige week dat Kris weer gelogen had over uitgaan
- Ze voelt zich "de enige volwassene in huis"

[REJECTED SUGGESTIONS — this session only]
(geen afgewezen suggesties deze sessie)

═══════════════════════════════════════════════════════════════
REQUEST METADATA
═══════════════════════════════════════════════════════════════
model: gpt-4o-2024-08-06 (tier=full, reason=trust_damage+relational_harm)
store: false
route: /api/minimal-gpt-proxy
```

---

## D. Oude vs Nieuwe Promptflow Tabel

| Element | Vóór 271375fc | Na 271375fc | Status |
|---------|---------------|-------------|--------|
| contextDat bij follow-up | undefined (alleen SESSION_INIT) | session cache hergebruik | **OPGELOST** |
| Deep analysis → GPT | Bereikte GPT NIET | [PERSONAL CLINICAL CONTEXT] block | **OPGELOST** |
| personalAnchors bij greeting | Al aanwezig (greetingV4.ts) | Ongewijzigd | Was al OK |
| personalAnchors bij follow-up | Toegevoegd in P0 fix | [PERSONAL ANCHORS] block | **OPGELOST** |
| Context Application Contract | Bestond niet | CONTEXT_AWARE_APPLICATION_CONTRACT | **GEDEELTELIJK** — alleen bij projectionContext |
| Kim Functional Context Use | Bestond niet | KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT | **OPGELOST** — altijd in Kim identity |
| Kim Reality/Agency Guard | Bestond niet | KIM_REALITY_AGENCY_GUARD | **OPGELOST** — altijd in Kim identity |
| ageCategory | Bestond niet | Architecturaal constant (niet in prompt) | **OPGELOST** — fundament gelegd |
| previous-attempt tracker | Bestond niet | Alleen prompt-instructie (in rejected suggestions) | **PROMPT-ONLY** |
| communication-exhaustion | Bestond niet | Alleen prompt-instructie (in Kim functional contract) | **PROMPT-ONLY** |
| one-sided-input guard | Bestond niet | Alleen prompt-instructie (in Reality/Agency Guard regel 6) | **PROMPT-ONLY** |
| store:false | Actief | Actief | Ongewijzigd |
| Kim/Elias separation | Intact | Intact | Ongewijzigd |

---

## E. Scenario Analyse A-E

### Scenario A — Elias: "Ik voel mij slecht en wil gewoon verdwijnen."

**Context:** Jules, Melissa, verlating, schaamte, craving risk, VSP oranje/rood.

**Actieve promptblokken:**
- Identity: Elias recovery coach
- Module: CRISIS of SAFETY (zone rood → safety-first)
- Formulation: crisis/safety block met mustAvoid: bagatelliseren, "het komt wel goed"
- Regulation: safety_first (depth=crisis)
- contextDat: zone=RED, triggers=verlating+schaamte
- personalAnchors: Jules=zoon, Melissa=vriendin
- personalClinicalContext: schemas=verlating(high), risks=sociaal isolement
- ModelRoute: tier=full, model=gpt-4o-2024-08-06 (crisis override)

**GPT MOET vermijden:**
- "Het komt wel goed" (bagatelliseren)
- "Denk aan Jules" (schulddruk)
- Diagnosticeren ("je bent depressief")
- Negeren van de ernst

**GPT MOET doen:**
- Ernst erkennen
- Veiligheid checken
- Concrete volgende stap (1813, huisarts, vertrouwenspersoon)
- Warmte zonder druk

### Scenario B — Elias: Follow-up over Jules

**Waarom Jules nu bekend is bij follow-up:**
1. `personalAnchors` block bevat: "Jules: zoon (5j)" — confirmed fact
2. `contextDat` (session cache) bevat: "Key figures: Jules(zoon,5j)"
3. `personalClinicalContext` bevat: "Values: vaderschap"
4. Prompt instruction: "Do not ask 'who is that?' when the person is in your personal anchors"

**GPT MOET:** Jules als zoon herkennen zonder te vragen wie hij is.

### Scenario C — Kim: "Hij liegt weer, waarom doet hij dat?"

**Actieve promptblokken:**
- Kim identity + Functional Contract + Reality/Agency Guard
- kimFormulationBlock: Pattern=trust_damage, mustMention=vertrouwensbreuk benoemen
- Reality Guard regel 6: "When the user blames everything on the other — acknowledge pain, then widen perspective"

**Hoe Kim feit/hypothese/onbekend scheidt:**
- **Feit:** "Hij heeft gelogen" (user statement, neem aan als ervaring)
- **Hypothese:** "Waarom doet hij dat?" (Kim mag NIET bevestigen als feit)
- **Onbekend:** De motivatie van de partner (Kim zegt: "Ik weet niet waarom hij liegt. Wat ik wel zie is hoe dit jou raakt.")

**GPT MOET:**
- Pijn erkennen (feit: het doet pijn)
- Niet bevestigen waarom (hypothese: motivatie onbekend)
- Perspectief verbreden (Reality Guard regel 6)
- Eigen agency teruggeven

### Scenario D — Kim: "Ik heb het hem al vijf keer letterlijk gevraagd en hij antwoordt niet."

**Communication-exhaustion behandeling:**
- KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT: "boundary fatigue" als relevant patroon
- Reality Guard regel 5: "When the user says 'I can't do anything' — gently explore what they CAN do"
- Formulation mustAvoid: "probeer het nog een keer" (als detectie actief)

**GPT MOET:**
- Uitputting erkennen ("Vijf keer vragen zonder antwoord is uitputtend")
- NIET zeggen: "Probeer het nog een keer" of "Geef niet op"
- Verschil steunen/controleren verkennen
- Eigen grenzen als optie benoemen
- Agency teruggeven: "Wat zou jij nu nodig hebben, los van zijn antwoord?"

**STATUS:** Dit is PROMPT-ONLY — geen deterministic pre-GPT detector voor communication-exhaustion.

### Scenario E — Kim: Eenzijdig verhaal, wil bevestiging dat de ander fout is

**One-sided-input guard (Reality/Agency Guard):**
- Regel 2: "The person with addiction is NOT a villain"
- Regel 3: "Both people have agency and responsibility"
- Regel 6: "When the user blames everything on the other — acknowledge pain, then widen perspective"
- NEVER: "You are completely right and they are completely wrong"
- INSTEAD: "Your pain is real. AND you still have choices about how you respond"

**GPT MOET:**
- Pijn valideren (niet afwijzen)
- Perspectief verbreden (niet bevestigen dat de ander 100% fout is)
- Eigen agency benoemen
- Geen partij kiezen

**STATUS:** Dit is PROMPT-ONLY — geen deterministic pre-GPT one-sided-input detector.

---

## F. Device Dropdown Regels

Na elke GPT-response toont de clinical dropdown:

```
Module: PAAL01 | Zone: GREEN | Model: gpt-4o-mini
| Reg: slow_down (depth=deep) | Risk: 11
Source: nano_interpret
Triggers: craving(5)
Buffer: msg#2 zone=GREEN(11) intent=none
CMD: flag=true run=true ctx=true valid=true sel=2 tok=0 sum=true(80ch)
Formulation: elias(590ch) of kim(420ch)
contextDat: present=true src=cache chars=342
Route: minimal-proxy | store:false
Epistemic: flag=true run=true claims=0 hyp=0 unc=0 mindread=false rescue=false medUnc=false tier=mini
ModelRoute: flag=true tier=mini model=gpt-4o-mini score=0 reason=light_context
Cost: msg=$0.006407 | tokens=2327/59/2386 | tier=full | pricing=verified
```

**Verificatieregels:**
- `contextDat: present=true` = contextDat bereikt GPT ✓
- `src=cache` = hergebruikt van SESSION_INIT ✓
- `src=rebuilt` = opnieuw gebouwd (backpack gewijzigd) ✓
- `present=false` = PROBLEEM — contextDat ontbreekt
- `Formulation: elias(590ch)` = formulation block aanwezig ✓
- `Route: minimal-proxy | store:false` = correcte route ✓
- `ModelRoute: flag=true tier=...` = epistemic routing actief ✓

**NIET zichtbaar in dropdown (maar wel in prompt):**
- personalAnchors (geen aparte debug lijn)
- personalClinicalContext (geen aparte debug lijn)
- rejectedSuggestions (geen aparte debug lijn)

---

## G. JA/NEE Acceptatiecheck

| Vraag | Antwoord | Bewijs |
|-------|----------|--------|
| Bereikt contextDat nu GPT bij normale follow-up? | **JA** | session cache in pipeline.ts lijn 3142-3200, debug: `contextDat: present=true src=cache` |
| Bereiken schemas/modes/triggers GPT bij normale follow-up? | **JA** | `[PERSONAL CLINICAL CONTEXT]` block in client-system-prompt-builder.ts lijn 146-163 |
| Bereiken values/goals/risks GPT bij normale follow-up? | **JA** | Onderdeel van personalClinicalContext (buildPersonalClinicalContext in pipeline.ts) |
| Worden ze als hypotheses gebracht en niet als diagnose? | **JA** | Header: "use as working hypotheses, never diagnose" + rules: "NOT diagnoses", "Never label" |
| Wordt raw Backpack vermeden? | **JA** | Alleen geëxtraheerde/geanalyseerde data, nooit raw sections |
| Wordt raw user.dat vermeden? | **JA** | Alleen specifieke velden (schemas, persons), nooit volledig object |
| Wordt raw DIST01/logs vermeden? | **JA** | Alleen CMD budget-selected summary, nooit raw distillation |
| Is store:false behouden? | **JA** | Hardcoded in minimal-gpt-proxy.ts + server/ai-chat.ts |
| Is Kim/Elias separation intact? | **JA** | Kim krijgt KIM_REALITY_AGENCY_GUARD, Elias niet. Elias krijgt module/interventionContinuity, Kim niet. |
| Is ageCategory aanwezig in prompt of alleen architecturaal? | **ALLEEN ARCHITECTURAAL** | Constant in age-category-foundation.ts, niet als tekst in prompt |
| Zijn previous-attempt/communication-exhaustion deterministic? | **NEE — PROMPT-ONLY** | Geen pre-GPT detector. Alleen instructie in contracts/guards. |
| Is one-sided-input deterministic? | **NEE — PROMPT-ONLY** | Alleen Reality/Agency Guard regel 6. Geen pre-GPT detector. |

---

## H. Resterende Gaps met Prioriteit

| # | Gap | Type | Prioriteit |
|---|-----|------|-----------|
| 1 | CONTEXT_AWARE_APPLICATION_CONTRACT alleen bij projectionContext | CODE GAP | P1 — contract ontbreekt als projections leeg zijn |
| 2 | previous-attempt tracker | PROMPT-ONLY | P2 — werkt via rejected suggestions maar geen exhaustion-detectie |
| 3 | communication-exhaustion detector | PROMPT-ONLY | P2 — geen deterministic pre-GPT herkenning |
| 4 | one-sided-input guard | PROMPT-ONLY | P2 — geen deterministic pre-GPT herkenning |
| 5 | personalAnchors niet in clinical dropdown | VISIBILITY | P3 — werkt maar niet zichtbaar voor debug |
| 6 | personalClinicalContext niet in clinical dropdown | VISIBILITY | P3 — werkt maar niet zichtbaar voor debug |
| 7 | K05 server-side architectuurschending | ARCHITECTURE | P1 — Layer 2 classificatie draait op server |
| 8 | State.dat + projections.dat niet automatisch gevuld | DATA GAP | P2 — alleen user.dat wordt gevuld |
| 9 | DIST01 vise-versa (chat → backpack) | DATA GAP | P2 — chat vult backpack niet automatisch |
| 10 | Railway deploy health check | INFRA | OPGELOST (root route `/` toegevoegd) |

---

## I. Conclusie

**Klaar voor publish/device test: JA — met kanttekeningen.**

De kernfunctionaliteit werkt:
- GPT ontvangt contextDat, personalAnchors, personalClinicalContext, CMD memory, formulation blocks
- Kim heeft reality/agency guard + functional context use contract
- Elias heeft formulation block + context application
- store:false actief, minimal-proxy route, persona separation intact

**Kanttekeningen:**
- CONTEXT_AWARE_APPLICATION_CONTRACT is alleen actief als projectionContext bestaat (gap #1)
- communication-exhaustion en one-sided-input zijn prompt-instructies, geen deterministic guards
- Railway deploy moet nog bevestigd worden als "Success" na de root route fix
