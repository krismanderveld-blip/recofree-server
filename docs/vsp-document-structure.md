# VSP Document Structure Analysis

Based on the reference document "Mijn Persoonlijk Vroegsignaleringsplan", the structure is:

## Per Zone (GROEN, GEEL, ORANJE, ROOD, PAARS)

Each zone contains:
1. **Zone description** — What this zone means for the person (free text intro)
2. **Signals** ("Hoe ik mezelf herken in [zone]") — List of recognition signals
3. **What helps** ("Wat ik doe in [zone]" / "Wat moet gebeuren in [zone]") — Actions/strategies
4. **Anchor sentence** ("Mijn zin voor [zone]") — One personal sentence that captures the zone's essence
5. **Extra rule** (optional) — Additional personal boundary for this zone

## Triggers Section ("MIJN PERSOONLIJKE KERNTRIGGERS")

Each trigger has:
1. **Trigger name** — e.g., "Controleverlies", "Onrecht en machteloosheid"
2. **Description** — What this trigger does to the person
3. **Counter-sentence** ("Mijn tegenzin") — A grounding sentence against the trigger

## Recovery Rules ("MIJN HERSTELREGELS")

Numbered list of personal rules (1-10 in the example).

## Emergency Card ("MIJN KORTE NOODKAART")

Brief per-zone summary (condensed version of the full plan).

## Personal Insight ("PERSOONLIJK INZICHT OVER MIJZELF")

Free text reflection on personal patterns.

## Target VspStructuredPlan Mapping

```typescript
interface VspStructuredPlan {
  zones: {
    GROEN?: VspZoneEntry;
    GEEL?: VspZoneEntry;
    ORANJE?: VspZoneEntry;
    ROOD?: VspZoneEntry;
    PAARS?: VspZoneEntry;
  };
  triggers: VspTriggerEntry[];
  recoveryRules: string[];
}

interface VspZoneEntry {
  signals: string[];      // "Hoe ik mezelf herken"
  whatHelps: string[];    // "Wat ik doe" / "Wat moet gebeuren"
  anchorSentence: string; // "Mijn zin voor [zone]"
}

interface VspTriggerEntry {
  name: string;           // Trigger name
  description?: string;   // What it does
  counterSentence: string; // "Mijn tegenzin"
}
```
