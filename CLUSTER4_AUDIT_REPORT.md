# Cluster 4 Audit Report — HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01

## Algemene bevindingen

De Cluster 4 modules zijn **pre-relational-stance** gebouwd. Ze bevatten geen expliciete fouten zoals "je moet weggaan" of "de ander is het probleem", maar ze missen de verbindingslaag die de rest van Kim nu wel heeft. Het risico is niet actieve schade, maar **passieve polarisering door omissie**: ze valideren de naaste zonder ooit het perspectief van de ander te verkennen, en ze bieden zelfzorg/reflectie aan zonder verbinding als doel te benoemen.

De RELATIONAL_STANCE_FILTER draait wel voor deze modules (pipeline lijn 3200-3215, `crisisLevel < 2`), maar de module-prompts zelf bevatten geen instructie om de filter-output te integreren. De K05 cross-module override draait server-side na GPT-output en vangt kale grenzen, maar de module-prompts sturen GPT niet actief richting verbinding.

---

## HOOP-K01 — Hoop-uitputting

| # | Criterium | Bevinding |
|---|-----------|-----------|
| 1 | Bestandspad | `lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads.ts` (lijn 14-39) |
| 2 | Huidige prompt/stance | Valideert hoop-uitputting, geen push stay/leave, geen push hope/give-up. 5-staps: valideer → benoem "genoeg is genoeg" → scheid waarde van herstel ander → reflectie bearable vs breaking → bridge naar andere modules. |
| 3 | Triggerlogica | `kimCluster4Detector.ts`: detecteert hope exhaustion markers (NL/EN/FR), "enough is enough" signalen. Suicidality split correct: situationele hopeloosheid → reflectief, suïcidale ideatie → CRISIS-K01. |
| 4 | Mogelijke oude framing | **"Separate Kim's worth from the loved one's recovery"** (stap 3) — dit is correct als zelfzorg, maar mist de nuance dat hoop ook verbinding kan voeden. Hoop wordt alleen geframed als iets dat uitgeput raakt, nooit als iets dat richting kan geven. |
| 5 | Risico op polarisering | **MIDDEN** — De prompt zegt expliciet "do not push staying or leaving", maar biedt geen perspectief op de ander. Als de naaste zegt "ik hoop niet meer dat het beter wordt", valideert Kim dat zonder te vragen wat de naaste eigenlijk hoopt (herstel? eerlijkheid? veilig contact? eigen rust?). |
| 6 | Risico op te vroege afstand | **MIDDEN** — "One small reflection on what is still bearable vs. what breaks" kan impliciet richting "dit is niet meer te dragen" duwen als Kim geen tegenwicht biedt. |
| 7 | Risico op minimalisering bij RELATIONAL_HARM | **LAAG** — De prompt minimaliseert niet, maar mist ook de harm-layer: bij herhaald vertrouwenstrauma zou hoop-uitputting anders benaderd moeten worden dan bij gewone slijtage. |
| 8 | Risico op verbinding forceren bij safety | **LAAG** — Suicidality split is correct. Safety bridge prompt is adequaat. |
| 9 | K05 override correct gerespecteerd? | **GEDEELTELIJK** — K05 draait server-side na output, maar de prompt zelf genereert zelden kale grenzen. Het risico is eerder dat K05 niets te corrigeren heeft omdat de prompt te passief is. |
| 10 | RELATIONAL_STANCE_FILTER correct geactiveerd? | **JA** — Filter draait voor alle Kim modules bij crisisLevel < 2. Maar de prompt bevat geen instructie om de filter-directieven te integreren. |
| 11 | Concrete voorbeeldoutput oud risico | Naaste: "Ik hoop al jaren dat het beter wordt, maar het wordt alleen maar erger." → Kim: "Ik hoor dat je al lang hoopt en dat die hoop steeds zwaarder wordt. Het is begrijpelijk dat je je afvraagt hoeveel je nog kunt dragen." → **Mist**: "Wat zou je eigenlijk willen dat er verandert? Wat voor soort hoop zou voor jou realistisch voelen?" |
| 12 | Patch nodig? | **JA** |
| 13 | Aanbevolen patchrichting | Voeg toe: (a) hoop-differentiatie (hoop op herstel vs hoop op eerlijkheid vs hoop op veilig contact vs hoop op eigen rust), (b) verbindingsvraag ("wat zou je willen dat er verandert in het contact?"), (c) bij RELATIONAL_HARM: hoop koppelen aan herstelvoorwaarden, (d) RELATIONAL CONNECTION CHECK. |

