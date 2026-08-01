# Data Flow Trace: Waarom kent Elias Ellen niet?

## De volledige keten

### 1. CLIENT: gpt-payload-builder.ts (SESSION_INIT)

**Na onze fix:** stuurt altijd volle backpack.lifeStory + extractedEntities + userDat.

**Vóór onze fix (context.dat mode):** stuurde `lifeStory: []` en geen extractedEntities.

### 2. SERVER: ai-chat.ts (SESSION_INIT ontvangst, lijn 489-523)

De server bouwt `sessionCache` met:
- `relationshipMap` = `extractRelationshipMap(input.backpack.lifeStory, initialContext, extractedEntities)`
- `lifeStorySummary` = `buildCompactLifeStorySummary(lifeStory, initialContext, userName)`

**PROBLEEM VÓÓR FIX:** Als `lifeStory: []` binnenkwam (context.dat mode), dan:
- `extractRelationshipMap([], '', undefined)` → regex vindt niks → `""` (leeg)
- `buildCompactLifeStorySummary([], '', userName)` → `""` (leeg)

**Resultaat:** `sessionCache.relationshipMap = ""` en `sessionCache.lifeStorySummary = ""`

### 3. SERVER: Follow-up berichten (lijn 2006-2053)

Bij elk follow-up bericht:
- `conditional.relationshipMap` = `sessionCache.relationshipMap` → **leeg**
- `lifeStoryContext` = `sessionCache.lifeStorySummary` → **leeg**

### 4. SERVER: buildSelectiveRelevanceBlock (lijn 1382-1386)

```
if (conditional.relationshipMap) {  // "" is falsy → SKIP
  parts.push(`RELATIEKAART:`);
  parts.push(`${conditional.relationshipMap}`);
}
```

→ PERSONEN-LOOKUP wordt NIET geïnjecteerd in het prompt.

### 5. GPT ontvangt het prompt ZONDER:
- Geen PERSONEN-LOOKUP tabel
- Geen PERSONAL MEMORY met levensverhaal
- Geen relatie-informatie

### 6. Gebruiker vraagt "Wie is Ellen?"
→ GPT heeft geen data → "Ik weet niet wie Ellen is"

---

## Waarom de huidige fix werkt

Na onze fix stuurt de client ALTIJD `lifeStory: [volledige secties]` + `extractedEntities`.
De server ontvangt dit en bouwt:
- `relationshipMap` met alle personen (Ellen, Jules, etc.)
- `lifeStorySummary` met het volledige levensverhaal

Bij follow-up berichten injecteert de server dit in het GPT prompt.

---

## Het toekomstige optimalisatie-pad

Wanneer we tokens willen besparen:
1. SESSION_INIT stuurt volle backpack (1x)
2. Server bouwt sessionCache met relationshipMap + lifeStorySummary
3. Follow-up berichten hoeven NIET de volle backpack opnieuw te sturen
4. Maar de SERVER moet de gecachede data WEL injecteren in elk GPT prompt

Het probleem was NOOIT de server-cache zelf — die werkt correct.
Het probleem was dat de CLIENT lege data stuurde, waardoor de server-cache leeg werd OPGEBOUWD.

---

## Conclusie

De "brute force" fix (altijd volle backpack meesturen) is eigenlijk de CORRECTE fix voor nu:
- De backpack gaat 1x mee bij SESSION_INIT
- De server cached de relevante extracties (personen, levensverhaal)
- Follow-up berichten gebruiken de cache

Later kunnen we optimaliseren door:
- context.dat te gebruiken als EXTRA laag in het prompt (naast de gecachede data)
- Niet als VERVANGING van de brondata die de server nodig heeft om de cache op te bouwen
