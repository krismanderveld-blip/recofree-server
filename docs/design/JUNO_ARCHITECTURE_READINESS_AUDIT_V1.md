# Juno Architecture Readiness Audit V1

**Auteur:** Manus AI  
**Auditdatum:** 2026-08-30  
**Werkmodus:** Audit-only — geen Juno-, Elias-, Kim-, backend-, prompt-, schema-, test- of runtime-implementatie  
**Geaudite codebasis:** RecoFree commit `80f93fa`  

> **Hoofdconclusie:** RecoFree heeft sterke herbruikbare client-side bouwstenen, maar Juno kan niet veilig worden toegevoegd als een combinatie van Elias en Kim. Juno vereist een derde, expliciete persona door de volledige typed keten: intake → Backpack/UserDat → memory namespace → sliders/zone → modules/router → formulation → promptcomposer → post-check → debug → tests/releasegate. De minimale Railway-backend hoeft hiervoor niet te veranderen.

## 1. Baseline verification

| Controle | Resultaat | Bewijs |
|---|---:|---|
| Huidige commit | `80f93fa` | `git rev-parse --short HEAD` tijdens audit |
| Volledige tests | **4.261 pass, 1 skip, 0 fail** | Laatste volledige Vitest-run op deze client-only commit |
| TypeScript | **0 fouten** | `npx tsc --noEmit` |
| Release gate | **PASS** | `npm run recofree:release-gate` |
| Wide-range pre-APK gate | **PASS**, 7/7 lagen | `npm run recofree:wide-range-pre-apk-gate` |
| Laatste lokale stateful scenariomatrix | **6/6 PASS** | `__tests__/integration/sixDeviceScenariosLocalMatrix.test.ts` |
| Nieuwe APK device-status | **Elias en Kim inhoudelijk getest; clientcoherentiecorrecties daarna nog niet device-herbevestigd** | Device-evidence gevolgd door client-only commit `80f93fa` |
| Productie-API | `https://railwayappdashboard-production.up.railway.app` | `lib/config/client-first-architecture.ts` |
| Productieroute | `/api/minimal-gpt-proxy` plus clientsessie/health | `server/_core/index.ts`; standalone routegate |
| OpenAI-retentie | `store:false` verplicht | `lib/ai/prompt/minimal-gpt-proxy-contract.ts`; `lib/ai/minimal-proxy-client.ts` |
| `*.manus.space` in productie-Androidbundle | **Afwezig** | standalone Androidbundle-gate |
| Backendrol | Minimale, stateless transport/proxy | `server/minimal-gpt-proxy.ts`; gespecialiseerde klinische routes niet geregistreerd |
| Klinische/personalogica | Client-side | `lib/rugzak/pipeline.ts`; `lib/engine/**` |

De werkboom bevat tijdens deze audit uitsluitend het vereiste auditrapport en de auditregistratie in `todo.md`. Er is geen Juno-code gecreëerd en geen bestaande runtimecode aangepast. De productiearchitectuur blijft client-first met een minimaal geregistreerd Railway-oppervlak.[1] [2]

### 1.1 Projectinvarianten

| Invariant | Status | Bestand/functie-evidence | Nuance |
|---|---|---|---|
| Elias ondersteunt eigen verslaving/herstel | **PASS** | `lib/engine/elias/**`; `lib/rugzak/pipeline.ts` | Eliasmechanismen mogen niet als Juno-identiteit worden hergebruikt |
| Kim ondersteunt naasten/caregivers | **PASS** | `lib/engine/kim/**`; `lib/ai/prompt/kim-prompt-composer.ts` | Kim-caregiverdata mag niet naar Juno lekken |
| Elias en Kim hebben gescheiden memory/context paths | **PASS** | `lib/types/memory/memoryCore.types.ts`; `recofree_memory/{persona}/...` | Eén actief Backpack/UserDat-paar blijft een derde-personarisico |
| Persona- en klinische logica is client-side | **PASS** | `lib/rugzak/pipeline.ts`; `lib/engine/**` | Geen Juno-branch bestaat vandaag |
| Productiebackend is minimale transport/proxy | **PASS** | `server/_core/index.ts`; `server/minimal-gpt-proxy.ts` | Gespecialiseerde legacyserverbestanden zijn niet geregistreerd |
| GPT gebruikt minimal proxy | **PASS** | `lib/ai/minimal-proxy-client.ts`; `lib/ai/openai-provider.ts` | Juno kan hetzelfde generieke transport gebruiken na unionuitbreiding |
| `store:false` is verplicht | **PASS** | `lib/ai/prompt/minimal-gpt-proxy-contract.ts` | Releasegate bewaakt dit contract |
| Geen productie-`*.manus.space` | **PASS** | `scripts/standalone-apk-railway-gate.sh` | Gebaseerd op Androidbundlescan |
| ClinicalCtx wordt client-side gebouwd | **PASS** | `buildPersonalClinicalContext()` in `lib/rugzak/pipeline.ts` | Signatuur is binair Elias/Kim |
| Modelrouting is client-side | **PASS** | `epistemic-model-routing.ts` | Juno-signalen/reasons ontbreken |
| Safety/crisisrouting is client-side | **PASS** | epistemic engine; `runtime-safety-presentation.ts`; pipeline | Juno shared-use en dual-dysregulation ontbreken |
| DeepAnalysis wordt client-side gestart en lokaal opgeslagen | **PASS** | `section-analysis-service.ts`; `manual-data-refresh.ts` | Output- en mergecontract zijn binair |
| `user.dat`, `state.dat`, `context.dat`, `logs.dat` zijn lokaal | **PASS** | memory stores; encrypted canonical JSON-store | Juno-namespace bestaat nog niet |
| Railway bevat geen actieve klinische personarouter | **PASS** | geregistreerde productie-routeoppervlak | Geen backendwijziging nodig voor Juno |

## 2. Persona architecture map

### 2.1 Canonieke personaboundaries

| Boundary | Elias | Kim | Juno-status |
|---|---|---|---|
| Hoofdtype | `UserType = 'elias'` | `UserType = 'kim'` | **Niet aanwezig**; union is binair in `lib/ai/types.ts` |
| Memorytype | `RecoFreePersona = 'elias'` | `RecoFreePersona = 'kim'` | **Niet aanwezig** in `lib/types/memory/memoryCore.types.ts` |
| Intakebranch | Stage of Change | Eigen Regie level | **Niet aanwezig** in `app/intake.tsx` |
| Backpack | `sections`, `vspSection`, Balkmetafoor | `kimBackpack`, `eigenRegiePlan` | **Nieuw Juno-Backpackcontract vereist** |
| Sliders | craving, frustration, despondency, focus, VSP | stress, boundaryFatigue, emotionalBurden, selfCare, Eigen Regie | **Nieuw `JunoMoodSliders` vereist** |
| Engine | `lib/engine/elias/**` | `lib/engine/kim/**` | **Nieuw `lib/engine/juno/**` vereist** |
| Directive | `EliasDirective` | `KimDirective` | **Nieuw `JunoDirective` vereist** |
| Modulecatalogus | `E01–E08` plus Elias short/advanced modules | `K01–K06` plus Kim advanced modules | **Nieuw J01–J05-catalogus vereist** |
| Promptcomposer | `elias-prompt-composer.ts` | `kim-prompt-composer.ts` | **Nieuw `juno-prompt-composer.ts` vereist** |
| Formulation | recovery formulation | relational/caregiver formulation | **Nieuwe relational-recovery formulation vereist** |
| Persona-debug | Elias branches in pipeline/dropdown | Kim branches in pipeline/dropdown | **Nieuw expliciet Juno-debugcontract vereist** |

`lib/engine/orchestration.ts` is de scherpste scheidingsboundary. Het contract zegt expliciet “never both, never merged” en routeert uitsluitend naar `EliasDirective` of `KimDirective`. `lib/ai/prompt/persona-prompt-composer.ts` is eveneens binair en valt voor iedere niet-Kimwaarde terug op Elias. Alleen `UserType` uitbreiden naar `juno` zou daarom gevaarlijk zijn: een niet-afgehandelde Juno-waarde kan stil Eliaspromptgedrag erven.[3] [4] [7]

