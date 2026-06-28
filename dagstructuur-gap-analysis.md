# Dagstructuur Feature — Gap Analysis

Analyse van de technische specificatie tegen de huidige codebase. Doel: identificeren wat er al is, wat er ontbreekt, en waar risico's/onduidelijkheden zitten.

---

## 1. Wat er al is (fundament aanwezig)

| Onderdeel | Status | Locatie |
|-----------|--------|---------|
| LocalDeviceTimeService | Aanwezig — `now()`, `getCurrentLocalDayKey()`, `getCurrentLocalHour()`, `getCurrentTimeZone()`, `refreshDeviceTimeContext()`, `hasLocalDayChanged()` | `lib/core/time/LocalDeviceTimeService.ts` |
| TimeProvider root context | Aanwezig in `app/_layout.tsx` | `app/_layout.tsx` |
| AES-256-GCM encrypted storage | Volledig werkend — `readEncrypted()`, `writeEncrypted()`, `removeEncrypted()` | `lib/crypto/storage-encryption.ts` |
| expo-notifications | Geïnstalleerd (`~0.32.15`) | `package.json` |
| POST_NOTIFICATIONS permission | Geconfigureerd voor Android | `app.config.ts` (regel 69) |
| Bell-icoon op home screen | Visueel aanwezig (emoji 🔔, geen functionaliteit) | `app/(tabs)/index.tsx` (regel 176-179) |
| Home screen ScrollView layout | Greeting + bell + milestone + sobriety + cards | `app/(tabs)/index.tsx` |
| i18n systeem | Werkend met nl/en/fr locales | `lib/i18n/locales/*.json` |
| Bestaande feature-structuur | `lib/features/{name}/` patroon | `lib/features/` |
| @noble/ciphers | Geïnstalleerd | `package.json` |
| Persona-context (Elias/Kim) | Werkend via `useUser()` | `lib/user-context.tsx` |

---

## 2. Wat er ontbreekt (moet gebouwd worden)

### 2.1 LocalDeviceTimeService uitbreidingen

De spec vereist een `DayStructureTimePort` interface met functies die **niet** bestaan:

| Functie | Bestaat? | Opmerking |
|---------|----------|-----------|
| `getCurrentWeekday(): Weekday` | **Nee** — `localWeekday` (1-7 number) bestaat in de snapshot, maar geen mapping naar `"monday"` etc. | Eenvoudig toe te voegen |
| `resolveNextOccurrence({ weekday, localTime })` | **Nee** | Kernlogica voor notification scheduling. Moet een absolute `Date` teruggeven voor de eerstvolgende keer dat weekday+tijd voorkomt |
| `compareLocalClockTimes(a, b)` | **Nee** | Simpele comparator, triviaal |
| `detectTimezoneChange(previousTimezone)` | **Nee** — `refreshDeviceTimeContext()` retourneert `{ timeZoneChanged: boolean }` maar vergelijkt met intern gecachte tz, niet met een meegegeven string | Kleine wrapper nodig |
| `getTimezoneOffsetMinutes()` | **Ja** — `offsetMinutes` zit in snapshot | Alleen wrapper nodig |

**Risico:** `resolveNextOccurrence` is de complexste — moet rekening houden met "als het vandaag dinsdag 15:00 is en je plant voor dinsdag 14:00, dan wordt het volgende week dinsdag."

### 2.2 Notification infrastructure

| Onderdeel | Status |
|-----------|--------|
| `SCHEDULE_EXACT_ALARM` Android permission | **Ontbreekt** in `app.config.ts` |
| `expo-notifications` config plugin met `sounds` array | **Ontbreekt** — geen custom wake sound geconfigureerd |
| Android notification channels (`daystructure_wake_alarm`, `daystructure_activity`) | **Ontbreken** |
| `Notifications.setNotificationHandler()` in root | **Ontbreekt** in `app/_layout.tsx` |
| Notification response listener (deep link naar `/day-structure`) | **Ontbreekt** |
| Custom wake sound bestand | **Ontbreekt** — er is geen `.wav`/`.mp3` in assets |

