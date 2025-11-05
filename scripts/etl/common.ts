/**
 * Common ETL utilities for Knowledge Graph data ingestion
 * Provides reusable functions for node/relationship upserts and provenance tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession } from '../../server/config/neo4j';
import { NodeUpsert, RelUpsert, ETLRun } from '../../shared/knowledge-graph-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { NodeUpsert, RelUpsert };

const ETL_RUNS_FILE = path.join(__dirname, '../output/etl_runs.csv');

/**
 * Ensure ETL runs CSV file exists with headers
 */
function ensureETLRunsFile() {
  const dir = path.dirname(ETL_RUNS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(ETL_RUNS_FILE)) {
    fs.writeFileSync(ETL_RUNS_FILE, 'id,scriptName,dataSource,startedAt,completedAt,status,nodesCreated,relationshipsCreated,errors\n');
  }
}

/**
 * Log ETL run to CSV file
 */
export function logETLRun(run: ETLRun): void {
  ensureETLRunsFile();
  
  const row = [
    run.id,
    run.scriptName,
    run.dataSource,
    run.startedAt,
    run.completedAt || '',
    run.status,
    run.nodesCreated,
    run.relationshipsCreated,
    (run.errors || []).join('; '),
  ].join(',');

  fs.appendFileSync(ETL_RUNS_FILE, row + '\n');
}

/**
 * Generic function to upsert nodes using UNWIND + MERGE pattern
 */
export async function upsertNodes(nodes: NodeUpsert[]): Promise<number> {
  if (nodes.length === 0) return 0;

  const session = createSession();
  let totalCreated = 0;

  try {
    // Group nodes by label for efficient processing
    const nodesByLabel = nodes.reduce((acc, node) => {
      if (!acc[node.label]) acc[node.label] = [];
      acc[node.label].push(node);
      return acc;
    }, {} as Record<string, NodeUpsert[]>);

    for (const [label, labelNodes] of Object.entries(nodesByLabel)) {
      // Determine match property (id, extId, or sourceKey)
      const sampleNode = labelNodes[0];
      const matchKey = sampleNode.matchOn.id ? 'id' 
        : sampleNode.matchOn.extId ? 'extId'
        : sampleNode.matchOn.sourceKey ? 'sourceKey'
        : 'id';

      const query = `
        UNWIND $batch as row
        MERGE (n:${label} {${matchKey}: row.matchValue})
        SET n += row.properties
        RETURN count(n) as created
      `;

      const batch = labelNodes.map(node => ({
        matchValue: node.matchOn.id || node.matchOn.extId || node.matchOn.sourceKey,
        properties: node.properties,
      }));

      const result = await session.run(query, { batch });
      const created = result.records[0]?.get('created').toNumber() || 0;
      totalCreated += created;
      console.log(`[ETL] Upserted ${created} ${label} nodes`);
    }

    return totalCreated;
  } finally {
    await session.close();
  }
}

/**
 * Generic function to upsert relationships using MERGE pattern
 */
export async function upsertRelationships(rels: RelUpsert[]): Promise<number> {
  if (rels.length === 0) return 0;

  const session = createSession();
  let created = 0;

  try {
    for (const rel of rels) {
      // Determine match keys
      const fromKey = rel.from.matchOn.id ? 'id'
        : rel.from.matchOn.extId ? 'extId'
        : rel.from.matchOn.sourceKey ? 'sourceKey'
        : 'id';
      
      const toKey = rel.to.matchOn.id ? 'id'
        : rel.to.matchOn.extId ? 'extId'
        : rel.to.matchOn.sourceKey ? 'sourceKey'
        : 'id';

      const fromValue = rel.from.matchOn.id || rel.from.matchOn.extId || rel.from.matchOn.sourceKey;
      const toValue = rel.to.matchOn.id || rel.to.matchOn.extId || rel.to.matchOn.sourceKey;

      const query = `
        MATCH (from:${rel.from.label} {${fromKey}: $fromValue})
        MATCH (to:${rel.to.label} {${toKey}: $toValue})
        MERGE (from)-[r:${rel.type}]->(to)
        ${rel.properties ? 'SET r += $properties' : ''}
        RETURN count(r) as created
      `;

      const result = await session.run(query, {
        fromValue,
        toValue,
        properties: rel.properties || {},
      });
      
      created += result.records[0]?.get('created').toNumber() || 0;
    }
    
    console.log(`[ETL] Upserted ${created} relationships`);
    return created;
  } finally {
    await session.close();
  }
}

/**
 * Create an ETL run tracker
 */
export class ETLRunTracker {
  private run: ETLRun;

  constructor(scriptName: string, dataSource: string) {
    this.run = {
      id: `${scriptName}-${Date.now()}`,
      scriptName,
      dataSource,
      startedAt: new Date().toISOString(),
      status: 'running',
      nodesCreated: 0,
      relationshipsCreated: 0,
      errors: [],
    };

    console.log(`[ETL] Starting run: ${this.run.id}`);
  }

  addNodesCreated(count: number) {
    this.run.nodesCreated += count;
  }

  addRelationshipsCreated(count: number) {
    this.run.relationshipsCreated += count;
  }

  addError(error: string) {
    if (!this.run.errors) this.run.errors = [];
    this.run.errors.push(error);
  }

  complete() {
    this.run.completedAt = new Date().toISOString();
    this.run.status = this.run.errors && this.run.errors.length > 0 ? 'failed' : 'completed';
    
    logETLRun(this.run);
    
    console.log(`[ETL] Run complete: ${this.run.id}`);
    console.log(`[ETL]   Nodes created: ${this.run.nodesCreated}`);
    console.log(`[ETL]   Relationships created: ${this.run.relationshipsCreated}`);
    console.log(`[ETL]   Status: ${this.run.status}`);
    
    if (this.run.errors && this.run.errors.length > 0) {
      console.log(`[ETL]   Errors: ${this.run.errors.length}`);
    }
  }

  fail(error: Error) {
    this.addError(error.message);
    this.run.completedAt = new Date().toISOString();
    this.run.status = 'failed';
    
    logETLRun(this.run);
    
    console.error(`[ETL] Run failed: ${this.run.id}`);
    console.error(`[ETL]   Error: ${error.message}`);
  }
}
