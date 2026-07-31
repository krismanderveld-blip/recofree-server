# Full TypeScript Error List (150 errors total: 84 production, 66 test)

## Production Errors by File

### lib/rugzak/pipeline.ts (31 errors)
- `recentRelapseEvent` does not exist in type `UserDatSummaryPayload` (line 651)
- `estimatedTokens` does not exist in type (line 898)
- Cannot find name `sessionId` (lines 2342, 2376, 2432)
- Property `active` does not exist on type `KimAdvancedP7Result` (lines 2404, 2447, 2482)
- Comparison with `"critical"` unintentional — types `"moderate"|"low"|"high"` (lines 2520, 2527)
- Plus more similar type mismatches

### lib/pipeline/memory/memoryCommitService.ts (19 errors)
- Type mismatches in memory commit operations

### lib/pipeline/memory/sessionInitContextBuilder.ts (9 errors)
- Type mismatches in session init context building

### lib/ai/openai-provider.ts (7 errors)
- DiaryEntry type mismatch (line 470): gratitude field
- Properties don't exist on GPTPayload: relapseClusterContext, dangerChildContext, relationalDynamicsContext, emotionalLossContext, stoaKContext, vspInsightContext (lines 651-657)

### lib/ai/prompt-minimizer.ts (5 errors)
- `substring` does not exist on intakeContext type (line 88)
- `name` does not exist on Backpack type (line 92)
- `keyword` does not exist on TriggerPattern type (line 113)
- `overallScore`/`dominantEmotion` don't exist on MoodSnapshot (line 118)

### lib/user-context.tsx (4 errors)
- TendencyConfirmable type mismatches

### app/(tabs)/chat.tsx (4 errors)
- TendencyConfirmable type mismatches (lines 1299, 1304, 1307, 1312)

### lib/i18n/i18n-provider.tsx (3 errors)
- TranslationStrings type doesn't match actual translation objects (nl/en/fr)

### lib/engine/kim/kim-advanced-modules.ts (1 error)
- `caregiverShameLevel` does not exist in type `KST01RuntimeInputs` (line 116)

### server/routers.ts (1 error)
- backpackChanged type mismatch (FIXED - was boolean vs boolean|null)

## Test Errors (66 errors in __tests__/)
- exportImport: missing nowIso, platform, expoSdkVersion
- greetingFactGrounding: eligible/TODAY_DIARY type mismatches
- kimCluster3: REFLECTIVE not in KimCluster3ResponseMode
- kimCluster4: crisisEscalation doesn't exist
- kimDangerChildCluster: expected 2 args got 1
- memory-write-routing: ELIAS vs elias, relational, pattern_inference, emotional vs emotion

## Fix Strategy
1. openai-provider.ts: Add missing fields to GPTPayload interface
2. prompt-minimizer.ts: Update property names to match current types
3. pipeline.ts: Fix sessionId references, KimAdvancedP7Result.active, UserDatSummaryPayload
4. i18n-provider.tsx: Update TranslationStrings type to include new keys
5. chat.tsx/user-context.tsx: Fix TendencyConfirmable casting
6. Test files: Update string literals and function signatures
