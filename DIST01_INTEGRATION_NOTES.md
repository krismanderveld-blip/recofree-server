# DIST01 Integration Notes

## Files Created (Phase 1)
- `lib/engine/shared/dist01-types.ts` — All DIST01 types (entities, signals, contexts, store data)
- `lib/engine/shared/dist01-store.ts` — Encrypted local persistence (load/save/merge)
- `lib/engine/shared/dist01-detector.ts` — Deterministic extraction (persons, signals, contexts)
- `lib/engine/shared/dist01-context-injector.ts` — Serialize store data for GPT prompt

## Files Modified (Phase 1 — completed)
- `lib/ai/types.ts` — Added `distillationContext?: string | null` to ChatContext (line 1279)
- `lib/ai/live-message-filter.ts` — Added `'distillationContext'` to OPTIONAL_CONTEXT_KEYS (line 118)
- `lib/ai/openai-provider.ts` — Added `distillationContext: context.distillationContext ?? null` to SESSION_INIT payload (line 685)
- `server/ai-chat.ts` — Added `distillationContext?: string | null` to ChatRequestInput interface (line 366)

## Remaining Integration Steps

### 1. Add Zod validation for distillationContext in server/ai-chat.ts
- Around line 680 (after eigenRegiePlanContext Zod schema), add:
  `distillationContext: z.string().nullable().optional(),`

### 2. Add distillationContext injection in server/ai-chat.ts prompt builder
- Around line 2150+ (where stoaBlock/schemaModeBlock are injected), add distillation block
- Include in the system prompt template for both SESSION_INIT and LIVE_MESSAGE

### 3. Wire DIST01 into pipeline.ts
- Import dist01 modules at top of pipeline.ts
- After POST-GPT feedback loop (around line 3320), run detector on user message
- Merge detections into store
- At PRE-GPT (before ChatContext build at line 3053), load store + build context + set context.distillationContext

### 4. Session cache in server/ai-chat.ts
- Add `distillationContext: string | null` to SessionCache interface (around line 371)
- Store it at SESSION_INIT
- Inject it on LIVE_MESSAGE follow-ups

## Key Patterns
- OPTIONAL_CONTEXT_KEYS in live-message-filter.ts: auto-includes non-null fields in LIVE_MESSAGE
- SESSION_INIT: explicit field in inputPayload (openai-provider.ts line 685)
- Server Zod schema: validates all incoming fields
- Server prompt: string blocks concatenated into system message template
- Session cache: stores SESSION_INIT data for follow-up turns