---

## SCHAAM-K01 — Schaamte

| # | Criterium | Bevinding |
|---|-----------|-----------|
| 1 | Bestandspad | `lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads.ts` (lijn 41-65) |
| 2 | Huidige prompt/stance | Valideert schaamte zonder het waarheid te maken, scheidt verantwoordelijkheid, benoemt dat geheimhouding isolatie vergroot, biedt één veilige connectiestap. |
| 3 | Triggerlogica | Detecteert schaamte/secrecy/withdrawal markers. Correct Kim-only. |
| 4 | Mogelijke oude framing | **"Separate Kim's responsibility from the loved one's behavior"** (stap 2) — dit is correct, maar kan doorslaan naar "jij hebt niets verkeerd gedaan" als de GPT dat te absoluut interpreteert. De prompt zegt niet expliciet dat de naaste ook eigen aandeel mag erkennen (bijv. enabling, vermijding, geheimhouding als keuze). |
| 5 | Risico op polarisering | **MIDDEN-HOOG** — "Do not make Kim responsible for the loved one's behavior" is correct, maar de prompt mist de nuance dat schaamte soms ook komt doordat de naaste zelf dingen doet die niet kloppen (bijv. liegen tegen familie, meedoen aan geheimhouding, eigen grenzen niet stellen). Als Kim alleen valideert zonder dit te verkennen, bevestigt ze de naaste in een slachtofferrol. |
| 6 | Risico op te vroege afstand | **LAAG** — De prompt duwt niet richting afstand. "One tiny safe connection step" is goed. |
| 7 | Risico op minimalisering bij RELATIONAL_HARM | **MIDDEN** — Bij herhaald vertrouwenstrauma kan schaamte een signaal zijn dat de naaste weet dat er iets fundamenteel mis is. De prompt behandelt schaamte als iets om te verzachten, maar bij harm-patronen moet schaamte soms serieus genomen worden als signaal, niet alleen verzacht. |
| 8 | Risico op verbinding forceren bij safety | **LAAG** — Geen verbinding-forcering. |
| 9 | K05 override correct gerespecteerd? | **GEDEELTELIJK** — Zelfde als HOOP: K05 draait maar prompt stuurt niet actief richting verbinding. |
| 10 | RELATIONAL_STANCE_FILTER correct geactiveerd? | **JA** — Filter draait. Prompt integreert het niet. |
| 11 | Concrete voorbeeldoutput oud risico | Naaste: "Ik schaam me dat ik tegen mijn moeder heb gelogen over waar de ander is." → Kim: "Schaamte is begrijpelijk. Jij bent niet verantwoordelijk voor het gedrag van de ander." → **Mist**: "Tegelijk merk ik dat je zelf ook iets doet dat niet bij je past — liegen tegen je moeder. Hoe voelt dat voor jou? Wat zou je eigenlijk willen zeggen?" |
| 12 | Patch nodig? | **JA** |
| 13 | Aanbevolen patchrichting | Voeg toe: (a) schaamte-differentiatie (schaamte over de ander vs schaamte over eigen gedrag vs schaamte over de situatie), (b) eigen aandeel zacht bevragen zonder beschuldiging, (c) verbindingsvraag ("wat zou je willen dat je moeder/vriend/collega wist?"), (d) bij RELATIONAL_HARM: schaamte als signaal serieus nemen, (e) RELATIONAL CONNECTION CHECK. |

---

## ROUW-K01 — Ambigue rouw

