#!/bin/bash
# RECOFREE RELEASE GATE — Automated pre-publish validation
# Run: npm run recofree:release-gate

REPORT="${RECOFREE_RELEASE_GATE_REPORT:-docs/release-gate/RECOFREE_RELEASE_GATE_REPORT.md}"
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

echo "=========================================="
echo "  RECOFREE RELEASE GATE"
echo "  $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "=========================================="
echo ""

# 1. TypeScript
echo ">>> GATE 1: TypeScript check..."
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
if [ "$TS_ERRORS" -gt 0 ]; then
  echo "  FAIL: $TS_ERRORS TypeScript errors"
  PASS=false
  BLOCKERS="$BLOCKERS\n- TypeScript: $TS_ERRORS errors"
else
  echo "  PASS: 0 TypeScript errors"
fi

# 2. Full test suite
echo ">>> GATE 2: Full test suite..."
TEST_OUTPUT=$(npx vitest run 2>&1)
TEST_STATUS=$?
TEST_PASS=$(passed_tests "$TEST_OUTPUT")
TEST_PASS=${TEST_PASS:-"0 passed"}
if [ "$TEST_STATUS" -ne 0 ]; then
  echo "  FAIL: full suite exited with status $TEST_STATUS"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Test suite failed (exit $TEST_STATUS)"
else
  echo "  PASS: $TEST_PASS"
fi

# 3. Release gate tests
echo ">>> GATE 3: Release gate tests..."
RG_OUTPUT=$(npx vitest run __tests__/integration/releaseGate.test.ts 2>&1)
RG_STATUS=$?
RG_PASS=$(passed_tests "$RG_OUTPUT")
RG_PASS=${RG_PASS:-"0 passed"}
if [ "$RG_STATUS" -ne 0 ]; then
  echo "  FAIL: release gate tests exited with status $RG_STATUS"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Release gate tests failed (exit $RG_STATUS)"
else
  echo "  PASS: $RG_PASS"
fi

# 4. Auto-debug tests
echo ">>> GATE 4: Auto-debug system tests..."
AD_OUTPUT=$(npx vitest run __tests__/integration/autoDebugFullSystem.test.ts 2>&1)
AD_STATUS=$?
AD_PASS=$(passed_tests "$AD_OUTPUT")
AD_PASS=${AD_PASS:-"0 passed"}
if [ "$AD_STATUS" -ne 0 ]; then
  echo "  FAIL: auto-debug tests exited with status $AD_STATUS"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Auto-debug tests failed (exit $AD_STATUS)"
else
  echo "  PASS: $AD_PASS"
fi

# 5. Integration tests
echo ">>> GATE 5: Integration tests..."
INT_OUTPUT=$(npx vitest run __tests__/integration/ 2>&1)
INT_STATUS=$?
INT_PASS=$(passed_tests "$INT_OUTPUT")
INT_PASS=${INT_PASS:-"0 passed"}
if [ "$INT_STATUS" -ne 0 ]; then
  echo "  FAIL: integration tests exited with status $INT_STATUS"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Integration tests failed (exit $INT_STATUS)"
else
  echo "  PASS: $INT_PASS"
fi

# 6. Active minimal-proxy store:false check
echo ">>> GATE 6: Privacy store:false check..."
MINIMAL_STORE=$(grep -c "store.*false" server/minimal-gpt-proxy.ts 2>/dev/null || echo "0")
CLIENT_STORE=$(grep -c "store.*false" lib/ai/minimal-proxy-client.ts 2>/dev/null || echo "0")
echo "  minimal-gpt-proxy: $MINIMAL_STORE (need >0)"
echo "  client minimal-proxy helper: $CLIENT_STORE (need >0)"
if [ "$MINIMAL_STORE" -eq 0 ] || [ "$CLIENT_STORE" -eq 0 ]; then
  PASS=false
  BLOCKERS="$BLOCKERS\n- store:false missing in active minimal-proxy path"
fi

# 7. Lockfile check
echo ">>> GATE 7: Lockfile integrity..."
if git diff --name-only 2>/dev/null | grep -q "pnpm-lock.yaml"; then
  echo "  FAIL: pnpm-lock.yaml modified"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Lockfile modified"
else
  echo "  PASS: pnpm-lock.yaml unchanged"
fi

# 8. Git status
echo ">>> GATE 8: Git status..."
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l || echo "0")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  Commit: $COMMIT"
echo "  Uncommitted files: $UNCOMMITTED"
if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ "$UNCOMMITTED" -ne 0 ]; then
  echo "  FAIL: working tree is not clean"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Git working tree has $UNCOMMITTED uncommitted files"
