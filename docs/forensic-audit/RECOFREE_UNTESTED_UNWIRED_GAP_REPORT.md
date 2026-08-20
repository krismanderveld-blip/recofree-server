# RECOFREE — UNTESTED / UNWIRED / UNCHECKED GAP REPORT

**Date:** 2026-08-20
**Commit:** c1cfa8d7
**Tests:** 3912 pass, 0 TS errors

---

## P0 — PRIVACY BLOCKER

| # | Item | File | Impact |
|---|------|------|--------|
| 1 | **nano-interpret.ts MISSING store:false** | server/engine/nano-interpret.ts | User messages sent to OpenAI WITHOUT store:false — OpenAI may retain training data. Every nano call is a privacy violation. |

**Fix:** Add `store: false` to the fetch body in nano-interpret.ts line 438.

---

## P1 — UNTESTED PROMPT BLOCKS (28 blocks defined, never tested)

| Block | File | Risk |
|-------|------|------|
| ELIAS_IDENTITY_PROMPT | elias/prompt-block.ts | Identity could be wrong without test |
| KIM_CORE_IDENTITY | kim/prompt-block.ts | Identity could be wrong without test |
| CRISIS_NUMBERS_PROMPT | shared/ | Safety-critical — must always be present |
| SUICIDE_RISK_BRIDGE_PROMPT | shared/ | Safety-critical |
| RELAPSE_INTENT_PROMPT | elias/ | Clinical — wrong wording = harm |
| RELAPSE_INTENT_KIM_PROMPT | kim/ | Clinical — wrong wording = harm |
| SHAME_IDENTITY | elias/ | Clinical |
| RESPONSIBILITY_WITHOUT_IDENTITY | elias/ | Clinical |
| NAMING_IDENTITY | elias/ | Clinical |
| STOA_K_SYSTEM_PROMPT | kim/ | Module prompt |
| SIGNAL_DETECTION_PROMPT | shared/ | Engine input |
| RELEVANCE_SCORING_PROMPT | shared/ | Engine input |
| SUMMARIZE_CONTEXT_PROMPT | shared/ | Engine input |
| COMPACT_PROMPT / FULL_PROMPT | various | Module variants |
| EKT_CONTRACT | shared/ | Contract |
| PREVENTION_POINT_CONTRACT | shared/ | Contract |
| MICROTOOL_PROMPT | shared/ | Module prompt |
| MAX_CONTEXTS/SIGNALS/SYSTEM_PROMPT | shared/ | Constants |

**Risk:** These blocks are injected into GPT prompts but never tested for correct content, forbidden language, or persona separation.

---

## P1 — UNTESTED SCREENS (7 screens, 0 tests)

| Screen | Path | Risk |
|--------|------|------|
| Day Planning | app/(tabs)/day-planning.tsx | UI could crash |
| Day Structure Wizard | app/day-structure/wizard.tsx | Data loss |
| Debug Log | app/dev/debug-log.tsx | Low risk (dev only) |
| Theme Lab | app/dev/theme-lab.tsx | Low risk (dev only) |
| Eigen Regie Plan Wizard | app/eigen-regie-plan/wizard.tsx | Data loss |
| GDPR Consent | app/gdpr-consent.tsx | Legal compliance |
| Proposal History | app/proposal-history.tsx | UI could crash |

---

## P2 — I18N GAPS

| Metric | Count |
|--------|-------|
| Total NL keys defined | 1101 |
| Keys used in code | 993 |
| **Unused keys** | **363** |
| Keys used but not defined | ~15 (dynamic keys) |
| Hardcoded NL strings in UI | ~20 (mostly debug-log.tsx) |

**Notable unused key groups:**
- All `backpack.kim.*` keys (20+) — Kim backpack sections defined but UI may not use them
- `backpack.relapse.*` keys — relapse UI keys unused
- `_layout.error_boundary.*` — error boundary keys unused

---

## P2 — FEATURE FLAG COVERAGE

