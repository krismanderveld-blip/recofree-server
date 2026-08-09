# CLIENT-FIRST BACKEND MINIMUM RULE

**Status:** ACTIEF — Geldig vanaf 9 augustus 2026
**Scope:** Alle RecoFree server/backend code
**Reden:** Privacy, MDR-compliance, architectuurintegriteit, kostenbeheer

---

## 1. BACKEND MINIMUM RULE

Railway/backend doet vanaf nu het **absolute minimum**. De backend is een doorgeefluik: hij ontvangt een kant-en-klare prompt, stuurt die naar OpenAI, en geeft het antwoord terug. Niets meer.

Alle klinische intelligentie, routing, analyse, geheugen, safety en formulation logic draait **client-side** op het apparaat van de gebruiker.

---

## 2. WAT BACKEND MAG DOEN

- HTTPS request ontvangen
- Kant-en-klare client-built prompt/payload ontvangen
- OpenAI API call uitvoeren
- `store: false` afdwingen op elke GPT call
- Response tekst teruggeven aan client
- Technische errors teruggeven (HTTP status codes, validation errors)
- Model routing op basis van client-meegegeven parameter (niet zelf bepalen)

---

## 3. WAT BACKEND NIET MAG DOEN

- Klinische analyse uitvoeren
- Module routing bepalen
- Safety routing bepalen
- Kim/Elias persona samenstellen of interpreteren
- Formulation engines draaien
- Guidance depth interpreteren of toepassen
- Geheugen bewaren (geen session cache voor klinische context)
- Session state bijhouden
- Prompt klinisch samenstellen (geen `buildSystemPrompt()` met klinische logica)
- Rugzak/KERP/VSP/context interpreteren of transformeren
- Relationele of herstelgerichte conclusies vormen
- Diagnostische labels toekennen
- Therapeutic stance bepalen
- Safety filters toepassen
- Post-processing van GPT output
- Nieuwe klinische routes toevoegen

---

## 4. FROZEN SERVERBESTANDEN (Legacy — niet uitbreiden)

De volgende bestanden bevatten legacy klinische logica die in een toekomstige fase naar client-side verplaatst wordt. Tot die tijd: **NIETS NIEUWS TOEVOEGEN**.

| Bestand | Status | Reden |
|---------|--------|-------|
| `server/ai-chat.ts` | **FROZEN** | Bevat `buildSystemPrompt()` (800+ regels klinische prompt constructie) — legacy |
| `server/engine-process.ts` | **FROZEN** | Volledige server-side engine — niet actief (`CLIENT_ACTIVE_SERVER_OFF`) maar aanwezig |
| `server/signal-engine.ts` | **FROZEN** | Semantic signal scoring — legacy |
| `server/nano-interpret-proxy.ts` | **FROZEN** | Nano pre-call — legacy |
| `server/session-greeting.ts` | **FROZEN** | Greeting GPT call — legacy |
| `server/backpack-analysis.ts` | **FROZEN** | Deep backpack analysis — legacy |
| `server/vsp-backpack-analysis.ts` | **FROZEN** | VSP analysis — legacy |
| `server/kerp01-generate.ts` | **FROZEN** | KERP01 zone generation — legacy |
| `server/backpack-document-parse.ts` | **FROZEN** | Document parsing — legacy |
| `server/vsp-document-parse.ts` | **FROZEN** | VSP document parsing — legacy |
| `server/vsp-text-extract.ts` | **FROZEN** | VSP text extraction — legacy |
| `server/k05-cross-module-override.ts` | **FROZEN** | Server-side K05 — replaced by client version |
| `server/engine/buffer-server.ts` | **FROZEN** | Server buffer — not used in CLIENT_ACTIVE mode |
| `server/engine/dominant-state-selector-server.ts` | **FROZEN** | Server state selector — not used |
| `server/engine/gpt-payload-server.ts` | **FROZEN** | Server payload builder — not used |
| `server/engine/loopblocker-server.ts` | **FROZEN** | Server loop blocker — not used |
| `server/engine/nano-interpret.ts` | **FROZEN** | Server nano interpret — not used |
| `server/engine/past-reference-server.ts` | **FROZEN** | Server past reference — not used |
| `server/engine/regulation-server.ts` | **FROZEN** | Server regulation — not used |
| `server/engine/signal-engine-server.ts` | **FROZEN** | Server signal engine — not used |
| `server/engine/state-analyzer-server.ts` | **FROZEN** | Server state analyzer — not used |
| `server/engine/vsp-insight-server.ts` | **FROZEN** | Server VSP insight — not used |

---

## 5. FROZEN ROUTES (Niet meer uitbreiden)

| Route | Bestand | Status |
|-------|---------|--------|
| `/api/gpt-proxy` | `server/gpt-proxy.ts` | FROZEN — mag alleen GPT doorsturen |
| `/api/engine-process` | `server/engine-process.ts` | FROZEN — niet actief, niet uitbreiden |
| `/api/signal-engine` | `server/signal-engine.ts` | FROZEN — legacy |
| `/api/nano-interpret` | `server/nano-interpret-proxy.ts` | FROZEN — legacy |
| `/api/session-greeting` | `server/session-greeting.ts` | FROZEN — legacy |
| `/api/backpack-analysis` | `server/backpack-analysis.ts` | FROZEN — legacy |
| `/api/vsp-backpack-analysis` | `server/vsp-backpack-analysis.ts` | FROZEN — legacy |
| `/api/kerp01-generate` | `server/kerp01-generate.ts` | FROZEN — legacy |
| `/api/pre-translate` | `server/pre-translate.ts` | FROZEN — legacy |
| `/api/debug-prompt` | `server/debug-prompt.ts` | FROZEN — debug only |
| tRPC `ai.chat` | `server/routers.ts` | FROZEN — fallback voor gpt-proxy |

