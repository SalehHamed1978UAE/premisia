import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { encryptKMS } from '../utils/kms-encryption.js';
// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function encryptInputSummaries() {
    try {
        console.log('🔐 Encrypting plaintext input_summary fields in strategy_versions...\n');
        // Get all records with plaintext input_summary
        const result = await pool.query(`SELECT id, input_summary FROM strategy_versions 
       WHERE input_summary IS NOT NULL 
       AND input_summary NOT LIKE 'kms:%' 
       AND input_summary NOT LIKE '{%dataKeyCiphertext%'`);
        console.log(`Found ${result.rows.length} records with plaintext input_summary\n`);
        if (result.rows.length === 0) {
            console.log('✅ All input_summary fields are already encrypted!');
            await pool.end();
            return;
        }
        // Encrypt each one
        for (const row of result.rows) {
            console.log(`Encrypting record ${row.id}...`);
            console.log(`  Original (first 100 chars): ${row.input_summary.substring(0, 100)}...`);
            const encrypted = await encryptKMS(row.input_summary);
            await pool.query('UPDATE strategy_versions SET input_summary = $1 WHERE id = $2', [encrypted, row.id]);
            console.log(`  ✅ Encrypted successfully\n`);
        }
        console.log(`\n✅ All ${result.rows.length} records encrypted successfully!`);
    }
    catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
    finally {
        await pool.end();
    }
}
encryptInputSummaries().catch(console.error);
//# sourceMappingURL=encrypt-input-summary.js.map