#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PACKAGE="space.manus.recofree.app.t20260405113127"

usage() {
  echo "Usage: $0 /path/to/known-good.apk /path/to/candidate.apk" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage
KNOWN_GOOD_APK="$1"
CANDIDATE_APK="$2"

[[ -f "$KNOWN_GOOD_APK" ]] || { echo "SIGNING_HANDOVER_BLOCKED: known-good APK not found" >&2; exit 2; }
[[ -f "$CANDIDATE_APK" ]] || { echo "SIGNING_HANDOVER_BLOCKED: candidate APK not found" >&2; exit 2; }
command -v apksigner >/dev/null 2>&1 || {
  echo "SIGNING_HANDOVER_BLOCKED: apksigner is required" >&2
  exit 2
}

certificate_digest() {
  apksigner verify --print-certs "$1" |
    awk -F': ' '/Signer #1 certificate SHA-256 digest/ { print tolower($2); exit }'
}

application_id() {
  local apk="$1"
  if command -v apkanalyzer >/dev/null 2>&1; then
    apkanalyzer manifest application-id "$apk"
    return
  fi
  if command -v aapt >/dev/null 2>&1; then
    aapt dump badging "$apk" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1
    return
  fi
  echo "UNKNOWN"
}

KNOWN_DIGEST="$(certificate_digest "$KNOWN_GOOD_APK")"
CANDIDATE_DIGEST="$(certificate_digest "$CANDIDATE_APK")"
KNOWN_PACKAGE="$(application_id "$KNOWN_GOOD_APK")"
CANDIDATE_PACKAGE="$(application_id "$CANDIDATE_APK")"

[[ -n "$KNOWN_DIGEST" && -n "$CANDIDATE_DIGEST" ]] || {
  echo "SIGNING_HANDOVER_BLOCKED: certificate digest unavailable" >&2
  exit 2
}

echo "KNOWN_GOOD_SHA256=$KNOWN_DIGEST"
echo "CANDIDATE_SHA256=$CANDIDATE_DIGEST"
echo "KNOWN_GOOD_PACKAGE=$KNOWN_PACKAGE"
echo "CANDIDATE_PACKAGE=$CANDIDATE_PACKAGE"

if [[ "$KNOWN_DIGEST" != "$CANDIDATE_DIGEST" ]]; then
  echo "SIGNING_IDENTITY_MISMATCH"
  exit 1
fi

for package_id in "$KNOWN_PACKAGE" "$CANDIDATE_PACKAGE"; do
  if [[ "$package_id" != "UNKNOWN" && "$package_id" != "$EXPECTED_PACKAGE" ]]; then
    echo "PACKAGE_ID_MISMATCH: expected $EXPECTED_PACKAGE, got $package_id"
    exit 1
  fi
done

echo "SIGNING_HANDOVER_PASS"
