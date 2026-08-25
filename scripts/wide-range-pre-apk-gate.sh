#!/usr/bin/env bash

set -uo pipefail

REPORT="${RECOFREE_WIDE_RANGE_REPORT:-docs/release-gate/RECOFREE_WIDE_RANGE_PRE_APK_REPORT.md}"
EXPECTED_RAILWAY_URL="https://railwayappdashboard-production.up.railway.app"
PASS=true
BLOCKERS=""
WARNINGS=""

strip_ansi() {
  sed -r 's/\x1B\[[0-9;]*[mK]//g'
}

passed_tests() {
  echo "$1" | strip_ansi | awk '/^[[:space:]]*Tests[[:space:]]/ {
    for (i = 1; i <= NF; i++) if ($i == "passed") { print $(i - 1) " passed"; exit }
  }'
}

fail_gate() {
  PASS=false
  BLOCKERS="$BLOCKERS\n- $1"
  echo "  FAIL: $1"
}

warn_gate() {
  WARNINGS="$WARNINGS\n- $1"
  echo "  WARN: $1"
}

run_layer() {
  local number="$1"
  local label="$2"
  shift 2
  echo ">>> LAYER $number: $label"
  local output
  output=$(npx vitest run "$@" 2>&1)
  local status=$?
  local count
  count=$(passed_tests "$output")
  count=${count:-"0 passed"}
  if [ "$status" -ne 0 ]; then
    fail_gate "$label tests failed (exit $status)"
    echo "$output" | strip_ansi | tail -40
  else
    echo "  PASS: $count"
  fi
}

echo "=========================================="
echo "  RECOFREE WIDE-RANGE PRE-APK GATE"
echo "  $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=========================================="

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo ">>> PRECONDITION: Source and build attestation"
echo "  Commit: $COMMIT"
echo "  Uncommitted files: $DIRTY_COUNT"
if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ "$DIRTY_COUNT" -ne 0 ]; then
  fail_gate "Git working tree is not clean; build source is not reproducible"
fi

if [ "${EXPO_PUBLIC_API_BASE_URL:-}" != "$EXPECTED_RAILWAY_URL" ]; then
  fail_gate "EXPO_PUBLIC_API_BASE_URL is not the Railway production URL"
else
  echo "  PASS: build API base is Railway"
fi

REQUIRED_TRUE_FLAGS=(
  EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY
  EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION
  EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE
  EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING
)
for flag in "${REQUIRED_TRUE_FLAGS[@]}"; do
  if [ "${!flag:-}" != "true" ]; then
    fail_gate "$flag is not true in the active build environment"
  else
    echo "  PASS: $flag=true"
  fi
done

if ! grep -q 'buildArchs: \["armeabi-v7a", "arm64-v8a"\]' app.config.ts; then
  fail_gate "Dual Android ABI configuration is missing"
else
  echo "  PASS: dual ABI armeabi-v7a + arm64-v8a"
fi

if ! grep -q '"preview"' eas.json || ! grep -q '"distribution": "internal"' eas.json; then
  fail_gate "Preview/internal APK profile is missing"
else
  echo "  PASS: preview/internal build profile present"
fi

ACTIVE_RUNTIME_FILES=(
  constants/oauth.ts
  lib/ai/openai-provider.ts
  lib/backpack-extractor/client.ts
  lib/backpack-analysis/schema-mode-trigger.ts
  server/minimal-gpt-proxy.ts
  server/_core/llm.ts
  server/engine/nano-interpret.ts
)

if grep -nE 'https?://[^"[:space:]]*manus\.(space|computer|com|im|ai)' "${ACTIVE_RUNTIME_FILES[@]}" >/tmp/recofree-manus-runtime-urls.txt 2>/dev/null; then
  fail_gate "Active API/GPT runtime files contain a Manus-domain URL"
  cat /tmp/recofree-manus-runtime-urls.txt
else
  echo "  PASS: no Manus-domain URL in active API/GPT runtime files"
fi

if grep -q 'forge.manus' server/_core/llm.ts || grep -qE "provider:[[:space:]]*['\"]forge['\"]" server/_core/llm.ts; then
  fail_gate "Active extraction provider still contains Forge routing"
