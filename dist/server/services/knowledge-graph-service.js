/**
 * Knowledge Graph Service
 * Provides high-level functions for interacting with the Neo4j Decision Support Knowledge Graph
 */
import { createSession } from '../config/neo4j';
/**
 * Generic function to upsert nodes using UNWIND + MERGE pattern
 * This is efficient for batch operations
 */
export async function upsertNodes(nodes) {
    if (nodes.length === 0)
        return;
    const session = createSession();
    try {
        // Group nodes by label for efficient processing
        const nodesByLabel = nodes.reduce((acc, node) => {
            if (!acc[node.label])
                acc[node.label] = [];
            acc[node.label].push(node);
            return acc;
        }, {});
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
            console.log(`[KG Service] Upserted ${created} ${label} nodes`);
        }
    }
    finally {
        await session.close();
    }
}
/**
 * Generic function to upsert relationships using MERGE pattern
 */
export async function upsertRelationships(rels) {
    if (rels.length === 0)
        return;
    const session = createSession();
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
            await session.run(query, {
                fromValue,
                toValue,
                properties: rel.properties || {},
            });
        }
        console.log(`[KG Service] Upserted ${rels.length} relationships`);
    }
    finally {
        await session.close();
    }
}
/**
 * Upsert a journey session node
 */
export async function upsertJourneySession(data) {
    const nodes = [{
            label: 'JourneySession',
            matchOn: { id: data.id },
            properties: data,
        }];
    await upsertNodes(nodes);
    // Create relationships to Location, Jurisdiction, Industry if provided
    const rels = [];
    if (data.locationId) {
        rels.push({
            from: { label: 'JourneySession', matchOn: { id: data.id } },
            type: 'LOCATED_IN',
            to: { label: 'Location', matchOn: { id: data.locationId } },
        });
    }
    if (data.jurisdictionId) {
        rels.push({
            from: { label: 'JourneySession', matchOn: { id: data.id } },
            type: 'UNDER',
            to: { label: 'Jurisdiction', matchOn: { id: data.jurisdictionId } },
        });
    }
    if (data.industryId) {
        rels.push({
            from: { label: 'JourneySession', matchOn: { id: data.id } },
            type: 'TARGETS_INDUSTRY',
            to: { label: 'Industry', matchOn: { id: data.industryId } },
        });
    }
    if (rels.length > 0) {
        await upsertRelationships(rels);
    }
}
/**
 * Upsert framework output node and link to journey
 */
export async function upsertFrameworkOutput(data) {
    const nodes = [{
            label: 'FrameworkOutput',
            matchOn: { id: data.id },
            properties: data,
        }];
    await upsertNodes(nodes);
    // Link to journey
    const rels = [{
            from: { label: 'JourneySession', matchOn: { id: data.journeyId } },
            type: 'PRODUCED_FRAMEWORK',
            to: { label: 'FrameworkOutput', matchOn: { id: data.id } },
        }];
    await upsertRelationships(rels);
}
/**
 * Upsert a decision node and link to journey
 */
export async function upsertDecision(data) {
    const nodes = [{
            label: 'Decision',
            matchOn: { id: data.id },
            properties: data,
        }];
    await upsertNodes(nodes);
    // Link to journey (implicit via decisionId in options)
}
/**
 * Upsert decision options and link to decision
 */
export async function upsertDecisionOptions(data) {
    if (data.length === 0)
        return;
    const nodes = data.map(option => ({
        label: 'DecisionOption',
        matchOn: { id: option.id },
        properties: option,
    }));
    await upsertNodes(nodes);
    // Create relationships to parent decision
    const rels = data.map(option => ({
        from: { label: 'Decision', matchOn: { id: option.decisionId } },
        type: 'HAS_CRITERION',
        to: { label: 'DecisionOption', matchOn: { id: option.id } },
    }));
    await upsertRelationships(rels);
}
/**
 * Upsert a program node and link to journey
 */
export async function upsertProgram(data) {
    const nodes = [{
            label: 'Program',
            matchOn: { id: data.id },
            properties: data,
        }];
    await upsertNodes(nodes);
    // Link to journey
    const rels = [{
            from: { label: 'JourneySession', matchOn: { id: data.journeyId } },
            type: 'GENERATED_PROGRAM',
            to: { label: 'Program', matchOn: { id: data.id } },
        }];
    if (data.locationId) {
        rels.push({
            from: { label: 'Program', matchOn: { id: data.id } },
            type: 'LOCATED_IN',
            to: { label: 'Location', matchOn: { id: data.locationId } },
        });
    }
    await upsertRelationships(rels);
}
/**
 * Link a journey to multiple incentives
 */
export async function linkJourneyToIncentives(journeyId, incentiveIds) {
    if (incentiveIds.length === 0)
        return;
    const rels = incentiveIds.map(incentiveId => ({
        from: { label: 'Program', matchOn: { id: journeyId } },
        type: 'ELIGIBLE_FOR',
        to: { label: 'Incentive', matchOn: { id: incentiveId } },
    }));
    await upsertRelationships(rels);
}
/**
 * Link a journey to multiple regulations
 */
export async function linkJourneyToRegulations(journeyId, regulationIds) {
    if (regulationIds.length === 0)
        return;
    const rels = regulationIds.map(regulationId => ({
        from: { label: 'Program', matchOn: { id: journeyId } },
        type: 'CONSTRAINED_BY',
        to: { label: 'Regulation', matchOn: { id: regulationId } },
    }));
    await upsertRelationships(rels);
}
/**
 * Create evidence links for a decision
 */
