# MINIMAL GPT PROXY CONTRACT

**Contract Version:** `minimal_gpt_proxy_v1`  
**Status:** Specification only — not yet implemented  
**Created:** August 2026  
**Last updated:** August 2026

---

## 1. Purpose

This contract defines the future minimal GPT proxy architecture for RecoFree.

The backend becomes a **transport layer only**. It receives a fully constructed prompt from the client, forwards it to OpenAI with `store:false`, and returns the response text. Nothing more.

The client remains the sole owner of:
- Clinical logic
- Memory management
- Prompt construction
- Safety routing
- Module selection
- Persona determination
- Formulation engines
- Post-GPT safety filters

The backend has **zero clinical awareness**. It cannot interpret, modify, route, or log clinical content.

---

## 2. Backend Allowed Responsibilities

The backend may **only**:

| # | Responsibility |
|---|----------------|
| 1 | Receive HTTPS request |
| 2 | Validate request schema (structural only, not clinical) |
| 3 | Accept allowlisted model |
| 4 | Validate maxTokens within configured limit |
| 5 | Validate temperature within allowed range |
| 6 | Validate topP within allowed range |
| 7 | Enforce `store:false` (reject if store !== false) |
| 8 | Execute OpenAI API call with provided parameters |
| 9 | Return response text |
| 10 | Return technical errors without clinical interpretation |

---

## 3. Backend Forbidden Responsibilities

The backend may **never**:

| # | Forbidden Action |
|---|------------------|
| 1 | Choose Kim/Elias persona |
| 2 | Select module |
| 3 | Interpret safety/crisis |
| 4 | Execute formulation logic |
| 5 | Interpret guidanceDepth |
| 6 | Read or store memory |
| 7 | Maintain session cache for clinical context |
| 8 | Analyze KERP01/VSP/Backpack |
| 9 | Summarize rugzak/context |
| 10 | Compose prompt content |
| 11 | Choose model based on clinical content |
| 12 | Log user message content |
| 13 | Log clinical state |
| 14 | Allow OpenAI `store:true` |
| 15 | Persist request body |

---

## 4. Client Responsibilities

The client **must** handle:

| # | Responsibility |
|---|----------------|
| 1 | Persona routing (Kim/Elias) |
| 2 | Deterministic engine (zone, buffer, regulation) |
| 3 | Safety routing (crisis detection, safety-first) |
| 4 | Module routing (dominant module selection) |
| 5 | GuidanceDepth resolver |
| 6 | Memory read/write (AsyncStorage, MMKV) |
| 7 | Encrypted local storage |
| 8 | Kim/Elias prompt composition |
| 9 | Formulation engines |
| 10 | Post-GPT safety filters |
| 11 | K05 cross-module override |
| 12 | Final systemPrompt construction |
| 13 | Token budget calculation |
| 14 | Model selection based on client policy |

---

## 5. Request Contract

```typescript
{
  "contractVersion": "minimal_gpt_proxy_v1",
  "requestId": "string",
  "persona": "kim" | "elias",
  "model": "string",
  "systemPrompt": "string",
  "messages": [
    {
      "role": "user" | "assistant",
      "content": "string"
    }
  ],
  "maxTokens": number,
  "temperature": number,
  "topP": number,
  "store": false,
  "metadata": {
    "clientBuildVersion": "string",
    "promptBuildVersion": "string",
    "clinicalDebugId": "string | undefined"
  }
}
```

---

## 6. Response Contract

**Success:**

```typescript
{
  "contractVersion": "minimal_gpt_proxy_v1",
  "requestId": "string",
  "ok": true,
  "text": "string",
  "modelUsed": "string",
  "usage": {
    "inputTokens": number | undefined,
    "outputTokens": number | undefined,
    "totalTokens": number | undefined
  }
}
```

**Error:**

```typescript
{
  "contractVersion": "minimal_gpt_proxy_v1",
  "requestId": "string",
  "ok": false,
  "errorCode": "string",
  "errorMessage": "technical error only, no clinical interpretation"
}
```

---

## 7. Validation Rules

Backend **must reject** if:

| # | Condition |
|---|-----------|
| 1 | `store !== false` |
| 2 | `systemPrompt` is empty |
| 3 | `messages` is empty |
| 4 | `model` not in allowlist |
| 5 | `maxTokens` above configured limit |
| 6 | `temperature` outside allowed range |
| 7 | `topP` outside allowed range |
| 8 | `contractVersion` mismatch |

---

## 8. Privacy Rules

| # | Rule |
|---|------|
| 1 | No server memory |
| 2 | No session cache |
| 3 | No clinical logging |
| 4 | No prompt/content logging |
| 5 | No analytics payload containing sensitive content |
| 6 | No persistent storage of request body |
| 7 | Transient processing only |

---

## 9. Migration Rule

- Legacy server `buildSystemPrompt()` remains temporarily
- Future route switch must be feature-flagged
- No deletion of legacy route until end-to-end tests pass
- No new clinical logic may be added to legacy server path
- Client prompt mirror (FASE 3B) provides debug comparison before switch

---

## 10. Stop Conditions

Implementation **must stop** if:

| # | Condition |
|---|-----------|
| 1 | Server needs clinical state to answer |
| 2 | Client-built prompt lacks required identity/module/safety block |
| 3 | Kim/Elias separation cannot be proven |
| 4 | `store:false` cannot be enforced |
| 5 | Test suite breaks |
| 6 | Lockfile would regenerate |
