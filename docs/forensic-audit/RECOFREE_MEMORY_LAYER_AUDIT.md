# RECOFREE MEMORY LAYER AUDIT

**Audit date:** 2026-08-20
**Commit:** 96340757

---

## 1. user.dat (@recofree_userdat)

| Field | Writer | Reader | Overwrite risk | Canonical? | Fallback? | Legacy? | Unused? | Persona |
|-------|--------|--------|----------------|------------|-----------|---------|---------|---------|
| extractedEntities.persons | forceExtract (Railway) | personalAnchors builder | mergeToUserDatStorage protects | yes | no | no | no | both |
| schemaTendencies | callBackpackAnalysis (user-context) | buildPersonalClinicalContext (fallback) | mergeAndPersistUserDat protects | no | yes | no | no | both |
| modeTendencies | callBackpackAnalysis (user-context) | buildPersonalClinicalContext (fallback) | mergeAndPersistUserDat protects | no | yes | no | no | both |
| schemas | mergeAnalysisToUserDat (section-analysis) | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| modes | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| triggers | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| protectiveFactors | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| values | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| goals | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| risks | mergeAnalysisToUserDat | buildPersonalClinicalContext | mergeToUserDatStorage protects | yes | no | no | no | both |
| recoveryPatterns | mergeAnalysisToUserDat | buildPersonalClinicalContext (Elias only) | protected | yes | no | no | no | elias |
| caregiverPatterns | mergeAnalysisToUserDat | buildPersonalClinicalContext (Kim only) | protected | yes | no | no | no | kim |
| developmentalFormulation | mergeAnalysisToUserDat | buildPersonalClinicalContext | protected | yes | no | no | no | both |
| triggerChains | mergeAnalysisToUserDat | buildPersonalClinicalContext | protected | yes | no | no | no | both |
| relapsePathways | mergeAnalysisToUserDat | buildPersonalClinicalContext (Elias only) | protected | yes | no | no | no | elias |
| caregiverBurdenPathways | mergeAnalysisToUserDat | buildPersonalClinicalContext (Kim only) | protected | yes | no | no | no | kim |
| functionOfAddiction | mergeAnalysisToUserDat | buildPersonalClinicalContext (Elias only) | protected | yes | no | no | no | elias |
| functionOfCaregivingPattern | mergeAnalysisToUserDat | buildPersonalClinicalContext (Kim only) | protected | yes | no | no | no | kim |
| contraindications | mergeAnalysisToUserDat | buildPersonalClinicalContext | protected | yes | no | no | no | both |
| safeFormulationHints | mergeAnalysisToUserDat | buildPersonalClinicalContext | protected | yes | no | no | no | both |
| lifeStatusFacts | mergeAnalysisToUserDat | buildPersonalAnchorsBlock | protected | yes | no | no | no | both |
| totalSessions | startSession (user-context) | greeting | mergeAndPersistUserDat protects | yes | no | no | no | both |
| lastSessionDate | startSession | greeting | protected | yes | no | no | no | both |
| chatHistory | chat.tsx greeting flow | legacy route only | mergeToUserDatStorage | no | no | yes | PARTIAL | both |
| moodSliders | mood screen | openai-provider state.dat signals | mergeAndPersistUserDat | yes | no | no | no | persona-specific |
| stageOfChange | settings | legacy route | mergeAndPersistUserDat | yes | no | no | no | elias |
| eigenRegieLevel | eigenRegie screen | pipeline depth resolver | mergeAndPersistUserDat | yes | no | no | no | kim |
| guidanceDepth | settings | pipeline depth resolver | mergeAndPersistUserDat | yes | no | no | no | both |
| sobrietyDate | settings | greeting/milestone | mergeAndPersistUserDat | yes | no | no | no | elias |
| clinicalModeActive | settings | pipeline | mergeAndPersistUserDat | yes | no | no | no | both |

---

## 2. state.dat (mood sliders + VSP zone)

| Field | Writer | Reader | Prompt usage | Status |
|-------|--------|--------|--------------|--------|
| elias.craving | mood screen | openai-provider:164 | signal label "craving" score 1-3 | OK |
| elias.frustration | mood screen | openai-provider:167 | signal label "frustration" | OK |
| elias.despondency | mood screen | openai-provider:170 | signal label "despondency" | OK |
| elias.focus | mood screen | openai-provider:174 | signal label "low-focus" (inverted) | OK |
| kim.stress | mood screen | openai-provider:180 | signal label "stress" | OK |
| kim.boundaryFatigue | mood screen | openai-provider:183 | signal label "boundary-fatigue" | OK |
| kim.emotionalBurden | mood screen | openai-provider:186 | signal label "emotional-burden" | OK |
| kim.selfCare | mood screen | NOT READ | not in prompt | UNUSED |
| vspZone | VSP screen | pipeline zone resolver | zone routing | OK |

**FINDING:** `kim.selfCare` slider exists but is NEVER read by the provider or prompt. Dead field.

---

## 3. context.dat (volatile session cache)

