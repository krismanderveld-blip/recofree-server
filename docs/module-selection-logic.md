# Module Selection Logic — Elias & Kim

This document describes the complete module selection pipeline as implemented in the current codebase. No code changes are proposed; this is a reference-only export of the existing logic.

---

## Architecture Overview

Module selection happens in **two stages**:

1. **Priority Module Computation** — determines which modules are *candidates* based on slider values, input signals, and trigger patterns (up to 3 modules, deduplicated).
2. **Dominant State Selection** — picks the *single* winning module from the candidates (or overrides them entirely) based on a strict 6-level priority hierarchy.

The final `dominantModule` in the `DominantState` output is what drives the GPT response.

---

## Stage 1: Priority Module Computation

### Elias Modules (E01–E08)

| Module | Name | Category | Slider Trigger | Keyword Trigger | Signal Trigger |
|--------|------|----------|----------------|-----------------|----------------|
| E01 | Craving Management | Acute | `craving >= 6` | craving, urge, want to use, tempted | `cravingMention` |
| E02 | Emotional Regulation | Core | `despondency >= 6` | overwhelmed, can't handle, too much, falling apart | `hopelessness` |
| E03 | Relapse Prevention | Core | — (trajectory = declining) | relapse, used again, slipped, fell off | — |
| E04 | Self-Compassion | Growth | `frustration >= 7` | hate myself, worthless, failure, ashamed | `dissociation` |
| E05 | Mindfulness & Grounding | Core | — | anxious, panic, racing, can't stop thinking | `isolationSignal` |
| E06 | Values & Meaning | Growth | — | why, purpose, meaning, motivation | `positiveSignal` |
| E07 | Focus & Clarity | Support | `focus <= 3` | can't focus, distracted, foggy, confused | — |
| E08 | ACT - Acceptance | Therapeutic | — | accept, struggle, fight, resist | — |

**Elias selection algorithm** (`computeEliasPriorityModules` + `eliasSignalToModules`):

1. Check slider thresholds (0–10 scale):
   - `craving >= 6` → push E01
   - `despondency >= 6` → push E02
   - `frustration >= 7` → push E04
   - `focus <= 3` → push E07
2. Check mood trajectory:
   - `declining` → push E03
3. Check long-term trigger patterns:
   - `isolation` pattern with count >= 2 → push E05
4. Check input text signals (regex-based):
   - `cravingMention` → push E01
   - `hopelessness` → push E02
   - `dissociation` → push E04
   - `isolationSignal` → push E05
   - `positiveSignal` → push E06
5. Deduplicate, cap at 3 modules.
6. **Fallback**: if empty → `E02` (Emotional Regulation).

### Kim Modules (K01–K06)

| Module | Name | Category | Slider Trigger | Keyword Trigger | Other Trigger |
|--------|------|----------|----------------|-----------------|---------------|
| K01 | Boundary Setting | Core | `boundaryFatigue >= 6` | boundary, boundaries, too much, can't anymore, limit | — |
| K02 | Enabling Awareness | Core | — | help, save, fix, cover, enable, protect, rescue | `enabling` pattern (count >= 2) |
| K03 | Self-Care | Core | `selfCare <= 3` or `emotionalBurden >= 6` | exhausted, tired, burned out, can't cope, drained | `hopelessness` signal |
| K04 | Stress Management | Core | `stress >= 6` | stressed, overwhelmed, too much, breaking down | — |
| K05 | Communication Skills | Practical | — | talk to, say to, communicate, conversation, argue, fight | `isolationSignal` |
| K06 | Detachment with Love | Growth | `emotionalBurden >= 5` | let go, detach, step back, distance, space | — |

**Kim selection algorithm** (`selectKimPriorityModules`):

1. Check slider thresholds (0–10 scale):
   - `stress >= 6` → push K04
   - `boundaryFatigue >= 6` → push K01
   - `emotionalBurden >= 6` → push K03
   - `selfCare <= 3` → push K03
2. Check input text signals:
   - `hopelessness` → push K03
3. Check active triggers:
   - `enabling` in activeTriggers → push K02
4. Check isolation signal:
   - `isolationSignal` → push K05
5. Deduplicate, cap at 3 modules.
6. **Fallback**: if empty → `K01` (Boundary Setting).

---

## Stage 2: Dominant State Selection (Priority Hierarchy)

