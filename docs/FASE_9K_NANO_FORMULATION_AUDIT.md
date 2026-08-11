# NANO ↔ FORMULATION DETECTORS AUDIT

**Date:** 2026-08-11  
**Status:** READ-ONLY AUDIT — No code changes  
**Context:** FASE 9K identified 5 DETECTOR_FALSE_NEGATIVE gaps (E4, K3, K7, K8, M1)

---

## 1. NANO OUTPUT SCHEMA

### Client-side interface (`lib/pipeline/nano-interpret-client.ts`)

```typescript
interface ClientNanoInterpretResult {
  translatedNL: string;           // Dutch translation of user message
  intent: string;                 // 'seeking_action' | 'exploring' | 'venting' | 'crisis_signal' | 'informational' | 'greeting'
  themes: string[];               // 1-4 labels from controlled vocabulary
  resolvedModule: string | null;  // Deterministic module from theme→module mapping
  matchedTheme: string | null;    // First theme that mapped to a module
}
```

### Server-side interface (`server/engine/nano-interpret.ts`)

```typescript
interface NanoInterpretResult {
  translatedNL: string;
  intent: 'seeking_action' | 'exploring' | 'venting' | 'crisis_signal' | 'informational' | 'greeting';
  themes: string[];  // Only labels from controlled vocabulary
}
```

### Key characteristics:
- **Model:** gpt-4.1-nano (via OpenAI API on Railway)
- **Temperature:** 0.1
- **Response format:** JSON object (forced)
- **Hallucination guard:** themes filtered against closed vocabulary set
- **Confidence/scoring:** NONE — no confidence field exists
- **Timeout:** 8 seconds client-side
- **Fallback:** null on failure (keyword matching takes over)

### Controlled vocabulary:
- **Elias:** 397 theme labels covering 91 modules
- **Kim:** 158 theme labels covering 96 modules

---

## 2. PIPELINE FLOW — WHERE NANO RUNS

```
user input
  ↓
[crisis/safety check] (line ~1187)
  ↓
callNanoInterpret() (line 1194) — IF not crisis AND flag enabled
  ↓
clientNanoResult stored (themes, intent, translatedNL, resolvedModule, matchedTheme)
  ↓
selectDominantState() — uses resolvedModule for module selection
  ↓
CMD runtime (line ~3400)
  ↓
Epistemic engine (line ~3420)
  ↓
Kim/Elias Formulation Engine (line ~3442 / ~3616)
  ↓ clientNanoResult.themes passed as input.semanticThemes
  ↓ clientNanoResult.translatedNL passed as input.normalizedMessage
  ↓ clientNanoResult.resolvedModule passed as input.semanticResolvedModule
  ↓ clientNanoResult.matchedTheme passed as input.semanticMatchedTheme
  ↓
prompt builder
  ↓
GPT response
```

### CRITICAL FINDING: Nano output IS available before formulation detectors

The formulation engine receives nano output via:
- `input.semanticThemes` — array of theme labels
- `input.normalizedMessage` — Dutch translation
- `input.semanticResolvedModule` — resolved module ID
- `input.semanticMatchedTheme` — matched theme label
- `input.semanticSource` — 'nano' | 'deterministic'

---

## 3. CURRENT USAGE BY FORMULATION DETECTORS

### Kim Relational Formulation Engine

**How nano enters the detector layer:**
```typescript
const combinedText = [
  primaryText,                           // normalizedMessage (= nano translatedNL)
  ...(input.userMessage),                // original user message
  ...(input.memoryFacts || []),
  ...(input.engineSignals || []),
  ...(input.semanticThemes || []),       // ← NANO THEMES APPENDED AS TEXT
].join(' ');
```

Then each detector runs `regex.test(combinedText)`.

| Detector | Uses nano themes? | How? | Effective? |
|----------|------------------|------|-----------|
| detectRescue | INDIRECT | themes appended to combinedText as raw strings | **NO** — theme labels like `responsibility_for_others` don't match rescue regex patterns |
| detectMindreading | INDIRECT | same | **NO** — no theme label matches `expres\|opzettelijk\|bewust` |
| detectMedical | INDIRECT | same | **NO** — no theme label matches medical boundary regex |
| detectRepeatedHarm | INDIRECT | same | **PARTIAL** — `broken_trust` and `betrayal` as text could match TRUST_TRIGGERS |
| detectChildTrust | INDIRECT | same | **NO** — theme labels don't match child reference + trust patterns |

### Elias Recovery Formulation Engine

**How nano enters the detector layer:**
```typescript
const themes = input.semanticThemes ?? [];
// Detectors use: themes.includes('craving') || REGEX.test(text)
```

