# Kim / Eigen Regie — Volledige Specificatie

Dit document beschrijft het volledige Eigen Regie systeem voor Kim-gebruikers in RecoFree. Het is bedoeld als spec om een nieuw "Eigen Regie Plan" (vergelijkbaar met het VSP bij Elias) te laten bouwen.

---

## 1. Context: Wie is Kim?

Kim is het persona voor **naasten** van iemand met een verslaving (partner, ouder, kind, vriend). Kim's kernthema is **eigen regie** — de mate waarin het eigen leven wordt bepaald door de keuzes van de ander.

**Elias** = persoonlijk herstel (verslaving zelf) → heeft een **VSP** (Vroeg Signalerings Plan)
**Kim** = naaste ondersteunen → heeft **Eigen Regie** maar nog **geen** gestructureerd zone-document

---

## 2. Huidige Architectuur

### 2.1 Sliders (dagelijks)

```typescript
interface KimMoodSliders {
  stress: number;            // 0-10
  boundaryFatigue: number;   // 0-10
  emotionalBurden: number;   // 0-10
  selfCare: number;          // 0-10
  eigenRegie: number | null; // 0-100 (null = niet ingevuld)
}
```

### 2.2 Eigen Regie Slider

**Vraag aan gebruiker:** "In hoeverre werd jouw dag vandaag bepaald door de keuzes van de ander?"

| Slider waarde | Betekenis |
|---------------|-----------|
| 0 | Volledig eigen regie |
| 100 | Volledig bepaald door de ander |

**Engine transformatie:** `engineScore = 100 - userInput` (inversie: hoge engine score = meer eigen regie)

### 2.3 Zone Mapping (engineScore → zone)

| Engine Score | Zone | Label | Betekenis |
|-------------|------|-------|-----------|
| 0–20 | ROOD | Loss of self-direction | "Ik was volledig gericht op de ander. Ik voelde me verantwoordelijk voor hun gedrag." |
| 21–40 | ORANJE | Limited self-direction | "Ik was vooral bezig met de ander. Mijn eigen behoeften kwamen nauwelijks aan bod." |
| 41–60 | GEEL | Fluctuating self-direction | "Ik dacht vaak aan de ander, maar dacht ook kort aan mezelf." |
| 61–80 | LICHTGROEN | Growing self-direction | "Ik hield rekening met de ander, maar bleef ook bij mezelf." |
| 81–100 | GROEN | Strong self-direction | "Ik volgde mijn eigen plan. Ik voelde me vrij, ongeacht wat de ander deed." |

### 2.4 Zone Impact (hoe Kim reageert per zone)

| Zone | Stabilisatie | Challenge | Autonomie | Primary Directive | Secondary Directive |
|------|-------------|-----------|-----------|-------------------|---------------------|
| ROOD | HIGH | NONE | LOW | stabilize | no confrontation |
| ORANJE | HIGH | LOW | LOW | raise awareness | light reflection |
| GEEL | MEDIUM | MEDIUM | MEDIUM | deepen insight | gentle mirroring |
| LICHTGROEN | LOW | MEDIUM | HIGH | strengthen | give small direction |
| GROEN | HIGH | HIGH | HIGH | autonomy | challenge possible |

### 2.5 Crisis Trigger

Kim crisis = `eigenRegie userInput < 10` (bijna volledig verlies van eigen regie). Equivalent van Elias PAARS. Triggert gpt-4o + ground regulation.

---

## 3. Kim Backpack (huidige structuur)

Kim heeft 5 vrije tekstvelden (geen zones):

```typescript
kimBackpack: {
  my_story: string;           // "Wie ben ik buiten deze relatie?"
  the_relationship: string;   // "Hoe is het geëvolueerd? Wanneer veranderde het?"
  the_impact: string;         // "Wat heeft verslaving gedaan met mijn leven?"
  my_boundaries: string;      // "Wat kan ik dragen? Wat heb ik geprobeerd?"
  my_strength: string;        // "Waar vind ik kracht?"
}
```

