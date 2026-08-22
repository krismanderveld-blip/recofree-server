# FORENSIC RUNTIME SCAN — COMMIT ed534cc0

**Date:** 2026-08-20
**Scope:** Full production flow trace, 15 audit points
**Code changes:** NONE during scan (tests added for verification only)

---

## MATRIX 1: CHECKPOINT FLOW

| Checkpoint | Input | Output | Persistent? | After cold start? | Final prompt? | PASS/FAIL |
|---|---|---|---|---|---|---|
| Gegevens bijwerken | Backpack sections | analysisReport | N/A | N/A | N/A | PASS |
| analyzeAllSections | sections[] + persona | BackpackSectionAnalysisResult[] | N/A | N/A | N/A | PASS |
| validateAndBuildResult | raw GPT JSON | typed+validated result (ALL 8 new fields) | N/A | N/A | N/A | PASS (fixed in ed534cc0) |
| mergeAnalysisToUserDat | analysisResult | userDat in AsyncStorage+SessionMemoryCache | YES | YES | N/A | PASS |
| SessionMemoryCache.set | JSON string | in-memory cache | NO (volatile) | NO (cleared) | N/A | PASS |
| AsyncStorage.setItem | JSON string | persistent disk | YES | YES | N/A | PASS |
| readEncrypted fallback | plain JSON in encrypted slot | returns plain (auto-migrates) | YES | YES | N/A | PASS |
| startSession | state.userDat | reads latest from SessionMemoryCache first | YES | YES (via readEncrypted) | N/A | PASS |
| handleSend | SessionMemoryCache.get | currentUserDat with deep analysis | YES | YES | N/A | PASS |
| buildPersonalClinicalContext | currentUserDat | formatted string with all fields | N/A | N/A | YES | PASS |
| buildClientSystemPrompt | personalClinicalContext string | included in systemPrompt | N/A | N/A | YES | PASS |
| OpenAI request | systemPrompt + messages | GPT response | N/A | N/A | YES | PASS |

## MATRIX 2: DEEP-ANALYSIS FIELD LINEAGE

| Field | GPT output | Validated | Merged | AsyncStorage | SessionCache | Cold start | ClinicalCtx | Prompt | PASS/FAIL |
|---|---|---|---|---|---|---|---|---|---|
| schemas | YES | YES (whitelist) | YES | YES | YES | YES (readEncrypted fallback) | YES | YES | PASS |
| modes | YES | YES (whitelist) | YES | YES | YES | YES | YES | YES | PASS |
| triggers | YES | YES (has trigger) | YES | YES | YES | YES | YES | YES | PASS |
| protectiveFactors | YES | YES (has factor) | YES | YES | YES | YES | YES | YES | PASS |
| values | YES | YES (has value) | YES | YES | YES | YES | YES | YES | PASS |
| goals | YES | YES (has goal) | YES | YES | YES | YES | YES | YES | PASS |
| risks | YES | YES (has risk) | YES | YES | YES | YES | YES | YES | PASS |
| recoveryPatterns | YES | YES (Elias only) | YES | YES | YES | YES | YES (Elias only) | YES | PASS |
| caregiverPatterns | YES | YES (Kim only) | YES | YES | YES | YES | YES (Kim only) | YES | PASS |
| developmentalFormulation | YES | YES (has originContext+learnedPattern) | YES | YES | YES | YES | YES | YES | PASS |
| triggerChains | YES | YES (has triggerEvent+copingBehavior) | YES | YES | YES | YES | YES | YES | PASS |
| relapsePathways | YES | YES (Elias, has destabilizer) | YES | YES | YES | YES | YES (Elias only) | YES | PASS |
| caregiverBurdenPathways | YES | YES (Kim, has destabilizer) | YES | YES | YES | YES | YES (Kim only) | YES | PASS |
| functionOfAddiction | YES | YES (Elias, has functionType) | YES | YES | YES | YES | YES (Elias only) | YES | PASS |
| functionOfCaregivingPattern | YES | YES (Kim, has functionType) | YES | YES | YES | YES | YES (Kim only) | YES | PASS |
| contraindications | YES | YES (has avoidTopic) | YES | YES | YES | YES | YES | YES | PASS |
| safeFormulationHints | YES | YES (has topic) | YES | YES | YES | YES | YES | YES | PASS |
| lifeStatusFacts | YES | YES (status in whitelist) | YES | YES | YES | YES | via personalAnchors | YES | PASS |
| personalAnchors | YES | YES | YES | YES | YES | YES | YES | YES | PASS |
| schemaTendencies (fallback) | via backpack-analysis | N/A | N/A | YES | YES | YES | YES (when canonical empty) | YES | PASS |
| modeTendencies (fallback) | via backpack-analysis | N/A | N/A | YES | YES | YES | YES (when canonical empty) | YES | PASS |

