#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${RECOFREE_STANDALONE_GATE_DIR:-/tmp/recofree-standalone-gate}"
BUNDLE_DIR="$OUT_DIR/android-export"
REPORT="${RECOFREE_STANDALONE_GATE_REPORT:-$OUT_DIR/STANDALONE_APK_RAILWAY_GATE.md}"
RAILWAY_HOST="https://railwayappdashboard-production.up.railway.app"

rm -rf "$OUT_DIR"
mkdir -p "$BUNDLE_DIR" "$(dirname "$REPORT")"

PASS=true
FAILURES=()

fail() {
  PASS=false
  FAILURES+=("$1")
  echo "FAIL: $1"
}

pass() {
  echo "PASS: $1"
}

echo "=== STANDALONE APK + MINIMAL RAILWAY GATE ==="

echo ">>> Server bundle"
if npm run build >/tmp/recofree-standalone-server-build.log 2>&1; then
  pass "Railway server bundles without OAuth/database runtime bootstrap"
else
  tail -40 /tmp/recofree-standalone-server-build.log || true
  fail "Railway server bundle failed"
fi

echo ">>> Security/privacy/storage/backup contracts"
TARGETED_TESTS=(
  __tests__/security/standaloneNativeRoot.test.ts
  __tests__/security/minimalRailwayRouteSurface.test.ts
  __tests__/security/railwayClientSecurity.test.ts
  __tests__/security/signingHandoverContract.test.ts
  __tests__/privacy/analysisTextMinimizer.test.ts
  __tests__/storage-encryption.test.ts
  __tests__/storage/atomicSensitiveJsonStore.test.ts
  __tests__/exportImport/standaloneEncryptedBackupCoverage.test.ts
  __tests__/exportImport/extendedExportScope.acceptance.test.ts
  __tests__/crisis/crisisResourceLink.test.ts
)
if npx vitest run "${TARGETED_TESTS[@]}" --reporter=dot >/tmp/recofree-standalone-targeted-tests.log 2>&1; then
  pass "standalone contract tests"
else
  tail -80 /tmp/recofree-standalone-targeted-tests.log || true
  fail "standalone contract tests failed"
fi

echo ">>> Android production JavaScript export"
if EXPO_NO_TELEMETRY=1 npx expo export \
  --platform android \
  --no-bytecode \
  --output-dir "$BUNDLE_DIR" \
  >/tmp/recofree-standalone-android-export.log 2>&1; then
  pass "Android production bundle exported"
else
  tail -80 /tmp/recofree-standalone-android-export.log || true
  fail "Android production bundle export failed"
fi

BUNDLE="$(find "$BUNDLE_DIR" -type f -path '*/_expo/static/js/android/*.js' | head -1 || true)"
if [[ -z "$BUNDLE" || ! -f "$BUNDLE" ]]; then
  fail "readable Android JavaScript bundle not found"
else
  BANNED_MARKERS=(
    'api.manus.im'
    'manus.space'
    'manus.computer'
    'api.openai.com'
    '/api/gpt-proxy'
    '/api/nano-interpret'
    '/api/pre-translate'
    '/api/session-greeting'
    '/api/signal-engine'
    '/api/engine-process'
    '/api/trpc'
    '/api/oauth'
    '/api/auth/'
    '/api/debug-prompt'
    '/api/data-api/'
    '/api/push/'
    '/api/vsp-backpack-analysis'
    '/api/vsp-document-parse'
    '/api/backpack-document-parse'
  )
  for marker in "${BANNED_MARKERS[@]}"; do
    if grep -Fq "$marker" "$BUNDLE"; then
      fail "Android bundle contains banned marker: $marker"
    fi
  done

  for required in "$RAILWAY_HOST" '/api/client/session' '/api/minimal-gpt-proxy'; do
    if grep -Fq "$required" "$BUNDLE"; then
      pass "Android bundle contains required marker: $required"
    else
      fail "Android bundle missing required marker: $required"
    fi
  done
fi

echo ">>> Credential hygiene"
TRACKED_CREDENTIALS="$(git ls-files | grep -E '(^|/)(credentials\.json|.*\.(jks|keystore|p12|p8|mobileprovision))$' || true)"
if [[ -n "$TRACKED_CREDENTIALS" ]]; then
  fail "signing credentials are tracked in Git"
else
  pass "no signing credentials tracked in Git"
fi

mkdir -p "$(dirname "$REPORT")"
{
  echo "# Standalone APK + Minimal Railway Gate"
  echo
  echo "**Generated:** $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo
  echo "| Check | Result |"
  echo "|---|---|"
  echo "| Railway server bundle | $([[ -f dist/index.js ]] && echo PASS || echo FAIL) |"
  echo "| Contract tests | $(grep -q 'Test Files.*passed' /tmp/recofree-standalone-targeted-tests.log 2>/dev/null && echo PASS || echo FAIL) |"
  echo "| Android readable production bundle | $([[ -n "$BUNDLE" && -f "$BUNDLE" ]] && echo PASS || echo FAIL) |"
  echo "| Credential hygiene | $([[ -z "$TRACKED_CREDENTIALS" ]] && echo PASS || echo FAIL) |"
  echo "| Overall | $([[ "$PASS" == true ]] && echo PASS || echo FAIL) |"
  if [[ ${#FAILURES[@]} -gt 0 ]]; then
    echo
    echo "## Failures"
    for item in "${FAILURES[@]}"; do echo "- $item"; done
  fi
} > "$REPORT"

echo "Report: $REPORT"
[[ "$PASS" == true ]]
