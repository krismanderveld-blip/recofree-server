# Export Scope Diagnosis

## Current Export Coverage

The export already covers these AsyncStorage keys:

| Store | Key(s) | In Export? | How? |
|-------|---------|-----------|------|
| UserDat (per persona) | `recofree_memory/{persona}/user.dat` + `@recofree_userdat` (legacy) | YES | `userDatStore` |
| StateDat (per persona) | `recofree_memory/{persona}/state.dat` | YES | `stateDatStore` |
| ProjectionsDat (per persona) | `recofree_memory/{persona}/projections.dat` | YES | `projectionsDatStore` |
| LogsDat (per persona) | `recofree_memory/{persona}/logs.dat` | YES | `logsDatStore` |
| Diary entries | `@recofree_diary` | YES | `diaryStore` |
| Gratitude entries | `@recofree_diary` (filtered by .gratitude) | YES | `gratitudeStore` |
| Backpack data | `@recofree_backpack` | YES | `backpackStore` |
| Persona Projections | `@recofree_projection_elias`, `@recofree_projection_kim` | YES | `personaProjectionStore` |
| Emergency Contacts | `emergencyContacts` | YES | `emergencyContactsStore` |
| Derived Caches | `@recofree_backpack_hash`, `@recofree_extracted_entities` | YES | `derivedCacheStore` |

## Data Location Analysis

| Feature | Where is data stored? | Separate store? | In export? |
|---------|----------------------|-----------------|-----------|
| **Sobriety Date** | `userDat.sobrietyDate` | NO (in userDat) | YES (via userDatStore) |
| **Milestone Tracker** | `userDat.milestoneTracker` (seenMilestones, lastCheckedAt, etc.) | NO (in userDat) | YES (via userDatStore) |
| **Mood History** | `userDat.moodHistory` (legacy) + `stateDat.moodHistory` (new) | NO (in userDat/stateDat) | YES (via both stores) |
| **Progress Tracker** | Derived at runtime from userDat.moodHistory + moduleUsage + sobrietyDate | NO (computed, not stored) | N/A (no persistent state) |
| **Mood Trend** | Derived at runtime from stateDat.moodHistory | NO (computed, not stored) | N/A (no persistent state) |

## Conclusion

**ALL persistent user data stores are already covered by the export.**

- Sobriety/nuchterheid counter → stored in `userDat.sobrietyDate` → exported via `userDatStore`
- Milestone Tracker state → stored in `userDat.milestoneTracker` → exported via `userDatStore`
- Mood History → stored in `userDat.moodHistory` + `stateDat.moodHistory` → exported via both stores
- Progress Tracker → has NO persistent store (computed at runtime from existing data)
- Mood Trend → has NO persistent store (computed at runtime from stateDat)

**No stores are missing from the export.** All persistent data is already covered.
