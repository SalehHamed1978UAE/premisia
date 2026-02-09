# Journey Registry V2 Migration Guide

## Database Schema Migration

### Required Schema Change

The Journey Registry V2 system requires a `session_id` column in the `framework_insights` table to link framework analysis results to journey sessions.

### Migration Applied

The following SQL migration was applied to add the missing column:

```sql
-- Add session_id column to framework_insights
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'framework_insights' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE framework_insights ADD COLUMN session_id VARCHAR;
        ALTER TABLE framework_insights ADD CONSTRAINT framework_insights_session_id_fkey 
            FOREIGN KEY (session_id) REFERENCES journey_sessions(id) ON DELETE CASCADE;
        CREATE INDEX idx_framework_insights_session ON framework_insights(session_id);
    END IF;
END $$;
```

### Verification

```bash
# Verify column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'framework_insights' 
AND column_name = 'session_id';

# Expected output:
# column_name | data_type         | is_nullable
# session_id  | character varying | YES
```

## Test Suite

The complete Journey Registry V2 guardrail test suite is in `tests/journey-registry.smoke.spec.ts`.

### Test Coverage (18 tests, 100% passing)

1. **Config Helper Tests (4 tests)**
   - Verifies `isJourneyRegistryV2Enabled()` returns correct boolean based on env var

2. **Journey Orchestrator Integration (4 tests)**
   - Verifies baseline summary loading when flag ON/OFF
   - Verifies summary saving when journey completes with flag ON/OFF
   - **Critical:** Tests execute real `orchestrator.executeJourney()` code paths

3. **Readiness Endpoint HTTP Tests (4 tests)**
   - Verifies registry thresholds used when flag ON
   - Verifies legacy hardcoded thresholds when flag OFF

4. **Summary Endpoint HTTP Tests (3 tests)**
   - Verifies endpoint returns null when flag OFF
   - Verifies endpoint returns data when flag ON

5. **Config Endpoint HTTP Tests (3 tests)**
   - Verifies `/config/features` exposes correct flag state to client

### Running Tests

```bash
# Run all journey registry tests
npx vitest run tests/journey-registry.smoke.spec.ts

# Run with watch mode
npx vitest tests/journey-registry.smoke.spec.ts

# Run with UI
npx vitest --ui tests/journey-registry.smoke.spec.ts
```

### Test Results

```
✓ 18/18 tests passing (100%)
✓ Test duration: ~8-10 seconds
✓ Tests prove FEATURE_JOURNEY_REGISTRY_V2 flag properly gates all behavior
```

## Feature Flag Usage

### Server-Side

```typescript
import { isJourneyRegistryV2Enabled } from './config';

// Check flag in code
if (isJourneyRegistryV2Enabled()) {
  // New registry-based behavior
} else {
  // Legacy behavior
}
```

### Client-Side

```typescript
import { useFeatureFlags } from '@/hooks/use-feature-flags';

function MyComponent() {
  const { journeyRegistryV2 } = useFeatureFlags();
  
  if (journeyRegistryV2) {
    // Show new registry-driven UI
  } else {
    // Show legacy UI
  }
}
```

### Environment Configuration

Add to `.env` or environment variables:

```bash
# Enable Journey Registry V2 (default: false)
FEATURE_JOURNEY_REGISTRY_V2=true
```

## Manual QA Checklist

Before enabling in production, complete the manual QA checklist in `docs/JOURNEY_REGISTRY_V2_QA.md`.

## CI/CD Integration

Add to your CI pipeline:

```bash
# Run journey registry guardrail tests
npx vitest run tests/journey-registry.smoke.spec.ts
```

All 18 tests must pass before merging changes to the journey registry system.
