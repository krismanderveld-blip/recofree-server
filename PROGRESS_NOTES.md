# Progress Notes — Current Session

## Completed
1. ✅ Zone-based prevention plan filter created: `lib/features/prevention-plan/zone-filter.ts`
2. ✅ Pipeline SESSION_INIT updated: uses filterPreventionPlanByZone + adds preventionPlanMissing flag
3. ✅ Pipeline LIVE_MESSAGE updated: same zone-based filtering
4. ✅ Server ai-chat.ts updated: shows zone label, uses filtered fields, hints when plan missing
5. ✅ Note: preventionPlanMissing hint is INSIDE the relapseEvent block — need to also add it OUTSIDE for greeting when no relapse but plan is empty

## Still TODO this session
- [ ] Move preventionPlanMissing hint OUTSIDE relapseEvent block so greeting mentions it even without relapse
- [ ] Update openai-provider.ts: preventionPlan field already sends full plan — needs to use zone-filtered version (but it reads from userDatSummary which pipeline already filters, so it should be OK)
- [ ] Fix notification i18n keys (profile.notifications.*)
- [ ] Fix VSP export
- [ ] Implement balkmetafoor
- [ ] Run tests + checkpoint

## Key file locations
- Zone filter: `/home/ubuntu/recofree-app/lib/features/prevention-plan/zone-filter.ts`
- Pipeline SESSION_INIT: line ~4104 in `/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts`
- Pipeline LIVE_MESSAGE: line ~659 in `/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts`
- Server greeting: line ~1249 in `/home/ubuntu/recofree-app/server/ai-chat.ts`
- openai-provider SESSION_INIT payload: line ~568 in `/home/ubuntu/recofree-app/lib/ai/openai-provider.ts`
- openai-provider cached payload: line ~725 in `/home/ubuntu/recofree-app/lib/ai/openai-provider.ts`

## Zone mapping
- PAARS → supportContacts + crisis
- ROOD → warningSigns + supportContacts
- ORANJE → warningSigns + copingStrategies
- GEEL → copingStrategies + safeActivities
- LICHTGROEN → safeActivities + motivation
- GROEN → motivation
- Kim (eigenRegie ≤40): full plan; GEEL: copingStrategies+safeActivities; GROEN/LICHTGROEN: motivation only

## TypeScript errors
- 150 errors reported but they are pre-existing (backpackChanged type mismatch) — not related to our changes