### 2.2 Waar persona vandaag wordt bepaald en doorgegeven

| Stap | Bestand/functie | Huidige werking | Juno-implicatie |
|---|---|---|---|
| Selectie | `app/intake.tsx` | Gebruiker kiest Elias of Kim | Juno alleen zichtbaar achter expliciete featureflag |
| Canonieke identiteit | `Backpack.userType` | Immutable na intake | Juno moet derde expliciete waarde zijn; geen runtime-inferentie |
| Initialisatie | `createNewBackpack`, `createNewUserDat` in `lib/ai/types.ts` | Persona-afhankelijke defaults | Juno moet eigen defaults krijgen; geen Elias-defaultfallthrough |
| Persistence | `persistBackpack`, `persistUserDat` in `lib/user-context.tsx` | Eén actief Backpack/UserDat-paar plus persona-memorylagen | Juno moet eigen namespace en migratieguard krijgen |
| Pipeline | `processMessage` in `lib/rugzak/pipeline.ts` | Leest `backpack.userType`; routeert alle clientengines | Iedere binaire conditional moet expliciet Juno afhandelen |
| Prompt | `buildClientSystemPrompt` | Persona is reeds beslist; composer formuleert alleen | Nieuwe Juno-composer; geen samengevoegde Elias/Kim-secties |
| Model | `routeEpistemicModel` | Shared safety/capaciteitsrouter | Herbruikbaar met nieuwe Juno-reasoninputs |
| Transport | `callMinimalProxy` | Persona als metadata; `store:false` | Union en contract moeten Juno toelaten; server blijft generiek |

### 2.3 Vereiste expliciete architectuurkaart

#### ELIAS

| Veld | Huidige implementatie |
|---|---|
| Persona key | `elias` |
| Kernbestanden | `lib/engine/elias/**`, `lib/rugzak/pipeline.ts`, `elias-prompt-composer.ts` |
| Statevelden | Eigen craving/relapse/recovery, VSP, sobriety en recovery formulation |
| Sliders | `craving`, `frustration`, `despondency`, `focus`, VSP-signalen |
| Zones | Elias VSP/turn-zone plus shared acute safety override |
| Modules | `E01–E08`, short modules en advanced Elias-modules |
| Promptcomposer | `lib/ai/prompt/elias-prompt-composer.ts` |
| ClinicalCtx path | `buildPersonalClinicalContext(userDat, 'elias', ...)` |
| DeepAnalysis path | Backpacksections → `analyzeAllSections(..., 'elias')` → `mergeAnalysisToUserDat` |
| Memory namespace | `recofree_memory/elias/{user,state,projections,logs,context}.dat` |
| Debugvelden | persona/module/zone/risk/CMD/ClinicalCtx/DeepAnalysis/ModelRoute/Cost/Route |
| Tests | Elias formulation, pipeline, safety, modelrouting, ClinicalCtx en stateful matrix |

#### KIM

| Veld | Huidige implementatie |
|---|---|
| Persona key | `kim` |
| Kernbestanden | `lib/engine/kim/**`, `lib/rugzak/pipeline.ts`, `kim-prompt-composer.ts` |
| Statevelden | Stress, boundary fatigue, emotional burden, self-care, caregiver/relational patterns, Eigen Regie |
| Sliders | `stress`, `boundaryFatigue`, `emotionalBurden`, `selfCare`, Eigen Regie |
| Zones | Kim stress/Eigen-Regie/turn-zone plus shared acute safety override |
| Modules | `K01–K06` en advanced Kim-modules |
| Promptcomposer | `lib/ai/prompt/kim-prompt-composer.ts` |
| ClinicalCtx path | `buildPersonalClinicalContext(userDat, 'kim', ...)` |
| DeepAnalysis path | Kim Backpacksections → `analyzeAllSections(..., 'kim')` → persona-aware merge |
| Memory namespace | `recofree_memory/kim/{user,state,projections,logs,context}.dat` |
| Debugvelden | persona/module/zone/risk/CMD/ClinicalCtx/DeepAnalysis/ModelRoute/Cost/Route/Kim guidance |
| Tests | Kim cluster-, formulation-, safety-, K05-, ClinicalCtx- en stateful matrixregressies |

#### UNKNOWN / SHARED

| Gedeeld onderdeel | Persona-safe vandaag? | Juno-vereiste |
|---|---|---|
| `processMessage`, buffer, regulation en epistemic routing | **PARTIAL** | Binaire casts/fallbacks exhaustief maken |
| Minimal proxy en `store:false` | **JA** | Persona-union gecontroleerd uitbreiden; server generiek houden |
| CMD/ClinicalCtx | **PARTIAL** | Juno-persona en memoryallowlist toevoegen |
| DeepAnalysis validator/hash/mergeframework | **PARTIAL** | Juno section map, velden en mergeguards toevoegen |
| Promptassembler | **NEE voor onbekende persona** | Niet-Kim valt vandaag naar Elias; fail-closed switch vereist |
| Encryption/export/import | **PARTIAL** | Juno-namespace en roundtripdekking toevoegen |

## 3. Elias reuse map

De volgende classificatie maakt onderscheid tussen **mechanisme hergebruiken** en **bestaande Elias-data overnemen**. Geen enkel bestaand Elias-memoryitem mag door Juno worden gelezen alsof het Juno-memory is.

| Elias-mechanisme | Status | Vereiste guard voor Juno | Primair bewijs |
|---|---|---|---|
| Eigen cravingdetectie | `MAY_REUSE_WITH_GUARD` | Alleen cravings/gebruik van de Juno-gebruiker; nooit die van de andere persoon als eigen state | `lib/engine/elias/elias-relapse-risk-helper.ts`; pipeline |
| Relapse-risk routing | `MAY_REUSE_WITH_GUARD` | `own_recovery_first` heeft voorrang op relatieherstel | epistemic/modelrouting + Elias relapse helper |
| Sobriety/recoverylogica | `MAY_REUSE_WITH_GUARD` | Nieuwe Juno-data in Juno-namespace; geen Elias sobriety state delen | `UserDat.sobrietyDate`, relapse/preventionvelden |
| Cold turkey/medical uncertainty | `MAY_REUSE_FOR_JUNO` | Onvoorwaardelijk vóór relationele routing; geen medisch advies laten formuleren als zekerheid | epistemic reasoning + `runtime-safety-presentation.ts` |
| Acute safety/crisis override | `MAY_REUSE_FOR_JUNO` | Acute crisis blijft hoogste prioriteit; reasonlabel niet verwarren met relational sensitivity | `epistemic-model-routing.ts` |
| Emotieregulatie | `MAY_REUSE_WITH_GUARD` | Generic skillmechanismen, maar nieuwe Juno-modulebeslissing | Elias E02/DBT/groundinglagen |
| Relapsepreventie | `MAY_REUSE_WITH_GUARD` | Alleen als eigen relapse-/shared-use-risk actief is | E03 en prevention contracts |
| Zelfcompassie | `MAY_REUSE_WITH_GUARD` | Geen Elias-identiteit of verslavingsnarratief kopiëren | E04/self-acceptance modules |
| Grounding/mindfulness | `MAY_REUSE_FOR_JUNO` | Shared skill; Juno-stem en Juno-modulemetadata | E05 en regulation contracts |
| VSP/vroegsignalering | `MAY_REUSE_WITH_GUARD` | Alleen structuur/concept; Juno heeft eigen plan en shared-riskdimensie | `VspStructuredPlan`, VSP engines |
| `userReportedClinicalFactors` | `MAY_REUSE_WITH_GUARD` | Alleen factoren over gebruiker; factor over andere persoon apart, user-attributed en niet-diagnostisch | `UserReportedClinicalFactor` |
| Trauma-related formulation | `PARTIAL / NEEDS_DECISION` | Huidige engine kent trauma-sensitivity en life-event type `trauma`, maar geen bewezen Juno trauma-relational contract; aanbevolen V1 beperkt zich tot expliciet user-reported context | epistemic router; `section-analysis-types.ts` |
| Schema’s/modi | `MAY_REUSE_WITH_GUARD` | Eigen hypotheses en relationele loops onderscheiden; geen partnerdiagnose | DeepAnalysis contracts |
| Personal anchors | `MAY_REUSE_FOR_JUNO` | Relatie/rollen expliciet labelen; status/deceased safety behouden | `personalAnchors`, relation graph |
| Contraindications | `MAY_REUSE_FOR_JUNO` | Juno-eigen items; prioriteit vóór formulation hints | DeepAnalysis/ClinicalCtx |
| Safe formulation hints | `MAY_REUSE_FOR_JUNO` | Juno-eigen items; geen Elias framing | DeepAnalysis/ClinicalCtx |
| Recovery patterns | `MAY_REUSE_WITH_GUARD` | Schema hergebruiken, maar opslaan als Juno-eigen recovery pattern | `UserDat.recoveryPatterns` |
| Relapse pathways | `MAY_REUSE_WITH_GUARD` | Mechanisme/schema herbruikbaar; **Elias-instanties niet**; Juno vereist eigen-subject pathway | `UserDat.relapsePathways` |
| Function of addiction | `MAY_REUSE_WITH_GUARD` | Alleen functie van eigen gebruik; andere persoon nooit infereren/diagnosticeren | `UserDat.functionOfAddiction` |

