#!/usr/bin/env python3
"""Find keys from combined JSON that are NOT yet replaced with t() in source files."""
import json
import os
from collections import Counter

PROJECT = '/home/ubuntu/recofree-app'

# Load combined JSON
with open('/home/ubuntu/upload/recofree-ui-strings-i18n-combined.json') as f:
    data = json.load(f)

strings = data['strings']

# Load current locale file to see what keys exist
with open(os.path.join(PROJECT, 'lib/i18n/locales/en.json')) as f:
    locale_keys = set(json.load(f).keys())

# Check which keys from combined are already in locale files
in_locale = 0
not_in_locale = 0
missing_keys = {}

for key, entry in strings.items():
    if key in locale_keys:
        in_locale += 1
    else:
        not_in_locale += 1
        missing_keys[key] = entry

print(f"Total keys in combined JSON: {len(strings)}")
print(f"Already in locale files: {in_locale}")
print(f"NOT in locale files: {not_in_locale}")

# Now check which are actually still hardcoded in source
print("\n--- Keys NOT in locale files, by source file ---")
by_file = Counter()
for key, entry in missing_keys.items():
    by_file[entry['source']] += 1

for src, count in by_file.most_common(25):
    print(f"  {src}: {count} missing keys")

# Also check: keys that ARE in locale but NOT used as t('key') in source
print("\n--- Sample missing keys (first 20) ---")
for i, (key, entry) in enumerate(missing_keys.items()):
    if i >= 20:
        break
    print(f"  {key}: \"{entry['value'][:60]}\" ({entry['source']}:{entry['line']})")
