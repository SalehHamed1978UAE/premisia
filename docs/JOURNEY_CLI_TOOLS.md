# Journey CLI Admin Tools

Command-line tools for managing and inspecting journey data.

## Installation

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "journeys:cli": "tsx scripts/journey-cli.ts",
    "journeys:list": "tsx scripts/journey-cli.ts list"
  }
}
```

**Note:** For commands with arguments, run directly with tsx:
```bash
npx tsx scripts/journey-cli.ts summary <understandingId> <journeyType>
npx tsx scripts/journey-cli.ts sessions <understandingId>
npx tsx scripts/journey-cli.ts clear-summaries <understandingId>
```

Or if you add npm scripts, use `--` to pass arguments:
```bash
npm run journeys:summary -- <understandingId> <journeyType>
```

## Commands

### 1. List All Journeys

View all registered journeys with their configurations.

```bash
npm run journeys:list
```

**Output:**
```
📚 Registered Journeys

================================================================================

1. Business Model Innovation (business_model_innovation)
   Status: ✅ Available
   Duration: 30-35 minutes
   Frameworks: five_whys → bmc
   Summary Builder: fiveWhysBmc
   Readiness: 0 refs, 0 entities
   Dependencies: five_whys→bmc

2. Market Entry Strategy (market_entry)
   Status: ⏸️  Not Implemented
   Duration: 15-20 minutes
   Frameworks: pestle → porters → swot
   Summary Builder: pestlePorters
   Readiness: 3 refs, 5 entities

...

================================================================================
Total: 6 journeys (1 available)
```

**Use Cases:**
- Check journey availability before running
- Verify readiness thresholds
- See framework sequences
- Review dependencies

---

### 2. View Journey Summary

Display the summary for a specific understanding and journey type.

```bash
npx tsx scripts/journey-cli.ts summary <understandingId> <journeyType>
```

**Examples:**
```bash
# View BMI summary
npx tsx scripts/journey-cli.ts summary abc123def456 business_model_innovation

# View market entry summary
npx tsx scripts/journey-cli.ts summary abc123def456 market_entry
```

**Output:**
```
🔍 Fetching summary for understanding: abc123def456, journey: business_model_innovation

================================================================================
📊 Journey Summary: business_model_innovation
================================================================================

Version: 2
Completed: 2025-11-02T10:30:00.000Z

💡 Key Insights:

  1. Root Cause: High customer acquisition costs due to unclear value proposition
  2. Value Proposition: AI-powered efficiency gains for SMBs
  3. Target Customers: Small businesses with 10-50 employees

🎯 Strategic Implications:

  1. Business model redesign needed to address root causes
  2. Focus on validated customer segments and value propositions
  3. Address critical business model gaps identified

🧩 Frameworks:

  five_whys:
    {
      "rootCauses": [...],
      "whysPath": [...]
    }
  bmc:
    {
      "valuePropositions": [...],
      "customerSegments": [...]
    }

================================================================================
```

**Use Cases:**
- Review completed journey insights
- Export summary data for reporting
- Debug summary builder issues
- Verify baseline data for follow-on runs

---

### 3. List Sessions

View all journey sessions for a specific understanding.

```bash
npx tsx scripts/journey-cli.ts sessions <understandingId>
```

**Example:**
```bash
npx tsx scripts/journey-cli.ts sessions abc123def456
```

**Output:**
```
📋 Journey Sessions for understanding: abc123def456

================================================================================

1. Session 9f8e7d6c-5b4a-3c2d-1e0f-a1b2c3d4e5f6
   Journey Type: business_model_innovation
   Version: 1
   Status: completed
   Created: 2025-11-01T14:20:00.000Z
   Updated: 2025-11-01T14:50:00.000Z
   Has Summary: Yes ✅

2. Session 8e7d6c5b-4a3c-2d1e-0f9a-b1c2d3e4f5g6
   Journey Type: business_model_innovation
   Version: 2
   Status: completed
   Created: 2025-11-02T10:15:00.000Z
   Updated: 2025-11-02T10:45:00.000Z
   Has Summary: Yes ✅

================================================================================
Total: 2 sessions
```

**Use Cases:**
- Track journey execution history
- Identify missing summaries
- Verify version progression
- Debug session status issues

---

### 4. Clear Summaries (Dangerous)

Remove summary data from all sessions for an understanding.

```bash
npx tsx scripts/journey-cli.ts clear-summaries <understandingId>
```

**Example:**
```bash
npx tsx scripts/journey-cli.ts clear-summaries abc123def456
```

**Output:**
```
⚠️  WARNING: This will clear all summaries for understanding: abc123def456

This operation will:
  - Remove summary data from all journey sessions
  - Keep the session records (only clears summary field)
  - Cannot be undone

Proceeding with summary clearing...

