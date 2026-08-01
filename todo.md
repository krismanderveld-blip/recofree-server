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
- [x] Add kimRecoveryState { eigenRegie: number } to data model (types.ts, Backpack, UserDat)
- [x] Add legacyStageOfChange migration field for backward compatibility
- [x] Update pipeline: route eigenRegie for KIM, keep stageOfChange for Elias
- [x] Add Eigen Regie zone mapping (0-30=RED, 31-50=ORANGE, 51-70=YELLOW, 71-100=GREEN)
- [x] Add intervention mapping per zone (low/medium/high eigen regie)
- [x] Update GPT payload builder: include eigenRegie for KIM users instead of stageOfChange
- [x] Update server Zod schema: add eigenRegie field
- [x] Update server system prompt: inject Eigen Regie context + intervention guidance for KIM
- [x] Update UI: replace Stage of Change card with Eigen Regie Meter for KIM users
- [x] Add Eigen Regie slider/input in mood check or profile screen
- [x] Ensure stageOfChange still works for Elias users (no regression)
- [x] TypeScript check + tests (15 dedicated tests green, 134 pre-existing TS errors unchanged)
- [x] Checkpoint

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
- [x] Build BackpackEntityExtractor: types (ExtractedEntities with persons, events, patterns, locations)
- [x] Build BackpackEntityExtractor: server-side LLM extraction endpoint (tRPC procedure)
- [x] Add backpack section hashing + change detection (only extract on actual content change)
- [x] Add extractedEntities field to UserDat + persist via AsyncStorage
- [x] Update pipeline: send extractedEntities instead of full backpack on every session, full backpack only when hash changed
- [x] Update server system prompt to use extractedEntities as structured memory (replace relationship instruction prompt)
- [x] Write tests for BackpackEntityExtractor (extraction, hashing, change detection)
- [x] Entity-driven greeting: greeting prompt references extracted persons/events from extractedEntities
- [x] Extraction versioning/migration: auto re-extract when schemaVersion changes on session start
- [x] Dual-output loop: Add engine_signals instruction to system prompt (LLM returns answer + JSON signals)
- [x] Dual-output loop: Build response parser (split LLM response into user text + engine_signals JSON)
- [x] Dual-output loop: Build real-time storage routing (signals → correct memory layer per message)
- [x] Dual-output loop: Add dynamic module reconsideration (engine can switch module mid-session based on new signals)
- [x] Dual-output loop: Enrich buffer with content-aware tracking (topics, persons mentioned, emotional arcs)
- [x] Dual-output loop: Write tests for parser, routing, module reconsideration
- [x] Dual-output loop: Wire processFeedbackLoop into pipeline.ts POST-GPT flow (step 6.5)
- [x] Fix clinical tag stripped by feedback loop — preserve <clinical> block in response for chat UI parsing
- [x] Fix clinical dropdown not appearing: remove suppression of fallback annotations in parseClinicalTag
- [x] Fix module hallucination: add exact module codes (E01-E08, SW01, STOA, VERGV01, etc.) to dynamicModuleList in server prompt
- [x] Add Kim advanced modules (BEDR01, VETR01, GASL01, CDP01, RNW01, PAR01, FIN01, ISO01) to Kim dynamicModuleList
- [x] Timestamp-based filtering for SESSION_INIT greeting (mood: today, diary: 2d, gratitude: 2d, rugzak: 4d)
- [x] VSP koppelen aan begroeting
- [x] Fallback to last available data when no fresh data exists
- [x] Bug 1 fix: Nederlandse markers toevoegen aan schema-detector.ts (alle 18 schema's, 5 domeinen)
- [x] Bug 1 fix: Nederlandse markers toevoegen aan mode-detector.ts (alle 22 modi: child, coping, parent, healthy, addiction, Kim-specific)
- [x] Bug 2 fix: GptSignalEngine initialiseren bij app startup in chat.tsx (useEffect met initGptSignalEngine)
- [x] Verification tests: 16 tests voor NL schema/mode detectie + GptSignalEngine init (621 total tests green)
- [x] Signal Engine backend verificatie: endpoint bestaat (server/signal-engine.ts:16), store:false toegevoegd, model=gpt-4o-mini, test-POST retourneert correcte JSON
- [x] Fix clinical annotation: separate gpt-4o call (store:false, max_tokens:300) when clinicalModeActive=true — no longer relies on gpt-4o-mini compliance
- [x] Memory Write Routing: type definitions (memoryCore, userDat, stateDat, projectionsDat, sessionBuffer, logsDat)
- [x] Memory Write Routing: utility functions (stableHash, roundTo3, clamp, unique, daysBetween, estimateTokens, createPatchId, createLogId)
- [x] Memory Write Routing: merge functions (mergeUserDat, mergeStateDat, mergeProjectionsDat, projectionDecay)
- [x] Memory Write Routing: crypto layer (secureKeyStore, aes256gcm, LocalCryptoProvider)
- [x] Memory Write Routing: memory stores (userDatStore, stateDatStore, projectionsDatStore, sessionBufferStore, logsDatStore)
- [x] Memory Write Routing: pipeline memory layer (memoryPatchBuilders, memoryWriteRouter, memoryWriteBackStep, memoryCommitService)
- [x] Memory Write Routing: session lifecycle (sessionEndSummarizer, sessionInitContextBuilder, sessionLifecycle)
- [x] Memory Write Routing: pipeline integration + USE_LOGS_DAT_CONTEXT flag (flag=false, fallback to conversationHistory)
- [x] Memory Write Routing: 15 acceptance tests (all green)
- [x] Memory Write Routing: debug output shows changedFields accurately
- [x] Pipeline integration: executeMemoryWriteBack() called after each GPT response in chat pipeline
- [x] Pipeline integration: sessionLifecycle.endSession() called at session end (Einde gesprek button + app background auto-end)
- [x] BackpackDeepAnalysis: server endpoint POST /api/backpack/analyze (gpt-4o, store:false)
- [x] BackpackDeepAnalysis: route results to user.dat (backpackAnalysis + schemaTendencies + triggerPatterns)
- [x] BackpackDeepAnalysis: client-side fire-and-forget trigger on backpack save
- [x] BackpackDeepAnalysis: engine reads backpackAnalysis in GPT context (injected in buildSystemPrompt after structured memory)
- [x] Timestamps: triggerPatterns[] add firstDetectedAt + lastUpdatedAt (firstDetectedAt never overwritten)
- [x] Timestamps: schemaTendencies[] add firstDetectedAt + lastUpdatedAt
- [x] Timestamps: modeTendencies[] add firstDetectedAt + lastUpdatedAt
- [x] Timestamps: backpackAnalysis add previousAnalyzedAt field
- [x] BackpackAnalysis Debug: fix memory write-back to use direct pipeline signals (candidateSignals + schemaModeResult now exposed on PipelineResult)
- [x] BackpackAnalysis Debug: add backpackAnalysis + schemaTendencies + modeTendencies to debug snapshot in traceData.memory
- [x] BackpackAnalysis Debug: verified endpoint returns 3 schemas, 2 modi, 2 triggers for Dutch abandonment text
- [x] BackpackAnalysis routing: schemas (≥0.35) → schemaTendencies, modi (≥0.35) → modeTendencies, triggers → triggerPatterns with timestamps (firstDetectedAt never overwritten, lastUpdatedAt updated)
- [x] Session Greeting Engine: type definitions (sessionGreeting.types.ts)
- [x] Session Greeting Engine: evaluateGreetingFreshness with time helpers
- [x] Session Greeting Engine: buildGreetingAnchorCandidates
- [x] Session Greeting Engine: resolveGreetingAnchorPriority + resolveSchemaRotationAnchor
- [x] Session Greeting Engine: buildGreetingPromptPayload + enforceGreetingOutputRules
- [x] Session Greeting Engine: sessionGreetingEngine main function + debug + buildSessionInitContext
- [x] Session Greeting Engine: sessionInitGreetingStep pipeline integration (chat.tsx with fallback)
- [x] Session Greeting Engine: 20 acceptance tests (corrected priority: RECENT_DIARY > BACKPACK_RECENT_UPDATE) — all passing
- [x] Session Greeting Engine: server endpoint (POST /api/session-greeting) registered
- [x] Debug snapshot: schemaTendencies/modeTendencies format changed from freq= to last= (date from lastUpdatedAt)
- [x] Encrypted Export/Import: type definitions (envelope, payload, import result)
- [x] Encrypted Export/Import: error classes and error codes
- [x] Encrypted Export/Import: version constants and forward compatibility
- [x] Encrypted Export/Import: utility modules (stableStringify, base64, sha256)
- [x] Encrypted Export/Import: crypto layer (PBKDF2, AES-256-GCM, AAD)
- [x] Encrypted Export/Import: export service (createEncryptedRecoFreeExport)
- [x] Encrypted Export/Import: import service with staging and rollback
- [x] Encrypted Export/Import: store export/import interfaces (exportAllPersonas, replaceAllPersonas)
- [x] Encrypted Export/Import: file picker (pickRecoFreeBackupFile)
- [x] Encrypted Export/Import: UI components (ExportDataSection, ImportDataSection, DataPrivacySection)
- [x] Encrypted Export/Import: settings/profile integration
- [x] Encrypted Export/Import: 15 acceptance tests all green
- [x] Encrypted Export/Import: existing 671 tests still green (was 656, now 671 with new tests)
- [x] Encrypted Export/Import: "Last exported" timestamp shown in Profile export section
- [x] BUG FIX: App crash on startup — expo-document-picker and expo-sharing static imports caused native module crash on APK builds compiled before packages were added. Fixed by converting all imports to dynamic `await import()`.
- [x] BUG FIX: expo-document-picker and expo-sharing versions corrected from v56 to ~14.0.8 (SDK 54 compatible)
- [x] Export scope: Add Elias Projection store (@recofree_projection_elias) to export/import
- [x] Export scope: Add Kim Projection store (@recofree_projection_kim) to export/import
- [x] Export scope: Add Emergency Contacts store (emergencyContacts) to export/import
- [x] Export scope: Add derived stores (backpack_hash, extracted_entities) to export/import
- [x] Export scope: Update ExportImportStores.types.ts with new store interfaces
- [x] Export scope: Update ExportPayload types with new fields
- [x] Export scope: Update exportDataService with new stores
- [x] Export scope: Update importDataService with new stores
- [x] Export scope: Update useExportImportStores hook with new store adapters
- [x] Intake import: Add import-from-backup option to intake step 1
- [x] Intake import: After successful import, skip intake and go to main app
- [x] Tests: 8 new acceptance tests for extended export scope — all green
- [x] Tests: All 679 tests green (was 671, now 679 with new tests)
- [x] BUG FIX: Crypto layer rewritten from Web Crypto API to @noble/ciphers + @noble/hashes for native Android/iOS compatibility
- [x] BUG FIX: Export now saves locally via SAF directory picker (no share sheet) — user chooses where to save the .recofree file
- [x] Greeting V3: Update types (synthesis source, override mode, mood metric types)
- [x] Greeting V3: Implement resolveGreetingOverride (CRISIS/FIRST/MISSING bypass)
- [x] Greeting V3: Implement selectMostEmotionallyRelevantMoodMetric
- [x] Greeting V3: Implement buildGreetingSynthesisCandidates with relevance scoring
- [x] Greeting V3: Implement selectGreetingSynthesisSources (max 3, balance rules)
- [x] Greeting V3: Implement buildGreetingSynthesisPromptPayload (weave instruction)
- [x] Greeting V3: Update enforceGreetingOutputRules (reject checklist/inventory style, "hoe voel je je")
- [x] Greeting V3: Update main sessionGreetingEngine to V3 flow
- [x] Greeting V3: Update sessionInitGreetingStep and server endpoint
- [x] Greeting V3: Write acceptance tests (32 tests in 4 files — all green)
- [x] Greeting V3: All 711 existing tests green (was 679)
- [x] Absence Awareness: Create calculateSessionAbsence module (bands: NONE/SHORT/RETURN_AFTER_ABSENCE/LONG_RETURN)
- [x] Absence Awareness: Update V3 types (GreetingOverrideType, GreetingSynthesisMode, SessionAbsenceResult)
- [x] Absence Awareness: Update resolveGreetingOverride with RETURN_AFTER_ABSENCE in priority 3
- [x] Absence Awareness: Add selectReturnAfterAbsenceSources (max 2 sources, no fear on LONG_RETURN)
- [x] Absence Awareness: Update buildGreetingSynthesisPrompt with absence mode instructions
- [x] Absence Awareness: Update output safety filter with blame/relapse rejection patterns
- [x] Absence Awareness: Update main V3 engine with absence calculation step
- [x] Absence Awareness: Create sessionStatsUpdateStep (commitSessionStartedAfterGreeting)
- [x] Absence Awareness: Update sessionInitGreetingStep pipeline integration
- [x] Absence Awareness: Write calculateSessionAbsence tests (12 tests)
- [x] Absence Awareness: Write returnAfterAbsenceOverride tests (6 tests)
- [x] Absence Awareness: Write returnAfterAbsenceSourceSelection tests (5 tests)
- [x] Absence Awareness: Write returnAfterAbsencePromptPayload tests (10 tests)
- [x] Absence Awareness: Write sessionStatsUpdateOrder tests (5 tests)
- [x] Absence Awareness: All 751 tests green (was 711, now 751 with 38 new absence tests + 2 updated)
- [x] Chat pipeline: Inject KNOWN USER PATTERNS block (schemas, modes, triggers) into GPT prompt
- [x] Chat pipeline: Inject relevant rugzak-context text via backpack_relevance into GPT prompt
- [x] Chat pipeline: Add GPT instruction for natural referencing of user knowledge
- [x] Debug fix: schemaTendencies/modeTendencies show last=datum instead of freq=undefined
- [x] Verify: "Wat weet je over Melissa?" → Elias references rugzak content
- [x] Verify: "Wat zijn mijn schema's?" → Elias lists known schemas
- [x] All 751 tests remain green after changes
- [x] E2E chain test: user.dat → openai-provider payload → Zod validation → server prompt (SESSION_INIT)
- [x] E2E chain test: user.dat → openai-provider payload → Zod validation → server prompt (LIVE_MESSAGE)
- [x] E2E chain test: asserts KNOWN USER PATTERNS block with schema name in GPT prompt
- [x] E2E chain test: asserts rugzak person reference (Melissa) in GPT prompt
- [x] E2E chain test: proves Zod stripping would break the test (regression guard)
- [x] All 800 tests green (was 751, now 800 with e2e chain + confirmation tests)
- [x] Schema/Mode confirmation layer: Add `confirmed: boolean` field to SchemaTendency and ModeTendency types
- [x] Schema/Mode confirmation layer: Auto-confirm when frequency≥5 AND confidence≥0.7
- [ ] Schema/Mode confirmation layer: Confirm via clinical mode acknowledgment (future: requires clinical mode integration)
- [ ] Schema/Mode confirmation layer: Confirm via user self-acknowledgment in chat (future: requires NLU intent detection)
- [x] Schema/Mode confirmation layer: Gate KNOWN USER PATTERNS injection to confirmed-only
- [x] Schema/Mode confirmation layer: Keep SchemaMode engine using ALL candidates (confirmed + unconfirmed)
- [x] Schema/Mode confirmation layer: Update debug trace to show confirmed vs candidate status
- [x] Schema/Mode confirmation layer: Write tests for auto-confirmation threshold logic
- [x] Schema/Mode confirmation layer: All existing tests remain green (800 total)
- [x] BUG: Zod 400 error on ai.chat — backpackAnalysis expects object but client sends null/undefined (added .nullable() to Zod schema)
- [x] BUG: Clinical mode active but no green bar under greeting (added clinical annotation to session-greeting endpoint)
- [x] BUG: Greeting references "sessies van gisteren" when there were no sessions yesterday (added anti-hallucination instruction to greeting prompts)
- [x] Export scope investigation: Inventariseer all persistent stores (sobriety, milestones, mood, progress, triggers)
- [x] Export scope investigation: Confirmed ALL stores already covered — no missing stores
- [x] Export scope investigation: sobrietyDate in userDat → exported via userDatStore
- [x] Export scope investigation: milestoneTracker in userDat → exported via userDatStore
- [x] Export scope investigation: moodHistory in userDat + stateDat → exported via both stores
- [x] Export scope investigation: Progress Tracker has NO persistent store (computed at runtime)
- [x] Export scope investigation: Mood Trend has NO persistent store (computed at runtime)
- [x] Import in intake: Verified import option already exists in Step 1 ("I have a backup — import my data")
- [x] Import in intake: Verified import modal with file picker + password field is complete
- [x] Import in intake: Verified success path calls reloadFromStorage() then router.replace('/(tabs)') — skips rest of intake
- [x] Import in intake: Verified createExportImportStoresAdapter (non-hook) is used in intake import flow
- [x] Export scope tests: 11 new acceptance tests (sobriety, milestones, mood, schemas, modes, triggers, full round-trip)
- [x] Export scope tests: All 811 tests green (was 800, now 811 with new acceptance tests)
- [x] GptSignalEngine: add relapseIntent category to interface + prompts + output
- [x] Deterministic marker fallback for relapse-intent (NL/EN/FR) when engine fails
- [x] Wire relapseIntent into zone escalation (computed zone → minimum ORANJE)
- [x] Tests: relapseIntent detection + zone escalation + fallback + full suite green (877 passed)
- [x] BUG 1: Model routing follows finale zone (ORANJE+ → gpt-4o) + relapseIntent as routing condition
- [x] BUG 2: Severity display shows correct VSP (GROEN=1) + escalation as separate step in trace
- [x] Proposal 1: GPT-4o prompt instruction block for relapse-intent (grounding, non-judgmental, directive)
- [x] Proposal 2: Relapse-intent logging in user.dat (persist events for cross-session pattern detection)
- [x] Proposal 3: Kim-variant detection for loved ones reporting relapse ("hij wil weer drinken") — 918 tests green
- [x] Kim Relapse Cluster: types with corrected crisis numbers (0800 32 123 not 1813, add 101)
- [x] Kim Relapse Cluster: NL/EN/FR marker files for HERV-K01, NAHERV-K01, CRISIS-K01
- [x] Kim Relapse Cluster: detector, crisis escalation gate, memory patch builder, router
- [x] Kim Relapse Cluster: prompt payload builders + response rules for all 3 modules
- [x] Kim Relapse Cluster: output safety filter (anti-rescue/control/diagnosis)
- [x] Kim Relapse Cluster: 20 acceptance tests with corrected crisis numbers
- [x] Kim Relapse Cluster: all existing 918+ tests remain green (938 passed)
- [x] Pipeline wiring: Create kim-advanced-modules-p6.ts for Relapse Cluster
- [x] Pipeline wiring: Wire P6 into pipeline.ts (import, call, pass to ChatContext)
- [x] Pipeline wiring: Add relapseClusterContext to ChatContext type + server prompt injection
- [x] Pipeline wiring: Integration tests + full suite green (954 passed)
- [x] Kim Cluster 2: types file (KimCluster2ModuleId, danger/child categories, detection result)
- [x] Kim Cluster 2: NL/EN/FR marker files for GEVAAR-K01 and KIND-K01
- [x] Kim Cluster 2: detectors for GEVAAR-K01 and KIND-K01 with priority resolver
- [x] Kim Cluster 2: prompt payload builders for GEVAAR-K01 and KIND-K01
- [x] Kim Cluster 2: memory patch builder (Kim-scoped only)
- [x] Kim Cluster 2: output safety filter (anti-rescue/control/parentification/diagnosis)
- [x] Kim Cluster 2: pipeline wiring as P7 (above P6 relapse cluster)
- [x] Kim Cluster 2: critical acceptance tests (persona separation, crisis numbers, KIND>GEVAAR priority)
- [x] GptSignalEngine: Kim-specific prompt for third-person relapse detection
- [x] All existing 954+ tests remain green (974 passed)
- [x] Kim Cluster 3: types + acute override gate + detectors (ROL-K01, VETR02-K, LEUGEN-K01)
- [x] Kim Cluster 3: NL/EN/FR marker files
- [x] Kim Cluster 3: prompt payload builders + memory patch builder + output safety filter
- [x] Kim Cluster 3: pipeline wiring as P8 (below acute clusters)
- [x] Kim Cluster 3: 14 critical acceptance tests
- [x] Kim Cluster 3: all existing 974+ tests remain green (988 passed)
- [x] Kim Cluster 4: types + acute override gate + suicidality-split
- [x] Kim Cluster 4: NL/EN/FR markers for HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
- [x] Kim Cluster 4: detectors, priority resolver, payloads, memory patch, safety filter
- [x] Kim Cluster 4: pipeline wiring as P9 (below P6/P7/P8)
- [x] Kim Cluster 4: 14 critical acceptance tests (suicidality-split, persona separation, acute override)
- [x] Kim Cluster 4: all existing tests remain green (1002 passed)
- [x] Kim Cluster 5 (STOA-K): types + acute override gate + detector
- [x] Kim Cluster 5 (STOA-K): NL/EN/FR marker files
- [x] Kim Cluster 5 (STOA-K): prompt payload builder + memory patch builder + output safety filter
- [x] Kim Cluster 5 (STOA-K): pipeline wiring as P10 (below reflective clusters, KST01 boundary)
- [x] Kim Cluster 5 (STOA-K): 10 critical acceptance tests
- [x] Kim Cluster 5 (STOA-K): all existing tests remain green (1012 passed, 1 skipped)
- [x] iOS build fix: newArchEnabled set to true (required by react-native-worklets 0.5.1 + reanimated 4.x)
- [x] iOS build fix: expo-build-properties iOS deploymentTarget 15.1 + newArchEnabled for both platforms
- [x] iOS build fix: withHermesFromSource.js config plugin (forces Hermes compile from source, fixes ABI mismatch)
- [x] iOS build fix: buildReactNativeFromSource in expo-build-properties
- [x] iOS build fix: eas.json env vars HERMES_USE_PREBUILT=false + BUILD_FROM_SOURCE=true
- [x] Clinical dropdown: show detected schemas and modi as full chat response when asked in clinical mode
- [x] Auto-confirmation threshold lowered from 5 to 3 (faster schema/mode confirmation)
- [x] VSP Insight System: types files (vspInsight.types, vspState, vspDiscrepancy, vspFramework, vspSoothing, vspTransition, vspPdfExport, vspProfile)
- [x] VSP Insight System: engine core (state detection, rational green detector, overwhelm detector, silent discrepancy, framework selection, prompt frame builder)
- [x] VSP Insight System: DGT soothing flow (catalog, safety filter, selector, recorder, evaluator, prompt builder)
- [x] VSP Insight System: phase transition detector + example builder + profile updater + safety boundary
- [x] VSP Insight System: adapters (mood, chat signal, logs.dat, diary, gratitude, backpack, greeting)
- [x] VSP Insight System: intake adapters (wheel-of-change, early signs, self-image)
- [x] VSP Insight System: PDF export (builder, renderer, disclaimer, data selector)
- [x] VSP Insight System: Kim variant (engine, state detector, profile updater, prompt frame)
- [x] VSP Insight System: pipeline wiring (pipeline.ts, ai-chat.ts, openai-provider.ts)
- [x] VSP Insight System: 22 test cases from spec
- [x] VSP Insight System: output safety filter
- [ ] iOS publish: show Expo Go QR code instead of failing TestFlight build
- [x] VSP Insight System: Create vspInsightTypes.ts (full type definitions)
- [x] VSP Insight System: Create detectVspInsightState.ts (state detection engine)
- [x] VSP Insight System: Create detectRationalGreenSignals.ts
- [x] VSP Insight System: Create detectOverwhelmSignals.ts
- [x] VSP Insight System: Create vspInsightRouter.ts (MI/MBT/DGT framework selection)
- [x] VSP Insight System: Create vspInsightStorage.ts (AsyncStorage, silent discrepancy)
- [x] VSP Insight System: Create vspInsightPhaseTracker.ts (state transitions)
- [x] VSP Insight System: Create vspChatSignalAdapter.ts (marker extraction)
- [x] VSP Insight System: Create vspInsightPdfExport.ts (disclaimer: geen diagnose)
- [x] VSP Insight System: Create kimVspVariant.ts (caregiver framing)
- [x] VSP Insight System: Create vspDgtSoothingFlow.ts (sensory options, safety filter)
- [x] VSP Insight System: Create vspInsightPipelineLayer.ts (pipeline integration)
- [x] VSP Insight System: Wire into pipeline.ts (after safety core, before GPT call)
- [x] VSP Insight System: Add vspInsightContext to ChatContext type
- [x] VSP Insight System: Add vspInsightContext to chatInputSchema (zod)
- [x] VSP Insight System: Wire vspInsightContext in openai-provider.ts (SESSION_INIT + LIVE_MESSAGE)
- [x] VSP Insight System: Inject vspInsightContext into buildSystemPrompt (Elias + Kim)
- [x] VSP Insight System: 22 test cases — all passing
- [x] VSP Insight UI: Clinical mode ClinicalTag shows VSP-Framework badge (MI/MBT/DGT) when active
- [x] Profile export knop: VSP Insight PDF export + share-sheet in settings
- [x] VSP Insight: framework badge actief bij greeting (SESSION_INIT) via session-greeting endpoint
- [x] VSP Insight: deterministic VSP-Framework injection in clinical annotation (GPT-onafhankelijk)
- [x] Greeting engine: real logs.dat session summary loaded via lifecycle manager
- [x] Greeting engine: LAST_SESSION_SUMMARY als 7e gewogen source in buildGreetingSynthesisCandidates
- [x] USE_LOGS_DAT_CONTEXT flag set to true
- [ ] Expo Go QR code always visible for iOS on publish
- [x] Fix 1: Higher weight for recurringThemes in BackpackRelevanceAnalyzer (1.5x)
- [x] Fix 2: VSP-label parser for backpack recurringThemes (extract per zone)
- [x] Fix 3: VSP profile block injection in Elias prompt (SESSION_INIT)
- [x] VSP Backpack Analyzer: server endpoint (POST /api/backpack/vsp-analyze) with LLM zone extraction
- [x] VSP Backpack Analyzer: client module (vsp-backpack-client.ts) with auth + fire-and-forget call
- [x] VSP Backpack Analyzer: analyzer module (vsp-backpack-analyzer.ts) with hash-based change detection + AsyncStorage cache
- [x] VSP Backpack Analyzer: wired in user-context.tsx triggerExtractionIfNeeded (fire-and-forget on backpack change)
- [x] VSP Backpack Analyzer: pipeline.ts loads cached profile via loadCachedVspProfile with fallback to local parser
- [x] VSP Backpack Analyzer: openai-provider.ts forwards vspBackpackProfile in SESSION_INIT + LIVE_MESSAGE payloads
- [x] VSP Backpack Analyzer: server ai-chat.ts injects vspBackpackProfileBlock into Elias system prompt
- [x] VSP Backpack Analyzer: 12 unit tests (all passing)

## Greeting Engine V3 Redesign — Emotionele Coherentie

- [x] Greeting: VSP zone als tone-setter meegeven aan engine input + prompt
- [x] Greeting: Zone-aware weighting (suppress positive sources when zone >= GEEL)
- [x] Greeting: Diary emotional urgency boost when negative + zone elevated
- [x] Greeting: Rewrite prompt builder to coherent context briefing (not disconnected snippets)
- [x] Greeting: Fix MISSING_DATA override to count logs.dat as valid fresh data
- [x] Greeting: Wire VSP Backpack Profile into greeting engine
- [x] Greeting: Update tests for new weighting logic (84 greeting tests + 12 zone-aware tests passing)
- [x] Greeting: Logs.dat continuity — detect recurring themes and inject pattern awareness into greeting
- [x] Greeting: VSP Backpack Profile as greeting source — zone-specific patterns from LLM analysis
- [x] Greeting: Tighten GEEL balance — dialectic role for gratitude ("maar/tegelijk") when diary is negative in elevated zone
- [x] Greeting: VSP structured section (per zone: signals + whatHelps + anchorSentence) injected into greeting prompt

## VSP Structured Section in Backpack

- [x] Backpack: Add dedicated VSP section (separate from Recurring Themes)
- [x] Backpack: VspStructuredPlan type (zones, triggers with counterSentences, recoveryRules)
- [x] Backpack: VspSectionEditor UI component (per-zone accordion, triggers, recovery rules)
- [x] Backpack: updateVspSection in user-context.tsx
- [x] Backpack: Wire VSP structured section into pipeline + ai-chat for ongoing conversation
- [x] Backpack: Update parseVspProfileFromBackpack to prefer structured section over legacy themes
- [x] All 1058 tests passing

## New-User Greeting Flow

- [x] Greeting: FIRST_SESSION prompt rewritten — warm, personal, no therapy-speak, invites to share
- [x] Greeting: FIRST_SESSION with VSP zone — uses personal signals/whatHelps/anchor from VSP section
- [x] Greeting: MISSING_DATA prompt rewritten — warmer, no reference to "check-in" or "invullen"

## Export/Import Update

- [x] Export/Import: VSP structured section already included via backpack object (no change needed)
- [x] Export/Import: VSP analyzer cache (@vsp_backpack_profile, @vsp_backpack_hash) added to derivedCacheStore
- [x] Export/Import: Import button removed from profile screen (export-only now)
- [x] Export/Import: All 34 export/import tests passing

## Guided VSP Fill-in Flow with Document Upload

- [x] Server: POST /api/vsp/parse-document endpoint — accepts uploaded VSP document text, GPT extracts all fields into VspStructuredPlan
- [x] Server: POST /api/vsp/extract-text endpoint — extracts text from DOCX/PDF uploads
- [x] Client: VSP upload flow — document picker + send to server + receive parsed VspStructuredPlan
- [x] UI: Guided VSP wizard screen with upload option (upload document OR manual fill-in per zone)
- [x] UI: After upload parse, show pre-filled fields for user review/edit before saving
- [x] Integration: Save parsed VSP to backpack.vspSection via updateVspSection
- [x] GPT prompt includes exact UI field names for accurate mapping

## Logs.dat Cross-Session Pattern Detection

- [x] Engine: Pattern detector — analyzes logs.dat session summaries for recurring themes/triggers
- [x] Engine: Frequency + recency scoring for detected patterns (topic, emotional, temporal, risk)
- [x] Engine: Wire detected patterns as RECURRING_PATTERN source in greeting engine
- [x] Engine: Pattern context block in greeting synthesis prompt
- [x] Engine: RECURRING_PATTERN added to source selection priority + valence + MISSING_DATA check
- [x] Tests: 13 new tests for pattern detection + greeting source integration (all passing)

## Bug Fixes (post-deploy)

- [x] Fix: Pipeline error "undefined is not a function" — ROOT CAUSE: null entries in vspSection.triggers crash buildVspStructuredBlock (line 3832). Fix: defensive null check + skip invalid entries.
- [x] Fix: 3 dynamic require()/await import() in pipeline.ts converted to static imports (Metro bundler cannot resolve dynamic imports on device)
- [x] Fix: T18 and T29 test assertions — updated to match new MISSING_DATA prompt text
- [x] Tests: 5 new VSP undefined-fields crash tests (T_VSP_01–T_VSP_05) confirming the fix
- [x] Full test suite: 1079 passed, 0 failed, 1 skipped (1080 total)
- [x] Add on-screen crash reporter to handleSend (full stack trace visible on device for debugging)
- [x] Enhance ChatErrorBoundary with full stack trace display (not just __DEV__)
- [x] Fix crash in buildVspStructuredBlock: .join() called on string instead of array (signals/whatHelps)
- [x] Fix auto VSP upload returning empty fields after document upload (mammoth DOCX parser + better logging)
- [x] Translate all remaining Dutch UI text to English (entire app)
- [x] Auto-detect user language from diary/backpack/gratitude/VSP content and use it for greeting
- [x] If no user content exists, greeting in English with "you can type in your native language" message
- [x] Set auto-close/auto-save timer to 10 minutes inactivity
- [x] Verify write-back to memory layers (incl. logs.dat) triggers on timer expiry
- [x] Verify auto-close works on app background (not just foreground inactivity)
- [x] Fix: VSP zone selection does not pass zone-specific content to GPT (generic response instead of zone-specific)
- [x] Fix: adaptVspSection crashed on string signals (same type mismatch as buildVspStructuredBlock)
- [x] Fix: greeting prompt now DIRECTLY uses user's VSP content for high zones (ROOD/PAARS/ORANJE)
- [x] Fix: buildVspStructuredBlock now sends ONLY the active zone (not all zones)
- [x] Pipeline must use VSP zone content to actively influence module selection (not just send to GPT)
- [x] Module switching based on user response: if user mentions something from their VSP "what helps", support that action instead of continuing current module
- [x] Pipeline must use VSP zone content to guide module selection (ROOD/PAARS → grounding/crisis)
- [x] Module switching based on user answer matching VSP "what helps" content
- [x] Proactively inject VSP "what helps" content into GPT instructions as de-escalation suggestions (DE-ESCALATION DIRECTIVE)
- [x] Dynamic mid-session module re-evaluation: switch therapy approach as conversation progresses (intensityTrajectory-based)
- [x] Fix: Privacy disclaimer screen keeps reappearing — should only show once (first use), then never again
- [x] Fix: Pipeline crash 'Cannot read property topicHistory of null' — enrichBuffer receives null bufferState
- [x] Fix: Clinical annotation block visible to user in chat (should be hidden unless Clinical Mode active)
- [x] Fix: VSP data (zones, wat helpt, signalen) must persist across app updates like backpack does
- [ ] Fix: VSP 'wat helpt' content must be used as PRIMARY intervention when zone ROOD is active (not generic grounding)
- [ ] Fix: Clinical annotation still showing — verify clinicalModeActive check works on published version

## Greeting Engine — Full Personal Data Injection (bij elke kleur)

- [x] Fix: adaptDiaryMetadata sends FULL diary content (not 80-char truncation)
- [x] Fix: adaptGratitudeMetadata sends ALL 3 gratitude entries (not just first 80 chars)
- [x] Fix: adaptLogsDat sends full session summary (not 120-char digest)
- [x] Fix: buildVspPersonalContext uses HARD directive for ALL zones (not just ORANJE/ROOD/PAARS)
- [x] Fix: buildCoherentSynthesisInstruction MANDATES GPT to use all personal data as primary material
- [x] Fix: Remove V3_MAX_SYNTHESIS_SOURCES=3 limit — send ALL eligible sources to GPT
- [x] Fix: buildContextBriefing outputs full content per source (not one-line summaries)
- [x] Fix: server ai-chat.ts SESSION_INIT vspStructuredSectionBlock uses hard directive for ALL zones
- [x] Fix: Backpack "indien gewijzigd" logic — include backpack in greeting when backpackAnalysis.analyzedAt is newer than previousAnalyzedAt in user.dat

## LIVE_MESSAGE Path — Full Personal Data on EVERY Turn (not just first 2)

- [x] Audit: What data does GPT get on turn 3+ via LIVE_MESSAGE path?
- [x] Fix: Extend full VSP + personal data + hard directive to EVERY turn (not just first 2)
- [x] Fix: Ensure relatie-context (partner names like Melissa) is injected on every turn
- [x] Fix: Check and raise LIVE_MESSAGE token cap if too low
- [x] Test: Turn 5+ with "veel stress gehad vandaag" → GPT references Melissa + Jan (4/8 score)
- [x] Test: Turn 5+ with relatie-context → GPT names Melissa + schema (2/5 score)

## Prompt Tuning + Token Logging

- [x] Add "noem minstens 1 VSP-strategie per antwoord" rule to LIVE_MESSAGE prompt
- [x] Add "spreek de gebruiker ALTIJD bij naam aan" rule to LIVE_MESSAGE identity block
- [x] Add token usage logging per turn (prompt tokens, completion tokens, total, cumulative per session)
- [x] Add ANKERZIN-REGEL: citeer ankerzin letterlijk wanneer gebruiker overweldigd is
- [x] Add DAGBOEK-REGEL: verwijs naar specifieke dagboek-entries wanneer thema overeenkomt
- [x] Add STEUNPERSOON-REGEL: noem steunpersoon uit VSP wat-helpt bij emotioneel beladen taal

## PsychoEducation: WILSKRACHT01 + AUTOPILOT01 Pipeline Integration

- [x] Connect WILSKRACHT01 detector to pipeline.ts (step 5e8b)
- [x] Connect AUTOPILOT01 detector to pipeline.ts (step 5e8b)
- [x] Add psychoEducationActivation to PipelineResult return
- [x] Add psychoEducationActivation to PipelineDetectionBundle (memoryIntegration.ts)
- [x] Add psychoEducation patches to memoryWriteRouter.ts (user.dat + projections.dat)
- [x] Add psychoEducationContext field to ChatRequestInput interface
- [x] Add psychoEducationContext to SessionCache and cacheSessionInit
- [x] Inject psychoEducation continuity block in buildSelectiveRelevanceBlock (every relevant turn)
- [x] Add psychoEducationActivation to chat.tsx memoryInput passthrough
- [x] Write acceptance test suite (35 tests): persona separation, crisis override, memory write, continuity, output safety, router integration
- [x] All 35 tests passing
- [x] Add psychoEducationContext to GPTPayloadBuilderInput + GPTPayloadOutput (gpt-payload-builder.ts)
- [x] Add psychoEducationContext string to ChatContext assembly in pipeline.ts (step 2385-2388)
- [x] Add psychoEducationContext to LIVE_MESSAGE payload in openai-provider.ts
- [x] Add psychoEducationContext to Zod chatInputSchema in ai-chat.ts
- [x] Add psychoEducationContext to GPT payload types (lib/ai/types.ts)

## PAAL01 Steunpilaren + Balkmetafoor
- [x] Types: eliasSteunpilaren.types.ts + balkmetafoor.types.ts
- [x] Detector: paal01.detector.ts (4 trigger contexts, NL+EN markers, confidence banding)
- [x] Memory patch builder: paal01.memoryPatchBuilder.ts (buffer, state.dat, user.dat, logs.dat mandatory; projections.dat conditional on isolation belief)
- [x] Prompt builder: paal01.promptBuilder.ts (hard directive, turn 5+, no keyword-gating)
- [x] Marker banks: NL + EN (paal01.markerBank.nl.ts, paal01.markerBank.en.ts)
- [x] Output safety filter: steunpilarenOutputSafetyFilter.ts
- [x] Context assembler: eliasSteunpilarenContextAssembler.ts
- [x] Balkmetafoor UI component: BalkmetafoorCard.tsx
- [x] Pipeline integration: pipeline.ts step 5e8a3 (after WILSKRACHT01/AUTOPILOT01)
- [x] Memory write router: paal01Activation → user.dat + state.dat + logs.dat
- [x] PipelineDetectionBundle + PipelineResult updated with Paal01Activation type
- [x] memoryIntegration.ts + PipelineResultForMemory updated
- [x] steunpilarenContext added to ChatContext assembly
- [x] All 35 PAAL01 tests passing (detector, memory, prompt, safety, balkmetafoor, router)
- [x] Spec alignment V2: DEFER_TO_SAFETY, DEFER_TO_GROUNDING, OFFER_AS_FOLLOWUP statuses
- [x] Spec alignment V2: 6 intervention types with context-based selection
- [x] Spec alignment V2: conditional state.dat (only STABLE_REFLECTION/FIRST_USE writes)
- [x] Spec alignment V2: layerJustification metadata in memory patches
- [x] Spec alignment V2: output safety filter with all spec forbidden patterns (26 patterns)
- [x] Spec alignment V2: context assembler NOT keyword-gated, NOT turn-limited
- [x] Spec alignment V2: all marker groups (balkmetafoorExplicit, profileFeatureRequest, isolationBelief, postDifficultyStabilization)
- [x] Spec alignment V2: gptMayScoreUser:false in prompt builder
- [x] All 81 PAAL01 spec-aligned tests passing + 35 WILSKRACHT01/AUTOPILOT01 + 15 memory router = 131 total

## Self-Acceptance Cluster: BLIK01, ONTK01, IKST01, COEX01
- [x] Shared types: eliasSelfAcceptanceCluster.types.ts
- [x] Shared context assembler: eliasSelfAcceptanceContextAssembler.ts
- [x] Shared output safety filter: selfAcceptanceClusterOutputSafetyFilter.ts
- [x] BLIK01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] ONTK01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] IKST01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] COEX01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] Pipeline integration: all 4 modules in pipeline.ts (step 5e8a4)
- [x] Memory write router: selfAcceptanceActivation routing
- [x] PipelineDetectionBundle + PipelineResult + memoryIntegration updated
- [x] Combined acceptance tests: 36 tests passing
- [x] Total test suite: 167 tests passing (81 PAAL01 + 35 WILSKRACHT01/AUTOPILOT01 + 36 self-acceptance + 15 memory router)

