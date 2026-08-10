# Legacy Backend Deprecation Plan

**Version:** 1.0
**Date:** 2026-08-10
**Status:** Planning — no code changes executed
**Author:** Architecture review (FASE 5A)

---

## 1. Purpose

This document defines the exact deprecation path for all server routes and backend logic that do not belong in the final client-first RecoFree architecture. It classifies each route, identifies risks, defines removal order, and sets safety conditions.

---

## 2. Final Client-First Target

**Client responsibilities:**
- Persona routing (Kim/Elias)
- Deterministic engine (zones, buffer, regulation, module selection)
- Safety/crisis detection
- Module routing
- Memory read/write (local encrypted storage)
- Prompt composition (buildClientSystemPrompt)
- Kim/Elias formulation engines (future)
- guidanceDepth / effectiveDepth resolution
- Post-GPT filters (safety filters, K05 override)
- Local state updates (user.dat, context.dat, distillation.dat)

**Railway/backend responsibilities (final):**
- `/api/minimal-gpt-proxy` — stateless GPT proxy
- `store:false` enforced
- Technical errors only
- No memory
- No clinical routing
- No prompt construction
- No session cache
- No clinical logging

**Normal chatloop final allowed route:** `/api/minimal-gpt-proxy` only.
**Exception:** `/api/health` for technical health check.

---

## 3. Route Classification Table

| Route | Current Function | Call Source | Clinical Logic | Memory/Session | OpenAI Direct | Forge/invokeLLM | store:false | Privacy Risk | Classification | Recommended Action |
|-------|-----------------|------------|----------------|----------------|---------------|-----------------|-------------|--------------|----------------|-------------------|
| `/api/minimal-gpt-proxy` | Stateless GPT proxy, client-built prompt | Client (flag=true) | No | No | Yes | No | Yes | Low | **KEEP_FINAL** | No changes needed |
| `/api/health` | Technical health check | Client/monitoring | No | No | No | No | N/A | Low | **KEEP_FINAL** | No changes needed |
| `/api/gpt-proxy` | Legacy GPT proxy with server-built prompt | Client (flag=false) | Yes (buildSystemPrompt, session cache) | Yes (54 session refs) | Yes | No | Yes | High | **KEEP_TEMPORARY_LEGACY** | Freeze. Remove after minimal proxy proven in production |
| `/api/session-greeting` | Server-side greeting GPT call | Client (SESSION_INIT) | Yes (personalization, context) | No | Yes | No | Yes | Medium | **REPLACE_BY_CLIENT** | Build client-side greeting via minimal proxy |
| `/api/nano-interpret` | Nano pre-call for module routing | Client (pipeline) | Yes (module interpretation) | No | No | Yes (Forge/Gemini) | No | Medium | **REPLACE_BY_CLIENT** | Replace with LocalLLMAdapter or client-side heuristic |
| `/api/signal-engine` | Semantic signal scoring | Client (pipeline) | Yes (signal classification) | No | Yes | No | Yes | Medium | **REPLACE_BY_CLIENT** | Replace with client-side signal scoring or LocalLLMAdapter |
| `/api/engine-process` | Full server-side engine (state, buffer, nano, GPT) | Client (if SERVER_ACTIVE) | Yes (full engine) | No | No | No | Yes | High | **DELETE_LATER** | Currently inactive (CLIENT_ACTIVE_SERVER_OFF). Remove after confirmed unused |
| `/api/backpack/analyze` | Backpack entity extraction via GPT | Client (manual trigger) | Yes (entity extraction) | No | Yes | No | Yes | Medium | **USER_INITIATED_ONLY** | Keep as explicit user action, not in chatloop |
| `/api/backpack/vsp-analyze` | VSP analysis via GPT | Client (manual trigger) | Yes (VSP interpretation) | No | Yes | No | Yes | Medium | **USER_INITIATED_ONLY** | Keep as explicit user action, not in chatloop |
| `/api/pre-translate` | Translation via GPT | Client (i18n) | No (linguistic only) | No | Yes | No | Yes | Low | **REPLACE_BY_CLIENT** | Move to client prompt instruction or minimal proxy |
| `/api/kerp01-generate` | Eigen Regie Plan generation | Client (wizard) | Yes (clinical generation) | No | No | Yes (invokeLLM/Forge) | No | High | **USER_INITIATED_ONLY** | Keep as wizard helper. Add store:false. Later: client prompt via minimal proxy |
| `/api/backpack/parse-document` | Document parsing for backpack | Client (upload) | No (text extraction) | No | No | No | N/A | Low | **USER_INITIATED_ONLY** | Keep as upload helper |
| `/api/vsp/parse-document` | Document parsing for VSP | Client (upload) | No (text extraction) | No | No | No | N/A | Low | **USER_INITIATED_ONLY** | Keep as upload helper |
| `/api/vsp/extract-text` | Text extraction from VSP | Client (export) | No (text extraction) | No | No | No | N/A | Low | **USER_INITIATED_ONLY** | Keep as export helper |
| `/api/debug/prompt` | Debug prompt viewer | Dev only | No | No | No | No | N/A | Low | **DELETE_LATER** | Remove before production release |

