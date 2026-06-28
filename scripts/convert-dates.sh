#!/bin/bash
# Script to add LocalDeviceTimeService import and replace new Date() calls
# across all production files that don't already have the import.
# Run from project root.

set -e

# Files that need conversion (excluding test files, mocks, and files already converted)
# We'll handle each file category differently based on usage patterns.

# The import line to add
IMPORT_LINE='import { LocalDeviceTimeService } from "@/lib/core/time";'
IMPORT_LINE_AT='import { LocalDeviceTimeService } from "@/lib/core/time";'

# Function to add import if not already present
add_import() {
  local file="$1"
  if ! grep -q "LocalDeviceTimeService" "$file"; then
    # Find the last import line and add after it
    local last_import_line=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)
    if [ -n "$last_import_line" ]; then
      sed -i "${last_import_line}a\\${IMPORT_LINE}" "$file"
    fi
  fi
}

echo "Conversion script ready. Use Python for actual conversion."
