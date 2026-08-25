# Laag 5 — Railway, minimal proxy en server

**Status:** Conditional pass. Actieve chat en extraction zijn Railway/OpenAI-only; legacy routes blijven bereikbaar en vormen een architectuurrisico.

De minimal proxy valideert het contract, dwingt `store:false` af en voegt geen klinische logica toe. Extraction gebruikt direct OpenAI zonder Forge. De productie-URL is Railway.[1] [2]

De server registreert echter nog legacy procedures zoals `engineProcess`, `analyzeBackpack` en `extractEntities`. De client bevat bovendien frozen legacy chatfallbackcode achter de minimal-proxy branch. De buildgate dwingt de minimal flag af en test de early return, maar verwijdert of blokkeert die routes niet.[3]

| Risico | Ernst | Actie |
|---|---|---|
| Legacy serverroutes extern bereikbaar | P1 | Na devicebewijs 410/403 of expliciete allowlist |
| Legacy clientbranch bij flagfout | P1 | Buildflag hard blokkeren; al toegevoegd aan gate |
| Providersecret ontbreekt | P1 | Structured failuretest behouden |
| Malformed OpenAI response | P2 | 502-contract en technische logging testen |

## References

[1]: ../../../server/minimal-gpt-proxy.ts "Minimal GPT proxy"
[2]: ../../../server/_core/llm.ts "Direct OpenAI extraction"
[3]: ../../../server/routers.ts "Registered legacy procedures"

