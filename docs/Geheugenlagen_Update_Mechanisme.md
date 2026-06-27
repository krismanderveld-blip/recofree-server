# RecoFree — Geheugenlagen: Hoe en Wanneer Ze Worden Bijgewerkt

> Dit document beschrijft uitsluitend wat de code daadwerkelijk doet. Geen interpretatie, geen bedoeling — alleen feitelijke implementatie.

---

## 1. Overzicht Geheugenlagen

| Laag | Bestand | Opslag | Versleuteling |
|------|---------|--------|---------------|
| **Session Buffer** | In-memory (niet persistent) | RAM | Nee |
| **user.dat** | `recofree_memory/{persona}/user.dat.v2` | AsyncStorage (versleuteld) | AES-256-GCM |
| **state.dat** | `recofree_memory/{persona}/state.dat` | AsyncStorage (versleuteld) | AES-256-GCM |
| **projections.dat** | `recofree_memory/{persona}/projections.dat.v2` | AsyncStorage (versleuteld) | AES-256-GCM |
| **logs.dat** | `recofree_memory/{persona}/logs.dat.encrypted.v2` | AsyncStorage (versleuteld) | AES-256-GCM |
| **Elias/Kim Projection** | `@recofree_elias_projection` / `@recofree_kim_projection` | AsyncStorage | Nee (apart systeem) |

---

## 2. Per Bericht — Welke Lagen Worden Aangeraakt

**Locatie:** `app/(tabs)/chat.tsx` regels 825-915

### Volgorde (sequentieel, alle `await`):

| Stap | Actie | Functie | Laag |
|------|-------|---------|------|
| 1 | Laden huidige stores | `stores.userDatStore.load()`, `stateDatStore.load()`, `projectionsDatStore.load()` | user.dat, state.dat, projections.dat |
| 2 | Detectie-bundle bouwen | `buildDetectionBundle()` (in pipeline) | Geen schrijfactie |
| 3 | Patches toepassen | `runMemoryWriteBack(bundle, currentStores)` → `applyMemoryWritePlan()` | In-memory mutatie |
| 4 | Opslaan user.dat | `await stores.userDatStore.save(...)` | **user.dat** |
| 5 | Opslaan state.dat | `await stores.stateDatStore.save(...)` | **state.dat** |
| 6 | Opslaan projections.dat | `await stores.projectionsDatStore.save(...)` | **projections.dat** |
| 7 | Buffer: user-bericht toevoegen | `sessionBufferStore.appendMessage(buffer, {role:'user', ...})` | **Session Buffer** |
| 8 | Buffer: assistant-bericht toevoegen | `sessionBufferStore.appendMessage(updatedBuffer, {role:'assistant', ...})` | **Session Buffer** |
| 9 | Buffer: turn snapshot toevoegen | `sessionBufferStore.appendTurnSnapshot(...)` | **Session Buffer** |
| 10 | Incrementeel logs.dat schrijven | `stores.logsDatStore.upsertCurrentSession(persona, incrementalSummary)` | **logs.dat** |

### Belangrijk: Stap 4-6 zijn sequentieel (`await`), niet parallel.

### Stap 10 — Incrementeel logs.dat schrijven (per beurt):

Na elke beurt wordt een **raw narrative** geschreven naar logs.dat:
- Neemt de laatste 10 user-berichten uit de session buffer
- Kapt elk bericht af op 300 tekens
- Voegt samen tot: `"Sessie-inhoud (X berichten): msg1 | msg2 | msg3"`
- Schrijft als `upsertCurrentSession` — vervangt bestaande entry met dezelfde `sessionId` (geen duplicaten)
- Timestamp `endedAt`: `new Date().toISOString()` (moment van schrijven)
- Timestamp `createdAt` / `startedAt`: `currentBuffer.startedAt` (sessie-starttijd)

---

## 3. Memory Commit Service — Patch-toepassing

**Locatie:** `lib/pipeline/memory/memoryCommitService.ts`

De `applyMemoryWritePlan()` functie itereert sequentieel (`for ... of`) over alle patches:

```
voor elke patch in plan.patches:
  als shouldWrite === false → skip
  anders:
    switch (patch.layer):
      "user.dat"        → applyUserDatPatch()
      "state.dat"       → applyStateDatPatch()
      "projections.dat" → applyProjectionsDatPatch()
      "buffer"          → (niet hier afgehandeld)
```

### user.dat patches (via `mergeUserDat.ts`):

