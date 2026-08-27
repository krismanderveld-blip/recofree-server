# RecoFree — zelfstandige APK + minimale Railway herstelrapport

**Datum:** 2026-08-27  
**Gedeployde codecommit:** `be035ee5fa6d9c6805b2471f6084fb9d9620a36d`  
**Validation/testcommit:** `048d81ed2e49700f9292052b2d857d5ce1c91cb2`  
**Productstatus:** `APK BUILD ELIGIBLE: YES`  
**Fysieke acceptatie:** `DEVICE VERIFIED: NO`

## 1. Uitgevoerde herstelgroepen

| Herstelgroep | Resultaat |
|---|---|
| P0 build- en privacygrenzen | Productiearchitectuur is fail-closed; gevoelige kernstores schrijven atomair en versleuteld; raw geheugen- en documentdump is uit GPT-payloads verwijderd. |
| Railway beveiligen en minimaliseren | Productie registreert alleen root/health, stateless clientsessie en minimal GPT proxy. Actieve GPT-functies bouwen hun prompt client-side en gebruiken hetzelfde generieke proxycontract. |
| Encrypted backup en signing/buildhandover | Actieve aanvullende stores zijn encrypted en aan export/import toegevoegd. Signinghandover is gedocumenteerd en heeft een signer-vergelijkingsscript; feitelijke keycontinuïteit vereist nog het private signingmateriaal of een bekende goede APK. |

## 2. Definitieve productiearchitectuur

De Androidclient houdt deterministische routing, safety, memoryselectie, persona, CMD, epistemic reasoning, modelkeuze en promptopbouw lokaal. Railway voert geen klinische beslissing uit. Het geregistreerde productieoppervlak is beperkt tot:

| Route | Functie | Publiek |
|---|---|---|
| `GET /api/health` | Niet-gevoelige healthcheck | Ja |
| `POST /api/client/session` | Kortlevende stateless clientsessie | Ja, rate-limited |
| `POST /api/minimal-gpt-proxy` | OpenAI transport voor client-built prompts | Alleen met geldige sessie-, timestamp- en nonceheaders |

Gespecialiseerde nano-, greeting-, pre-translate-, signal-engine-, extraction-, documentanalyse-, KERP-, tRPC-, OAuth-, debugprompt-, legacy GPT- en server-engine-routes zijn niet meer geregistreerd. De bestanden blijven waar nodig als frozen/legacy bron aanwezig; zij zijn niet productieroutable.

## 3. Native bundle en buildgrenzen

De echte leesbare Androidproductiebundle is opnieuw gebouwd en gescand. De scan vond geen actieve `manus.im`, CloudFront-logometadata, eigenaarmetadata, externe OAuth, directe OpenAI-URL, Forge-route, legacy `/api/gpt-proxy`, tRPC-AI-route, `/api/engine-process` of gespecialiseerde GPT-analyseroute. De bundle bevat als RecoFree-netwerkcontract alleen Railway, `/api/client/session` en `/api/minimal-gpt-proxy`.

De Android-package-ID bleef bewust ongewijzigd om updatecompatibiliteit niet stil te breken. De dual-ABI-config `armeabi-v7a` + `arm64-v8a` bleef behouden. De productieflags voor minimal proxy, CMD, core epistemic engine, epistemic modelrouting en nano staan version-controlled en fail-closed.

## 4. Privacy en lokale opslag

| Grens | Herstel |
|---|---|
| Kernstores | Directe plaintextwrites naar `user.dat` en Backpack zijn vervangen door één serialized encrypted mutatiepad. |
| Lost updates | Per-key mutatiequeues voorkomen dat parallelle chat-, extraction- en DeepAnalysis-merges elkaar overschrijven. |
| GPT-memory | Raw Backpack, raw `user.dat`, raw DIST01/logs en raw geboortedatum worden niet als GPT-payload opgebouwd. |
| Documenten | TXT/DOCX wordt lokaal gelezen. Raw PDF en legacy DOC worden niet meer naar Railway geüpload; unsupported formaten geven een expliciete lokale fout. |
| Analyse-invoer | Tekst wordt begrensd en PII-achtig materiaal wordt client-side geredigeerd, met dezelfde defense-in-depth op frozen serverhelpers. |
| Extra stores | Noodcontacten, VSP Insight, KERP-hulpdata en Eigen-Regie-notificatiegegevens gebruiken de canonical encrypted store. |

## 5. Railway-beveiliging

Railway gebruikt kortlevende stateless sessietokens, request-ID/nonces, timestamps, replaydetectie, payloadlimieten, routegebonden rate limiting en restrictief CORS. De shared client hernieuwt een verlopen/ongeldige sessie eenmaal en herhaalt requests met een nieuwe nonce. `store:false` blijft onderdeel van iedere minimal-proxyrequest en wordt server-side gevalideerd.

