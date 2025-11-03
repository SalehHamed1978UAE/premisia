# Golden Records System

## Overview

The Golden Records system provides baseline snapshots of journey executions for regression testing and quality assurance. It allows teams to:

- **Capture** known-good journey outputs as versioned baselines
- **Compare** new journey runs against baselines to detect regressions
- **Promote** successful captures to become the current golden standard
- **Rollback** to previous versions if needed
- **Auto-capture** journey completions for continuous baseline tracking

## Table of Contents

1. [System Overview & Toggle Guide](#system-overview--toggle-guide)
2. [Concepts](#concepts)
3. [Admin UI Workflow](#admin-ui-workflow)
4. [CLI Capture Utility](#cli-capture-utility)
5. [CLI Compare Utility](#cli-compare-utility)
6. [Auto-Capture Feature](#auto-capture-feature)
7. [Promotion & Rollback](#promotion--rollback)
8. [Screenshot Storage](#screenshot-storage)
9. [Security & Sanitization](#security--sanitization)

---

## System Overview & Toggle Guide

This section provides a complete operational guide for understanding, configuring, and managing the Golden Records automation system.

### How It Works

The Golden Records system automatically captures baseline snapshots of journey executions for regression testing:

1. **Journey Completion Triggers Capture**
   - Every journey completion produces a sanitized snapshot containing:
     - Session metadata (journey type, version, timestamps)
     - Completed framework steps
     - EPM program generation status
   - Snapshots are captured in the background and never block the user flow

2. **Dual Storage Strategy**
   - **Database**: Records stored in `golden_records` table, checks in `golden_record_checks` table
   - **Filesystem**: JSON files saved to `scripts/output/golden-records/<journey_type>/v<version>_<timestamp>.json`
   - Both storage locations are kept synchronized with matching version numbers

3. **Current Baseline System**
   - One record per journey type is marked `is_current=true`
   - The compare CLI (`golden-record-compare.ts`) diffs latest runs against the current record
   - Only the promoted baseline is used for regression testing

4. **Non-Blocking Background Execution**
   - Auto-capture runs asynchronously using `setImmediate()`
   - Never blocks user workflows or journey completion
   - Errors are logged but don't affect the main application flow

### Control Flags

The Golden Records system uses feature flags and allowlists for fine-grained control:

#### AUTO_CAPTURE_GOLDEN Environment Variable

```bash
# Enable auto-capture (default: false)
export AUTO_CAPTURE_GOLDEN=true

# Disable auto-capture
export AUTO_CAPTURE_GOLDEN=false
# or simply unset it
```

**Behavior:**
- `false` (default): Auto-capture is disabled; only manual CLI captures work
- `true`: Every completed journey in the allowlist triggers automatic capture

#### Journey Allowlist

**Location:** `server/journey/journey-orchestrator.ts`

```typescript
// Current allowlist (BMI only)
const allowedJourneys: JourneyType[] = ['business_model_innovation'];

// To enable all journeys
const allowedJourneys: JourneyType[] = [
  'market_entry',
  'business_model_innovation',
  'competitive_strategy',
  'digital_transformation',
  'crisis_recovery',
  'growth_strategy'
];
```

**Control Options:**
- **Disable globally**: Set `AUTO_CAPTURE_GOLDEN=false` and restart server
- **Disable for specific journey**: Remove from allowlist array and restart
- **Enable specific journeys**: Add journey types to allowlist array

**Changes require server restart** to take effect.

### Running Manually

Manual CLI tools are available for on-demand capture and comparison operations.

#### Capture Command

```bash
# Capture by journey session ID
npx tsx scripts/golden-record-capture.ts --sessionId=<session_id> [--notes="Description"] [--promote]

# Capture by strategy version ID (alternative)
npx tsx scripts/golden-record-capture.ts --strategyVersionId=<version_id> [--notes="Description"] [--promote]
```

**Flags:**
- `--sessionId`: Journey session ID to capture (required if no strategyVersionId)
- `--strategyVersionId`: Strategy version ID alternative to sessionId
- `--notes`: Optional description for this baseline (e.g., "BMI v2.1 after fixes")
- `--promote`: Mark this capture as the current golden record (default: false)

**Exit Codes:**
- `0`: Success
- `1`: Error during capture

**Example:**
```bash
# Find the latest BMI session
# SELECT id FROM journey_sessions WHERE journey_type = 'business_model_innovation' ORDER BY completed_at DESC LIMIT 1;

npx tsx scripts/golden-record-capture.ts \
  --sessionId=abc-123-def \
  --notes="Baseline BMI after entity extraction fixes" \
  --promote
```

#### Compare Command

```bash
# Compare new run against current baseline
npx tsx scripts/golden-record-compare.ts --sessionId=<session_id> --journeyType=<journey_type>

# Using strategy version ID instead
npx tsx scripts/golden-record-compare.ts --strategyVersionId=<version_id> --journeyType=<journey_type>
```

**Flags:**
- `--sessionId`: Journey session ID to compare (required if no strategyVersionId)
- `--strategyVersionId`: Strategy version ID alternative to sessionId
- `--journeyType`: Journey type to compare against (required)

**Exit Codes:**
- `0`: Match - journey is consistent with golden record ✅
- `1`: Mismatch - journey differs from golden record ❌
- `2`: Error occurred during comparison ⚠️

**Example:**
```bash
npx tsx scripts/golden-record-compare.ts \
  --sessionId=xyz-789-ghi \
  --journeyType=business_model_innovation
```

The compare tool will output:
- Detailed diff summary (added/removed/modified steps)
- Step-by-step comparison results
- Check ID for audit trail in database

### Operational Checklist

Follow these steps to enable and maintain Golden Records in production:

#### 1. Promote a Verified Baseline (One-Time Setup)

Before enabling auto-capture, establish a known-good baseline:

```bash
# Step 1: Find the most recent successful BMI journey
SELECT id FROM journey_sessions
WHERE journey_type = 'business_model_innovation'
ORDER BY completed_at DESC NULLS LAST, created_at DESC
LIMIT 1;

# Step 2: Capture it as the canonical baseline
npx tsx scripts/golden-record-capture.ts \
  --sessionId=<session_id_from_query> \
  --notes="Baseline BMI after fixes" \
  --promote

# Step 3: Verify in admin UI
# Navigate to /admin/golden-records
# Confirm the entry appears as "current" for BMI
```

**Critical:** This baseline becomes your regression testing anchor. Choose a stable, fully-functional journey execution.

#### 2. Enable Auto-Capture for Continuous Tracking

```bash
# Step 1: Set environment variable
export AUTO_CAPTURE_GOLDEN=true

# Step 2: Expand allowlist (if needed)
# Edit server/journey/journey-orchestrator.ts
# Change: const allowedJourneys: JourneyType[] = ['business_model_innovation'];
# To: const allowedJourneys: JourneyType[] = [all journey types...];

# Step 3: Restart the server
# The workflow will auto-restart after code changes

# Step 4: Verify auto-capture is working
# Complete a test journey and check scripts/output/golden-records/
# New unpromoted records should appear automatically
```

**Note:** Auto-captured records are **never automatically promoted**. They must be manually reviewed and promoted via admin UI or CLI.

#### 3. Integrate Regression Testing into QA Workflow

Add golden record comparison to your quality assurance process:

```bash
# After any code change affecting journeys:

# Step 1: Complete a test journey execution
# Step 2: Run comparison against current baseline
npx tsx scripts/golden-record-compare.ts \
  --sessionId=<latest_session_id> \
  --journeyType=<journey_type>

# Step 3: Check exit code
echo $?  # Should be 0 for pass, 1 for differences

# Step 4: Investigate any failures
# - Review diff summary in console output
# - Check admin UI for detailed step comparison
# - Determine if differences are expected or bugs

# Step 5: Update baseline if changes are intentional
npx tsx scripts/golden-record-capture.ts \
  --sessionId=<new_session_id> \
  --notes="Updated baseline for feature X" \
  --promote
```

**QA Rule:** No release should ship without a passing golden record comparison (exit code 0) for affected journey types.

#### 4. Maintenance and Troubleshooting

**Pause Auto-Capture During Maintenance:**
```bash
# Disable temporarily
export AUTO_CAPTURE_GOLDEN=false
# Restart server

# Re-enable after maintenance
export AUTO_CAPTURE_GOLDEN=true
# Restart server
```

**Check Auto-Capture Status:**
```bash
# Verify environment variable
echo $AUTO_CAPTURE_GOLDEN

# Check server logs for auto-capture messages
# Look for: "[Golden Records] Auto-captured golden record v<X>"
# Or: "[Golden Records] Auto-capture disabled"
```

**Review Captured Records:**
```bash
# Database records
# SELECT * FROM golden_records ORDER BY created_at DESC LIMIT 10;

# Filesystem records
ls -lah scripts/output/golden-records/business_model_innovation/

# Compare database vs filesystem versions to ensure sync
```

**Common Issues:**
- **Auto-capture not working**: Check `AUTO_CAPTURE_GOLDEN=true` and journey is in allowlist
- **Version mismatch**: Filesystem and database versions should always align
- **Comparison failures**: Review diff output to determine if expected or regression
- **Missing current baseline**: Promote a baseline before running comparisons

---

## Concepts

### What is a Golden Record?

A **Golden Record** is a sanitized, versioned snapshot of a journey execution that serves as a baseline for regression testing. It includes:

- Journey type (e.g., `business_model_innovation`)
- Version number (auto-incremented)
- Steps with framework outputs
- Metadata (execution context, duration, etc.)
- Notes and creation timestamp

### Version Lineage

Golden Records maintain a parent-child relationship:

```
v1 (initial capture)
  └─ v2 (refinement)
      └─ v3 (current)
```

Only one version can be marked as `isCurrent=true` at a time.

### Version Synchronization

**Important:** Golden record versions are synchronized across both database and filesystem storage:
- Database records store the computed golden record version (v1, v2, v3...)
- Filesystem files are saved with matching version numbers in filenames (`v2_timestamp.json`)
- The capture process ensures version alignment by updating the sanitized data before persistence
- This prevents version mismatches and ensures consistent regression testing

### Data Sanitization

All golden records are automatically sanitized to remove:
- Authentication tokens and API keys
- Personally Identifiable Information (PII)
- Business-sensitive data (revenue, financials)
- Encrypted fields are preserved in encrypted form

See [Security & Sanitization](#security--sanitization) for details.

---

## Admin UI Workflow

### 1. Navigate to Golden Records

Access the admin panel at `/admin/golden-records` to:
- View all journey types and their current versions
- Browse version history
- View detailed step-by-step outputs
- Compare versions
- Promote or rollback versions

### 2. Manual Capture via Admin UI

1. Navigate to a completed journey session
2. Click **"Capture as Golden Record"**
3. Add notes describing this baseline (e.g., "BMI v2.1 with enhanced value propositions")
4. Choose whether to promote as current
5. Click **"Save Golden Record"**

The system will:
- Fetch journey session data
- Sanitize sensitive information
- Assign next version number
- Save to database
- Optionally promote to current

### 3. View Version History

On the Golden Records page:
- Select a journey type (e.g., `business_model_innovation`)
- View all versions with metadata
- Click a version to view detailed steps
- Compare versions side-by-side

### 4. Review Check Results

View comparison results from CLI or automated checks:
- Check ID and timestamp
- Pass/Fail status
- Diff summary (added/removed/modified steps)
- Step-by-step results

---

## CLI Capture Utility

### Purpose

Manually capture journey baselines from the command line, useful for:
- CI/CD integration
- Bulk capture operations
- Scripted baseline management

### Usage

```bash
# Basic capture (without promotion)
tsx scripts/golden-record-capture.ts --sessionId=abc123

# Capture and promote to current
tsx scripts/golden-record-capture.ts --sessionId=abc123 --promote

# Capture with notes
tsx scripts/golden-record-capture.ts \
  --sessionId=abc123 \
  --notes="BMI baseline after Five Whys improvements" \
  --promote

# Alternative: Capture by strategy version ID
tsx scripts/golden-record-capture.ts \
  --strategyVersionId=xyz789 \
  --notes="Competitive strategy baseline v1"
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--sessionId` | Yes* | Journey session ID to capture |
| `--strategyVersionId` | Yes* | Alternative to sessionId (uses latest journey session) |
| `--notes` | No | Description of this baseline |
| `--promote` | No | Promote to current version (default: false) |

*Either `--sessionId` or `--strategyVersionId` is required.

### Output

The utility will:
1. Fetch journey session data
2. Sanitize sensitive information
3. Determine next version number
4. Save to local file: `scripts/output/golden-records/<journeyType>/v<version>/<timestamp>.json`
5. Save to database
6. Optionally promote to current
7. Print summary with file paths

Example output:
```
🎯 Golden Record Capture Tool
================================================================================

📥 Fetching journey session data...
✓ Found journey: business_model_innovation (v1)
  Session ID: abc123-def456-ghi789
  Steps: 15

🧹 Sanitizing journey data...
✓ Data sanitized (removed PII and sensitive fields)

🔍 Determining version number...
✓ Found 2 existing records (current: v2)
✓ Next version: v3

💾 Saving golden record...
✓ Saved to file: scripts/output/golden-records/business_model_innovation/v3/2025-11-03T13:45:00.json
✓ Saved to database: golden-record-id-123

🎉 Golden record captured successfully!
  Journey Type: business_model_innovation
  Version: v3
  Status: current (promoted)
  ID: golden-record-id-123
```

### Authentication

The CLI requires admin authentication via the `ADMIN_TOKEN` environment variable:

```bash
export ADMIN_TOKEN=your_admin_token_here
tsx scripts/golden-record-capture.ts --sessionId=abc123
```

---

## CLI Compare Utility

### Purpose

Compare a journey execution against the current golden record to detect regressions. Used for:
- Regression testing in CI/CD
- Pre-deployment validation
- Quality assurance checks

### Usage

```bash
# Compare by session ID
tsx scripts/golden-record-compare.ts \
  --sessionId=abc123 \
  --journeyType=business_model_innovation

# Compare by strategy version ID
tsx scripts/golden-record-compare.ts \
  --strategyVersionId=xyz789 \
  --journeyType=competitive_strategy
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--sessionId` | Yes* | Journey session ID to compare |
| `--strategyVersionId` | Yes* | Alternative to sessionId |
| `--journeyType` | Yes | Journey type to compare against |

*Either `--sessionId` or `--strategyVersionId` is required.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Journey matches golden record (PASS) |
| 1 | Journey differs from golden record (FAIL) |
| 2 | Error occurred during comparison |

### Output

The utility will:
1. Fetch current journey data
2. Sanitize data
3. Fetch current golden record
4. Compare step-by-step
5. Generate diff summary
6. Log check result to database
7. Print detailed diff
8. Exit with appropriate code

Example output (PASS):
```
🔍 Golden Record Comparison Tool
================================================================================

📥 Fetching current journey data...
✓ Found journey: business_model_innovation (v1)
  Session ID: abc123-def456-ghi789
  Steps: 15

🧹 Sanitizing current journey data...
✓ Data sanitized

📚 Fetching current golden record...
✓ Found golden record: v3
  Created: 2025-11-03T13:45:00.000Z
  Created by: admin@example.com
  Notes: BMI baseline after Five Whys improvements

⚖️  Comparing journeys...

================================================================================
✅ MATCH: Journey matches golden record (15/15 steps identical)
================================================================================

💾 Logging check result...
✓ Check logged: check-id-123

📊 Comparison Summary:
  Golden Record: v3
  Current Journey: v1
  Result: ✅ PASS
  Check ID: check-id-123

💡 Next steps:
  ✓ Journey is consistent with golden record
  - View check history: /admin/golden-records/business_model_innovation
```

Example output (FAIL):
```
⚖️  Comparing journeys...

================================================================================
❌ MISMATCH: 3 differences detected (12/15 steps match)
================================================================================

🔄 Modified Steps:
  - value_proposition:
      • Value prop 1: "AI-powered" changed to "Machine learning-driven"
      • Value prop 3: Added new item "24/7 customer support"

➕ Added Steps:
  - revenue_streams

➖ Removed Steps:
  - (none)

💡 Next steps:
  - Review the differences above
  - If expected, capture as new golden record:
    tsx scripts/golden-record-capture.ts --sessionId=abc123 --promote
  - View check history: /admin/golden-records/business_model_innovation
```

### CI/CD Integration

Use the compare utility in CI/CD pipelines:

```bash
#!/bin/bash
# regression-test.sh

# Run journey and capture session ID
SESSION_ID=$(npm run journey:run -- --type=business_model_innovation --userId=test-user | grep "Session ID" | cut -d: -f2)

# Compare against golden record
tsx scripts/golden-record-compare.ts \
  --sessionId="$SESSION_ID" \
  --journeyType=business_model_innovation

# Exit code is propagated (0 = pass, 1 = fail)
```

---

## Auto-Capture Feature

### Purpose

Automatically capture golden records when journeys complete, useful for:
- Continuous baseline tracking
- Regression detection across commits
- Historical analysis and trends

### Configuration

Enable auto-capture via environment variable:

```bash
# In .env file
AUTO_CAPTURE_GOLDEN=true
```

Or disable (default):
```bash
AUTO_CAPTURE_GOLDEN=false
```

### Journey Allowlist

Auto-capture is currently enabled for:
- `business_model_innovation` (BMI)

To enable for additional journey types, update the allowlist in:
`server/journey/journey-orchestrator.ts` → `autoCaptureGoldenRecord()` method

```typescript
// Journey allowlist
const allowedJourneys: JourneyType[] = [
  'business_model_innovation',
  'competitive_strategy', // Add here
];
```

### Behavior

When enabled, the system will:
1. Detect journey completion (status = 'completed')
2. Check if journey type is in allowlist
3. Fetch journey session data
4. Sanitize data
5. Determine next version number
6. Save to local file and database
7. **Do NOT auto-promote** (requires manual review)
8. Log capture event

Example log output:
```
[Golden Records] 🔄 Auto-capturing golden record for journey: business_model_innovation
[Golden Records] ✅ Auto-captured golden record v4: golden-record-id-456
[Golden Records] Journey: business_model_innovation, Session: abc123-def456-ghi789
```

### Non-Blocking Execution

Auto-capture runs asynchronously using `setImmediate()` to avoid blocking the main journey flow. If capture fails:
- Journey completion is **not affected**
- Error is logged but not thrown
- User sees successful journey completion

### Reviewing Auto-Captured Records

Auto-captured records are marked with:
- `createdBy: "system"`
- `isCurrent: false`
- `notes: "Auto-captured on <timestamp>"`

Review and promote via Admin UI:
1. Navigate to `/admin/golden-records`
2. Select journey type
3. Find system-captured version
4. Review step details
5. Click **"Promote to Current"** if acceptable

---

## Promotion & Rollback

### Promoting a Version

**Via Admin UI:**
1. Navigate to `/admin/golden-records/<journeyType>`
2. Select version to promote
3. Click **"Promote to Current"**
4. Confirm action

**Via API:**
```bash
curl -X POST http://localhost:5000/api/admin/golden-records/<id>/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Via CLI (during capture):**
```bash
tsx scripts/golden-record-capture.ts --sessionId=abc123 --promote
```

### Rolling Back

Rolling back means promoting a previous version:

**Via Admin UI:**
1. Navigate to version history
2. Select previous version (e.g., v2)
3. Click **"Promote to Current"**
4. Previous version becomes current

**Via API:**
```bash
# Promote version ID abc-123 (which is v2)
curl -X POST http://localhost:5000/api/admin/golden-records/abc-123/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Version Lineage After Promotion

When promoting v2 over v3:
- v3: `isCurrent=false` (demoted)
- v2: `isCurrent=true` (promoted)
- v1: `isCurrent=false` (unchanged)

New captures after rollback:
- v2 (current) → v4 (new capture, child of v2)

---

## Screenshot Storage

### Convention

Screenshots are stored alongside golden record JSON files:

```
scripts/output/golden-records/
└── business_model_innovation/
    └── v3/
        ├── 2025-11-03T13:45:00.json    # Golden record data
        ├── step1-value-proposition.png
        ├── step2-customer-segments.png
        └── step3-channels.png
```

### Naming Convention

Screenshot filenames should follow this pattern:
```
<step>-<framework-or-section-name>.png
```

Examples:
- `step1-value-proposition.png`
- `step2-customer-segments.png`
- `step15-summary.png`

### Capturing Screenshots

Screenshots can be captured via:

**Manual:**
1. Navigate to journey session
2. Take screenshots of each step
3. Save to `scripts/output/golden-records/<journeyType>/v<version>/`

**Automated (Future Enhancement):**
```bash
# Planned feature
npm run capture:golden -- --sessionId=abc123 --screenshots
```

This would use Puppeteer to automatically capture screenshots during journey replay.

### Comparison with Screenshots

When comparing journeys, developers can:
1. Run `npm run compare:golden`
2. If diff detected, review screenshots manually
3. Compare side-by-side to identify visual regressions

---

## Security & Sanitization

### What Gets Sanitized?

All golden records are automatically sanitized before storage to remove:

**Authentication & Secrets:**
- API keys (`OPENAI_API_KEY`, etc.)
- Auth tokens (`Bearer ...`)
- Session IDs
- JWT tokens

**PII (Personally Identifiable Information):**
- Email addresses
- Phone numbers
- Names
- Addresses

**Business-Sensitive Data:**
- Revenue figures
- Financial projections
- Pricing details
- Customer lists

### Sanitization Process

Sanitization happens via `server/utils/golden-record-sanitizer.ts`:

1. **Token Removal:** Scrubs `REDACTED_*` placeholders for API keys
2. **PII Masking:** Replaces sensitive strings with generic values
3. **Field Filtering:** Removes specific sensitive fields
4. **Encryption Preservation:** Keeps KMS-encrypted data encrypted

### Encrypted Fields

The following fields remain encrypted in golden records:
- `accumulatedContext` (journey context with user inputs)
- `insights` (framework-specific insights)

These are encrypted via KMS and can only be decrypted by authorized services.

### Viewing Sanitized Data

Sanitized data can be viewed:
- In golden record JSON files (`scripts/output/golden-records/`)
- Via Admin UI (displays sanitized version)
- Via CLI tools (always work with sanitized data)

---

## Troubleshooting

### CLI Commands Not Found

If `npm run capture:golden` or `npm run compare:golden` don't work:

**Solution:** Run scripts directly with `tsx`:
```bash
tsx scripts/golden-record-capture.ts --sessionId=abc123
tsx scripts/golden-record-compare.ts --sessionId=abc123 --journeyType=business_model_innovation
```

### Authentication Errors

If you see `401 Unauthorized` errors:

**Solution:** Set the `ADMIN_TOKEN` environment variable:
```bash
export ADMIN_TOKEN=your_admin_token_here
```

Get the token from `.env` or generate via admin panel.

### Journey Not Found

If you see `Journey session not found`:

**Solution:** Verify the session ID:
```bash
# List recent journey sessions
curl http://localhost:5000/api/journey-sessions \
  -H "Authorization: Bearer $TOKEN"
```

### No Golden Record Found

If you see `No current golden record found`:

**Solution:** Create an initial golden record:
```bash
tsx scripts/golden-record-capture.ts --sessionId=abc123 --promote
```

### Auto-Capture Not Working

If journeys complete but no auto-capture happens:

**Solution:** Check:
1. `AUTO_CAPTURE_GOLDEN=true` in `.env`
2. Journey type is in allowlist (see [Auto-Capture Feature](#auto-capture-feature))
3. Check server logs for capture errors

---

## Best Practices

### 1. Capture After Significant Changes

Capture new golden records when:
- Framework logic is updated
- Journey flows are modified
- AI prompt engineering improves outputs

### 2. Always Add Notes

Describe what makes this baseline special:
```bash
--notes="BMI v2.1: Enhanced value propositions with customer jobs-to-be-done"
```

### 3. Review Before Promotion

Never auto-promote without review:
1. Capture without `--promote`
2. Review step details in Admin UI
3. Manually promote when satisfied

### 4. Use Compare in CI/CD

Add regression checks to CI pipelines:
```yaml
# .github/workflows/test.yml
- name: Regression Test
  run: |
    tsx scripts/golden-record-compare.ts \
      --sessionId=$SESSION_ID \
      --journeyType=business_model_innovation
```

### 5. Version Control Golden Records

Commit golden record JSON files to git:
```bash
git add scripts/output/golden-records/
git commit -m "chore: update BMI golden record to v4"
```

---

## API Reference

### Endpoints

All endpoints require admin authentication (`Authorization: Bearer $ADMIN_TOKEN`).

#### List Golden Records
```
GET /api/admin/golden-records/:journeyType
```

Returns all versions for a journey type.

#### Get Golden Record
```
GET /api/admin/golden-records/:journeyType/:version
```

Returns specific version details.

#### Create Golden Record
```
POST /api/admin/golden-records
Body: {
  sessionId: string,
  notes?: string,
  promote?: boolean
}
```

Creates a new golden record from a journey session.

#### Promote Golden Record
```
POST /api/admin/golden-records/:id/promote
```

Promotes a version to current.

#### Compare Journey
```
POST /api/admin/golden-records/:journeyType/:version/compare
Body: {
  sessionId: string
}
```

Compares a journey session against a golden record version.

#### List Checks
```
GET /api/admin/golden-records/:journeyType/checks
```

Returns comparison check history.

---

## See Also

- [Journey Registry Documentation](./JOURNEY_REGISTRY.md)
- [EPM Generation Guide](./EPM_GENERATION.md)
- [Admin Panel Guide](./ADMIN_PANEL.md)
- [Security & Encryption](./SECURITY.md)