## 4. Kim reuse map

| Kim-mechanisme | Status | Vereiste guard voor Juno | Primair bewijs |
|---|---|---|---|
| Boundary logic | `MAY_REUSE_WITH_GUARD` | Symmetrisch en gekoppeld aan eigen herstel; geen caregiver-only frame | K01/KBR01 |
| Eigen Regie Plan | `DO_NOT_REUSE` | Juno heeft een eigen relational recovery/safety plan nodig | `Backpack.eigenRegiePlan` |
| Self-care logic | `MAY_REUSE_WITH_GUARD` | Zelfzorg als herstelbescherming, niet als “beter kunnen zorgen voor de ander” | K03/K06 |
| Boundary fatigue | `MAY_REUSE_WITH_GUARD` | Relationele uitputting koppelen aan eigen recovery state | Kim sliders/zone |
| Emotional burden | `MAY_REUSE_WITH_GUARD` | Eigen belasting, geen partnerbeoordeling | Kim sliders/zone |
| Stress | `MAY_REUSE_FOR_JUNO` | Shared statefeature; Juno-zone bepaalt betekenis | slider architecture |
| K03 Self-Care | `MAY_REUSE_WITH_GUARD` | Skill/rationale hergebruiken; nieuwe Juno module-ID/stance | `lib/engine/kim/k03-self-care.ts` |
| K04 Emotional Regulation | `MAY_REUSE_WITH_GUARD` | Generic regulation; geen caregiver-only formulering | `lib/engine/kim/k04-emotional-regulation.ts` |
| K05 trust/repair/herstelpad | `MAY_REUSE_WITH_GUARD` | Alleen nadat own craving/relapse, medical safety, acute dysregulation en shared-use-risk veilig zijn | `k05-communication.ts`; K05 post-check |
| K06 Detachment with Love | `DO_NOT_REUSE` | Caregiver/partner-van-een-persoon framing past niet bij mutual recovery | K06/KDL modules |
| KBR01 Boundary Restoration | `MAY_REUSE_WITH_GUARD` | Grens beschermt eigen herstel én behoudt non-demonizing repair path | Kim advanced module |
| BEDR01 betrayal response | `MAY_REUSE_WITH_GUARD` | Alleen relationele schade/impact; nooit partnerdiagnose of automatisch partij kiezen | Kim BPG safety filter |
| VETR01 trust repair | `MAY_REUSE_WITH_GUARD` | Own-recovery-first gate vóór hersteladvies | VETR safety filter |
| GASL01 recognition | `MAY_REUSE_WITH_GUARD` | Werk met concrete ervaring/impact; app stelt geen label als feit vast | BPG safety filter |
| Relational-harm detector | `MAY_REUSE_WITH_GUARD` | Onderscheid conflict, harm en acute safety; symmetrisch waar passend | relational stance/filter |
| Rescue/control detector | `MAY_REUSE_WITH_GUARD` | Detecteer tweerichtingslus; niet alleen caregiver → addicted partner | epistemic/rescue flags |
| Self-loss detector | `MAY_REUSE_WITH_GUARD` | Eigen agency en recovery protection centraal | Kim formulation layers |
| Caregiver burden pathways | `DO_NOT_REUSE` | Juno vereist `relationalRecoveryRisks`/`mutualTriggerLoops`, geen caregiverpad | `UserDat.caregiverBurdenPathways` |
| Function of caregiving pattern | `DO_NOT_REUSE` | Semantisch caregiver-only | `UserDat.functionOfCaregivingPattern` |
| Caregiver patterns | `DO_NOT_REUSE` | Geen Kim-data of Kim-rol naar Juno | `UserDat.caregiverPatterns` |
| Kim stance filter | `DO_NOT_REUSE` | Juno heeft eigen stance: recovery first + mutual accountability + non-rescue | Kim prompt/stance layers |
| Reality/Agency/Responsibility guard | `MAY_REUSE_WITH_GUARD` | Symmetrisch toepassen; gebruiker blijft verantwoordelijk voor eigen herstel, niet voor dat van de ander | Kim responsibility contract |
| Child/minor/trust safeguards | `PARTIAL / NEEDS_DECISION` | Bestaande algemene safetyregels herbruikbaar; Juno-specifieke contact-/child-safetyregels nog niet bewezen als compleet contract | verspreide Kim safety/post-checks |

## 5. Explicit do-not-reuse list

| Risico | Huidige bescherming | Bron | Prioriteit | Vereiste Juno-guard |
|---|---|---|---:|---|
| Elias `relapsePathways` als Juno-memory lezen | Juno bestaat niet; Elias/Kim merge filtert persona | DeepAnalysis merge | P1 | Nieuwe Juno-instanties; nooit Elias-array refereren |
| Kim caregiver burden in Juno | Juno bestaat niet; Kim-only merge | DeepAnalysis merge | P1 | Nieuwe relational recovery riskvelden |
| Elias VSP als relationeel Juno-plan | VSP type is Elias-only | `Backpack.vspSection` | P1 | Nieuw Juno safety/recovery plancontract |
| Kim Eigen Regie Plan als dual-recovery plan | Plan is Kim-only | `Backpack.eigenRegiePlan` | P1 | Niet casten; nieuw Juno-plan |
| Rescue/repair vóór eigen recovery safety | Niet beoordeelbaar voor niet-bestaande Juno-router | N.v.t. | **P0** | Harde routingprioriteit vóór J02/J04/J05 |
| Relatie boven eigen herstel | Niet beoordeelbaar voor Juno | N.v.t. | **P0** | Prompt + deterministic router + post-check |
| Elias- en Kimprompts concatenaten | Binaire composer voorkomt huidige mix | `persona-prompt-composer.ts` | **P0** | Dedicated Juno composer; geen concatenatie |
| Shared memory leakage | Per-persona memorypaths bestaan, maar typed persona-union is binair; legacy active-pair keys bestaan | memory stores/UserProvider | **P0** | `recofree_memory/juno/*`, Juno key alias, export/importisolatie |
| Duplicate module activation | Huidige routers zijn persona-specifiek | catalogs/pipeline | P1 | Juno module allowlist en één dominant-state decision |
| Fallback doet alsof canonical Juno-context bestaat | Geen Juno-fallbackcontract | relevance/ClinicalCtx | P2 | `source=none|canonical|fallback` en `canonicalMissing=true` |
| Onbekende persona valt naar Eliasprompt | **Huidig binair fallthroughrisico** | `persona-prompt-composer.ts` | **P0** | Exhaustieve switch met fail-closed error/default Juno-safe block |
| Juno-velden toevoegen aan gemengd `UserDat` zonder discriminatie | Huidig groot optioneel schema bevat Elias + Kim velden | `lib/ai/types.ts` | P1 | Discriminated persona sections of strict Juno subobject + sanitizers |

## 6. Memory architecture recommendation

### 6.1 Huidige architectuur

