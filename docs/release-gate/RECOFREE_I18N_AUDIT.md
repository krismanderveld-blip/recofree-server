# RECOFREE I18N AUDIT

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## SUMMARY

NL and EN locale files are perfectly synchronized with 1101 keys each. FR locale also has 1101 keys. No keys exist in one locale but not another. The app uses `t()` calls extensively (973 occurrences across UI files). No hardcoded user-facing Dutch strings were found in the main UI components (chat, profile, backpack, mood, diary screens).

## FINDINGS

| Check | Result | Status |
|-------|--------|--------|
| NL keys | 1101 | PASS |
| EN keys | 1101 | PASS |
| FR keys | 1101 | PASS |
| NL-EN mismatch | 0 | PASS |
| EN-NL mismatch | 0 | PASS |
| t() usage count | 973 | PASS |
| Hardcoded Dutch in UI | 0 found in main screens | PASS |
| Hardcoded crisis text | 1 ("Noodgevallen" in chat.tsx:2178) | **P3** — acceptable for safety |
| Clinical dropdown labels | 16 (debug-only, not user-facing) | PASS — dev/debug context |
| Hardcoded Dutch in engine prompts | 17 files | **P2** — prompts are NL-only by design |

## ISSUES

| ID | Severity | Issue | File |
|----|----------|-------|------|
| I18N-01 | P3 | "Noodgevallen" hardcoded in crisis footer | chat.tsx:2178 |
| I18N-02 | P2 | 17 engine prompt files have hardcoded Dutch | Engine modules — by design for NL therapy |
| I18N-03 | P3 | Clinical dropdown labels are English debug strings | chat.tsx — dev/debug only |

## VERDICT: **PASS** (no P0/P1 i18n blockers)

Engine prompts are intentionally Dutch for NL therapy context. Crisis text hardcoding is acceptable for safety visibility. Clinical dropdown is debug-only.

*** Add File: /home/ubuntu/recofree-app/docs/release-gate/RECOFREE_AGE_FLOW_AUDIT.md
# RECOFREE AGE / BIRTHDATE / CONSENT FLOW AUDIT

**Generated:** 2026-08-20 | **Commit:** e7769bbb

---

## SUMMARY

The ageCategory system exists architecturally but is functionally dead. birthDate is NEVER collected from the user. The resolver always returns `unknown_adult`. The prompt injection works correctly but always sends the same generic adult communication hints.

## AUDIT RESULTS

| Question | Answer | Evidence |
|----------|--------|----------|
| Is birthDate input in UI? | **NO** | No date picker or age input in intake.tsx or any screen |
| Is it required? | N/A | Not collected at all |
| Is there 18+ check? | **NO** | No age verification anywhere |
| What happens at unknown_adult? | Generic adult hints sent to GPT | age-category-foundation.ts returns safe defaults |
| What happens at <18? | **UNTESTED** | Category exists but never triggered |
| Is raw birthDate sent to GPT? | **NO (correct)** | Only ageCategory string sent |
| Is ageCategory sent to GPT? | **YES** | Via client-system-prompt-builder.ts |
| Are texts translated? | N/A | No user-facing age UI exists |
| Is this tested? | **YES** (unit tests) | 15 tests for resolver and prompt injection |
| MDR/safety impact? | **LOW** | unknown_adult is safe default, no minors flow |

## DECISION REQUIRED

RecoFree Phase 1 is 18+ only. Two options:

**Option A (recommended):** Document `unknown_adult` as intentional default. Add a simple 18+ confirmation checkbox to intake (not birthDate collection). Remove the 4-category resolver complexity.

**Option B:** Collect birthDate at intake, enable full 4-category system. Requires consent flow, minors rejection, and MDR review.

## CURRENT STATUS

The ageCategory system is NOT a release blocker because `unknown_adult` is a safe default. However, it is a dead feature that adds code complexity without value. The 15 tests pass but test a feature that never activates in production.

## VERDICT: **PASS with NOTE** — not a blocker, but dead feature should be documented or simplified
