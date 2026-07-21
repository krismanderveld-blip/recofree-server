# RecoFree — Project Structure Map

Generated: 21 Jul 2026 | 680+ source files | Expo SDK 54 + Express backend

## Architecture Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| **Mobile App** | `app/`, `components/`, `hooks/` | Expo Router screens, UI components, React hooks |
| **AI Engine** | `lib/ai/`, `lib/rugzak/`, `lib/pipeline/` | GPT payload assembly, context distillation, deepening |
| **Therapy Engines** | `lib/engine/`, `src/modules/` | Elias (verslaafde) + Kim (naaste) therapy modules |
| **Memory Layer** | `lib/storage/`, `lib/crypto/`, `lib/memory/` | Encrypted local storage, session cache, memory lifecycle |
| **Signal & Regulation** | `lib/signal/`, `lib/regulation/`, `lib/crisis/` | Semantic signal detection, mood regulation, crisis handling |
| **Backend Server** | `server/` | Express + tRPC, server-side GPT payload, auth |
| **Advanced Features** | `src/features/`, `src/modules/` | VSP insight, psycho-education, advanced therapy modules |
| **Confirmation Layer** | `lib/engine/shared/tendency-confirmation.ts` | Multi-source schema/mode verification (auto + clinical + user ack) |
| **Eigen Regie (Kim)** | `lib/engine/kim/eigen-regie-engine.ts` | Kim-specific eigen regie zone system (replaces stageOfChange) |

## File Tree