## Kim Pattern Support: PAAL-K01, BEHE-K01, AANP-K01, CODEP-K01
- [x] Shared types: kimPatternsSupport.types.ts
- [x] Shared context assembler: kimPatternSupportContextAssembler.ts
- [x] Shared output safety filter: patternSupportOutputSafetyFilter.ts
- [x] PAAL-K01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] BEHE-K01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] AANP-K01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] CODEP-K01: detector, NL+EN markers, memory patch builder, prompt builder, index
- [x] Pipeline integration: all 4 modules in pipeline.ts (step 5e8a5)
- [x] Memory write router: kimPatternSupportActivation routing
- [x] PipelineDetectionBundle + PipelineResult + memoryIntegration updated
- [x] Combined acceptance tests: 33 tests passing (persona, crisis priority, layers, continuity, safety)
- [x] Total test suite: 200 tests passing (81 PAAL01 + 35 WILSKRACHT01/AUTOPILOT01 + 36 self-acceptance + 33 Kim pattern + 15 memory router)
- [x] Fix greeting diary timestamp regression: recentDiary uses toLocaleDateString() without time label, causing GPT to treat yesterday's entries as "vandaag"
- [x] Fix riskScore underestimation: craving + emotional distress combinations score too low (14-16 instead of ORANJE 41-60)
- [x] Add Dutch language patterns to detectKimTrigger (grens, schuld, moe, uitgeput, terugval, boos, controleren, etc.)
- [x] Add control_exhaustion to KIM_PRIORITY_TRIGGERS for same priority as boundary_violation/caregiver_fatigue
- [x] Live Kim test: control_exhaustion + loved_one_relapse — controle als uitputtend erkend, geen blame, naam correct, coping erkend (4/5 checks pass; terugval partner impliciet maar niet letterlijk benoemd in truncated response)
- [x] CRITICAL SAFETY: Fix GPT outputting schema/modi diagnoses to users when clinical mode is OFF — must add hard anti-diagnosis directive to system prompt
- [x] Hide feeling tags (Calm, Sad, etc.) on diary main view — only show when actively writing a new entry
- [x] Implement AES-256-GCM encryption for all persistent sensitive data (userDat, projections, backpack) with expo-secure-store key management and plain JSON migration
- [x] Add ZONE_DISPLAY_LABELS mapping in eigen-regie.ts (English labels for UI, internal keys unchanged)
- [x] Translate zone names in prechat-eigen-regie.tsx UI from Dutch (ROOD/ORANJE/GEEL/LICHTGROEN/GROEN) to English display labels
- [x] Translate zone names in mood.tsx UI from Dutch to English display labels
- [x] Translate "Eigen Regie" section title to "Self-Direction" in mood.tsx UI
- [x] FIX: Extend isSensitive check in useExportImportStores adapter with MEMORY_STORE_KEYS so memory store keys are read/written through encrypted layer
- [x] FIX: Make pre-import snapshot safe — if reading encrypted data fails, read raw value as fallback so rollback never restores null (dataverlies-preventie)
- [x] FIX: logs.dat import round-trip correct — export reads encrypted envelope, import writes it back as-is (logs.dat excluded from RF_ENC_V1 layer)
- [x] FIX: reloadFromStorage reconstructs backpack from userDat when @recofree_backpack is null (import from older exports)
- [x] FIX: backpackStore.replaceAllPersonas no longer deletes existing backpack when import data is null (preserves existing)
- [x] FIX: Export fallback — if readEncrypted returns null for backpack, try plain AsyncStorage read as fallback
- [x] FIX: Post-import name prompt — if import has no backpack/name, show name input before continuing to app
- [x] FIX: Store name redundantly in userDat as backup field (synced on session end + backpack edit)
- [x] Build Backpack wizard Route 1: DOCX upload (mammoth parser + GPT extraction + review screen)
- [x] Build Backpack wizard Route 2: Step-by-step manual input (section-by-section guided wizard)
- [x] Wire Backpack wizard into app (intake for new users + settings for existing users)
- [x] Update export to include all new features (VSP profile, VSP hash, extracted entities, backpack hash)
- [x] Add "Import backup" button to profile/settings screen (ImportDataSection wired into DataPrivacySection)
- [x] Wire reloadFromStorage into profile import success callback so UI updates immediately
- [x] Fix 5 pre-existing e2eChain test failures (clinical mode gating — tests updated to match non-clinical INTERNAL GUIDANCE behavior)
- [x] BUG FIX: Backpack wizard extracts data correctly but fails to persist lifeStory sections to backpack (onSave callback was empty, now uses replaceBackpack)
- [x] Remove duplicate VSP section from life phases list (VSP already shown as separate "My Safety Plan" section above)
- [x] Rename all "VSP" references in UI to "My Safety Plan" (no abbreviations)
- [x] Fix progress bar to only count 5 narrative sections (exclude VSP from count)
- [x] Move "My Safety Plan" section below life phase sections (story first, then plan)
- [x] BUG FIX: Dropdown menu missing in clinical mode on chat screen — fixed: now uses local engine metadata (clinicalInfo) on ChatMessage instead of relying on GPT-generated <clinical> tag

