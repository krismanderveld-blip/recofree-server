# BACKPACK CLINICAL FORMULATION AUDIT

**Datum:** 2026-08-19
**Scope:** Read-only forensic audit — zero code changes
**Commit:** `8cfecfc` (HEAD)
**Doel:** Beantwoord of RecoFree's backpack-analyse leest zoals een klinisch psycholoog zou doen.

---

## SECTIE 1: HUIDIGE EXTRACTIE-ARCHITECTUUR

RecoFree heeft **twee** extractie-lagen:

| Laag | Bestand | Prompt-rol | Model | Route |
|------|---------|-----------|-------|-------|
| Basic Extraction | `server/backpack-extractor.ts` | "clinical entity extractor" | gpt-4o-mini (via invokeLLM) | tRPC `/api/trpc/ai.extractEntities` |
| Deep Section Analysis | `lib/backpack-extractor/section-analysis-service.ts` | "clinical memory extraction engine" | gpt-4o-mini (via minimal-proxy) | `/api/minimal-gpt-proxy` |

### Basic Extraction extraheert:
- `persons[]` — naam, relatie, emotionele valentie, context
- `events[]` — type (trauma/loss/turning_point/relapse/achievement/conflict/abuse/neglect), tijdperiode, trigger
- `patterns[]` — type (relational/behavioral/emotional/coping/avoidance/schema/cycle), schemaHypothesis (vrije tekst)
- `contexts[]` — type (work/living/social/health/financial/legal)

### Deep Section Analysis extraheert:
- `personalAnchors[]` — naam, relatie (NL), relevantie, emotioneel belangrijk, explicitInSource, confidence
- `relationGraph[]` — subject, relatie, object, explicitInSource, confidence
- `lifeEvents[]` — beschrijving, type, tijdperiode, betrokkenen, emotionele impact, triggerSource
- `lifeStatusFacts[]` — persoon, status (alive/deceased/unknown), explicitInSource, confidence
- `schemas[]` — 16 gevalideerde schema-namen, evidenceType, confidence, doNotDiagnose
- `modes[]` — 9 gevalideerde mode-namen, evidenceType, confidence, doNotDiagnose
- `triggers[]` — trigger, context, severity, confidence
- `protectiveFactors[]` — factor, domein, sterkte, confidence
- `values[]` — waarde, belang, confidence
- `goals[]` — doel, tijdsframe, confidence
- `risks[]` — risico, ernst, actief, confidence
- `recoveryPatterns[]` — Elias-only
- `caregiverPatterns[]` — Kim-only

---

## SECTIE 2: KLINISCHE LEESBRIL CHECK

**Vraag:** Leest de extractie-prompt als een klinisch psycholoog?

### Wat een klinisch psycholoog doet bij het lezen van een levensverhaal:

| Klinische competentie | Basic Extraction | Deep Analysis | Status |
|----------------------|-----------------|---------------|--------|
| Personen herkennen met relatie | JA | JA | OK |
| Emotionele valentie per persoon | JA | JA (emotionallyImportant) | OK |
| Levensgebeurtenissen classificeren | JA (8 types) | JA (8 types) | OK |
| Schema-hypotheses formuleren | DEELS (vrije tekst) | JA (16 gevalideerde schemas) | DEEP BETER |
| Modi herkennen | NEE | JA (9 gevalideerde modes) | DEEP ONLY |
| Triggers identificeren | NEE (alleen isTriggerSource) | JA (trigger + context + severity) | DEEP ONLY |
| Beschermfactoren herkennen | NEE | JA (factor + domein + sterkte) | DEEP ONLY |
| Waarden herkennen | NEE | JA (waarde + belang) | DEEP ONLY |
| Doelen herkennen | NEE | JA (doel + tijdsframe) | DEEP ONLY |
| Risico's herkennen | NEE | JA (risico + ernst + actief) | DEEP ONLY |
| Relatiegraaf bouwen | NEE | JA (subject-relatie-object) | DEEP ONLY |
| Levensstatus (overleden/levend) | NEE | JA | DEEP ONLY |
| Feit vs hypothese onderscheid | NEE | JA (explicitInSource + confidence) | DEEP ONLY |
| Persona-scheiding (Elias/Kim) | NEE | JA (recoveryPatterns vs caregiverPatterns) | DEEP ONLY |
| **Ontwikkelingsfase-bewustzijn** | NEE | NEE | **ABSENT** |
| **Trigger-ketens** (event→meaning→emotion→mode→coping→risk) | NEE | NEE | **ABSENT** |
| **Terugvalroutes** | NEE | NEE | **ABSENT** |
| **Functie van verslaving** (verdoving, controle, ontsnapping) | NEE | NEE | **ABSENT** |
| **Contra-indicaties / wat-niet-te-zeggen** | NEE | NEE | **ABSENT** |
| **Veilige formuleringshinten** | NEE | NEE | **ABSENT** |
| **Bronbewijs per conclusie** | NEE | DEELS (explicitInSource boolean, geen citaat) | **ONVOLLEDIG** |

