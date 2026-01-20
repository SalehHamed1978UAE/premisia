import { Router, Request, Response } from 'express';
import { db } from '../db';
import { segmentDiscoveryResults, betaUsageCounters, users } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { encryptKMS, decryptKMS, encryptJSONKMS, decryptJSONKMS } from '../utils/kms-encryption';
import { discoveryCacheService } from '../services/discovery-cache-service';

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const OFFERING_TYPES = [
  'b2b_software',
  'b2c_software',
  'professional_services',
  'physical_product',
  'marketplace_platform',
  'content_education',
  'other'
] as const;

const COMPANY_STAGES = [
  'idea_stage',
  'built_no_users',
  'early_users',
  'growing',
  'scaling'
] as const;

const GTM_CONSTRAINTS = [
  'solo_founder',
  'small_team',
  'funded_startup',
  'established_company'
] as const;

const SALES_MOTIONS = [
  'self_serve',
  'light_touch',
  'enterprise',
  'partner_channel'
] as const;

interface ClassificationResult {
  offeringType: typeof OFFERING_TYPES[number];
  suggestedStage: typeof COMPANY_STAGES[number];
  suggestedGtmConstraint: typeof GTM_CONSTRAINTS[number];
  suggestedSalesMotion: typeof SALES_MOTIONS[number];
  confidence: number;
  reasoning: string;
}

async function classifyOffering(description: string): Promise<ClassificationResult> {
  const prompt = `Analyze this offering description and classify it for marketing strategy purposes:

"${description}"

Classify into these categories:

OFFERING TYPE (pick one):
- b2b_software: SaaS or software sold to businesses
- b2c_software: Apps or software sold to consumers
- professional_services: Consulting, agency, or service-based business
- physical_product: Physical goods or products
- marketplace_platform: Two-sided marketplace connecting buyers/sellers
- content_education: Courses, content, coaching, education
- other: Doesn't fit above categories

COMPANY STAGE (suggest based on context clues):
- idea_stage: Just an idea, no product yet
- built_no_users: Product exists but no users/customers
- early_users: Some initial users/customers (< 100)
- growing: Growing user base, finding product-market fit
- scaling: Proven model, scaling operations

GTM CONSTRAINT (suggest based on context):
- solo_founder: Single person operation
- small_team: 2-5 person team
- funded_startup: Has external funding, can invest in growth
- established_company: Existing company with resources

SALES MOTION (suggest based on offering type):
- self_serve: Users sign up and pay without talking to sales
- light_touch: Some sales involvement but quick cycle
- enterprise: Complex sales, multiple stakeholders
- partner_channel: Selling through partners/resellers

Return JSON only:
{
  "offeringType": "one of the types above",
  "suggestedStage": "one of the stages above",
  "suggestedGtmConstraint": "one of the constraints above",
  "suggestedSalesMotion": "one of the motions above",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
    
    if (!OFFERING_TYPES.includes(result.offeringType)) {
      result.offeringType = 'other';
    }
    if (!COMPANY_STAGES.includes(result.suggestedStage)) {
      result.suggestedStage = 'idea_stage';
    }
    if (!GTM_CONSTRAINTS.includes(result.suggestedGtmConstraint)) {
      result.suggestedGtmConstraint = 'solo_founder';
    }
    if (!SALES_MOTIONS.includes(result.suggestedSalesMotion)) {
      result.suggestedSalesMotion = 'self_serve';
    }
    
    return result;
  } catch (error) {
    console.error('[Marketing Consultant] Failed to parse classification:', error);
    return {
      offeringType: 'other',
      suggestedStage: 'idea_stage',
      suggestedGtmConstraint: 'solo_founder',
      suggestedSalesMotion: 'self_serve',
      confidence: 0.3,
      reasoning: 'Could not parse AI response, using defaults',
    };
  }
}

router.post('/check-ambiguities', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userInput } = req.body;
    if (!userInput) {
      return res.status(400).json({ error: 'userInput is required' });
    }

    const prompt = `Analyze this marketing/business offering for ambiguities that would affect segment discovery:

"${userInput}"

MARKETING-SPECIFIC AMBIGUITIES TO CHECK:

1. **Target Customer Ambiguity**
   - Is this B2B (businesses) or B2C (consumers)?
   - Who is the economic buyer vs the user?

2. **Value Proposition Ambiguity**
   - What specific problem does this solve?
   - Is the benefit clear?

3. **Delivery/Distribution Ambiguity**
   - How is the offering delivered (digital, physical, in-person)?
   - Is this a product or service?

4. **Pricing Model Ambiguity**
   - One-time, subscription, or usage-based?
   - What price tier are we targeting?

5. **Geographic Scope Ambiguity**
   - Local, regional, national, or global?
   - Any market-specific focus?

INSTRUCTIONS:
- Identify CRITICAL ambiguities for market segmentation
- Generate clear multiple-choice questions
- Provide 2-4 specific options per question
- Focus on marketing and go-to-market clarity

Return as JSON:
{
  "hasAmbiguities": true/false,
  "questions": [
    {
      "id": "unique_id",
      "question": "Clear question?",
      "multiSelect": false,
      "options": [
        { "value": "option_key", "label": "Short Label", "description": "Longer explanation" }
      ]
    }
  ],
  "reasoning": "Why these ambiguities matter for segmentation"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return res.status(500).json({ error: 'Unexpected AI response' });
    }

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({ hasAmbiguities: false, questions: [] });
      }
      const result = JSON.parse(jsonMatch[0]);
      res.json({
        hasAmbiguities: result.hasAmbiguities ?? false,
        questions: result.questions ?? [],
        reasoning: result.reasoning,
      });
    } catch (parseError) {
      console.error('[Marketing Consultant] Failed to parse ambiguity response:', parseError);
      res.json({ hasAmbiguities: false, questions: [] });
    }
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in check-ambiguities:', error);
    res.status(500).json({ error: error.message || 'Failed to check ambiguities' });
  }
});