RecoFree gebruikt gedeelde lagen (`user.dat`, `state.dat`, `projections.dat`, `logs.dat`, buffer) met persona in de writecontext. De layerpaths zijn fysiek persona-gescheiden via `recofree_memory/{persona}/...`. Tegelijk gebruikt `UserProvider` één actief `Backpack`/`UserDat`-paar en is `Backpack.userType` immutable. `UserDat` zelf is een groot schema met gedeelde en persona-specifieke optionele velden; de persona wordt hoofdzakelijk uit Backpack/context afgeleid en niet door een verplichte `UserDat.persona`-discriminator.[5] [11]

### 6.2 Vereist Juno namespacecontract

```text
recofree_memory/juno/user.dat
recofree_memory/juno/state.dat
recofree_memory/juno/projections.dat
recofree_memory/juno/logs.dat
recofree_memory/juno/context.dat
recofree_logs_key_juno
```

**Plaatsingsadvies:** gebruik de bestaande persona-namespace, niet een los `juno.dat`. Persistente identiteit, intake, patronen en hypotheses horen in `recofree_memory/juno/user.dat`; actuele check-in/zone in `state.dat`; toekomstverwachtingen uitsluitend als hypothese in `projections.dat`; veilige sessiesamenvattingen in `logs.dat`; en de afgeleide promptcontext in `context.dat`. Dit volgt de bestaande architectuur en voorkomt een parallel opslagmodel.

| Datafamilie | Advies | Reden |
|---|---|---|
| `naam`, locale, consent, guidance depth | Shared mechanisme, opnieuw opslaan in Juno user context | Geen cross-persona objectreferenties |
| `userReportedClinicalFactors` over gebruiker | Reuse schema in Juno namespace | Aanpak aanpassen, nooit diagnose |
| Personal anchors/relation graph | Reuse schema met subject/role | Nodig voor twee-persoonscontext |
| Schemas/modes/contraindications/hints | Reuse schema, Juno-eigen analyse | Werkhypothesen, niet diagnoses |
| Elias recovery/relapse instances | Niet lezen | Data hoort bij Eliascontext |
| Kim caregiver instances | Niet lezen | Data hoort bij Kimcontext |
| Juno dual dynamics | Nieuwe velden | Niet uit individuele/caregiverarrays afleidbaar |

### 6.3 Minimale nieuwe Juno-memoryvelden

Het veiligste V1-contract is een expliciet `juno`-subobject of een gediscrimineerde `JunoUserDat`. Minimaal vereist:

- `junoIntake`;
- `junoState`;
- `junoCheckIns` en huidig `JunoMoodSliders`;
- `junoDynamicsProfile`;
- `junoStageMap`;
- `ownRecoveryPatterns` en `ownRelapsePathways`;
- `junoRelationalRecoveryPatterns`;
- `junoMutualTriggerLoops`;
- `junoSharedRelapseRisk`;
- `junoRescueControlLoops`;
- `junoRecoverySupportPatterns`;
- `relationshipRecoveryRisks`;
- `stageGapDynamics`;
- `contactSafetyPatterns`;
- `junoContraindications` en `junoSafeFormulationHints`;
- provenance per claim: subject, source, confidence, evidence hash/snippet, first/last seen;
- voor informatie over de ander: `attribution='user_reported_about_other'`, nooit `clinical_fact`.

## 7. Intake recommendation

### 7.1 Huidige bewezen intake

`app/intake.tsx` verzamelt land/taal, gebruikersnaam, persona, urgentie en daarna voor Elias de eigen Stage of Change of voor Kim het Eigen Regie level. `startEmotion` en `initialContext` bestaan in het contract maar worden in de actuele intake op lege strings gezet; zij worden dus niet door deze UI verzameld. `completeIntake` maakt met `createNewBackpack` en `createNewUserDat` de lokale stores; `userType` wordt daarna immutable.

### 7.2 Vereist Juno intakecontract

| Veld | Status | Semantiek/guard |
|---|---|---|
| `userName` | Reuse | Naam van gebruiker |
| `userStageOfChange` | Reuse Elias enum | Eigen self-report/context |
| `otherPersonName` | **REQUIRED_NEW_FIELD** | Alleen naam/alias die gebruiker opgeeft |
| `otherPersonRelationshipType` | **REQUIRED_NEW_FIELD** | partner/ex-partner/housemate/family/other |
| `otherPersonStageOfChangeEstimated` | **REQUIRED_NEW_FIELD** | Altijd user-estimated, nooit klinische waarheid |
| `otherPersonStageCertainty` | **REQUIRED_NEW_FIELD** | Zekerheid van de gebruikersinschatting; nooit diagnostische confidence |
| `otherStageSource` | **REQUIRED_NEW_FIELD** | Vast: `user_estimated` in V1 |
| `otherPersonUseRecoveryStatus` | **REQUIRED_NEW_FIELD** | `uses`, `in_recovery`, `unknown` als user-reported context |
| `bothInRecovery` | **REQUIRED_NEW_FIELD** | Context, geen garantie over ander |
| `currentContactSafety` | **REQUIRED_NEW_FIELD** | Geen diagnose; activeert safety routing |
| `sharedUseContext` | **REQUIRED_NEW_FIELD** | Samen gebruiken/toegang/omgeving |
| `ownAddictionRecoveryHistory` | **REQUIRED_NEW_FIELD** | Eigen geschiedenis en huidige status; alleen gebruiker als subject |
| `ownMainRecoveryRisks` | **REQUIRED_NEW_FIELD** | Eigen risico’s; geen afleiding uit gedrag van ander |
| `otherImpactOnOwnRecovery` | **REQUIRED_NEW_FIELD** | User-reported effect van ander op eigen herstel |
| `ownImpactOnOtherDynamic` | **REQUIRED_NEW_FIELD** | Reflectieve self-report, nooit schuld- of causaliteitsclaim |
| `startEmotion`, `urgency`, `initialContext` | Reuse | Persona-neutrale velden met Juno-copy |

**Harde regel:** de Stage of Change van de andere persoon mag alleen de gesprekstaal en voorzichtigheid aanpassen. Zij mag niet zelfstandig een interventie, diagnose of uitspraak over bereidheid van de andere persoon bewijzen.

## 8. Slider/state recommendation

### 8.1 Huidige structuur

De slider UI is config-driven via `getSliderConfig(userType)`. De sliders worden opgeslagen in `UserDat.currentMood`, de historie in `moodHistory`, en beïnvloeden lokale distress/resilience, moduleprioriteit, zone en promptcontext. De huidige union en UI zijn binair.

### 8.2 Voorgestelde Juno-sliders

| Slider | Type | Betekenis | Routingimpact |
|---|---|---|---|
| `ownRecoveryRisk` | 0–10 | Eigen craving/relapse/instabiliteit | Hoog: `own_recovery_first`; full bij high sensitivity |
| `triggeredByOther` | 0–10 | Hoe sterk gedrag/gebruik van ander triggert | J02/J03 of stabilisatie |
| `myImpactOnDynamic` | 0–10 | Eigen ervaren aandeel/impact, zonder schuldclaim | J05 reflectie; nooit causaliteit als feit |
| `rescueControlUrge` | 0–10 | Drang om te redden/controleren/monitoren | J03 agency/boundaries |
| `mutualDysregulation` | 0–10 | Ervaren wederzijdse escalatie | `dual_stabilisation` vóór gesprek/repair |
| `recoveryProtection` | 0–10, positief/inverted | Bescherming van eigen herstel | Lage waarde verhoogt safetyprioriteit |

### 8.3 Nieuwe zonecalculator vereist

Juno mag niet simpelweg Elias VSP of Kim Eigen Regie mappen. Een aparte calculator moet minimaal twee assen behouden:

1. **Own Recovery Safety Axis** — craving, relapse, withdrawal/medical, acute crisis, recovery protection.
2. **Relational Dynamics Axis** — triggering, mutual dysregulation, rescue/control, relational harm, positive support.

De zichtbare zone mag een dominante kleur tonen, maar debug moet beide assen behouden. Voorgestelde prioriteit:

```text
PAARS: acute crisis, medical/withdrawal uncertainty, shared use with immediate danger
ROOD: own relapse imminent, severe mutual dysregulation, active relational danger
ORANJE: high own recovery risk or destabilizing rescue/control loop
GEEL: elevated triggering/stage mismatch/relationship strain
GROEN: stable own recovery and no active harmful dynamic
```

