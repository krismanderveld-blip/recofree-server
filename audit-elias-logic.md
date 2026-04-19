# Elias-Related Logic Audit

Searched for: "elias", "mode", "persona", "stage", "behavior", "coach"

## Findings by File

### server/ai-chat.ts
- `userType: "elias" | "kim"` — used in ChatRequestInput, session cache, Zod schema
- `isElias = input.userType === "elias"` — branches Elias vs Kim identity/prompt
- Full Elias identity prompt (line ~682): "Je bent Elias. Digitale metgezel..."
- `stageOfChange` — stored in session cache, injected into system prompt conditionally
- `stageDescriptions` — maps stage names to Dutch descriptions for GPT prompt
- `coach` — appears in Kim identity text: "betrouwbare coach"
- Elias-specific crisis instructions (line ~820)
- Elias-specific schema recognition block (line ~1003)
- Elias-specific STOA session block (line ~1027)

### lib/ai/types.ts
- `stageOfChange` field in ChatContext and related types
- `userType: "elias" | "kim"` in multiple interfaces

### lib/ai/openai-provider.ts
- Forwards `stageOfChange` from GPT payload to server in SESSION_INIT, LIVE_MESSAGE, and FOLLOW_UP payloads

### lib/rugzak/pipeline.ts
- References `stageOfChange` from backpack intake context
- Passes `stageOfChange` into GPT payload builder

### lib/rugzak/gpt-payload-builder.ts
- `stageOfChange` field in GPTPayload interface
- Passes through to server payload

### lib/rugzak/engine.ts
- `userType` branching for slider access (craving vs stress, focus vs selfCare)
- Defaults to `'elias'` when userType missing
- Elias-specific zone calculation logic

### lib/rugzak/state-analyzer.ts
- Elias vs Kim slider type support
- `userType === 'elias'` branching for distress, stability, risk calculations

### lib/rugzak/dominant-state-selector.ts
- Full Elias vs Kim branching for dominant state codes (E_CRISIS vs K_CRISIS, E02 vs K01)
- Elias-specific state mapping

### lib/rugzak/backpack-relevance-analyzer.ts
- `userType: 'elias' | 'kim'` parameter
- Elias-specific relevance weighting

### lib/crisis/detector.ts
- Elias-specific crisis detection: craving >= 6, despondency >= 6
- `userType` branching for slider access

### lib/modules/module-system.ts
- `ELIAS_MODULES` — 8 Elias-specific recovery modules defined
- `KIM_MODULES` — separate Kim modules
- `userType: 'elias'` on each Elias module
- `persona` — not used here, but `userType` serves same purpose

### app/intake.tsx
- `stageOfChange` state + UI selection
- `selectedType === 'elias'` for companion selection
- Passes stageOfChange to user context on submit

### app/(tabs)/index.tsx
- `isElias` branching for greeting text and slider config
- `companionName` display

### app/(tabs)/chat.tsx
- `companionName = state.userType === 'elias' ? 'Elias' : 'Kim'`

### app/(tabs)/profile.tsx
- `isElias` branching for labels
- `stageOfChange` display from userDat

### app/(tabs)/mood.tsx
- `userType = state.userType ?? 'elias'` for slider config

### lib/rugzak/regulation-layer.ts
- No Elias-specific logic found

### lib/rugzak/regulation-decay-engine.ts
- No Elias-specific logic found

### lib/ai/preprocessor.ts
- Comment only: "before it reaches the Elias/Kim logic layer"

## Summary

Elias-specific logic is **deeply embedded** across the codebase. It is NOT isolated. Key areas:

| Category | Files | What exists |
|----------|-------|-------------|
| Identity/Prompt | server/ai-chat.ts | Full Elias persona prompt, crisis instructions, schema recognition, STOA sessions |
| Stage of Change | server/ai-chat.ts, pipeline.ts, gpt-payload-builder.ts, openai-provider.ts, intake.tsx, profile.tsx | Full flow from intake → backpack → pipeline → server → GPT prompt |
| Slider interpretation | engine.ts, state-analyzer.ts, dominant-state-selector.ts, crisis/detector.ts | Elias-specific slider mapping (craving, focus, despondency) |
| Module system | module-system.ts | 8 Elias-specific modules |
| UI branching | index.tsx, chat.tsx, profile.tsx, mood.tsx, intake.tsx | Companion name, greeting, labels |
| Backpack relevance | backpack-relevance-analyzer.ts | Elias-specific weighting |

**No existing code lives in `lib/engine/`** — all Elias logic is in `lib/rugzak/`, `lib/ai/`, `server/`, and `app/`.
