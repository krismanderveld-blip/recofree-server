# Kim AI Persona — Volledige Wijzigingen (Juli–Augustus 2026)

## Samenvatting

Kim is getransformeerd van een "grenzenvriendin" die partij kiest voor de naaste naar een **relatiebewuste therapeut** die patronen benoemt, verbinding beschermt, en herstelvoorwaarden formuleert zonder ooit een relatiebeslissing te nemen.

**Totale investering:** ~60.000+ credits over meerdere sessies
**Resultaat:** 35 modules met runtime bescherming, 6 nieuwe response layers, 1 volledig herschreven identiteit, ~2000 tests, 0 TypeScript errors.

---

## 1. KIM IDENTITY REWRITE (Kernwijziging)

**Bestand:** `lib/engine/kim/prompt-block.ts`

### Oud (verwijderd):
- "You have chosen a side: the caregiver's"
- "Always on their side"
- Partijdig, validerend zonder perspectiefruimte
- Geen verbindingsdoel
- Geen perspectief van de persoon met verslaving

### Nieuw (actief):
- **Relatiebewust:** Kim ziet de relatie als systeem, niet als twee partijen
- **Geen partij kiezen:** Nooit tegen de persoon met verslaving
- **Valideren zonder polariseren:** Pijn erkennen zonder de ander te demoniseren
- **Grenzen met repair path:** Elke grens bevat een brug naar veiliger contact (tenzij safety/harm actief)
- **Perspectiefruimte:** Bij elk relationeel conflict ruimte voor beide kanten
- **Verbinding als doel:** Niet afstand als standaard

---

## 2. RELATIONAL_STANCE_FILTER

**Bestand:** `lib/engine/kim/relational-stance-filter.ts`

**Functie:** Detecteert conflict/blame/harm signalen in user input en genereert GPT directives die Kim's antwoord bijsturen.

**Detectie:**
- Blame language (hij/zij is het probleem, het is zijn/haar schuld)
- Distance advice signals (ik moet weg, afstand nemen)
- Conflict signals (ruzie, bedrog, leugens)
- RELATIONAL_HARM_PATTERN (herhaalde schade, geweld, dwang)

**Output:**
- `requirePerspectiveShift`: true/false
- `requireBridgeBoundary`: true/false
- `blockBlameLanguage`: true/false
- `blockDistanceAdvice`: true/false
- `gptDirective`: volledige instructie voor GPT

**Uitbreiding:** RELATIONAL_HARM_MIDDLE_LAYER voor gevallen waar schade reëel is maar safety niet actief — herstelvoorwaarden eerst, geen vroege perspectiefopening.

---

## 3. K05 CROSS-MODULE OVERRIDE ENGINE

**Bestand:** `lib/engine/kim/k05-cross-module-override-client.ts`

**Functie:** Runtime afdwinging dat elke Kim-grens een repair path bevat.

**Architectuur (gelaagd):**
- **Layer 1 (altijd, deterministisch):** Regex scan op grens-signaalwoorden. Check of repair path aanwezig is.
- **Fallback bij ontbrekend repair path:** Deterministische correctie uit K05-templates.

**Uitzonderingen (geen correctie bij):**
- Safety-first/crisis actief
- RELATIONAL_HARM_PATTERN waar herstelvoorwaarden nog niet vervuld zijn

**Fallback-zinnen:**
- Standaard: "Ik wil contact niet verbreken, maar ik kan dit alleen verder bespreken wanneer er genoeg rust en veiligheid is om elkaar echt te horen."
- Bij afstand zonder safety: "Ik neem nu afstand van dit gesprek, niet om te straffen, maar om te voorkomen dat we elkaar verder beschadigen."

**Monitoring:** K05 override dashboard in clinical mode toont wanneer en waarom correcties plaatsvinden.

---

## 4. GLOBAL_KIM_DEPTH_AND_NAMING_LAYER

**Bestand:** `lib/engine/kim/depth-and-naming-layer.ts`

**Functie:** Bepaalt diepte van Kim's antwoord op basis van relationele context en dwingt concrete patroonbenoeming af.

**Diepteprofielen:**

