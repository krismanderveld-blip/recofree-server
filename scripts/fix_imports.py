"""
Fix missing LocalDeviceTimeService imports.
Adds the import line after the last existing import in files that use the service
but don't import it.
"""

import re
import os
import subprocess

PROJECT_ROOT = "/home/ubuntu/recofree-app"
IMPORT_LINE = 'import { LocalDeviceTimeService } from "@/lib/core/time";'

# Files that should NOT get the import (they define it or re-export it)
SKIP_FILES = [
    "lib/core/time/LocalDeviceTimeService.ts",
    "lib/core/time/index.ts",
    "lib/core/time/types.ts",
    "lib/core/time/testing.ts",
    "lib/core/time/useLocalDeviceTime.ts",
    "lib/core/time/TimeProvider.tsx",
]

def find_files_needing_import():
    """Find files that use LocalDeviceTimeService but don't import it."""
    result = subprocess.run(
        ["grep", "-rln", "LocalDeviceTimeService", "--include=*.ts", "--include=*.tsx",
         PROJECT_ROOT],
        capture_output=True, text=True
    )
    
    files = []
    for filepath in result.stdout.strip().split('\n'):
        if not filepath:
            continue
        if 'node_modules' in filepath:
            continue
            
        rel = os.path.relpath(filepath, PROJECT_ROOT)
        if any(rel == skip or rel.endswith(skip) for skip in SKIP_FILES):
            continue
        
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check if it uses LocalDeviceTimeService but doesn't import it
        if 'LocalDeviceTimeService' in content and 'import' not in content.split('LocalDeviceTimeService')[0].split('\n')[-1]:
            # More precise check: look for import statement containing LocalDeviceTimeService
            has_import = bool(re.search(r'import\s+.*LocalDeviceTimeService.*from', content))
            if not has_import:
                files.append(filepath)
    
    return files

def add_import_to_file(filepath):
    """Add the import line after the last import statement."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find the last import line (handling multi-line imports)
    last_import_idx = -1
    in_multiline_import = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import '):
            if '{' in stripped and '}' not in stripped:
                in_multiline_import = True
            else:
                last_import_idx = i
        elif in_multiline_import:
            if '}' in stripped:
                in_multiline_import = False
                last_import_idx = i
        elif stripped.startswith('} from'):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, IMPORT_LINE)
    else:
        # No imports found - add after initial comments
        insert_at = 0
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('/*') or stripped.startswith('*') or stripped.startswith('//') or stripped == '':
                insert_at = i + 1
            else:
                break
        lines.insert(insert_at, IMPORT_LINE)
    
    with open(filepath, 'w') as f:
        f.write('\n'.join(lines))
    
    return True

def main():
    files = find_files_needing_import()
    print(f"Found {len(files)} files needing import fix")
    
    for filepath in sorted(files):
        rel = os.path.relpath(filepath, PROJECT_ROOT)
        add_import_to_file(filepath)
        print(f"  ✓ {rel}")
    
    print(f"\nFixed {len(files)} files")

if __name__ == "__main__":
    main()