| Patch path | Merge-functie | Wat het doet |
|------------|---------------|--------------|
| `triggerPatterns` | `mergeTriggerPattern()` | Nieuw: voegt toe met `firstSeenAt = timestampIso`. Bestaand: update `lastSeenAt`, extend sources |
| `schemaTendencies` | `mergeSchemaTendency()` | Idem patroon |
| `modeTendencies` | `mergeModeTendency()` | Idem patroon |
| `moduleUsage` | `mergeModuleUsage()` | Update `lastUsedAt`, extend recent-use array |

Alle patches stampen `userDat.updatedAt = payload.timestampIso`.

### state.dat patches (via `mergeStateDat.ts`):

| Patch path | Merge-functie | Wat het doet |
|------------|---------------|--------------|
| `current.zone` | `mergeZoneHistoryBuffer()` | Append zone history record, update `current.zone`, stamp `current.lastUpdatedAt` + `updatedAt` = `timestampIso`. **Conditie:** retourneert ongewijzigd als zone === `UNKNOWN` |
| `current.mood` | `mergeMoodHistory()` | Append mood history record. **Conditie:** update `current.mood` alleen als er geen huidige mood is OF source is `slider_ui` OF vorige source was niet `slider_ui` |
| `current.activeModuleId` | `mergeCurrentState()` | Update `activeModuleId`, `activeResponseMode`, stamp `current.lastUpdatedAt` + `updatedAt` = `timestampIso` |

### projections.dat patches (via `mergeProjectionsDat.ts`):

| Actie | Wat het doet |
|-------|--------------|
| `mergeProjectionRecord()` | Key: `kind|normalizedLabel|category`. Eerst `applyProjectionDecay(existing, timestampIso)`, dan reinforce score. Stamp `lastSeenAt` + `lastReinforcedAt` = `timestampIso`. Nieuw: `firstSeenAt = lastSeenAt = lastReinforcedAt = timestampIso`. Top-level `projDat.updatedAt = timestampIso` |

---

## 4. Decay — Waar, Wanneer, Welke Berekening

### 4a. Regulation Decay (per bericht, in-buffer)

**Locatie:** `lib/rugzak/regulation-decay-engine.ts`
**Wanneer:** Na buffer-update, VÓÓR GPT payload wordt gebouwd
**Wat wordt aangepast:** Alleen `currentZoneScore` en `currentZoneColor` in de session buffer (RAM)

**Condities voor GEEN decay:**
- Eerste bericht van de sessie (`messageCount <= 1`)
- Crisis actief (`currentIntent === 'crisis'` of `currentZoneColor === 'PURPLE'`)

**Drie decay-componenten:**

| Component | Conditie | Waarde |
|-----------|----------|--------|
| **Time decay** | Geen trigger + neutral intent | GREEN/YELLOW: -2, ORANGE: -3, RED: -4 |
| **Time decay** | Zwakke trigger, niet crisis/venting | -2 |
| **Response decay** | Intensity trajectory = 'falling' | drop ≥20: -10, drop ≥10: -7, anders: -5 |
| **Response decay** | Trajectory = 'stable', drop ≥10 | -5 |
| **Overshoot correction** | Was ≥60, nu ≤35, drop ≥25 | -20 |
| **Overshoot correction** | Was ≥50, nu ≤30, drop ≥20 | -15 |

**Floor:** Score kan niet onder 0 zakken (`Math.max(0, score + totalDecay)`)

### 4b. Projection Decay (per bericht, in projections.dat)

**Locatie:** `lib/storage/memory/mergeProjectionsDat.ts` → `applyProjectionDecay()`
**Wanneer:** Bij elke `mergeProjectionRecord()` call — dus bij elke projection-patch per bericht
**Wat wordt aangepast:** De `score` van de bestaande projection entry, gebaseerd op tijd sinds `lastReinforcedAt`

### 4c. Elias/Kim Projection Decay (bij sessie-einde)

**Locatie:** `lib/engine/elias/projection.ts` (en equivalent voor Kim)
**Wanneer:** Wordt aangeroepen bij sessie-einde
**Berekening:**

| Conditie | Decay |
|----------|-------|
| ≥3 dagen sinds `lastReinforcedAt` | -10 (PROJECTION_DECAY_FAST) |
| Niet versterkt deze sessie | -5 (PROJECTION_DECAY_PER_SESSION) |
| Wél versterkt deze sessie | 0 (al afgehandeld door signaaldetectie) |

