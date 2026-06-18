# PAAL01 Spec vs Implementation — Gap Analysis

## Summary

The current implementation covers the core PAAL01 flow (detector, memory patch, prompt, safety, pipeline) but has several gaps compared to the full spec. Below is the detailed comparison.

---

## 1. Trigger Contexts

### Spec defines:
- BLOCKED_BY_PERSONA ✅
- BLOCKED_BY_CRISIS ✅
- BLOCKED_BY_INTAKE ✅
- **DEFER_TO_SAFETY** ❌ (missing — spec requires this for relapseIntent, acuteDanger, severeIntoxication, medicalEmergency, PAARS, ROOD without stabilization)
- **DEFER_TO_GROUNDING** ❌ (missing — spec requires this for activeGroundingNeeded, ORANJE without stabilization)
- **OFFER_AS_FOLLOWUP** ❌ (missing — spec uses this for deferred activation)

### Spec trigger inputs missing from RuntimeInput:
- `stabilizedEnoughForReflection` ❌
- `activeGroundingNeeded` ❌
- `existingPillarsCount` ❌
- `existingBalanceItemsCount` ❌
- `profileFeatureFirstUse` ❌
- `hasRecentDifficultMomentResolved` ❌

### Spec intervention types (8 total):
- INTRODUCE_SUPPORT_PILLARS ❌ (not in types)
- INVENTORY_PEOPLE_ROUTINES_PLACES_BELIEFS ❌
- REMEMBER_EXISTING_PILLARS ❌
- POST_DIFFICULT_MOMENT_RECONNECT ❌
- BALANCE_BAR_INTRODUCTION ❌
- QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION ❌
- ADD_ONE_SMALL_PILLAR ❌
- BRIDGE_TO_PROFILE_FEATURE ❌

Current implementation uses 4 trigger contexts instead of intervention types.

### Spec confidence scoring:
- Spec uses additive scoring (+0.35 for explicit marker, +0.25 for first use, etc.)
- Current uses similar but slightly different weights
- Spec threshold: 0.55 for offer, 0.70 for active
- Current threshold: 0.60 for active (close enough, acceptable)

### Spec markers missing from current NL bank:
- "wat helpt mij" ❌
- "wie helpt mij" ❌
- "waar kan ik op terugvallen" ❌
- "ik weet niet wat mij nog helpt" ❌
- "ik heb steunpilaren nodig" ❌
- "wat zijn mijn steunpilaren" ❌
- "waar haal ik draagkracht uit" ❌
- "wat maakt dat ik toch doorga" ❌
- "wat helpt mij nuchter blijven" ❌
- "wat helpt mij stabiel blijven" ❌
- "wat hielp daarnet" ❌
- "hoe ben ik daar doorgeraakt" ❌
- "ik ben gezakt, wat hielp" ❌
- "ik wil onthouden wat hielp" ❌
- "dit moet ik onthouden voor later" ❌
- "wat trekt aan mij" ❌
- "wat weegt op mij" ❌
- "wat houdt mij recht" ❌
- "draaglast" ❌
- "draagkracht" ❌
- "balans" ❌
- "ik wil zien wat zwaar is en wat helpt" ❌
- "ik wil dit in mijn profiel zetten" ❌

---

## 2. Output Safety Filter

### Spec forbidden patterns missing:
- "ranking" ❌
- "je draagkracht is te laag" ❌
- "je draaglast is te hoog" ❌
- "je scoort slecht" ❌
- "je score is" ❌
- "je balans is negatief" ❌
- "je faalt" ❌
- "je hebt onvoldoende steun" ❌
- "je hebt te weinig steunpilaren" ❌
- "dit betekent dat je gaat hervallen" ❌
- "dit voorspelt herval" ❌
- "als je genoeg steunpilaren hebt herval je niet" ❌
- "je moet gewoon positief denken" ❌
- "je moet dankbaar zijn" ❌
- "je moet dit elke dag doen om punten te halen" ❌
- "diagnose" ❌
- "symptoom van" ❌
- "de engine weet" ❌
- "crisisprotocol hoeft niet" ❌
- "negatieve balans" ❌
- "mood sliders zijn minder belangrijk" ❌
- "opgeslagen in logs.dat" ❌

### Spec fallback text:
Spec: "Ik maak hier geen score van. We kijken alleen naar twee kanten: wat trekt er aan jou, en wat houdt je nog overeind?"
Current: "Ik wil niet vastzetten dat je niets hebt..."

---

## 3. Memory Layers — Justification

### Spec rules:
- **buffer**: ALWAYS required ✅
- **state.dat**: CONDITIONALLY — only when session reflective frame remains active ❌ (currently always written)
- **user.dat**: RELEVANT when user CONFIRMS a pillar ❌ (currently always increments moduleUsage + writes empty array)
- **projections.dat**: CONDITIONALLY — only for protective beliefs/handles ✅ (correctly conditional)
- **logs.dat**: RELEVANT on activation or meaningful update ✅ (acceptable — always on activation)

### Missing: `layerJustification` object
Spec requires a `Paal01MemoryLayerJustification` object with explicit reason per layer. Not present in current implementation.

---

## 4. Missing Spec Components

### Types:
- `Paal01InterventionType` enum (8 types) ❌
- `Paal01PillarType` (12 categories vs current 7) ❌
- `BalanceItemSource` type ❌
- `Paal01MemoryLayerJustification` interface ❌
- `Paal01CandidatePillar` in buffer ❌
- `BalanceBarCandidateItem` in buffer ❌
- `shouldIntroduceBalanceFeature` in detection result ❌
- `shouldWriteBalanceItemSuggestion` in detection result ❌
- `gptMayScoreUser: false` in prompt payload ❌
- Full `BalanceBarProfileState` with tags, notes, status, archive ❌
- `BalanceBarTag` type (17 tags) ❌
- `BalanceBarUiState` with crisis-disabled state ❌

### Balkfeature files missing:
- balanceBarStore.ts ❌
- balanceBarRepository.ts ❌
- balanceBarUiStateBuilder.ts ❌
- balanceBarCandidateExtractor.ts ❌
- balanceBarVspExporter.ts ❌
- balanceBarMemoryWriter.ts ❌
- balanceBarSafetyGate.ts ❌

### UI components missing:
- BalanceBarHeader ❌
- BalanceBarExplanationToggle ❌
- BalanceBarVisual (proper, no count-based comparison) ❌
- BalanceItemChipList ❌
- BalanceItemEditor (with tags, notes) ❌
- BalanceBarHistory ❌
- BalanceBarEmptyState ❌
- BalanceBarCrisisDisabledState ❌

### Context assembler issues:
- Still keyword-gated (line 80: relevanceKeywords check) ❌
- Still limited to turnIndex <= 2 as auto-allow ❌
- Spec says: not keyword-gated, every relevant turn

---

## Verdict

The implementation covers the **core engine logic** (detector, memory, prompt, safety, pipeline integration) but is missing:
1. **Richer activation statuses** (DEFER_TO_SAFETY, DEFER_TO_GROUNDING, OFFER_AS_FOLLOWUP)
2. **Intervention type selection** (8 types with distinct behavior)
3. **Many spec markers** in both NL and EN banks
4. **Many forbidden patterns** in the safety filter
5. **Conditional memory layer writing** (state.dat should be conditional, not always)
6. **Layer justification metadata**
7. **Full balkfeature infrastructure** (store, repository, tags, archive, history, crisis-disabled)
8. **Context assembler is still keyword-gated** (violates spec)
