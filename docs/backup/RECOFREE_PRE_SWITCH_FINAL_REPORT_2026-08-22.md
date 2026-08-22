# RecoFree Pre-Switch Final Report

**Date:** 2026-08-22  
**Author:** Manus AI  
**Production backend:** Railway

## Executive result

RecoFree is technically prepared for the announced Manus service window. The historical release-gate runner, six release reports, two forensic reports and focused ClinicalCtx fallback regression suite have been restored. The complete gate passes with **4,144 tests**, **54 release-gate tests**, **43 auto-debug tests**, **114 integration tests** and zero TypeScript errors. The lockfile remains unchanged.

The remaining mandatory user action is to create the official Manus Task Data Backup through [manus.im/backup](https://manus.im/backup) before the deadline in the user's notice. A local source backup is complementary and does not replace that official export.[1] [2]

## Restored artifacts

| Category | Restored result |
|---|---|
| Automated gate | `scripts/release-gate.sh` and `npm run recofree:release-gate` |
| Focused regression | `__tests__/pipeline/clinicalCtxFallbackTendencies.test.ts` |
| Release documentation | Six historical `docs/release-gate/*` reports |
| Forensic documentation | Two historical `docs/audit/*` reports |

The restored runner was also hardened. It now reads the correct Vitest test totals, uses process exit codes rather than fragile text-only failure detection, validates every current direct OpenAI call path for `store:false`, and no longer produces an integer-expression warning.

## Behandelaar/VSP export repair

The previous profile button created only an internal temporary file and immediately attempted to open the system share sheet. It provided no user-selected save location, did not verify whether sharing was available, supplied no success/cancellation feedback and had no dedicated end-to-end regression coverage.

The repaired flow now separates two actions:

| Action | Behavior |
|---|---|
| **Bewaar bestand** | Primary action. Opens the native directory picker and writes the VSP insight profile to the user-selected location. |
| **Deel met behandelaar** | Secondary action. Checks sharing availability, creates a temporary local file and opens the native share sheet. |

The exported text is generated locally from the existing VSP Insight profile. No backend or network call is required. Ten new deterministic tests cover safe filenames, Elias/Kim naming, local write success, cancellation, storage failure, share unavailability, operation order, share failure and absence of network calls.

## Validation result

| Gate | Result |
|---|---|
| TypeScript | PASS — 0 errors |
| Full Vitest suite | PASS — 4,144 tests |
| Release-gate suite | PASS — 54 tests |
| Auto-debug suite | PASS — 43 tests |
| Integration suite | PASS — 114 tests |
| `store:false` | PASS — minimal proxy, extraction LLM, nano and frozen legacy chat |
| Lockfile | PASS — `pnpm-lock.yaml` unchanged |
| APK release gate | PASS — runner reports `APK READY: YES` |

## Local backup set

The local backup workflow produces a complete Git bundle, clean committed source ZIP, current working-tree archive, commit/status metadata, restore instructions and SHA-256 checksums. Sandbox logs, Manus-local metadata and `.env` files are excluded from the download package.

The backup script is `scripts/create-local-backup.sh`. It is designed to be rerun after the final commit so the final downloadable package contains the exact final Git state.

## Official Manus backup actions

The official export is a fixed point-in-time snapshot and must be repeated after the last project changes. Affected users should select **Export task data → Export more → All tasks → All time → Start export**. Type C users must create Account Info Backup before Task Data Backup. Packages must not be renamed or mixed between export runs.[1] [2]

Restoration opens after the announced service window. Restoration is performed once, so all complete packages must be selected together. Third-party connectors must be re-enabled manually afterward.[3]

RecoFree's installed APK is a device copy, and its production GPT proxy remains on Railway. The Manus service window may block project editing, building and publishing, but it does not require moving RecoFree's production backend away from Railway.

## References

[1]: https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected "What’s Happening and Am I Affected?"
[2]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "How to Back Up Your Data"
[3]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "How to Restore Your Data"
