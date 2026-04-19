# Elias Deep Encapsulation Audit — Working Notes

## Phase 0: What IS encapsulated
- lib/engine/elias/ contains ONLY `decision-layer.ts`
- decision-layer.ts is PURE AGGREGATION — no thresholds, no formulas, no module IDs, no prompt text
- It reads from other systems and bundles into EliasDecision object
- Conclusion: virtually NOTHING is encapsulated in the Elias engine

## AUDIT 1: Elias thresholds, distress/risk/intervention formulas

### 1a. Elias slider thresholds (inline)
| File | Line | Code | Threshold |
|------|------|------|-----------|
| mock-provider.ts | 72 | `despondency >= 4` | lowMood |
| mock-provider.ts | 77 | `craving >= 5` | craving response |
| detector.ts | 119 | `craving >= 6` | crisis trigger |
| detector.ts | 123 | `despondency >= 6` | crisis trigger |
| engine.ts | 177 | `craving >= 6` | priority module E01 |
| engine.ts | 178 | `despondency >= 6` | priority module E02 |
| engine.ts | 179 | `frustration >= 7` | priority module E04 |
| engine.ts | 180 | `focus <= 3` | priority module E07 |
| state-analyzer.ts | 161 | `primaryConcern >= 5.5` | craving moderate |
| state-analyzer.ts | 311 | `craving >= 6` | module E01 |
| state-analyzer.ts | 313 | `despondency >= 6` | module E02 |
| state-analyzer.ts | 317 | `frustration >= 7` | module E04 |
| state-analyzer.ts | 321 | `focus <= 3` | module E07 |
| backpack-relevance-analyzer.ts | 191-194 | `craving >= 6`, `focus <= 3`, `despondency >= 6`, `frustration >= 6` | trigger scoring |
| dominant-state-selector.ts | 105-106 | craving vs despondency vs frustration comparison | default module |

### 1b. Elias distress formulas (duplicated 6x!)
| File | Line | Formula |
|------|------|---------|
| detector.ts | 36 | `(craving + frustration + despondency) / 3` |
| engine.ts | 36 | `(craving + frustration + despondency) / 3` |
| pipeline.ts | 948 | `(craving + frustration + despondency) / 3` |
| pipeline.ts | 951 | `(craving + frustration + despondency) / 3` |
| state-analyzer.ts | 54 | `(craving + frustration + despondency) / 3` |
| buffer.ts | 550 | `(craving + frustration + despondency) / 3` |
| dominant-state-selector.ts | 62 | `(craving + frustration + despondency) / 3` |

### 1c. riskScore thresholds
| File | Line | Code |
|------|------|------|
| ai-chat.ts | 1241 | `riskScore >= 7` → model selection |

## AUDIT 2: Elias module mappings (E01-E08), fallbacks, default modules

### 2a. E01-E08 module IDs scattered across 7 files
| File | Lines | Type |
|------|-------|------|
| openai-provider.ts | 129 | Hardcoded `'E02'` fallback |
| module-system.ts | 50-110 | Full ELIAS_MODULES array (8 modules with triggers) |
| engine.ts | 177-183 | Slider→module mapping (E01,E02,E04,E07,E03,E05) |
| pipeline.ts | 296,332,787 | `'E02'` as Elias default fallback (3x) |
| state-analyzer.ts | 311-325 | Signal→module mapping (E01-E07) + E02 default |
| dominant-state-selector.ts | 86-107,114 | Trigger→module switch (7 cases) + slider→module + E02 default |
| backpack-relevance-analyzer.ts | (from audit 1) | Trigger→slider→module alignment |

### 2b. ELIAS_MODULES definitions
- module-system.ts:48 — Full ELIAS_MODULES array with 8 TherapeuticModule objects
- module-system.ts:129,182 — Used in routing functions

### 2c. Elias default module
- `'E02'` used as Elias default in: pipeline.ts (3x), dominant-state-selector.ts (2x), state-analyzer.ts (1x), openai-provider.ts (1x)
- Total: 7 hardcoded `'E02'` Elias defaults across 4 files

## AUDIT 3: Elias crisis mappings, stageOfChange branches, zone behavior

### 3a. Elias crisis mappings
| File | Line | Code |
|------|------|------|
| dominant-state-selector.ts | 80 | `'E_CRISIS'` hardcoded Elias crisis module |
| ai-chat.ts | 781-785 | Elias crisis prompt text (inline ternary) |

### 3b. stageOfChange usage (extensive, mostly structural)
- Used in: openai-provider.ts, pipeline.ts (6x), gpt-payload-builder.ts (4x), ai-chat.ts (15+ refs)
- Most are data passing (structural), not Elias-specific logic
- **stageDescriptions** duplicated 2x in ai-chat.ts (lines 573, 642) — inline Record with 5 stage descriptions
- stageOfChange is conceptually Elias-specific (addiction recovery stages) but used as shared infrastructure

### 3c. Zone-derived Elias behavior
- pipeline.ts:617 — only a console.log, not logic
- No Elias-specific zone→behavior logic found outside engine

### 3d. E_CRISIS
- dominant-state-selector.ts:80 — hardcoded `'E_CRISIS'` string
