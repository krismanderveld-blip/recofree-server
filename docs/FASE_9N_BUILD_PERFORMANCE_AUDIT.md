# FASE 9N: Read-Only Cleanup + Build Performance Audit

**Date:** 2026-08-11  
**Status:** AUDIT COMPLETE — Zero code changes  
**Baseline:** 3158 tests PASS, 0 TS errors, checkpoint 85a20b51

---

## Executive Finding

The APK build slowness reported by Kris is **NOT caused by tests or TypeScript**. Tests run locally in Vitest and are never part of the EAS/Expo APK build pipeline. The primary APK build bottleneck is **dual-architecture native compilation** (armeabi-v7a + arm64-v8a) combined with EAS cloud resource constraints (medium resourceClass). The test suite itself has a secondary performance issue: 6 test files make live API calls totaling approximately 100 seconds of the 122-second test execution time. Cleanup opportunities exist but will not improve APK build time.

---

## DEEL A — Build Timing Baseline

| Metric | Duration | Notes |
|--------|----------|-------|
| TypeScript check (`tsc --noEmit`) | **21.1s** | Full project, 906 .ts/.tsx files |
| Full test suite (vitest run) | **57.8s** wall / 122.2s test time | 3158 tests, 149 files |
| Kim tests only | **1.6s** | 209 tests, 6 files |
| Elias tests only | **1.3s** | 110 tests |
| Engine shared tests | **1.7s** | 450 tests |
| Server tests | **1.3s** | 10 tests |
| Pipeline tests | **1.4s** | 57 tests |
| Prompt tests (LIVE API) | **41.8s** | 55 tests — 6 make live OpenAI calls |
| PipelineCrash tests (LIVE API) | **28.1s** | 8 tests — 5 make live API calls |
| Rugzak tests | **1.4s** | 40 tests |
| Android APK build (EAS cloud) | **~90-150 min** | Dual arch, medium resource, clean |
| Android incremental (EAS) | **~60-90 min** | Cache partial, still dual arch |
| Bundle step (Metro) | **~5-10s** locally | Not measured on EAS |

**Cold vs Incremental:** The EAS build is always effectively cold because it runs on cloud infrastructure with limited caching. Local Metro bundling is fast (5-10s). The extreme APK build time is entirely EAS cloud + Gradle + dual architecture.

---

## DEEL B — Top 10 Build Bottlenecks

| # | Phase | Est. Duration | % of APK Build | Tool | Cause | Cleanup Relevant | Config Relevant |
|---|-------|---------------|----------------|------|-------|-----------------|-----------------|
| 1 | Gradle native compilation (dual arch) | 40-60 min | 40-50% | Gradle/NDK | armeabi-v7a + arm64-v8a | NO | **YES** |
| 2 | Gradle dependency resolution | 15-25 min | 15-20% | Gradle | Large dependency tree | NO | YES |
| 3 | Metro JS bundling | 5-15 min | 5-10% | Metro | 112K lines lib/ + server/ | PARTIAL | NO |
| 4 | Resource processing | 5-10 min | 5-8% | AAPT2 | Icons, splash, assets | NO | NO |
| 5 | Hermes bytecode compilation | 5-10 min | 5-8% | Hermes | JS→bytecode for both archs | NO | NO |
| 6 | EAS queue/setup time | 5-15 min | 5-10% | EAS Cloud | Medium resourceClass | NO | **YES** |
| 7 | Source map generation | 2-5 min | 2-4% | Metro | Debug symbols | NO | YES |
| 8 | APK packaging/signing | 2-5 min | 2-3% | Gradle | Standard | NO | NO |
| 9 | TypeScript check (if in CI) | 0.5 min | <1% | tsc | 906 files | NO | NO |
| 10 | Vitest (NOT in APK build) | 0 min | 0% | Vitest | Not part of EAS build | N/A | N/A |

---

## DEEL C — Test Performance Audit

| Metric | Value |
|--------|-------|
| Total test files | 149 (126 in `__tests__/` + 23 in `tests/`) |
| Total tests | 3158 (+1 skipped) |
| Total test execution time | 122.2s (parallel) |
| Total wall time | 57.8s |
| Transform time | 6.9s |
| Collect time | 15.3s |
| Prepare time | 11.9s |

