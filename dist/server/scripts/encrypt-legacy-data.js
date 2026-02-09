#!/usr/bin/env tsx
/**
 * Encrypt Legacy Data Migration Script
 *
 * This script encrypts existing plaintext data in the database that was created
 * before the encryption system was implemented.
 *
 * Tables affected:
 * - strategy_versions: analysisData, decisionsData fields
 *
 * Usage:
 *   npm run encrypt-legacy-data [--dry-run] [--batch-size=50]
 *
 * Options:
 *   --dry-run: Show what would be encrypted without making changes
 *   --batch-size: Number of records to process at once (default: 50)
 */
import { runEncryptionMigration } from '../services/encryption-migration';
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Encrypt Legacy Data Migration Script                ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (data will be encrypted)'}`);
    console.log(`Batch size: ${batchSize} records`);
    try {
        console.log('\n🔍 Checking strategy_versions for plaintext data...\n');
        let processed = 0;
        const stats = await runEncryptionMigration({
            dryRun,
            batchSize,
            onProgress: (record, current, total) => {
                processed++;
                console.log(`[${current}/${total}] ID: ${record.id.substring(0, 8)}...`);
                if (record.analysisPlaintext) {
                    console.log(`  ⚠️  analysisData contains plaintext`);
                }
                if (record.decisionsPlaintext) {
                    console.log(`  ⚠️  decisionsData contains plaintext`);
                }
                if (dryRun) {
                    console.log(`  ℹ️  DRY RUN: Would encrypt this record`);
                }
                else {
                    if (record.analysisPlaintext) {
                        console.log(`  ✅ Encrypted analysisData`);
                    }
                    if (record.decisionsPlaintext) {
                        console.log(`  ✅ Encrypted decisionsData`);
                    }
                    console.log(`  ✅ Record updated successfully\n`);
                }
            }
        });
        if (stats.total > 0 && processed === 0) {
            console.log(`Found ${stats.total} records with analysis or decisions data\n`);
        }
        const duration = (stats.duration / 1000).toFixed(2);
        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║   Migration Complete                                   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📊 Statistics:');
        console.log(`   Total records checked: ${stats.total}`);
        console.log(`   Records encrypted:     ${stats.encrypted}`);
        console.log(`   Records skipped:       ${stats.skipped} (already encrypted)`);
        console.log(`   Records failed:        ${stats.failed}`);
        console.log(`   Duration:              ${duration}s`);
        console.log('');
        if (dryRun) {
            console.log('ℹ️  This was a dry run. Run without --dry-run to encrypt the data.');
        }
        else if (stats.failed > 0) {
            console.log('⚠️  Some records failed to encrypt. Check the logs above for details.');
            process.exit(1);
        }
        else {
            console.log('✅ All plaintext data has been encrypted successfully!');
        }
    }
    catch (error) {
        console.error('\n❌ Migration failed with error:');
        console.error(error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=encrypt-legacy-data.js.map