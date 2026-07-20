# Schema/Mode Confirmation Layer V2 — Architecture Notes

## Current State
- `lib/engine/shared/tendency-confirmation.ts` — existing module with:
  - `shouldAutoConfirm()` — checks freq≥3 AND conf≥0.7
  - `applyAutoConfirmation()` — applies to array of tendencies
  - `confirmTendencyById()` — manual confirm by ID (unused currently)
  - `getConfirmedOnly()` — filter to confirmed
  - `getAllCandidates()` — returns all (for engine use)

- Types in `lib/ai/types.ts` line 448-450:
  - modeTendencies: `{ modeId, frequency, lastSeen, effectiveInterventions, firstDetectedAt?, lastUpdatedAt?, confidence?, confirmed?, confirmedAt? }`
  - schemaTendencies: `{ schemaId, domain, frequency, lastSeen, copingStyle, firstDetectedAt?, lastUpdatedAt?, confidence?, confirmed?, confirmedAt? }`

- `lib/engine/shared/schema-mode-types.ts` line 308-326:
  - `ModeTendency` and `SchemaTendency` types (simpler, used by engine)

## Where Things Happen
- **Schema/Mode engine runs**: pipeline.ts line 1307 (PRE-GPT STEP 5f)
- **Tendencies updated**: pipeline.ts line 4380-4420 (post-session, endSession function)
- **Auto-confirmation applied**: pipeline.ts line 4390, 4420
- **KNOWN USER PATTERNS built**: openai-provider.ts line 237 (buildKnownUserPatterns)
  - Normal mode: only `confirmed === true` with conf≥0.35
  - Clinical mode: ALL with conf≥0.3 (regardless of confirmed)
- **Schema-mode prompt injection**: per-turn via `schemaModeContext` (line 3005)

## V2 Plan
1. **Add fields to types**: `clinicalAcknowledged`, `userAcknowledged`, `acknowledgmentScore`
2. **New confirmation logic**:
   - Single ack (clinical OR user) → stays CANDIDATE, but `acknowledged = true`
   - Multi-source (auto≥3 + clinical + user, OR freq≥8) → CONFIRMED
3. **Acknowledged candidates in prompt**: get exploratory injection ("mogelijk patroon")
4. **Clinical ack detection**: when clinicalModeActive AND message contains confirm intent for a schema/mode
5. **User self-ack detection**: NLU patterns in user message referencing active schema/mode

## Where to Add User Ack Detection
- In pipeline.ts AFTER schema-mode engine runs (line ~1320)
- Check if user message acknowledges a schema/mode that was active in PREVIOUS turn
- Need to track: what schema/mode was presented to user last turn (from schemaModeResult)
- Track in sessionBuffer: `lastPresentedMode`, `lastPresentedSchema`

## Acknowledgment Patterns (Dutch + English)
- "ja dat herken ik" / "yes I recognize that"
- "dat klopt" / "that's right"
- "zo voelt het" / "that's how it feels"
- "precies" / "exactly"
- "dat is wat er gebeurt" / "that's what happens"
- "ik merk dat ook" / "I notice that too"
- "klopt helemaal" / "completely right"
- "zo zit het" / "that's how it is"