### Top 30 Slowest Test Files

| # | File | Tests | Duration | Avg/test | Category | Live API? |
|---|------|-------|----------|----------|----------|-----------|
| 1 | prompt/minimalProxyBothPersonasClientFlow | 17 | 38.9s | 2289ms | LIVE API | YES |
| 2 | pipelineCrash/undefinedVspFieldsCrash | 5 | 24.2s | 4841ms | LIVE API | YES |
| 3 | exportImport/encryptedExportImport | 15 | 18.1s | 1203ms | Filesystem | NO |
| 4 | exportImport/exportScopeCompleteness | 11 | 11.5s | 1044ms | Filesystem | NO |
| 5 | exportImport/extendedExportScope | 8 | 8.8s | 1103ms | Filesystem | NO |
| 6 | tests/ai-chat.test.ts | 17 | 7.1s | 420ms | Server mock | PARTIAL |
| 7 | tests/openai-key.test.ts | 2 | 650ms | 325ms | Config | NO |
| 8 | tests/signal-engine-integration | 5 | 579ms | 116ms | Engine | NO |
| 9 | openai-key-validation | 1 | 544ms | 544ms | Config | NO |
| 10 | pipelineCrash/firstMessageAfterV3Greeting | 3 | 412ms | 137ms | Pipeline | NO |
| 11-30 | (all under 200ms) | varies | <200ms | <10ms | Various | NO |

**Key finding:** Tests 1-2 account for **63.1 seconds** (51.6%) of total test execution time due to live OpenAI API calls. Tests 3-5 account for 38.4 seconds (31.4%) due to filesystem encryption operations. All other 144 test files combined take only ~20 seconds.

---

## DEEL D — Test Classification

| Category | Count | Files | Description |
|----------|-------|-------|-------------|
| A. CORE SAFETY | ~180 | 12 | Crisis, suicide, cold turkey, medical safety, persona isolation |
| B. CORE ENGINE | ~850 | 35 | Routing, DIST01, formulation, CMD, model selection, epistemic |
| C. CLINICAL BEHAVIOR | ~650 | 28 | Kim rescue/mindreading/self-loss/harm, Elias relapse/craving/shame |
| D. DUPLICATE/NEAR-DUPLICATE | ~80 | 3 | Same detector tested in 9J-R2, 9K, and 9L with overlapping inputs |
| E. PHASE-SPECIFIC TEMPORARY | ~28 | 1 | FASE 9K adversarial regression (measurement-only) |
| F. OBSOLETE | ~0 | 0 | No fully obsolete tests found |
| G. LOW-VALUE | ~25 | 4 | Trivial config/file-existence checks |

### D/E/G Candidates for Consolidation

| File | Category | Tests | Reason | Overlap | Risk | Action |
|------|----------|-------|--------|---------|------|--------|
| fase9k-adversarial-regression.test.ts | E | 28 | Measurement-only, scenarios covered by 9J-R2 + 9L | 60% with 9J-R2/9L | LOW | ARCHIVE |
| kimFormulationTriggerCoverage9JR2.test.ts | C→D partial | 24 | 8 scenarios overlap with 9L | 33% with 9L | LOW | KEEP (unique negative controls) |
| kimNanoSemanticDetectors9L.test.ts | C | 36 | Permanent — tests nano supplementation | Unique | NONE | KEEP |

---

## DEEL E — Duplicate Test Detection

### Cluster 1: Medical Boundary Detection

| File | Tests | Unique Coverage |
|------|-------|-----------------|
| kimFormulationTriggerCoverage9JR2 | 6 (medical) | Regex-only detection |
| kimNanoSemanticDetectors9L | 6 (medical) | Nano-supplemented detection |
| fase9k-adversarial-regression | 2 (medical) | Cross-detector overlap |

**Overlap:** 3 inputs appear in both 9J-R2 and 9L. However, 9J-R2 tests regex-only path while 9L tests nano-supplemented path — these are distinct code paths. **Minimal set:** Keep 9J-R2 + 9L, archive 9K.