---

## 6. TOEKOMSTIGE FORMULATION ENGINES — CLIENT-SIDE ONLY

Alle toekomstige Kim/Elias formulation logic MOET client-side:

- `KIM_RELATIONAL_FORMULATION_ENGINE` → `lib/engine/kim/`
- `ELIAS_RECOVERY_FORMULATION_ENGINE` → `lib/engine/elias/`
- Nieuwe depth layers → `lib/engine/{persona}/`
- Nieuwe safety filters → `lib/engine/{persona}/modules/`
- Nieuwe assessment modes → `lib/engine/{persona}/`

De server ontvangt alleen het **resultaat** (een string directive) als onderdeel van de payload. De server interpreteert dit niet.

---

## 7. STORE:FALSE — VERPLICHT

Elke GPT API call vanuit de backend MOET `store: false` bevatten in de request body. Dit voorkomt dat OpenAI gebruikersdata opslaat voor training.

```typescript
// VERPLICHT in elke fetch() naar OpenAI:
body: JSON.stringify({
  model: selectedModel,
  messages: [...],
  store: false,  // ← VERPLICHT
  ...
})
```

---

## 8. GEEN SERVER MEMORY

De backend mag GEEN klinische state bewaren:
- Geen session cache voor klinische context (bestaande `sessionCache` in ai-chat.ts is legacy — niet uitbreiden)
- Geen database writes voor klinische data
- Geen AsyncStorage equivalent op server
- Geen user profiles op server
- Geen conversation history op server

Alle geheugen leeft op het apparaat (AsyncStorage, SessionMemoryCache, SecureStore).

---

## 9. GEEN CLINICAL STATE LOGGING

De backend mag GEEN klinische informatie loggen:
- Geen module selectie loggen
- Geen safety triggers loggen
- Geen user emotions loggen
- Geen therapeutic progress loggen
- Technische logs (errors, latency, model used) zijn WEL toegestaan

---

## 10. GEEN LOCKFILE REGENERATIE

`pnpm-lock.yaml` mag NOOIT geregenereerd worden:
- Gebruik altijd de bestaande lockfile
- Bij dependency changes: `pnpm add <package>` (voegt toe aan bestaande lockfile)
- NOOIT: `pnpm install --force`, `rm pnpm-lock.yaml`, of `pnpm install` zonder lockfile
- Reden: regeneratie trekt nieuwe package versies die `minimumReleaseAge` policy schenden op Railway

---

## 11. GEEN NIEUWE KLINISCHE SERVERROUTES

Nieuwe serverroutes die klinische logica bevatten zijn VERBODEN zonder expliciete architectuurreview:
- Geen nieuwe `/api/` endpoints die klinische beslissingen nemen
- Geen nieuwe tRPC procedures die therapeutic logic bevatten
- Geen nieuwe server-side filters, detectors, of analyzers
- Uitzondering: pure GPT proxy routes die alleen een prompt doorsturen (maar waarom zou je een nieuwe nodig hebben?)

---

## 12. EINDDOEL: MINIMAL GPT PROXY

De normale chatloop moet uiteindelijk naar een minimale GPT proxy:

```
CLIENT                          SERVER (Railway)
──────                          ────────────────
Engine besluit module     →
Engine bouwt prompt       →
Client stuurt prompt      →     Ontvangt prompt
                                Stuurt naar OpenAI (store:false)
                          ←     Geeft response tekst terug
Client past filters toe   ←
Client toont antwoord     ←
```

De huidige `buildSystemPrompt()` op de server is legacy en moet in een toekomstige fase naar client-side verplaatst worden. Tot die tijd: niet uitbreiden.

---

## BESTAANDE OVERTREDINGEN (niet nu fixen — alleen documenteren)

| Overtreding | Bestand | Ernst | Toekomstige actie |
|-------------|---------|-------|-------------------|
| `buildSystemPrompt()` bouwt klinische prompt server-side | `server/ai-chat.ts` | HOOG | Verplaats naar client |
| Session cache bewaart klinische context | `server/ai-chat.ts` | MEDIUM | Verwijder session cache |
| Model routing op server | `server/ai-chat.ts` | LAAG | Client stuurt model mee |
| Nano-interpret doet semantic analysis | `server/nano-interpret-proxy.ts` | MEDIUM | Verplaats naar client |
| Signal engine doet semantic scoring | `server/signal-engine.ts` | MEDIUM | Verplaats naar client |
| Greeting generation op server | `server/session-greeting.ts` | LAAG | Kan server blijven (geen clinical state) |
| Backpack analysis op server | `server/backpack-analysis.ts` | LAAG | Eenmalig, geen state — kan server blijven |

---

*Dit document is de architectuurwet. Elke wijziging aan serverbestanden die niet in lijn is met deze regels vereist expliciete goedkeuring.*
