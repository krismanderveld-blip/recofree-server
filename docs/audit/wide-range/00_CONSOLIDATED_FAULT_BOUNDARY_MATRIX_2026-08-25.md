# RecoFree Wide-Range Fault-Boundary Matrix

**Commitbasis:** `570d97d`  
**Datum:** 2026-08-25  
**Methode:** zeven onafhankelijke parallelle code- en testaudits, gevolgd door lokale cross-checks

## Hoofdconclusie

De huidige code is **APK BUILD ELIGIBLE**, maar nog niet **DEVICE VERIFIED**. De nieuwe gate controleert zeven lagen, Railway-buildconfig, vier verplichte feature flags, dual ABI, actieve runtime-URL’s, directe OpenAI extraction en legacy/minimal route-isolatie. Alle zeven testlagen slagen.[1]

| Laag | Code aanwezig | Tests aanwezig | Build gesimuleerd | Runtime bewezen | Device bewezen | Status |
|---|---:|---:|---:|---:|---:|---|
| Native client/Android | Ja | Ja | Ja | Ja | Nee | Conditional pass |
| Deterministic engine/routing | Ja | Ja | N.v.t. | Ja | Deels | Conditional pass |
| Geheugen/opslag | Ja | Ja | N.v.t. | Ja | Deels | Conditional pass |
| Prompts/contracts | Ja | Ja | N.v.t. | Ja | Deels | Conditional pass |
| Railway/minimal-proxy | Ja | Ja | Ja | Ja, live | Nee voor nieuwe APK | Conditional pass |
| UI/i18n/exports | Ja | Deels | N.v.t. | Deels | Nee | Conditional pass |
| Release-gate/testinfra | Ja | Ja | Ja | Ja | Niet van toepassing | Pass voor build eligibility |

## Gevalideerde testmatrix

| Laag | Tests in wide-range gate | Resultaat |
|---|---:|---|
| Native/build | 27 | Pass |
| Engine/routing | 172 | Pass |
| Geheugen/opslag | 79 | Pass |
| Prompts/contracts | 166 | Pass |
| Railway/server | 35 | Pass |
| UI/i18n/export | 44 | Pass |
| Release/testinfra | 106 | Pass |

## Echte resterende risico’s

| Prioriteit | Bevinding | Verplichte actie |
|---|---|---|
| P1 | Legacy Railway-routes en clientfallbackcode bestaan nog; feature flag voorkomt normaal gebruik | Route-isolatie bewijzen en daarna afsluiten of 410 retourneren |
| P1 | Gecorrigeerde APK is nog niet op device getest | Eén build; embedded Railway-host en beide persona’s verifiëren |
| P1 | Silent fallbacks bij nano, sessiesamenvatting en storage kunnen degradatie maskeren | Debugstatus/counters plus failure-injection tests |
| P1 | Enkele schermen hebben geen gerichte tests | Day Planning, GDPR Consent en Proposal History testen |
| P2 | AsyncStorage mocks bewijzen geen native race/corruptiegedrag | Devicegerichte opslagtest en herstelprotocol |
| P2 | Buildnummer/commit is niet zichtbaar als betrouwbaar embedded attest | Buildmanifest/debugregel toevoegen |

## Gecorrigeerde fout-positieven uit parallelle subaudits

De ruwe subaudits meldden ontbrekende tests voor raw-data-uitsluiting, ageCategory, diary en cold-start. Cross-checking toont dat hiervoor meerdere actuele tests bestaan, waaronder `wiring-verification`, `autoDebugFullSystem`, `ageCategoryPromptInjection`, `diary-selfcare-projection`, `manualDataRefresh` en `forensicRuntimeValidation`.[2] [3] [4]

## Beslisregel

> **APK BUILD ELIGIBLE: YES** betekent alleen dat broncode, buildconfig en zeven foutgrenslagen lokaal groen zijn. **DEVICE VERIFIED: YES** mag pas na installatie van precies die commit en controle van Railway-host, persona’s, opslag, export en debugmetadata.

## References

[1]: ../../../scripts/wide-range-pre-apk-gate.sh "Wide-range pre-APK gate"
[2]: ../../../__tests__/wiring-verification.test.ts "Wiring verification"
[3]: ../../../__tests__/integration/autoDebugFullSystem.test.ts "Auto-debug full system"
[4]: ../../../__tests__/integration/forensicRuntimeValidation.test.ts "Forensic runtime validation"
[5]: ../P0_RAILWAY_ONLY_NATIVE_ROUTING_ROOT_CAUSE_2026-08-25.md "Railway-only root cause"