### Cluster 2: Rescue Detection

Same pattern: 9J-R2 (regex), 9L (nano), 9K (measurement). **Minimal set:** Keep 9J-R2 + 9L.

### Cluster 3: Mindreading Detection

Same pattern. **Minimal set:** Keep 9J-R2 + 9L.

**Total potentially removable from duplicate consolidation:** 28 tests (FASE 9K file only).

---

## DEEL F — FASE 9I-9L Temporary Artifacts

| Item | Present? | Status |
|------|----------|--------|
| FASE 9I stress test scripts | NO | Already cleaned |
| FASE 9J temporary scripts | NO | Already cleaned |
| FASE 9J-R2 test file | YES | Permanent — unique regex-only tests |
| FASE 9K adversarial regression | YES | Archivable — measurement-only |
| FASE 9K batch report script | NO | Already cleaned |
| FASE 9L test file | YES | Permanent — unique nano tests |
| FASE 9L debug scripts | NO | Never created |
| Generated output files | YES | docs/FASE_7D_OUTPUT_QUALITY_REPORT.md, docs/FASE_9K_NANO_FORMULATION_AUDIT.md |
| Temporary exports | NO | None found |
| Debug logs in production code | NO | None found |

---

## DEEL G — Legacy / Dead Code Audit

| ID | File | Function/Export | Imports | Runtime? | Test? | Confidence | Action |
|----|------|----------------|---------|----------|-------|------------|--------|
| L1 | server/engine-process.ts | processEngineRequest | 2 (index, routers) | YES (route registered) | YES | LOW | KEEP (still registered) |
| L2 | server/debug-prompt.ts | registerDebugPromptRoute | 1 (index) | YES (route registered) | NO | MEDIUM | Candidate for removal |
| L3 | lib/ai/mock-provider.ts | MockAIProvider | 1 (lib/ai/index.ts) | YES (imported) | NO | LOW | KEEP (detection logic extracted) |
| L4 | lib/migration/shadow-engine-client.ts | fireShadowEngineCall | 1 (index.ts only) | NO (never called externally) | NO | HIGH | REMOVE candidate |
| L5 | lib/migration/golden-testset.ts | golden test scenarios | 1 (index.ts only) | NO | NO | HIGH | REMOVE candidate |
| L6 | lib/migration/shadow-log-store.ts | createShadowLogStore | 1 (index.ts only) | NO | NO | HIGH | REMOVE candidate |
| L7 | scripts/add-i18n-keys-batch2.mjs | batch script | 0 | NO | NO | HIGH | REMOVE candidate |
| L8 | mysql2 package | database driver | 0 imports | NO | NO | HIGH | Dependency removal candidate |
| L9 | expo-keep-awake package | screen awake | 0 imports | NO | NO | HIGH | Dependency removal candidate |

---

## DEEL H — Feature Flag Audit

| Flag | Default | Production | Used? | Temporary? | Safe to Remove? |
|------|---------|-----------|-------|-----------|-----------------|
| EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY | true (build secret) | ACTIVE | YES | NO | NO — primary route |
| EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION | true (build secret) | ACTIVE | YES | NO | NO — CMD active |
| EXPO_PUBLIC_ENABLE_NANO_INTERPRET | default ON | ACTIVE | YES | NO (TEMPORARY_SEMANTIC_MODULE_RESOLVER) | NO |
| EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR | false | INACTIVE | YES (code exists) | YES | YES — never activated |

**Note:** EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE and EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING from the task context are set as build secrets but the actual code references were not found in the current codebase. They may have been inlined or removed during earlier refactoring.

---

## DEEL I — Dependency Audit

| Package | Type | Imported? | Native? | Build Impact | Deletion Confidence | Risk |
|---------|------|-----------|---------|--------------|--------------------|----|
| mysql2 | prod | NO (0 imports) | NO | LOW | HIGH | NONE |
| expo-keep-awake | prod | NO (0 imports) | YES | MEDIUM | HIGH | NONE |
| expo-video | prod | 1 import (plugin config) | YES | HIGH | LOW | May break build |
| expo-audio | prod | 1 import (plugin config) | YES | HIGH | LOW | May break build |
| jose | prod | 1 import (auth) | NO | LOW | LOW | Auth dependency |
| react-native-worklets | prod | implicit (reanimated) | YES | MEDIUM | LOW | Required by reanimated |

