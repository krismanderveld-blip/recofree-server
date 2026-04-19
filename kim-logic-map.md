# Kim Logic Map — Current Codebase

Audit date: 2026-04-19. Read-only. No modifications, no suggestions.

---

## 1. Intake / Gatekeeper

| File | Function/Element | Description |
|------|-----------------|-------------|
| `app/intake.tsx` | `setSelectedType('kim')` (line 163) | User selects "I'm a loved one of someone" → sets userType to `'kim'` |
| `app/intake.tsx` | UI label (line 179) | Shows: "You'll be supported by Kim — a direct, honest companion for your well-being." |
| `app/intake.tsx` | Companion name display (lines 211, 392) | Conditionally shows "Kim" instead of "Elias" in intake text |
| `lib/ai/types.ts` | `KIM_SLIDER_CONFIG` (lines 108–113) | Defines 4 Kim sliders: stress, boundaryFatigue, emotionalBurden, selfCare |
| `app/intake.tsx` | Mood slider step | Uses `KIM_SLIDER_CONFIG` when userType is `'kim'` — same UI, different slider keys |

**Note:** Intake flow is shared between Elias and Kim. No Kim-specific gating logic exists. The only branching is the userType selection and the slider config used.

---

## 2. Slider Interpretation

| File | Function | Description |
|------|----------|-------------|
| `lib/ai/types.ts` | `KimMoodSliders` interface (lines 72–77) | Defines Kim slider keys: `stress`, `boundaryFatigue`, `emotionalBurden`, `selfCare` |
| `lib/ai/types.ts` | `KIM_SLIDER_CONFIG` (lines 108–113) | Slider metadata with thresholds for each Kim slider |
| `lib/rugzak/state-analyzer.ts` | `getDistressScore()` (line 54) | Kim: `(stress + boundaryFatigue + emotionalBurden) / 3` |
| `lib/rugzak/state-analyzer.ts` | `getResilienceScore()` (line 66) | Kim: `selfCare` value directly |
| `lib/rugzak/state-analyzer.ts` | `getPrimaryConcern()` (line 78) | Kim: `stress` value directly |
| `lib/rugzak/state-analyzer.ts` | Combined rule (line 237) | `stress > 6 AND emotionalBurden > 6 → grounding + directive` (Kim-specific) |
| `lib/rugzak/engine.ts` | Slider routing | Uses `userType` to select which slider config to apply — branched via if/else |

**Note:** Slider interpretation is NOT isolated. All functions branch on `userType` with if/else. Kim uses different slider keys but the same analysis functions as Elias.

---

## 3. Crisis / Redirect to Elias

| File | Function | Description |
|------|----------|-------------|
| `lib/crisis/detector.ts` | `assessCrisis()` (line 128) | Kim-specific: `emotionalBurden >= 6` adds a crisis trigger |
| `lib/crisis/detector.ts` | Generic thresholds (line 99) | Shared slider threshold analysis works for both Elias and Kim via `getSlider()` |
| `lib/rugzak/state-analyzer.ts` | `calculateRiskLevel()` (lines 142–155) | Uses generic distress/resilience scores — same function for both, different slider inputs |

**Note:** There is NO "redirect to Elias" logic. Crisis detection is shared. Kim has one additional trigger (`emotionalBurden >= 6`). No Kim-specific crisis escalation path exists.

---

## 4. Module Selection

| File | Function/Constant | Description |
|------|-------------------|-------------|
| `lib/modules/module-system.ts` | `KIM_MODULES` (lines 118–167) | 6 Kim-specific modules: K01 Boundary Setting, K02 Enabling Awareness, K03 Self-Care, K04 Stress Management, K05 Communication Skills, K06 Detachment with Love |
| `lib/modules/module-system.ts` | `getModuleRecommendations()` (line 171) | Filters modules by `userType` — returns only Kim modules for Kim users |
| `lib/rugzak/dominant-state-selector.ts` | `selectDominantState()` (line 156) | Accepts `userType` parameter — same selection logic, different module pool |
| `lib/rugzak/state-analyzer.ts` | Module suggestion (line 237) | Kim-specific combined rule: stress + emotionalBurden → grounding + directive |

**Note:** Module catalogs are separated (KIM_MODULES vs ELIAS_MODULES). Selection logic is shared. Kim modules use Kim slider keys as triggers.

---

## 5. Prompt Construction

| File | Location | Description |
|------|----------|-------------|
| `server/ai-chat.ts` | Lines 735–776 | Full Kim identity prompt: "Je bent Kim. Directe therapeutische begeleider voor naasten van verslaafden." |
| `server/ai-chat.ts` | Kim communication style | Direct, menselijk, helder. Korte krachtige zinnen. Geen wolligheid. |
| `server/ai-chat.ts` | Kim core principles | Grenzen stellen, zelfzorg, eerlijkheid boven comfort, verantwoordelijkheid bij juiste persoon |
| `server/ai-chat.ts` | Kim response logic | Kwetsbaar → verzacht toon. Chaotisch → vertraging. Rationele afstand → prikt doorheen. Zorggedrag → grijpt in. |
| `server/ai-chat.ts` | Kim specializations | Codependentie, grenzen, zelfzorg, emotioneel/financieel misbruik, kinderen beschermen |
| `server/ai-chat.ts` | Kim boundaries | "Ik ben hier voor jou, niet voor hem." "Jouw veiligheid is belangrijker dan zijn gevoelens." |
| `server/ai-chat.ts` | Line 29, 55, 143, 198, 238 | `userType: "elias" | "kim"` in interfaces and Zod schemas |

