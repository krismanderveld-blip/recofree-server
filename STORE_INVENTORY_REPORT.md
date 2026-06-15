# Store Inventory Report — Export/Import Scope

## Currently Exported Stores

| Store | AsyncStorage Key | Covered |
|-------|-----------------|---------|
| user.dat (per persona) | `recofree_memory/{persona}/user.dat` | YES |
| state.dat (per persona) | `recofree_memory/{persona}/state.dat` | YES |
| projections.dat (per persona) | `recofree_memory/{persona}/projections.dat` | YES |
| logs.dat (per persona) | `recofree_memory/{persona}/logs.dat` | YES |
| Diary entries | `@recofree_diary` | YES |
| Gratitude entries | embedded in diary | YES |
| Backpack (legacy) | `@recofree_backpack` | YES |
| UserDat (legacy) | `@recofree_userdat` | YES |

## Missing Stores (NOT in export)

| Store | AsyncStorage Key | Contains | Priority |
|-------|-----------------|----------|----------|
| Elias Projection | `@recofree_projection_elias` | Future-facing fears/hopes/goals, decay scores, reinforcement counts | HIGH |
| Kim Projection | `@recofree_projection_kim` | Same as above for Kim persona | HIGH |
| Emergency Contacts | `emergencyContacts` | User-defined emergency phone contacts | HIGH |
| Backpack Hash | `@recofree_backpack_hash` | SHA hash for change detection (derived, can be regenerated) | LOW |
| Extracted Entities | `@recofree_extracted_entities` | NLP-extracted entities from backpack (derived, can be regenerated) | LOW |
| Last Export Timestamp | `@recofree_last_export_timestamp` | When last export was made (meta, not user data) | SKIP |

## Analysis

### Sobriety/Milestone Data
- `sobrietyDate` and `lastMilestoneShown` are fields INSIDE `UserDat` (legacy `@recofree_userdat`)
- These are ALREADY exported via the userDatStore
- No separate store exists for milestones

### Progress Tracker
- `elias-progress-tracker.ts` and `kim-progress-tracker.ts` are PURE COMPUTATION engines
- They read from UserDat (moodHistory, moduleUsage, repeatingPatterns, sobrietyDate)
- They have NO separate persistent storage — all data lives in UserDat
- Already covered by export

### Mood Trend Data
- Mood trends are COMPUTED from `moodHistory` inside UserDat
- No separate mood trend store exists
- Already covered by export

### Persona Projections (MISSING!)
- `@recofree_projection_elias` — EliasProjection with fears/hopes/goals
- `@recofree_projection_kim` — KimProjection with fears/hopes/goals
- These are SEPARATE from `projections.dat` in the memory layer
- These are user-confirmed entries that cannot be regenerated
- **MUST be added to export/import**

### Emergency Contacts (MISSING!)
- Stored under key `emergencyContacts` (no @recofree_ prefix)
- User-entered phone contacts for crisis situations
- **MUST be added to export/import**

### Derived/Regenerable Stores (LOW PRIORITY)
- `@recofree_backpack_hash` — can be regenerated from backpack
- `@recofree_extracted_entities` — can be regenerated from backpack via NLP
- These are caches, not user data. Including them is nice-to-have but not critical.

## Conclusion

Three stores need to be added:
1. **Elias Projection** (`@recofree_projection_elias`) — HIGH priority
2. **Kim Projection** (`@recofree_projection_kim`) — HIGH priority  
3. **Emergency Contacts** (`emergencyContacts`) — HIGH priority

Two derived stores can optionally be included for completeness:
4. Backpack Hash (`@recofree_backpack_hash`) — LOW priority
5. Extracted Entities (`@recofree_extracted_entities`) — LOW priority