| # | Criterium | Bevinding |
|---|-----------|-----------|
| 1 | Bestandspad | `lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads.ts` (lijn 67-93) |
| 2 | Huidige prompt/stance | Valideert levende rouw/ambigue verlies, staat gemengde gevoelens toe, geen sluitingsdruk, één rouw-houdende reflectie. |
| 3 | Triggerlogica | Detecteert grief/loss/missing markers. Correct Kim-only. |
| 4 | Mogelijke oude framing | **"Validate missing the person/relationship/future as it was imagined"** (stap 2) — dit is goed, maar het frame is volledig verlies-gericht. Rouw wordt behandeld alsof de relatie al voorbij is ("as it was imagined" = verleden tijd). De prompt mist dat rouw kan bestaan naast actieve liefde en actief contact. |
| 5 | Risico op polarisering | **HOOG** — Dit is het hoogste risico van alle vier. De prompt zegt "do not push staying or leaving" en "do not erase love", maar het hele frame is rouw = verlies. Als de naaste zegt "ik mis wie de ander vroeger was", kan Kim dit valideren op een manier die impliciet zegt "die persoon bestaat niet meer". Dat is een impliciete demonisering van de huidige persoon met verslaving. |
| 6 | Risico op te vroege afstand | **HOOG** — "Avoid closure or decision pressure" is goed als regel, maar het frame zelf duwt richting afscheid. Rouw impliceert verlies, en als Kim dat alleen valideert zonder te verkennen of er ook hoop, verandering of herstel mogelijk is, bevestigt ze de naaste in een rouwproces dat de relatie al als verloren beschouwt. |
| 7 | Risico op minimalisering bij RELATIONAL_HARM | **MIDDEN** — Bij herhaald vertrouwenstrauma is rouw legitiem en moet niet geminimaliseerd worden. Maar de prompt maakt geen onderscheid tussen rouw door slijtage en rouw door actieve schade. |
| 8 | Risico op verbinding forceren bij safety | **LAAG** — Geen verbinding-forcering. |
| 9 | K05 override correct gerespecteerd? | **GEDEELTELIJK** — K05 draait maar prompt genereert zelden grenzen. Het risico is dat Kim rouw valideert op een manier die impliciet afstand normaliseert, zonder dat K05 dat kan vangen (want er is geen expliciete grens-zin). |
| 10 | RELATIONAL_STANCE_FILTER correct geactiveerd? | **JA** — Filter draait. Prompt integreert het niet. |
| 11 | Concrete voorbeeldoutput oud risico | Naaste: "Ik mis wie de ander vroeger was. Soms herken ik diegene niet meer." → Kim: "Dat is een vorm van rouw die heel reëel is, ook al is de ander er nog. Je mist iemand die er nog is maar anders is geworden." → **Mist**: "Tegelijk is de ander er nog. Zijn er momenten waarop je de persoon die je mist nog wel ziet? Wat zou je nodig hebben om die momenten vaker te laten gebeuren?" |
| 12 | Patch nodig? | **JA — PRIORITEIT** |
| 13 | Aanbevolen patchrichting | Voeg toe: (a) rouw-differentiatie (rouw om wie iemand was vs rouw om de relatie vs rouw om de toekomst vs rouw om eigen verlies), (b) **verplichte verbindingsvraag**: "zijn er momenten waarop je de persoon die je mist nog wel ziet?", (c) rouw mag naast liefde bestaan — niet als vervanging, (d) bij RELATIONAL_HARM: rouw als signaal van herhaalde schade, herstelvoorwaarden benoemen, (e) bij gewone slijtage: hoop en rouw mogen naast elkaar bestaan, (f) RELATIONAL CONNECTION CHECK, (g) forbidden: "die persoon bestaat niet meer", "je rouwt om iemand die er nog is" (minimaliserend). |

---

## ISOL-K01 — Isolatie

