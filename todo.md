# RecoFree App TODO

- [x] Configure theme colors (green brand palette)
- [x] Add tab bar icons mapping (chat, mood, diary)
- [x] Build AIProvider interface with AIResult type
- [x] Build MockAIProvider with realistic Elias responses
- [x] Build MockAIProvider with realistic Kim responses
- [x] Build OpenAIProvider stub (for future backend integration)
- [x] Build AI provider factory with environment toggle
- [x] Build intake screen with user type selection
- [x] Build intake state persistence (AsyncStorage)
- [x] Build intake routing logic (Elias/Kim permanent assignment)
- [x] Build user context provider (name, type, state)
- [x] Build home screen with Elias/Kim greeting
- [x] Build chat screen with message bubbles
- [x] Build chat input bar with send button
- [x] Build typing indicator animation
- [x] Build chat context management (history, mood, rugzak)
- [x] Build mood tracking screen with 4 sliders
- [x] Build slider persistence (AsyncStorage)
- [x] Build mood history tracking
- [x] Build diary screen with entry list
- [x] Build diary entry editor
- [x] Build diary persistence (AsyncStorage)
- [x] Build crisis detection (regex patterns)
- [x] Build failsafe response system
- [x] Build emergency resources card
- [x] Build profile/settings screen
- [x] Generate app icon (green heart with arrow)
- [x] Configure splash screen
- [x] Test intake flow end-to-end
- [x] Test chat flow with mock responses
- [x] Test mood tracking flow
- [x] Test diary flow
- [x] Test crisis detection flow
- [x] Ensure emotion detection is owned by Elias/Kim logic layer, not AI provider
- [x] AIResult advisory signals are optional hints only, not authoritative
- [x] Extend intake to collect start_emotie (self-reported)
- [x] Extend intake to collect urgentie (laag/midden/hoog)
- [x] Extend intake to collect eerste context (vrije input)
- [x] Store intake state as initial rugzak entry and session baseline
- [x] Ensure userType is immutable after intake (no runtime switching)
- [x] Convert all UI text and mock AI responses to English
- [x] No multilingual support in initial version
- [x] Add input language detection before processing
- [x] Add input translation to English before Elias/Kim logic
- [x] All internal processing (modules, triggers, state) in English only
- [x] Mock phase: pass-through (assume English), backend phase: real translation
- [x] Build visible Rugzak (Backpack) screen with context entries
- [x] Add Rugzak as 5th tab in tab bar
- [x] Rebuild Rugzak as structured therapeutic instrument with life-phase categories
- [x] Add life-phase sections: childhood (6-12), adolescence (12-adult), work, current situation
- [x] Update Rugzak UI to show categorized sections instead of flat key-value list
- [x] Rebuild Rugzak as narrative document with 5 life-phase free-text sections
- [x] Rugzak sections: Childhood (6-12), Adolescence (12-18), Adulthood (18-50), Family, Recurring Themes
- [x] Each section is a free-text field, not a list of items
- [x] Data stored locally, analyzed at start/end of each conversation
- [x] User can always edit/expand their Rugzak
- [x] Rebuild Rugzak as active therapeutic engine (not passive storage)
- [x] Persistent cross-session state: mood, craving, stimuli, social, history, trigger patterns
- [x] State does NOT reset per chat session — accumulates across sessions
- [x] Rugzak actively influences: module selection, tone, crisis detection, suggestion intensity
- [x] Build Rugzak influence engine (lib/rugzak/engine.ts)
- [x] Update chat pipeline to read/update/store state on every message
- [x] Track module usage history across sessions
- [x] Detect and accumulate trigger patterns over time
- [x] Build StateAnalyzer: analyzes Rugzak state (mood trends, risk level, emotional state, trigger context)
- [x] Build message processing pipeline: Load → Analyze → Select Modules → Adjust Behavior → Crisis → AI Gen → State Update
- [x] AI generates language ONLY, system makes ALL decisions (modules, tone, crisis, state)
- [x] Rebuild chat screen to use mandatory pipeline
- [x] Update mood screen to read/write from Rugzak
- [x] Fix all TypeScript errors after Rugzak refactor
- [x] Fix crash: computeMoodTrajectory accessing .length on undefined moodHistory
- [x] Add defensive null checks to all Rugzak property access in engine.ts
- [x] Fix Backpack showing "0 of 0 sections" — sections not rendering (migration added)
- [x] Ensure all 5 life-phase sections are visible and editable in Backpack
- [x] Fix sliders: Elias uses Craving/Frustration/Despondency/Focus (0-7 scale with intervention thresholds)
- [x] Fix sliders: Kim (naaste) uses Stress/Boundary Fatigue/Emotional Burden/Self-care (0-7 scale)
- [x] Add intervention thresholds to slider logic
- [x] Change all sliders (Elias and Kim) from 0-7 to 0-10 scale for AI chat compatibility
- [x] Build "End conversation" button in chat interface
- [x] Build session analysis on end (chat content, mood, diary, rugzak)
- [x] Build processing indicator ("Elias/Kim is processing your session...")
- [x] Build confirmation message after analysis ("Session saved safely")
- [x] Build post-session navigation (back to home / close app)
- [x] Build failsafe: cache last chat if app closed before confirmation
- [x] Update Rugzak state on session end (mood snapshot, trigger patterns, session count)
- [x] Session-end pipeline tests (11 tests: farewell, summary, themes, triggers, rugzak update, mood delta, Kim support, empty history, fallback)
- [x] Update color palette to Warm Sky Blue (#039BE5) — fresher, more inspiring look
- [x] Fix dark mode readability: lighten backgrounds, surfaces, borders, and improve text contrast
- [x] Fix intervention alert cards (Heads up / High alert) readability in dark mode
- [x] Fix intervention logic for positive sliders (focus, selfCare) — alerts should trigger on LOW values, not high
- [x] Read server documentation and understand backend structure
- [x] Add OpenAI API key as server-side secret (not in app)
- [x] Create server-side AI chat endpoint with OpenAI integration
- [x] Update mobile app to call backend AI endpoint instead of mock provider
- [x] Write tests for backend AI integration (8 tests: schema validation, GPT-4o integration, session end)
- [x] Fix Elias slider-response mapping: high craving + low mood must trigger grounding/directive tone, slow pacing, sharp reflection
- [x] Add compound slider rules to state-analyzer (e.g., craving>6 AND despondency>6 → crisis-adjacent behavior)
- [x] Strengthen system prompt to enforce slider-driven behavior instructions (MANDATORY BEHAVIORAL INSTRUCTIONS block)
- [x] Fix chat keyboard behavior: content must scroll up when keyboard opens so input field and messages stay visible
- [x] Fix chat keyboard overlap on Android: use KeyboardStickyView from react-native-keyboard-controller to stick input above keyboard
- [x] Fix Android keyboard overlap (attempt 3): try adjustResize + Keyboard listener approach since KeyboardStickyView didn't work
- [x] Fix Android keyboard overlap (attempt 4): root-level KeyboardAvoidingView with dynamic behavior hook (height on Android, padding on iOS)
- [x] Fix "Something went wrong with the connection" error in chat — switched to superjson serialization matching tRPC client, added auth headers and logging
- [x] Fix rugzak not being sent to GPT-4o: send FULL rugzak (life story sections, triggers, mood history, intake context)
- [x] Rewrite system prompt to treat rugzak as persistent personal memory (not a side note)
- [x] System prompt must instruct AI to USE rugzak data as if it knows the user personally
- [x] Check diary integration with rugzak — diary entries now sent to GPT-4o at session start
- [x] Fix Android keyboard: removed root-level KeyboardAvoidingView, rely on softwareKeyboardLayoutMode:resize for Android, KAV with padding for iOS only
- [x] Rewrote server-side system prompt as personal memory backbone (life story, triggers, mood trajectory, intake context)
- [x] Added 2 new rugzak schema validation tests (86 total tests passing)
- [x] ARCHITECTURE: Split monolithic Rugzak into backpack.json + user.dat dual-store
- [x] Define Backpack type (stable identity: name, userType, sections, intakeContext, createdAt)
- [x] Define UserDat type (dynamic session memory: currentMood, moodHistory, chatHistory, moduleUsage, triggerPatterns, totalSessions, lastSessionDate, sessionAnalyses)
- [x] Create dual-store persistence layer with separate AsyncStorage keys
- [x] Rewrite user-context.tsx with dual-store state management
- [x] Backpack is NEVER auto-modified — only user can edit via Backpack screen
- [x] Backpack is NEVER summarized or truncated — always sent in full
- [x] user.dat is updated ONLY at session end via analysis pipeline
- [x] At session start: send BOTH backpack + user.dat in full to GPT-4o
- [x] During session: AI reads both but modifies NEITHER
- [x] At session end: only user.dat is updated (new triggers, mood snapshot, themes, session count)
- [x] Update pipeline.ts to accept both stores separately
- [x] Update OpenAI provider to send backpack + userDat as separate payloads
- [x] Update server ai-chat.ts schema to accept backpack + userDat separately
- [x] Update server system prompt to clearly distinguish identity anchor vs session memory
- [x] Update Backpack UI screen — clarify it's the identity anchor (user-editable only)
- [x] Update chat.tsx for dual-store session flow
- [x] Update engine.ts for new UserDat type
- [x] Migrate existing Rugzak data to backpack.json + user.dat on first load
- [x] Update all tests for new dual-store architecture (90 tests passing, 14 AI chat tests)
- [x] FIX: Send backpack+userDat only ONCE at session start, not with every message
- [x] FIX: Integrate diary entries into AI context — last 10 diary entries sent at session start alongside backpack+userDat
- [x] FIX P1: Anti-hallucinatie instructie + relatiekaart in system prompt — Elias mag NOOIT relaties/feiten verzinnen
- [x] FIX P2: Elias-identiteit herschrijven op basis van canon (elias.dat + ELIAS_IDENTITEIT_COMPLETE_V2025.txt)
- [x] FIX P3: Schema/modi-herkenning + relatiedetectie + patroonherkenning in system prompt
- [x] FIX P4: Android toetsenbord bedekt chat — dynamische padding wanneer keyboard open is
- [x] FIX P5: Module 12 vooranalyse/failsafe — geen AI-reactie zonder voldoende input (sliders/rugzak/dagboek)
- [x] FIX P6: Stale closure — sendGreetingViaP and handleSend now read backpack directly from AsyncStorage instead of React state
- [x] FIX P7: tabBarHideOnKeyboard: true — tab bar hides when keyboard opens on Android
- [x] FIX: Backpack recognized at first chat start — replaced useEffect with useFocusEffect so greeting only fires when Chat tab is visible
- [x] FIX: Keyboard trilling on Android — removed KAV on Android, let softwareKeyboardLayoutMode:resize handle it alone
- [x] FIX: Removed broken backpackFilledCount reset that caused double greetings
- [x] FIX: Backpack content guard — greeting only fires when at least one backpack section has actual content (prevents empty-backpack greeting after intake)

## Step 1: New Engine Spec Implementation (fixes follow-up context blindness)
- [x] Create Backpack Relevance Analyzer (local module: selects max 2 triggers, 1 core wound, 1 context line, 1 relationship anchor per message)
- [x] Create GPT Payload Builder (structured minimal payload for every API call)
- [x] Update openai-provider to send structured payload on EVERY call (not just session start)
- [x] Update server ai-chat to use structured payload for both session-start and follow-up prompts
- [x] Enforce single dominant module per message (currently allows 3)
- [x] Reduce conversation history window from 20 to 6-10 messages

## Step 2: Engine Spec V2 — Relational Anchor Detection, Relational Pattern Analyzer, Stage of Change
- [x] Build Relational Anchor Detector (extracts all named persons + exact relationships from backpack text)
- [x] Build Relational Pattern Analyzer (detects recurring relational dynamics: codependency, enabling, conflict avoidance, etc.)
- [x] Integrate Stage of Change into data model (precontemplation, contemplation, preparation, action, maintenance)
- [x] Add Stage of Change to intake flow
- [x] Wire new modules into pipeline, payload builder, and server system prompt
- [x] Persist relational anchors and patterns in UserDat across sessions

## Step 3: Engine Spec V2 — Cost Control, Post-chat Analysis, ChatHistory Management
- [x] Build Cost Control Layer — token monitoring per API call with logging and threshold warnings
- [x] Track cumulative token usage per session and per day in user.dat
- [x] Refine post-chat analysis — ensure it only runs at session end, not mid-session
- [x] Post-chat analysis updates user.dat: new triggers, mood delta, themes, session count
- [x] Build ChatHistory management — limit stored sessions, archive/cleanup old ones
- [x] Configurable max session history (e.g., last 5 sessions kept, older ones pruned)
- [x] Add Stage of Change editor to Backpack screen (so existing users can set/change their stage)

## Patch V2: Post-Stage-3 Memory + Scoring + Regulation Corrections
- [x] Patch A+B+I: Create ShortTermMemoryBuffer (session-only live context, priority over user.dat, intent detection with structure/tone/repetition)
- [x] Patch C: Create DominantStateSelector (single dominant driver per response, deterministic priority)
- [x] Patch D+E: Add 0-100 internal scaling + zone system (GREEN/YELLOW/ORANGE/RED/PURPLE)
- [x] Patch F: Add RegulationDecayEngine (time decay, response decay, overshoot correction)
- [x] Patch G+K: Upgrade trigger scoring (0-100 block weights) + relational anchor weighting (scored thresholds)
- [x] Patch H: Upgrade user.dat promotion rules (only confirmed patterns, max 5 updates/session)
- [x] Patch J: Upgrade RelationalPatternAnalyzer for Kim (repeated event detection, recurrence signals)
- [x] Patch L: Rebuild GPT payload from buffer + selector (no full backpack, no full user.dat)
- [x] Patch M: Lock final 17-step execution order in pipeline
- [x] Patch N: Verify all "must not happen" constraints

## Patch N: Payload Optimization + Decay + Model Routing
- [x] Step 1: SESSION_INIT / LIVE_MESSAGE payload split (static fields sent once, not per message)
- [x] Step 2: Add trigger decay logic (timeDecay: -1 per 2 msgs without match, -2 per 5min inactivity, min 0)
- [x] Step 3: Update trigger selection pipeline (decay runs BEFORE threshold + top-N)
- [x] Step 4: Add ModelRoutingLayer (gpt-4o for crisis/high-risk, gpt-4o-mini for normal)
- [x] Step 5: Optimize conversationHistory (max 6, summarize oldest, keep last user+assistant+1 emotional)
- [x] Step 6: Per-message logging (triggers with finalScore, dominantModule, selected model, token estimate)

## Internal Dual-Processing Flow (wire all modules into pipeline.ts)
- [x] PRE-GPT: Apply trigger decay to PREVIOUS buffer state BEFORE new message merges
- [x] PRE-GPT: Update ShortTermMemoryBuffer with new message (after decay)
- [x] PRE-GPT: Apply RegulationDecayEngine zone decay (after buffer update)
- [x] PRE-GPT: Select DominantState (pre-GPT decision variable for current response)
- [x] PRE-GPT: Build stable BufferSnapshot for GPT payload
- [x] PRE-GPT: Feed dominant state + buffer snapshot into ChatContext → ONE GPT call
- [x] POST-GPT: Update internal stored state (no reselection of dominantState)
- [x] POST-GPT: Concrete pattern marking (repeat counter, promotion threshold >=3, cooldown/anti-spam)
- [x] POST-GPT: Consolidated logging (model, dominant state, triggers, tokens, promotion decisions)
- [x] SESSION-END: Ranked promotion evaluation (by score, not first-come-first-served), apply top 5
- [x] Wire modules into generateGreeting flow (buffer init at session start)
- [x] Ensure ZERO second GPT calls per message — all state updates are local

## BufferSnapshot Wiring + ConversationHistory Optimisation
- [x] Wire BufferSnapshot into GPTPayload type (new optional field)
- [x] Wire BufferSnapshot into gpt-payload-builder (accept from input, include in payload)
- [x] Wire BufferSnapshot into openai-provider LIVE_MESSAGE payload (send to server)
- [x] Patch N Step 5: ConversationHistory max 6 messages, summarize oldest, keep last user+assistant+1 emotional

## Mood History Redesign + Guidance Depth Setting
- [x] Mood history: dominant zone summary (last 7 days) as primary element
- [x] Mood history: trend indicator (improving/declining/stable) per slider
- [x] Mood history: top 2-3 recurring triggers shown for recognition
- [x] Mood history: timeline is secondary, collapsible visual support only
- [x] Profile: add guidance depth setting (light/normal/deep)
- [x] Wire guidance depth into user context + AsyncStorage persistence
- [x] Wire guidance depth into AI pipeline (system prompt instruction)

## GuidanceDepth as Maximum Ceiling
- [x] GuidanceDepth = max ceiling, not absolute. Effective depth = min(userSetting, stateAllowedDepth)
- [x] Red/Purple zone → force 'light' regardless of user setting
- [x] Orange zone → cap at 'normal' regardless of user setting
- [x] Yellow/Green zone → user setting applies (up to 'deep')

## BufferSnapshot in Server System Prompt
- [x] Inject bufferSnapshot (zone, intent, emotionalDirection, dominantState) into follow-up system prompt as live session context

## Bug Fixes
- [x] BUG: Rugzak/backpack data not reaching GPT — Elias doesn't know Melissa (vriendin) or Jules (zoon) even though they're in the backpack (fix: lifeStorySummary always injected in follow-up prompt)
- [x] BUG: Keyboard bedekt invoerveld in APK build — fix: KAV met behavior=padding op beide platforms, softwareKeyboardLayoutMode changed to pan

## IAMFREE Regulation Engine Patch (Lightweight v1)
- [x] Build regulation module: zone→action mapping (green=reflect, yellow=slow_down, orange=regulate, red=stabilize, purple=ground)
- [x] Add micro-intervention texts per action (Dutch, 1-2 sentences, natural not clinical)
- [x] Wire into pipeline: AFTER zone detection, BEFORE GPT response generation
- [x] Integrate guidance depth control (light=short no explanation, normal=regulation+light reflection, deep=regulation+gentle probing after stabilization)
- [x] Inject regulation prefix into GPT system prompt so response follows regulation naturally
- [x] Rules: no analysis before regulation if zone>=orange, max 1-2 sentences, never overload in red/purple, no stacking techniques

## IAMFREE Regulation Engine Patch (Lightweight v1)

- [x] Build regulation-layer.ts with zone→action mapping and micro-interventions (Dutch)
- [x] Add anti-repetition safeguard: detect if previous assistant message contained regulation, soften or skip
- [x] Add softened intervention variants for consecutive regulation messages
- [x] Wire regulation into pipeline.ts after zone detection (Step 3), before GPT call (Step 6)
- [x] Add regulationResult to ChatContext and forward to server
- [x] Inject regulation GPT instruction into server system prompt (ai-chat.ts)
- [x] Add regulation logging to pipeline MessageLog
- [x] Verify 0 TypeScript errors
- [x] Verify 31 regulation tests passing (124 total)
- [x] Checkpoint

## Bug Fixes (Post-Regulation Patch)
- [x] BUG: "Something went wrong with the connection" on every chat message in deployed APK — investigate server-side error after regulation wiring
- [x] FIX: Add regulationResult to server Zod schema (chatInputSchema) for correctness
- [x] FIX: Native API URL fallback — added retry logic with exponential backoff (2s/4s/8s) + server health ping for cold starts
- [x] BUG: "Something went wrong with the connection" after reopening app after 2h idle — fixed with retry logic + health ping
- [x] FIX: Add retry logic with exponential backoff in openai-provider for transient server failures
- [x] FIX: Add server health check / wake-up ping before first API call after app resume

## KIM Patch: Eigen Regie Meter (replaces Stage of Change for KIM users)
- [ ] Add kimRecoveryState { eigenRegie: number } to data model (types.ts, Backpack, UserDat)
- [ ] Add legacyStageOfChange migration field for backward compatibility
- [ ] Update pipeline: route eigenRegie for KIM, keep stageOfChange for Elias
- [ ] Add Eigen Regie zone mapping (0-30=RED, 31-50=ORANGE, 51-70=YELLOW, 71-100=GREEN)
- [ ] Add intervention mapping per zone (low/medium/high eigen regie)
- [ ] Update GPT payload builder: include eigenRegie for KIM users instead of stageOfChange
- [ ] Update server Zod schema: add eigenRegie field
- [ ] Update server system prompt: inject Eigen Regie context + intervention guidance for KIM
- [ ] Update UI: replace Stage of Change card with Eigen Regie Meter for KIM users
- [ ] Add Eigen Regie slider/input in mood check or profile screen
- [ ] Ensure stageOfChange still works for Elias users (no regression)
- [ ] TypeScript check + tests
- [ ] Checkpoint

## Shared Engine — Controlled Architecture
- [x] Block 1: Zone Core — enum (1-5), session zone state, explicit init, read-only access (lib/engine/shared/zone-core.ts)
- [x] Block 2: Session Shell — session structure, Zone Core reference, creation with zone, read-only access (lib/engine/shared/session-shell.ts)
- [x] Block 3: Trigger Object — kinds (event/state), modes (binary/weighted), discriminated union, validation, creation (lib/engine/shared/trigger-object.ts)
- [x] Block 4: Session Trigger List — structured storage, append-only, immutable updates, read access (lib/engine/shared/session-trigger-list.ts)
- [x] Block 5: Backpack Container — BackpackFixed + BackpackEntry + BackpackContainer, immutable creation, append-only, read access (lib/engine/shared/backpack-container.ts)
- [x] Block 6: User.dat Filter Layer — UserDat from SessionTriggerList + BackpackContainer, pure aggregation, read-only (lib/engine/shared/userdat-filter.ts)
- [x] Block 7: Session Impact Skeleton — SessionImpact from UserDat, presence/count signals only, no calculations (lib/engine/shared/session-impact.ts)
- [x] Block 8: Failsafe Skeleton — FailsafeState with limits (100/100), current counts, flags, from SessionImpact (lib/engine/shared/failsafe.ts)
- [x] Debug Layer: Engine Snapshot — DebugSnapshot from UserDat + SessionImpact + FailsafeState, sessionId consistency check, pass-by-reference (lib/engine/debug/debug-snapshot.ts)

## Elias Engine
- [x] Elias decision-layer.ts — aggregate existing outputs into single decision object (lib/engine/elias/decision-layer.ts)
- [x] Wire EliasDecision into pipeline.ts — replace individual output reads with decision object reads (no logic changes)
- [x] Debug Layer: Add EliasDecision to DebugSnapshot for inspection (lib/engine/debug/debug-snapshot.ts)

## Kim Engine — Extraction
- [x] Create lib/engine/kim/slider-interpretation.ts — extract Kim slider scores (distress, resilience, primaryConcern)
- [x] Create lib/engine/kim/crisis-trigger.ts — extract Kim-specific crisis trigger (emotionalBurden >= 6)
- [x] Create lib/engine/kim/module-catalog.ts — extract K01–K06 module definitions
- [x] Create lib/engine/kim/relational-signals.ts — extract Kim trigger categories from buffer
- [x] Create lib/engine/kim/prompt-block.ts — extract Kim identity prompt from server
- [x] Replace original if/else branches with kimEngine.* calls in shared files
- [x] Verify behavior unchanged — 0 TS errors, 124 tests passing

## Kim Engine — Wiring (micro-patches)
- [x] Micro-patch 1: state-analyzer.ts — replace Kim branches with kimEngine calls
- [x] Micro-patch 2: detector.ts — replace Kim branch with kimEngine call
- [x] Micro-patch 3: engine.ts — replace Kim branches with kimEngine calls
- [x] Micro-patch 4: buffer.ts — replace Kim branches with kimEngine calls (detectKimTrigger + kimDistressScore×10)
- [x] Micro-patch 5: ai-chat.ts — replace Kim prompt block with KIM_IDENTITY_PROMPT import

## Kim Engine — Wiring Round 2 (micro-patches 6-11)
- [x] Micro-patch 6: mock-provider.ts — extract Kim boundary/enabling detection to Kim engine (detectKimBoundaryTopic + detectKimEnablingPattern)
- [x] Micro-patch 7: dominant-state-selector.ts — extract Kim trigger/slider/distress/resilience/concern + module mapping to Kim engine
- [x] Micro-patch 8: backpack-relevance-analyzer.ts — extract Kim slider scoring to Kim engine (kimBackpackSliderScore)
- [x] Micro-patch 9: server/ai-chat.ts — extract Kim crisis prompt text to Kim engine (kimCrisisInstructions)
- [x] Micro-patch 10: module-system.ts — replace duplicate Kim module definitions with Kim engine import (KIM_THERAPEUTIC_MODULES)
- [x] Micro-patch 11: detector.ts — refactored Kim routing into symmetric else branch, all Kim logic via checkKimCrisisTrigger
- [x] Final audit: confirmed — all Kim computation extracted, only neutral routing remains

## Kim Engine — Wiring Round 3 (MP12–15): Single Source of Truth
- [x] Micro-patch 12: pipeline.ts — replaced 4 inline Kim formulas with kimDistressScore/kimResilienceScore + 3 'K01' literals with KIM_DEFAULT_MODULE
- [x] Micro-patch 13: backpack-relevance-analyzer.ts — moved Kim module alignment mapping to KIM_MODULE_ALIGNMENTS in engine
- [x] Micro-patch 14: mock-provider.ts — extracted Kim response pool (KIM_MOCK_RESPONSES) + threshold (isKimLowMood) to engine
- [x] Micro-patch 15: ai-chat.ts — extracted selfCare to KIM_POSITIVE_SLIDERS constant in engine
- [x] Final verification: isKimLowMood moved from mock-responses.ts to slider-interpretation.ts (logic/data separation confirmed)

## Elias Engine — Phase 1: Critical Core Extraction
- [x] Create lib/engine/elias/slider-interpretation.ts (distress, resilience, primaryConcern, isEliasLowMood, isEliasHighCraving, ELIAS_POSITIVE_SLIDERS, ELIAS_DEFAULT_MOOD)
- [x] Create lib/engine/elias/state-logic.ts (crisis triggers, guidance depth, model routing, detectEliasReflectionTrigger)
- [x] Create lib/engine/elias/module-catalog.ts (ELIAS_THERAPEUTIC_MODULES, trigger→module, slider→module, priority modules, default/crisis, alignments, signal→module, backpack slider scoring, mock responses, high complexity)
- [x] Wire state-analyzer.ts to Elias engine (distress + resilience + concern + signal→module)
- [x] Wire dominant-state-selector.ts to Elias engine (all 100-scale helpers + trigger/slider/default/crisis)
- [x] Wire engine.ts (rugzak) to Elias engine (distress + resilience + concern + priority modules)
- [x] Wire detector.ts to Elias engine (distress + resilience + crisis triggers)
- [x] Wire pipeline.ts to Elias engine (distress + resilience + default mood + E02 fallbacks)
- [x] Wire ai-chat.ts to Elias engine (positive sliders + high complexity modules)
- [x] Wire all remaining files (openai-provider: ELIAS_DEFAULT_MODULE, module-system: ELIAS_THERAPEUTIC_MODULES, mock-provider: all detection + responses, backpack-relevance-analyzer: slider scoring + module alignments, buffer.ts: eliasDistressScore)
- [x] Final verification: 0 TS errors, 124 tests passing, zero inline Elias formulas/thresholds/module IDs outside engine

## Elias Engine — Phase 2: Prompt Extraction + StageOfChange
- [x] Create lib/engine/elias/prompt-block.ts (ELIAS_IDENTITY_PROMPT, eliasCrisisInstructions, ELIAS_SCHEMA_BLOCK, ELIAS_STOA_BLOCK, ELIAS_STAGE_DESCRIPTIONS, ELIAS_STAGE_DESCRIPTIONS_DETAILED)
- [x] Create lib/engine/elias/stage-of-change.ts (ELIAS_DEFAULT_STAGE)
- [x] Wire ai-chat.ts to import all Elias prompt content from engine (identity, crisis, schema, stoa, stageDescriptions x2)
- [x] Wire pipeline.ts (7x contemplation→ELIAS_DEFAULT_STAGE), gpt-payload-builder.ts (2x), types.ts (1x createNewUserDat default)
- [x] Final verification: 0 TS errors, 124 tests passing, zero inline Elias prompts/stageOfChange outside engine

## Kim Eigen Regie — 5-Step Model
- [x] Create lib/engine/kim/eigen-regie.ts (score inversion, zone mapping, zone meaning, engine impact)
- [x] Wire Eigen Regie into Kim decision-layer.ts (computeKimDecision includes eigenRegie)
- [x] Create UI component for daily reflection input (percentage 0-100, Kim-only on mood screen)
- [x] Store eigenRegie data in user state (EigenRegieEntry type, eigenRegieHistory in UserDat, updateEigenRegie + getEigenRegieHistory in context, migration)
- [x] Verify: 0 TS errors, 124 tests passing, no Eigen Regie logic outside engine

## Zone System — Engine Architecture Layer
- [x] Define shared zone types (ZoneLevel, ZoneResult, ZoneImpact) — lib/engine/zone-types.ts
- [x] Create lib/engine/kim/zone.ts (Kim zones based on Eigen Regie levels)
- [x] Create lib/engine/elias/zone.ts (Elias zones based on existing engine outputs)
- [x] Wire Kim zone into Kim decision-layer.ts output
- [x] Wire Elias zone into Elias decision-layer.ts output
- [x] Verify: 0 TS errors, 124 tests passing, no zone logic outside engines

## Zone System — Deterministic Impact Mappings
- [x] Define EliasImpact type (interventionLevel, reflectionDepth, directiveStyle)
- [x] Define eliasZoneImpactMap: Record<ZoneLevel, EliasImpact> with fixed values per zone
- [x] Wire EliasImpact into Elias zone output (replace string-based impact)
- [x] Define KimImpact type (stabilizationLevel, challengeLevel, autonomyLevel)
- [x] Define kimZoneImpactMap: Record<ZoneLevel, KimImpact> with fixed values per zone
- [x] Wire KimImpact into Kim zone output (replace string-based impact)
- [x] Update zone-types.ts: remove ZoneImpact, make ZoneResult<T> generic over impact type
- [x] Verify: 0 TS errors, 124 tests passing, no legacy string-based impact references remain

## Zone System — Orchestration (Routing Layer)
- [x] Create orchestration routing module: select Elias OR Kim engine output based on userType
- [x] Define EngineDirective discriminated union type (elias: EliasImpact, kim: KimImpact)
- [x] Thread EngineDirective through ChatContext → GPTPayload → OpenAIProvider
- [x] Accept EngineDirective in server ChatRequestInput/schema
- [x] Inject routed directive values directly into system prompt (no transformation)
- [x] Verify: 0 TS errors, 124 tests passing, no merging of Elias and Kim

## Zone System — Final Wiring
- [x] Wire routeEngineDirective() into pipeline.ts (call once, store on context.engineDirective)
- [x] Add Kim decision path in pipeline (createKimDecision for kim users, createEliasDecision for elias users)
- [x] Verify provider passthrough reads only from context.engineDirective unchanged
- [x] Add routing tests: elias→EliasDirective, kim→KimDirective, no cross-routing (19 tests)
- [x] Verify: 0 TS errors, 143 tests passing, Kim path active

## Zone System — Wire Kim Eigen Regie Input
- [x] Trace where Eigen Regie input is stored (UserDat.eigenRegieHistory)
- [x] Pass existing Eigen Regie value into createKimDecision in pipeline.ts (getLatestEigenRegieInput helper)
- [x] Verify: 0 TS errors, 143 tests passing

## Zone System — Fix Eigen Regie Source
- [x] Change eigenRegieInput source from eigenRegieHistory to currentMood.eigenRegie
- [x] Remove getLatestEigenRegieInput helper function
- [x] Verify: 0 TS errors, 143 tests passing

## Zone System — Eigen Regie as Current-State Input
- [x] Add eigenRegie: number | null to KimMoodSliders
- [x] Update createDefaultSliders for kim to include eigenRegie: null
- [x] Update updateEigenRegie() to also write currentMood.eigenRegie
- [x] Fix pipeline: read currentMood.eigenRegie, remove getLatestEigenRegieInput helper
- [x] Verify: 0 TS errors, 143 tests passing

## Zone Impact Tests & Mood Screen Validation
- [x] Write Elias zone impact tests: verify exact mapping values per zone level (ROOD→GROEN)
- [x] Write Kim zone impact tests: verify exact mapping values per zone level (ROOD→GROEN)
- [x] Write computeEliasZone boundary tests (zone level transitions)
- [x] Write computeKimZone boundary tests (zone level transitions)
- [x] Validate mood screen eigenRegie sync with currentMood.eigenRegie (12 tests)
- [x] Verify: 0 TS errors, 200 tests passing

## Mood Screen — Eigen Regie Slider Initialisation
- [x] Initialise eigenRegieInput from currentMood.eigenRegie (saved value) or 50 (default when null)
- [x] Add test for initialisation behavior (7 tests)
- [x] Verify: 0 TS errors, 207 tests passing

## Mood Screen — Eigen Regie Slider Zone Color
- [x] Add zone-based color to Eigen Regie slider track (ROOD→GROEN)
- [x] Verify: 0 TS errors, 207 tests passing

## Intake Fix — Kim Eigen Regie
- [x] Remove Stage of Change from Kim intake
- [x] Add Eigen Regie meter (5 zones) to Kim intake screen
- [x] Show question: "In hoeverre wordt jouw leven momenteel bepaald door de ander?"
- [x] Implement exact 5 zone labels (ROOD→DONKER GROEN)
- [x] Store eigenRegieLevel (1-5) in backpack.intakeContext + currentMood.eigenRegie
- [x] Wire eigenRegieLevel into Kim engine baseline (createNewUserDat converts level to 0-100)
- [x] Verify: no Stage of Change shown for Kim, no mixing of systems
- [x] Verify: 0 TS errors, 207 tests passing

## Hedenlaag — VSP Thermometer (Elias) + Pre-chat Blokkering
- [x] Define VSP types: VspLevel (GROEN/GEEL/ORANJE/ROOD/PAARS), add vsp field to EliasMoodSliders
- [x] Create Elias VSP engine module (lib/engine/elias/vsp.ts) with 5-zone mapping
- [x] Wire VSP into Elias decision path (like eigenRegie for Kim)
- [x] Build pre-chat screen for Elias (VSP thermometer)
- [x] Implement routing guard: chat blocked until pre-chat input submitted (both user types)
- [x] Verify: 0 TS errors, all tests passing

## VSP Resolution Layer — Separate Decision Architecture
- [x] Create resolveEliasZone() resolution layer (lib/engine/elias/vsp-resolution.ts)
- [x] Explicit severity mapping: VSP (GROEN=1..PAARS=5), Computed (GROEN=1, LICHTGROEN=1, GEEL=2, ORANJE=3, ROOD=4)
- [x] Resolution rules: PAARS→CRISIS override, higher severity wins, tie→VSP source
- [x] ResolvedEliasZone output: finalSeverity, finalZoneLabel, source, reason, vspLevel, computedZone, isBlocked, isCrisis
- [x] Create computeEliasImpact() accepting full ResolvedEliasZone (lib/engine/elias/vsp-impact.ts)
- [x] Rewire decision-layer.ts: computeEliasZone (detection) → resolveEliasZone (decision) → computeEliasImpact (impact)
- [x] Pipeline hard-stop: isBlocked as safety guardrail (no impact, no GPT when blocked)
- [x] Pipeline status: BLOCKED_PRECHAT_REQUIRED / CRISIS_MODE / OK
- [x] Pre-chat enforces VSP before pipeline start (pipeline never receives vsp=null in normal flow)
- [x] updateVsp in user-context (only explicit user choice, no default GROEN)
- [x] Pre-chat VSP screen for Elias (no default selection, confirm required)
- [x] Pre-chat Eigen Regie screen for Kim (slider interaction required before confirm)
- [x] Remove legacy vsp-zone-combiner.ts (replaced by resolution layer)
- [x] 45 VSP resolution tests (9 categories per specification)
- [x] Verify: 0 TS errors, 252 tests passing (10 test files)

## Intervention Continuity Layer — Zone-Linked Therapeutic Memory
- [x] Create InterventionContinuityLayer module with interventionState (lastInterventionType, interventionGoal, linkedZone, expectedShift, effectivenessScore)
- [x] Per-turn zone comparison: compare current resolvedZone with linkedZone
- [x] Zone shifted → re-evaluate intervention (new goal, new linkedZone)
- [x] Zone unchanged → continue building on same therapeutic line
- [x] Detect user response pattern (engaged/deflected/escalated/ignored)
- [x] Compute effectiveness score linked to zone transitions
- [x] Inject interventionState into GPT system prompt (PRE-GPT)
- [x] Wire into pipeline: evaluate zone shift PRE-GPT, update interventionState POST-GPT
- [x] Write tests for zone-linked intervention tracking (38 tests)
- [x] Verify: 0 TS errors, 290 tests passing (11 test files)

## Intervention Continuity Layer — Fixes
- [x] Fix 1: Define exact codeable detection rules for engaged/deflected/escalated/ignored (no AI interpretation)
- [x] Fix 2: Effectiveness scoring uses zone-severity comparisons; instruction thresholds (70/40) are intentional behavioral categories
- [x] Fix 3: Remove cross-session learning claims, replace with "local within-device memory", getSessionSummary as pure function only
- [x] Fix 4: Enforce max 5 entries in zone evolution trail before GPT injection (older entries not sent)
- [x] Fix 5: Block Kim continuity layer until Eigen Regie is mandatory at chat start (document as blocked)

## Targeted Fixes — Round 2
- [x] Fix 1: pipeline.ts Step 0 — add VSP/Eigen Regie as valid minimal context
- [x] Fix 2: zone.ts — precontemplation only forces GEEL when distress < 3.5 (tiebreaker, not override)
- [x] Fix 3: intervention-continuity.ts — crisis keywords (help, red, nood, sos) not classified as 'ignored'
- [x] Fix 4: server/ai-chat.ts — static crisis-fallback response when GPT call fails and crisisLevel >= 1

## Follow-up Tasks
- [x] Integration test: crisis-fallback-on-network-failure (mock fetch, verify 113/112 in response)
- [x] Update recofree_audit_snapshot.txt with Round 2 fixes (CRISIS_KEYWORDS, precontemplation, VSP/ER check, crisis-fallback)

## Projection Layer (RECOFREE_PROJECTION_SPEC_V1)
- [x] Create lib/engine/elias/projection.ts (types + signal detection + decay + injection + summary)
- [x] Create lib/engine/kim/projection.ts (Kim-specific signals, Eigen Regie based)
- [x] Create lib/rugzak/projection-layer.ts (orchestrator, called in Step 5d)
- [x] Integrate into pipeline.ts: Step 5d (signal detection) + session-end decay (after UserDat promotion)
- [x] Integrate into server/ai-chat.ts: GPT injection (after SESSION MEMORY, before RELEVANCE CONTEXT)
- [x] Write projection-layer.test.ts (signal detection, decay, injection, deepening, orchestrator — 30 tests)
- [x] Deepening module: activates on E03/E06 (Elias) or high Eigen Regie (Kim)
- [x] Deflection detection: blocks deepening when user deflects
- [x] All tests passing: 347 tests, 0 TS errors

## Maintenance Tasks — Round 3
- [x] Replace DEFLECTION_MARKERS in intervention-continuity.ts with English equivalents
- [x] Update recofree_audit_snapshot.txt with Projection Layer modules, contracts, and constants
- [x] Export server/ai-chat.ts as recofree_code_review_aichat.txt

## Maintenance Tasks — Round 4
- [x] Fix 1: projection-layer.ts — replace all NL/EN mixed markers with English only (already English)
- [x] Fix 2: server/ai-chat.ts — add single-user comment above sessionCache
- [x] Fix 3: server/ai-chat.ts — translate buildSystemPrompt() fully to English (last Dutch comment translated)

## Full English Migration (codebase-wide)
- [x] Translate CRISIS_KEYWORDS in intervention-continuity.ts from Dutch to English
- [x] Translate ACKNOWLEDGMENT_TOKENS in intervention-continuity.ts from Dutch to English
- [x] Translate REGULATION_MARKERS in regulation-layer.ts from Dutch to English
- [x] Translate MICRO_INTERVENTIONS in regulation-layer.ts from Dutch to English
- [x] Translate SOFTENED_INTERVENTIONS in regulation-layer.ts from Dutch to English
- [x] Translate GPT_INSTRUCTIONS in regulation-layer.ts from Dutch to English
- [x] Translate SOFTENED_GPT_INSTRUCTIONS in regulation-layer.ts from Dutch to English
- [x] Translate passive response messages in pipeline.ts from Dutch to English
- [x] Translate Dutch regex patterns in server/ai-chat.ts to English (asksAboutPerson, patternRelevant, woundRelevant)
- [x] Translate Dutch comments in server/ai-chat.ts to English
- [x] Fix IGNORED_MAX_LENGTH from 5 to 4 (accommodates English ack tokens: ok, yes, no, yep, nope, sure, yeah, hmm)
- [x] Fix crisis keyword detection: exact match + short-message substring (prevents false positives in longer messages)
- [x] Update all test files to use English assertions (regulation-layer.test.ts, intervention-continuity.test.ts, targeted-fixes-round2.test.ts, vsp-resolution.test.ts)
- [x] Verify: 0 TypeScript errors, 347 tests passing (all green)

## Maintenance Tasks — Round 5
- [x] Translate Dutch docblock in lib/engine/kim/decision-layer.ts to English (eigenRegieInput comment)

## Projection Persistence — AsyncStorage
- [x] Implement loadEliasProjection() and saveEliasProjection() in lib/engine/elias/projection.ts
- [x] Wire load into loadAndRestoreEliasProjection() (session start), save after applyProjectionDecay() (session end)
- [x] Implement loadKimProjection() and saveKimProjection() in lib/engine/kim/projection.ts
- [x] Wire load into loadAndRestoreKimProjection() (session start), save after applyKimProjectionDecay() (session end)
- [x] Write 11 tests for projection persistence (load empty, save/load roundtrip, corrupted data, decay before save)

## Projection Persistence — Wiring & Utilities
- [x] Wire loadAndRestoreEliasProjection() into chat.tsx session start (Elias users)
- [x] Wire loadAndRestoreKimProjection() into chat.tsx session start (Kim users)
- [x] Add clearEliasProjection() utility to elias/projection.ts
- [x] Add clearKimProjection() utility to kim/projection.ts

## Debug Log Screen — On-device Engine Monitoring
- [x] Create debug session logger utility (lib/debug/session-logger.ts)
- [x] Create debug screen modal (app/dev/debug-log.tsx) with Live State + Session Log tabs
- [x] Wire 5-tap activation on version number in profile.tsx (5 taps within 2s)
- [x] Add utility buttons (Clear Elias/Kim Projection, Clear UserDat with confirmation)
- [x] Add Copy Full Log button (via Share API, no new dependencies)
- [x] Wire logDebugEvent calls into chat.tsx (session_start, message_processed, session_end, crisis_detected)

## Logging Improvements — Zone Shift, Projection Signal, Token Budget
- [x] Add zone_shift event logging in pipeline.ts when bufferZoneColor changes between messages
- [x] Add projection_signal event logging in projection-layer.ts when fear/hope/goal is created or reinforced
- [x] Add token budget indicator to Live State tab in debug screen (remaining budget, status OK/WARNING/CRITICAL)

## Bug Fixes — Round 5
- [x] Bug 1 BLOCKER: Elias chat connection error — moodSliders.vsp (string) rejected by server z.record(z.string(), z.number()). Fix: filter non-numeric values from sliders in gpt-payload-builder.ts
- [x] Bug 2: VSP/Eigen Regie thermometer always shown at every chat start — preChatDone now always starts false
- [x] Bug 3: Version number sync — profile now reads from Constants.expoConfig.version (same source as publish)
- [x] Bug 4: Stage of Change hidden for Kim users in backpack.tsx and profile.tsx (userType guard added)
- [x] Bug 5: "Sla reflectie op" / "Opgeslagen!" translated to "Save reflection" / "Saved!"

## Fixes — Round 6
- [x] Fix 1: Reset currentMood.vsp and eigenRegie to null at session-end (prevent stale values in next session)
- [x] Fix 2: Add ChatErrorBoundary around chat component (restart button + debug log on crash, never crashes whole app)

## Fixes — Round 7
- [x] Fix 1: Elias connection error — root cause: userDat.moodHistory[*].sliders contained vsp string. Fix: server Zod schema now accepts mixed types and transforms/filters to numbers only
- [x] Fix 2: Pipeline Step 0 — all blocking conditions removed. Pipeline NEVER blocks. VSP-missing fallback proceeds with GREEN zone defaults. Greeting also non-blocking.

## Fixes — Round 8
- [x] Structural fix: VSP stripped from moodHistory snapshots via shared sanitizeSliders() util (Optie A)
- [x] Fix all storage points: pipeline.ts session-end, engine.ts recordMoodSnapshot, gpt-payload-builder.ts (all use sanitizeSliders)
- [x] Migration at app load: migrateUserDat() sanitizes existing polluted moodHistory entries + re-persists to AsyncStorage
- [x] Zod workaround reverted: server/ai-chat.ts back to strict z.record(z.string(), z.number())
- [x] Integration test added: __tests__/slider-sanitize-integration.test.ts (8 assertions)

## Fixes — Round 9
- [x] Fix debug tap: register dev/debug-log route in root _layout.tsx as modal
- [x] Fix debug tap: enlarge touch target with hitSlop on version Pressable

## Fixes — Round 10
- [x] Add vspScore: number | null field to EliasMoodSliders interface and defaults
- [x] Compute vspScore in updateVsp() using mapping GROEN→1, GEEL→2, ORANJE→3, ROOD→4, PAARS→5
- [x] vspScore included in moodSliders (sanitizeSliders keeps it as numeric); vsp string filtered out by sanitizeSliders

## Fixes — Round 11
- [x] Add safe defaults in gpt-payload-builder.ts for all fields that can be undefined in Elias payload (crisisLevel→0, detectedEmotion→'unknown', therapeuticStance→'supportive', sessionDurationMinutes→0, urgency→'low', startEmotion→'unknown', backpack.naam→'', backpack.createdAt→ISO now)

## Fixes — Round 12
- [x] Temporarily remove vsp AND vspScore from Elias SESSION_INIT payload (neither sent to server in moodSliders or moodHistory)

## Fixes — Round 13
- [x] Update EXPO_PUBLIC_API_BASE_URL from sandbox URL to production domain (https://recobase-vhsxu5ua.manus.space)

## Fixes — Round 14 (Critical: Chat still not working on device)
- [x] Hardcode production URL as fallback in getApiBaseUrl() so env var issues cannot block it
- [x] Show actual error message + URL on screen instead of generic "Something went wrong"
- [x] Remove __DEV__ gates from debug screen access, session logger, and chat logging
- [x] Verify the tRPC request format matches what the production server expects (confirmed: server returns 200 OK with GPT response)
- [x] Fix riskScore: NaN causing 400 error — added safeNumber() guard to all numeric payload fields
- [x] Fix sanitizeSliders to filter NaN (typeof NaN === 'number' in JS)
- [x] Guard bufferSnapshot.dominantState.riskScore, zoneScore, messageCount against NaN

## Round 15
- [x] Add Copy tab to debug screen to copy all debug info to clipboard for external sharing

## Round 16 — Full Engine Transparency Debug Log
- [x] Create structured debug block type with all required fields (pipeline steps, zone, regulation, module, model routing, intervention, projection, memory layers, payload, tokens)
- [x] Create debug event emitter that logs a full block per message without changing production code
- [x] Integrate emitter into pipeline (read-only taps)
- [x] Update Session Log tab to render cumulative message blocks
- [x] Update Copy All tab to export full session including all message blocks
- [x] Verify 0 TS errors, all tests green

## Round 17
- [x] Fix Copy All: use Clipboard.setStringAsync() instead of Share.share() so text actually copies to clipboard

## Round 18
- [x] Add isCrisis flag from ResolvedEliasZone to model routing in server/ai-chat.ts
- [x] Add isCrisis to ChatContext interface (lib/ai/types.ts)
- [x] Pass isCrisis from pipeline context (elisDecision.zone.resolved.isCrisis) to ChatContext
- [x] Add isCrisis to both SESSION_INIT and LIVE_MESSAGE payloads in openai-provider.ts
- [x] Add isCrisis to server-side ChatRequestInput interface and Zod schema
- [x] Fix vitest config: add @/ alias resolution and include both test directories
- [x] 0 TS errors, 369 tests pass (16 files + 1 skipped)

## Round 19
- [x] Bug 1 verification: confirm isCrisis=true selects gpt-4o when VSP=PAARS (6 tests green)
- [x] Bug 2: identified regulation uses sessionBuffer.currentZoneColor (buffer-computed from text/sliders), NOT resolved zone
- [x] Bug 2: moved regulation call after elisDecision/kimDecision; now uses resolvedZoneForRegulation (Elias: finalZoneLabel, Kim: engine.level, fallback: buffer)
- [x] 0 TS errors, 375 tests green (17 files + 1 skipped)

## Round 20
- [x] Taak 1: Add resolvedZoneForRegulation + isFallbackZone to debug trace (Session Log shows resolved vs fallback)
- [x] Taak 2: Integration test vsp-paars-full-path-integration (3 tests: PAARS→PURPLE→ground→gpt-4o, PAARS overrides GROEN, ROOD→stabilize)
- [x] Taak 3: Kim isCrisis equivalent (eigenRegie.userInput < 10 → isKimCrisis=true on KimDecision)
- [x] Taak 3: Wire isKimCrisis in model routing (via ChatContext.isCrisis) and regulation (force PURPLE zone)
- [x] Taak 3: 9 new tests for Kim crisis (decision flag, model routing, regulation ground)
- [x] 0 TS errors, 387 tests green (19 files + 1 skipped)

## Round 21
- [x] Taak 1: isKimCrisis + eigenRegie.userInput in debug trace ZONE BESLISSING (Kim users now show zone decision block)
- [x] Taak 2: kim-eigen-regie-crisis-full-path integration test (5 tests: eigenRegie=5/0/9 → crisis path, eigenRegie=10/50 → normal path)
- [x] 0 TS errors, 392 tests green (20 files + 1 skipped)

## Round 22
- [x] Bug 1: Remove duplicate vsp/eigenRegie from state.dat snapshot (already in sliders loop via currentMood)
- [x] Bug 2: Fix projection_signal undefined — reinforced events have no category/content/strength; now renders "reinforced N entries" instead
- [x] 0 TS errors, 392 tests green

## Round 23 — Crisis card taaldetectie + Belgische nummers
- [x] Define NL/EN crisis resource sets (Belgische nummers: 1813, 106, 112) in lib/crisis/resources.ts
- [x] Implement language detection from last user message (Dutch markers + ratio threshold)
- [x] Translate crisis card title + intro + dismiss text (NL default, EN fallback)
- [x] Wire lastUserMessage prop from chat.tsx to EmergencyCard
- [x] Update legacy EMERGENCY_RESOURCES to Belgian numbers, mark as deprecated
- [x] 0 TS errors, 392 tests green

## Round 24
- [x] Taak 1: Unit tests for detectCrisisLanguage() — 9 edge cases (empty, null, undefined, single word, short EN, short NL, mixed NL majority, mixed EN majority, crisis NL, whitespace)
- [x] Taak 2: Primary "Bel 1813" button at top of crisis card with heavy haptic, red background, phone icon
- [x] Added phone.fill icon mapping
- [x] 0 TS errors, 401 tests green

## Round 25
- [x] Taak 1: Bevestigings-alert voor bellen (NL: "Wil je 1813 bellen?" / EN: "Do you want to call 1813?") met Bevestig/Annuleer
- [x] Taak 2: SMS 1813 knop onder bel-knop (outlined style, paperplane icon, NL: "SMS 1813" / EN: "Text 1813")
- [x] 0 TS errors, 401 tests green

## Round 37 — GPT-4o-mini SignalEngine (server-side)
- [x] Created lib/engine/local-llm/signal-engine.ts (LocalSignalEngine interface)
- [x] Created lib/engine/local-llm/null-engine.ts (NullSignalEngine fallback)
- [x] Created lib/engine/local-llm/gpt-signal-engine.ts (GPT-4o-mini implementation)
- [x] Created lib/engine/local-llm/engine-provider.ts (singleton, initGptSignalEngine)
- [x] Created server/signal-engine.ts (POST /api/signal-engine endpoint)
- [x] Registered signal-engine route in server/_core/index.ts
- [x] No llama.rn, no expo-dev-client, no model-download code
- [x] pnpm.onlyBuiltDependencies whitelist for esbuild + unrs-resolver
- [x] 0 TS errors, 401 tests green, pnpm run build succeeds

## Round 38 — Pipeline wiring + build fix
- [x] Added candidateSignals + relevanceScores fields to ChatContext interface
- [x] Wired getEngine().detectSignals() + scoreRelevance() in pipeline Step 5c (non-blocking, fault-tolerant)
- [x] Updated debug trace Step 5c: "SignalEngine [passed/skipped] fears=N hopes=N goals=N triggers=N"
- [x] Added pnpm-workspace.yaml with dangerouslyAllowAllBuilds: true (definitive build fix)
- [x] Created docs/fase4-local-llm-archive.md
- [x] 0 TS errors, 401 tests green, pnpm run build succeeds

## Round 48 — Fase 4 architecture finalization
- [x] Taak 1: Wire relevanceScores from pipeline → openai-provider → server
- [x] Taak 1: In server follow-up prompt, skip lifeStorySummary if backpackRelevance < 0.3
- [x] Taak 1: In server follow-up prompt, skip diary if diaryRelevance < 0.3
- [x] Taak 2: Call summarizeContext() in pipeline for LIVE_MESSAGE calls
- [x] Taak 2: Send contextSummary to server as replacement for full lifeStorySummary
- [x] Taak 2: Server uses contextSummary when available, falls back to lifeStorySummary
- [x] Taak 3: Add architecture comment block at top of pipeline.ts (Two-Layer Decision Model)
- [x] 0 TS errors, 401 tests green (1 skipped = baseline)

## Round 49 — VSP=ROOD routing + detectSignals full context

- [x] Fix 1: Add VSP=ROOD/RED routing condition to gpt-4o in server/ai-chat.ts
- [x] Fix 1: vspLevel added to ChatContext, openai-provider payloads, server ChatRequestInput + Zod schema
- [x] Fix 2: Add activeProjections field to SignalContext type in signal-engine.ts
- [x] Fix 2: Wire full SignalContext (zoneColor, vspOrEigenRegie, keySliders, userType, activeProjections) in pipeline.ts detectSignals call
- [x] Fix 2: GptSignalEngine.detectSignals() uses context in prompt (Kim/Elias routing, 3s timeout)
- [x] Tests updated: 3 new VSP routing tests, ROOD assertion corrected
- [x] 0 TS errors, 404 tests green, build succeeds

## Round 50 — Fase 5: STOA Engine

- [x] Taak 1: Create StoaSession and StoaEngineResult types in lib/engine/elias/stoa-engine.ts
- [x] Taak 1: Define all 15 STOA sessions as typed data from V102 JSON
- [x] Taak 2: Implement selectStoaSession() with trigger matching against zone, VSP, signals, projections
- [x] Taak 2: Prevent same session from being selected twice in one session (within-session + cross-session cooldown)
- [x] Taak 3: Wire selectStoaSession() into pipeline.ts as Step 5e after projection
- [x] Taak 3: Add stoaContext to ChatContext type
- [x] Taak 3: Inject STOA result as separate prompt block in GPT payload
- [x] Taak 3: Wire through gpt-payload-builder.ts + openai-provider.ts + server/ai-chat.ts
- [x] Taak 3: Replace legacy static ELIAS_STOA_SESSIONS with dynamic stoaBlock injection
- [x] Taak 4: Add stoaSessionsUsed to user.dat type for cross-session tracking
- [x] Taak 4: Update stoaSessionsUsed after STOA session is activated (endSession persistence)
- [x] Taak 4: Update all 3 persistence paths in user-context.tsx (legacy, migrate, compat)
- [x] 0 TS errors, 404 tests green (21 test files, 1 skipped)

## Round 51 — Fase 5: Schema en Modi Engine

- [x] Stap 1: Create lib/engine/shared/schema-mode-types.ts (22 modes, 18 schemas, 5 domains, all type contracts)
- [x] Stap 2: Create lib/engine/shared/schema-detector.ts (deterministic marker detection for 18 schemas)
- [x] Stap 3: Create lib/engine/shared/mode-detector.ts (deterministic marker detection for 22 modes)
- [x] Stap 4: Create lib/engine/shared/schema-mode-router.ts (intervention routing + prompt builder + safety gating)
- [x] Stap 5: Add hybrid persistence (modeTendencies/schemaTendencies in UserDat, all 3 persistence paths)
- [x] Stap 6: Wire as Step 5f in pipeline.ts after STOA, result in ChatContext as schemaModeContext
- [x] Stap 7: Wire through gpt-payload-builder.ts + openai-provider.ts + server/ai-chat.ts
- [x] 0 TS errors, 404 tests green (21 passed, 1 skipped)

## Round 52 — RETP Routing + Tendency Decay

- [x] Taak 1: Create lib/engine/elias/retp-router.ts (emotie→interventie routing)
- [x] Taak 1: Safety gating (no RETP at crisisLevel >= 2)
- [x] Taak 1: Wire RETP output as input to STOA selector in pipeline (Step 5e1)
- [x] Taak 2: Add lastSeenAt to modeTendencies/schemaTendencies entries
- [x] Taak 2: Implement 10% decay at session-end for unseen tendencies
- [x] Taak 2: Prune entries with score < 0.1
- [x] Taak 2: Cap at max 10 tendencies per category
- [x] 0 TS errors, 409 tests green (22 passed, 1 skipped)
- [x] Write SignalEngine integration test (5 assertions: engine active, fears detection, hopes detection, model selection, projection boost)

## Round 53 — Fase 5: ACT Therapy Engine

- [x] Stap 1: Create lib/engine/shared/act-types.ts (ACTProcessId, ACTSignalId, ACTCandidate, ACTDecision, ACTProgress)
- [x] Stap 2: Create lib/engine/shared/act-detector.ts (deterministic marker detection for 14 signals)
- [x] Stap 3: Create lib/engine/shared/act-router.ts (6 ACT processes, safety gating, VSP/EigenRegie gating, schema/mode integration, prompt builder)
- [x] Stap 4: Wire into pipeline.ts as Step 5g after schema/mode, add actContext to ChatContext
- [x] Stap 5: Wire through gpt-payload-builder.ts + openai-provider.ts + server/ai-chat.ts
- [x] Stap 6: Add ACT progress to user.dat (values, preferred tools, fusion patterns, all 3 persistence paths)
- [x] Stap 7: 0 TS errors, 409 tests green (22 passed, 1 skipped)

## Round 54 — Fase 5: CGT (Cognitive Behavioral Therapy) Engine

- [x] Stap 1: Create lib/engine/shared/cgt-types.ts (27 DistortionIds, 13 CBTProcessIds, 16 CBTSignalIds, CBTCandidate, CBTDecision, CBTProgress, signal→process/hint/distortion maps)
- [x] Stap 2: Create lib/engine/shared/cgt-detector.ts (deterministic marker detection for 16 signals, confidence scoring, priority boost)
- [x] Stap 3: Create lib/engine/shared/cgt-router.ts (safety gating, VSP depth levels, EigenRegie gating, CBT×ACT integration, CBT×Schema/Mode integration, anti-repeat, prompt builder)
- [x] Stap 4: Wire into pipeline.ts as Step 5h after ACT, add cgtContext to ChatContext
- [x] Stap 5: Wire through gpt-payload-builder.ts + openai-provider.ts + server/ai-chat.ts (both prompt paths)
- [x] Stap 6: Add CBT progress to user.dat (recurring distortions, preferred tools, reframes/experiments counts, all 3 persistence paths in user-context.tsx)
- [x] Stap 7: 0 TS errors, 409 tests green (22 passed, 1 skipped)

## Round 55 — Fase 5: DGT (Dialectical Behavior Therapy) Engine

- [x] Stap 1: Create lib/engine/shared/dbt-types.ts (16 DGTProcessIds, 18 DGTSignalIds, 22 DGTSkillIds, 6 ValidationLevelIds, 5 EscalationStages, EKTPhases, KimStateRisks, AbandonmentPanicSubtypes, ShameSpiralStages, RelapseRiskStages, DGTCandidate/DGTDecision/DGTProgress contracts, signal→process/skill/hint maps, VSP→validation/escalation→validation maps)
- [x] Stap 2: Create lib/engine/shared/dbt-detector.ts (deterministic marker detection for 18 signals, priority-weighted confidence scoring per Section 22)
- [x] Stap 3: Create lib/engine/shared/dbt-router.ts (validation L1-L6 engine, skill selection hidden, safety gating, VSP depth levels, escalation stage scoring, Kim boundary-first routing, DGT→EKT routing, DGT×ACT×CBT×Schema arbitration, prompt builder 4-line context budget)
- [x] Stap 4: Wire into pipeline.ts as Step 5i after CBT, add dgtContext to ChatContext, resetDGTSessionState
- [x] Stap 5: Wire through gpt-payload-builder.ts + openai-provider.ts (3 locations) + server/ai-chat.ts (interface + Zod + prompt block + 2 prompt templates)
- [x] Stap 6: Add DGT progress to user.dat (successful skills, grounding preference, trigger patterns, relapse interruption, validation depth, boundary skills, caregiver overload, all 3 persistence paths in user-context.tsx)
- [x] Stap 7: 0 TS errors, 409 tests green (22 passed, 1 skipped)

## Round 56 — Fase 5: MBT++ (Mentalization-Based Treatment) Engine

- [x] Stap 1: Create lib/engine/shared/mbt-types.ts (8 mentalizing states M0-M7, 9 response modes, 16 processes, 18 signals, signal→process+state+responseMode mapping, severity/depth/VSP maps, routing priority, MBTCandidate/MBTDecision/MBTEngineResult/MBTProgress contracts)
- [x] Stap 2: Create lib/engine/shared/mbt-detector.ts (deterministic mentalizing state detection M0-M7 via weighted pattern matching, 18 signal marker detection NL+EN regex, combined detectMBT function)
- [x] Stap 3: Create lib/engine/shared/mbt-router.ts (safety gating: crisis/boundary/relapse/VSP/shutdown, Kim/Elias persona divergence with priority signal boost, cross-engine integration MBT×ACT×CBT×DGT×Schema, depth gating, anti-repeat logic, response mode selection per routing priority, Kim boundary-first override, compact prompt builder 4-line budget)
- [x] Stap 4: Wire into pipeline.ts as Step 5j after DGT, add mbtContext to ChatContext, resetMBTSessionState, trace data
- [x] Stap 5: Wire through gpt-payload-builder.ts + openai-provider.ts (3 locations) + server/ai-chat.ts (interface + Zod + prompt block + 2 prompt templates)
- [x] Stap 6: Add MBT progress to user.dat (dominantMentalizingPattern, recurringCollapsePatterns, successfulRepairs, successfulRegulations, boundaryProtectionsUsed, preferredResponseModes, lastMBTProcessUsed, lastMBTSessionDate) + all 3 persistence paths in user-context.tsx
- [x] Stap 7: 0 TS errors, 409 tests green (22 passed, 1 skipped)

## Bugfix — Projection layer fears not activating

- [x] Fix missing `await` on loadAndRestoreEliasProjection/Kim in chat.tsx (projection state was empty at first pipeline run)
- [x] Add persistence after detection in projection-layer.ts (saveEliasProjection/saveKimProjection fire-and-forget after new entries or reinforcements)
- [x] 0 TS errors, 409 tests green
- [x] Add Dutch FEAR_MARKERS, HOPE_MARKERS, GOAL_MARKERS to projection engine (bang, angst, zorgen, hoop, droom, doel, etc.)
- [x] Fix test assertion for NL marker detection (signal-engine-integration test 5)

## Round 57 — KO1 Recognition & Validation (Kim-only)

- [x] Create lib/engine/kim/ko1-recognition.ts with types, detector, router, prompt builder
- [x] Wire KO1 into pipeline.ts as Kim-specific step after MBT (Step 5k)
- [x] Add ko1Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add ko1Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 58 — K05 Communication Skills (Kim-only)

- [x] Create lib/engine/kim/k05-communication.ts with types, detector, router, prompt builder
- [x] Wire K05 into pipeline.ts as Kim-specific step after KO1 (Step 5l)
- [x] Add k05Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k05Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 59 — K02 Enabling Awareness (Kim-only)

- [x] Create lib/engine/kim/k02-enabling-awareness.ts with enums, state variables, boundary flags, detector, router, prompt builder
- [x] Detector: 6 boundary flags (self-loss, guilt, rescuing, control-as-care, hypervigilance, abandonment fear) with NL+EN markers
- [x] Router: 5 intervention states, K03/K04 routing, awareness tracking, prompt builder
- [x] Wire K02 into pipeline.ts as Kim-specific step after K05 (Step 5m)
- [x] Add k02Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k02Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 60 — K04 Emotional Regulation for Caregivers (Kim-only)

- [x] Create lib/engine/kim/k04-emotional-regulation.ts with types, detector (NL+EN markers), router, prompt builder
- [x] Wire K04 into pipeline.ts as Kim-specific step after K02 (Step 5n)
- [x] Add k04Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k04Progress to user.dat persistence (types.ts, user-context.tsx)
- [ ] Fix deployment pnpm approve-builds error (deferred)
- [x] 0 TS errors, 409 tests green

## Round 61 — K04-S4 Betrayal, Trust, Hope & Self-Protection (Kim-only)

- [x] Create lib/engine/kim/k04-betrayal-trust.ts with types, detector, router, prompt builder
- [x] Wire K04-S4 into pipeline.ts as Kim-specific step after K04 (Step 5o)
- [x] Add k04s4Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k04s4Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 62 — K06 Self-Care & Sustainable Support (Kim-only)

- [x] Create lib/engine/kim/k06-self-care.ts with types, detector, router, prompt builder
- [x] Wire K06 into pipeline.ts as Kim-specific step after K04-S4 (Step 5p)
- [x] Add k06Context to payload chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k06Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 63 — K01 Boundary Setting (Kim default module)

- [x] Create lib/engine/kim/k01-boundary-setting.ts with types, detector, directive logic, prompt builder
- [x] Wire K01 into pipeline.ts as Step 5q (Kim only, default module)
- [x] Add k01Context to transport chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k01Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] Fix TS errors: replace undeclared sessionMessageCount/recentMessages with sessionBuffer equivalents
- [x] 0 TS errors, 409 tests green

## Round 63b — moduleUsage aggregatie fix

- [x] Fix recordModuleUsage: aggregate count instead of pushing duplicate entries
- [x] Add count field to ModuleUsageRecord interface
- [x] Fix diagnostics to use actual count from record instead of hardcoded 1
- [x] Legacy entries auto-migrate via (m.count || 1) fallback
- [x] 0 TS errors, 409 tests green

## Maintenance Round 4

- [x] Fix 1: projection-layer.ts NL→EN markers (already English, no changes needed)
- [x] Fix 2: Add single-user cache comment above sessionCache in server/ai-chat.ts
- [x] Fix 3: Translate all Dutch strings/comments in server/ai-chat.ts buildSystemPrompt to English (Taak→Task, Kwaliteitscontrole→Quality Control, Vooranalyse→Pre-Analysis, Schema Integratie→Schema Integration, VSP ROOD→VSP RED)
- [x] 0 TS errors, 409 tests green

## Round 64 — SW01 Shadow Work (Elias only, final closing module)

- [x] Create lib/engine/elias/shadow/sw01_shadow_types.ts
- [x] Create lib/engine/elias/shadow/sw01_trigger_detector.ts
- [x] Create lib/engine/elias/shadow/sw01_zucht_router.ts
- [x] Create lib/engine/elias/shadow/sw01_relapse_loops.ts
- [x] Create lib/engine/elias/shadow/sw01_projection_mapper.ts
- [x] Create lib/engine/elias/shadow/sw01_journaling_prompts.ts
- [x] Create lib/engine/elias/shadow/sw01_prompt_injector.ts
- [x] Create lib/engine/elias/shadow/sw01_storage_contract.ts + index.ts barrel
- [x] Wire SW01 into pipeline.ts as Step 5e3 (Elias only)
- [x] Add sw01Context to transport chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add sw01Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] Fix TS error: replace sessionBuffer.currentZucht with currentZoneScore/10 mapping
- [x] 0 SW01-specific TS errors, 409 tests green