---

## 4. Server File Classification Table

| File | Primary Route | Classification | Notes |
|------|--------------|----------------|-------|
| `server/minimal-gpt-proxy.ts` | `/api/minimal-gpt-proxy` | **KEEP_FINAL** | Stateless, store:false, no clinical logic |
| `server/_core/index.ts` | Route registration + health | **KEEP_FINAL** | Minimal orchestration |
| `server/_core/llm.ts` | invokeLLM helper (Forge/Gemini) | **KEEP_TEMPORARY_LEGACY** | Used by kerp01-generate, nano-interpret. Later: remove or replace |
| `server/_core/env.ts` | Environment config | **KEEP_FINAL** | Technical config only |
| `server/ai-chat.ts` | `/api/gpt-proxy` | **KEEP_TEMPORARY_LEGACY** | 3200+ lines, buildSystemPrompt, session cache. Freeze. Delete after minimal proven |
| `server/gpt-proxy.ts` | `/api/gpt-proxy` (registration) | **KEEP_TEMPORARY_LEGACY** | Thin wrapper calling ai-chat. Delete with ai-chat |
| `server/engine-process.ts` | `/api/engine-process` | **DELETE_LATER** | Currently inactive (CLIENT_ACTIVE_SERVER_OFF) |
| `server/signal-engine.ts` | `/api/signal-engine` | **REPLACE_BY_CLIENT** | Semantic scoring. Replace with local adapter |
| `server/nano-interpret-proxy.ts` | `/api/nano-interpret` | **REPLACE_BY_CLIENT** | Module routing nano call. Replace with LocalLLMAdapter |
| `server/session-greeting.ts` | `/api/session-greeting` | **REPLACE_BY_CLIENT** | Greeting GPT call. Replace with client prompt via minimal proxy |
| `server/backpack-analysis.ts` | `/api/backpack/analyze` | **USER_INITIATED_ONLY** | Entity extraction. Keep as explicit action |
| `server/vsp-backpack-analysis.ts` | `/api/backpack/vsp-analyze` | **USER_INITIATED_ONLY** | VSP analysis. Keep as explicit action |
| `server/pre-translate.ts` | `/api/pre-translate` | **REPLACE_BY_CLIENT** | Translation. Move to client prompt |
| `server/kerp01-generate.ts` | `/api/kerp01-generate` | **USER_INITIATED_ONLY** | Wizard helper. Add store:false. Keep as explicit action |
| `server/backpack-document-parse.ts` | `/api/backpack/parse-document` | **USER_INITIATED_ONLY** | Document upload helper |
| `server/vsp-document-parse.ts` | `/api/vsp/parse-document` | **USER_INITIATED_ONLY** | Document upload helper |
| `server/vsp-text-extract.ts` | `/api/vsp/extract-text` | **USER_INITIATED_ONLY** | Text export helper |
| `server/debug-prompt.ts` | `/api/debug/prompt` | **DELETE_LATER** | Dev-only debug tool |
| `server/k05-cross-module-override.ts` | None (unused server file) | **DELETE_LATER** | Superseded by client-side version |

