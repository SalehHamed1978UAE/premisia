/**
 * Grounded Analysis Service
 * 
 * Wraps AI analysis with Context Foundry grounding to ensure
 * responses are constrained by verified facts with proper citations.
 * 
 * Includes intelligent claim routing orchestration that routes claims
 * through appropriate sources based on claim type.
 */

import { 
  ContextBundle, 
  queryContext, 
  groundAnalysis, 
  formatForReport,
  getContextFoundryClient
} from './context-foundry-client';

export interface GroundedAnalysisRequest {
  query: string;
  focalEntity?: string;
  analysisType: 'five_whys' | 'porters' | 'bmc' | 'pestle' | 'swot' | 'general';
  originalInput: string;
}

export interface GroundedAnalysisResult {
  groundedPrompt: string;
  context: ContextBundle | null;
  isGrounded: boolean;
  reportSection: string | null;
}

export type ClaimType = 'internal' | 'external' | 'framework';

export interface ClaimClassification {
  claimType: ClaimType;
  topic: string;
  entities: string[];
  requiresValidation: boolean;
  source?: 'context_foundry' | 'web_search' | 'llm_reasoning';
  originalText?: string;
}

export interface OrchestrationResult {
  groundedPrompt: string;
  classifications: ClaimClassification[];
  cfContext: ContextBundle | null;
  flaggedAssumptions: string[];
  externalClaimsForWebSearch: string[];
}

const INTERNAL_KEYWORDS = [
  'team', 'department', 'process', 'system', 'workflow', 'employee', 
  'manager', 'role', 'internal', 'our', 'we', 'staff', 'personnel',
  'procedure', 'policy', 'protocol', 'organization', 'organisational',
  'organizational', 'division', 'unit', 'group', 'colleague', 'supervisor',
  'stakeholder', 'budget', 'resource', 'capacity', 'infrastructure',
  // Technical infrastructure terms (should trigger CF for service topology)
  'service', 'services', 'api', 'gateway', 'dependency', 'dependencies',
  'microservice', 'microservices', 'backend', 'frontend', 'database',
  'server', 'servers', 'cluster', 'deployment', 'architecture',
  'component', 'components', 'module', 'modules', 'integration',
  'endpoint', 'endpoints', 'circuit', 'breaker', 'failover', 'redundancy',
  'downtime', 'uptime', 'availability', 'reliability', 'latency',
  'timeout', 'retry', 'cascade', 'cascading', 'interconnected'
];

const INTERNAL_PHRASES = [
  'how we do', 'our approach', 'we currently', 'our team', 'our process',
  'we have', 'we use', 'our system', 'our workflow', 'internally',
  'in-house', 'our department', 'our organization', 'our company',
  'depends on', 'reports to', 'managed by', 'owned by', 'responsible for',
  // Technical infrastructure phrases
  'api gateway', 'service mesh', 'load balancer', 'circuit breaker',
  'cascading failure', 'dependent service', 'downstream service',
  'upstream service', 'service topology', 'system architecture',
  'service dependency', 'interconnected system', 'failure cascade'
];

const EXTERNAL_KEYWORDS = [
  'market', 'competitor', 'industry', 'customer', 'trend', 'regulation',
  'economy', 'economic', 'pricing', 'segment', 'share', 'consumer',
  'demand', 'supply', 'vendor', 'supplier', 'partner', 'external',
  'benchmark', 'landscape', 'sector', 'growth', 'decline', 'forecast',
  'regulatory', 'compliance', 'legislation', 'law', 'government',
  'technology', 'innovation', 'disruption', 'digital', 'ai', 'automation'
];

const EXTERNAL_PHRASES = [
  'market share', 'competitive landscape', 'industry trend', 'customer segment',
  'market conditions', 'economic factors', 'regulatory environment',
  'technology trend', 'market growth', 'competitive pressure', 'market position',
  'customer needs', 'consumer behavior', 'market opportunity', 'market threat',
  'price point', 'pricing strategy', 'competitive advantage', 'market leader'
];

const FRAMEWORK_KEYWORDS = [
  'swot', 'porter', 'pestle', 'pestel', 'pest', 'five whys', '5 whys',
  'root cause', 'analysis', 'framework', 'matrix', 'model', 'canvas',
  'strategy', 'strategic', 'assessment', 'evaluation', 'diagnostic',
  'force', 'strength', 'weakness', 'opportunity', 'threat', 'factor',
  'driver', 'barrier', 'enabler', 'constraint', 'assumption', 'hypothesis'
];