Elias detectors **explicitly check theme labels** via `themes.includes()`:
- `themes.includes('craving')` → craving detector
- `themes.includes('shame')` → shame detector
- `themes.includes('emotional_overload')` → overload detector
- etc.

**This is the key architectural difference:**
- **Elias:** `regex_match OR themes.includes(label)` — nano supplements regex
- **Kim:** `regex.test(combinedText_with_themes_as_text)` — nano themes treated as raw text, NOT semantically checked

---

## 4. NANO TEST ON 6 INPUTS (PREDICTED OUTPUT)

Since nano cannot be called without a live API call (and this is a read-only audit), the following analysis is based on the controlled vocabulary and the nano's documented behavior:

| Input | Predicted nano themes (Kim) | Regex detector result | FormBlock |
|-------|---------------------------|----------------------|-----------|
| A. "Ik denk dat hij ontwenningsverschijnselen heeft." | `self_medication`, `responsibility_for_others` | detectMedical: **MISS** (regex gap) | NONE |
| B. "Zijn lever is kapot van het drinken." | `self_medication` | detectMedical: **MISS** (regex gap) | NONE |
| C. "Mijn hele dag hangt af van hoe hij thuiskomt." | `loss_of_control_in_relationship`, `identity_confusion_under_pressure` | No detector: **MISS** (no self-loss detector) | NONE |
| D. "Ik moet hem gemotiveerd houden om niet opnieuw te drinken." | `responsibility_for_others`, `overcontrol` | detectRescue: **HIT** (after FASE 9J-R2 fix) | medium |
| E. "Hij liegt omdat hij mij expres wil kwetsen." | `broken_trust`, `gaslighting` | detectMindreading: **HIT** | medium |
| F. "Mijn dochter vertrouwt hem niet meer omdat hij telkens drinkt en liegt." | `broken_trust`, `betrayal` | detectRepeatedHarm: **HIT** + detectChildTrust: depends on conjunctive | medium |

### Key observation:
- For A, B, C: nano produces **generic** labels (self_medication, responsibility_for_others, loss_of_control_in_relationship)
- These labels do NOT exist in the Kim formulation detector vocabulary
- The Kim detectors only check regex patterns, not `themes.includes()`
- Even if nano produced perfect labels, the Kim engine would NOT use them because it doesn't have `themes.includes()` checks like Elias does

---

## 5. CAN THE ENGINE SAFELY USE NANO AS SEMANTIC SUPPLEMENT?

### Conceptual architecture:
```
DETECTED = regex_match OR trusted_nano_semantic_hint
```

### Answer: **YES, but requires MODERATE changes**

The architecture is sound because:
- Nano runs BEFORE formulation detectors (confirmed)
- Nano output is already passed to the formulation engine (confirmed)
- The deterministic engine makes the final decision (confirmed)
- Nano doesn't write mustMention/mustAvoid (confirmed)
- Nano doesn't make safety decisions (confirmed)
- Nano doesn't choose modules definitively (confirmed — engine overrides)

### BUT: Two blockers exist

**Blocker 1:** Kim vocabulary lacks specific labels for the 4 gap categories:
- No `medical_boundary`, `withdrawal_symptoms`, `organ_damage`
- No `rescue_role`, `controlling_recovery`, `managing_other_recovery`
- No `intent_attribution`, `mindreading`, `motive_assumption`
- No `self_loss_through_other`, `emotional_dependency`, `day_depends_on_other`

**Blocker 2:** Kim formulation engine doesn't use `themes.includes()` like Elias does:
- Kim appends themes as text to combinedText (useless for regex matching)
- Kim would need explicit `themes.includes('medical_boundary')` checks added to each detector

---

## 6. FEASIBILITY WITHOUT MAJOR CHANGES

| Requirement | Possible? |
|-------------|-----------|
| No new model | YES — same gpt-4.1-nano |
| No extra OpenAI call | YES — same single nano call |
| No model routing change | YES — nano is pre-call, routing is post-formulation |
| No DIST01 change | YES |
| No memory architecture change | YES |
| No safety architecture change | YES |
| No large refactor | **MODERATE** — vocabulary extension + detector logic addition |

---

## 7. IMPACT CLASSIFICATION

### **B. MODERATE CHANGE**

Nano output exists and is architecturally available, but:
1. The Kim controlled vocabulary needs 8-12 new labels added
2. The Kim formulation detectors need `themes.includes()` checks added (like Elias already has)
3. A confidence threshold mechanism should be added (nano currently has NO confidence field)

---

## 8. MINIMAL REQUIRED CHANGES (IF APPROVED)

### Files to modify:

| File | Change |
|------|--------|
| `server/engine/nano-interpret.ts` | Add 8-12 new Kim theme labels to `KIM_THEME_LABELS` |
| `server/engine/nano-interpret.ts` | Add theme→module mappings for new labels |
| `lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts` | Add `themes.includes()` checks to detectRescue, detectMindreading, detectMedical, detectRepeatedHarm |
| `__tests__/engine/kim/` | Add tests for nano-supplemented detection |

### New Kim theme labels needed:

```typescript
// Medical boundary (for detectMedical)
'medical_concern_partner', 'withdrawal_symptoms', 'organ_damage_concern',

// Rescue role (for detectRescue)
'rescue_role', 'controlling_other_recovery', 'managing_other_sobriety',

// Mindreading (for detectMindreading)
'intent_attribution', 'motive_assumption', 'deliberate_harm_belief',

// Self-loss (for future self-loss detector)
'emotional_dependency', 'self_loss_through_other', 'day_depends_on_other',
```

### Detector logic change (example for detectMedical):

```typescript
function detectMedical(text: string, themes?: string[]): DetectedPattern | null {
  const regexMatch = MEDICAL_BOUNDARY.test(text);
  const nanoMatch = themes?.some(t => 
    t === 'medical_concern_partner' || 
    t === 'withdrawal_symptoms' || 
    t === 'organ_damage_concern'
  ) ?? false;
  
  if (!regexMatch && !nanoMatch) return null;
  if (MEDICAL_NEGATIVE.test(text) && !regexMatch) return null; // negative filter still applies
  // ... rest unchanged
}
```

### Confidence threshold:
Since nano has no confidence field, the safety mechanism is:
1. Closed vocabulary (hallucination guard already exists)
2. Negative regex filter still applies AFTER nano match
3. Persona context (Kim-only labels)
4. Combined check: nano hint alone is insufficient if negative filter fires

---

## 9. FALSE POSITIVE RISK ANALYSIS

### "Ik voel me ziek van zorgen" → medical false positive?

**Risk: LOW**
- Nano would likely produce `emotional_overwhelm` or `exhaustion`, NOT `medical_concern_partner`
- The new label `medical_concern_partner` specifically requires concern about the OTHER person's medical state
- Nano's controlled vocabulary forces it to pick from the closed set — "ziek van zorgen" maps to emotional labels, not medical ones
- Additional safety: the negative regex filter (`MEDICAL_NEGATIVE`) still blocks figurative medical language

### "We plannen samen" → rescue false positive?

**Risk: LOW**
- Nano would produce `general_question` or `greeting`, NOT `rescue_role`
- The label `controlling_other_recovery` specifically requires recovery/sobriety management context
- The negative regex filter (`RESCUE_NEGATIVE`) still blocks healthy planning language

### Recommended safety architecture:

```
DETECTED = (regex_match) OR (nano_theme_match AND NOT negative_regex_match)
```

This means:
- Regex alone can trigger (backward compatible)
- Nano alone can trigger BUT negative filter still blocks
- Both together = highest confidence
- Negative filter always has veto power over nano (deterministic wins)

---

## 10. FINAL VERDICT

| Question | Answer |
|----------|--------|
| **NANO CURRENTLY WORKS** | **PARTIAL** — nano runs, produces themes, but Kim detectors don't use them semantically |
| **NANO AVAILABLE BEFORE FORMULATION** | **YES** — confirmed at pipeline line 1194, passed to formulation at line 3458 |
| **NANO SEMANTIC SIGNALS SUFFICIENT** | **NO** — vocabulary lacks specific labels for the 4 gap categories |
| **RECOMMENDED ARCHITECTURE** | `DETECTED = regex_match OR (nano_theme_match AND NOT negative_regex)` with 8-12 new Kim labels |
| **ESTIMATED CHANGE SIZE** | **MODERATE** (B) — vocabulary extension + detector logic addition |
| **RECOMMENDED NEXT ACTION** | Add 8-12 Kim-specific theme labels + add `themes.includes()` checks to 4 Kim detectors (like Elias already does) |

---

## ADDITIONAL OBSERVATIONS

1. **Elias already does this correctly** — Elias detectors use `themes.includes('craving') || REGEX.test(text)`. Kim should follow the same pattern.

2. **No extra API call needed** — the same nano call that already runs produces the themes. Only the vocabulary and detector logic need updating.

3. **Backward compatible** — regex still works independently. Nano is additive, not replacing.

4. **Deterministic engine remains in control** — nano provides hints, engine decides. mustMention/mustAvoid still come from the detector, not from nano.

5. **Safety architecture untouched** — safety/crisis check runs BEFORE nano. If safety is active, nano doesn't run. Safety detectors are independent of formulation detectors.

6. **No DIST01/CMD/memory changes** — this is purely a detector-layer enhancement.

---

**END OF AUDIT — NO CODE CHANGES MADE**