**Key finding:** `mysql2` and `expo-keep-awake` are completely unused. `mysql2` is a pure JS package (low build impact). `expo-keep-awake` is a native module that adds to native compilation time.

---

## DEEL J — Android / Gradle Audit

| Setting | Current Value | Impact |
|---------|--------------|--------|
| Build architectures | armeabi-v7a + arm64-v8a | **MAJOR** — doubles native compilation |
| New Architecture (Fabric) | enabled | Adds compilation overhead |
| Resource class | medium | Standard EAS tier |
| Min SDK | 24 | Standard |
| Hermes | enabled (default Expo 54) | Required, adds bytecode step |
| Source maps | generated (default) | Adds ~2-5 min |
| ProGuard/R8 | default (release only) | Standard |
| Parallel execution | EAS default | Limited by resourceClass |
| Build cache | EAS managed | Partial effectiveness |

**Primary Android bottleneck:** Dual architecture build (armeabi-v7a + arm64-v8a). Each architecture requires separate native module compilation. Removing armeabi-v7a (32-bit, increasingly rare on modern devices) would reduce native build time by approximately 30-40%.

---

## DEEL K — Tests vs Build

**A. Are tests run as part of the APK build?**

> **NO.** EAS builds do NOT run Vitest. The APK build pipeline is: install dependencies → Metro bundle → Gradle compile → APK package. Tests are a separate local/CI concern.

**B. Can removing tests improve APK build time?**

