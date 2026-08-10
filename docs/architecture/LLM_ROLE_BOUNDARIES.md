# LLM Role Boundaries — RecoFree Architecture

**Document version:** 1.0
**Status:** Active architectural constraint
**Last updated:** 2026-08-10
**Scope:** All LLM interactions within RecoFree (Elias + Kim)

---

## 1. Current Reality

- **No local LLM is active.** All LLM calls go through server-side proxies.
- **Nano/semantic pre-call** (`/api/nano-interpret`) is a temporary bridge using `gemini-2.5-flash` via `forge.manus.im` (Manus proxy). It provides intent/theme/signal hints before the deterministic engine runs.
- **Main therapeutic response** uses OpenAI language model (`gpt-4o` / `gpt-4o-mini`) via Railway server proxy (`/api/gpt-proxy`). The server receives a client-built payload and forwards it to OpenAI with `store:false`.
- **Deterministic engine** runs fully client-side in `lib/rugzak/pipeline.ts`. It decides persona, module, zone, safety, depth, filters, and memory operations.
- **Clinical annotation** (optional, clinical mode only) uses a separate `gpt-4o` call with `store:false`.

---

## 2. Permanent Principle

> **Engine decides. LLM formulates or supports interpretation.**

No LLM layer may make final decisions about:
- Safety routing
- Module selection
- Crisis classification
- Memory read/write operations
- Persona assignment
- Zone escalation/de-escalation
- Guidance depth determination
- Post-GPT filter application

The deterministic engine is always the final authority. LLM output is advisory input or language formulation only.

---

## 3. OpenAI Main Call

**Role:** Language formulation layer.

**Allowed:**
- Generate therapeutic language based on client-built prompt
- Formulate responses within the constraints of the system prompt
- Produce text that the client-side filters then validate
- Operate with `store:false` (no data retention at OpenAI)
- Operate without memory (stateless per request)

**Forbidden:**
- Decide clinical routing (module, zone, persona)
- Choose or switch persona
- Manage or access memory beyond what is in the current prompt
- Override safety decisions made by the engine
- Invent formulation strategies outside the provided payload
- Store any user data
- Build or maintain session state
- Make autonomous relational or recovery hypotheses

---

## 4. Nano / Forge / Gemini Temporary Bridge

**Status:** Legacy. Temporary. Not privacy-ideal. Must remain replaceable.

**Current implementation:**
- `server/_core/llm.ts` → `invokeLLM()` → `forge.manus.im/v1/chat/completions`
- Model: `gemini-2.5-flash`
- Used by: `/api/nano-interpret`, `/api/session-greeting`, `/api/backpack-analysis`, `/api/vsp-backpack-analysis`, `/api/kerp01-generate`
- No `store:false` (technically uncertain for non-OpenAI proxy — documented in FASE 4A-2)

**Allowed (temporarily):**
- Provide intent/theme/signal hints
- Support language or semantic normalization
- Help confirm module selection (advisory only)
- Generate greeting text
- Analyze backpack content for entity extraction

**Forbidden (permanently):**
- Make final decisions on any clinical parameter
- Override safety routing
- Store or retain memory
- Build autonomous clinical context
- Receive new clinical routes or expanded responsibilities
- Become a formulation engine
- Make autonomous relational or recovery hypotheses
- Expand beyond current frozen route set

---

## 5. Future LocalLLMAdapter

**Goal:** Replace nano/signal-type tasks client-side.

**Design intent:**
- Semantic hints generated locally (no server needed for mini-interpretation)
- Intent classification on-device
- Theme extraction on-device
- Signal normalization on-device
- Deterministic engine remains final decision-maker
- No server dependency for pre-GPT interpretation
- Privacy improvement: semantic analysis never leaves device

**Constraints:**
- Must implement same interface as current nano-interpret output
- Must not make final decisions
- Must not bypass deterministic engine
- Must not store data beyond current session
- Must be swappable without pipeline changes

---

## 6. Deterministic Engine

**Location:** `lib/rugzak/pipeline.ts` (client-side)

**Must always decide:**
- Persona (Elias / Kim)
- Module selection and routing
- Zone classification (ROOD → GROEN)
- Safety/crisis level
- guidanceDepth / effectiveDepth
- formulationMode
- Memory read operations (which layers to include)
- Memory write operations (what to store, where)
- Post-GPT safety filters (K05 override, cluster filters, forbidden patterns)
- Relational harm pattern detection
- Relapse risk detection
- Depth and naming layer activation
- Decision pressure / intimacy / assessment mode activation

**May not delegate to any LLM:**
- Final safety classification
- Final module routing
- Final zone assignment
- Memory persistence decisions
- Filter application decisions

---

## 7. Backend Minimum Direction

**Target end-state for Railway backend:**
- Minimal GPT proxy (receives prompt, forwards to OpenAI, returns text)
- `store:false` on all OpenAI calls
- No memory retention
- No clinical routing
- No semantic helper unless explicit legacy exception
- No session cache for clinical purposes
- No prompt construction (client builds prompt)
- No model routing logic (client specifies model)

**Current deviation from target:**
- `buildSystemPrompt()` (800+ lines) still runs server-side
- Model selection logic still server-side
- Session cache still exists for LIVE_MESSAGE optimization
- Multiple non-proxy routes still active (nano-interpret, greeting, backpack-analysis)

**Migration path:** Documented in FASE 3A/3B (client prompt builder mirror) and FASE 4A (minimal proxy contract). No timeline forced.

---

## 8. Legacy Exception Rule

Every non-minimal LLM route on the server must be marked as:

| Route | Status | Expandable | Replaceable by LocalLLMAdapter |
|-------|--------|------------|-------------------------------|
| `/api/gpt-proxy` | Legacy (prompt construction server-side) | NO | Partially (prompt moves client-side) |
| `/api/nano-interpret` | Temporary bridge | NO | YES |
| `/api/session-greeting` | Temporary bridge | NO | YES (client-side greeting) |
| `/api/backpack-analysis` | Temporary bridge | NO | YES (client-side extraction) |
| `/api/vsp-backpack-analysis` | Temporary bridge | NO | YES |
| `/api/kerp01-generate` | Temporary bridge | NO | YES |
| `/api/engine-process` | Legacy (mode: OFF) | NO | Already replaced (client engine) |
| `/api/signal-engine` | Legacy (mode: OFF) | NO | Already replaced (client engine) |

**Rule:** No route marked "NO" for expansion may receive new clinical logic, new LLM calls, new prompt blocks, or new clinical branching.

---

## 9. Stop Conditions

New LLM logic must be **immediately stopped and reported** if it:

1. Adds server-side clinical decisions
2. Increases nano/forge dependency (new calls, new routes, expanded responsibilities)
3. Moves memory outside client (server-side storage, session cache for clinical state)
4. Moves safety outside deterministic engine
5. Cannot prove Kim/Elias separation (persona-specific logic leaking between personas)
6. Adds formulation logic to server (buildSystemPrompt expansion, new prompt blocks)
7. Creates new server-side LLM calls without explicit architectural review
8. Bypasses post-GPT safety filters
9. Stores user content at any LLM provider (violates store:false principle)
10. Makes the system harder to migrate toward LocalLLMAdapter + minimal proxy

---

## Document Authority

This document is a binding architectural constraint. Any code change that violates these boundaries requires explicit architectural review before implementation. The deterministic engine is sovereign. LLMs serve the engine, never the reverse.
