#!/bin/bash
# RECOFREE RELEASE GATE — Automated pre-publish validation
# Run: npm run recofree:release-gate

REPORT="docs/release-gate/RECOFREE_RELEASE_GATE_REPORT.md"
PASS=true
BLOCKERS=""
WARNINGS=""

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
TEST_PASS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '(\d+) failed' | grep -oP '\d+' || echo "0")
if [ "$FAIL_COUNT" -gt 0 ] 2>/dev/null; then
  echo "  FAIL: $FAIL_COUNT tests failed"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Test suite: $FAIL_COUNT failed"
else
  echo "  PASS: $TEST_PASS"
fi

# 3. Release gate tests
echo ">>> GATE 3: Release gate tests..."
RG_OUTPUT=$(npx vitest run __tests__/integration/releaseGate.test.ts 2>&1)
RG_PASS=$(echo "$RG_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
RG_FAIL=$(echo "$RG_OUTPUT" | grep -oP '(\d+) failed' | grep -oP '\d+' || echo "0")
if [ "$RG_FAIL" -gt 0 ] 2>/dev/null; then
  echo "  FAIL: $RG_FAIL release gate tests failed"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Release gate: $RG_FAIL failed"
else
  echo "  PASS: $RG_PASS"
fi

# 4. Auto-debug tests
echo ">>> GATE 4: Auto-debug system tests..."
AD_OUTPUT=$(npx vitest run __tests__/integration/autoDebugFullSystem.test.ts 2>&1)
AD_PASS=$(echo "$AD_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
AD_FAIL=$(echo "$AD_OUTPUT" | grep -oP '(\d+) failed' | grep -oP '\d+' || echo "0")
if [ "$AD_FAIL" -gt 0 ] 2>/dev/null; then
  echo "  FAIL: $AD_FAIL auto-debug tests failed"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Auto-debug: $AD_FAIL failed"
else
  echo "  PASS: $AD_PASS"
fi

# 5. Integration tests
echo ">>> GATE 5: Integration tests..."
INT_OUTPUT=$(npx vitest run __tests__/integration/ 2>&1)
INT_PASS=$(echo "$INT_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
INT_FAIL=$(echo "$INT_OUTPUT" | grep -oP '(\d+) failed' | grep -oP '\d+' || echo "0")
if [ "$INT_FAIL" -gt 0 ] 2>/dev/null; then
  echo "  FAIL: $INT_FAIL integration tests failed"
  PASS=false
  BLOCKERS="$BLOCKERS\n- Integration: $INT_FAIL failed"
else
  echo "  PASS: $INT_PASS"
fi

# 6. store:false check
echo ">>> GATE 6: Privacy store:false check..."
MINIMAL_STORE=$(grep -c "store.*false" server/minimal-gpt-proxy.ts 2>/dev/null || echo "0")
LEGACY_STORE=$(grep -c "store.*false" server/gpt-proxy.ts 2>/dev/null; echo $?)
LLM_STORE=$(grep -c "store.*false" server/_core/llm.ts 2>/dev/null || echo "0")
echo "  minimal-gpt-proxy: $MINIMAL_STORE (need >0)"
echo "  gpt-proxy (legacy): $LEGACY_STORE (need >0 if fallback active)"
echo "  llm.ts: $LLM_STORE (need >0)"
if [ "$MINIMAL_STORE" -eq 0 ]; then
  PASS=false
  BLOCKERS="$BLOCKERS\n- store:false missing in minimal-gpt-proxy"
fi
if [ "$LEGACY_STORE" -eq 0 ]; then
  WARNINGS="$WARNINGS\n- WARNING: store:false missing in legacy gpt-proxy (P0 if fallback active)"
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

# Summary
echo ""
echo "=========================================="
if [ "$PASS" = true ]; then
  echo "  RELEASE GATE: PASS"
  echo "  APK READY: YES"
else
  echo "  RELEASE GATE: FAIL"
  echo "  APK READY: NO"
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
| store:false (legacy) | $LEGACY_STORE |
| Lockfile | $([ "$UNCOMMITTED" -eq 0 ] && echo "clean" || echo "$UNCOMMITTED uncommitted") |

## VERDICT

$([ "$PASS" = true ] && echo "**PASS — APK READY: YES**" || echo "**FAIL — APK READY: NO**")

$([ -n "$BLOCKERS" ] && echo -e "## BLOCKERS\n$BLOCKERS" || echo "No blockers.")

$([ -n "$WARNINGS" ] && echo -e "## WARNINGS\n$WARNINGS" || echo "No warnings.")
EOF

echo ""
echo "Report written to: $REPORT"
