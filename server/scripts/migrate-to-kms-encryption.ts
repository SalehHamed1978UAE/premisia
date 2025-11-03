import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// OLD encryption methods
import { decrypt, decryptJSON, isEncrypted } from '../utils/encryption.js';

// NEW KMS encryption methods
import { encryptKMS, encryptJSONKMS, decryptKMS, decryptJSONKMS, generateDataKey, decryptDataKey } from '../utils/kms-encryption.js';

const BATCH_SIZE = 10;
const ERROR_LOG_FILE = 'migration-errors.log';
const isDryRun = process.argv.includes('--dry-run');

interface MigrationStats {
  totalRecords: number;
  migratedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: Array<{ table: string; id: string; error: string }>;
}

const stats: MigrationStats = {
  totalRecords: 0,
  migratedRecords: 0,
  skippedRecords: 0,
  errorRecords: 0,
  errors: [],
};

// Initialize database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper function to detect if data is in old format
function isOldFormat(data: string | null): boolean {
  if (!data) return false;
  
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
  } catch {
    // Not JSON, might be unencrypted or old format
  }
  
  return false;
}

// Helper function to log errors
function logError(table: string, id: string, error: string) {
  const errorMsg = `[${new Date().toISOString()}] Table: ${table}, ID: ${id}, Error: ${error}\n`;
  fs.appendFileSync(ERROR_LOG_FILE, errorMsg);
  stats.errors.push({ table, id, error });
  stats.errorRecords++;
}

