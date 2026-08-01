# RecoFree App — Project Structure

**Last updated:** 2026-08-01 | **Total files:** ~861 (excl. node_modules)

---

## Top-Level Overview

| Directory | Files | Purpose |
|-----------|-------|---------|
| `app/` | 21 | Expo Router screens (tabs, modals, nested routes) |
| `components/` | 31 | Reusable UI components (screen-container, day-structure, profile, ui) |
| `constants/` | 3 | Design tokens, theme constants |
| `hooks/` | 4 | Custom React hooks (useAuth, useColors, useColorScheme) |
| `lib/` | 576 | Core business logic, engine, pipeline, storage, i18n, features |
| `server/` | 45 | Backend API (tRPC, AI chat, backpack analysis, auth) |
| `shared/` | 3 | Types and constants shared between client and server |
| `__tests__/` | 73 | Integration and unit tests (organized by feature) |
| `tests/` | 23 | Additional integration tests (server-side, pipeline) |
| `scripts/` | 32 | Dev/debug scripts, one-off tools |
| `drizzle/` | 6 | Database migrations and schema |
| `docs/` | 12 | Internal documentation |
| `specs/` | 2 | Module specification comparisons |
| `assets/` | — | App icons, splash images |

---

## App Screens (`app/`)

```
app/
├── _layout.tsx                 ← Root layout (providers, fonts, theme)
├── intake.tsx                  ← Onboarding wizard (user type, country, context)
├── gdpr-consent.tsx            ← GDPR consent screen
├── (tabs)/
│   ├── _layout.tsx             ← Tab bar configuration
│   ├── index.tsx               ← Home screen (greeting, navigation cards)
│   ├── chat.tsx                ← AI chat (Elias/Kim)
│   ├── mood.tsx                ← Mood sliders (Elias: craving/frustration/despondency/focus)
│   ├── diary.tsx               ← Daily diary + gratitude journal
│   ├── backpack.tsx            ← Rugzak (life story sections, editable)
│   ├── day-planning.tsx        ← Day structure overview
│   └── profile.tsx             ← Settings, export, debug access
├── day-structure/
│   ├── wizard.tsx              ← Day structure creation wizard
│   └── editor.tsx              ← Day structure editor
├── eigen-regie-plan/
│   ├── index.tsx               ← Plan overview (zones, reminder toggle)
│   ├── wizard.tsx              ← Plan creation wizard (manual + AI generation)
│   ├── zone.tsx                ← Individual zone detail/edit
│   ├── triggers.tsx            ← Trigger management
│   └── export.tsx              ← Export plan as text for therapist
├── dev/
│   ├── debug-log.tsx           ← Developer debug log viewer
│   └── theme-lab.tsx           ← Theme color preview (dev only)
└── oauth/
    └── callback.tsx            ← OAuth callback handler
```

---

## Core Logic (`lib/`)

```
lib/
├── _core/                      ← NativeWind pressable fix, theme builder
├── ai/                         ← AI types, backpack sections, module registry
│   └── types.ts                ← Central type definitions (Backpack, UserDat, etc.)
├── backpack-analysis/          ← Client-side backpack analysis utilities
├── backpack-extractor/         ← Extract structured data from backpack text
├── core/time/                  ← Time utilities
├── crisis/                     ← Crisis detection and failsafe logic
├── crypto/                     ← Encryption utilities (AES-256-GCM)
├── debug/                      ← Import diagnostics
├── engine/                     ← 🔑 CORE: Therapeutic AI engine
│   ├── elias/                  ← Elias persona (addiction recovery)
│   │   ├── modules/            ← 16 Elias-specific modules (PAAL01, BLIK01, etc.)
│   │   ├── shadow/             ← Shadow work engine
│   │   └── stoicism/           ← Stoic philosophy engine
│   ├── kim/                    ← Kim persona (caregiver support)
│   │   └── modules/            ← 20 Kim-specific modules (clusters, relapse, etc.)
│   ├── shared/                 ← Shared engines (ACT, CGT, MBT, MI, Schema) + DIST01 Distillation
│   ├── local-llm/             ← Local LLM integration
│   └── debug/                  ← Engine debug output
├── features/                   ← Feature modules (UI + logic)
│   ├── backpackWizard/         ← Backpack creation wizard
│   ├── balkmetafoor/           ← Balance metaphor visualization
│   ├── dayStructure/           ← Day planning notifications + logic
│   ├── diary-export/           ← Diary export functionality
│   ├── diary-search/           ← Diary search functionality
│   ├── eigenRegie/             ← Eigen Regie notification service
│   ├── exportImport/           ← Full data export/import (encrypted)
│   ├── greetingV4/             ← Smart greeting system
│   ├── milestone-tracker/      ← Recovery milestone tracking
│   ├── mood-trend/             ← Mood trend analysis
│   ├── prevention-plan/        ← VSP (Veiligheidsplan)
│   ├── sessionGreeting/        ← Session greeting logic
│   ├── vspInsight/             ← VSP insight generation
│   └── vspWizard/              ← VSP creation wizard
├── i18n/                       ← Internationalization
│   └── locales/                ← nl.json, fr.json, en.json (1063 keys each)
├── migration/                  ← Data migration utilities
├── pipeline/                   ← Message processing pipeline
│   └── memory/                 ← Memory management (commit, write-back, lifecycle)
├── rugzak/                     ← 🔑 CORE: Engine orchestration layer
│   ├── pipeline.ts             ← Main 17-step execution pipeline
│   ├── engine.ts               ← State engine
│   ├── gpt-payload-builder.ts  ← GPT payload construction
│   ├── dominant-state-selector.ts
│   ├── regulation-decay-engine.ts
│   ├── short-term-memory-buffer.ts
│   ├── relational-anchor-detector.ts
│   ├── relational-pattern-analyzer.ts
│   ├── cost-control.ts
│   └── ...
├── storage/                    ← Persistence layer
│   ├── crypto/                 ← Storage encryption
│   └── memory/                 ← Memory stores (userDat, stateDat, logsDat, etc.)
├── types/                      ← TypeScript type definitions
│   └── memory/                 ← Memory architecture types
├── utils/                      ← Utility functions (arrays, hash, math, time, tokens)
├── theme-provider.tsx          ← Theme context (light/dark)
├── trpc.ts                     ← tRPC client configuration
├── user-context.tsx            ← User state provider
└── utils.ts                    ← cn() utility
```

