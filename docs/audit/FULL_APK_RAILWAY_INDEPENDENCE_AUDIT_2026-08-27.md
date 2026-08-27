# RecoFree — volledige audit zelfstandige APK + minimale Railway

**Auteur:** Manus AI  
**Datum:** 2026-08-27  
**Scope:** read-only productaudit; alleen auditdocumentatie en `todo.md` zijn gewijzigd  
**Doelarchitectuur:** één APK; persistente data en deterministische klinische beslissingen client-side; Railway als enige backend met uitsluitend minimale, stateless GPT-proxyfunctionaliteit; OpenAI `store:false`; geen Manus-, WebDev-, Forge-, OAuth-, database- of storageafhankelijkheid.

## Eindconclusie

> **De huidige correct gebouwde APK gebruikt Railway als enige app-backend en bevat geen directe OpenAI- of Forgecall. Maar RecoFree voldoet nog niet volledig aan “alleen APK + minimale Railway”.**

Het specifieke Androidproductieartefact dat met alle vereiste flags is geëxporteerd, bevat de Railway-host en minimal-proxyroute, terwijl `/api/gpt-proxy`, `/api/trpc/ai.chat`, `api.openai.com`, Forge en Manus previewdomeinen ontbreken. De echte zes-scenariomatrix is 6/6 groen. Dit bewijst dat de huidige hoofdchatflow client-first en Railway-only kan werken.[1] [2]

De strikte onafhankelijkheidstoets faalt echter op vier releasegrenzen: de minimal-proxykeuze is niet fail-closed in version-controlled buildconfig; gevoelige clientstores worden via meerdere actieve paden plaintext geschreven; Railway exposeert onbeveiligde kostdragende endpoints en voert meerdere niet-minimale prompt-/analysefuncties uit; en de APK bevat nog callable Manus OAuth-URLs plus eigenaarmetadata. Daarnaast is een compatibele vervolgbuild buiten het huidige platform niet reproduceerbaar bewezen wegens ontbrekende signing-/EAS-overdracht.[1] [3] [4] [5]

| Beoordeling | Status |
|---|---|
| Huidige hoofdchat gebruikt native uitsluitend Railway | **PASS** |
| Directe OpenAI-call vanuit APK | **PASS — afwezig** |
| Forge/Manus previewhost in normale API-routing | **PASS — afwezig** |
| Manuswaarden volledig uit gecompileerde APK | **FAIL** |
| Railway is alleen health + generieke minimal proxy | **FAIL** |
| Alle persistente gevoelige data encrypted client-side | **FAIL** |
| Releaseconfig faalt gesloten naar minimal proxy/client-engine | **FAIL** |
| Railway misbruik-/kostenbescherming | **FAIL** |
| Volledige backup van alle actieve lokale clinical stores | **FAIL** |
| Onafhankelijk reproduceerbare, compatibel gesigneerde vervolg-APK | **NIET BEWEZEN** |
| Lokale tests/releasepoorten | **PASS** |
| Fysieke device-/netwerkacceptatie van dit artefact | **DEVICE_REQUIRED** |

## Wat aantoonbaar goed werkt

De native URL-resolver negeert geïnjecteerde API-hosts en retourneert voor Android/iOS altijd `https://railwayappdashboard-production.up.railway.app`. De lokaal gebouwde Androidbundle bevat geen directe OpenAIhost; OpenAI is uitsluitend een Railway-upstream. Bij de juiste buildflags is de legacy chatroute door dead-code elimination niet in de bundle aanwezig.[1] [6]

| Bewijs | Resultaat |
|---|---|
| TypeScript | 0 fouten |
| Volledige Vitest-suite | 187 bestanden pass, 1 skip; 4.187 tests pass, 1 skip |
| Echte zes-scenariomatrix | 6/6 pass via live Railway minimal proxy |
| Gerichte route/encryptie/exporttests | 83/83 pass |
| Release-gate | PASS |
| Wide-range gate | 7/7 lagen pass; build eligible, niet device verified |
| Railway-server zonder DB/OAuth/Forge-env | Start en health PASS |
| Android Hermes- en JS-export | PASS |

