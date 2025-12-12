/**
 * Grounded Analysis Service
 * 
 * Wraps AI analysis with Context Foundry grounding to ensure
 * responses are constrained by verified facts with proper citations.
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
  // If Context Foundry is not configured, return ungrounded
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
    // Query Context Foundry for relevant context
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

    // Generate grounded prompt
    const groundedPrompt = groundAnalysis(request.originalInput, context);
    
    // Generate report section
    const reportSection = formatForReport(context, `Grounded Context: ${request.analysisType.toUpperCase()}`);

    console.log(`[GroundedAnalysis] Successfully grounded analysis with ${context.entities.length} entities, ${context.relationships.length} relationships`);

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
