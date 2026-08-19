# DATA CONTRACT REGRESSION AUDIT — POST P0 FIX 9ff057b

**Datum:** 2026-08-19
**Scope:** Read-only forensic audit — zero code changes
**Commit:** `9ff057b` (HEAD after P0 field name fix)
**Doel:** Volledige producer→consumer data-contract check op silent data loss, veldnaam-mismatches, en ontbrekende flows.

---

## 1. AUDIT METHODOLOGIE

Elke data-item is getraceerd door de volledige keten:

```
Producer → Storage → Consumer → Prompt Builder → GPT Payload → OpenAI
```

Per item is gecontroleerd:
- Veldnaam bij schrijven vs. veldnaam bij lezen
- Of data daadwerkelijk in de prompt terechtkomt
- Of tests de volledige flow bewijzen of alleen helpers
- Of silent failure mogelijk is (geen error, geen warning, data verdwijnt)

---

## 2. MASTER TRUTH TABLE

| # | Data Item | Producer | Field Written | Stored In | Consumer | Field Read | Match? | Reaches GPT? | Test Exists? | Silent Failure Risk | Priority |
|---|-----------|----------|---------------|-----------|----------|------------|--------|-------------|-------------|-------------------|----------|
| 1 | extractedEntities.persons | server extractEntities + DIST01 direct write | `persons[].name, .relationship, .relationshipNL` | user.dat.extractedEntities.persons | buildPersonalAnchorsBlock() | `.name, .relationshipNL \|\| .relationship \|\| .role` | MATCH | YES via [PERSONAL ANCHORS] | YES (unit) | LOW | OK |
| 2 | personalAnchors | buildPersonalAnchorsBlock() | string block | ChatContext.personalAnchors | client-system-prompt-builder | `input.personalAnchors` | MATCH | YES | YES (unit) | LOW | OK |
| 3 | relationGraph | section-analysis-service | `edge.subjectPerson, .relation, .objectPerson` | user.dat.relationGraph | buildPersonalAnchorsBlock() | `.subjectPerson, .relation, .objectPerson` | MATCH | YES (enriches anchors) | YES (unit) | LOW | OK |
| 4 | lifeStatusFacts | section-analysis-service | `fact.person, .status` | user.dat.lifeStatusFacts | buildPersonalAnchorsBlock() | `.person, .status` | MATCH | YES (adds "overleden") | YES (unit) | LOW | OK |
| 5 | schemas | section-analysis-service | `s.schema` | user.dat.schemas | buildPersonalClinicalContext() | `s.schema \|\| s.schemaName` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 6 | modes | section-analysis-service | `m.mode` | user.dat.modes | buildPersonalClinicalContext() | `m.mode \|\| m.modeName` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 7 | triggers | section-analysis-service | `t.trigger` | user.dat.triggers | buildPersonalClinicalContext() | `t.trigger \|\| t.triggerDescription` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 8 | protectiveFactors | section-analysis-service | `p.factor` | user.dat.protectiveFactors | buildPersonalClinicalContext() | `f.factor \|\| f.description` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 9 | values | section-analysis-service | `v.value` | user.dat.values | buildPersonalClinicalContext() | `v.value \|\| v.valueName` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 10 | goals | section-analysis-service | `g.goal` | user.dat.goals | buildPersonalClinicalContext() | `g.goal \|\| g.goalDescription` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 11 | risks | section-analysis-service | `r.risk` | user.dat.risks | buildPersonalClinicalContext() | `r.risk \|\| r.riskDescription` | **FIXED (was MISMATCH)** | YES (after P0 fix) | YES (12 tests) | LOW (after fix) | **FIXED** |
| 12 | recoveryPatterns | section-analysis-service | `p.type, p.description` | user.dat.recoveryPatterns | **NO CONSUMER** | N/A | N/A | **NO** | NO | **HIGH — stored but never read** | P2 |
| 13 | caregiverPatterns | section-analysis-service | `p.type, p.description` | user.dat.caregiverPatterns | **NO CONSUMER** | N/A | N/A | **NO** | NO | **HIGH — stored but never read** | P2 |
| 14 | contextDatSerialized | context-dat-distiller | serialized string | volatile session cache | openai-provider → prompt builder | `input.contextDatSerialized` | MATCH | YES (SESSION_INIT + cache) | YES (unit) | MEDIUM — cache miss = no contextDat | P2 |
| 15 | personalClinicalContext | buildPersonalClinicalContext() | string block | ChatContext | openai-provider → prompt builder | `input.personalClinicalContext` | MATCH (after P0 fix) | YES | YES (12 tests) | LOW | **FIXED** |
| 16 | CMD selected memory | CMD runtime → budget selector | summary string | ChatContext.cmdMemorySummary | client-system-prompt-builder | `input.cmdMemorySummary` | MATCH | YES via [SELECTED CLINICAL MEMORY] | YES (unit) | LOW | OK |
| 17 | rejectedSuggestions | rejected-suggestion-guard | session-only list | volatile memory | openai-provider builds block | `buildRejectedSuggestionsBlock()` | MATCH | YES via [REJECTED SUGGESTIONS] | YES (unit) | LOW | OK |
| 18 | kimFormulationBlock | Kim relational formulation engine | string block | ChatContext.kimFormulationBlock | openai-provider → prompt builder | `input.kimFormulationBlock` | MATCH | YES (Kim only) | YES (unit) | LOW | OK |
| 19 | eliasFormulationBlock | Elias recovery formulation engine | string block | ChatContext.eliasFormulationBlock | openai-provider → prompt builder | `input.eliasFormulationBlock` | MATCH | YES (Elias only) | YES (unit) | LOW | OK |
| 20 | relationalStanceDirective | Kim stance filter + depth resolver | string | ChatContext.relationalStanceFilter | openai-provider → prompt builder | `input.relationalStanceDirective` | MATCH | YES (Kim only) | YES (unit) | LOW | OK |
| 21 | ageCategory | age-category-foundation.ts | `AGE_CATEGORY = 'adult_18_plus'` | constant (not stored) | **NO CONSUMER in prompt** | N/A | N/A | **NO — not injected into prompt** | NO | **MEDIUM — exists as constant but never reaches GPT** | P2 |
| 22 | projectionContext | projection-layer | `projectionResult.injectionBlock` | ChatContext.projectionContext | openai-provider → prompt builder | `input.projectionContext` | MATCH | YES (when projection active) | YES (unit) | LOW | OK |
| 23 | VSP/ERP context | vspInsightPipelineLayer | insight context string | ChatContext | openai-provider (legacy path) | via gptPayload | MATCH | YES (legacy path) | YES (unit) | LOW | OK |
| 24 | state.dat (mood sliders) | pipeline mood extraction | `currentMood.*` | user.dat.currentMood | openai-provider → signals | `state.dat` labels | MATCH | YES (via signal injection) | YES (unit) | LOW | OK |
| 25 | projections.dat | GptSignalEngine | `fears[], hopes[], goals[]` | projections store | openai-provider → signals | `.keyword, .confidence` | MATCH | YES (via signal injection) | YES (unit) | LOW | OK |
| 26 | diary summaries | pipeline diary extraction | `diaryEntries[].content` | ChatContext.diaryEntries | gpt-payload-builder (legacy) | `.content` | MATCH | YES (legacy path, SESSION_INIT) | PARTIAL | LOW | OK |
| 27 | mood sliders | pipeline | `moodSliders{}` | ChatContext.moodSliders | openai-provider → prompt builder | `input.moodSliders` | MATCH | YES | YES (unit) | LOW | OK |
| 28 | module memory | module-memory-cross-session | `ModuleMemoryState` | user.dat | evaluateModuleMemoryRepeat() | same type | MATCH | YES (via module routing) | YES (unit) | LOW | OK |
| 29 | distillationContext (DIST01) | detectDistillation + buildDistillationContext | JSON string | ChatContext.distillationContext | gpt-payload-builder (legacy) | `.distillationContext` | MATCH | YES (legacy path) | YES (unit) | LOW | OK |
| 30 | contextApplicationContract | CONTEXT_AWARE_APPLICATION_CONTRACT | constant string | composer output | client-system-prompt-builder | `sections.contextApplicationContract` | MATCH | YES (always, after P1 fix) | YES (7 tests) | LOW | **FIXED** |

