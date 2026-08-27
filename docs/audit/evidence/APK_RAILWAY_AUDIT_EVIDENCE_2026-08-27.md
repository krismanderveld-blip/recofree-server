# APK + Railway independence audit — bewijsregister

**Datum:** 2026-08-27  
**Auditmodus:** read-only; geen productcode gewijzigd  
**Lokale bronbasis bij start:** checkpoint `2fe3606b`; de functionele code is dezelfde als de eerder gepushte en op Railway gevalideerde codecommit `16c7bd9`.

## Uitgevoerde controles

| Controle | Resultaat |
|---|---|
| `npx tsc --noEmit` | Exit 0; geen TypeScriptfouten |
| `npx vitest run` | 187 bestanden pass, 1 skip; 4.187 tests pass, 1 skip |
| Zes echte `processMessage()`-scenario’s via Railway | 6/6 pass; minimal proxy; `store:false`; geen legacyroute/raw-memorypayload |
| Release gate | PASS; 54 release-integratietests, 43 auto-debugtests en 120 integratietests pass |
| Wide-range pre-APK gate | 7/7 lagen pass; `APK BUILD ELIGIBLE: YES`; `DEVICE VERIFIED: NO` |
| Gerichte route/encryptie/exportregressies | 8 bestanden, 83 tests, 83 pass |
| Railway-serverbundle bouwen | PASS |
| Server opstarten zonder DB/OAuth/Forgevariabelen | PASS; `/api/health` antwoordt; OAuthconfigfout wordt gelogd maar blokkeert boot niet |
| Android Expo-export met productieflags | PASS als Hermesbundle en als leesbare JavaScriptbundle |
| Live Railway CORS-probe | Willekeurige Origin werd gereflecteerd; credentials toegestaan |
| Live route-exposureprobes met lege/ongeldige payloads | Brede routeoppervlakte bevestigd zonder OpenAI-call |

## Leesbare Androidbundle

De bundle is gebouwd met Railway als API-host en met minimal proxy, CMD, core epistemic engine, epistemic modelrouting en nano expliciet actief.

| Zoekterm | Aantal in gecompileerde JS | Duiding |
|---|---:|---|
| `railwayappdashboard-production.up.railway.app` | 3 | Actieve native API-host |
| `/api/minimal-gpt-proxy` | 3 | Actieve chatroute |
| `/api/gpt-proxy` | 0 | Legacy chatroute is bij correcte flag uit de bundle geëlimineerd |
| `/api/trpc/ai.chat` | 0 | Legacy chatfallback is bij correcte flag uit de bundle geëlimineerd |
| `api.openai.com` | 0 | Geen directe OpenAI-call vanuit APK |
| `forge.manus` | 0 | Geen Forgehost in APK |
| `manus.space` / `manus.computer` | 0 | Geen preview-/sandboxhost in APK |
| `https://manus.im` | 1 | Meegebundelde OAuth-portal |
| `https://api.manus.im` | 1 | Meegebundelde OAuth-server |
| eigenaarmetadata | aanwezig | Buildomgeving injecteert app-/ownergegevens in `constants/oauth.ts` |

De eerste Hermes-scan leverde schijnbare aaneengeplakte URL-fragmenten op door de stringtabel. Daarom is een tweede `--no-bytecode`-export gebruikt. Die leesbare bundle bevestigt dat de OAuth-URLs en eigenaarmetadata echte afzonderlijke waarden zijn.

## Gecompileerde app-routeoppervlakte

De leesbare Androidbundle bevat onder meer `/api/health`, `/api/minimal-gpt-proxy`, `/api/nano-interpret`, `/api/session-greeting`, `/api/pre-translate`, `/api/signal-engine`, backpack-/VSP-analyseroutes, documentparse, `/api/engine-process`, OAuth/authroutes en `/api/trpc`. Aanwezigheid in de bundle is niet voor elke route gelijk aan een actieve call; de callgraph bepaalt de classificatie.

## Railway-routeoppervlakte

Het productie-entrypoint registreert meer dan health + minimal proxy. Lege/ongeldige requests bevestigden live dat legacy GPT, nano, pre-translate, signal engine, backpack/VSP-analyse, documentparse en engine-process bereikbaar zijn. `/api/debug/prompt` gaf in productie correct 404.

De CORS-probe tegen `/api/minimal-gpt-proxy` met `Origin: https://untrusted.example` leverde:

```text
HTTP/2 200
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
access-control-allow-origin: https://untrusted.example
```

Er werd in de serverbron geen rate limiter, requestquota, API-clientauth of origin-allowlist gevonden. De globale JSON- en urlencoded-bodylimiet is 50 MB.

## Lokale opslag en backup

`SENSITIVE_KEYS` omvat legacy user.dat, backpack, diary, persona projections, extracted entities en VSP backpack profile. De memory user/state/projections stores gebruiken eveneens encrypted storage; logs.dat heeft een eigen encrypted envelope. Dagstructuurdocument en completion zijn in export/import expliciet encrypted.

Toch schrijven `chat.tsx`, manual refresh en DeepAnalysis dezelfde gevoelige kernkeys daarnaast rechtstreeks met `AsyncStorage.setItem()`. VSP Insight-profielen/events en de losse KERP-store gebruiken eveneens directe plaintext AsyncStorage. De exportadapter dekt VSP Insight niet af. Het actuele KERP-plan wordt door de UI daarnaast in de geëxporteerde backpack bewaard.

## Serverlogs en GPT-grenzen

Alle twaalf productie-serverbestanden met een directe `api.openai.com`-URL bevatten `store: false`. Dat beschermt niet tegen eigen Railwaylogging: meerdere routes loggen gebruikersnamen, begroetingfragmenten, OpenAI-errorbodies of onparseerbare GPT-outputfragmenten. `backpack-analysis` kan een raw GPT-fragment in een 502-response opnemen.

Clinical session greeting doet een tweede GPT-call met gebruikersnaam, begroeting en maximaal 800 tekens van de system prompt voor een debugannotatie. Manual refresh stuurt de raw backpack naar entity extraction. Dit zijn actieve niet-minimale gegevensstromen.

## Build- en distributieketen

Er is geen `android/`- of `ios/`-project, geen version-controlled EAS project-ID/ownerbinding en geen signingkeystore/credentialsbestand in de repository. De publieke Expo-config bevat package ID `space.manus...` en scheme `manus...`; er is geen Expo Updates-config. Een bestaande APK kan zelfstandig draaien, maar een compatibele vervolgbuild buiten het huidige buildplatform is niet bewezen zonder overdracht van de Android signing key en een eigen reproduceerbare buildprocedure.

