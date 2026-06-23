"""
Add i18n keys for mood screen: SLIDER_META and ZONE_CONFIG
"""
import json
import os

LOCALES_DIR = '/home/ubuntu/recofree-app/lib/i18n/locales'

NEW_KEYS = {
    # ─── Slider Meta ───────────────────────────────────────────
    "mood.slider.craving.description": {
        "nl": "Hoe sterk is de drang nu?",
        "en": "How strong is the urge right now?",
        "fr": "Quelle est l'intensité de l'envie en ce moment ?"
    },
    "mood.slider.craving.low": {
        "nl": "Geen",
        "en": "None",
        "fr": "Aucune"
    },
    "mood.slider.craving.high": {
        "nl": "Overweldigend",
        "en": "Overwhelming",
        "fr": "Écrasante"
    },
    "mood.slider.frustration.description": {
        "nl": "Hoe gefrustreerd voel je je?",
        "en": "How frustrated do you feel?",
        "fr": "À quel point te sens-tu frustré ?"
    },
    "mood.slider.frustration.low": {
        "nl": "Kalm",
        "en": "Calm",
        "fr": "Calme"
    },
    "mood.slider.frustration.high": {
        "nl": "Erg gefrustreerd",
        "en": "Very frustrated",
        "fr": "Très frustré"
    },
    "mood.slider.despondency.description": {
        "nl": "Hoe hopeloos of ontmoedigd voel je je?",
        "en": "How hopeless or discouraged do you feel?",
        "fr": "À quel point te sens-tu découragé ?"
    },
    "mood.slider.despondency.low": {
        "nl": "Hoopvol",
        "en": "Hopeful",
        "fr": "Plein d'espoir"
    },
    "mood.slider.despondency.high": {
        "nl": "Erg ontmoedigd",
        "en": "Very discouraged",
        "fr": "Très découragé"
    },
    "mood.slider.focus.description": {
        "nl": "Hoe goed kun je je nu concentreren?",
        "en": "How well can you concentrate right now?",
        "fr": "À quel point arrives-tu à te concentrer ?"
    },
    "mood.slider.focus.low": {
        "nl": "Verstrooid",
        "en": "Scattered",
        "fr": "Dispersé"
    },
    "mood.slider.focus.high": {
        "nl": "Erg gefocust",
        "en": "Very focused",
        "fr": "Très concentré"
    },
    "mood.slider.stress.description": {
        "nl": "Hoe gestrest voel je je nu?",
        "en": "How stressed do you feel right now?",
        "fr": "À quel point te sens-tu stressé ?"
    },
    "mood.slider.stress.low": {
        "nl": "Ontspannen",
        "en": "Relaxed",
        "fr": "Détendu"
    },
    "mood.slider.stress.high": {
        "nl": "Erg gestrest",
        "en": "Very stressed",
        "fr": "Très stressé"
    },
    "mood.slider.boundaryFatigue.description": {
        "nl": "Hoe uitgeput ben je van het stellen van grenzen?",
        "en": "How exhausted are you from setting boundaries?",
        "fr": "À quel point es-tu épuisé de poser des limites ?"
    },
    "mood.slider.boundaryFatigue.low": {
        "nl": "Energiek",
        "en": "Energized",
        "fr": "Énergique"
    },
    "mood.slider.boundaryFatigue.high": {
        "nl": "Uitgeput",
        "en": "Exhausted",
        "fr": "Épuisé"
    },
    "mood.slider.emotionalBurden.description": {
        "nl": "Hoe zwaar voelt de emotionele last?",
        "en": "How heavy does the emotional weight feel?",
        "fr": "À quel point le poids émotionnel est-il lourd ?"
    },
    "mood.slider.emotionalBurden.low": {
        "nl": "Licht",
        "en": "Light",
        "fr": "Léger"
    },
    "mood.slider.emotionalBurden.high": {
        "nl": "Overweldigend",
        "en": "Overwhelming",
        "fr": "Écrasant"
    },
    "mood.slider.selfCare.description": {
        "nl": "Hoe goed zorg je voor jezelf?",
        "en": "How well are you taking care of yourself?",
        "fr": "À quel point prends-tu soin de toi ?"
    },
    "mood.slider.selfCare.low": {
        "nl": "Verwaarlozing",
        "en": "Neglecting",
        "fr": "Négligence"
    },
    "mood.slider.selfCare.high": {
        "nl": "Erg goed",
        "en": "Very well",
        "fr": "Très bien"
    },

    # ─── Zone Config ───────────────────────────────────────────
    "mood.zone.green.label": {
        "nl": "Stabiel",
        "en": "Stable",
        "fr": "Stable"
    },
    "mood.zone.green.description": {
        "nl": "Je bent in een rustige, beheersbare ruimte geweest.",
        "en": "You've been in a calm, manageable space.",
        "fr": "Tu as été dans un espace calme et gérable."
    },
    "mood.zone.yellow.label": {
        "nl": "Verhoogd",
        "en": "Elevated",
        "fr": "Élevé"
    },
    "mood.zone.yellow.description": {
        "nl": "Er bouwt wat spanning op. Blijf alert.",
        "en": "Some tension is building. Stay aware.",
        "fr": "Une certaine tension s'accumule. Reste attentif."
    },
    "mood.zone.orange.label": {
        "nl": "Belast",
        "en": "Strained",
        "fr": "Sous tension"
    },
    "mood.zone.orange.description": {
        "nl": "Het is de laatste tijd moeilijker geweest. Dat is oké om te erkennen.",
        "en": "Things have been harder lately. That's okay to acknowledge.",
        "fr": "Les choses ont été plus difficiles dernièrement. C'est normal de le reconnaître."
    },
    "mood.zone.red.label": {
        "nl": "Kritiek",
        "en": "Critical",
        "fr": "Critique"
    },
    "mood.zone.red.description": {
        "nl": "Je hebt onder zware druk gestaan. Overweeg om hulp te zoeken.",
        "en": "You've been under heavy pressure. Consider reaching out.",
        "fr": "Tu as été sous forte pression. Envisage de demander de l'aide."
    },

    # ─── Trend labels ──────────────────────────────────────────
    "mood.trend.improving": {
        "nl": "Verbetering",
        "en": "Improving",
        "fr": "En amélioration"
    },
    "mood.trend.worsening": {
        "nl": "Verslechtering",
        "en": "Worsening",
        "fr": "En détérioration"
    },
    "mood.trend.stable": {
        "nl": "Stabiel",
        "en": "Stable",
        "fr": "Stable"
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