**Besluit nodig:** zes sliders passen technisch in het bestaande config-driven patroon, maar zijn zwaar voor één mobiel scherm. Aanbevolen default is **alle zes behouden en verdelen over twee compacte stappen**, “Mijn herstel” en “Onze dynamiek”. Hiervoor zijn nieuwe statevelden, UI-config, dual-axis zonecalculator, promptblok, debugvelden en releasegatetests vereist.

### 8.4 Vereist Juno statecontract

| Stateveld | Type/range | Betekenis | Persistence |
|---|---|---|---|
| `ownCraving` | 0–10 | Huidige eigen craving | `juno/state.dat`; geen projectie |
| `ownRelapseRisk` | 0–10 | Huidige eigen hervalkans volgens self-report/clientengine | `juno/state.dat` |
| `otherPersonImpact` | 0–10 | Ervaren impact van de andere persoon op eigen herstel | `juno/state.dat`; bron `user_reported` |
| `relationshipTension` | 0–10 | Huidige relationele spanning | `juno/state.dat` |
| `relationshipSupport` | 0–10 | Huidige ervaren steun voor herstel | `juno/state.dat` |
| `mutualDysregulation` | 0–10 | Ervaren wederzijdse escalatie | `juno/state.dat` |
| `sharedUseRisk` | 0–10/afgeleid | Beschikbaarheid, samen gebruiken of wederzijdse trigger | `juno/state.dat`; raw partnerclaim verboden |
| `contactSafetyState` | enum | veilig/onzeker/onveilig/unknown | `juno/state.dat`; safety-first |
| `junoZone` | Juno enum | Afgeleide presentatie-/routingzone | Afgeleid; debugbaar |
| `zoneReason` | enum/string | Exacte dominante reden | Afgeleid; geen dossierdump |

## 9. Module architecture recommendation

Juno heeft een eigen catalogus, prefix en router nodig. Bestaande Elias/Kim modules kunnen intern skills/helpers leveren, maar mogen niet als dominante Juno module-ID verschijnen.

| ID | Werknaam | Verantwoordelijkheid | Belangrijkste guard |
|---|---|---|---|
| `J01` | Own Recovery First | Eigen craving, relapse, medische/safetyprioriteit | Blokkeert repair/rescue zolang eigen safety instabiel is |
| `J02` | Triggered by the Other | Reactie op gebruik/gedrag van ander stabiliseren | Geen diagnose of mindreading over ander |
| `J03` | Rescue/Control Loop | Reddings-, controle- en monitoringslus doorbreken | Agency zonder schuld; geen Kim-caregiveridentiteit |
| `J04` | Together Strong or Together Vulnerable | Wederzijdse steun én wederzijdse ontregeling beoordelen | Geen verantwoordelijkheid voor elkaars herstel overnemen |
| `J05` | Shared Relapse Risk | Gedeeld gebruik, beschikbaarheid of wederzijdse hervaltrigger | Safety vóór verbinding; geen relationeel gesprek bij acuut risico |

**Gereserveerd voor later:** `J06` Grenzen zonder verlating, `J07` Herstelafspraken tussen twee mensen, `J08` Schaamte na wederzijdse ontregeling, `J09` Contactpauze als terugvalpreventie en `J10` Verbinding na stabilisatie. Deze IDs mogen in V1 niet routeerbaar zijn.

**Default:** `J01` wanneer safety onzeker is. Een neutrale no-matchroute mag niet stil naar Elias/Kim of een gereserveerde module vallen; de precieze stabiele default moet Kris vóór implementatie bevestigen.

## 10. Routing priority recommendation

De aanbevolen uitvoering is een aparte `lib/engine/juno/juno-router.ts`, aangeroepen vanuit een exhaustieve persona-orchestrator. Geen serverrouter en geen samenvoeging van Elias/Kim modulemaps. De bestaande epistemic router kan als capaciteitsmechanisme worden hergebruikt, maar niet zonder nieuwe Juno-signalen en reasons.[4] [6]

| Prioriteit | Signaal | Route/resultaat |
|---:|---|---|
| 1 | Acute crisis, suicide/self-harm, medical/withdrawal uncertainty | Safety override + full model; relationele interventies geblokkeerd |
| 2 | Eigen craving/relapse imminent | `J01`, `own_recovery_first` |
| 3 | Shared use/shared relapse risk | `J05`, `shared_relapse_safety`, PAARS/ROOD afhankelijk van immediacy |
| 4 | Severe mutual dysregulation | `J04` in `dual_stabilisation` mode; geen repairgesprek |
| 5 | Rescue/control loop | `J03` |
| 6 | Triggered by other | `J02` |
| 7 | User impact on other/dynamic | Juno-reflectie binnen J04 of een niet-modulegebonden formulationlaag; nooit schuld als feit |
| 8 | Positive mutual recovery support | `J04` |
| 9 | Reflective relational check/stage gap | Alleen na safety gate; gereserveerde toekomstige repairmodule niet in V1 activeren |
| 10 | Geen match | Fail-closed default volgens vooraf gekozen J01/neutrale-regel |

Modelreasonlabels moeten minimaal onderscheiden: `acute_crisis`, `medical_safety`, `own_relapse_risk`, `shared_relapse_risk`, `dual_dysregulation`, `relational_safety`, `high_clinical_sensitivity`, `light_context`. Full-modelcapaciteit is vereist voor de eerste zeven indien complexiteit/safety dat vraagt; het reasonlabel mag nooit alles als `crisis_active` presenteren.

### Safety and model-reason recommendation

Juno mag **geen klassieke ROOD-betekenis rechtstreeks erven**. Aanbevolen is een nieuwe Juno-zonecalculator met afzonderlijke assen voor eigen herstelrisico, gedeeld hervalrisico, relationele ontregeling en acute safety. De zichtbare zonekleuren/namen zijn een productbeslissing; intern moeten de assen gescheiden blijven.

| Safety/modelsignal | Modelcapaciteit | Redenlabel | Dominante route |
|---|---|---|---|
| Acute crisis/self-harm/geweld | Full | `crisis_active` | Safety override; relationele modules blokkeren |
| Withdrawal/medische onzekerheid | Full | `medical_safety` | J01/safety presentation |
| Eigen imminent relapse | Full | `own_relapse_risk` | J01 |
| Shared use/immediate availability | Full | `shared_relapse_safety` | J05 |
| Ernstige wederzijdse ontregeling | Full | `dual_stabilisation` | J04 stabilisation mode |
| Onveilige contactcontext | Full | `contact_safety` | Safety-first; geen repairdruk |
| Trauma-related explicit context | Full indien hooggevoelig | `trauma_sensitive` | Alleen user-reported context; geen diagnose |
| Relationele schade zonder acute crisis | Full indien complex | `relational_safety` | J02/J04 na safety gate |
| Complexe niet-acute formulation | Full | `high_clinical_sensitivity` | Juno-module volgens priority |
| Lichte stabiele reflectie | Mini | `light_context` | Stabiele Juno-default |

Model, `ModelRoute`, Cost en visible reason moeten dezelfde clientrouterbron gebruiken. Een bestaande Elias/Kim `crisis_active`-shortcut mag niet op algemene Juno-spanning worden toegepast.

## 11. Prompt reuse recommendation

### 11.1 Nieuwe bestanden/injectiepunten

- `lib/ai/prompt/juno-prompt-composer.ts` — Juno identity, stance en sections;
- `lib/engine/juno/prompt-block.ts` — Juno safety- en rolcontract;
- `ClientPromptBuildInput.persona` uitbreiden met `juno`;
- `junoFormulationBlock`, `junoStateContext`, `junoPlanContext` expliciet toevoegen;
- `persona-prompt-composer.ts` herschrijven als exhaustieve switch zonder Elias-fallthrough;
- `client-system-prompt-builder.ts` injecteert shared blokken en Juno-blokken met include/omit-debug;
- `response-post-check.ts` krijgt Juno-specifieke verboden patronen en fallback.

### 11.2 Verplicht Juno-contract

