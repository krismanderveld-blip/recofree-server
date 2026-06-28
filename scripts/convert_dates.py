"""
Batch converter: replaces `new Date()` patterns with LocalDeviceTimeService calls.

Strategy:
- `new Date().toISOString()` → `LocalDeviceTimeService.now().utcIso`
- `new Date().getTime()` / `Date.now()` → `LocalDeviceTimeService.now().epochMs`
- `new Date()` (standalone, used for comparison) → `new Date(LocalDeviceTimeService.now().epochMs)`
- Adds import if not already present

Exclusions:
- Test files (*-tests.ts, *.test.ts, __tests__/, __mocks__/)
- Server-side files (server/) — these run on Node, not device
- The LocalDeviceTimeService itself
- Files that parse stored ISO strings: `new Date(someVariable)` — NOT touched
"""

import re
import os
import sys

PROJECT_ROOT = "/home/ubuntu/recofree-app"

IMPORT_LINE = 'import { LocalDeviceTimeService } from "@/lib/core/time";'
# For files in modules/ that use relative paths differently
IMPORT_LINE_MODULES = 'import { LocalDeviceTimeService } from "@/lib/core/time";'

# Files/dirs to SKIP (server runs on Node, not device; test files use mocks)
SKIP_PATTERNS = [
    "node_modules",
    "__tests__",
    "__mocks__",
    ".test.",
    "-tests.ts",
    "server/",
    "scripts/",
    "lib/core/time/",  # Don't modify the service itself
    "dist/",
]

def should_skip(filepath):
    rel = os.path.relpath(filepath, PROJECT_ROOT)
    for pattern in SKIP_PATTERNS:
        if pattern in rel:
            return True
    return False

def has_import(content):
    return "LocalDeviceTimeService" in content

def add_import(content, filepath):
    """Add import after the last existing import statement."""
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import ') or (line.startswith('} from') and i > 0):
            last_import_idx = i
        # Handle multi-line imports
        if re.match(r'^import\s', line) or re.match(r'^\} from', line):
            last_import_idx = i
    
    # Find the actual last import (including multi-line)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import ') or (stripped.startswith('}') and 'from' in stripped):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, IMPORT_LINE)
    else:
        # No imports found, add at top (after any comments)
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith('/*') or line.startswith(' *') or line.startswith('//') or line.strip() == '':
                insert_at = i + 1
            else:
                break
        lines.insert(insert_at, IMPORT_LINE)
    
    return '\n'.join(lines)

def convert_file(filepath):
    """Convert new Date() patterns in a single file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: `new Date().toISOString()` → `LocalDeviceTimeService.now().utcIso`
    content = re.sub(
        r'new Date\(\)\.toISOString\(\)',
        'LocalDeviceTimeService.now().utcIso',
        content
    )
    
    # Pattern 2: `Date.now()` → `LocalDeviceTimeService.now().epochMs`
    # But NOT inside LocalDeviceTimeService itself or in `Date.now() - someVar` comparisons
    # We'll replace standalone Date.now() usage
    content = re.sub(
        r'(?<![\w.])Date\.now\(\)',
        'LocalDeviceTimeService.now().epochMs',
        content
    )
    
    # Pattern 3: `new Date().getTime()` → `LocalDeviceTimeService.now().epochMs`
    content = re.sub(
        r'new Date\(\)\.getTime\(\)',
        'LocalDeviceTimeService.now().epochMs',
        content
    )
    
    # Pattern 4: Standalone `new Date()` used for time comparisons or formatting
    # e.g., `const now = new Date();` → `const now = new Date(LocalDeviceTimeService.now().epochMs);`
    # This preserves Date object behavior while routing through central service
    content = re.sub(
        r'(?<!=\s)new Date\(\)(?!\.)',
        'new Date(LocalDeviceTimeService.now().epochMs)',
        content
    )
    # Also handle `= new Date()` at end of expression
    content = re.sub(
        r'=\s*new Date\(\)(?!\.)',
        '= new Date(LocalDeviceTimeService.now().epochMs)',
        content
    )
    
    if content != original:
        # Add import if needed
        if not has_import(content):
            content = add_import(content, filepath)
        
        with open(filepath, 'w') as f:
            f.write(content)
        
        return True
    return False

def main():
    converted_files = []
    skipped_files = []
    
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Skip node_modules etc
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '.expo']]
        
        for filename in files:
            if not (filename.endswith('.ts') or filename.endswith('.tsx')):
                continue
            
            filepath = os.path.join(root, filename)
            
            if should_skip(filepath):
                continue
            
            # Check if file has new Date() or Date.now()
            with open(filepath, 'r') as f:
                content = f.read()
            
            if 'new Date()' in content or 'Date.now()' in content:
                if convert_file(filepath):
                    rel = os.path.relpath(filepath, PROJECT_ROOT)
                    converted_files.append(rel)
                    print(f"  ✓ {rel}")
    
    print(f"\n{'='*60}")
    print(f"Converted {len(converted_files)} files")
    print(f"{'='*60}")
    
    return converted_files

if __name__ == "__main__":
    main()
