#!/usr/bin/env tsx

/**
 * ETL script to load industry data into the Knowledge Graph
 * Industries include: F&B, retail, software, fintech, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, ETLRunTracker, NodeUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IndustryData {
  id: string;
  name: string;
  code?: string;
  aliases?: string[];
}

async function loadIndustries() {
  const tracker = new ETLRunTracker('industries', 'manual-seed');

  try {
    console.log('[ETL:Industries] Loading industries data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/industries.json');
    const data: IndustryData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Industries] Found ${data.length} industries`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map(ind => ({
      label: 'Industry',
      matchOn: { id: ind.id },
      properties: {
        id: ind.id,
        name: ind.name,
        code: ind.code,
        aliases: ind.aliases || [],
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    tracker.complete();
    console.log('[ETL:Industries] ✓ Industries loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Industries] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadIndustries()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Industries] Fatal error:', error);
    process.exit(1);
  });

export { loadIndustries };