### Conclusie Sectie 2:

> De Deep Section Analysis is **significant beter** dan de Basic Extraction en bevat ~70% van wat een klinisch psycholoog zou extraheren. Maar 6 cruciale klinische competenties ontbreken volledig: ontwikkelingsfase-bewustzijn, trigger-ketens, terugvalroutes, functie van verslaving, contra-indicaties, en veilige formuleringshinten.

---

## SECTIE 3: ONTWIKKELINGSFASE-CHECK

**Vraag:** Wordt de levensfase van de gebruiker meegenomen in de analyse?

**Antwoord: NEE.**

Geen van beide prompts vraagt naar:
- Leeftijdsfase (0-6, 6-12, 12-18, 18+)
- Ontwikkelingstaken per fase
- Fase-gekoppelde schema-ontwikkeling
- Hechtingsstijl als ontwikkelingsproduct

De `ageCategory` foundation is geplaatst (FASE 6 nachtwerk) maar wordt **niet** doorgegeven aan de extractie-prompts.

**Impact:** Een 19-jarige die schrijft over een alcoholische vader wordt identiek geanalyseerd als een 55-jarige die schrijft over een alcoholische vader. De klinische betekenis is fundamenteel anders.

---

## SECTIE 4: DUMMY INPUT/OUTPUT TEST

### Input (Elias backpack sectie "Mijn Verhaal"):
```
Ik ben Kris, 38 jaar. Mijn vader dronk veel toen ik klein was. Mijn moeder Ellen
heeft altijd voor ons gezorgd maar ze is 3 jaar geleden overleden. Ik heb een
zoon Jules van 5 en een vriendin Melissa. Ik drink al 15 jaar maar de laatste
2 jaar is het erger geworden na het overlijden van mijn moeder. Melissa dreigt
te vertrekken als ik niet stop. Jules begrijpt het niet maar ik zie dat hij bang
wordt als ik drink.
```

### Verwachte klinische extractie (wat een psycholoog zou noteren):

**Personen:** Kris (zelf, 38j), Ellen (moeder, overleden 3j geleden), Jules (zoon, 5j), Melissa (vriendin), vader (alcoholprobleem)

**Relatiegraaf:** Ellen = moeder van Kris, Ellen = moeder van Jules (impliciet), Melissa = vriendin van Kris, Jules = zoon van Kris, vader = vader van Kris

**Levensstatus:** Ellen = deceased (expliciet), vader = unknown

**Schema-hypotheses:**
- abandonment (vader dronk, moeder overleden, Melissa dreigt te vertrekken)
- vulnerability (Jules wordt bang)
- emotional_deprivation (vader niet beschikbaar door alcohol)

**Modi:**
- vulnerable_child (angst voor verlies)
- detached_protector (15 jaar drinken als coping)

**Trigger-keten (ONTBREEKT IN HUIDIGE EXTRACTIE):**
- Overlijden moeder → verlies primaire hechtingsfiguur → versterking abandonment schema → toename drinken als verdoving → Melissa dreigt te vertrekken → heractivering abandonment → meer drinken

**Functie van verslaving (ONTBREEKT):**
- Verdoving van rouwpijn
- Ontsnapping aan schaamte (Jules ziet het)

**Contra-indicaties (ONTBREEKT):**
- Zeg NIET: "je moeder zou dit niet gewild hebben" (instrumentalisering rouw)
- Zeg NIET: "denk aan Jules" (schulddruk als motivatie)
- Zeg NIET: "Melissa heeft gelijk" (partij kiezen)

**Veilige formulering (ONTBREEKT):**
- WEL: "Het verlies van je moeder heeft veel in beweging gezet"
- WEL: "Je ziet dat Jules reageert — dat zegt iets over hoe belangrijk je voor hem bent"

### Wat de huidige Deep Analysis WEL zou produceren:
- Personen: correct (5 personen met relaties)
- Relatiegraaf: correct (5 edges)
- Levensstatus: correct (Ellen=deceased)
- Schemas: waarschijnlijk correct (abandonment, vulnerability)
- Modi: waarschijnlijk correct (vulnerable_child)
- Triggers: deels (overlijden moeder, Melissa dreigt)
- Risico's: deels (relatie-verlies, impact op Jules)

