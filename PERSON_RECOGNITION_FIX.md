# Person Recognition Bug — Root Cause Analysis

## Problem
When user asks "Wie is Melissa?" GPT responds "Ik weet niet wie Melissa is" despite Melissa being mentioned in the backpack.

## Evidence from logs
- `isSessionStart: false` → follow-up message
- `backpackAnalysis: yes` → backpack analysis IS injected
- `knownPatterns: yes` → patterns ARE injected
- `Gebruikt model: gpt-4o-mini` → using mini model (weaker instruction following)
- `promptTokens: 6038` → relatively low token count for follow-up
- Projection shows: "Bang dat melissa me zal verlaten" → system KNOWS Melissa exists

## Root Cause (multi-factor)

### Factor 1: `extractRelationshipMap` is generic English instruction only
The function (lines 715-741) returns a GENERIC instruction:
```
"Before responding, you MUST mentally extract every person mentioned..."
```
It does NOT contain an actual list of persons. It tells GPT to "mentally extract" from the life story text — but on follow-up messages, the full life story text may not be present (only lifeStorySummary or structuredMemory).

### Factor 2: Follow-up messages use `lifeStorySummary` or `structuredMemory`
On follow-up (non session-start), the prompt uses:
1. `sessionCache.structuredMemory` (if hasStructuredEntities) — contains `[PERSONEN IN HET LEVEN VAN DE GEBRUIKER]` with names
2. OR `sessionCache.lifeStorySummary` — contains full text with `PERSONAL MEMORY OF KRIS (summary)`
3. OR `input.contextSummary` — compressed

The structured memory DOES contain persons. But the instruction to USE them is weak.

### Factor 3: The relationship instruction says "Common relationship words: son, daughter, wife, girlfriend..." — all English
But the backpack text is in Dutch. GPT-4o-mini may not connect "vriendin" to "girlfriend" when scanning.

### Factor 4: Anti-hallucination rule is TOO strong
The anti-hallucination says:
```
"If a person, relationship, event, or fact is NOT known: Say honestly: 'I don't know that about you.'"
```
Combined with the weak person-recognition instruction, GPT defaults to "I don't know" rather than searching the structured memory block.

## Fix Strategy
1. Replace the generic `extractRelationshipMap` with a CONCRETE person lookup table generated at cache time
2. Add Dutch relationship terms to the instruction
3. Add an explicit "PERSON LOOKUP RULE" that says: "Before saying you don't know someone, SEARCH the structured memory and life story above"