> Juno ondersteunt een gebruiker die zelf in herstel is én in een relatie/dynamiek staat met iemand die mogelijk ook een verslavingsprobleem heeft. Juno beschermt eerst de eigen recovery en veiligheid van de gebruiker. Juno adviseert nooit redden, controleren, monitoren, behandelen of verantwoordelijkheid overnemen. Juno demoniseert de andere persoon niet, stelt geen diagnose en presenteert diens motivatie, Stage of Change of mentale toestand nooit als feit. Relatieherstel wordt alleen besproken wanneer eigen recovery, medische safety, acute regulatie en shared-use-risk voldoende stabiel zijn. Wederzijdse verantwoordelijkheid wordt erkend zonder schuldtoewijzing.

Shared herbruikbare promptblokken zijn `CONTEXT_AWARE_APPLICATION_CONTRACT`, personal anchors, schema/mode-hypothesen, contraindications, safe formulation hints en user-reported clinical factors over de gebruiker. Niet herbruikbaar zijn Elias identity/recovery narrator, Kim caregiver stance, Elias relapse instances en Kim caregiver pattern instances.

| Promptlaag | Huidige bron | Juno-hergebruik |
|---|---|---|
| Elias identity | `lib/ai/prompt/elias-prompt-composer.ts` | **DO_NOT_REUSE** |
| Kim core identity/stance | `lib/ai/prompt/kim-prompt-composer.ts` | **DO_NOT_REUSE** |
| Shared context application | client system promptbuilder | **MAY_REUSE_FOR_JUNO** |
| Crisis/medical safety | shared epistemic/safetyblokken | **MAY_REUSE_WITH_GUARD**; own recovery eerst |
| Clinical factors | shared formatted summary | **MAY_REUSE_WITH_GUARD**; ander alleen attributed user-report |
| Schema/mode/ClinicalCtx | `buildPersonalClinicalContext` | **MAY_REUSE_WITH_GUARD**; Juno-persona en subjectfilter vereist |
| Moduleprompt | persona composer/modulecatalogus | **JUNO_SPECIFIC**; alleen J-prefix |
| Forbidden language/post-check | persona post-checks | Shared mechanism, nieuw Juno-contract vereist |

De Juno identity/stance hoort in `lib/ai/prompt/juno-prompt-composer.ts`, wordt gekozen door een exhaustieve persona-switch en wordt daarna door `client-system-prompt-builder.ts` gecombineerd met uitsluitend goedgekeurde shared contextblokken. Vereiste tests zijn prompt snapshots voor Juno identity, ontbreken van Elias/Kim identityfragmenten, own-recovery-first, geen rescue/monitoring/diagnose, subject/provenancefiltering en veilige post-checkfallback.[7] [12]

## 12. DeepAnalysis recommendation

### 12.1 Huidig pad

`lib/backpack-extractor/section-analysis-service.ts` bouwt per sectie een client-side minimal-proxyprompt, valideert met `validateAndBuildResult`, mergeert via `mergeAnalysisToUserDat` naar versleutelde persistence en gebruikt section hashes/force-reanalysis. Persona-specifieke arrays worden vandaag alleen voor Elias of Kim toegelaten. ClinicalCtx leest daarna de persisted snapshot.[8] [12]

| Onderdeel | Huidige concrete werking | Juno-gat |
|---|---|---|
| Elias section discovery | `manual-data-refresh.ts` analyseert gevulde `backpack.sections`; VSP is onderdeel van dezelfde lijst | Geen Juno section map |
| Kim section discovery | `manual-data-refresh.ts` analyseert gevulde `kimBackpack` entries als `kim_<key>`; hashlaag kent `my_story`, `the_relationship`, `the_impact`, `my_boundaries`, `my_strength` | Geen dual-recovery sections |
| Intake context | Hashlaag kent `intake_context` wanneer gevuld | Juno dual-intake/provenance niet representeerbaar |
| Output schema | `BackpackSectionAnalysisResult` bevat shared velden plus Elias-only recovery en Kim-only caregiver arrays | Union is binair; Juno-fields ontbreken |
| Validatie | `validateAndBuildResult` normaliseert output en koppelt `sectionId`/hash/persona | Juno moet expliciet gevalideerd worden; geen defaultbranch |
| Merge | `mergeAnalysisToUserDat` bewaart shared velden en filtert Elias/Kim-only arrays | Juno-subobject en subjectguard ontbreken |
| Hash/force | Section hash skip; force bij ontbrekende geldige schemas/modes | Mechanisme herbruikbaar met eigen Juno hashes |
| ClinicalCtx | Leest persisted canonical `user.dat` en bouwt persona-aware samenvatting | Juno formatter/allowlist ontbreekt |
| Debug | Manual refresh en dropdown tonen run/stored totals en failures | Juno counts/sources/reasons ontbreken |
| Tests | Section analysis, full-device ClinicalCtx, device coherence en field-contracttests | Geen Juno producer→merge→ClinicalCtx matrix |

### 12.2 Herbruikbare velden

| Veld | Juno-status | Guard |
|---|---|---|
| schemas/modes | Reuse | hypotheses; subject=user unless explicitly relational loop |
| triggers | Reuse | onderscheid own trigger, other-reported behavior en mutual loop |
| protective factors/values/goals/risks | Reuse | subject/provenance verplicht |
| personal anchors/relation graph/life status | Reuse | explicitness/deceased safety behouden |
| developmental formulation/trigger chains | Reuse guarded | geen partnerdiagnose of causaliteitsclaim |
| contraindications/hints | Reuse | vóór formulation hints prioriteren |
| userReportedClinicalFactors | Reuse guarded | gebruikerfactor; ander alleen user-attributed context |
| Elias relapse/function arrays | Schema guarded herbruikbaar | nieuwe Juno-eigen data, nooit Elias-memory lezen |
| Kim caregiver arrays | Niet hergebruiken | semantisch verkeerde persona |

### 12.3 Nieuwe Juno DeepAnalysisvelden

- `relationalRecoveryPatterns`;
- `mutualTriggerLoops`;
- `sharedRelapseRisk`;
- `rescueControlLoops`;
- `recoverySupportPatterns`;
- `relationshipRecoveryRisks`;
- `stageGapDynamics`;
- `contactSafetyPatterns`;
- optioneel `traumaRelatedRelationalPatterns` **alleen na productbeslissing**.

Ieder item vereist `subject`, `isHypothesis`, `confidence`, `sourceEvidence`, `sourceSectionId`, timestamps en waar relevant `attribution`. Het model mag nooit een diagnose of Stage of Change van de andere persoon genereren als clinical truth.

## 13. Feature flag recommendation

Juno moet eerst verborgen zijn. Omdat RecoFree productiearchitectuurflags version-controlled en fail-closed zijn, is de veiligste uitbreiding:

```ts
junoPersona: false
```

in `CLIENT_FIRST_ARCHITECTURE`, met een test-only override naar `EXPO_PUBLIC_ENABLE_JUNO_PERSONA`. Productie mag Juno pas op `true` zetten nadat de Juno releasegate volledig groen is. UI en deeplinks moeten dezelfde resolver gebruiken; geen losse `process.env`-check in intake of tabs.[1]

| Optie | Beoordeling | Risico |
|---|---|---|
| A. Verborgen achter `EXPO_PUBLIC_ENABLE_JUNO_PERSONA=false` | **AANBEVOLEN** | Laagst; gefaseerde contract- en devicevalidatie mogelijk |
| B. Meteen zichtbaar | **AFGERADEN** | Onveilige partial routing/memory/promptbranches kunnen bereikbaar worden |
| C. Internal-only | **MOGELIJK als tussenfase** | Vereist nog steeds dezelfde fail-closed routeguards en tests |

De actuele intake kent persona switching alleen tijdens onboarding; na `intakeCompleted` is `userType` immutable. Een toekomstige Juno-entry moet daarom in de onboardingselector en alle routeguards dezelfde centrale featureflag gebruiken. Er is vandaag geen bewezen verborgen Juno/devmodus.

## 14. Test/release-gate recommendation

### 14.0 Huidige dekking en gaten

