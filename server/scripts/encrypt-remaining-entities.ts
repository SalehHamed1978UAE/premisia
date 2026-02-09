import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// OLD encryption methods
import { decrypt, isEncrypted } from '../utils/encryption.js';

// NEW KMS encryption methods
import { encryptKMS } from '../utils/kms-encryption.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function encryptRemainingFields() {
  console.log('🔧 Encrypting remaining strategic_entities fields...\n');

  // Find all records with unencrypted fields
  const result = await pool.query(`
    SELECT id, claim, source, evidence, category 
    FROM strategic_entities 
    WHERE (claim IS NOT NULL AND claim NOT LIKE 'kms:%' AND claim NOT LIKE '{%')
       OR (source IS NOT NULL AND source NOT LIKE 'kms:%' AND source NOT LIKE '{%')
       OR (evidence IS NOT NULL AND evidence NOT LIKE 'kms:%' AND evidence NOT LIKE '{%')
       OR (category IS NOT NULL AND category NOT LIKE 'kms:%' AND category NOT LIKE '{%')
  `);

  console.log(`Found ${result.rows.length} records with unencrypted fields\n`);

  let encrypted = 0;
  let errors = 0;

  for (const record of result.rows) {
    try {
      const updates: any = {};
      let hasUpdates = false;

      // Encrypt claim if needed
      if (record.claim && !record.claim.startsWith('kms:') && !record.claim.startsWith('{')) {
        if (isEncrypted(record.claim)) {
          const decrypted = decrypt(record.claim);
          if (decrypted) {
            const reencrypted = await encryptKMS(decrypted);
            updates.claim = reencrypted;
            hasUpdates = true;
            console.log(`  ✓ Encrypted claim for ${record.id}`);
          }
        }
      }

      // Encrypt source if needed
      if (record.source && !record.source.startsWith('kms:') && !record.source.startsWith('{')) {
        if (isEncrypted(record.source)) {
          const decrypted = decrypt(record.source);
          if (decrypted) {
            const reencrypted = await encryptKMS(decrypted);
            updates.source = reencrypted;
            hasUpdates = true;
            console.log(`  ✓ Encrypted source for ${record.id}`);
          }
        }
      }

      // Encrypt evidence if needed
      if (record.evidence && !record.evidence.startsWith('kms:') && !record.evidence.startsWith('{')) {
        if (isEncrypted(record.evidence)) {
          const decrypted = decrypt(record.evidence);
          if (decrypted) {
            const reencrypted = await encryptKMS(decrypted);
            updates.evidence = reencrypted;
            hasUpdates = true;
            console.log(`  ✓ Encrypted evidence for ${record.id}`);
          }
        }
      }

      // Encrypt category if needed
      if (record.category && !record.category.startsWith('kms:') && !record.category.startsWith('{')) {
        if (isEncrypted(record.category)) {
          const decrypted = decrypt(record.category);
          if (decrypted) {
            const reencrypted = await encryptKMS(decrypted);
            updates.category = reencrypted;
            hasUpdates = true;
            console.log(`  ✓ Encrypted category for ${record.id}`);
          }
        }
      }

      if (hasUpdates) {
        const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
        const values = Object.values(updates);
        
        await pool.query(
          `UPDATE strategic_entities SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`,
          [...values, record.id]
        );
        
        encrypted++;
      }
    } catch (error) {
      console.error(`  ❌ Error encrypting record ${record.id}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Encrypted ${encrypted} records`);
  if (errors > 0) {
    console.log(`❌ ${errors} errors encountered`);
  }

  await pool.end();
}

encryptRemainingFields().catch(console.error);
