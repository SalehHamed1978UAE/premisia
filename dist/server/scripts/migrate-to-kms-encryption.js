import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;
// OLD encryption methods
import { decrypt, decryptJSON, isEncrypted } from '../utils/encryption.js';
// NEW KMS encryption methods
import { encryptKMS, encryptJSONKMS, decryptKMS, decryptJSONKMS, generateDataKey, decryptDataKey } from '../utils/kms-encryption.js';
const BATCH_SIZE = 10;
const ERROR_LOG_FILE = 'migration-errors.log';
const isDryRun = process.argv.includes('--dry-run');
const stats = {
    totalRecords: 0,
    migratedRecords: 0,
    skippedRecords: 0,
    errorRecords: 0,
    errors: [],
};
// Initialize database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Helper function to detect if data is in old format
function isOldFormat(data) {
    if (!data)
        return false;
    // Check if it's old format (iv:authTag:ciphertext)
    if (isEncrypted(data)) {
        const parts = data.split(':');
        if (parts.length === 3) {
            // It's old format
            return true;
        }
    }
    // Check if it's already new KMS format (JSON)
    try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && 'dataKeyCiphertext' in parsed) {
            // Already in new KMS format
            return false;
        }
    }
    catch {
        // Not JSON, might be unencrypted or old format
    }
    return false;
}
// Helper function to log errors
function logError(table, id, error) {
    const errorMsg = `[${new Date().toISOString()}] Table: ${table}, ID: ${id}, Error: ${error}\n`;
    fs.appendFileSync(ERROR_LOG_FILE, errorMsg);
    stats.errors.push({ table, id, error });
    stats.errorRecords++;
}
// KMS health check before migration
async function validateKMSAccess() {
    try {
        console.log('🔍 Validating KMS access...');
        // Test generate data key
        const testKey = await generateDataKey();
        console.log('  ✓ Successfully generated data key');
        // Test decrypt data key
        await decryptDataKey(testKey.encryptedKey);
        console.log('  ✓ Successfully decrypted data key');
        // Test full encryption/decryption cycle
        const testData = 'KMS migration validation test';
        const encrypted = await encryptKMS(testData);
        const decrypted = await decryptKMS(encrypted);
        if (decrypted !== testData) {
            throw new Error('Encryption/decryption cycle did not match');
        }
        console.log('  ✓ Full encryption/decryption cycle successful');
        console.log('✅ KMS validation successful - ready to proceed with migration\n');
    }
    catch (error) {
        console.error('❌ KMS validation failed:', error);
        console.error('\nPlease ensure the following environment variables are set:');
        console.error('  - AWS_REGION');
        console.error('  - AWS_ACCESS_KEY_ID');
        console.error('  - AWS_SECRET_ACCESS_KEY');
        console.error('  - PREMISIA_KMS_KEY_ID');
        throw new Error('Cannot proceed without KMS access');
    }
}
// Helper function to migrate a text field
async function migrateTextField(oldValue, fieldName, recordId, tableName) {
    if (!oldValue)
        return null;
    // CRITICAL FIX: Detect TEXT fields wrongly storing JSONB format encryption
    // These should be in 'kms:' format, not JSON with dataKeyCiphertext
    if (oldValue.startsWith('{') && oldValue.includes('dataKeyCiphertext')) {
        try {
            // This is JSONB-format encryption in a TEXT field - decrypt and convert to proper format
            const decrypted = await decryptKMS(oldValue);
            if (!decrypted) {
                console.warn(`  ⚠️  Could not decrypt JSONB-format ${fieldName} for record ${recordId}`);
                return null;
            }
            // Re-encrypt with TEXT format (kms: prefix)
            const reencrypted = await encryptKMS(decrypted);
            console.log(`  🔄 Converted ${tableName}.${fieldName} from JSONB-format to TEXT-format encryption`);
            return reencrypted;
        }
        catch (error) {
            const errorMsg = `Failed to convert JSONB-format ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
            logError(tableName, recordId, errorMsg);
            return null;
        }
    }
    // Check if already in correct TEXT format (kms: prefix)
    if (oldValue.startsWith('kms:')) {
        return null; // Skip, already in correct format
    }
    // Check if it's legacy encrypted format
    if (!isOldFormat(oldValue)) {
        return null; // Skip, unencrypted or unknown format
    }
    try {
        // Decrypt with old method
        const decrypted = decrypt(oldValue);
        if (!decrypted) {
            console.warn(`  ⚠️  Could not decrypt ${fieldName} for record ${recordId}`);
            return null;
        }
        // Re-encrypt with KMS
        const reencrypted = await encryptKMS(decrypted);
        return reencrypted;
    }
    catch (error) {
        const errorMsg = `Failed to migrate ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
        logError(tableName, recordId, errorMsg);
        return null;
    }
}
// Helper function to migrate a JSON field
async function migrateJSONField(oldValue, fieldName, recordId, tableName) {
    if (!oldValue)
        return null;
    // Handle JSONB columns returned as JavaScript objects
    if (typeof oldValue === 'object' && !Buffer.isBuffer(oldValue)) {
        // Check if it's the old encryption format stored as JSONB object
        if ('iv' in oldValue && 'authTag' in oldValue && 'ciphertext' in oldValue) {
            try {
                // Convert object back to string format for decryptJSON
                const oldFormatString = `${oldValue.iv}:${oldValue.authTag}:${oldValue.ciphertext}`;
                const decrypted = decryptJSON(oldFormatString);
                if (!decrypted) {
                    console.warn(`  ⚠️  Could not decrypt ${fieldName} for record ${recordId}`);
                    return null;
                }
                // Re-encrypt with KMS
                const reencrypted = await encryptJSONKMS(decrypted);
                return reencrypted;
            }
            catch (error) {
                const errorMsg = `Failed to migrate legacy JSONB ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
                logError(tableName, recordId, errorMsg);
                return null;
            }
        }
        // Not old format, so it's plaintext JSONB that needs to be encrypted
        try {
            const encrypted = await encryptJSONKMS(oldValue);
            return encrypted;
        }
        catch (error) {
            const errorMsg = `Failed to encrypt plaintext JSONB ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
            logError(tableName, recordId, errorMsg);
            return null;
        }
    }
    // Handle string values (legacy encrypted, KMS format, or plaintext JSON)
    if (typeof oldValue !== 'string') {
        return null; // Skip non-string, non-object values
    }
    // Check if already in KMS format
    try {
        const parsed = JSON.parse(oldValue);
        if (parsed && typeof parsed === 'object' && 'dataKeyCiphertext' in parsed) {
            // Already in KMS format, skip
            return null;
        }
        // If we got here, it's a valid JSON string that's NOT encrypted
        // This is plaintext JSON that needs to be encrypted
        const encrypted = await encryptJSONKMS(parsed);
        return encrypted;
    }
    catch {
        // Not a valid JSON string, might be legacy encrypted format
    }
    // Check if it's legacy encrypted format
    if (!isOldFormat(oldValue)) {
        return null; // Skip, not recognized format
    }
    try {
        // Decrypt with old method
        const decrypted = decryptJSON(oldValue);
        if (!decrypted) {
            console.warn(`  ⚠️  Could not decrypt ${fieldName} for record ${recordId}`);
            return null;
        }
        // Re-encrypt with KMS
        const reencrypted = await encryptJSONKMS(decrypted);
        return reencrypted;
    }
    catch (error) {
        const errorMsg = `Failed to migrate ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
        logError(tableName, recordId, errorMsg);
        return null;
    }
}
// Helper function to encrypt plaintext fields (fields that were never encrypted)
async function encryptPlaintextField(value, fieldName, recordId, tableName) {
    if (!value)
        return null;
    // Check if already encrypted (either old or new format)
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && 'dataKeyCiphertext' in parsed) {
            // Already in KMS format, skip
            return null;
        }
    }
    catch {
        // Not JSON, might be plaintext or old format
    }
    if (isOldFormat(value)) {
        // Already in old encrypted format, skip (will be handled by migrateTextField)
        return null;
    }
    try {
        // Encrypt plaintext with KMS
        const encrypted = await encryptKMS(value);
        return encrypted;
    }
    catch (error) {
        const errorMsg = `Failed to encrypt ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
        logError(tableName, recordId, errorMsg);
        return null;
    }
}
// ==================== TABLE MIGRATION FUNCTIONS ====================
async function migrateStrategicUnderstanding() {
    const tableName = 'strategic_understanding';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, user_input, company_context, initiative_description FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                const updates = {};
                let hasUpdates = false;
                // Migrate user_input
                const newUserInput = await migrateTextField(record.user_input, 'user_input', record.id, tableName);
                if (newUserInput) {
                    updates.user_input = newUserInput;
                    hasUpdates = true;
                }
                // Migrate company_context (JSON)
                const newCompanyContext = await migrateJSONField(record.company_context, 'company_context', record.id, tableName);
                if (newCompanyContext) {
                    updates.company_context = newCompanyContext;
                    hasUpdates = true;
                }
                // Migrate initiative_description
                const newInitiativeDescription = await migrateTextField(record.initiative_description, 'initiative_description', record.id, tableName);
                if (newInitiativeDescription) {
                    updates.initiative_description = newInitiativeDescription;
                    hasUpdates = true;
                }
                if (hasUpdates && !isDryRun) {
                    // Build dynamic UPDATE query
                    const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                    const values = Object.values(updates);
                    await pool.query(`UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (hasUpdates && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateJourneySessions() {
    const tableName = 'journey_sessions';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, accumulated_context FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                // Migrate accumulated_context (JSON)
                const newAccumulatedContext = await migrateJSONField(record.accumulated_context, 'accumulated_context', record.id, tableName);
                if (newAccumulatedContext && !isDryRun) {
                    await pool.query(`UPDATE ${tableName} SET accumulated_context = $1, updated_at = NOW() WHERE id = $2`, [newAccumulatedContext, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (newAccumulatedContext && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateStrategicEntities() {
    const tableName = 'strategic_entities';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, claim, source, evidence, category, subcategory, metadata FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                const updates = {};
                let hasUpdates = false;
                // Migrate claim
                const newClaim = await migrateTextField(record.claim, 'claim', record.id, tableName);
                if (newClaim) {
                    updates.claim = newClaim;
                    hasUpdates = true;
                }
                // Migrate source
                const newSource = await migrateTextField(record.source, 'source', record.id, tableName);
                if (newSource) {
                    updates.source = newSource;
                    hasUpdates = true;
                }
                // Migrate evidence
                const newEvidence = await migrateTextField(record.evidence, 'evidence', record.id, tableName);
                if (newEvidence) {
                    updates.evidence = newEvidence;
                    hasUpdates = true;
                }
                // Migrate category
                const newCategory = await migrateTextField(record.category, 'category', record.id, tableName);
                if (newCategory) {
                    updates.category = newCategory;
                    hasUpdates = true;
                }
                // Migrate subcategory
                const newSubcategory = await migrateTextField(record.subcategory, 'subcategory', record.id, tableName);
                if (newSubcategory) {
                    updates.subcategory = newSubcategory;
                    hasUpdates = true;
                }
                // Migrate metadata (JSON)
                const newMetadata = await migrateJSONField(record.metadata, 'metadata', record.id, tableName);
                if (newMetadata) {
                    updates.metadata = newMetadata;
                    hasUpdates = true;
                }
                if (hasUpdates && !isDryRun) {
                    const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                    const values = Object.values(updates);
                    await pool.query(`UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (hasUpdates && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateStrategicRelationships() {
    const tableName = 'strategic_relationships';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, evidence, metadata FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                const updates = {};
                let hasUpdates = false;
                // Migrate evidence
                const newEvidence = await migrateTextField(record.evidence, 'evidence', record.id, tableName);
                if (newEvidence) {
                    updates.evidence = newEvidence;
                    hasUpdates = true;
                }
                // Migrate metadata (JSON)
                const newMetadata = await migrateJSONField(record.metadata, 'metadata', record.id, tableName);
                if (newMetadata) {
                    updates.metadata = newMetadata;
                    hasUpdates = true;
                }
                if (hasUpdates && !isDryRun) {
                    const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                    const values = Object.values(updates);
                    await pool.query(`UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (hasUpdates && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateEPMPrograms() {
    const tableName = 'epm_programs';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, executive_summary, workstreams, timeline, resource_plan, 
              financial_plan, benefits_realization, risk_register, stakeholder_map, 
              governance, qa_plan, procurement, exit_strategy, kpis 
       FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                const updates = {};
                let hasUpdates = false;
                // Migrate executive_summary (JSONB)
                const newExecutiveSummary = await migrateJSONField(record.executive_summary, 'executive_summary', record.id, tableName);
                if (newExecutiveSummary) {
                    updates.executive_summary = newExecutiveSummary;
                    hasUpdates = true;
                }
                // Migrate workstreams (JSON)
                const newWorkstreams = await migrateJSONField(record.workstreams, 'workstreams', record.id, tableName);
                if (newWorkstreams) {
                    updates.workstreams = newWorkstreams;
                    hasUpdates = true;
                }
                // Migrate timeline (JSON)
                const newTimeline = await migrateJSONField(record.timeline, 'timeline', record.id, tableName);
                if (newTimeline) {
                    updates.timeline = newTimeline;
                    hasUpdates = true;
                }
                // Migrate resource_plan (JSON)
                const newResourcePlan = await migrateJSONField(record.resource_plan, 'resource_plan', record.id, tableName);
                if (newResourcePlan) {
                    updates.resource_plan = newResourcePlan;
                    hasUpdates = true;
                }
                // Migrate financial_plan (JSON)
                const newFinancialPlan = await migrateJSONField(record.financial_plan, 'financial_plan', record.id, tableName);
                if (newFinancialPlan) {
                    updates.financial_plan = newFinancialPlan;
                    hasUpdates = true;
                }
                // Migrate benefits_realization (JSON)
                const newBenefitsRealization = await migrateJSONField(record.benefits_realization, 'benefits_realization', record.id, tableName);
                if (newBenefitsRealization) {
                    updates.benefits_realization = newBenefitsRealization;
                    hasUpdates = true;
                }
                // Migrate risk_register (JSON)
                const newRiskRegister = await migrateJSONField(record.risk_register, 'risk_register', record.id, tableName);
                if (newRiskRegister) {
                    updates.risk_register = newRiskRegister;
                    hasUpdates = true;
                }
                // Migrate stakeholder_map (JSON)
                const newStakeholderMap = await migrateJSONField(record.stakeholder_map, 'stakeholder_map', record.id, tableName);
                if (newStakeholderMap) {
                    updates.stakeholder_map = newStakeholderMap;
                    hasUpdates = true;
                }
                // Migrate governance (JSON)
                const newGovernance = await migrateJSONField(record.governance, 'governance', record.id, tableName);
                if (newGovernance) {
                    updates.governance = newGovernance;
                    hasUpdates = true;
                }
                // Migrate qa_plan (JSON)
                const newQaPlan = await migrateJSONField(record.qa_plan, 'qa_plan', record.id, tableName);
                if (newQaPlan) {
                    updates.qa_plan = newQaPlan;
                    hasUpdates = true;
                }
                // Migrate procurement (JSON)
                const newProcurement = await migrateJSONField(record.procurement, 'procurement', record.id, tableName);
                if (newProcurement) {
                    updates.procurement = newProcurement;
                    hasUpdates = true;
                }
                // Migrate exit_strategy (JSON)
                const newExitStrategy = await migrateJSONField(record.exit_strategy, 'exit_strategy', record.id, tableName);
                if (newExitStrategy) {
                    updates.exit_strategy = newExitStrategy;
                    hasUpdates = true;
                }
                // Migrate kpis (JSON)
                const newKpis = await migrateJSONField(record.kpis, 'kpis', record.id, tableName);
                if (newKpis) {
                    updates.kpis = newKpis;
                    hasUpdates = true;
                }
                if (hasUpdates && !isDryRun) {
                    const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                    const values = Object.values(updates);
                    await pool.query(`UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length + 1}`, [...values, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (hasUpdates && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateStrategyVersions() {
    const tableName = 'strategy_versions';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, input_summary, analysis_data, decisions_data FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                const updates = {};
                let hasUpdates = false;
                // Encrypt input_summary (plaintext field that was never encrypted)
                const newInputSummary = await encryptPlaintextField(record.input_summary, 'input_summary', record.id, tableName);
                if (newInputSummary) {
                    updates.input_summary = newInputSummary;
                    hasUpdates = true;
                }
                // Migrate analysis_data (JSON)
                const newAnalysisData = await migrateJSONField(record.analysis_data, 'analysis_data', record.id, tableName);
                if (newAnalysisData) {
                    updates.analysis_data = newAnalysisData;
                    hasUpdates = true;
                }
                // Migrate decisions_data (JSON)
                const newDecisionsData = await migrateJSONField(record.decisions_data, 'decisions_data', record.id, tableName);
                if (newDecisionsData) {
                    updates.decisions_data = newDecisionsData;
                    hasUpdates = true;
                }
                if (hasUpdates && !isDryRun) {
                    const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
                    const values = Object.values(updates);
                    await pool.query(`UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length + 1}`, [...values, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (hasUpdates && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
async function migrateStrategicDecisions() {
    const tableName = 'strategic_decisions';
    console.log(`\n📋 Migrating ${tableName}...`);
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);
    stats.totalRecords += totalRecords;
    console.log(`  Total records: ${totalRecords}`);
    let offset = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    while (offset < totalRecords) {
        const result = await pool.query(`SELECT id, decisions_data FROM ${tableName} LIMIT $1 OFFSET $2`, [BATCH_SIZE, offset]);
        for (const record of result.rows) {
            try {
                // Migrate decisions_data (JSON)
                const newDecisionsData = await migrateJSONField(record.decisions_data, 'decisions_data', record.id, tableName);
                if (newDecisionsData && !isDryRun) {
                    await pool.query(`UPDATE ${tableName} SET decisions_data = $1 WHERE id = $2`, [newDecisionsData, record.id]);
                    migratedCount++;
                    stats.migratedRecords++;
                }
                else if (newDecisionsData && isDryRun) {
                    console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
                    migratedCount++;
                }
                else {
                    skippedCount++;
                    stats.skippedRecords++;
                }
            }
            catch (error) {
                logError(tableName, record.id, error instanceof Error ? error.message : String(error));
            }
        }
        offset += BATCH_SIZE;
        console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} records (${migratedCount} migrated, ${skippedCount} skipped)`);
    }
    console.log(`  ✅ Completed: ${migratedCount} migrated, ${skippedCount} skipped`);
}
// ==================== VERIFICATION ====================
async function verifyMigration() {
    console.log(`\n🔍 Verifying migration (sensitive fields only)...`);
    // Only verify fields that contain sensitive business data and should be encrypted
    const tables = [
        {
            name: 'strategic_understanding',
            textFields: ['user_input', 'initiative_description'],
            jsonFields: ['company_context']
        },
        {
            name: 'journey_sessions',
            textFields: [],
            jsonFields: ['accumulated_context']
        },
        {
            name: 'strategic_entities',
            textFields: ['claim', 'source'],
            jsonFields: ['evidence', 'category', 'subcategory', 'metadata']
        },
        {
            name: 'strategic_relationships',
            textFields: [],
            jsonFields: ['evidence', 'metadata']
        },
        {
            name: 'epm_programs',
            textFields: [],
            jsonFields: ['executive_summary', 'workstreams', 'timeline', 'resource_plan', 'financial_plan',
                'benefits_realization', 'risk_register', 'stakeholder_map', 'governance',
                'qa_plan', 'procurement', 'exit_strategy', 'kpis']
        },
        {
            name: 'strategy_versions',
            textFields: ['input_summary'],
            jsonFields: ['analysis_data', 'decisions_data']
        },
        {
            name: 'strategic_decisions',
            textFields: [],
            jsonFields: ['decisions_data']
        }
    ];
    let verificationErrors = 0;
    let verifiedCount = 0;
    for (const table of tables) {
        const result = await pool.query(`SELECT * FROM ${table.name} ORDER BY RANDOM() LIMIT 3`);
        for (const record of result.rows) {
            // Verify text fields
            for (const field of table.textFields) {
                const value = record[field];
                if (!value)
                    continue;
                try {
                    await decryptKMS(value);
                    console.log(`  ✅ ${table.name}.${field} (${record.id}) - Successfully decrypted with KMS`);
                    verifiedCount++;
                }
                catch (error) {
                    console.error(`  ❌ ${table.name}.${field} (${record.id}) - Failed to decrypt: ${error instanceof Error ? error.message : String(error)}`);
                    verificationErrors++;
                }
            }
            // Verify JSON fields
            for (const field of table.jsonFields) {
                const value = record[field];
                if (!value)
                    continue;
                try {
                    await decryptJSONKMS(value);
                    console.log(`  ✅ ${table.name}.${field} (${record.id}) - Successfully decrypted with KMS`);
                    verifiedCount++;
                }
                catch (error) {
                    console.error(`  ❌ ${table.name}.${field} (${record.id}) - Failed to decrypt: ${error instanceof Error ? error.message : String(error)}`);
                    verificationErrors++;
                }
            }
        }
    }
    console.log(`\n📊 Verified ${verifiedCount} sensitive fields`);
    if (verificationErrors > 0) {
        console.log(`⚠️  Verification found ${verificationErrors} errors`);
        throw new Error(`Verification failed with ${verificationErrors} errors`);
    }
    else {
        console.log(`✅ Verification passed - all sampled sensitive fields decrypt successfully with KMS`);
    }
}
// ==================== MAIN MIGRATION FUNCTION ====================
async function runMigration() {
    console.log('🔐 KMS Encryption Migration Script');
    console.log('=====================================');
    if (isDryRun) {
        console.log('⚠️  DRY-RUN MODE - No data will be modified\n');
    }
    // Clear error log file
    if (fs.existsSync(ERROR_LOG_FILE)) {
        fs.unlinkSync(ERROR_LOG_FILE);
    }
    try {
        // Validate KMS access before starting (tests generateDataKey and decryptDataKey)
        await validateKMSAccess();
        const startTime = Date.now();
        // Run migrations for each table
        await migrateStrategicUnderstanding();
        await migrateJourneySessions();
        await migrateStrategicEntities();
        await migrateStrategicRelationships();
        await migrateEPMPrograms();
        await migrateStrategyVersions();
        await migrateStrategicDecisions();
        // Run verification (always run unless dry-run to prove encryption coverage)
        if (!isDryRun) {
            await verifyMigration();
        }
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        // Print summary
        console.log('\n=====================================');
        console.log('📊 Migration Summary');
        console.log('=====================================');
        console.log(`Total records processed: ${stats.totalRecords}`);
        console.log(`Successfully migrated: ${stats.migratedRecords}`);
        console.log(`Skipped (already migrated): ${stats.skippedRecords}`);
        console.log(`Errors: ${stats.errorRecords}`);
        console.log(`Duration: ${duration}s`);
        if (stats.errorRecords > 0) {
            console.log(`\n⚠️  ${stats.errorRecords} errors occurred. Check ${ERROR_LOG_FILE} for details.`);
            console.log('\nError summary:');
            stats.errors.slice(0, 10).forEach(err => {
                console.log(`  - ${err.table} (${err.id}): ${err.error}`);
            });
            if (stats.errors.length > 10) {
                console.log(`  ... and ${stats.errors.length - 10} more errors`);
            }
        }
        if (isDryRun) {
            console.log('\n⚠️  This was a DRY-RUN. No data was modified.');
            console.log('Run without --dry-run to perform the actual migration.');
        }
        else {
            console.log('\n✅ Migration completed successfully!');
        }
    }
    catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
// Run the migration
runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=migrate-to-kms-encryption.js.map