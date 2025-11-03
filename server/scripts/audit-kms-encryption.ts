import { neon } from '@neondatabase/serverless';
import ws from 'ws';

const neonConfig = await import('@neondatabase/serverless');
neonConfig.neonConfig.webSocketConstructor = ws.default;

const pool = neon(process.env.DATABASE_URL!);

async function auditKMSEncryption() {
  console.log('🔍 KMS Encryption Audit - Deterministic Coverage Check\n');
  console.log('Both TEXT and JSONB fields use JSON format: {"dataKeyCiphertext":"...", "iv":"...", "authTag":"...", "ciphertext":"..."}\n');

  const auditConfig = [
    {
      table: 'strategic_understanding',
      fields: ['user_input', 'initiative_description', 'company_context']
    },
    {
      table: 'journey_sessions',
      fields: ['accumulated_context']
    },
    {
      table: 'strategic_entities',
      fields: ['claim', 'source', 'evidence', 'category', 'subcategory', 'metadata']
    },
    {
      table: 'strategic_relationships',
      fields: ['evidence', 'metadata']
    },
    {
      table: 'epm_programs',
      fields: [
        'executive_summary', 'workstreams', 'timeline', 'resource_plan',
        'financial_plan', 'benefits_realization', 'risk_register',
        'stakeholder_map', 'governance', 'qa_plan', 'procurement',
        'exit_strategy', 'kpis'
      ]
    },
    {
      table: 'strategy_versions',
      fields: ['input_summary', 'analysis_data', 'decisions_data']
    }
  ];

  let totalFields = 0;
  let encryptedFields = 0;
  let nullFields = 0;
  let unencryptedFields = 0;

  for (const config of auditConfig) {
    const [countResult] = await pool(`SELECT COUNT(*) as count FROM ${config.table}`);
    const rowCount = parseInt(countResult.count);

    if (rowCount === 0) {
      console.log(`📋 ${config.table}: 0 records (skipped)`);
      continue;
    }

    console.log(`\n📋 ${config.table} (${rowCount} records):`);

    for (const field of config.fields) {
      const [stats] = await pool(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN ${field}::text LIKE '%dataKeyCiphertext%' THEN 1 END) as encrypted,
          COUNT(CASE WHEN ${field} IS NULL THEN 1 END) as null_count,
          COUNT(CASE WHEN ${field} IS NOT NULL AND ${field}::text NOT LIKE '%dataKeyCiphertext%' THEN 1 END) as unencrypted
        FROM ${config.table}
      `);

      totalFields++;
      encryptedFields += parseInt(stats.encrypted);
      nullFields += parseInt(stats.null_count);
      unencryptedFields += parseInt(stats.unencrypted);

      const status = parseInt(stats.encrypted) + parseInt(stats.null_count) === rowCount ? '✅' : '⚠️';
      console.log(`  ${status}  ${field}: ${stats.encrypted} encrypted, ${stats.null_count} null, ${stats.unencrypted} unencrypted`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL AUDIT SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total sensitive fields audited: ${totalFields}`);
  console.log(`KMS-encrypted fields: ${encryptedFields}`);
  console.log(`Null fields (acceptable): ${nullFields}`);
  console.log(`Unencrypted non-null fields (PROBLEMS): ${unencryptedFields}`);

  if (unencryptedFields > 0) {
    console.log('\n❌ AUDIT FAILED - Found unencrypted sensitive data!');
    process.exit(1);
  } else {
    console.log(`\n✅ AUDIT PASSED - All ${encryptedFields} non-null sensitive fields are KMS encrypted!`);
    process.exit(0);
  }
}

auditKMSEncryption();