// KMS health check before migration
async function validateKMSAccess(): Promise<void> {
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
    const decrypted = await decryptKMS(encrypted!);
    
    if (decrypted !== testData) {
      throw new Error('Encryption/decryption cycle did not match');
    }
    console.log('  ✓ Full encryption/decryption cycle successful');
    
    console.log('✅ KMS validation successful - ready to proceed with migration\n');
  } catch (error) {
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
async function migrateTextField(oldValue: string | null, fieldName: string, recordId: string, tableName: string): Promise<string | null> {
  if (!oldValue) return null;
  
  // Check if already in new format
  if (!isOldFormat(oldValue)) {
    return null; // Skip, already migrated or unencrypted
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
  } catch (error) {
    const errorMsg = `Failed to migrate ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
    logError(tableName, recordId, errorMsg);
    return null;
  }
}

// Helper function to migrate a JSON field
async function migrateJSONField(oldValue: string | null, fieldName: string, recordId: string, tableName: string): Promise<string | null> {
  if (!oldValue) return null;
  
  // Check if already in new format
  if (!isOldFormat(oldValue)) {
    return null; // Skip, already migrated or unencrypted
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
  } catch (error) {
    const errorMsg = `Failed to migrate ${fieldName}: ${error instanceof Error ? error.message : String(error)}`;
    logError(tableName, recordId, errorMsg);
    return null;
  }
}

// Helper function to encrypt plaintext fields (fields that were never encrypted)
async function encryptPlaintextField(value: string | null, fieldName: string, recordId: string, tableName: string): Promise<string | null> {
  if (!value) return null;
  
  // Check if already encrypted (either old or new format)
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'dataKeyCiphertext' in parsed) {
      // Already in KMS format, skip
      return null;
    }
  } catch {
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
  } catch (error) {
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
    const result = await pool.query(
      `SELECT id, user_input, company_context, initiative_description FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        const updates: any = {};
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
          
          await pool.query(
            `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1}`,
            [...values, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (hasUpdates && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, accumulated_context FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        // Migrate accumulated_context (JSON)
        const newAccumulatedContext = await migrateJSONField(record.accumulated_context, 'accumulated_context', record.id, tableName);
        
        if (newAccumulatedContext && !isDryRun) {
          await pool.query(
            `UPDATE ${tableName} SET accumulated_context = $1, updated_at = NOW() WHERE id = $2`,
            [newAccumulatedContext, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (newAccumulatedContext && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, claim, source, evidence, category, subcategory, metadata FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        const updates: any = {};
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
          const setClause = Object.keys(updates).map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
          const values = Object.values(updates);
          
          await pool.query(
            `UPDATE ${tableName} SET ${setClause}, "updatedAt" = NOW() WHERE id = $${values.length + 1}`,
            [...values, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (hasUpdates && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, evidence, metadata FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        const updates: any = {};
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
          const setClause = Object.keys(updates).map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
          const values = Object.values(updates);
          
          await pool.query(
            `UPDATE ${tableName} SET ${setClause}, "updatedAt" = NOW() WHERE id = $${values.length + 1}`,
            [...values, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (hasUpdates && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, "programName", "executiveSummary", workstreams, timeline, "resourcePlan", 
              "financialPlan", "benefitsRealization", "riskRegister", "stakeholderMap", 
              governance, "qaPlan", procurement, "exitStrategy", kpis 
       FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        const updates: any = {};
        let hasUpdates = false;
        
        // Migrate programName (text)
        const newProgramName = await migrateTextField(record.programName, 'programName', record.id, tableName);
        if (newProgramName) {
          updates.programName = newProgramName;
          hasUpdates = true;
        }
        
        // Migrate executiveSummary (text)
        const newExecutiveSummary = await migrateTextField(record.executiveSummary, 'executiveSummary', record.id, tableName);
        if (newExecutiveSummary) {
          updates.executiveSummary = newExecutiveSummary;
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
        
        // Migrate resourcePlan (JSON)
        const newResourcePlan = await migrateJSONField(record.resourcePlan, 'resourcePlan', record.id, tableName);
        if (newResourcePlan) {
          updates.resourcePlan = newResourcePlan;
          hasUpdates = true;
        }
        
        // Migrate financialPlan (JSON)
        const newFinancialPlan = await migrateJSONField(record.financialPlan, 'financialPlan', record.id, tableName);
        if (newFinancialPlan) {
          updates.financialPlan = newFinancialPlan;
          hasUpdates = true;
        }
        
        // Migrate benefitsRealization (JSON)
        const newBenefitsRealization = await migrateJSONField(record.benefitsRealization, 'benefitsRealization', record.id, tableName);
        if (newBenefitsRealization) {
          updates.benefitsRealization = newBenefitsRealization;
          hasUpdates = true;
        }
        
        // Migrate riskRegister (JSON)
        const newRiskRegister = await migrateJSONField(record.riskRegister, 'riskRegister', record.id, tableName);
        if (newRiskRegister) {
          updates.riskRegister = newRiskRegister;
          hasUpdates = true;
        }
        
        // Migrate stakeholderMap (JSON)
        const newStakeholderMap = await migrateJSONField(record.stakeholderMap, 'stakeholderMap', record.id, tableName);
        if (newStakeholderMap) {
          updates.stakeholderMap = newStakeholderMap;
          hasUpdates = true;
        }
        
        // Migrate governance (JSON)
        const newGovernance = await migrateJSONField(record.governance, 'governance', record.id, tableName);
        if (newGovernance) {
          updates.governance = newGovernance;
          hasUpdates = true;
        }
        
        // Migrate qaPlan (JSON)
        const newQaPlan = await migrateJSONField(record.qaPlan, 'qaPlan', record.id, tableName);
        if (newQaPlan) {
          updates.qaPlan = newQaPlan;
          hasUpdates = true;
        }
        
        // Migrate procurement (JSON)
        const newProcurement = await migrateJSONField(record.procurement, 'procurement', record.id, tableName);
        if (newProcurement) {
          updates.procurement = newProcurement;
          hasUpdates = true;
        }
        
        // Migrate exitStrategy (JSON)
        const newExitStrategy = await migrateJSONField(record.exitStrategy, 'exitStrategy', record.id, tableName);
        if (newExitStrategy) {
          updates.exitStrategy = newExitStrategy;
          hasUpdates = true;
        }
        
        // Migrate kpis (JSON)
        const newKpis = await migrateJSONField(record.kpis, 'kpis', record.id, tableName);
        if (newKpis) {
          updates.kpis = newKpis;
          hasUpdates = true;
        }
        
        if (hasUpdates && !isDryRun) {
          const setClause = Object.keys(updates).map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
          const values = Object.values(updates);
          
          await pool.query(
            `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length + 1}`,
            [...values, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (hasUpdates && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, input_summary, analysis_data, decisions_data FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        const updates: any = {};
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
          
          await pool.query(
            `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length + 1}`,
            [...values, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (hasUpdates && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
    const result = await pool.query(
      `SELECT id, decisions_data FROM ${tableName} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    
    for (const record of result.rows) {
      try {
        // Migrate decisions_data (JSON)
        const newDecisionsData = await migrateJSONField(record.decisions_data, 'decisions_data', record.id, tableName);
        
        if (newDecisionsData && !isDryRun) {
          await pool.query(
            `UPDATE ${tableName} SET decisions_data = $1 WHERE id = $2`,
            [newDecisionsData, record.id]
          );
          
          migratedCount++;
          stats.migratedRecords++;
        } else if (newDecisionsData && isDryRun) {
          console.log(`  [DRY-RUN] Would migrate record ${record.id}`);
          migratedCount++;
        } else {
          skippedCount++;
          stats.skippedRecords++;
        }
      } catch (error) {
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
  console.log(`\n🔍 Verifying migration...`);
  
  const tables = [
    { name: 'strategic_understanding', fields: ['userInput', 'companyContext', 'initiativeDescription'] },
    { name: 'journey_sessions', fields: ['accumulatedContext'] },
    { name: 'strategic_entities', fields: ['claim', 'source', 'evidence', 'category', 'subcategory', 'metadata'] },
    { name: 'strategic_relationships', fields: ['evidence', 'metadata'] },
    { name: 'epm_programs', fields: ['programName', 'executiveSummary', 'workstreams'] },
    { name: 'strategy_versions', fields: ['analysisData', 'decisionsData'] },
    { name: 'strategic_decisions', fields: ['decisionsData'] }
  ];
  
  let verificationErrors = 0;
  
  for (const table of tables) {
    const result = await pool.query(`SELECT * FROM ${table.name} ORDER BY RANDOM() LIMIT 3`);
    
    for (const record of result.rows) {
      for (const field of table.fields) {
        const value = record[field];
        
        if (!value) continue;
        
        try {
          // Try to decrypt with KMS
          if (field === 'companyContext' || field === 'accumulatedContext' || field === 'metadata' || 
              field === 'analysisData' || field === 'decisionsData' || field === 'workstreams') {
            await decryptJSONKMS(value);
          } else {
            await decryptKMS(value);
          }
          console.log(`  ✅ ${table.name}.${field} (${record.id}) - Successfully decrypted with KMS`);
        } catch (error) {
          console.error(`  ❌ ${table.name}.${field} (${record.id}) - Failed to decrypt: ${error instanceof Error ? error.message : String(error)}`);
          verificationErrors++;
        }
      }
    }
  }
  
  if (verificationErrors > 0) {
    console.log(`\n⚠️  Verification found ${verificationErrors} errors`);
  } else {
    console.log(`\n✅ Verification passed - all sampled records decrypt successfully`);
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
    
    // Run verification
    if (!isDryRun && stats.migratedRecords > 0) {
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
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