### 3.6 Intake (eenmalig bij onboarding)

```typescript
eigenRegieLevel: 1 | 2 | 3 | 4 | 5;
// 1 = "Mijn leven draait volledig om de ander"
// 2 = "Ik ben vooral gefocust op de ander"
// 3 = "Er is een mix tussen mezelf en de ander"
// 4 = "Ik behoud grotendeels mijn eigen richting"
// 5 = "Ik leef volledig mijn eigen leven"
```

---

## 4. Kim Modules (bestaand)

| ID | Naam | Categorie | Beschrijving |
|----|------|-----------|--------------|
| K01 | Boundary Setting | Core | Gezonde grenzen leren stellen en handhaven |
| K02 | Enabling Awareness | Core | Enabling-gedrag herkennen en stoppen |
| K03 | Self-Care | Core | Eigen welzijn prioriteren |
| K04 | Emotional Regulation | Core | Emotionele overbelasting, verraad, vertrouwen, hoop |
| K05 | Communication Skills | Practical | Effectieve communicatie met iemand in verslaving |
| K06 | Self-Care & Sustainable Support | Growth | Duurzame zorg zonder zelfvernietiging |
| KST01 | Stoicism for Caregivers | Advanced | Stoïcijnse principes voor mantelzorgers |
| KDL01 | Detachment with Love | Advanced | Liefdevol loslaten zonder verlating |
| KBR01 | Boundary Restoration | Advanced | Duidelijke, humane, afdwingbare grenzen |
| KSC01 | Self-Compassion for Caregivers | Advanced | Gegronde zelfcompassie |

---

## 5. Elias VSP ter vergelijking (wat Kim NIET heeft)

Elias heeft een **VspStructuredPlan** met:

```typescript
interface VspStructuredPlan {
  zones: {
    green: VspZoneEntry;   // { signals, whatHelps, anchorSentence }
    yellow: VspZoneEntry;
    orange: VspZoneEntry;
    red: VspZoneEntry;
    purple: VspZoneEntry;
  };
  triggers: VspTrigger[];        // { trigger, counterThought }
  recoveryRules: string[];       // Persoonlijke herstelregels
  mainAnchorSentence: string;    // Overkoepelende kernzin
  lastUpdated: string | null;
}
```

Per zone beschrijft de gebruiker:
- **signals**: Hoe herken ik mezelf in deze zone? (gedachten, gedrag, lichaam)
- **whatHelps**: Wat helpt mij in deze zone? (concrete acties)
- **anchorSentence**: Persoonlijke kernzin voor deze zone

---

## 6. Wat ontbreekt voor Kim: Eigen Regie Plan

Kim heeft wél zones (ROOD→GROEN via eigenRegie score), maar **geen gestructureerd document** per zone met:
- Herkenningssignalen
- Wat helpt
- Kernzinnen

### Gewenste structuur (voorstel):

```typescript
interface EigenRegiePlan {
  zones: {
    rood: EigenRegieZoneEntry;
    oranje: EigenRegieZoneEntry;
    geel: EigenRegieZoneEntry;
    lichtgroen: EigenRegieZoneEntry;
    groen: EigenRegieZoneEntry;
  };
  /** Persoonlijke patronen/triggers die eigen regie ondermijnen */
  triggers: EigenRegieTrigger[];
  /** Persoonlijke grenzen-regels */
  boundaryRules: string[];
  /** Overkoepelende kernzin */
  mainAnchorSentence: string;
  lastUpdated: string | null;
}

interface EigenRegieZoneEntry {
  /** Hoe herken ik mezelf in deze zone? (gedachten, gedrag, lichaam) */
  signals: string;
  /** Wat helpt mij in deze zone? (concrete acties, grenzen) */
  whatHelps: string;
  /** Persoonlijke kernzin voor deze zone */
  anchorSentence: string;
}

interface EigenRegieTrigger {
  /** Wat triggert verlies van eigen regie? */
  trigger: string;
  /** Wat is mijn gezonde reactie/grens? */
  healthyResponse: string;
}
```