### 2.3 Data & Storage

| Onderdeel | Status |
|-----------|--------|
| `DayStructureDocumentV1` type definitie | **Ontbreekt** |
| Encrypted storage key `encryptedStorage.dayStructure.v1` | **Ontbreekt** — niet in `SENSITIVE_KEYS` |
| Repository (load/save/validate/migrate) | **Ontbreekt** |
| Completion store per localDayKey | **Ontbreekt** |
| Scheduled notification index | **Ontbreekt** |

### 2.4 UI & Navigatie

| Onderdeel | Status |
|-----------|--------|
| `/day-structure` route | **Ontbreekt** |
| `/day-structure/wizard` route | **Ontbreekt** |
| `/day-structure/edit-day` route | **Ontbreekt** |
| `DayStructureHomeCard` component | **Ontbreekt** |
| `DayStructureBellToggle` (functioneel) | **Ontbreekt** — bell is nu visueel-only emoji |
| Wizard flow (5-6 stappen) | **Ontbreekt** |
| Day editor | **Ontbreekt** |
| Copy-to-week confirmation sheet | **Ontbreekt** |
| Permission bottom sheet | **Ontbreekt** |
| i18n keys voor dagstructuur | **Ontbreken** |

### 2.5 Services

Alle 7 services uit sectie 13 van de spec moeten van scratch gebouwd worden:
- `dayStructureRepository.ts`
- `dayStructureService.ts`
- `dayStructureWizardService.ts`
- `dayStructureNotificationService.ts`
- `dayStructurePermissionService.ts`
- `dayStructureTimeAdapter.ts`
- `dayStructureCompletionService.ts`

---

## 3. Risico's en onduidelijkheden

### 3.1 Custom wake sound — binary dependency

De spec wil een "alarmachtige wekker-notificatie met geluid". Dit vereist:
1. Een `.wav` of `.caf` bestand in het project
2. Registratie via de `expo-notifications` config plugin `sounds` array
3. Dit werkt alleen in **development builds** / productie — **niet in Expo Go**

**Risico:** Testen van custom sound is onmogelijk in de sandbox. We kunnen de code schrijven maar niet verifiëren dat het geluid daadwerkelijk afspeelt.

**Voorstel:** MVP implementeert de code-path met custom sound referentie, maar valt terug op `Notifications.AndroidImportance.MAX` + default sound als het custom bestand niet beschikbaar is.

### 3.2 SCHEDULE_EXACT_ALARM — Android 12+ gedrag

Android 12+ vereist expliciete toestemming voor exact alarms. Expo's `scheduleNotificationAsync` met een `date` trigger vereist dit. De spec noemt dit maar zegt "MVP gebruikt expo-notifications lokale scheduled notifications."

**Risico:** Zonder `SCHEDULE_EXACT_ALARM` kunnen alarms op Android 12+ inexact worden (tot 10 min afwijking). De spec accepteert dit impliciet ("echte wekkergarantie wordt later overwogen").

**Voorstel:** Toevoegen aan `app.config.ts` permissions array. Geen runtime-check in MVP nodig — Android geeft de permissie automatisch tot de gebruiker het intrekt.

### 3.3 Timezone-change detection — app foreground trigger

De spec zegt: "Bij app foreground/resume: lees current timezone, vergelijk met `timezoneAtLastPlanning`."

**Onduidelijkheid:** Er is geen bestaande `AppState` listener in de app die timezone-checks doet bij foreground. `LocalDeviceTimeService.refreshDeviceTimeContext()` retourneert `timeZoneChanged` maar wordt nergens automatisch bij foreground aangeroepen.

**Voorstel:** Een `useEffect` met `AppState.addEventListener('change')` in de DayStructureHomeCard of een dedicated hook die bij foreground de timezone checkt en herplant indien nodig.

