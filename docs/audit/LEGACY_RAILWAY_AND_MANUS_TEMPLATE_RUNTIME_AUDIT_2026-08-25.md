# Legacy Railway Routes and Manus Template Runtime Audit

**Date:** 2026-08-25  
**Author:** Manus AI  
**Source commit:** `ee3ab6c264792488702bcdeae84666e42a591552`  
**Mode:** Read-only audit; no route or helper removed or blocked

## External Railway reachability evidence

The production host `https://railwayappdashboard-production.up.railway.app` was queried only with empty or invalid payloads, so no user content or clinical memory was transmitted. HTTP `400` proves that the route exists and rejected validation before normal processing; `401`/`403` proves an authentication or authorization boundary; `404` proves the route was not registered in production.[1]

| Express route | HTTP | Reachability interpretation |
|---|---:|---|
| `/api/minimal-gpt-proxy` | 400 | Registered and public-validation reachable |
| `/api/gpt-proxy` | 400 | Registered legacy route; public-validation reachable |
| `/api/engine-process` | 400 | Registered server-engine route; public-validation reachable |
| `/api/signal-engine` | 400 | Registered; public-validation reachable |
| `/api/pre-translate` | 400 | Registered; public-validation reachable |
| `/api/backpack/analyze` | 400 | Registered; public-validation reachable |
| `/api/backpack/vsp-analyze` | 400 | Registered; public-validation reachable |
| `/api/vsp/parse-document` | 400 | Registered; public-validation reachable |
| `/api/backpack/parse-document` | 400 | Registered; public-validation reachable |
| `/api/vsp/extract-text` | 400 | Registered; public-validation reachable |
| `/api/session-greeting` | 400 | Registered; public-validation reachable |
| `/api/nano-interpret` | 400 | Registered; public-validation reachable |
| `/api/debug/prompt` | 404 | Correctly absent in Railway production due `NODE_ENV=production` guard |
| `/api/auth/me` | 401 | Registered and authentication-protected Express route |
| `/api/oauth/mobile` | 400 | Registered OAuth route; validation reachable |

| tRPC procedure | HTTP | Reachability interpretation |
|---|---:|---|
| `ai.chat` | 400 | Public procedure exists; invalid input rejected |
| `ai.extractEntities` | 400 | Public procedure exists; invalid input rejected |
| `ai.engineProcess` | 400 | Public server-engine procedure exists; invalid input rejected |
| `ai.generateEigenRegiePlan` | 400 | Public procedure exists; invalid input rejected |
| `ai.analyzeBackpack` | 400 | Public procedure exists; invalid input rejected |
| `auth.logout` | 200 | Public mutation exists; empty logout accepted |
| `system.notifyOwner` | 403 | Registered but admin-protected |
| `auth.me` | 200 | Public query exists and can return nullable context user |

## Preliminary safety rule

> Reachability is not proof that a route is used by the current APK. A route can be externally reachable yet have no active client consumer. Conversely, source files without direct imports can still be reached through router registration. Final classification therefore requires both server registration and client/import callgraph evidence.

## Final decision vocabulary

| Decision | Meaning |
|---|---|
| `KEEP` | Required by a proven current client flow or by the minimal Railway/OpenAI architecture |
| `FREEZE` | Currently consumed, but violates or exceeds the future backend-minimum target; do not expand |
| `BLOCK_AFTER_DEVICE_PROOF` | No longer required by the intended minimal flow, but blocking now could break an older APK or unverified secondary flow |
| `SAFE_TO_REMOVE_LATER` | No production import, client consumer or required router dependency was found; removal still requires a separate clean build/test commit |
| `DEPENDENCY_UNPROVEN` | Evidence is mixed; preserve until the remaining auth/session dependency is resolved |

## Express route matrix

