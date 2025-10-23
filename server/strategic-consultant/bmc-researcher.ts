import { BMCQueryGenerator, type BMCQuery, type BMCBlockType } from './bmc-query-generator';
import { MarketResearcher, type Finding, type Source } from './market-researcher';
import { AssumptionExtractor, type Assumption } from './assumption-extractor';
import { AssumptionValidator, type Contradiction } from './assumption-validator';
import { aiClients } from '../ai-clients';
import { strategicUnderstandingService } from '../strategic-understanding-service';
import { RequestThrottler } from '../utils/request-throttler';
import { parseAIJson } from '../utils/parse-ai-json';
import { dbConnectionManager } from '../db-connection-manager';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

export interface BMCBlockFindings {
  blockType: BMCBlockType;
  blockName: string;
  description: string;
  findings: Finding[];
  confidence: 'weak' | 'moderate' | 'strong';
  strategicImplications: string;
  gaps: string[];
  researchQueries: string[];
}

export interface BMCResearchResult {
  blocks: BMCBlockFindings[];
  sources: Source[];
  overallConfidence: number;
  viability: string;
  keyInsights: string[];
  criticalGaps: string[];
  consistencyChecks: any[];
  recommendations: any[];
  assumptions?: Assumption[];
  contradictions?: Contradiction[];
}

export class BMCResearcher {
  private queryGenerator: BMCQueryGenerator;
  private marketResearcher: MarketResearcher;
  private assumptionExtractor: AssumptionExtractor;
  private assumptionValidator: AssumptionValidator;

  constructor() {
    this.queryGenerator = new BMCQueryGenerator();
    this.marketResearcher = new MarketResearcher();
    this.assumptionExtractor = new AssumptionExtractor();
    this.assumptionValidator = new AssumptionValidator();
  }

  /**
   * Convert StrategicUnderstandingService entities to Assumption format for backward compatibility
   */
  private entitiesToAssumptions(entities: any[]): Assumption[] {
    return entities.map(entity => {
      // Map entity type to assumption category
      let category: 'product' | 'market' | 'customer' | 'competitive' | 'operational' = 'market';
      
      if (entity.claim.toLowerCase().includes('localization') || 
          entity.claim.toLowerCase().includes('feature') ||
          entity.claim.toLowerCase().includes('product')) {
        category = 'product';
      } else if (entity.claim.toLowerCase().includes('customer') || 
                 entity.claim.toLowerCase().includes('enterprise') ||
                 entity.claim.toLowerCase().includes('segment')) {
        category = 'customer';
      } else if (entity.claim.toLowerCase().includes('competitive') || 
                 entity.claim.toLowerCase().includes('vendor')) {
        category = 'competitive';
      } else if (entity.claim.toLowerCase().includes('timeline') || 
                 entity.claim.toLowerCase().includes('achievable') ||
                 entity.claim.toLowerCase().includes('feasible')) {
        category = 'operational';
      }

      // Map entity type to confidence
      let confidence: 'explicit' | 'implicit' = 'implicit';
      if (entity.type === 'explicit_assumption') {
        confidence = 'explicit';
      }

      // Convert investment amount to string format for backward compatibility
      const investmentAmount = entity.investmentAmount 
        ? `$${entity.investmentAmount.toLocaleString()}`
        : null;

      return {
        claim: entity.claim,
        category,
        confidence,
        investmentAmount,
        source: entity.source,
      };
    });
  }

