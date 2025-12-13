/**
 * Context Foundry Integration
 * 
 * Provides grounded context for AI analysis by querying verified facts
 * from the Context Foundry service. This constrains LLM responses to
 * use verified data with proper source citations.
 * 
 * Based on the official Premisia <-> Context Foundry integration spec.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  confidence: number;
  source?: string;
}

export interface Relationship {
  sourceEntity: string;
  relationshipType: string;
  targetEntity: string;
  confidence: number;
}

export interface KnowledgeBoundary {
  frontierNodes: string[];
  missingTypes: string[];
  lowCoverageAreas: string[];
}

export interface ContextBundle {
  query: string;
  answer: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  confirmedEntities: Entity[];
  inferredRelationships: Relationship[];
  boundaries: KnowledgeBoundary;
  evidenceChain: Array<Record<string, unknown>>;
  sources: string[];
  isGrounded: boolean;
  focalEntity: string | null;
  timestamp: string;
}

export interface ContextFoundryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  confidenceThreshold?: number;
}

export interface VerifyResult {
  verified: boolean | null;
  confidence: number;
  evidence?: unknown[];
  note?: string;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export class ContextFoundryClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private confidenceThreshold: number;

  constructor(config: ContextFoundryConfig) {
    this.apiKey = config.apiKey;
    // Use the actual Context Foundry URL
    this.baseUrl = config.baseUrl || 'https://context-foundry-darinkishore.replit.app';
    this.timeout = config.timeout || 30000;
    this.confidenceThreshold = config.confidenceThreshold || DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Query Context Foundry for grounded context
   * @param query - Natural language question
   * @param focalEntity - Optional entity to center the query around
   * @param includeEpisodic - Include time-sensitive/recent facts
   * @returns ContextBundle with verified facts
   */
  async query(query: string, focalEntity?: string, includeEpisodic = false): Promise<ContextBundle> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const payload: Record<string, unknown> = { query };
      if (focalEntity) {
        payload.focal_entity = focalEntity;
      }
      if (includeEpisodic) {
        payload.include_episodic = true;
      }

      const response = await fetch(`${this.baseUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ContextFoundry] API error:', response.status, errorText);
        return this.createEmptyContext(query, focalEntity);
      }

      const data = await response.json();
      return this.parseResponse(query, data, focalEntity);

    } catch (error) {
      console.error('[ContextFoundry] Query failed:', error);
      return this.createEmptyContext(query, focalEntity);
    }
  }

  /**
   * Verify a factual claim against the knowledge graph
   */
  async verify(statement: string, context?: string): Promise<VerifyResult> {
    try {
      const payload: Record<string, string> = { statement };
      if (context) {
        payload.context = context;
      }

      const response = await fetch(`${this.baseUrl}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 404) {
        return { verified: null, confidence: 0, note: 'verify endpoint not available' };
      }

      if (!response.ok) {
        return { verified: null, confidence: 0, note: `API error: ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error('[ContextFoundry] Verify failed:', error);
      return { verified: null, confidence: 0, note: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // Try a simple query to validate the API key
      const response = await fetch(`${this.baseUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'test connection' })
      });
      // Accept 200 or 401 (unauthorized means endpoint works but key is bad)
      return response.ok || response.status !== 401;
    } catch {
      return false;
    }
  }

  private parseResponse(query: string, data: Record<string, unknown>, focalEntity?: string): ContextBundle {
    const tieredResults = (data.tiered_results || {}) as Record<string, unknown>;
    const confirmed = (tieredResults.confirmed || {}) as Record<string, unknown[]>;
    const inferred = (tieredResults.inferred || {}) as Record<string, unknown[]>;
    const boundariesRaw = (tieredResults.boundaries || {}) as Record<string, string[]>;

    // Parse entities - API returns 'nodes' not 'entities'
    const nodesOrEntities = (confirmed as Record<string, unknown>).nodes || (confirmed as Record<string, unknown>).entities || [];
    const entities: Entity[] = (nodesOrEntities as Record<string, unknown>[]).map(e => ({
      id: String(e.id || ''),
      type: String(e.type || ''),
      name: String(e.name || (e.properties as Record<string, unknown>)?.name || ''),
      properties: (e.properties || {}) as Record<string, unknown>,
      confidence: Number(e.confidence) || 0.5,
      source: e.source ? String(e.source) : undefined
    }));

    // Parse relationships - API returns 'edges' not 'relationships'
    const edgesOrRelationships = (inferred as Record<string, unknown>).edges || (inferred as Record<string, unknown>).relationships || [];
    const relationships: Relationship[] = (edgesOrRelationships as Record<string, unknown>[]).map(r => ({
      sourceEntity: String(r.source || ''),
      relationshipType: String(r.type || ''),
      targetEntity: String(r.target || ''),
      confidence: Number(r.confidence) || 0.5
    }));

    // Parse boundaries
    const boundaries: KnowledgeBoundary = {
      frontierNodes: (boundariesRaw.frontier_nodes || []).map(String),
      missingTypes: (boundariesRaw.missing_types || []).map(String),
      lowCoverageAreas: (boundariesRaw.low_coverage_areas || []).map(String)
    };

    // Determine confidence level
    const confidence = Number(data.confidence) || 0;
    let confidenceLevel: ConfidenceLevel;
    if (confidence >= 0.8) {
      confidenceLevel = 'high';
    } else if (confidence >= 0.6) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    // Extract sources from evidence chain
    const evidenceChain = (data.evidence_chain || []) as Record<string, unknown>[];
    const sourceSet = new Set<string>();
    evidenceChain.forEach(e => {
      if (e.source) sourceSet.add(String(e.source));
    });
    const sources = Array.from(sourceSet);

    const isGrounded = confidence >= this.confidenceThreshold && entities.length > 0;

    return {
      query,
      answer: String(data.answer || ''),
      confidence,
      confidenceLevel,
      confirmedEntities: entities,
      inferredRelationships: relationships,
      boundaries,
      evidenceChain,
      sources,
      isGrounded,
      focalEntity: focalEntity || null,
      timestamp: new Date().toISOString()
    };
  }

  private createEmptyContext(query: string, focalEntity?: string): ContextBundle {
    return {
      query,
      answer: '',
      confidence: 0,
      confidenceLevel: 'low',
      confirmedEntities: [],
      inferredRelationships: [],
      boundaries: {
        frontierNodes: [],
        missingTypes: [],
        lowCoverageAreas: []
      },
      evidenceChain: [],
      sources: [],
      isGrounded: false,
      focalEntity: focalEntity || null,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate a grounded prompt for Premisia's LLM.
 * 
 * This injects verified organizational facts into the prompt,
 * ensuring the LLM response is grounded in reality.
 */
export function groundAnalysis(
  userQuestion: string, 
  context: ContextBundle,
  analysisType: string = 'strategic'
): string {
  // Build entity context
  const entityFacts = context.confirmedEntities.map(e => {
    const confMarker = e.confidence >= 0.8 ? '✓' : '~';
    return `  ${confMarker} ${e.type}: ${e.name} (confidence: ${Math.round(e.confidence * 100)}%)`;
  });

  // Build relationship context
  const relationshipFacts = context.inferredRelationships.map(r => 
    `  - ${r.sourceEntity} --[${r.relationshipType}]--> ${r.targetEntity}`
  );

  // Build boundaries context (what we DON'T know)
  const boundaryNotes: string[] = [];
  if (context.boundaries.frontierNodes.length > 0) {
    boundaryNotes.push(`  - Knowledge boundary at: ${context.boundaries.frontierNodes.slice(0, 5).join(', ')}`);
  }
  if (context.boundaries.lowCoverageAreas.length > 0) {
    boundaryNotes.push(`  - Limited data on: ${context.boundaries.lowCoverageAreas.slice(0, 3).join(', ')}`);
  }

  return `You are a ${analysisType} consultant using Premisia. Answer the following question using ONLY the verified organizational context provided below. Do not hallucinate or invent facts.

## User Question
${userQuestion}

## Verified Context from Organization's Knowledge Graph
**Overall Confidence: ${Math.round(context.confidence * 100)}% (${context.confidenceLevel})**

### Context Foundry's Answer
${context.answer || 'No direct answer available'}

### Confirmed Entities (${context.confirmedEntities.length} found)
${entityFacts.length > 0 ? entityFacts.join('\n') : '  No entities found'}

### Relationships
${relationshipFacts.length > 0 ? relationshipFacts.join('\n') : '  No relationships found'}

### Knowledge Boundaries (what we don't know)
${boundaryNotes.length > 0 ? boundaryNotes.join('\n') : '  No significant gaps identified'}

### Sources
${context.sources.length > 0 ? context.sources.join(', ') : 'No sources available'}

## Instructions
1. Base your analysis on the verified context above
2. If confidence is below 80%, note the uncertainty
3. If the knowledge boundary limits your answer, say so explicitly
4. Do not invent facts not present in the context
5. Cite sources when making specific claims

## Your Analysis:`;
}

/**
 * Format Context Bundle for inclusion in a Premisia report.
 * Returns markdown-formatted findings section.
 */
export function formatForReport(context: ContextBundle, sectionTitle?: string): string {
  const title = sectionTitle || 'Findings from Organizational Knowledge Graph';
  
  const lines: string[] = [
    `## ${title}`,
    '',
    `**Query:** ${context.query}`,
    `**Confidence:** ${Math.round(context.confidence * 100)}%`,
    ''
  ];

  if (context.confirmedEntities.length > 0) {
    lines.push('### Verified Entities');
    const highConfEntities = context.confirmedEntities.filter(e => e.confidence >= 0.8);
    for (const e of highConfEntities) {
      lines.push(`- **${e.name}** (${e.type})`);
      for (const [key, val] of Object.entries(e.properties)) {
        if (key !== 'name' && val) {
          lines.push(`  - ${key}: ${val}`);
        }
      }
    }
    lines.push('');
  }

  if (context.sources.length > 0) {
    lines.push('### Sources');
    for (const src of context.sources) {
      lines.push(`- ${src}`);
    }
    lines.push('');
  }

  if (context.boundaries.lowCoverageAreas.length > 0) {
    lines.push('### Data Limitations');
    lines.push(`Limited information available on: ${context.boundaries.lowCoverageAreas.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Singleton instance - initialized when API key is available
let clientInstance: ContextFoundryClient | null = null;

/**
 * Get or create the Context Foundry client instance
 */
export function getContextFoundryClient(): ContextFoundryClient | null {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.CONTEXT_FOUNDRY_API_KEY;
  if (!apiKey) {
    console.warn('[ContextFoundry] API key not configured. Set CONTEXT_FOUNDRY_API_KEY environment variable.');
    return null;
  }

  clientInstance = new ContextFoundryClient({ apiKey });
  return clientInstance;
}

/**
 * Query Context Foundry with automatic client initialization
 * Returns null if client is not configured
 */
export async function queryContext(query: string, focalEntity?: string): Promise<ContextBundle | null> {
  const client = getContextFoundryClient();
  if (!client) {
    return null;
  }
  return client.query(query, focalEntity);
}
