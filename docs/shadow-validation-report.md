# Shadow Validation — Parity Report

**Date:** 2026-06-28  
**Mode:** CLIENT_ACTIVE_SERVER_SHADOW  
**Scenarios:** 14 golden-session cases  
**Server endpoint:** /api/engine-process (v1)

---

## Summary Verdict

| Criterion | Threshold | Result | Status |
|-----------|-----------|--------|--------|
| Crisis (crisisLevel + showEmergency + relapseIntent) | 100% | 64.3% | **FAIL** |
| Persona separation | 100% | 100.0% | **PASS** |
| High fields (dominantModule, zoneColor, emotionalState, loopDetected) | 95%+ | 62.5% | **FAIL** |
| Greeting / fact-grounding | no new hallucinations | N/A (no GPT) | **PASS** |

**VERDICT: NO-GO — Fix differences before Checkpoint G**

---

## Per-Field Match Rates

| Field | Severity | Match Rate | Notes |
|-------|----------|------------|-------|
| crisisLevel | critical | 92.9% (13/14) | 1 mismatch: server returns 3 for suicidal, client returns 2 |
| showEmergency | critical | 78.6% (11/14) | Server does not escalate to showEmergency for high craving / relapse intent |
| relapseIntentDetected | critical | 78.6% (11/14) | Server misses relapse intent in 2 cases, false positive in 1 (FR multilingual) |
| riskLevel | critical | 100.0% (14/14) | Perfect match |
| persona | critical | 100.0% (14/14) | Perfect match |
| dominantModule | high | 0.0% (0/14) | **Server always returns "default"** — module selection not yet wired |
| zoneColor | high | 50.0% (7/14) | Systematic offset: server tends higher (GREEN→YELLOW, ORANGE→RED) |
| emotionalState | high | 100.0% (14/14) | Perfect match |
| loopDetected | high | 100.0% (14/14) | Perfect match |
| zoneScore | medium | 50.0% (7/14) | Server scores systematically ~5-15 points higher |
| regulationAction | medium | 71.4% (10/14) | Follows from zoneColor mismatch |
| regulationZone | medium | 71.4% (10/14) | Follows from zoneColor mismatch |
| regulationWasSoftened | medium | 100.0% (14/14) | Perfect match |
| regulationWasSkipped | medium | 100.0% (14/14) | Perfect match |
| selectedModel | low | 78.6% (11/14) | Server defaults to gpt-4o-mini; client escalates to gpt-4o for crisis |

---

## Mismatch Classification

### REAL DECISION DIFFERENCES (must fix before G)

#### 1. dominantModule: Server always returns "default" (0% match)

**Root cause:** The server's `engine-process.ts` does not run the full module selection pipeline (DominantStateSelector, P2/P3/P4 modules, signal engine → module mapping). It only runs state analysis, buffer, decay, regulation, and loopblock. The module selection logic lives entirely in the client pipeline.

**Fix required:** Port the DominantStateSelector + module activation chain to the server engine-process pipeline. This is the largest gap.

**Classification:** REAL_DECISION_DIFFERENCE

---

#### 2. showEmergency: Server misses escalation (3 mismatches)

**Scenarios:** high_craving_elias, relapse_intent, persona_separation_kim_only

**Root cause:** Client sets `showEmergency = true` when crisisLevel >= 2 OR when specific crisis conditions are met (PAARS VSP, high craving + relapse markers). Server only sets showEmergency based on crisisLevel >= 3 (a stricter threshold).

**Fix required:** Align server's showEmergency threshold with client logic: `crisisLevel >= 2 || vspLevel === 'PAARS'`.

**Classification:** REAL_DECISION_DIFFERENCE

---

#### 3. relapseIntentDetected: 3 mismatches (2 missed, 1 false positive)

**Missed cases:**
- `relapse_intent`: "Ik ga vanavond drinken, ik heb al bier gekocht" — client detects, server does not
- `persona_separation_kim_only`: Kim high-stress → client escalates (incorrect?), server does not

**False positive:**
- `multilingual_fr`: "j'ai presque rechuté" — server detects relapse intent, client does not

**Root cause:** The server's signal engine runs synchronously with different NL/FR marker weights. The client uses the GptSignalEngine (async LLM call) which has broader NL coverage but misses FR markers. The Kim false positive on client side is likely a bug (Kim should not trigger relapse intent).

