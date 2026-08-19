# FORENSIC AUDIT — ClinicalCtx=false After P0 Fix d3ee76e

**Date:** 2026-08-19
**Commit:** d3ee76e
**Status:** NO CODE CHANGES — audit only
**Runtime evidence:** `ClinicalCtx: present=false reason=no_deep_analysis_fields udKeys=41`

---

## 1. Runtime Dataflow: Gegevens bijwerken → Chat

### Phase A: Gegevens bijwerken (ManualDataRefreshButton → runManualDataRefresh)

| Step | File | Function | Action | Object state |
|------|------|----------|--------|-------------|
| A1 | manual-data-refresh.ts:123 | runManualDataRefresh | READ SessionMemoryCache('@recofree_userdat') | userDat loaded — **NO deep analysis fields** (schemas/modes/triggers absent) |
| A2 | manual-data-refresh.ts:139 | runManualDataRefresh | forceExtract() → extractedEntities | userDat.extractedEntities = entities (persons, events, patterns) |
| A3 | manual-data-refresh.ts:153 | runManualDataRefresh | WRITE SessionMemoryCache + AsyncStorage | userDat WITH extractedEntities but **WITHOUT schemas/modes/triggers** |
| A4 | section-analysis-service.ts:379 | mergeAnalysisToUserDat | READ AsyncStorage('@recofree_userdat') | Reads the A3 version — has extractedEntities, no deep analysis |
| A5 | section-analysis-service.ts:462-523 | mergeAnalysisToUserDat | MERGE schemas, modes, triggers, etc. | userDat NOW HAS schemas/modes/triggers/values/goals/risks |
| A6 | section-analysis-service.ts:642 | mergeAnalysisToUserDat | WRITE AsyncStorage | userDat WITH deep analysis fields ✅ |
| A7 | section-analysis-service.ts:648 | mergeAnalysisToUserDat | WRITE SessionMemoryCache | userDat WITH deep analysis fields ✅ |

**At this point, SessionMemoryCache contains the correct merged userDat with deep analysis fields.**

### Phase B: Context.dat Refresh (still inside runManualDataRefresh)

| Step | File | Function | Action | Object state |
|------|------|----------|--------|-------------|
| B1 | manual-data-refresh.ts:226 | runManualDataRefresh | READ local variable `userDat` | **STALE** — this is the A1/A3 version, NOT the A7 version. The local variable was never refreshed after analyzeAllSections() completed. |
| B2 | manual-data-refresh.ts:228-241 | runManualDataRefresh | distillContextDat(userDat) → serialize → write context_dat_cache | contextDat built from STALE userDat — deep analysis fields ABSENT from contextDat |

**Note:** This is a secondary issue (contextDat is stale) but NOT the primary cause of ClinicalCtx=false.

### Phase C: User Opens Chat Tab

| Step | File | Function | Action | Object state |
|------|------|----------|--------|-------------|
| C1 | user-context.tsx:909 | startSession() | READ state.userDat (React reducer state) | **STALE** — React state was never updated after Gegevens bijwerken. It still holds the pre-refresh version. |
| C2 | user-context.tsx:914-918 | startSession() | Build updatedUserDat = { ...state.userDat, totalSessions, lastSessionDate } | **STALE** — spread from state.userDat which has NO deep analysis fields |
| **C3** | **user-context.tsx:919** | **startSession()** | **WRITE persistUserDat(updatedUserDat) → SessionMemoryCache.set()** | **STALE OVERWRITE — deep analysis fields DESTROYED** |

**THIS IS THE PRIMARY ROOT CAUSE.**

`startSession()` at line 909 is called from `useFocusEffect` in chat.tsx line 417. It runs BEFORE `sendGreetingViaP()` at line 444. It takes `state.userDat` (React reducer state), spreads it into a new object with only `totalSessions` and `lastSessionDate` updated, and writes it to SessionMemoryCache via `persistUserDat()`.

