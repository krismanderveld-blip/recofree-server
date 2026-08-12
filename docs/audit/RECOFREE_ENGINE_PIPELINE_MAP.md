# RecoFree Engine Pipeline Map

**Date:** 2026-08-12
**File:** lib/rugzak/pipeline.ts (6363 lines)
**Entry:** processMessage()

---

## Pipeline Execution Order

### PRE-GPT Phase

| Step | Name | File/Function | Persona | Persistent | Tests | Risk |
|------|------|---------------|---------|------------|-------|------|
| 1 | Trigger decay | pipeline.ts:1116 | Both | In-memory | Yes | P2 |
| 2 | Buffer update | short-term-memory-buffer.ts | Both | In-memory | Yes | P2 |
| 3 | Zone decay | regulation-decay-engine.ts | Both | In-memory | Yes | P1 |
| 3b | Language recovery | pipeline.ts:1169 | Both | In-memory | No | P2 |
| 3b | Nano-interpret | nano-interpret-client.ts → Railway | Both | No | Partial | P1 |
| 4 | State analysis + DominantState | state-analyzer.ts + dominant-state-selector.ts | Both | In-memory | Yes | P1 |
| 5 | Buffer snapshot | pipeline.ts:1316 | Both | In-memory | Yes | P2 |
| 5b | Regulation layer | regulation-layer.ts | Both | In-memory | Yes | P1 |
| 5d | Projection layer | projection-layer.ts | Both | Persistent | Yes | P1 |
| 5e1 | RETP router | lib/engine/elias/ | Elias | In-memory | Yes | P2 |
| 5e2 | STOA engine | lib/engine/elias/stoicism/ | Elias | In-memory | Yes | P2 |
| 5f | Schema/Mode engine | lib/engine/shared/ | Both | In-memory | Yes | P1 |
| 5g | ACT engine | act-detector/router | Both | In-memory | Yes | P2 |
| 5h | CBT/CGT engine | cgt-detector/router | Both | In-memory | Yes | P2 |
| 5i | DGT/DBT engine | dbt-detector/router | Both | In-memory | Yes | P2 |
| 5j | MBT++ engine | mbt-detector/router | Both | In-memory | Yes | P2 |
| 5k | KO1 Recognition | lib/engine/kim/ | Kim | In-memory | Yes | P1 |
| 5e7 | Elias Advanced (TERV01+MI02) | lib/engine/elias/modules/ | Elias | In-memory | Yes | P2 |
| 6a | EliasDecision aggregation | pipeline.ts:2808 | Elias | In-memory | Yes | P1 |
| 5b | Regulation apply | pipeline.ts:2876 | Both | In-memory | Yes | P1 |
| 6c | Intervention continuity | pipeline.ts:2930 | Elias | In-memory | Yes | P2 |
| 5c | SignalEngine | pipeline.ts:2941 | Both | In-memory | Partial | P2 |
| 5d | Relapse intent | pipeline.ts:3003 | Elias | In-memory | Yes | P0 |
| 6b | Past-reference search | pipeline.ts:3118 | Both | Reads logs.dat | Yes | P1 |
| - | CMD runtime | clinical-memory-distillation/ | Both | Reads DIST01 | Yes | P1 |
| - | CMD selector | budget-selector | Both | In-memory | Yes | P1 |
| - | Kim formulation engine | kim-relational-formulation-engine.ts | Kim | In-memory | Yes (209) | P0 |
| - | Elias formulation engine | elias-recovery-formulation-engine.ts | Elias | In-memory | Yes (110) | P0 |
| - | Personal anchors | buildPersonalAnchorsBlock() | Both | Reads user.dat | Yes (16) | P0 |
| - | Rejected suggestions | rejected-suggestion-guard.ts | Both | Session-only | Yes (6) | P2 |
| - | **Epistemic engine** | **DELETED** | Both | - | **DELETED** | **P0** |
| - | **Model routing (epistemic)** | **DELETED** | Both | - | **DELETED** | **P0** |

### GPT Call

| Step | Name | File | Route | store:false |
|------|------|------|-------|-------------|
| 6 | Prompt build | client-system-prompt-builder.ts | - | - |
| 6 | Minimal proxy call | openai-provider.ts → server/minimal-gpt-proxy.ts | /api/minimal-gpt-proxy | YES |
| 6 | Legacy proxy (fallback) | openai-provider.ts → server/gpt-proxy.ts → ai-chat.ts | /api/gpt-proxy | YES (line 3153) |

### POST-GPT Phase

| Step | Name | File | Persona | Risk |
|------|------|------|---------|------|
| 6.0 | Kim safety filters + K05 override | pipeline.ts:3884 + server/k05-cross-module-override.ts | Kim | P0 |
| 6.5 | Feedback loop (dual-output) | pipeline.ts:3933 | Both | P2 |
| 6.7 | VSP output safety filter | pipeline.ts:3961 | Both | P1 |
| 6.9 | DIST01 detector | pipeline.ts:3986 | Both | P1 |
| 6.10 | DIST01 proposal generation | pipeline.ts:4010 | Both | P1 |
| 6.11 | DIST01 auto-save | pipeline.ts:4078 | Both | P1 |
| 7 | State update | pipeline.ts:4133 | Both | P1 |
| 8 | Pattern marking | pipeline.ts:4260 | Both | P2 |
| 9 | Consolidated logging | pipeline.ts:4292 | Both | P2 |

---

## Model Routing (Current State)

**Epistemic model routing was DELETED** in commit 675d59e8.

Current fallback logic (openai-provider.ts line 895-898):
- Default: `gpt-4o-mini`
- Upgrade to `gpt-4o` only if: `crisisLevel >= 2` OR `clinicalModeActive`

**Missing:** Cold turkey, relapse risk, medical uncertainty, zone red/purple, high responsibility — all previously handled by epistemic routing.

---

## Failure Modes

| Component | Failure Mode | Impact | Fallback |
|-----------|-------------|--------|----------|
| Nano-interpret | Network timeout | No semantic themes | Regex-only detection |
| CMD runtime | Empty DIST01 | No clinical memory | Formulation still works |
| Minimal proxy | Railway down | No GPT response | Legacy proxy fallback |
| Personal anchors | Empty user.dat | No anchor block | GPT works without |
| K05 override | Classification fails | No repair path enforcement | Logs error, passes through |
| DIST01 write | Storage full | Lost distillation | Non-blocking |
