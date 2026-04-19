# Elias Deep Encapsulation Audit

**Date:** 2026-04-19
**Scope:** pipeline.ts, ai-chat.ts, and EliasDecision input chain files (state-analyzer, dominant-state-selector, engine, detector, module-system, openai-provider)
**Engine:** `lib/engine/elias/decision-layer.ts` — contains only an aggregation wrapper, no actual Elias logic

---

## Part A: Fully Clean Categories

**None.** Every searched category has findings. Elias is NOT encapsulated.

---

## Part B: Exact Remaining Elias Inline Logic

### B1. Hardcoded Elias Module IDs (E01–E08)

| File | Lines | Code | Severity |
|------|-------|------|----------|
| `lib/rugzak/pipeline.ts` | 296, 332, 787 | `'E02'` as Elias default fallback (3x) | **MEDIUM** |
| `lib/rugzak/dominant-state-selector.ts` | 86-93 | Trigger→module switch: craving→E01, isolation→E05, conflict→E04, boredom→E07, stress→E02, sleep→E02, trauma→E02, default→E02 | **MEDIUM** |
| `lib/rugzak/dominant-state-selector.ts` | 105-107 | Slider→module: craving→E01, despondency→E02, frustration→E04 | **MEDIUM** |
| `lib/rugzak/dominant-state-selector.ts` | 114 | `'E02'` as Elias default module | **MEDIUM** |
| `lib/rugzak/dominant-state-selector.ts` | 80 | `'E_CRISIS'` hardcoded Elias crisis module | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 311-325 | Signal/slider→module mapping (E01-E07) + E02 default | **MEDIUM** |
| `lib/rugzak/engine.ts` | 177-183 | Slider→module mapping (E01,E02,E03,E04,E05,E07) | **MEDIUM** |
| `lib/modules/module-system.ts` | 50-110 | Full ELIAS_MODULES array (8 TherapeuticModule objects) | **MEDIUM** |
| `lib/ai/openai-provider.ts` | 129 | `'E02'` as fallback dominant module | **LOW** |

**Total: 9 locations across 6 files with hardcoded Elias module IDs.**

### B2. Elias Distress/Resilience Formulas (Duplicated)

| File | Lines | Formula | Severity |
|------|-------|---------|----------|
| `lib/rugzak/pipeline.ts` | 948, 951 | `(craving + frustration + despondency) / 3` (historical sliders) | **MEDIUM** |
| `lib/rugzak/pipeline.ts` | 976 | Default mood: `{ craving: 0, frustration: 0, despondency: 0, focus: 5 }` | **MEDIUM** |
| `lib/rugzak/dominant-state-selector.ts` | 62 | `(craving + frustration + despondency) / 3` | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 54 | `(craving + frustration + despondency) / 3` | **MEDIUM** |
| `lib/crisis/detector.ts` | 36 | `(craving + frustration + despondency) / 3` | **MEDIUM** |

**Total: The same distress formula is duplicated 5x across 4 files.**

### B3. Elias Thresholds (Risk/Distress/Intervention)

| File | Lines | Threshold | Severity |
|------|-------|-----------|----------|
| `lib/rugzak/state-analyzer.ts` | 152 | `distress >= 7.5 && resilience <= 3` → risk high | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 153 | `distress >= 5.5 && primaryConcern >= 5.5` → risk moderate | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 157-161 | Multiple moderate risk thresholds | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 181 | `distress >= 6.5` → depleted tone | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 240, 243 | `primaryConcern > 6 && distress >= 6` → grounding tone | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 280, 288 | `distress >= 5.5`, `resilience <= 2` → suggestion intensity | **MEDIUM** |
| `lib/rugzak/state-analyzer.ts` | 311-321 | `craving >= 6`, `despondency >= 6`, `frustration >= 7`, `focus <= 3` → module selection | **MEDIUM** |
| `lib/rugzak/engine.ts` | 177-180 | `craving >= 6`, `despondency >= 6`, `frustration >= 7`, `focus <= 3` → module selection | **MEDIUM** |
| `lib/crisis/detector.ts` | 106, 112, 119, 123, 136 | `distress >= 6`, `resilience <= 1`, `craving >= 6`, `despondency >= 6`, `distress >= 5 && resilience <= 1` | **MEDIUM** |
| `server/ai-chat.ts` | 817, 820 | `riskScore >= 8 || maxDistress >= 9`, `riskScore >= 5 || maxDistress >= 7` → guidance depth | **MEDIUM** |
| `server/ai-chat.ts` | 1241 | `riskScore >= 7` → model routing | **MEDIUM** |

**Total: 20+ hardcoded thresholds across 4 files. None in the Elias engine.**

### B4. Inline Crisis Logic

| File | Lines | Code | Severity |
|------|-------|------|----------|
| `server/ai-chat.ts` | 782-785 | Elias crisis prompt text (inline in ternary) | **MEDIUM** |
| `server/ai-chat.ts` | 788 | Shared crisis level 1 text (inline) | **LOW** |
| `lib/crisis/detector.ts` | 119-124 | Elias-specific `extreme_craving` and `extreme_despondency` triggers | **MEDIUM** |

### B5. stageOfChange Branching

| File | Lines | Code | Severity |
|------|-------|------|----------|
| `server/ai-chat.ts` | 573-581 | `stageDescriptions` Record (5 stages) — duplicated | **LOW** |
| `server/ai-chat.ts` | 642-650 | `stageDescriptions` Record (5 stages) — duplicated | **LOW** |
| `lib/rugzak/pipeline.ts` | 216, 228, 430, 717, 729, 903, 915 | `'contemplation'` as default stageOfChange (7x) | **LOW** |

### B6. Elias Prompt Text / Content Blocks (bonus finding)

| File | Lines | Code | Severity |
|------|-------|------|----------|
| `server/ai-chat.ts` | 683-700+ | Full Elias identity prompt (inline) | **MEDIUM** |
| `server/ai-chat.ts` | 962-984 | Schema therapy instructions (Elias-only, inline) | **MEDIUM** |
| `server/ai-chat.ts` | 986-1004 | Stoa sessions list (Elias-only, inline) | **MEDIUM** |

---

## Part C: Final Conclusion

**Elias is NOT encapsulated.** The current `lib/engine/elias/decision-layer.ts` is an empty aggregation shell that calls into the scattered files — it does not contain any actual Elias logic.

### Summary by category

| Category | Status | Files affected | Instances |
|----------|--------|---------------|-----------|
| Hardcoded module IDs (E01-E08) | Scattered | 6 files | 30+ literals |
| Distress formula | Duplicated 5x | 4 files | 5 copies |
| Thresholds | Scattered | 4 files | 20+ thresholds |
| Crisis logic | Inline | 2 files | 3 blocks |
| stageOfChange | Inline defaults | 2 files | 9 instances |
| Prompt text/content | Inline | 1 file | 3 large blocks |

### Comparison with Kim

Kim encapsulation after MP1-15: **100% complete** — all Kim logic routes through `lib/engine/kim/`.
Elias encapsulation: **~0%** — `lib/engine/elias/` contains no actual logic, everything is inline.
