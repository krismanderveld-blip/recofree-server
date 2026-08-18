# FORENSIC FAILURE REPORT — Context Bridge 271375fc → 766da9d → 8cfecfc

**Datum:** 19 augustus 2026  
**Scope:** 7-fase context bridge + Railway deploy failures  
**Doel:** Blootleggen van fouten, verkeerde aannames, gemiste gaten en te optimistische claims.  
**Geen code gewijzigd.**

---

## 1. BEWEZEN OORSPRONKELIJKE PROBLEMEN

| # | Probleem | Bewezen? | Bewijs |
|---|---------|----------|--------|
| 1 | contextDat bij follow-up = undefined | **JA** | pipeline.ts bouwde contextDat alleen bij SESSION_INIT of backpack dirty. Follow-up messages kregen undefined. |
| 2 | Deep analysis niet in prompt | **JA** | buildPersonalClinicalContext bestond niet. Deep analysis resultaten (schemas, modes, triggers) werden opgeslagen maar nooit naar GPT gestuurd. |
| 3 | personalAnchors bij greeting | **NIET BEWEZEN ALS PROBLEEM** | greetingV4.ts gebruikte al extractedEntities.persons. Het probleem was dat extractedEntities LEEG was (extraction faalde). |
| 4 | Kim/Elias contextgebruik onvoldoende | **JA** | Geen output contract dwong GPT om context te gebruiken. GPT kon generiek antwoorden ondanks beschikbare formulation. |
| 5 | Railway deploy niet live | **JA** | Railway health check verwacht HTTP 200 op `/`. Server had alleen `/api/health`. Elke deploy faalde op health check. |

---

## 2. FOUTE OF ONVOLLEDIGE CLAIMS

### Claim A: "Railway + GitHub bijgewerkt" (NACHTWERK rapport)
- **Claim:** "Railway + GitHub bijgewerkt"
- **Werkelijkheid:** GitHub was bijgewerkt. Railway deploy FAALDE. De NACHTWERK code draait NIET op Railway.
- **Bewijs:** `curl / → 404`, Railway status "Online · Deploy failed"
- **Impact:** LAAG voor client-side features (die zitten in APK, niet Railway). HOOG voor de root route fix (die moet op Railway draaien).

### Claim B: "contextDat bereikt nu GPT bij follow-up via volatile session cache"
- **Claim:** Volledig opgelost.
- **Werkelijkheid:** Code bestaat en tests passen. MAAR: alleen bewezen in unit tests. Geen device/runtime bewijs. De APK die dit bevat is nog niet gebouwd (build hangt).
- **Bewijs:** `context-dat-session-cache.ts` bestaat, 8 tests passen, pipeline integreert het.
- **Impact:** MEDIUM — lokaal bewezen, niet op device geverifieerd.

### Claim C: "CONTEXT_AWARE_APPLICATION_CONTRACT dwingt GPT"
- **Claim:** Contract dwingt GPT om context te gebruiken.
- **Werkelijkheid:** Contract was CONDITIONEEL — alleen geïnjecteerd als projectionContext bestond. Nu gefixed (P1 fix, commit 8cfecfc).
- **Bewijs:** Code review toonde `if (input.projectionContext) { sections.contextApplicationContract = ... }`. Fix verplaatst het buiten de if.
- **Impact:** HOOG — zonder fix was het contract afwezig bij de meeste follow-up berichten.

### Claim D: "3660 tests pass"
- **Claim:** Alle tests passen.
- **Werkelijkheid:** CORRECT — 3667 tests passen na P1 fix. 1 skipped (env-dependent openai-key-validation).
- **Bewijs:** `npx vitest run` output: "3667 passed | 1 skipped"
- **Impact:** GEEN — claim klopt.