---

## 3. NEWLY DISCOVERED ISSUES

### 3.1 recoveryPatterns / caregiverPatterns — STORED BUT NEVER CONSUMED (P2)

**Producer:** `section-analysis-service.ts` extracts `recoveryPatterns` (Elias) and `caregiverPatterns` (Kim) from deep analysis.

**Storage:** `mergeAnalysisToUserDat()` correctly writes them to `user.dat.recoveryPatterns` and `user.dat.caregiverPatterns`.

**Consumer:** No function anywhere in the pipeline reads `recoveryPatterns` or `caregiverPatterns` from user.dat. They are not included in `buildPersonalClinicalContext()`, not in `buildPersonalAnchorsBlock()`, not in any formulation engine, and not in any prompt builder.

**Impact:** Persona-specific deep analysis patterns are extracted and stored but silently discarded. No error, no warning.

**Classification:** P2 — data exists, no consumer, no runtime impact (just wasted extraction tokens).

**Fix:** Either add a consumer in `buildPersonalClinicalContext()` or remove from extraction to save tokens.

### 3.2 ageCategory — EXISTS BUT NOT INJECTED (P2)

**Producer:** `age-category-foundation.ts` defines `AGE_CATEGORY = 'adult_18_plus'` as a constant.

**Consumer:** No prompt builder, no composer, no formulation engine reads or injects this value.