## Round 64b — Module-catalog.ts cleanup

- [x] Update K04 name: "Stress Management" → "Emotional Regulation" (matches k04-emotional-regulation.ts)
- [x] Update K06 name: "Detachment with Love" → "Self-Care & Sustainable Support" (matches k06-self-care.ts)
- [x] Add K06 trigger keywords: burnout, exhausted, can't anymore
- [x] Add K04 trigger keywords: betrayed, trust, hope (matches K04-S4 sub-module)
- [x] Add comments noting KO1 (Recognition) and K04-S4 (Betrayal/Trust) as separate engine files
- [x] Update all selection function comments to use correct module names
- [x] 0 TS errors, 409 tests green

## Round 65 — Gratitude Dagboek Sectie + Deploy Fix

- [x] Fix pnpm ERR_PNPM_IGNORED_BUILDS deploy error (add pnpm.onlyBuiltDependencies to package.json)
- [x] Add gratitude field (entry1/entry2/entry3) to DiaryEntry interface
- [x] Add gratitudeStreak + lastGratitudeDate to UserDat + createNewUserDat + user-context.tsx
- [x] Update diary.tsx UI with 3 gratitude text fields + explanation text + gratitude badge on entries
- [x] Wire gratitude streak logic into pipeline.ts endSession (Step 5c)
- [x] Pass diary entries from chat.tsx to endSession via _sessionDiaryEntries
- [x] Fix 3 fallback UserDat constructions missing gratitudeStreak/lastGratitudeDate
- [x] 0 project-specific TS errors, 409 tests green