Alle twaalf productie-serverbestanden met directe OpenAIrequests bevatten `store: false`. De server kan opstarten en health/minimal proxy hosten zonder database-, OAuth- of Forgeconfiguratie. Database en OAuth zijn dus geen harde bootdependency voor de kernproxy.[1] [7]

## Externe domeinen en links

| Domein/link | In Androidbundle | Werkelijke rol | Classificatie |
|---|---:|---|---|
| `railwayappdashboard-production.up.railway.app` | Ja | Enige native API-host | **Actief en gewenst** |
| `api.openai.com` | Nee | Alleen Railway-serverupstream | **Actief server-side; gewenst via proxy** |
| `forge.manus*` | Nee | Oude serverhelpers zonder productcaller | **Legacy/template, niet actief bewezen** |
| `manus.space` / `manus.computer` | Nee | Preview-/sandboxhosts | **Afwezig uit APK** |
| `manus.im` | Ja | OAuth-portal in meegebundelde loginhelper | **Latent/callable; ongewenst** |
| `api.manus.im` | Ja | OAuth-server in meegebundelde loginhelper | **Latent/callable; ongewenst** |
| `localhost` / `127.0.0.1` | Ja | Webdevelopment en librarystrings; native resolver kiest Railway | **Development-only** |
| Expo/GitHub/documentatie-URLs | Ja | Frameworkmetadata/errorhelp; geen RecoFree-call bewezen | **Dependencytekst, niet als app-backend** |
| Gebruikersgestuurde `tel:`, `sms:` en hulpwebsites | Ja | Crisis-/hulpactie na expliciete tap | **Functioneel extern, geen backend** |

De gecompileerde bundle bevat niet alleen OAuth-URLs, maar ook de ingespoten Manus app-ID en ownergegevens. Geen normaal scherm roept `startOAuthLogin()` aan, maar de helper, waarden en callbackroute zijn wel meegebundeld. De bestaande gate mist dit omdat ze geselecteerde bronbestanden en onvolledige domeinpatronen scant, niet het echte Androidartefact.[1] [6]

## Gevonden fouten en risico’s

| ID | Bevinding | Prioriteit | Bewijsstatus | Gevolg |
|---|---|---:|---|---|
| F-01 | Minimal proxy is alleen actief als `EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY === 'true'`; anders volgt legacy GPT + tRPC fallback | **P0** | Code + bundleverschil bewezen | Een verkeerd opgebouwde APK schendt client-first/minimal-backend zonder hard buildfalen |
| F-02 | Vereiste CMD/epistemic/modelroutingflags staan niet version-controlled in `app.config.ts`/`eas.json` | **P0** | Config bewezen | Zelfstandige rebuild kan stil klinische/runtimefuncties uitschakelen |
| F-03 | `chat.tsx`, manual refresh en DeepAnalysis schrijven `user.dat`/backpack plaintext naar AsyncStorage | **P0** | Actieve writepaths bewezen | Gevoelige data kan plaintext op disk blijven, vooral na crash/kill |
| F-04 | Manual refresh stuurt de raw backpack naar GPT-extraction; DeepAnalysis/documentparse sturen ruwe sectie-/documenttekst | **P0** | Actieve callpaths bewezen | Schendt de huidige strikte no-raw-memory-naar-GPT grens; `store:false` verandert dat niet |
| F-05 | Railway GPT-/analyseroutes zijn publiek, zonder rate limit/API-clientauth; CORS reflecteert willekeurige origins; bodylimit 50 MB | **P0/P1** | Code + live CORS/routeprobe | Kostenmisbruik, overbelasting en beschikbaarheidsrisico |
| F-06 | Railway registreert veel meer dan health + minimal proxy | **P1 architecture** | Code + live exposure bewezen | Backend beslist/formuleert/analyseert buiten de toegestane minimale rol |
| F-07 | Clinical greeting doet tweede GPT-call met naam, greeting en promptfragment | **P1** | Actieve route bewezen | Extra kosten, gegevensoppervlak en risico op debugtekstlek |
| F-08 | Serverlogs/errorresponses kunnen naam, greeting en GPT-outputfragmenten bevatten | **P1 privacy** | Actieve codepaden bewezen | Persoonlijke of klinische data kan in Railwaylogs/errorbody terechtkomen |
| F-09 | Parallelle fire-and-forget backpackanalyses kunnen stale `userDat` terugschrijven | **P1 data-integriteit** | Racevorm bewezen; regressietest ontbreekt | Nieuwere extractie-/analysevelden kunnen worden teruggedraaid |
| F-10 | VSP Insight-profielen/events en losse KERP-store staan plaintext; VSP Insight ontbreekt in backup/export | **P1** | Store + adapter bewezen | Privacy- en herstelverlies na migratie/reset |
| F-11 | UK-crisistekstlijn `SHOUT to 85258` doet niets | **P1 safety** | Data + handlerbranch bewezen | Een zichtbare crisisactie is functioneel defect |
| F-12 | Signingkey en reproduceerbare onafhankelijke buildketen zijn niet overgedragen/bewezen | **P1 operational** | Repository/config bewezen | Geen gegarandeerde compatibele update-APK buiten huidig buildplatform |
| F-13 | Androidbundle bevat Manus OAuth-URLs en eigenaarmetadata | **P1 independence** | Echte JS-bundle bewezen | Strikte “geen Manus in APK”-eis faalt; latente externe login blijft callable |
| F-14 | Package ID en deep-linkscheme zijn `space.manus...` / `manus...` | **P2** | Expo public config bewezen | Geen netwerkcall, maar appidentiteit/eigendom blijft platformgebonden |
| F-15 | `/api/engine-process` en server-engineclient zijn gebundeld | **P3 latent** | Callgraph bewezen | Default is client-only en geen productiecaller wijzigt de mode; wel gevaarlijke migratiecode indien later geactiveerd |
| F-16 | Forge image/voice/data/storagehelpers blijven in serverbron | **P3 legacy/frozen** | Geen productcaller gevonden | Geen huidige afhankelijkheid bewezen; niet verwijderen zonder functie-evidence |