| Level | Activatie | Vereisten |
|-------|-----------|-----------|
| LOW | Algemeen emotioneel bericht | 1 patroonzin + 1 richting |
| MEDIUM | Conflict, grens, partner-vermelding | Patroon + effect + verantwoordelijkheid + richting |
| HIGH | Bedrog, herhaling, kindcontext, geweld | Evidence-bound reasoning + repair conditions + consequentie |
| SKIP | Crisis, <15 tekens, praktische vraag, Elias | Geen directive |

**Naming Layers (verplicht per antwoord):**
1. PATROON — wat herhaalt zich?
2. EFFECT — wat doet dit met de gebruiker?
3. BEHOEFTE — wat mist hier?
4. VERANTWOORDELIJKHEID — wie draagt wat?
5. VERBINDING — wat is er nodig voor veiliger contact?
6. HERSTELVOORWAARDE — welk gedrag moet zichtbaar worden?

**Verboden zwakke output:**
- "wat zou je helpen?"
- "wat heb je nodig?"
- "hoe kan ik je ondersteunen?"
- "wat voel je daarbij?"
- Meerdere reflectievragen achter elkaar

**QUESTION LIMITER (globaal):**
- Maximaal 1 vraag per antwoord
- Nooit 2 reflectievragen op het einde
- Voorkeur voor sterke slotrichting boven vraag

---

## 5. RELATIONAL_PATTERN_ASSESSMENT_MODE

**Bestand:** `lib/engine/kim/relational-pattern-assessment.ts`

**Functie:** Bij expliciete beoordelingsvragen ("wat vind je van mijn relatie?") geeft Kim een gestructureerde 6-staps patroonanalyse.

**Activatie:** 38 patronen (NL/EN/FR) voor expliciete assessment-vragen.

**6-staps output:**
1. Patroonduiding (wat herhaalt zich)
2. Effectbeschrijving (wat doet dit met jou)
3. Verantwoordelijkheidscorrectie (wie draagt wat)
4. Verbindingscheck (is er nog basis)
5. Herstelvoorwaarden (wat moet zichtbaar worden)
6. Sterke eindzin of toetsvraag

**KERP01 integratie:** Gebruikt eigenRegiePlan data (connectionIntent, repairCondition, bridgeSentence, safetyException) als die ingevuld is.

---

## 6. DECISION_PRESSURE_RESPONSE_LAYER

**Bestand:** `lib/engine/kim/decision-pressure-layer.ts`

**Functie:** Bij "moet ik blijven of weggaan?" geeft Kim een gestructureerd antwoord zonder relatiebeslissing te nemen.

**Activatie:** 17 NL + 12 EN + 6 FR patronen voor stay/leave vragen.

**6-staps output:**
1. Geen beslissing overnemen
2. Concreet patroon benoemen
3. Veiligheidscheck
4. Herstelbaarheidsvoorwaarden (nuchterheid, eerlijkheid, transparantie, initiatief, respect, verantwoordelijkheid, voorspelbaarheid, daden niet woorden)
5. Consequentie zonder advies
6. Eén toetsvraag of sterke eindzin

**Context sub-lagen:**
- **Kindcontext:** Partnerherstel ≠ kindherstel. Kind mag eigen tempo.
- **Affectie/intimiteit:** Niet opgeëist als bewijs van liefde.
- **Schaamte:** Verzacht, benoem zacht, concrete herstelstap.

---

## 7. INTIMACY_AFFECTION_EXPLANATION_LAYER

**Bestand:** `lib/engine/kim/intimacy-affection-layer.ts`

**Functie:** Bij vragen over verlies van affectie/intimiteit/verlangen legt Kim concreet uit WAAROM nabijheid is afgeremd.

**Activatie:** 17 NL + 12 EN + 5 FR patronen.

**6-staps output:**
1. Niet reduceren tot "geen liefde"
2. Vertrouwensschade als remmer benoemen
3. Partnerdynamiek-verschuiving benoemen (partner→drager)
4. Druk rond intimiteit benoemen
5. Diepere behoefte benoemen (vertrouwen, bewondering, gelijkwaardigheid)
6. Herstelvoorwaarden concreet maken

---

## 8. RUNTIME SAFETY FILTERS (35 modules beschermd)

Alle 35 Kim-modules hebben nu runtime bescherming. Geen prompt-only modules meer.

### Dedicated safety filters:

| Filter | Modules | Kern |
|--------|---------|------|
| `cdp01SafetyFilter.ts` | CDP01 | Geen diagnostische labels, geen zelfverlies-beschuldiging |
| `paal-behe-aanp-safety-filter.ts` | PAAL-K01, BEHE-K01, AANP-K01 | Geen demonisering, geen acquittal, geen beslissingsdwang |
| `kimCluster3SafetyFilter.ts` | ROL-K01, VETR02-K, LEUGEN-K01 | Geen rolbenoeming, geen vertrouwensdwang, geen leugen-demonisering |
| `kimCluster4SafetyFilter.ts` | ROUW-K01, SCHAAM-K01, HOOP-K01, ISOL-K01 | 30+ forbidden patterns (rouw, schaamte, hoop, isolatie) |
| `bedr01-par01-gasl01-safety-filter.ts` | BEDR01, PAR01, GASL01 | Geen gaslighting-label, geen demonisering |
| `vetr01-safety-filter.ts` | VETR01 | Geen geforceerd vergeven, geen cynische afstand |
| `kst-fin-iso-safety-filter.ts` | KST01, FIN01, ISO01 | Geen "stop met betalen", geen "zoek steun buiten" |
| `ksc01-safety-filter.ts` | KSC01 | Geen relationele vermijding via zelfzorg |
| `slaap01-safety-filter.ts` | SLAAP01 | Geen afstand als slaapadvies |
| `par01-safety-filter.ts` | PAR01 | Geen rolbenoeming, geen afstandsadvies |

### Gedeelde forbidden patterns (alle filters):
- Demonisering van de persoon met verslaving
- Absoluut vrijpleiten van de naaste
- Beslissingsdwang
- Diagnostische labels (codependent, toxic, etc.)
- Vaste persoonsnamen

---

## 9. MODULE PATCHES (Relational Stance)

### Kernmodules gepatcht:
- **KO1, K01, K02:** Inherited relational stance — geen partij kiezen
- **K03 (Zelfzorg):** Zelfzorg zonder breuk, verbinding behouden
- **K04 (Regulatie):** Regulatie vóór gesprek, niet als vervanging
- **K05 (Communicatie):** Cross-module override, ik-taal, schuldtaal blokkeren, uitnodiging tot rustiger contact
- **K06 (Duurzame steun):** Steun zonder afstand als standaard
- **KDL01 (Controle loslaten):** Controle loslaten zonder liefde/contact los te laten

### Cluster patches:
- **Cluster 3 (ROL-K01, VETR02-K, LEUGEN-K01):** Relational connection layer
- **Cluster 4 (ROUW-K01, SCHAAM-K01, HOOP-K01, ISOL-K01):** Relational stance + 30 forbidden patterns

### Individuele module rewrites:
- **CDP01:** Zelfverlies zonder label, liefde als waarde, eigen regie zonder verbinding af te breken
- **RNW01:** Rouw naast liefde, geen "die persoon bestaat niet meer", geen afscheid als standaard
- **PAAL-K01, BEHE-K01, AANP-K01:** Connection check toegevoegd

---

## 10. KERP01 UITBREIDING (Eigen Regie Plan)

**Bestand:** `lib/engine/kim/kerp01-types.ts`

**4 nieuwe verbindingsvelden per zone:**
- `connectionIntent` — wat wil de gebruiker bereiken in de relatie?
- `bridgeSentence` — welke zin kan als brug dienen?
- `repairCondition` — welke voorwaarde moet vervuld zijn?
- `safetyException` — wanneer wijkt verbinding voor veiligheid?

**UI:** Eigen Regie Plan wizard uitgebreid met "Verbinding zonder zelfverlies" sectie.

---

## 11. DIST01 UITBREIDING

**Bestand:** `lib/engine/shared/dist01-detector.ts`

**Nieuwe detectie:**
- Addiction-recovery vocabulary (valkuil, terugval, opname, nuchter, patroonherkenning, craving, sponsor, AA/NA)
- Kim naaste-perspective patterns (hij/zij teruggevallen, patroon herkennen bij ander, co-afhankelijkheid)
- Proposal card detection count context ("Dit heb je nu Xx benoemd")
- Auto-save toast notification
- Pattern-acknowledgment GPT injection voor herhaalde patronen
- Kim-specifieke routing (Grenzenplan, Steunplan, Patroonkaart)

**Vise versa fix:**
- DIST01 schrijft nu direct naar user.dat bij eerste detectie (geen 3x drempel meer voor personen)
- extractedEntities wordt geïnitialiseerd als het null is (lege rugzak werkt nu ook)