| Categorie | Huidige status | Juno-gat |
|---|---|---|
| Persona separation | **PARTIAL** — uitgebreide Elias/Kim tests, maar geen derde persona | Exhaustieve Juno-switch en drie-namespace-leakscan |
| Prompt blocks/post-check | **PASS voor Elias/Kim** | Juno identity, forbidden language en no-concatenation ontbreken |
| Safety/modelrouting | **PASS voor Elias/Kim** | Own/shared recovery, dual dysregulation en Juno reasons ontbreken |
| ClinicalCtx/CMD | **PASS voor Elias/Kim** | Juno memory allowlist, subjectfilter en zero-selection reasons ontbreken |
| DeepAnalysis | **PASS voor binaire schema’s** | Juno section map/output/merge/contextmatrix ontbreekt |
| Memory | **PASS voor bestaande namespaces** | Geen expliciete drie-persona namespace-/migrationtest |
| Module routing | **PASS voor E/K** | J-prefix allowlist, unknown-ID fail-closed en J01–J05 matrix ontbreken |
| `no-manus.space`/`store:false` | **PASS** | Moet ongewijzigd blijven wanneer Juno wordt toegevoegd |
| Wide-range/stateful matrix | **PASS voor zes Elias/Kim-scenario’s** | Aparte Juno matrix en Elias/Kim non-regression vereist |

### 14.1 Minimaal vereiste tests vóór activatie

| # | Verplichte categorie |
|---:|---|
| 1 | Juno is onzichtbaar en niet routeerbaar zolang flag uit staat |
| 2 | Intake bewaart eigen naam en eigen Stage of Change |
| 3 | Intake bewaart naam/relatie van ander en geschatte Stage of Change |
| 4 | Andere Stage of Change blijft `user_estimated` en nooit clinical truth |
| 5 | Own craving + gebruik van ander → `own_recovery_first` |
| 6 | Shared use → `shared_relapse_safety` en PAARS/ROOD volgens severity |
| 7 | Rescue/control loop → J03 |
| 8 | Mutual dysregulation → stabilisatie vóór repair |
| 9 | Positieve mutual support → J04 |
| 10 | Eigen impact wordt erkend zonder schuldclaim |
| 11 | Juno adviseert nooit rescue/monitoring/treatment of the other |
| 12 | Juno diagnosticeert de ander nooit |
| 13 | Relation repair krijgt nooit voorrang op own recovery safety |
| 14 | `recofree_memory/juno/*` is geïsoleerd van Elias/Kim |
| 15 | Volledige Elias-regressies blijven groen |
| 16 | Volledige Kim-regressies blijven groen |
| 17 | Iedere OpenAI-call blijft `store:false` via minimal proxy |
| 18 | Geen server/backendwijziging voor Juno klinische logica |
| 19 | Androidbundle bevat geen `manus.space`, legacy AI-route of cross-personamodule |
| 20 | Releasegate bevat aparte Juno-categorie en persona-leakscan |

### 14.2 Extra aanbevolen matrices

- State-transition matrix voor alle zes sliders op grenswaarden;
- Routing-priority matrix met combinaties van own craving, shared use, harm, rescue en positive support;
- Prompt snapshotmatrix die Elias/Kim-fragmenten in Juno expliciet verbiedt;
- DeepAnalysis producer→validator→merge→ClinicalCtx contractmatrix;
- Export→wipe→import roundtrip met alle drie persona namespaces;
- Offline/fallbackmatrix met Juno-safe lokale fallback;
- Device acceptance voor update-install en clean install.

## 15. OPEN QUESTIONS FOR KRIS

### Q1

**decision needed:** Moet Juno in V1 trauma-related relational formulation ondersteunen?  
**options:** A. Niet in V1; B. alleen expliciet user-reported trauma context; C. volledige trauma-related relational patterns.  
**recommended default:** B — alleen expliciet user-reported context en safety-adaptatie; geen nieuw traumamodel in V1.  
**risk if unresolved:** Scope creep, onveilige causaliteitsclaims en partnerdiagnostiek.

### Q2

**decision needed:** Worden alle zes voorgestelde Juno-sliders behouden?  
**options:** A. Zes op één scherm; B. zes verdeeld over twee stappen; C. reduceren naar vier.  
**recommended default:** B — alle zes behouden, verdeeld over “Mijn herstel” en “Onze dynamiek”.  
**risk if unresolved:** UI-overbelasting bij A; klinisch informatieverlies bij C; geen stabiel zonecontract zonder definitieve set.

### Overige beslissingen

| Beslissing | Opties | Aanbevolen default | Risico indien open |
|---|---|---|---|
| Default Juno-module zonder match | J01 / J05 | J01 wanneer safety onzeker; anders J05 | Verkeerde persona- of repair-first fallback |
| Stage of Change van ander | Prompt-only / routergewicht | Prompt-only in V1 | Gebruikersinschatting wordt schijnwaarheid |
| Juno plan | Nieuw dual recovery plan / Elias VSP / Kim ERP | Nieuw plan | Semantische persona-menging |
| Meerdere persona’s per installatie | Immutable één persona / wisselbaar | Immutable één persona in V1 | Grote migratie- en lekrisico’s |
| Informatie over ander | Alleen user-report / inference | Alleen user-report | Diagnose/mindreading |

## 16. Blockers

| Prioriteit | Blocker | Waarom blocker | Vereiste resolutie vóór implementatie/activatie |
|---:|---|---|---|
| **P0** | `UserType` en `RecoFreePersona` zijn binair | Juno valt anders in onveilige bestaande branches | Typed derde persona door gehele keten |
| **P0** | Persona promptcomposer heeft Elias-fallthrough | Onbekende Juno kan Eliasidentiteit krijgen | Exhaustieve switch + fail-closed test |
| **P0** | Geen Juno memory namespace | Cross-persona leakage mogelijk | `recofree_memory/juno/*`, encryption, backup/restore |
| **P0** | Geen own-recovery-first Juno-router | Repair/rescue kan safety overschrijven | Priority router vóór modules/prompt |
| **P0** | Geen Juno prompt/stance/post-check | Naïeve Kim+Elias-mix is onveilig | Dedicated composer en forbidden-language checks |
| **P0** | Geen contract voor shared-use/medical/acute safety | Relatieadvies kan vóór stabilisatie komen | Juno safety axis + full-model reasonlabels |
| **P1** | Intake mist andere persoon en estimated-stage provenance | Kerncontext niet representabel | Nieuwe validated intakevelden |
| **P1** | Geen Juno sliders/zonecalculator | Routing heeft geen betrouwbare state | Definitieve sliders + dual-axis zone |
| **P1** | Geen J01–J05 registry/router | Modulelekkage/fallbackrisico | Eigen catalogus en allowlist |
| **P1** | Geen Juno DeepAnalysis schema/merge | Canonical ClinicalCtx blijft arm of gemengd | Nieuwe fields + persona validator/merge |
| **P1** | Geen Juno debug/dropdowncontract | Fouten pas via APK-output zichtbaar | Counts/reasons/sources zonder raw data |
| **P1** | Geen Juno tests/releasegate | Geen veilige activatie | Minimaal 20 categorieën + matrices |
| **P2** | Zes-slider UI nog niet besloten | Ontwerp en zonecontract kunnen wijzigen | Q2 beslissen |
| **P2** | Trauma-scope nog niet besloten | DeepAnalysis/promptscope onzeker | Q1 beslissen |

### Geconsolideerde reusebeslismatrix