### Claim E: "personalAnchors altijd aanwezig"
- **Claim:** personalAnchors bereikt GPT altijd bij follow-up.
- **Werkelijkheid:** Code bestaat. MAAR: personalAnchors is afhankelijk van extractedEntities.persons. Als extraction nooit draaide (of faalde), is personalAnchors undefined.
- **Bewijs:** `buildPersonalAnchorsBlock()` returneert undefined als `currentUserDat.extractedEntities?.persons` leeg is.
- **Impact:** HOOG — na clean install + extraction werkt het. Bij bestaande installaties met corrupte data: undefined.

### Claim F: "Kim Reality/Agency Guard actief"
- **Claim:** Guard is altijd actief in Kim prompts.
- **Werkelijkheid:** CORRECT — guard is onderdeel van KIM_IDENTITY_PROMPT, altijd geïnjecteerd.
- **Bewijs:** `kim-prompt-composer.ts` lijn 32: identity bevat KIM_IDENTITY_PROMPT + KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT + KIM_REALITY_AGENCY_GUARD.
- **Impact:** GEEN — claim klopt.

---

## 3. VOLLEDIG BEWEZEN FIXES

| Fix | Codepad | Testbewijs | Promptbewijs | Runtime/device |
|-----|---------|------------|--------------|----------------|
| contextDat session cache | `lib/pipeline/context-dat-session-cache.ts` | 8 tests pass | Prompt builder injects `sections.context` | **NIET GEVERIFIEERD** |
| personalClinicalContext | `pipeline.ts:buildPersonalClinicalContext()` | Implicit (TS compiles, prompt builder handles) | `[PERSONAL CLINICAL CONTEXT]` block in builder | **NIET GEVERIFIEERD** |
| Kim Reality/Agency Guard | `lib/engine/kim/prompt-block.ts` | 7 tests pass | Altijd in Kim identity | **NIET GEVERIFIEERD** |
| Context Application Contract (P1 fix) | `kim-prompt-composer.ts`, `elias-prompt-composer.ts` | 7 tests pass | Always in sections.contextApplicationContract | **NIET GEVERIFIEERD** |
| Railway root route | `server/_core/index.ts` | esbuild succeeds | N/A | **NIET LIVE** (deploy pending) |
| max_tokens 32768→16384 | `server/_core/llm.ts` | 8 tests pass | N/A | **LIVE** (curl test bewijst extraction werkt) |
| OpenAI extraction fallback | `server/_core/llm.ts` | 8 tests pass | N/A | **LIVE** (curl test bewijst persons extracted) |

---

## 4. GEDEELTELIJK BEWEZEN FIXES

| Fix | Wat werkt | Wat ontbreekt | Risico |
|-----|-----------|---------------|--------|
| Context Application Contract | Code + tests bewijzen altijd actief | Geen device/runtime bewijs | LAAG — code is deterministisch |
| personalAnchors | Code werkt als extractedEntities gevuld is | Afhankelijk van succesvolle extraction | MEDIUM — extraction kan falen |
| Deep analysis → prompt | Code bouwt block als deepAnalysis in userDat staat | deepAnalysis alleen na "Gegevens verversen" + succesvolle GPT call | MEDIUM — niet automatisch |
| Kim one-sided-input guard | Prompt instructie in Reality/Agency Guard regel 6 | Geen deterministic pre-GPT detector | LAAG — GPT volgt instructies redelijk |
| Communication-exhaustion | Prompt instructie in Functional Context Use Contract | Geen deterministic pre-GPT detector | LAAG — GPT volgt instructies redelijk |
| ageCategory | Architecturaal constant, code exists | Niet in prompt-tekst, niet zichtbaar voor GPT | GEEN RISICO — is fundament, niet feature |

---

## 5. NIET LIVE OP RAILWAY

