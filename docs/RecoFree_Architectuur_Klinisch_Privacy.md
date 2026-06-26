# RecoFree — Volledige Technische, Klinische en Privacy-Documentatie

**Versie:** 2.0  
**Datum:** 26 juni 2026  
**Doelgroep:** MDR-commissie (Medical Device Regulation EU 2017/745), klinisch toezichthouder (dr. Peuskens), interne audit  
**Classificatie:** Vertrouwelijk — niet voor publieke distributie

---

## Inhoudsopgave

1. [Samenvatting in mensentaal](#1-samenvatting-in-mensentaal)
2. [Productoverzicht en MDR-classificatie](#2-productoverzicht-en-mdr-classificatie)
3. [Architectuuroverzicht](#3-architectuuroverzicht)
4. [De twee persona's: Elias en Kim](#4-de-twee-personas-elias-en-kim)
5. [De deterministische pipeline — alle stappen](#5-de-deterministische-pipeline--alle-stappen)
6. [Geheugenlagen en datastructuur](#6-geheugenlagen-en-datastructuur)
7. [Therapeutische modules — Elias (volledig)](#7-therapeutische-modules--elias-volledig)
8. [Therapeutische modules — Kim (volledig)](#8-therapeutische-modules--kim-volledig)
9. [Gedeelde therapeutische kaders](#9-gedeelde-therapeutische-kaders)
10. [Veiligheidssysteem en crisisprotocol](#10-veiligheidssysteem-en-crisisprotocol)
11. [Het profiel: Levensverhaal, VSP en Eigen Regie](#11-het-profiel-levensverhaal-vsp-en-eigen-regie)
12. [Het dagboek: My Diary en Gratitude](#12-het-dagboek-my-diary-en-gratitude)
13. [GDPR/Privacy en gegevensbescherming](#13-gdprprivacy-en-gegevensbescherming)
14. [Kwaliteitsborging en anti-hallucinatie](#14-kwaliteitsborging-en-anti-hallucinatie)
15. [Governance en klinisch toezicht](#15-governance-en-klinisch-toezicht)
16. [Traceerbaarheid en logging](#16-traceerbaarheid-en-logging)

---

## 1. Samenvatting in mensentaal

RecoFree is een mobiele app die mensen in herstel van verslaving (persona **Elias**) en hun naasten/mantelzorgers (persona **Kim**) ondersteunt via AI-gestuurde gesprekken. De app vervangt geen therapeut, maar biedt 24/7 laagdrempelige ondersteuning tussen sessies door.

**Hoe het werkt in het kort:**

De gebruiker opent de app, geeft via schuifregelaars aan hoe het gaat (stemming, craving, slaap, etc.), en begint een gesprek. Achter de schermen doorloopt elk bericht een vaste reeks van deterministische stappen — vergelijkbaar met een beslisboom — die bepalen welk therapeutisch kader het meest passend is. Pas na die volledige analyse wordt één keer een AI-model (GPT) aangesproken om het eigenlijke antwoord te formuleren, binnen de strikte kaders die de pipeline heeft vastgelegd.

De app slaat alle persoonlijke gegevens lokaal op het toestel op, versleuteld met AES-256-GCM. Er worden geen persoonlijke gegevens naar externe servers gestuurd behalve het gespreksbericht zelf (noodzakelijk voor de AI-respons). De gebruiker kan op elk moment alle data exporteren of permanent verwijderen.

---

## 2. Productoverzicht en MDR-classificatie

| Kenmerk | Beschrijving |
|---------|-------------|
| **Productnaam** | RecoFree |
| **Type** | Software as a Medical Device (SaMD) — klasse IIa onder MDR EU 2017/745 |
| **Beoogd doel** | Ondersteunende digitale interventie bij verslavingsherstel en mantelzorgondersteuning |
| **Doelgroep** | Volwassenen (18+) in herstel van middelenverslaving; naasten van personen met verslaving |
| **Contra-indicaties** | Acute psychose, actieve suïcidaliteit zonder professionele begeleiding, minderjarigen |
| **Klinische supervisie** | Dr. Peuskens (psychiater, verslavingsspecialist) |
| **Talen** | Nederlands (primair), Engels, Frans (detectie + respons) |
| **Platform** | iOS en Android (React Native / Expo) |

---

## 3. Architectuuroverzicht

RecoFree bestaat uit drie lagen:

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATIELAAG (React Native / Expo)                  │
│  - Chat UI, Dagboek, Profiel, Mood-sliders              │
├─────────────────────────────────────────────────────────┤
│  DETERMINISTISCHE ENGINE (TypeScript, lokaal)            │
│  - Pipeline (17+ stappen per bericht)                   │
│  - Module-detectoren (regex + heuristiek)               │
│  - Zone-berekening (VSP / Eigen Regie)                  │
│  - Veiligheidslaag (crisis, relapse, gevaar)            │
├─────────────────────────────────────────────────────────┤
│  AI-LAAG (server-side, één GPT-call per beurt)          │
│  - System prompt (persona + context + modules)          │
│  - Strikte instructies (do's en don'ts per module)      │
│  - Post-GPT validatie en filtering                      │
└─────────────────────────────────────────────────────────┘
```

**Kernprincipe:** De deterministische engine beslist *wat* er gezegd moet worden (welk kader, welke toon, welke diepte). Het AI-model bepaalt alleen *hoe* dat verwoord wordt. Dit voorkomt dat het AI-model eigenstandig klinische beslissingen neemt.

---

## 4. De twee persona's: Elias en Kim

### 4.1 Elias — De persoon in herstel

Elias is een AI-begeleider voor mensen die zelf kampen met verslaving. De persona is gemodelleerd als een warme, directe mannelijke stem die:

- Motiverende gespreksvoering (MI) toepast
- Werkt vanuit het Veiligheidssignaalplan (VSP) met vijf zones (Groen → Geel → Oranje → Rood → Paars)
- Nooit oordeelt over terugval maar deze als leermoment benadert
- Stoïcijnse principes integreert waar passend
- Schaduwwerk faciliteert (projectie, vermijding, schaamkern)
- Psycho-educatie biedt over wilskracht, autopilot en triggers

### 4.2 Kim — De naaste/mantelzorger

Kim is een AI-begeleider voor partners, ouders of andere naasten van iemand met verslaving. De persona is gemodelleerd als een empathische vrouwelijke stem die:

- Erkent dat de naaste óók lijdt
- Werkt vanuit Eigen Regie (0-100 schaal)
- Grenzen stellen centraal zet zonder schuldgevoel
- Codependentie, enabling en gaslighting herkent
- Veiligheid van kinderen prioriteert boven alles
- Rouw om een levend persoon valideert

### 4.3 Gedeelde infrastructuur

Beide persona's delen dezelfde technische infrastructuur: dezelfde pipeline, dezelfde server-validatie, dezelfde geheugenlagen, dezelfde crisisdetectie. Het verschil zit uitsluitend in:

- De **system prompt** (identiteit, toon, focus)
- De **modulecatalogus** (Elias-specifieke vs. Kim-specifieke modules)
- De **mood-sliders** (Elias: craving/mood/energy/sleep/self-care/VSP; Kim: stress/boundary-fatigue/eigen-regie/self-care)

---

## 5. De deterministische pipeline — alle stappen

Elk bericht dat de gebruiker stuurt doorloopt de volgende stappen **voordat** het AI-model wordt aangesproken. Alle stappen zijn deterministisch (geen AI nodig) tenzij expliciet anders vermeld.

### 5.1 Overzichtstabel — PRE-GPT stappen

| Stap | Code | Naam | Type | Functie |
|------|------|------|------|---------|
| 1 | triggerDecay | Trigger Decay | Deterministisch | Veroudering van eerder gedetecteerde triggers (tijdsgebaseerd) |
| 2 | bufferUpdate | Buffer Update | Deterministisch | Sessie-buffer bijwerken met nieuw bericht, zone-score herberekenen |
| 3 | zoneDecay | Zone Decay | Deterministisch | Geleidelijke normalisatie van zone-score als er geen nieuwe signalen zijn |
| 4 | dominantState | Dominant State Analysis | Deterministisch | Bepaal dominante emotionele staat, risico-niveau, bron-laag |
| 5a | bufferSnapshot | Buffer Snapshot | Deterministisch | Momentopname van buffer-staat voor GPT-context |
| 5b | regulation | Regulation Layer | Deterministisch | Bepaal interventie-diepte op basis van zone + guidance-depth + anti-repetitie |
| 5c | signalEngine | Signal Engine | GPT-mini (niet-blokkerend) | Signaaldetectie (angsten, hoop, doelen, triggers) + relevantiescoring |
| 5d | relapseIntent | Relapse Intent Detection | GPT + deterministisch fallback | Dual-pad terugvalintentie-detectie |
| 5e | projection | Projection Detection | Deterministisch | Detectie van psychologische projectie, vermijding, intellectualisatie |
| 5f | vspInsight | VSP Insight Layer | Deterministisch | Framework-selectie (MI/MBT/DGT) op basis van zone — leest safety core, muteert niet |
| 5g | stoa | STOA Engine | Deterministisch | Stoïcijnse reflectie-detectie en routing |
| 5h | schemaMode | Schema Mode Detection | Deterministisch | Detectie van schemamodi (Young) |
| 5i | act | ACT Engine | Deterministisch | Acceptance & Commitment Therapy detectie en routing |
| 5j | cgt | CGT Engine | Deterministisch | Cognitieve Gedragstherapie detectie en routing |
| 5k | dgt | DGT/DBT Engine | Deterministisch | Dialectische Gedragstherapie detectie en routing (validatie L1-L6) |
| 5l | mbt | MBT Engine | Deterministisch | Mentalisatie-Bevorderende Therapie detectie en routing |
| 5m | ko1 | KO1 Engine | Deterministisch | Kim: herkenning en validatie |
| 5n | k05 | K05 Communication | Deterministisch | Kim: communicatie met de verslaafde naaste |
| 5o | k04 | K04 Emotional Regulation | Deterministisch | Kim: emotieregulatie voor mantelzorgers |
| 5o2 | k04s4 | K04-S4 Betrayal/Trust | Deterministisch | Kim: verraad, vertrouwen, hoop en zelfbescherming |
| 5p | k06 | K06 Self-Care | Deterministisch | Kim: zelfzorg en duurzame ondersteuning (safety gate) |
| 5p2 | kimAdvanced | Kim Advanced (KST01/KDL01/KBR01/KSC01) | Deterministisch | Kim: stabilisatie, draaglastverdeling, boundary repair, self-compassion |
| 5q | k01 | K01 Boundary Setting | Deterministisch | Kim: grenzen stellen (standaardmodule) |
| 5r | k03 | K03 Self-Care Shadow | Deterministisch | Gedeeld: zelfzorg met schaduwlaag |
| 5e3 | sw01 | SW01 Shadow Work | Deterministisch | Elias: schaduwwerk (projectie, vermijdingsloops, schaamkern) |
| 5e4 | sto01 | STO01 Stoicism Integration | Deterministisch | Elias: stoïcijnse principes met veiligheidsoverrides |
| 5e5 | eliasAdvanced | Elias Advanced P1 (VERGV01/IGH01/AGC01/HWK01) | Deterministisch | Elias: vergeving, intergenerationeel, agency, herstelwaardigheid |
| 5e6 | eliasAdvancedP2 | Elias Advanced P2 (FALE01/VERG01/ROUW01/IDEN01/ZINK01) | Deterministisch | Elias: falen, vergankelijkheid, rouw, identiteit, zingeving |
| 5e7 | eliasAdvancedP3 | Elias Advanced P3 (TERV01/MI02) | Deterministisch | Elias: terugvalpreventie-analyse, diepe ambivalentie |
| 5e8 | eliasP4 | Elias P4 (SLAAP01) | Deterministisch | Elias: slaapproblematiek |
| 5e8a2 | psychoEducation | PsychoEducation (WILSKRACHT01/AUTOPILOT01) | Deterministisch | Elias: wilskracht-mythe, automatisch gedrag |
| 5e8a3 | paal01 | PAAL01 Steunpilaren | Deterministisch | Elias: inventarisatie steunpilaren + balkmetafoor |
| 5e8a4 | selfAcceptance | Self-Acceptance (BLIK01/ONTK01/IKST01/COEX01) | Deterministisch | Elias: zelfacceptatie-cluster |
| 5e8a5 | kimPatternSupport | Kim Pattern Support (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01) | Deterministisch | Kim: patroonondersteuning |
| 5e8b | kimSlaap01 | Kim SLAAP01 | Deterministisch | Kim: slaap en nachtwaakzaamheid |
| 5e8c | kimP7 | Kim P7 Danger/Child (GEVAAR-K01/KIND-K01) | Deterministisch | Kim: HOOGSTE PRIORITEIT — acuut gevaar, kindveiligheid |
| 5e8b2 | kimP6 | Kim P6 Relapse Cluster (HERV-K01/NAHERV-K01/CRISIS-K01) | Deterministisch | Kim: terugval-cluster |
| 5e9a | kimP8 | Kim P8 Relational (ROL-K01/VETR02-K/LEUGEN-K01) | Deterministisch | Kim: relationele dynamiek |
| 5e9b | kimP9 | Kim P9 Emotional Loss (HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01) | Deterministisch | Kim: emotioneel verlies |
| 5e9c | kimP10 | Kim P10 STOA-K | Deterministisch | Kim: stoïcijns reflectief kader |
| 5e9 | kimP2 | Kim P2 (BEDR01/VETR01/GASL01) | Deterministisch | Kim: bedrog en gaslighting |
| 5e10 | kimP3 | Kim P3 (CDP01/RNW01) | Deterministisch | Kim: codependentie en rouw |
| 5e11 | kimP4 | Kim P4 (PAR01/FIN01) | Deterministisch | Kim: ouderschap en financiën |
| 5e12 | kimP5 | Kim P5 (ISO01) | Deterministisch | Kim: sociaal isolement |

### 5.2 GPT-call en POST-GPT stappen

| Stap | Code | Naam | Functie |
|------|------|------|---------|
| 6 | engineDecision | Engine Decision | Aggregatie tot EliasDecision of KimDecision |
| 6a | pastReference | Past-Reference Search | Zoek in logs.dat/user.dat naar eerder besproken thema's |
| 6b | contextAssembly | Context Assembly | Bouw ChatContext-object met alle module-resultaten |
| 7 | gptCall | GPT Call | Eén enkele aanroep naar AI-model |
| 8 | feedbackLoop | Post-GPT Feedback Loop | Parse engine_signals, strip metadata, enrich buffer |
| 9 | patternMarking | Pattern Marking | Markeer patroon-signalen in sessie-staat |
| 10 | promotionCheck | Promotion Check | Controleer of patronen gepromoveerd worden (drempel ≥3, cooldown) |
| 11 | historyUpdate | History Update | Voeg user + AI bericht toe aan chatgeschiedenis |
| 12 | logging | Consolidated Logging | Schrijf volledige trace (model, tokens, modules, triggers) |

### 5.3 Prioriteitshiërarchie Kim-modules

De Kim-modules volgen een strikte prioriteitscascade. Wanneer een hoger-prioriteitsmodule actief is, worden lagere modules onderdrukt:

```
P7 (GEVAAR-K01/KIND-K01) — overschrijft ALLES
  ↓
P6 (HERV-K01/NAHERV-K01/CRISIS-K01) — overschrijft P2-P5, P8-P10
  ↓
P8 (ROL-K01/VETR02-K/LEUGEN-K01) — reflectief, onder acuut
  ↓
P9 (HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01) — reflectief, onder P8
  ↓
P10 (STOA-K) — laagste reflectieve prioriteit
  ↓
P2-P5 — specifieke thematische modules (niet-acuut)
```

### 5.4 Prioriteitshiërarchie Elias-modules

```
HWK01 > VERGV01 > IGH01 > AGC01 (Advanced Group 1)
FALE01 > VERG01 > ROUW01 > IDEN01 > ZINK01 (Advanced Group 2)
TERV01 > MI02 (Advanced Group 3, post-crisis only)
```

---

## 6. Geheugenlagen en datastructuur

RecoFree gebruikt vijf geheugenlagen die samen het "geheugen" van de app vormen:

### 6.1 Sessie-buffer (vluchtig, per gesprek)

| Veld | Functie |
|------|---------|
| `recentMessages` | Laatste berichten in huidige sessie |
| `currentZoneScore` | Numerieke zone-score (0-100) |
| `currentZoneColor` | Kleur-label (GREEN/YELLOW/ORANGE/RED/PURPLE) |
| `messageCount` | Aantal berichten in sessie |
| `topicHistory` | Besproken onderwerpen |
| `personsDiscussed` | Genoemde personen |
| `emotionalArc` | Emotioneel verloop binnen sessie |
| `usedModules` | Welke modules deze sessie al actief waren (loopblocker) |
| `currentTriggerGuess` | Vermoedelijke trigger dit gesprek |
| `liveIntent` | Real-time intentie-detectie |
| `moduleSwitchCount` | Aantal module-wisselingen (stabiliteitsmonitor) |

De sessie-buffer wordt gewist bij het beëindigen van een sessie. Relevante patronen worden eerst gepromoveerd naar user.dat.

### 6.2 User.dat (persistent, lokaal versleuteld)

| Sectie | Inhoud |
|--------|--------|
| `chatHistory` | Volledige gespreksgeschiedenis (alle sessies) |
| `currentMood` | Laatst ingevulde mood-sliders |
| `totalSessions` | Totaal aantal sessies |
| `triggerPatterns` | Herkende trigger-patronen met frequentie en decay |
| `moduleUsage` | Welke modules hoe vaak gebruikt zijn |
| `guidanceDepth` | Gebruikersvoorkeur voor diepte (light/normal/deep) |
| `relapseIntentLog` | Historiek van gedetecteerde terugval-intenties |
| `extractedEntities` | Geëxtraheerde personen, plaatsen, relaties |
| `backpackAnalysis` | GPT-4o analyse van schema's, modi, triggers |
| `repeatingPatterns` | Cross-sessie herhalingspatronen (loopblocker) |
| `k01Progress` / `k06Progress` / etc. | Module-specifieke voortgang (per Kim-module) |
| `sw01Storage` / `sto01Storage` / etc. | Module-specifieke voortgang (per Elias-module) |
| `steunpilaren` | Opgeslagen steunpilaren (PAAL01) |
| `balkmetafoor` | Draaglast vs. draagkracht items |

### 6.3 Backpack (Rugzak) — het profiel

De rugzak bevat het levensverhaal en de klinische context van de gebruiker:

| Veld | Inhoud |
|------|--------|
| `naam` | Voornaam gebruiker |
| `userType` | 'elias' of 'kim' |
| `sections` | Vrije tekst-secties (levensverhaal, relaties, triggers, doelen) |
| `intakeContext` | Startemotion, urgentie, stage of change |
| `vsp` | Veiligheidssignaalplan (Elias) — per zone: signalen, wat helpt, ankerzin |
| `eigenRegie` | Eigen Regie score (Kim) |

### 6.4 State.dat en Projections.dat

| Bestand | Inhoud |
|---------|--------|
| `state.dat` | Sessiestatus, actieve projecties, interventie-continuïteit |
| `projections.dat` | Projectie-tracking: categorie, inhoud, sterkte, actief/inactief |

### 6.5 Logs.dat — sessielog

Na elke sessie wordt een samenvatting geschreven naar logs.dat:

| Veld | Inhoud |
|------|--------|
| `sessionId` | Unieke sessie-identifier |
| `startTime` / `endTime` | Tijdstempels |
| `summary` | AI-gegenereerde samenvatting (key themes, progress, concerns) |
| `zoneProgression` | Zone-verloop tijdens sessie |
| `modulesUsed` | Welke modules actief waren |
| `triggersPatternsDetected` | Nieuw gedetecteerde patronen |

### 6.6 Sessie-levenscyclus

**Bij sessiestart:**
1. Alle geheugenlagen worden geladen (user.dat, state.dat, projections.dat)
2. Logs.dat wordt gelezen en retentiebeleid toegepast
3. SessionInitContext wordt opgebouwd uit alle lagen
4. SessionBuffer wordt geïnitialiseerd
5. Volledige backpack wordt meegegeven (alleen bij SESSION_INIT)

**Bij sessie-einde:**
1. Concurrency-guard voorkomt dubbele afsluiting
2. GPT-samenvatting wordt gegenereerd (of fallback bij falen)
3. Samenvatting wordt naar logs.dat geschreven (upsert, geen duplicaten)
4. Ranked promotie-evaluatie: top 5 patronen worden naar user.dat geschreven
5. Buffer wordt gewist

---

## 7. Therapeutische modules — Elias (volledig)

### 7.1 Korte modules (M05-M85) — Elias only

Deze modules worden geactiveerd wanneer specifieke thematische markers in het gebruikersbericht worden gedetecteerd. Elke module injecteert een prompt-blok dat het AI-model instrueert hoe te reageren.

| Module | Naam | Therapeutisch domein |
|--------|------|---------------------|
| M05 | Structurele eenzaamheid | Chronisch isolement als trigger voor gebruik |
| M06 | Vertrouwensbreuk | Beschadigd vertrouwen in relaties |
| M07 | Paniek bij nabijheid | Angst wanneer intimiteit dichtbij komt |
| M08 | Slaapstoornis | Slaapproblemen als trigger/gevolg van gebruik |
| M09 | Interne druk/perfectionisme | Perfectionisme als onderliggende drijfveer |
| M13 | Verlies van ouder | Rouw om ouder (overlijden of emotionele afwezigheid) |
| M16 | Overbelasting/ontploffing | Emotionele overload die leidt tot gebruik |
| M17 | Traumatische kindervaring | ACE's (Adverse Childhood Experiences) |
| M19 | Schaamte door afwijzing | Afwijzingsgevoeligheid en schaamte |
| M20 | Verinnerlijkte verwerping | Kernovertuiging "ik ben niet goed genoeg" |
| M21 | Verlatingsangst | Angst voor verlating als trigger |
| M22 | Onzichtbaarheid | Gevoel niet gezien te worden |
| M23 | Intimiteit als gevaar | Nabijheid als bedreiging ervaren |
| M25 | Permanent buitenstaander | Chronisch gevoel er niet bij te horen |
| M26 | Chronisch misbegrepen | Gevoel nooit begrepen te worden |
| M27 | Overcontrole als overleving | Controle als copingmechanisme |
| M29 | Emotionele instabiliteit | Stemmingswisselingen en dysregulatie |
| M30 | Angst voor nabijheid | Vermijding van emotionele nabijheid |
| M33 | Controleverlies na confrontatie | Verlies van grip na confronterende situatie |
| M34 | Zelfmedicatie voor onrust | Gebruik als zelfmedicatie voor innerlijke onrust |
| M35 | Woede als masker | Boosheid die onderliggende pijn verbergt |
| M40 | Schuldgevoel als motor | Schuld die gebruik in stand houdt |
| M41 | Loyaliteitsconflict | Verscheurdheid tussen loyaliteiten |
| M42 | Identiteitsverlies door gebruik | Wie ben ik zonder de verslaving? |
| M43 | Parentificatie | Als kind de ouderrol moeten innemen |
| M44 | Emotionele verwaarlozing | Opgegroeid zonder emotionele voeding |
| M45 | Chronische schaamte | Diepgewortelde schaamte als kernthema |
| M46 | Zelfdestructief patroon | Bewust of onbewust zelfbeschadigend gedrag |
| M47 | Verlies van toekomstperspectief | Hopeloosheid over de toekomst |
| M49 | Machteloosheid | Gevoel geen invloed te hebben |
| M50 | Ambivalentie over herstel | Twijfel of herstel het waard is |
| M51 | Sociale angst | Angst in sociale situaties als trigger |
| M52 | Financiële stress | Geldzorgen als trigger |
| M53 | Juridische problemen | Rechtszaken, boetes, voorwaarden |
| M54 | Werkgerelateerde stress | Werkdruk, ontslag, burn-out |
| M55 | Relatie-einde | Scheiding of relatiebreuk |
| M56 | Lichamelijke klachten | Fysieke gevolgen van gebruik |
| M57 | Medicatie-interactie | Zorgen over medicatie en gebruik |
| M58 | Craving-management | Omgaan met hunkering |
| M59 | Sociale druk | Druk van omgeving om te gebruiken |
| M60 | Feestdagen/vieringen | Risicomomenten bij feesten |
| M61 | Verveling als trigger | Leegte en verveling |
| M62 | Seksualiteit en gebruik | Verband tussen seks en middelengebruik |
| M63 | Rouw en verlies | Verlies van dierbaren |
| M64 | Spiritualiteit | Zingeving en spirituele zoektocht |
| M65 | Herstel van relaties | Relatieherstel na schade door gebruik |
| M66 | Ouderschap in herstel | Ouder zijn tijdens herstelproces |
| M67 | Terugkeer naar werk | Re-integratie na behandeling |
| M68 | Nieuwe identiteit | Opbouwen van een nieuw zelfbeeld |
| M69 | Gezonde routines | Structuur en dagritme |
| M70 | Omgaan met flashbacks | Traumatische herinneringen |
| M71 | Grenzen leren stellen | Assertiviteit ontwikkelen |
| M72 | Zelfcompassie | Leren mild zijn voor jezelf |
| M73 | Betekenisvolle activiteiten | Zinvolle dagbesteding vinden |
| M74 | Omgaan met terugval van anderen | Wanneer lotgenoten terugvallen |
| M75 | Seizoensgebonden risico's | Winterdepressie, zomerfeesten |
| M76 | Digitale triggers | Social media, online gokken |
| M77 | Huisvesting en stabiliteit | Woonsituatie als herstel-factor |
| M78 | Voeding en herstel | Eetpatronen en fysiek herstel |
| M79 | Beweging en sport | Lichamelijke activiteit als coping |
| M80 | Creatieve expressie | Kunst, muziek, schrijven als uitlaatklep |
| M81 | Mindfulness in herstel | Aandachtstraining en aanwezigheid |
| M82 | Lotgenotencontact | Peer support en groepswerk |
| M83 | Familie-dynamiek | Gezinssysteem en rollen |
| M84 | Culturele factoren | Culturele context van gebruik en herstel |
| M85 | Langetermijnherstel | Onderhoud na eerste jaar |

### 7.2 Geavanceerde modules — Elias

#### Cluster 1: Existentieel herstel (prioriteit: HWK01 > VERGV01 > IGH01 > AGC01)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **HWK01** | Herstelwaardigheid-kern | Adresseert de kernvraag "ben ik het waard om te herstellen?" Detecteert zelfondermijning, sabotage, en onwaardigheidsovertuigingen. Hoogste prioriteit in dit cluster. |
| **VERGV01** | Vergevingsmodule | Begeleidt het vergevingsproces — zowel zelfvergeving als vergeving van anderen. Detecteert vergevingsdruk, premature vergeving, en woede die vergeving blokkeert. |
| **IGH01** | Intergenerationeel Herstel | Herkent patronen die over generaties worden doorgegeven (verslaving in familie, emotionele verwaarlozing). Helpt de cyclus te doorbreken zonder schuld. |
| **AGC01** | Agency-Check | Monitort of de gebruiker voldoende eigen regie ervaart. Detecteert geleerde hulpeloosheid, externe locus of control, en passiviteit. |

#### Cluster 2: Emotioneel-existentieel (prioriteit: FALE01 > VERG01 > ROUW01 > IDEN01 > ZINK01)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **FALE01** | Falen | Omgaan met faalangst en faalervaringen in herstel. Detecteert schaamtespiraal na terugval. |
| **VERG01** | Vergankelijkheid | Confrontatie met eindigheid, tijd die verloren is gegaan door verslaving. |
| **ROUW01** | Rouw | Rouwverwerking: verlies door verslaving, verloren jaren, relaties, kansen. |
| **IDEN01** | Identiteit | Identiteitscrisis: wie ben ik zonder de verslaving? Reconstructie van zelfbeeld. |
| **ZINK01** | Zingeving | Existentiële zinvragen, betekenis vinden in herstel, leegte na stoppen. |

#### Cluster 3: Post-crisis analyse (prioriteit: TERV01 > MI02)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **TERV01** | Terugvalpreventie-analyse | Alleen actief na stabilisatie post-PAARS zone. Analyseert de volledige terugvalketen: trigger → gedachte → gevoel → gedrag → gebruiksmoment. Vereist: stabilisatie voltooid, geen actief medisch risico. |
| **MI02** | Diepe Ambivalentie | Motiverende gespreksvoering bij diepe ambivalentie. Detecteert: change talk vs. sustain talk, adviesresistentie, externe motivatie, gemengde signalen. Vereist: intake voltooid. |

#### Slaap en psycho-educatie

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **SLAAP01** | Slaapmodule Elias | Slaapproblemen, nacht-craving, vermoeidheid als terugval-trigger, ontwenningsgerelateerde slaapzorgen. Detecteert: slaapangst, nacht-craving, vermoeidheid-relapse-trigger, ontwenningsslaap. |
| **WILSKRACHT01** | Wilskracht psycho-educatie | Ontkracht de wilskracht-mythe. Activeert bij zelfblame ("ik ben zwak", "mijn schuld", "gefaald") of wilskracht-taal ("doorzettingsvermogen", "discipline"). |
| **AUTOPILOT01** | Autopilot psycho-educatie | Legt uit hoe automatisch gedrag werkt. Activeert bij: geconditioneerde triggers, approach bias, attentional bias, "zonder na te denken"-taal. |

#### Steunpilaren en zelfacceptatie

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **PAAL01** | Steunpilaren | Inventariseert en activeert steunpilaren. Integreert de balkmetafoor (draaglast vs. draagkracht). Detecteert: behoefte aan steun, moeilijk moment opgelost, eerste gebruik van profiel-feature. |
| **BLIK01** | Zelfbeeld | Werkt aan een realistisch, compassievol zelfbeeld. Detecteert: negatief zelfbeeld, vergelijking met anderen. |
| **ONTK01** | Ontkenning | Doorbreekt ontkenningspatronen zonder confrontatie. Detecteert: minimalisering, externalisering, rationalisering. |
| **IKST01** | Ik-sterkte | Versterkt de kern-identiteit los van verslaving. Detecteert: identiteitsverwarring, afhankelijkheid van rol. |
| **COEX01** | Co-existentie | Leren leven met tegenstrijdige delen van jezelf. Detecteert: innerlijk conflict, zwart-wit denken over zelf. |

#### Schaduwwerk en stoïcisme

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **SW01** | Shadow Work | Detecteert projectie, vermijdingsloops, schaamkern. Gebruikt de "Zucht-waarde" (0-10, afgeleid van zone-score) om diepte te bepalen. Integreert met EKT-fasen. Bevat loop-detectie en projectie-tracking. |
| **STO01** | Stoicism Integration | Stoïcijnse principes: dichotomie van controle, amor fati, memento mori, premeditatio malorum. Bevat veiligheidsoverrides bij crisis. Detecteert: externe oorzaak-fixatie, controle-illusie. Integreert met SW01 (projectie-context). |

---

## 8. Therapeutische modules — Kim (volledig)

### 8.1 Kernmodules (K01-K06)

| Module | Naam | Klinische functie | Activatie-conditie |
|--------|------|-------------------|-------------------|
| **K01** | Boundary Setting | Grenzen stellen: detecteert boundary-vermoeidheid, collapse-risico. | Standaardmodule, altijd beschikbaar. Boundary-fatigue slider ≤ 3 verhoogt prioriteit. |
| **K02** | Enabling Awareness | Bewustwording van enabling-gedrag: herkennen wanneer "helpen" het probleem in stand houdt. Boundary-first benadering. | Na K01, wanneer enabling-markers gedetecteerd. |
| **K03** | Self-Care with Shadow | Zelfzorg met schaduwlaag: waarom zelfzorg moeilijk is (schuldgevoel, onwaardigheid). | Self-care slider ≤ 3. Gedeeld met Elias. |
| **K04** | Emotional Regulation | Emotieregulatie voor mantelzorgers: omgaan met woede, verdriet, machteloosheid rond de verslaafde naaste. | Emotionele markers gedetecteerd (woede, schuld, angst, machteloosheid). |
| **K04-S4** | Betrayal/Trust/Hope | Verraad, vertrouwen, hoop en zelfbescherming: wanneer beloftes herhaaldelijk gebroken worden. | Verraad/vertrouwens-markers in bericht. |
| **K05** | Communication | Communicatie met de verslaafde naaste: wat wel/niet te zeggen, timing, toon. | Communicatie-gerelateerde vragen of frustratie. |
| **K06** | Self-Care & Sustainable Support | Duurzame zelfzorg: voorkomt uitputting, biedt sustainability-level monitoring. Fungeert als safety gate voor andere modules. | Altijd geëvalueerd; stabilisatie-status bepaalt of andere modules mogen activeren. |

### 8.2 Advanced cluster: Stabilisatie en draagkracht (KST01/KDL01/KBR01/KSC01)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **KST01** | Stabilisatie | Emotionele stabilisatie wanneer de mantelzorger overbelast is. Vereist: K06 safety gate cleared. |
| **KDL01** | Draaglastverdeling | Verdeling van lasten: wie draagt wat, en is dat eerlijk? |
| **KBR01** | Boundary Repair | Herstel van grenzen die eerder zijn overschreden. |
| **KSC01** | Self-Compassion | Zelfcompassie voor de mantelzorger: toestemming geven om voor zichzelf te zorgen. |

### 8.3 Patroonondersteuning (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **PAAL-K01** | Steunpilaren Kim | Inventarisatie van eigen steunpilaren (niet die van de verslaafde). |
| **BEHE-K01** | Beheersing | Herkenning van controlepatronen als copingmechanisme. Detecteert: hypervigilantie, monitoring-dwang. |
| **AANP-K01** | Aanpassing | Overmatige aanpassing aan de verslaafde: zichzelf wegcijferen, eigen behoeften negeren. |
| **CODEP-K01** | Codependentie | Codependentie-detectie en bewustwording: relationele fusie, reddingsdwang. |

### 8.4 Cluster P7 — Acuut gevaar (HOOGSTE PRIORITEIT — overschrijft ALLE andere modules)

| Module | Naam | Klinische functie | Detectie-signalen |
|--------|------|-------------------|-------------------|
| **GEVAAR-K01** | Acuut Gevaar | Onmiddellijke veiligheidsinterventie. Toont crisisnummers. | Agressie, dronken rijden, verdwijning, overdosis, zelfbeschadiging door naaste, huiselijk geweld, politie-relevant. |
| **KIND-K01** | Kindveiligheid | Kindveiligheid overschrijft altijd algemeen gevaar. Verwijst naar 1712. | Kindermishandeling, verwaarlozing, parentificatie-risico, kind aanwezig bij gevaar. |

**Crisisnummers bij P7-activatie:**
- 112 — Levensbedreigende situatie
- 0800 32 123 — Zelfmoordlijn (België)
- 113 — Zelfmoordpreventie (Nederland)
- 1712 — Kindertelefoon (bij KIND-K01)

### 8.5 Cluster P6 — Terugval naaste (prioriteit: CRISIS-K01 > HERV-K01 > NAHERV-K01)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **CRISIS-K01** | Crisis mantelzorger | Acute crisis bij de mantelzorger zelf (niet de verslaafde). Overschrijft HERV-K01 en NAHERV-K01. |
| **HERV-K01** | Herval naaste | De naaste gebruikt weer: wat nu? Real-time ondersteuning tijdens actieve terugval. |
| **NAHERV-K01** | Nasleep herval | De dagen/weken na een terugval: verwerking, beslissingen, grenzen herbevestigen. |

### 8.6 Cluster P8 — Relationele dynamiek (reflectief, onder P6/P7)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **ROL-K01** | Rolverschuiving | Wanneer rollen verschoven zijn (ouder↔kind, partner↔verzorger). Detecteert: onderdrukte emotiegolf, partner afwezig/opgenomen, hypervigilantie. |
| **VETR02-K** | Vertrouwen 2.0 | Hoe vertrouwen opnieuw op te bouwen — of de beslissing dat het niet meer kan. Detecteert: herbelevingen, chronisch wantrouwen. |
| **LEUGEN-K01** | Leugenpatronen | Omgaan met chronisch liegen: detective-rol, bewijs zoeken, realiteitstoetsing. Detecteert: chronisch liegen, detective-gedrag, verraadpijn. |

### 8.7 Cluster P9 — Emotioneel verlies (reflectief, onder P8)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **HOOP-K01** | Hoop-uitputting | "Wanneer is genoeg genoeg?" Bevat suïcidaliteits-split: situationele hopeloosheid → reflectief; suïcidale ideatie → escalatie naar CRISIS-K01 met crisisnummers. |
| **SCHAAM-K01** | Schaamte | Schaamte over de situatie, geheimhouding, sociale terugtrekking door schaamte. |
| **ROUW-K01** | Rouw om levend persoon | Ambigue rouw: rouwen om iemand die er nog is maar "weg" is. Detecteert: mis wie hij/zij was, verloren toekomst, schuld over rouwen. |
| **ISOL-K01** | Isolatie | Sociaal isolement: angst voor oordeel, vermoeidheid, beschermende terugtrekking, pijnlijke eenzaamheid. |

### 8.8 Cluster P10 — Stoïcijns reflectief (laagste reflectieve prioriteit)

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **STOA-K** | Stoïcijns kader Kim | Stoïcijnse reflectie aangepast voor mantelzorgers: wat kan ik beïnvloeden? Acceptatie zonder berusting. Nooit tegelijk met KST01 als primair in één beurt. |

### 8.9 Cluster P2 — Bedrog en gaslighting

| Module | Naam | Klinische functie | Activatie-conditie |
|--------|------|-------------------|-------------------|
| **BEDR01** | Bedrog (acuut) | Acute ontdekking van bedrog: schok, lichamelijke dysregulatie, beslissingsdruk. | Acuut schok-dominant, ontdekking net gebeurd, lichaamsdysregulatie. |
| **VETR01** | Vertrouwensbreuk | Na K06-stabilisatie: verwerking van vertrouwensbreuk, vergeven vs. grenzen. | K06 gestabiliseerd, vertrouwensherstel-vraag, vergevingsdruk, tijdlijndruk. |
| **GASL01** | Gaslighting-herkenning | Feit-verankering: DARVO-patroon, informatie-asymmetrie, realiteitstoetsing, zelftwijfel-dominant. | Realiteitsvraag dominant, DARVO gedetecteerd, partner beschuldigt mantelzorger, kindertriangulatie. |

### 8.10 Cluster P3 — Codependentie en rouw

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **CDP01** | Codependentie-detectie | Zelfverlies, relationele fusie, emotionele afhankelijkheid van partnerstaat, reddingsdwang, oververantwoordelijkheid, controle uit angst, zelfzorgschuld, identiteitscollaps zonder partner. |
| **RNW01** | Rouw naaste — wie ze was | Rouw om de persoon die de verslaafde ooit was: valse hoop, acceptatiedruk, toekomstverlies, schuld over rouwen, ambigue rouw. |

### 8.11 Cluster P4 — Ouderschap en financiën

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **PAR01** | Ouderschap onder druk | Opvoeden terwijl partner verslaafd is: triangulatie, bescherming kinderen, eigen grenzen als ouder. Vereist: K06 gestabiliseerd. |
| **FIN01** | Financiële impact | Financiële gevolgen van verslaving: schulden, verborgen uitgaven, financiële controle, economische afhankelijkheid. Vereist: K06 gestabiliseerd. |

### 8.12 Cluster P5 — Isolatie

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **ISO01** | Sociaal isolement | Sociale terugtrekking, schaamte over praten, last-angst, beschermend isolement, advies-vermoeidheid, pijnlijke eenzaamheid, angst voor oordeel, geen sociaal contact, privacy-behoefte. |

### 8.13 Slaapmodule Kim

| Module | Naam | Klinische functie |
|--------|------|-------------------|
| **SLAAP01-K** | Slaap Kim | Nachtwaakzaamheid, slaapschuld, vermoeidheid als grens-trigger, zorgen over veiligheid 's nachts, slaapangst door hypervigilantie. |

---

## 9. Gedeelde therapeutische kaders

Naast de persona-specifieke modules delen Elias en Kim de volgende evidence-based kaders die als "engine" functioneren in de pipeline:

| Kader | Afkorting | Evidence-base | Toepassing in RecoFree |
|-------|-----------|---------------|------------------------|
| Motiverende Gespreksvoering | MI | Miller & Rollnick, 2012 | Change talk/sustain talk detectie, OARS-technieken, ambivalentie-exploratie |
| Cognitieve Gedragstherapie | CGT/CBT | Beck, 1979; Beck et al., 1993 | Gedachte-uitdaging, gedragsexperimenten, ABC-model |
| Dialectische Gedragstherapie | DGT/DBT | Linehan, 1993 | Validatie (6 niveaus), distress tolerance, emotieregulatie, interpersoonlijke effectiviteit |
| Mentalisatie-Bevorderende Therapie | MBT | Bateman & Fonagy, 2004 | Pre-mentalisatie modi detectie, mentaliseren bevorderen, affect-focus |
| Acceptance & Commitment Therapy | ACT | Hayes et al., 1999 | Experiëntiële vermijding, cognitieve defusie, waarden-gericht handelen |
| Schematherapie | Schema/Mode | Young et al., 2003 | Schema-modi detectie, limited reparenting, modus-dialoog |
| Emotionele Kerntherapie | EKT | Van den Hout, adaptatie | Fasen: verheldering → spiegel → contract → exit |
| Stoïcijnse filosofie | STOA | Epictetus, Marcus Aurelius, Seneca | Dichotomie van controle, amor fati, premeditatio malorum |

### Arbitratie tussen kaders

Wanneer meerdere kaders tegelijk geactiveerd worden, bepaalt de pipeline via confidence-scores en prioriteitsregels welk kader dominant is. Het AI-model ontvangt alleen het winnende kader als primaire instructie, met eventueel een secundair kader als aanvulling. De selectie is deterministisch en traceerbaar in de engine trace.

---

## 10. Veiligheidssysteem en crisisprotocol

### 10.1 Risiconiveaus

| Niveau | Label | Actie |
|--------|-------|-------|
| 0 | Low | Normaal gesprek, volledige therapeutische diepte |
| 1 | Moderate | Verhoogde alertheid, zachtere interventies, geen diepe confrontatie |
| 2 | High | Crisisprotocol actief, noodcontacten tonen, stabilisatie eerst |
| 2+ | Critical | Volledige crisis-override, ALLE modules onderdrukt, alleen veiligheid |

### 10.2 Crisisdetectie (deterministisch + GPT)

De app detecteert crisis via twee parallelle paden:

1. **Deterministisch (regex + heuristiek):** Meertalige markerbanken (NL/EN/FR) voor suïcidaliteit, zelfbeschadiging, acute intoxicatie, geweld, kindgevaar, verdwijning, overdosis.
2. **GPT Signal Engine:** Semantische analyse voor subtielere signalen die regex mist (3 seconden timeout, niet-blokkerend).

Wanneer één van beide paden een crisis detecteert, wordt het hoogste niveau aangehouden (**fail-safe principe**).

### 10.3 Crisisrespons

Bij crisis-detectie:

1. Alle therapeutische modules worden onderdrukt
2. Het AI-model ontvangt een crisis-specifiek prompt-blok
3. Crisisnummers worden getoond in de UI
4. De sessie wordt gemarkeerd als crisis-sessie in logs.dat
5. Het event wordt gelogd in `relapseIntentLog` (cross-sessie tracking)

**Crisisnummers:**

| Nummer | Dienst | Wanneer |
|--------|--------|---------|
| 112 | Nooddiensten | Levensbedreigende situatie |
| 0800 32 123 | Zelfmoordlijn België | Suïcidale ideatie |
| 113 | Zelfmoordpreventie Nederland | Suïcidale ideatie |
| 1712 | Kindertelefoon | Kindveiligheid in gevaar |
| 1813 | Zelfmoordlijn België (alternatief) | Suïcidale ideatie |

### 10.4 Zone-escalatie bij terugvalintentie

Wanneer terugvalintentie wordt gedetecteerd (Elias) of terugval van de naaste (Kim), wordt de zone automatisch geëscaleerd naar minimaal ORANJE (severity 3). Dit garandeert dat het AI-model een verhoogde alertheid hanteert, ongeacht de zelf-gerapporteerde zone. De escalatie wordt gelogd met bron (GPT of fallback) en confidence-score.

### 10.5 Wat de app NIET doet

| Beperking | Reden |
|-----------|-------|
| Geen diagnoses stellen | Buiten scope, vereist klinische beoordeling |
| Geen medicatie-advies | Medisch domein, verwijst naar arts |
| Geen vervanging van therapie | Aanvullend, niet vervangend |
| Geen contact met hulpdiensten namens gebruiker | Gebruiker behoudt eigen regie |
| Geen opslag van data buiten toestel | Privacy by design |
| Geen advies over juridische zaken | Verwijst naar professioneel |
| Geen beoordeling van schuld/onschuld | Ethisch niet verantwoord |

---

## 11. Het profiel: Levensverhaal, VSP en Eigen Regie

### 11.1 Levensverhaal (Backpack/Rugzak)

De gebruiker kan vrije tekst-secties invullen over:

- Persoonlijke geschiedenis (kindertijd, adolescentie, volwassenheid)
- Belangrijke relaties (familie, partner, kinderen)
- Triggers en risicosituaties
- Doelen en waarden
- Wat helpt in moeilijke momenten

Deze informatie wordt lokaal opgeslagen en bij sessie-start meegegeven aan het AI-model als context. Het model gebruikt dit om gepersonaliseerde, relevante antwoorden te geven. De backpack wordt **nooit** automatisch gewijzigd, samengevat of ingekort — dit is een architectureel vereiste voor consistentie.

**Entity-extractie:** Na het invullen analyseert een GPT-4o call de secties en extraheert gestructureerde entiteiten (personen, relaties, triggers, schema's). Deze worden gecached zodat niet elke sessie de volledige tekst opnieuw geanalyseerd hoeft te worden.

**VSP Backpack Profile:** Een LLM-geanalyseerd profiel op basis van recurringThemes uit de backpack-secties. Gecached in AsyncStorage, periodiek vernieuwd.

### 11.2 Veiligheidssignaalplan (VSP) — Elias

Het VSP is het kernstuk van de Elias-persona. Het is gebaseerd op het klinische concept van het signaleringsplan uit de verslavingszorg.

**Vijf zones:**

| Zone | Kleur | Betekenis | Systeemgedrag |
|------|-------|-----------|---------------|
| 1 | Groen | Stabiel, herstel verloopt goed | Volledige therapeutische diepte, reflectie toegestaan |
| 2 | Geel | Lichte waarschuwing | Reflectie toegestaan, geen diepe confrontatie |
| 3 | Oranje | Duidelijke waarschuwing | Begeleiding beperkt, extra waakzaamheid, model-upgrade naar gpt-4o |
| 4 | Rood | Acuut risico | Stabilisatie eerst, max 2 zinnen, één concrete stap |
| 5 | Paars | Crisis | Onmiddellijke crisisinterventie, overschrijft alle modules |

**Per zone vult de gebruiker in:**

- Welke signalen horen bij deze zone? (herkenning)
- Wat helpt in deze zone? (coping)
- Een ankerzin (persoonlijke motivatie-zin)

**Hoe het VSP de engine stuurt:**

De gebruiker geeft bij sessie-start via een thermometer-slider aan in welke zone hij/zij zich bevindt. De pipeline combineert dit zelf-rapport met objectieve signalen uit het bericht (craving-taal, isolatie-markers, etc.) om een *resolved zone* te bepalen. De resolved zone bepaalt:

- Welk AI-model wordt gebruikt (gpt-4o-mini voor groen/geel, gpt-4o voor oranje+)
- Welke interventie-diepte is toegestaan (regulation layer)
- Welke modules geactiveerd mogen worden
- Of zone-escalatie nodig is
- Welke VSP-sectie (signalen + wat helpt + ankerzin) prominent wordt meegegeven aan GPT

### 11.3 Eigen Regie — Kim

Kim gebruikt geen VSP maar een **Eigen Regie score** (0-100):

| Score | Betekenis | Systeemgedrag |
|-------|-----------|---------------|
| 80-100 | Sterk: duidelijke grenzen, zelfzorg op orde | Volledige reflectieve diepte |
| 50-79 | Gemiddeld: wisselend, soms moeite met grenzen | Normale begeleiding |
| 20-49 | Laag: overbelast, grenzen vervagen | Verhoogde alertheid, stabilisatie-focus |
| 0-19 | Crisis: volledig verlies van eigen regie | Kim-crisis geactiveerd (equivalent PAARS) |

---

## 12. Het dagboek: My Diary en Gratitude

### 12.1 My Diary

Het dagboek biedt de gebruiker een veilige plek om gedachten vast te leggen, los van het gesprek met de AI.

**Kenmerken:**

- Vrije tekst-invoer met datum/tijd-stempel
- Lokaal opgeslagen, versleuteld (AES-256-GCM)
- Optioneel: stemming-tag bij entry
- Laatste 10 entries worden meegegeven als context aan het AI-model zodat het gesprek kan aansluiten
- Gebruiker kan entries exporteren of verwijderen

**Klinische functie:** Zelfreflectie, emotie-expressie, patroonherkenning over tijd. Het dagboek fungeert als "extern geheugen" dat de gebruiker helpt patronen te zien die in het moment onzichtbaar zijn.

### 12.2 Gratitude (Dankbaarheid)

Een apart gedeelte binnen het dagboek voor dankbaarheidsnotities.

**Kenmerken:**

- Korte entries (één zin tot kort alinea)
- Dagelijkse prompt/herinnering (optioneel)
- Lokaal opgeslagen, versleuteld
- Wordt NIET meegegeven aan het AI-model (privacy)

**Klinische functie:** Evidence-based interventie voor welzijn (Emmons & McCullough, 2003). Verschuift aandacht van probleem naar hulpbron. Specifiek relevant bij verslavingsherstel waar negativiteitsbias sterk kan zijn.

### 12.3 Mood-tracking (Stemmingssliders)

Bij sessie-start vult de gebruiker sliders in die de engine direct beïnvloeden:

**Elias-sliders:**

| Slider | Bereik | Engine-effect |
|--------|--------|---------------|
| Craving | 0-10 | ≥4: craving-modules geactiveerd, AUTOPILOT01 kandidaat |
| Mood | 0-10 | Beïnvloedt zone-score berekening |
| Energy | 0-10 | Lage energie → vermoeidheid-triggers |
| Sleep | 0-10 | Lage slaap → SLAAP01 kandidaat |
| Self-care | 0-10 | ≤3: K03 geactiveerd |
| VSP (thermometer) | Zone 1-5 | Primaire zone-input |

**Kim-sliders:**

| Slider | Bereik | Engine-effect |
|--------|--------|---------------|
| Stress | 0-10 | Beïnvloedt Kim zone-berekening |
| Boundary fatigue | 0-10 | ≤3: K01 verhoogde prioriteit |
| Eigen Regie | 0-100 | Primaire Kim zone-input; <10 = crisis |
| Self-care | 0-10 | ≤3: K03/K06 geactiveerd |

---

## 13. GDPR/Privacy en gegevensbescherming

### 13.1 Architectuurprincipe: Privacy by Design

| Principe | Implementatie |
|----------|---------------|
| **Dataminimalisatie** | Alleen strikt noodzakelijke data wordt verwerkt |
| **Lokale opslag** | Alle persoonlijke data staat op het toestel, niet in de cloud |
| **Versleuteling** | AES-256-GCM met device-specifieke sleutel |
| **Geen tracking** | Geen analytics, geen advertenties, geen third-party trackers |
| **Recht op verwijdering** | Eén-klik volledige data-wipe |
| **Recht op portabiliteit** | Export naar JSON/tekst |
| **Doelbinding** | Data wordt uitsluitend gebruikt voor het beoogde doel (herstelondersteuning) |

### 13.2 Datastromen

```
┌──────────────────────────────────────────────────────────┐
│  TOESTEL (lokaal, versleuteld met AES-256-GCM)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  user.dat   │  │  logs.dat   │  │  backpack   │     │
│  │  (profiel,  │  │  (sessie-   │  │  (levens-   │     │
│  │   history)  │  │   logs)     │  │   verhaal)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  diary      │  │  gratitude  │  │  state.dat  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────┘
         │ (alleen: bericht + system prompt + context)
         ▼
┌──────────────────────────────────────────────────────────┐
│  SERVER (transit only)                                    │
│  - Ontvangt: bericht + system prompt + context           │
│  - Valideert: Zod-schema (structuur, niet inhoud)        │
│  - Stuurt door naar: AI-provider (OpenAI)                │
│  - Slaat NIETS op van berichtinhoud                      │
│  - Geen logging van persoonlijke data                    │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│  AI-PROVIDER (OpenAI)                                    │
│  - Verwerkt bericht, genereert antwoord                  │
│  - Geen training op gebruikersdata (API ToS)             │
│  - Zero data retention policy (API endpoint)             │
└──────────────────────────────────────────────────────────┘
```

### 13.3 Versleuteling (technisch detail)

| Aspect | Implementatie |
|--------|---------------|
| **Algoritme** | AES-256-GCM (authenticated encryption) |
| **Sleutelbeheer** | Device-specifieke sleutel via Expo SecureStore (iOS Keychain / Android Keystore) |
| **IV (Initialization Vector)** | Uniek per encryptie-operatie (12 bytes, cryptografisch random) |
| **Auth Tag** | 16 bytes, geïntegreerd in ciphertext |
| **Sleutelrotatie** | Bij app-update of handmatige reset |
| **Key derivation** | PBKDF2 of device-native KDF |

### 13.4 Wat wordt naar de server gestuurd?

| Data | Wordt verstuurd? | Doel | Opgeslagen op server? |
|------|-------------------|------|----------------------|
| Gebruikersbericht | Ja | AI-respons genereren | Nee |
| System prompt | Ja | AI-model sturen | Nee |
| Mood-sliders (huidige sessie) | Ja (als context) | Gepersonaliseerde respons | Nee |
| Levensverhaal-fragmenten | Ja (bij SESSION_INIT) | Relevante antwoorden | Nee |
| Voornaam | Ja | Persoonlijke aanspreking | Nee |
| Volledige chatgeschiedenis | Nee | Lokaal verwerkt | N.v.t. |
| Dagboek (laatste 10) | Ja (als context) | Aansluiting bij recente reflecties | Nee |
| Gratitude-entries | Nee | Volledig privé | N.v.t. |
| Locatiegegevens | Nee | Niet verzameld | N.v.t. |
| Device-identifiers | Nee | Niet verzameld | N.v.t. |

### 13.5 Gebruikersrechten (GDPR Art. 15-22)

| Recht | Implementatie |
|-------|---------------|
| **Inzage (Art. 15)** | Volledige data zichtbaar in app (profiel, dagboek, geschiedenis) |
| **Rectificatie (Art. 16)** | Profiel en dagboek vrij bewerkbaar door gebruiker |
| **Verwijdering (Art. 17)** | Eén-klik wipe van alle data, inclusief versleutelde bestanden |
| **Portabiliteit (Art. 20)** | Export naar JSON (volledig, machine-leesbaar) of tekst (menselijk leesbaar) |
| **Beperking (Art. 18)** | Gebruiker kan specifieke secties leegmaken zonder alles te verwijderen |
| **Bezwaar (Art. 21)** | N.v.t. — geen profiling, geen marketing, geen geautomatiseerde besluitvorming |

### 13.6 Data Protection Impact Assessment (DPIA) overwegingen

| Aspect | Beoordeling |
|--------|-------------|
| **Gevoelige data** | Ja — gezondheidsgegevens (Art. 9 GDPR) |
| **Rechtsgrond** | Uitdrukkelijke toestemming (Art. 9(2)(a)) |
| **Verwerkingsverantwoordelijke** | Ontwikkelaar RecoFree |
| **Verwerker** | OpenAI (sub-verwerker, verwerkersovereenkomst vereist) |
| **Bewaartermijn** | Onbeperkt lokaal (gebruiker bepaalt); zero retention bij OpenAI |
| **Internationale doorgifte** | Ja (OpenAI servers VS) — Standard Contractual Clauses van toepassing |

---

## 14. Kwaliteitsborging en anti-hallucinatie

### 14.1 Deterministische controle over AI-output

Het kernprincipe van RecoFree is dat het AI-model **nooit eigenstandig klinische beslissingen neemt**. De pipeline bepaalt:

- Welk therapeutisch kader actief is (module-selectie)
- Welke toon en diepte toegestaan zijn (regulation layer)
- Welke onderwerpen vermeden moeten worden (do-nots per module)
- Of crisisnummers getoond moeten worden (crisis-override)
- Welk model gebruikt wordt (model-selectie op basis van zone)

Het AI-model ontvangt deze instructies als harde constraints in het system prompt en mag deze niet overschrijven.

### 14.2 Anti-hallucinatie maatregelen

| Maatregel | Implementatie |
|-----------|---------------|
| **Geen feitelijke claims** | Model wordt geïnstrueerd geen medische feiten te beweren |
| **Geen diagnoses** | Expliciet verboden in system prompt |
| **Geen medicatie-advies** | Expliciet verboden, verwijst naar arts |
| **Geen externe verwijzingen** | Model noemt geen specifieke klinieken of therapeuten (behalve crisisnummers) |
| **Post-GPT filtering** | Feedback loop parst engine_signals en valideert tegen pipeline-staat |
| **Loopblocker** | Detecteert cross-sessie herhalingspatronen (≥3 sessies zonder progressie) |
| **Anti-repetitie** | Regulation layer vergelijkt met vorige assistant-bericht |
| **Language recovery** | Detecteert positieve taalverschuiving en voorkomt overdreven bevestiging |

### 14.3 Model-selectie

| Zone | Model | Reden |
|------|-------|-------|
| Groen/Geel | gpt-4o-mini | Kostenefficiënt, voldoende voor reflectief gesprek |
| Oranje+ | gpt-4o | Hogere capaciteit voor complexe klinische situaties |
| Crisis | gpt-4o | Maximale nauwkeurigheid bij veiligheidskritieke situaties |

### 14.4 Regulation Layer (interventie-diepte)

De regulation layer bepaalt per bericht hoe diep de interventie mag gaan:

| Actie | Betekenis |
|-------|-----------|
| `reflect` | Alleen reflecteren, geen interventie |
| `soften` | Interventie verzachten (lagere intensiteit) |
| `intervene` | Normale interventie toegestaan |
| `challenge` | Confrontatie toegestaan (alleen in groene zone met voldoende diepte) |

De layer houdt rekening met: huidige zone, guidance-depth voorkeur van gebruiker, en anti-repetitie (niet hetzelfde type interventie herhalen).

---

## 15. Governance en klinisch toezicht

### 15.1 Rolverdeling

| Rol | Verantwoordelijkheid |
|-----|---------------------|
| **Klinisch toezichthouder** (dr. Peuskens) | Validatie therapeutische kaders, review module-specificaties, goedkeuring crisisprotocol, periodieke review van AI-output |
| **Ontwikkelteam** | Technische implementatie, testing, deployment, monitoring |
| **MDR-verantwoordelijke** | Conformiteit met Medical Device Regulation EU 2017/745, risicobeoordeling, technische documentatie |

### 15.2 Wijzigingsbeheer

Elke nieuwe module of wijziging aan bestaande modules doorloopt:

1. Specificatie-document (klinische onderbouwing + technische spec)
2. Review door klinisch toezichthouder
3. Implementatie met unit tests (TypeScript, vitest)
4. Integratie-test (alle bestaande tests moeten slagen — momenteel 550+ tests)
5. TypeScript-check (zero errors vereist)
6. Deployment na goedkeuring

### 15.3 Beperkingen en risico-mitigatie

| Risico | Waarschijnlijkheid | Ernst | Mitigatie |
|--------|-------------------|-------|-----------|
| AI-hallucinatie (onjuiste informatie) | Laag | Hoog | Deterministische pipeline + post-GPT filtering + geen feitelijke claims |
| Gemiste crisis | Zeer laag | Kritiek | Dual-pad detectie (deterministisch + GPT), fail-safe naar hoogste niveau |
| Overafhankelijkheid van app | Middel | Middel | Sessie-limiet, verwijzing naar professionele hulp, geen vervanging van therapie |
| Privacy-lek | Zeer laag | Hoog | Lokale opslag, AES-256-GCM, geen cloud-sync, zero retention bij AI-provider |
| Technische storing | Laag | Laag | Graceful fallback, geen data-verlies bij crash |
| Misbruik door gebruiker | Laag | Laag | Geen persoonlijke data van derden verwerkt |

---

## 16. Traceerbaarheid en logging

### 16.1 Per-bericht trace (Engine Trace)

Elk verwerkt bericht genereert een volledige trace die bevat:

| Veld | Inhoud |
|------|--------|
| `timestamp` | Tijdstempel verwerking |
| `messageIndex` | Volgnummer in sessie |
| `preGPT.triggerDecayApplied` | Of trigger-decay is toegepast |
| `preGPT.zoneDecay` | Of en welk type zone-decay actief was |
| `preGPT.dominantState` | Dominante module, bron-laag, risico-score |
| `preGPT.selectedTriggers` | Gedetecteerde triggers met scores |
| `preGPT.bufferZoneScore` | Zone-score op moment van verwerking |
| `preGPT.regulation` | Regulatie-actie, zone, diepte, softening, skipping |
| `gpt.selectedModel` | Welk AI-model gebruikt is |
| `gpt.tokenUsage` | Token-verbruik (prompt + completion + totaal) |
| `gpt.responseLength` | Lengte van AI-respons |
| `postGPT.patternSignalsMarked` | Welke patronen gemarkeerd zijn |
| `postGPT.promotionCandidates` | Patronen die mogelijk gepromoveerd worden |
| `postGPT.promotionDecisions` | Daadwerkelijke promotie-beslissingen |

### 16.2 Sessie-samenvatting (logs.dat)

Na sessie-einde wordt een gestructureerde samenvatting geschreven die:

- Geen letterlijke gebruikersberichten bevat (privacy)
- Wel thema's, zone-verloop en module-gebruik documenteert
- Doorzoekbaar is voor past-reference (wanneer gebruiker verwijst naar eerdere sessie)
- Retentiebeleid volgt (compressie na 6 maanden)

### 16.3 Audit-trail voor MDR

Voor MDR-doeleinden is de volledige beslissingsketen traceerbaar:

```
Gebruikersbericht
  → Trigger-detectie (welke markers, welke scores)
    → Zone-berekening (welke inputs, welk resultaat, resolved vs. self-reported)
      → Module-selectie (welke kandidaten, welke winnaar, confidence, prioriteit)
        → Regulation (welke actie, welke diepte, anti-repetitie)
          → GPT-instructie (welke constraints, welke toon, welke do-nots)
            → AI-respons (welk model, hoeveel tokens)
              → Post-GPT validatie (feedback loop, pattern marking)
                → Opslag (wat waar opgeslagen, wat gewist)
```

### 16.4 Kostenregistratie

Per GPT-call wordt geregistreerd:
- Token-verbruik (input + output)
- Model gebruikt
- Of het een SESSION_INIT of LIVE_MESSAGE was
- Welke module dominant was

---

## Bijlage A: Technische stack

| Component | Technologie |
|-----------|-------------|
| Frontend | React Native 0.81, Expo SDK 54, TypeScript 5.9 |
| Styling | NativeWind 4 (Tailwind CSS) |
| State management | React Context + AsyncStorage (versleuteld) |
| Navigatie | Expo Router 6 |
| Versleuteling | AES-256-GCM via expo-crypto + expo-secure-store |
| AI-provider | OpenAI GPT-4o / GPT-4o-mini via server-proxy |
| Server | Express.js + tRPC (transit only, geen data-opslag) |
| Validatie | Zod schema-validatie op server |
| Testing | Vitest (550+ tests) |
| Database | Geen server-side database voor gebruikersdata |

---

## Bijlage B: Referenties klinische kaders

| Kader | Primaire bron |
|-------|---------------|
| Motiverende Gespreksvoering | Miller, W.R. & Rollnick, S. (2012). *Motivational Interviewing: Helping People Change* (3rd ed.). Guilford Press. |
| Cognitieve Gedragstherapie | Beck, A.T. (1979). *Cognitive Therapy and the Emotional Disorders*. Penguin. |
| Dialectische Gedragstherapie | Linehan, M.M. (1993). *Cognitive-Behavioral Treatment of Borderline Personality Disorder*. Guilford Press. |
| Mentalisatie-Bevorderende Therapie | Bateman, A. & Fonagy, P. (2004). *Psychotherapy for Borderline Personality Disorder: Mentalization-Based Treatment*. Oxford University Press. |
| Acceptance & Commitment Therapy | Hayes, S.C., Strosahl, K.D. & Wilson, K.G. (1999). *Acceptance and Commitment Therapy*. Guilford Press. |
| Schematherapie | Young, J.E., Klosko, J.S. & Weishaar, M.E. (2003). *Schema Therapy: A Practitioner's Guide*. Guilford Press. |
| Veiligheidssignaalplan | GGZ-standaard Verslavingszorg, Zorgstandaarden Nederland. |
| Dankbaarheidsinterventie | Emmons, R.A. & McCullough, M.E. (2003). Counting blessings versus burdens. *Journal of Personality and Social Psychology*, 84(2), 377-389. |
| Stoïcijnse filosofie | Epictetus, *Enchiridion*; Marcus Aurelius, *Meditaties*; Seneca, *Brieven aan Lucilius*. |

---

## Bijlage C: Afkortingenlijst

| Afkorting | Betekenis |
|-----------|-----------|
| ACT | Acceptance & Commitment Therapy |
| AES-GCM | Advanced Encryption Standard - Galois/Counter Mode |
| CGT/CBT | Cognitieve Gedragstherapie / Cognitive Behavioural Therapy |
| DGT/DBT | Dialectische Gedragstherapie / Dialectical Behaviour Therapy |
| DPIA | Data Protection Impact Assessment |
| EKT | Emotionele Kerntherapie |
| GDPR | General Data Protection Regulation (AVG) |
| GPT | Generative Pre-trained Transformer |
| IV | Initialization Vector |
| MBT | Mentalisatie-Bevorderende Therapie |
| MDR | Medical Device Regulation (EU 2017/745) |
| MI | Motiverende Gespreksvoering / Motivational Interviewing |
| SaMD | Software as a Medical Device |
| VSP | Veiligheidssignaalplan |

---

*Dit document is gegenereerd op basis van de volledige broncode van RecoFree en weerspiegelt de staat van de applicatie per 26 juni 2026. Geen code is gewijzigd bij het opstellen van dit document.*