### Wat de huidige Deep Analysis NIET produceert:
- Trigger-keten (event→meaning→emotion→mode→coping→risk)
- Functie van verslaving
- Contra-indicaties
- Veilige formuleringshinten
- Ontwikkelingsfase-context

---

## SECTIE 5: OUTPUT SCHEMA AUDIT

### P0 BUG: FIELD NAME MISMATCH

**De deep analysis data wordt correct opgeslagen in user.dat maar bereikt GPT NOOIT.**

`buildPersonalClinicalContext()` in `pipeline.ts` (lijn 6504-6570) leest VERKEERDE veldnamen:

| Wat deep analysis schrijft | Wat pipeline leest | Match? |
|---------------------------|-------------------|--------|
| `schemas[].schema` | `schemas[].schemaName` | **MISMATCH** |
| `modes[].mode` | `modes[].modeName` | **MISMATCH** |
| `triggers[].trigger` | `triggers[].triggerDescription` | **MISMATCH** |
| `protectiveFactors[].factor` | `protectiveFactors[].description` | **MISMATCH** |
| `values[].value` | `values[].valueName` | **MISMATCH** |
| `goals[].goal` | `goals[].goalDescription` | **MISMATCH** |
| `risks[].risk` | `risks[].riskDescription` | **MISMATCH** |

**Impact:** `buildPersonalClinicalContext()` filtert op niet-bestaande velden → alle items worden weggefilterd → `personalClinicalContext = undefined` → GPT krijgt NOOIT schemas, modes, triggers, values, goals, risks.

**Classificatie: P0 — SILENT DATA LOSS**

De data bestaat in AsyncStorage. De pipeline leest het. Maar de filter op verkeerde veldnamen gooit alles weg. Geen error, geen warning, geen crash. Volledig stil.

---

## SECTIE 6: MERGE RULES EN NUANCEVERLIES

### Merge rules (10 regels) — correct geïmplementeerd:
1. Explicit > inferred ✓
2. Higher confidence wins ✓
3. Null never overwrites known ✓
4. Unknown never overwrites deceased/alive ✓
5. Vague never removes edge ✓
6. Persona separation absolute ✓
7-10. Dedup rules ✓

### Nuanceverlies bij merge:
- **Ambivalentie verdwijnt:** Als sectie A zegt "Melissa is positief" (confidence 0.8) en sectie B zegt "Melissa is negatief" (confidence 0.7), wint A. De ambivalentie verdwijnt.
- **Tijdsverandering verdwijnt:** Als de gebruiker in 2024 schrijft "vader is een goede man" en in 2026 "vader was een alcoholist", wint de hogere confidence. De verandering in perspectief verdwijnt.
- **Geen conflictdetectie:** Er is geen mechanisme dat zegt "sectie A en B spreken elkaar tegen over dezelfde persoon."

---

## SECTIE 7: FOLLOW-UP PROMPT CHECK

### Wat bereikt GPT bij een follow-up bericht:

| Blok | Aanwezig? | Bron | Bewijs |
|------|----------|------|--------|
| Identity prompt | JA | kim-prompt-composer / elias-prompt-composer | Code confirmed |
| Functional Context Use Contract | JA (na P1 fix) | CONTEXT_AWARE_APPLICATION_CONTRACT | Code confirmed |
| Kim Reality/Agency Guard | JA (Kim only) | KIM_REALITY_AGENCY_GUARD | Code confirmed |
| relationalStanceDirective | JA (Kim only) | pipeline → openai-provider | Code confirmed |
| kimFormulationBlock | JA (Kim only) | pipeline → openai-provider | Code confirmed |
| eliasFormulationBlock | JA (Elias only) | pipeline → openai-provider | Code confirmed |
| personalAnchors | JA | buildPersonalAnchorsBlock() | Code confirmed |
| personalClinicalContext | **ALTIJD LEEG** | buildPersonalClinicalContext() | **P0 BUG: field name mismatch** |
| contextDat (cached) | JA (na FASE 1 nachtwerk) | session cache | Code confirmed |
| CMD memory summary | JA | CMD selector → pipeline | Code confirmed |
| rejectedSuggestions | JA | rejected-suggestion-guard | Code confirmed |
| conversation history | JA | chat messages | Code confirmed |
| ageCategory | **NEE** | age-category-foundation.ts exists but not injected | **GAP** |
| raw Backpack | NEE | Correct — excluded | ✓ |
| raw user.dat | NEE | Correct — excluded | ✓ |
| raw DIST01/logs | NEE | Correct — excluded | ✓ |
| raw birthDate | NEE | Correct — excluded | ✓ |