Live productieproeven op de gedeployde cutover bevestigden:

| Proef | Resultaat |
|---|---|
| Health | HTTP 200 |
| Clientsessie | HTTP 200, token aanwezig |
| Minimal proxy zonder sessie | HTTP 401, `CLIENT_SESSION_REQUIRED` |
| Contractongeldige request met sessie | HTTP 400, `VALIDATION_FAILED` |
| Zelfde nonce opnieuw | HTTP 409, `STALE_OR_REPLAYED_REQUEST` |
| Onbekende browser-origin | HTTP 403 |
| Oude `/api/signal-engine` met geldige sessie | HTTP 404, `ROUTE_NOT_AVAILABLE` |

> De publieke sessiebootstrap is misbruikbeperking, geen cryptografisch bewijs dat de caller een echte APK is. Voor een hogere beveiligingsklasse blijft platformattestatie, zoals Play Integrity of App Attest, een afzonderlijke P1-hardening. In-memory rate limiting veronderstelt bovendien één Railwayinstance; meerdere replica’s vereisen een gedeelde limiter.

## 6. Encrypted export/import

Het backwards-compatible backupcontract omvat nu naast de bestaande canonieke persona- en memorylagen ook VSP Insight en Eigen-Regie-hulpdata. Het actieve Kim Eigen-Regie-plan blijft canoniek onderdeel van de Backpackbackup. Noodcontacten en relevante notificatie-instellingen zijn eveneens gedekt. Tests bewijzen export → wipe → import voor Elias en Kim, rollbackkeys en compatibiliteit met oudere exports waarin de nieuwe optionele datasets ontbreken.

## 7. Signing en onafhankelijke builds

`docs/architecture/STANDALONE_SIGNING_AND_BUILD_HANDOVER.md` documenteert package-ID, EAS-profielen, credentials-overdracht, updatecompatibiliteit en onafhankelijke buildstappen. `scripts/verify-android-signing-handover.sh` vergelijkt de package-ID en SHA-256 signer van een bekende goede APK met een nieuwe APK en genereert geen nieuwe sleutel.

De codebase is voorbereid, maar signingcontinuïteit kan niet uit Git worden bewezen: Android-keystore, wachtwoorden en private EAS-credentials horen bewust niet in de repository. De laatste externe acceptatiestap is daarom:

1. Exporteer of draag de bestaande Androidcredentials veilig over.
2. Geef het verificatiescript een bekende updatebare APK en de nieuwe build.
3. Accepteer alleen `SIGNING HANDOVER: PASS` voordat een bestaande installatie wordt geüpdatet.

## 8. Validatiebewijs

| Controle | Resultaat |
|---|---|
| TypeScript | 0 fouten |
| Volledige Vitest-suite | 4.249 pass, 0 fail, 1 skip |
| Zes echte `processMessage`-scenario’s tegen live Railway | 6/6 pass |
| Release gate | PASS; 54 release-, 43 auto-debug- en 120 integrationtests |
| Wide-range layer 1: native/build | 27 pass |
| Layer 2: deterministic engine/routing | 172 pass |
| Layer 3: memory/storage | 79 pass |
| Layer 4: prompts/safety/clinical | 166 pass |
| Layer 5: Railway/provider isolation | 35 pass |
| Layer 6: UI/export | 44 pass |
| Layer 7: release/failure-boundaries | 106 pass |
| Standalone Androidbundle/route/privacy/backup gate | PASS |
| Railway deployment | SUCCESS voor `be035ee`; validationcommit `048d81e` eveneens SUCCESS |
| Lockfiles | Ongewijzigd |

## 9. Resterende waarheid vóór fysieke distributie

De bron-, Androidbundle-, Railway-, privacy-, storage-, backup- en lokale/live simulatiepoorten zijn groen. RecoFree is code-architecturaal geschikt voor een client-first APK met minimale Railway-backend. Twee externe/devicegrenzen blijven bewust niet als bewezen gemarkeerd:

1. **Signingcontinuïteit:** private credentials of een bekende goede APK moeten nog met de nieuwe APK worden vergeleken.
2. **Fysieke APK-acceptatie:** de zes scenario’s moeten eenmaal op de werkelijk ondertekende APK worden uitgevoerd. Dit is finale validatie, niet foutontdekking.

Daarom is de eindstatus **APK BUILD ELIGIBLE: YES**, **RAILWAY CUTOVER: LIVE**, **DEVICE VERIFIED: NO** en **SIGNING HANDOVER: EXTERNAL VERIFICATION REQUIRED**.