| Route | Client consumer | Server behavior | Decision | Reason |
|---|---|---|---|---|
| `/api/minimal-gpt-proxy` | Main follow-up and deep section analysis | Contract validation, OpenAI call, hardcoded `store:false` | `KEEP` | Intended production GPT route |
| `/api/nano-interpret` | `lib/pipeline/nano-interpret-client.ts` | Temporary semantic module resolver | `KEEP` | Explicitly required temporary resolver; engine remains final decision-maker |
| `/api/pre-translate` | `lib/ai/preprocessor.ts` for non-NL input | Literal translation only; `store:false` | `KEEP` | Safety-sensitive language normalization; no clinical final decision |
| `/api/signal-engine` | Session-end summary flow; per-message GPT signal engine initialization is disabled | Generic prompt-based classification/summarization | `FREEZE` | Still used for session summary, but it exceeds a strict minimal proxy surface |
| `/api/session-greeting` | Three greeting implementations | Server-side greeting prompt call | `FREEZE` | Proven current consumer; later migrate to client-built prompt plus minimal proxy |
| `/api/vsp/extract-text` | VSP and Backpack document uploads | Document text extraction | `KEEP` | Proven upload dependency; not clinical decision logic |
| `/api/vsp/parse-document` | VSP document upload | GPT document-to-VSP parsing | `FREEZE` | Current consumer, but structured interpretation occurs server-side |
| `/api/backpack/parse-document` | Backpack document upload | GPT section extraction | `FREEZE` | Current consumer; preserve until client-built equivalent is proven |
| `/api/backpack/analyze` | `lib/backpack-analysis/client.ts` | Full server clinical schema/mode analysis | `BLOCK_AFTER_DEVICE_PROOF` | Active fire-and-forget legacy analysis conflicts with client-first clinical logic |
| `/api/backpack/vsp-analyze` | `lib/backpack-extractor/vsp-backpack-client.ts` | Server VSP zone extraction | `BLOCK_AFTER_DEVICE_PROOF` | Active legacy clinical extraction; verify canonical client flow before blocking |
| `/api/gpt-proxy` | Legacy branch in `openai-provider.ts`; unreachable when mandatory minimal flag is true | Server prompt building/legacy chat | `BLOCK_AFTER_DEVICE_PROOF` | Public and externally reachable despite intended minimal route |
| `/api/engine-process` | Migration client exists but has no app import; default mode is client-only | Full server-side clinical engine | `BLOCK_AFTER_DEVICE_PROOF` | Externally reachable architecture violation; no active app caller found |
| `/api/debug/prompt` | No production client | Prompt/session inspection | `KEEP_DEV_ONLY` | Correctly returns 404 in production due explicit production guard |
| `/api/oauth/*`, `/api/auth/*` | Auth helper and callback files exist; no user-facing auth-hook consumer found | Manus OAuth/session exchange | `DEPENDENCY_UNPROVEN` | Chat provider still reads optional bearer tokens; remove only after auth-free APK proof |

## tRPC procedure matrix

| Procedure | Client consumer | Decision | Reason |
|---|---|---|---|
| `ai.extractEntities` | `lib/backpack-extractor/client.ts` | `FREEZE` | Required by manual refresh; direct OpenAI extraction now used server-side |
| `ai.generateEigenRegiePlan` | Kim KERP client | `FREEZE` | Proven current consumer and server generation logic |
| `ai.analyzeBackpack` | Schema/mode trigger | `BLOCK_AFTER_DEVICE_PROOF` | Active duplicate server clinical analysis |
| `ai.chat` | Legacy fallback branch | `BLOCK_AFTER_DEVICE_PROOF` | Public fallback, not used when minimal flag is enforced |
| `ai.engineProcess` | No active app import found | `BLOCK_AFTER_DEVICE_PROOF` | Public duplicate of server engine route |
| `system.notifyOwner` | No RecoFree client consumer; admin-protected | `SAFE_TO_REMOVE_LATER` | Template-only owner notification unless product owner alerts are explicitly retained |
| `auth.me`, `auth.logout` | No active user-facing auth-hook consumer found | `DEPENDENCY_UNPROVEN` | Coupled to unresolved optional auth/session template |

## Manus-template helper matrix