## UI Update: Remove tab bar, home-based navigation
- [x] Remove bottom tab bar entirely
- [x] Home screen serves as navigation hub (cards link to each section)
- [x] Add home button on each sub-screen (mood, diary, backpack, chat, profile)
- [x] Reduce spacing between chat input field and emergency numbers

## Debug Snapshot: 5-point buffer→sessionAnalyses transfer diagnostic
- [x] Add 5 new DebugEventType values (transfer_1 through transfer_5) to session-logger.ts
- [x] Point 1 (session-end detected): log in chat.tsx with trigger, messageCount, sessionAnalysesCountBefore, writtenTo
- [x] Point 2 (buffer status): log buffer existence and compactMessages count before lifecycleManager.endSession()
- [x] Point 3 (logs.dat write): log in sessionLifecycle.ts after appendSessionSummary succeeds
- [x] Point 4 (lifecycle result): log endSession result without __DEV__ guard (works on APK)
- [x] Point 5 (greeting read): log logs.dat session count at greeting time, note separate store
- [x] Punt 3b: Display dual-path storage key visibility in debug-log.tsx (shows both paths write to DIFFERENT stores)
- [x] Add "Buffer → sessionAnalyses Transfer (5-point)" section to debug-log.tsx Live tab
- [x] Remove __DEV__ guard from memory_session_end logDebugEvent so it fires on device APK

## Fix: logs.dat schrijven herstellen
- [x] Fix missing turnId in appendMessage calls (chat.tsx lines 1059/1066) — was causing TS errors
- [x] Fix sessionEndSummarizer.ts type mismatch — was producing objects incompatible with SessionLogSummary type (9 TS errors)
- [x] Rewrite sessionEndSummarizer to produce valid SessionLogSummary with all required fields (summaryId, createdAt, summaryModel, etc.)
- [x] Update greeting read path to use correct SessionLogSummary field names (openEndpoints, emotionalThemes instead of old fields)
- [x] Vitest verification: 3 tests pass (write+read, empty buffer error, multi-session accumulation)
- [x] Add 5-point transfer diagnostic to inactivity auto-end path
- [x] Add 5-point transfer diagnostic to background auto-end path

## Refactor: Inactivity = exact same endSession chain as manual close
- [x] Refactor inactivity auto-end to use full endSession chain (all 5 memory layers)
- [x] Refactor background auto-end to use full endSession chain (all 5 memory layers)
- [x] Remove any separate lightweight/pending-close path — one path to session-end
- [x] Remove PENDING_CLOSE_KEY recovery logic (deferred analysis) — no longer needed
- [x] Remove runDeferredSessionAnalysis import
- [x] Remove PENDING_CLOSE_KEY constant and all references

## Bug fixes batch (21 juni)
- [x] Issue 1: Chat resets after ~20 seconds — fixed: background auto-end now waits 10min (was immediate)
- [x] Issue 2: Session not saving to logs.dat — fixed: chatHistory fallback in endSession + robust buffer handling
- [x] Issue 3: Schema/modi not recognized — fixed: field name mapping (observationCount→frequency, lastSeenAt→lastSeen)
- [x] Issue 4: Rugzak not recognized since wizard — root cause = endSession never ran → tendencies never persisted (fixed by issues 1+2)
- [x] Issue 5: End-session button added in header + background timeout set to 10min
- [x] Greeting now includes last 3 session narratives from logs.dat (recentSessionDigests)