  async conductBMCResearch(
    input: string, 
    sessionId?: string
  ): Promise<BMCResearchResult> {
    // Step 1: Extract understanding from user input using knowledge graph
    
    const effectiveSessionId = sessionId || `bmc-${Date.now()}`;
    console.log(`[BMCResearcher] Using StrategicUnderstandingService for session: ${effectiveSessionId}`);
    
    const { understandingId, entities } = await strategicUnderstandingService.extractUnderstanding({
      sessionId: effectiveSessionId,
      userInput: input,
    });
    console.log(`[BMCResearcher] Extracted ${entities.length} entities (knowledge graph replaces AssumptionExtractor)`);
    console.log(`[BMCResearcher] Understanding ID: ${understandingId}`);

    // Convert entities to Assumption format for backward compatibility with existing flow
    const assumptions = this.entitiesToAssumptions(entities);
    console.log(`[BMCResearcher] Converted to ${assumptions.length} assumptions for BMC flow`);

    // Step 2: Generate BMC block queries
    const querySet = await this.queryGenerator.generateQueriesForAllBlocks(input);

    // Step 3: Generate assumption-specific queries
    const assumptionQueries = await this.assumptionValidator.generateAssumptionQueries(assumptions);
    console.log(`Generated ${assumptionQueries.length} assumption validation queries`);

    // Step 4: Separate BMC block queries from assumption queries
    const bmcQueries: BMCQuery[] = [
      ...querySet.customer_segments,
      ...querySet.value_propositions,
      ...querySet.revenue_streams,
      ...querySet.channels,
      ...querySet.customer_relationships,
      ...querySet.key_resources,
      ...querySet.key_activities,
      ...querySet.key_partnerships,
      ...querySet.cost_structure,
    ];

    // Assumption queries are separate - they validate across ALL blocks, not tied to one
    const assumptionOnlyQueries = assumptionQueries.map(aq => ({ 
      query: aq.query, 
      purpose: `Assumption check: ${aq.assumption}`,
      type: (aq.purpose === 'validate' ? 'validating' : 'challenging') as 'validating' | 'challenging' | 'baseline',
    }));

    const allQueries = [...bmcQueries, ...assumptionOnlyQueries];

    const searchResults = await this.performParallelWebSearch(allQueries);
    
    // Separate assumption search results - these apply to ALL blocks
    const assumptionResults = searchResults.filter(r => 
      assumptionOnlyQueries.some(q => q.query === r.query)
    );
    console.log(`Found ${assumptionResults.length} assumption-related search results to share across all blocks`);
    
    const allSources = this.extractUniqueSources(searchResults);
    const topSources = allSources.slice(0, 10);
    
    const sourceContents = await this.marketResearcher.fetchSourceContentPublic(
      topSources.slice(0, 3)
    );

    // Step 5: CRITICAL FIX - Detect contradictions BEFORE block synthesis
    
    // Extract raw findings from ASSUMPTION-SPECIFIC queries only (preserves context)
    // Use assumptionResults instead of all searchResults to ensure evidence matches assumption context
    // E.g., "Asana" contradiction should have "Asana" evidence, not generic "software modernization" evidence
    const assumptionFindings = assumptionResults.flatMap(sr => 
      (sr.results || []).map((r: any) => `${r.title}: ${r.snippet}`)
    );
    const contradictionResult = await this.assumptionValidator.detectContradictions(
      assumptions,
      assumptionFindings  // Context-preserved findings
    );
    console.log(`Detected ${contradictionResult.contradictions.length} contradictions BEFORE block synthesis`);

    // Step 6: Synthesize blocks WITH contradiction awareness
    const [
      customerBlock, 
      valueBlock, 
      revenueBlock,
      channelsBlock,
      relationshipsBlock,
      resourcesBlock,
      activitiesBlock,
      partnersBlock,
      costBlock
    ] = await Promise.all([
      this.synthesizeBlock(
        'customer_segments',
        'Customer Segments',
        querySet.customer_segments,
        [
          ...searchResults.filter(r => 
            querySet.customer_segments.some(q => q.query === r.query)
          ),
          ...assumptionResults // Include assumption findings in all blocks
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'value_propositions',
        'Value Propositions',
        querySet.value_propositions,
        [
          ...searchResults.filter(r => 
            querySet.value_propositions.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'revenue_streams',
        'Revenue Streams',
        querySet.revenue_streams,
        [
          ...searchResults.filter(r => 
            querySet.revenue_streams.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'channels',
        'Channels',
        querySet.channels,
        [
          ...searchResults.filter(r => 
            querySet.channels.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'customer_relationships',
        'Customer Relationships',
        querySet.customer_relationships,
        [
          ...searchResults.filter(r => 
            querySet.customer_relationships.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'key_resources',
        'Key Resources',
        querySet.key_resources,
        [
          ...searchResults.filter(r => 
            querySet.key_resources.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'key_activities',
        'Key Activities',
        querySet.key_activities,
        [
          ...searchResults.filter(r => 
            querySet.key_activities.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'key_partnerships',
        'Key Partnerships',
        querySet.key_partnerships,
        [
          ...searchResults.filter(r => 
            querySet.key_partnerships.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'cost_structure',
        'Cost Structure',
        querySet.cost_structure,
        [
          ...searchResults.filter(r => 
            querySet.cost_structure.some(q => q.query === r.query)
          ),
          ...assumptionResults
        ],
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
    ]);

    const blocks = [
      customerBlock, 
      valueBlock, 
      revenueBlock,
      channelsBlock,
      relationshipsBlock,
      resourcesBlock,
      activitiesBlock,
      partnersBlock,
      costBlock
    ];
    const overallConfidence = this.calculateOverallConfidence(blocks);

    // Step 6: Synthesize overall BMC with contradiction awareness
    const synthesis = await this.synthesizeOverallBMC(blocks, input, contradictionResult.contradictions);

    // Step 7 (Task 17): Store BMC findings back into knowledge graph
    await this.storeBMCFindingsInGraph(understandingId, entities, blocks, contradictionResult.contradictions, synthesis.criticalGaps);
    
    return {
      blocks,
      sources: topSources,
      overallConfidence,
      viability: synthesis.viability,
      keyInsights: synthesis.keyInsights,
      criticalGaps: synthesis.criticalGaps,
      consistencyChecks: synthesis.consistencyChecks,
      recommendations: synthesis.recommendations,
      assumptions,
      contradictions: contradictionResult.contradictions,
    };
  }

  /**
   * Validate ALL contradictions upfront (prevents DB timeout by doing LLM calls separately)
   */
  private async validateAllContradictions(
    contradictions: Contradiction[],
    userInputEntities: any[]
  ): Promise<Array<{
    contradiction: Contradiction;
    sourceEntity: any;
    isValid: boolean;
    validation: {
      isContradiction: boolean;
      reasoning: string;
      provider?: string;
      model?: string;
    }
  }>> {
    console.log(`[BMCResearcher] Validating ${contradictions.length} potential contradictions...`);
    
    const results = await Promise.all(
      contradictions.map(async (contradiction) => {
        // Find the source entity that matches the assumption
        // Use flexible matching: check for key concept overlaps (numbers, product names, timelines)
        const sourceEntity = userInputEntities.find(e => {
          const entityClaim = e.claim;
          const assumptionClaim = contradiction.assumption;
          
          // Try multiple matching strategies:
          // 1. Direct substring matching (case-insensitive)
          const entityLower = entityClaim.toLowerCase();
          const assumptionLower = assumptionClaim.toLowerCase();
          if (entityLower.includes(assumptionLower.substring(0, 30)) ||
              assumptionLower.includes(entityLower.substring(0, 30))) {
            console.log(`[BMCResearcher] Matched via substring`);
            return true;
          }
          
          // 2. Extract key concepts (numbers, products, timelines) from ORIGINAL casing
          const extractConcepts = (text: string) => {
            const concepts = new Set<string>();
            // Numbers (including currency and percentages)
            const numbers = text.match(/\$?\d+[\d,]*\.?\d*[%]?/g) || [];
            numbers.forEach(n => concepts.add(n.replace(/,/g, '').toLowerCase()));
            // Timeframes (weeks, months, years, days)
            const timeframes = text.match(/\d+[-–]\d+\s*(week|month|year|day)s?/gi) || [];
            timeframes.forEach(t => concepts.add(t.toLowerCase()));
            // Product/tool names (capitalized words) - extract BEFORE lowercasing
            const products = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
            products.forEach(p => concepts.add(p.toLowerCase()));
            // Keywords (implementation, deployment, rollout, etc.)
            const keywords = ['implementation', 'deployment', 'rollout', 'timeline', 'budget', 'investment'];
            keywords.forEach(kw => {
              if (text.toLowerCase().includes(kw)) {
                concepts.add(kw);
              }
            });
            return concepts;
          };
          
          const entityConcepts = extractConcepts(entityClaim);
          const assumptionConcepts = extractConcepts(assumptionClaim);
          
          // Check for concept overlap (at least 1 shared concept)
          const sharedConcepts = Array.from(entityConcepts).filter(c => assumptionConcepts.has(c));
          if (sharedConcepts.length >= 1) {
            console.log(`[BMCResearcher] Matched via concepts: ${sharedConcepts.join(', ')}`);
            return true;
          }
          
          return false;
        });

        if (!sourceEntity || contradiction.contradictedBy.length === 0) {
          return {
            contradiction,
            sourceEntity: null,
            isValid: false,
            validation: { isContradiction: false, reasoning: 'No matching entity found' }
          };
        }

        // Semantic validation: Check EACH evidence item separately
        const validationResults = await Promise.all(
          contradiction.contradictedBy.map(evidence => 
            this.validateContradiction(sourceEntity.claim, evidence)
          )
        );

        // Valid if AT LEAST ONE evidence item is a contradiction
        const anyValid = validationResults.some(v => v.isContradiction);
        const validCount = validationResults.filter(v => v.isContradiction).length;
        const validationReasons = validationResults.map(v => v.reasoning);

        return {
          contradiction,
          sourceEntity,
          isValid: anyValid,
          validation: {
            isContradiction: anyValid,
            reasoning: anyValid 
              ? `${validCount}/${validationResults.length} evidence items validated as contradictions: ${validationReasons.join('; ')}`
              : `No evidence items validated as contradictions: ${validationReasons.join('; ')}`,
            provider: validationResults[0]?.provider,
            model: validationResults[0]?.model
          }
        };
      })
    );

    return results;
  }

  /**
   * Semantic validation: Check if user claim and research finding contradict each other
   * Two-step check: (1) Same concept? (2) Different values?
   * Prevents false contradictions from semantically different claims (e.g., "PM software" vs "PM discipline")
   */
  private async validateContradiction(
    userClaim: string,
    researchFinding: string
  ): Promise<{isContradiction: boolean, reasoning: string, provider?: string, model?: string}> {
    const systemPrompt = `You are a contradiction detection expert. Your job is to determine if two statements CONTRADICT each other.

CRITICAL TWO-STEP CHECK:
Step 1: Are they about the SAME concept/topic?
Step 2: If same concept, do the values/claims DIFFER?

CONTRADICTION = SAME CONCEPT + DIFFERENT VALUES

Examples:
- "Monthly cost is $500" vs "Monthly subscription is $624.75" → SAME concept (recurring cost) + DIFFERENT values ($500 ≠ $624.75) → CONTRADICTION ✓
- "Implementation takes 2-4 weeks" vs "Implementation takes 6 months" → SAME concept (timeline) + DIFFERENT values (weeks vs months) → CONTRADICTION ✓
- "PM software implementation takes 2-4 weeks" vs "PM discipline adoption takes 6 months" → DIFFERENT concepts (software vs discipline) → NOT A CONTRADICTION ✗
- "Asana deployment takes 2 weeks" vs "Asana implementation takes 6 months" → SAME concept (Asana rollout) + DIFFERENT values (2 weeks vs 6 months) → CONTRADICTION ✓
- "Hiring engineers costs $500" vs "Hiring process costs $1000" → DIFFERENT concepts (salaries vs recruitment process) → NOT A CONTRADICTION ✗
- "India market entry" vs "India market research" → DIFFERENT concepts (entering vs researching) → NOT A CONTRADICTION ✗

Return ONLY valid JSON with this exact structure:
{
  "isSameConcept": true/false,
  "valuesConflict": true/false,
  "isContradiction": true/false,
  "reasoning": "Brief explanation of your analysis"
}`;

    const userMessage = `User claimed: "${userClaim}"
Research found: "${researchFinding}"

Do these statements contradict each other?
Step 1: Same concept? Step 2: Different values?`;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt,
        userMessage,
        maxTokens: 500,
      }, "anthropic");

      const result = parseAIJson(response.content, 'BMC contradiction validation');
      
      const status = result.isContradiction 
        ? `CONTRADICTION (same concept, different values)` 
        : result.isSameConcept 
          ? `NOT CONTRADICTION (same concept, same values)` 
          : `NOT CONTRADICTION (different concepts)`;
      
      console.log(`[BMCResearcher] Semantic validation: "${userClaim.substring(0, 50)}..." vs "${researchFinding.substring(0, 50)}..." → ${status}`);
      
      return {
        isContradiction: result.isContradiction === true,
        reasoning: result.reasoning || 'No reasoning provided',
        provider: response.provider,
        model: response.model
      };
    } catch (error) {
      console.error('[BMCResearcher] Semantic validation error:', error);
      // Soft fail: Skip contradiction creation on validation error
      return { isContradiction: false, reasoning: `Validation error: ${error}` };
    }
  }

  /**
   * Task 17: Store BMC research findings back into the knowledge graph
   * Maps: research findings → entities, contradictions → relationships, gaps → entities
   */
  private async storeBMCFindingsInGraph(
    understandingId: string,
    sourceEntities: any[],
    blocks: BMCBlockFindings[],
    contradictions: Contradiction[],
    criticalGaps: string[]
  ): Promise<void> {
    console.log(`[BMCResearcher] Storing BMC findings in knowledge graph for understanding: ${understandingId}`);

    try {
      // STEP 1: Get DB entities ONCE with fresh connection (before long operations)
      const persistedUserEntities = await dbConnectionManager.withFreshConnection(async () => {
        return await strategicUnderstandingService.getEntitiesByUnderstanding(understandingId);
      });
      const userInputEntities = persistedUserEntities.filter(e => e.discoveredBy === 'user_input');
      console.log(`[BMCResearcher] Found ${userInputEntities.length} persisted user_input entities for contradiction matching`);
      
      // STEP 2: Do ALL semantic validations BEFORE touching DB again (prevents timeout)
      console.log(`[BMCResearcher] Performing semantic validation (no DB operations)...`);
      const validatedContradictions = await this.validateAllContradictions(contradictions, userInputEntities);
      console.log(`[BMCResearcher] Validation complete: ${validatedContradictions.filter(v => v.isValid).length}/${validatedContradictions.length} contradictions validated`);
      
      // STEP 3: CRITICAL PATTERN - Batch all AI/embedding calls BEFORE any DB writes
      // This prevents Neon from killing connections during OpenAI API calls
      
      // 3a. Collect all claims that need embeddings
      const findingClaims = blocks.flatMap(block => 
        block.findings.slice(0, 3).map(finding => finding.fact)
      );
      const contradictionClaims = validatedContradictions
        .filter(r => r.isValid && r.validation.isContradiction)
        .map(r => r.contradiction.contradictedBy.join('; '));
      const gapClaims = criticalGaps.slice(0, 5);
      
      const allClaims = [...findingClaims, ...contradictionClaims, ...gapClaims];
      console.log(`[BMCResearcher] Batch-generating ${allClaims.length} embeddings...`);
      
      // 3b. Generate ALL embeddings at once (no DB connection held)
      const embeddings = await strategicUnderstandingService.generateEmbeddingsBatch(allClaims);
      console.log(`[BMCResearcher] ✓ All embeddings ready`);
      
      // STEP 4: Now persist everything in ONE retry block with fresh connection
      await dbConnectionManager.retryWithBackoff(async (db) => {
        let embeddingIndex = 0;
        
        // 4a. Store research findings
        for (const block of blocks) {
          for (const finding of block.findings.slice(0, 3)) {
            await strategicUnderstandingService.createEntityWithEmbedding(
              db,
              understandingId,
              {
                type: 'research_finding',
                claim: finding.fact,
                confidence: block.confidence === 'strong' ? 'high' : block.confidence === 'moderate' ? 'medium' : 'low',
                source: finding.citation,
                evidence: `BMC ${block.blockName} research finding`,
              },
              embeddings[embeddingIndex++],
              'bmc_agent'
            );
          }
        }
        console.log(`[BMCResearcher] Stored ${findingClaims.length} research findings`);

        // 4b. Store validated contradictions
        let createdCount = 0;
        let skippedCount = 0;
        
        for (const result of validatedContradictions) {
          if (!result.isValid || !result.sourceEntity) {
            skippedCount++;
            continue;
          }

          const { contradiction, sourceEntity, validation } = result;

          if (validation.isContradiction) {
            console.log(`[BMCResearcher] ✓ Creating contradiction relationship from entity ID: ${sourceEntity.id}`);
            
            // Create contradiction entity with pre-generated embedding
            const contradictionEntity = await strategicUnderstandingService.createEntityWithEmbedding(
              db,
              understandingId,
              {
                type: 'research_finding',
                claim: contradiction.contradictedBy.join('; '),
                confidence: contradiction.validationStrength === 'STRONG' ? 'high' : contradiction.validationStrength === 'MODERATE' ? 'medium' : 'low',
                source: 'BMC research',
                evidence: `Contradicts: ${contradiction.assumption}. Impact: ${contradiction.impact}`,
              },
              embeddings[embeddingIndex++],
              'bmc_agent'
            );

            // Create relationship
            await strategicUnderstandingService.createRelationshipDirect(
              db,
              sourceEntity.id,
              contradictionEntity.id,
              'contradicts',
              contradiction.validationStrength === 'STRONG' ? 'high' : contradiction.validationStrength === 'MODERATE' ? 'medium' : 'low',
              contradiction.recommendation,
              'bmc_agent',
              {
                semanticValidation: {
                  reasoning: validation.reasoning,
                  provider: validation.provider,
                  model: validation.model,
                  validatedAt: new Date().toISOString()
                },
                contradictionImpact: contradiction.impact,
                contradictionRecommendation: contradiction.recommendation
              }
            );
            
            createdCount++;
          } else {
            skippedCount++;
          }
        }
        
        console.log(`[BMCResearcher] Contradiction results: ${createdCount} created, ${skippedCount} skipped`);

        // 4c. Store critical gaps
        for (const gap of criticalGaps.slice(0, 5)) {
          await strategicUnderstandingService.createEntityWithEmbedding(
            db,
            understandingId,
            {
              type: 'business_model_gap',
              claim: gap,
              confidence: 'medium',
              source: 'BMC analysis synthesis',
              evidence: 'Identified during Business Model Canvas research and synthesis',
            },
            embeddings[embeddingIndex++],
            'bmc_agent'
          );
        }
        console.log(`[BMCResearcher] Stored ${gapClaims.length} critical gaps`);

        console.log(`[BMCResearcher] ✓ Knowledge graph enriched with BMC findings`);
      });
    } catch (error: any) {
      console.error(`[BMCResearcher] Error storing BMC findings in graph:`, error.message);
      // Don't throw - BMC research should complete even if graph storage fails
    }
  }

  private async performParallelWebSearch(queries: BMCQuery[]): Promise<any[]> {
    const throttler = new RequestThrottler({
      maxConcurrent: 5,
      delayBetweenBatches: 200,
      maxRetries: 3,
      initialRetryDelay: 1000,
    });

    const searchTasks = queries.map((queryObj) => async () => {
      try {
        const response = await fetch(`${API_BASE}/api/web-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: queryObj.query }),
        });

        if (!response.ok) {
          const error: any = new Error(`Search failed: ${response.status}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        
        const results = (data.organic || []).map((result: any) => ({
          url: result.link,
          title: result.title,
          snippet: result.snippet || '',
          relevance: result.position ? 1 / result.position : 0.5,
        }));

        return { query: queryObj.query, results };
      } catch (error: any) {
        if (error.status === 429 || error.message?.includes('429')) {
          throw error;
        }
        console.error(`Error searching for "${queryObj.query}":`, error);
        return { query: queryObj.query, results: [] };
      }
    });

    return throttler.throttleAll(
      searchTasks, 
      (taskIndex) => ({ query: queries[taskIndex].query, results: [] })
    );
  }

  private extractUniqueSources(searchResults: any[]): Source[] {
    const sourceMap = new Map<string, Source>();
    
    for (const searchResult of searchResults) {
      if (searchResult.results && Array.isArray(searchResult.results)) {
        for (const result of searchResult.results) {
          if (!sourceMap.has(result.url)) {
            sourceMap.set(result.url, {
              url: result.url,
              title: result.title,
              relevance_score: result.relevance || 0.5,
            });
          }
        }
      }
    }

    const sources = Array.from(sourceMap.values());
    sources.sort((a, b) => b.relevance_score - a.relevance_score);
    
    return sources;
  }

  private async synthesizeBlock(
    blockType: BMCBlockType,
    blockName: string,
    queries: BMCQuery[],
    searchResults: any[],
    sourceContents: Map<string, string>,
    originalInput: string,
    contradictions: Contradiction[] = []
  ): Promise<BMCBlockFindings> {
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const fullContentSummary = Array.from(sourceContents.entries())
      .map(([url, content]) => `URL: ${url}\nContent: ${content.substring(0, 1500)}...`)
      .join('\n\n---\n\n');

    const blockContext = {
      customer_segments: {
        focus: 'WHO the target customers are, their characteristics, needs, and pain points',
        outputGuidance: 'Describe the target customer segments based on research evidence',
      },
      value_propositions: {
        focus: 'WHAT value solves customer problems and how it differentiates from alternatives',
        outputGuidance: 'Describe the key value propositions based on market research',
      },
      revenue_streams: {
        focus: 'HOW the business generates revenue and monetizes value',
        outputGuidance: 'Describe revenue models and pricing strategies based on research',
      },
      channels: {
        focus: 'HOW the company reaches and communicates with customer segments to deliver value',
        outputGuidance: 'Describe distribution/sales channels and delivery methods based on research',
      },
      customer_relationships: {
        focus: 'WHAT type of relationship is established and maintained with each customer segment',
        outputGuidance: 'Describe customer engagement and support models based on research',
      },
      key_resources: {
        focus: 'WHAT critical assets are required to create and deliver value',
        outputGuidance: 'Describe essential resources (human, intellectual, physical, financial) based on research',
      },
      key_activities: {
        focus: 'WHAT key actions must be performed to operate successfully',
        outputGuidance: 'Describe core operational activities and priorities based on research',
      },
      key_partnerships: {
        focus: 'WHO are the key partners and suppliers needed',
        outputGuidance: 'Describe strategic partnerships and supplier relationships based on research',
      },
      cost_structure: {
        focus: 'WHAT are the major costs required to operate the business model',
        outputGuidance: 'Describe cost drivers and structure (fixed/variable) based on research',
      },
    };

    const context = blockContext[blockType];

    // Build contradiction warning section
    const contradictionWarning = contradictions.length > 0
      ? `\n\n🚨 CRITICAL - CONTRADICTED ASSUMPTIONS:
Research has contradicted the following user assumptions. DO NOT validate these in your synthesis:

${contradictions.map(c => 
  `❌ "${c.assumption}" - Research shows: ${c.contradictedBy.slice(0, 2).join('; ')}`
).join('\n')}

IMPORTANT: If your findings relate to these contradicted assumptions, acknowledge the contradiction rather than validating the assumption.`
      : '';

    const systemPrompt = `You are a Business Model Canvas analyst. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Synthesize research for the "${blockName}" block.

BLOCK FOCUS: ${context.focus}

ORIGINAL INPUT:
${originalInput.substring(0, 1500)}

RESEARCH QUERIES USED:
${queries.map(q => `- ${q.query} (${q.type})`).join('\n')}

SEARCH RESULTS:
${searchSummary}

FULL CONTENT FROM TOP SOURCES:
${fullContentSummary}${contradictionWarning}

Based on the research above, synthesize findings for the ${blockName} block.

${context.outputGuidance}

Return ONLY valid JSON (no markdown, no explanation):

{
  "description": "2-3 sentence summary of this BMC block based on research evidence",
  "findings": [
    {
      "fact": "Specific insight from research about ${context.focus}",
      "citation": "https://source-url.com",
      "confidence": "high|medium|low"
    }
  ],
  "confidence": "weak|moderate|strong",
  "strategicImplications": "1-2 sentences on strategic implications for this block",
  "gaps": ["identified gap 1", "identified gap 2"],
  "researchQueries": ${JSON.stringify(queries.map(q => q.query))}
}

Include 3-6 findings. Set confidence to:
- "strong" if multiple high-quality sources confirm insights
- "moderate" if some sources support insights
- "weak" if limited or uncertain evidence`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 3000,
    }, "anthropic");

    const textContent = response.content;

    const synthesized = parseAIJson(textContent, `BMC ${blockType} synthesis`);

    return {
      blockType,
      blockName,
      description: synthesized.description || '',
      findings: synthesized.findings || [],
      confidence: synthesized.confidence || 'weak',
      strategicImplications: synthesized.strategicImplications || '',
      gaps: synthesized.gaps || [],
      researchQueries: synthesized.researchQueries || [],
    };
  }

  private calculateOverallConfidence(blocks: BMCBlockFindings[]): number {
    const confidenceMap = { weak: 0.3, moderate: 0.6, strong: 0.9 };
    const scores = blocks.map(b => confidenceMap[b.confidence]);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average * 100) / 100;
  }

  async synthesizeOverallBMC(
    blocks: BMCBlockFindings[],
    originalInput: string,
    contradictions: Contradiction[] = []
  ): Promise<{
    viability: string;
    keyInsights: string[];
    criticalGaps: string[];
    consistencyChecks: any[];
    recommendations: any[];
  }> {
    const blockSummary = blocks.map(b => 
      `${b.blockName} (${b.confidence} confidence):\n${b.description}\nGaps: ${b.gaps.join(', ') || 'None identified'}`
    ).join('\n\n');

    const contradictionSummary = contradictions.length > 0
      ? `\n\n🚨 CONTRADICTED ASSUMPTIONS:\n${contradictions.map(c => 
          `- "${c.assumption}" (${c.impact} impact${c.investmentAmount ? `, Investment: ${c.investmentAmount}` : ''})\n  Research found: ${c.contradictedBy.join('; ')}\n  Recommendation: ${c.recommendation}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are a Business Model Canvas expert. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Conduct overall viability analysis.

ORIGINAL INPUT:
${originalInput.substring(0, 1500)}

RESEARCH FINDINGS FOR ALL 9 BMC BLOCKS:
${blockSummary}${contradictionSummary}

Based on these findings, provide comprehensive BMC viability analysis:

1. **Cross-Block Consistency**: Analyze alignment across all blocks. Key relationships to check:
   - Do customer segments align with value propositions?
   - Do channels effectively reach customer segments?
   - Do customer relationships match segment expectations?
   - Do key resources and activities support value delivery?
   - Do key partners fill critical gaps?
   - Does cost structure align with revenue streams?
2. **Overall Viability**: Can this business model work based on research evidence?
3. **Key Insights**: What are the most important strategic insights across all blocks?
4. **Critical Gaps**: What critical information is missing or uncertain? PRIORITIZE contradicted assumptions!
5. **Recommendations**: What should be prioritized or validated? ALWAYS flag contradicted assumptions as HIGH priority!

Return ONLY valid JSON (no markdown, no explanation):

{
  "viability": "strong|moderate|weak",
  "keyInsights": [
    "Cross-block insight 1 (2-3 sentences)",
    "Cross-block insight 2 (2-3 sentences)",
    "Cross-block insight 3 (2-3 sentences)"
  ],
  "criticalGaps": [
    "Critical gap 1",
    "Critical gap 2"
  ],
  "consistencyChecks": [
    {
      "aspect": "Customer-Value Alignment",
      "status": "aligned|misaligned|uncertain",
      "explanation": "Brief explanation of consistency"
    },
    {
      "aspect": "Value-Revenue Alignment",
      "status": "aligned|misaligned|uncertain",
      "explanation": "Brief explanation of consistency"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "Specific recommendation",
      "rationale": "Why this matters"
    }
  ]
}

Viability criteria:
- "strong": All blocks have moderate-strong confidence, good alignment, clear path to revenue
- "moderate": Some uncertainty but core model appears viable with validation
- "weak": Significant gaps, misalignment, or fundamental viability concerns`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 3000,
    }, "anthropic");

    const textContent = response.content;

    const synthesized = parseAIJson(textContent, 'BMC overall synthesis');

    return {
      viability: synthesized.viability || 'weak',
      keyInsights: synthesized.keyInsights || [],
      criticalGaps: synthesized.criticalGaps || [],
      consistencyChecks: synthesized.consistencyChecks || [],
      recommendations: synthesized.recommendations || [],
    };
  }
}
