"""Fix module-level t() calls by replacing them with tStatic()."""
import re
import os

files_to_fix = [
    'app/(tabs)/diary.tsx',
    'app/_layout.tsx',
    'app/intake.tsx',
    'components/mood-trend-chart-card.tsx',
    'components/prechat-vsp.tsx',
    'components/profile/BalkmetafoorCard.tsx',
    'components/progress-card.tsx',
    'components/sober-counter.tsx',
    'components/vsp-section-editor.tsx',
]

# Pattern to match standalone t(' but not words ending in t like "const" or "import"
T_CALL_PATTERN = re.compile(r"(?<![a-zA-Z_])t\('")

for filepath in files_to_fix:
    full_path = os.path.join('/home/ubuntu/recofree-app', filepath)
    if not os.path.exists(full_path):
        print(f'SKIP: {filepath}')
        continue

    with open(full_path, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    hook_line_idx = None
    for i, line in enumerate(lines):
        if 'const { t } = useTranslation()' in line:
            hook_line_idx = i
            break

    if hook_line_idx is None:
        print(f'NO HOOK FOUND: {filepath}')
        continue

    # Check if there are module-level t() calls (before the hook)
    has_module_level = False
    for i in range(hook_line_idx):
        if T_CALL_PATTERN.search(lines[i]):
            has_module_level = True
            break

    if not has_module_level:
        print(f'NO MODULE-LEVEL t(): {filepath}')
        continue

    # Replace module-level t() with tStatic()
    modified_lines = []
    for i, line in enumerate(lines):
        if i < hook_line_idx:
            new_line = T_CALL_PATTERN.sub("tStatic('", line)
            modified_lines.append(new_line)
        else:
            modified_lines.append(line)

    content = '\n'.join(modified_lines)

    # Add tStatic to import if not already there
    if 'tStatic' not in content:
        content = content.replace(
            "import { useTranslation } from '@/lib/i18n';",
            "import { useTranslation, tStatic } from '@/lib/i18n';"
        )

    with open(full_path, 'w') as f:
        f.write(content)

    print(f'FIXED: {filepath}')