---

## 7. Hoe het VSP bij Elias wordt gebruikt (ter referentie)

1. **Bij SESSION_INIT (greeting):** De huidige VSP-zone wordt bepaald, en de bijbehorende `signals`, `whatHelps`, en `anchorSentence` worden meegestuurd naar de LLM.
2. **Bij LIVE_MESSAGE:** Dezelfde zone-content wordt meegestuurd zodat de AI kan verwijzen naar wat de gebruiker zelf heeft opgeschreven.
3. **VSP Insight Profile:** Een apart systeem dat patronen detecteert over sessies heen en een exporteerbaar profiel bouwt.
4. **Export:** Gebruiker kan het VSP exporteren als tekst om te delen met therapeut.

---

## 8. Integratiepunten

### 8.1 Opslag
- Zou opgeslagen moeten worden in `backpack.eigenRegiePlan` (vergelijkbaar met `backpack.vspSection`)
- Gebruiker vult het in via de Backpack/Rugzak UI
- Alleen de gebruiker kan het bewerken

### 8.2 Pipeline integratie
- Bij SESSION_INIT: huidige eigenRegie zone → bijbehorende zone-entry meesturen
- Bij LIVE_MESSAGE: zelfde zone-entry meesturen
- Server-side: injecteren in greeting prompt (vergelijkbaar met VSP-injectie)

### 8.3 Bestaande bestanden die aangepast moeten worden
- `lib/ai/types.ts` — EigenRegiePlan interface toevoegen + aan Backpack interface hangen
- `lib/rugzak/pipeline.ts` — zone-entry meesturen bij SESSION_INIT en LIVE_MESSAGE
- `lib/ai/openai-provider.ts` — payload uitbreiden
- `server/ai-chat.ts` — greeting prompt injectie
- `app/(tabs)/backpack.tsx` — UI voor invullen
- `lib/features/backpackWizard/BackpackWizardScreen.tsx` — wizard stap toevoegen

### 8.4 Kim-specifieke context voor zones

| Zone | Kim-context | Typische signalen |
|------|-------------|-------------------|
| ROOD | Volledig verlies eigen regie | "Ik check constant hun telefoon", "Ik heb mijn afspraken afgezegd voor hen", "Ik voel me verantwoordelijk voor hun gedrag" |
| ORANJE | Beperkte eigen regie | "Ik denk de hele dag aan hen", "Ik pas mijn plannen aan", "Ik loop op eieren" |
| GEEL | Wisselende eigen regie | "Soms lukt het, soms niet", "Ik merk dat ik weer meega", "Ik twijfel aan mijn grenzen" |
| LICHTGROEN | Groeiende eigen regie | "Ik heb mijn grens gehouden", "Ik deed iets voor mezelf", "Ik voelde me minder schuldig" |
| GROEN | Sterke eigen regie | "Ik volgde mijn eigen plan", "Ik voelde me vrij", "Hun keuzes zijn niet mijn verantwoordelijkheid" |

---

## 9. Bestaande Zone-types (gedeeld met Elias)

```typescript
// lib/engine/zone-types.ts
export type ZoneLevel = 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';

export interface ZoneResult<T> {
  readonly level: ZoneLevel;
  readonly label: string;
  readonly impact: T;
}
```

---

## 10. Samenvatting: Wat moet gebouwd worden

1. **EigenRegiePlan type** — interface met zones, triggers, boundaryRules, mainAnchorSentence
2. **Opslag** — in Backpack (naast kimBackpack en vspSection)
3. **UI** — invulscherm in backpack (per zone: signals, whatHelps, anchorSentence)
4. **Pipeline** — zone-entry meesturen op basis van huidige eigenRegie score
5. **Server** — injecteren in greeting prompt
6. **Export** — exporteerbaar als tekst (net als VSP)

Het systeem moet **exact dezelfde patronen** volgen als het VSP bij Elias, maar dan met Kim-specifieke taal en context.
