# Server Migration Analysis — Client vs Sandbox vs Railway

## 1. CLIENT ENGINE (pipeline.ts + server-active-client.ts)

### What happens per message:
1. `isServerEngineActive()` returns true (mode = `SERVER_ACTIVE_CLIENT_SHADOW`)
2. Pipeline builds `ServerEngineCallInput` from local data
3. `callServerEngine()` in `server-active-client.ts` is called
4. It builds `CanonicalEngineInput` from the input
5. It POSTs to `${apiBaseUrl}/api/engine-process` with:
   - All CanonicalEngineInput fields
   - `includeGPTResponse: true`
   - `backpack` (full, raw from AsyncStorage)
   - `userDat` (full, raw from AsyncStorage)
   - `diaryEntries` (array)
   - `dayStructureContext` (string or null)
6. If response has `gptResponse.response` → use it, apply patches, return early
7. If not → fall through to full client pipeline (all 50+ steps + local GPT call)

### URL Resolution:
- `getApiBaseUrl()` in `constants/oauth.ts`
- On native device: ALWAYS returns `https://railwayappdashboard-production.up.railway.app`
- On web (sandbox): derives from hostname (8081→3000)

### What the app sends as `backpack`:
- Raw from AsyncStorage: `{ naam, userType, sections: [{id, title, content}], intakeContext: {...}, createdAt }`
- NOTE: App uses `sections` array, NOT `lifeStory` array
- NOTE: sections have `title` field, NOT `label` field
- NOTE: sections do NOT have `ageRange` field

### What the app sends as `userDat`:
- Raw from AsyncStorage: full UserDat object
- Has `triggerPatterns` with `count` (not `frequency`)
- Has `moodHistory`, `moduleUsage`, `sessionAnalyses`, `chatHistory`, etc.
- `sessionAnalyses` may be empty array

### What the app sends as `moodSliders`:
- From `currentUserDat.currentMood`
- Contains BOTH numeric values (craving, frustration, etc.) AND string values (vsp: "GEEL")
- Contains vspScore as number

### CanonicalEngineInput shape (what actually goes in the POST body):
```
{
  requestType: 'process_message' | 'greeting' | 'session_start' | 'session_end',
  userType: 'elias' | 'kim',
  userName: string,
  locale: 'nl' | 'en' | 'fr',
  country: 'NL' | 'BE' | 'FR' | 'UK' | 'US',
  guidanceDepth: string,
  clinicalModeActive: boolean,
  message: string,
  conversationHistory: [{role, content}],
  moodSliders: Record<string, number | null | undefined>,  // includes vsp string!
  isSessionStart: boolean,
  vspSection: { level, score, lastUpdated?, source? } | null,
  logsSessions: [{sessionId, startedAt, endedAt, compressedNarrative, ...}],
  userDatSummary: {
    totalSessions, lastSessionDate, currentMood,
    moodHistory: [{date, sliders}],
    triggerPatterns: [{trigger, frequency, lastSeen}],  // NOTE: uses "frequency" here
    moduleUsage: [{moduleId, count, lastUsed}],
    stageOfChange, clinicalModeActive, guidanceDepth
  },
  usedModules: string[],
  previousZoneScore: number,
  messageCount: number,
  deviceTimeContext: {deviceNowIso, timeZone, timezoneOffsetMinutes, localDate, localTime, greetingDaypart, cycleTimestamp, sessionStartedAtDeviceIso},
  // EXTRA fields appended:
  includeGPTResponse: true,
  backpack: <raw from AsyncStorage>,
  userDat: <raw from AsyncStorage>,
  diaryEntries: [],
  dayStructureContext: null
}
```

### What the client expects BACK:
```
{
  sessionId: string,
  turnId: string,
  statePatches: { safety: {...}, sessionState: {...} },
  gptResponse: { response: string, tokenUsage?: {...}, selectedModel?: string },
  signalEngine: { signals: { fears: [...], hopes: [...], triggers: [...] } },
  nanoInterpret: { translatedNL, intent, themes, resolvedModule, matchedTheme },
  latencyMs: number
}
```

---

## 2. SANDBOX SERVER (server/_core/index.ts + server/ai-chat.ts)

### Endpoints:
- `/api/trpc/*` — tRPC routes including `ai.chat` (the GPT call route)
- `/api/engine-process` — The engine endpoint (registered via `registerEngineProcessRoute`)
- `/api/health` — Health check
- `/api/debug/prompt` — Debug endpoint (dev only)

### ai-chat.ts ChatRequestInput interface expects:
```
{
  userType: "elias" | "kim",
  userName: string,
  message: string,
  conversationHistory: [{role, content}],
  moodSliders: Record<string, number>,  // ONLY numbers!
  isSessionStart: boolean,
  backpack: {
    naam, userType,
    lifeStory: [{id, label, ageRange, content}],  // NOT sections!
    kimBackpack?: {...},
    intakeContext: {startEmotion, urgency, initialContext, intakeDate},
    createdAt
  } | null,
  userDat: {
    totalSessions,
    triggerPatterns: [{trigger, count, firstSeen, lastSeen}],  // uses "count" not "frequency"!
    moodHistory: [{sliders, timestamp}],
    moduleUsageSummary: string[],
    lastSessionDate,
    sessionAnalyses: [{...complex object...}]
  } | null,
  diaryEntries?: [{content, moodTag, timestamp}],
  activeModules: string[],
  crisisLevel: number,
  detectedEmotion: string,
  therapeuticStance: string,
  sessionDurationMinutes: number,
  urgency: string,
  startEmotion: string,
  // ... 60+ optional context fields (regulation, projection, schema, etc.)
}
```