| # | Criterium | Bevinding |
|---|-----------|-----------|
| 1 | Bestandspad | `lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads.ts` (lijn 95-119) |
| 2 | Huidige prompt/stance | Benoemt isolatie zonder schuld, valideert energielimieten, biedt één kleine herverbindingsstap. |
| 3 | Triggerlogica | Detecteert social isolation markers. Correct Kim-only. |
| 4 | Mogelijke oude framing | **"Support one small, safe reconnection step"** (stap 4) — dit is goed, maar de "reconnection" is alleen gericht op sociaal netwerk buiten de relatie. De prompt mist dat isolatie ook binnen de relatie kan bestaan (de naaste isoleert zich van de persoon met verslaving) en dat herverbinding ook richting de ander kan gaan. |
| 5 | Risico op polarisering | **MIDDEN** — De prompt demoniseert niet, maar framt isolatie als iets dat "through caregiving" ontstaat. Dat impliceert dat de relatie de oorzaak is van de isolatie, wat de ander indirect als bron van schade positioneert. |
| 6 | Risico op te vroege afstand | **MIDDEN** — "One tiny reconnection step" is goed, maar als die stap alleen buiten de relatie wordt gezocht ("bel een vriendin", "ga naar een groep"), normaliseert Kim impliciet dat de relatie zelf geen bron van verbinding kan zijn. |
| 7 | Risico op minimalisering bij RELATIONAL_HARM | **LAAG** — Bij herhaald vertrouwenstrauma is isolatie vaak een beschermingsmechanisme. De prompt minimaliseert dit niet. |
| 8 | Risico op verbinding forceren bij safety | **LAAG** — Geen verbinding-forcering. |
| 9 | K05 override correct gerespecteerd? | **GEDEELTELIJK** — Zelfde patroon als andere modules. |
| 10 | RELATIONAL_STANCE_FILTER correct geactiveerd? | **JA** — Filter draait. Prompt integreert het niet. |
| 11 | Concrete voorbeeldoutput oud risico | Naaste: "Ik zie niemand meer. Ik durf niet meer af te spreken want ik wil niet uitleggen wat er thuis gebeurt." → Kim: "Isolatie kan sluipend ontstaan als je veel draagt. Je hoeft niet alles te vertellen. Eén klein contact kan al verschil maken." → **Mist**: "Tegelijk merk ik dat je ook binnen je relatie alleen lijkt te staan. Hoe is het contact met de ander zelf? Is er ruimte om daar iets van te delen?" |
| 12 | Patch nodig? | **JA** |
| 13 | Aanbevolen patchrichting | Voeg toe: (a) isolatie-differentiatie (sociaal vs relationeel vs emotioneel), (b) herverbinding ook richting de ander waar veilig, (c) steun verbreden = relatie ontlasten, niet vervangen, (d) bij RELATIONAL_HARM: isolatie als bescherming erkennen, herstelvoorwaarden benoemen, (e) RELATIONAL CONNECTION CHECK. |

---

## Samenvatting

| Module | Patch nodig | Risico | Prioriteit |
|--------|------------|--------|------------|
| ROUW-K01 | JA | HOOG | 1 — hoogste risico op impliciete demonisering |
| SCHAAM-K01 | JA | MIDDEN-HOOG | 2 — eigen aandeel ontbreekt |
| HOOP-K01 | JA | MIDDEN | 3 — hoop-differentiatie ontbreekt |
| ISOL-K01 | JA | MIDDEN | 4 — isolatie alleen buiten relatie |

## Ontbrekende testcases

Per module ontbreken tests die controleren:
1. Prompt bevat verbindingsvraag richting de ander
2. Prompt bevat RELATIONAL CONNECTION CHECK
3. Prompt differentieert tussen gewone slijtage en RELATIONAL_HARM
4. Forbidden list bevat impliciete demonisering ("die persoon bestaat niet meer")
5. Output bij rouw bevat niet alleen verlies maar ook hoop/verbinding
6. Output bij schaamte bevraagt eigen aandeel zacht
7. Output bij isolatie biedt herverbinding ook richting de ander
8. Safety-case wordt niet gecorrigeerd

## Aanbevolen implementatievolgorde

1. **ROUW-K01** — hoogste risico, impliciete demonisering
2. **SCHAAM-K01** — eigen aandeel ontbreekt
3. **HOOP-K01** — hoop-differentiatie
4. **ISOL-K01** — isolatie-richting verbreden
5. **Tests** — 8 testcases per module
6. **Checkpoint** — review voor dashboard
