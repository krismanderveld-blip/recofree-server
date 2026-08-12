# RecoFree Memory and Context Flow Map

**Date:** 2026-08-12

---

## Memory Layers Overview

| Layer | Storage Key | Persistent | Encrypted | Persona-Scoped | Reaches GPT | Source of Truth |
|-------|-------------|------------|-----------|----------------|-------------|-----------------|
| Backpack | @recofree_backpack / @recofree_rugzak | Yes | No | Yes | Via analysis only | Yes |
| Backpack hash | @recofree_backpack_hash | Yes | No | Yes | No | Derived |
| Extracted entities | @recofree_extracted_entities | Yes | No | Yes | Via personalAnchors | Derived |
| user.dat | recofree_memory/{persona}/user.dat | Yes | Yes (AES-256) | Yes | Via CMD summary | Yes |
| state.dat | recofree_memory/{persona}/state.dat | Yes | Yes | Yes | No (internal) | Yes |
| projections.dat | recofree_memory/{persona}/projections.dat | Yes | Yes | Yes | As hypothesis only | Yes |
| logs.dat | recofree_memory/{persona}/logs.dat | Yes | Yes | Yes | Via past-reference | Yes |
| context.dat cache | @recofree_context_dat_cache | Yes | No | No | Yes (SESSION_INIT) | Derived |
| DIST01 (distillation.dat) | recofree_memory/{persona}/distillation.dat | Yes | Yes | Yes | Via CMD selector | Yes |
| CMD context | In-memory (runtime) | No | - | Yes | Via summary block | Derived |
| CMD selector output | In-memory | No | - | Yes | Via summary | Derived |
| selectedClinicalMemorySummary | In-memory | No | - | Yes | Yes (prompt block) | Derived |
| personalAnchors | In-memory (built from user.dat) | No | - | No | Yes (always) | Derived |
| Session buffer | In-memory | No | - | Both | No | Volatile |
| rejectedSuggestions | In-memory (session-only) | No | - | Both | Yes (prompt block) | Volatile |
| Elias projection | @recofree_projection_elias | Yes | Yes | Elias | As hypothesis | Yes |
| Kim projection | @recofree_projection_kim | Yes | Yes | Kim | As hypothesis | Yes |
| ERP (Eigen Regie Plan) | @recofree:eigenRegiePlan | Yes | No | Kim | Via zone/anchor | Yes |
| VSP profile | @vsp_backpack_profile | Yes | No | Elias | Via structured block | Yes |
| Diary | @recofree_diary | Yes | No | Both | No (separate screen) | Yes |
| Day structure | @recofree_daystructure_v1 | Yes | Yes | Both | No | Yes |
| Token/cost debug | **DELETED** | - | - | - | No | - |
| Manual refresh state | @recofree_manual_data_refresh | Yes | No | Both | No | Yes |

---

## Data Flow: What Reaches GPT

### Always (every message):
1. **Identity/persona prompt** — hardcoded per persona
2. **Personal anchors** — from extractedEntities.persons (max 7)
3. **Recent chat history** — conversation window (last N messages)
4. **User message** — current input

### Conditional:
5. **Context (contextDatSerialized)** — only at SESSION_INIT or backpack dirty
6. **CMD selected memory summary** — when CMD flag true + items selected
7. **Formulation block** — when detector triggers (Kim: relational, Elias: recovery)
8. **Regulation instruction** — when regulation layer active
9. **Deepening block** — when deepening active
10. **Projection context** — when projections relevant
11. **Rejected suggestions** — when user rejected something this session
12. **Relational stance directive** — Kim only, when stance filter active
13. **Engine directive** — when engine has specific instruction
14. **Intervention continuity** — Elias only, when continuing intervention

### Never reaches GPT:
- Raw backpack content
- Raw user.dat
- Raw state.dat
- Raw DIST01 store
- Raw logs.dat
- Session buffer internals
- Debug/clinical dropdown data
- Token cost data
- Storage keys/paths

---

## Write Moments

| Layer | Written When |
|-------|-------------|
| user.dat | After backpack analysis, after session analysis promotion |
| state.dat | After each message (state update) |
| projections.dat | When projection detected in chat |
| logs.dat | At session end (summary) |
| DIST01 | Post-GPT step 6.9-6.11 (entity/signal detection + auto-save) |
| Backpack | Manual user edit only |
| ERP | Manual user edit (wizard) |
| personalAnchors | Derived on-the-fly from user.dat each message |

---

## P0 Context Loss Points

1. **Follow-up messages lose contextDatSerialized** — only built at SESSION_INIT. Fixed by personalAnchors block.
2. **App restart without backpack dirty flag** — user.dat not re-analyzed until next backpack change.
3. **DIST01 writeback incomplete** — new chat info may not reach distillation if session ends abruptly.
4. **Epistemic engine deleted** — model routing no longer considers claim certainty or responsibility.

*** Add File: /home/ubuntu/recofree-app/docs/audit/RECOFREE_GAP_REGISTER_P0_P1_P2.md
