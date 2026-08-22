# FORENSIC FULL CODEBASE SCAN — ClinicalCtx=false + LifeStatus/Deceased

**Date:** 2026-08-20
**Commit:** d6fb0863
**Status:** AUDIT ONLY — NO CODE CHANGES

---

## EXECUTIVE SUMMARY

ClinicalCtx=false persists on device because **two separate schema/mode systems exist** and `buildPersonalClinicalContext()` reads ONLY the canonical system that depends on a GPT call that likely fails silently on device.

| System | Source | Fields | Fills via | Works on device? |
|--------|--------|--------|-----------|-----------------|
| **schemaTendencies/modeTendencies** | backpack-analysis in user-context.tsx | `schemaTendencies[]`, `modeTendencies[]` | `callBackpackAnalysis()` → local pattern detection | YES (visible in dropdown) |
| **canonical schemas/modes/triggers** | section-analysis-service.ts | `schemas[]`, `modes[]`, `triggers[]` | `analyzeAllSections()` → GPT `/api/minimal-gpt-proxy` call | NO (ClinicalCtx=false) |

`buildPersonalClinicalContext()` reads ONLY canonical `schemas`/`modes`/`triggers`. It does NOT read `schemaTendencies`/`modeTendencies`. Therefore ClinicalCtx=false even though schemaTendencies are populated.

The deceased/lifeStatus bug has the same root cause: `lifeStatusFacts` is populated ONLY by `analyzeAllSections()`. If that GPT call fails, lifeStatus is never stored, and `buildPersonalAnchorsBlock()` cannot add "overleden" to the prompt.

---

## ROOT CAUSE ANALYSIS

### Why ClinicalCtx=false

**Primary hypothesis:** `analyzeAllSections()` calls `POST /api/minimal-gpt-proxy` on Railway. This call either:
1. Times out (Railway cold start, network latency on mobile)
2. Returns an error that is silently caught (lijn 170-171 in manual-data-refresh.ts: `catch (analysisErr) { console.warn(...) }`)
3. Returns valid JSON but `validateAndBuildResult()` rejects it
4. All sections are skipped by hash check (now fixed with `forceReanalyze`)