```
.project-config.json
CLINICAL_ARCHITECTURE_DIAGNOSIS.md
CONVERSATION_HISTORY_FIX.md
ENGINE_PROCESS_SPEC.md
EXPORT_DIAGNOSIS.md
GDPR_COMPLIANCE.md
PERSON_RECOGNITION_FIX.md
PROBLEM_ANALYSIS.md
RECOFREE_LITE_SPEC.md
ROADMAP_COVERAGE_REPORT.md
ROOT_CAUSE_ANALYSIS.md
STORE_INVENTORY_REPORT.md
app.config.ts
audit-elias-logic.md
babel.config.js
dagstructuur-gap-analysis.md
design.md
drizzle.config.ts
eas.json
elias-audit-working.md
elias-encapsulation-audit.md
elias-logic-map.md
eslint.config.js
expo-env.d.ts
global.css
kim-audit-final.md
kim-audit-post-mp5.md
kim-deep-audit-working.md
kim-logic-map.md
metro.config.js
nativewind-env.d.ts
package.json
tailwind.config.js
theme.config.d.ts
theme.config.js
todo.md
tsconfig.json
ui-strings-collected.json
vitest.config.ts

app/ — Expo Router screens and layouts [3 files]
    _layout.tsx
    gdpr-consent.tsx
    intake.tsx
    (tabs)/ — Tab-based main screens (chat, mood, diary, backpack, profile, day-planning) [8 files]
      _layout.tsx
      backpack.tsx
      chat.tsx
      day-planning.tsx
      diary.tsx
      index.tsx
      mood.tsx
      profile.tsx
    day-structure/ — Day structure wizard and editor screens [2 files]
      editor.tsx
      wizard.tsx
    dev/ — Developer debug tools (theme lab, debug log) [2 files]
      debug-log.tsx
      theme-lab.tsx
    oauth/ — OAuth callback handler [1 files]
      callback.tsx
assets/ — Static assets (images, fonts)
    images/ — App icons, splash screen, favicons
components/ — Reusable UI components [17 files]
    animated-tab-icon.tsx
    chat-error-boundary.tsx
    emergency-card.tsx
    external-link.tsx
    haptic-tab.tsx
    hello-wave.tsx
    home-button.tsx
    milestone-card.tsx
    mood-trend-chart-card.tsx
    parallax-scroll-view.tsx
    prechat-eigen-regie.tsx
    prechat-vsp.tsx
    progress-card.tsx
    screen-container.tsx
    sober-counter.tsx
    themed-view.tsx
    vsp-section-editor.tsx
    day-structure/ — Day structure wizard step components [8 files]
      home-card.tsx
      scroll-wheel-time-picker.tsx
      wizard-activities.tsx
      wizard-copy-week.tsx
      wizard-intro.tsx
      wizard-review.tsx
      wizard-sleep.tsx
      wizard-wake.tsx
    profile/ — Profile screen sub-components [2 files]
      BalkmetafoorCard.tsx
      NotificationPermissionCard.tsx
    ui/ — Base UI primitives (icons, collapsible) [3 files]
      collapsible.tsx
      icon-symbol.ios.tsx
      icon-symbol.tsx
constants/ — App-wide constants (theme, oauth, design tokens) [4 files]
    const.ts
    design.ts
    oauth.ts
    theme.ts
docs/ — Architecture documentation and analysis reports [10 files]
    Geheugenlagen_Update_Mechanisme.md
    Greeting_Architectuur_Diagnose.md
    RecoFree_Architectuur_Klinisch_Privacy.md
    fase4-local-llm-archive.md
    key-findings.md
    rapport-model-routing-and-detectsignals.md
    schema-mode-canon-notes.md
    server-migration-analysis.md
    shadow-validation-report.md
    vsp-document-structure.md
drizzle/ — Database schema and migrations (Drizzle ORM) [2 files]
    relations.ts
    schema.ts
    meta/ [2 files]
      0000_snapshot.json
      _journal.json
    migrations/
hooks/ — Custom React hooks (auth, colors, color scheme) [4 files]
    use-auth.ts
    use-color-scheme.ts
    use-color-scheme.web.ts
    use-colors.ts
lib/ — Core application logic [4 files]
    theme-provider.tsx
    trpc.ts
    user-context.tsx
    utils.ts
    _core/ — Framework internals (API client, auth, theme, NativeWind) [5 files]
      api.ts
      auth.ts
      manus-runtime.ts
      nativewind-pressable.ts
      theme.ts
    ai/ — AI provider layer (OpenAI integration, payload filtering, types) [9 files]
      gdpr-config.ts
      index.ts
      live-message-filter.ts
      mock-provider.ts
      openai-provider.ts
      preprocessor.ts
      prompt-minimizer.ts
      response-post-check.ts
      types.ts
    backpack-analysis/ — Schema/mode trigger analysis from backpack data [2 files]
      client.ts
      schema-mode-trigger.ts
    backpack-extractor/ — VSP backpack content extraction and hashing [7 files]
      client.ts
      extractor.ts
      hash.ts
      index.ts
      types.ts
      vsp-backpack-analyzer.ts
      vsp-backpack-client.ts
    core/
      time/ — Time provider abstraction (internal clock, device time) [7 files]
        (7 files)
    crisis/ — Crisis detection and emergency resources [2 files]
      detector.ts
      resources.ts
    crypto/ — Encryption layer (SessionMemoryCache, AES storage) [2 files]
      session-memory-cache.ts
      storage-encryption.ts
    debug/ — Debug tooling (engine trace, session logger, diagnostics) [3 files]
      engine-trace.ts
      import-diagnostics.ts
      session-logger.ts
    engine/ — Therapy engine modules [8 files]
      buffer-enrichment.ts
      crisis-prompt-helper.ts
      feedback-loop.ts
      module-reconsideration.ts
      orchestration.ts
      signal-parser.ts
      signal-router.ts
      zone-types.ts
      debug/ [1 files]
        (1 files)
      elias/ — Elias-specific engines (ACT, EKT01, MI01, RETP, etc.) [24 files]
        (24 files)
        shadow/ [9 files]
        stoicism/ [7 files]
      kim/ — Kim-specific engines (K01-K06, KST01, KDL01, etc.) [31 files]
        (31 files)
      local-llm/ [5 files]
        (5 files)
      shared/ — Shared engines (CGT, DBT, MBT, SchemaMode, STOA) [27 files]
        (27 files)
    features/
      backpackWizard/ [2 files]
        (2 files)
      dayStructure/ [13 files]
        (13 files)
      diary-search/ [2 files]
        (2 files)
      exportImport/ [1 files]
        (1 files)
        crypto/ [2 files]
        errors/ [1 files]
        filePicker/ [1 files]
        hooks/ [1 files]
        migrations/ [1 files]
        services/ [4 files]
        types/ [3 files]
        ui/ [3 files]
        version/ [1 files]
      greetingV4/ [1 files]
        (1 files)
      milestone-tracker/ [3 files]
        (3 files)
      mood-trend/ [3 files]
        (3 files)
      sessionGreeting/ [23 files]
        (23 files)
      vspWizard/ [2 files]
        (2 files)
    i18n/ — Internationalization (NL/EN translations) [2 files]
      i18n-provider.tsx
      index.ts
      locales/ [3 files]
        (3 files)
    migration/ [11 files]
      build-engine-input.ts
      engine-input.types.ts
      engine-mode.ts
      engine-output.types.ts
      golden-testset.ts
      index.ts
      patch-writer.ts
      server-active-client.ts
      shadow-engine-client.ts
      shadow-log-store.ts
      shadow-log.ts
    modules/ [1 files]
      module-system.ts
    pipeline/ — Pipeline modules (context.dat distillation, deepening, memory lifecycle) [4 files]
      context-dat-deepening.ts
      context-dat-distiller.ts
      deepening-cache.ts
      nano-interpret-client.ts
      memory/ [13 files]
        (13 files)
    rugzak/ — Core pipeline orchestrator (GPT payload builder, cost control) [15 files]
      backpack-relevance-analyzer.ts
      chat-history-manager.ts
      cost-control.ts
      dominant-state-selector.ts
      engine.ts
      gpt-payload-builder.ts
      pipeline.ts
      projection-layer.ts
      regulation-decay-engine.ts
      regulation-layer.ts
      relational-anchor-detector.ts
      relational-pattern-analyzer.ts
      short-term-memory-buffer.ts
      state-analyzer.ts
      userdat-promotion.ts
    storage/ — Storage layer (AsyncStorage, memory stores, encrypted JSON)
      crypto/ [3 files]
        (3 files)
      memory/ [11 files]
        (11 files)
    types/
      memory/ [7 files]
        (7 files)
    utils/
      arrays/ [1 files]
        (1 files)
      hash/ [3 files]
        (3 files)
      json/ [1 files]
        (1 files)
      math/ [2 files]
        (2 files)
      time/ [1 files]
        (1 files)
      tokens/ [1 files]
        (1 files)
modules/
    elias/
      fale01/ [6 files]
        (6 files)
      iden01/ [6 files]
        (6 files)
      mi02/ [6 files]
        (6 files)
      rouw01/ [6 files]
        (6 files)
      slaap01/ [6 files]
        (6 files)
      terv01/ [6 files]
        (6 files)
      verg01/ [6 files]
        (6 files)
      zink01/ [6 files]
        (6 files)
    kim/
      bedr01/ [6 files]
        (6 files)
      cdp01/ [6 files]
        (6 files)
      dangerChildCluster/ [9 files]
        (9 files)
      emotionalLossCluster/ [10 files]
        (10 files)
      fin01/ [6 files]
        (6 files)
      gasl01/ [6 files]
        (6 files)
      iso01/ [5 files]
        (5 files)
      kbr01/ [6 files]
        (6 files)
      kdl01/ [6 files]
        (6 files)
      ksc01/ [6 files]
        (6 files)
      kst01/ [6 files]
        (6 files)
      par01/ [6 files]
        (6 files)
      relapseCluster/ [9 files]
        (9 files)
        CRISIS-K01/ [1 files]
        HERV-K01/ [1 files]
        NAHERV-K01/ [1 files]
      relationalDynamicsCluster/ [10 files]
        (10 files)
      rnw01/ [6 files]
        (6 files)
      slaap01/ [6 files]
        (6 files)
      stoaK/ [10 files]
        (10 files)
      vetr01/ [6 files]
        (6 files)
scripts/ — Build and utility scripts [10 files]
    decrypted-payload.json
    live-diary-timestamp-test.ts
    live-e2e-test.ts
    load-env.js
    reset-project.js
    test-detector.ts
    test-full-session-rood.ts
    test-greeting-rood.ts
    test-groen-geel-craving.ts
    test-live-message-turn5.ts
server/ — Backend server (Express + tRPC) [19 files]
    README.md
    ai-chat.ts
    backpack-analysis.ts
    backpack-analyzer.ts
    backpack-document-parse.ts
    backpack-extractor.ts
    db.ts
    debug-prompt.ts
    engine-process.ts
    gpt-proxy.ts
    nano-interpret-proxy.ts
    pre-translate.ts
    routers.ts
    session-greeting.ts
    signal-engine.ts
    storage.ts
    vsp-backpack-analysis.ts
    vsp-document-parse.ts
    vsp-text-extract.ts
    _core/ — Server framework (routes, middleware, auth) [13 files]
      context.ts
      cookies.ts
      dataApi.ts
      env.ts
      imageGeneration.ts
      index.ts
      llm.ts
      notification.ts
      oauth.ts
      sdk.ts
      systemRouter.ts
      trpc.ts
      voiceTranscription.ts
      types/ [2 files]
        (2 files)
    engine/ — Server-side engine (GPT payload builder) [10 files]
      buffer-server.ts
      dominant-state-selector-server.ts
      gpt-payload-server.ts
      loopblocker-server.ts
      nano-interpret.ts
      past-reference-server.ts
      regulation-server.ts
      signal-engine-server.ts
      state-analyzer-server.ts
      vsp-insight-server.ts
shared/ [2 files]
    const.ts
    types.ts
    _core/ [1 files]
      errors.ts
specs/ [1 files]
    PAAL01_SPEC_COMPARISON_ANALYSIS.md
src/ — Extended source modules (advanced features)
    features/ — Feature modules (balkmetafoor, dagstructuur, milestones, psychoEducation, vspInsight)
      vspInsight/ [15 files]
        detectOverwhelmSignals.ts
        detectRationalGreenSignals.ts
        detectVspInsightState.ts
        index.ts
        kimVspVariant.ts
        vspChatSignalAdapter.ts
        vspDgtSoothingFlow.ts
        vspInsightPdfExport.ts
        vspInsightPhaseTracker.ts
        vspInsightPipelineLayer.ts
        vspInsightRouter.ts
        vspInsightStorage.ts
        vspInsightTypes.ts
        vspIntakeAdapters.ts          ← NEW: wheel-of-change, early signs, self-image adapters
        vspOutputSafetyFilter.ts      ← NEW: post-GPT audit (clinical term leakage, framework disclosure)
    modules/ — Advanced therapy modules (Elias + Kim)
      elias/ — Elias advanced modules (AUTOPILOT01, BLIK01, COEX01, IKST01, ONTK01, PAAL01, WILSKRACHT01) [2 files]
        (2 files)
        AUTOPILOT01/ [5 files]
        BLIK01/ [6 files]
        COEX01/ [6 files]
        IKST01/ [6 files]
        ONTK01/ [6 files]
        PAAL01/ [6 files]
        WILSKRACHT01/ [5 files]
        psychoEducation/ [3 files]
      kim/ — Kim advanced modules (AANP-K01, BEHE-K01, CODEP-K01, PAAL-K01) [1 files]
        (1 files)
        AANP-K01/ [6 files]
        BEHE-K01/ [6 files]
        CODEP-K01/ [6 files]
        PAAL-K01/ [6 files]
    pipeline/
      memory/ — Advanced memory context assemblers [3 files]
        (3 files)
    types/ — Type definitions for advanced features [5 files]
      balkmetafoor.types.ts
      eliasPsychoEducation.types.ts
      eliasSelfAcceptanceCluster.types.ts
      eliasSteunpilaren.types.ts
      kimPatternsSupport.types.ts
```

