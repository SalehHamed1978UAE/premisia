#!/usr/bin/env tsx
/**
 * Security Audit Script
 * 
 * Audits the database to verify that sensitive fields are properly encrypted
 * using AWS KMS envelope encryption format.
 * 
 * Usage:
 *   npm run tsx server/scripts/security-audit.ts
 *   
 * Or with tsx directly:
 *   npx tsx server/scripts/security-audit.ts
 * 
 * Options:
 *   --sample-size=N    Number of records to sample per table (default: 10)
 *   --verbose          Show detailed encryption status for each record
 *   --table=NAME       Audit only specific table
 * 
 * Example:
 *   npx tsx server/scripts/security-audit.ts --sample-size=20 --verbose
 *   npx tsx server/scripts/security-audit.ts --table=strategic_understanding
 */

import { Pool } from '@neondatabase/serverless';

interface EncryptionStatus {
  kmsEncrypted: number;
  legacyEncrypted: number;
  plaintext: number;
  null: number;
}

interface TableAuditResult {
  tableName: string;
  totalRecords: number;
  sampledRecords: number;
  fields: {
    [fieldName: string]: EncryptionStatus;
  };
}

const SAMPLE_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--sample-size='))?.split('=')[1] || '10');
const VERBOSE = process.argv.includes('--verbose');
const SPECIFIC_TABLE = process.argv.find(arg => arg.startsWith('--table='))?.split('=')[1];

// Table configurations with encrypted fields
const TABLE_CONFIGS = [
  {
    name: 'strategic_understanding',
    fields: ['user_input', 'company_context', 'initiative_description'],
  },
  {
    name: 'journey_sessions',
    fields: ['accumulated_context'],
  },
  {
    name: 'epm_programs',
    fields: [
      'program_name',
      'executive_summary',
      'workstreams',
      'timeline',
      'resource_plan',
      'financial_plan',
      'benefits_realization',
      'risk_register',
      'stakeholder_map',
      'governance',
      'qa_plan',
      'procurement',
      'exit_strategy',
      'kpis',
    ],
  },
  {
    name: 'strategy_versions',
    fields: ['analysis_data', 'decisions_data'],
  },
  {
    name: 'strategic_entities',
    fields: ['claim', 'source', 'evidence', 'category', 'subcategory', 'metadata'],
  },
  {
    name: 'strategic_relationships',
    fields: ['evidence', 'metadata'],
  },
  {
    name: 'strategic_decisions',
    fields: ['decisions_data'],
  },
];

/**
 * Deterministic plaintext detection
 * Detects if a value is plaintext using multiple heuristics
 */
function isPlaintext(value: string): boolean {
  // Check if it's valid JSON without KMS envelope
  try {
    const parsed = JSON.parse(value);
    // JSON but not KMS encrypted = plaintext
    if (!parsed.dataKeyCiphertext) {
      return true;
    }
    // Has dataKeyCiphertext = likely encrypted
    return false;
  } catch {
    // Not JSON, continue with other checks
  }
  
  // Check for common plaintext patterns
  const hasReadableText = /[a-zA-Z]{10,}/.test(value); // 10+ consecutive letters
  const isNotBase64 = !/^[A-Za-z0-9+/=:]+$/.test(value); // Contains non-base64 chars
  
  return hasReadableText && isNotBase64;
}

function detectEncryptionFormat(value: string | null): 'kms' | 'legacy' | 'plaintext' | 'null' {
  if (value === null || value === undefined) {
    return 'null';
  }

  // Check for KMS format (JSON with dataKeyCiphertext)
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'dataKeyCiphertext' in parsed &&
      'iv' in parsed &&
      'authTag' in parsed &&
      'ciphertext' in parsed
    ) {
      return 'kms';
    }
  } catch {
    // Not JSON, check other formats
  }

  // Check for legacy format (base64:base64:base64)
  const parts = value.split(':');
  if (parts.length === 3) {
    try {
      // Try to decode each part as base64
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encrypted = Buffer.from(parts[2], 'base64');

      if (iv.length > 0 && authTag.length > 0 && encrypted.length > 0) {
        return 'legacy';
      }
    } catch {
      // Not valid base64
    }
  }

  // Use deterministic plaintext detection
  if (isPlaintext(value)) {
    return 'plaintext';
  }

  // If we can't determine, assume plaintext for safety (better to flag it)
  return 'plaintext';
}