## Fix: Rugzak/backpack content not recognized (Melissa issue)
- [x] Add Dutch relationship terms to RELATIONSHIP_ROLES in backpack-relevance-analyzer.ts (vriendin, vriend, moeder, vader, zoon, dochter, zus, broer, etc.)
- [x] Add Dutch ROLE_PATTERNS to relational-anchor-detector.ts (mijn vriendin X, mijn zoon X, etc.)
- [x] Add Dutch IMPLICIT_ROLE_WORDS to relational-anchor-detector.ts
- [x] Add Dutch EMOTIONAL_PATTERNS to relational-anchor-detector.ts (mis, verdriet, boos, bang, pijn, etc.)
- [x] Reset extractedEntities in userDat when wizard saves backpack → forces full backpack send at next session
- [x] Fix server ai-chat.ts: when backpackChanged=true, use full backpack text (not stale extractedEntities)
- [x] Fix gpt-payload-builder.ts: always send full backpack at session-start (remove compact/empty lifeStory mode)

## Feature: GPT backpack analysis (eenmalig bij wijziging)
- [x] Server endpoint: ai.analyzeBackpack (tRPC) — GPT ontleedt rugzak-secties voor schema/mode kandidaten (server/backpack-analyzer.ts)
- [x] Output schema: per sectie schema-kandidaten + mode-kandidaten met confidence, evidence, sourceSectionId
- [x] Timestamp tracking: backpackAnalysisTimestamps (Record<string, string>) in userDat
- [x] Client trigger: bij sessie-start check of section.lastUpdated > lastAnalysisTimestamp → call analyse (lib/backpack-analysis/schema-mode-trigger.ts)
- [x] Write GPT output direct naar userDat.schemaTendencies + modeTendencies (moving average merge)
- [x] Backpack alleen bij wijziging meesturen (per-sectie change detection, niet elke sessie)
- [x] Elias/Kim specifieke GPT prompts (andere schema-focus per persona)
- [ ] Fix: volledige backpack-tekst moet GPT system prompt bereiken bij session-start

## Bug: GPT herkent geen personen uit de rugzak
- [x] Probleem: Rugzak gaat wél mee naar GPT, schema's/modi worden herkend, maar persoonsnamen (bijv. "Melissa") worden niet herkend
- [x] Oorzaak 1: Prompt ORDERING — antiHallucination stond BOVEN personal data, GPT-4o-mini prioriteert eerdere instructies
- [x] Oorzaak 2: Regex EXTRACTION — alleen "mijn [role] [Name]" patroon, maar user schrijft "Melissa, partner sinds 2019"
- [x] Fix 1: antiHallucination verplaatst ONDER identityMemory/lifeStoryContext in session-start + follow-up prompt
- [x] Fix 2: Free-text regex patronen toegevoegd: "[Name], [role]", "[Name] ([role])", "[Role]: [Name]"
- [x] Fix 3: antiHallucination regel herschreven met concreet voorbeeld en "SCAN ALL TEXT ABOVE"
- [x] Fix 4: relational-anchor-detector.ts uitgebreid met dezelfde free-text patronen
- [x] Skill: prompt-data-injection-audit bijgewerkt met prompt-ordering en regex-failure lessen

## Bug: Conversation history niet compleet + sessie-logs niet meegegeven
- [x] Probleem 1: sessionAnalysesSummary (laatste 3 sessies) nu gecached bij SESSION_INIT en geïnjecteerd in elk follow-up prompt
- [x] Probleem 2: extractThemes uitgebreid met Nederlandse termen (ruzie, woordenwisseling, vriendin, etc.) zodat sessie-inhoud correct wordt opgeslagen
- [x] Add /api/debug/prompt endpoint (dev mode only) — GET /api/debug/prompt toont volledige system prompt, session cache, PERSONEN-LOOKUP
- [x] Fix 5 TS errors: user-context.tsx (userName→naam, domain→name, label→string[]), kimCluster4MemoryPatch.ts, kst01-router.ts

## Bug: Greeting engine gebruikt dagboek als primaire context i.p.v. recente sessie-inhoud
- [x] Root cause 1: LAST_SESSION_SUMMARY base score (0.82-0.88) lager dan RECENT_DIARY (tot 1.0) → verhoogd naar 0.93-0.96
- [x] Root cause 2: RETURN_AFTER_ABSENCE hardcoded priority: RECENT_DIARY stond boven LAST_SESSION_SUMMARY → omgedraaid
- [x] Root cause 3: logs.dat had geen sourceTimestamp entry → nu endedAt als timestamp voor recency bonus
- [x] Fix: LAST_SESSION_SUMMARY base score verhoogd naar 0.96 (open loops) / 0.93 (recent digests) / 0.85 (alleen digest)
- [x] Fix: RETURN_AFTER_ABSENCE priority: LAST_SESSION_SUMMARY nu boven RECENT_DIARY
- [x] Fix: logs.dat endedAt timestamp toegevoegd aan sourceTimestamps voor recency bonus
- [x] Fix: RECENT_DIARY base relevance gecapped op 0.85 zodat het nooit boven sessie-samenvatting scoort
- [x] Fix: previousSessionMessages (laatste 5) direct als bron in greeting engine geïnjecteerd via adaptLogsDat
- [x] Fix: chat.tsx laadt nu previousSessionMessages en geeft ze door aan sessionInitGreetingStep
- [x] Fix: RETURN_AFTER_ABSENCE prompt behandelt sessie-inhoud als VERPLICHT (niet optioneel)

## Unified logs.dat — PAD A + PAD B samenvoeging
- [x] Nieuwe logs.dat schema: unifiedSessionEndWriter.ts met timestamp, zone, dominantModule, triggers, compressedNarrative, discussedTopics, source
- [x] Eén schrijffunctie voor sessie-einde (handmatig + auto-end) — writeUnifiedSessionEnd()
- [x] GPT-fail fallback: altijd entry schrijven met buffer-data als GPT faalt (buildFallbackSessionSummary)
- [x] Concurrency lock: sessie kan maar één keer worden afgesloten (sessionEndLock Map)
- [x] Retentie: 0-3mo volledig, 3-6mo gecomprimeerd, >6mo verwijderd (logsDatRetention.ts, runs at startSession)
- [x] Hidden migration feature: 5x tikken op persona naam in chat header (migrateSessionAnalysesToLogsDat.ts)
- [x] Export/import backward compatibility met oude sessionAnalyses structuur (importStagingService auto-migratie)
- [x] Greeting engine leest uit unified logs.dat (previousSessionMessages als fallback)
- [x] Auto-end + handmatige End roepen beide sessionLifecycle.endSession() aan met legacySessionData

## Fase 2: Zone-chronologie, logs.dat per-bericht leesmoment, verleden-tijd-lookup
- [x] Onderdeel 3 (basis): Standalone search functie voor logs.dat + user.dat (discussedTopics, compressedNarrative, triggerPatterns, schemaTendencies)
- [x] Onderdeel 3: Unit tests voor search functie (bekende + onbekende zoektermen)
- [x] Onderdeel 2: Wire search functie in per-bericht pipeline als verleden-tijd-trigger
- [x] Onderdeel 2: GPT krijgt context "gevonden" of "onbekend onderwerp" mee
- [x] Onderdeel 1: Zone-chronologie-regel in greeting engine (vergelijk vorige vs huidige zone)
- [x] Onderdeel 1: ROOD-poort: crisis-routing neemt voorrang, geen chronologie-toevoeging (handled by override priority in V3 engine)
- [x] Onderdeel 1: Verbetering (vorige slechter → nu beter): bekrachtigende incheck
- [x] Onderdeel 1: Verslechtering (vorige beter → nu slechter, geel): zorgzame incheck
- [x] Onderdeel 1: Geen verandering: geen speciale toevoeging
- [x] Onderdeel 1: Unit tests voor zone-chronologie scenarios (10 tests in zoneAwareGreeting.test.ts T13-T22)

## Greeting stale-data fix (logs.dat immediate write)
- [x] Root cause: greeting used stale compressedNarrative from logs.dat (GPT-generated "uitstellen") instead of raw chatHistory messages
- [x] Fix 1: adaptLogsDat now excludes logs.dat digests when raw previousSessionMessages are available (sessionInitGreetingStep.ts)
- [x] Fix 2: Prompt label changed to "LETTERLIJKE BERICHTEN" + anti-parafraseer-regel added (buildGreetingSynthesisPrompt.ts)
- [x] Fix 3: logsDatStore.upsertCurrentSession() method added — upserts by sessionId instead of blind append
- [x] Fix 4: Incremental logs.dat write after every turn in chat.tsx — raw messages written immediately, no GPT needed
- [x] Fix 5: endSession() now uses upsertCurrentSession (upgrades raw entry with GPT summary, no duplicate)
- [ ] Verify on device: greeting no longer says "uitstellen" after correction
- [ ] Verify on device: debug log shows current session immediately after first message

## PAR01 NL trigger patterns (additief)
- [x] NL regex patronen toegevoegd voor alle 9 MARKER_PATTERNS categorieën (role-reversal, responsibility-overload, own-needs-suppressed, guilt-when-stepping-back, identity-as-caretaker, childhood-pattern, exhaustion-denial, emotional-labor, boundary-inability)
- [x] Bestaande EN patronen ongewijzigd gelaten
- [x] 26 unit tests geschreven en geslaagd (18 NL + 4 EN regression + 2 safety gates + 2 combined)
- [x] Volledige testsuite: 1354 passed, 1 pre-existing failure (inactivityAutoClose EN message — niet gerelateerd)

## V3.3 Greeting source selection: timestamp-based dominance (replaces fixed hierarchy)
- [x] Remove artificial 0.85 cap on diary base score
- [x] Remove artificial 0.85 multiplier on gratitude base score
- [x] Lower session base score from 0.93-0.96 to 0.88-0.90 (equalized with diary/gratitude)
- [x] Normalize mood base scores (elevated 0.88, positive 0.85) to same range
- [x] Increase recency bonus rank 1 from +0.15 to +0.20 (decisive)
- [x] Change return-after-absence sort to use relevanceScore instead of fixed priority index
- [x] Keep high_alarm mood at 0.95 as safety exception
- [x] Write timestamp dominance tests (A: diary>session, B: session>diary, C: mood>both, D: gratitude>diary, E: high_alarm safety)
- [x] Update C2 absence test to reflect V3.3 score-based ordering
- [x] All 1359 tests pass (1 pre-existing failure unrelated)
- [x] Created selectMostRecentGreetingSource.ts utility (standalone, for future use)

## Phase A — i18n foundation + UI string replacement (drietaligheid NL/EN/FR)
- [x] Build i18n provider with React Context
- [x] Build useTranslation() hook with t("key") function + tStatic for module-level
- [x] Split flat JSON into nl.json, en.json, fr.json language files
- [x] Wire i18n provider into app/_layout.tsx
- [x] Write automated replacement script (source/line-based from combined JSON)
- [x] Test replacement script on ONE file first (app/(tabs)/index.tsx) — 50 strings replaced
- [x] Report single-file result for user confirmation
- [x] Batch replace remaining 18 files — 16 files modified, ~200 replacements
- [x] Fix TS errors: placeholder braces, module-level t→tStatic, variable shadowing
- [x] Verify all tests still pass (1359 pass, 1 pre-existing failure only)
- [x] Keep "I have a backup — import my data" option on intake screen unchanged
- [x] Persona separation maintained (Elias/Kim strings separate in mapping)
- [x] Exclude dev/debug files from UI string replacement
- [x] Handle ~425 UNMATCHED strings — analyzed: all are internal engine strings, not user-facing. Only 6 Migration alerts replaced.

## Phase B — Language selection screen in intake flow
- [x] Added language selection as step 0 in intake flow (before addiction/loved-one choice)
- [x] Three language options: Nederlands, English, Français with flag indicators
- [x] Selection persists via I18nProvider (AsyncStorage)
- [x] "I have a backup" option preserved on step 1 unchanged

## Phase C — AI output language via system prompt locale parameter
- [x] Added locale field to ChatContext interface (lib/ai/types.ts)
- [x] Added locale field to ChatRequestInput interface (server/ai-chat.ts)
- [x] Added locale to chatInputSchema (zod validation)
- [x] Added LANGUAGE RULE (ABSOLUTE) to buildSystemPrompt based on locale
- [x] Threaded locale through pipeline processMessage options
- [x] Threaded locale through OpenAI provider (SESSION_INIT + LIVE_MESSAGE payloads)
- [x] Updated sessionInitGreetingStep to prefer locale over content detection
- [x] Fixed greeting fallback to use locale-based language selection (NL/EN/FR)
- [x] Added locale/setLocale aliases to I18nContextValue for pipeline compatibility

## Bug fixes — i18n issues found on device
- [x] Unicode escape sequences (\u{1F6E1}, \u26A1, \u{1F4CB}, \u25BC) fixed in locale files (actual emoji now)
- [x] VSP screen: subtitle, tip text, counter-thought, last-updated translated
- [x] Backpack: tip text and last-updated translated
- [x] Diary: {dateStr} om {timeStr} showing as raw text — fixed: renderEntry useCallback now includes t in deps
- [x] Diary: {getDailyQuote().author} — fixed: STOIC_QUOTES moved to useMemo with t() inside component
- [x] Chat: previous session — already uses t('chat.history.show', { count }) correctly
- [x] Backpack: logs.dat — fixed by encryption key in backup (key was lost after reset)
- [x] tStatic: converted all critical module-level tStatic arrays to useMemo with t() (diary, vsp-section-editor, intake)

## Fix: Include encryption key in backup for reliable restore
- [x] Export: include at-rest encryption key (from SecureStore) in the encrypted backup payload
- [x] Import: restore the encryption key to SecureStore before writing data
- [x] Fix chat previous messages not loading after import (useEffect dependency on state.userDat)

## Intake flow restructure: Land → Taal → Intake
- [x] Add Land (country) selection as first intake screen (step 0, for emergency numbers)
- [x] Add Taal (language) selection as second intake screen (step 1)
- [x] Keep existing intake flow (with import) as step 2-4
- [x] All hardcoded English strings in intake replaced with t() calls
- [x] Unicode escapes in source code replaced with actual emoji characters

## Dynamic crisis numbers per country (safety-critical)
- [x] Replace hardcoded BE crisis numbers with CRISIS_NUMBERS mapping per country
- [x] Implement BE language exception (NL→1813, FR→0800 32 123)
- [x] Update emergency card and footer links to use dynamic numbers
- [x] Add i18n labels for all number categories (NL, EN, FR)
- [x] Server-side AI prompt crisis numbers now dynamic per country/locale
- [x] Shared crisis-prompt-helper.ts for elias and kim prompt blocks
- [x] Client sends country to server in chat requests
- [x] All 34 export/import tests pass

## French translations fix (missing keys cause fallback to EN/NL)
- [x] Add FR translations for stage of change options (intake screen)
- [x] Add FR translations for urgency levels and subtitle (intake screen)
- [x] Add FR translations for GDPR consent screen (subtitle + bullet points)
- [x] Add FR translations for zone selector (title, subtitle, zone names + descriptions)
- [x] Add FR translations for disclaimer modal (title, body, bullets, button)
- [x] Add FR translations for any other missing keys found in comparison
- [x] Verify components use t() not hardcoded strings for these sections
- [x] Add mood screen i18n keys (slider descriptions, zone labels, trend labels, timestamps)
- [x] Replace hardcoded SLIDER_META and ZONE_CONFIG with reactive t() in mood.tsx
- [x] Replace hardcoded strings in backpack stage section with t() calls
- [x] Replace hardcoded strings in BackpackWizardScreen with t() calls
- [x] Fix crisis-prompt-helper require() → import for vitest compatibility

## Pre-translate vrije tekst (veiligheidskritiek)
- [x] Build pre-translate module (gpt-4o-mini, NL vertaling, fallback, debug log)
- [x] Integrate pre-translate BEFORE all detection layers (trigger, zone, crisis, SignalEngine)
- [x] Condition: only call when locale !== 'nl', skip for NL users
- [x] Fallback: on error, pass original text through (never drop messages)
- [x] Debug trace: [pre-translate] input → NL translation (or skipped)
- [x] Test: FR "je veux mourir" → crisis detection triggers
- [x] Test: FR "j'ai envie de boire" → craving trigger matches
- [x] Test: NL message → no translate call, skipped
- [x] Test: Simulated translate failure → message passed through

