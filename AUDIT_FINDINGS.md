# Data-Integrity Audit — Complete Findings

## Audit Scope
All places where a "smarter abstraction" silently drops data compared to what it replaced.

---

## FINDING 1: context.dat zeroes out 8 fields in gpt-payload-builder.ts

**Location:** `buildGPTPayload()` lines 814-905  
**Severity:** HIGH (already caused the "Elias doesn't know Jules" bug)  
**Status:** PARTIALLY MITIGATED (relationalAnchors fallback added)

When `contextDatSerialized` is present, these fields are zeroed:

| Field | Full-payload value | context.dat value | Data lost? |
|-------|-------------------|-------------------|------------|
| `backpack.lifeStory` | Full sections array | `[]` (empty) | Relies on context.dat string |
| `backpack.intakeContext.initialContext` | Full text | `''` (empty) | Relies on context.dat |
| `backpack.kimBackpack` | Full Kim sections | NOT SENT | Relies on context.dat |
| `userDat.triggerPatterns` | Full array | `[]` (empty) | Relies on context.dat |
| `userDat.moodHistory` | Last 5 entries | `[]` (empty) | Relies on context.dat |
| `userDat.sessionAnalyses` | Full array | `[]` (empty) | Relies on context.dat |
| `diaryEntries` | Full array | NOT SENT | Relies on context.dat |
| `extractedEntities` | Full entities | NOT SENT | Relies on context.dat |

**Root problem:** No validation exists that context.dat CONTAINS the same information as the zeroed fields. If the distiller misses something (which it did — relationalAnchors), GPT permanently loses that data for the session.

**Risk:** The context.dat serializer (`serializeContextDatForGPT`) produces ~2-3k tokens of text. The full payload it replaces is ~16k tokens. By design, 80% of information is dropped. The question is whether the 20% that remains covers what GPT actually needs.

**What's NOT in context.dat that IS in the full payload:**
- Full life story text (only key figures extracted, not narrative)
- Full trigger patterns with counts/dates (only top triggers via backpackAnalysis)
- Full session analyses (only last 3 summaries)
- Full diary entries (not included at all)
- Full intake initialContext text (only first 50 words)

---

## FINDING 2: relationalAnchors — computed every message, never persisted

**Location:** `openai-provider.ts` line 438, `lib/ai/types.ts` line 894  
**Severity:** MEDIUM (workaround in place, but fragile)  
**Status:** WORKAROUND ACTIVE (fallback in context-dat-distiller + greetingV4)

`extractRelationalAnchors(backpack)` is called on EVERY message in `openai-provider.ts` (line 438), but the result is NEVER written back to `userDat.relationalAnchors`. The field is initialized as `[]` in `createNewUserDat()` (types.ts line 894) and stays empty forever.

**Impact:** Any module that reads `userDat.relationalAnchors` directly gets `[]`. Currently:
- `greetingV4.ts` line 471: reads it → gets `[]` → BUT has its own `buildKeyFigures()` fallback
- `context-dat-distiller.ts` line 170: reads it → gets `[]` → BUT has `extractRelationalAnchors(backpack)` fallback
- `pastReferenceSearch.ts` line 203: reads it → gets `[]` → **NO FALLBACK** ← potential data loss

**Fix needed:** Either persist the result, or add the same fallback to `pastReferenceSearch.ts`.

---

## FINDING 3: prompt-minimizer.ts — dead code, not on active path

**Location:** `lib/ai/prompt-minimizer.ts`  
**Severity:** NONE (dead code, no callers found)  
**Status:** SAFE — not imported anywhere

This file defines `minimizeBackpack`, `minimizeUserDat`, `minimizeDiaryEntries`, `minimizeConversationHistory` but is never imported by any active module. It's a leftover from an earlier approach that was replaced by context.dat.

**Action:** Can be deleted as dead code (not urgent).

---

## FINDING 4: live-message-filter.ts — omits null fields by design (SAFE)

**Location:** `lib/ai/live-message-filter.ts`  
**Severity:** LOW (by design, not a bug)  
**Status:** SAFE