**Verwijdering:** Entries met `decayScore === 0` die NIET `isUserConfirmed` zijn → verwijderd
**Deactivering:** Entries die onder `PROJECTION_ACTIVE_THRESHOLD` zakken → `isActive = false`
**Persistentie:** `await saveEliasProjection(currentProjection)` — direct na decay

---

## 5. Bij Chat-Einde — Volledige Volgorde

Er zijn **twee paden** naar sessie-einde:

### Pad A: Manueel ("Stoppen" knop)

**Locatie:** `app/(tabs)/chat.tsx` → `handleEndConversation()` (regel 966-1073)

| Stap | Await | Actie | Functie |
|------|-------|-------|---------|
| 1 | — | `setSessionPhase('ending')` | UI state |
| 2 | — | Toon "Ik ga alles analyseren..." bericht | UI |
| 3 | await | Lees huidige userDat | `readEncrypted(USERDAT_KEY)` |
| 4 | await | Lees diary entries | `readEncrypted(DIARY_KEY)` |
| 5 | await | **Pipeline endSession** | `endSession(backpack, provider, userDatWithDiary)` |
| 6 | await | Persist updated userDat | `writeEncrypted(USERDAT_KEY, ...)` |
| 7 | await | Reset VSP/eigenRegie, dispatch END_SESSION | `endSessionWithUserDat(result.updatedUserDat)` |
| 8 | — | Toon farewell bericht | UI |
| 9 | — | `setSessionPhase('completed')` | UI state |
| 10 | await | **Memory Lifecycle endSession** | `lifecycleManager.endSession(persona, apiBase, chatHistoryForFallback, legacySessionData)` |

### Pad B: Automatisch (inactiviteit/achtergrond)

Zelfde `handleEndConversation` functie wordt aangeroepen via `handleEndConversationRef.current`.

---

## 6. Pipeline `endSession()` — Interne Stappen

**Locatie:** `lib/rugzak/pipeline.ts` → `endSession()`

Dit is stap 5 uit het schema hierboven. Intern doet deze functie:

| Stap | Wat | Conditie |
|------|-----|----------|
| 1 | Trigger-analyse (frequentie, patronen) | Altijd |
| 2 | Mood/sessie-analyse | Altijd |
| 3 | K04S4 update (Kim) | `persona === 'kim'` |
| 4 | K06 update (Kim) | `persona === 'kim'` |
| 5 | K01 update (Kim) | `persona === 'kim'` |
| 6 | K03 update (Kim) | `persona === 'kim'` |
| 7 | SW01 update (Elias) | `persona === 'elias'` |
| 8 | STO01 update (Elias) | `persona === 'elias'` |
| 9 | Module memory update | Altijd |
| 10 | Gratitude streak berekening | Altijd |
| 11 | Repeating patterns detectie | Altijd |
| 12 | Chat archivering (sessionAnalyses[]) | Altijd |
| 13 | `resetSessionState()` | Altijd |
| 14 | Return: `{ farewell, updatedUserDat, sessionSummary }` | Altijd |

**Alle stappen zijn sequentieel** — geen `Promise.all` of parallelle uitvoering.

---

## 7. Memory Lifecycle `endSession()` — logs.dat Schrijven

**Locatie:** `lib/pipeline/memory/sessionLifecycle.ts` → `endSession()`

Dit is stap 10 uit het handleEndConversation schema.

| Stap | Await | Actie | Functie |
|------|-------|-------|---------|
| 1 | — | Buffer ophalen of recoveren uit chatHistory | `sessionBufferStore.getBuffer()` of synthetic buffer |
| 2 | — | Concurrency check | `isSessionAlreadyClosed(sessionId)` |
| 3 | await | **Unified session-end writer** | `writeUnifiedSessionEnd({persona, sessionId, buffer, apiBaseUrl, legacySessionData})` |
| 4 | await | **Upsert naar logs.dat** | `stores.logsDatStore.upsertCurrentSession(persona, writeResult.summary)` |
| 5 | — | Debug logging | `logDebugEvent('transfer_3_logsdat_write', ...)` |
| 6 | — | Buffer wissen | `sessionBufferStore.clear()` |

### Stap 3 — Unified Session End Writer:
- Probeert eerst GPT-samenvatting (via server API call)
- Bij fout: fallback naar `buildBufferFallbackSummary` (laatste 5 user-berichten als narrative)