async function auditTable(pool: Pool, tableConfig: { name: string; fields: string[] }): Promise<TableAuditResult> {
  const { name: tableName, fields } = tableConfig;

  console.log(`\n📋 Auditing table: ${tableName}...`);

  // Get total record count
  const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
  const totalRecords = parseInt(countResult.rows[0].count);

  if (totalRecords === 0) {
    console.log(`  ⚠️  Table is empty, skipping`);
    return {
      tableName,
      totalRecords: 0,
      sampledRecords: 0,
      fields: {},
    };
  }

  // Sample random records
  const sampleSize = Math.min(SAMPLE_SIZE, totalRecords);
  const fieldList = fields.map(f => `"${f}"`).join(', ');
  
  const sampleResult = await pool.query(
    `SELECT ${fieldList} FROM ${tableName} ORDER BY RANDOM() LIMIT $1`,
    [sampleSize]
  );

  const fieldStats: { [fieldName: string]: EncryptionStatus } = {};

  // Initialize stats for each field
  for (const field of fields) {
    fieldStats[field] = {
      kmsEncrypted: 0,
      legacyEncrypted: 0,
      plaintext: 0,
      null: 0,
    };
  }

  // Analyze each sampled record
  for (const record of sampleResult.rows) {
    for (const field of fields) {
      const value = record[field];
      const format = detectEncryptionFormat(value);

      if (format === 'kms') {
        fieldStats[field].kmsEncrypted++;
      } else if (format === 'legacy') {
        fieldStats[field].legacyEncrypted++;
      } else if (format === 'null') {
        fieldStats[field].null++;
      } else {
        fieldStats[field].plaintext++;
        
        if (VERBOSE) {
          console.log(`  ⚠️  PLAINTEXT DETECTED in ${tableName}.${field}:`);
          console.log(`     Value: ${value?.substring(0, 100)}...`);
        }
      }
    }
  }

  return {
    tableName,
    totalRecords,
    sampledRecords: sampleSize,
    fields: fieldStats,
  };
}

function printFieldStatus(fieldName: string, stats: EncryptionStatus, sampledRecords: number): string {
  const total = stats.kmsEncrypted + stats.legacyEncrypted + stats.plaintext + stats.null;
  const encrypted = stats.kmsEncrypted + stats.legacyEncrypted;
  const nonNull = total - stats.null;

  if (nonNull === 0) {
    return `    ${fieldName.padEnd(30)} ⚪ NULL (all ${stats.null} records)`;
  }

  if (stats.plaintext > 0) {
    return `    ${fieldName.padEnd(30)} ❌ FAIL (${stats.plaintext}/${nonNull} plaintext)`;
  }

  if (stats.legacyEncrypted > 0 && stats.kmsEncrypted === 0) {
    return `    ${fieldName.padEnd(30)} ⚠️  LEGACY (${stats.legacyEncrypted}/${nonNull} old format)`;
  }

  if (stats.legacyEncrypted > 0) {
    return `    ${fieldName.padEnd(30)} ⚠️  MIXED (${stats.kmsEncrypted} KMS, ${stats.legacyEncrypted} legacy)`;
  }

  return `    ${fieldName.padEnd(30)} ✅ ENCRYPTED (${stats.kmsEncrypted}/${nonNull} KMS)`;
}

function getTableStatus(result: TableAuditResult): 'pass' | 'warning' | 'fail' {
  if (result.sampledRecords === 0) return 'pass';

  let hasPlaintext = false;
  let hasLegacy = false;

  for (const stats of Object.values(result.fields)) {
    if (stats.plaintext > 0) hasPlaintext = true;
    if (stats.legacyEncrypted > 0) hasLegacy = true;
  }

  if (hasPlaintext) return 'fail';
  if (hasLegacy) return 'warning';
  return 'pass';
}