The `selectDominantState` function in `dominant-state-selector.ts` applies a strict **6-level priority cascade**. The first level that matches wins — all lower levels are skipped.

| Priority | Layer | Condition | Module Source | Tone |
|----------|-------|-----------|---------------|------|
| 1 | **Crisis** | `intent === 'crisis'` OR `riskLevel === 'critical'` OR `zone === PURPLE` | `E_CRISIS` / `K_CRISIS` | crisis |
| 2 | **Urgent Live Trigger** | Buffer has `currentTriggerGuess` AND `zoneScore >= 50` | `eliasTriggerToModule()` / `kimTriggerToModule()` | zone-based |
| 3 | **Extreme Slider** | `primaryConcern >= 70` (0-100) OR (`distress >= 65` AND `resilience <= 30`) | `eliasSliderToModule()` / `kimSliderToModule()` | zone-based |
| 4 | **Session Pattern** | Buffer `temporaryRepeats` has signal with `count >= 3` | Trigger→module mapping (most repeated wins) | zone-based |
| 5 | **User.dat Pattern** | Long-term `triggerPatterns` with `count >= 3` AND `zoneScore >= 30` | Trigger→module mapping (highest count wins) | zone-based |
| 6 | **Backpack Relevance** | StateAnalyzer `priorityModules` has entries | First priority module from Stage 1 | zone-based |
| — | **Default** | No signals detected | `E02` (Elias) / `K01` (Kim) | zone-based |

### Trigger → Module Mapping (used by Priority 2, 4, 5)

**Elias:**

| Trigger | Module |
|---------|--------|
| craving | E01 |
| isolation | E05 |
| conflict | E04 |
| boredom | E07 |
| stress | E02 |
| sleep_disruption | E02 |
| trauma_memory | E02 |
| *(default)* | E02 |

**Kim:**

| Trigger | Module |
|---------|--------|
| boundary_violation | K01 |
| repeated_pattern | K02 |
| guilt | K03 |
| caregiver_fatigue | K03 |
| isolation | K05 |
| loved_one_relapse | K04 |
| anger_at_situation | K04 |
| *(default)* | K01 |

### Slider → Module Mapping (used by Priority 3)

**Elias** (`eliasSliderToModule`): Compares `craving`, `despondency`, `frustration` on 0–100 scale. The highest wins:
- Craving highest → E01
- Despondency highest → E02
- Frustration highest → E04

**Kim** (`kimSliderToModule`): Compares `boundaryFatigue`, `stress`, `emotionalBurden` on 0–100 scale. The highest wins:
- BoundaryFatigue highest → K01
- Stress highest → K04
- EmotionalBurden highest → K03

---

## Conflict Resolution Rules

When two candidates at the same priority level compete:

1. Choose the one with **higher live score** (zoneScore from buffer).
2. If equal, choose the one with **stronger risk impact** (higher riskScore).
3. If still equal, choose the **simpler stabilizing option** (lower module number).

In practice, the cascade structure means conflicts are rare — the first matching priority level wins outright.

---

## Fallback Summary

| User Type | Default Module | Crisis Module |
|-----------|---------------|---------------|
| Elias | E02 (Emotional Regulation) | E_CRISIS |
| Kim | K01 (Boundary Setting) | K_CRISIS |

The default module is used when:
- No slider exceeds its threshold
- No input signals are detected
- No trigger patterns are active
- The buffer has no live triggers or session patterns
- The backpack relevance analyzer returns no candidates

---

## Data Flow Diagram

```
User Message
    │
    ▼
detectInputSignals() ──► regex flags (craving, isolation, hopelessness, etc.)
    │
    ▼
analyzeState() ──► StateAnalysis { priorityModules, riskLevel, ... }
    │                    │
    │                    ▼
    │         selectPriorityModules() ──► [E01, E02, ...] or [K04, K01, ...]
    │                                         │
    ▼                                         │
ShortTermMemoryBuffer ──► buffer state        │
    │                                         │
    ▼                                         ▼
selectDominantState(buffer, analysis, mood, userType, triggerPatterns, priorityModules)
    │
    ▼
DominantState { dominantModule, dominantTrigger, sourceLayer, riskScore, ... }
    │
    ▼
Decision Layer (Elias/Kim) ──► EngineDirective ──► GPT Payload
```