## Round 65b — Intervention Continuity re-evaluatie fix

- [x] Add time-based re-evaluation trigger (turnsActive >= 5 && effectivenessScore >= 70)
- [x] Add selectUpgradedGoal() with progression ladder (stabilization→regulation→deceleration→reflection→confrontation)
- [x] Safety guard: high-severity zones (ROOD/PAARS) cannot progress past regulation
- [x] Reset turnsActive to 0 on time-based re-eval (zone-shift keeps incrementing)
- [x] 0 project-specific TS errors, 409 tests green

## Round 66 — K03 Self-Care With Shadow Layer (Elias + Kim)

- [x] Create lib/engine/kim/k03-self-care.ts with types, shadow detector, response level router, prompt builder, session state
- [x] Wire K03 into pipeline.ts as Step 5r (both Elias + Kim, trigger: selfCare <= 3)
- [x] Add k03Context to transport chain (gpt-payload-builder, openai-provider, server/ai-chat)
- [x] Add k03Progress to user.dat persistence (types.ts, user-context.tsx)
- [x] 0 TS errors, 409 tests green

## Round 67 — Therapeutic Engine Patch (Hybride Fix)

- [x] Fix 1: Self-compassion micro-layer always active at crisisLevel >= 2 (pipeline.ts) — DGT was already never suppressed
- [x] Fix 2: INVALID_RESPONSE_FILTER added to buildSystemPrompt (both follow-up and session-start templates)
- [x] Fix 3: THERAPY_SELECTION_MATRIX added to buildSystemPrompt (both follow-up and session-start templates)
- [x] 0 project-specific TS errors, 409 tests green

