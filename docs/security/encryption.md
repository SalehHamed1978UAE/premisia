# KMS Envelope Encryption Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Encrypted Fields by Table](#encrypted-fields-by-table)
4. [Key Management](#key-management)
5. [Migration Process](#migration-process)
6. [Security Guarantees](#security-guarantees)
7. [Operational Procedures](#operational-procedures)
8. [Testing & Verification](#testing--verification)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Envelope Encryption?

Envelope encryption is a practice of encrypting plaintext data with a **data key**, and then encrypting the data key with a **master key**. This approach provides several security benefits:

- **Performance**: Encrypting large data with a data key is faster than using a master key directly
- **Key Rotation**: Master keys can be rotated without re-encrypting all data
- **Access Control**: Only those with KMS permissions can decrypt the data keys
- **Audit Trail**: All key operations are logged in AWS CloudTrail

### Why AWS KMS?

We use AWS Key Management Service (KMS) to implement a **zero-knowledge architecture** where:

1. **Database administrators cannot read encrypted data** without KMS permissions
2. **Backup files remain encrypted** and useless without the KMS key
3. **Per-record unique encryption** prevents pattern analysis
4. **Centralized key management** with automatic rotation and audit logging
5. **Compliance-ready** for SOC 2, HIPAA, GDPR requirements

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENCRYPTION PROCESS                           │
└─────────────────────────────────────────────────────────────────┘

1. Plaintext Data (e.g., "Secret strategic plan")
         │
         ▼
2. Call AWS KMS → Generate random 32-byte AES-256 data key
         │
         ├─→ Plaintext Data Key (256 bits)
         └─→ Encrypted Data Key (ciphertext blob)
         │
         ▼
3. Encrypt plaintext with data key using AES-256-GCM
         │
         ├─→ Initialization Vector (IV): 16 bytes
         ├─→ Ciphertext: Encrypted data
         └─→ Authentication Tag: 16 bytes (integrity check)
         │
         ▼
4. Store in database as JSON:
   {
     "dataKeyCiphertext": "base64-encoded-encrypted-key",
     "iv": "base64-encoded-iv",
     "authTag": "base64-encoded-auth-tag",
     "ciphertext": "base64-encoded-encrypted-data"
   }

5. Securely erase plaintext data key from memory
```

**Decryption Flow:**

```
1. Read encrypted JSON from database
         │
         ▼
2. Call AWS KMS → Decrypt the data key ciphertext
         │
         └─→ Plaintext Data Key (256 bits)
         │
         ▼
3. Use data key + IV + authTag to decrypt ciphertext
         │
         └─→ Verify authentication tag (integrity check)
         │
         ▼
4. Return plaintext data to application
         │
         ▼
5. Securely erase plaintext data key from memory
```

---

## Architecture

### Components

1. **KMS Client** (`server/utils/kms-encryption.ts`)
   - Manages AWS KMS API calls
   - Generates data keys
   - Decrypts data keys

2. **Encryption Utilities** (`server/utils/kms-encryption.ts`)
   - `encryptKMS()`: Encrypt text strings
   - `decryptKMS()`: Decrypt text strings
   - `encryptJSONKMS()`: Encrypt JSON objects
   - `decryptJSONKMS()`: Decrypt JSON objects

3. **Secure Data Service** (`server/services/secure-data-service.ts`)
   - Provides high-level CRUD operations
   - Automatically encrypts on save
   - Automatically decrypts on retrieval
   - Handles all 7 encrypted tables

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes) - randomly generated per encryption
- **Authentication Tag Size**: 128 bits (16 bytes) - ensures integrity

### Why AES-256-GCM?

- **AES-256**: Industry standard, NIST-approved, highly secure
- **GCM Mode**: 
  - Provides both encryption and authentication
  - Protects against tampering and bit-flipping attacks
  - Efficient for large data encryption
  - Parallelizable for better performance

---

## Encrypted Fields by Table

### Summary

- **7 tables** with encrypted fields
- **29 total encrypted fields** across all tables
- All encryption uses AWS KMS envelope encryption

### Field-by-Field Breakdown

#### 1. Strategic Understanding (3 fields)

| Field Name | Type | Description |
|------------|------|-------------|
| `user_input` | text | User's strategic input/question |
| `company_context` | jsonb | Company details and context |
| `initiative_description` | text | Description of the initiative |

**Example:**
```sql
SELECT user_input FROM strategic_understanding WHERE id = 'xxx';
-- Returns encrypted JSON, NOT plaintext
```

#### 2. Journey Sessions (1 field)

| Field Name | Type | Description |
|------------|------|-------------|
| `accumulated_context` | jsonb | Journey insights and analysis data |

**Contains:**
- Framework analysis results
- Root causes and insights
- Business model findings
- Competitive analysis

#### 3. EPM Programs (14 fields) ⭐ MOST SENSITIVE

| Field Name | Type | Description |
|------------|------|-------------|
| `program_name` | text | Program title |
| `executive_summary` | text | High-level program overview |
| `workstreams` | jsonb | Detailed workstream plans |
| `timeline` | jsonb | Project schedule and milestones |
| `resource_plan` | jsonb | Staffing and resource allocation |
| `financial_plan` | jsonb | Budget and financial projections |
| `benefits_realization` | jsonb | Expected ROI and benefits |
| `risk_register` | jsonb | Risk assessment and mitigation |
| `stakeholder_map` | jsonb | Key stakeholders and roles |
| `governance` | jsonb | Governance structure and processes |
| `qa_plan` | jsonb | Quality assurance procedures |
| `procurement` | jsonb | Vendor and procurement details |
| `exit_strategy` | jsonb | Program exit criteria and plan |
| `kpis` | jsonb | Key performance indicators |

**Why all 14 fields?**
EPM programs contain the most sensitive strategic and financial data in the system.

#### 4. Strategy Versions (2 fields)

| Field Name | Type | Description |
|------------|------|-------------|
| `analysis_data` | jsonb | Complete analysis from all frameworks |
| `decisions_data` | jsonb | Strategic decision details |

#### 5. Strategic Entities (6 fields)

| Field Name | Type | Description |
|------------|------|-------------|
| `claim` | text | The strategic claim or assumption |
| `source` | text | Where the information came from |
| `evidence` | text | Supporting evidence |
| `category` | text | Classification category |
| `subcategory` | text | Sub-classification |
| `metadata` | jsonb | Additional entity properties |

#### 6. Strategic Relationships (2 fields)

| Field Name | Type | Description |
|------------|------|-------------|
| `evidence` | text | Evidence for the relationship |
| `metadata` | jsonb | Additional relationship properties |

#### 7. Strategic Decisions (1 field)

| Field Name | Type | Description |
|------------|------|-------------|
| `decisions_data` | jsonb | Complete decision record |

---

## Key Management

### KMS Key Details

**Key ID:**
```
arn:aws:kms:eu-north-1:369862962223:key/[key-id]
```

**Environment Variables Required:**
```bash
# AWS Credentials
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>

# KMS Key ID
PREMISIA_KMS_KEY_ID=arn:aws:kms:eu-north-1:369862962223:key/[key-id]
```

### IAM Permissions Required

The application's IAM user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:GenerateDataKey",
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:eu-north-1:369862962223:key/[key-id]"
    }
  ]
}
```

**Operations:**
- `kms:GenerateDataKey` - Create new data keys for encryption
- `kms:Decrypt` - Decrypt data keys to read encrypted data

### Key Rotation Policy

**Automatic Rotation:**
- AWS KMS handles automatic key rotation
- Rotation occurs every **365 days** by default
- Old key versions remain available for decryption
- New encryptions use the new key version automatically

**Manual Rotation:**
If you need to manually rotate:
1. Create a new KMS key
2. Update `PREMISIA_KMS_KEY_ID` environment variable
3. Run migration script to re-encrypt with new key
4. Disable/delete old key after migration

**Best Practice:**
- Enable CloudTrail logging for KMS API calls
- Set up CloudWatch alarms for unusual activity
- Review key usage monthly

---

## Migration Process

### Overview

The migration script converts data from:
- **Old Format**: `iv:authTag:ciphertext` (local encryption key)
- **New Format**: KMS envelope encryption with JSON structure

### Running the Migration

**Dry Run (Safe - No Changes):**
```bash
npx tsx server/scripts/migrate-to-kms-encryption.ts --dry-run
```

**Actual Migration:**
```bash
npx tsx server/scripts/migrate-to-kms-encryption.ts
```

**Output Example:**
```
🔄 Starting KMS Encryption Migration
=====================================

📋 Migrating strategic_understanding...
  Total records: 150
  Progress: 150/150 records (142 migrated, 8 skipped)
  ✅ Completed: 142 migrated, 8 skipped

📋 Migrating journey_sessions...
  Total records: 89
  Progress: 89/89 records (89 migrated, 0 skipped)
  ✅ Completed: 89 migrated, 0 skipped

✅ Migration completed successfully!
   Total records migrated: 231
   Total errors: 0
```

### Migration Behavior

**Batch Processing:**
- Processes 10 records at a time
- Prevents memory overflow on large datasets

**Error Handling:**
- Errors logged to `migration-errors.log`
- Migration continues even if individual records fail
- Failed records can be retried

**Skipped Records:**
- Already in KMS format (no re-encryption needed)
- NULL values (nothing to encrypt)

### Verification After Migration

**1. Run Security Audit:**
```bash
npx tsx server/scripts/security-audit.ts
```

Expected output:
```
✅ All audited fields are properly encrypted with KMS
   → No action needed
```

**2. Run Verification Tests:**
```bash
npm test server/tests/encryption-verification.test.ts
```

All tests should pass.

**3. Manual Spot Check:**
```sql
-- Should see JSON with "dataKeyCiphertext", NOT plaintext
SELECT user_input FROM strategic_understanding LIMIT 1;
```

### Rollback Procedure

**If migration fails:**

1. **Stop the application immediately**
2. **Check `migration-errors.log` for details**
3. **Restore from database backup** (if available)
4. **Fix the underlying issue** (e.g., AWS credentials)
5. **Re-run migration**

**Backup Strategy:**
```bash
# Before migration, create a backup
pg_dump $DATABASE_URL > backup_before_kms_migration.sql

# If needed, restore
psql $DATABASE_URL < backup_before_kms_migration.sql
```

---

## Security Guarantees

### 1. Data Encrypted at Rest

✅ **Guarantee:** All sensitive fields are encrypted in the database.

**Verification:**
```bash
# Run this to confirm no plaintext in database
npx tsx server/scripts/security-audit.ts
```

### 2. Admins Cannot Decrypt Without KMS

✅ **Guarantee:** Database administrators cannot read encrypted data without AWS KMS permissions.

**How it works:**
- Encrypted data keys are stored in the database
- Only AWS KMS can decrypt those data keys
- Without KMS access, the database content is useless

**Example:**
```sql
-- Even with full database access, admin sees this:
SELECT user_input FROM strategic_understanding LIMIT 1;

Result: 
{"dataKeyCiphertext":"AQICAHi...","iv":"Fn2Xw...","authTag":"kJ8x...","ciphertext":"Ht9..."}
```

### 3. Per-Record Unique Data Keys

✅ **Guarantee:** Every encryption operation uses a new, unique 256-bit data key.

**Why this matters:**
- Prevents pattern analysis (same plaintext → different ciphertext)
- Limits damage if one key is compromised
- Meets compliance requirements (GDPR, HIPAA)

**Verification:**
```typescript
const encrypted1 = await encryptKMS("same text");
const encrypted2 = await encryptKMS("same text");

// These will be completely different
assert(encrypted1 !== encrypted2);
```

### 4. No Plaintext Keys Stored

✅ **Guarantee:** Plaintext data keys exist only in memory during encryption/decryption.

**How it works:**
1. Generate data key via KMS
2. Use plaintext key to encrypt
3. **Immediately zero out the plaintext key** in memory
4. Store only the encrypted key

**Code snippet:**
```typescript
let plaintextKey: Buffer | null = null;
try {
  const { plaintextKey: key, encryptedKey } = await generateDataKey();
  plaintextKey = key;
  // ... use key for encryption ...
} finally {
  if (plaintextKey) {
    plaintextKey.fill(0); // Zero out memory
    plaintextKey = null;  // Release reference
  }
}
```

### 5. Integrity Protection (Authentication Tags)

✅ **Guarantee:** Data tampering is detected and rejected.

**How it works:**
- AES-GCM mode produces an authentication tag
- Any modification to ciphertext invalidates the tag
- Decryption fails if tag doesn't match

**Example:**
```typescript
// If someone modifies the database ciphertext
const tampered = modifyCiphertext(encrypted);
const result = await decryptKMS(tampered);
// Throws error: "Authentication tag verification failed"
```

---

## Operational Procedures

### Running Security Audits

**Frequency:** Monthly (or after any database changes)

**Command:**
```bash
npx tsx server/scripts/security-audit.ts
```

**Options:**
```bash
# Audit more records per table
npx tsx server/scripts/security-audit.ts --sample-size=50

# Show detailed output
npx tsx server/scripts/security-audit.ts --verbose

# Audit specific table
npx tsx server/scripts/security-audit.ts --table=epm_programs
```

**Interpreting Results:**

- ✅ **PASS**: All sampled records properly encrypted
- ⚠️ **WARNING**: Legacy encryption detected (schedule migration)
- ❌ **FAIL**: Plaintext detected (immediate action required)

**Action on FAIL:**
1. Run migration script immediately
2. Investigate why encryption failed
3. Review recent code changes

### Monitoring KMS API Calls

**CloudWatch Metrics:**
- `kms:GenerateDataKey` call count
- `kms:Decrypt` call count
- Error rates

**Set up alerts:**
```bash
# Alert if decrypt errors spike
Metric: AWS/KMS DecryptErrors
Threshold: > 10 in 5 minutes

# Alert if usage is abnormally high
Metric: AWS/KMS APIRequestCount
Threshold: > 10,000 in 1 hour
```

**CloudTrail Logging:**
- All KMS operations are logged to CloudTrail
- Review logs for unauthorized access attempts
- Set up SNS notifications for KMS key policy changes

### Incident Response

**If KMS key is compromised:**

1. **Immediate Actions (Within 1 hour):**
   - Disable the compromised KMS key
   - Revoke IAM credentials with KMS access
   - Review CloudTrail logs for unauthorized decrypt operations

2. **Short-term (Within 24 hours):**
   - Create a new KMS key
   - Update application with new `PREMISIA_KMS_KEY_ID`
   - Deploy updated configuration

3. **Migration (Within 1 week):**
   - Run migration script to re-encrypt all data with new key
   - Verify encryption with security audit
   - Delete compromised key

4. **Post-Incident:**
   - Document incident and response
   - Review and update IAM policies
   - Implement additional monitoring

**If database backup is leaked:**

✅ **Good news:** Encrypted data in backup is useless without KMS access.

**Actions:**
- Rotate KMS key as precaution
- Review who had backup access
- Audit KMS access logs

---

## Testing & Verification

### Running Verification Tests

**Full test suite:**
```bash
npm test server/tests/encryption-verification.test.ts
```

**Specific test categories:**
```bash
# Test strategic understanding encryption
npm test -- --grep "Strategic Understanding Encryption"

# Test EPM programs encryption
npm test -- --grep "EPM Programs Encryption"

# Test backward compatibility
npm test -- --grep "Backward Compatibility"
```

### Test Coverage

The verification tests cover:

✅ **Plaintext Leakage Prevention**
- Verifies sensitive data doesn't appear in raw database queries
- Confirms KMS format structure is present

✅ **Decryption Correctness**
- Ensures data can be decrypted via secure-data-service
- Validates data integrity after round-trip encryption

✅ **All 14 EPM Fields**
- Tests each EPM program field individually
- Confirms no field is accidentally left unencrypted

✅ **Backward Compatibility**
- Verifies legacy encrypted data can still be read
- Tests mixed format handling (legacy + KMS)

✅ **Encryption Format Validation**
- Validates JSON structure of encrypted payloads
- Confirms IV length, data key format
- Ensures unique keys per encryption

### Development Environment Testing

**Enable test encryption key:**
```bash
# For local development/testing
export ENCRYPTION_KEY=$(openssl rand -base64 32)
export AWS_REGION=eu-north-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export PREMISIA_KMS_KEY_ID=test-key
```

**Note:** Tests will use mock KMS in development.

**Validate KMS setup:**
```typescript
import { validateKMSSetup } from './server/utils/kms-encryption';

await validateKMSSetup();
// Should print: ✅ KMS encryption validated successfully
```

---

## Troubleshooting

### Common Issues

#### 1. "AWS credentials not configured"

**Error:**
```
Error: AWS credentials not configured. Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

**Solution:**
```bash
# Check environment variables are set
echo $AWS_REGION
echo $AWS_ACCESS_KEY_ID
echo $PREMISIA_KMS_KEY_ID

# Set them if missing
export AWS_REGION=eu-north-1
export AWS_ACCESS_KEY_ID=<your-key>
export AWS_SECRET_ACCESS_KEY=<your-secret>
```

#### 2. "KMS Decrypt failed: AccessDeniedException"

**Error:**
```
❌ KMS Decrypt failed: AccessDeniedException
```

**Solution:**
- IAM user lacks `kms:Decrypt` permission
- Add permission to IAM policy (see [IAM Permissions](#iam-permissions-required))
- Or use IAM user with proper permissions

#### 3. "PREMISIA_KMS_KEY_ID environment variable not set"

**Error:**
```
Error: PREMISIA_KMS_KEY_ID environment variable not set
```

**Solution:**
```bash
export PREMISIA_KMS_KEY_ID=arn:aws:kms:eu-north-1:369862962223:key/[your-key-id]
```

#### 4. Migration Script Shows "Failed to decrypt"

**Error in `migration-errors.log`:**
```
Failed to migrate user_input: Failed to decrypt with old method
```

**Solution:**
- Field might already be in KMS format (safe to ignore)
- Or field contains invalid encrypted data
- Check specific record manually:
```sql
SELECT user_input FROM strategic_understanding WHERE id = '<failing-id>';
```

#### 5. Tests Fail with "Database connection failed"

**Error:**
```
Test database connection failed. Make sure DATABASE_URL is set correctly.
```

**Solution:**
```bash
# Ensure test database URL is set
export DATABASE_URL=postgresql://user:password@localhost:5432/testdb

# Or use Replit's database
export DATABASE_URL=$REPLIT_DB_URL
```

#### 6. "Authentication tag verification failed"

**Error:**
```
Error: Failed to decrypt with KMS: Unsupported state or unable to authenticate data
```

**Possible Causes:**
- Data was tampered with in database
- Wrong KMS key being used
- Corrupted encrypted data

**Solution:**
1. Check if correct KMS key ID is set
2. Verify data wasn't manually modified in database
3. Check CloudTrail logs for any KMS key changes

#### 7. Performance Issues (Slow Encryption/Decryption)

**Symptoms:**
- API requests taking > 2 seconds
- High KMS API usage costs

**Solutions:**
- **Batch operations**: Encrypt/decrypt multiple fields together
- **Caching**: Cache decrypted values in memory (with TTL)
- **Connection pooling**: Reuse KMS client instances
- **Regional endpoint**: Ensure using KMS in same region as app

**Example optimization:**
```typescript
// Instead of this (slow):
for (const record of records) {
  record.field = await decryptKMS(record.field);
}

// Do this (faster):
const decrypted = await Promise.all(
  records.map(r => decryptKMS(r.field))
);
```

---

## Additional Resources

- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)
- [Envelope Encryption Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/protecting-data-at-rest.html)
- [AES-GCM Security Analysis](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-02  
**Maintained By:** Security Team
