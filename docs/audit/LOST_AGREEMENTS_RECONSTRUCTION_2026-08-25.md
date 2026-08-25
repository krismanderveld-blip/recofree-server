# Reconstructie van verdwenen afspraken en onvolledige claims

**Datum:** 2026-08-25  
**Auteur:** Manus AI

## Conclusie

> De broncodebackup was technisch geldig, maar niet semantisch volledig. Hij bevatte de gecommitte repository en Git-history, maar niet alle afspraken die uitsluitend in chat of in een nog niet gecommitte `todo.md` stonden.

De brede parallelle foutgrensaudit werd na checkpoint `d212285` aan `todo.md` toegevoegd, maar vóór een nieuwe commit/checkpoint. Git-history bevat daarom geen commit met de tekst `brede parallelle` of `fault-boundary`. Toen de werkruimte op 2026-08-25 opnieuw werd geladen vanuit checkpoint `d212285`, verdween die ongetrackte afspraak. De latere backup kon haar niet bevatten, omdat zij toen al uit de werkruimte verdwenen was.[1] [2]

## Tijdlijn

| Moment | Gebeurtenis | Gevolg |
|---|---|---|
| 2026-08-22 | Checkpoint `d212285` bevestigde broncode, Git-history en technische backup | Technische staat vastgelegd |
| Na `d212285` | Wide-range audit met zeven lagen werd alleen aan de actieve TODO toegevoegd | Afspraak bestond in werkruimte/chat, niet in Git |
| 2026-08-25 05:04 UTC | Werkruimte werd opnieuw geladen vanaf `d212285` | Niet-gecommitte wide-range TODO verdween |
| 2026-08-25 | P0 devicebewijs toonde `recobase-vhsxu5ua.manus.space` | Bewees dat eerdere Railway-only audit buildconfig niet had afgedekt |
| 2026-08-25 | Commit `570d97d` herstelde Railway-only routing | Actieve API/GPT-routes gecorrigeerd en getest |
| 2026-08-25 | Wide-range gate opnieuw gebouwd en uitgevoerd | Zeven lagen, buildsecrets en negatieve routechecks toegevoegd |

## Wat eerdere claims misten

| Eerdere claim | Waarom onvolledig | Correcte formulering |
|---|---|---|
| “Volledige backup” | Chat-only eisen en niet-gecommitte TODO’s zaten er niet in | Volledige technische repositorybackup, geen semantische taakbackup |
| “Railway-only routing geverifieerd” | Alleen tracked constants/fallback werden bekeken; actieve buildsecret en gegenereerde projectconfig niet gesimuleerd | Railway stond in code, maar de APK-buildoverride was niet bewezen |
| “APK READY: YES” | Lokale unit/integratietests bewezen geen embedded buildvariabelen of devicegedrag | APK **build eligible**; device verificatie blijft afzonderlijk |
| “Volledige scan” | De scan was sequentieel en niet onafhankelijk per foutgrenslaag | Meerdere runtimepaden waren getest, maar build-, negative-route- en devicegrenzen waren incompleet |

## Gereconstrueerde afspraken

De volgende expliciete afspraken zijn teruggevonden of opnieuw vastgelegd:

1. Een brede audit moet zeven onafhankelijke lagen bevatten en niet één sequentiële codecheck zijn.
2. De pre-APK gate moet buildsecrets, Expo-public variabelen, URL-resolvers, feature flags, ABI-profiel en commitstatus simuleren.
3. Foutpaden moeten expliciet worden getest: verkeerde backend, Manus-domain injectie, ontbrekende provider, malformed response, stale config en netwerkfalen.
4. Unit-tests alleen mogen nooit meer leiden tot “APK READY”.
5. Een semantische backup moet eisen, verboden architectuurpaden, open TODO’s, devicebevindingen en beslissingen bewaren.
6. De terugkerende twee reflectievragen, iOS/testgroepvoorbereiding en resterende template-Manushelpers moeten opnieuw als expliciete vervolgpunten worden bijgehouden.

Een oudere opdracht die alleen als “zet 3 op todo” werd aangeduid, kan niet betrouwbaar worden gereconstrueerd zonder de verwijderde chat. Deze wordt bewust niet ingevuld of gegokt.

## References

[1]: ../../todo.md "Actuele RecoFree TODO"
[2]: https://github.com/krismanderveld-blip/recofree-server/commits/main "RecoFree Git-history"
[3]: ./P0_RAILWAY_ONLY_NATIVE_ROUTING_ROOT_CAUSE_2026-08-25.md "P0 Railway-only rootcauserapport"