fi

# 9. Seven-layer wide-range pre-APK gate
echo ">>> GATE 9: Wide-range pre-APK fault-boundary matrix..."
WR_OUTPUT=$(ALLOW_DIRTY="${ALLOW_DIRTY:-0}" bash scripts/wide-range-pre-apk-gate.sh 2>&1)
WR_STATUS=$?
if [ "$WR_STATUS" -ne 0 ]; then
  echo "  FAIL: wide-range gate exited with status $WR_STATUS"
  echo "$WR_OUTPUT" | strip_ansi | tail -60
  PASS=false
  BLOCKERS="$BLOCKERS\n- Wide-range pre-APK gate failed (exit $WR_STATUS)"
else
  echo "  PASS: seven fault-boundary layers"
fi

# 10. Real Android bundle + minimal Railway independence gate
echo ">>> GATE 10: Standalone APK + minimal Railway boundary..."
SA_OUTPUT=$(RECOFREE_STANDALONE_GATE_REPORT="${RECOFREE_STANDALONE_GATE_REPORT:-/tmp/RECOFREE_STANDALONE_APK_RAILWAY_GATE.md}" bash scripts/standalone-apk-railway-gate.sh 2>&1)
SA_STATUS=$?
if [ "$SA_STATUS" -ne 0 ]; then
  echo "  FAIL: standalone gate exited with status $SA_STATUS"
  echo "$SA_OUTPUT" | strip_ansi | tail -80
  PASS=false
  BLOCKERS="$BLOCKERS\n- Standalone APK + minimal Railway gate failed (exit $SA_STATUS)"
else
  echo "  PASS: Android bundle, route, privacy, encryption and backup boundaries"
fi

# Summary
echo ""
echo "=========================================="
if [ "$PASS" = true ]; then
  echo "  RELEASE GATE: PASS"
  echo "  APK BUILD ELIGIBLE: YES"
  echo "  DEVICE VERIFIED: NO"
else
  echo "  RELEASE GATE: FAIL"
  echo "  APK BUILD ELIGIBLE: NO"
  echo "  DEVICE VERIFIED: NO"
fi
echo "=========================================="
echo ""

if [ -n "$BLOCKERS" ]; then
  echo "BLOCKERS:"
  echo -e "$BLOCKERS"
  echo ""
fi

if [ -n "$WARNINGS" ]; then
  echo "WARNINGS:"
  echo -e "$WARNINGS"
  echo ""
fi

echo "Commit: $COMMIT"
echo "TypeScript: $TS_ERRORS errors"
echo "Tests: $TEST_PASS"
echo "Release Gate: $RG_PASS"
echo "Auto-Debug: $AD_PASS"
echo "Integration: $INT_PASS"

# Write report
mkdir -p docs/release-gate
cat > "$REPORT" << EOF
# RECOFREE RELEASE GATE REPORT

**Generated:** $(date -u '+%Y-%m-%d %H:%M UTC')
**Commit:** $COMMIT

---

## RESULT

| Gate | Result |
|------|--------|
| TypeScript | $TS_ERRORS errors |
| Full Test Suite | $TEST_PASS |
| Release Gate Tests | $RG_PASS |
| Auto-Debug Tests | $AD_PASS |
| Integration Tests | $INT_PASS |
| store:false (minimal) | $MINIMAL_STORE |
| store:false (client minimal helper) | $CLIENT_STORE |
| Git working tree | $([ "$UNCOMMITTED" -eq 0 ] && echo "clean" || echo "$UNCOMMITTED uncommitted") |
| Wide-range fault-boundary gate | $([ "$WR_STATUS" -eq 0 ] && echo "PASS" || echo "FAIL") |
| Standalone APK + Railway gate | $([ "$SA_STATUS" -eq 0 ] && echo "PASS" || echo "FAIL") |

## VERDICT

$([ "$PASS" = true ] && echo "**PASS — APK BUILD ELIGIBLE: YES**" || echo "**FAIL — APK BUILD ELIGIBLE: NO**")

> Device verification remains a separate post-build gate. Local tests do not prove APK readiness.

$([ -n "$BLOCKERS" ] && echo -e "## BLOCKERS\n$BLOCKERS" || echo "No blockers.")

$([ -n "$WARNINGS" ] && echo -e "## WARNINGS\n$WARNINGS" || echo "No warnings.")
EOF

echo ""
echo "Report written to: $REPORT"

if [ "$PASS" = true ]; then
  exit 0
fi
exit 1