## Round 68 — Persona Rewrite (Elias + Kim)

- [x] Replace ELIAS_IDENTITY_PROMPT with new persona (direct, recognition-first, no wellness-app tone)
- [x] Replace KIM_IDENTITY_PROMPT with new persona (chosen side, pattern-naming, first-5-minutes rule)
- [x] 0 TS errors, 409 tests green
- [x] Gratitude streak badge UI in diary header (shows at streak >= 1, fire emoji at >= 3, tap opens editor)
- [x] Fix module-catalog.ts K03 threshold from 2 to 3 (spec alignment)
- [x] SW01 Shadow Work unit tests (8 tests: confidence scoring, zucht routing, Elias-only guard)
- [x] Fix SW01 circular dependency: replaced require() with top-level import in sw01_prompt_injector.ts
- [x] Onboarding tekst fix: Elias description → "direct, honest support for your recovery — from someone who gets it."
- [x] Sober counter: add sobrietyDate to UserDat + createNewUserDat + hydration
- [x] Sober counter: date picker on Elias profile screen
- [x] Sober counter: counter display on Elias home/profile (Elias only, optional)
- [x] Sober counter compact display on Elias home screen (tap → profile)
- [x] Milestone notifications: lastMilestoneShown in UserDat, modal on milestone days (1,7,30,90,180,365)
- [x] Fix pnpm ERR_PNPM_IGNORED_BUILDS: wildcard onlyBuiltDependencies + packageManager pinned to 9.12.0