| Source persona | Component/dependency | Reuse decision | Guard needed | Action | Evidence |
|---|---|---|---|---|---|
| Shared | Minimal proxy + `store:false` | `MAY_REUSE_FOR_JUNO` | Persona-union uitbreiden; server generiek | Adapter/type-uitbreiding | `minimal-proxy-client.ts` |
| Shared | Encryption/export/import | `MAY_REUSE_WITH_GUARD` | Eigen Juno-namespace en roundtrip | Uitbreiden | memory/export stores |
| Shared | Epistemic modelrouter | `MAY_REUSE_WITH_GUARD` | Nieuwe Juno-signalen en reasons | Uitbreiden | `epistemic-model-routing.ts` |
| Shared | CMD-mechanisme | `MAY_REUSE_WITH_GUARD` | Juno allowlist en subjectfilter | Uitbreiden | CMD runtime/builders |
| Shared | DeepAnalysis framework | `MAY_REUSE_WITH_GUARD` | Juno section map/output/merge | Uitbreiden | section analysis service |
| Elias | Eigen craving/relapse detection | `MAY_REUSE_WITH_GUARD` | Alleen gebruiker als subject | Adapter | Elias relapse helpers |
| Elias | Cold turkey/medical safety | `MAY_REUSE_FOR_JUNO` | Safety vóór relatie | Reuse | epistemic safety |
| Elias | Recovery pattern schema | `MAY_REUSE_WITH_GUARD` | Nieuwe Juno-instanties | Adapter | `recoveryPatterns` |
| Elias | Elias identity/narrator | `DO_NOT_REUSE` | N.v.t. | Nieuw Juno contract | Elias composer |
| Kim | K03/K04 skillmechanismen | `MAY_REUSE_WITH_GUARD` | Geen caregiverframe | Adapter | Kim module engines |
| Kim | K05 repairmechanisme | `MAY_REUSE_WITH_GUARD` | Own-recovery-first en safety gate | Adapter | K05 engine/post-check |
| Kim | Caregiver burden/function/patterns | `DO_NOT_REUSE` | N.v.t. | Nieuwe relational-recovery fields | UserDat Kim fields |
| Kim | Kim core stance | `DO_NOT_REUSE` | N.v.t. | Nieuw Juno contract | Kim composer |
| Both | Personal anchors/contraindications/hints | `MAY_REUSE_WITH_GUARD` | Juno namespace/provenance | Reuse in Juno ClinicalCtx | pipeline ClinicalCtx |
| Both | `userReportedClinicalFactors` | `PARTIAL` | Gebruiker versus attributed-other subtype | Schema uitbreiden | `lib/ai/types.ts` |

## 17. Phased implementation proposal

Deze fasen zijn een auditadvies, geen uitgevoerde implementatie.

| Fase | Scope | Exitcriterium |
|---:|---|---|
| 0 | Kris beslist Q1, Q2, defaultmodule, Juno-plan en single-persona V1 | Beslissingen schriftelijk vastgelegd |
| 1 | Alleen types, flag en fail-closed persona switch; Juno blijft verborgen | Elias/Kim groen; onbekende persona kan niet naar Elias vallen |
| 2 | Juno intake, Backpack/UserDat, namespace, encryptie, export/import | Roundtrip en nul cross-persona leakage |
| 3 | Juno sliders, dual-axis zone, debugstate | Grenswaardematrix groen |
| 4 | J01–J05 catalogus, priority router, modelreasonlabels | Routingmatrix groen; own recovery altijd dominant |
| 5 | Juno formulation, promptcomposer, ClinicalCtx, CMD, post-check | Geen Elias/Kim identity/context leakage; safetycontract groen |
| 6 | Juno DeepAnalysis output/validation/merge | Producer→ClinicalCtx contractmatrix groen |
| 7 | Volledige tests, releasegate, Androidbundlescan en lokale stateful scenario’s | Alle gates groen; flag blijft uit |
| 8 | Interne/device pilot met flag aan | Device-evidence PASS; geen regressie Elias/Kim |
| 9 | Productieactivatie | Alleen na expliciete goedkeuring en rollbackplan |

## 18. Minimum safe implementation contract

Juno mag pas implementeerbaar worden verklaard wanneer minimaal aan alle onderstaande voorwaarden is voldaan:

1. Eigen persona-ID `juno` in alle relevante unions en exhaustieve switches.
2. Eigen local-first memorynamespace `recofree_memory/juno/*`.
3. Eigen `JunoIntake` met dual recovery context en provenance voor gegevens over de ander.
4. Eigen Juno-sliders en dual-axis zonecalculator.
5. Eigen modules `J01–J05`; `J06–J10` gereserveerd en niet routeerbaar.
6. Eigen deterministic routingprioriteit met own-recovery-first en shared-risk-safety.
7. Eigen Juno identity/stance en forbidden-languagecontract.
8. Geen automatische toegang tot Elias-memory of Kim-memory.
9. Geen diagnose of causaliteitsclaim over de andere persoon.
10. Eigen DeepAnalysis section map, outputvelden, validator en mergeguards.
11. Eigen ClinicalCtx/CMD allowlist en subject-/provenancefilter.
12. Eigen featureflag, standaard uit en centraal fail-closed.
13. Eigen debugcontract met persona, module, zone, reasons, CMD en memorybronnen.
14. Eigen releasegate en stateful Juno-matrix plus Elias/Kim non-regression.
15. Minimale Railwaytransportarchitectuur blijft ongewijzigd.
16. `store:false`, geen raw memory naar GPT en geen productie-`*.manus.space` blijven harde gates.

## Contradiction / missing-logic check

| Vraag | Antwoord |
|---|---|
| Codewijzigingen gemaakt? | **NO** — alleen rapport en verplichte TODO-registratie |
| Juno gecreëerd/geactiveerd? | **NO** |
| Elias/Kim gedrag gewijzigd? | **NO** |
| Backend/Railway/proxy gewijzigd? | **NO** |
| APK/EAS gestart? | **NO** |
| Huidige persona separation geverifieerd? | **PASS**, inclusief typed/runtime boundaries en binaire fallthroughrisico’s |
| Elias memory exact geïdentificeerd? | **PASS**, namespace plus actieve user.dat/Backpacknuance |
| Kim memory exact geïdentificeerd? | **PASS**, namespace plus Eigen-Regie/caregiverlagen |
| Eigen Juno-memorypad geïdentificeerd? | **PASS als ontwerpcontract**; implementatie bestaat niet |
| Elias mechanism versus identity onderscheiden? | **YES** |
| Kim mechanism versus identity onderscheiden? | **YES** |
| Naïeve Kim+Elias merge voorkomen? | **YES**, als P0-do-not-reuse en dedicated composer/router |
| Open productbeslissingen benoemd? | **YES**, zonder invulling als feit |
| Client-side klinische logica behouden? | **YES** |
| Minimale backendarchitectuur behouden? | **YES** |
| Feature flagging gedocumenteerd? | **YES**, option A aanbevolen |
| Nieuwe Juno DeepAnalysisvelden nodig? | **YES**, expliciet opgesomd |
| `userReportedClinicalFactors` veilig herbruikbaar? | **PARTIAL** — veilig voor gebruiker; attributed-other subconstruct vereist |
| Alle blockers vermeld? | **YES** |
| Gevraagd rapport geproduceerd? | **YES** |

Er is geen onopgeloste feitelijke contradictie in de auditbaseline. **Juno-implementatie blijft BLOCKED** totdat de P0-blockers en de expliciete productbeslissingen in Q1/Q2 en de overige beslissingstabel schriftelijk zijn opgelost.

## Eindstatus

| Status | Beoordeling |
|---|---|
| Architectuur technisch uitbreidbaar | **JA** |
| Juno vandaag compileerbaar/routeerbaar | **NEE** |
| Veilig als Elias+Kim-combinatie | **NEE** |
| Backendwijziging noodzakelijk | **NEE** |
| Nieuwe clienttypes/memory/router/prompt/tests noodzakelijk | **JA** |
| Implementatie mag starten zonder Q1/Q2/defaultbeslissingen | **NEE** |
| Aanbevolen eerstvolgende stap | Kris beslist open productvragen; daarna fase 1 met flag standaard uit |

## References

[1]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/config/client-first-architecture.ts "Client-first architecture configuration"
[2]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/server/_core/index.ts "Minimal Railway route registration"
[3]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/ai/types.ts "Persona, intake, Backpack and UserDat contracts"
[4]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/engine/orchestration.ts "Elias/Kim orchestration boundary"
[5]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/types/memory/memoryCore.types.ts "Persona memory namespaces and snapshots"
[6]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/engine/shared/epistemic-reasoning/epistemic-model-routing.ts "Client-side epistemic model routing"
[7]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/ai/prompt/persona-prompt-composer.ts "Binary persona prompt composition"
[8]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/backpack-extractor/section-analysis-service.ts "DeepAnalysis validation, merge and hash flow"
[9]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/app/intake.tsx "Current Elias/Kim intake branching"
[10]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/scripts/release-gate.sh "Release gate"
[11]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/user-context.tsx "User context initialization and persistence"
[12]: https://github.com/krismanderveld-blip/recofree-server/blob/80f93fa468c5b830af0f0cdf188fb1df396e735c/lib/rugzak/pipeline.ts "Client routing, CMD, ClinicalCtx and debug"
