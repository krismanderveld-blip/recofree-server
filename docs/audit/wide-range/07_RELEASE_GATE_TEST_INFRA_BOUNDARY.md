# Laag 7 — Release-gate en testinfrastructuur

**Status:** Pass voor build eligibility. Device readiness wordt niet langer uit lokale tests afgeleid.

De oude gate controleerde TypeScript, volledige Vitest, release-, auto-debug-, integratie-, privacy- en lockfilechecks, maar simuleerde geen buildsecret en rapporteerde ten onrechte `APK READY: YES`. De nieuwe wide-range gate voegt zeven lagen, Railway-buildvariabele, vier feature flags, dual ABI, actieve URL-scan en Forge-uitsluiting toe.[1]

| Beslisstatus | Betekenis |
|---|---|
| APK BUILD ELIGIBLE: YES | Broncode, buildconfig en brede lokale gates slagen |
| DEVICE VERIFIED: NO | Nog geen installatie/runtimebewijs van de nieuwe APK |
| DEVICE VERIFIED: YES | Alleen na vast deviceprotocol op dezelfde commit/build |

De release gate faalt nu ook werkelijk met exitcode 1 en blokkeert standaard een niet-schone Git-tree.

## References

[1]: ../../../scripts/wide-range-pre-apk-gate.sh "Wide-range gate"
[2]: ../../../scripts/release-gate.sh "Main release gate"
[3]: ../../../__tests__/wide-range-pre-apk-gate.test.ts "Gate contract tests"

