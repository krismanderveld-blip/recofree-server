import json

keys = {
    "profile.guidance_depth.option.light.label": {
        "nl": "Licht",
        "en": "Light",
        "fr": "Léger"
    },
    "profile.guidance_depth.option.light.description": {
        "nl": "Meer luisteren, zachte aanwezigheid",
        "en": "More listening, gentle presence",
        "fr": "Plus d'écoute, présence douce"
    },
    "profile.guidance_depth.option.normal.label": {
        "nl": "Normaal",
        "en": "Normal",
        "fr": "Normal"
    },
    "profile.guidance_depth.option.normal.description": {
        "nl": "Gebalanceerde reflectie en begeleiding",
        "en": "Balanced reflection and guidance",
        "fr": "Réflexion et accompagnement équilibrés"
    },
    "profile.guidance_depth.option.deep.label": {
        "nl": "Diep",
        "en": "Deep",
        "fr": "Profond"
    },
    "profile.guidance_depth.option.deep.description": {
        "nl": "Actief doorvragen en diepere verkenning",
        "en": "Active probing and deeper exploration",
        "fr": "Exploration active et approfondissement"
    },
    "profile.data_privacy.title": {
        "nl": "Gegevens & Privacy",
        "en": "Data & Privacy",
        "fr": "Données & Confidentialité"
    },
    "profile.data_privacy.subtitle": {
        "nl": "Beheer je lokale RecoFree-gegevens. Alle bewerkingen gebeuren alleen op dit apparaat.",
        "en": "Manage your local RecoFree data. All operations happen on this device only.",
        "fr": "Gère tes données RecoFree locales. Toutes les opérations se font uniquement sur cet appareil."
    },
    "profile.data_privacy.export.title": {
        "nl": "Exporteer je RecoFree-gegevens",
        "en": "Export your RecoFree data",
        "fr": "Exporter tes données RecoFree"
    },
    "profile.data_privacy.export.description": {
        "nl": "Maak één versleuteld bestand met je lokale RecoFree-gegevens. Het bestand kan alleen worden geopend met het wachtwoord dat je kiest.",
        "en": "Create one encrypted file with your local RecoFree data. The file can only be opened with the password you choose.",
        "fr": "Crée un fichier chiffré avec tes données RecoFree locales. Le fichier ne peut être ouvert qu'avec le mot de passe que tu choisis."
    },
    "profile.data_privacy.export.password_label": {
        "nl": "WACHTWOORD",
        "en": "PASSWORD",
        "fr": "MOT DE PASSE"
    },
    "profile.data_privacy.export.password_placeholder": {
        "nl": "Minimaal 8 tekens",
        "en": "Minimum 8 characters",
        "fr": "Minimum 8 caractères"
    },
    "profile.data_privacy.export.confirm_label": {
        "nl": "BEVESTIG WACHTWOORD",
        "en": "CONFIRM PASSWORD",
        "fr": "CONFIRMER LE MOT DE PASSE"
    },
    "profile.data_privacy.export.confirm_placeholder": {
        "nl": "Herhaal wachtwoord",
        "en": "Repeat password",
        "fr": "Répéter le mot de passe"
    },
    "profile.data_privacy.export.warning": {
        "nl": "RecoFree kan dit wachtwoord niet herstellen. Bewaar dit bestand op een veilige plek.",
        "en": "RecoFree cannot recover this password. Keep this file somewhere safe.",
        "fr": "RecoFree ne peut pas récupérer ce mot de passe. Conserve ce fichier en lieu sûr."
    },
    "profile.data_privacy.export.button": {
        "nl": "Exporteer versleutelde backup",
        "en": "Export encrypted backup",
        "fr": "Exporter la sauvegarde chiffrée"
    },
    "profile.data_privacy.export.footer": {
        "nl": "Je export wordt versleuteld op dit apparaat. RecoFree kan het wachtwoord niet herstellen. Geen server betrokken.",
        "en": "Your export is encrypted on this device. RecoFree cannot recover the password. No server is involved.",
        "fr": "Ton export est chiffré sur cet appareil. RecoFree ne peut pas récupérer le mot de passe. Aucun serveur impliqué."
    },
    "profile.data_privacy.import.title": {
        "nl": "Importeer RecoFree-backup",
        "en": "Import RecoFree backup",
        "fr": "Importer une sauvegarde RecoFree"
    },
    "profile.data_privacy.import.description": {
        "nl": "Importeren vervangt de RecoFree-gegevens op dit apparaat. Je bestaande lokale gegevens worden overschreven nadat het bestand is geverifieerd.",
        "en": "Importing replaces the RecoFree data on this device. Your existing local data will be overwritten after the file is verified.",
        "fr": "L'importation remplace les données RecoFree sur cet appareil. Tes données locales existantes seront écrasées après vérification du fichier."
    }
}

for lang in ['nl', 'en', 'fr']:
    path = f'/home/ubuntu/recofree-app/lib/i18n/locales/{lang}.json'
    with open(path, 'r') as f:
        data = json.load(f)
    
    for key, translations in keys.items():
        if key not in data:
            data[key] = translations[lang]
    
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

print("Done - added guidance depth option keys and data privacy keys to all locales")