| Helper/file family | Registration/import evidence | Decision | Notes |
|---|---|---|---|
| `server/_core/dataApi.ts` | No production importer or registered route found | `SAFE_TO_REMOVE_LATER` | Contains Forge Data API URL but is dormant |
| `server/_core/imageGeneration.ts` | No production importer found | `SAFE_TO_REMOVE_LATER` | Uses `server/storage.ts`; both form a dormant pair |
| `server/_core/voiceTranscription.ts` | No production importer found | `SAFE_TO_REMOVE_LATER` | Documentation examples only |
| `server/storage.ts` | Only imported by dormant image generation helper | `SAFE_TO_REMOVE_LATER` | Remove together with image generation after isolated build proof |
| `server/_core/notification.ts` | Imported only by admin `system.notifyOwner` | `SAFE_TO_REMOVE_LATER` | Not part of chat, extraction or normal client UI |
| `server/_core/sdk.ts`, OAuth env/helpers | Registered OAuth routes and optional token infrastructure | `DEPENDENCY_UNPROVEN` | Contains `api.manus.im`; preserve pending auth-free device proof |
| `lib/notifications/*` | Used by the mobile app for local/push notification features | `KEEP` | Not the Manus owner-notification backend helper |
| Expo bundle/package identifiers containing `space.manus` | Native identifier, not an API/server route | `KEEP` | Changing package identity is a separate migration, not backend cleanup |

## Critical findings

The main minimal-proxy flow is Railway/OpenAI-only, but the server is **not yet a pure minimal GPT proxy**. Multiple externally reachable server-clinical routes remain registered, and two backpack analysis paths still have active client consumers.[2] [3] [5]

The server-engine migration code is dormant in the app callgraph: `dispatchEngine()` and `callServerEngine()` are re-exported but no app or pipeline importer was found, and the default engine mode is `CLIENT_ACTIVE_SERVER_OFF`. Nevertheless, both Express and tRPC server-engine endpoints remain publicly validation-reachable, so they cannot be considered removed or harmless.[6]

No file or route was deleted or blocked in this audit. This follows the project rule that removal requires proven absence of function, a clean build, passing gates, and device confirmation for any path that older APKs may still call.

## Recommended order after the corrected APK passes device acceptance

| Order | Action | Gate |
|---:|---|---|
| 1 | Block `/api/gpt-proxy`, `ai.chat`, `/api/engine-process`, and `ai.engineProcess` with an explicit technical response | New APK proves minimal follow-up and client engine |
| 2 | Compare canonical deep analysis against `/api/backpack/analyze`, `/api/backpack/vsp-analyze`, and `ai.analyzeBackpack`; disable duplicates only after stored outputs remain intact | Refresh + restart + ClinicalCtx device checks |
| 3 | Decide whether OAuth/user accounts are a RecoFree product feature; if not, remove callback/session/token plumbing as one isolated change | Auth-free cold start, chat, refresh and export tests |
| 4 | Remove dormant Data API, image, voice, storage and owner-notification helpers in one separate cleanup commit | `git grep`, TypeScript, full gate and Railway build |
| 5 | Migrate greeting, document parsing, KERP and session summary to client-built minimal-proxy contracts where required | Feature-specific equivalence tests |

## Audit outcome

> **No deletions are safe to combine with the current device test.** The corrected APK should first prove its Railway-only minimal chat flow. The audit does, however, provide sufficient evidence to prepare isolated future cleanup commits for dormant template helpers and to block unconsumed legacy clinical routes after device proof.

## References

[1]: https://railwayappdashboard-production.up.railway.app/ "RecoFree Railway production host"
[2]: ../../server/_core/index.ts "Express route registration"
[3]: ../../server/routers.ts "tRPC procedure registration"
[4]: ../../server/debug-prompt.ts "Production guard for debug prompt"
[5]: ../../lib/ai/openai-provider.ts "Minimal and legacy chat branches"
[6]: ../../lib/migration/engine-mode.ts "Client-only default migration mode"
[7]: ../../lib/backpack-analysis/client.ts "Legacy backpack analysis client"
[8]: ../../lib/backpack-extractor/vsp-backpack-client.ts "VSP backpack analysis client"
[9]: ../../server/_core/systemRouter.ts "Admin owner-notification procedure"
