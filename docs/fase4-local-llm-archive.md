# Fase 4 — Local LLM Archive

## Waarom geparkeerd

V1 vaste beslissing: Fase 4 — LocalSignalEngine interface eerst, dan pas model integratie. De on-device LLM (Gemma via llama.rn) is geparkeerd omdat het native module de Manus build omgeving crasht. De server-side implementatie via GPT-4o-mini is nu actief als vervanging.

## Wat behouden blijft als fundament

| Bestand | Functie |
|---------|---------|
| `lib/engine/local-llm/signal-engine.ts` | Interface definitie (LocalSignalEngine) |
| `lib/engine/local-llm/null-engine.ts` | Fallback engine (retourneert lege/neutrale waarden) |
| `lib/engine/local-llm/engine-provider.ts` | Singleton pattern (getEngine, setEngine, resetEngine, initGptSignalEngine) |
| `lib/engine/local-llm/gpt-signal-engine.ts` | Huidige actieve implementatie via GPT-4o-mini |
| `server/signal-engine.ts` | Server endpoint voor GPT-4o-mini calls |

## Wat verwijderd is en straks opnieuw moet komen (bij lokale LLM)

| Component | Beschrijving |
|-----------|-------------|
| llama.rn package | React Native binding voor llama.cpp — native .so bestanden |
| gemma-signal-engine.ts | Gemma 3 implementatie via llama.rn (dynamic import, context params) |
| GGUF download manager | WiFi-only check, resumable download, progress tracking |
| Model download UI | Download screen, progress bar, skip knop |
| CloudAIBanner | Subtle banner "On-device AI not active" met auto-fade na 5s |
| Profile "On-device AI" sectie | Status badge (Ready/Downloading/Not downloaded), download/delete knoppen |
| Skip-flow | dismissed state -> NullEngine + CloudAIBanner |

## Geleerd uit deze poging

1. **llama.rn postinstall conflict**: Het package heeft een postinstall script dat native .so bestanden downloadt. De Manus build omgeving (Node.js Docker container) kan deze niet compileren of linken in een native APK.

2. **Manus build != native APK build**: De Manus Publish pipeline bouwt een server-side deployment, geen Android APK. Voor native modules is EAS Build (Expo Application Services) of een lokale Android Studio build vereist.

3. **pnpm 10+/11 symptoomfixes**: packageManager field, pnpm-workspace.yaml met allowBuilds en nodeLinker: hoisted waren allemaal symptoomfixes voor het llama.rn probleem. Na verwijdering van llama.rn zijn alleen pnpm.onlyBuiltDependencies voor esbuild en unrs-resolver nodig.

4. **Mogelijk alternatief voor toekomst**: Model downloaden na APK install (via expo-file-system) in plaats van via de build pipeline. Dit vereist wel een EAS Build voor de native llama.rn binding.

5. **GPT-4o-mini als tussenoplossing**: Voor de drie kleine classificatietaken (signaaldetectie, relevantie scoring, context samenvatting) is GPT-4o-mini server-side voldoende. Kosten: ~$0.003/dag bij 100 berichten. Latency: ~200ms extra per bericht.

## Wanneer wel oppakken

- Na interne test (Kris + Melissa)
- Na Alexianen pilot
- In elk geval na huidige stabilisatie
- Wanneer EAS Build beschikbaar is voor native APK generatie
- Model keuze: Gemma 3 1B (806 MB) is voldoende voor classificatietaken
