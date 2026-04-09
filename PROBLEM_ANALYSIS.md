# RecoFree — Probleemanalyse na test met echte data

## Samenvatting

Na het lezen van de volledige RecoFree canon-specificaties en de huidige code heb ik **5 kernproblemen** geïdentificeerd. Ze vallen uiteen in twee categorieën: **AI-gedrag** (Elias fabuleert/haalt door elkaar) en **UI** (toetsenbord bedekt chat).

---

## PROBLEEM 1: Elias fabuleert over personen en relaties

**Wat er gebeurt:** Elias noemt Jules een "goede vriend uit het herstelproces" terwijl hij je zoon is. Melissa wordt je "zus" genoemd terwijl ze je vriendin is.

**Oorzaak:** Het system prompt mist een **anti-hallucinatie instructie**. Het zegt wel "You KNOW this story" en "reference it naturally", maar het zegt NIET:

> "Als een persoon, relatie of feit NIET expliciet in de backpack staat, zeg dan eerlijk dat je het niet weet. Verzin NOOIT relaties, rollen, achtergrondverhalen of feiten over het leven van de gebruiker."

Het huidige prompt moedigt GPT-4o zelfs aan om "naturally" te refereren — waardoor het model gaat confabuleren als het een naam herkent maar de exacte relatie niet vindt of verkeerd interpreteert.

**Canon-referentie:** Module 033 (Rechterhandmodule/Kwaliteitscontrole) schrijft expliciet voor:
- `fabricated_info_suspected == true → blokkeer output, activeer kwaliteitscontrole`
- `output_inconsistency == true → blokkeer output`

Dit is **niet geïmplementeerd** in het system prompt of de pipeline.

**Oplossing:**
- Harde anti-hallucinatie regel toevoegen aan het system prompt
- Expliciet instrueren: "Personen en hun rollen staan EXACT in de backpack. Jules = zoon. Melissa = vriendin. Als je twijfelt, vraag het — verzin het niet."
- Optioneel: een gestructureerde "relatiekaart" extraheren uit de backpack en apart meesturen, zodat GPT-4o een duidelijke lookup-tabel heeft

---

## PROBLEEM 2: Elias herkent geen schema's of modi

**Wat er gebeurt:** Elias reageert generiek empathisch maar herkent geen diepere patronen zoals schematherapie-modi, relationele patronen, kindertijd-invloeden, of terugkerende levensthema's.

**Oorzaak:** Het system prompt bevat **geen instructie over schematherapie, modi-herkenning, of patroondetectie**. De canon specificeert dit expliciet:

- **Elias Identity (Therapeutische Basis):** "Schematherapie en modi-herkenning" staat als kernmethode
- **Elias Identity (Functionele Modules):** "Relatiedetectie (Jules, Melissa, moeder, sociaal isolement)" en "Rugzakanalyse + herbelevingsdetectie"
- **Module Trigger Map:** Module voor schema-integratie activeert bij `levenspatronen_herkenning`, `kindertijd_invloed`, `relationele_patronen`

Het huidige system prompt noemt alleen "ACT, CBT, DBT, and mindfulness" in één zin, zonder enige instructie over HOE deze toe te passen op de backpack-data.

**Oplossing:**
- System prompt uitbreiden met schematherapie-instructies
- Expliciet instrueren om patronen te herkennen in de levensfases (kindertijd → adolescentie → volwassenheid)
- Modi-herkenning toevoegen: kwetsbaar kind, boze beschermer, veeleisende ouder, gezonde volwassene
- Relatiedetectie-instructie: "Analyseer relaties die in de backpack staan en herken patronen (loyaliteit, vermijding, afhankelijkheid)"

---

## PROBLEEM 3: Elias-identiteit is te generiek — canon niet geïmplementeerd

**Wat er gebeurt:** Het system prompt definieert Elias als "a warm, empathetic companion" — een generieke beschrijving die niets te maken heeft met de rijke identiteit uit de canon.

