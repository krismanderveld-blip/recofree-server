# Refactor Plan: ai-chat.ts → Pure Proxy

## Status: Phase 3 of 7

## What's Done
- Phase 1: Mapped all server-side extraction logic that should be local
- Phase 2: Created `lib/pipeline/prebuilt-prompt-blocks.ts` (0 TS errors)
  - `buildPrebuiltPromptBlocks()` produces: personLookupBlock, lifeContextBlock, structuredMemoryBlock, sessionAnalysesSummary
  - Uses extractedEntities.persons (strategy 1), relationalAnchors (strategy 2), regex fallback (strategy 3)

## What's Next

### Phase 3: Refactor ai-chat.ts
- Add new fields to ChatRequestInput: `personLookupBlock`, `lifeContextBlock`, `structuredMemoryBlock`, `prebuiltSessionHistory`
- In SESSION_INIT handler: use these pre-built blocks instead of calling extractRelationshipMap/buildCompactLifeStorySummary
- SessionCache: store the pre-built strings directly (no more extraction)
- Keep sessionCache for: messageCount, cumulativeTokens, psychoEducation/steunpilaren/selfAcceptance contexts (these ARE session-level caches that the server needs)
- Remove: extractRelationshipMap(), buildCompactLifeStorySummary(), buildStructuredMemoryBlock() functions

### Phase 4: Update gpt-payload-builder.ts
- Import and call buildPrebuiltPromptBlocks() in the pipeline
- Add personLookupBlock, lifeContextBlock, structuredMemoryBlock to ChatContext/GptPayload
- Stop sending raw backpack/userDat/diaryEntries (unless backpackChanged)

### Phase 5: Update openai-provider.ts
- Pass the pre-built blocks through to the server payload
- Remove raw backpack from SESSION_INIT payload (replace with pre-built blocks)

## Key Server-Side References (ai-chat.ts)
- ChatRequestInput interface: line 36-367
- SessionCache interface: line 373-416
- sessionCache = {...}: line 489-523
- extractRelationshipMap(): line 1055-1140
- buildPersonLookupBlock(): line 1146-1164
- buildCompactLifeStorySummary(): line 1171-1219
- resolveConditionalContext(): line 1241-1265 (V3.2: always returns full cache)
- buildSelectiveRelevanceBlock(): line 1269-1430 (uses conditional.relationshipMap)
- Follow-up lifeStoryContext injection: line 2044-2053
- Follow-up sessionAnalysesSummary: line 2131
- Follow-up distillationBlock: line 2133

## Key Local References
- Pipeline ChatContext assembly: pipeline.ts line 3127-3313
- context-dat-distiller: lib/pipeline/context-dat-distiller.ts
- prebuilt-prompt-blocks: lib/pipeline/prebuilt-prompt-blocks.ts (NEW)
- openai-provider SESSION_INIT: lib/ai/openai-provider.ts line 540-714
- openai-provider LIVE_MESSAGE: lib/ai/openai-provider.ts line 731-747

## Architecture Principle
- Backpack goes 1x at first session (or on manual change) → feeds user.dat
- User.dat + all memory layers → feed context.dat locally
- Pre-built prompt blocks are built LOCALLY from extractedEntities/userDat/backpack
- Server receives pre-built strings and injects them into GPT prompt
- Server does NOT extract, summarize, or derive anything from raw data