The LIVE_MESSAGE filter only omits fields that are `null/undefined/''`. It never replaces a full payload with a summary. The server-side SESSION_INIT cache retains the full context from the first message. This is a legitimate optimization (don't send null fields) not a data-loss pattern.

**Caveat:** If the SESSION_INIT itself was incomplete (due to context.dat zeroing — Finding 1), then LIVE_MESSAGE also operates on incomplete context. The root cause is Finding 1, not this filter.

---

## FINDING 5: Conversation window truncation — messages capped at 800 chars

**Location:** `gpt-payload-builder.ts` lines 420-528  
**Severity:** LOW-MEDIUM (by design, but aggressive)  
**Status:** ACCEPTABLE with caveat

Each message is truncated to `MAX_MSG_TOKENS = 200` (~800 chars). For a typical GPT response of 300-500 chars this is fine. For long user messages (e.g., someone pouring out their story in 2000 chars), the last 1200 chars are lost.

**Mitigating factor:** The full chat history is preserved in `userDat.chatHistory` for session-end analysis. Only the GPT call sees truncated messages. The user's full text is still processed by local analyzers (backpack-relevance, relational-anchor, etc.) before truncation.

**Not a bug, but worth noting:** If a user writes a very long message, GPT only sees the first 800 chars of it.

---

## FINDING 6: pastReferenceSearch.ts reads empty relationalAnchors

**Location:** `lib/pipeline/memory/pastReferenceSearch.ts` line 203  
**Severity:** MEDIUM  
**Status:** UNFIXED — needs fallback

This module searches `userDat.relationalAnchors` to find past references to persons. Since `relationalAnchors` is always `[]` (Finding 2), this search NEVER finds any person-based past references.

**Impact:** When a user says "hoe gaat het met Melissa?", the past-reference search should find previous mentions of Melissa in session history. It does search other sources (triggers, schemas, sessionAnalyses), but the relationalAnchors path is dead.

---

## FINDING 7: Memory write-back does NOT persist relationalAnchors

**Location:** `lib/pipeline/memory/memoryWriteRouter.ts`  
**Severity:** MEDIUM (same root as Finding 2)  
**Status:** UNFIXED

The `buildMemoryWritePlan()` function writes: fears, hopes, triggers, schemas, modes, mood, zone, active module. It does NOT write relationalAnchors. There is no `buildRelationalAnchorPatch` function.

**Root cause:** relationalAnchors was designed to be persisted but the write-back was never implemented. The field exists in the type definition but no code ever fills it.

---

## FINDING 8: context.dat distiller — extractNamesFromText is fragile

**Location:** `context-dat-distiller.ts` lines 254-266  
**Severity:** LOW (fallback to extractRelationalAnchors covers most cases)  
**Status:** ACCEPTABLE

The regex `(?<=[,\s])[A-Z][a-zà-ÿ]{1,20}(?=[\s,.])` only matches names that:
- Follow a comma or space (not at line start)
- Are followed by space/comma/period
- Are 2-20 chars

This misses names at the start of sentences, names followed by other punctuation, and names in parentheses. However, since the primary source is now `extractRelationalAnchors(backpack)` (which uses a more robust approach), this is only a secondary fallback for names not already found.

---

## SUMMARY — Priority Fixes

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | context.dat zeroes 8 fields | HIGH | Already mitigated; needs completeness test |
| 2 | relationalAnchors never persisted | MEDIUM | Add write-back OR ensure all readers have fallback |
| 6 | pastReferenceSearch reads empty [] | MEDIUM | Add extractRelationalAnchors fallback |
| 7 | memoryWriteRouter missing anchor patch | MEDIUM | Same root as #2 |
| 5 | Message truncation at 800 chars | LOW | Acceptable, document only |
| 3 | prompt-minimizer.ts dead code | NONE | Delete when convenient |
| 4 | live-message-filter omits nulls | NONE | By design, safe |
| 8 | extractNamesFromText fragile regex | LOW | Covered by primary fallback |

---

## Recommended Fixes (minimal, no new abstractions)

1. **pastReferenceSearch.ts:** Add same fallback as context-dat-distiller — if `userDat.relationalAnchors` is empty, call `extractRelationalAnchors(backpack)`.

2. **Add completeness test for context.dat:** A test that verifies: if a backpack contains person X, then `serializeContextDatForGPT()` output contains person X's name. This prevents future regressions.

3. **Delete prompt-minimizer.ts:** Dead code removal.
