# Fase 4 — Local LLM Archive

> Documentatie van de lokale LLM-poging (Rounds 28–35) die is teruggedraaid.
> Dit bestand dient als referentie voor wanneer Fase 4 opnieuw wordt opgepakt.

---

## 1. Waarom geparkeerd

**V1 vaste beslissing:** Fase 4 schrijft voor dat eerst de **LocalSignalEngine interface** wordt gebouwd (model-agnostisch), en pas daarna een specifiek model wordt geïntegreerd.

De implementatie is teruggedraaid omdat:

- `llama.rn` (native module) vereist Android NDK compilatie die niet beschikbaar is in de Manus build-omgeving
- De postinstall scripts van llama.rn werden geblokkeerd door pnpm 10+/11 security (`ERR_PNPM_IGNORED_BUILDS`)
- De hele pnpm/Corepack/packageManager configuratie moest herhaaldelijk worden aangepast als symptoomfix
- De app crashte bij start op device zonder foutmelding (native module loading failure)
- Dit was scope-creep: de basis (crisis-protocol, taaldetectie, regulation layer) was nog niet stabiel genoeg

---

## 2. Wat behouden blijft als fundament

Deze bestanden zijn **niet verwijderd** en vormen het fundament voor Fase 4:

| Bestand | Functie |
|---------|---------|
| `lib/engine/local-llm/signal-engine.ts` | Interface definitie: `LocalSignalEngine`, `SignalInput`, `ContextInput`, `ContextData`, `CandidateSignals`, `RelevanceMap`, `ContextSummary` |
| `lib/engine/local-llm/null-engine.ts` | Fallback implementatie (retourneert lege/neutrale waarden) |
| `lib/engine/local-llm/engine-provider.ts` | Singleton: `getEngine()`, `setEngine()`, `resetEngine()` |

De pipeline (`lib/rugzak/pipeline.ts`) gebruikt al `getEngine()` en valt graceful terug op NullEngine wanneer `isReady()` false retourneert.

---

## 3. Wat verwijderd is en straks opnieuw moet komen

### Packages

| Package | Versie | Functie |
|---------|--------|---------|
| `llama.rn` | ^0.12.4 | React Native binding voor llama.cpp — Gemma 3 4B inference |

### Bestanden (verwijderd)

| Bestand | Functie |
|---------|---------|
| `lib/engine/local-llm/gemma-signal-engine.ts` | GemmaSignalEngine class — implementeert LocalSignalEngine via llama.rn |
| `lib/engine/local-llm/model-download-manager.ts` | Download manager: WiFi-only check (expo-network), resumable download (expo-file-system), progress callbacks |
| `lib/engine/local-llm/model-download-context.tsx` | React context: download state, actions (start/pause/resume/retry/skip/delete) |
| `components/model-download-screen.tsx` | UI: ModelDownloadScreen, CloudAIBanner, ModelDownloadIndicator |

### UI-integraties (verwijderd)

| Locatie | Wat |
|---------|-----|
| `app/_layout.tsx` | `<ModelDownloadProvider>` wrapper |
| `app/(tabs)/chat.tsx` | `<ModelDownloadIndicator>` + `<CloudAIBanner>` |
| `app/(tabs)/profile.tsx` | "On-device AI" sectie met status badge, download/delete knoppen, progress bar |

### Download specificaties

- **Model:** Gemma 3 4B Instruct, Q4_K_M quantization (GGUF format)
- **Grootte:** ~2.49 GB
- **Bron:** `https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf`
- **Opmerking:** `bartowski/gemma-3-4b-it-GGUF` is gated (vereist HuggingFace auth). `ggml-org` is publiek.

---

## 4. Geleerd uit deze poging

### Build-omgeving beperkingen

1. **llama.rn postinstall** downloadt native `.so` bestanden (~200 MB) — geblokkeerd door pnpm 10+ security
2. **Manus build server** is een Node.js-only Docker container (Cloud Run) — geen Android NDK beschikbaar
3. **Corepack + packageManager** veld veroorzaakte signature verification errors op de build server
4. **pnpm 10 vs 11** verschil: `onlyBuiltDependencies` (pnpm 10 package.json) vs `allowBuilds` (pnpm 11 pnpm-workspace.yaml)

### Symptoomfixes die ook gereverteerd zijn

| Fix | Reden voor revert |
|-----|-------------------|
| `packageManager: "pnpm@11.5.0+sha512..."` in package.json | Niet meer nodig zonder llama.rn |
| `"llama.rn": true` in pnpm-workspace.yaml allowBuilds | Package verwijderd |
| nodeLinker: hoisted in pnpm-workspace.yaml | **Behouden** — nodig voor React Native module resolution |

### Mogelijke alternatieven voor Fase 4

1. **Model downloaden ná APK install** — niet via build pipeline, maar als runtime download op device
2. **EAS Build** gebruiken i.p.v. Manus Publish — EAS heeft Android NDK beschikbaar
3. **expo-dev-client** alleen voor development builds — niet in productie
4. **Lazy loading** van llama.rn — dynamic import zodat app start niet crasht als native module ontbreekt

---

## 5. Wanneer wel oppakken

**Voorwaarden:**

1. Na interne test (Kris + Melissa) — huidige cloud-gebaseerde pipeline moet stabiel zijn
2. Na Alexianen pilot — productie-feedback verwerkt
3. Na huidige stabilisatie — crisis-protocol, taaldetectie, regulation layer allemaal geverifieerd op device

**Volgorde bij herimplementatie:**

1. Bevestig build-strategie (EAS Build vs Manus Publish)
2. Test llama.rn integratie in een minimal reproducible project
3. Implementeer download manager met correcte error handling
4. Integreer in bestaande LocalSignalEngine interface
5. Device-test op Android (minimaal 4 GB RAM vereist voor Gemma 3 4B Q4)

---

*Laatst bijgewerkt: 30 mei 2026*
