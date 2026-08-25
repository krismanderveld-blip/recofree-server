# P0 Cold-Turkey Device Failure — Root Cause and Fix

**Date:** 2026-08-25  
**Device question:** `Kan ik plots stoppen met zwaar drinken zonder dokter?`  
**Status:** Code fixed, test-green and live on Railway commit `f138506`; new APK retest still required

## Proven failure chain

The device used the correct Railway endpoint but received HTTP 400 `VALIDATION_FAILED`. A contract-valid control request with `gpt-4o-mini` returned 200, while the identical request with `gpt-4o-2024-08-06` returned 400. This isolated the first root cause to the model field.

| Boundary | Proven defect | Fix |
|---|---|---|
| Client ↔ Railway contract | Provider selected `gpt-4o-2024-08-06`, but Railway’s allowlist omitted it | Shared allowlist now includes the versioned full model |
| Medical detection | Natural Dutch words `dokter`, `arts` and `plots stoppen` were absent from the medical marker set | Explicit markers added without symptom-based diagnosis inference |
| Core ↔ deterministic model router | Core engine produced `safetyRelevant=true` and full-tier, but the second router did not receive `safetyRelevant` | Field added, scored and made a hard full-model override |
| GPT failure boundary | Provider displayed raw `[DEBUG]` text to the user | Explicit cold-turkey questions receive a local NL/EN/FR medical safety response on HTTP, contract or network failure |

## Why the dropdown contradicted itself

The device showed `Epistemic tier=full` but `ModelRoute tier=mini`. These were two different decisions. The core epistemic engine recognized a safety-relevant claim and recommended full. The separate deterministic model router only received `medicalUncertainty=false`, not `safetyRelevant=true`, so it downgraded the same message to `light_context`.

The provider itself used the core recommendation and sent the versioned full model. Railway rejected that model because its local allowlist had drifted from the client model catalog.

## Safety fallback scope

The local fallback activates only when both conditions hold:

1. The message explicitly asks about abrupt stopping, cold turkey, detox or withdrawal; and
2. The deterministic engine marked the message medical or safety-relevant.

It does not infer a diagnosis, dependence or withdrawal state from symptoms alone. Unrelated technical failures still use the existing technical debug path.

## Validation

| Validation | Result |
|---|---|
| New P0 cold-turkey tests | 9/9 passed |
| Routing + live minimal-proxy targeted set | 96/96 passed |
| Full Vitest suite | 4,172 passed; 1 skipped |
| TypeScript | 0 errors |
| Lockfile | Unchanged |
| Railway deploy | SUCCESS on commit `f138506` |
| Live versioned full-model request | HTTP 200, `modelUsed=gpt-4o-2024-08-06` |

## Required remaining proof

1. Build a new APK containing client commit `f138506`.
2. Repeat the exact Dutch device question.
3. Accept only if the response is a safety answer, `ModelRoute tier=full`, `medicalUncertainty=true`, Railway returns 200 and no `[DEBUG]` text is shown.

## References

[1]: ../../server/minimal-gpt-proxy.ts "Railway minimal proxy allowlist"
[2]: ../../lib/ai/prompt/minimal-gpt-proxy-contract.ts "Shared model allowlist and contract"
[3]: ../../lib/engine/shared/epistemic-reasoning/epistemic-reasoning-engine.ts "Medical and safety detection"
[4]: ../../lib/engine/shared/epistemic-reasoning/epistemic-model-routing.ts "Deterministic model router"
[5]: ../../lib/ai/medical-safety-fallback.ts "Local medical safety failure response"
[6]: ../../__tests__/cold-turkey-minimal-proxy-p0.test.ts "P0 regression suite"
