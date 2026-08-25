# Laag 1 — Native client, Android en buildconfig

**Status:** Conditional pass. De Railway-only resolver en buildvariabele zijn getest, maar de gecorrigeerde APK is nog niet op device bewezen.

De belangrijkste foutgrens is build-time configuratie. `constants/oauth.ts` forceert Railway voor native en hosted web, terwijl localhost alleen voor lokale ontwikkeling is toegestaan. De gate controleert bovendien de vier verplichte feature flags, dual ABI en het interne previewprofiel.[1] [2]

| Risico | Grens | Dekking |
|---|---|---|
| Verkeerde publieke API-base | Build/runtime | Manus-overrides op Android, iOS en hosted web worden getest |
| Ontbrekende feature flags | Build | Vier flags moeten exact `true` zijn |
| Verkeerd ABI-profiel | Build | `armeabi-v7a` en `arm64-v8a` verplicht |
| Native modulecrash | Device | Niet volledig lokaal bewijsbaar; APK-test vereist |
| Verkeerde commit/build | Build/device | Nog geen embedded commitattest |

**Nog nodig:** buildcommit en API-host zichtbaar maken in technische appinfo; één gecorrigeerde APK installeren en debughost controleren.

## References

[1]: ../../../constants/oauth.ts "API-base resolver"
[2]: ../../../__tests__/api-base-url-production-guard.test.ts "Production routing guard"
[3]: ../../../app.config.ts "Expo native configuration"

