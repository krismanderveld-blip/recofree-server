# RECOFREE TOTAL SYSTEM INVENTORY

**Generated:** 2026-08-20 | **Commit:** e7769bbb | **Tests:** 3916 | **TS Errors:** 0

---

## 1. ALL SCREENS

| Screen | File | Route | Reachable | Persona | Data Required | Storage Keys | Actions | i18n | Tests |
|--------|------|-------|-----------|---------|---------------|--------------|---------|------|-------|
| Intake | app/intake.tsx | /intake | Yes (first launch) | Both | country, persona | @recofree_country | Select country, persona, start | Partial | Yes |
| Home | app/(tabs)/index.tsx | / | Yes (tab) | Both | userDat, sobriety | @recofree_userdat | View progress, milestones | Yes | Partial |
| Mood | app/(tabs)/mood.tsx | /mood | Yes (tab) | Both | mood sliders | @recofree_userdat | Submit mood, view trends | Yes | Partial |
| Diary | app/(tabs)/diary.tsx | /diary | Yes (tab) | Both | diary entries | @recofree_diary | Add/edit entries | Yes | Partial |
| Backpack | app/(tabs)/backpack.tsx | /backpack | Yes (tab) | Both | backpack sections | @recofree_backpack, @recofree_rugzak | Edit sections, Gegevens bijwerken | Yes | Yes |
| Day Planning | app/(tabs)/day-planning.tsx | /day-planning | Yes (tab) | Both | day structure | @recofree_daystructure_v1 | View/edit schedule | Yes | Partial |
| Chat | app/(tabs)/chat.tsx | /chat | Yes (tab) | Both | userDat, contextDat, backpack | Multiple | Send messages, view clinical debug | Yes | Yes |
| Profile | app/(tabs)/profile.tsx | /profile | Yes (tab) | Both | userDat, settings | @recofree_userdat | Settings, data refresh, export | Yes | Partial |
| Eigen Regie Plan | app/eigen-regie-plan/index.tsx | /eigen-regie-plan | Yes (navigation) | Both | ERP state | @recofree_userdat | View/edit plan | Yes | Partial |
| ERP Wizard | app/eigen-regie-plan/wizard.tsx | /eigen-regie-plan/wizard | Yes (navigation) | Both | ERP state | @recofree_userdat | Create/edit plan | Yes | Partial |
| ERP Triggers | app/eigen-regie-plan/triggers.tsx | /eigen-regie-plan/triggers | Yes (navigation) | Both | triggers | @recofree_userdat | Manage triggers | Yes | Partial |
| ERP Zone | app/eigen-regie-plan/zone.tsx | /eigen-regie-plan/zone | Yes (navigation) | Both | zone state | @recofree_userdat | View zone status | Yes | No |
| ERP Export | app/eigen-regie-plan/export.tsx | /eigen-regie-plan/export | Yes (navigation) | Both | ERP data | @recofree_userdat | Export plan | Yes | No |
| Day Structure Editor | app/day-structure/editor.tsx | /day-structure/editor | Yes (navigation) | Both | day structure | @recofree_daystructure_v1 | Edit activities | Yes | Partial |
| Day Structure Wizard | app/day-structure/wizard.tsx | /day-structure/wizard | Yes (navigation) | Both | day structure | @recofree_daystructure_v1 | Create schedule | Yes | Partial |
| Proposal History | app/proposal-history.tsx | /proposal-history | Yes (navigation) | Both | proposals | @recofree_userdat | View past proposals | Yes | No |
| GDPR Consent | app/gdpr-consent.tsx | /gdpr-consent | Yes (navigation) | Both | consent state | @recofree_userdat | Accept/reject | Yes | No |
| Debug Log | app/dev/debug-log.tsx | /dev/debug-log | Dev only | Both | debug data | None | View logs | No | No |
| Theme Lab | app/dev/theme-lab.tsx | /dev/theme-lab | Dev only | Both | None | None | Test themes | No | No |
| OAuth Callback | app/oauth/callback.tsx | /oauth/callback | System | Both | OAuth tokens | Auth store | Handle callback | No | No |

**FINDINGS:**
- **20 screens** total (18 user-facing, 2 dev-only)
- **ERP Zone, ERP Export, Proposal History, GDPR Consent** have NO tests
- **Debug Log, Theme Lab** are dev-only, acceptable without tests

---

## 2. ALL FEATURES

