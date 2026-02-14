#!/bin/bash

# EPM Fast-Path Testing Script
# Usage: ./test-fast-path.sh <command>

set -e

BASE_URL="http://localhost:3001"
FIXTURE_NAME="fintech-baseline"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_header() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

function print_error() {
  echo -e "${RED}✗ $1${NC}"
}

function print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# List available fixtures
function list_fixtures() {
  print_header "Listing EPM Fixtures"

  curl -s "${BASE_URL}/api/epm/fixtures/list" | jq '.'

  print_success "Fixtures listed"
}

# Test baseline FinTech ($1.8M, 24mo)
function test_baseline() {
  print_header "Test 1: FinTech Baseline ($1.8M, 24 months)"

  curl -s -X POST "${BASE_URL}/api/epm/fixtures/load" \
    -H "Content-Type: application/json" \
    -d '{
      "fixtureName": "fintech-baseline",
      "overrideConstraints": {
        "budgetRange": { "min": 1500000, "max": 1800000 },
        "timelineRange": { "min": 18, "max": 24 }
      },
      "saveToDatabase": false
    }' | jq '.metadata, .epmProgram | {
      mode: .synthesisMode,
      fixture: .fixtureName,
      initiativeType: .initiativeType,
      totalFTEs: .resourcePlan.totalFTEs,
      totalBudget: (.financialPlan.totalBudget / 1000000 | tostring + "M"),
      totalMonths: .timeline.totalMonths
    }'

  print_success "Baseline test complete"
  print_info "Check console for invariant validation"
}

# Test tiny budget ($500K, 24mo) - infeasibility edge case
function test_tiny_budget() {
  print_header "Test 2: Tiny Budget ($500K, 24 months) - Infeasibility Test"

  curl -s -X POST "${BASE_URL}/api/epm/fixtures/load" \
    -H "Content-Type: application/json" \
    -d '{
      "fixtureName": "fintech-baseline",
      "overrideConstraints": {
        "budgetRange": { "min": 500000, "max": 500000 },
        "timelineRange": { "min": 24, "max": 24 }
      },
      "saveToDatabase": false
    }' | jq '.metadata, .epmProgram | {
      mode: .synthesisMode,
      fixture: .fixtureName,
      totalFTEs: .resourcePlan.totalFTEs,
      totalBudget: (.financialPlan.totalBudget / 1000000 | tostring + "M"),
      totalMonths: .timeline.totalMonths,
      warning: .resourcePlan.budgetConstrained
    }'

  print_success "Tiny budget test complete"
  print_info "Expected: Infeasibility flagged or error thrown"
}

# Test large budget ($10M, 24mo)
function test_large_budget() {
  print_header "Test 3: Large Budget ($10M, 24 months)"

  curl -s -X POST "${BASE_URL}/api/epm/fixtures/load" \
    -H "Content-Type: application/json" \
    -d '{
      "fixtureName": "fintech-baseline",
      "overrideConstraints": {
        "budgetRange": { "min": 10000000, "max": 10000000 },
        "timelineRange": { "min": 24, "max": 24 }
      },
      "saveToDatabase": false
    }' | jq '.metadata, .epmProgram | {
      mode: .synthesisMode,
      fixture: .fixtureName,
      totalFTEs: .resourcePlan.totalFTEs,
      totalBudget: (.financialPlan.totalBudget / 1000000 | tostring + "M"),
      totalMonths: .timeline.totalMonths
    }'

  print_success "Large budget test complete"
  print_info "Expected: maxAffordableFTEs ~40, no explosion"
}

# Run all tests sequentially
function test_all() {
  print_header "Running All Sprint 6B Tests"

  test_baseline
  echo ""
  test_tiny_budget
  echo ""
  test_large_budget

  print_success "All tests complete"
  echo ""
  print_info "Review console output for invariant checks:"
  echo "  ✅ Invariant 1 (FTE): X <= Y = true"
  echo "  ✅ Invariant 2 (Budget): \$X.XM <= \$Y.YM = true"
  echo "  ✅ Invariant 3 (Timeline): X = Y = true"
}

# Show usage
function usage() {
  echo "EPM Fast-Path Testing Script"
  echo ""
  echo "Usage: ./test-fast-path.sh <command>"
  echo ""
  echo "Commands:"
  echo "  list           List all available fixtures"
  echo "  baseline       Test FinTech baseline (\$1.8M, 24mo)"
  echo "  tiny           Test tiny budget (\$500K, 24mo) - infeasibility"
  echo "  large          Test large budget (\$10M, 24mo)"
  echo "  all            Run all tests sequentially"
  echo "  help           Show this help message"
  echo ""
  echo "Prerequisites:"
  echo "  1. Server running on localhost:3001"
  echo "  2. Fixture 'fintech-baseline' exists (see EPM-FAST-PATH-README.md)"
  echo ""
  echo "Example:"
  echo "  ./test-fast-path.sh all"
}

# Main command router
case "${1:-help}" in
  list)
    list_fixtures
    ;;
  baseline)
    test_baseline
    ;;
  tiny)
    test_tiny_budget
    ;;
  large)
    test_large_budget
    ;;
  all)
    test_all
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    print_error "Unknown command: $1"
    echo ""
    usage
    exit 1
    ;;
esac