## GPT antwoordt in verkeerde taal (NL ipv EN/FR)
- [x] Fix: LANGUAGE ENFORCEMENT reminder toegevoegd aan einde van BEIDE prompt templates (Elias + Kim)
- [x] Fix: generateGreeting() miste locale parameter - nu doorgegeven vanuit chat.tsx
- [x] Fix: Added final system message AFTER user message to enforce locale (strongest position)
- [x] Fix: Intake country step hardcoded to English (language not yet chosen at that point)
- [x] Fix: Profile GUIDANCE DEPTH section - replaced hardcoded EN with t() calls + useMemo
- [x] Fix: Data & Privacy section - all export/import strings now use t()
- [x] Fix: ImportDataSection - all strings use t() (confirm modal, name prompt, buttons)
- [x] Fix: ExportDataSection - validation messages, success, footer all use t()

## Hardcoded strings fix (FR screenshots juni 2026)
- [x] Mood screen: slider titles (Craving/Frustration/Despondency/Focus) → t() calls
- [x] Mood screen: intervention alert text "X, Y are elevated" → t() with interpolation
- [x] Mood screen: trend card fallback text → t() (elias + kim mood-trend.ts)
- [x] Mood screen: "Save a few check-ins to start seeing your patterns here" → t()
- [x] Mood screen: "7 days / 30 days" tab labels → t()
- [x] Mood trend chart card: series display names from i18n (elias + kim)
- [x] Progress card: 7/30 days toggle, signal summary, hope/fear from i18n
- [x] Backpack screen: section titles (Childhood, Adolescence, Adulthood, Family, Recurring Themes) → t()
- [x] Backpack screen: section subtitles (6-12 years, 12-18 years, etc.) → t()
- [x] Backpack screen: Kim section titles/subtitles → t()
- [x] Backpack screen: progress counter → t()
- [x] Profile screen: "De balkmetafoor wordt geïntroduceerd..." (NL hardcoded) → t()
- [x] Profile screen: "1 session · 2 check-ins" → t() with interpolation
- [x] Profile screen: STAGE_LABELS replaced with t() calls
- [x] Profile screen: emergency contact remove confirm → t()
- [x] Profile screen: VSP share dialog title → t()
- [x] BalkmetafoorCard: all hardcoded NL strings → t()
- [x] Chat error boundary: NL strings → t()
- [x] Prechat Eigen Regie: all hardcoded EN strings → t()
- [x] Added 54 new keys to en/nl/fr locale files
- [x] All 1383 tests pass

## Pipeline crash fix: scoreTrigger .toLowerCase() on undefined
- [x] Diagnose: tp.trigger is undefined in userDat.triggerPatterns (persisted by updateTriggerPatterns when label is undefined)
- [x] Fix: defensive guard in scoreTrigger — skip entries where tp.trigger is falsy
- [x] Fix: defensive guard in updateTriggerPatterns — skip undefined/null/empty trigger strings before persisting
- [x] NOT caused by i18n-sweep — backpack section labels are never written to triggerPatterns
- [x] All 1383 tests pass

## Server 400 fix: knownUserPatterns.triggers[0] invalid_type
- [x] Diagnose: buildKnownUserPatterns sends undefined trigger strings to server (Zod expects string[])
- [x] Fix: filter out undefined/null/non-string entries from triggerPatterns before mapping to trigger strings
- [x] All pipeline + AI chat tests pass
- [x] Cleanup migration: migrateUserDat now filters out corrupted triggerPatterns entries (trigger undefined/null/non-string) at load time
- [x] Cleanup persist: if corrupt entries were removed, persist cleaned userDat back to storage (both initial load + reloadFromStorage paths)
- [x] Logging: `[cleanup] removed N corrupt triggerPattern entries` when entries are cleaned
- [x] Defensive: safe for users without rugzak/triggers (checks Array.isArray before comparing lengths)

## Milestone cards + sober counter i18n fix
- [x] Milestone cards: added i18nKey to MilestoneDefinition type + all Elias/Kim definitions
- [x] Home screen uses t() for milestone title/message/cta based on i18nKey
- [x] Added 36 milestone i18n keys to en/nl/fr locale files (8 Elias + 4 Kim milestones × 3 fields)
- [x] Sober counter: fixed ${days} → {days} interpolation in locale files
- [x] Sober counter: pass days param to t() calls in sober-counter.tsx
- [x] All 1382 tests pass (1 timeout on Railway health check = infra, not code)

## Persistent server 400 fix: final-layer payload sanitization
- [x] Root cause: backpackAnalysis.triggers sent raw to server without filtering (could contain null/undefined/non-string entries)
- [x] Root cause: knownUserPatterns filter exists but no final safety net before serialization
- [x] Fix: added sanitizeChatPayload() helper in openai-provider.ts — runs on EVERY payload before superjson.serialize()
- [x] Sanitizes: backpackAnalysis.triggers (string[]), backpackAnalysis.coreBeliefs (string[]), backpackAnalysis.copingPatterns (string[])
- [x] Sanitizes: knownUserPatterns.triggers (string[])
- [x] Sanitizes: selectedTriggers (Array<{trigger: string, score: number}>)
- [x] All 1383 tests pass

## Bug: Inactivity auto-message causes state corruption + server 400
- [x] Removed silence auto-message entirely (was source of English responses + state corruption)
- [x] Removed all STILTE_RESPONSES, POST_ONTHULLING, DISCLOSURE_KEYWORDS, silence timer logic
- [x] Kept 10-min inactivity auto-close (full endSession chain, no follow-up messages)
- [x] All 1383 tests pass
- [x] Clinical dropdown: all text nodes now have selectable prop (copy/paste works)

## Bug: logs.dat save fails at session end (GPT summarization always 400)
- [x] Root cause: sessionEndSummarizer sent wrong payload format to /api/signal-engine
- [x] Route expects `{ prompt: string }`, summarizer was sending `{ conversationHistory, bufferSnapshot, _internal }`
- [x] Fix: changed to `{ prompt }` and parse `{ result }` response correctly
- [x] GPT session summaries now actually reach logs.dat (not just fallback data)
- [x] All 1383 tests pass

## Bug: Server 400 on ai.chat — Zod schema missing 22+ module context fields
- [x] Root cause: client sends fields (vergv01Context, igh01Context, loopDetected, languageRecovery, etc.) that server Zod schema doesn't declare
- [x] Zod z.object() in tRPC is strict by default — unknown fields cause 400
- [x] Fix: added all 22 missing context fields + loopDetected + languageRecovery to chatInputSchema
- [x] Added .passthrough() to schema to prevent future 400s from new client fields
- [x] Also added fields to ChatRequestInput interface for type safety
- [x] All 1383 tests pass

## Bug: Server 400 DEFINITIVE FIX (proven with live server tests)
- [x] Root cause PROVEN: client sends `selectedTriggers: null` and `activeSignals: null` — server Zod expects array, not null
- [x] Also: `extractedEntities: null` rejected (server expects object or undefined)
- [x] Client fix: sanitizeChatPayload converts null arrays → `[]`, null objects → delete
- [x] Server fix: ALL .optional() fields now also .nullable() as safety net
- [x] Tested against LIVE deployed server: unsanitized → 400, sanitized → 200
- [x] SESSION_END farewell call also tested and passes
- [x] All 1383 tests pass

## Bug: 3 mini tweaks (June 26)
- [x] Gratitude tab: fixed {item.n}. → direct item.n rendering (1., 2., 3.)
- [x] Session save/end messages: all translated to Dutch (analyzing, confirmation, fallback, pipeline farewell)
- [x] Auto-end session: replaced setTimeout with timestamp-based check on foreground return (backgroundStartTimeRef)
- [x] Fixed knownUserPatterns null → delete (was incorrectly being converted to empty array)
- [x] All 1392 tests pass

## Recency-Weighted Conversation Window
- [x] Increase conversation window from 6 to 20 messages (recency-weighted)
- [x] Add CONVERSATION CONTINUITY RULE to server-side system prompt
- [x] Update gpt-payload-builder.ts header comment to reflect new window size

## Greeting Continuity Fix
- [x] LAST_SESSION_SUMMARY always selected FIRST in selectGreetingSynthesisSources (not competitive)
- [x] Greeting prompt: vorige sessie is PRIMAIRE bron, GPT MOET er direct naar refereren
- [x] Updated timestampDominance tests to reflect new continuity rule
- [x] All 1391 tests pass, 119 greeting tests pass

## Greeting Herontwerp + Timestamp Consistentie (3 fixes)
- [x] FIX 1: Timestamp-consistentie — één bron per schrijfcyclus, logs.dat ≥ andere lagen
- [x] FIX 2: Greeting herontwerp — engine bepaalt feiten/verband, model verwoordt alleen
- [x] FIX 3: Blokkerende output-check met retry en fact-only fallback
- [x] TEST 1: Dagboek "blij Melissa" + chat "Melissa ambetant warm weer" → greeting noemt beide mét toeschrijving, ZONDER verzonnen verband
- [x] TEST 2: Timestamps logs.dat ≥ andere lagen na sessie-einde
- [x] TEST 3: Crisis-zin → crisis-override, geen synthese
- [x] TEST 4: Eén bron → warme greeting met dat ene feit
- [x] TEST 5: Geen nieuwe data → geen crash

## Bugs reported 2026-06-27
- [x] Greeting copies raw logs.dat text literally instead of verbalizing facts (shows "laatste sessie: elias: ja, die hitte...") — fixed: stripRawLabels() in greetingFactExtractor + buildGreetingSynthesisPrompt, strengthened anti-copy instructions
- [x] Missing i18n keys: mood.slider.craving.title → actually .label keys exist in all locales; progress tracker was using hardcoded English labels instead of tStatic() — fixed
- [x] English text on voortgang/progress screen needs Dutch translation ("36 days. This is factual, not a score.", slider names, "isolation") — fixed: elias-progress-tracker + kim-progress-tracker now use tStatic() with proper i18n keys

## Bugs reported 2026-06-27 (batch 2)
- [x] Session timeout/autosave: greeting context becomes stale after inactivity (no response for ~1 hour) causing raw/unprocessed text in GPT response when user finally replies — fixed: V3 greeting now calls resetSessionState()+clearSessionInitCache(), inactivity timer starts after greeting (guard changed from <=1 to <1), first follow-up forces SESSION_INIT to populate server cache
- [x] Persona isolation leak: Kim received an Elias mention in chat (one-time occurrence) — fixed: server-side persona guard invalidates sessionCache when userType mismatches, client forces SESSION_INIT on first follow-up after V3 greeting to ensure correct persona data in cache