| Feature | Status | UI | Data Flow | Backend | Tests | Device Acceptance |
|---------|--------|-----|-----------|---------|-------|-------------------|
| Intake/Onboarding | Complete | Yes | Yes | No | Yes | Country + persona selection works |
| Persona Selection (Elias/Kim) | Complete | Yes | Yes | No | Yes | Correct persona loads |
| Backpack (Rugzak) | Complete | Yes | Yes | No | Yes | Sections editable, saved |
| Gegevens bijwerken (Manual Refresh) | **PARTIAL** | Yes | Yes | Yes (GPT) | Yes | **DeepAnalysis failures=5 was root cause, NOW FIXED** |
| forceExtract (Entity Extraction) | Complete | Yes (via refresh) | Yes | Yes (Railway) | Yes | Persons/events extracted |
| analyzeAllSections (Deep Analysis) | **FIXED** | No direct UI | Yes | Yes (minimal-proxy) | Yes | **Contract format + response parsing fixed** |
| contextDat (Session Context) | Complete | No direct UI | Yes | No | Yes | Rebuilt on session start |
| personalAnchors | Complete | Debug only | Yes | No | Yes | Shows in dropdown |
| personalClinicalContext | **FIXED** | Debug only | Yes | No | Yes | **Fallback on schemaTendencies works** |
| Chat Elias | Complete | Yes | Yes | Yes (GPT) | Yes | Responds with clinical context |
| Chat Kim | Complete | Yes | Yes | Yes (GPT) | Yes | Responds with relational context |
| VSP (Veiligheidsplan) | Complete | Yes | Yes | No | Partial | Editable, sections work |
| Eigen Regie Plan | Complete | Yes | Yes | No | Partial | Wizard + triggers work |
| Mood Sliders Elias | Complete | Yes | Yes | No | Yes | 4 sliders, stored |
| Mood Sliders Kim | Complete | Yes | Yes | No | Yes | 4 sliders, stored |
| Progress Tracker | Complete | Yes | Yes | No | Partial | Sobriety counter works |
| Milestone Tracker | Complete | Yes | Yes | No | Partial | Milestones shown |
| Module Memory | Complete | No direct UI | Yes | No | Yes | Per-module usage tracked |
| Rejected Suggestions | Complete | No direct UI | Yes | No | Yes | Session-only, prevents repetition |
| CMD Memory | Complete | Debug only | Yes | No | Yes | Selector + summary works |
| Projections | **PARTIAL** | No direct UI | Yes | No | Partial | fears/hopes stored, not fully consumed |
| Diary | Complete | Yes | Yes | No | Partial | Entries saved, viewed |
| Proposal History | **PARTIAL** | Yes | **UNCLEAR** | No | No | **No tests, unclear data source** |
| Notifications | **PARTIAL** | Settings only | Partial | No | No | Permission card exists, scheduling partial |
| Privacy/Data Export | Complete | Yes | Yes | No | Partial | Export works |
| Session Summaries | Complete | No direct UI | Yes | No | Yes | End-of-session summary |
| Module Activation | Complete | No direct UI | Yes | No | Yes | Deterministic engine routes |
| Crisis Routing | Complete | No direct UI | Yes | No | Yes | Safety-first override |
| Minimal GPT Proxy | **FIXED** | No direct UI | Yes | Yes | Yes | **Contract format fixed** |
| Legacy GPT Proxy | **LEGACY** | No direct UI | Yes | Yes | No | **Still used as fallback, NO store:false** |
| ageCategory | **PARTIAL** | No UI input | Partial | No | Yes | **birthDate never asked, always unknown_adult** |
| lifeStatus/Deceased | **FIXED** | No direct UI | Yes | Yes | Yes | **Extraction + safety rule added** |
| Day Structure | Complete | Yes | Yes | No | Partial | Schedule creation works |
| Sober Counter | Complete | Yes | Yes | No | Partial | Days counted |
| Balkmetafoor | Complete | Yes | Yes | No | Partial | Visual metaphor works |

**CRITICAL FINDINGS:**
1. **Legacy GPT Proxy has NO store:false** — privacy risk if fallback activates
2. **ageCategory: birthDate is NEVER asked** — always unknown_adult, the entire age system is a dead feature
3. **Proposal History: no tests, unclear data source** — may be broken
4. **Projections: stored but not fully consumed** — fears/hopes exist but limited prompt use

---

## 3. DATA DICTIONARY

