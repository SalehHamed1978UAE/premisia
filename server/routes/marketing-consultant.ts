import { Router, Request, Response } from 'express';
import { db } from '../db';
import { segmentDiscoveryResults, betaUsageCounters, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

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

    const [newRecord] = await db.insert(segmentDiscoveryResults).values({
      userId,
      offeringDescription: input,
      offeringType: classification.offeringType,
      stage: classification.suggestedStage,
      gtmConstraint: classification.suggestedGtmConstraint,
      salesMotion: classification.suggestedSalesMotion,
      clarifications: clarifications ? JSON.stringify(clarifications) : null,
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

export default router;