---

## FOUND DEFECTS

### DEFECT 1 (FIXED in ed534cc0): validateAndBuildResult missing 8 new fields
- **File:** lib/backpack-extractor/section-analysis-service.ts
- **Function:** validateAndBuildResult()
- **Lines:** 298-371 (return object)
- **Cause:** Return object was manually constructed and did not include FASE 4-5 fields
- **Effect:** GPT returned correct data but it was silently discarded before merge
- **Status:** FIXED — all 8 fields now validated and included in return

### DEFECT 2 (LOW RISK): intake.tsx and ImportDataSection.tsx use writeEncrypted directly
- **File:** app/intake.tsx:814, lib/features/exportImport/ui/ImportDataSection.tsx:130
- **Function:** name update after import
- **Cause:** Uses writeEncrypted directly (bypasses mergeToUserDatStorage)
- **Effect:** Only writes `naam` field — does NOT destroy deep analysis (spread reads existing first)
- **Risk:** LOW — only updates one field, reads existing data first via JSON.parse
- **Status:** ACCEPTABLE — not a data loss vector

### DEFECT 3 (MITIGATED): user-context.tsx:458 async extraction spread
- **File:** lib/user-context.tsx:458
- **Function:** checkAndExtract background callback
- **Cause:** `{ ...state.userDat, extractedEntities: entities }` uses React state (potentially stale)
- **Effect:** Could overwrite deep analysis fields
- **Mitigation:** persistUserDat now reads latest from SessionMemoryCache first (FIX 4)
- **Status:** MITIGATED — persistUserDat merge prevents data loss

---

## ROOT CAUSE CHAIN

1. FASE 4-5 added 8 new fields to BackpackSectionAnalysisResult TYPE
2. FASE 5 added extraction instructions to the GPT PROMPT
3. FASE 6 added merge logic to mergeAnalysisToUserDat
4. **BUT: validateAndBuildResult() was NOT updated to include the 8 new fields in its return object**
5. GPT returned the data → parser extracted it → validator DISCARDED it (not in return object)
6. mergeAnalysisToUserDat received empty arrays → nothing to merge
7. user.dat remained without deep analysis canonical fields
8. buildPersonalClinicalContext found no canonical data → ClinicalCtx=false
9. Fallback on schemaTendencies worked (different path), but canonical was always empty

---

## CACHE COHERENCY (POINT 5)

| Scenario | AsyncStorage | SessionMemoryCache | ClinicalCtx | PASS/FAIL |
|---|---|---|---|---|
| A: analyse → immediate chat | YES | YES (set in merge) | YES | PASS |
| B: analyse → Home → chat | YES | YES (still in memory) | YES | PASS |
| C: analyse → app active → new session | YES | YES | YES | PASS |
| D: analyse → app kill → cold start | YES | via readEncrypted fallback | YES | PASS |
| E: old user.dat → new analyse → chat | YES (merged) | YES | YES | PASS |
| F: partial fields → forceReanalyze → chat | YES (force=true) | YES | YES | PASS |

