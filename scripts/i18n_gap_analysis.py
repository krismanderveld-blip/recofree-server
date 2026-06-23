#!/usr/bin/env python3
"""Analyze the gap between locale keys and actual t() usage in source files."""
import json, os, re
from collections import Counter

PROJECT = '/home/ubuntu/recofree-app'

# Load locale keys
with open(os.path.join(PROJECT, 'lib/i18n/locales/en.json')) as f:
    en_locale = json.load(f)
locale_keys = set(en_locale.keys())

# Scan source files for t() / tStatic() usage
used_keys = set()
for root, dirs, files in os.walk(PROJECT):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '__tests__', 'dist', '.manus-logs')]
    for fname in files:
        if fname.endswith(('.tsx', '.ts')) and not fname.endswith('.d.ts'):
            filepath = os.path.join(root, fname)
            try:
                content = open(filepath).read()
                matches = re.findall(r"(?:t|tStatic)\('([^']+)'", content)
                used_keys.update(matches)
            except:
                pass

# Keys used in code but NOT in locale files = need to be added
missing_from_locale = sorted(used_keys - locale_keys)

# Keys in locale but NOT used in code = either dead keys or strings not yet replaced
unused_in_code = sorted(locale_keys - used_keys)

print(f"=== i18n Gap Analysis ===")
print(f"Locale keys: {len(locale_keys)}")
print(f"Keys used in source: {len(used_keys)}")
print(f"Keys MISSING from locale (used but not defined): {len(missing_from_locale)}")
print(f"Keys UNUSED in code (defined but not called): {len(unused_in_code)}")

print(f"\n--- MISSING FROM LOCALE (need to add translations) ---")
# Group by prefix
by_prefix = Counter()
for k in missing_from_locale:
    prefix = k.split('.')[0]
    by_prefix[prefix] += 1
for prefix, count in by_prefix.most_common(20):
    print(f"  {prefix}.*: {count} keys")

print(f"\n--- First 30 missing keys ---")
for k in missing_from_locale[:30]:
    print(f"  {k}")

# Now find hardcoded strings still in source (not yet replaced)
print(f"\n--- HARDCODED STRINGS STILL IN SOURCE (sample) ---")
hardcoded_files = {}
for root, dirs, files in os.walk(PROJECT):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '__tests__', 'dist', '.manus-logs', 'lib/i18n')]
    for fname in files:
        if fname.endswith('.tsx') and not fname.startswith('_'):
            filepath = os.path.join(root, fname)
            rel = os.path.relpath(filepath, PROJECT)
            # Only check app/ and components/
            if not (rel.startswith('app/') or rel.startswith('components/')):
                continue
            try:
                lines = open(filepath).readlines()
                count = 0
                for line in lines:
                    # Skip imports, comments, console
                    stripped = line.strip()
                    if stripped.startswith('import ') or stripped.startswith('//') or 'console.' in stripped:
                        continue
                    # Find >text</Text> that's NOT {t( or {tStatic(
                    text_nodes = re.findall(r'>([^<>{}\n]+)</Text>', line)
                    for t in text_nodes:
                        t = t.strip()
                        if len(t) > 1 and re.search(r'[a-zA-Z]', t) and not t.startswith('{'):
                            count += 1
                if count > 0:
                    hardcoded_files[rel] = count
            except:
                pass

print(f"\nFiles with remaining hardcoded text nodes:")
for f, c in sorted(hardcoded_files.items(), key=lambda x: -x[1])[:15]:
    print(f"  {f}: ~{c} hardcoded strings")
print(f"\nTotal remaining hardcoded text nodes: {sum(hardcoded_files.values())}")
