# RecoFree standalone signing- en buildoverdracht

**Status:** technisch voorbereid; bestaande private signingcredential en certificaatfingerprint moeten nog door de eigenaar worden geëxporteerd en geverifieerd. **Er wordt geen nieuwe signingkey gegenereerd.**

## 1. Identiteit die niet mag wijzigen

| Veld | Canonieke waarde |
|---|---|
| Appnaam | `RecoFree` |
| Android package | `space.manus.recofree.app.t20260405113127` |
| iOS bundle identifier | `space.manus.recofree.app.t20260405113127` |
| URL scheme | `recofree` |
| Expo slug | `recofree-app` |
| Android ABI's | `armeabi-v7a`, `arm64-v8a` |
| Android minSdk | `24` |
| React Native new architecture | actief |

De bestaande package-ID blijft bewust behouden. Android accepteert een update op een geïnstalleerde APK alleen wanneer package-ID en ondertekeningscertificaat bij de bestaande installatie passen. Android vereist bovendien dat APK's digitaal zijn ondertekend; de app-signingkey blijft normaal gedurende de levensduur van de app gelijk.[1]

## 2. Wat in de repository staat

De bron bevat `app.config.ts` en `eas.json`, maar geen ingecheckte keystore, wachtwoorden, `credentials.json`, native `android/`-project of `extra.eas.projectId`. Dit is correct voor geheimhouding, maar betekent dat de repository alleen nog geen updatecompatibele release kan ondertekenen. Zonder de bestaande private credential mag geen nieuwe keystore als vervanging worden gegenereerd.

Expo documenteert dat EAS standaard remote credentials gebruikt wanneer `credentialsSource` niet expliciet is ingesteld. Bestaande credentials kunnen via `eas credentials` worden gedownload; keystore en credentials mogen nooit in Git worden opgenomen.[2] Voor volledig eigen beheer kan `credentialsSource: "local"` worden gebruikt met een lokaal `credentials.json` dat naar de bestaande keystore verwijst.[3]

## 3. Verplichte overdrachtsset

| Artefact | Verplicht | Opslagregel |
|---|---:|---|
| Bestaande Android `.jks`/`.keystore` | Ja | Alleen encrypted secret vault/offline backup; nooit Git |
| Keystore password | Ja | Secret vault |
| Key alias | Ja | Secret vault |
| Key password | Ja | Secret vault |
| SHA-256 certificaatfingerprint van laatste werkende APK | Ja | Mag als niet-geheime attestatie in releaseverslag |
| Expo-account/project-ID onder eigen beheer | Voor EAS | Configwaarde; geen signingsecret |
| Apple distribution/provisioningmateriaal | Voor iOS | Secret vault; niet Git |

Wanneer Google Play App Signing wordt gebruikt, moet worden onderscheiden tussen de door Google beheerde app-signingkey en de uploadkey. De uploadkey kan worden gereset; de app-signingkey bepaalt wat eindgebruikers als update ontvangen.[1] [2]

## 4. Veilige export van bestaande Androidcredentials

Voer dit uit in het account/project dat de laatste updatecompatibele RecoFree-build ondertekende:

```bash
eas credentials -p android
```

Kies het gebruikte buildprofiel en daarna **Download credentials from EAS to credentials.json**. Verplaats de gedownloade keystore en `credentials.json` onmiddellijk naar een beveiligde lokale map. Expo waarschuwt expliciet dat deze bestanden niet in de repository mogen worden opgenomen.[2]

Als de credentials door een andere buildprovider werden beheerd, exporteer daar exact dezelfde vier Androidwaarden. Genereer niet automatisch een nieuwe key wanneer een prompt meldt dat credentials ontbreken.

## 5. Certificaatfingerprint bewijzen

Bereken de SHA-256-fingerprint van de overgedragen keystore:

```bash
keytool -list -v \
  -keystore /secure/path/recofree-release.jks \
  -alias "$RECOFREE_ANDROID_KEY_ALIAS"
```

Bereken de signer van een bestaande, updatecompatibele APK:

```bash
apksigner verify --print-certs /secure/path/recofree-known-good.apk
```

Bereken dezelfde signer voor de nieuwe APK. **PASS** vereist dezelfde SHA-256 certificate digest als de bekende werkende APK. Alleen dan mag de build als update worden aangeboden. Een verschil betekent `SIGNING_IDENTITY_MISMATCH`; installeer of verspreid die build niet als update.

## 6. Eigen EAS-projectbinding

Maak of koppel het project onder een Expo-account dat de eigenaar controleert. De nieuwe EAS-project-ID mag veranderen; package-ID en signingcertificaat niet. Leg de project-ID daarna vast in `extra.eas.projectId` via de normale Expo-projectkoppeling. Upload de **bestaande** Androidcredential, niet een nieuw gegenereerde.

Remote credentials:

```bash
eas credentials -p android
eas build -p android --profile preview
eas build -p android --profile production
```

Local credentials zijn ook ondersteund. Maak lokaal een niet-ingecheckt `credentials.json` met `keystorePath`, `keystorePassword`, `keyAlias` en `keyPassword`, en zet voor het gewenste profiel `credentialsSource: "local"`.[3]

## 7. Artefacten en acceptatie

| Profiel | Doel | Vereist artefact |
|---|---|---|
| `preview` | Interne fysieke acceptatie | APK |
| `production` | Store-release | AAB/storeartefact |

Voor iedere kandidaatbuild zijn minimaal vereist: TypeScript groen, volledige tests groen, releasegate groen, Androidbundle zonder Manus/legacyhosts, Railwayrouteoppervlak beperkt tot health/client-session/minimal-proxy, en signerfingerprint identiek aan de bekende goede APK.

## 8. Huidige blocker

De code en buildconfig zijn overdraagbaar gemaakt, maar de private bestaande signingcredential is niet in de repository aanwezig en hoort daar ook niet te staan. De laatste stap kan daarom alleen worden afgerond nadat de eigenaar de credential uit de huidige signingprovider exporteert en de fingerprintvergelijking uitvoert. Tot dat bewijs is de status **SOURCE_REPRODUCIBLE / SIGNING_HANDOVER_PENDING**.

## Referenties

[1]: https://developer.android.com/studio/publish/app-signing "Android Developers — Sign your app"
[2]: https://docs.expo.dev/app-signing/app-credentials/ "Expo — App credentials"
[3]: https://docs.expo.dev/app-signing/local-credentials/ "Expo — Using local credentials"
