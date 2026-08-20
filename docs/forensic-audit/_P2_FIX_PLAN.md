# P2 Fix Plan — Active Work

## P2-1: React state.userDat sync (IN PROGRESS)
- ManualDataRefreshButton uses `useUser()` which gives `{ state }` but NOT `dispatch`
- Need to also destructure `dispatch` from useUser()
- After runManualDataRefresh completes, read latest userDat from SessionMemoryCache
- Dispatch UPDATE_USERDAT to React reducer
- File: components/profile/ManualDataRefreshButton.tsx
- Import: SessionMemoryCache from '@/lib/crypto/session-memory-cache'
- Key: USERDAT_KEY = '@recofree_userdat'

## P2-2: contextDat cold start
- File: lib/pipeline/context-dat-session-cache.ts
- On cache miss, rebuild from latest userDat instead of returning undefined
- Debug: src=rebuilt_after_cold_start
- File: lib/rugzak/pipeline.ts (contextDat loading section)

## P2-3: Projections.dat debug
- File: lib/rugzak/pipeline.ts (clinicalInfo section ~line 4320)
- Read projection stores and add counts to clinicalInfo
- Format: Projections: fears=N hopes=N

## P2-4: Module memory debug + tests
- File: lib/rugzak/pipeline.ts (clinicalInfo section)
- File: lib/engine/elias/elias-module-memory.ts
- File: lib/engine/shared/module-memory-cross-session.ts
- Add: ModuleMemory: dominant=X secondary=[Y,Z] contextOnly=[W]
- Tests: module repeat detection, cross-session persistence

## P2-5: kim.selfCare slider wiring
- WIRE (not remove) — user confirmed
- Low selfCare → influence Kim routing toward K03/self-care/eigen regie
- File: lib/ai/openai-provider.ts (buildStateSignals, around line 180-186)
- Add selfCare signal like other Kim sliders
- File: lib/rugzak/pipeline.ts (Kim module selection area)
- Low selfCare could boost K03 priority
- No coach role, no guilt
- Tests: low/medium/high selfCare impact

## Key imports/patterns:
- useUser() returns { state, dispatch, ... }
- dispatch({ type: 'UPDATE_USERDAT', payload: updatedUserDat })
- SessionMemoryCache.get('@recofree_userdat') returns JSON string or null
- clinicalInfo object built around pipeline.ts line 4320
