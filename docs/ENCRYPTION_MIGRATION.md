# Legacy Data Encryption Migration

## Overview

This document explains how to encrypt existing plaintext data in the production database that was created before the encryption system was implemented.

## Background

Prior to November 2025, the encryption system had a critical bug where `analysisData` and `decisionsData` fields in the `strategy_versions` table were **not being encrypted** on create/update operations. This resulted in sensitive business data (customer segments, revenue models, cost structures, BMC research, strategic decisions, etc.) being stored in plaintext.

**Root Cause:** The `storage.ts` methods `createStrategyVersion` and `updateStrategyVersion` were only encrypting `inputSummary`, but passing `analysisData` and `decisionsData` through without encryption.

**What's Fixed (November 2025):**
- ✅ `storage.ts` now properly encrypts `analysisData` and `decisionsData` on create/update
- ✅ All NEW records will be encrypted automatically
- ❌ **LEGACY records still contain plaintext data and need migration**

## Fields Affected

### `strategy_versions` table:
- `analysis_data` - Contains BMC research, Five Whys analysis, and other strategic insights
- `decisions_data` - Contains strategic decisions data

**Note:** `input_summary` was already being encrypted correctly ✅

## Migration Script

### Location
```
server/scripts/encrypt-legacy-data.ts
```

### Prerequisites

1. **AWS KMS Access**: Ensure the `ENCRYPTION_KEY` secret is set
2. **Database Access**: Ensure the `DATABASE_URL` secret is set  
3. **Production Environment**: Connect to production database

### Running the Migration

#### 1. Dry Run (Recommended First)

Run this to see what would be encrypted WITHOUT making any changes:

```bash
tsx server/scripts/encrypt-legacy-data.ts --dry-run
```

This will:
- ✅ Check all `strategy_versions` records
- ✅ Identify which ones contain plaintext data
- ✅ Show you exactly what would be encrypted
- ❌ **Not make any changes to the database**

#### 2. Live Migration

Once you've reviewed the dry run output and are ready to encrypt:

```bash
tsx server/scripts/encrypt-legacy-data.ts
```

This will:
- ✅ Encrypt all plaintext `analysisData` and `decisionsData` fields
- ✅ Update records in batches of 50 (configurable)
- ✅ Provide progress updates and statistics
- ✅ Handle errors gracefully and continue processing

#### 3. Custom Batch Size

To process more/fewer records at once:

```bash
tsx server/scripts/encrypt-legacy-data.ts --batch-size=100
```

## What the Script Does

### Detection Logic

The script uses **deterministic envelope detection** to identify plaintext data:

1. **Parse the JSON data** - Convert string to object if needed
2. **Check for encrypted envelope structure** - Encrypted data MUST have all fields:
   - `dataKeyCiphertext` - Encrypted data encryption key
   - `iv` - Initialization vector
   - `ciphertext` - Encrypted payload
   - `authTag` - Authentication tag
3. **Classify as plaintext** - If ANY of these fields are missing, the data is plaintext

This approach ensures **100% coverage** - no plaintext data can slip through, regardless of content.

### Encryption Process

For each record with plaintext data:
1. Encrypts the field using AWS KMS envelope encryption (`encryptJSONKMS`)
2. Updates the database record with encrypted data
3. Logs progress and any errors

### Error Handling

- ✅ Continues processing if a single record fails
- ✅ Tracks failed records for review
- ✅ Provides detailed error logs
- ✅ Exit code 1 if any failures occurred

## Example Output

```
╔════════════════════════════════════════════════════════╗
║   Encrypt Legacy Data Migration Script                ║
╚════════════════════════════════════════════════════════╝

Mode: ⚡ LIVE (data will be encrypted)
Batch size: 50 records

🔍 Checking strategy_versions for plaintext data...

Found 87 records with analysis or decisions data

[1/87] ID: 307fb9f3...
  ⚠️  analysisData contains plaintext
  ✅ Encrypted analysisData
  ✅ Record updated successfully

[2/87] ID: eda3c7de...
  ⚠️  analysisData contains plaintext
  ✅ Encrypted analysisData
  ✅ Record updated successfully

...

╔════════════════════════════════════════════════════════╗
║   Migration Complete                                   ║
╚════════════════════════════════════════════════════════╝

📊 Statistics:
   Total records checked: 87
   Records encrypted:     12
   Records skipped:       75 (already encrypted)
   Records failed:        0
   Duration:              3.45s

✅ All plaintext data has been encrypted successfully!
```