**Impact:** The architectural foundation exists but has zero runtime effect. GPT does not know the user is 18+. This is low-impact because all current prompts implicitly assume adult communication, but it means the foundation built in FASE 6 (nachtwerk) is not yet connected.

**Classification:** P2 — architectural gap, no silent data loss, no runtime failure.

### 3.3 contextDatSerialized Cache Miss — SILENT DEGRADATION (P2)

**Producer:** `context-dat-distiller` builds contextDat at SESSION_INIT and caches it via `cacheContextDat()`.

**Consumer:** Follow-up messages call `getCachedContextDat(persona)`. If cache is empty (app restart, persona mismatch), `contextDatSerialized = undefined`.

**Impact:** Follow-up messages after app restart lose contextDat silently. The clinical dropdown shows `contextDat: present=false` but there is no explicit warning that context was lost due to cache miss vs. never built.

**Classification:** P2 — known design limitation (volatile cache), but no debug differentiation between "never built" and "cache expired".

### 3.4 Diary Summaries — LEGACY PATH ONLY (P3)

**Producer:** Pipeline extracts `diaryEntries` from options and passes to ChatContext.

**Consumer:** `gpt-payload-builder.ts` includes diary entries in the legacy GPT payload. The minimal proxy path (`client-system-prompt-builder.ts`) does NOT include diary content.

**Impact:** When `EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY=true` (current production), diary entries are NOT in the GPT prompt. They only appear in the legacy path.

**Classification:** P3 — diary feature is not widely used, but this is a silent omission in the minimal proxy path.

---

## 4. PRIVACY & SEPARATION GUARDS

### 4.1 Raw Data Exclusion

| Check | Status | Evidence |
|-------|--------|----------|
| Raw Backpack absent from minimal proxy | PASS | `minimalRequest` contains only `systemPrompt` + `messages` — no backpack field |
| Raw user.dat absent from minimal proxy | PASS | No `userDat` field in `MinimalGptProxyRequest` |
| Raw DIST01/logs absent from minimal proxy | PASS | No distillation/logs field in minimal request |
| Raw birthDate absent from prompt | PASS | No birthDate reference in `client-system-prompt-builder.ts` |
| store:false in minimal proxy | PASS | Line 104 in `server/minimal-gpt-proxy.ts`: `store: false` hardcoded |
| store:false in extraction (OpenAI fallback) | PASS | Line 332 in `server/_core/llm.ts`: `payload.store = false` |
| store:false in section analysis | PASS | Section analysis calls `/api/minimal-gpt-proxy` which enforces store:false |

### 4.2 Persona Separation

