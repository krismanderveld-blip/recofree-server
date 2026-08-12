# RecoFree Server Switch Survival Plan

**Date:** 2026-08-12
**Event:** Manus server switch (~23 August 2026)
**Impact:** Project must be re-uploaded; sandbox URLs change; forge.manus.im may change.

---

## What Changes After Switch

| Component | Risk | Action |
|-----------|------|--------|
| Manus sandbox URL | Changes | No impact — not used in production |
| forge.manus.im (nano-interpret) | MAY change | Document current behavior, prepare fallback |
| BUILT_IN_FORGE_API_KEY | MAY change | Will need new key from Manus |
| BUILT_IN_FORGE_API_URL | MAY change | Will need new URL from Manus |
| Railway backend | NO change | Independent service, auto-deploys from GitHub |
| OpenAI API | NO change | Direct API, independent of Manus |
| Expo/EAS | NO change | Independent service |
| GitHub repo | NO change | Independent |
| User device data | NO change | All local on device |

---

## Survival Checklist

### Before Switch (by 22 August)

1. [ ] Save final checkpoint
2. [ ] Download ZIP of full project
3. [ ] Screenshot Railway env vars
4. [ ] Screenshot EAS build secrets
5. [ ] Verify GitHub repo is up to date
6. [ ] Document current forge.manus.im behavior
7. [ ] Save OPENAI_API_KEY separately
8. [ ] Save Railway token separately
9. [ ] Save GitHub PAT separately
10. [ ] Run final APK build + device test
11. [ ] Fix P0-01 (restore epistemic engine)
12. [ ] Fix P0-04 (14 failing tests)

### After Switch

1. [ ] Upload project to new sandbox
2. [ ] Run restore procedure (15 steps)
3. [ ] Verify forge.manus.im still works
4. [ ] If forge changed: update BUILT_IN_FORGE_API_URL
5. [ ] If forge key changed: update BUILT_IN_FORGE_API_KEY
6. [ ] Run full test suite
7. [ ] Build APK
8. [ ] Device smoke test

---

## Nano-Interpret Contingency

If forge.manus.im becomes unavailable after switch:

1. **Short-term:** Nano is already behind a feature flag (EXPO_PUBLIC_ENABLE_NANO_INTERPRET). Set to 'false' to disable.
2. **Impact:** Kim/Elias formulation engines fall back to regex-only detection. Quality drops slightly but safety remains intact.
3. **Long-term:** Replace with LocalLLMAdapter (documented in FASE 5C/6C audit).

---

## Railway Independence Verification

Railway is completely independent of Manus:
- Deploys from GitHub (not Manus sandbox)
- Has its own env vars
- Has its own domain (railwayappdashboard-production.up.railway.app)
- App hardcodes this URL in constants/oauth.ts

**No action needed for Railway during switch.**

*** Add File: /home/ubuntu/recofree-app/docs/audit/RECOFREE_NEXT_7_DAYS_FREE_CREDITS_PLAN.md
