import json

keys = {
    "profile.data_privacy.import.button.choose": {
        "nl": "Kies backupbestand",
        "en": "Choose backup file",
        "fr": "Choisir le fichier de sauvegarde"
    },
    "profile.data_privacy.import.password_label": {
        "nl": "WACHTWOORD",
        "en": "PASSWORD",
        "fr": "MOT DE PASSE"
    },
    "profile.data_privacy.import.password_placeholder": {
        "nl": "Voer backup-wachtwoord in",
        "en": "Enter backup password",
        "fr": "Entrer le mot de passe de la sauvegarde"
    },
    "profile.data_privacy.import.button.import": {
        "nl": "Importeer versleutelde backup",
        "en": "Import encrypted backup",
        "fr": "Importer la sauvegarde chiffrée"
    },
    "profile.data_privacy.import.success": {
        "nl": "Backup succesvol geïmporteerd.",
        "en": "Backup imported successfully.",
        "fr": "Sauvegarde importée avec succès."
    },
    "profile.data_privacy.import.confirm.title": {
        "nl": "Lokale gegevens vervangen?",
        "en": "Replace local data?",
        "fr": "Remplacer les données locales ?"
    },
    "profile.data_privacy.import.confirm.message": {
        "nl": "Het importeren van deze backup vervangt de RecoFree-gegevens die momenteel op dit apparaat zijn opgeslagen. Dit kan niet worden samengevoegd. Doorgaan?",
        "en": "Importing this backup will replace the RecoFree data currently stored on this device. This cannot be merged. Continue?",
        "fr": "L'importation de cette sauvegarde remplacera les données RecoFree actuellement stockées sur cet appareil. Cela ne peut pas être fusionné. Continuer ?"
    },
    "profile.data_privacy.import.confirm.cancel": {
        "nl": "Annuleren",
        "en": "Cancel",
        "fr": "Annuler"
    },
    "profile.data_privacy.import.confirm.replace": {
        "nl": "Lokale gegevens vervangen",
        "en": "Replace local data",
        "fr": "Remplacer les données locales"
    },
    "profile.data_privacy.import.name_prompt.title": {
        "nl": "Wat is je naam?",
        "en": "What's your name?",
        "fr": "Quel est ton prénom ?"
    },
    "profile.data_privacy.import.name_prompt.message": {
        "nl": "Je backup bevatte geen naam. Voer je voornaam in zodat de app je persoonlijk kan aanspreken.",
        "en": "Your backup didn't include a name. Please enter your first name so the app can address you personally.",
        "fr": "Ta sauvegarde ne contenait pas de nom. Entre ton prénom pour que l'app puisse s'adresser à toi personnellement."
    },
    "profile.data_privacy.import.name_prompt.placeholder": {
        "nl": "Je voornaam",
        "en": "Your first name",
        "fr": "Ton prénom"
    },
    "profile.data_privacy.import.name_prompt.save": {
        "nl": "Opslaan & doorgaan",
        "en": "Save & continue",
        "fr": "Enregistrer & continuer"
    },
    "profile.data_privacy.export.password_too_short": {
        "nl": "Wachtwoord moet minimaal 8 tekens zijn.",
        "en": "Password must be at least 8 characters.",
        "fr": "Le mot de passe doit contenir au moins 8 caractères."
    },
    "profile.data_privacy.export.passwords_no_match": {
        "nl": "Wachtwoorden komen niet overeen.",
        "en": "Passwords do not match.",
        "fr": "Les mots de passe ne correspondent pas."
    },
    "profile.data_privacy.export.success": {
        "nl": "Backup opgeslagen op de gekozen locatie.",
        "en": "Backup saved to your chosen location.",
        "fr": "Sauvegarde enregistrée à l'emplacement choisi."
    },
    "profile.data_privacy.export.last_exported": {
        "nl": "Laatst geëxporteerd: ",
        "en": "Last exported: ",
        "fr": "Dernière exportation : "
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

print("Done - added import/export i18n keys to all locales")