export async function createEvidenceLinks(decisionId, evidenceList) {
    if (evidenceList.length === 0)
        return;
    // Create evidence nodes
    const evidenceNodes = evidenceList.map(evidence => ({
        label: 'Evidence',
        matchOn: { id: evidence.id },
        properties: {
            ...evidence,
            createdAt: new Date().toISOString(),
        },
    }));
    await upsertNodes(evidenceNodes);
    // Link evidence to decision
    const decisionRels = evidenceList.map(evidence => ({
        from: { label: 'Decision', matchOn: { id: decisionId } },
        type: 'SUPPORTED_BY',
        to: { label: 'Evidence', matchOn: { id: evidence.id } },
    }));
    await upsertRelationships(decisionRels);
    // Link evidence to references if provided
    const referenceRels = evidenceList
        .filter(e => e.referenceId)
        .map(evidence => ({
        from: { label: 'Evidence', matchOn: { id: evidence.id } },
        type: 'CITES',
        to: { label: 'Reference', matchOn: { id: evidence.referenceId } },
    }));
    if (referenceRels.length > 0) {
        await upsertRelationships(referenceRels);
    }
}
/**
 * Find similar journeys based on location, industry, and optional root cause
 */
export async function getSimilarJourneys(params) {
    const { locationId, industryId, rootCause, limit = 10 } = params;
    const session = createSession();
    try {
        const query = `
      MATCH (j:JourneySession)
      ${locationId ? 'MATCH (j)-[:LOCATED_IN]->(loc:Location {id: $locationId})' : ''}
      ${industryId ? 'MATCH (j)-[:TARGETS_INDUSTRY]->(ind:Industry {id: $industryId})' : ''}
      OPTIONAL MATCH (j)-[:LOCATED_IN]->(location:Location)
      OPTIONAL MATCH (j)-[:TARGETS_INDUSTRY]->(industry:Industry)
      OPTIONAL MATCH (j)-[:GENERATED_PROGRAM]->(p:Program)
      OPTIONAL MATCH (j)-[:PRODUCED_FRAMEWORK]->(f:FrameworkOutput)
      RETURN j.id as id,
             j.journeyType as journeyType,
             j.versionNumber as versionNumber,
             j.createdAt as createdAt,
             location.name as locationName,
             industry.name as industryName,
             p.status as programStatus,
             collect(DISTINCT f.framework) as frameworks
      ORDER BY j.createdAt DESC
      LIMIT $limit
    `;
        const result = await session.run(query, { locationId, industryId, limit });
        return result.records.map(record => ({
            id: record.get('id'),
            journeyType: record.get('journeyType'),
            locationName: record.get('locationName'),
            industryName: record.get('industryName'),
            versionNumber: record.get('versionNumber'),
            createdAt: record.get('createdAt'),
            programStatus: record.get('programStatus'),
            frameworks: record.get('frameworks'),
        }));
    }
    finally {
        await session.close();
    }
}
/**
 * Get available incentives for a jurisdiction and industry
 */
export async function getAvailableIncentives(params) {
    const { jurisdictionId, industryId, limit = 20 } = params;
    const session = createSession();
    try {
        const query = `
      MATCH (i:Incentive)
      ${jurisdictionId ? 'MATCH (i)-[:AVAILABLE_IN]->(j:Jurisdiction {id: $jurisdictionId})' : ''}
      WHERE i.expiryDate IS NULL OR datetime(i.expiryDate) > datetime()
      RETURN i.id as id,
             i.name as name,
             i.provider as provider,
             i.description as description,
             i.eligibilitySummary as eligibilitySummary,
             i.benefits as benefits,
             i.url as url,
             i.expiryDate as expiryDate
      ORDER BY i.name
      LIMIT $limit
    `;
        const result = await session.run(query, { jurisdictionId, limit });
        return result.records.map(record => ({
            id: record.get('id'),
            name: record.get('name'),
            provider: record.get('provider'),
            description: record.get('description'),
            eligibilitySummary: record.get('eligibilitySummary'),
            benefits: record.get('benefits'),
            url: record.get('url'),
            expiryDate: record.get('expiryDate'),
        }));
    }
    finally {
        await session.close();
    }
}
/**
 * Check if a journey session already exists in the Knowledge Graph
 */
export async function checkJourneySessionExists(sessionId) {
    const session = createSession();
    try {
        const query = `
      MATCH (j:JourneySession {id: $sessionId})
      RETURN count(j) > 0 as exists
    `;
        const result = await session.run(query, { sessionId });
        return result.records[0]?.get('exists') || false;
    }
    finally {
        await session.close();
    }
}
/**
 * Get all insights for a session (aggregator function)
 * Combines similar journeys, incentives, and regulations in a single call
 */
export async function getInsightsForSession(sessionId, params) {
    const { locationId, industryId, jurisdictionId, rootCause } = params;
    // Fetch similar journeys and incentives in parallel
    const [similarStrategies, incentives] = await Promise.all([
        getSimilarJourneys({
            locationId,
            industryId,
            rootCause,
            limit: 3, // Top 3 similar strategies
        }),
        getAvailableIncentives({
            jurisdictionId,
            industryId,
            locationId,
            limit: 10, // Top 10 incentives
        }),
    ]);
    // TODO: Add regulations query when regulation data is available
    const regulations = [];
    return {
        similarStrategies,
        incentives,
        regulations,
    };
}
/**
 * Close the Neo4j driver connection
 */
export async function closeDriver() {
    const { closeNeo4j } = await import('../config/neo4j.js');
    await closeNeo4j();
}
//# sourceMappingURL=knowledge-graph-service.js.map