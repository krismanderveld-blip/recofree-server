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

## Server-Side Integration (ALL COMPLETE)

All server-side steps were implemented in a previous session:

1. **Zod validation** (line 685): `distillationContext: z.string().nullable().optional()` ✔️
2. **SessionCache** (line 415): `distillationContext: string | null` ✔️
3. **SESSION_INIT storage** (line 522): `distillationContext: input.distillationContext ?? null` ✔️
4. **LIVE_MESSAGE injection** (line 2133): `const distillationBlock = (input.distillationContext || sessionCache?.distillationContext) ?? ''` ✔️
5. **SESSION_INIT prompt** (line 2649+2654): `sessionStartDistillation` injected in system prompt ✔️
6. **Pipeline wiring** (pipeline.ts): PRE-GPT loads store + builds context; POST-GPT runs detector + merges ✔️

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

## Files Created (Phase 3 — Route B + Auto-Save + History)
- `lib/engine/shared/dist01-proposal-writer.ts` — Route B writer (writeProposalToDocument, processAutoSave, updateSignalPromotionStatus)
- `app/proposal-history.tsx` — Full proposal history/analytics screen with filter tabs and stats
- `__tests__/dist01-phase3-writer.test.ts` — 24 tests for writer and auto-save

## Files Modified (Phase 3 — completed)
- `lib/rugzak/pipeline.ts` — Added Step 6.11 auto-save, imported processAutoSave + getRoutingRulesForPersona
- `lib/engine/shared/dist01-proposal-generator.ts` — Added getRoutingRulesForPersona export
- `app/(tabs)/chat.tsx` — handleProposalAction now writes to target documents via Route B writer
- `app/(tabs)/profile.tsx` — Added navigation card to proposal history screen
- `lib/i18n/locales/nl.json` — Added 27 proposal_history.* + profile.proposal_history.* keys
- `lib/i18n/locales/en.json` — Added 27 proposal_history.* + profile.proposal_history.* keys
- `lib/i18n/locales/fr.json` — Added 27 proposal_history.* + profile.proposal_history.* keys

## Phase 3 Architecture
- **Route B Writer**: writeProposalToDocument maps each TargetDocument to the correct backpack/VSP/EigenRegie field
  - Elias: vsp_trigger, vsp_zone, vsp_recovery_rule, vsp_anchor_sentence, backpack sections
  - Kim: eigen_regie_trigger, eigen_regie_zone, eigen_regie_boundary_rule, eigen_regie_anchor_sentence, kimBackpack
  - Zone inference from clinicalMeaning (e.g., early_signal → orange, relapse_warning → red)
  - Dedup: avoids duplicate triggers/rules (case-insensitive)
  - InsertMode: append / add_note / add_nuance
- **Auto-Save**: Pipeline Step 6.11 (after Step 6.10 proposals)
  - Filters: eligibleForAutoSave + in_store + not suppressed + not contradicted
  - Max 2 per turn (configurable)
  - Uses same writeProposalToDocument function
  - Updates promotionStatus to 'auto_saved'
- **History Screen**: app/proposal-history.tsx
  - Filter tabs: All / Accepted / Rejected / Auto-saved / Expired
  - Stats summary row
  - Navigable from Profile → "Inzichten & voorstellen"

## Key Patterns
- OPTIONAL_CONTEXT_KEYS in live-message-filter.ts: auto-includes non-null fields in LIVE_MESSAGE
- SESSION_INIT: explicit field in inputPayload (openai-provider.ts line 685)
- Server Zod schema: validates all incoming fields
- Server prompt: string blocks concatenated into system message template
- Session cache: stores SESSION_INIT data for follow-up turns