| Item | Status |
|------|--------|
| Huidige live commit op Railway | **Pre-271375fc** (exact commit onbekend, maar vóór NACHTWERK) |
| Laatste succesvolle deploy | Bevat: max_tokens fix + OpenAI fallback. Bevat NIET: root route, NACHTWERK, P1 fix |
| Commit 766da9d (root route) | Op GitHub, NIET live op Railway (deploy failed of nog building) |
| Commit 8cfecfc (P1 fix) | Op GitHub, NIET live op Railway |
| Root route `/` | **NIET LIVE** — returns 404 |
| `/api/health` | **LIVE** — returns 200 |
| Production vs GitHub verschil | **6 commits achter** (89e9fac live vs 8cfecfc op GitHub) |

**Kritiek inzicht:** De NACHTWERK changes (context bridge, Kim guards, contracts) zijn **CLIENT-SIDE** code. Ze zitten in de APK, niet op Railway. De enige server-side change is `server/_core/index.ts` (root route). Railway deploy failure blokkeert alleen de root route — niet de klinische features.

---

## 6. TEST CLASSIFICATIE

| Type | Aantal | Wat ze bewijzen | Wat ze NIET bewijzen |
|------|--------|-----------------|---------------------|
| Unit tests (detectors, helpers) | ~2800 | Individuele functies werken correct | Niet dat ze in de juiste volgorde aangeroepen worden |
| Prompt snapshot tests | ~200 | Prompt composers produceren verwachte secties | Niet dat GPT de instructies volgt |
| Pipeline integration tests | ~400 | Pipeline roept modules in juiste volgorde aan | Niet dat het op device werkt met echte data |
| Server tests | ~50 | Server routes compileren en basis-validatie | Niet dat Railway de code accepteert |
| Echte Railway/runtime verificatie | **0** | N/A | **NIETS** — geen enkele test raakt de live server |
| Device verificatie | **0** | N/A | **NIETS** — geen enkele test draait op een echte APK |

**Conclusie:** Alle 3667 tests zijn lokale unit/integration tests. Geen enkele test bewijst dat de code op Railway of device correct draait.

---

## 7. RISICO'S BIJ PUBLISH/DEVICE TEST NU

| # | Risico | Ernst | Mitigatie |
|---|--------|-------|-----------|
| 1 | Railway draait oude code (geen root route) | LAAG | Root route is alleen voor Railway health check, niet voor app functionaliteit |
| 2 | Railway deploy blijft falen | MEDIUM | Railway health check path moet geconfigureerd worden naar `/api/health` in Railway dashboard |
| 3 | Context Application Contract was conditioneel | **OPGELOST** (P1 fix) | Code + tests bewijzen het |
| 4 | Deep analysis alleen na "Gegevens verversen" | MEDIUM | Nieuwe gebruikers zonder backpack krijgen lege context |
| 5 | personalAnchors undefined bij corrupte userDat | MEDIUM | Clean install lost het op, bestaande installaties niet |
| 6 | APK build hangt op 1% | HOOG | Buiten controle — EAS platform issue |
| 7 | Prompt guards zonder deterministic detector | LAAG | GPT volgt instructies redelijk, maar niet 100% |
| 8 | NACHTWERK code niet op Railway | LAAG | NACHTWERK is client-side, hoeft niet op Railway |

---

## 8. REMAINING GAPS — CLASSIFICATIE

| # | Gap | Classificatie | Reden |
|---|-----|---------------|-------|
| 1 | Railway deploy failed (root route niet live) | **P1 BLOCKER voor server features** | Maar NIET blocker voor client-side APK features |
| 2 | APK build hangt (EAS platform) | **P0 BLOCKER voor device test** | Zonder nieuwe APK kan niets geverifieerd worden |
| 3 | personalAnchors undefined bij bestaande installaties | **P1 voor bestaande users** | Clean install werkt, bestaande niet |
| 4 | Deep analysis alleen na handmatige trigger | **P2 hardening** | Werkt na "Gegevens verversen", niet automatisch |
| 5 | communication-exhaustion prompt-only | **P3 cleanup** | GPT volgt instructie redelijk |
| 6 | one-sided-input prompt-only | **P3 cleanup** | GPT volgt instructie redelijk |
| 7 | K05 server-side architectuurschending | **P2 hardening** | Werkt functioneel, schendt alleen architectuurregel |
| 8 | State.dat + projections.dat niet auto-gevuld | **P2 hardening** | Alleen user.dat wordt gevuld |
| 9 | DIST01 vise-versa (chat → backpack) | **P2 hardening** | Chat vult backpack niet automatisch |
| 10 | personalAnchors/personalClinicalContext niet in clinical dropdown | **P3 cleanup** | Werkt maar niet zichtbaar voor debug |

