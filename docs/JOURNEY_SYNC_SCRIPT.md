# Journey Registry Sync Script

The journey registry sync script (`scripts/sync-journeys.ts`) validates the journey registry and generates helpful artifacts for developers.

## Installation

Add this script to your `package.json`:

```json
{
  "scripts": {
    "journeys:sync": "tsx scripts/sync-journeys.ts"
  }
}
```

## Usage

### Run the Sync Script

```bash
npm run journeys:sync
```

### What It Does

The sync script performs 4 key operations:

#### 1. **Validation**

Validates every journey in the registry to ensure:
- ✅ Journey type is valid (matches `JourneyType` enum)
- ✅ Has a name and description
- ✅ Has a frameworks array with at least one framework
- ✅ Has a summaryBuilder declared
- ✅ Summary builder exists in `journey-summary-service.ts`
- ✅ Has readiness thresholds configured
- ✅ Dependencies are properly structured

#### 2. **Summary Builder Coverage Check**

Ensures perfect alignment between:
- Journey definitions (which declare `summaryBuilder: 'fiveWhysBmc'`)
- Summary builder implementations (registered in `summaryBuilders` object)

Reports:
- ❌ Missing builders (journey declares builder that doesn't exist)
- ℹ️ Orphaned builders (builder exists but no journey uses it)

#### 3. **Documentation Generation**

Generates `docs/JOURNEY_REGISTRY.md` with:
- Complete journey catalog
- Framework sequences
- Readiness thresholds
- Dependencies
- Implementation status

#### 4. **Type Validation Generation**

Generates `server/journey/journey-registry.generated.ts` with:
- `REGISTERED_JOURNEY_TYPES` - Array of all journey types
- `RegisteredJourneyType` - Type-safe union
- `isRegisteredJourneyType()` - Type guard function

## Adding a New Journey

### Step 1: Add Journey Type

Edit `shared/journey-types.ts`:

```typescript
export type JourneyType =
  | 'market_entry'
  | 'business_model_innovation'
  // ... existing types ...
  | 'my_new_journey'; // Add your new type
```

### Step 2: Define the Journey

Edit `server/journey/journey-registry.ts`:

```typescript
export const JOURNEYS: Record<JourneyType, JourneyDefinition> = {
  // ... existing journeys ...
  
  my_new_journey: {
    type: 'my_new_journey', // MUST match the key
    name: 'My New Journey',
    description: 'What this journey does',
    frameworks: ['framework_a', 'framework_b'],
    estimatedDuration: '15-20 minutes',
    available: false, // Set to true when implemented
    summaryBuilder: 'frameworkAFrameworkB',
    defaultReadiness: {
      minReferences: 3,
      minEntities: 5,
    },
    insightsConfig: {},
    dependencies: [
      { from: 'framework_a', to: 'framework_b' }
    ],
  },
};
```

**Important:** The `type` field MUST match the object key (`my_new_journey`).

### Step 3: Implement Summary Builder

Edit `server/services/journey-summary-service.ts`:

```typescript
// 1. Create the builder function
function buildFrameworkAFrameworkBSummary(
  context: StrategicContext,
  sessionMeta: { versionNumber: number; completedAt: string }
): JourneySummary {
  // Extract insights from frameworks
  const frameworkAInsights = context.frameworks?.find(f => f.name === 'framework_a');
  const frameworkBInsights = context.frameworks?.find(f => f.name === 'framework_b');
  
  return {
    journeyType: 'my_new_journey',
    version: sessionMeta.versionNumber,
    completedAt: sessionMeta.completedAt,
    keyInsights: [
      // Extract key insights
    ],
    strategicImplications: [
      // Extract strategic implications
    ],
    frameworksUsed: ['framework_a', 'framework_b'],
    dataQuality: {
      completeness: calculateCompleteness(context),
      confidence: 'high',
    },
  };
}

// 2. Register the builder
export const summaryBuilders: Record<string, SummaryBuilder> = {
  // ... existing builders ...
  frameworkAFrameworkB: buildFrameworkAFrameworkBSummary,
};
```

### Step 4: Run Sync Script

```bash
npm run journeys:sync
```

The script will:
- ✅ Validate your new journey
- ✅ Check that the summary builder exists
- ✅ Regenerate documentation
- ✅ Update type definitions

### Step 5: Fix Any Errors

If validation fails, the script will show:
```
❌ Errors:

  [my_new_journey] Summary builder 'frameworkAFrameworkB' declared but not found in registry
```

Fix the errors and re-run `npm run journeys:sync` until you see:
```
✅ Journey registry sync completed successfully!
```

## Output Files

### Generated Documentation

**File:** `docs/JOURNEY_REGISTRY.md`
- Human-readable journey catalog
- Framework sequences
- Readiness thresholds
- Dependencies
- Implementation status

**Usage:** Reference documentation for developers and stakeholders

### Generated Types

**File:** `server/journey/journey-registry.generated.ts`
- Type-safe journey type validation
- Runtime type guards
- Complete list of registered journeys

**Usage:** Import in code for type safety:

```typescript
import { REGISTERED_JOURNEY_TYPES, isRegisteredJourneyType } from '../server/journey/journey-registry.generated';

// Check if a journey is registered
if (isRegisteredJourneyType(userInput)) {
  // TypeScript knows userInput is RegisteredJourneyType
}
```

## Validation Rules

The sync script enforces these rules:

### Required Fields

Every journey must have:
- ✅ `type` - Matches JourneyType enum
- ✅ `name` - Human-readable name
- ✅ `description` - What the journey does
- ✅ `frameworks` - At least one framework
- ✅ `estimatedDuration` - Time estimate
- ✅ `available` - Implementation status
- ✅ `summaryBuilder` - Builder name

### Summary Builder Alignment

- ✅ Every `summaryBuilder` declared must exist in `summaryBuilders` registry
- ⚠️ Orphaned builders (exist but unused) are reported as warnings

### Readiness Thresholds

- ✅ Must include both `minReferences` and `minEntities`
- ⚠️ Missing thresholds are warnings (system defaults used)

### Dependencies

- ✅ Must be an array of `{ from: FrameworkName, to: FrameworkName }`
- ℹ️ Empty dependencies array is valid (no dependencies)

## Troubleshooting

### Error: "Summary builder not found"

**Problem:** Journey declares `summaryBuilder: 'myBuilder'` but `summaryBuilders['myBuilder']` doesn't exist

**Solution:** Add the builder to `server/services/journey-summary-service.ts`:

```typescript
export const summaryBuilders: Record<string, SummaryBuilder> = {
  // ... existing ...
  myBuilder: buildMyBuilderSummary,
};
```

### Error: "Type mismatch"

**Problem:** `journey.type` doesn't match the registry key

Example: Registry key is `my_journey` but `journey.type = 'different_journey'`

**Solution:** Ensure consistency:

```typescript
export const JOURNEYS: Record<JourneyType, JourneyDefinition> = {
  my_journey: {
    type: 'my_journey', // ✅ MUST match the key
    // ...
  }
};
```

### Error: "Missing required fields"

**Problem:** Journey definition is incomplete

**Solution:** Ensure all required fields are present:
- `type`, `name`, `description`, `frameworks`, `estimatedDuration`, `available`, `summaryBuilder`

## Integration with CI/CD

Add to your CI pipeline to catch errors early:

```yaml
# .github/workflows/ci.yml
steps:
  - name: Validate Journey Registry
    run: npm run journeys:sync
```

The script exits with code 1 if validation fails, breaking the CI build.

## Best Practices

1. **Run After Every Journey Change**
   - Added a new journey? Run sync.
   - Modified a journey? Run sync.
   - Added a summary builder? Run sync.

2. **Commit Generated Files**
   - `docs/JOURNEY_REGISTRY.md` - Documentation
   - `server/journey/journey-registry.generated.ts` - Types
   - Keep these in version control for team visibility

3. **Review Generated Docs**
   - Check `JOURNEY_REGISTRY.md` for accuracy
   - Verify descriptions make sense
   - Ensure dependencies are correct

4. **Use Type Guards**
   - Import `isRegisteredJourneyType()` for runtime validation
   - Use `RegisteredJourneyType` for type-safe function parameters

## Example Output

```
🚀 Journey Registry Sync Tool

This tool validates the journey registry and generates artifacts.


🔍 Validating Journey Registry...

  ✓ [business_model_innovation] Summary builder 'fiveWhysBmc' registered
  ✓ [business_model_innovation] Readiness thresholds: refs=0, entities=0
  ✓ [business_model_innovation] Dependencies: [object Object]
  ✓ [market_entry] Summary builder 'pestlePorters' registered
  ✓ [market_entry] Readiness thresholds: refs=3, entities=5
  ...

📈 Statistics:

  Total Journeys: 6
  With Summary Builders: 6
  With Readiness Config: 6
  With Dependencies: 5

📊 Summary Builder Coverage:

  ✅ Perfect alignment - all journeys have summary builders

📄 Documentation generated: docs/JOURNEY_REGISTRY.md
📦 Type validation generated: server/journey/journey-registry.generated.ts

✅ Journey registry sync completed successfully!

📋 Next steps:

  1. Review generated documentation: docs/JOURNEY_REGISTRY.md
  2. Review generated types: server/journey/journey-registry.generated.ts
  3. Add new journeys to server/journey/journey-registry.ts
  4. Run `npm run journeys:sync` after changes
```
