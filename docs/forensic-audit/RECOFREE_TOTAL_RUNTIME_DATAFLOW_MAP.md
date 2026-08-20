# RECOFREE TOTAL RUNTIME DATAFLOW MAP

**Audit date:** 2026-08-20
**Commit:** 96340757
**Scope:** Complete data lifecycle from user input through GPT response to storage writeback

---

## EXECUTIVE SUMMARY

RecoFree has 26 data lifecycle steps. This map traces each step with file, function, storage, sync/async, failure modes, debug visibility, and test coverage.

---

## STEP-BY-STEP DATAFLOW

| Step | Description | File | Function | Input | Output | Storage R/W | Async | Silent fail? | Debug visible? | Tested? | Raw data risk? | Persona | Status |
|------|-------------|------|----------|-------|--------|-------------|-------|--------------|----------------|---------|----------------|---------|--------|
| 1 | User types message | app/(tabs)/chat.tsx | handleSend | text string | trimmed message | none | no | no | no | no | no | both | OK |
| 2 | UI screen captures context | app/(tabs)/chat.tsx | handleSend:787-790 | USERDAT_KEY | currentUserDat | SessionMemoryCache.get | yes | yes (returns null→fallback) | CP4 console.log | partial | no | both | PARTIAL |
| 3 | Local state (React) | lib/user-context.tsx | state.userDat | reducer | stale copy | in-memory | no | no | no | no | no | both | LEGACY RISK |
| 4 | AsyncStorage | lib/crypto/storage-encryption.ts | readEncrypted/writeEncrypted | key | encrypted JSON | AsyncStorage | yes | yes (returns null) | no | partial | no | both | OK |
| 5 | SessionMemoryCache | lib/crypto/session-memory-cache.ts | get/set | key | JSON string | in-memory + dirty flush | yes | yes (returns null on locked) | no | partial | no | both | PARTIAL |
| 6 | user.dat load | lib/rugzak/pipeline.ts:553 | currentUserDat = userDat | param from chat.tsx | full UserDat | SessionMemoryCache.get | yes | fallback to state.userDat | CP4 | partial | no | both | OK |
| 7 | state.dat (mood sliders) | lib/ai/openai-provider.ts:157-186 | buildStateSignals | userDat.moodSliders | signal array | read from userDat | no | empty array | no | no | no | both | PARTIAL |
| 8 | context.dat | lib/pipeline/context-dat-session-cache.ts | getOrBuild | backpack+userDat | serialized context | volatile cache | yes | returns undefined | ContextDat line | partial | no | both | PARTIAL |
| 9 | projections.dat | lib/engine/elias/projection.ts + kim/projection.ts | loadProjections | storage key | fears/hopes | AsyncStorage | yes | returns empty | no | no | no | persona-specific | PARTIAL |
| 10 | DIST01/distillation | lib/engine/shared/clinical-memory-distillation/ | buildCMDContext | userDat+stateDat | selected items | in-memory build | no | returns empty | CMD line | yes | no | both | OK |
| 11 | Backpack/Rugzak | lib/rugzak/manual-data-refresh.ts | runManualDataRefresh | raw sections | extractedEntities + deepAnalysis | AsyncStorage+SessionMemoryCache | yes | silent on GPT fail | DeepAnalysis line | partial | raw sent to Railway for extraction | both | PARTIAL |
| 12 | VSP/Eigen Regie | lib/rugzak/backpack-relevance-analyzer.ts | parseVSPProfile | recurringThemes section | zone labels | none (derived) | no | returns empty | no | partial | no | elias | PARTIAL |
| 13 | Diary | app/(tabs)/chat.tsx:536-542 + pipeline.ts:2960 | loadDiary→buildDiarySummary | AsyncStorage diary key | summary string | read from AsyncStorage | yes | returns empty | diary line (new) | partial | no | both | OK |
| 14 | Module memory | lib/engine/shared/module-memory-cross-session.ts | getSessionState | persona+moduleId | usage counts | AsyncStorage | yes | returns defaults | no | no | no | persona-specific | UNTESTED |
| 15 | Rejected suggestions | lib/rugzak/rejected-suggestion-guard.ts | getSessionRejections | session-only | rejection list | volatile (session) | no | returns empty | rejectedSuggestions line | yes | no | both | OK |
| 16 | CMD memory | lib/engine/shared/clinical-memory-distillation/ | selectAndSummarize | all memory layers | summary string | in-memory | no | returns empty | CMD line | yes | no | both | OK |
| 17 | personalAnchors | lib/rugzak/pipeline.ts:6070-6120 | buildPersonalAnchorsBlock | extractedEntities.persons + lifeStatusFacts | compact string | none (derived) | no | returns undefined | Anchors line | yes | no | both | OK |
| 18 | personalClinicalContext | lib/rugzak/pipeline.ts:6504-6750 | buildPersonalClinicalContext | userDat schemas/modes/triggers OR schemaTendencies fallback | formatted string | none (derived) | no | returns undefined | ClinicalCtx line | yes | no | persona-specific | OK |
| 19 | Formulation blocks | lib/ai/prompt/kim-prompt-composer.ts + elias-prompt-composer.ts | compose | pipeline context | prompt sections | none | no | returns empty | Formulation line | yes | no | persona-specific | OK |
| 20 | Prompt builder | lib/ai/prompt/client-system-prompt-builder.ts | buildClientSystemPrompt | ClientPromptBuildInput | systemPrompt string | none | no | no | omittedSections | yes | no | both | OK |
| 21 | Provider | lib/ai/openai-provider.ts:849-960 | sendMinimalProxy | promptInput | HTTP request | none | yes | shows error in UI | Route line | yes | no | both | OK |
| 22 | Minimal proxy | server/minimal-gpt-proxy.ts | POST handler | contract request | OpenAI call | none | yes | returns error JSON | server logs | yes | store:false ✓ | both | OK |
| 23 | GPT response | OpenAI API | — | messages+model | text response | none (store:false) | yes | HTTP error | response visible | no | no | both | OK |
| 24 | Post-GPT update | lib/rugzak/pipeline.ts:933-963 | runMemoryWriteBack | detectionBundle | patches | userDat/stateDat/projectionsDat stores | yes | silent if no patches | memoryWriteBack line | partial | no | both | PARTIAL |
| 25 | Storage writeback | lib/rugzak/pipeline.ts:937-939 + chat.tsx mergeToUserDatStorage | save stores | updated data | persisted | AsyncStorage+SessionMemoryCache | yes | can fail silently | no | partial | no | both | PARTIAL |
| 26 | Next session reuse | app/(tabs)/chat.tsx:787 + pipeline.ts:553 | SessionMemoryCache.get | USERDAT_KEY | full userDat with deep analysis | SessionMemoryCache | yes | fallback to stale | CP4 | partial | no | both | PARTIAL |

---

## CRITICAL FINDINGS

| # | Finding | Severity | Step | Impact |
|---|---------|----------|------|--------|
| 1 | React state.userDat (step 3) is NEVER updated with deep analysis fields | P2 | 3→6 | If SessionMemoryCache fails, fallback is stale |
| 2 | Module memory (step 14) has no debug visibility | P3 | 14 | Cannot verify on device |
| 3 | Projections.dat (step 9) has no debug visibility | P2 | 9 | Cannot verify injection |
| 4 | Post-GPT writeback (step 24) runs only on legacy path | P1 | 24 | Minimal proxy path has no memory writeback |
| 5 | VSP profile (step 12) is derived but not stored/cached | P3 | 12 | Re-parsed every message |
| 6 | contextDat volatile cache lost on app restart | P2 | 8 | First message after restart has no contextDat |
| 7 | Legacy server files (19 files) still exist with clinical logic | P2 | 22 | Backend freeze violation risk |

---

## LEGEND

- **OK:** Fully wired, tested, debug visible
- **PARTIAL:** Wired but incomplete testing or debug visibility
- **BROKEN:** Known failure, data doesn't flow
- **UNTESTED:** Code exists but no test coverage
- **LEGACY:** Old path that should be deprecated