---

## 5. Normal Chatloop Allowed Routes (Final)

| Route | Reason |
|-------|--------|
| `/api/minimal-gpt-proxy` | Stateless GPT proxy, store:false, no clinical logic |
| `/api/health` | Technical health check only |

**All other routes are forbidden in normal chatloop in the final architecture.**

---

## 6. Routes Forbidden In Normal Chatloop (Final)

| Route | Current Status | Reason |
|-------|---------------|--------|
| `/api/gpt-proxy` | Active (flag=false) | Contains buildSystemPrompt, session cache, clinical routing |
| `/api/session-greeting` | Active | Server-side personalization, should be client prompt |
| `/api/nano-interpret` | Active | Server-side module routing, should be client/local |
| `/api/signal-engine` | Active | Server-side semantic scoring, should be client/local |
| `/api/engine-process` | Inactive | Full server engine, already disabled |
| `/api/pre-translate` | Active | Translation should be in client prompt instruction |

---

## 7. Temporary Legacy Exceptions

| Route | Why Temporary | Removal Condition |
|-------|--------------|-------------------|
| `/api/gpt-proxy` | Fallback while minimal proxy is validated | Remove after 2+ weeks stable production on minimal proxy |
| `/api/session-greeting` | Greeting still uses server GPT call | Remove after client-side greeting via minimal proxy is built |
| `/api/nano-interpret` | Module routing still needs nano pre-call | Remove after LocalLLMAdapter or client heuristic replaces it |
| `/api/signal-engine` | Signal scoring still server-side | Remove after client-side scoring or LocalLLMAdapter |
| `/api/pre-translate` | Translation still server-side | Remove after client prompt handles translation |

---

## 8. User-Initiated-Only Exceptions

| Route | Trigger | Why Allowed |
|-------|---------|-------------|
| `/api/backpack/analyze` | User manually edits backpack | Explicit action, not automatic chatloop |
| `/api/backpack/vsp-analyze` | User manually triggers VSP analysis | Explicit action |
| `/api/kerp01-generate` | User opens Eigen Regie wizard | Explicit wizard interaction |
| `/api/backpack/parse-document` | User uploads document | Explicit upload action |
| `/api/vsp/parse-document` | User uploads VSP document | Explicit upload action |
| `/api/vsp/extract-text` | User exports VSP | Explicit export action |

---

## 9. LocalLLMAdapter Future Replacement Targets

| Current Route | Current LLM | Replacement Strategy |
|---------------|-------------|---------------------|
| `/api/nano-interpret` | Forge/Gemini (via invokeLLM) | LocalLLMAdapter: on-device small model or client-side heuristic |
| `/api/signal-engine` | OpenAI direct | LocalLLMAdapter: client-side semantic scoring or rule-based |
| `/api/kerp01-generate` | Forge/Gemini (via invokeLLM) | Client prompt via minimal proxy with store:false |
| `/api/pre-translate` | OpenAI direct | Client prompt instruction (no separate call needed) |

---

## 10. Removal Order

| Priority | Route/File | Reason | Dependency |
|----------|-----------|--------|------------|
| 1 | `/api/engine-process` | Already inactive, dead code | None |
| 2 | `/api/debug/prompt` | Dev-only, not needed in production | None |
| 3 | `server/k05-cross-module-override.ts` | Superseded by client version | None |
| 4 | `/api/pre-translate` | Simple replacement: add to client prompt | Client prompt builder handles language |
| 5 | `/api/session-greeting` | Replace with client greeting via minimal proxy | Client greeting builder exists |
| 6 | `/api/signal-engine` | Replace with client-side scoring | Client signal scoring built |
| 7 | `/api/nano-interpret` | Replace with LocalLLMAdapter or heuristic | LocalLLMAdapter built and tested |
| 8 | `/api/gpt-proxy` + `server/ai-chat.ts` | Last to remove: only after minimal proxy proven stable 2+ weeks | All chatloop traffic on minimal proxy |

