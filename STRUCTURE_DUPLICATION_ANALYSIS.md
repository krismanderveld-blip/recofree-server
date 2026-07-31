# RecoFree — Structuur Duplicatie & Risico-Analyse

Datum: 31 Jul 2026

## Samenvatting

Er zijn **3 categorieën** van verspreiding/duplicatie in het project. Sommige zijn bewust (architectuurkeuzes), andere zijn historisch gegroeid en vormen een **reëel risico**.

---

## Categorie 1: BEWUST — Geen actie nodig

### Persona-specifieke parallelle bestanden

| Locatie | Voorbeeld | Reden |
|---------|-----------|-------|
| `lib/engine/elias/` vs `lib/engine/kim/` | `decision-layer.ts`, `zone.ts` | Elias en Kim hebben fundamenteel andere logica |
| `modules/elias/slaap01/` vs `modules/kim/slaap01/` | `slaap01-detector.ts` | Zelfde module-naam maar totaal andere implementatie per persona |

**Risico: LAAG** — Dit is het persona-pattern. Elke persona heeft eigen detectors, prompts, types. Ze delen geen state en worden nooit door elkaar aangeroepen.

### Server-side mirrors van client-side engines

| Client | Server | Reden |
|--------|--------|-------|
| `lib/rugzak/dominant-state-selector.ts` | `server/engine/dominant-state-selector-server.ts` | Server heeft eigen versie nodig voor server-side payload building |
| `lib/engine/` (signal detection) | `server/engine/signal-engine-server.ts` | Server doet eigen signal parsing |

**Risico: LAAG-MEDIUM** — De server-versies zijn bewust vereenvoudigde kopieën. Maar als de client-logica verandert en de server niet mee-updatet, kan er drift ontstaan.

---

## Categorie 2: HISTORISCH GEGROEID — Risico aanwezig

### `lib/` vs `src/` split

| `lib/` | `src/` | Overlap |
|--------|--------|---------|
| `lib/features/` (8 features) | `src/features/` (1: vspInsight) | Feature modules verspreid over 2 locaties |
| `lib/pipeline/memory/` (13 files) | `src/pipeline/memory/` (3 files) | Memory context assemblers verspreid |
| `lib/engine/elias/` (24 files) | `src/modules/elias/` (7 modules) | Elias engines verspreid over 2 locaties |
| `lib/engine/kim/` (31 files) | `src/modules/kim/` (4 modules) | Kim engines verspreid over 2 locaties |

**Risico: MEDIUM-HOOG**
- Ontwikkelaar moet weten "zit dit in `lib/` of `src/`?" — geen duidelijke conventie
- Imports gebruiken `@/src/modules/...` met `require()` (dynamic) in pipeline.ts — fragiel
- Nieuwe modules worden soms in `lib/engine/`, soms in `src/modules/`, soms in `modules/` geplaatst

### Root `modules/` vs `lib/engine/` vs `src/modules/`

Er zijn **3 locaties** voor therapy modules:

| Locatie | Inhoud | Patroon |
|---------|--------|---------|
| `modules/` (root) | fale01, iden01, mi02, rouw01, slaap01, terv01, verg01, zink01 | Nieuwere "advanced P2-P4" modules |
| `lib/engine/elias/` | ACT, RETP, STOA, shadow, stoicism, etc. | Oorspronkelijke core engines |
| `src/modules/elias/` | AUTOPILOT01, BLIK01, COEX01, IKST01, ONTK01, PAAL01, WILSKRACHT01 | Latere "advanced" modules |

**Risico: HOOG**
- 3 verschillende locaties voor hetzelfde concept (therapy module)
- Geen gedeeld interface/contract — elke locatie heeft eigen patterns
- Pipeline importeert uit alle 3 via verschillende mechanismen (static import, dynamic require)
- Bij refactoring of nieuwe module: onduidelijk waar het hoort

---

## Categorie 3: ECHTE DUPLICATEN — Actie vereist

### `types.ts` (6 locaties)

| Bestand | Inhoud |
|---------|--------|
| `lib/ai/types.ts` | ChatMessage, UserDat, Backpack, ChatContext (MASTER) |
| `lib/backpack-extractor/types.ts` | BackpackExtractor-specifieke types |
| `lib/core/time/types.ts` | TimeProvider types |
| `lib/features/dayStructure/types.ts` | DayStructure types |
| `modules/kim/iso01/types.ts` | ISO01 module types |
| `shared/types.ts` | Shared server/client types |

**Risico: LAAG** — Dit zijn allemaal domein-specifieke types in hun eigen scope. Geen echte duplicatie.

### `signal-engine.ts` (2 locaties)

| Bestand | Rol |
|---------|-----|
| `lib/engine/local-llm/signal-engine.ts` | Lokale LLM signal engine (experimenteel, niet actief) |
| `server/signal-engine.ts` | Server-side signal engine (actief) |

**Risico: LAAG** — De local-llm versie is een experimenteel archief, niet actief in productie.

---

## Aanbevelingen

### Prioriteit 1: Consolideer module-locaties

**Voorstel:** Verplaats alle therapy modules naar één locatie met duidelijke conventie:

```
lib/engine/
  elias/
    core/        ← huidige lib/engine/elias/ bestanden
    modules/     ← verplaats modules/elias/* en src/modules/elias/* hierheen
  kim/
    core/        ← huidige lib/engine/kim/ bestanden
    modules/     ← verplaats modules/kim/* en src/modules/kim/* hierheen
  shared/        ← bestaand (CGT, DBT, MBT, SchemaMode, confirmation)
```

**Impact:** ~60 bestanden verplaatsen, alle imports updaten. Groot maar eenmalig.

### Prioriteit 2: Consolideer features

**Voorstel:** Kies één locatie voor features — `lib/features/` (al 8 features daar):

```
lib/features/
  vspInsight/    ← verplaats van src/features/
  balkmetafoor/  ← verplaats types van src/types/
```

**Impact:** ~20 bestanden, minder import-wijzigingen.

### Prioriteit 3: Elimineer `src/` directory

Na prioriteit 1 en 2 is `src/` leeg en kan verwijderd worden. Alles zit dan in:
- `lib/` — alle applicatielogica
- `modules/` → verwijderd (gemerged in `lib/engine/`)
- `server/` — backend
- `app/` — UI screens

### Prioriteit 4: Server drift monitoring

Voeg een test toe die verifieert dat server-side engine outputs consistent zijn met client-side verwachtingen (contract test).

---

## Risico-matrix

| Issue | Kans op bug | Impact | Prioriteit |
|-------|-------------|--------|------------|
| 3 module-locaties | Hoog (nieuwe dev weet niet waar) | Medium (verkeerde import) | P1 |
| `lib/` vs `src/` features split | Medium | Laag (werkt, maar verwarrend) | P2 |
| Server/client engine drift | Laag (zelden gewijzigd) | Hoog (silent bugs) | P3 |
| Persona parallelle bestanden | Zeer laag | N/A (bewust) | Geen actie |
