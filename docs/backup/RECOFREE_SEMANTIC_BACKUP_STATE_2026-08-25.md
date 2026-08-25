# RecoFree Semantic Backup State

**Datum:** 2026-08-25  
**Doel:** bewaren wat Git alleen niet volledig bewaart

## Niet-onderhandelbare architectuur

| Onderwerp | Beslissing |
|---|---|
| Productiebackend | Alleen Railway |
| Client/servergrens | Deterministic engine client-side; server voert GPT-call uit |
| GPT-provider | Direct OpenAI via Railway; `store:false` verplicht |
| Manus/Forge | Geen actieve productie-API/GPT-routing |
| Nano | Tijdelijke semantische module-resolver; adviserend, geen eindbeslisser |
| Persona’s | Kim en Elias strikt gescheiden |
| Kim | Relationele therapeut; geen partij kiezen; grenzen met herstelpad tenzij safety/harm |
| Geheugen | Raw Backpack/user.dat/DIST01/logs niet rechtstreeks naar GPT |
| Diagnoses | Niet infereren; expliciete user-/clinician-reported factors alleen als context |
| Lockfile | Niet regenereren |
| Verwijdering | Niets verwijderen zonder bewezen functieloosheid |

## Actuele bewezen staat

- GitHub/Railway commitbasis vóór wide-range uitbreiding: `570d97d`.
- Railway-only buildsecret en resolver zijn actief.
- Vier kernflags zijn `true`: minimal proxy, CMD, core epistemic engine en model routing.
- Dual Android ABI blijft `armeabi-v7a` plus `arm64-v8a`.
- De nieuwe wide-range gate rapporteert build eligibility en nooit automatisch device readiness.

## Device-only observaties die niet verloren mogen gaan

1. APK v1.2.99 belde aantoonbaar `recobase-vhsxu5ua.manus.space` en kreeg 404.
2. ClinicalCtx/deep-analysis debug kan this-run en stored totals verwarrend tonen; labels zijn verduidelijkt.
3. Schemas/modi moeten bij directe clinical-vraag volledig met aanwezigheidswaarden worden geleverd.
4. Behandelaar-export deed voorheen zichtbaar niets; lokale save en share zijn gescheiden.
5. Draagbalk moet na refresh ook uit risks/protectiveFactors worden gevuld.

## Open productrisico’s

De actuele bron blijft `todo.md`. Belangrijkste brede risico’s zijn: legacy serverroutes, silent fallbackmonitoring, ongeteste schermen, native opslagraces, embedded buildcommit en de post-build deviceacceptatiematrix.

## Backupregel

> Een toekomstige backup is pas volledig wanneer Git/files, deze semantische staat, `todo.md`, devicebevindingen, externe endpoints, buildflags, laatste succesvolle commit en niet-gecommitte wijzigingen samen zijn opgeslagen.