router.post('/understanding', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { input, clarifications } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'input is required' });
    }

    const classification = await classifyOffering(input);

    // Encrypt sensitive business data
    const encryptedDescription = await encryptKMS(input);
    const encryptedClarifications = clarifications ? await encryptJSONKMS(clarifications) : null;

    const [newRecord] = await db.insert(segmentDiscoveryResults).values({
      userId,
      offeringDescription: encryptedDescription || input,
      offeringType: classification.offeringType,
      stage: classification.suggestedStage,
      gtmConstraint: classification.suggestedGtmConstraint,
      salesMotion: classification.suggestedSalesMotion,
      clarifications: encryptedClarifications,
      status: 'pending',
    }).returning();

    res.json({
      understandingId: newRecord.id,
      classification: {
        offeringType: classification.offeringType,
        suggestedStage: classification.suggestedStage,
        suggestedGtmConstraint: classification.suggestedGtmConstraint,
        suggestedSalesMotion: classification.suggestedSalesMotion,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
      },
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in understanding:', error);
    res.status(500).json({ error: error.message || 'Failed to create understanding' });
  }
});

router.post('/classification/confirm', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { understandingId, offeringType, stage, gtmConstraint, salesMotion, existingHypothesis } = req.body;

    if (!understandingId) {
      return res.status(400).json({ error: 'understandingId is required' });
    }
    if (!offeringType || !stage || !gtmConstraint || !salesMotion) {
      return res.status(400).json({ error: 'All classification fields are required' });
    }

    const [existing] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, understandingId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Understanding record not found' });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this record' });
    }

    await db.update(segmentDiscoveryResults)
      .set({
        offeringType: offeringType as typeof OFFERING_TYPES[number],
        stage: stage as typeof COMPANY_STAGES[number],
        gtmConstraint: gtmConstraint as typeof GTM_CONSTRAINTS[number],
        salesMotion: salesMotion as typeof SALES_MOTIONS[number],
        existingHypothesis: existingHypothesis || null,
        updatedAt: new Date(),
      })
      .where(eq(segmentDiscoveryResults.id, understandingId));

    res.json({
      success: true,
      understandingId,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in classification/confirm:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm classification' });
  }
});

router.get('/beta-status', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [counter] = await db.select()
      .from(betaUsageCounters)
      .where(eq(betaUsageCounters.featureName, 'segment_discovery'))
      .limit(1);

    if (!counter) {
      return res.json({
        available: true,
        currentCount: 0,
        maxCount: 100,
      });
    }

    const available = counter.currentCount < counter.maxCount;

    res.json({
      available,
      currentCount: counter.currentCount,
      maxCount: counter.maxCount,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in beta-status:', error);
    res.status(500).json({ error: error.message || 'Failed to check beta status' });
  }
});