| Flag | Used | Tested | Status |
|------|------|--------|--------|
| EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY | 5x | Yes | OK |
| EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION | 3x | Yes | OK |
| EXPO_PUBLIC_ENABLE_NANO_INTERPRET | 4x | Yes | OK |
| EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE | **1x** | Partial | Single use — if flag name changes, silently disabled |
| EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING | **1x** | Partial | Single use |
| EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR | **1x** | No | Dead? Only 1 reference |

---

## P2 — STORAGE KEYS WITHOUT DEDICATED TESTS

| Key | Tested | Risk |
|-----|--------|------|
| @recofree_backpack | Indirect | Covered by integration tests |
| @recofree_userdat | Yes | Covered by multiple tests |
| @recofree_diary | **No** | Diary read/write not tested |
| @recofree_projection_elias | **No** | Projection persistence not tested |
| @recofree_projection_kim | **No** | Projection persistence not tested |
| @recofree_daystructure_v1 | **No** | Day structure persistence not tested |
| @recofree_daystructure_wizard_draft_v1 | **No** | Wizard draft persistence not tested |
| @recofree_daystructure_completion_v1 | **No** | Completion tracking not tested |
| @recofree_daystructure_streaks_enabled | **No** | Streaks not tested |
| @recofree_eigenregie_last_check | **No** | Eigen regie timing not tested |
| @recofree_country | **No** | Country detection not tested |
| @recofree_language | **No** | Language persistence not tested |
| @recofree_section_analysis_hashes | Indirect | Hash skip logic tested |
| @recofree_section_analysis_results | Indirect | Results tested |
| @recofree_last_deep_analysis_report | Yes | Report storage tested |
| @recofree_extracted_entities | Indirect | Extraction tested |
| @recofree_context_dat_cache | Yes | Cache tested |
| @recofree_manual_data_refresh | **No** | Refresh state not tested |

---

## P2 — PERSONA WIRING NOT FULLY VERIFIED

| Area | Elias tested | Kim tested | Cross-persona test |
|------|-------------|------------|-------------------|
| Deep analysis | Yes | Yes | **No** |
| personalAnchors | Yes | Partial | **No** |
| personalClinicalContext | Yes | Yes | Yes (release gate) |
| Formulation block | Yes | Yes | Yes |
| Module routing | Yes | Yes | **No** |
| K05 override | N/A | Yes | N/A |
| Relational stance | N/A | Yes | N/A |
| Diary summary | **No** | **No** | **No** |
| selfCare slider | N/A | **No** | N/A |
| ageCategory | Yes | Yes | **No** |

---

## P3 — CLEANUP (no runtime impact)

| Item | Count |
|------|-------|
| Console.log CHECKPOINT regels | 4 |
| Unused i18n keys | 363 |
| Hardcoded debug strings | ~20 |
| Legacy server files (frozen) | 19 |
| Dead feature flag (CLIENT_PROMPT_MIRROR) | 1 |

---

## SUMMARY — WHAT MUST BE DONE BEFORE NEXT PUBLISH

| Priority | Item | Effort |
|----------|------|--------|
| **P0** | nano-interpret.ts store:false | 1 line |
| **P1** | Test CRISIS_NUMBERS_PROMPT always present | 5 min |
| **P1** | Test SUICIDE_RISK_BRIDGE_PROMPT always present | 5 min |
| **P1** | Test ELIAS_IDENTITY_PROMPT correct content | 10 min |
| **P1** | Test KIM_CORE_IDENTITY correct content | 10 min |
| **P1** | Test diary read/write persistence | 15 min |
| **P1** | Test selfCare slider signal wiring | 10 min |
| **P2** | Test projection persistence | 15 min |
| **P2** | Test day structure persistence | 15 min |
| **P2** | Cross-persona deep analysis test | 10 min |
| **P3** | Remove 363 unused i18n keys | 30 min |
| **P3** | Remove 4 console.log checkpoints | 5 min |