### Stap 4 — Upsert naar logs.dat:
- `upsertCurrentSession` vervangt de bestaande incrementele entry (zelfde sessionId) met de volledige GPT-samenvatting
- Schrijft `data.updatedAt = new Date().toISOString()` (moment van schrijven, NIET sessie-timestamp)

---

## 8. Timestamps — Wat Krijgt Elke Laag

| Laag | Veld | Waarde | Bron |
|------|------|--------|------|
| **user.dat** | `updatedAt` | `payload.timestampIso` (van de patch) | Moment dat de detectie-bundle werd gebouwd |
| **user.dat** | `firstSeenAt` / `lastSeenAt` | `payload.timestampIso` | Idem |
| **state.dat** | `updatedAt` | `payload.timestampIso` | Idem |
| **state.dat** | `current.lastUpdatedAt` | `payload.timestampIso` | Idem |
| **projections.dat** | `updatedAt` | `payload.timestampIso` | Idem |
| **projections.dat** | `lastSeenAt` / `lastReinforcedAt` | `payload.timestampIso` | Idem |
| **logs.dat** (incrementeel) | `endedAt` | `new Date().toISOString()` | Moment van schrijven (elke beurt) |
| **logs.dat** (incrementeel) | `startedAt` / `createdAt` | `currentBuffer.startedAt` | Sessie-starttijd |
| **logs.dat** (sessie-einde) | `endedAt` | `new Date().toISOString()` | Moment van GPT-samenvatting |
| **logs.dat** (sessie-einde) | `startedAt` | `buffer.startedAt` | Sessie-starttijd |
| **logs.dat** top-level | `updatedAt` | `new Date().toISOString()` | Moment van save-call |

### Inconsistentie:
- `user.dat`, `state.dat`, `projections.dat` gebruiken de **patch-timestamp** (moment van detectie-bundle creatie)
- `logs.dat` gebruikt `new Date().toISOString()` op het moment van schrijven
- Dit kan een verschil van milliseconden tot seconden opleveren

---

## 9. Await vs. Parallel

| Context | Uitvoering | Bewijs |
|---------|------------|--------|
| Per-bericht: user.dat → state.dat → projections.dat | **Sequentieel** (3x `await`) | `chat.tsx:837-839` |
| Per-bericht: buffer append → logs.dat upsert | **Sequentieel** (buffer eerst, dan `await` upsert) | `chat.tsx:840-915` |
| Sessie-einde: pipeline.endSession → lifecycle.endSession | **Sequentieel** (`await` op beide) | `chat.tsx:988-1037` |
| Lifecycle endSession: writeUnified → upsert logs.dat | **Sequentieel** (`await` op beide) | `sessionLifecycle.ts:145-156` |
| Patch-toepassing binnen memoryCommitService | **Sequentieel** (`for ... of` loop) | `memoryCommitService.ts:51` |

**Conclusie: ALLES is sequentieel. Er is nergens `Promise.all` of parallelle uitvoering bij geheugen-schrijfacties.**

---

## 10. Voorwaarden — Stappen Die Alleen Onder Bepaalde Condities Draaien

### Per bericht:

| Conditie | Effect |
|----------|--------|
| `patch.shouldWrite === false` | Patch wordt overgeslagen (niet geschreven) |
| Zone === `UNKNOWN` | `mergeZoneHistoryBuffer` retourneert ongewijzigd |
| Mood `sourceKind === "not_detected"` | Geen mood-patch gebouwd |
| Mood confidence < `WRITE_THRESHOLDS.MOOD_CONFIDENCE` | Geen mood-patch gebouwd |
| `messageCount <= 1` | Geen regulation decay |
| Crisis actief of PURPLE | Geen regulation decay |
| Buffer is `null` | Geen buffer-append, geen incrementeel logs.dat |

### Bij sessie-einde:

| Conditie | Effect |
|----------|--------|
| `!state.backpack || !state.userDat || sessionPhase !== 'active'` | `handleEndConversation` doet niets |
| Buffer is `null` EN geen chatHistoryFallback | Lifecycle endSession retourneert error |
| `isSessionAlreadyClosed(sessionId)` | Lifecycle endSession skipt (concurrency guard) |
| GPT-samenvatting faalt | Fallback naar buffer-based summary (laatste 5 user-berichten) |

---

## 11. logs.dat Retentie

**Locatie:** `lib/pipeline/memory/logsDatRetention.ts`
**Wanneer:** Bij **sessie-start** (`sessionLifecycle.startSession()`), VÓÓR de greeting

### Beleid:

| Leeftijd sessie | Actie |
|-----------------|-------|
| 0-3 maanden | Volledig bewaard (geen wijziging) |
| 3-6 maanden | Gecomprimeerd |
| >6 maanden | Verwijderd |

### Compressie (3-6 maanden) — wat blijft:
- `compressedNarrative` (volledig)
- `discussedTopics` (volledig)
- `openEndpoints` (volledig)
- `emotionalThemes` → alleen eerste entry (label + intensity)
- `breakthroughs` → alleen eerste entry (label + confidence, description gewist)
- `relapseOrRiskEvents` → alleen niet-"none" events
- `moduleTrace` → max 3
- `zoneTrace` → max 3
- `extractedCandidates` → leeggemaakt (fears, hopes, triggers, schemas, modes)
- `inputTokenEstimate` / `outputTokenEstimate` → 0

### Compressie — wat verdwijnt:
- Alle gedetailleerde extractedCandidates
- Volledige emotionalThemes behalve de eerste
- Volledige breakthroughs behalve de eerste
- Module/zone traces na de eerste 3
- Token-schattingen

### Na retentie:
- `logsDat.updatedAt = new Date().toISOString()`
- Alleen opgeslagen als er daadwerkelijk iets gecomprimeerd of verwijderd is

---

## 12. Samenvatting Dataflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        PER BERICHT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. processMessage() → detectie-bundle                          │
│  2. regulation decay → buffer (RAM only)                        │
│  3. buildMemoryWritePlan() → patches                            │
│  4. applyMemoryWritePlan() → in-memory mutatie                  │
│  5. await save user.dat                                         │
│  6. await save state.dat                                        │
│  7. await save projections.dat                                  │
│  8. buffer.appendMessage(user + assistant)                      │
│  9. buffer.appendTurnSnapshot()                                 │
│ 10. await logsDatStore.upsertCurrentSession() ← incrementeel    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     BIJ SESSIE-EINDE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. pipeline.endSession() → farewell + updatedUserDat           │
│     └─ intern: trigger-analyse, mood, module updates,           │
│        gratitude, repeating patterns, chat archivering          │
│  2. await writeEncrypted(userDat)                               │
│  3. endSessionWithUserDat() → reset VSP, persist                │
│  4. lifecycleManager.endSession():                              │
│     a. Buffer ophalen (of recoveren uit chatHistory)            │
│     b. Concurrency check                                        │
│     c. await writeUnifiedSessionEnd() → GPT of fallback        │
│     d. await logsDatStore.upsertCurrentSession() ← definitief  │
│     e. Buffer wissen                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     BIJ SESSIE-START                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Load user.dat, state.dat, projections.dat                   │
│  2. Initialize session buffer                                   │
│  3. Load logs.dat                                               │
│  4. applyRetentionToLogsDat() → compress/prune                  │
│  5. Save logs.dat (alleen als retentie iets wijzigde)           │
│  6. buildSessionInitContext()                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Betrokken Bestanden

| Bestand | Rol |
|---------|-----|
| `app/(tabs)/chat.tsx` | Orchestratie: per-bericht schrijfvolgorde, sessie-einde trigger |
| `lib/pipeline/memory/memoryCommitService.ts` | Patch-toepassing op in-memory stores |
| `lib/pipeline/memory/memoryPatchBuilders.ts` | Bouwt patches uit detectie-bundle |
| `lib/storage/memory/mergeUserDat.ts` | user.dat merge-logica |
| `lib/storage/memory/mergeStateDat.ts` | state.dat merge-logica |
| `lib/storage/memory/mergeProjectionsDat.ts` | projections.dat merge-logica |
| `lib/rugzak/regulation-decay-engine.ts` | Buffer zone-score decay per bericht |
| `lib/engine/elias/projection.ts` | Elias projection decay bij sessie-einde |
| `lib/pipeline/memory/sessionLifecycle.ts` | Sessie start/einde orchestratie |
| `lib/pipeline/memory/unifiedSessionEndWriter.ts` | GPT-samenvatting of fallback |
| `lib/pipeline/memory/logsDatRetention.ts` | Retentiebeleid (0-3mo / 3-6mo / >6mo) |
| `lib/storage/memory/logsDatStore.ts` | Versleutelde logs.dat I/O |
| `lib/user-context.tsx` | `endSessionWithUserDat()`: reset VSP, persist |

---

*Document gegenereerd op basis van de feitelijke code-implementatie. Geen wijzigingen aangebracht.*
