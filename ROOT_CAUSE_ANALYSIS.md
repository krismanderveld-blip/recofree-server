# Root Cause Analysis — Backpack Not Reaching GPT-4o + Keyboard Overlap

## PROBLEEM A: Elias kent Jules/Melissa niet (backpack bereikt GPT niet)

### Root Cause: Race Condition in chat.tsx

In `chat.tsx` regels 136-141:
```tsx
startSession();          // dispatches START_SESSION to reducer
sendGreetingViaP();      // immediately calls getBackpack() and getUserDat()
```

`startSession()` dispatcht een actie naar de React reducer. Maar React state updates zijn **asynchroon** — de reducer update land pas bij de volgende render cycle. 

`sendGreetingViaP()` wordt **onmiddellijk** daarna aangeroepen en roept `getBackpack()` en `getUserDat()` aan. Deze getters returnen de **huidige** reducer state (vóór de START_SESSION update). 

**Maar dit is NIET de echte oorzaak.** De getters returnen `state.backpack` en `state.userDat` die al geladen zijn uit AsyncStorage bij mount. De backpack data IS beschikbaar.

### Werkelijke Root Cause: De backpack wordt WEL meegestuurd, maar GPT hallucineert toch

Na het traceren van de volledige flow:
1. `sendGreetingViaP()` → `getBackpack()` returnt de backpack (die is geladen bij mount)
2. `generateGreeting(backpack, provider, userDat, diaryEntries)` → `isSessionStart: true`
3. `OpenAIProvider.generateResponse()` → `buildBackpackPayload(context.backpack)` → stuurt lifeStory mee
4. Server ontvangt backpack → `buildSystemPrompt()` → injecteert levensverhaal in system prompt

**Het probleem zit in de INHOUD van de backpack.** De backpack bevat de levensverhaal-secties, maar:
- De secties zijn mogelijk LEEG (default secties zonder content)
- Of de relaties (Jules = zoon, Melissa = vriendin) staan niet expliciet genoeg in de tekst
- Of GPT negeert de instructies ondanks de anti-hallucinatie regels

### Verificatie nodig:
- Server-side logging toevoegen om te zien WAT er exact in het system prompt terechtkomt
- Controleren of de backpack.lifeStory daadwerkelijk content bevat bij de API call

---

## PROBLEEM B: Toetsenbord bedekt chat op Android

### Root Cause: Tab bar blijft zichtbaar + dubbele padding

1. **Tab layout** (`_layout.tsx`): Geen `tabBarHideOnKeyboard: true` ingesteld. De tab bar (56 + insets.bottom px) blijft ALTIJD zichtbaar, ook wanneer het toetsenbord open is.

2. **Chat input bar** (`chat.tsx` regel 484): 
   ```tsx
   paddingBottom: Platform.OS === 'android' && keyboardVisible ? 8 : tabBarHeight
   ```
   Wanneer het toetsenbord open is op Android:
   - `softwareKeyboardLayoutMode: "resize"` verkleint het venster
   - De tab bar neemt nog steeds ~70px in beslag (niet verborgen)
   - De input bar heeft 8px padding
   - Maar het verkleinde venster moet nu passen: header + messages + input + tab bar
   - Er is simpelweg niet genoeg ruimte → input en berichten worden afgekapt

### Fix:
- `tabBarHideOnKeyboard: true` toevoegen aan de tab layout screenOptions
- Dit verbergt de tab bar automatisch wanneer het toetsenbord opent op Android
- Dan hoeft de chat input bar geen speciale keyboard-logica meer te hebben

---

## Samenvatting fixes

| # | Probleem | Root Cause | Fix |
|---|----------|-----------|-----|
| A | Backpack bereikt GPT niet / GPT hallucineert | Backpack content mogelijk leeg OF GPT negeert instructies | Server-side logging + verificatie + eventueel prompt versterking |
| B | Toetsenbord bedekt chat | Tab bar niet verborgen bij keyboard + dubbele ruimte-reservering | `tabBarHideOnKeyboard: true` in tab layout |
