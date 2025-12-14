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

export type CFQueryStatus = 'RESOLVED' | 'AMBIGUOUS' | 'NO_MATCHES';

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

export interface ResolvedEntity {
  entity_id: string;
  name: string;
  confidence?: number;
}

export interface EntityResolution {
  selected?: ResolvedEntity;
  candidates?: ResolvedEntity[];
}

export interface CFV1Answer {
  grounded_facts: Array<Record<string, unknown>>;
  gaps: string[];
}

export interface CFV1Response {
  status: CFQueryStatus;
  entity_resolution?: EntityResolution;
  answer?: CFV1Answer;
  confidence: number;
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
  resolvedEntity: ResolvedEntity | null;
  resolutionStatus: CFQueryStatus;
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
    this.baseUrl = config.baseUrl || 'https://1ccacfa5-76d6-4bc8-b11c-e8a59e39c1f1-00-i16a1ywb4a3m.riker.replit.dev';
    this.timeout = config.timeout || 30000;
    this.confidenceThreshold = config.confidenceThreshold || DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Query Context Foundry for grounded context using the new /api/v1/query endpoint
   * @param rawText - Raw user text (CF handles entity extraction internally)
   * @param analysisType - Type of analysis being performed
   * @param sessionContext - Optional session context for tracking
   * @returns ContextBundle with verified facts
   */
  async query(rawText: string, analysisType: string = 'root_cause', sessionContext?: { userId?: string; sessionId?: string }): Promise<ContextBundle> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const payload: Record<string, unknown> = {
        query: rawText,
        analysis_type: analysisType,
        context: {
          app_id: 'premisia',
          user_id: sessionContext?.userId || 'anonymous',
          session_id: sessionContext?.sessionId || 'default'
        }
      };

      console.log(`[ContextFoundry] Querying /api/v1/query with raw text: "${rawText.substring(0, 100)}..."`);

      const response = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-API-Key': this.apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ContextFoundry] API error:', response.status, errorText);
        return this.createEmptyContext(rawText);
      }

      const data = await response.json() as CFV1Response;
      return this.parseV1Response(rawText, data);

    } catch (error) {
      console.error('[ContextFoundry] Query failed:', error);
      return this.createEmptyContext(rawText);
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
          'X-CF-API-Key': this.apiKey
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
      const response = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-API-Key': this.apiKey
        },
        body: JSON.stringify({ 
          query: 'test connection',
          analysis_type: 'root_cause',
          context: { app_id: 'premisia' }
        })
      });
      return response.ok || response.status !== 401;
    } catch {
      return false;
    }
  }

  /**
   * Parse V1 API response format
   */
  private parseV1Response(query: string, data: CFV1Response): ContextBundle {
    const status = data.status || 'NO_MATCHES';
    const confidence = data.confidence || 0;
    
    let confidenceLevel: ConfidenceLevel;
    if (confidence >= 0.8) {
      confidenceLevel = 'high';
    } else if (confidence >= 0.6) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    const resolvedEntity = data.entity_resolution?.selected || null;
    const groundedFacts = data.answer?.grounded_facts || [];
    const gaps = data.answer?.gaps || [];

    const entities: Entity[] = [];
    if (resolvedEntity) {
      entities.push({
        id: resolvedEntity.entity_id,
        type: 'resolved_entity',
        name: resolvedEntity.name,
        properties: {},
        confidence: resolvedEntity.confidence || confidence,
        source: 'context_foundry'
      });
    }

    for (const fact of groundedFacts) {
      if (fact.entity_id && fact.name) {
        entities.push({
          id: String(fact.entity_id),
          type: String(fact.type || 'fact'),
          name: String(fact.name),
          properties: fact as Record<string, unknown>,
          confidence: Number(fact.confidence) || confidence,
          source: 'context_foundry'
        });
      }
    }

    const isGrounded = status === 'RESOLVED' && confidence >= this.confidenceThreshold;

    console.log(`[ContextFoundry] V1 Response: status=${status}, confidence=${confidence}, resolvedEntity=${resolvedEntity?.name || 'none'}, isGrounded=${isGrounded}`);

    return {
      query,
      answer: resolvedEntity ? `Resolved entity: ${resolvedEntity.name}` : '',
      confidence,
      confidenceLevel,
      confirmedEntities: entities,
      inferredRelationships: [],
      boundaries: {
        frontierNodes: [],
        missingTypes: [],
        lowCoverageAreas: gaps
      },
      evidenceChain: groundedFacts,
      sources: ['context_foundry'],
      isGrounded,
      resolvedEntity,
      resolutionStatus: status,
      timestamp: new Date().toISOString()
    };
  }

  private createEmptyContext(query: string): ContextBundle {
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
      resolvedEntity: null,
      resolutionStatus: 'NO_MATCHES',
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
 * Query Context Foundry with automatic client initialization using V1 API
 * @param rawText - Raw user text (CF handles entity extraction internally)
 * @param analysisType - Type of analysis: 'root_cause', 'porters', 'bmc', etc.
 * @param sessionContext - Optional session context for tracking
 * @returns ContextBundle with verified facts or null if not configured
 */
export async function queryContext(
  rawText: string, 
  analysisType: string = 'root_cause',
  sessionContext?: { userId?: string; sessionId?: string }
): Promise<ContextBundle | null> {
  const client = getContextFoundryClient();
  if (!client) {
    return null;
  }
  console.log(`[Orchestrator] Querying Context Foundry with raw text: "${rawText.substring(0, 100)}..."`);
  return client.query(rawText, analysisType, sessionContext);
}