---

## 9. TRUTH TABLE

| Item | Claimed fixed | Code exists | Tests exist | Prompt visible | Runtime live | Device verified | Status |
|------|:---:|:---:|:---:|:---:|:---:|:---:|--------|
| contextDat bij follow-up | YES | YES | YES (8) | YES (in builder) | NO | NO | **LOCAL ONLY** |
| Deep analysis → prompt | YES | YES | IMPLICIT | YES (in builder) | NO | NO | **LOCAL ONLY** |
| personalAnchors bij follow-up | YES | YES | YES (16) | YES (in builder) | PARTIAL (extraction works) | NO | **PARTIAL** |
| Context Application Contract | YES | YES | YES (7) | YES (always) | NO | NO | **LOCAL ONLY** |
| Kim Functional Context Use | YES | YES | YES (20) | YES (in identity) | NO | NO | **LOCAL ONLY** |
| Kim Reality/Agency Guard | YES | YES | YES (7) | YES (in identity) | NO | NO | **LOCAL ONLY** |
| ageCategory 18+ | YES | YES | NO (architectural) | NO (not in prompt) | N/A | N/A | **ARCHITECTURAL** |
| Railway root route | YES | YES | NO (infra) | N/A | **NO** | N/A | **NOT DEPLOYED** |
| max_tokens fix | YES | YES | YES (8) | N/A | **YES** | YES (extraction works) | **LIVE + VERIFIED** |
| OpenAI extraction fallback | YES | YES | YES (8) | N/A | **YES** | YES (persons extracted) | **LIVE + VERIFIED** |
| Extraction trigger in refresh | YES | YES | YES (40) | N/A | NO | NO | **LOCAL ONLY** |
| Backpack section analysis | YES | YES | YES (36) | N/A | NO | NO | **LOCAL ONLY** |

---

## 10. EINDCONCLUSIE

### Wat is ECHT klaar?
- max_tokens fix (LIVE op Railway, bewezen met curl)
- OpenAI extraction fallback (LIVE op Railway, bewezen met curl)
- Alle client-side code (compileert, tests passen, prompt builders correct)

### Wat is LOKAAL klaar maar nog NIET live?
- contextDat session cache (in code, niet in APK op device)
- personalClinicalContext (in code, niet in APK op device)
- Kim Reality/Agency Guard (in code, niet in APK op device)
- Context Application Contract always-active (in code, niet in APK op device)
- Extraction trigger in refresh button (in code, niet in APK op device)
- Railway root route (in GitHub, niet deployed op Railway)

### Wat is HALF gebouwd?
- personalAnchors: werkt na clean install + extraction, NIET voor bestaande installaties met corrupte data
- Deep analysis: werkt alleen na handmatige "Gegevens verversen", niet automatisch bij chat
- Railway deploy: code gepusht, deploy faalt op health check

### Wat moet EERST vóór publish/device test?
1. **APK build moet slagen** — zonder nieuwe APK is alles onverifieerbaar
2. **Railway health check path configureren** — in Railway dashboard, health check path instellen op `/api/health` in plaats van `/`

### Wat mag ABSOLUUT NIET verder gebouwd worden vóór deze checks klaar zijn?
- Geen nieuwe features
- Geen K05 migratie
- Geen state.dat/projections.dat
- Geen deterministic detectors
- Geen prompt rewrites
- Geen server refactors

**EERST:** APK build laten slagen + Railway deploy laten slagen. Dan device test. Dan pas verder.
