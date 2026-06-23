"""Add remaining i18n keys for chat modal, backpack stage descriptions, and prechat_vsp option labels"""
import json, os

LOCALES_DIR = '/home/ubuntu/recofree-app/lib/i18n/locales'

NEW_KEYS = {
    # ─── Chat Disclaimer Modal ─────────────────────────────────
    "chat.modal.title": {
        "nl": "Voordat we beginnen",
        "en": "Before we begin",
        "fr": "Avant de commencer"
    },
    "chat.modal.body": {
        "nl": "{companionName} is een AI-metgezel, geen therapeut of arts.\n\n• RecoFree vervangt geen professionele geestelijke gezondheidszorg.\n• RecoFree stelt nooit diagnoses of geeft medisch advies.\n• RecoFree is geen vervanging voor een psycholoog of psychiater.\n• Soms is professionele hulp de betere keuze — en dat is oké.\n• In geval van crisis, neem altijd contact op met een professional of bel 1813.\n• Je gesprekken zijn privé en blijven op je toestel.",
        "en": "{companionName} is an AI companion, not a therapist or doctor.\n\n• RecoFree does not replace professional mental health care.\n• RecoFree never provides diagnoses or medical advice.\n• RecoFree is not a replacement for a psychologist or psychiatrist.\n• Sometimes professional help is the better choice — and that is okay.\n• In case of crisis, always contact a professional or call 1813.\n• Your conversations are private and stay on your device.",
        "fr": "{companionName} est un compagnon IA, pas un thérapeute ni un médecin.\n\n• RecoFree ne remplace pas les soins professionnels de santé mentale.\n• RecoFree ne fournit jamais de diagnostic ni de conseil médical.\n• RecoFree ne remplace pas un psychologue ou un psychiatre.\n• Parfois, l'aide professionnelle est le meilleur choix — et c'est normal.\n• En cas de crise, contactez toujours un professionnel ou appelez le 0800 32 123.\n• Vos conversations sont privées et restent sur votre appareil."
    },
    "chat.modal.button": {
        "nl": "Ik begrijp het",
        "en": "I understand",
        "fr": "Je comprends"
    },

    # ─── Backpack Stage Descriptions (for backpack.tsx and wizard) ────
    "backpack.stage_of_change.description": {
        "nl": "Waar sta je in je veranderingsproces? Dit helpt je metgezel om de aanpak aan te passen.",
        "en": "Where are you in your journey? This helps your companion adjust their approach.",
        "fr": "Où en es-tu dans ton parcours ? Cela aide ton compagnon à adapter son approche."
    },
    "backpack.stage.precontemplation.label": {
        "nl": "Nog niet klaar",
        "en": "Not ready yet",
        "fr": "Pas encore prêt"
    },
    "backpack.stage.precontemplation.description": {
        "nl": "Ik denk er nog niet echt over na om te veranderen.",
        "en": "I'm not really thinking about changing yet.",
        "fr": "Je ne pense pas encore vraiment à changer."
    },
    "backpack.stage.contemplation.label": {
        "nl": "Erover nadenken",
        "en": "Thinking about it",
        "fr": "J'y réfléchis"
    },
    "backpack.stage.contemplation.description": {
        "nl": "Ik denk erover na, maar heb nog geen beslissing genomen.",
        "en": "I'm considering it, but haven't decided yet.",
        "fr": "J'y réfléchis, mais je n'ai pas encore décidé."
    },
    "backpack.stage.preparation.label": {
        "nl": "Voorbereiden",
        "en": "Getting ready",
        "fr": "En préparation"
    },
    "backpack.stage.preparation.description": {
        "nl": "Ik bereid me voor om binnenkort te veranderen.",
        "en": "I'm preparing to make a change soon.",
        "fr": "Je me prépare à faire un changement bientôt."
    },
    "backpack.stage.action.label": {
        "nl": "In actie",
        "en": "Taking action",
        "fr": "En action"
    },
    "backpack.stage.action.description": {
        "nl": "Ik ben actief bezig met veranderen.",
        "en": "I'm actively working on changing.",
        "fr": "Je travaille activement à changer."
    },
    "backpack.stage.maintenance.label": {
        "nl": "Volhouden",
        "en": "Maintaining",
        "fr": "Maintien"
    },
    "backpack.stage.maintenance.description": {
        "nl": "Ik heb veranderingen aangebracht en werk eraan om ze vol te houden.",
        "en": "I've made changes and am working to maintain them.",
        "fr": "J'ai fait des changements et je travaille à les maintenir."
    },

    # ─── Prechat VSP Option Labels ────────────────────────────
    "prechat_vsp.option.groen.label": {
        "nl": "Groen — Ik voel me goed",
        "en": "Green — I feel good",
        "fr": "Vert — Je me sens bien"
    },
    "prechat_vsp.option.geel.label": {
        "nl": "Geel — Lichte spanning",
        "en": "Yellow — Slight tension",
        "fr": "Jaune — Légère tension"
    },
    "prechat_vsp.option.oranje.label": {
        "nl": "Oranje — Duidelijke spanning",
        "en": "Orange — Clear tension",
        "fr": "Orange — Tension nette"
    },
    "prechat_vsp.option.rood.label": {
        "nl": "Rood — Hoge spanning",
        "en": "Red — High tension",
        "fr": "Rouge — Forte tension"
    },
    "prechat_vsp.option.paars.label": {
        "nl": "Paars — Terugval / Crisis",
        "en": "Purple — Relapse / Crisis",
        "fr": "Violet — Rechute / Crise"
    },

    # ─── Prechat VSP UI ───────────────────────────────────────
    "prechat_vsp.title": {
        "nl": "Hoe voel je je nu, {userName}?",
        "en": "How are you feeling right now, {userName}?",
        "fr": "Comment te sens-tu en ce moment, {userName} ?"
    },
    "prechat_vsp.subtitle": {
        "nl": "Kies het niveau dat het best past bij hoe je je nu voelt.",
        "en": "Choose the level that best matches how you feel right now.",
        "fr": "Choisis le niveau qui correspond le mieux à ce que tu ressens maintenant."
    },
    "prechat_vsp.button.confirm": {
        "nl": "Bevestigen",
        "en": "Confirm",
        "fr": "Confirmer"
    },

    # ─── GDPR Consent hardcoded strings ───────────────────────
    "gdpr_consent.header.subtitle": {
        "nl": "Jouw privacy is onze prioriteit",
        "en": "Your privacy is our priority",
        "fr": "Ta vie privée est notre priorité"
    },
    "gdpr_consent.card.body1": {
        "nl": "RecoFree gebruikt AI-technologie (OpenAI) om gesprekken te verwerken.",
        "en": "RecoFree uses AI technology (OpenAI) to process conversations.",
        "fr": "RecoFree utilise la technologie IA (OpenAI) pour traiter les conversations."
    },
    "gdpr_consent.card.body2": {
        "nl": "Je persoonlijke gegevens blijven op je toestel. RecoFree slaat geen persoonlijke gegevens op externe servers op.",
        "en": "Your personal data stays on your device. RecoFree does not store personal data on external servers.",
        "fr": "Tes données personnelles restent sur ton appareil. RecoFree ne stocke pas de données personnelles sur des serveurs externes."
    },
    "gdpr_consent.contact_text": {
        "nl": "Vragen? privacy@recofree.app",
        "en": "Questions? privacy@recofree.app",
        "fr": "Questions ? privacy@recofree.app"
    },
}

def add_keys_to_locale(locale_code):
    filepath = os.path.join(LOCALES_DIR, f'{locale_code}.json')
    with open(filepath, 'r') as f:
        data = json.load(f)
    added = 0
    for key, translations in NEW_KEYS.items():
        if key not in data:
            data[key] = translations[locale_code]
            added += 1
        else:
            # Update existing keys if they still have EN text in FR/NL
            if locale_code != 'en' and data[key] == translations['en']:
                data[key] = translations[locale_code]
                added += 1
    with open(filepath, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'{locale_code}.json: added/updated {added} keys (total: {len(data)})')

add_keys_to_locale('nl')
add_keys_to_locale('en')
add_keys_to_locale('fr')
print('Done!')