## Deployment Fix — pnpm 11 compatibility

- [x] Fix backend deploy: pnpm 11.5.1 requires nodeLinker in pnpm-workspace.yaml (not .npmrc)
- [x] Add packageManager: "pnpm@11.5.1" to package.json (matches Docker Corepack version)
- [x] Regenerate pnpm-lock.yaml with pnpm 11.5.1 (lockfileVersion 9.0 compatible)
- [x] Add nodeLinker: hoisted to pnpm-workspace.yaml (pnpm 11 ignores .npmrc for non-auth settings)
- [x] Verify: pnpm install --frozen-lockfile + pnpm run build + expo export --platform android all pass
- [x] Add AppErrorBoundary to _layout.tsx (catches and displays crashes instead of silent close on Android)
- [x] 417 tests green, 0 project-specific TS errors
- [x] Fix Android crash: "Rendered more hooks than during previous render" — moved useCallback above early return in HomeScreen
- [x] Sober counter: redesign home screen version as prominent, emotional primary element (big, top of screen)
- [x] Sober counter: keep date picker in profile only
- [x] Fix backend deploy: add verifyDepsBeforeRun: install to pnpm-workspace.yaml (pnpm 11 default check fails across Docker RUN layers)
- [x] Fix diary New Entry: gratitude fields unreachable with keyboard open on Android — changed behavior to "padding", added keyboardShouldPersistTaps, removed autoFocus
- [x] Clinical Mode: add clinicalModeActive to UserDat (default false)
- [x] Clinical Mode: easter egg activation on home screen (5x tap on avatar/name)
- [x] Clinical Mode: inject clinical annotation instruction into system prompt when active
- [x] Clinical Mode: parse and render collapsible clinical tag in chat bubble UI
- [x] Bug fix: Chat duplicate — session now starts fresh (old history not shown, pipeline still sends full context to GPT)
- [x] Bug fix: Clinical tag — added clinicalModeActive to Zod schema (was being stripped during validation), updated label to ⚕ clinical
- [x] Clinical Mode: fix GPT compliance — moved annotation instruction to absolute end of system prompt (both paths), strengthened enforcement language, added server-side fallback that appends default <clinical> tag if GPT omits it
- [x] Kim Backpack: add kimBackpack data structure to Backpack type with 5 sections
- [x] Kim Backpack: add persistence (AsyncStorage) for Kim sections
- [x] Kim Backpack: update backpack.tsx UI to show Kim sections when userType === 'kim'
- [x] Kim Backpack: integrate Kim backpack into GPT session start context
- [x] Kim Backpack: 0 TS errors, all tests green
- [x] Diary: split into Journal and Gratitude tabs at top of screen
- [x] Diary: Journal tab with stoic quote and explanation
- [x] Diary: Gratitude tab with explanation and 3 fields
- [x] Diary: 0 TS errors, all tests green
- [x] Diary: rotating stoic quotes (10-15 quotes, daily rotation) in Journal tab
- [x] Diary: mood tag chip selector in editor modal
- [x] Onboarding: remove step 3 (emotion choice) from intake flow
- [x] Onboarding: remove step 5 (free text "What's on your mind?") from intake flow
- [x] Onboarding: 0 TS errors, all tests green
- [x] BUG: Backpack data lost on app restart (AsyncStorage persistence failure)
- [x] BUG: Chat history not retained between sessions (data not persisted or overwritten)
- [x] FIX: migrateBackpack must include kimBackpack field on restore
- [x] FEAT: Chat UI shows previous session messages (collapsed/separator)
- [x] FEAT: Refresh chatHistory at session end — keep only current + previous session
- [x] FIX: Kim users always get greeting regardless of backpack content (greeting gate bypass)
- [x] STO01: Create types file (sto01_types.ts) with all interfaces
- [x] STO01: Create trigger detector (sto01_trigger_detector.ts) with EN/NL markers
- [x] STO01: Create routing function (sto01_routing.ts) with evaluateSTO01 + selectSTO01Intervention
- [x] STO01: Create prompt builder (sto01_prompt_builder.ts) with SW01-aware modifiers
- [x] STO01: Create forbidden outputs (sto01_forbidden_outputs.ts)
- [x] STO01: Create storage contract (sto01_storage_contract.ts) with session state + progress
- [x] STO01: Create barrel export (index.ts)
- [x] STO01: Integrate into pipeline.ts as step 5e4 after SW01
- [x] STO01: Add sto01Context to ChatContext, GPTPayload, BuildPayloadInput, OpenAIProvider
- [x] STO01: Add sto01Context to server ai-chat.ts (interface, Zod schema, prompt injection)
- [x] STO01: Write 9 test cases (6 spec + 3 extra) — all passing
- [x] STO01: 0 TS errors, all 427 tests green
- [x] Model routing: riskScore threshold 7→30, add PAARS/PURPLE + ORANJE/ORANGE VSP levels, GROEN+GEEL→gpt-4o-mini
- [x] FIX: Elias greeting gate removed — both Elias and Kim always get greeting regardless of backpack content
- [x] FEAT: Greeting tone adaptation when backpack is empty — warm invite to talk or fill backpack
- [x] FEAT: Export server as standalone Node.js package for Railway deploy (Dockerfile, railway.json, .env.example)
- [x] Update EXPO_PUBLIC_API_BASE_URL to Railway production URL (https://railwayappdashboard-production.up.railway.app)
- [x] Remove all Manus sandbox URL references

## V2 Design Overhaul (Mockup Implementation)
- [x] Update theme config: white/light-grey background, blue (#2196F3) accent
- [x] Restructure tab bar: Home → Chat → Mood → Diary → Backpack → Profile (6 tabs)
- [x] Redesign Home screen: greeting, sober counter card, mood summary row, CTA button
- [x] Redesign Mood screen: slider cards with colored dots, value display, Save Check-in button
- [x] Redesign Diary screen: Journal/Gratitude toggle tabs, Stoic quote, mood tags
- [x] Redesign Backpack screen: progress bar, Stage of Change cards
- [x] Redesign Profile screen: user card with stats, guidance depth radio, reset button
- [x] Build VSP Check-in screen: tension levels list with red Relapse option
- [x] Consistent light styling across all screens
- [x] 0 TS errors, all tests green after V2 redesign
- [x] Add Signals line to clinical tag (candidateSignals from engine → server → UI)
- [x] Add Elias avatar (elias_avatar.jpg) to assets/images
- [x] Add Kim avatar (kim_avatar.png) to assets/images
- [x] Display companion avatar on Home screen (Elias for addiction users, Kim for loved ones)
- [x] Loopblocker Function 1: Per-session module repetition detection (usedModules[] in buffer)
- [x] Loopblocker Function 2: Cross-session pattern recognition (repeatingPatterns[] in user.dat)
- [x] Wire loopDetected directive into GPT payload (SESSION_INIT + LIVE_MESSAGE)
- [x] Add loopDetected to ChatContext, GPTPayload, PayloadBuilderInput interfaces
- [x] Inject loop directive in pipeline processMessage (reads from user.dat repeatingPatterns)
- [x] Session-end: detect repeating themes, update repeatingPatterns with decay
- [x] Language Recovery Analyzer: detect diminishing negative intensity in user language (pipeline step 3b)
- [x] Recovery indicators: 20 Dutch phrases signaling reduced negativity (not positive statements)
- [x] Theme keyword mapping: link recovery to projection themes (verlatingsangst, terugval, schaamte, etc.)
- [x] Apply -0.5 decay to matching projection entry when recovery detected
- [x] Inject LANGUAGE_RECOVERY_DETECTED directive into GPT payload for subtle acknowledgment
- [x] Wire languageRecovery through ChatContext → GPTPayload → PayloadBuilder → OpenAI provider
- [x] Kim Module KST01: Stoicism for Caregivers (types, detector, router, prompt, storage, tests)
- [x] Kim Module KDL01: Detachment With Love (types, detector, router, prompt, storage, tests)
- [x] Kim Module KBR01: Boundary Restoration (types, detector, router, prompt, storage, tests)
- [x] Kim Module KSC01: Self-Compassion Caregiver (types, detector, router, prompt, storage, tests)
- [x] Pipeline integration: KST01→KDL01/KBR01/KSC01 conditional routing after K06 (step 5p2)
- [x] Server-side: KST01/KDL01/KBR01/KSC01 context fields in Zod schema + system prompt injection
- [x] KimModuleRouteTarget enum with all routing targets
- [x] Kim advanced modules integration layer (lib/engine/kim/kim-advanced-modules.ts)
- [x] Kim Advanced Modules storage persistence at session-end (KST01/KDL01/KBR01/KSC01 → user.dat)
- [x] Crisis escalation (crisisLevel >= 2) confirmed in all Kim advanced module detectors + final safety override
- [x] Clinical tag hidden when annotation contains '[not annotated' or 'model did not comply'
- [x] Crisis markers: suicidal ideation language detection in buildActiveSignals (score +3, buffer)
- [x] Crisis Response Protocol: presence → safety → numbers (Belgian: 112, 0800 32 123, 107, 1712)
- [x] GDPR: Create privacy constants config (store=false, all tools disabled)
- [x] GDPR: Implement prompt minimization layer (no raw journal/rugzak/crisis history to OpenAI)
- [x] GDPR: Refactor OpenAI provider as language-rendering-only wrapper
- [x] GDPR: Implement local response post-check layer (reject diagnosis/advice/escalation)
- [x] GDPR: Add fallback when post-check fails (discard OpenAI output, show local text)
- [x] GDPR: Write 14 compliance tests (store=false, no tools, no raw data, post-check)
- [x] GDPR: Add compliance note in codebase
- [x] GDPR consent screen: mandatory, not skipable, shown after intake and for returning users without gdprAccepted
- [x] First-chat disclaimer modal: one-time, not skipable, saves firstChatSeen to user.dat
- [x] Fixed crisis disclaimer at bottom of chat screen (always visible)
- [x] Personal emergency contacts (max 2): add name + number in Settings, shown in EmergencyCard as tappable call buttons
- [x] Server: THERAPY DISCLOSURE in CLINICAL MODE + moduleRegistry.getActiveModules(userType)
- [x] Kim Stilte Detectie: 20s silence timer, random soft invitation, max 1x per silence, reset on interaction
- [x] Stilte Detectie rewrite: both Elias + Kim, 20s normal silence, persona-specific responses
- [x] Module 58: post-onthulling 90s silence detection with disclosure keywords + specific response
- [x] Fix: VSP PAARS always showing red border/bg even when not selected — now only highlights when actively selected
- [x] Clinical tag: change color from warning/orange to green (#2E7D32 / colors.success)
- [x] Clinical tag: show fallback "[not annotated]" instead of hiding it
- [x] Server: clinical mode now always routes to gpt-4o (mini unreliable for tag compliance)
- [x] Module routing integration: VERGV01/IGH01/AGC01/HWK01 detectors wired into app pipeline (step 5e5) with end-to-end context injection to server
- [x] Unit tests for advanced-modules detector: 47 tests covering NL+EN markers, gate conditions, priority routing (HWK01>VERGV01>IGH01>AGC01), confidence scoring, prompt block content
- [x] Server verification: VERGV01/IGH01/AGC01/HWK01 context fields correctly injected in buildSystemPrompt() for both Elias and Kim templates (SESSION_INIT + LIVE_MESSAGE)
- [x] Integration test: end-to-end pipeline for VERGV01/IGH01/AGC01/HWK01 — 22 tests covering full path (gate → detect → payload builder → server contract), priority routing through payload, Kim/Elias persona separation
- [x] Scroll-to-bottom FAB in chat: floating "↓" button rechtsonder wanneer gebruiker omhoog gescrold is, verdwijnt automatisch bij terugkeer naar bodem
- [x] Design refresh: Update design tokens (theme.config.js, theme.ts, theme-provider, tailwind)
- [x] Design refresh: Create shared design constants (colors, typography, spacing, radius, shadows)
- [x] Design refresh: Home screen redesign
- [x] Design refresh: Chat bubbles and input redesign
- [x] Design refresh: Mood screen sliders and cards redesign
- [x] Design refresh: Tab bar floating style
- [x] Design refresh: Diary, Backpack, Profile screens update
- [x] Animated tab bar: scale/opacity animation on tab icons via react-native-reanimated
- [x] Onboarding/intake screen refresh: warm backgrounds, new typography, card styles consistent with design system
- [x] GDPR-consent screen refresh: warm background, new typography, card styles consistent with design system
- [x] Onboarding step transition: fade/slide-in animation between 3 intake steps via react-native-reanimated
- [x] Animated progress bar: width transition on step change in onboarding via react-native-reanimated
- [x] Settings screen refresh: card/typography style consistent with design system
- [x] Dark mode fine-tuning: per-screen contrast and readability with warm tokens (tokens verified, forced-light mode intentional for V2 design)
- [x] Loading state animation: pulse/shimmer on "Submitting..." button in onboarding step 3
- [x] Fix: PreChatVsp confirm button not reachable on small screens — moved button inside ScrollView instead of absolute positioning
- [x] Fix: Reset All Data now correctly clears in-memory state (resetUser dispatch) + navigates to /intake instead of just showing "restart app" alert
- [x] Confirmation haptic + success toast after Reset All Data before navigating to intake
- [x] Chat history reset: verify chat messages in memory (useRef/state) are cleared on reset/navigation to intake
- [x] PreChatEigenRegie (Kim) scroll-fix: move confirm button inside ScrollView like PreChatVsp
- [x] Fix: Crisis disclaimer overlapping tab bar and Back to Home button — added paddingBottom: insets.bottom + 60
- [x] Color palette update: Switch to "Rust & Herstel" theme — Saliegroen (#A8C3A0), Donkergroen (#4F6F52), Petrolblauw (#1F4E5F), Crème (#F7F5F0), Lichtgrijs (#EAEAEA), Tekst (#2E2E2E)
- [x] Fix: Crisis mode EmergencyCard not showing phone numbers — replaced NativeWind className (bg-error/10 broken with CSS var hex) with inline styles from design system
- [x] Fix: EmergencyCard moved from ListHeaderComponent to ListFooterComponent so it appears after latest messages (visible without scrolling up)
- [x] Fix: Progress bars/sliders barely visible — added dc.sliderTrack (#C4C2BD) color, darkened moodGreen (#6B9E63) and moodYellow (#B89B3E) for better contrast against white cards
- [x] Fix: Elias fabuleert over therapievormen (EMDR, etc.) die de app niet biedt — CAPABILITY HONESTY RULE: mag eigen modules eerlijk noemen, mag NOOIT niet-bestaande therapieën verzinnen
- [x] Fix: Chat header moet donkergroen/petrolblauw achtergrond met witte tekst (zoals reference design)
- [x] Fix: Intake scherm moet crème achtergrond (#F7F5F0) ipv wit
- [x] Fix: Chat scherm achtergrond moet crème (#F7F5F0) zijn ipv wit
- [x] Fix: Intake kaarten nog te wit — tint surface kleur naar licht crème/sage (#FDFCF9), borders naar warm grijs (#E2E0DB/#E8E6E1)
- [x] Fix: Meer Rust & Herstel kleuren door de hele app — surface, border, surfaceKim tokens getint
- [x] Fix: Clinical annotation 'did not comply' error verborgen — fallback annotations worden niet meer getoond
- [x] Fix: Module lijst dynamisch uit backend catalogs ipv hardcoded in prompt (voorkomt fabuleren)
- [x] Implement all non-implemented Elias short modules (M05-M85) in module catalog — 66 modules with full prompt blocks
- [x] Wire all modules into dynamic clinical mode module list + keyword detector + routing map (343 tags)
- [x] Short module routing: detectShortModuleTrigger in dominant-state-selector (priority 5.5)
- [x] getTriggerModule fallback: checks SHORT_MODULE_TAG_MAP when standard mapping returns default
- [x] Debug: Short modules (M05-M85) not activating — rewrote detector with English keywords + multilingual translation map (NL/DE/FR/ES→EN), threshold=1, all 66/66 modules now trigger correctly
- [x] Implement FALE01 module (types, detector, router, prompt, storage, tests)
- [x] Implement VERG01 module (types, detector, router, prompt, storage, tests)
- [x] Implement ROUW01 module (types, detector, router, prompt, storage, tests)
- [x] Implement IDEN01 module (types, detector, router, prompt, storage, tests)
- [x] Implement ZINK01 module (types, detector, router, prompt, storage, tests)
- [x] Create elias-advanced-modules-p2.ts integration layer (priority 5.6)
- [x] Wire new modules into pipeline.ts at step 5.6
- [x] Add storage fields to user-dat schema (via ChatContext + GPTPayload types)
- [x] Add keywords to short-module-detector for FALE01/VERG01/ROUW01/IDEN01/ZINK01
- [x] Implement Module Memory Cross-Session (shared types + elias + kim persona-separated)
- [x] Wire module memory into pipeline session-end (persona-separated persistence)
- [x] Add moduleMemory field to UserDat type
- [x] Implement Elias Progress Tracker engine (detector + trend computation + prompt payload)
- [x] Implement Kim Progress Tracker engine (detector + trend computation + prompt payload)
- [x] Build ProgressCard UI component with 7/30 day toggle, trend rows, signal summary
- [x] Integrate ProgressCard into Mood tab (between check-in and recognition sections)
- [x] Implement TERV01 module (terugvalanalyse na PAARS — types, detector, router, prompt, storage, tests)
- [x] Implement MI02 module (motivational interviewing verdieping — types, detector, router, prompt, storage, tests)
- [x] Create advanced-modules-p3.ts integration layer for TERV01 + MI02 (priority 5.7)
- [x] Wire P3 into pipeline.ts at step 5e7 + GPT payload passthrough + engine trace
- [x] Add TERV01/MI02 test suite (30 tests, all green)
- [x] Implement SLAAP01 Elias module (types, detector, router, prompt, storage, tests)
- [x] Implement SLAAP01 Kim module (types, detector, router, prompt, storage, tests)
- [x] Create SLAAP01 integration layers (Elias P4 + Kim extension)
- [x] Wire SLAAP01 into pipeline.ts with persona separation
- [x] Add SLAAP01 keywords to short-module-detector
- [x] Implement Milestone Tracker (types + elias logic + kim logic + MilestoneCard UI on Home)
- [x] Implement Diary Search (types + search logic + search UI on Diary tab)
- [x] Implement Chat Text Selection (selectable={true} on chat bubbles, clinical dropdown non-copyable)
- [x] Implement Mood Trend Chart (types + elias logic + kim logic + SVG line chart + integration on Mood tab)
- [x] Implement BEDR01 Kim module (betrayal discovery acute shock — types, detector, router, prompt, storage, tests)
- [x] Implement VETR01 Kim module (trust repair after betrayal — types, detector, router, prompt, storage, tests)
- [x] Implement GASL01 Kim module (gaslighting recognition & fact anchoring — types, detector, router, prompt, storage, tests)
- [x] Create kim-advanced-modules-p2.ts integration layer (BEDR01/VETR01/GASL01 priority routing)
- [x] Wire Kim P2 into pipeline.ts at step 5e9 (detection block + context passthrough + engine trace)
- [x] Add bedr01Context/vetr01Context/gasl01Context to GPTPayload, PayloadBuilderInput, ChatContext types
- [x] Add Kim P2 passthrough + serialization in openai-provider.ts (both blocks)
- [x] Add BEDR01/VETR01/GASL01 keywords to short-module-detector (English + NL/DE/FR/ES translations)
- [x] FIX CRITICAL: Crisis nummers moeten IN de chattekst van Elias/Kim staan (niet alleen UI kaart)
- [x] FIX CRITICAL: Correcte noodnummers onderaan chat scherm (Zelfmoordlijn 0800 32 123 + 112)
- [x] FIX: Server fallback response bij API failure: 113 → 0800 32 123 (correct Belgisch nummer)
- [x] FIX: Server-side post-processing: als crisisLevel >= 2 en nummers ontbreken in GPT response, automatisch toevoegen
- [x] FIX: Crisis disclaimer onderaan chat wordt afgesneden door tab bar — meer padding nodig
- [x] FIX: Rode crisis kaart verschijnt niet — root cause: Dutch keywords ontbraken in signal detection
- [x] FIX: Dutch crisis keywords toegevoegd aan state-analyzer.ts (activeSuicidal, passiveSuicidal, selfHarm, etc.)
- [x] FIX: Dutch crisis keywords toegevoegd aan lib/crisis/detector.ts (CRISIS_PATTERNS)
- [x] FIX: Chat begint met antwoord op laatste vraag i.p.v. frisse begroeting — sessie-afscheiding fixen
- [x] FIX: conversationHistory leeg bij SESSION_INIT (pipeline.ts) zodat GPT geen oud gesprek voortzet
- [x] FIX: Expliciete greeting instructie toegevoegd aan SESSION_START system prompt (server/ai-chat.ts)
- [x] FIX: Client-side session reset — greetingSent.current + preChatDone + messages + sessionPhase reset na End session
- [x] FIX: useFocusEffect reset bij sessionPhase 'completed' — automatische fresh start bij terugkeer naar Chat tab
- [x] FIX: handleBackToHome reset alle session state zodat volgende chat-open een verse sessie start
- [x] Remove End Chat button from UI
- [x] Add AppState listener: auto-trigger endSession when app goes to background
- [x] Ensure fresh greeting on next app open after auto-end (reset greetingSent + preChatDone on foreground return)
- [x] Enhancement: Timeout fallback (10s) for auto-end — lightweight local save if API too slow
- [x] Enhancement: "Welkom terug" short greeting variant if user returns within 30 min
- [x] Enhancement: Visual toast "Vorige sessie veilig opgeslagen" on session restore
- [x] Implement CDP01 Kim module (Codependentie Patroon Detectie) — types, detector, router, prompt, storage, tests
- [x] Implement RNW01 Kim module (Rouw Naaste: Wie Ze Was) — types, detector, router, prompt, storage, tests
- [x] Create kim-advanced-modules-p3.ts integration layer for CDP01/RNW01
- [x] Wire CDP01/RNW01 into pipeline (step 5e10), payload builder, ChatContext, OpenAI provider
- [x] Register CDP01/RNW01 in Kim module catalog
- [x] Add CDP01/RNW01 keywords to short-module-detector (English + Dutch translations)
- [x] Add CDP01/RNW01/BEDR01/VETR01/GASL01/PAR01/FIN01 to clinical mode dropdown (dr peuskens)
- [x] Implement Kim P4 modules (PAR01: Parentificatie, FIN01: Financiële afhankelijkheid)
- [x] Create kim-advanced-modules-p4.ts integration layer
- [x] Wire P4 into pipeline (step 5e11), payload builder, ChatContext, OpenAI provider
- [x] Register P4 modules in catalog and keyword detector
- [x] Build module-activation dashboard in clinical mode (real-time active modules, confidence scores, K06 status)
- [x] Add 1712 (huiselijk geweld) to crisis footer alongside 0800 32 123 and 112
- [x] Implement ISO01 Kim module (Isolatie en Sociale Terugtrekking) — types, detector, router, prompt, storage, tests
- [x] Create kim-advanced-modules-p5.ts integration layer for ISO01
- [x] Wire ISO01 into pipeline (step 5e12, after P4/PAR01/FIN01), payload builder, ChatContext, OpenAI provider
- [x] Register ISO01 in Kim module catalog and keyword detector
- [x] Add ISO01 to clinical mode disclosure (dr peuskens)
- [x] Add ISO01 to clinical mode therapy disclosure (dr peuskens)
- [x] Implement needsFullAnalysis handling at session start (run full analysis on previous chatHistory before new greeting)
- [x] Enrich ISO01 pipeline signals from short-module-detector output (connect socialWithdrawal to actual keyword matches)