router.post('/beta/increment', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [counter] = await db.select()
      .from(betaUsageCounters)
      .where(eq(betaUsageCounters.featureName, 'segment_discovery'))
      .limit(1);

    if (!counter) {
      await db.insert(betaUsageCounters).values({
        featureName: 'segment_discovery',
        currentCount: 1,
        maxCount: 100,
      });

      return res.json({
        success: true,
        available: true,
      });
    }

    if (counter.currentCount >= counter.maxCount) {
      return res.json({
        success: false,
        available: false,
      });
    }

    await db.update(betaUsageCounters)
      .set({
        currentCount: sql`${betaUsageCounters.currentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(betaUsageCounters.featureName, 'segment_discovery'));

    res.json({
      success: true,
      available: true,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in beta/increment:', error);
    res.status(500).json({ error: error.message || 'Failed to increment beta counter' });
  }
});

// List all discoveries for the current user - MUST be before /:id to avoid catch-all
router.get('/discoveries', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;

    const records = await db.select({
      id: segmentDiscoveryResults.id,
      offeringType: segmentDiscoveryResults.offeringType,
      stage: segmentDiscoveryResults.stage,
      status: segmentDiscoveryResults.status,
      createdAt: segmentDiscoveryResults.createdAt,
      completedAt: segmentDiscoveryResults.completedAt,
    })
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.userId, userId))
      .orderBy(desc(segmentDiscoveryResults.createdAt))
      .limit(50);

    res.json({ discoveries: records });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in GET discoveries:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch discoveries' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const [record] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, id))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this record' });
    }

    // Decrypt sensitive fields (handles both encrypted and unencrypted legacy data)
    const decryptedDescription = await decryptKMS(record.offeringDescription);
    const decryptedHypothesis = record.existingHypothesis ? await decryptKMS(record.existingHypothesis) : null;
    const decryptedClarifications = record.clarifications ? await decryptJSONKMS(record.clarifications as string) : null;

    res.json({
      id: record.id,
      offeringDescription: decryptedDescription || record.offeringDescription,
      offeringType: record.offeringType,
      stage: record.stage,
      gtmConstraint: record.gtmConstraint,
      salesMotion: record.salesMotion,
      existingHypothesis: decryptedHypothesis,
      clarifications: decryptedClarifications,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in GET /:id:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch record' });
  }
});

// Progress tracking for SSE
const discoveryProgress = new Map<string, { step: string; progress: number; message: string }>();

router.post('/start-discovery/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { id } = req.params;

    const [record] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, id))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (record.status === 'running') {
      return res.status(400).json({ error: 'Discovery already in progress' });
    }

    // Decrypt sensitive fields before passing to discovery engine
    const decryptedDescription = await decryptKMS(record.offeringDescription);
    const decryptedHypothesis = record.existingHypothesis ? await decryptKMS(record.existingHypothesis) : undefined;

    // Update status to running
    await db.update(segmentDiscoveryResults)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(segmentDiscoveryResults.id, id));

    // Initialize progress tracking
    discoveryProgress.set(id, { step: 'Starting', progress: 0, message: 'Initializing segment discovery...' });

    // Start discovery in background (pass userId for caching, use decrypted values)
    runSegmentDiscovery(id, userId, {
      offeringDescription: decryptedDescription || record.offeringDescription,
      offeringType: record.offeringType || 'other',
      stage: record.stage || 'idea_stage',
      gtmConstraint: record.gtmConstraint || 'solo_founder',
      salesMotion: record.salesMotion || 'self_serve',
      existingHypothesis: decryptedHypothesis,
    });

    res.json({
      success: true,
      message: 'Discovery started',
      understandingId: id,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error starting discovery:', error);
    res.status(500).json({ error: error.message || 'Failed to start discovery' });
  }
});

async function runSegmentDiscovery(id: string, userId: string, context: any) {
  try {
    // Check cache first for instant results on retry
    const cached = discoveryCacheService.get(userId, context);
    if (cached) {
      console.log(`[Segment Discovery ${id}] Using cached result`);
      discoveryProgress.set(id, { step: 'Using cached results', progress: 50, message: 'Loading cached results...' });
      
      // Encrypt cached result and save to database
      const [encryptedGeneLibrary, encryptedGenomes, encryptedSynthesis] = await Promise.all([
        encryptJSONKMS(cached.geneLibrary),
        encryptJSONKMS(cached.genomes),
        encryptJSONKMS(cached.synthesis),
      ]);

      await db.update(segmentDiscoveryResults)
        .set({
          geneLibrary: encryptedGeneLibrary || cached.geneLibrary,
          genomes: encryptedGenomes || cached.genomes,
          synthesis: encryptedSynthesis || cached.synthesis,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(segmentDiscoveryResults.id, id));

      discoveryProgress.set(id, { step: 'Complete (cached)', progress: 100, message: 'Discovery complete!' });
      console.log(`[Segment Discovery ${id}] Completed from cache`);
      return;
    }

    const { segmentDiscoveryEngine } = await import('../services/segment-discovery-engine');
    
    const result = await segmentDiscoveryEngine.runDiscovery(
      context,
      (step: string, progress: number) => {
        discoveryProgress.set(id, { step, progress, message: step });
        console.log(`[Segment Discovery ${id}] ${step}: ${progress}%`);
      }
    );

    // Cache the result for future requests (user-scoped)
    discoveryCacheService.set(userId, context, result);

    // Debug: Log result sizes before encryption
    console.log(`[Segment Discovery ${id}] Result sizes - geneLibrary: ${result.geneLibrary ? Object.keys(result.geneLibrary.dimensions || {}).length : 'null'} dims, genomes: ${result.genomes?.length || 0}, synthesis: ${result.synthesis?.beachhead ? 'has beachhead' : 'null'}`);

    // Encrypt and save results to database (parallel for speed)
    const [encryptedGeneLibrary, encryptedGenomes, encryptedSynthesis] = await Promise.all([
      encryptJSONKMS(result.geneLibrary),
      encryptJSONKMS(result.genomes),
      encryptJSONKMS(result.synthesis),
    ]);

    // Debug: Log encryption results
    console.log(`[Segment Discovery ${id}] Encryption results - geneLibrary: ${encryptedGeneLibrary ? encryptedGeneLibrary.length + ' chars' : 'NULL'}, genomes: ${encryptedGenomes ? encryptedGenomes.length + ' chars' : 'NULL'}, synthesis: ${encryptedSynthesis ? encryptedSynthesis.length + ' chars' : 'NULL'}`);

    if (!encryptedGeneLibrary || !encryptedGenomes || !encryptedSynthesis) {
      console.error(`[Segment Discovery ${id}] ENCRYPTION FAILED - one or more fields returned null!`);
    }

    // Create lightweight summary for instant loading (NOT encrypted)
    const uniqueRoles = new Set(result.genomes.map(g => g.genes.decision_maker)).size;
    const beachheadGenome = result.synthesis.beachhead.genome;
    const summary = {
      topGenomes: result.genomes.slice(0, 20).map(g => ({
        id: g.id,
        genes: g.genes,
        score: g.fitness.totalScore,
        narrative: g.narrativeReason
      })),
      // Include full beachhead data for instant display
      beachhead: {
        genome: {
          id: beachheadGenome.id,
          genes: beachheadGenome.genes,
          fitness: beachheadGenome.fitness,
          narrativeReason: beachheadGenome.narrativeReason
        },
        rationale: result.synthesis.beachhead.rationale,
        validationPlan: result.synthesis.beachhead.validationPlan
      },
      backupSegments: (result.synthesis.backupSegments || []).slice(0, 3).map(s => ({
        id: s.id,
        genes: s.genes,
        fitness: s.fitness,
        narrativeReason: s.narrativeReason
      })),
      strategicInsights: result.synthesis.strategicInsights || [],
      beachheadId: result.synthesis.beachhead.genome.id,
      totalSegments: result.genomes.length,
      uniqueRoles,
      completedAt: new Date().toISOString()
    };

    await db.update(segmentDiscoveryResults)
      .set({
        geneLibrary: encryptedGeneLibrary,
        genomes: encryptedGenomes,
        synthesis: encryptedSynthesis,
        summary,
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(segmentDiscoveryResults.id, id));

    console.log(`[Segment Discovery ${id}] Database update completed`);
    discoveryProgress.set(id, { step: 'Complete', progress: 100, message: 'Discovery complete!' });
    console.log(`[Segment Discovery ${id}] Completed successfully`);
  } catch (error: any) {
    console.error(`[Segment Discovery ${id}] Failed:`, error);
    
    await db.update(segmentDiscoveryResults)
      .set({
        status: 'failed',
        errorMessage: error.message,
        updatedAt: new Date(),
      })
      .where(eq(segmentDiscoveryResults.id, id));

    discoveryProgress.set(id, { step: 'Error', progress: -1, message: error.message });
  }
}

router.get('/discovery-stream/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { id } = req.params;

    const [record] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, id))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Discovery stream connected' })}\n\n`);

    // Poll for progress updates
    const pollInterval = setInterval(async () => {
      try {
        const progress = discoveryProgress.get(id);
        
        if (progress) {
          if (progress.progress === 100) {
            res.write(`data: ${JSON.stringify({ type: 'complete', ...progress })}\n\n`);
            clearInterval(pollInterval);
            res.end();
            return;
          }
          
          if (progress.progress === -1) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: progress.message })}\n\n`);
            clearInterval(pollInterval);
            res.end();
            return;
          }
          
          // Parse special event types encoded in step string
          if (progress.step?.startsWith('intermediate_results:')) {
            try {
              const data = JSON.parse(progress.step.replace('intermediate_results:', ''));
              res.write(`event: intermediate_results\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              console.error('[Discovery Stream] Failed to parse intermediate_results:', e);
            }
          } else if (progress.step?.startsWith('partial_scores:')) {
            try {
              const data = JSON.parse(progress.step.replace('partial_scores:', ''));
              res.write(`event: partial_scores\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              console.error('[Discovery Stream] Failed to parse partial_scores:', e);
            }
          } else if (progress.step?.startsWith('stage_error:')) {
            try {
              const data = JSON.parse(progress.step.replace('stage_error:', ''));
              res.write(`event: stage_error\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              console.error('[Discovery Stream] Failed to parse stage_error:', e);
            }
          } else {
            // Standard progress event
            res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
          }
        } else {
          // Check database for completed status
          const [current] = await db.select()
            .from(segmentDiscoveryResults)
            .where(eq(segmentDiscoveryResults.id, id))
            .limit(1);
          
          if (current?.status === 'completed') {
            res.write(`data: ${JSON.stringify({ type: 'complete', step: 'Complete', progress: 100 })}\n\n`);
            clearInterval(pollInterval);
            res.end();
            return;
          }
          
          if (current?.status === 'failed') {
            res.write(`data: ${JSON.stringify({ type: 'error', message: current.errorMessage || 'Discovery failed' })}\n\n`);
            clearInterval(pollInterval);
            res.end();
            return;
          }
        }
      } catch (pollError) {
        console.error('[Discovery Stream] Poll error:', pollError);
      }
    }, 1000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval);
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Discovery timed out' })}\n\n`);
      res.end();
    }, 10 * 60 * 1000);

  } catch (error: any) {
    console.error('[Marketing Consultant] Error in discovery stream:', error);
    res.status(500).json({ error: error.message || 'Failed to stream discovery' });
  }
});

