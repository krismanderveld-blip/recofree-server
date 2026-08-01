# Bug Investigation: Backpack not loaded on chat restart (only on app restart)

## Problem
1. Elias doesn't know Melissa (partner in rugzak) unless full app restart
2. Chat end + restart → still doesn't know. Only full app refresh works.
3. Old diary/gratitude entries missing after previous fix.

## Data Flow (SESSION_INIT)

### Chat start flow (chat.tsx):
1. `sendGreetingViaP()` (line 447) reads backpack + userDat from `SessionMemoryCache.get()`
2. Falls back to `getBackpack()` / `getUserDat()` from React state if storage read fails
3. Calls `generateGreeting()` or `greetingV4()` with backpack + userDat + diaryEntries

### Pipeline (processMessage, line 3043-3088):
- On `isSessionStart=true`: builds `contextDatSerialized` via `distillContextDat()`
- `distillContextDat()` receives `backpack` directly (the object passed to processMessage)
- Extracts key figures from: `userDat.relationalAnchors` → `backpack.sections` → `logsDat`

### GPT Payload Builder (gpt-payload-builder.ts, line 814-843):
- If `contextDatSerialized` exists → sends MINIMAL backpack (empty lifeStory: [])
- context.dat contains the distilled key figures (including Melissa if extracted correctly)
- If contextDatSerialized is undefined → sends FULL backpack with all sections

## Key Insight: The problem is NOT in the distillation logic itself
- The backpack passed to `processMessage` comes from `SessionMemoryCache.get(BACKPACK_KEY)`
- If SessionMemoryCache returns stale data, the distiller gets stale backpack

## SessionMemoryCache behavior:
- `SessionMemoryCache.registerKeys([DIARY_KEY])` at line 131
- Reads from AsyncStorage
- Question: Does SessionMemoryCache have its own in-memory cache that doesn't refresh?

## Root Cause Hypothesis:
- `SessionMemoryCache` caches values in memory after first read
- When user edits backpack (in profile/backpack editor), it writes to AsyncStorage
- But SessionMemoryCache's in-memory cache is NOT invalidated
- On chat end + restart (same component mount?), the stale cache is still used
- On full app restart, SessionMemoryCache is re-initialized from AsyncStorage → fresh data

## Next: Check SessionMemoryCache implementation to confirm this hypothesis
- Location: likely in lib/ somewhere
- Look for in-memory caching behavior and cache invalidation

## Diary Issue:
- Diary loaded from `SessionMemoryCache.get(DIARY_KEY)` at line 476
- Same caching issue could apply
- OR: diary entries were lost due to a previous fix that cleared/overwrote them
