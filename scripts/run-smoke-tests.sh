#!/bin/bash

echo "=== Premisia Journey Smoke Tests ==="
echo "Date: $(date)"
echo ""

# Set test environment
export TEST_API_URL="${TEST_API_URL:-http://localhost:5000}"
export NODE_ENV=test

# Check if server is running
echo "Checking if server is running at $TEST_API_URL..."
if ! curl -s "$TEST_API_URL/api/health" > /dev/null 2>&1; then
  echo "⚠ Warning: Server may not be running at $TEST_API_URL"
  echo "  Some tests may fail. Start the server with 'npm run dev' first."
  echo ""
fi

# Run smoke tests
echo "Running smoke tests..."
echo ""

npx vitest run tests/smoke/ --reporter=verbose

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All smoke tests passed!"
else
  echo "❌ Smoke tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