---

## 12. PIPELINE PRIORITEIT (Huidige volgorde)

```
1. RELATIONAL_PATTERN_ASSESSMENT_MODE (expliciete beoordelingsvraag)
2. DECISION_PRESSURE_RESPONSE_LAYER (blijven/weggaan)
3. INTIMACY_AFFECTION_EXPLANATION_LAYER (affectie/intimiteit)
4. GLOBAL_KIM_DEPTH_AND_NAMING_LAYER (altijd actief, diepte + naming)
5. Normal RELATIONAL_STANCE_FILTER (standaard relationeel filter)
```

Na GPT response:
```
6. K05 CROSS-MODULE OVERRIDE (grens zonder repair path → correctie)
7. RUNTIME SAFETY FILTERS (forbidden output blokkeren)
```

---

## 13. K05 OVERRIDE MONITORING DASHBOARD

**Locatie:** Clinical mode (chat.tsx)

**Toont:**
- K05 Override fired: ja/nee
- Method: regex/fallback
- Layer 1 details: welk signaal gedetecteerd
- Safety Filter violations: per filter/module/categorieën

---

## 14. TECHNISCHE DETAILS

### Architectuur:
- **Client-side:** Alle layers, filters, K05 override, DIST01 detectie
- **Server (Railway):** Pure GPT proxy — ontvangt prompt, stuurt door naar OpenAI
- **Server importeert:** KIM_IDENTITY_PROMPT, module catalogs, slider interpretation (constanten)

### Deploy:
- **Railway:** `github.com/krismanderveld-blip/recofree-server` → auto-deploy op push
- **APK:** Via Manus Publish → EAS build
- **packageManager:** pnpm@9.12.0 (EAS compatibiliteit)

### Tests:
- ~2000+ tests totaal
- 0 TypeScript errors
- Alle safety filters getest met forbidden/allowed output
- K05 override getest met vóór/na correctie bewijs

---

## 15. SAMENVATTING VERANDERINGEN PER CATEGORIE

| Categorie | Aantal bestanden | Status |
|-----------|-----------------|--------|
| Identity rewrite | 1 | Compleet |
| Relational stance filter | 1 | Compleet |
| K05 cross-module override | 1 (client) | Compleet |
| Depth & naming layer | 1 | Compleet |
| Assessment mode | 1 | Compleet |
| Decision pressure layer | 1 | Compleet |
| Intimacy/affection layer | 1 | Compleet |
| Safety filters (dedicated) | 10 | Compleet |
| Module patches (prompt) | 35 modules | Compleet |
| KERP01 uitbreiding | 2 (types + wizard) | Compleet |
| DIST01 uitbreiding | 1 | Compleet |
| K05 monitoring dashboard | 1 (chat.tsx) | Compleet |
| Pipeline integratie | 1 (pipeline.ts) | Compleet |

---

## 16. WAT KIM NU DOET (vs. VOOR)

| Situatie | VOOR | NU |
|----------|------|-----|
| "Hij zet me onder druk" | "Je hebt recht op grenzen. Wat zou je helpen?" | Benoemt patroon, vraagt wat er onder het gedrag zit, biedt grens + repair path |
| "Moet ik blijven of weggaan?" | "Alleen jij kunt dit weten. Wat voel je?" | 6-staps: geen beslissing, patroon, safety, herstelvoorwaarden, consequentie, toetsvraag |
| "Ik voel geen affectie meer" | "Dat is begrijpelijk. Wat heb je nodig?" | 3+ concrete remmers (vertrouwen, dynamiek, druk), herstelvoorwaarden, geen druk om warmer te zijn |
| "Wat vind je van mijn relatie?" | Vage validatie | Gestructureerde patroonanalyse met evidence en richting |
| Grens zonder repair path | Wordt doorgelaten | K05 detecteert en corrigeert met bridge/repair |
| "Die persoon bestaat niet meer" | Kon als output verschijnen | Geblokkeerd door safety filter, vervangen door rouw-naast-liefde |
| "Je moet loskomen" | Kon als output verschijnen | Geblokkeerd, vervangen door eigen regie zonder verbinding af te breken |

---

*Document gegenereerd: 9 augustus 2026*
*Laatste checkpoint: `2e261dab`*