router.get('/results/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { id } = req.params;
    const expandFull = req.query.expand === 'full';

    const [record] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, id))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    // Debug: log what fields Drizzle returns
    console.log('[Results] Record keys:', Object.keys(record));
    console.log('[Results] geneLibrary type:', typeof record.geneLibrary, 'truthy:', !!record.geneLibrary);
    console.log('[Results] genomes type:', typeof record.genomes, 'truthy:', !!record.genomes);
    console.log('[Results] synthesis type:', typeof record.synthesis, 'truthy:', !!record.synthesis);

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // If summary exists and expand=full is not requested, return lightweight summary
    if (record.summary && !expandFull) {
      console.log('[Results] Returning lightweight summary (no decryption)');
      return res.json({
        id: record.id,
        summary: record.summary,
        offeringType: record.offeringType,
        stage: record.stage,
        status: record.status,
        createdAt: record.createdAt,
        completedAt: record.completedAt,
      });
    }

    // Full payload - decrypt all fields
    const decryptedDescription = await decryptKMS(record.offeringDescription);
    const decryptedHypothesis = record.existingHypothesis ? await decryptKMS(record.existingHypothesis) : null;
    const decryptedClarifications = record.clarifications ? await decryptJSONKMS(record.clarifications as string) : null;
    
    // Helper to decrypt JSONB fields that may be:
    // 1. Encrypted string stored in JSONB (comes back as string from Drizzle)
    // 2. Unencrypted object stored in JSONB (comes back as object from Drizzle)
    const decryptJsonbField = async <T>(field: any, fieldName: string): Promise<T | null> => {
      if (!field) {
        console.log(`[Decrypt ${fieldName}] Field is null/undefined`);
        return null;
      }
      
      console.log(`[Decrypt ${fieldName}] Type: ${typeof field}, isArray: ${Array.isArray(field)}`);
      if (typeof field === 'string') {
        console.log(`[Decrypt ${fieldName}] String length: ${field.length}, starts with: ${field.substring(0, 50)}`);
      }
      
      // If it's already an object (not encrypted), return as-is
      if (typeof field === 'object' && field !== null && !('dataKeyCiphertext' in field)) {
        console.log(`[Decrypt ${fieldName}] Returning unencrypted object as-is`);
        return field as T;
      }
      
      // If it's an object with encryption format keys, stringify it first
      if (typeof field === 'object' && 'dataKeyCiphertext' in field) {
        console.log(`[Decrypt ${fieldName}] Decrypting object with encryption keys`);
        return await decryptJSONKMS<T>(JSON.stringify(field));
      }
      
      // If it's a string, try to decrypt it
      if (typeof field === 'string') {
        console.log(`[Decrypt ${fieldName}] Decrypting string`);
        const result = await decryptJSONKMS<T>(field);
        console.log(`[Decrypt ${fieldName}] Result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
        return result;
      }
      
      return null;
    };
    
    let decryptedGeneLibrary: any = null;
    let decryptedGenomes: any = null;
    let decryptedSynthesis: any = null;
    
    try {
      decryptedGeneLibrary = await decryptJsonbField(record.geneLibrary, 'geneLibrary');
      console.log('[Results] geneLibrary decrypted, dimensions:', decryptedGeneLibrary?.dimensions ? Object.keys(decryptedGeneLibrary.dimensions).length : 0);
    } catch (e) {
      console.error('[Results] geneLibrary decryption failed:', e);
    }
    
    try {
      decryptedGenomes = await decryptJsonbField(record.genomes, 'genomes');
      console.log('[Results] genomes decrypted, count:', Array.isArray(decryptedGenomes) ? decryptedGenomes.length : 0);
    } catch (e) {
      console.error('[Results] genomes decryption failed:', e);
    }
    
    try {
      decryptedSynthesis = await decryptJsonbField(record.synthesis, 'synthesis');
      console.log('[Results] synthesis decrypted, has beachhead:', !!decryptedSynthesis?.beachhead);
    } catch (e) {
      console.error('[Results] synthesis decryption failed:', e);
    }

    res.json({
      id: record.id,
      offeringDescription: decryptedDescription || record.offeringDescription,
      offeringType: record.offeringType,
      stage: record.stage,
      gtmConstraint: record.gtmConstraint,
      salesMotion: record.salesMotion,
      existingHypothesis: decryptedHypothesis,
      clarifications: decryptedClarifications,
      geneLibrary: decryptedGeneLibrary,
      genomes: decryptedGenomes,
      synthesis: decryptedSynthesis,
      summary: record.summary,
      status: record.status,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    });
  } catch (error: any) {
    console.error('[Marketing Consultant] Error in GET results:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch results' });
  }
});

// Generate strategic summary for handoff to Strategic Consultant
router.get('/strategic-summary/:discoveryId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.claims?.sub) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = user.claims.sub;
    const { discoveryId } = req.params;

    const [record] = await db.select()
      .from(segmentDiscoveryResults)
      .where(eq(segmentDiscoveryResults.id, discoveryId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Discovery not found' });
    }

    if (record.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (record.status !== 'completed') {
      return res.status(400).json({ error: 'Discovery not yet completed' });
    }

    // Check if we have a cached summary
    if (record.strategicSummary) {
      const cachedSummary = await decryptKMS(record.strategicSummary);
      console.log('[Strategic Summary] Returning cached summary for:', discoveryId);
      return res.json({ summary: cachedSummary, cached: true });
    }

    // Decrypt the data for LLM summarization
    const decryptedDescription = await decryptKMS(record.offeringDescription);
    
    // Helper to decrypt JSONB fields
    const decryptJsonbField = async <T>(field: any): Promise<T | null> => {
      if (!field) return null;
      if (typeof field === 'object' && field !== null && !('dataKeyCiphertext' in field)) {
        return field as T;
      }
      if (typeof field === 'object' && 'dataKeyCiphertext' in field) {
        return await decryptJSONKMS<T>(JSON.stringify(field));
      }
      if (typeof field === 'string') {
        return await decryptJSONKMS<T>(field);
      }
      return null;
    };

    const decryptedClarifications = record.clarifications ? await decryptJsonbField(record.clarifications) : null;
    const decryptedSynthesis = await decryptJsonbField<any>(record.synthesis);

    // Build context for LLM
    const beachhead = decryptedSynthesis?.beachhead;
    const backupSegments = decryptedSynthesis?.backupSegments?.slice(0, 3) || [];
    
    const offeringTypeLabels: Record<string, string> = {
      'b2b_software': 'B2B Software',
      'b2c_software': 'B2C Software',
      'professional_services': 'Professional Services',
      'physical_product': 'Physical Product',
      'marketplace_platform': 'Marketplace/Platform',
      'content_education': 'Content/Education',
      'other': 'Other'
    };

    const stageLabels: Record<string, string> = {
      'idea_stage': 'Idea Stage',
      'built_no_users': 'Built, No Users',
      'early_users': 'Early Users',
      'growing': 'Growing',
      'scaling': 'Scaling'
    };

    const prompt = `You are helping a user transition from market segmentation analysis to strategic planning. Generate a concise summary that will pre-fill their strategic analysis input.

## Segment Discovery Results

**Offering:** ${decryptedDescription}

**Business Context:**
- Type: ${offeringTypeLabels[record.offeringType] || record.offeringType}
- Stage: ${stageLabels[record.stage] || record.stage}
- GTM: ${record.gtmConstraint?.replace(/_/g, ' ')}
- Sales Motion: ${record.salesMotion?.replace(/_/g, ' ')}

${decryptedClarifications ? `**User Clarifications:** ${JSON.stringify(decryptedClarifications)}` : ''}

**Recommended Beachhead Market:**
${beachhead ? `
- Industry: ${beachhead.genes?.industry_vertical || 'Not specified'}
- Company Size: ${beachhead.genes?.company_size || 'Not specified'}
- Decision Maker: ${beachhead.genes?.decision_maker || 'Not specified'}
- Purchase Trigger: ${beachhead.genes?.purchase_trigger || 'Not specified'}
- Score: ${beachhead.fitness?.totalScore || 'N/A'}/40
- Rationale: ${beachhead.rationale || 'Not provided'}
` : 'No beachhead identified'}

${backupSegments.length > 0 ? `**Backup Segments:**
${backupSegments.map((s: any, i: number) => `${i + 1}. ${s.genes?.industry_vertical || 'Unknown'} - ${s.genes?.decision_maker || 'Unknown'} (Score: ${s.fitness?.totalScore || 'N/A'}/40)`).join('\n')}
` : ''}

## Task

Write a 2-3 paragraph summary suitable for pasting into a strategic analysis tool. The summary should:
1. Briefly describe what the offering is and who it's for
2. Highlight the recommended beachhead market and why it was selected
3. Note key strategic considerations for the next phase of analysis

Write in first person as if the user is describing their situation. Be concise and actionable. Do NOT use markdown headers or bullet points - write flowing prose paragraphs.`;

    console.log('[Strategic Summary] Generating LLM summary for:', discoveryId);
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const summaryText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Cache the summary (encrypted)
    const encryptedSummary = await encryptKMS(summaryText);
    await db.update(segmentDiscoveryResults)
      .set({ strategicSummary: encryptedSummary, updatedAt: new Date() })
      .where(eq(segmentDiscoveryResults.id, discoveryId));

    console.log('[Strategic Summary] Summary generated and cached for:', discoveryId);
    
    res.json({ summary: summaryText, cached: false });
  } catch (error: any) {
    console.error('[Strategic Summary] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

export default router;
