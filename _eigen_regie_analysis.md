# Eigen Regie Implementation Status

## ALREADY EXISTS:
1. `eigenRegie: number | null` in KimMoodSliders (types.ts:86)
2. `lib/engine/kim/eigen-regie.ts` — full 5-step model (score, zone, meaning, impact)
3. `lib/engine/kim/decision-layer.ts` — calls processEigenRegie, computes zone
4. Pipeline reads eigenRegie from currentMood, passes to decision-layer (pipeline.ts:1188-1189)
5. UI: PreChatEigenRegie component + mood.tsx slider (both exist)
6. Server Zod: eigenRegieHistory field (engine-process.ts:121)
7. Server: Kim crisis check eigenRegie < 10 (engine-process.ts:420-422)
8. stageOfChange still works for Elias (pipeline.ts:529, 541, 647, etc.)
9. eigenRegieHistory in UserDat (types.ts:440)

## STILL NEEDED (from todo):
1. **kimRecoveryState { eigenRegie: number }** — NOT in data model
   - The UserDat already has eigenRegieHistory and currentMood.eigenRegie
   - But there's no dedicated kimRecoveryState field that tracks the CURRENT eigen regie state
   - This should be a computed/persisted field that the pipeline and GPT can reference
   
2. **legacyStageOfChange migration** — Kim users still have stageOfChange in UserDat
   - Need: when userType=kim, stageOfChange should be ignored/migrated to eigenRegie-based system
   - Elias keeps stageOfChange unchanged

3. **GPT payload: include eigenRegie context for KIM**
   - Currently: stageOfChange is sent to GPT for ALL users (openai-provider.ts:548)
   - Needed: for Kim users, send eigenRegie zone/impact/meaning INSTEAD of stageOfChange
   - The kimDecision.eigenRegie result is computed but NOT injected into the ChatContext/GPT payload

4. **Server Zod: add current eigenRegie score field** (not just history)
   - engine-process.ts has eigenRegieHistory but not the current processed result

5. **Server system prompt: inject Eigen Regie context for Kim**
   - The server ai-chat.ts buildSystemPrompt does NOT have eigenRegie injection
   - Needed: when Kim, inject zone + impact + meaning into system prompt

## KEY INSIGHT:
The eigenRegie ENGINE works (computation, zones, impacts). What's missing is the LAST MILE:
- The computed result (zone, meaning, impact) never reaches the GPT system prompt
- The server doesn't know about the current eigenRegie state (only history)
- For Kim users, stageOfChange is still sent instead of eigenRegie

## FILES TO MODIFY:
- lib/ai/types.ts — add kimRecoveryState to UserDat or ChatContext
- lib/rugzak/pipeline.ts — inject eigenRegie result into ChatContext for Kim
- lib/ai/openai-provider.ts — send eigenRegie instead of stageOfChange for Kim
- server/engine-process.ts — add eigenRegie current score to Zod schema
- server/ai-chat.ts — inject eigenRegie context into system prompt for Kim
