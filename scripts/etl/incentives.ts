#!/usr/bin/env tsx

/**
 * ETL script to load incentive programs into the Knowledge Graph
 * Incentives include: ADDED, ADIO, Dubai DED programs, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, upsertRelationships, ETLRunTracker, NodeUpsert, RelUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IncentiveData {
  sourceKey: string;
  name: string;
  provider: string;
  description: string;
  eligibilitySummary?: string;
  benefits?: string[];
  url?: string;
  expiryDate?: string;
  jurisdictionId?: string;
  industryId?: string;
}

async function loadIncentives() {
  const tracker = new ETLRunTracker('incentives', 'manual-seed');

  try {
    console.log('[ETL:Incentives] Loading incentives data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/incentives.json');
    const data: IncentiveData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Incentives] Found ${data.length} incentives`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map((inc, idx) => ({
      label: 'Incentive',
      matchOn: { sourceKey: inc.sourceKey },
      properties: {
        id: `inc-${inc.sourceKey}`,
        sourceKey: inc.sourceKey,
        name: inc.name,
        provider: inc.provider,
        description: inc.description,
        eligibilitySummary: inc.eligibilitySummary,
        benefits: inc.benefits || [],
        url: inc.url,
        expiryDate: inc.expiryDate,
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    // Create relationships to jurisdictions and industries
    const relationships: RelUpsert[] = [];

    data.forEach((inc) => {
      if (inc.jurisdictionId) {
        relationships.push({
          from: { label: 'Incentive', matchOn: { sourceKey: inc.sourceKey } },
          type: 'AVAILABLE_IN',
          to: { label: 'Jurisdiction', matchOn: { id: inc.jurisdictionId } },
        });
      }

      if (inc.industryId) {
        relationships.push({
          from: { label: 'Incentive', matchOn: { sourceKey: inc.sourceKey } },
          type: 'TARGETS_INDUSTRY',
          to: { label: 'Industry', matchOn: { id: inc.industryId } },
        });
      }
    });

    if (relationships.length > 0) {
      const relsCreated = await upsertRelationships(relationships);
      tracker.addRelationshipsCreated(relsCreated);
    }

    tracker.complete();
    console.log('[ETL:Incentives] ✓ Incentives loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Incentives] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadIncentives()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Incentives] Fatal error:', error);
    process.exit(1);
  });

export { loadIncentives };