## Railway is momenteel niet “minimaal”

| Routegroep | Actief vanuit productflow | Waarom niet minimaal |
|---|---:|---|
| `/api/health` | Ja | Toegestane infrastructuur |
| `/api/minimal-gpt-proxy` | Ja | Toegestane generieke GPT-doorvoer met modelallowlist en `store:false` |
| `/api/nano-interpret` | Ja | Server bevat eigen prompt, parsing, retries en semantische mapping |
| `/api/session-greeting` | Ja | Server genereert greeting en clinical debugannotatie |
| `/api/pre-translate` | Voor niet-Nederlandse input | Aparte serverprompt/LLMfunctie |
| `/api/signal-engine` | Bij sessie-einde | Server-side signaalextractie |
| tRPC extraction/backpack/KERP | Ja voor refresh/planflows | Server-side prompt- en analysefuncties; tRPC/auth-templateoppervlak |
| backpack-/VSP-analyse en documentparse | Featureafhankelijk | Ruwe inhoud en server-side analyse/parsing |
| `/api/gpt-proxy` | Niet bij correcte buildflag | Publieke legacy eindchatroute blijft gemount |
| `/api/engine-process` | Nee; default client-only | Latente volledige serverengine blijft publiek gemount |
| OAuth/auth/database | Geen normale appflow | Templateoppervlak blijft gemount; geen bootdependency |
| `/api/debug/prompt` | Nee in production | Correct production-off |

De juiste eindarchitectuur hoeft nano, greeting of extraction niet functioneel te verliezen. De client kan de deterministische selectie en promptopbouw uitvoeren en uitsluitend een generiek, versiegebonden request naar dezelfde minimal proxy sturen. Railway valideert dan alleen transport, payloadschema, limieten, modelallowlist en `store:false`; het beslist geen persona, module, risk, memory of formulering.[3] [8]

## Lokale data en backup

