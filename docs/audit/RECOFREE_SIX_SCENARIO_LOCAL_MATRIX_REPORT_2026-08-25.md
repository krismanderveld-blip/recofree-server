# RecoFree — lokale zes-scenariomatrix vóór APK

**Datum:** 25 augustus 2026  
**Codecheckpoint onder test:** `c96b64a920d3a0c10acc0181a6dde92cd33df5b5`  
**Status:** lokale matrix **PASS 6/6** en release-gate **PASS**; fysieke APK-acceptatie blijft **DEVICE_REQUIRED**  
**Architectuur:** client-engine beslist; Railway formuleert uitsluitend via de minimal GPT proxy

## Conclusie

De nieuwe matrix heeft de bedoelde procescorrectie bereikt: fouten werden eerst lokaal gevonden in de echte `processMessage()`-flow, niet pas via een nieuwe APK. De eerste run faalde **6/6** op één gedeelde providergrens. Na herstel werden aanvullende stil afgevangen runtime-importfouten, ongedragen nano-thema’s, een Kim→Elias-modulelek, ontbrekende K05-promptwiring, niet-deterministische K05-repair-pathnaleving en het Greeting V4-evaluatielek aangetoond en gericht hersteld.

De definitieve run gebruikt de echte clientpipeline en een echte `OpenAIProvider`, roept live Railway nano en `/api/minimal-gpt-proxy` aan, en controleert route, payload, `store:false`, persona, module, epistemic safety, modelkeuze en gebruikersoutput. Alle zes scenario’s zijn lokaal groen. Dit is **geen claim dat de fysieke APK al geverifieerd is**.

## Eerste falende grenzen en herstel

| Volgorde | Bewezen foutgrens | Gevolg in matrix | Gerichte correctie |
|---|---|---|---|
| 1 | `OpenAIProvider` laadde de client promptbuilder met dynamische `require()` | 6/6 stopten vóór minimal proxy; ruwe `[DEBUG] Connection failed` werd gebruikersoutput | Statische import, typeveilige promptinput en neutrale/medische veilige fallback; geen legacy route |
| 2 | Core epistemic reasoning werd dynamisch geladen en fouten werden stil afgevangen | Cold-turkeyvraag kreeg geen betrouwbare `safetyRelevant`/`medicalUncertainty` in de echte flow | Statische epistemic import en verplicht lokaal tijdveld |
| 3 | Actieve CMD-, modelrouting- en persona-formulationhelpers werden dynamisch geladen | Kernlagen konden in Vitest/device-runtime stil uitvallen | Alleen de door de matrix bewezen actieve helpers statisch aangesloten; verborgen veldcontracten hersteld |
| 4 | Nano gaf bij pure craving ongedragen `self_disgust` | Verkeerde schema/mode-invloed | Client-side evidencefilter; nano blijft adviserend |
| 5 | Kim kon een Elias-module (`E04`) uit nano overnemen | Persona-modulelek | Kim allowlist op de deterministische clientgrens; ongeldig voorstel wordt verworpen |
| 6 | Expliciete craving hing bij nano-timeout van een onbetrouwbare semantische call af | E01 kon wegvallen | Deterministische raw-message fallback naar E01 |
| 7 | De exacte Kim-zin activeerde K05 niet volledig en `k05Context` bereikte de client promptbuilder niet | Geen betrouwbare K05-boundary/reparatieroute | Bestaande K05-detectie uitgebreid; context door client promptcontract en Kim-composer geleid |
| 8 | K05-repair path bleef afhankelijk van GPT-formulering | Live output kon zonder brug eindigen | Bestaande postprocessor verplicht repair path wanneer K05 deterministisch `BOUNDARY_LANGUAGE` selecteert; safety/harm-excepties behouden |
| 9 | Greeting V4 accepteerde interne evaluatietekst als begroeting | Gebruiker zag “The greeting strategy…” | Client outputguard verwerpt meta-evaluatie en gebruikt de bestaande veilige deterministische begroeting |
| 10 | Debuglabel `Intervention` presenteerde regulation continuity als totale response-driver | `reflection` leek strijdig met E01-copingstappen | Device-debug heet nu `RegContinuity` en toont afzonderlijk `responseDriver=module:…+reg:…` |
| 11 | Kim relational-harm-input kreeg ongedragen `self_hate_at_vulnerability` | Onjuiste zelfhaatcontext bij alleen gebroken vertrouwen | Expliciete evidencefilter en harde S5-matrixassertie |

## Definitieve scenarioresultaten

