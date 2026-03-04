#!/bin/bash
# =============================================================================
# The Barber Project — Test Runner
# =============================================================================
#
# Usage:
#   bash scripts/run-tests.sh [api|client|admin|all]
#
# Prerequisites:
#   - API server running at http://localhost:8787
#   - Client dev server running at http://localhost:5174 (for client Playwright)
#   - Admin dev server running at http://localhost:5175 (for admin Playwright)
#   - Database seeded (pnpm --filter @barber/api db:seed)
#
# =============================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="${1:-all}"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

header() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  The Barber Project — Test Suite             ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

check_server() {
  local url=$1
  local name=$2
  if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name is running at $url"
    return 0
  else
    echo -e "${RED}✗${NC} $name is NOT running at $url"
    return 1
  fi
}

run_api_tests() {
  echo -e "\n${BLUE}━━━ Phase 1: API Curl Tests ━━━${NC}\n"

  if ! check_server "http://localhost:8787/api/health" "API Server"; then
    echo -e "${RED}Skipping API tests — server not running${NC}"
    echo -e "${YELLOW}Start with: pnpm --filter @barber/api dev${NC}"
    ((SKIP_COUNT++))
    return
  fi

  echo -e "${YELLOW}Running curl test suite...${NC}\n"

  if bash "$ROOT_DIR/docs/curl_tests.sh" 2>&1; then
    echo -e "\n${GREEN}✓ API curl tests completed${NC}"
    ((PASS_COUNT++))
  else
    echo -e "\n${RED}✗ API curl tests had failures${NC}"
    ((FAIL_COUNT++))
  fi
}

run_client_playwright() {
  echo -e "\n${BLUE}━━━ Phase 2: Client Playwright Tests ━━━${NC}\n"

  if ! check_server "http://localhost:5174" "Client Dev Server"; then
    echo -e "${RED}Skipping client Playwright tests — server not running${NC}"
    echo -e "${YELLOW}Start with: pnpm --filter @barber/client dev${NC}"
    ((SKIP_COUNT++))
    return
  fi

  echo -e "${YELLOW}Running client Playwright specs...${NC}\n"

  cd "$ROOT_DIR/apps/client"
  if npx playwright test 2>&1; then
    echo -e "\n${GREEN}✓ Client Playwright tests passed${NC}"
    ((PASS_COUNT++))
  else
    echo -e "\n${RED}✗ Client Playwright tests had failures${NC}"
    ((FAIL_COUNT++))
  fi
  cd "$ROOT_DIR"
}

run_admin_playwright() {
  echo -e "\n${BLUE}━━━ Phase 3: Admin Playwright Tests ━━━${NC}\n"

  if ! check_server "http://localhost:5175" "Admin Dev Server"; then
    echo -e "${RED}Skipping admin Playwright tests — server not running${NC}"
    echo -e "${YELLOW}Start with: pnpm --filter @barber/admin dev${NC}"
    ((SKIP_COUNT++))
    return
  fi

  echo -e "${YELLOW}Running admin Playwright specs...${NC}\n"

  cd "$ROOT_DIR/apps/admin"
  if npx playwright test 2>&1; then
    echo -e "\n${GREEN}✓ Admin Playwright tests passed${NC}"
    ((PASS_COUNT++))
  else
    echo -e "\n${RED}✗ Admin Playwright tests had failures${NC}"
    ((FAIL_COUNT++))
  fi
  cd "$ROOT_DIR"
}

summary() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Test Summary                                ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT"
  echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT"
  echo -e "  ${YELLOW}Skipped:${NC} $SKIP_COUNT"
  echo ""

  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "${RED}Some tests failed. Review the output above.${NC}"
    exit 1
  elif [ "$SKIP_COUNT" -gt 0 ] && [ "$PASS_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}All tests were skipped. Ensure servers are running.${NC}"
    exit 1
  else
    echo -e "${GREEN}All executed tests passed!${NC}"
  fi
}

# --- Main ---
header

case "$MODE" in
  api)
    run_api_tests
    ;;
  client)
    run_client_playwright
    ;;
  admin)
    run_admin_playwright
    ;;
  all)
    run_api_tests
    run_client_playwright
    run_admin_playwright
    ;;
  *)
    echo "Usage: bash scripts/run-tests.sh [api|client|admin|all]"
    exit 1
    ;;
esac

summary