---

## SECTIE 8: ROOT CAUSE CLASSIFICATIE

| # | Root Cause | Classificatie | Impact |
|---|-----------|--------------|--------|
| 1 | Field name mismatch in buildPersonalClinicalContext | **P0 SILENT DATA LOSS** | Schemas, modes, triggers, values, goals, risks bereiken GPT NOOIT |
| 2 | Geen ontwikkelingsfase in extractie-prompt | P2 CLINICAL GAP | Leeftijdscontext ontbreekt in analyse |
| 3 | Geen trigger-ketens | P2 CLINICAL GAP | Causale verbanden ontbreken |
| 4 | Geen functie van verslaving | P2 CLINICAL GAP | Waarom-vraag onbeantwoord |
| 5 | Geen contra-indicaties | P1 SAFETY GAP | GPT kan onbedoeld schadelijke zinnen formuleren |
| 6 | Geen veilige formuleringshinten | P1 CLINICAL GAP | GPT heeft geen positieve richtlijnen per persoon |
| 7 | ageCategory niet in prompt | P2 INTEGRATION GAP | Foundation bestaat maar niet geïnjecteerd |
| 8 | Ambivalentie verdwijnt bij merge | P3 NUANCE LOSS | Conflicterende percepties worden platgeslagen |
| 9 | Geen bronbewijs (citaat) per conclusie | P3 TRACEABILITY | Alleen boolean, geen tekst-referentie |
| 10 | Basic extraction prompt te generiek | P2 PROMPT QUALITY | "clinical entity extractor" mist klinische diepte |

---

## SECTIE 9: TRUTH TABLE

| Item | Code exists | Tests exist | Data stored | Reaches GPT | Device verified |
|------|-----------|------------|------------|------------|----------------|
| Basic extraction (persons) | YES | YES | YES | YES (via personalAnchors) | YES (clean install) |
| Deep analysis (schemas) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (modes) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (triggers) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (values) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (goals) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (risks) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (protectiveFactors) | YES | YES | YES | **NO (field mismatch)** | NO |
| Deep analysis (relationGraph) | YES | YES | YES | YES (via personalAnchors) | NO |
| Deep analysis (lifeStatusFacts) | YES | YES | YES | YES (via personalAnchors) | NO |
| Trigger chains | NO | NO | NO | NO | NO |
| Function of addiction | NO | NO | NO | NO | NO |
| Contra-indications | NO | NO | NO | NO | NO |
| Safe formulation hints | NO | NO | NO | NO | NO |
| Developmental phase | NO | NO | NO | NO | NO |
| ageCategory in prompt | PARTIAL | NO | NO | NO | NO |

---

## SECTIE 10: EINDCONCLUSIE

### Leest RecoFree als een klinisch psycholoog?

**NEE.** RecoFree leest als een **enthousiaste stagiair** die de juiste categorieën kent maar:
1. De data correct extraheert maar door een **veldnaam-bug** nooit aan GPT doorgeeft (P0)
2. Geen causale verbanden legt (trigger-ketens)
3. Niet weet wat je NIET moet zeggen (contra-indicaties)
4. Niet weet HOE je iets veilig formuleert (formuleringshinten)
5. De leeftijd/ontwikkelingsfase negeert
6. De functie van het gedrag niet begrijpt

### Wat EERST moet:
1. **P0: Fix field name mismatch** — 7 veldnamen corrigeren in `buildPersonalClinicalContext()`. Zonder dit bereikt NIETS van de deep analysis GPT.
2. **P1: Contra-indicaties** — per persoon/situatie "zeg dit niet" regels toevoegen aan extractie
3. **P1: Veilige formuleringshinten** — per persoon/situatie "zeg het zo" voorbeelden

### Wat LATER mag:
4. P2: Trigger-ketens
5. P2: Functie van verslaving
6. P2: Ontwikkelingsfase-bewustzijn
7. P3: Ambivalentie-detectie bij merge
8. P3: Bronbewijs per conclusie

### Wat NIET mag vóór P0 fix:
- Geen nieuwe extractie-features bouwen zolang de bestaande data GPT niet bereikt
- Geen prompt-tuning zolang de pipeline de data weggooit
- Geen device-test claimen zolang personalClinicalContext altijd undefined is

---

**Geen code gewijzigd. Geen bestanden aangemaakt behalve dit rapport. Geen commit.**