| Dataset | Huidige primaire opslag | At-rest veilig | In export/import | Auditstatus |
|---|---|---:|---:|---|
| legacy `@recofree_userdat` | AsyncStorage + SessionMemoryCache | **Nee, niet op alle writepaths** | Ja | P0 |
| legacy backpack | AsyncStorage + encrypted helpers | **Nee, manual refresh schrijft plaintext** | Ja | P0 |
| persona user/state/projections `.dat` | Encrypted memory store | Ja | Ja | Pass |
| logs.dat | Eigen encrypted envelope | Ja | Ja | Pass |
| diary | Encrypted sensitive key | Ja | Ja | Pass |
| dagstructuurdocument/completion | Encrypted store | Ja | Ja | Pass |
| noodcontacten | Plain AsyncStorage | Nee | Ja | P1 privacy |
| VSP Insight profile/events/soothing | Plain AsyncStorage | Nee | **Nee** | P1 |
| KERP parallelstore | Plain AsyncStorage | Nee | Niet rechtstreeks; actueel plan staat ook in backpack | P1/P2 |
| contextDat/deep-analysis debug/caches | Gemengde AsyncStorage | Gemengd | Gedeeltelijk of rebuildable | P2 hardening |

De 83 gerichte encryptie-/exporttests zijn groen, maar testen de bekende adapterset. Zij detecteren niet dat actieve featurestores buiten die set vallen en niet dat andere productpaden encrypted keys later opnieuw plaintext overschrijven.[1] [9]

## Wat ontbreekt voor volledig zelfstandig gebruik

Onder “volledig zelfstandig” wordt hier verstaan: een gebruiker kan een gesigneerde APK installeren, alle lokale gegevens blijven privé en herstelbaar, alle netwerkverkeer is verklaard, en alleen een door de gebruiker beheerde Railwayservice plus OpenAI-upstream is nodig.

| Volgorde | Vereiste stap | Acceptatiebewijs |
|---:|---|---|
| 1 | Maak de architectuur **fail-closed**: minimal proxy, client engine, CMD en epistemic routing zijn version-controlled defaults; verwijder de legacy providerelsebranch uit productiebuild | Build zonder secrets bevat minimal route; legacy GPT/tRPC-chatstrings ontbreken; build faalt als vereiste config ontbreekt |
| 2 | Verwijder OAuth/ownerbuildvariabelen en `startOAuthLogin`/callback uit de native bundle | Bundle bevat 0 `manus.im`, 0 `api.manus.im`, 0 owner-ID/ownernaam en geen authroutes |
| 3 | Routeer iedere gevoelige store uitsluitend via encrypted storage; maak writes atomisch | Device-inspectie na chat, refresh, deep analysis, crash en restart toont alleen encrypted envelopes |
| 4 | Voeg VSP Insight, noodcontacten en alle actieve KERPdata toe aan encrypted backup/export | Export→wipe→import roundtrip herstelt elke actieve dataset per persona |
| 5 | Los de backpackanalyse-race op met één serialized transaction/reducer of compare-and-swap merge | Deterministische vertraagde paralleltest bewijst geen lost update |
| 6 | Reduceer Railway naar health + één generieke minimal proxy; verplaats promptopbouw, parsing en deterministische regels client-side | Routeinventory en live probes tonen alleen toegestane routes; backend bevat geen persona/module/risk/memorybeslissing |
| 7 | Vervang raw-backpack/documentcalls door lokale extractie of expliciet geminimaliseerde, geredigeerde velden | Payloadaudit bewijst geen raw Backpack/user.dat/DIST01/logs/birthdate/documentdump |
| 8 | Voeg Railway-misbruikbeveiliging toe zonder externe dienst: requestlimiet, payloadlimiet, originbeleid en per-installatie ondertekend token in SecureStore | Misbruik-, replay-, oversize- en quota-tests pass; normale APK-call blijft werken |
| 9 | Verwijder inhoud/PII uit Railwaylogs en foutresponses | Logcapture bevat alleen request-ID, route, status, timing, model en veilige foutcode |
| 10 | Herstel de UK SMS-crisisactie | Device- of Linking-test bewijst `sms:85258` met correcte tekstinstructie |
| 11 | Leg signing en build over: eigen EAS-project of reproduceerbare lokale Androidbuild, plus veilig geëxporteerde signing key | Onafhankelijke clean checkout bouwt een update-APK die over de bestaande installatie kan worden geïnstalleerd |
| 12 | Breid releasegate uit met echte Androidbundle- en routeoppervlakscan | Gate faalt op Manus/OAuth/ownerwaarden, legacyroutes, directe OpenAIhost, ontbrekende flags en onverwachte Railwayroutes |
| 13 | Beslis bewust over package-ID/scheme | Behouden voor updatecompatibiliteit óf gecontroleerde migratie naar eigen ID; nooit stil wijzigen |
| 14 | Voer finale fysieke netwerkaudit uit | Zes scenario’s + refresh + documentflow + offline/degraded flow; netwerklog toont alleen Railway en expliciet aangeklikte hulpacties |