## Key Modules & Their Roles

### AI Pipeline (request flow)

```
User message → chat.tsx
  → lib/rugzak/pipeline.ts (orchestrator)
    → lib/signal/ (semantic signal detection)
    → lib/regulation/ (mood zone + decay)
    → lib/engine/ (module selection: ACT, DBT, CGT, MBT, Schema, STOA...)
    → lib/pipeline/context-dat-distiller.ts (distill user.dat/state.dat → context.dat)
    → lib/pipeline/context-dat-deepening.ts (add priority-ranked deepening fragments)
    → lib/rugzak/gpt-payload-builder.ts (assemble GPT payload)
    → lib/ai/live-message-filter.ts (slim: only active fields)
    → lib/ai/openai-provider.ts (send to OpenAI)
  → Response → chat.tsx
```

### Memory Layers

| Layer | File | Content |
|-------|------|---------|
| user.dat | `lib/storage/memory/userDatStore.ts` | Schemas, modes, key figures, triggers, tendencies |
| state.dat | `lib/storage/memory/stateDatStore.ts` | Mood history, current zone, regulation state |
| logs.dat | `lib/storage/memory/logsDatStore.ts` | Session summaries, topics, breakthroughs |
| projections.dat | `lib/storage/memory/projectionsDatStore.ts` | Fears, hopes, active projections |
| context.dat | `lib/pipeline/context-dat-distiller.ts` | Distilled per-turn context (schemas, modes, trend, sessions) |