## Production Migration via API Endpoint

For deployed Replit applications, use the secure admin endpoint instead of the CLI:

### Step 1: Set Migration Passphrase

In your **production deployment** (Replit Secrets):
```
ENCRYPTION_MIGRATION_PASSPHRASE=<choose-a-strong-random-passphrase>
```

Keep this passphrase secure - you'll need it to run the migration.

### Step 2: Deploy Your Application

Deploy the updated code with encryption fixes.

### Step 3: Dry Run via API

```bash
curl -X POST https://your-app.replit.app/api/admin/encrypt-legacy-data \
  -H "Content-Type: application/json" \
  -d '{
    "passphrase": "YOUR_PASSPHRASE_HERE",
    "dryRun": true
  }'
```

**Example Response:**
```json
{
  "success": true,
  "dryRun": true,
  "stats": {
    "totalRecords": 17,
    "recordsEncrypted": 17,
    "recordsSkipped": 0,
    "recordsFailed": 0,
    "durationMs": 305
  },
  "message": "Dry run completed. No data was modified."
}
```

### Step 4: Run Live Migration

```bash
curl -X POST https://your-app.replit.app/api/admin/encrypt-legacy-data \
  -H "Content-Type: application/json" \
  -d '{
    "passphrase": "YOUR_PASSPHRASE_HERE",
    "dryRun": false
  }'
```

### Step 5: Verify Encryption Complete

Run dry run again - all records should be skipped (already encrypted):

```bash
curl -X POST https://your-app.replit.app/api/admin/encrypt-legacy-data \
  -H "Content-Type: application/json" \
  -d '{
    "passphrase": "YOUR_PASSPHRASE_HERE",
    "dryRun": true
  }'
```

**Expected:** `recordsEncrypted: 0`, `recordsSkipped: <total>`

### Security Notes

- Requires Admin role authentication
- Passphrase validation prevents accidental execution
- All attempts are logged with user ID and timestamp
- Invalid passphrase attempts are logged

## Verification

After running the migration, verify the encryption worked:

```sql
-- Check for any remaining plaintext data
SELECT 
  id,
  LEFT(analysis_data::text, 100) as analysis_preview,
  CASE 
    WHEN analysis_data::text LIKE '%primary_customer_segment%' THEN 'PLAINTEXT'
    WHEN analysis_data::text ~ 'dataKeyCiphertext' THEN 'ENCRYPTED'
    ELSE 'OTHER'
  END as encryption_status
FROM strategy_versions
WHERE analysis_data IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

All records should show `ENCRYPTED` or `OTHER` (empty/null). **No records should show `PLAINTEXT`.**

## Rollback

If something goes wrong:

1. **Stop the migration immediately** (Ctrl+C)
2. **Do NOT run the script again**
3. Contact the development team for assistance
4. Replit's automatic checkpoints allow database rollback if needed

## Production Deployment Checklist

Before deploying to production:

- [ ] Verify development database encryption works correctly
- [ ] Run dry-run migration in development
- [ ] Run live migration in development
- [ ] Verify all data is encrypted in development
- [ ] Enable `pg_trgm` extension in production database
- [ ] Run dry-run migration in production
- [ ] Review dry-run output
- [ ] Run live migration in production
- [ ] Verify all data is encrypted in production
- [ ] Redeploy application with fixed encryption code

## Technical Details

### Encryption Method

The script uses AWS KMS envelope encryption:
- **Data Encryption Key (DEK)**: Generated per-record for optimal security
- **Key Encryption Key (KEK)**: AWS KMS master key
- **Algorithm**: AES-256-GCM
- **Storage Format**: `{ dataKeyCiphertext, iv, ciphertext, authTag }`

### Performance

- **Batch processing**: Pauses every 50 records (configurable)
- **Estimated time**: ~3-5 seconds per 100 records
- **Database impact**: Minimal (batched updates with pauses)

## Support

If you encounter issues:
1. Check the script output for specific error messages
2. Verify AWS KMS access with the `ENCRYPTION_KEY` secret
3. Verify database access with the `DATABASE_URL` secret
4. Contact the development team with the error logs
