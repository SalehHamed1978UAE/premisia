#!/usr/bin/env tsx

/**
 * ETL script to load organization data into the Knowledge Graph
 * Organizations include: government agencies, authorities, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, ETLRunTracker, NodeUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface OrganizationData {
  id: string;
  name: string;
  type: 'government' | 'authority' | 'agency' | 'private';
  url?: string;
}

async function loadOrganizations() {
  const tracker = new ETLRunTracker('organizations', 'manual-seed');

  try {
    console.log('[ETL:Organizations] Loading organizations data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/organizations.json');
    const data: OrganizationData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Organizations] Found ${data.length} organizations`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map(org => ({
      label: 'Organization',
      matchOn: { id: org.id },
      properties: {
        id: org.id,
        name: org.name,
        type: org.type,
        url: org.url,
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    tracker.complete();
    console.log('[ETL:Organizations] ✓ Organizations loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Organizations] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadOrganizations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Organizations] Fatal error:', error);
    process.exit(1);
  });

export { loadOrganizations };
