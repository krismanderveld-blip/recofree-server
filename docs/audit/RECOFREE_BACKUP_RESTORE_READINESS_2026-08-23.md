# RecoFree Gap Register — P0 / P1 / P2

**Date:** 2026-08-12
**Audit basis:** Checkpoint d52f1273

---

## P0 — Can Break Trust / Safety / Privacy

| ID | Title | Layers | Evidence | Impact | Fix Before 23 Aug |
|----|-------|--------|----------|--------|-------------------|
| P0-01 | **Epistemic engine + model routing DELETED** | lib/engine/shared/epistemic-reasoning/ (all 4 files), 3 test files, pipeline integration | Commit 675d59e8 deleted 4120 lines | Model routing falls back to crisis-only upgrade. Cold turkey, relapse risk, medical uncertainty, zone red/purple no longer trigger gpt-4o. | YES — restore from git |
| P0-02 | **Token cost tracker DELETED** | lib/ai/debug/ (4 files), 2 test files | Same commit 675d59e8 | No cost visibility. Cannot monitor spend. | YES — restore from git |
| P0-03 | **DIST01 quality analyzer DELETED** | lib/engine/shared/dist01-quality/ (3 files), 1 test file | Same commit 675d59e8 | Cannot classify DIST01 test failures automatically. | P1 (nice-to-have) |
| P0-04 | **14 tests failing** | tests/signal-engine-integration, pipelineCrash/firstMessage, pipelineCrash/undefinedVspFields | Current test run | Pipeline crash on certain inputs not caught in production. | YES |
| P0-05 | **K05 override runs on server** | server/k05-cross-module-override.ts | Code inspection | Violates client-first rule. Classification call goes to server. | P1 (works, but architecture violation) |
| P0-06 | **Legacy gpt-proxy has NO store:false in route itself** | server/gpt-proxy.ts (0 occurrences of "store") | grep result | ai-chat.ts has store:false at line 3153, but gpt-proxy.ts wrapper doesn't enforce it independently. | Verify — may be inherited |

---

## P1 — Strong Quality Regression (No Direct Safety/Privacy Breach)

| ID | Title | Layers | Impact | Fix Before 23 Aug |
|----|-------|--------|--------|-------------------|
| P1-01 | Model routing too simple | openai-provider.ts:895-898 | Only crisis upgrades to gpt-4o. Medical uncertainty, relapse risk, cold turkey all get gpt-4o-mini. | YES (restore epistemic) |
| P1-02 | DIST01 writeback incomplete for new users | DIST01 detector + proposal writer | New users who only chat (no backpack) get no distillation. Vise-versa principle not fully working. | Investigate |
| P1-03 | No app restart smoke test | - | Memory reload after kill/restart untested. Could lose session state. | Add test |
| P1-04 | Context.dat only at SESSION_INIT | pipeline.ts | Follow-up messages rely on personalAnchors + CMD. If both empty, GPT has no context. | Monitor |
| P1-05 | Nano-interpret single point of failure | forge.manus.im | If Manus infra changes, nano breaks. No local fallback. | Document + plan |
| P1-06 | 5 pipelineCrash tests failing | firstMessageAfterV3Greeting + undefinedVspFields | Edge cases where pipeline crashes on malformed input. | Fix |
| P1-07 | Signal engine integration tests failing (5) | tests/signal-engine-integration | Server-dependent tests that need Railway running. | Classify as integration-only |
| P1-08 | Kim formulation regex gaps | FASE 9K audit | 'ontwenningsverschijnselen', 'lever kapot', 'morgen stoppen' not detected | Extend regex |

---

## P2 — Technical Debt / Later

| ID | Title | Impact |
|----|-------|--------|
| P2-01 | Legacy server files (engine-process.ts, debug-prompt.ts) still registered | Dead code in production bundle |
| P2-02 | mysql2 in dependencies but unused | Bundle size |
| P2-03 | Confidence promotion not fully implemented | DIST01 items stay at initial confidence |
| P2-04 | Contradiction resolution not implemented | Old hypotheses never invalidated |
| P2-05 | Decay cleanup not implemented | Stale projections never expire |
| P2-06 | lib/migration/ contains dead shadow-engine code | Confusion risk |
| P2-07 | Cost UI refinement | No user-facing cost display |
| P2-08 | FASE 9K archived test not in CI | 28 adversarial scenarios only in archive |
| P2-09 | Nano vocabulary incomplete for Kim | 12 labels added but nano LLM may not produce them reliably |
| P2-10 | Day structure notifications untested on device | May not fire correctly |

---

## Summary

| Priority | Count | Fix Before 23 Aug |
|----------|-------|-------------------|
| P0 | 6 | 4 YES, 1 verify, 1 P1 |
| P1 | 8 | 3 YES, 5 investigate/monitor |
| P2 | 10 | 0 (later) |

**Biggest risk before server switch:** P0-01 (epistemic engine deleted). This removes intelligent model routing and 224+ tests from the codebase.

*** Add File: /home/ubuntu/recofree-app/docs/audit/RECOFREE_BACKUP_RESTORE_READINESS_2026-08-23.md
