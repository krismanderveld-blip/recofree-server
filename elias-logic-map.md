# Elias Logic Map — Current Codebase

Mapping of all existing Elias-specific logic organized by functional block.
No modifications, no suggestions, no gap-filling. Only what exists.

---

## Block 1: Intake / Gatekeeper

**File:** `app/intake.tsx`

**What exists:**
- Multi-step intake screen (5 steps)
- Step 1: User selects `userType` ("elias" or "kim")
- Step 2: Stage of Change selection — shared UI for both Elias and Kim, uses `STAGE_OF_CHANGE_OPTIONS` array with 5 options: `precontemplation`, `contemplation`, `preparation`, `action`, `maintenance`
- Step 3: Start emotion (free text)
- Step 4: Urgency level (`laag`, `midden`, `hoog`)
- Step 5: Initial context (free text)
- `handleSubmit()` calls `completeIntake()` with all collected data, then routes to `/(tabs)`

**Elias-specific behavior:**
- Step 1 description text differs: "Ik worstel zelf met verslaving" for Elias
- No other Elias-specific branching in intake — same flow for both personas

**Data produced:**
- `name`, `userType`, `stageOfChange`, `startEmotion`, `urgency`, `initialContext`
- Stored in backpack via `completeIntake()`

---

## Block 2: Stage of Change Usage

**Files:** `app/intake.tsx`, `lib/rugzak/gpt-payload-builder.ts`, `lib/ai/openai-provider.ts`, `server/ai-chat.ts`

**What exists:**

### Collection (intake.tsx)
- 5 stages: `precontemplation`, `contemplation`, `preparation`, `action`, `maintenance`
- Same options for both Elias and Kim
- Stored in `backpack.intakeContext.stageOfChange`

### Pipeline transport (gpt-payload-builder.ts)
- `stageOfChange` is read from `backpack.intakeContext.stageOfChange`
- Included in `GPTPayload` as a string field
- Forwarded to server in every payload

### Client transport (openai-provider.ts)
- `stageOfChange` is sent in both `SESSION_INIT` and `LIVE_MESSAGE` payloads to server

### Server usage (ai-chat.ts)
- `stageOfChange` is part of `ChatRequestInput` interface
- Used in `buildSystemPrompt()`:
  - Mapped to Dutch descriptions in `stageDescriptions` object
  - Injected into system prompt as: `Fase van verandering: {stage} — {description}`
  - Included in both session-start and follow-up prompts (follow-up: conditionally via `resolveConditionalContext`)

**Elias-specific behavior:**
- Stage descriptions are generic (not Elias-specific)
- No Elias-specific stage interpretation exists
- Same stage logic applies to both personas

---

## Block 3: Slider Interpretation

**Files:** `lib/rugzak/state-analyzer.ts`, `lib/rugzak/dominant-state-selector.ts`, `lib/crisis/detector.ts`

**What exists:**

### state-analyzer.ts
- `getDistressScore(mood, userType)`: Elias = avg(craving, frustration, despondency); Kim = avg(stress, boundaryFatigue, emotionalBurden)
- `getResilienceScore(mood, userType)`: Elias = focus; Kim = selfCare
- `getPrimaryConcern(mood, userType)`: Elias = craving; Kim = stress
- These drive: risk level, emotional state, tone, pacing, suggestion intensity
- Module selection in `selectPriorityModules()`: Elias-specific rules map slider values to modules (E01–E08)

### dominant-state-selector.ts
- `getDistress100()`: Elias = avg(craving, frustration, despondency) * 10
- `getResilience100()`: Elias = focus * 10
- `getPrimaryConcern100()`: Elias = craving * 10
- `getSliderModule()`: Elias routes to E01 (craving highest), E02 (despondency highest), E04 (frustration highest)
- These drive priority selection in the 6-layer dominant state selector

### crisis/detector.ts
- Elias-specific crisis triggers: `extreme_craving` (craving >= 6), `extreme_despondency` (despondency >= 6)
- Generic triggers also apply: combined distress + low resilience escalation

**Elias slider set:** `craving`, `frustration`, `despondency`, `focus` (4 sliders)
**Kim slider set:** `stress`, `boundaryFatigue`, `emotionalBurden`, `selfCare` (4 sliders)

---

## Block 4: Crisis Detection

**File:** `lib/crisis/detector.ts`

**What exists:**
- `assessCrisis(message, moodSliders, userType)` — returns `CrisisAssessment { level, triggers, recommendedAction }`
- Level 0 = none, 1 = elevated, 2 = active crisis

### Detection layers:
1. **Text patterns** (regex): `suicidal_active`, `suicidal_passive`, `self_harm`, `dissociation`, `relapse` — generic, not Elias-specific
2. **Slider thresholds**:
   - Generic: distress >= 6 → level 1, resilience <= 1 → level 1
   - Elias-only: craving >= 6 → `extreme_craving` trigger, despondency >= 6 → `extreme_despondency` trigger
   - Kim-only: emotionalBurden >= 8 → `extreme_emotional_burden`
   - Combined: distress >= 7 AND resilience <= 2 → level 2

### Output:
- `level`: 0, 1, or 2
- `triggers`: array of trigger strings
- `recommendedAction`: "none" | "intervene" | "emergency"

