# RecoFree Backup & Restore Readiness — 2026-08-23

**Date:** 2026-08-12
**Target:** Full backup before Manus server switch (~23 August)

---

## 1. What Must Be Backed Up

### Code & Config (in git repo)
- [ ] Full project directory (excluding node_modules)
- [ ] pnpm-lock.yaml (CRITICAL — never regenerate)
- [ ] app.config.ts (bundle ID, branding)
- [ ] constants/oauth.ts (Railway URL hardcoded)
- [ ] eas.json (build config)
- [ ] vitest.config.ts
- [ ] tailwind.config.js + theme.config.js

### Secrets (NOT in repo — Kris must save separately)
- [ ] OPENAI_API_KEY (Railway env var)
- [ ] Railway project token
- [ ] GitHub PAT (for Railway auto-deploy)
- [ ] EAS/Expo credentials (expo login)
- [ ] BUILT_IN_FORGE_API_KEY (Manus — may change after switch)
- [ ] BUILT_IN_FORGE_API_URL (Manus — may change after switch)
- [ ] JWT_SECRET
- [ ] DATABASE_URL
- [ ] OAUTH_SERVER_URL
- [ ] VITE_APP_ID
- [ ] OWNER_OPEN_ID

### Build Secrets (EAS)
- [ ] EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY=true
- [ ] EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION=true
- [ ] EXPO_PUBLIC_ENABLE_NANO_INTERPRET (default ON)
- [ ] EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE=true (if restored)
- [ ] EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING=true (if restored)

### External Services
- [ ] Railway project settings (screenshot/export)
- [ ] Railway environment variables (screenshot)
- [ ] Expo/EAS project settings
- [ ] GitHub repo access (krismanderveld-blip/recofree-server)
- [ ] OpenAI API account + billing

---

## 2. Last Known Good State

| Item | Value |
|------|-------|
| Last checkpoint | d52f1273 |
| Tests passing | 3132/3147 (14 fail are pre-existing) |
| TypeScript | 0 errors |
| APK published | Yes (latest build) |
| Railway deployed | Yes (auto-deploy from GitHub main) |
| Bundle ID | space.manus.recofree.app.t20260405113127 |
| Domain | recobase-vhsxu5ua.manus.space |

---

## 3. Restore Procedure (After Server Switch)

```
Step 1:  Upload project to new Manus sandbox
Step 2:  pnpm install (DO NOT regenerate lockfile)
Step 3:  Restore all env vars / secrets
Step 4:  npx tsc --noEmit → expect 0 errors
Step 5:  npx vitest run → expect 3132+ pass
Step 6:  Start local dev server (pnpm dev)
Step 7:  Verify Railway connection (health check)
Step 8:  Test minimal proxy (curl /api/minimal-gpt-proxy)
Step 9:  Test nano-interpret (curl /api/nano-interpret)
Step 10: Verify personal anchors in chat (follow-up message)
Step 11: Verify Kim/Elias persona separation
Step 12: Verify CMD debug in clinical dropdown
Step 13: Build APK (Publish button)
Step 14: Device smoke test (6 scenarios from FASE 4E protocol)
Step 15: Verify Railway logs show no raw content
```

---

## 4. Backup Readiness Score

| Category | Score | Notes |
|----------|-------|-------|
| Code in git | 9/10 | All committed, checkpoints available |
| Secrets documented | 7/10 | Need Kris to verify all values saved |
| External services | 6/10 | Railway/Expo settings need screenshot |
| Restore procedure | 8/10 | Clear steps, needs one rehearsal |
| Test coverage for restore | 5/10 | No dedicated restore smoke test |

**Overall: 7/10** — Good but needs secret verification + one rehearsal.

*** Add File: /home/ubuntu/recofree-app/docs/audit/RECOFREE_SERVER_SWITCH_SURVIVAL_PLAN.md