| Check | Status | Evidence |
|-------|--------|----------|
| recoveryPatterns only stored for Elias | PASS | Line 333: `persona === 'elias'` guard |
| caregiverPatterns only stored for Kim | PASS | Line 339: `persona === 'kim'` guard |
| Kim formulation block only for Kim | PASS | Pipeline: `kimFormulationBlock` only built when `backpack.userType === 'kim'` |
| Elias formulation block only for Elias | PASS | Pipeline: `eliasFormulationBlock` only built when `backpack.userType === 'elias'` |
| Kim Reality/Agency Guard only in Kim prompt | PASS | `composeKimPrompt` includes guard, `composeEliasPrompt` does not |
| No cross-persona data mixing in user.dat | PASS | Merge function uses `analysisResult.persona` to gate persona-specific patterns |
| DIST01 direct write uses same persona | PASS | `distPersona = backpack.userType` — no cross-write |

### 4.3 store:false Enforcement

| Route | store:false | Evidence |
|-------|------------|----------|
| `/api/minimal-gpt-proxy` | HARDCODED | `server/minimal-gpt-proxy.ts` line 104 |
| `/api/gpt-proxy` (legacy) | HARDCODED | `server/ai-chat.ts` lines 3153, 3334 |
| Extraction (OpenAI fallback) | HARDCODED | `server/_core/llm.ts` line 332 |
| Section analysis | INHERITED | Uses `/api/minimal-gpt-proxy` |

---

## 5. TEST COVERAGE ASSESSMENT

| Data Flow | Unit Test | Integration Test | Full Flow Test | Device Verified |
|-----------|----------|-----------------|---------------|----------------|
| extractedEntities.persons → personalAnchors → GPT | YES | YES | NO | YES (clean install) |
| deep analysis → user.dat → personalClinicalContext → GPT | YES (12 tests) | NO | NO | NO |
| contextDat → session cache → follow-up prompt | YES | NO | NO | NO |
| CMD → selector → summary → GPT | YES | NO | NO | NO |
| rejected suggestions → session block → GPT | YES | NO | NO | NO |
| Kim formulation → prompt → GPT | YES | NO | NO | NO |
| Elias formulation → prompt → GPT | YES | NO | NO | NO |
| DIST01 → distillation context → GPT (legacy) | YES | NO | NO | NO |
| mood sliders → signals → GPT | YES | NO | NO | NO |
| projections → signals → GPT | YES | NO | NO | NO |

**Observation:** All tests are unit-level. No integration test proves the full chain from AsyncStorage → pipeline → openai-provider → minimal-proxy → OpenAI. The 12 new P0 tests prove the field name resolution logic but use a replicated function, not the actual pipeline export.

---

## 6. CLINICAL DROPDOWN VISIBILITY

| Debug Field | Shown in Dropdown? | Source |
|------------|-------------------|--------|
| Module | YES | pipeline debug |
| Zone | YES | pipeline debug |
| Model (routing) | YES | epistemic routing |
| Regulation | YES | pipeline debug |
| Risk | YES | pipeline debug |
| Source nano_interpret | YES | pipeline debug |
| Triggers | YES | pipeline debug |
| Buffer | YES | pipeline debug |
| CMD flags | YES (after 8O-B1) | CMD debug |
| Epistemic flags | YES | epistemic debug |
| Cost estimate | YES | token cost tracker |
| Route (minimal/legacy) | YES | pipeline debug |
| contextDat present/absent | YES | pipeline debug |
| personalAnchors present/absent | **NOT SHOWN** | — |
| personalClinicalContext present/absent | **NOT SHOWN** | — |
| formulation block present/absent | PARTIAL (char count) | pipeline debug |
| rejectedSuggestions count | **NOT SHOWN** | — |
| recoveryPatterns/caregiverPatterns | **NOT SHOWN** | — |
| ageCategory | **NOT SHOWN** | — |

**Observation:** The clinical dropdown does not show whether `personalAnchors` or `personalClinicalContext` are present. After the P0 fix, it would be valuable to see `clinicalCtx: present=true schemas=2 modes=2 triggers=2` in the dropdown to confirm deep analysis data reaches GPT on device.

---

## 7. REMAINING FIELD NAME RISKS

After the P0 fix, a systematic scan for remaining `Name` / `Description` suffix patterns:

| Pattern | Location | Status |
|---------|----------|--------|
| `schemaName` | Only in P0 backwards compat fallback | SAFE — `s.schema \|\| s.schemaName` |
| `modeName` | Only in P0 backwards compat fallback | SAFE — `m.mode \|\| m.modeName` |
| `triggerDescription` | Only in P0 backwards compat fallback | SAFE — `t.trigger \|\| t.triggerDescription` |
| `valueName` | Only in P0 backwards compat fallback | SAFE — `v.value \|\| v.valueName` |
| `goalDescription` | Only in P0 backwards compat fallback | SAFE — `g.goal \|\| g.goalDescription` |
| `riskDescription` | Only in P0 backwards compat fallback | SAFE — `r.risk \|\| r.riskDescription` |
| `description` (protectiveFactors) | Only in P0 backwards compat fallback | SAFE — `f.factor \|\| f.description` |

No other field name mismatches found in the current codebase. The section-analysis-service writes consistent field names (`schema`, `mode`, `trigger`, `factor`, `value`, `goal`, `risk`) and the merge function in `mergeAnalysisToUserDat()` uses the same names for dedup checks.

---

## 8. SUMMARY OF FINDINGS

### FIXED in P0 (9ff057b):
- 7 field name mismatches in `buildPersonalClinicalContext()` — all 7 categories now reach GPT
- Pre-existing TS errors in `contextApplicationContractAlwaysActive.test.ts`

### PREVIOUSLY FIXED (still intact):
- `CONTEXT_AWARE_APPLICATION_CONTRACT` always active (P1 fix, d785096b)
- Extraction provider fallback (forge → OpenAI, ea67c043)
- Pipeline crash edge cases (dc18058b)
- Epistemic engine + model routing + cost tracker restored (9a353565)

### NEW FINDINGS — NO EXISTING CONSUMER:

| Item | Stored? | Consumer? | Reaches GPT? | Priority |
|------|---------|----------|-------------|----------|
| recoveryPatterns | YES | NO | NO | P2 |
| caregiverPatterns | YES | NO | NO | P2 |
| ageCategory | CONSTANT | NO | NO | P2 |

### NEW FINDINGS — SILENT DEGRADATION:

| Item | Issue | Priority |
|------|-------|----------|
| contextDat cache miss | No debug differentiation between "never built" and "cache expired" | P2 |
| diary entries | Not included in minimal proxy path | P3 |
| personalAnchors/clinicalContext visibility | Not shown in clinical dropdown | P2 |

### CONFIRMED SAFE:
- Raw Backpack excluded from minimal proxy
- Raw user.dat excluded from minimal proxy
- Raw DIST01/logs excluded from minimal proxy
- Raw birthDate excluded from prompt
- store:false hardcoded on all routes
- Kim/Elias persona separation intact
- No cross-persona data mixing
- All 30 items in truth table have consistent field names (after P0 fix)

---

## 9. PRIORITIZED ACTION LIST

| # | Item | Priority | Type | Effort |
|---|------|----------|------|--------|
| 1 | Add personalAnchors/personalClinicalContext to clinical dropdown | P2 | Debug visibility | Small |
| 2 | Add recoveryPatterns/caregiverPatterns consumer or remove from extraction | P2 | Data flow | Medium |
| 3 | Inject ageCategory into prompt builder | P2 | Integration | Small |
| 4 | Add diary entries to minimal proxy path | P3 | Feature gap | Medium |
| 5 | Differentiate contextDat "never built" vs "cache expired" in debug | P2 | Debug | Small |
| 6 | Add integration test proving full AsyncStorage→pipeline→prompt→GPT flow | P2 | Test coverage | Large |

---

**Geen code gewijzigd. Geen tests aangepast. Geen commit. Alleen audit.**

**Eindconclusie:** Na de P0 fix zijn alle 7 deep analysis categorieën correct gekoppeld. Er zijn 3 items die wel opgeslagen worden maar geen consumer hebben (recoveryPatterns, caregiverPatterns, ageCategory). Er zijn 2 silent degradation risico's (contextDat cache miss, diary in minimal proxy). Alle privacy/separation guards zijn intact. Geen nieuwe P0 of P1 issues gevonden.