async function main() {
  console.log('🔍 Security Audit Report');
  console.log('========================\n');
  console.log(`Sample Size: ${SAMPLE_SIZE} records per table`);
  console.log(`Verbose Mode: ${VERBOSE ? 'ON' : 'OFF'}`);
  
  if (SPECIFIC_TABLE) {
    console.log(`Specific Table: ${SPECIFIC_TABLE}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const results: TableAuditResult[] = [];
  let totalFieldsAudited = 0;
  let totalFieldsEncrypted = 0;
  let totalFieldsWithLegacy = 0;
  let totalFieldsPlaintext = 0;

  const tablesToAudit = SPECIFIC_TABLE
    ? TABLE_CONFIGS.filter(t => t.name === SPECIFIC_TABLE)
    : TABLE_CONFIGS;

  if (SPECIFIC_TABLE && tablesToAudit.length === 0) {
    console.error(`❌ Table "${SPECIFIC_TABLE}" not found in audit configuration`);
    process.exit(1);
  }

  for (const tableConfig of tablesToAudit) {
    try {
      const result = await auditTable(pool, tableConfig);
      results.push(result);

      // Print table summary
      console.log(`\n  Total Records: ${result.totalRecords}`);
      console.log(`  Sampled: ${result.sampledRecords}`);
      console.log(`  Fields:`);

      for (const [fieldName, stats] of Object.entries(result.fields)) {
        console.log(printFieldStatus(fieldName, stats, result.sampledRecords));
        
        totalFieldsAudited++;
        const nonNull = stats.kmsEncrypted + stats.legacyEncrypted + stats.plaintext;
        
        if (nonNull > 0) {
          if (stats.plaintext > 0) {
            totalFieldsPlaintext++;
          } else if (stats.legacyEncrypted > 0) {
            totalFieldsWithLegacy++;
            totalFieldsEncrypted++;
          } else {
            totalFieldsEncrypted++;
          }
        }
      }

      const status = getTableStatus(result);
      if (status === 'pass') {
        console.log(`\n  ✅ Status: PASS`);
      } else if (status === 'warning') {
        console.log(`\n  ⚠️  Status: WARNING (legacy encryption detected)`);
      } else {
        console.log(`\n  ❌ Status: FAIL (plaintext detected)`);
      }
    } catch (error) {
      console.error(`  ❌ Error auditing table ${tableConfig.name}:`, error);
    }
  }

  await pool.end();

  // Print overall summary
  console.log('\n\n📊 Overall Summary');
  console.log('==================');
  console.log(`Total Fields Audited: ${totalFieldsAudited}`);
  console.log(`Properly Encrypted (KMS): ${totalFieldsEncrypted - totalFieldsWithLegacy}/${totalFieldsAudited}`);
  console.log(`Legacy Encryption: ${totalFieldsWithLegacy}/${totalFieldsAudited}`);
  console.log(`Plaintext (SECURITY RISK): ${totalFieldsPlaintext}/${totalFieldsAudited}`);

  // Print recommendations
  console.log('\n💡 Recommendations');
  console.log('==================');

  if (totalFieldsPlaintext > 0) {
    console.log(`❌ CRITICAL: ${totalFieldsPlaintext} fields contain plaintext data!`);
    console.log(`   → Run: npx tsx server/scripts/migrate-to-kms-encryption.ts`);
  }

  if (totalFieldsWithLegacy > 0) {
    console.log(`⚠️  WARNING: ${totalFieldsWithLegacy} fields use legacy encryption format`);
    console.log(`   → Run: npx tsx server/scripts/migrate-to-kms-encryption.ts`);
    console.log(`   → This will re-encrypt data with KMS envelope encryption`);
  }

  if (totalFieldsPlaintext === 0 && totalFieldsWithLegacy === 0) {
    console.log(`✅ All audited fields are properly encrypted with KMS`);
    console.log(`   → No action needed`);
  }

  // Exit with error code if plaintext detected
  if (totalFieldsPlaintext > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
