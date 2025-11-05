#!/usr/bin/env tsx

/**
 * ETL script to load location data into the Knowledge Graph
 * Locations include: countries, emirates, cities, districts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, upsertRelationships, ETLRunTracker, NodeUpsert, RelUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LocationData {
  id: string;
  name: string;
  type: 'district' | 'city' | 'emirate' | 'country';
  lat?: number;
  lng?: number;
  parentId?: string;
  aliases?: string[];
}

async function loadLocations() {
  const tracker = new ETLRunTracker('locations', 'manual-seed');

  try {
    console.log('[ETL:Locations] Loading locations data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/locations.json');
    const data: LocationData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Locations] Found ${data.length} locations`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map(loc => ({
      label: 'Location',
      matchOn: { id: loc.id },
      properties: {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        lat: loc.lat,
        lng: loc.lng,
        aliases: loc.aliases || [],
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    // Create WITHIN relationships for hierarchical structure
    const relationships: RelUpsert[] = data
      .filter(loc => loc.parentId)
      .map(loc => ({
        from: { label: 'Location', matchOn: { id: loc.id } },
        type: 'WITHIN' as const,
        to: { label: 'Location', matchOn: { id: loc.parentId! } },
      }));

    if (relationships.length > 0) {
      const relsCreated = await upsertRelationships(relationships);
      tracker.addRelationshipsCreated(relsCreated);
    }

    tracker.complete();
    console.log('[ETL:Locations] ✓ Locations loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Locations] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadLocations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Locations] Fatal error:', error);
    process.exit(1);
  });

export { loadLocations };