**Evidence:** User reports `Anchors: present=true` (extraction works) but `ClinicalCtx: present=false` (deep analysis doesn't). Extraction uses the SAME Railway endpoint (`/api/minimal-gpt-proxy` or tRPC). If extraction works but deep analysis doesn't, the difference is:
- Extraction: single call, simpler prompt, called BLOCKING
- Deep analysis: MULTIPLE calls (one per section), complex prompt, called in try/catch with silent failure

**Secondary hypothesis:** Even if one section succeeds, the hash is saved. On next refresh, that section is skipped. If other sections fail, only partial data is saved. If the successful section had no schemas (e.g. "Familie" section might produce lifeStatusFacts but no schemas), then schemas remain empty.

### Why deceased mother is treated as alive

1. `forceExtract()` extracts persons (name, relationship) but does NOT extract lifeStatus
2. `analyzeAllSections()` extracts lifeStatusFacts (person, status=deceased, confidence) but FAILS on device
3. `buildPersonalAnchorsBlock()` correctly adds "overleden" IF `lifeStatusFacts` exists in user.dat
4. Since analyzeAllSections fails → lifeStatusFacts is never populated → "overleden" never reaches prompt
5. GPT sees "Marie Louise Steegmans: moeder" without "overleden" → asks active relationship question

### Why CP1-CP4 are not visible

CP1-CP4 are `console.log()` statements only. On a production APK:
- `console.log` is NOT visible in the clinical dropdown
- `console.log` is NOT visible in any user-facing debug
- `console.log` requires ADB/Logcat connection which user doesn't have
- The clinical dropdown only shows fields from `clinicalInfo` object returned by `processMessage()`

---

## DATAFLOW TRUTH TABLE

| Step | File | Function | Canonical fields present? | LifeStatus present? | Debug visible? | Status | Risk |
|------|------|----------|--------------------------|--------------------:|----------------|--------|------|
| Backpack input | app/backpack screens | user types | N/A | Text contains "overleden" | N/A | OK | - |
| Extraction | manual-data-refresh.ts:139 | forceExtract() | NO | NO (not extracted) | NO | WORKS | Missing lifeStatus |
| schemaTendencies | user-context.tsx:471 | callBackpackAnalysis() | NO (different system) | NO | YES (dropdown) | WORKS | Not used by ClinicalCtx |
| analyzeAllSections | section-analysis-service.ts:659 | analyzeAllSections() | YES (if GPT succeeds) | YES (if GPT succeeds) | NO (console only) | LIKELY FAILS | Silent failure |
| mergeAnalysisToUserDat | section-analysis-service.ts:375 | mergeAnalysisToUserDat() | YES (writes to storage) | YES (writes to storage) | NO | OK if called | Never called if GPT fails |
| AsyncStorage write | section-analysis-service.ts:643 | mergeAnalysisToUserDat() | YES | YES | NO | OK | - |
| SessionMemoryCache write | section-analysis-service.ts:648 | mergeAnalysisToUserDat() | YES | YES | NO | OK | - |
| startSession | user-context.tsx:909 | startSession() | PRESERVED (reads latest) | PRESERVED | NO | FIXED | - |
| greeting | chat.tsx:707 | sendGreetingViaP() | PRESERVED (mergeToUserDatStorage) | PRESERVED | NO | FIXED | - |
| handleSend | chat.tsx:787 | handleSend() | READS from SessionMemoryCache | READS from SessionMemoryCache | NO | OK | - |
| buildPersonalClinicalContext | pipeline.ts:6504 | buildPersonalClinicalContext() | READS canonical schemas/modes/triggers | N/A (separate block) | YES (dropdown) | EMPTY | No data to read |
| buildPersonalAnchorsBlock | pipeline.ts:6064 | buildPersonalAnchorsBlock() | N/A | READS lifeStatusFacts | YES (Anchors line) | MISSING overleden | No lifeStatusFacts |
| openai-provider | openai-provider.ts | buildMinimalProxyPayload() | INCLUDED if present | INCLUDED via anchors | NO | OK | - |
| GPT response | Railway | /api/minimal-gpt-proxy | N/A | N/A | NO | OK | - |

---

## ALL USERDAT WRITE PATHS — SAFETY ASSESSMENT

| File | Line | Function | Pattern | Safe? | Reason |
|------|------|----------|---------|-------|--------|
| chat.tsx | 34 | mergeToUserDatStorage() | reads latest, merges partial | YES | Helper reads first |
| chat.tsx | 250,457,506,520,707,718,827,1201,1264,1471 | various | mergeToUserDatStorage() | YES | All use safe helper |
| section-analysis-service.ts | 643+648 | mergeAnalysisToUserDat() | reads from AsyncStorage, adds fields, writes back | YES | Additive only |
| manual-data-refresh.ts | 153-154 | runManualDataRefresh() | writes userDat with extractedEntities BEFORE deep analysis | SAFE | Deep analysis reads back and adds |
| pipeline.ts | 689,3253,4222 | DIST01 direct write | reads from SessionMemoryCache, adds persons, writes back | YES | Additive only |
| user-context.tsx | 182 | persistUserDat() | writes full object | DEPENDS | Safe if caller passes complete object |
| user-context.tsx | 927 | startSession() | reads latest from SessionMemoryCache first | YES | Fixed |
| user-context.tsx | 355,421,448,571,599,617,629,643,656,746,767,784,802,820,839,849,856,863,870,882,927,972,990 | various | builds updatedUserDat from state.userDat spread | UNSAFE | state.userDat never has deep analysis fields |

---

## FIX PLAN (PRIORITIZED)

### FIX 1 — P0: ClinicalCtx=false (analyzeAllSections silent failure)

**Root cause:** `analyzeAllSections()` GPT call fails silently on device. The `forceReanalyze` flag ensures it TRIES, but the call itself fails (timeout/error) and is caught silently.

**Minimal fix:** Make `buildPersonalClinicalContext()` ALSO read from `schemaTendencies`/`modeTendencies` as FALLBACK when canonical `schemas`/`modes`/`triggers` are empty. This ensures ClinicalCtx=true even when deep analysis GPT call fails, using the data that IS available.

**Files:** `lib/rugzak/pipeline.ts` (buildPersonalClinicalContext)
**Test:** ClinicalCtx=true when schemaTendencies populated but canonical schemas empty
**Device acceptance:** ClinicalCtx: present=true after Gegevens verversen

### FIX 2 — P0: CP1-CP4 visible in clinical dropdown

**Root cause:** CP1-CP4 are console.log only, not in clinicalInfo object.

**Minimal fix:** Add a `deepAnalysisDebug` field to clinicalInfo that shows: analysisRan, sectionsAnalyzed, sectionsSkipped, failures, schemasWritten, modesWritten, triggersWritten, lastError.

**Files:** `lib/rugzak/manual-data-refresh.ts` (store report), `lib/rugzak/pipeline.ts` (read and show in clinicalInfo)
**Test:** clinicalInfo.deepAnalysis shows counts
**Device acceptance:** Dropdown shows "DeepAnalysis: ran=true analyzed=3 schemas=2 modes=1"

### FIX 3 — P0: Deceased/lifeStatus application

**Root cause:** `forceExtract()` does not extract lifeStatus. Only `analyzeAllSections()` does, but that fails.

**Minimal fix (two-part):**
1. Add lifeStatus extraction to `forceExtract()` server prompt (persons should include status: alive/deceased)
2. Add deceased safety rule to CONTEXT_AWARE_APPLICATION_CONTRACT: "Never ask active relationship questions about persons marked as deceased/overleden"

**Files:** server extraction prompt, `lib/engine/shared/context-application-contract.ts`
**Test:** Deceased person in personalAnchors → GPT does not ask "hoe gaat het tussen jullie"
**Device acceptance:** "Hoe heet mijn moeder?" → names her, acknowledges/respects deceased status

### FIX 4 — P1: user-context.tsx persistUserDat unsafe spreads

**Root cause:** 20+ `persistUserDat()` calls in user-context.tsx build `updatedUserDat` from `{ ...state.userDat, ... }`. React state NEVER contains deep analysis fields.

**Minimal fix:** Replace `persistUserDat()` with a version that reads latest from SessionMemoryCache first (same pattern as `mergeToUserDatStorage` in chat.tsx).

**Files:** `lib/user-context.tsx`
**Test:** Deep analysis fields survive all persistUserDat calls
**Device acceptance:** ClinicalCtx remains true across session lifecycle

---

## STOPCONDITIES CHECK

| Condition | Status |
|-----------|--------|
| CP1-CP4 not visible | CONFIRMED — console.log only |
| analyzeAllSections not running on device | LIKELY — silent failure in catch block |
| GPT extraction fails silently | CONFIRMED for deep analysis path |
| canonical fields never produced | CONFIRMED on device |
| deceased status not extracted by forceExtract | CONFIRMED — not in extraction prompt |
| write path can overwrite stale userDat | YES — user-context.tsx persistUserDat |
| raw user.dat in prompt | NO — excluded |
| Kim/Elias data mixes | NO — separated |
| TS fails | NO — 0 errors |
| Tests fail | NO — 3792 pass |