else
  echo "  PASS: extraction provider is direct OpenAI only"
fi

run_layer 1 "Native client / Android / build configuration" \
  __tests__/wide-range-pre-apk-gate.test.ts \
  __tests__/api-base-url-production-guard.test.ts \
  __tests__/prompt/minimalProxyClientSwitch.test.ts

run_layer 2 "Deterministic engine and routing" \
  __tests__/pipeline/epistemicModelRouting.test.ts \
  __tests__/pipeline/epistemicPipelineIntegration.test.ts \
  __tests__/guidanceDepthResolver/guidanceDepthResolver.test.ts \
  __tests__/guidanceDepthResolver/harmDynamic.test.ts \
  __tests__/tendency-to-canonical-bridge.test.ts

run_layer 3 "Memory and local storage" \
  __tests__/rugzak/manualDataRefresh.test.ts \
  __tests__/integration/fullDeviceFlowClinicalCtx.test.ts \
  __tests__/diary-selfcare-projection.test.ts \
  __tests__/daystructure-persistence.test.ts

run_layer 4 "Prompts, safety and clinical contracts" \
  __tests__/prompt/contextApplicationContractAlwaysActive.test.ts \
  __tests__/safety-prompt-blocks.test.ts \
  __tests__/schema-mode-presence-pipeline.test.ts \
  __tests__/clinical-factors.test.ts \
  __tests__/wiring-verification.test.ts

run_layer 5 "Railway, minimal proxy and provider isolation" \
  __tests__/server/minimalGptProxyRoute.test.ts \
  __tests__/server/extractionProviderFallback.test.ts \
  __tests__/prompt/minimalProxyBothPersonasClientFlow.test.ts

run_layer 6 "UI, i18n and export" \
  __tests__/i18n-completeness.test.ts \
  __tests__/vspInsight/vspInsightFileExport.test.ts \
  __tests__/exportImport/encryptedExportImport.acceptance.test.ts \
  __tests__/exportImport/exportScopeCompleteness.acceptance.test.ts

run_layer 7 "Release-gate and failure-boundary infrastructure" \
  __tests__/integration/releaseGate.test.ts \
  __tests__/integration/autoDebugFullSystem.test.ts \
  __tests__/integration/forensicRuntimeValidation.test.ts

if grep -q 'APK READY: YES' scripts/release-gate.sh; then
  fail_gate "Release gate still claims device readiness from local tests alone"
fi

if git grep -nE '/api/gpt-proxy|/api/trpc/ai\.chat' -- 'lib/ai/openai-provider.ts' >/dev/null; then
  warn_gate "Legacy Railway chat routes remain in frozen fallback code; minimal-proxy tests must stay mandatory"
fi

mkdir -p docs/release-gate
cat > "$REPORT" << EOF
# RECOFREE WIDE-RANGE PRE-APK GATE REPORT

**Generated:** $(date -u '+%Y-%m-%d %H:%M UTC')  
**Commit:** $COMMIT  
**Working tree files:** $DIRTY_COUNT

## Verdict

$([ "$PASS" = true ] && echo "**PASS — APK BUILD ELIGIBLE: YES**" || echo "**FAIL — APK BUILD ELIGIBLE: NO**")

> Device verification is a separate post-build gate. Local tests never prove **APK READY**.

$([ -n "$BLOCKERS" ] && echo -e "## Blockers\n$BLOCKERS" || echo "No blockers.")

$([ -n "$WARNINGS" ] && echo -e "## Warnings\n$WARNINGS" || echo "No warnings.")
EOF

echo ""
echo "=========================================="
if [ "$PASS" = true ]; then
  echo "  WIDE-RANGE GATE: PASS"
  echo "  APK BUILD ELIGIBLE: YES"
  echo "  DEVICE VERIFIED: NO"
  exit 0
else
  echo "  WIDE-RANGE GATE: FAIL"
  echo "  APK BUILD ELIGIBLE: NO"
  echo "  DEVICE VERIFIED: NO"
  exit 1
fi