---

## Server (`server/`)

```
server/
├── _core/                      ← Framework (tRPC, Express, OAuth, env, SDK)
│   ├── index.ts                ← Server entry point
│   ├── trpc.ts                 ← tRPC router setup
│   ├── llm.ts                  ← Built-in LLM (invokeLLM)
│   ├── oauth.ts                ← OAuth authentication
│   └── ...
├── routers.ts                  ← All tRPC route registrations
├── ai-chat.ts                  ← Main AI chat endpoint (system prompt, GPT call)
├── engine-process.ts           ← Server-side engine processing
├── engine/                     ← Server-side engine modules
│   ├── buffer-server.ts
│   ├── gpt-payload-server.ts
│   ├── regulation-server.ts
│   └── ...
├── session-greeting.ts         ← Smart greeting generation
├── backpack-extractor.ts       ← AI-powered backpack extraction
├── backpack-analyzer.ts        ← Backpack analysis
├── kerp01-generate.ts          ← AI eigen-regie plan generation
├── signal-engine.ts            ← Signal detection engine
├── gpt-proxy.ts                ← GPT proxy for client
├── pre-translate.ts            ← Input translation
├── db.ts                       ← Database connection (Drizzle + PostgreSQL)
└── storage.ts                  ← File storage integration
```

---

## Tests (`__tests__/` + `tests/`)

```
__tests__/                      ← 73 test files organized by feature
├── backpack-extractor/         ← Backpack extraction tests
├── eigenRegie/                 ← Eigen Regie plan tests
├── engine/                     ← Engine pipeline tests
├── kimCluster3-5/              ← Kim module cluster tests
├── kimDangerChildCluster/      ← Kim danger child tests
├── kimRelapseCluster/          ← Kim relapse cluster tests
├── memory/                     ← Memory architecture tests
├── sessionGreeting/            ← Greeting system tests
├── exportImport/               ← Export/import tests
├── i18n-completeness.test.ts   ← 🆕 Locale sync validation
└── ...

tests/                          ← 23 integration test files
├── ai-chat.test.ts             ← Server AI chat integration
├── crisis-language-detection.ts
├── zone-routing.test.ts
└── ...
```

**Test stats:** 1659 tests passing, 0 failing, 1 skipped

---

## Configuration (Root)

| File | Purpose |
|------|---------|
| `app.config.ts` | Expo app configuration (name, bundle ID, plugins) |
| `tailwind.config.js` | Tailwind CSS configuration |
| `theme.config.js` | Color tokens (shared by Tailwind + runtime) |
| `tsconfig.json` | TypeScript configuration |
| `vitest.config.ts` | Test runner configuration |
| `metro.config.js` | Metro bundler configuration |
| `package.json` | Dependencies and scripts |
| `todo.md` | Feature tracking (2563 lines, all complete) |
| `global.css` | Tailwind directives |

---

## Key Architecture Decisions

1. **Dual-store persistence:** `backpack.json` (identity, user-editable) + `user.dat` (dynamic session memory, system-managed)
2. **17-step pipeline:** Deterministic execution order (decay → buffer → regulation → dominant state → payload → GPT → post-process)
3. **Engine separation:** Elias (addiction) and Kim (caregiver) have independent module trees but share ACT/CGT/MBT/MI/Schema engines
4. **i18n:** 3 locales (nl/fr/en) with 1063 keys each, fallback chain: selected → nl → key
5. **Server-side AI:** All GPT calls go through server (cost control, prompt injection prevention, model routing)
6. **Memory architecture:** 5 stores (userDat, stateDat, logsDat, projectionsDat, sessionBuffer) with atomic writes
7. **DIST01 Distillation:** Continuous entity/signal/context extraction from chat → local encrypted store → GPT context injection for chat continuity ("Hoe gaat het met Melissa?")