| Aspect | Detail |
|--------|--------|
| Built from | backpack sections + userDat + extractedEntities |
| When rebuilt | SESSION_INIT or after Gegevens verversen |
| Cache key | volatile in-memory (context-dat-session-cache.ts) |
| Stale risk | Lost on app restart; first message has no contextDat |
| Data included | section summaries, relationship context, life events |
| Data excluded | raw backpack text, full chatHistory |
| Prompt injection | via contextDatSerialized in promptInput |
| Debug | ContextDat line: present/src/chars |
| Status | PARTIAL — works but lost on cold start |

---

## 4. projections.dat

| Aspect | Detail |
|--------|--------|
| Storage keys | @recofree_projection_elias, @recofree_projection_kim |
| Fields | fears[], hopes[] |
| Writer | pipeline post-GPT writeback (runMemoryWriteBack) |
| Reader | pipeline projectionContext builder |
| Prompt injection | projectionContext in promptInput |
| Debug visible | NO — not in clinical dropdown |
| Tests | partial (projection types tested, not full flow) |
| Status | PARTIAL — no debug visibility, no device verification possible |

---

## 5. DIST01 / Clinical Memory Distillation

| Aspect | Detail |
|--------|--------|
| Detection | CMD builders read from userDat, stateDat, projectionsDat |
| Storage | in-memory build per message (not persisted separately) |
| Prompt injection | cmdMemorySummary in promptInput → [SELECTED CLINICAL MEMORY] |
| Token budget | budget selector limits to ~500 tokens |
| Raw leak risk | NO — summary only, no raw items |
| Vice versa (GPT→DIST01) | runMemoryWriteBack writes patterns back to stores |
| Legacy/minimal | works on BOTH paths (built client-side) |
| Debug | CMD line: flag/run/ctx/valid/sel/tok/sum |
| Status | OK |

---

## 6. Backpack/Rugzak

| Flow | File | Status |
|------|------|--------|
| Raw input | app/(tabs)/backpack screens | OK |
| forceExtract (persons) | lib/backpack-extractor/client.ts → Railway | OK |
| schemaTendencies/modeTendencies | lib/user-context.tsx:callBackpackAnalysis | OK (fallback) |
| analyzeAllSections (canonical) | lib/backpack-extractor/section-analysis-service.ts | OK (fixed: contract format + enum whitelist) |
| merge to user.dat | section-analysis-service.ts:mergeAnalysisToUserDat | OK |
| prompt usage | via personalClinicalContext + personalAnchors | OK |
| privacy exclusion | raw backpack NOT sent on minimal proxy path | OK |
| Raw sent to Railway | forceExtract sends raw sections for entity extraction | ACCEPTABLE (extraction only) |

---

## 7. Diary

| Aspect | Detail |
|--------|--------|
| Storage | @recofree_diary (encrypted) |
| Summary built | pipeline.ts:2960 buildDiarySummary |
| Prompt injection | diarySummary in promptInput → [RECENT DIARY CONTEXT] |
| Minimal proxy path | YES (wired in latest commit) |
| Legacy path | YES (via diaryEntries in gptPayload) |
| Tests | partial |
| Status | OK |

---

## 8. Module memory

| Aspect | Detail |
|--------|--------|
| Storage | AsyncStorage per persona per module |
| Writer | elias-module-memory.ts / module-memory-cross-session.ts |
| Reader | module selection priority |
| Prompt injection | NONE directly — influences module selection only |
| Debug visible | NO |
| Tests | NO dedicated tests |
| Status | UNTESTED — no debug visibility, no device verification |

---

## 9. CMD memory (Clinical Memory Distillation)

| Aspect | Detail |
|--------|--------|
| Selector | clinical-memory-budget-selector.ts |
| Summary | builds grouped NL text |
| Token budget | ~500 tokens max |
| Prompt injection | cmdMemorySummary → [SELECTED CLINICAL MEMORY] |
| Debug | CMD line in dropdown |
| Status | OK |

---

## 10. Rejected suggestions

| Aspect | Detail |
|--------|--------|
| Storage | session-only volatile (rejected-suggestion-guard.ts) |
| Writer | pipeline post-GPT detection |
| Reader | pipeline pre-GPT injection |
| Prompt injection | rejectedSuggestionsBlock → [REJECTED SUGGESTIONS] |
| Persistent? | NO — session only, resets on new session |
| Debug visible | YES (rejectedSuggestions line) |
| Tests | YES |
| Status | OK |

---

## CRITICAL P0/P1 FINDINGS

| # | Finding | Layer | Severity |
|---|---------|-------|----------|
| 1 | Post-GPT memory writeback (runMemoryWriteBack) runs ONLY on legacy path, NOT on minimal proxy | DIST01/projections | P1 |
| 2 | kim.selfCare slider is NEVER read — dead field | state.dat | P3 |
| 3 | Module memory has NO debug visibility and NO tests | module memory | P2 |
| 4 | Projections.dat has NO debug visibility | projections | P2 |
| 5 | contextDat lost on cold start (volatile cache) | context.dat | P2 |
| 6 | React state.userDat never updated with deep analysis | user.dat | P2 |