| Field | Type | Source | Asked? | Extracted? | Stored | Merged | Consumed | In Prompt? | In UI? | Translated? | Tested? | Persona | Status |
|-------|------|--------|--------|------------|--------|--------|----------|------------|--------|-------------|---------|---------|--------|
| ageCategory | string | resolveAgeCategory() | **NO** | From persons[] | userDat | No | prompt builder | Yes | No | N/A | Yes | Both | **DEAD — birthDate never asked** |
| birthDate | date | **NEVER COLLECTED** | **NO** | No | No | No | No | **NO (correct)** | No | N/A | Yes | Both | **Never collected, never sent** |
| extractedEntities | object | Railway extraction | No | Yes | userDat | Yes | pipeline | Indirect | No | N/A | Yes | Both | Complete |
| persons[] | array | Railway extraction | No | Yes | userDat | Yes | anchors | Yes | No | N/A | Yes | Both | Complete |
| lifeStatus | string | **FIXED: extraction** | No | Yes | persons[] | Yes | anchors | Yes | No | N/A | Yes | Both | **Fixed this session** |
| relationGraph | array | Deep analysis | No | Yes | userDat | Yes | anchors | Yes | No | N/A | Yes | Both | Complete |
| lifeStatusFacts | array | Deep analysis | No | Yes | userDat | Yes | anchors | Yes | No | N/A | Yes | Both | Complete |
| schemaTendencies | array | backpack-analysis | No | Yes | userDat | Yes | **ClinicalCtx fallback** | Yes | Debug | N/A | Yes | Both | Complete |
| modeTendencies | array | backpack-analysis | No | Yes | userDat | Yes | **ClinicalCtx fallback** | Yes | Debug | N/A | Yes | Both | Complete |
| schemas | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | Debug | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| modes | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | Debug | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| triggers | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | Debug | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| protectiveFactors | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | Complete |
| values | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | Complete |
| goals | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | Complete |
| risks | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | Complete |
| recoveryPatterns | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Elias | Complete |
| caregiverPatterns | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Kim | Complete |
| developmentalFormulation | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| triggerChains | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| relapsePathways | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Elias | **Fixed: validateAndBuildResult** |
| caregiverBurdenPathways | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Kim | **Fixed: validateAndBuildResult** |
| functionOfAddiction | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Elias | **Fixed: validateAndBuildResult** |
| functionOfCaregivingPattern | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Kim | **Fixed: validateAndBuildResult** |
| contraindications | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| safeFormulationHints | array | Deep analysis | No | Yes | userDat | Yes | ClinicalCtx | Yes | No | N/A | Yes | Both | **Fixed: validateAndBuildResult** |
| mood sliders | object | User input | Yes | No | userDat | Yes | pipeline | Yes | Yes | Yes | Yes | Both | Complete |
| VSP state | object | User input | Yes | No | userDat | Yes | pipeline | Yes | Yes | Yes | Partial | Both | Complete |
| ERP state | object | User input | Yes | No | userDat | Yes | pipeline | Yes | Yes | Yes | Partial | Both | Complete |
| sobrietyDate | string | User input | Yes | No | userDat | Yes | pipeline | Yes | Yes | Yes | Partial | Elias | Complete |
| relapse history | array | User input | Yes | No | userDat | Yes | pipeline | Yes | No | N/A | Partial | Elias | Complete |
| moduleUsage | object | Engine | No | No | userDat | Yes | engine | No | No | N/A | Yes | Both | Complete |
| rejectedSuggestions | array | Engine | No | No | Session only | No | prompt | Yes | No | N/A | Yes | Both | Complete |
| CMD selected memory | string | CMD selector | No | No | Pipeline | No | prompt | Yes | Debug | N/A | Yes | Both | Complete |
| projections | object | Projection layer | No | No | @recofree_projection_* | No | pipeline | **PARTIAL** | No | N/A | Partial | Both | **Stored but limited consumption** |
| contextDat | string | Context builder | No | No | @recofree_context_dat_cache | No | prompt | Yes | Debug | N/A | Yes | Both | Complete |
| anchors | string | Anchor builder | No | No | Pipeline | No | prompt | Yes | Debug | N/A | Yes | Both | Complete |
| diary entries | array | User input | Yes | No | @recofree_diary | No | **NOT in prompt** | **NO** | Yes | Yes | Partial | Both | **Stored but not in GPT prompt** |

**AUTOMATIC FLAGS:**
1. **ageCategory: exists but birthDate never asked** — dead feature
2. **diary entries: stored but never consumed by GPT** — user writes diary but AI never reads it
3. **projections: stored but limited prompt consumption** — fears/hopes partially used
4. **Proposal History: unclear data source** — may read from moduleUsage or separate store
5. **lifeStatus: now extracted but only via deep analysis path** — basic extraction also has it now (FIXED)
6. **Legacy GPT proxy: no store:false** — privacy risk

---

## 4. STORAGE KEYS INVENTORY

