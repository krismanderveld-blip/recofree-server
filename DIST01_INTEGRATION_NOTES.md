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

## Files Created (Phase 2 — Route A: Promotie)
- `lib/engine/shared/dist01-proposal-types.ts` — Proposal data model (DistillationProposal, TargetDocument, RoutingRule, timing constants)
- `lib/engine/shared/dist01-proposal-store.ts` — Local persistence for proposals (add/update/query/expire/dedup)
- `lib/engine/shared/dist01-proposal-generator.ts` — Routing tables (Elias+Kim), confidence thresholds, dedup, crisis-block, timing
- `components/distillation/ProposalCard.tsx` — In-chat proposal card UI (accept/edit/dismiss/reject)
- `__tests__/dist01-proposal-phase2.test.ts` — 22 tests for proposal generator

## Files Modified (Phase 2 — completed)
- `lib/rugzak/pipeline.ts` — Added imports, POST-GPT Step 6.10 proposal generation, `distillationProposals` in PipelineResult
- `app/(tabs)/chat.tsx` — Added pendingProposals state, handleProposalAction callback, ProposalCard in ListFooter
- `lib/debug/session-logger.ts` — Added `dist01_proposal_action` to DebugEventType
- `lib/i18n/locales/nl.json` — Added 11 distillation.proposal.* keys
- `lib/i18n/locales/en.json` — Added 11 distillation.proposal.* keys
- `lib/i18n/locales/fr.json` — Added 11 distillation.proposal.* keys

## Phase 2 Architecture
- Pipeline POST-GPT Step 6.10: After detector runs, loads proposal store, checks timing/crisis/safety, generates proposals from eligible signals
- Max 1 proposal shown per turn (even if multiple generated)
- Proposals expire after 72h (PROPOSAL_EXPIRY_MS)
- Cooldown between proposals: 5 minutes (PROPOSAL_COOLDOWN_MS)
- Max 20 pending proposals at any time
- Crisis (level >= 2) or elevated safety: NO proposals generated or shown
- Dedup: same signal ID, same normalizedPatternKey, or same key in target document → skip
- Rejected proposals are permanently suppressed for that pattern

## Phase 3 (Route B — TODO)
- Wire accept/edit action to actually write to target documents (backpack, VSP, eigen-regie-plan)
- Update promotionStatus in distillation store from 'proposed' to 'promoted'
- Handle auto-save for eligible signals (eligibleForAutoSave flag)

## Key Patterns
- OPTIONAL_CONTEXT_KEYS in live-message-filter.ts: auto-includes non-null fields in LIVE_MESSAGE
- SESSION_INIT: explicit field in inputPayload (openai-provider.ts line 685)
- Server Zod schema: validates all incoming fields
- Server prompt: string blocks concatenated into system message template
- Session cache: stores SESSION_INIT data for follow-up turns