**Note:** Kim prompt is a single else-branch in `buildSystemPrompt()`. The full Kim identity block is inline in the server file. Not extracted to a separate file or config.

---

## 6. UI Branching

| File | Location | Description |
|------|----------|-------------|
| `app/(tabs)/index.tsx` | Line 33 | `companionName = isElias ? 'Elias' : 'Kim'` — home screen display |
| `app/(tabs)/chat.tsx` | Line 63 | `companionName = state.userType === 'elias' ? 'Elias' : 'Kim'` — chat header |
| `app/(tabs)/profile.tsx` | Line 28 | `companionName = isElias ? 'Elias' : 'Kim'` — profile screen |
| `app/intake.tsx` | Lines 163, 170, 179, 211, 392 | Kim selection card, conditional labels |

**Note:** UI branching is minimal — only companion name swaps. No Kim-specific screens, layouts, or visual theming. Same UI structure for both user types.

---

## 7. Backpack / Relevance

| File | Function | Description |
|------|----------|-------------|
| `lib/rugzak/backpack-relevance-analyzer.ts` | `calculateRelevanceScore()` (line 173) | Accepts `userType` parameter — same scoring function for both |
| `lib/rugzak/gpt-payload-builder.ts` | `buildGPTPayload()` (line 38) | `route: 'elias' | 'kim'` — passes userType to server payload |

**Note:** Backpack relevance logic is NOT Kim-specific. The same scoring function is used for both. No Kim-specific weighting or filtering exists.

---

## 8. Relational / Boundary Logic (Kim-critical)

| File | Function/Constant | Description |
|------|-------------------|-------------|
| `lib/rugzak/relational-pattern-analyzer.ts` | `RelationalPatternId` type (line 33) | Pattern types including boundary-related patterns |
| `lib/rugzak/relational-pattern-analyzer.ts` | `analyzeRelationalPatterns()` (line 254) | Full relational pattern analysis — text + backpack + anchors |
| `lib/rugzak/relational-pattern-analyzer.ts` | Kim priority note (line 370) | "Kim prioritizes: repeated pattern > relational wound > boundary strain" |
| `lib/rugzak/relational-pattern-analyzer.ts` | `countRepeatedEventSignals()` (line 373) | Patch J: detects repeated relational pain signals |
| `lib/rugzak/relational-pattern-analyzer.ts` | `countHistoricalRecurrence()` (line 394) | Checks historical sessions for same relational pattern |
| `lib/rugzak/short-term-memory-buffer.ts` | Kim trigger detection (lines 354–362) | Kim-specific triggers: boundary_violation, repeated_pattern, guilt, caregiver_fatigue, isolation, loved_one_relapse, anger_at_situation |
| `lib/ai/mock-provider.ts` | `kimResponses` (line 48) | Mock responses: boundary, enabling, crisis, lowMood, general |
| `lib/ai/mock-provider.ts` | Boundary/enabling detection (lines 108–115) | Kim-only: `detectBoundaryTopic()` and `detectEnablingPattern()` |

**Note:** The relational pattern analyzer is the most Kim-specific module. It contains Kim-prioritized logic (repeated patterns, relational wounds). The buffer also has Kim-specific trigger categories. However, the analyzer is still called from the shared pipeline — not isolated.

---

## Summary Table

| Functional Block | Isolated? | Location | Kim-specific code |
|-----------------|-----------|----------|-------------------|
| 1. Intake / Gatekeeper | No — shared UI | `app/intake.tsx` | userType selection + slider config swap |
| 2. Slider Interpretation | No — branched if/else | `state-analyzer.ts`, `types.ts`, `engine.ts` | 4 unique sliders, 3 derived scores, 1 combined rule |
| 3. Crisis / Redirect | No — shared + 1 extra trigger | `detector.ts`, `state-analyzer.ts` | `emotionalBurden >= 6` trigger only |
| 4. Module Selection | Partially — separate catalog | `module-system.ts`, `dominant-state-selector.ts` | 6 Kim modules (K01–K06), shared selection logic |
| 5. Prompt Construction | No — inline else-branch | `server/ai-chat.ts` | Full Kim identity block (lines 735–776) |
| 6. UI Branching | No — ternary swaps | `index.tsx`, `chat.tsx`, `profile.tsx`, `intake.tsx` | Name display only |
| 7. Backpack / Relevance | No — fully shared | `backpack-relevance-analyzer.ts`, `gpt-payload-builder.ts` | Only `route` field differs |
| 8. Relational / Boundary | Partially — Kim-prioritized | `relational-pattern-analyzer.ts`, `buffer.ts`, `mock-provider.ts` | Kim triggers, priority rules, mock responses |

---

## Conclusion

**Kim logic is scattered, not isolated.** It exists as:

- `if (userType === 'kim')` branches in shared files
- Separate slider keys and module catalogs within shared structures
- One inline prompt block in the server
- Kim-prioritized logic in the relational pattern analyzer (closest to isolated)
- Kim-specific trigger categories in the buffer

There is no `lib/engine/kim/` layer. No Kim-specific files exist. All Kim behavior is embedded in shared modules via conditional branching.
