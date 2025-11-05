#!/usr/bin/env tsx

/**
 * ETL script to load regulation data into the Knowledge Graph
 * Regulations include: PDPL, Emiratisation, corporate tax, etc.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upsertNodes, upsertRelationships, ETLRunTracker, NodeUpsert, RelUpsert } from './common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RegulationData {
  sourceKey: string;
  title: string;
  authority: string;
  summary: string;
  effectiveDate?: string;
  url?: string;
  jurisdictionId?: string;
  industryId?: string;
}

async function loadRegulations() {
  const tracker = new ETLRunTracker('regulations', 'manual-seed');

  try {
    console.log('[ETL:Regulations] Loading regulations data...');
    
    // Read data file
    const dataPath = path.join(__dirname, 'data/regulations.json');
    const data: RegulationData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    
    console.log(`[ETL:Regulations] Found ${data.length} regulations`);

    // Prepare nodes
    const now = new Date().toISOString();
    const nodes: NodeUpsert[] = data.map((reg) => ({
      label: 'Regulation',
      matchOn: { sourceKey: reg.sourceKey },
      properties: {
        id: `reg-${reg.sourceKey}`,
        sourceKey: reg.sourceKey,
        title: reg.title,
        authority: reg.authority,
        summary: reg.summary,
        effectiveDate: reg.effectiveDate,
        url: reg.url,
        dataSource: 'manual-seed',
        retrievedAt: now,
      },
    }));

    // Upsert nodes
    const nodesCreated = await upsertNodes(nodes);
    tracker.addNodesCreated(nodesCreated);

    // Create relationships to jurisdictions and industries
    const relationships: RelUpsert[] = [];

    data.forEach((reg) => {
      if (reg.jurisdictionId) {
        relationships.push({
          from: { label: 'Regulation', matchOn: { sourceKey: reg.sourceKey } },
          type: 'CONSTRAINED_BY',
          to: { label: 'Jurisdiction', matchOn: { id: reg.jurisdictionId } },
        });
      }

      if (reg.industryId) {
        relationships.push({
          from: { label: 'Regulation', matchOn: { sourceKey: reg.sourceKey } },
          type: 'TARGETS_INDUSTRY',
          to: { label: 'Industry', matchOn: { id: reg.industryId } },
        });
      }
    });

    if (relationships.length > 0) {
      const relsCreated = await upsertRelationships(relationships);
      tracker.addRelationshipsCreated(relsCreated);
    }

    tracker.complete();
    console.log('[ETL:Regulations] ✓ Regulations loaded successfully');

  } catch (error) {
    tracker.fail(error as Error);
    console.error('[ETL:Regulations] ✗ Failed:', error);
    throw error;
  }
}

// Run if called directly
loadRegulations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ETL:Regulations] Fatal error:', error);
    process.exit(1);
  });

export { loadRegulations };