### Personas

| Persona | Target User | Engines |
|---------|-------------|---------|
| **Elias** | Verslaafde (addicted person) | RETP, STOA, STO01, SW01, ACT, CGT, DBT, MBT, SchemaMode, EKT01, MI01, M05-M85, AUTOPILOT01, BLIK01, COEX01, IKST01, ONTK01, PAAL01, WILSKRACHT01 |
| **Kim** | Naaste (caregiver/loved one) | K01-K06, KST01, KDL01, KBR01, KSC01, CDP01, RNW01, ISO01, AANP-K01, BEHE-K01, CODEP-K01, PAAL-K01 |

### Persona-Specific Gating

| Feature | Elias | Kim |
|---------|-------|-----|
| stageOfChange (prompt injection) | Yes (contemplation→maintenance) | No (gated out) |
| eigenRegieContext (prompt injection) | No | Yes (zone-based directives) |
| Eigen Regie slider (mood screen) | Hidden | Visible (0-100) |
| Schema/Mode confirmation | Both | Both |

### Eigen Regie System (Kim-only, replaces stageOfChange)

```
Kim mood input (0-100 slider)
  → lib/engine/kim/eigen-regie-engine.ts (zone mapping: RED/ORANGE/YELLOW/LIGHTGREEN/GREEN)
    → processEigenRegie() → EigenRegieContext { zone, score, meaning, primaryDirective, secondaryDirective }
  → lib/ai/openai-provider.ts (SESSION_INIT + LIVE_MESSAGE payload)
  → server/ai-chat.ts (system prompt injection: "EIGEN REGIE ZONE: ...")
```