## Aanbevolen herstelvolgorde

De eerste fixgroep moet uitsluitend de **P0-boundaries** aanpakken: fail-closed buildconfig, encrypted writes, no-raw-memorypayloads en Railway rate/auth/payloadbescherming. Dit zijn kleine, testbare grenzen en mogen niet gecombineerd worden met legacycleanup.

Daarna volgt de **minimalisatiegroep**: iedere actieve nano/greeting/extraction/documentfunctie één voor één client-build → generic proxy maken, met een end-to-endtest per migratie. Legacyroutes blijven tot bewijs als `KEEP/FREEZE/BLOCK`; pas verwijderen wanneer de bundle- en callgraphtests aantonen dat zij geen functie meer hebben.

De derde groep is **operationele onafhankelijkheid**: signingkey, eigen buildprocedure, backupcompleetheid en device-netwerkcapture. Alleen daarna kan RecoFree eerlijk `APK + Railway SELF-CONTAINED: PASS` krijgen.

## Testdekking versus resterende onzekerheid

| Bewijssoort | Wat bewezen is | Wat niet bewezen is |
|---|---|---|
| Unit/integratietests | Helpers, routingcontracten, persona/safety, encryptieadapter, exportset | Onbekende stores, fysieke at-rest toestand, echte concurrentietiming |
| Zes-scenariomatrix | Werkelijke clientpipeline + Railway minimal proxy voor zes kernscenario’s | Alle UI-features, documentflows, netwerkverlies tijdens writes |
| Server/no-envproef | DB/OAuth/Forge niet nodig voor boot/health | Alle gemounte routes blijven werken zonder die envs |
| Androidbundle-analyse | Werkelijke strings/routes/config in één correct geflagde bundle | OS-level networkcalls van frameworknative code |
| Live probes | Route-exposure en CORS | Belastbaarheid, misbruiklimieten, lange-termijnbeschikbaarheid |
| Device-test | Nog niet uitgevoerd voor deze audit | Signingupdate, SMSactie, encrypted disk, volledige netwerkcapture |

## Eindstatus

**Gevonden productfouten:** ja. **Manus als normale native API-backend:** nee. **Manus volledig uit de APK:** nee. **Railway momenteel minimale proxy-only:** nee. **Alle gevoelige data veilig client-side:** nee. **Zelfstandige compatibele vervolgbuild bewezen:** nee.

Daarom is de eerlijke eindstatus:

> **Huidige kernchat: lokaal groen en Railway-only. Volledige zelfstandigheid met uitsluitend APK + minimale Railway: FAIL, met concrete P0/P1-herstelpunten.**

## Referenties

[1]: ./evidence/APK_RAILWAY_AUDIT_EVIDENCE_2026-08-27.md "Audit evidence register"
[2]: ./RECOFREE_SIX_SCENARIO_LOCAL_MATRIX_REPORT_2026-08-25.md "Six-scenario local matrix"
[3]: ../../server/_core/index.ts "Railway server entrypoint"
[4]: ../../lib/crypto/session-memory-cache.ts "Encrypted client cache"
[5]: ../../app.config.ts "Expo app identity and Android configuration"
[6]: ../../constants/oauth.ts "Native URL resolver and bundled OAuth configuration"
[7]: ../../server/session-greeting.ts "Greeting and clinical annotation route"
[8]: ../../lib/ai/openai-provider.ts "Client provider and minimal proxy switch"
[9]: ../../lib/features/exportImport/hooks/useExportImportStores.ts "Export/import store adapter"
