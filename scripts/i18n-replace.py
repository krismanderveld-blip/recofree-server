"""
i18n String Replacement Script for RecoFree App
Replaces hardcoded UI strings with t("key") calls based on the combined JSON mapping.

Strategy:
- For each source file, find all strings mapped in the combined JSON
- Replace simple string literals with t("key") 
- For strings with JS expressions/placeholders, use {param} interpolation
- Add `import { useTranslation } from '@/lib/i18n';` if not present
- Add `const { t } = useTranslation();` in component body if not present

Exclusions:
- app/dev/theme-lab.tsx (dev/debug file)
- app/(tabs)/index.tsx (already done)
"""

import json
import re
import os
import sys

# Load combined JSON
with open('/home/ubuntu/upload/recofree-ui-strings-i18n-combined.json') as f:
    combined = json.load(f)

# Group by source file
by_source = {}
for key, entry in combined['strings'].items():
    src = entry['source']
    if src not in by_source:
        by_source[src] = []
    by_source[src].append((key, entry))

# Sort each file's entries by line number (descending) so replacements don't shift line numbers
for src in by_source:
    by_source[src].sort(key=lambda x: x[1]['line'], reverse=True)

# Files to skip
SKIP_FILES = [
    'app/(tabs)/index.tsx',  # already done
    'app/dev/theme-lab.tsx',  # dev/debug file
]

# Files to process
TARGET_FILES = [src for src in by_source.keys() if src not in SKIP_FILES]

def get_project_path(source):
    return os.path.join('/home/ubuntu/recofree-app', source)

def needs_import(content):
    return "from '@/lib/i18n'" not in content and 'from "@/lib/i18n"' not in content

def add_import(content):
    """Add i18n import after the last existing import."""
    lines = content.split('\n')
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('} from '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, "import { useTranslation } from '@/lib/i18n';")
    return '\n'.join(lines)

def needs_hook(content):
    """Check if const { t } = useTranslation() is already in the file."""
    return 'useTranslation()' not in content

def add_hook(content):
    """Add const { t } = useTranslation(); after the first line that has useUser() or useColors() or useRouter()."""
    lines = content.split('\n')
    # Find a good insertion point - after existing hooks
    insert_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if any(hook in stripped for hook in ['useUser()', 'useColors()', 'useRouter()', 'useState(']):
            insert_idx = i
    
    if insert_idx is not None:
        # Find the indentation level
        indent = '  '
        for ch in lines[insert_idx]:
            if ch == ' ':
                indent = ' ' * (len(lines[insert_idx]) - len(lines[insert_idx].lstrip()))
                break
        lines.insert(insert_idx + 1, f'{indent}const {{ t }} = useTranslation();')
    else:
        # Fallback: add after first { in function component
        for i, line in enumerate(lines):
            if 'export default function' in line or 'export function' in line:
                # Find the opening brace
                for j in range(i, min(i+5, len(lines))):
                    if '{' in lines[j]:
                        indent = '  '
                        lines.insert(j + 1, f'{indent}const {{ t }} = useTranslation();')
                        break
                break
    return '\n'.join(lines)

def process_file(source):
    """Process a single source file."""
    filepath = get_project_path(source)
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {source}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    entries = by_source[source]
    replacements_made = 0
    
    for key, entry in entries:
        value = entry['value']
        line_num = entry['line']
        
        # Skip emoji-only or single-character strings that are decorative
        if len(value) <= 2 and all(ord(c) > 127 for c in value):
            # Pure emoji - still replace for consistency
            pass
        
        # Try to find and replace the string in the content
        # Strategy: look for the exact string value in quotes near the expected line
        escaped_value = re.escape(value)
        
        # Pattern 1: Simple string in JSX text content: >STRING<
        # Pattern 2: String in quotes: "STRING" or 'STRING'
        # Pattern 3: Template literal: `STRING`
        
        # For simple strings (no JS expressions), do direct replacement
        if '{' not in value or value.startswith('{') and value.endswith('}'):
            # Check if it's a pure expression like {companionName}
            pass
        
        # Try to replace the literal string
        replaced = False
        
        # Case 1: String as JSX text content between > and <
        # e.g., >Loading...</Text> -> >{t('home.loading')}</Text>
        pattern = f'>{re.escape(value)}<'
        if pattern.replace('\\', '') != f'>{value}<':
            # Has special regex chars
            pass
        if re.search(f'>{re.escape(value)}<', content):
            content = content.replace(f'>{value}<', f">{{t('{key}')}}<", 1)
            replaced = True
            replacements_made += 1
        
        # Case 2: String in single quotes as prop value or in JSX expression
        elif f"'{value}'" in content:
            # Check context - is it in JSX expression or as a return value?
            # Replace 'value' with t('key')
            content = content.replace(f"'{value}'", f"t('{key}')", 1)
            replaced = True
            replacements_made += 1
        
        # Case 3: String in double quotes
        elif f'"{value}"' in content:
            content = content.replace(f'"{value}"', f"t('{key}')", 1)
            replaced = True
            replacements_made += 1
        
        # Case 4: Template literal
        elif f'`{value}`' in content:
            content = content.replace(f'`{value}`', f"t('{key}')", 1)
            replaced = True
            replacements_made += 1
        
        if not replaced:
            # Log unmatched strings for manual review
            print(f"  UNMATCHED: {key} = {repr(value[:40])} (line ~{line_num})")
    
    if replacements_made > 0:
        # Add import if needed
        if needs_import(content):
            content = add_import(content)
        
        # Add hook if needed
        if needs_hook(content):
            content = add_hook(content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"  OK: {source} — {replacements_made} replacements")
        return True
    else:
        print(f"  NO MATCHES: {source}")
        return False

# Main execution
if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    
    if target:
        files = [target]
    else:
        files = TARGET_FILES
    
    print(f"Processing {len(files)} files...")
    print()
    
    success = 0
    for src in sorted(files):
        print(f"[{src}]")
        if process_file(src):
            success += 1
        print()
    
    print(f"\nDone: {success}/{len(files)} files modified")