| Zone | Score Range | Meaning |
|------|-------------|----------|
| RED | 0-20 | Minimale eigen regie, maximale ondersteuning nodig |
| ORANGE | 21-40 | Beperkte eigen regie, veel begeleiding nodig |
| YELLOW | 41-60 | Matige eigen regie, gerichte ondersteuning |
| LIGHTGREEN | 61-80 | Goede eigen regie, lichte coaching |
| GREEN | 81-100 | Sterke eigen regie, bekrachtiging |

### Schema/Mode Confirmation Layer V2 (Multi-Source Verification)

```
Detection (auto, per-turn)
  → lib/engine/shared/schema-mode-router.ts (detects modes/schemas from user message)
  → lib/engine/shared/tendency-confirmation.ts (tracks acknowledgment score)

Acknowledgment sources:
  1. Auto-detect: +1 per detection (frequency≥3 needed)
  2. Clinical ack: +2 (therapist confirms via ClinicalTag button)
  3. User self-ack: +2 (user says "ja dat herken ik" etc.)

Confirmation threshold: acknowledgmentScore ≥ 5 AND frequency ≥ 3 AND confidence ≥ 0.6

Prompt injection:
  - CANDIDATE: not injected in KNOWN USER PATTERNS
  - CANDIDATE + acknowledged: injected as "MOGELIJKE PATRONEN (EXPLORATIEF)" (voorzichtig)
  - CONFIRMED: injected in KNOWN USER PATTERNS (vaststaand)
```

| File | Role |
|------|------|
| `lib/engine/shared/tendency-confirmation.ts` | Core logic: apply ack, check confirmation, detect user/clinical ack |
| `lib/rugzak/pipeline.ts` (step 5f.2) | Detects user-ack and clinical-ack per turn |
| `lib/rugzak/short-term-memory-buffer.ts` | Stores lastPresentedMode/Schema for next-turn detection |
| `lib/ai/openai-provider.ts` | Builds acknowledgedCandidates payload |
| `server/ai-chat.ts` | Injects MOGELIJKE PATRONEN block in system prompt |
| `app/(tabs)/chat.tsx` (ClinicalTag) | Confirm button UI for clinicians |

### VSP Insight Intake Adapters

```
SESSION_INIT (pipeline.ts)
  → runVspIntakeAdapters(backpack, userDat)
    → adaptWheelOfChange(): maps stageOfChange → WheelOfChangeSnapshot
    → adaptEarlySigns(): extracts signals from VSP zones → VspSelfReportedEarlySign[]
    → adaptSelfImage(): extracts self-image patterns from backpack sections
  → applyVspInsightProfilePatch(profile, result) → merged VspInsightProfile
  → runVspInsightLayer(input with enriched profile)
```

### VSP Output Safety Filter

```
Post-GPT (pipeline.ts)
  → auditVspOutputSafety(response, { insightState, framework, clinicalModeActive })
    → Checks: clinical terminology, framework disclosure, discrepancy disclosure,
              store violations, percentage leaks, schema/mode naming
    → Returns: { safe, violations[], severity, suggestedRedaction }
    → Clinical mode: bypasses all checks
  → Violations logged to debug trace (no response modification)
```

### Payload Optimisation Stack

| Component | File | Token Saving |
|-----------|------|--------------|
| context.dat distiller | `lib/pipeline/context-dat-distiller.ts` | ~24k tokens vs raw JSON dump |
| Slim LIVE_MESSAGE filter | `lib/ai/live-message-filter.ts` | Only active fields per turn (incl. eigenRegieContext) |
| Deepening cap (500 tok) | `lib/pipeline/context-dat-deepening.ts` | Priority-ranked, crisis-first |
| Deepening cache | `lib/pipeline/deepening-cache.ts` | Avoids re-scanning same fragments |
| Conversation window (10) | `lib/rugzak/gpt-payload-builder.ts` | 10 recent + summary + crisis retention |
| Token truncation (200/msg) | `lib/rugzak/gpt-payload-builder.ts` | Long messages capped at ~800 chars |

