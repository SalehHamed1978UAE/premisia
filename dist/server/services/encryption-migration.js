/**
 * Encryption Migration Service
 *
 * Provides reusable encryption migration logic for both CLI scripts and API endpoints.
 * Encrypts existing plaintext data in the database using AWS KMS envelope encryption.
 */
import { db } from '../db';
import { strategyVersions } from '@shared/schema';
import { encryptJSONKMS } from '../utils/kms-encryption';
import { eq, sql } from 'drizzle-orm';
/**
 * Check if a value is plaintext JSON (not encrypted)
 * Encrypted data has the KMS envelope structure: { dataKeyCiphertext, iv, ciphertext, authTag }
 */
async function isPlaintextJSON(value) {
    if (!value)
        return false;
    // Parse to object if it's a string
    let parsed;
    try {
        parsed = typeof value === 'string' ? JSON.parse(value) : value;
    }
    catch (e) {
        // If it can't be parsed as JSON, treat as plaintext
        return true;
    }
    // Check if it has the encrypted envelope structure
    if (parsed &&
        typeof parsed === 'object' &&
        'dataKeyCiphertext' in parsed &&
        'iv' in parsed &&
        'ciphertext' in parsed &&
        'authTag' in parsed) {
        // This is encrypted data
        return false;
    }
    // Any other JSON structure is plaintext
    return true;
}
/**
 * Run the encryption migration on strategy_versions table
 * Returns detailed statistics about the migration
 */
export async function runEncryptionMigration(options) {
    const { dryRun, batchSize = 50, onProgress } = options;
    const stats = {
        total: 0,
        encrypted: 0,
        skipped: 0,
        failed: 0,
        duration: 0
    };
    const startTime = Date.now();
    try {
        // Get all strategy versions with non-null analysisData or decisionsData
        const versions = await db.select({
            id: strategyVersions.id,
            analysisData: strategyVersions.analysisData,
            decisionsData: strategyVersions.decisionsData,
            createdAt: strategyVersions.createdAt
        })
            .from(strategyVersions)
            .where(sql `${strategyVersions.analysisData} IS NOT NULL OR ${strategyVersions.decisionsData} IS NOT NULL`);
        stats.total = versions.length;
        let processed = 0;
        for (const version of versions) {
            processed++;
            try {
                const needsUpdate = {
                    analysisData: await isPlaintextJSON(version.analysisData),
                    decisionsData: await isPlaintextJSON(version.decisionsData)
                };
                if (!needsUpdate.analysisData && !needsUpdate.decisionsData) {
                    stats.skipped++;
                    continue;
                }
                // Notify progress callback
                if (onProgress) {
                    onProgress({
                        id: version.id,
                        analysisPlaintext: needsUpdate.analysisData,
                        decisionsPlaintext: needsUpdate.decisionsData
                    }, processed, versions.length);
                }
                if (dryRun) {
                    stats.encrypted++;
                    continue;
                }
                // Encrypt the fields
                const updateData = {};
                if (needsUpdate.analysisData && version.analysisData) {
                    updateData.analysisData = await encryptJSONKMS(version.analysisData);
                }
                if (needsUpdate.decisionsData && version.decisionsData) {
                    updateData.decisionsData = await encryptJSONKMS(version.decisionsData);
                }
                // Update the record
                await db.update(strategyVersions)
                    .set(updateData)
                    .where(eq(strategyVersions.id, version.id));
                stats.encrypted++;
                // Batch processing pause
                if (processed % batchSize === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                stats.failed++;
                console.error(`Error encrypting record ${version.id}:`, error);
            }
        }
        stats.duration = Date.now() - startTime;
    }
    catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
    return stats;
}
//# sourceMappingURL=encryption-migration.js.map