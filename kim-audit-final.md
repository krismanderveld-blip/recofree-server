# Kim Engine Final Audit — Post MP11

Date: 2026-04-19

## Goal
Confirm that NO Kim-specific inline logic remains outside `lib/engine/kim/`.

## Classification

### Category A: Pure imports/calls to Kim engine (CORRECT — delegated)
These files import from `lib/engine/kim/*` and call engine functions. No inline Kim logic.

| File | What it imports/calls |
|------|---------------------|
| `lib/crisis/detector.ts` | `kimDistressScore`, `kimResilienceScore`, `checkKimCrisisTrigger` |
| `lib/rugzak/state-analyzer.ts` | `kimDistressScore`, `kimResilienceScore`, `kimPrimaryConcern` |
| `lib/rugzak/engine.ts` | `kimDistressScore`, `kimResilienceScore`, `kimPrimaryConcern` |
| `lib/rugzak/short-term-memory-buffer.ts` | `detectKimTrigger`, `kimDistressScore` |
| `lib/rugzak/backpack-relevance-analyzer.ts` | `kimBackpackSliderScore` |
| `lib/rugzak/dominant-state-selector.ts` | `KIM_DEFAULT_MODULE`, `KIM_CRISIS_MODULE`, `kimDistress100`, `kimResilience100`, `kimPrimaryConcern100` |
| `lib/modules/module-system.ts` | `KIM_THERAPEUTIC_MODULES` |
| `lib/ai/mock-provider.ts` | `detectKimBoundaryTopic`, `detectKimEnablingPattern` |
| `server/ai-chat.ts` | `KIM_IDENTITY_PROMPT`, `kimCrisisInstructions` |

### Category B: Neutral routing (ACCEPTABLE — no Kim logic, only type dispatch)
These use `userType === 'kim'` or `=== 'elias'` purely for routing to engine calls or selecting response pools. No thresholds, formulas, or regex.

| File | Lines | What it does |
|------|-------|-------------|
| `lib/crisis/detector.ts` | 127-133 | `else { checkKimCrisisTrigger() }` — routing to engine |
| `lib/rugzak/engine.ts` | 38,43,48 | Ternary routing to `kimDistressScore`/`kimResilienceScore`/`kimPrimaryConcern` |
| `lib/rugzak/state-analyzer.ts` | 56,68,80 | Same ternary routing pattern |
| `lib/rugzak/dominant-state-selector.ts` | 64,69,74,80,114 | Ternary routing to `kimDistress100`/etc |
| `lib/modules/module-system.ts` | 129,182 | `userType === 'elias' ? ELIAS_MODULES : KIM_MODULES` |
| `lib/ai/mock-provider.ts` | 85,110,115 | `context.userType === 'kim'` routing to engine functions + response pool selection |
| `lib/rugzak/backpack-relevance-analyzer.ts` | 194-196 | `else { kimBackpackSliderScore() }` routing |
| `server/ai-chat.ts` | 736,785 | Ternary routing to `KIM_IDENTITY_PROMPT`/`kimCrisisInstructions` |

### Category C: Type definitions and UI (NOT Kim logic — structural)
| File | What |
|------|------|
| `lib/ai/types.ts` | `UserType = 'elias' \| 'kim'`, `KIM_SLIDER_CONFIG`, `KimMoodSliders` interface — type definitions |
| `app/intake.tsx` | UI button `selectedType === 'kim'` — user selection |
| `app/(tabs)/mood.tsx` | Slider labels for Kim sliders — UI display |
| `app/(tabs)/index.tsx` | `slider.key !== 'selfCare'` — UI inversion logic |

### Category D: REMAINING inline Kim computation (needs future extraction)

| File | Lines | What | Severity |
|------|-------|------|----------|
| `lib/rugzak/pipeline.ts` | 294,330,785 | Fallback `'K01'` string literal | LOW — just a default module ID |
| `lib/rugzak/pipeline.ts` | 947-953 | Inline Kim distress/resilience formulas for session-end mood delta | MEDIUM — duplicates `kimDistressScore`/`kimResilienceScore` logic |
| `lib/ai/mock-provider.ts` | 100 | `emotionalBurden >= 4` threshold in shared lowMood check | LOW — shared between Elias/Kim, not Kim-specific |
| `lib/rugzak/backpack-relevance-analyzer.ts` | 217-222 | K01/K02/K03 module alignment mapping | LOW — static data mapping, not computation |

## Conclusion

**All Kim-specific COMPUTATION (thresholds, formulas, regex patterns, prompt text, module definitions) has been extracted to `lib/engine/kim/`.**

Remaining items in Category D are:
1. **pipeline.ts lines 947-953**: Inline distress/resilience formulas that duplicate engine functions — should be refactored in a future patch
2. **pipeline.ts K01 fallbacks**: String literals, not logic
3. **backpack-relevance-analyzer.ts module alignment**: Static data mapping
4. **mock-provider.ts emotionalBurden >= 4**: Shared threshold (applies to both Elias despondency and Kim emotionalBurden)

Items 2-4 are NOT Kim-specific inline logic — they are neutral routing or shared data.
Item 1 (pipeline.ts distress/resilience formulas) is the only remaining duplication, but it operates in a session-end context that was not part of the original MP1-11 scope.