const FRAMEWORK_PHRASES = [
  'business model', 'value proposition', 'competitive force', 'five forces',
  'root cause analysis', 'cause and effect', 'why did', 'because of',
  'leads to', 'results in', 'contributes to', 'analyze the', 'assess the',
  'evaluate the', 'compare and contrast', 'pros and cons', 'trade-off',
  'strategic option', 'decision criteria', 'critical success factor'
];

/**
 * ClaimClassifier - Analyzes input text to classify claims
 * into internal, external, or framework categories
 */
export class ClaimClassifier {
  private internalKeywords: Set<string>;
  private externalKeywords: Set<string>;
  private frameworkKeywords: Set<string>;

  constructor() {
    this.internalKeywords = new Set(INTERNAL_KEYWORDS.map(k => k.toLowerCase()));
    this.externalKeywords = new Set(EXTERNAL_KEYWORDS.map(k => k.toLowerCase()));
    this.frameworkKeywords = new Set(FRAMEWORK_KEYWORDS.map(k => k.toLowerCase()));
  }

  /**
   * Analyze input text and classify claims
   */
  classifyClaims(input: string): ClaimClassification[] {
    const classifications: ClaimClassification[] = [];
    const sentences = this.splitIntoSentences(input);

    for (const sentence of sentences) {
      const classification = this.classifySentence(sentence);
      if (classification) {
        classifications.push(classification);
      }
    }

    if (classifications.length === 0) {
      classifications.push({
        claimType: 'framework',
        topic: 'general analysis',
        entities: [],
        requiresValidation: false,
        source: 'llm_reasoning',
        originalText: input
      });
    }

    return classifications;
  }

