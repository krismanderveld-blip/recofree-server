# Conversation History Bug Analysis

## Problem 1: Previous session content not reaching GPT follow-up messages

### Current flow:
1. `logs.dat` stores `compressedNarrative` per session (rich text summary of what was discussed)
2. At session-start, `chat.tsx` loads `logs.dat` and passes it to the **greeting engine** only
3. The greeting engine uses it to generate a warm, contextual greeting
4. The **main chat GPT call** (follow-up messages) NEVER receives the compressedNarrative
5. `sessionAnalyses` in `userDat` only stores generic themes (craving, isolation, relationships) — NOT specific content like "woordenwisseling met Melissa"

### Root cause:
- `compressedNarrative` is only used by `sessionInitGreetingStep.ts` → `latestLogDigest`
- The server's `buildSystemPrompt` for session-start DOES include `sessionAnalyses` (themes/triggers)
- But `sessionAnalyses` themes are extracted via English-only regex → misses Dutch content
- The follow-up prompt NEVER includes any previous session context beyond the cached `lifeStorySummary`

### Fix:
1. Add `previousSessionNarrative` to the SESSION_INIT payload (from logs.dat compressedNarrative)
2. Store it in `sessionCache` and inject it in the follow-up prompt template
3. This gives GPT access to "what happened last session" for the ENTIRE current session

## Problem 2: Conversation window too small (6 messages for follow-up)

### Current flow:
- `buildOptimisedConversationWindow` limits to 6 messages for follow-up, 10 for session-start
- Dropped messages get a generic English theme summary
- The user expects the last 30 messages to be visible/usable

### Root cause:
- The 6-message limit was set for token optimization
- The summary of dropped messages uses English-only regex themes

### Fix:
1. Increase follow-up window to 20 messages (still within token budget for gpt-4o-mini)
2. Add Dutch keywords to the dropped-message summary

## Problem 3: extractThemes uses English-only keywords

### Fix:
Add Dutch equivalents to both:
- `extractThemes` in pipeline.ts (line 4091)
- `extractSimpleThemes` in chat-history-manager.ts (line 146)
