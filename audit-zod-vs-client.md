# Zod Schema vs Client Payload Audit

## Fields the CLIENT sends (openai-provider.ts SESSION_INIT) vs Zod chatInputSchema

### ✅ Fields in BOTH client and schema (OK):
- userType, userName, message, conversationHistory, moodSliders, isSessionStart
- selectedTriggers, riskScore, dominantModule, vspLevel
- coreWound, contextLine, relationshipAnchor, relationalPattern
- recentDiary, stageOfChange, eigenRegieContext
- backpack, userDat, diaryEntries
- activeModules, crisisLevel, isCrisis, detectedEmotion
- therapeuticStance, sessionDurationMinutes, urgency, startEmotion
- guidanceDepth, bufferSnapshot, regulationResult, engineDirective
- interventionContinuity, projectionContext, projectionDeepening
- stoaContext, schemaModeContext, actContext, cgtContext, dgtContext, mbtContext
- ko1Context, k05Context, k02Context, k04Context, k04s4Context, k06Context
- k01Context, k03Context, sw01Context, sto01Context
- relapseClusterContext, dangerChildContext, relationalDynamicsContext
- emotionalLossContext, stoaKContext, vspInsightContext
- vspBackpackProfile, vspStructuredSection
- vergv01Context, igh01Context, agc01Context, hwk01Context
- fale01Context, verg01Context, rouw01Context, iden01Context
- zink01Context, terv01Context, mi02Context
- slaap01EliasContext, slaap01KimContext, bedr01Context, vetr01Context
- gasl01Context, cdp01Context, rnw01Context, par01Context, fin01Context, iso01Context
- loopDetected, languageRecovery
- clinicalModeActive, backpackEmpty, activeSignals
- extractedEntities, backpackChanged
- backpackAnalysis, knownUserPatterns
- psychoEducationContext, steunpilarenContext, selfAcceptanceContext, kimPatternSupportContext
- contextDat, deepeningBlock
- locale

### ❌ Fields CLIENT sends but NOT in Zod schema (SILENTLY DROPPED via passthrough):
1. **recentRelapseEvent** — sent as `(gptPayload).userDatSummary?.recentRelapseEvent ?? null`
2. **preventionPlan** — sent as `(gptPayload).userDatSummary?.preventionPlan ?? null`
3. **acknowledgedCandidates** — sent from `buildAcknowledgedCandidates(context.userDat)`

### ⚠️ Fields in Zod schema but NOT explicitly sent by client:
1. **relevanceScores** — in schema but not in SESSION_INIT payload (may come from LIVE_MESSAGE slim payload)
2. **contextSummary** — in schema but not in SESSION_INIT payload (may come from LIVE_MESSAGE slim payload)
3. **pastReferenceContext** — in schema but not in SESSION_INIT payload (may come from LIVE_MESSAGE slim payload)
4. **country** — in schema but not sent by client

## Impact Analysis:

Since the schema uses `.passthrough()`, fields NOT in the schema are NOT dropped — they pass through!
However, they are also NOT type-validated, which means:
- `recentRelapseEvent`, `preventionPlan`, `acknowledgedCandidates` DO reach the server handler
- But they are typed as `unknown` in the parsed result (not in ChatRequestInput interface)

The REAL issue is: are these fields in the **ChatRequestInput interface**?
If not, TypeScript won't let the server code access them without casting.

## Check: ChatRequestInput interface fields
Need to verify: recentRelapseEvent, preventionPlan, acknowledgedCandidates in the interface.
