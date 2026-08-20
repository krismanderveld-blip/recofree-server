# Forensic Scan Notes (preserved before context compaction)

## KEY FINDINGS SO FAR

### P1 BLOCKER: Post-GPT memory writeback only on legacy path
- pipeline.ts:933-963 runMemoryWriteBack runs ONLY when NOT on minimal proxy
- Minimal proxy path (EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY=true) skips memory writeback
- This means: projections.dat, state.dat, userDat pattern updates NEVER happen on minimal proxy
- Impact: DIST01 vice-versa is BROKEN on the production path

### P2: kim.selfCare slider NEVER READ
- Written by mood screen
- Never consumed by openai-provider or any prompt builder
- Dead field

### P2: Module memory NO debug/tests
- lib/engine/shared/module-memory-cross-session.ts
- lib/engine/elias/elias-module-memory.ts
- No debug visibility in clinical dropdown
- No dedicated tests

### P2: Projections.dat NO debug visibility
- @recofree_projection_elias, @recofree_projection_kim
- No line in clinical dropdown

### REMAINING REPORTS TO WRITE:
3. RECOFREE_PROMPT_BUILD_AUDIT.md + PROMPT_BLOCK_MATRIX.md
4. RECOFREE_PROVIDER_CONTRACT_AUDIT.md
5. RECOFREE_DIST01_VICE_VERSA_AUDIT.md
6. RECOFREE_FEATURE_REACHABILITY_AUDIT.md
7. RECOFREE_MODULE_SYSTEM_AUDIT.md
8. RECOFREE_OUTPUT_CONTRACT_AUDIT.md
9. RECOFREE_I18N_COPY_AUDIT.md
10. RECOFREE_SAFETY_PRIVACY_MDR_AUDIT.md
11. BIDIRECTIONAL_FIELD_TRACE_MATRIX.md
12. RECOFREE_RELEASE_DECISION_MATRIX.md + RECOFREE_TOTAL_FIX_PLAN.md

## SCAN DATA COLLECTED
- 150 test files, 3912 tests pass
- 143,381 total lines of code
- 19 legacy server files
- 152 exported functions in engine/shared
- 5 feature flags active
- 10 memory layers identified
- 26 dataflow steps mapped
- store:false confirmed on all routes
- Encryption fallback works (readEncrypted handles plain JSON)
- schemas/modes prompt now has exact enum whitelist (fix 96340757)