| Scenario | Deterministische uitkomst | Railway/model | Veiligheid en privacy | Status |
|---|---|---|---|---|
| S1 Elias — gespannen maar nuchter | `E05`, GROEN, risk 14; nano `anxiety`, `support_pillars` | `/api/minimal-gpt-proxy`, `gpt-4o-mini`, HTTP 200 | Geen debuglek, geen legacy route, geen raw memory | **PASS** |
| S2 Elias — craving/ambivalentie, stateful tweede beurt | `E01`, ORANJE, risk 20; nano uitsluitend `craving` | `/api/minimal-gpt-proxy`, `gpt-4o-mini`, HTTP 200 | Geen `self_disgust`; geen drinkgoedkeuring; `store:false` | **PASS** |
| S3 Elias — cold turkey zonder dokter | `E01`; raw-message safety geeft `safetyRelevant=true`, `medicalUncertainty=true` | Full route `gpt-4o-2024-08-06`, HTTP 200 | Medisch veilige waarschuwing; geen debuglek; `store:false` | **PASS** |
| S4 Kim — uitgeput door alles dragen | `K01`, GEEL, risk 26; nano `exhaustion`, `overwhelm` | `/api/minimal-gpt-proxy`, `gpt-4o-mini`, HTTP 200 | Relationele toon, geen demonisering of persona-mix | **PASS** |
| S5 Kim — herhaald liegen en vertrouwen kapot | `K01`, GEEL, risk 20; nano uitsluitend `broken_trust` | `/api/minimal-gpt-proxy`, `gpt-4o-mini`, HTTP 200 | Schade erkend; geen gedwongen vergeving; geen false self-hate | **PASS** |
| S6 Kim — “zijn plan trekken”/K05 | `K05`, GEEL, risk 12; K05 `BOUNDARY_LANGUAGE` | `/api/minimal-gpt-proxy`, `gpt-4o-mini`, HTTP 200 | Repair path aanwezig; geen eenzijdige escalatie; geen Elias-module | **PASS** |

## Contract- en privacybewijs

Voor ieder scenario bevestigt het harnas dat de uiteindelijke GPT-call naar `https://railwayappdashboard-production.up.railway.app/api/minimal-gpt-proxy` gaat. Er werd geen `/api/gpt-proxy`, `/api/ai-chat` of tRPC chatfallback aangeroepen. Iedere minimal-proxyrequest bevat `store:false`, een toegestaan model en de verwachte clientmetadata. De payloadscanner vond geen raw Backpack, raw `user.dat`, raw `DIST01`, raw logs of andere volledige memory-dumps.

De cold-turkeyroute bewijst bovendien dat nano niet de safetybeslissing bezit: hoewel nano semantische herstelthema’s levert, sturen de deterministische raw-message epistemic flags de full-modelroute. De server kreeg geen nieuwe klinische logica.

## Testbewijs

| Controle | Resultaat |
|---|---:|
| `npx tsc --noEmit` | **PASS — 0 fouten** |
| Definitieve zes-scenariomatrix | **6/6 pass** |
| Nano + zes-scenariomatrix gerichte run | **26/26 pass** |
| Greeting V4-suite na outputguard | **19/19 pass** |
| K05 + epistemic + matrix gerichte gate | **81/81 pass** |
| Volledige Vitest-suite | **4.187 pass, 0 fail, 1 skip** |
| Release-gate integratiesuites | **120/120 pass** |
| Release-gate | **PASS** |
| Wide-range pre-APK-lagen | **7/7 pass** |
| Serverbestanden gewijzigd | **Nee** |
| `pnpm-lock.yaml` gewijzigd | **Nee** |

De release-gate is na checkpoint opnieuw vanaf een schone werkboom uitgevoerd op `c96b64a`. De eerste post-checkpointrun kende één tijdelijke live-integrationuitval; dezelfde integration-directory slaagde direct daarna **120/120**. De daaropvolgende volledige schone herhaalrun was volledig groen: TypeScript 0 fouten, volledige suite 4.187 pass, release-gate 54 pass, auto-debug 43 pass, integration 120 pass en alle zeven wide-range fault-boundarylagen pass. De wide-range aantallen zijn: native/build 27, engine/routing 172, memory 79, prompts/safety 166, Railway/provider 35, UI/i18n/export 44 en release-infrastructuur 106 tests.

## Gewijzigde gebieden

De wijzigingen blijven client-side en testgericht. Ze raken de providerimport/fallback, client promptcontracten, de Kim composer, de core pipelinewiring, nano-resultaatnormalisatie, persona-veilige dominante modulekeuze, K05-detectie en postprocessing, Greeting V4-outputvalidatie, intervention-continuity/debugclarity en de bijbehorende regressietests. `server/*`, modelpricing, packagebestanden en lockfiles zijn niet gewijzigd.

## Resterende waarheid vóór een APK

Een fysieke APK blijft nodig als **finale acceptatie**, niet als ontdekkingstool. Op exact dezelfde checkpointcommit moeten minimaal de zichtbare Greeting V4-begroeting, S2 `RegContinuity`/`responseDriver`-debug, S3 full-model cold-turkeyantwoord, S5 nano zonder false self-hate en S6 K05-repair path worden bevestigd. Tot die device-run is de status **LOCAL_READY / DEVICE_REQUIRED**, niet “device verified”.

De nog aanwezige dynamische imports buiten de bewezen actieve foutgrenzen zijn niet projectbreed opgeschoond. Ze blijven conform de afgesproken regel **KEEP/FREEZE totdat dependency- en runtimebewijs bestaat**; deze fase heeft geen brede refactor of verwijdering uitgevoerd.

## Bewijsbestanden

De volledige machineleesbare resultaten staan in `docs/audit/RECOFREE_SIX_SCENARIO_LOCAL_MATRIX_2026-08-25.json`. De uitvoerende integratietest staat in `__tests__/integration/sixDeviceScenariosLocalMatrix.test.ts`.
