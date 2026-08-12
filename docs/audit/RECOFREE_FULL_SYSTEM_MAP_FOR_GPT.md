# RecoFree Full System Map for GPT

**Date:** 2026-08-12
**Status:** P0 Structural Audit — Read-Only
**Last Known Good Checkpoint:** d52f1273

---

## 1. Product Overview

RecoFree is a mobile mental health support app (React Native / Expo SDK 54) with two AI personas:

- **Elias** — addiction recovery coach for persons with substance dependency
- **Kim** — relational therapist for caregivers/partners of persons with addiction

**Architecture:** Client-first. The deterministic engine runs entirely on-device. The server is a pure GPT proxy (Railway). No clinical logic on server.

---

## 2. Personas

| Persona | Target User | Role | Safety Domain |
|---------|-------------|------|---------------|
| Elias | Person with addiction | Recovery coach | Cold turkey, relapse, crisis, suicidal ideation |
| Kim | Caregiver/partner | Relational therapist | Self-loss, boundary fatigue, child safety, relational harm |

**Hard rule:** Kim and Elias are strictly separated. No cross-persona memory, no shared clinical state, no VSP/sobriety data in Kim, no relational/ERP data in Elias.

---

## 3. Core Screens

| Screen | File | Status |
|--------|------|--------|
| Home/Index | app/(tabs)/index.tsx | Stable |
| Chat | app/(tabs)/chat.tsx | Stable — main interaction |
| Mood/Check-in | app/(tabs)/mood.tsx | Stable |
| Backpack (Rugzak) | app/(tabs)/backpack.tsx | Stable |
| Diary | app/(tabs)/diary.tsx | Stable |
| Day Planning | app/(tabs)/day-planning.tsx | Stable |
| Profile | app/(tabs)/profile.tsx | Stable |
| Eigen Regie Plan | app/eigen-regie-plan/ | Stable (4 sub-screens) |
| Day Structure | app/day-structure/ | Stable (editor + wizard) |
| Intake | app/intake.tsx | Stable |
| GDPR Consent | app/gdpr-consent.tsx | Stable |
| Proposal History | app/proposal-history.tsx | Stable |
| Debug Log | app/dev/debug-log.tsx | Dev only |
| Theme Lab | app/dev/theme-lab.tsx | Dev only |

---

## 4. Core User Journeys

| Journey | Persona | Test Coverage | Status |
|---------|---------|---------------|--------|
| New user Elias (intake → first chat) | Elias | Partial | Stable |
| New user Kim (intake → first chat) | Kim | Partial | Stable |
| Existing user new session (greeting → chat) | Both | Unit tests | Stable |
| Follow-up chat (LIVE_MESSAGE) | Both | Unit tests | **P0: personal anchors were lost** (fixed d52f1273) |
| Manual data refresh | Both | 40 tests | Stable |
| Crisis detection | Both | Unit tests | Stable |
| Cold turkey safety | Elias | Unit tests | Stable |
| Relapse risk | Elias | Unit tests | Stable |
| Caregiver self-loss | Kim | 36 tests (9L) | Stable |
| Relational harm | Kim | Unit tests | Stable |
| Personal anchor recall | Both | 16 tests (P0 fix) | **Fixed** |
| App restart (memory reload) | Both | No dedicated tests | **P1: needs smoke test** |
| APK device smoke test | Both | Manual only | **P1: no automated test** |

---

## 5. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native | 0.81.5 |
| Platform | Expo SDK | 54 |
| Language | TypeScript | 5.9 |
| Styling | NativeWind (Tailwind) | 4 |
| Navigation | Expo Router | 6 |
| State | AsyncStorage + in-memory | - |
| Encryption | AES-256-GCM (local) | - |
| Backend | Railway (Express) | - |
| AI | OpenAI (gpt-4o-mini / gpt-4o) | - |
| Semantic | Nano-interpret (forge.manus.im) | Temporary |
| Package Manager | pnpm | 9.12.0 |
| Tests | Vitest | 2.1.9 |

---

## 6. File Counts

| Directory | .ts/.tsx files |
|-----------|---------------|
| lib/ | 612 |
| server/ | 46 |
| __tests__/ | 126 |
| app/ | 22 |
| components/ | 33 |
| docs/ | 18 |

**Total tests:** 3147 (3132 pass, 14 fail, 1 skip)
**Pipeline:** 6363 lines (lib/rugzak/pipeline.ts)

---

## 7. Active Feature Flags

| Flag | Status | Effect |
|------|--------|--------|
| EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY | true | Client-built prompt → minimal proxy |
| EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION | true | CMD runtime active |
| EXPO_PUBLIC_ENABLE_NANO_INTERPRET | default ON | Nano semantic helper active |
| EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE | true | **DELETED from codebase** |
| EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING | true | **DELETED from codebase** |
| EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR | - | Debug mirror of client prompt |

---

## 8. Critical Architecture Rules

1. **Engine beslist.** GPT levert alleen taal.
2. **Server = pure proxy.** No clinical logic on server.
3. **store:false** always active on OpenAI calls.
4. **Local-first privacy.** All memory on-device, encrypted.
5. **Persona separation.** Kim ≠ Elias. No cross-contamination.
6. **Safety > everything.** Crisis/cold turkey overrides all other logic.
7. **No raw memory to GPT.** Only compact summaries via CMD selector.
8. **No lockfile regeneration.** pnpm-lock.yaml is sacred.
9. **Railway = only production backend.** No Manus sandbox URLs in production.
10. **Confirmed facts ≠ hypotheses.** Personal anchors are facts, projections are hypotheses.
