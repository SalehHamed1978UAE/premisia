/**
 * Context Foundry Integration
 * 
 * Provides grounded context for AI analysis by querying verified facts
 * from the Context Foundry service. This constrains LLM responses to
 * use verified data with proper source citations.
 */

export interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  confidence: number;
  sources: string[];
}

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  attributes: Record<string, unknown>;
  confidence: number;
  sources: string[];
}

export interface Boundary {
  type: 'temporal' | 'geographic' | 'domain' | 'organizational';
  value: string;
  description: string;
}

export interface ContextBundle {
  entities: Entity[];
  relationships: Relationship[];
  boundaries: Boundary[];
  confidence: number;
  sources: string[];
  focalEntity: string | null;
  query: string;
  timestamp: string;
  isGrounded: boolean;
}

export interface ContextFoundryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class ContextFoundryClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ContextFoundryConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.contextfoundry.com/v1';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Query Context Foundry for grounded context
   * @param query - The analysis query (e.g., "operational risks")
   * @param focalEntity - Optional focal entity to center the query around
   * @returns ContextBundle with verified facts
   */
  async query(query: string, focalEntity?: string): Promise<ContextBundle> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/context/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'premisia-platform'
        },
        body: JSON.stringify({
          query,
          focal_entity: focalEntity,
          include_relationships: true,
          include_boundaries: true,
          max_entities: 50,
          min_confidence: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ContextFoundry] API error:', response.status, errorText);
        
        // Return empty grounded context on error
        return this.createEmptyContext(query, focalEntity);
      }

      const data = await response.json();
      
      return {
        entities: data.entities || [],
        relationships: data.relationships || [],
        boundaries: data.boundaries || [],
        confidence: data.confidence || 0,
        sources: data.sources || [],
        focalEntity: focalEntity || null,
        query,
        timestamp: new Date().toISOString(),
        isGrounded: (data.entities?.length > 0) || (data.relationships?.length > 0)
      };

    } catch (error) {
      console.error('[ContextFoundry] Query failed:', error);
      return this.createEmptyContext(query, focalEntity);
    }
  }

  /**
   * Check if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private createEmptyContext(query: string, focalEntity?: string): ContextBundle {
    return {
      entities: [],
      relationships: [],
      boundaries: [],
      confidence: 0,
      sources: [],
      focalEntity: focalEntity || null,
      query,
      timestamp: new Date().toISOString(),
      isGrounded: false
    };
  }
}

/**
 * Generate a prompt that constrains the LLM to use verified facts
 * from the Context Foundry context bundle
 */
export function groundAnalysis(userQuestion: string, context: ContextBundle): string {
  if (!context.isGrounded) {
    return `User Question: ${userQuestion}

Note: No verified context available for this query. Proceed with caution and clearly indicate any assumptions made.`;
  }

  const entityDescriptions = context.entities.map(e => 
    `- ${e.name} (${e.type}): ${JSON.stringify(e.attributes)} [Confidence: ${Math.round(e.confidence * 100)}%]`
  ).join('\n');

  const relationshipDescriptions = context.relationships.map(r => {
    const source = context.entities.find(e => e.id === r.sourceEntityId)?.name || r.sourceEntityId;
    const target = context.entities.find(e => e.id === r.targetEntityId)?.name || r.targetEntityId;
    return `- ${source} → ${r.type} → ${target} [Confidence: ${Math.round(r.confidence * 100)}%]`;
  }).join('\n');

  const boundaryDescriptions = context.boundaries.map(b =>
    `- ${b.type}: ${b.value} (${b.description})`
  ).join('\n');

  const sourceList = context.sources.map((s, i) => `[${i + 1}] ${s}`).join('\n');

  return `## Grounded Analysis Request

**User Question:** ${userQuestion}

**IMPORTANT INSTRUCTIONS:**
You MUST base your analysis on the following verified facts. Do NOT make claims that contradict this verified information. Cite sources using [n] notation where applicable.

${context.focalEntity ? `**Focal Entity:** ${context.focalEntity}\n` : ''}
**Overall Confidence:** ${Math.round(context.confidence * 100)}%

### Verified Entities
${entityDescriptions || 'No entities available.'}

### Verified Relationships
${relationshipDescriptions || 'No relationships available.'}

### Context Boundaries
${boundaryDescriptions || 'No boundaries specified.'}

### Sources
${sourceList || 'No sources available.'}

---

**Response Guidelines:**
1. Only make claims supported by the verified facts above
2. Cite sources using [n] notation
3. Clearly flag any uncertainty or gaps in the verified data
4. If the question requires information beyond the verified facts, acknowledge this limitation
5. Maintain consistency with established relationships and entity attributes`;
}

/**
 * Format context bundle as a markdown section for Premisia reports
 */
export function formatForReport(context: ContextBundle, sectionTitle?: string): string {
  const title = sectionTitle || 'Grounded Context';
  
  if (!context.isGrounded) {
    return `## ${title}

*No verified context was available for this analysis. Results should be treated as ungrounded.*`;
  }

  let markdown = `## ${title}

**Query:** ${context.query}
${context.focalEntity ? `**Focal Entity:** ${context.focalEntity}` : ''}
**Confidence Level:** ${Math.round(context.confidence * 100)}%
**Retrieved:** ${new Date(context.timestamp).toLocaleString()}

### Key Entities (${context.entities.length})

| Entity | Type | Confidence | Key Attributes |
|--------|------|------------|----------------|
`;

  for (const entity of context.entities.slice(0, 15)) {
    const attrs = Object.entries(entity.attributes)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    markdown += `| ${entity.name} | ${entity.type} | ${Math.round(entity.confidence * 100)}% | ${attrs} |\n`;
  }

  if (context.entities.length > 15) {
    markdown += `\n*...and ${context.entities.length - 15} more entities*\n`;
  }

  if (context.relationships.length > 0) {
    markdown += `\n### Key Relationships (${context.relationships.length})\n\n`;
    
    for (const rel of context.relationships.slice(0, 10)) {
      const source = context.entities.find(e => e.id === rel.sourceEntityId)?.name || rel.sourceEntityId;
      const target = context.entities.find(e => e.id === rel.targetEntityId)?.name || rel.targetEntityId;
      markdown += `- **${source}** → *${rel.type}* → **${target}** (${Math.round(rel.confidence * 100)}% confidence)\n`;
    }
    
    if (context.relationships.length > 10) {
      markdown += `\n*...and ${context.relationships.length - 10} more relationships*\n`;
    }
  }

  if (context.boundaries.length > 0) {
    markdown += `\n### Context Boundaries\n\n`;
    for (const boundary of context.boundaries) {
      markdown += `- **${boundary.type}:** ${boundary.value} — ${boundary.description}\n`;
    }
  }

  if (context.sources.length > 0) {
    markdown += `\n### Sources\n\n`;
    context.sources.forEach((source, i) => {
      markdown += `${i + 1}. ${source}\n`;
    });
  }

  return markdown;
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