✅ Cleared summaries from 2 sessions
```

**Use Cases:**
- Reset summaries for testing
- Clear corrupted summary data
- Rebuild summaries from scratch
- Clean up development data

**⚠️ Warning:** This operation cannot be undone. The session records remain intact, but the summary field is set to null. To regenerate summaries, you must re-run the journey.

---

## Common Workflows

### Workflow 1: Debug Missing Summary

**Problem:** Summary not showing up in UI

```bash
# 1. List all sessions to verify they exist
npx tsx scripts/journey-cli.ts sessions abc123def456

# 2. Check if summary exists for specific journey
npx tsx scripts/journey-cli.ts summary abc123def456 business_model_innovation

# 3. If no summary found, check journey registry
npm run journeys:list
```

---

### Workflow 2: Verify Follow-On Run Baseline

**Problem:** Need to confirm baseline summary for follow-on journey

```bash
# 1. View the latest summary (baseline)
npx tsx scripts/journey-cli.ts summary abc123def456 business_model_innovation

# 2. Verify version number matches expected baseline
# (Latest version should be loaded as baseline for next run)
```

---

### Workflow 3: Clean Test Data

**Problem:** Need to clean up test journey data

```bash
# 1. View current sessions
npx tsx scripts/journey-cli.ts sessions test-understanding-id

# 2. Clear summaries
npx tsx scripts/journey-cli.ts clear-summaries test-understanding-id

# 3. Verify summaries cleared
npx tsx scripts/journey-cli.ts sessions test-understanding-id
# Should show "Has Summary: No ❌"
```

---

## Advanced Usage

### Pipe Output for Processing

```bash
# Export journey list as text
npm run journeys:list > journeys-catalog.txt

# Extract session IDs
npm run journeys:sessions abc123 | grep "Session" | awk '{print $2}'

# Count completed sessions
npm run journeys:sessions abc123 | grep "Status: completed" | wc -l
```

### Integration with Scripts

```bash
#!/bin/bash

# Get all understandings with sessions
UNDERSTANDING_IDS=$(your-db-query-tool)

# Generate summary reports for all
for id in $UNDERSTANDING_IDS; do
  echo "Generating report for $id..."
  npm run journeys:summary $id business_model_innovation >> reports/$id-bmi.txt
done
```

---

## Troubleshooting

### Error: "No summary found"

**Possible causes:**
1. Journey session hasn't completed yet
2. Summary builder failed during execution
3. Feature flag `FEATURE_JOURNEY_REGISTRY_V2` is OFF
4. Wrong understanding ID or journey type

**Solutions:**
1. Check session status: `npm run journeys:sessions <id>`
2. Verify journey completed successfully
3. Enable feature flag and re-run journey
4. Double-check understanding ID and journey type

---

### Error: "Invalid journey type"

**Cause:** Journey type doesn't exist in registry

**Solution:** Run `npm run journeys:list` to see available journey types

---

### Error: "Database connection failed"

**Cause:** Database environment variables not set

**Solution:** Ensure `DATABASE_URL` is set in your environment:

```bash
export DATABASE_URL="postgresql://..."
npm run journeys:sessions abc123
```

---

## Security Considerations

### Production Access

⚠️ **Do not run clear-summaries on production data without backups**

Best practices:
1. Only use `clear-summaries` in development/test environments
2. Create database backups before clearing production summaries
3. Restrict CLI access to admin users only
4. Log all CLI operations for audit trail

### Data Privacy

Journey summaries may contain:
- User input data
- Strategic business information
- Proprietary analysis

**Recommendations:**
- Encrypt summary data at rest (already implemented)
- Limit CLI access via environment variables
- Do not log summary content to console in production
- Use secure channels when sharing CLI output

---

## Future Enhancements

Planned features for future versions:

1. **Interactive Mode**
   ```bash
   npm run journeys:cli
   ? Select command: summary
   ? Enter understanding ID: abc123
   ? Select journey type: business_model_innovation
   ```

2. **Rebuild Summaries**
   ```bash
   npm run journeys:rebuild <understandingId> <journeyType>
   # Re-execute summary builder without re-running journey
   ```

3. **Export Summaries**
   ```bash
   npm run journeys:export <understandingId> --format json
   # Export all summaries as JSON/CSV/PDF
   ```

4. **Validate Summaries**
   ```bash
   npm run journeys:validate-summaries
   # Check all summaries for data quality issues
   ```

---

## Related Documentation

- [Journey Registry Documentation](./JOURNEY_REGISTRY.md)
- [Journey Sync Script](./JOURNEY_SYNC_SCRIPT.md)
- [Journey Registry V2 Migration](./JOURNEY_REGISTRY_V2_MIGRATION.md)
- [Journey Registry V2 QA Checklist](./JOURNEY_REGISTRY_V2_QA.md)
