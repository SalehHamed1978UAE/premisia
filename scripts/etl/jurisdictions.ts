#!/usr/bin/env tsx

/**
 * ETL script to load jurisdiction data into the Knowledge Graph
 * Jurisdictions include: mainland and free zones
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, upsertRelationships, ETLRunTracker, NodeUpsert, RelUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface JurisdictionData {
  id: string;
  name: string;
  type: 'mainland' | 'free_zone';
  authorityOrgId?: string;
  locationId?: string;
}

async function loadJurisdictions() {
  const tracker = new ETLRunTracker('jurisdictions', 'manual-seed');

  try {
    console.log('[ETL:Jurisdictions] Loading jurisdictions data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/jurisdictions.json');
    const data: JurisdictionData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Jurisdictions] Found ${data.length} jurisdictions`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map(jur => ({
      label: 'Jurisdiction',
      matchOn: { id: jur.id },
      properties: {
        id: jur.id,
        name: jur.name,
        type: jur.type,
        authorityOrgId: jur.authorityOrgId,
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    // Create relationships to locations if specified
    const relationships: RelUpsert[] = data
      .filter(jur => jur.locationId)
      .map(jur => ({
        from: { label: 'Jurisdiction', matchOn: { id: jur.id } },
        type: 'WITHIN' as const,
        to: { label: 'Location', matchOn: { id: jur.locationId! } },
      }));

    if (relationships.length > 0) {
      const relsCreated = await upsertRelationships(relationships);
      tracker.addRelationshipsCreated(relsCreated);
    }

    tracker.complete();
    console.log('[ETL:Jurisdictions] ✓ Jurisdictions loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Jurisdictions] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadJurisdictions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Jurisdictions] Fatal error:', error);
    process.exit(1);
  });

export { loadJurisdictions };
