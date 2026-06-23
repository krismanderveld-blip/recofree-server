"""Add remaining mood screen i18n keys for trend and time labels"""
import json, os

LOCALES_DIR = '/home/ubuntu/recofree-app/lib/i18n/locales'

NEW_KEYS = {
    "mood.trend.not_enough_data": {
        "nl": "Nog niet genoeg gegevens",
        "en": "Not enough data yet",
        "fr": "Pas encore assez de données"
    },
    "mood.trend.needs_attention": {
        "nl": "Vraagt aandacht",
        "en": "Needs attention",
        "fr": "Demande de l'attention"
    },
    "mood.time.just_now": {
        "nl": "Zojuist",
        "en": "Just now",
        "fr": "À l'instant"
    },
    "mood.time.hours_ago": {
        "nl": "{hours}u geleden",
        "en": "{hours}h ago",
        "fr": "Il y a {hours}h"
    },
    "mood.time.yesterday": {
        "nl": "Gisteren",
        "en": "Yesterday",
        "fr": "Hier"
    },
    "mood.time.days_ago": {
        "nl": "{days} dagen geleden",
        "en": "{days} days ago",
        "fr": "Il y a {days} jours"
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
print('Done!')