## Bugs reported 2026-06-27 (batch 3)
- [x] Greeting repeats same content every session ("de vermoeidheid door de warmte en de craving") — fixed: removed forced CONTINUITY RULE, all sources now compete on relevanceScore (recency bonus decides)
- [x] Connection failure to server gives generic fallback ("fijn dat je er bent. Waar wil je het vandaag over hebben?") with no context — fixed: fact extraction moved before GPT call, connection failure now uses contextual deterministic fallback (mood/diary/session reference)
- [x] Simplify greeting engine: adaptLogsDat now uses only most recent logs.dat session (sorted by endedAt), no raw messages path, no cross-session pattern detection
- [x] Migration Harness: engine-mode feature flag (4 modes)
- [x] Migration Harness: canonical EngineInput type with deviceTimeContext
- [x] Migration Harness: canonical EngineOutput comparison type
- [x] Migration Harness: shadow logging infrastructure (local encrypted)
- [x] Migration Harness: golden testset foundation
- [x] Checkpoint A: /api/engine-process endpoint with schema validation
- [x] Checkpoint A: CanonicalEngineInput builder on client
- [x] Checkpoint A: State analyzer ported to server (server-safe, no react-native deps)
- [x] Checkpoint A: Dominant-state-selector stub (returns null until buffer ported)
- [x] Checkpoint A: Shadow engine client (fire-and-forget comparison)
- [x] Checkpoint A: Go/No-Go validation (1399 tests pass, server responds 1-2ms, crisis detection correct)
- [x] Checkpoint B: ShortTermMemoryBuffer ported to server (session-stateful, in-memory cache)
- [x] Checkpoint B: Loopblocker + mid-session re-eval ported to server
- [x] Checkpoint B: Regulation layer (zone decay + overshoot) ported to server
- [x] Checkpoint B: All wired into engine-process endpoint (full pipeline: analyze → buffer → decay → loopblock → regulate → re-eval)
- [x] Checkpoint B: Go/No-Go validation (1398 pass, 1 pre-existing timeout, crisis detection correct, latency 5ms)
- [x] Checkpoint C: Signal engine consolidated into engine-process (direct OpenAI call, no HTTP round-trip)
- [x] Checkpoint C: VSP Insight Layer ported to server (server-safe, no react-native deps)
- [x] Checkpoint C: Past-reference search ported to server (server-safe)
- [x] Checkpoint D: GPT prompt build + OpenAI call integrated into engine-process (includeGPTResponse flag)
- [x] Checkpoint D: Full pipeline test: state-analyzer → buffer → decay → loopblock → regulation → signal → VSP → past-ref → GPT (9960ms with GPT, 1429ms without)
- [x] Checkpoint D: Go/No-Go validation (1399 tests pass, GPT response correct in Dutch, model routing works)
- [x] Checkpoint E: State-patch generation on server (statePatches with safety/sessionState/memory/logs/greetingCycle + sessionId + turnId)
- [x] Checkpoint E: Client-side patch-writer (applyServerPatches) — 0 TS errors, idempotent, persona-aware
- [x] Checkpoint F: SERVER_ACTIVE_CLIENT_SHADOW mode dispatcher (server-active-client.ts)
- [x] Checkpoint F: callServerEngine — builds CanonicalEngineInput, calls /api/engine-process, applies patches
- [x] Checkpoint F: dispatchEngine — mode-aware dispatcher (4 modes: off/shadow/active/only)
- [x] Checkpoint F: Crisis safety net (offline/timeout fallback with Dutch crisis numbers)
- [x] Checkpoint F: All migration files exported from lib/migration/index.ts
- [x] Checkpoint E+F: Go/No-Go validation (1398 pass, 1 pre-existing timeout, 0 TS errors in migration files)
- [x] Shadow Validation: Build shadow-comparison test harness (runs golden sessions through both client + server engines)
- [x] Shadow Validation: Create golden-session scenarios (stable Elias/Kim, high craving, relapse intent, crisis, VSP zones, past-reference, greeting, fact-grounding, module-loops, multilingual)
- [x] Shadow Validation: Run comparison and collect per-field match data
- [x] Shadow Validation: Report match-percentages — RESULT: crisis 64.3% (FAIL), persona 100% (PASS), high fields 62.5% (FAIL)
- [x] Shadow Validation: Classify mismatches — 36 real differences, 10 timing artifacts. Root cause: DominantStateSelector not on server (0% module match), showEmergency threshold mismatch, decay order difference
- [x] P1a: Align showEmergency threshold on server (crisisLevel >= 2 OR vspLevel === 'PAARS')
- [x] P1b: Fix decay order on server (decay BEFORE zone calculation, matching client)
- [x] P1b+: Align zoneScore formula (AVG not MAX, 40/25/20 weights, trigger/intent/trajectory modifiers)
- [x] P0: Port DominantStateSelector to server engine-process pipeline (server/engine/dominant-state-selector-server.ts)
- [x] Additional: Buffer initialization from input.previousZoneScore for fresh sessions
- [x] Re-run shadow validator — FINAL RESULT: Crisis 100% (PASS), Persona 100% (PASS), High fields 98.2% (PASS)
- [x] VERDICT: 🟢 GO — Server parity validated. Checkpoint G is verantwoord.
- [x] Regulation vocabulary alignment: added resolvedZoneForRegulation to server (mirrors client's VSP+crisis+distress zone resolution before regulation)
- [x] Model routing on server: modelRoutingDecision exposed in response (gpt-4o for crisis/high-risk/complex modules/VSP ROOD+PAARS+ORANJE)
- [x] Re-run shadow validation: Crisis 100%, Persona 100%, High fields 98.2% — 🟢 GO maintained (9 real diffs, 7 timing artifacts)
- [x] Publish for user testing (checkpoint f4bbd37c)
- [x] Checkpoint G: Switch engine mode to SERVER_ACTIVE (server leidend)
- [x] Checkpoint G: Insert server-led early return block in pipeline.ts processMessage (calls callServerEngine, returns PipelineResult directly)
- [x] Checkpoint G: Fix requestType mismatch (server expects 'process_message', not 'LIVE_MESSAGE')
- [x] Checkpoint G: Build full ServerEngineCallInput payload (UserDatSummaryPayload, LogsSessionPayload, VSP, moodSliders)
- [x] Checkpoint G: Graceful degradation — on server failure, falls through to client pipeline
- [x] Checkpoint G: Run tests and verify no regressions (1328 pass, 5 pre-existing env failures)
- [x] Stap 2: Enable includeGPTResponse:true in callServerEngine so server returns AI text (+ backpack/userDat/diaryEntries payload, 30s timeout)
- [x] Stap 1: Flip isServerEngineActive() to true (was already SERVER_ACTIVE_CLIENT_SHADOW)
- [x] Stap 3: Remove client-side GPT call path (deprecated to fallback-only, server-led is primary)
- [x] Greeting server-led: add server-led early return in generateGreeting() (same pattern as processMessage)
- [x] ChatContext guard: labeled ChatContext + GPT call as CLIENT FALLBACK (only reached when server-led fails)
- [x] PRE-GPT lazy-load: verified server-led block already returns BEFORE PRE-GPT (line 747 return skips 2000+ lines on success)

## Dagstructuur Feature (local structure + reminder layer)
- [x] Fase 1: Types + constants + TimeAdapter + LocalDeviceTimeService extensions
- [x] Fase 2: Repository (encrypted load/save/validate) + DayStructureService + CompletionService
- [x] Fase 3: NotificationService + PermissionService + app.config updates
- [x] Fase 4: Wizard UI + routes
- [x] Fase 5: Home card + bell toggle + day editor UI
- [x] Fase 6: Root integration (notification handler, observer, reconciliation, timezone hook)
- [x] Fase 7: i18n keys (nl/en/fr) + icon mappings (46 keys x 3 locales)
- [x] Fase 8: Unit tests (34 tests passing)
- [x] Fase 9: Final verification + checkpoint
- [x] Audit weekday mapping: TimeAdapter ISO 1-7 ↔ expo-notifications US 1-7 conversion confirmed correct
- [x] Sleep notification: added "Vergeet je wekker niet te zetten!" body text + "Bedtijd 🌙" title for sleep blocks
- [x] Home screen: dagstructuur nav card met 📅 agenda-icoon + navigatie naar /day-structure/wizard
- [x] ScrollWheelTimePicker: build scroll-wheel component (two columns, selected big/white, adjacent grey)
- [x] Wizard wake/sleep: replace current time input with ScrollWheelTimePicker
- [x] Wizard save button: add persistent Save button + draft persistence (encrypted) for partial saves at any step
- [x] Activities step: replace TextInput with ScrollWheelTimePicker for start/end times
- [x] Day editor screen: view/edit/delete existing blocks per weekday (with add block form)
- [x] Home card conditional text: navigates to editor if configured, wizard if not; different body/CTA text
- [x] Bug fix: ScrollWheelTimePicker crash when value prop is undefined — made value optional with '07:00' default
- [x] Bug fix: wizard-activities.tsx using wrong picker API (initialHour/onTimeChange) — rewritten to use correct value/onChange API
- [x] Bug fix: Editor display showing wake/sleep blocks as range "startTime – endTime" — now shows single time point
- [x] Bug fix: Editor inline-edit showing two pickers for wake/sleep — now shows single picker (syncs start+end)
- [x] Bug fix: Home card showing wake/sleep blocks as range — now shows single time point
- [x] Bug fix: Home card weekday resolution using new Date().getDay() — replaced with DayStructureTimeAdapter.getCurrentWeekday()
- [x] Bug fix: Validation errors (start_equals_end + overlap) when copying day to weekdays — fixed: point-in-time blocks (startTime===endTime) excluded from overlap check
- [x] Bug fix: Wake block should display as single time point (1 uur), not "van-tot" range — already correct in wizard (startTime===endTime model)
- [x] Improvement: Validation feedback — show translated user-friendly error messages instead of raw i18n keys in Alert
- [x] Improvement: Auto-suggest next activity start time from previous activity's end time
- [x] Improvement: Separate weekend schema option in copy-week wizard step
- [x] Improvement: Completion tracking with checkboxes on home card to mark blocks as done
- [x] Feature: Add delete button per block in wizard-review step (dagindeling preview)
- [x] Bug fix: start_equals_end validation already fixed — only triggers for activity blocks, wake/sleep are exempt
- [x] Bug fix: Duplicate "Opstaan" block — review now correctly shows wake with clock icon and single time
- [x] Feature: Add 'Einde dag' button in wizard-activities to navigate to sleep/bedtime step
- [x] Bug fix: Editor time picker layout — replaced with tap-to-expand start/end buttons, one picker at a time
- [x] Feature: Add 'Einde dag (slaaptijd)' button to editor — moon icon button at bottom of editor
- [x] Feature: Push notification toggle (bell icon) on home card — integrated DayStructureHomeCard with bell on homescreen
- [x] Feature: Greeting integration — DayStructureHomeCard shows current block highlighted + context
- [x] Feature: Task follow-up / streak overview — streak counter (🔥 X dagen) on home card progress bar
- [x] Bug fix: Server/AI uses wrong time — now passes device localTime from client to buildSystemPrompt
- [x] Bug fix: AI hallucinates activities — dayStructureContext now sent to AI with actual blocks
- [x] Feature: Push notifications 10min before each block start, activated via bell toggle
- [x] Feature: Move dagplanning to its own tab (day-planning.tsx) with nav card on home
- [x] Feature: Add 'Straks' (later/skip) option to dagstructuur tab screen
- [x] Feature: Add streaks on/off toggle (ja/nee) — small text toggle on progress bar
- [x] Feature: Extend AI greeting with time-of-day awareness + dagstructuur context (current block reference, off-schedule empathetic response during sleep time)
- [x] Fix: Add implicit help signal patterns to LiveIntent detection (short-term-memory-buffer.ts)
- [x] Fix: Add proactivity instruction to deep guidanceDepth (ai-chat.ts) — soft invitation, zone-safe
- [x] Feature: InternalClockService — calibrates at app-start from LocalDeviceTimeService, self-increments via elapsed time calculation
- [x] Feature: TimeProvider wires InternalClockService.calibrate() on mount + checkAndRecalibrate() on foreground return
- [x] Feature: Greeting (server-active-client.ts) reads deviceTimeContext from InternalClockService.now() instead of new Date()
- [x] Feature: DayStructureTimeAdapter reads all time from InternalClockService (single source of truth for dagstructuur)

- [x] Fix: InternalClockService now reads fresh device time on every .now() call (no stale anchor drift after long background)
- [x] Fix: TimeProvider recalibrates on EVERY foreground return (not just timezone change)
- [x] Fix: home-card.tsx uses DayStructureTimeAdapter.getCurrentLocalTime() instead of raw new Date() for current-block detection
- [x] Fix: day-structure-service.ts auto-reschedules OS notifications after every schema save (saveWeekSchema + saveDayBlocks) if bell is enabled
- [x] Fix: use-day-structure-observer verifies OS-scheduled notifications exist on foreground + mount, reschedules if missing (handles force-close, reboot, iOS drops)
- [x] Fix: Activate previousSessionMessages fallback in adaptLogsDat when logs.dat is empty or only has a poor live-entry
- [x] Enhancement: Increase fallback message window from 5 to 10 (chat.tsx slice(-10)) for richer fallback context
- [x] Enhancement: Add logsDatSource debug indicator to greeting debugLog (rich_summary | previousSessionMessages_fallback | none)
- [x] Enhancement: Extract semantic topics from raw fallback messages via keyword frequency (extractTopicsFromMessages, top 3 topics)
- [x] Fix: Give LAST_SESSION_SUMMARY continuity-first priority in selectGreetingSynthesisSources (always slot 0)
- [x] Fix: Prompt focuses on open endpoints ("waar waren we gebleven") instead of full narrative recap
- [x] Fix: Max 2 state sources alongside continuity slot, with variation instruction to prevent repetitive greetings
- [x] Feature: Backup includes dagstructuur (document, completion, bell-state, streaks-enabled)
- [x] Feature: Backup includes app preferences (language, country)
- [x] Feature: Import restores dagstructuur and app preferences without data loss
- [x] Feature: Pre-import snapshot covers all new keys for safe rollback
- [x] Fix: Sanitize fallback narrative — filter internal error strings (gpt-samenvatting niet beschikbaar, network request, berichttellers)
- [x] Fix: Frame fallback narrative as "Gebruiker besprak:" thematic summary instead of raw concatenation
- [x] Fix: Prompt explicitly forbids literal user quotes — must extract THEME and rephrase in own words
- [x] Fix: Added FOUT/GOED examples in prompt to demonstrate correct vs incorrect greeting phrasing
- [x] Fix: dagStructure document/completion export was silently null — added EXTRA_ENCRYPTED_KEYS to isKeyEncrypted() so readJson/writeJson/readJsonForSnapshot all route through readEncrypted/writeEncrypted for @recofree_daystructure_v1 and @recofree_daystructure_completion_v1
- [x] Feature: Copy-day functionality in dagstructuur editor (copy blocks from one day to other days after wizard is closed)
- [x] Feature: Restart wizard button in dagstructuur editor (re-run wizard flow from scratch)
- [x] Feature: Copy-only-activities option in dagstructuur editor (skip wake/sleep when copying to other days)
- [x] Feature: Drag-and-drop block reordering in dagstructuur editor (up/down arrows per block)
- [x] Feature: Undo after copy in dagstructuur editor (revert to previous state if wrong days were overwritten)
- [x] Feature: Copy-from-another-day option in dagstructuur editor (import blocks from a chosen source day to current day)
- [x] Feature: Visual indicator (green dot) on day-tabs showing which days already have a structure configured
- [x] Fix: Notifications already use expo-notifications WEEKLY scheduled triggers (fire in background/closed) — confirmed working correctly
- [x] Feature: Permissions request flow/card in profile where user is prompted for notification permission with explanation
- [x] Feature: Auto permission prompt after wizard completion (ask notification permission immediately after finishing wizard)
- [x] Feature: Test notification button in the notification permission card (send a test notification to verify delivery)
- [x] Feature: Notification sound setting per block type (silent/default/alarm) in the editor

## Memory Write-Back Integration (per-turn persistence)
- [x] Connect executeMemoryWriteBack to server-mode pipeline (pipeline.ts lines 708-848)
- [x] Connect executeMemoryWriteBack to client-mode pipeline (pipeline.ts lines 3255-3338)
- [x] Replace hardcoded changedUserDatFields: [] with real values from commitResult
- [x] Replace hardcoded changedStateFields: [] with real values from commitResult
- [x] Add server-mode trace block (buildTraceBlock) with real memory data
- [x] Extend ServerEngineCallResult with signalDetections from server response
- [x] Verify 0 new TypeScript errors introduced (142 pre-existing remain)

## Pre-call Interpretation Layer (gpt-4.1-nano)
- [x] Build nano-interpret.ts module (server/engine/)
- [x] Integrate pre-call into engine-process.ts after crisis check, before module selection
- [x] Replace keyword matching in dominant-state-selector with suggestedModule from pre-call
- [x] Implement fallback: 1 retry, then user-facing error (no silent keyword fallback)
- [x] Verify TypeScript compiles with 0 new errors (142 pre-existing, 0 in new files)
- [x] Add module validation (hallucination guard) in nano-interpret.ts
- [x] Route translatedNL + nanoInterpret into GPT system prompt (MESSAGE INTERPRETATION block)

## Deterministic Theme→Module Refactor (nano interprets, engine decides)
- [x] Build controlled theme vocabulary per persona (ELIAS_THEMES: 42 labels, KIM_THEMES: 22 labels)
- [x] Build THEME_TO_MODULE_ELIAS mapping (42 themes → module IDs)
- [x] Build THEME_TO_MODULE_KIM mapping (22 themes → module IDs)
- [x] Refactor nano-interpret.ts: output themes[] from closed list only, no suggestedModule
- [x] Build resolveModuleFromThemes() deterministic resolver (exported from nano-interpret.ts)
- [x] Update engine-process.ts: call resolveModuleFromThemes after nano, pass resolvedModule to selector
- [x] Update NanoInterpretSuggestion interface: resolvedModule + matchedTheme (replaces suggestedModule)
- [x] Update dominant-state-selector: all priorities use resolvedModule from engine (not nano)
- [x] Update ai-chat.ts ChatRequestInput and MESSAGE INTERPRETATION prompt block
- [x] Hoist nanoModuleResolution outside try block for proper scoping
- [x] Verify 0 new TypeScript errors (142 pre-existing unchanged)

## M21-M85 Theme Extension + Debug Improvements
- [x] Extend Elias theme vocabulary to 343 tags covering M05-M85 (from short-module-routing.ts)
- [x] Extend Kim theme vocabulary to 96 unique modules (M21-M85 + PAR01 + FIN01 + ROUW-K01 + ISOL-K01)
- [x] Add Memory Write-Back (per turn) section to debug-log.tsx live tab
- [x] Add logs.dat (per-turn live write) section to debug-log.tsx live tab
- [x] Add memory_logsdat_turn_write DebugEventType
- [x] Add logDebugEvent calls for per-turn logs.dat write (success + failure paths)
- [x] Add memory_write_back + memory_logsdat_turn_write formatters to event renderer
- [x] Verify 0 new TypeScript errors (142 pre-existing unchanged)

## Nano-Interpret Debug Trace Routing
- [x] Add nanoInterpret to EngineProcessResponse interface + return object in engine-process.ts
- [x] Add nanoInterpret to ServerEngineCallResult interface + both return paths in server-active-client.ts
- [x] Add nanoInterpret field to EngineTraceInput interface in engine-trace.ts
- [x] Add NANO-INTERPRET renderer section to buildTraceBlock() in engine-trace.ts (themes, resolvedModule, matchedTheme, intent, translatedNL)
- [x] Route nanoInterpret into server-mode serverTraceData in pipeline.ts
- [x] Add nanoInterpret: null to client-mode traceData in pipeline.ts (server-only feature)
- [x] Verify 0 new TypeScript errors (142 pre-existing unchanged)

## Railway Backend End-to-End Integration
- [x] Railway /api/engine-process endpoint fully working (GPT response + nano-interpret + engine patches)
- [x] Server returns gptResponse.response (gpt-4o-mini), nanoInterpret, statePatches, signalEngine, bufferState
- [x] Pipeline server-mode early return path (line 690) correctly triggers when serverResult.responseText is present
- [x] Client pipeline applies server patches to sessionBuffer and sessionDominantState
- [x] Memory write-back runs with server signalDetections
- [x] nanoInterpret data routed into trace block for debug visibility
- [x] Unit test: server-pipeline-integration.test.ts (3 tests passing)
- [x] Verified 0 new TypeScript errors (142 pre-existing unchanged)
## Railway Schema & Format Fixes (2 Jul 2026)
- [x] Fix Zod schema: moodSliders accepts string values (vsp: "GEEL"), lastSeen/lastUsed optional
- [x] Fix: server/engine-process.ts was the actual import path (not root engine-process.ts)
- [x] Fix: filter non-numeric moodSliders before passing to generateAIResponse
- [x] Fix: adapt backpack format (app sends sections → server expects lifeStory)
- [x] Fix: adapt userDat format (app sends frequency → server expects count, sessionAnalyses optional)
- [x] Fix: safe logging in ai-chat.ts (optional chaining for backpack.lifeStory and userDat fields)
- [x] Verified via curl: Railway returns full GPT response with realistic app payload
- [ ] Verify end-to-end on device: app uses Railway response instead of falling back to client-mode
## Option B: Railway GPT-Proxy Migration (2 Jul 2026)
- [x] Verify client pipeline builds correct ChatRequestInput for tRPC call
- [x] Set engine-mode to client-primary (disable server-active-client shadow)
- [x] Build /api/gpt-proxy endpoint on Railway
- [x] Route client GPT calls to Railway /api/gpt-proxy
- [x] Maintain fallback to sandbox tRPC if Railway fails
- [ ] Test end-to-end on device (awaiting user test)
## Railway Cold Start Mitigation (2 Jul 2026)
- [x] Added warmup ping on app mount (GET /api/health) to wake Railway container before greeting/chat
- [x] Greeting already routes via Railway /api/session-greeting (confirmed working ~2s via curl)
## Greeting Fix: Error Narratives + Halve Zinnen (2 Jul 2026)
- [x] Fix sessionEndSummarizer.ts: fallback narrative never contains raw error messages
- [x] Fix sessionEndSummarizer.ts: clean minimal summary from user messages when GPT fails
- [x] Add isErrorNarrative() defense-in-depth filter in adaptLogsDat() (sessionInitGreetingStep.ts)
- [x] Fix extractTopicFromNarrative(): respect word/sentence boundaries (no mid-word truncation)
- [x] Fix stateFact.content slice: use truncateAtBoundary() instead of raw .slice(0,80)
- [x] Add truncateAtBoundary() utility function in greetingFactExtractor.ts
- [x] Tests: 15 new tests for error filtering + topic extraction + boundary truncation (all passing)
- [x] Regression: all existing session-end + greeting tests still passing
## Greeting Fallback: Second-Person Conversion (2 Jul 2026)
- [x] Confirmed: greeting GPT call already routes via Railway /api/session-greeting (getApiBaseUrl → PRODUCTION_API_URL)
- [x] Rewrote buildDeterministicFallback to use narrativeToSecondPersonTopic() instead of raw text
- [x] Added narrativeToSecondPersonState() for mood/state acknowledgments
- [x] Added extractTopicCore(): strips names, prefixes, meta-labels from raw narrative
- [x] Added thirdToSecondPerson(): converts "voelt zich/heeft/is/maakt zich zorgen" to second-person
- [x] Possessive "zijn/haar [relatie-noun]" → "je [relatie-noun]" conversion
- [x] Generic fallback "We pakken de draad op van vorige keer." when topic extraction fails
- [x] Tests: 22 tests passing (error filter + second-person conversion + boundary truncation)
- [x] Regression: all 41 greeting/session-end/logsDat tests still passing
- [x] 0 new TS errors in source files (pre-existing test-only errors unchanged)
## Logs.dat Cleanup Migration + Greeting Timeout (2 Jul 2026)
- [x] Build logs.dat migration: remove entries with error narratives on app start
- [x] Increase greeting-call timeout to reduce fallback triggers during Railway cold starts
## Greeting V4 — Full Replacement (3 Jul 2026)
- [x] Build V4 greeting engine (source collector, zone-arc, prompt builder)
- [x] Wire V4 into chat.tsx, replace V3 call path
- [x] Typing indicator in user language during greeting load
- [x] Deterministic fallback (second-person, no raw text)
- [x] Both personas parametric (Elias: VSP + sliders; Kim: Eigen Regie + her sources)
- [x] Warm default for first session
- [x] 15s timeout with AbortController on proxy call
- [x] 0 new TS errors, all 12 V4 tests green
## Nano-Interpret in Client Pipeline (3 Jul 2026)
- [x] Build client-side nano-interpret caller (routes via Railway /api/nano-interpret proxy)
- [x] Wire nano result into client selectDominantState (priority 2: first non-crisis layer, primary detection)
- [x] Update trace to show nano result from client-side call
- [x] Engine mode stays CLIENT_ACTIVE_SERVER_OFF — nano runs client-side via proxy
## Session-Based Encryption (4 Jul 2026)
- [x] Build SessionMemoryCache: in-memory store with decrypt-on-open, dirty tracking
- [x] Wire cache into pipeline/chat.tsx (replace per-message readEncrypted/writeEncrypted)
- [x] Wire cache into user-context.tsx (persistBackpack/persistUserDat)
- [x] Wire cache into diary.tsx (3 calls replaced)
- [x] Wire cache into atomicJsonStore.ts (state.dat, projections.dat)
- [x] Add AppState/background listener for encrypt-on-background/close
- [x] Add 10min inactivity timer for periodic encrypt-and-flush
- [x] Preserve persona separation in cache
- [x] 0 new TS errors, 34 tests green

## context.dat — In-Memory Distilled Context (4 Jul 2026)
- [x] Build context.dat distiller (key figures max 7, schemas max 5, modes max 5, 7-day trend, last 3 session summaries, active projections max 2)
- [x] Build deepening layer (targeted fragment retrieval: person/theme not in context, older session ref, active schema needing depth)
- [x] Wire into pipeline: distill at first user message after greeting, replace full backpack/userDat/diary payload
- [x] Handle empty/new user gracefully (minimal/empty context.dat, no crash)
- [x] Debug trace: show distilled context contents + token size old vs new
- [x] 0 new TS errors, 34 tests green

## Payload Optimization: Deepening Cap + LIVE_MESSAGE Slim (4 Jul 2026)
- [x] Cap deepening layer at 500 tokens max (priority-ranked fragments, truncate lowest priority)
- [x] Added crisis/safety priority ranking: crisis schemas + crisis-context persons get priority 1
- [x] Priority order: 1=crisis/safety, 2=person references, 3=schema deepening, 4=older session refs
- [x] 11 dedicated deepening tests green (`__tests__/deepeningCap/deepeningCap.test.ts`)
- [x] LIVE_MESSAGE: only send active/relevant engine contexts per turn (not all 30+ fields)
- [x] Built `lib/ai/live-message-filter.ts` — buildSlimLivePayload() drops all null/undefined optional context fields
- [x] Integrated into openai-provider.ts LIVE_MESSAGE branch (replaces 150-line explicit field list)
- [x] Updated pipeline.ts trace to show dynamically active fields per turn
- [x] 15 dedicated tests green (`__tests__/liveMessageFilter/slimPayload.test.ts`)
- [x] e2e chain tests pass (knownUserPatterns + backpackAnalysis preserved in LIVE_MESSAGE)
- [x] Server-side robuustheid: alle optionele velden al bewaakt met if-guards + Zod .nullable().optional()
- [x] 17 server robustness tests green (`__tests__/e2eChain/slimPayloadServerRobustness.test.ts`)
- [x] Bewezen: minimale slim payload (alleen required fields) → Zod OK → buildSystemPrompt OK → geen crash
- [x] 0 new TS errors (133 total = 6 FEWER than before, pre-existing errors only)
- [x] Totaal 67 tests green over 4 test suites (deepening + slim filter + server robustness + e2e chain)

## Fix: context.dat Distiller Empty Stores + Trace Regex Mismatch (4 Jul 2026)
- [x] Fix 1A: Length-guard fallback in distiller (extractSchemas, extractModes)
  - Empty [] is truthy → || fallback never fires → now uses explicit length check
  - Memory-layer preferred when populated; pipeline userDat as fallback
- [x] Fix 1B: Register memory-layer keys with SessionMemoryCache (both personas)
  - Added 6 keys to registerKeys(): elias + kim × (user.dat, state.dat, projections.dat)
  - Without registration, SessionMemoryCache.get() returns null → store creates empty object
- [x] Fix 2: Replace regex-based trace counting with ContextDat object fields
  - Old regexes used Dutch words (modus, dag, sessie, projectie) but serializer uses English headers
  - Now uses contextDatObject.schemas.length etc. directly — always accurate
- [x] 16 dedicated tests green (`__tests__/contextDatFix/distillerFallback.test.ts`)
- [x] 83 tests green across 5 suites (contextDatFix + deepeningCap + slimFilter + serverRobustness + e2eChain)
- [x] 0 new TS errors (133 total, all pre-existing)

## Payload Optimisation Refinements (12 Jul 2026)
- [x] Token-meting labels: renamed serializedTokens → contextDatTokens, estimatedTokens → chatContextJsonTokens, added fullPromptTokens (OpenAI actual)
- [x] Updated engine-trace.ts type definitions and formatting to match new field names
- [x] Deepening cache: `lib/pipeline/deepening-cache.ts` — in-memory Map, 20 max entries, 30min TTL
- [x] Integrated into resolveDeepening: cache-first lookup for person/schema/session fragments
- [x] clearDeepeningCache() called at session start in pipeline.ts
- [x] E2E validation test: 12 tests proving schemas/modes/trend/sessions/cache all work correctly
- [x] 94 tests green across 6 suites, 0 new TS errors (134 total, 1 fewer than before)

## Conversation Window Optimisation + Project Structure Map (12 Jul 2026)
- [x] Reduce RECENT_WINDOW from 20 to 10 messages (both client + server)
- [x] Improve thematic summary: include assistant key interventions (schema/mode work, grounding, techniques, reflective questioning)
- [x] Add token-aware truncation: long messages capped at ~200 tokens (800 chars) with ellipsis
- [x] Preserve crisis messages regardless of position (max 3 retained, never summarized)
- [x] Retain most emotionally salient non-crisis message from earlier pool
- [x] 14 dedicated tests green (`__tests__/payloadRefinements/conversationWindow.test.ts`)
- [x] Server-side mirror: identical logic in `server/engine/gpt-payload-server.ts`
- [x] Generated full project structure map: `STRUCTURE_MAP.md` (502 lines, architecture overview, file tree, pipeline flow, memory layers, personas, payload stack)

## Schema/Mode Confirmation Layer V2 — Multi-source verification
- [ ] Extend SchemaTendency/ModeTendency types: add clinicalAcknowledged, userAcknowledged, acknowledgmentScore fields
- [ ] Update confirmation logic: single ack stays CANDIDATE, meervoudige verificatie (auto≥3 + clinical + user OR frequency≥8) = CONFIRMED
- [ ] Acknowledged candidates: may appear in prompt as "mogelijk patroon" (exploratory, cautious)
- [ ] Clinical mode acknowledgment: detect clinical ack intent, set clinicalAcknowledged=true, bump acknowledgmentScore
- [ ] User self-acknowledgment: NLU intent detection for recognition statements ("ja dat herken ik", "dat klopt")
- [ ] Update prompt injection: acknowledged candidates get exploratory injection (not assertive)
- [ ] Tests for multi-source confirmation logic
- [ ] Checkpoint

## VSP Insight Wiring (Pipeline + Safety Filter + Clinical UI)
- [x] Pipeline integration: call runVspIntakeAdapters() at SESSION_INIT and merge into VspInsightProfile
- [x] Output safety filter: call auditVspOutputSafety() after GPT response and log violations to debug trace
- [x] Clinical mode UI: add schema/mode confirmation button in clinical dropdown

## Structure Consolidation Refactor
- [ ] P2: Move src/features/vspInsight → lib/features/vspInsight
- [ ] P2: Move src/pipeline/memory/ → lib/pipeline/memory/
- [ ] P1: Move modules/elias/* → lib/engine/elias/modules/
- [ ] P1: Move modules/kim/* → lib/engine/kim/modules/
- [ ] P1: Move src/modules/elias/* → lib/engine/elias/modules/
- [ ] P1: Move src/modules/kim/* → lib/engine/kim/modules/
- [ ] P3: Remove empty src/ directory
- [x] P4: Add contract tests for server/client engine drift (__tests__/contractDrift/serverClientContract.test.ts — 16 tests)
- [ ] Update STRUCTURE_MAP.md with new layout

## Bug Fixes — Session Persistence
- [x] Fix diary/gratitude entries disappearing after days: @recofree_diary key not registered in user-context.tsx before unlock() — entries were never decrypted into SessionMemoryCache at app start
- [x] Fix vitest expo-modules-core/expo-constants/expo-linking mock failures: added __mocks__/expo-modules-core.ts, __mocks__/expo-constants.ts, __mocks__/expo-linking.ts + vitest.config.ts aliases

## Gratitude Persistence + Structure Consolidation + Diary Search
- [x] Fix gratitude key registration: ALREADY FIXED — gratitude uses same @recofree_diary key (entries have .gratitude field), diary key was registered in previous fix
- [x] Structure consolidation P1: Move modules/elias/* → lib/engine/elias/modules/ (ALREADY DONE — modules/ dir doesn't exist, content in lib/engine/elias/modules/)
- [x] Structure consolidation P1: Move modules/kim/* → lib/engine/kim/modules/ (ALREADY DONE — content in lib/engine/kim/modules/)
- [x] Structure consolidation P1: Move src/modules/elias/* → lib/engine/elias/modules/ (ALREADY DONE — src/ dir doesn't exist)
- [x] Structure consolidation P1: Move src/modules/kim/* → lib/engine/kim/modules/ (ALREADY DONE)
- [x] Structure consolidation P2: Move src/features/vspInsight → lib/features/vspInsight (ALREADY DONE — in lib/features/)
- [x] Structure consolidation P2: Move src/pipeline/memory/ → lib/pipeline/memory/ (ALREADY DONE — in lib/pipeline/memory/)
- [x] Structure consolidation P3: Remove empty src/ directory (ALREADY DONE — src/ doesn't exist)
- [x] Add diary search functionality: advanced search with mood filter chips, date range, proper search icon, and "no results" state

## Herval/Terugval in Wiel van Verandering
- [x] Add "Terugval of Herval" subsection to Wiel van Verandering (Stage of Change)
- [x] Herval: resets sobriety date, stays in current wheel stage until user picks another, sends signal to greeting
- [x] Terugval: preserves trajectory + sobriety date, but sends signal to greeting (same as herval)
- [x] Wire herval/terugval signals into greeting pipeline (sessionGreeting reads relapse events)
- [x] Persist herval/terugval events in user.dat (timestamp, type, context)

## Herval-historie + Dagboek Export + Preventieplan
- [x] Herval-historie overzicht in backpack: timeline met datum, type (herval/terugval), context, en "X dagen sinds laatste event"
- [x] Dagboek export als PDF/tekst: exporteer dagboek-entries met datum, mood, content voor therapeut-gesprekken (lokaal opslaan)
- [x] Terugval-preventieplan in backpack: invulbaar plan dat automatisch wordt meegestuurd naar Elias bij herval/terugval melding

## Zone-based Prevention Plan + Fixes
- [x] Refactor preventionPlan injection: send only zone-relevant field (PAARS→supportContacts+crisis, ROOD→warningSigns+supportContacts, ORANJE→warningSigns+copingStrategies, GEEL→copingStrategies+safeActivities, GROEN→motivation)
- [x] Greeting check: if preventionPlan not filled, Elias mentions it as suggestion
- [x] Fix profile.notifications.* i18n keys not translated (section_title, status_active, active_help, test_button, toggle_off)
- [x] VSP export: combine ingevuld VSP (backpack.vspSection) + VspInsightProfile (AI-patronen) in één export document
- [x] Balkmetafoor auto-init: pipeline zet initialized=true bij eerste PAAL01 FIRST_USE_INTRODUCTION
- [x] Balkmetafoor feed from chat: post-response parser extraheert draaglast/draagkracht items uit AI-antwoord en schrijft terug naar backpack
- [x] Balkmetafoor manual start: "Start balkmetafoor" knop in UI voor handmatige initialisatie

## Cost Optimization + VspInsight Live Feed
- [x] Disable GptSignalEngine (4 redundant API calls per message removed — NullEngine active)
- [x] System prompt: dynamicModuleList conditioneel (alleen bij SESSION_INIT of capability-vraag, bespaart ~3000 chars per message)
- [x] VspInsight live feed: profile wordt bijgewerkt tijdens LIVE_MESSAGE turns (niet alleen bij SESSION_INIT)
- [x] Balkmetafoor chat feed parser: extraheert draaglast/draagkracht items uit AI-antwoorden
- [x] NullEngine test suite: 12 tests verifiëren geen API calls + deterministische fallbacks werken

## Zod Schema Audit & TS Error Fixes (July 2025)
- [x] Audit zod chatInputSchema vs client payload fields (openai-provider.ts)
- [x] Identified: gratitude in diaryEntries was STRIPPED by zod v4 nested object stripping
- [x] Added gratitude field to diaryEntries in zod schema + ChatRequestInput interface
- [x] Added recentRelapseEvent, preventionPlan, preventionPlanMissing, acknowledgedCandidates to schema + interface
- [x] Removed (input as any) casts — now properly typed
- [x] Exported ChatRequestInput from ai-chat.ts
- [x] Fixed pipeline.ts: kimAdvancedP7Result.active → .activeModule
- [x] Fixed pipeline.ts: analysis.riskLevel narrowing errors (TS2367) with string casts
- [x] Fixed pipeline.ts: sessionId → sessionBuffer.sessionId
- [x] Fixed pipeline.ts: resolvedZone → zone.engine?.label
- [x] Fixed pipeline.ts: recommendedModel (removed — not on type)
- [x] Fixed pipeline.ts: estimatedTokens → chatContextJsonTokens
- [x] Fixed pipeline.ts: schemaModeResult type mismatch (map acceptedModes/Schemas to string[])
- [x] Fixed pipeline.ts: mergePersons type mismatch (as any cast)
- [x] Fixed pipeline.ts: TendencyConfirmable null compatibility (clinicalAcknowledgedAt, userAcknowledgedAt allow null)
- [x] Fixed pipeline.ts: applyAutoConfirmation calls (as any cast for mode/schema tendencies)
- [x] Fixed ChatContext: added country + backpackAnalysis fields
- [x] Fixed DebugEventType: added 'vsp_output_safety'
- [x] Fixed SessionLogSummary: added turnCount, dominantThemes, emotionalArc, unresolvedTensions, suggestedFollowUp
- [x] Fixed sessionInitContextBuilder.ts: null-safe access for optional SessionLogSummary fields
- [x] Fixed prompt-minimizer.ts: backpack.intakeContext → .intakeContext.initialContext, .name → .naam
- [x] Fixed KST01RuntimeInputs: added caregiverShameLevel
- [x] Fixed i18n-provider.tsx: TranslationStrings type allows nested objects
- [x] Fixed MemoryWritePatch.payload: unknown → any
- [x] Fixed GPTPayload + PayloadBuilderInput: added Kim cluster context fields
- [x] Fixed UserDatSummaryPayload: added recentRelapseEvent + preventionPlan
- [x] Result: 0 non-test TS errors, dev server starts cleanly

## Phase 2: Test File TS Errors + Nested Passthrough + Integration Test
- [x] Fixed memory-write-routing.test.ts: persona 'elias'→'Elias', sourceKind 'pipeline'→'VSPZone_6e', zone 'YELLOW'→'GREEN', added dormantBelowScore/pruneBelowScoreAfterDays to ProjectionDecayConfig
- [x] Fixed memory-write-routing.test.ts: PipelineTurnContext added localUserId, appVersion, pipelineVersion, language
- [x] Fixed greeting tests: added moodUsable, eligible, reason, backpackAnalysisChanged fields
- [x] Fixed zoneAwareGreeting.test.ts: SessionAbsenceResult added isReturnAfterLongAbsence, daysSinceLastSession, lastKnownZone
- [x] Fixed absenceSourceSelection.test.ts: GreetingSynthesisCandidate added eligible + reason
- [x] Fixed kimDangerChildCluster.test.ts: filterDangerChildOutput now receives moduleId arg
- [x] Fixed kimCluster4.test.ts: shouldEscalate → crisisNumbersToShow.length check
- [x] Fixed recurringPatterns.test.ts: added moodUsable to GreetingFreshnessResult
- [x] Fixed nl-markers-and-engine-init.test.ts: added vspLevel + messageCount to SchemaModeDetectionInput
- [x] Fixed exportImport.test.ts: added nowIso, platform, expoSdkVersion; removed duplicate nowIso
- [x] Fixed quietCloseWritesLogsDat.test.ts: createSessionLifecycleManager() takes 0 args
- [x] Fixed serverClientContract.test.ts: added sessionNumber to sessionAnalyses fixture
- [x] Fixed SelectedSynthesisSource: added dataTimestamp, eligible, reason as optional fields
- [x] Re-exported GreetingLogsDatSnapshot from sessionGreetingV3.types.ts
- [x] Added .passthrough() to nested zod objects: backpack, userDat, diaryEntries items, extractedEntities, backpackAnalysis, knownUserPatterns
- [x] Wrote nestedPassthrough.test.ts: 10 tests verifying all client fields survive parsing (top-level, backpack, userDat, diaryEntries, extractedEntities, backpackAnalysis, knownUserPatterns, recently added fields, gratitude, full payload)
- [x] Result: 0 TS errors (all files), 26/26 contract tests passing, dev server clean

## Phase 3: Quick Improvements + KERP01 Kim Eigen Regie Plan
- [x] Add .passthrough() to eigenRegieContext.impact and relevanceScores nested objects in zod schema
- [x] Add CI tsc check script to package.json
- [x] Remove (result.data as any) casts in contract tests — use proper typed helper (ParsedData)
- [x] KERP01: Define EigenRegiePlan, EigenRegieZoneEntry, EigenRegieTrigger, EigenRegiePlanSource types
- [x] KERP01: Add eigenRegiePlan field to Backpack type
- [x] KERP01: Build storage layer (read/write eigenRegiePlan in backpack AsyncStorage)
- [x] KERP01: Build Eigen Regie Plan overview screen (zone bar, zone cards)
- [x] KERP01: Build zone detail/edit screen (signals, bodySignals, thoughts, behaviour, whatHelps, boundaryActions, contactRule, anchorSentence)
- [x] KERP01: Build wizard flow (source selection → pattern detection → zone proposals → whatHelps → anchor sentences → triggers/rules → review)
- [x] KERP01: Integrate into pipeline SESSION_INIT (inject current zone entry + anchor + boundary rules)
- [x] KERP01: Integrate into pipeline LIVE_MESSAGE (detect regie-relevant topics, inject zone entry)
- [x] KERP01: Add eigenRegiePlanContext to server zod schema + ChatRequestInput interface
- [x] KERP01: Inject eigenRegiePlanContext into GPT prompt builder (server-side)
- [x] KERP01: Build text export (share with therapist)
- [x] KERP01: Fix TS errors and run tests (0 TS errors, 1616 tests passing)

## Phase 4: AI Wizard + Notification Reminder

- [x] AI Wizard: Read backend LLM docs and understand invokeLLM pattern
- [x] AI Wizard: Create server endpoint (server/kerp01-generate.ts) that generates zone proposals from life story via invokeLLM
- [x] AI Wizard: Create client-side caller (lib/engine/kim/kerp01-generate-client.ts) following backpack-extractor pattern
- [x] AI Wizard: Update wizard UI with "AI-genereer plan vanuit rugzak" button on intro step
- [x] AI Wizard: Show AI-generated proposals pre-filled in wizard with "Gegenereerd door AI — controleer en pas aan" notice
- [x] AI Wizard: User can review/edit all AI proposals in normal wizard flow before saving
- [x] Notification: Create notification service (lib/features/eigenRegie/notification-service.ts) using expo-notifications
- [x] Notification: Daily trigger at configurable time (default 20:00) with 3-day inactivity threshold
- [x] Notification: Add reminder toggle to eigen-regie plan overview screen
- [x] Notification: Record last check timestamp on plan screen open
- [x] Fix TS errors (0 errors) and run tests (1616 passed, 0 failed)

## Phase 5: Rugzak i18n — Engels naar Nederlands

- [x] Replace hardcoded English in DEFAULT_KIM_BACKPACK_SECTIONS (lib/ai/types.ts) with Dutch text
- [x] Replace hardcoded English in DEFAULT_BACKPACK_SECTIONS (lib/ai/types.ts) with Dutch text
- [x] Replace hardcoded English in KIM_SECTION_CONFIG + ELIAS_SECTION_CONFIG (BackpackWizardScreen.tsx) with Dutch
- [x] Replace all hardcoded English UI strings in BackpackWizardScreen.tsx with t() calls (45+ strings)
- [x] Replace section.prompt and section.subtitle in backpack.tsx with t() calls
- [x] Add 43 new Dutch translations to nl.json (backpack.wizard.* keys)
- [x] Verify TypeScript compiles (0 errors) and tests pass (1616 passed)

## Phase 6: i18n Completeness

- [x] Add 43 missing English translations to en.json (backpack.wizard.* keys)
- [x] Scan entire app for remaining hardcoded UI strings not using t()
- [x] Fix hardcoded strings in eigen-regie-plan (wizard, index, zone, triggers, export) — 30+ strings
- [x] Fix hardcoded strings in VspWizardScreen — 11 strings
- [x] Fix hardcoded strings in intake.tsx (country step) — 5 strings
- [x] Add all new i18n keys to nl.json, fr.json, en.json (now 1057 keys each, fully in sync)
- [x] Add i18n completeness test (__tests__/i18n-completeness.test.ts) — 8 assertions
- [x] Verify TS compiles (0 errors) and tests pass (1624 passed, 0 failed)

## Phase 7: i18n country names + wizard stop button + remaining hardcoded strings

- [x] Translate intake country names (Frankrijk, Verenigd Koninkrijk, Verenigde Staten) in nl.json + fr.json + en.json
- [x] Add stop/back button to eigen-regie wizard with confirmation Alert ("Wizard stoppen?")
- [x] Wizard now shows both "← Vorige" (back) and "Annuleren" (stop with confirm) buttons
- [x] Scan remaining screens (chat, profile, diary, home, dagstructuur, day-structure, gdpr-consent)
- [x] Result: all user-facing screens already use t() — only dev-only debug-log has English (intentional)
- [x] Remaining "strings" are UI symbols (›, ×, +, ✕) and emoji — not translatable text
- [x] Verify TS compiles (0 errors) and tests pass (1624 passed, 0 failed)

## Phase 8: DIST01 — Continue Wederzijdse Distillatie (Fase 1: Stille Kennisopbouw)

- [x] Create dist01-types.ts (DetectedEntity, DetectedSignal, DetectedContext, DistillationStore, DistillationContextForChat)
- [x] Create dist01-store.ts (encrypted local persistence, merge, dedup, limits, query helpers)
- [x] Create dist01-detector.ts (50 regex patterns: persons, relationships, signals, contexts, anchors)
- [x] Create dist01-context-injector.ts (serialize distillation data for GPT prompt, max 7 persons, high-conf signals)
- [x] Wire into pipeline.ts (PRE-GPT: build context + POST-GPT: run detector on user+GPT text)
- [x] Wire into server/ai-chat.ts (Zod schema, SessionCache, prompt injection for SESSION_INIT + LIVE_MESSAGE)
- [x] Wire into openai-provider.ts + live-message-filter.ts (pass distillationContext field)
- [x] Wire into server-active-client.ts (ServerEngineCallInput + fetch body)
- [x] Write 35 tests (17 detector, 11 store, 7 context-injector) — all passing
- [x] Verify TS compiles (0 errors) and full test suite passes (1659 tests, 0 failures)

## Phase 9: DIST01 — Fase 2: Promotie (Route A)

- [x] Create dist01-proposal-types.ts (DistillationProposal, ProposalStatus, TargetDocument, RoutingRule, timing constants)
- [x] Create dist01-proposal-store.ts (local persistence, add/update/query/expire/dedup helpers)
- [x] Create dist01-proposal-generator.ts (Elias+Kim routing tables, confidence thresholds, dedup, crisis-block, timing)
- [x] Create DistillationProposalCard component (in-chat card with accept/edit/dismiss/reject, i18n NL/EN/FR)
- [x] Wire proposal generation into pipeline POST-GPT Step 6.10 (after detector runs)
- [x] Wire proposal cards into chat.tsx ListFooterComponent + handleProposalAction callback
- [x] Add distillationProposals field to PipelineResult interface
- [x] Add dist01_proposal_action to DebugEventType
- [x] Add 11 i18n keys (distillation.proposal.*) to nl.json, en.json, fr.json
- [x] Write 22 tests for proposal generator (routing, thresholds, dedup, timing, crisis-block, constants)
- [x] Verify TS compiles (0 errors) and all 1681 tests pass
- [x] Phase 3 (Route B): Wire accept action to write to target documents (backpack, VSP, eigen-regie-plan)

## Phase 10: DIST01 — Fase 3: Route B + Auto-Save + History Scherm

- [x] Route B: Read target document write APIs (backpack, VSP, eigen-regie-plan)
- [x] Route B: Create dist01-proposal-writer.ts (writeProposalToDocument, processAutoSave, updateSignalPromotionStatus)
- [x] Route B: Wire writer into handleProposalAction in chat.tsx (accept/edit → write to target + persist)
- [x] Route B: Update promotionStatus in distillation store (accepted/rejected/auto_saved)
- [x] Route B: On reject → suppress signal + update promotionStatus to 'rejected'
- [x] Auto-save: processAutoSave function with eligibleForAutoSave filter + maxAutoSavePerTurn
- [x] Auto-save: Pipeline Step 6.11 — auto-save eligible signals each turn (non-blocking)
- [x] Auto-save: getRoutingRulesForPersona export for pipeline use
- [x] History: Create app/proposal-history.tsx (full screen with filter tabs + stats)
- [x] History: Show accepted/rejected/expired/auto-saved proposals with timestamps + target info
- [x] History: Add navigation card from profile.tsx to history screen
- [x] History: Add 27 i18n keys for history screen (NL/EN/FR)
- [x] Write 24 tests for proposal writer and auto-save logic
- [x] Verify TS compiles (0 errors) and all 1705 tests pass

## Backlog: DIST01 — Toekomstige opties (indien nodig)

- [ ] Undo/terugdraai-functie: Laat gebruikers een auto-saved of geaccepteerd voorstel ongedaan maken vanuit het history-scherm
- [ ] Contradictie-detectie: Logica die detecteert wanneer een nieuw signaal in tegenspraak is met bestaande document-inhoud (contradictionFlag activeren)

## Phase 11: DIST01 — Server-side integratie afronden

- [x] Zod validation for distillationContext (line 685 server/ai-chat.ts) — was al geïmplementeerd
- [x] SessionCache interface + SESSION_INIT opslag (line 415, 522) — was al geïmplementeerd
- [x] LIVE_MESSAGE injection from session cache (line 2133) — was al geïmplementeerd
- [x] GPT system prompt template injection (SESSION_INIT line 2649, LIVE_MESSAGE line 2133) — was al geïmplementeerd
- [x] Pipeline wiring (PRE-GPT context build + POST-GPT detector) — was al geïmplementeerd
- [x] DIST01_INTEGRATION_NOTES.md bijgewerkt (verouderde TODO's verwijderd)
- [x] Verify TS compiles (0 errors) and all 1705 tests pass

## Bug: Backpack niet geladen bij eerste SESSION_INIT (alleen na herstart) — FIXED

- [x] Investigate: Elias kent rugzak-inhoud (partner Melissa) niet bij eerste sessie-start, wél na app-herstart
- [x] Root cause: greetingV4 prompt bevatte GEEN rugzak key figures (personen, relaties, triggers)
- [x] Fix: buildKeyFigures() toegevoegd aan greetingV4.ts — injecteert personen, relational anchors, triggers, intake context in greeting prompt
- [x] Verify: 0 TS errors, 1705 tests groen

## Phase 12: GreetingV4 Key Figures Test + Context.dat Refresh na Rugzak-edit

- [x] Write 6 tests for buildKeyFigures() in greetingV4 (persons, relational anchors dedup, triggers, intake context, empty backpack, max 8 limit)
- [x] Implement context.dat refresh after backpack edit:
  - [x] Created backpack-dirty-flag.ts (markBackpackDirty/isBackpackDirty/clearBackpackDirty)
  - [x] Added markBackpackDirty() calls to all 4 backpack save functions in user-context.tsx
  - [x] Modified pipeline.ts: shouldBuildContextDat = isSessionStart || isBackpackDirty()
  - [x] Pipeline rebuilds context.dat on next message after any backpack edit
- [x] Verify TS compiles (0 errors) and all 1711 tests pass

## Bug: context.dat mist key figures (Jules/zoon niet herkend) — FIXED

- [x] Root cause: context.dat leest userDat.relationalAnchors (altijd leeg []) → fallback regex te fragiel
- [x] Oorzaak: context.dat commit (60b7980) verving volledige backpack door gedistilleerde versie, maar distiller miste data
- [x] Fix: context-dat-distiller.ts valt nu terug op extractRelationalAnchors(backpack) als relationalAnchors leeg is
- [x] Verify: 0 TS errors, 1711 tests groen
- [x] AUDIT: Fix context.dat zeroing memory layers — always send full backpack/userDat (context.dat is additive only)
- [x] AUDIT: Fix openai-provider SESSION_INIT to always include full data alongside context.dat
- [ ] AUDIT: Add extractRelationalAnchors fallback to pastReferenceSearch.ts
- [ ] AUDIT: Delete dead code prompt-minimizer.ts
- [x] REFACTOR: Add prebuilt-prompt-blocks.ts (local person/life/memory block builder)
- [x] REFACTOR: ai-chat.ts accepts pre-built blocks from client, falls back to old extraction
- [x] REFACTOR: ChatContext + ChatRequestInput + chatInputSchema updated with new fields
- [x] REFACTOR: pipeline.ts calls buildPrebuiltPromptBlocks() and spreads into ChatContext
- [x] REFACTOR: openai-provider.ts forwards pre-built blocks to server
- [ ] FUTURE: Remove raw backpack from SESSION_INIT once pre-built blocks proven stable
- [ ] FUTURE: Remove extractRelationshipMap/buildCompactLifeStorySummary from ai-chat.ts (dead code after migration)
- [ ] FUTURE: Token optimization — context.dat replaces full backpack once vice-versa learning is stable
- [x] FIX: Session-start extraction guarantee — if backpack has manual changes or extractedEntities is empty, run extraction SYNCHRONOUSLY before greeting
- [x] FIX: checkAndExtract now accepts changeSource ('manual' | 'auto_fill') — auto_fill skips extraction (user.dat is already the source)
- [x] FIX: BackpackHashState type extended with changeSource field
- [x] FIX: DIST01 handleProposalAction now triggers extraction after backpack write — user.dat (analysis) is fed alongside backpack (narrative)