### 3.4 Notification scheduling bij app-start — reconciliation

De spec zegt: "Bij app start: load scheduled index, call `getAllScheduledNotificationsAsync`, vergelijk IDs, herplan indien nodig."

**Onduidelijkheid:** Waar in de app-lifecycle moet dit draaien? De root `_layout.tsx` is de logische plek, maar het mag niet blokkeren.

**Voorstel:** Non-blocking `useEffect` in root layout die na mount de reconciliation uitvoert. Falen is niet-fataal.

### 3.5 Encrypted storage key registratie

De huidige `SENSITIVE_KEYS` array is een `as const` tuple. Toevoegen van een nieuwe key vereist aanpassing van dit array, anders werkt `readEncrypted`/`writeEncrypted` niet voor de nieuwe key.

**Bevestigd:** `readEncrypted(key: string)` accepteert elke string — `SENSITIVE_KEYS` is alleen voor de bulk-migratie functie. We kunnen direct `readEncrypted('encryptedStorage.dayStructure.v1')` gebruiken zonder de array aan te passen.

### 3.6 Bell-icoon: emoji vs IconSymbol

Het huidige bell-icoon is een emoji (`🔔`). De spec beschrijft 5 statussen met visueel verschil. Een emoji kan niet van kleur/stijl wisselen.

**Voorstel:** Vervangen door een `IconSymbol` component (MaterialIcons `notifications` / `notifications-off` / `notifications-paused`) dat dynamisch van kleur/icoon wisselt op basis van `bellState`.

### 3.7 Blok over middernacht — completion edge case

De spec zegt: "completion verschijnt op de dag waarop het blok start." Maar als een gebruiker om 02:00 's nachts de app opent (nieuwe localDayKey), ziet hij het slaapblok van gisteren niet meer.

**Onduidelijkheid:** Is dit gewenst? Of moet een "actief blok dat over middernacht loopt" nog zichtbaar zijn op de nieuwe dag?

**Voorstel:** Spec volgen letterlijk — completion hoort bij startdag. Gebruiker kan in de dagweergave altijd terug naar gisteren.

---

## 4. Implementatievolgorde (voorstel)

| Fase | Wat | Afhankelijkheden |
|------|-----|------------------|
| 1 | Types + constants + TimeAdapter | LocalDeviceTimeService uitbreidingen |
| 2 | Repository (encrypted load/save) + validation | Types, encrypted storage |
| 3 | Service layer (CRUD, completion, copy) | Repository, TimeAdapter |
| 4 | Wizard UI + routes | Service layer |
| 5 | Home card + bell toggle (visueel) | Service layer, types |
| 6 | Notification service (channels, schedule, cancel) | TimeAdapter, Permission service |
| 7 | Permission service + sheets | expo-notifications API |
| 8 | Root integration (handler, observer, reconciliation) | Notification service |
| 9 | Day editor UI | Service layer |
| 10 | Timezone-change hook + foreground detection | TimeAdapter, Notification service |
| 11 | Unit tests | Alle services |
| 12 | app.config.ts updates (sounds, SCHEDULE_EXACT_ALARM) | — |

---

## 5. Samenvatting

**Fundament is solide** — encrypted storage, time service, notifications package, en home screen layout zijn er. Maar de feature zelf is 100% nieuw: geen enkele service, type, route, of component bestaat al. De grootste technische risico's zitten in:

1. **`resolveNextOccurrence`** — correcte weekdag+tijd→absolute Date berekening met timezone
2. **Custom wake sound** — binary-level config die niet in sandbox te testen is
3. **Notification reconciliation** — robuust omgaan met OS die notifications wist

De spec is zeer gedetailleerd en laat weinig ambiguïteit. Het is een stevig stuk werk (~12 services/components, ~6 routes, ~50+ i18n keys) maar architecturaal clean omdat het volledig lokaal is en geen server/engine/GPT raakt.
