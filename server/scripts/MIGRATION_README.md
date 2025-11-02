# KMS Encryption Migration Script

## Overview

This script migrates all existing encrypted data from single-key AES-256-GCM encryption to AWS KMS envelope encryption for enhanced security and key management.

## Prerequisites

Before running this migration:

1. **KMS Setup Required**: Ensure these environment variables are set:
   - `AWS_REGION` - Your AWS region
   - `AWS_ACCESS_KEY_ID` - AWS access key
   - `AWS_SECRET_ACCESS_KEY` - AWS secret key
   - `PREMISIA_KMS_KEY_ID` - Your KMS key ID
   - `ENCRYPTION_KEY` - Legacy encryption key (for decrypting old data)

2. **Database Backup**: Although the script is designed to be safe, consider backing up your database before running the migration.

## Usage

### Dry-Run (Recommended First Step)

Preview what will be migrated without making any changes:

```bash
tsx server/scripts/migrate-to-kms-encryption.ts --dry-run
```

### Run Migration

Execute the actual migration:

```bash
tsx server/scripts/migrate-to-kms-encryption.ts
```

### Alternative: Add to package.json

If you want to add this as an npm script, manually add to package.json:

```json
"scripts": {
  "migrate:kms": "tsx server/scripts/migrate-to-kms-encryption.ts"
}
```

Then run:
```bash
npm run migrate:kms           # Run migration
npm run migrate:kms --dry-run # Preview migration
```

## What Gets Migrated

The script migrates encrypted fields across 7 tables:

### 1. strategic_understanding
- userInput (text)
- companyContext (JSON)
- initiativeDescription (text)

### 2. journey_sessions
- accumulatedContext (JSON)

### 3. strategic_entities
- claim (text)
- source (text)
- evidence (text)
- category (text)
- subcategory (text)
- metadata (JSON)

### 4. strategic_relationships
- evidence (text)
- metadata (JSON)

### 5. epm_programs (14 fields)
- programName (text)
- executiveSummary (text)
- workstreams (JSON)
- timeline (JSON)
- resourcePlan (JSON)
- financialPlan (JSON)
- benefitsRealization (JSON)
- riskRegister (JSON)
- stakeholderMap (JSON)
- governance (JSON)
- qaPlan (JSON)
- procurement (JSON)
- exitStrategy (JSON)
- kpis (JSON)

### 6. strategy_versions
- analysisData (JSON)
- decisionsData (JSON)

### 7. strategic_decisions
- decisionsData (JSON)

## How It Works

1. **Format Detection**: Automatically detects old format (`iv:authTag:ciphertext`) vs new KMS format (JSON)
2. **Batch Processing**: Processes 10 records at a time to avoid memory issues
3. **Idempotent**: Can be run multiple times safely - skips already-migrated records
4. **Error Handling**: Continues on error, logs failures to `migration-errors.log`
5. **Progress Tracking**: Shows real-time progress for each table
6. **Verification**: After migration, verifies random samples decrypt correctly

## Output

The script provides detailed output:

```
🔐 KMS Encryption Migration Script
=====================================

🔍 Validating KMS setup...
✅ KMS encryption validated successfully

📋 Migrating strategic_understanding...
  Total records: 150
  Progress: 10/150 records (5 migrated, 5 skipped)
  Progress: 20/150 records (12 migrated, 8 skipped)
  ...
  ✅ Completed: 75 migrated, 75 skipped

[... other tables ...]

🔍 Verifying migration...
  ✅ strategic_understanding.userInput (abc123) - Successfully decrypted with KMS
  ...

=====================================
📊 Migration Summary
=====================================
Total records processed: 1500
Successfully migrated: 850
Skipped (already migrated): 650
Errors: 0
Duration: 45.32s

✅ Migration completed successfully!
```

## Error Handling

If errors occur during migration:

1. **Errors are logged** to `migration-errors.log` with timestamp and details
2. **Migration continues** for other records (doesn't abort)
3. **Summary shows** total error count
4. **First 10 errors** are displayed in console output

Example error log format:
```
[2025-11-02T12:34:56.789Z] Table: strategic_understanding, ID: abc-123, Error: Failed to decrypt data
```

## Safety Features

✅ **Idempotent**: Running multiple times won't corrupt data  
✅ **Format Detection**: Automatically detects and skips already-migrated records  
✅ **Dry-Run Mode**: Preview changes before applying  
✅ **Error Isolation**: One failed record doesn't stop the entire migration  
✅ **Verification**: Post-migration sampling ensures data integrity  
✅ **Backward Compatible**: KMS decryption functions can still read old format

## Rollback

If you need to rollback:

1. The old encryption methods are still available in `server/utils/encryption.ts`
2. The KMS decryption functions have backward compatibility built-in
3. For full rollback, restore from your database backup

## Troubleshooting

### "AWS credentials not configured"
- Ensure all AWS environment variables are set correctly
- Verify KMS key ID is correct

### "KMS validation failed"
- Check that your KMS key exists and you have permissions
- Verify AWS credentials are valid

### "Decryption failed"
- Some records might be unencrypted or corrupted
- Check `migration-errors.log` for details
- These records are skipped, not blocking migration

### High error rate
- If many errors occur, stop and investigate
- Check that `ENCRYPTION_KEY` environment variable is correct
- Verify database connection is stable

## Performance

- **Batch Size**: 10 records per batch (configurable in script)
- **Expected Speed**: ~30-50 records/second (varies by field count)
- **Large Datasets**: For databases with 100k+ records, consider running during off-hours

## Post-Migration

After successful migration:

1. **Verify Application**: Test that encrypted data reads correctly
2. **Monitor Logs**: Watch for any decryption errors in production
3. **Keep Logs**: Retain `migration-errors.log` for audit trail
4. **Update Documentation**: Note migration date and any issues encountered

## Support

If you encounter issues:

1. Check `migration-errors.log` for specific error details
2. Run with `--dry-run` to preview without changes
3. Verify all environment variables are set correctly
4. Ensure KMS key has proper permissions
