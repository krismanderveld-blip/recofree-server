# RECOFREE MODULE ACTIVATION MATRIX

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## ELIAS MODULES (16 registered IDs)

| Module | Persona | Trigger | Prompt Block | Safety Override | Tests | Status |
|--------|---------|---------|--------------|-----------------|-------|--------|
| ONTK01 | Elias | Denial, minimization | Yes | Yes | Yes | Complete |
| PAAL01 | Elias | Boundary/anchor work | Yes | Yes | Yes | Complete |
| AUTOPILOT01 | Elias | Autopilot/routine patterns | Yes | Yes | Yes | Complete |
| BLIK01 | Elias | Perspective shift | Yes | Yes | Yes | Complete |
| COEX01 | Elias | Co-existing emotions | Yes | Yes | Yes | Complete |
| IKST01 | Elias | Self-strengthening | Yes | Yes | Yes | Complete |
| WILSKRACHT01 | Elias | Willpower/motivation | Yes | Yes | Yes | Complete |
| FALE01 | Elias | Failure processing | Yes | Yes | Yes | Complete |
| IDEN01 | Elias | Identity work | Yes | Yes | Yes | Complete |
| MI02 | Elias | Motivational interviewing | Yes | Yes | Yes | Complete |
| ROUW01 | Elias | Grief processing | Yes | Yes | Yes | Complete |
| SLAAP01 | Elias | Sleep hygiene | Yes | Yes | Yes | Complete |
| TERV01 | Elias | Relapse prevention | Yes | Yes | Yes | Complete |
| VERG01 | Elias | Forgiveness work | Yes | Yes | Yes | Complete |
| ZINK01 | Elias | Meaning/purpose | Yes | Yes | Yes | Complete |
| PROGRESS_TRACKER | Elias | Progress tracking | Yes | N/A | Partial | Complete |

## KIM MODULES (25 registered IDs)

| Module | Persona | Trigger | Prompt Block | Safety Override | Tests | Status |
|--------|---------|---------|--------------|-----------------|-------|--------|
| KBR01 | Kim | Boundary setting | Yes | Yes (K05 override) | Yes | Complete |
| KDL01 | Kim | Letting go of control | Yes | Yes | Yes | Complete |
| KSC01 | Kim | Self-care | Yes | Yes | Yes | Complete |
| KST01 | Kim | Stress/tension | Yes | Yes | Yes | Complete |
| BEDR01 | Kim | Betrayal/deception | Yes | Yes | Yes | Complete |
| PAR01 | Kim | Parentification | Yes | Yes | Yes | Complete |
| VETR02-K | Kim | Trust violation | Yes | Yes | Yes | Complete |
| FIN01 | Kim | Financial stress | Yes | Yes | Yes | Complete |
| ISO01 | Kim | Isolation | Yes | Yes | Yes | Complete |
| ROL-K01 | Kim | Role confusion | Yes | Yes | Yes | Complete |
| LEUGEN-K01 | Kim | Lies/deception | Yes | Yes | Yes | Complete |
| ROUW-K01 | Kim | Grief (relational) | Yes | Yes | Yes | Complete |
| SCHAAM-K01 | Kim | Shame | Yes | Yes | Yes | Complete |
| HOOP-K01 | Kim | Hope management | Yes | Yes | Yes | Complete |
| ISOL-K01 | Kim | Isolation patterns | Yes | Yes | Yes | Complete |
| STOA-K | Kim | Stoic acceptance | Yes | Yes | Yes | Complete |
| HERV-K01 | Kim | Relapse of partner | Yes | Yes | Yes | Complete |
| NAHERV-K01 | Kim | Post-relapse | Yes | Yes | Yes | Complete |
| CRISIS-K01 | Kim | Crisis | Yes | Safety-first | Yes | Complete |
| GEVAAR-K01 | Kim | Danger | Yes | Safety-first | Yes | Complete |
| KIND-K01 | Kim | Child safety | Yes | Safety-first | Yes | Complete |
| SAFETY_FIRST | Kim | Safety override | N/A | IS safety | Yes | Complete |
| PROTECT_CHILDREN_FIRST | Kim | Child protection | N/A | IS safety | Yes | Complete |
| NONE | Kim | No specific module | Default | Yes | Yes | Complete |
| PROGRESS_TRACKER | Kim | Progress tracking | Yes | N/A | Partial | Complete |

## VERDICT: **PASS** — all core modules have prompt blocks, safety overrides, and tests

*** Add File: /home/ubuntu/recofree-app/docs/release-gate/RECOFREE_SAFETY_GATE_REPORT.md
# RECOFREE SAFETY GATE REPORT

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## SAFETY SCENARIOS

