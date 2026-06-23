"""
Add missing i18n keys for:
- Stage of Change options (intake)
- Eigen Regie intake options (intake)
- VSP zone labels (prechat-vsp)
- GDPR consent hardcoded strings
- Disclaimer modal (chat)
"""
import json
import os

LOCALES_DIR = '/home/ubuntu/recofree-app/lib/i18n/locales'

# New keys to add
NEW_KEYS = {
    # ─── Stage of Change Options ───────────────────────────────
    "intake.stage.precontemplation.label": {
        "nl": "Nog niet klaar",
        "en": "Not ready yet",
        "fr": "Pas encore prêt"
    },
    "intake.stage.precontemplation.description": {
        "nl": "Ik weet niet zeker of ik nu iets moet veranderen.",
        "en": "I'm not sure I need to change anything right now.",
        "fr": "Je ne suis pas sûr d'avoir besoin de changer quoi que ce soit maintenant."
    },
    "intake.stage.contemplation.label": {
        "nl": "Erover nadenken",
        "en": "Thinking about it",
        "fr": "J'y réfléchis"
    },
    "intake.stage.contemplation.description": {
        "nl": "Ik begin na te denken over verandering.",
        "en": "I'm starting to think about making a change.",
        "fr": "Je commence à penser à faire un changement."
    },
    "intake.stage.preparation.label": {
        "nl": "Ik bereid me voor",
        "en": "Getting ready",
        "fr": "Je me prépare"
    },
    "intake.stage.preparation.description": {
        "nl": "Ik ben van plan om binnenkort actie te ondernemen.",
        "en": "I'm planning to take action soon.",
        "fr": "Je prévois de passer à l'action bientôt."
    },
    "intake.stage.action.label": {
        "nl": "Ik doe het",
        "en": "Taking action",
        "fr": "Je passe à l'action"
    },
    "intake.stage.action.description": {
        "nl": "Ik werk nu actief aan verandering.",
        "en": "I'm actively working on change right now.",
        "fr": "Je travaille activement à changer en ce moment."
    },
    "intake.stage.maintenance.label": {
        "nl": "Ik houd het vol",
        "en": "Maintaining",
        "fr": "Je maintiens"
    },
    "intake.stage.maintenance.description": {
        "nl": "Ik heb veranderingen aangebracht en werk eraan om ze te behouden.",
        "en": "I've made changes and I'm working to keep them.",
        "fr": "J'ai fait des changements et je travaille à les maintenir."
    },

    # ─── Eigen Regie Intake Options ────────────────────────────
    "intake.eigen_regie.1.label": {
        "nl": "Mijn leven draait volledig om de ander",
        "en": "My life revolves entirely around the other person",
        "fr": "Ma vie tourne entièrement autour de l'autre personne"
    },
    "intake.eigen_regie.2.label": {
        "nl": "Ik ben vooral bezig met de ander",
        "en": "I am mostly focused on the other person",
        "fr": "Je suis principalement concentré sur l'autre personne"
    },
    "intake.eigen_regie.3.label": {
        "nl": "Er is een mix tussen mezelf en de ander",
        "en": "There is a mix between myself and the other person",
        "fr": "Il y a un mélange entre moi et l'autre personne"
    },
    "intake.eigen_regie.4.label": {
        "nl": "Ik behoud grotendeels mijn eigen koers",
        "en": "I mostly maintain my own direction",
        "fr": "Je maintiens principalement ma propre direction"
    },
    "intake.eigen_regie.5.label": {
        "nl": "Ik leef volledig mijn eigen leven",
        "en": "I fully live my own life",
        "fr": "Je vis pleinement ma propre vie"
    },

    # ─── VSP Zone Labels (prechat-vsp option titles) ───────────
    "prechat_vsp.option.groen.label": {
        "nl": "Geen spanning",
        "en": "No tension",
        "fr": "Pas de tension"
    },
    "prechat_vsp.option.geel.label": {
        "nl": "Lichte spanning",
        "en": "Mild tension",
        "fr": "Légère tension"
    },
    "prechat_vsp.option.oranje.label": {
        "nl": "Hogere spanning / tijd om in te grijpen",
        "en": "Higher tension / time to intervene",
        "fr": "Tension plus forte / temps d'intervenir"
    },
    "prechat_vsp.option.rood.label": {
        "nl": "Terugval nabij / actie nodig",
        "en": "Relapse near / action needed",
        "fr": "Rechute proche / action nécessaire"
    },
    "prechat_vsp.option.paars.label": {
        "nl": "Terugval",
        "en": "Relapse",
        "fr": "Rechute"
    },

    # ─── GDPR Consent hardcoded strings ────────────────────────
    "gdpr_consent.card.body_intro": {
        "nl": "RecoFree gebruikt AI-technologie (OpenAI) om gesprekken te verwerken.",
        "en": "RecoFree uses AI technology (OpenAI) to process conversations.",
        "fr": "RecoFree utilise la technologie IA (OpenAI) pour traiter les conversations."
    },
    "gdpr_consent.card.body_footer": {
        "nl": "Je persoonlijke gegevens blijven op je toestel. RecoFree slaat geen persoonlijke gegevens op externe servers op.",
        "en": "Your personal data stays on your device. RecoFree does not store personal data on external servers.",
        "fr": "Tes données personnelles restent sur ton appareil. RecoFree ne stocke pas de données personnelles sur des serveurs externes."
    },
    "gdpr_consent.contact_text": {
        "nl": "Vragen? privacy@recofree.app",
        "en": "Questions? privacy@recofree.app",
        "fr": "Questions ? privacy@recofree.app"
    },

    # ─── Chat Disclaimer Modal ─────────────────────────────────
    # chat.modal.title, chat.modal.body, chat.modal.button already exist in all 3 locales
    # But the component uses HARDCODED strings instead of t() — we just need to fix the component

    # ─── Backpack Stage of Change option labels (used in backpack.tsx) ───
    "backpack.stage.precontemplation.label": {
        "nl": "Nog niet klaar",
        "en": "Not ready yet",
        "fr": "Pas encore prêt"
    },
    "backpack.stage.precontemplation.description": {
        "nl": "Ik weet niet zeker of ik nu iets moet veranderen.",
        "en": "I'm not sure I need to change anything right now.",
        "fr": "Je ne suis pas sûr d'avoir besoin de changer quoi que ce soit maintenant."
    },
    "backpack.stage.contemplation.label": {
        "nl": "Erover nadenken",
        "en": "Thinking about it",
        "fr": "J'y réfléchis"
    },
    "backpack.stage.contemplation.description": {
        "nl": "Ik begin na te denken over verandering.",
        "en": "I'm starting to think about making a change.",
        "fr": "Je commence à penser à faire un changement."
    },
    "backpack.stage.preparation.label": {
        "nl": "Ik bereid me voor",
        "en": "Getting ready",
        "fr": "Je me prépare"
    },
    "backpack.stage.preparation.description": {
        "nl": "Ik ben van plan om binnenkort actie te ondernemen.",
        "en": "I'm planning to take action soon.",
        "fr": "Je prévois de passer à l'action bientôt."
    },
    "backpack.stage.action.label": {
        "nl": "Ik doe het",
        "en": "Taking action",
        "fr": "Je passe à l'action"
    },
    "backpack.stage.action.description": {
        "nl": "Ik werk nu actief aan verandering.",
        "en": "I'm actively working on change right now.",
        "fr": "Je travaille activement à changer en ce moment."
    },
    "backpack.stage.maintenance.label": {
        "nl": "Ik houd het vol",
        "en": "Maintaining",
        "fr": "Je maintiens"
    },
    "backpack.stage.maintenance.description": {
        "nl": "Ik heb veranderingen aangebracht en werk eraan om ze te behouden.",
        "en": "I've made changes and I'm working to keep them.",
        "fr": "J'ai fait des changements et je travaille à les maintenir."
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
    
    with open(filepath, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    
    print(f'{locale_code}.json: added {added} new keys (total: {len(data)})')

add_keys_to_locale('nl')
add_keys_to_locale('en')
add_keys_to_locale('fr')
print('\nDone!')