### Key differences from what client sends:
1. `moodSliders` must be Record<string, number> (no strings like "GEEL")
2. `backpack.lifeStory` vs client's `backpack.sections`
3. `backpack.lifeStory[].label` vs client's `sections[].title`
4. `backpack.lifeStory[].ageRange` (required) vs client doesn't have it
5. `userDat.triggerPatterns[].count` vs client sends `frequency` in userDatSummary
6. `userDat.sessionAnalyses` (complex array required) vs client may send empty
7. `userDat.moduleUsageSummary: string[]` vs client sends `moduleUsage: [{moduleId, count}]`
8. ai-chat.ts expects `activeModules`, `crisisLevel`, `detectedEmotion`, `therapeuticStance`, `sessionDurationMinutes`, `urgency`, `startEmotion` — these are ENGINE DECISIONS that the client pipeline computes LOCALLY

### The fundamental problem:
ai-chat.ts expects PRE-PROCESSED engine decisions as input. The client pipeline computes these decisions (zone, regulation, module selection, crisis detection) and then passes them to the GPT call. Railway's engine-process.ts tries to replicate these decisions server-side, but the data formats don't match.

---

## 3. RAILWAY SERVER (engine-process.ts + ai-chat.ts)

### Current state:
- Has its own Zod schema that validates the incoming payload
- Runs: nano-interpret → buffer → zone → regulation → signal engine → dominant state → loopblocker → GPT call
- The GPT call uses `generateAIResponse()` from `server/ai-chat.ts`
- The ai-chat.ts on Railway is the SAME file as sandbox (copied)

### What Railway currently does in engine-process.ts:
1. Validates input with Zod schema (recently fixed to accept strings in moodSliders)
2. Runs nano-interpret (gpt-4.1-nano call)
3. Builds ShortTermMemoryBuffer
4. Computes zone decision
5. Runs regulation engine
6. Runs signal engine (gpt-4o-mini call)
7. Selects dominant module
8. Runs loopblocker
9. If `includeGPTResponse=true`: builds chatInput and calls `generateAIResponse()`
10. Returns statePatches + gptResponse + nanoInterpret + signalEngine

### Adapter layer added (the pleisters):
- `moodSliders` filtered to only numbers before passing to generateAIResponse
- `backpack.sections` → `backpack.lifeStory` conversion
- `userDat.frequency` → `count` conversion
- `userDat.moduleUsage` → `moduleUsageSummary` conversion

### Why it still fails on device:
The curl test works because we send a controlled payload. But the ACTUAL app payload may have:
- Additional fields that Zod rejects (strict mode?)
- Different nested structures
- The `callServerEngine()` on the device may be hitting a different error (network, CORS, timeout)
- The 30s timeout may be too short for Railway cold start + nano-interpret + signal engine + GPT

---

## 4. ROOT CAUSE SUMMARY

The architecture has THREE separate problems:

### Problem A: Data Format Mismatch
Client stores data in format X (sections, title, frequency). Server expects format Y (lifeStory, label, count). Adapter layers are fragile and incomplete.

### Problem B: Engine Duplication
The engine logic (zone, regulation, module selection, crisis detection) exists in TWO places:
1. Client: `lib/rugzak/pipeline.ts` (4000+ lines)
2. Railway: `engine-process.ts` (800+ lines, simplified copy)

These produce DIFFERENT results for the same input, making the client fallback trace look different from what Railway would produce.

### Problem C: ai-chat.ts expects ENGINE DECISIONS as input
The GPT prompt builder (`buildSystemPrompt`) expects pre-computed values like `crisisLevel`, `detectedEmotion`, `therapeuticStance`, `activeModules`, `regulationResult`, etc. These are computed by the ENGINE. Railway's engine-process.ts computes them and passes them to ai-chat.ts. But if any computation differs from what the client would do, the GPT response quality changes.

### Problem D: No visibility into WHY it fails on device
The `callServerEngine()` catch block returns `success: false` with an error message, but the app's debug trace only shows "client-mode" — it doesn't log the actual error. So we can't see if it's a 400 (Zod rejection), 500 (server crash), timeout, or network error.

---

## 5. WHAT THE CORRECT ARCHITECTURE SHOULD BE

### Option A: Railway as FULL engine (replace client pipeline entirely)
- Railway receives the raw app data (sections format, mixed moodSliders, etc.)
- Railway does ALL processing (no format conversion needed — it accepts what the app sends)
- Railway calls GPT and returns the response
- Client only displays the response and stores patches
- Client pipeline is disabled (mode = SERVER_ONLY_WITH_CLIENT_CRISIS_NET)

### Option B: Railway as GPT-only proxy (client does all engine work)
- Client pipeline runs all engine decisions (zone, regulation, module, etc.)
- Client sends the FINAL ChatRequestInput (already in ai-chat.ts format) to Railway
- Railway only calls OpenAI and returns the response
- No engine duplication needed

### Option C: Fix the format mismatches properly (current approach, but done right)
- Define ONE canonical format that both client and server use
- Client converts its local data to canonical format BEFORE sending
- Server accepts canonical format directly (no adapters)
- This is what `CanonicalEngineInput` was supposed to be, but it's incomplete

---

## 6. RECOMMENDATION

**Option A is the cleanest** but requires Railway to understand ALL app data formats natively.

**Option B is the fastest** — Railway becomes a thin GPT proxy. The client already computes everything. Railway just needs to accept the ChatRequestInput and call OpenAI. No engine duplication. No format mismatches for engine data. Only the backpack/userDat format for the system prompt needs to match.

**The current approach (C with adapters) is the worst** — it creates an ever-growing list of format mismatches that break silently.