| Key | Purpose | Read By | Written By | Encrypted | Tested |
|-----|---------|---------|------------|-----------|--------|
| @recofree_userdat | Main user data store | Pipeline, chat, profile | persistUserDat, mergeAnalysisToUserDat, mergeToUserDatStorage | Yes | Yes |
| @recofree_backpack | Backpack sections | Backpack screen, refresh | Backpack editor | Yes | Partial |
| @recofree_backpack_hash | Backpack change detection | Manual refresh | Manual refresh | No | No |
| @recofree_rugzak | Legacy backpack key | Pipeline | Backpack editor | Yes | Partial |
| @recofree_context_dat_cache | Session context cache | Pipeline | Context builder | No | Yes |
| @recofree_extracted_entities | Extracted entities | Pipeline | Extraction client | Yes | Yes |
| @recofree_section_analysis_hashes | Deep analysis skip check | analyzeAllSections | analyzeAllSections | No | Yes |
| @recofree_section_analysis_results | Deep analysis results | Manual refresh | analyzeAllSections | No | Partial |
| @recofree_last_deep_analysis_report | Last analysis report | Pipeline debug | Manual refresh | No | Yes |
| @recofree_diary | Diary entries | Diary screen | Diary screen | Yes | Partial |
| @recofree_country | User country | Crisis resources | Intake | No | No |
| @recofree_language | UI language | i18n provider | Settings | No | No |
| @recofree_projection_elias | Elias projections | Projection layer | Projection layer | No | Partial |
| @recofree_projection_kim | Kim projections | Projection layer | Projection layer | No | Partial |
| @recofree_daystructure_v1 | Day structure | Day planning | Day wizard | No | Partial |
| @recofree_manual_data_refresh | Refresh timestamp | Manual refresh | Manual refresh | No | No |
| @recofree_last_export_timestamp | Export timestamp | Export section | Export section | No | No |
| @recofree_eigenregie_last_check | ERP check timestamp | ERP | ERP | No | No |
| @recofree_eigenregie_notification_settings | ERP notification settings | ERP | ERP | No | No |

---

## 5. FEATURE FLAGS

| Flag | Purpose | Default | Status |
|------|---------|---------|--------|
| EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY | Use client-built prompt + minimal proxy | true | **ACTIVE — required for all fixes** |
| EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION | CMD memory system | true | Active |
| EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE | Epistemic reasoning | true | Active |
| EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING | Deterministic model selection | true | Active |
| EXPO_PUBLIC_ENABLE_NANO_INTERPRET | Nano semantic resolver | default ON | Active (TEMPORARY_SEMANTIC_MODULE_RESOLVER) |
| EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR | Debug prompt mirror | false | Dev only |

---

## 6. SERVER FILES (FROZEN per architecture guard)

| File | Purpose | Clinical Logic? | store:false? | Status |
|------|---------|-----------------|--------------|--------|
| server/minimal-gpt-proxy.ts | Client-built prompt proxy | NO | **YES** | Active, correct |
| server/gpt-proxy.ts | Legacy full-payload proxy | YES (via ai-chat.ts) | **NO — P0 PRIVACY** | Legacy, fallback |
| server/ai-chat.ts | Full GPT response generator | YES | YES (in OpenAI calls) | Legacy, frozen |
| server/backpack-extractor.ts | Entity extraction | Minimal | YES (via llm.ts) | Active |
| server/backpack-analysis.ts | Backpack analysis | YES | Unknown | Legacy |
| server/_core/llm.ts | LLM provider resolution | No | YES | Active |
| server/_core/index.ts | Server entry + root route | No | N/A | Active |
| server/session-greeting.ts | Server-side greeting | YES | Unknown | **Legacy — should be client** |
| server/signal-engine.ts | Signal processing | YES | Unknown | **Legacy — should be client** |
| server/engine-process.ts | Engine processing | YES | Unknown | **Legacy — should be client** |
| server/k05-cross-module-override.ts | K05 override | YES | Unknown | **Legacy — should be client** |

---

## 7. CRITICAL ISSUES SUMMARY

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| INV-01 | **P0** | Legacy GPT proxy has NO store:false | grep "store" server/gpt-proxy.ts returns empty |
| INV-02 | **P1** | ageCategory is dead — birthDate never asked | No UI input for birthDate anywhere |
| INV-03 | **P1** | Diary entries never reach GPT prompt | diary entries stored but not in prompt builder |
| INV-04 | **P1** | Proposal History has no tests, unclear data source | No test files, unclear storage |
| INV-05 | **P2** | Projections partially consumed | fears/hopes stored but limited prompt use |
| INV-06 | **P2** | 17 files with hardcoded Dutch in prompts | grep shows prompt files with "Je " |
| INV-07 | **P2** | Multiple server files have clinical logic (frozen but present) | ai-chat.ts, signal-engine.ts, etc. |
| INV-08 | **P3** | ERP Zone, ERP Export, Proposal History, GDPR Consent have no tests | No test files found |
| INV-09 | **P3** | Several storage keys have no test coverage | @recofree_country, @recofree_language, etc. |
