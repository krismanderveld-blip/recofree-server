# Laag 3 — Geheugen en lokale opslag

**Status:** Conditional pass. Refresh, ClinicalCtx, diary, projections en day structure zijn getest; native storage-races zijn niet volledig bewezen.

De actuele testset dekt manual refresh, volledige ClinicalCtx-flow, diary/self-care/projections en day-structure persistence. Eerdere bevindingen dat cold-start en refresh geheel ongetest waren, zijn achterhaald.[1] [2]

| Risico | Ernst | Actie |
|---|---|---|
| AsyncStorage write faalt of racet met SessionMemoryCache | P1 | Failure-injection test en debug readback |
| Corrupte JSON wordt naar lege/default state hersteld | P2 | Dataverlieswaarschuwing en herstelbewijs |
| Silent buffer/context fallback | P2 | Bron/reason in clinical debug behouden |
| Persona-mix bij nieuwe opslagvelden | P1 | Elk nieuw veld krijgt cross-persona regressietest |

## References

[1]: ../../../__tests__/rugzak/manualDataRefresh.test.ts "Manual refresh tests"
[2]: ../../../__tests__/integration/fullDeviceFlowClinicalCtx.test.ts "Full ClinicalCtx flow"
[3]: ../../../__tests__/diary-selfcare-projection.test.ts "Diary and projection tests"