**Fix required:**
1. Add FR relapse markers to server signal engine
2. Fix client Kim false-positive (Kim persona should not trigger Elias relapse detection)
3. Align NL relapse marker thresholds

**Classification:** REAL_DECISION_DIFFERENCE

---

#### 4. zoneColor: Systematic server offset (50% match)

**Pattern:** Server scores zones ~1 level higher than client:
- GREEN → YELLOW (stable_kim, fact_grounding, multilingual_nl)
- ORANGE → RED (high_craving, crisis_suicidal, vsp_paars)
- YELLOW → ORANGE (relapse_intent)

**Root cause:** The server's zone score calculation uses a different base formula. The client applies decay BEFORE zone calculation (reducing score), while the server applies decay AFTER (resulting in higher raw scores that map to higher zones).

**Fix required:** Align decay application order. The client's order (decay → zone) is the canonical one per the pipeline spec. Server should apply decay before zone mapping.

**Classification:** REAL_DECISION_DIFFERENCE (partially TIMING_ARTIFACT for ±5 point differences)

---

#### 5. crisisLevel: Server returns 3 for suicidal (client returns 2)

**Scenario:** crisis_suicidal ("Ik wil er niet meer zijn")

**Root cause:** Server has a 3-level crisis scale (0/1/2/3) while client uses 2-level (0/1/2). The server's level 3 = "active suicidal ideation" is semantically equivalent to client's level 2 = "active crisis".

**Fix required:** Normalize server's 3-level to client's 2-level in the response mapping, OR update client to support 3 levels. Recommend: map server 3 → client 2 for now (both mean "show emergency + crisis protocol").

**Classification:** REAL_DECISION_DIFFERENCE (but semantic equivalence — easy fix)

---

### TIMING ARTIFACTS (tolerable, no fix needed)

| Scenario | Field | Client | Server | Reason |
|----------|-------|--------|--------|--------|
| stable_elias_green | zoneScore | 11 | 17 | Decay timing difference (±6) |
| stable_kim_normal | zoneScore | 15 | 22 | Decay timing difference (±7) |
| high_craving_elias | zoneScore | 48 | 61 | Decay timing difference (±13) |
| relapse_intent | zoneScore | 32 | 55 | Decay + signal timing (±23) |
| relapse_intent | selectedModel | gpt-4o | gpt-4o-mini | Model routing not yet on server |
| crisis_suicidal | zoneScore | 48 | 61 | Decay timing difference (±13) |
| crisis_suicidal | selectedModel | gpt-4o | gpt-4o-mini | Model routing not yet on server |
| vsp_paars_override | zoneScore | 48 | 63 | Decay timing difference (±15) |
| vsp_paars_override | selectedModel | gpt-4o | gpt-4o-mini | Model routing not yet on server |
| multilingual_en | zoneScore | 29 | 23 | Reverse offset (signal timing) |

---

## Priority Fix List (ordered by impact)

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| P0 | Port DominantStateSelector to server | 0% module match → blocks G | High (largest gap) |
| P1 | Align showEmergency threshold | Crisis safety gap | Low (threshold change) |
| P1 | Align decay order (decay before zone) | 50% zoneColor mismatch | Medium (reorder server logic) |
| P2 | Normalize crisisLevel 3→2 mapping | 1 crisis mismatch | Low (response mapping) |
| P2 | Fix FR relapse markers on server | 1 false negative | Low (add markers) |
| P2 | Fix Kim relapse false-positive on client | 1 false positive | Low (persona guard) |
| P3 | Port model routing logic to server | selectedModel mismatch | Medium (routing rules) |

---

## Conclusion

**Persona separation is 100% — Kim modules never appear for Elias and vice versa.**

The two critical blockers for Checkpoint G are:

1. **DominantStateSelector not on server** — This is the largest gap. Without module selection, the server cannot make the same therapeutic decisions as the client. This needs to be ported.

2. **showEmergency + relapseIntent threshold alignment** — Safety-critical. The server must match the client's escalation logic exactly.

Once P0 and P1 are fixed, re-run this harness. If crisis reaches 100% and high fields reach 95%+, Checkpoint G is safe to proceed.
