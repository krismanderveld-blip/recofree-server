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