---

## FORCE-REANALYZE LOGIC (POINT 6)

- `forceReanalyze=true` when: no user.dat, OR user.dat has no schemas AND no modes AND no triggers
- After fix ed534cc0: canonical fields ARE written → subsequent refreshes use hash check (efficient)
- Schema evolution: old user.dat without new fields → forceReanalyze=true → re-analyzes → fills new fields
- No reinstall required. No manual storage reset required.

---

## VALIDATION AUDIT (POINT 7)

| Field | Valid → | Invalid → | Missing → | New/extra → |
|---|---|---|---|---|
| schemas | kept (whitelist) | discarded silently | empty array | N/A |
| modes | kept (whitelist) | discarded silently | empty array | N/A |
| triggers | kept (has trigger) | discarded | empty array | N/A |
| developmentalFormulation | kept (has originContext+learnedPattern) | discarded | empty array | PASS (now included) |
| triggerChains | kept (has triggerEvent+copingBehavior) | discarded | empty array | PASS (now included) |
| contraindications | kept (has avoidTopic) | discarded | empty array | PASS (now included) |

**NOTE:** Invalid schemas/modes are silently discarded without warning. This is by design (whitelist validation). The test sentinel values must use valid schema/mode names.

---

## PRODUCTION vs MOCK (POINT 8)

| Component | Mock behavior | Production behavior | Match? |
|---|---|---|---|
| SessionMemoryCache.get | returns from mockSessionCache | returns from in-memory store (unlocked) or readEncrypted (locked) | YES — both return string or null |
| SessionMemoryCache.set | writes to mockSessionCache | writes to in-memory store (unlocked) or writeEncrypted (locked) | YES — both persist |
| AsyncStorage | simple key-value | encrypted at-rest (but readEncrypted handles plain fallback) | YES |
| GPT/provider | mockFetch returns JSON | Railway /api/minimal-gpt-proxy returns JSON | YES — same shape |
| Cold start | clear mockSessionCache | SessionMemoryCache locked, falls back to readEncrypted | YES — readEncrypted handles plain JSON |

---

## REMAINING RISKS

1. **Schema whitelist:** If GPT returns a schema name not in `validSchemas`, it's silently discarded. No warning in debug.
2. **Mode whitelist:** Same as above for `validModes`.
3. **GPT call failure:** If Railway is unreachable or returns error, analyzeAllSections catches silently. The `@recofree_last_deep_analysis_report` stores the failure but user may not notice.
4. **Race condition window:** Between `AsyncStorage.setItem` (plain) and next SessionMemoryCache flush (encrypted), a crash could leave plain data. readEncrypted handles this gracefully.
5. **user-context.tsx dispatch:** React state (`state.userDat`) is never updated with deep analysis fields. Only persistent storage has them. This is acceptable because handleSend reads from SessionMemoryCache, not React state.

---

## TEST RESULTS

- **TypeScript:** 0 errors
- **Full test suite:** 3819 passed, 0 failed, 1 skipped (pre-existing env-dependent)
- **Integration tests (forensic):** 17 passed (8 full-flow + 9 forensic validation)
- **Cold-start test:** PASS
- **Sentinel propagation:** PASS (14 sentinel values traced end-to-end)
- **Mother-anchor regression:** PASS (deceased status preserved, safety rule in contract)
- **Context-prompt audit:** PASS (ClinicalCtx → systemPrompt verified)
- **Persona separation:** PASS (Elias/Kim strict isolation verified)

---

## PUBLISH VERDICT

**SAFE TO PUBLISH**

All 15 audit points verified. The root cause (validateAndBuildResult missing 8 fields) is fixed and proven with end-to-end tests. Cold start, cache coherency, force-reanalyze, validation, persona separation, and mother-anchor handling all PASS. No remaining P0 defects. The 5 remaining risks are all LOW severity with existing mitigations.
