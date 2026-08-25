# Laag 4 — Prompts en clinical contracts

**Status:** Conditional pass. Contextcontract, crisisblokken, raw-data-uitsluiting en clinical factors hebben regressietests; uiteindelijke GPT-compliance blijft device/runtime-afhankelijk.

De promptlaag bevat verplichte crisis-, identity-, context application-, deceased safety- en no-diagnosisregels. Cross-checking toont expliciete tests voor raw Backpack/user.dat/DIST01/logs, ageCategory en diary; de ruwe parallelle audit onderschatte deze dekking.[1] [2]

| Risico | Ernst | Actie |
|---|---|---|
| Tegenstrijdige promptregels | P1 | Directe-vraag en clinical-mode scenario’s als snapshots behouden |
| GPT negeert aanwezigheid/ALL-instructie | P1 | Exacte input/output deviceprotocollen |
| Nieuwe clinical factorregex mist formulering | P2 | Meertalige expliciete-zelfrapportage corpus uitbreiden |
| Silent fallback naar legacy prompt | P1 | Minimal flag + routegebruik verplicht in gate/debug |

## References

[1]: ../../../__tests__/wiring-verification.test.ts "Prompt wiring verification"
[2]: ../../../__tests__/safety-prompt-blocks.test.ts "Safety prompt blocks"
[3]: ../../../lib/engine/shared/context-application-contract.ts "Context application contract"