### Usage in pipeline (pipeline.ts):
- `analysis.riskLevel` maps to `crisisLevel` (0, 1, 2)
- `crisisLevel >= 2` → `showEmergency = true`
- Crisis level forwarded to server in ChatContext

### Usage in server (ai-chat.ts):
- `crisisLevel` drives crisis instructions in system prompt
- Level 2: full emergency protocol with 113 Zelfmoordpreventie reference
- Level 1: elevated awareness instructions

---

## Block 5: Module Selection

**Files:** `lib/modules/module-system.ts`, `lib/rugzak/state-analyzer.ts`, `lib/rugzak/dominant-state-selector.ts`

**What exists:**

### Module catalog (module-system.ts)
8 Elias modules:
| ID | Name | Primary trigger |
|----|------|----------------|
| E01 | Craving Management | craving >= 6, keywords: trek/craving/drang |
| E02 | Emotional Regulation | despondency >= 6, keywords: verdriet/boos/angstig |
| E03 | Relapse Prevention | craving_trend_up condition |
| E04 | Self-Compassion | frustration >= 6, keywords: schuld/schaamte |
| E05 | Mindfulness & Grounding | overprikkeling >= 7, keywords: paniek/onrustig |
| E06 | Values & Meaning | positive signal, keywords: doel/waarde/zin |
| E07 | Focus & Clarity | focus <= 3, keywords: concentratie/helder |
| E08 | ACT - Acceptance | keywords: acceptatie/vermijding/controle |

### Rule-based selection (state-analyzer.ts → selectPriorityModules)
- Elias rules: craving >= 7 → E01, despondency >= 7 → E02, declining trend → E03, frustration >= 7 → E04, isolation signals → E05, low focus → E07, positive → E06, default E02
- Returns priority-ordered module list

### Dominant state selection (dominant-state-selector.ts)
- 6-layer priority: crisis → live trigger → extreme slider → session pattern → userdat pattern → backpack relevance → default
- Elias crisis module: `E_CRISIS`
- Elias trigger-to-module mapping: craving→E01, isolation→E05, conflict→E04, boredom→E07, stress→E02, etc.
- Elias default: `E02`

### How they connect:
- `module-system.ts` provides `getModuleRecommendations()` — used for general module catalog
- `state-analyzer.ts` provides `selectPriorityModules()` — used in pipeline as `analysis.priorityModules`
- `dominant-state-selector.ts` picks ONE dominant module from all inputs — this is the final decision

---

## Block 6: Prompt Construction

**File:** `server/ai-chat.ts`

**What exists:**

### Identity prompt (Elias-specific, hardcoded)
- Full Dutch persona: "Ik ben Elias. Geen therapeut, geen AI-assistent..."
- Defines tone, boundaries, behavior rules
- Includes anti-hallucination instructions
- Only used when `isElias = true`

### Schema recognition (Elias-only)
- Schema therapy modes: kwetsbaar kind, boos kind, veeleisende ouder, straffende ouder, afstandelijke beschermer, gezonde volwassene
- Pattern recognition instructions
- Only injected at session start

### STOA sessions (Elias-only)
- 15 Stoic session templates mapped to emotional contexts
- Only injected at session start

### Backpack injection
- Full life story, intake context, relationship map
- Injected at session start, cached for follow-ups

### UserDat injection
- Trigger patterns, mood history, module usage, session analyses
- Injected at session start

### Diary injection
- Recent diary entries
- Injected at session start

### Dynamic per-message injection
- Mood sliders (always)
- Buffer snapshot: zone, emotional direction, live intent, dominant state (always)
- Module instructions: dominant module name (always)
- Crisis instructions: based on crisisLevel (conditional)
- Guidance depth: light/normal/deep with ceiling logic (always)
- Regulation instruction: from regulation layer (conditional)
- Stage of change: conditionally in follow-ups via `resolveConditionalContext`

### Follow-up vs session-start
- Session start: full prompt with all context
- Follow-up: selective injection from cache — only relevant parts re-injected based on message content analysis (`resolveConditionalContext`)

---

## Summary: Where Elias Logic Lives

| Functional Block | Files | Isolated? |
|-----------------|-------|-----------|
| Intake/Gatekeeper | `app/intake.tsx` | Shared with Kim (same UI) |
| Stage of Change | `intake.tsx`, `gpt-payload-builder.ts`, `openai-provider.ts`, `ai-chat.ts` | Shared (no Elias-specific interpretation) |
| Slider Interpretation | `state-analyzer.ts`, `dominant-state-selector.ts`, `detector.ts` | **Branched** (if/else on userType) |
| Crisis Detection | `detector.ts` | **Branched** (Elias-specific triggers added) |
| Module Selection | `module-system.ts`, `state-analyzer.ts`, `dominant-state-selector.ts` | **Branched** (separate module catalogs + rules) |
| Prompt Construction | `ai-chat.ts` | **Branched** (Elias identity, schema, STOA are conditional) |

**Key observation:** No Elias logic is truly isolated. Everything is branched via `if (userType === 'elias')` or `if (isElias)` checks scattered across shared files. There is no `lib/engine/elias/` layer.