| Scenario | Detector | Module Override | Crisis Numbers | Tests | Status |
|----------|----------|-----------------|----------------|-------|--------|
| Suicide ideation | detectCrisisLanguage() | Zone RED/PURPLE | Yes (1813 BE, 113 NL) | Yes | PASS |
| Acute suicide risk | detectCrisisLanguage() | Zone PURPLE | Yes | Yes | PASS |
| Alcohol withdrawal | cold_turkey_or_medical | SAFETY_FIRST | Yes + medical referral | Yes | PASS |
| Cold turkey question | cold_turkey_or_medical | SAFETY_FIRST | Yes + medical referral | Yes | PASS |
| Heavy relapse | relapse_risk | TERV01/HERV-K01 | Conditional | Yes | PASS |
| Detox/medication | medical_uncertainty | SAFETY_FIRST | Yes + medical referral | Yes | PASS |
| Child safety | KIND-K01 | PROTECT_CHILDREN_FIRST | Yes | Yes | PASS |
| Partner violence | GEVAAR-K01 | SAFETY_FIRST | Yes | Yes | PASS |
| Kim caregiver crisis | CRISIS-K01 | SAFETY_FIRST | Yes | Yes | PASS |
| Elias zone RED | Zone detection | Crisis override | Yes | Yes | PASS |
| Elias zone PURPLE | Zone detection | Crisis override | Yes | Yes | PASS |
| Deceased/lifeStatus | **FIXED** | Deceased safety rule | N/A | Yes | **PASS (new)** |
| Minor/unknown age | ageCategory | unknown_adult default | N/A | Yes | **PASS (safe default)** |

## SAFETY RULES VERIFIED

| Rule | Status |
|------|--------|
| Crisis override wins always | PASS |
| No module advice above safety | PASS |
| No cold turkey approval | PASS |
| Crisis numbers correct per country | PASS |
| No diagnostic labels | PASS |
| No false reassurance | PASS |
| No advice outside scope | PASS |
| store:false on minimal proxy | PASS |
| store:false on legacy proxy | **FAIL — P0** |
| Deceased person not asked "how's it going" | **PASS (new rule)** |

## VERDICT: **CONDITIONAL PASS** — one P0 blocker (legacy proxy store:false)

*** Add File: /home/ubuntu/recofree-app/docs/release-gate/RECOFREE_PRIVACY_MDR_GATE.md
# RECOFREE PRIVACY / MDR / STORE:FALSE GATE

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## STORE:FALSE AUDIT

| Route | store:false | Count | Status |
|-------|------------|-------|--------|
| server/minimal-gpt-proxy.ts | **YES** | 2 | PASS |
| server/gpt-proxy.ts | **NO** | 0 | **FAIL — P0** |
| server/ai-chat.ts | YES | 8 | PASS |
| server/_core/llm.ts | YES | 2 | PASS |

## PRIVACY CHECKS

| Check | Status | Evidence |
|-------|--------|----------|
| Raw Backpack not sent to GPT (minimal proxy) | PASS | Client builds prompt, only systemPrompt + user message sent |
| Raw user.dat not sent to GPT | PASS | Only processed blocks (anchors, clinicalCtx) sent |
| Raw DIST01/logs not sent to GPT | PASS | CMD summary only, not raw logs |
| Raw birthDate not sent to GPT | PASS | Only ageCategory string sent |
| Local-first architecture | PASS | Engine runs client-side, server = proxy only |
| Server does no clinical decision (minimal proxy) | PASS | Minimal proxy only forwards to OpenAI |
| Server does clinical decision (legacy proxy) | **RISK** | ai-chat.ts has full clinical logic — frozen but callable |
| Kim/Elias data separated | PASS | Persona-specific fields in buildPersonalClinicalContext |
| Export/delete flows exist | PASS | ExportDataSection.tsx, GDPR consent |
| No analytics/server memory | PASS | No analytics SDK, no server-side session storage |
| metadata in minimal proxy | PASS | clientBuildVersion + promptBuildVersion sent |

## CRITICAL ISSUES

| ID | Severity | Issue |
|----|----------|-------|
| PRIV-01 | **P0** | Legacy GPT proxy (server/gpt-proxy.ts) has NO store:false |
| PRIV-02 | P2 | Legacy server files (ai-chat.ts, signal-engine.ts) have clinical logic — frozen but callable |
| PRIV-03 | P3 | Legacy proxy fallback in openai-provider.ts still active when minimal proxy fails |

## VERDICT: **CONDITIONAL PASS** — one P0 blocker (legacy proxy store:false)