**Oorzaak:** De `elias.dat` en `ELIAS_IDENTITEIT_COMPLETE_V2025.txt` bevatten een gedetailleerde persoonlijkheid met:
- Stoïcijnse principes (Amor Fati, Apátheia, Dichotomie van controle)
- Specifieke gedragsregels ("Zegt niets als dat veiliger is", "Gebruikt geen bevestiging als onduidelijkheid aanwezig is")
- Contextafhankelijk gedrag (hoog verlangen → grounding, lage stemming → zachte aanmoediging, crisis → directe ondersteuning)
- Stilte-detectie, regressie-herkenning, dissociatie-detectie
- Filosofische responslogica

**Niets hiervan** zit in het huidige system prompt.

**Oplossing:**
- System prompt herschrijven op basis van de canon-identiteit
- Stoïcijnse principes integreren
- Gedragsregels per context toevoegen (gebaseerd op slider-waarden)
- Elias' unieke kenmerken implementeren: "Ik ben er ook in stilte", "Ik oordeel niet, ik diagnoseer niet, ik dwing niet"

---

## PROBLEEM 4: Module 12 (vooranalyse/failsafe) niet geïmplementeerd

**Wat er gebeurt:** Elias reageert altijd, ook als er onvoldoende input is.

**Oorzaak:** Module 12 schrijft voor:
- Zonder slider-, rugzak- of dagboekinput → AI-reactie = gedeactiveerd
- Enkel toegestane uitspraak: "Ik weet nu niets van jou. Ik wacht tot jij iets deelt."
- Pas na eerste input wordt responsmatrix actief

Dit is niet geïmplementeerd. De pipeline stuurt altijd een bericht naar GPT-4o, ongeacht of er voldoende context is.

**Oplossing:**
- Pre-check in de pipeline: zijn sliders ingevuld? Is de backpack niet leeg? Is er recente dagboek-input?
- Indien niet: lokaal antwoord genereren (geen API-call), met de canon-tekst
- Indien wel: normale flow

---

## PROBLEEM 5: Toetsenbord bedekt chat-invoer op Android

**Wat er gebeurt:** Op Android bedekt het toetsenbord de berichten en het invoerveld, ondanks `softwareKeyboardLayoutMode: "resize"` in app.config.ts.

**Oorzaak:** De chat.tsx heeft `paddingBottom: tabBarHeight` op de input bar. Wanneer Android het venster verkleint (resize), wordt de tab bar al meegerekend door het systeem. De extra `tabBarHeight` padding duwt het invoerveld ONDER het zichtbare gebied.

Daarnaast: de FlatList heeft `automaticallyAdjustKeyboardInsets={isIOS}` — dit is correct voor iOS maar doet niets op Android. Het probleem is dat de resize-modus het venster verkleint, maar de input bar's eigen padding het buiten beeld duwt.

**Oplossing:**
- De `paddingBottom` van de input bar moet dynamisch zijn: wanneer het toetsenbord open is op Android, moet de tab bar padding wegvallen (het systeem handelt het al af via resize)
- Gebruik `Keyboard.addListener` om te detecteren of het toetsenbord open is, en pas de padding aan
- Alternatief: verwijder de vaste `tabBarHeight` padding en gebruik in plaats daarvan de daadwerkelijke safe area insets

---

## Prioriteitsvolgorde (aanbevolen)

| # | Probleem | Impact | Complexiteit |
|---|----------|--------|-------------|
| 1 | Anti-hallucinatie + relatiekaart | Kritiek — vertrouwen | Middel |
| 2 | Elias-identiteit herschrijven op basis van canon | Kritiek — kern van de app | Hoog |
| 3 | Schema/modi-herkenning | Hoog — therapeutische waarde | Middel |
| 4 | Toetsenbord-fix Android | Hoog — bruikbaarheid | Laag |
| 5 | Module 12 vooranalyse/failsafe | Middel — ethisch vereist | Middel |