Since `state.userDat` is React reducer state that was NEVER updated after `Gegevens bijwerken` (the refresh button only writes to AsyncStorage/SessionMemoryCache, not to the React reducer), this spread operation creates a userDat WITHOUT any deep analysis fields and overwrites the correct merged version in SessionMemoryCache.

### Phase D: handleSend() — User Sends Message

| Step | File | Function | Action | Object state |
|------|------|----------|--------|-------------|
| D1 | chat.tsx:767 | handleSend | READ SessionMemoryCache('@recofree_userdat') | Reads the C3 STALE version — no schemas/modes/triggers |
| D2 | pipeline.ts:3952 | processMessage | buildPersonalClinicalContext(currentUserDat, persona) | currentUserDat has no deep analysis fields → returns undefined |
| D3 | pipeline.ts:4323 | debug clinicalCtx | reason=no_deep_analysis_fields | ClinicalCtx: present=false ✅ matches observed behavior |

---

## 2. All @recofree_userdat Reads/Writes in Execution Order

| # | File:Line | Function | R/W | Source | Has deep analysis? | Can overwrite newer? |
|---|-----------|----------|-----|--------|--------------------|--------------------|
| 1 | manual-data-refresh.ts:123 | runManualDataRefresh | READ | SessionMemoryCache | NO | — |
| 2 | manual-data-refresh.ts:153 | runManualDataRefresh | WRITE | local userDat + extractedEntities | NO | YES — but acceptable at this point |
| 3 | section-analysis-service.ts:379 | mergeAnalysisToUserDat | READ | AsyncStorage | NO (reads #2 version) | — |
| 4 | section-analysis-service.ts:642 | mergeAnalysisToUserDat | WRITE | merged userDat | YES ✅ | — |
| 5 | section-analysis-service.ts:648 | mergeAnalysisToUserDat | WRITE | merged userDat | YES ✅ | — |
| **6** | **user-context.tsx:919** | **startSession()** | **WRITE** | **{ ...state.userDat }** | **NO ❌** | **YES — DESTROYS #5** |
| 7 | chat.tsx:688 | sendGreetingViaP | WRITE | greeting userDat | NO | YES — but after #6 already destroyed |
| 8 | chat.tsx:767 | handleSend | READ | SessionMemoryCache | NO (reads #6 version) | — |

---

## 3. Expected Property Paths vs Actual Structure

`buildPersonalClinicalContext()` checks these top-level properties:

| Property path | Expected type | Present after merge (#5)? | Present after startSession (#6)? |
|---------------|--------------|--------------------------|--------------------------------|
| userDat.schemas | Array | YES ✅ | NO ❌ |
| userDat.modes | Array | YES ✅ | NO ❌ |
| userDat.triggers | Array | YES ✅ | NO ❌ |
| userDat.protectiveFactors | Array | YES ✅ | NO ❌ |
| userDat.values | Array | YES ✅ | NO ❌ |
| userDat.goals | Array | YES ✅ | NO ❌ |
| userDat.risks | Array | YES ✅ | NO ❌ |
| userDat.recoveryPatterns | Array | YES ✅ | NO ❌ |
| userDat.caregiverPatterns | Array | YES ✅ | NO ❌ |
| userDat.developmentalFormulation | Array | YES ✅ | NO ❌ |
| userDat.triggerChains | Array | YES ✅ | NO ❌ |
| userDat.relapsePathways | Array | YES ✅ | NO ❌ |
| userDat.caregiverBurdenPathways | Array | YES ✅ | NO ❌ |
| userDat.functionOfAddiction | Array | YES ✅ | NO ❌ |
| userDat.functionOfCaregivingPattern | Array | YES ✅ | NO ❌ |
| userDat.contraindications | Array | YES ✅ | NO ❌ |
| userDat.safeFormulationHints | Array | YES ✅ | NO ❌ |

---

## 4. Why Visible Response Shows Schemas/Modes While ClinicalCtx=false

The visible 5 schemas and 4 modes in the GPT response come from a DIFFERENT path:

- `triggerBackpackAnalysisIfNeeded()` in `lib/backpack-analysis/schema-mode-trigger.ts` runs at session start (chat.tsx line 435)
- This writes `schemaTendencies` and `modeTendencies` to userDat — NOT `schemas` and `modes`
- These tendencies are used by the schema-mode engine (`schemaModeResult`) which feeds into the prompt via a separate block
- `buildPersonalClinicalContext()` checks `userDat.schemas` (from deep section analysis), NOT `userDat.schemaTendencies` (from backpack analysis)

Therefore: schema/mode content appears in GPT output via schemaTendencies, but ClinicalCtx reports no_deep_analysis_fields because the deep analysis `schemas` array was destroyed by the stale overwrite.

---

## 5. SessionMemoryCache Implementation Confirmation

- `get()`: returns exact stored string from in-memory map when unlocked, falls back to encrypted disk read when locked
- `set()`: stores full string value unchanged in RAM when unlocked, writes encrypted when locked
- **No field filtering, normalization, cloning, or nested-property stripping**
- The cache itself is NOT the problem

---

## 6. Exact Root Cause

**`startSession()` in `user-context.tsx:909-920` performs a STALE OVERWRITE.**

It builds `updatedUserDat` from `{ ...state.userDat }` (React reducer state) which was NEVER updated after `Gegevens bijwerken`. The spread creates a new object that includes only the fields present in React state — which does NOT include any deep analysis fields (schemas, modes, triggers, etc.) because those were written directly to AsyncStorage/SessionMemoryCache by `mergeAnalysisToUserDat()`, bypassing the React reducer.

This stale object is then written to SessionMemoryCache via `persistUserDat()`, destroying the correct merged version.

---

## 7. Minimal Scoped Fix Required

**Option A (smallest change, recommended):**
In `startSession()` (user-context.tsx:909-920), instead of spreading from `state.userDat`, read the LATEST userDat from SessionMemoryCache first, then apply the session updates:

```typescript
const startSession = useCallback(async () => {
  dispatch({ type: 'START_SESSION' });
  if (state.backpack && state.userDat) {
    const rugzak = composeRugzak(state.backpack, state.userDat);
    const updated = startNewSession(rugzak);
    // Read LATEST from storage to preserve deep analysis fields
    let latestUserDat = state.userDat;
    try {
      const udJson = await SessionMemoryCache.get(USERDAT_KEY);
      if (udJson) latestUserDat = JSON.parse(udJson);
    } catch { /* fallback to state */ }
    const updatedUserDat: UserDat = {
      ...latestUserDat,
      totalSessions: updated.totalSessions,
      lastSessionDate: updated.lastSessionDate,
    };
    await persistUserDat(updatedUserDat);
  }
}, [state.backpack, state.userDat]);
```

**Option B (broader but safer long-term):**
After `runManualDataRefresh()` completes, reload userDat from SessionMemoryCache into React state via `dispatch({ type: 'SET_USERDAT', payload: freshUserDat })`. This ensures all subsequent React state spreads include deep analysis fields.

**Recommendation:** Option A is the smallest scoped fix. Option B prevents the same class of bug in `endSessionWithRugzak()` and other functions that spread from `state.userDat`.

---

## 8. Secondary Issue: contextDat Built from Stale Local Variable

In `runManualDataRefresh()` line 226, `distillContextDat()` uses the local `userDat` variable which was loaded at line 123 and never refreshed after `analyzeAllSections()`. This means contextDat is built WITHOUT deep analysis fields even though they exist in storage.

**Fix:** After `analyzeAllSections()` completes (line 168), re-read userDat from SessionMemoryCache/AsyncStorage before building contextDat.

---

**NO CODE CHANGES MADE IN THIS AUDIT.**
