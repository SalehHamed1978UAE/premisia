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

import { db } from '../db';
import { strategyVersions } from '@shared/schema';
import { encryptJSONKMS } from '../utils/kms-encryption';
import { eq, sql } from 'drizzle-orm';

interface MigrationStats {
  total: number;
  encrypted: number;
  skipped: number;
  failed: number;
}

const stats: MigrationStats = {
  total: 0,
  encrypted: 0,
  skipped: 0,
  failed: 0
};

async function isPlaintextJSON(value: any): Promise<boolean> {
  if (!value) return false;
  
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  
  // Check if it looks like encrypted data (has dataKeyCiphertext)
  if (valueStr.includes('dataKeyCiphertext') || valueStr.includes('ciphertext')) {
    return false;
  }
  
  // Check if it looks like business data
  if (valueStr.includes('primary_customer_segment') || 
      valueStr.includes('revenue_model') ||
      valueStr.includes('cost_structure') ||
      valueStr.includes('bmc_research') ||
      valueStr.includes('five_whys')) {
    return true;
  }
  
  return false;
}

async function encryptStrategyVersions(dryRun: boolean, batchSize: number) {
  console.log('\n🔍 Checking strategy_versions for plaintext data...\n');
  
  // Get all strategy versions with non-null analysisData or decisionsData
  const versions = await db.select({
    id: strategyVersions.id,
    analysisData: strategyVersions.analysisData,
    decisionsData: strategyVersions.decisionsData,
    createdAt: strategyVersions.createdAt
  })
  .from(strategyVersions)
  .where(sql`${strategyVersions.analysisData} IS NOT NULL OR ${strategyVersions.decisionsData} IS NOT NULL`);
  
  stats.total = versions.length;
  console.log(`Found ${versions.length} records with analysis or decisions data\n`);
  
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
      
      console.log(`[${processed}/${versions.length}] ID: ${version.id.substring(0, 8)}...`);
      
      if (needsUpdate.analysisData) {
        console.log(`  ⚠️  analysisData contains plaintext`);
      }
      if (needsUpdate.decisionsData) {
        console.log(`  ⚠️  decisionsData contains plaintext`);
      }
      
      if (dryRun) {
        console.log(`  ℹ️  DRY RUN: Would encrypt this record`);
        stats.encrypted++;
        continue;
      }
      
      // Encrypt the fields
      const updateData: any = {};
      
      if (needsUpdate.analysisData && version.analysisData) {
        updateData.analysisData = await encryptJSONKMS(version.analysisData);
        console.log(`  ✅ Encrypted analysisData`);
      }
      
      if (needsUpdate.decisionsData && version.decisionsData) {
        updateData.decisionsData = await encryptJSONKMS(version.decisionsData);
        console.log(`  ✅ Encrypted decisionsData`);
      }
      
      // Update the record
      await db.update(strategyVersions)
        .set(updateData)
        .where(eq(strategyVersions.id, version.id));
      
      stats.encrypted++;
      console.log(`  ✅ Record updated successfully\n`);
      
      // Batch processing pause
      if (processed % batchSize === 0) {
        console.log(`  ⏸️  Processed ${processed} records, pausing briefly...\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      stats.failed++;
      console.error(`  ❌ Error encrypting record ${version.id}:`, error);
      console.error(`     Continuing with next record...\n`);
    }
  }
}

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
  
  const startTime = Date.now();
  
  try {
    await encryptStrategyVersions(dryRun, batchSize);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
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
    } else if (stats.failed > 0) {
      console.log('⚠️  Some records failed to encrypt. Check the logs above for details.');
      process.exit(1);
    } else {
      console.log('✅ All plaintext data has been encrypted successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);
    process.exit(1);
  }
}

main();