---

## 11. Safety Conditions Before Removal

| Route | Conditions Required Before Removal |
|-------|-----------------------------------|
| `/api/gpt-proxy` | Minimal proxy stable 2+ weeks. All users on new APK. No regression in Kim/Elias quality. Rollback plan documented. |
| `/api/session-greeting` | Client-side greeting tested and validated. Greeting quality equal or better. |
| `/api/nano-interpret` | LocalLLMAdapter or heuristic tested. Module routing accuracy maintained. |
| `/api/signal-engine` | Client-side scoring tested. Signal quality maintained. |
| `/api/engine-process` | Confirm no client code references it with SERVER_ACTIVE mode. |
| `/api/pre-translate` | Confirm translation works via client prompt instruction. |
| `/api/kerp01-generate` | Add store:false before any other change. Keep as wizard helper. |

---

## 12. Privacy/MDR Risk Notes

| Risk Level | Routes | Issue |
|------------|--------|-------|
| **HIGH** | `/api/gpt-proxy` (ai-chat.ts) | 54 session cache references. buildSystemPrompt constructs clinical prompt server-side. User data passes through server memory. |
| **HIGH** | `/api/kerp01-generate` | Uses invokeLLM (Forge) without store:false. Clinical content (Eigen Regie zones) sent to Forge proxy. |
| **MEDIUM** | `/api/session-greeting` | User context/personalization processed server-side. store:false present. |
| **MEDIUM** | `/api/nano-interpret` | User message sent to Forge/Gemini for interpretation. No store:false confirmed. |
| **MEDIUM** | `/api/signal-engine` | User message sent for semantic scoring. store:false present. |
| **MEDIUM** | `/api/backpack/analyze` | Backpack content (personal data) sent to OpenAI. store:false present. |
| **MEDIUM** | `/api/backpack/vsp-analyze` | VSP content (personal data) sent to OpenAI. store:false present. |
| **LOW** | `/api/minimal-gpt-proxy` | Stateless. store:false. No memory. No logging of content. |
| **LOW** | `/api/health` | No user data. |
| **LOW** | `/api/pre-translate` | Linguistic only. store:false present. |
| **LOW** | Document parse routes | Text extraction only. No LLM call. |

---

## 13. Stop Conditions

**STOP removal/deprecation immediately if:**

1. Kim or Elias response quality degrades measurably after route removal
2. Safety/crisis detection fails or is delayed
3. User reports loss of memory/continuity that cannot be explained by client-side state
4. APK crash rate increases after route removal
5. Railway logs show unexpected traffic to removed routes (indicates client code still references them)
6. store:false is not confirmed on any remaining LLM-calling route
7. Any route removal causes TypeScript errors or test failures

---

## 14. Open Questions

| # | Question | Impact | Blocking? |
|---|----------|--------|-----------|
| 1 | Does `/api/nano-interpret` use store:false? Inspection shows 0 store:false references. | Privacy risk: user messages may be stored by Forge/Gemini | Yes — must add store:false or confirm Forge proxy handles it |
| 2 | Does `/api/kerp01-generate` use store:false? Inspection shows 0 store:false references. | Privacy risk: Eigen Regie clinical content may be stored | Yes — must add store:false before production |
| 3 | Can LocalLLMAdapter run on-device with acceptable latency for nano-interpret? | Determines if nano-interpret can be fully client-side | No — can use minimal proxy as intermediate step |
| 4 | Is the session cache in ai-chat.ts ever read by routes other than /api/gpt-proxy? | Determines if session cache removal affects other routes | No — inspection needed before removal |
| 5 | Are there any server-side scheduled tasks or webhooks that call legacy routes? | Could break background processes | No — likely none, but must confirm |

---

## Confirmation

- No code changes made
- No server files modified
- No client files modified
- No routes removed or deactivated
- No feature flags changed
- No tests modified
- No lockfile regenerated
