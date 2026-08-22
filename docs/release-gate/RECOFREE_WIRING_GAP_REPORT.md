# RECOFREE WIRING GAP REPORT

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## CRITICAL WIRING GAPS

### GAP-01: ELIAS_SHORT_MODULE_PROMPTS defined but NEVER injected (0 consumers)
- **File:** lib/engine/elias/short-module-prompts.ts
- **Impact:** Elias short module prompts exist as constants but are never included in the prompt builder
- **Severity:** P2 — prompts exist but GPT never receives them
- **Fix:** Wire into elias-prompt-composer.ts or remove if superseded

### GAP-02: KIM_OUTPUT_STRUCTURE_CONTRACT defined but NEVER injected (0 consumers)
- **File:** lib/engine/kim/prompt-block.ts
- **Impact:** Kim output structure contract exists but is never included in prompt
- **Severity:** P2 — contract exists but GPT never receives it
- **Fix:** Wire into kim-prompt-composer.ts or remove if superseded

### GAP-03: relationalHarmPatternActive hardcoded false (TODO in pipeline.ts:3994)
- **File:** lib/rugzak/pipeline.ts:3994
- **Code:** `const isHarm = false; // TODO: wire to relational stance filter harm detection`
- **Impact:** Relational harm detection NEVER activates in guidance depth resolver
- **Severity:** P1 — Kim cannot enforce minimum depth for harm patterns
- **Fix:** Wire to existing detectRelationalSignals() output

### GAP-04: lastProposalShownAt not tracked (TODO in pipeline.ts:4130)
- **File:** lib/rugzak/pipeline.ts:4130
- **Code:** `lastProposalShownAt: null, // TODO: track in session buffer`
- **Impact:** Proposal timing not tracked, may cause repetitive proposals
- **Severity:** P3 — cosmetic/UX issue

### GAP-05: existingDocumentKeys not extracted (TODO in pipeline.ts:4150)
- **File:** lib/rugzak/pipeline.ts:4150
- **Code:** `existingDocumentKeys: [], // TODO: extract from backpack/VSP/eigenRegie`
- **Impact:** DIST01 cannot check what documents user already has
- **Severity:** P3 — may cause duplicate document suggestions

### GAP-06: Diary entries in pipeline but NOT in minimal-proxy prompt
- **Evidence:** pipeline.ts:592 reads diaryEntries, but client-system-prompt-builder.ts does NOT include diary
- **Impact:** User writes diary but GPT never reads it in minimal-proxy path
- **Severity:** P1 — user data collected but not used
- **Fix:** Add diary summary to ClientPromptBuildInput and inject in prompt builder

### GAP-07: Legacy GPT proxy (/api/gpt-proxy) has NO store:false
- **File:** server/gpt-proxy.ts
- **Evidence:** grep "store" returns empty
- **Impact:** If fallback activates, OpenAI stores user data — PRIVACY VIOLATION
- **Severity:** P0 — privacy/MDR blocker
- **Fix:** Add store:false to generateAIResponse OpenAI call in legacy path, or disable fallback entirely

### GAP-08: Legacy server files have clinical logic (frozen but still callable)
- **Files:** server/ai-chat.ts, server/signal-engine.ts, server/engine-process.ts, server/k05-cross-module-override.ts
- **Impact:** Legacy routes still exist and can be called, violating client-first architecture
- **Severity:** P2 — architecture debt, not actively harmful if minimal-proxy flag is true

### GAP-09: Proposal History screen has no tests and unclear data source
- **File:** app/proposal-history.tsx
- **Impact:** May be broken, no way to verify without device test
- **Severity:** P2 — product completeness

### GAP-10: ageCategory system is dead — birthDate never collected
- **Evidence:** No UI input for birthDate in intake.tsx or any screen
- **Impact:** ageCategory always resolves to unknown_adult
- **Severity:** P1 — feature exists but is unreachable
- **Fix:** Either add birthDate to intake or document unknown_adult as intentional default

---

## SEARCH PATTERN RESULTS

| Pattern | Count | Risk | Files |
|---------|-------|------|-------|
| TODO/FIXME in production code | 4 | P2-P3 | pipeline.ts, prompt-redaction-guards.ts, server/db.ts |
| Silent catch blocks | 20+ files | P2 | chat.tsx, pipeline.ts, providers, etc. |
| return null/undefined | 20+ files | P2 | Various — most are safe optional returns |
| Hardcoded Dutch in prompts | 17 files | P2 | Engine modules, prompt builders |
| ...state.userDat spreads | 3 locations | **FIXED** | user-context.tsx (now uses mergeAndPersistUserDat) |
| Direct SessionMemoryCache.set(@recofree_userdat) | 3 in pipeline.ts | SAFE | All read latest first |
| schemaTendencies as fallback | 1 location | SAFE | buildPersonalClinicalContext (intentional fallback) |

---

## HALF-WIRED FEATURES

| Feature | What Exists | What's Missing | Severity |
|---------|-------------|----------------|----------|
| ageCategory | Resolver, prompt injection, 4 categories | birthDate input UI | P1 |
| Diary → GPT | Storage, UI, entries | Prompt injection in minimal-proxy path | P1 |
| relationalHarmPattern | Detector exists, depth resolver supports it | Wiring in pipeline (hardcoded false) | P1 |
| ELIAS_SHORT_MODULE_PROMPTS | Constant defined | Never injected into prompt | P2 |
| KIM_OUTPUT_STRUCTURE_CONTRACT | Constant defined | Never injected into prompt | P2 |
| Proposal History | Screen exists | No tests, unclear data flow | P2 |
| Projections | Storage, decay, types | Limited prompt consumption | P2 |
| Legacy GPT proxy | Route exists, fallback active | store:false missing | P0 |
