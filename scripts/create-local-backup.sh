#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${1:-$ROOT_DIR/backups}"
TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
BACKUP_DIR="$BACKUP_ROOT/recofree-$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

cd "$ROOT_DIR"

echo "Creating RecoFree local backup in $BACKUP_DIR"

git bundle create "$BACKUP_DIR/recofree-complete-history.bundle" --all
git archive --format=zip --output="$BACKUP_DIR/recofree-head-source.zip" HEAD
tar -czf "$BACKUP_DIR/recofree-working-tree.tar.gz" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='backups' \
  --exclude='.expo' \
  --exclude='.manus' \
  --exclude='.manus-logs' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='dist' \
  --exclude='coverage' \
  .

git rev-parse HEAD > "$BACKUP_DIR/HEAD.txt"
git status --short > "$BACKUP_DIR/git-status.txt"
git remote -v > "$BACKUP_DIR/git-remotes.txt"
git log --oneline --decorate -100 > "$BACKUP_DIR/recent-commits.txt"

cat > "$BACKUP_DIR/RESTORE.txt" <<'EOF'
RecoFree local backup contents

1. recofree-complete-history.bundle
   Full Git history and all refs. Restore with:
   git clone recofree-complete-history.bundle recofree-app

2. recofree-head-source.zip
   Clean source snapshot of committed HEAD.

3. recofree-working-tree.tar.gz
   Working-tree snapshot including current uncommitted files, excluding .git,
   node_modules, build output and previous backups.

This backup does not replace the official Manus Task Data Backup. Use
https://manus.im/backup before the official deadline.
EOF

(cd "$BACKUP_DIR" && sha256sum \
  recofree-complete-history.bundle \
  recofree-head-source.zip \
  recofree-working-tree.tar.gz \
  HEAD.txt git-status.txt git-remotes.txt recent-commits.txt RESTORE.txt \
  > SHA256SUMS.txt)

echo "Backup complete: $BACKUP_DIR"
echo "Verify with: cd '$BACKUP_DIR' && sha256sum -c SHA256SUMS.txt"
