# Laag 2 — Deterministic engine en routing

**Status:** Conditional pass. Module-, guidance-, epistemic- en persona-routing zijn breed getest; stille degradatiepaden blijven een risico.

De clientengine neemt beslissingen over safety, guidance, module, modeltier en contextselectie. Nano levert semantische hints en is geen eindbeslisser. Kim en Elias hebben gescheiden formulation- en routingpaden.[1] [2]

| Risico | Ernst | Actie |
|---|---|---|
| Nano timeout valt terug op keywords zonder centrale degradatiestatus | P1 | Failure counter/debugreden verplichten |
| Sessiesamenvatting valt terug op buffer | P2 | Degradatie zichtbaar maken in debug/export |
| Gemengde signalen kunnen verschillende detectors activeren | P2 | Overlapmatrix blijven uitbreiden |

De gate draait 172 gerichte routingtests. Devicebewijs blijft nodig voor timing, netwerkvertraging en UI-reactie.

## References

[1]: ../../../lib/rugzak/pipeline.ts "Client pipeline"
[2]: ../../../lib/engine/shared/guidance-depth-resolver.ts "Guidance resolver"
[3]: ../../../__tests__/pipeline/epistemicPipelineIntegration.test.ts "Epistemic integration"

