# Schema Mode Engine Canon — Implementation Notes

## Key Decisions
- HYBRID persistence: tendencies in user.dat, active modes in buffer/session only
- Deterministic engine validates candidates — LLM cannot decide alone
- Non-diagnostic: need-first language, no schema labels as fact
- Safety hierarchy overrides everything
- English-only internal constants

## Files to Create
1. `lib/engine/shared/schema-mode-types.ts` — all types from Section 9
2. `lib/engine/shared/schema-detector.ts` — schema detection from Section 11
3. `lib/engine/shared/mode-detector.ts` — mode detection from Section 11
4. `lib/engine/shared/schema-mode-router.ts` — intervention routing from Sections 12-13
5. Wire into pipeline.ts as Step 5f after STOA

## Type Summary (Section 9)
- ModeCandidate, ModeSignalSource, ModeEvidence, ModeInterventionHint, ModeDecision
- SchemaCandidate, SchemaActivationState, SchemaEvidence, SchemaDecision

## Enums
- SchemaId: 18 values (5 domains)
- SchemaDomain: 5 values
- ModeId: 22 values
- CopingStyle: 3 values (SURRENDER, AVOIDANCE, OVERCOMPENSATION)

## Prompt Builder Rules (Section 15)
- Return empty string if no safe validated context
- Prefer need language over labels
- Max injection: 1 line dominant mode, max 2 supporting, 1 schema if safe, 2 lines intervention, 1 line forbidden
- Never exceed budget, no raw backpack, no unvalidated evidence

## Pipeline Integration
- Step 5f after STOA (Step 5e)
- Result in ChatContext as `schemaModeContext`
- Compact string for prompt injection (like projectionContext/stoaContext)