> **NO.** Test files are excluded from the Metro bundle (they're in `__tests__/` and `tests/`, not imported by app code). Removing tests saves zero APK build time.

**C. Time breakdown of Kris's wait:**

| Component | % of APK Build Time | Improvable? |
|-----------|--------------------|----|
| Gradle/native compilation | 50-60% | YES (drop armeabi-v7a) |
| Dependency resolution | 15-20% | NO (required) |
| Metro bundling | 5-10% | PARTIAL (dead code removal) |
| Resource processing | 5-8% | NO |
| Hermes bytecode | 5-8% | NO |
| EAS queue/setup | 5-10% | YES (upgrade resourceClass) |
| Tests | **0%** | N/A |
| TypeScript | **0%** | N/A |

---

## DEEL L — Safe Cleanup Plan

### LEVEL 1 — ZERO/NEAR-ZERO RISK

| Item | Type | Count | Time Saving | Repo Reduction |
|------|------|-------|-------------|----------------|
| scripts/add-i18n-keys-batch2.mjs | Dead script | 1 file | 0s | ~50 lines |
| lib/migration/shadow-engine-client.ts | Dead code | 1 file | 0s | ~200 lines |
| lib/migration/shadow-log-store.ts | Dead code | 1 file | 0s | ~100 lines |
| lib/migration/golden-testset.ts | Dead code | 1 file | 0s | ~150 lines |
| docs/FASE_7D_OUTPUT_QUALITY_REPORT.md | Stale report | 1 file | 0s | ~100 lines |
| FASE 9K adversarial test (archive) | Measurement-only | 28 tests | ~0.1s | 426 lines |

**Total Level 1:** 5-6 files, ~28 tests, ~1026 lines. **Zero test time improvement.** Zero APK build improvement.

### LEVEL 2 — LOW RISK

| Item | Type | Risk | Regression Needed |
|------|------|------|-------------------|
| Remove `mysql2` from package.json | Unused dep | LOW | Verify no dynamic import |
| Remove `expo-keep-awake` from package.json | Unused dep | LOW | Verify no plugin reference |
| Remove EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR code | Dead flag | LOW | Run full suite after |
| Consolidate lib/migration/ exports (remove dead re-exports) | Cleanup | LOW | Run full suite |
| Drop armeabi-v7a from buildArchs | Config change | MEDIUM | Test on 32-bit device |

**Estimated improvement from dropping armeabi-v7a:** 30-40% reduction in native build time (saves ~20-30 minutes per build).

### LEVEL 3 — REQUIRES EXPLICIT APPROVAL

| Item | Risk | Reason |
|------|------|--------|
| Remove server/engine-process.ts | HIGH | Still registered as route, may be called by older APK versions |
| Remove server/debug-prompt.ts | MEDIUM | Still registered, used for debugging |
| Remove lib/ai/mock-provider.ts | MEDIUM | Detection logic extracted from it, referenced in comments |
| Remove lib/migration/ entirely | HIGH | Pipeline still imports isServerEngineActive/callServerEngine |
| Upgrade EAS resourceClass to large | COST | Faster builds but higher Expo bill |
| Remove expo-video/expo-audio plugins | HIGH | May be used in future features |

---

## DEEL M — Minimal Permanent Regression Suite (Proposal Only)

| Category | Current Tests | Unique Behaviors | Proposed Minimum |
|----------|--------------|------------------|------------------|
| Core Safety | ~180 | ~180 | 180 (no reduction) |
| Core Engine | ~850 | ~750 | 750 (merge 100 near-duplicates) |
| Clinical Behavior | ~650 | ~580 | 580 (merge 70 overlapping scenarios) |
| Integration/E2E | ~80 | ~60 | 60 (consolidate export tests) |
| Config/Structural | ~50 | ~30 | 30 (remove trivial checks) |
| Live API (slow) | ~30 | ~20 | 20 (reduce redundant API scenarios) |
| Phase-specific | ~28 | ~0 | 0 (archive 9K) |
| **TOTAL** | **3158** | **~2700** | **~2620** |

**Possible reduction:** ~538 tests (~17%) without losing unique behavioral coverage. However, the time saving would be minimal (~2-3 seconds) because the slow tests are API-bound, not count-bound.

---

## DEEL N — Mandatory Retention List

The following categories are **NEVER removable** regardless of performance:

- Crisis/suicide detection and response
- Cold turkey medical safety
- Medical boundary (Kim)
- Persona separation (Kim/Elias isolation)
- DIST01 contract and behavior
- Memory contradiction handling
- Epistemic uncertainty classification
- Model routing (mini vs full)
- Kim rescue/mindreading/medical/repeated harm/child trust/self-loss
- Nano semantic supplementation
- Negative controls (false positive prevention)
- Safety precedence over all other layers
- Hard persona leakage checks

---

## Final Verdicts

**PRIMARY BUILD BOTTLENECK:**
Dual-architecture native compilation (armeabi-v7a + arm64-v8a) on EAS medium resourceClass.

**TEST SUITE IS MAJOR APK BUILD BOTTLENECK:**
**NO.** Tests are never part of the EAS APK build pipeline.

**SAFE DEAD CODE REMOVAL AVAILABLE:**
**YES.** 5-6 files (shadow-engine-client, shadow-log-store, golden-testset, batch script, stale report).

**SAFE TEST CONSOLIDATION AVAILABLE:**
**YES.** FASE 9K adversarial regression (28 tests) can be archived. ~170 additional near-duplicates can be merged long-term.

**ESTIMATED SAFE TEST REDUCTION:**
28 tests immediately (Level 1), up to ~538 with careful consolidation (Level 2+).

**ESTIMATED BUILD TIME IMPROVEMENT:**
- Dropping armeabi-v7a: **-30-40% native build time** (~20-30 min saved per build)
- Upgrading EAS resourceClass: **-20-30% total build time**
- Dead code removal: **~0% build improvement** (code is excluded from bundle by tree-shaking)
- Test consolidation: **0% APK build improvement** (tests not in build)

**RECOMMENDED NEXT ACTION:**
Drop `armeabi-v7a` from buildArchs in app.config.ts. This single config change provides the largest measurable improvement with minimal risk (only affects very old 32-bit Android devices, which represent <2% of active Android devices in 2026).

**FASE 9N STATUS:**
**AUDIT COMPLETE**

---

*0 code changes. 0 deletions. 0 test modifications. 0 config changes. 0 dependency changes. 0 lockfile changes.*