  private splitIntoSentences(input: string): string[] {
    return input
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  private classifySentence(sentence: string): ClaimClassification | null {
    const lowerSentence = sentence.toLowerCase();
    const words = lowerSentence.split(/\s+/);

    const internalScore = this.scoreInternal(lowerSentence, words);
    const externalScore = this.scoreExternal(lowerSentence, words);
    const frameworkScore = this.scoreFramework(lowerSentence, words);

    const maxScore = Math.max(internalScore, externalScore, frameworkScore);
    if (maxScore < 0.5) {
      return null;
    }

    const entities = this.extractEntities(sentence);
    const topic = this.extractTopic(sentence);

    if (internalScore === maxScore) {
      return {
        claimType: 'internal',
        topic,
        entities,
        requiresValidation: true,
        source: 'context_foundry',
        originalText: sentence
      };
    } else if (externalScore === maxScore) {
      return {
        claimType: 'external',
        topic,
        entities,
        requiresValidation: true,
        source: 'web_search',
        originalText: sentence
      };
    } else {
      return {
        claimType: 'framework',
        topic,
        entities,
        requiresValidation: false,
        source: 'llm_reasoning',
        originalText: sentence
      };
    }
  }

  private scoreInternal(sentence: string, words: string[]): number {
    let score = 0;
    const totalPossible = INTERNAL_KEYWORDS.length + INTERNAL_PHRASES.length;

    for (const word of words) {
      if (this.internalKeywords.has(word)) {
        score += 1;
      }
    }

    for (const phrase of INTERNAL_PHRASES) {
      if (sentence.includes(phrase.toLowerCase())) {
        score += 2;
      }
    }

    return Math.min(score / 3, 1);
  }

  private scoreExternal(sentence: string, words: string[]): number {
    let score = 0;

    for (const word of words) {
      if (this.externalKeywords.has(word)) {
        score += 1;
      }
    }

    for (const phrase of EXTERNAL_PHRASES) {
      if (sentence.includes(phrase.toLowerCase())) {
        score += 2;
      }
    }

    return Math.min(score / 3, 1);
  }

  private scoreFramework(sentence: string, words: string[]): number {
    let score = 0;

    for (const word of words) {
      if (this.frameworkKeywords.has(word)) {
        score += 1;
      }
    }

    for (const phrase of FRAMEWORK_PHRASES) {
      if (sentence.includes(phrase.toLowerCase())) {
        score += 2;
      }
    }

    return Math.min(score / 3, 1);
  }

  private extractEntities(sentence: string): string[] {
    const entities: string[] = [];
    const capitalizedWords = sentence.match(/\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g) || [];
    
    for (const word of capitalizedWords) {
      if (word.length > 2 && !['The', 'This', 'That', 'They', 'We', 'Our', 'Their'].includes(word)) {
        entities.push(word);
      }
    }

    return [...new Set(entities)].slice(0, 5);
  }

  private extractTopic(sentence: string): string {
    const words = sentence.split(/\s+/).slice(0, 8);
    return words.join(' ') + (words.length >= 8 ? '...' : '');
  }
}

/**
 * Check if Context Foundry is configured and available
 */
export function isContextFoundryConfigured(): boolean {
  return !!process.env.CONTEXT_FOUNDRY_API_KEY;
}

/**
 * Prepare a grounded analysis request by querying Context Foundry
 * and generating a constrained prompt
 */
export async function prepareGroundedAnalysis(
  request: GroundedAnalysisRequest
): Promise<GroundedAnalysisResult> {
  if (!isContextFoundryConfigured()) {
    console.log('[GroundedAnalysis] Context Foundry not configured, proceeding without grounding');
    return {
      groundedPrompt: request.originalInput,
      context: null,
      isGrounded: false,
      reportSection: null
    };
  }

  try {
    const context = await queryContext(request.query, request.focalEntity);

    if (!context || !context.isGrounded) {
      console.log('[GroundedAnalysis] No grounded context found for query:', request.query);
      return {
        groundedPrompt: request.originalInput,
        context: context,
        isGrounded: false,
        reportSection: null
      };
    }

    const groundedPrompt = groundAnalysis(request.originalInput, context);
    const reportSection = formatForReport(context, `Grounded Context: ${request.analysisType.toUpperCase()}`);

    console.log(`[GroundedAnalysis] Successfully grounded analysis with ${context.confirmedEntities.length} entities, ${context.inferredRelationships.length} relationships`);

    return {
      groundedPrompt,
      context,
      isGrounded: true,
      reportSection
    };

  } catch (error) {
    console.error('[GroundedAnalysis] Error preparing grounded analysis:', error);
    return {
      groundedPrompt: request.originalInput,
      context: null,
      isGrounded: false,
      reportSection: null
    };
  }
}

/**
 * Extract a query for Context Foundry based on analysis type
 */
export function buildContextQuery(
  analysisType: string,
  focalEntity?: string,
  additionalContext?: string
): string {
  const entityPrefix = focalEntity ? `${focalEntity}: ` : '';
  
  const queryTemplates: Record<string, string> = {
    'five_whys': `${entityPrefix}root cause analysis factors, operational challenges, business problems`,
    'porters': `${entityPrefix}competitive dynamics, market forces, industry structure, competitors`,
    'bmc': `${entityPrefix}business model components, revenue streams, customer segments, value proposition`,
    'pestle': `${entityPrefix}political, economic, social, technological, legal, environmental factors`,
    'swot': `${entityPrefix}strengths, weaknesses, opportunities, threats, competitive position`,
    'general': `${entityPrefix}strategic context, business environment, key stakeholders`
  };

  const baseQuery = queryTemplates[analysisType] || queryTemplates['general'];
  
  if (additionalContext) {
    return `${baseQuery}. Additional context: ${additionalContext.substring(0, 200)}`;
  }
  
  return baseQuery;
}

/**
 * Validate Context Foundry connection
 */
export async function validateContextFoundryConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isContextFoundryConfigured()) {
    return {
      configured: false,
      connected: false,
      error: 'CONTEXT_FOUNDRY_API_KEY not set'
    };
  }

  try {
    const client = getContextFoundryClient();
    if (!client) {
      return {
        configured: true,
        connected: false,
        error: 'Failed to initialize client'
      };
    }

    const isValid = await client.validateApiKey();
    return {
      configured: true,
      connected: isValid,
      error: isValid ? undefined : 'API key validation failed'
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Grounded analysis helper for strategy analyzer
 */
export async function groundStrategicAnalysis(
  userInput: string,
  analysisType: 'five_whys' | 'porters' | 'bmc' | 'pestle' | 'swot' | 'general',
  focalEntity?: string
): Promise<{ prompt: string; context: ContextBundle | null; grounded: boolean }> {
  const query = buildContextQuery(analysisType, focalEntity, userInput);
  
  const result = await prepareGroundedAnalysis({
    query,
    focalEntity,
    analysisType,
    originalInput: userInput
  });

  return {
    prompt: result.groundedPrompt,
    context: result.context,
    grounded: result.isGrounded
  };
}

/**
 * Orchestrate analysis by routing claims through appropriate sources
 * 
 * - Internal claims → Query Context Foundry
 * - External claims → Flag for web search
 * - Framework claims → Pass through to LLM
 */
export async function orchestrateAnalysis(
  userInput: string,
  analysisType: 'five_whys' | 'porters' | 'bmc' | 'pestle' | 'swot' | 'general',
  focalEntity?: string
): Promise<OrchestrationResult> {
  console.log(`\n[Orchestrator] ========== STARTING ORCHESTRATION ==========`);
  console.log(`[Orchestrator] Analysis type: ${analysisType}`);
  console.log(`[Orchestrator] Focal entity: ${focalEntity || 'none'}`);
  console.log(`[Orchestrator] Input length: ${userInput.length} chars`);
  console.log(`[Orchestrator] Input preview: ${userInput.substring(0, 200)}...`);
  
  const classifier = new ClaimClassifier();
  const classifications = classifier.classifyClaims(userInput);
  
  const internalClaims = classifications.filter(c => c.claimType === 'internal');
  const externalClaims = classifications.filter(c => c.claimType === 'external');
  const frameworkClaims = classifications.filter(c => c.claimType === 'framework');

  console.log(`[Orchestrator] Classified claims: ${internalClaims.length} internal, ${externalClaims.length} external, ${frameworkClaims.length} framework`);
  
  // Log each classification for debugging
  for (const claim of classifications) {
    console.log(`[Orchestrator] - ${claim.claimType.toUpperCase()}: "${claim.topic}" | entities: [${claim.entities.join(', ')}]`);
  }

  let cfContext: ContextBundle | null = null;
  const flaggedAssumptions: string[] = [];
  const externalClaimsForWebSearch: string[] = [];

  console.log(`[Orchestrator] Context Foundry configured: ${isContextFoundryConfigured()}`);

  if (internalClaims.length > 0 && isContextFoundryConfigured()) {
    const internalEntities = internalClaims.flatMap(c => c.entities);
    const internalTopics = internalClaims.map(c => c.topic).join('; ');
    
    const cfQuery = buildContextQuery(analysisType, focalEntity, internalTopics);
    console.log(`[Orchestrator] CF Query: ${cfQuery}`);
    console.log(`[Orchestrator] Querying Context Foundry with focal entity: ${focalEntity || internalEntities[0] || 'none'}`);
    
    cfContext = await queryContext(cfQuery, focalEntity || internalEntities[0]);
    
    console.log(`[Orchestrator] CF Response received:`);
    console.log(`[Orchestrator] - isGrounded: ${cfContext?.isGrounded}`);
    console.log(`[Orchestrator] - confidence: ${cfContext?.confidence}`);
    console.log(`[Orchestrator] - confirmedEntities: ${cfContext?.confirmedEntities?.length || 0}`);
    console.log(`[Orchestrator] - inferredRelationships: ${cfContext?.inferredRelationships?.length || 0}`);
    if (cfContext?.confirmedEntities?.length) {
      for (const entity of cfContext.confirmedEntities.slice(0, 5)) {
        console.log(`[Orchestrator]   * ${entity.type}: ${entity.name} (${Math.round(entity.confidence * 100)}%)`);
      }
    }
    if (cfContext?.inferredRelationships?.length) {
      for (const rel of cfContext.inferredRelationships.slice(0, 5)) {
        console.log(`[Orchestrator]   * ${rel.sourceEntity} --[${rel.relationshipType}]--> ${rel.targetEntity}`);
      }
    }

    if (cfContext && cfContext.isGrounded) {
      for (const claim of internalClaims) {
        const hasMatchingEntity = claim.entities.some(entity =>
          cfContext!.confirmedEntities.some(ce => 
            ce.name.toLowerCase().includes(entity.toLowerCase()) ||
            entity.toLowerCase().includes(ce.name.toLowerCase())
          )
        );

        if (!hasMatchingEntity && claim.originalText) {
          flaggedAssumptions.push(`[Unverified] ${claim.originalText}`);
        }
      }

      if (cfContext.boundaries.lowCoverageAreas.length > 0) {
        flaggedAssumptions.push(
          `[Knowledge Gap] Limited data on: ${cfContext.boundaries.lowCoverageAreas.join(', ')}`
        );
      }
    } else {
      for (const claim of internalClaims) {
        if (claim.originalText) {
          flaggedAssumptions.push(`[No CF Data] ${claim.originalText}`);
        }
      }
    }
  } else if (internalClaims.length > 0) {
    for (const claim of internalClaims) {
      if (claim.originalText) {
        flaggedAssumptions.push(`[CF Not Configured] ${claim.originalText}`);
      }
    }
  }

  for (const claim of externalClaims) {
    if (claim.originalText) {
      externalClaimsForWebSearch.push(claim.originalText);
    }
  }

  const groundedPrompt = buildOrchestatedPrompt(
    userInput,
    analysisType,
    classifications,
    cfContext,
    flaggedAssumptions,
    externalClaimsForWebSearch
  );

  return {
    groundedPrompt,
    classifications,
    cfContext,
    flaggedAssumptions,
    externalClaimsForWebSearch
  };
}

/**
 * Build an orchestrated prompt that includes context from all sources
 */
function buildOrchestatedPrompt(
  originalInput: string,
  analysisType: string,
  classifications: ClaimClassification[],
  cfContext: ContextBundle | null,
  flaggedAssumptions: string[],
  externalClaimsForWebSearch: string[]
): string {
  const sections: string[] = [];

  sections.push(`## User Request\n${originalInput}`);

  sections.push(`\n## Analysis Type: ${analysisType.toUpperCase()}`);

  sections.push(`\n## Claim Classification Summary`);
  sections.push(`- Internal claims (organizational): ${classifications.filter(c => c.claimType === 'internal').length}`);
  sections.push(`- External claims (market/industry): ${classifications.filter(c => c.claimType === 'external').length}`);
  sections.push(`- Framework claims (analytical): ${classifications.filter(c => c.claimType === 'framework').length}`);

  if (cfContext && cfContext.isGrounded) {
    sections.push(`\n## Verified Organizational Context (from Context Foundry)`);
    sections.push(`**Confidence: ${Math.round(cfContext.confidence * 100)}%**`);
    
    if (cfContext.confirmedEntities.length > 0) {
      sections.push(`\n### Confirmed Entities`);
      for (const entity of cfContext.confirmedEntities.slice(0, 10)) {
        sections.push(`- ${entity.type}: ${entity.name} (${Math.round(entity.confidence * 100)}% confidence)`);
      }
    }

    if (cfContext.inferredRelationships.length > 0) {
      sections.push(`\n### Relationships`);
      for (const rel of cfContext.inferredRelationships.slice(0, 10)) {
        sections.push(`- ${rel.sourceEntity} → ${rel.relationshipType} → ${rel.targetEntity}`);
      }
    }

    if (cfContext.answer) {
      sections.push(`\n### Context Foundry Answer`);
      sections.push(cfContext.answer);
    }
  }

  if (flaggedAssumptions.length > 0) {
    sections.push(`\n## ⚠️ Flagged Assumptions (require verification)`);
    for (const assumption of flaggedAssumptions) {
      sections.push(`- ${assumption}`);
    }
    sections.push(`\n*These claims about internal operations could not be verified against organizational data. Treat as assumptions until confirmed.*`);
  }

  if (externalClaimsForWebSearch.length > 0) {
    sections.push(`\n## 🔍 External Claims (marked for web search)`);
    for (const claim of externalClaimsForWebSearch) {
      sections.push(`- ${claim}`);
    }
    sections.push(`\n*These claims about markets, competitors, or industry trends require external validation. Web search recommended.*`);
  }

  sections.push(`\n## Instructions for Analysis`);
  sections.push(`1. Use the verified organizational context above when available`);
  sections.push(`2. Clearly mark unverified assumptions in your analysis`);
  sections.push(`3. Note where external data would strengthen the analysis`);
  sections.push(`4. Apply ${analysisType} framework methodology to structure insights`);
  sections.push(`5. Cite sources when making specific claims`);

  return sections.join('\n');
}
