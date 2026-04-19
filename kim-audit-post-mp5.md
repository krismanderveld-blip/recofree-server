# Kim Branch Audit — Post Micro-patch 5

Audit date: 2026-04-19
Scope: All .ts/.tsx files outside lib/engine/kim/, excluding tests and node_modules

## FINDINGS: Remaining Kim-specific if/else branches

### 1. lib/ai/mock-provider.ts (lines 109, 114)
**Status: INLINE KIM LOGIC — NOT DELEGATED**
```
else if (context.userType === 'kim' && this.detectBoundaryTopic(context.currentMessage))
else if (context.userType === 'kim' && this.detectEnablingPattern(context.currentMessage))
```
- `detectBoundaryTopic()` and `detectEnablingPattern()` are private methods with inline keyword arrays
- These do NOT import from lib/engine/kim/*
- This is mock-only code (not used in production OpenAI flow)

### 2. lib/crisis/detector.ts (line 130)
**Status: DELEGATED — branch calls checkKimCrisisTrigger()**
```
if (userType === 'kim') {
    const kimCrisis = checkKimCrisisTrigger(moodSliders);
```
- The Kim logic IS delegated to lib/engine/kim/crisis-trigger.ts
- But the `if (userType === 'kim')` routing branch still exists in detector.ts

### 3. lib/rugzak/dominant-state-selector.ts (lines 86-97, 108-115, 119)
**Status: INLINE KIM LOGIC — NOT DELEGATED**
- `getTriggerModule()`: else branch maps Kim triggers → K01-K06 modules (inline switch)
- `getSliderModule()`: else branch reads Kim sliders (stress, boundaryFatigue, emotionalBurden) inline
- `getDefaultModule()`: ternary returns 'K01' for Kim

### 4. lib/rugzak/backpack-relevance-analyzer.ts (lines 193-198)
**Status: INLINE KIM LOGIC — NOT DELEGATED**
- `scoreTrigger()`: else branch reads Kim slider thresholds inline (boundaryFatigue >= 6, emotionalBurden >= 6, selfCare <= 3)

### 5. server/ai-chat.ts (lines 780-788)
**Status: INLINE KIM LOGIC — NOT DELEGATED**
- Crisis instructions: `isElias ? <Elias crisis text> : <Kim crisis text>` — Kim crisis prompt text is still inline

### 6. lib/modules/module-system.ts (lines 118-167)
**Status: INLINE KIM MODULE DEFINITIONS**
- KIM_MODULES array (K01-K06) with triggers, thresholds — duplicates lib/engine/kim/module-catalog.ts

## SUMMARY

| File | Type | Delegated? |
|------|------|-----------|
| mock-provider.ts | Kim branch + inline helpers | NO |
| detector.ts | Kim routing branch | YES (calls checkKimCrisisTrigger) |
| dominant-state-selector.ts | Kim trigger→module + slider→module | NO |
| backpack-relevance-analyzer.ts | Kim slider scoring | NO |
| server/ai-chat.ts | Kim crisis prompt text | NO |
| module-system.ts | Kim module definitions | NO (duplicate of module-catalog.ts) |

**Conclusion: 6 files still contain Kim-specific branches outside lib/engine/kim/.**
- 1 file (detector.ts) properly delegates but still has the routing branch
- 5 files contain inline Kim logic that has NOT been extracted/delegated
