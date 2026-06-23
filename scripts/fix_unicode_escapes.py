#!/usr/bin/env python3
"""Fix unicode escape sequences in locale JSON files.
Replaces literal \\uXXXX and \\u{XXXXX} strings with actual Unicode characters."""

import json
import re

LOCALES = ['nl', 'en', 'fr']

def fix_unicode_in_string(s):
    """Replace \\u{XXXX} and \\uXXXX patterns with actual unicode chars."""
    changed = False
    
    # Fix \\u{XXXXX} pattern (e.g. \\u{1F6E1})
    def replace_long(m):
        nonlocal changed
        changed = True
        codepoint = int(m.group(1), 16)
        return chr(codepoint)
    
    s = re.sub(r'\\u\{([0-9A-Fa-f]+)\}', replace_long, s)
    
    # Fix \\uXXXX pattern (e.g. \\u25BC, \\u26A1)
    def replace_short(m):
        nonlocal changed
        changed = True
        codepoint = int(m.group(1), 16)
        return chr(codepoint)
    
    s = re.sub(r'\\u([0-9A-Fa-f]{4})', replace_short, s)
    
    return s, changed

for locale in LOCALES:
    path = f'lib/i18n/locales/{locale}.json'
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    
    data = json.loads(raw)
    
    total_changed = 0
    for key, val in data.items():
        if isinstance(val, str):
            new_val, was_changed = fix_unicode_in_string(val)
            if was_changed:
                data[key] = new_val
                total_changed += 1
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    
    print(f'{locale}.json: {total_changed} unicode escapes fixed')
