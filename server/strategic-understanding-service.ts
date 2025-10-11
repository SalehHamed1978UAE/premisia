import OpenAI from "openai";
import { z } from "zod";
import { db } from "./db";
import { 
  strategicUnderstanding, 
  strategicEntities, 
  strategicRelationships 
} from "@shared/schema";
import type { 
  InsertStrategicUnderstanding,
  InsertStrategicEntity,
  InsertStrategicRelationship,
  StrategicUnderstanding,
  StrategicEntity,
  StrategicRelationship
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { aiClients } from "./ai-clients";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export interface ExtractUnderstandingOptions {
  sessionId: string;
  userInput: string;
  companyContext?: any;
}

export interface EntityExtractionResult {
  type: string;
  claim: string;
  source: string;
  confidence: "high" | "medium" | "low";
  category?: string;
  subcategory?: string;
  investmentAmount?: number;
  evidence?: string;
}

const entityExtractionSchema = z.object({
  entities: z.array(z.object({
    type: z.enum([
      'explicit_assumption',
      'implicit_implication', 
      'inferred_reasoning',
      'constraint',
      'opportunity',
      'risk'
    ]),
    claim: z.string(),
    source: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    investmentAmount: z.number().optional(),
    evidence: z.string().optional(),
  })),
});

export class StrategicUnderstandingService {
  private openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor() {
    // Lazy initialization of OpenAI client
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private validateSource(source: string, userInput: string): boolean {
    const normalizedSource = this.normalizeText(source);
    const normalizedInput = this.normalizeText(userInput);
    
    if (normalizedSource.length === 0) {
      return false;
    }
    
    return normalizedInput.includes(normalizedSource);
  }

  async getOrCreateUnderstanding(sessionId: string, userInput: string, companyContext?: any): Promise<StrategicUnderstanding> {
    const existing = await db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.sessionId, sessionId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const understanding: InsertStrategicUnderstanding = {
      sessionId,
      userInput,
      companyContext: companyContext || null,
      graphVersion: 1,
      lastEnrichedBy: null,
      lastEnrichedAt: null,
    };

    const inserted = await db
      .insert(strategicUnderstanding)
      .values(understanding)
      .returning();

    return inserted[0];
  }

  async extractUnderstanding(options: ExtractUnderstandingOptions): Promise<{ understandingId: string; entities: EntityExtractionResult[] }> {
    const { sessionId, userInput, companyContext } = options;
    
    // Get or create the strategic understanding record
    const understanding = await this.getOrCreateUnderstanding(sessionId, userInput, companyContext);

    const systemPrompt = `You are a strategic insight extraction expert. Your ONLY job is to extract verifiable insights from user input. Return ONLY valid JSON (no markdown, no explanation).

CRITICAL GROUNDING RULES:
1. EXPLICIT entities: User DIRECTLY stated them - require exact quote in source field
2. IMPLICIT entities: Direct logical implications with clear reasoning chain
3. INFERRED entities: Exploratory reasoning (mark as low confidence)
4. NEVER invent facts not grounded in the input
5. Source field MUST contain actual text from input (exact substring match required)`;

    const userMessage = `Extract strategic entities from user input using STRICT 3-tier categorization. Only extract what can be VALIDATED.

USER INPUT:
${userInput}

ENTITY TYPES & CATEGORIZATION:

**1. EXPLICIT_ASSUMPTION (confidence: high)**
- User DIRECTLY states: "We assume X", "X is critical", "We need Y", "Plan to do Z"
- Investment amounts: "$500K for Hindi" → "Hindi localization is a priority" (explicit, investment=$500000)
- Targets: "100 clients in 18 months" → "100 clients within 18 months is the goal" (explicit)
- Source: EXACT quote where user stated it

**2. IMPLICIT_IMPLICATION (confidence: medium)**
- DIRECT logical implications only:
  - "Expand to India" → "India market entry is planned" (implicit)
  - "Need Hindi localization" → "Non-Hindi speakers are potential customers" (implicit)
  - "$500K investment" → "Expects ROI from this investment" (implicit)
- Source: Quote the text that implies it
- Evidence: Explain the logical chain briefly.

**3. INFERRED_REASONING (confidence: low)**
- Exploratory/speculative insights:
  - "Target enterprises" → MIGHT imply "SMB market is deprioritized" (inferred)
  - "18-month timeline" → COULD suggest "Speed is competitive advantage" (inferred)
- Mark confidence as LOW
- Evidence: Explain the reasoning

**4. CONSTRAINT, OPPORTUNITY, RISK**
- CONSTRAINT: "Budget is $500K" (explicit limit)
- OPPORTUNITY: "Indian market is growing" (if stated)
- RISK: "Competition is intense" (if stated)

EXTRACTION RULES:
1. Extract 3-8 entities (quality over quantity)
2. Source MUST be actual text from input (will be validated)
3. Explicit entities require HIGH confidence + exact quote
4. Implicit entities need clear logical chain in evidence
5. Inferred entities have LOW confidence + reasoning explanation
6. Extract investment amounts as numbers (e.g., 500000 for "$500K")
7. Add category/subcategory for organization (e.g., "market_entry", "localization")

EXAMPLE:

Input: "We want to expand Asana to India with Hindi localization ($500K investment) to target 100 enterprise clients in 18 months."

Extract:
{
  "entities": [
    {
      "type": "explicit_assumption",
      "claim": "India market expansion is planned",
      "source": "expand Asana to India",
      "confidence": "high",
      "category": "market_entry"
    },
    {
      "type": "explicit_assumption",
      "claim": "Hindi localization requires $500K investment",
      "source": "Hindi localization ($500K investment)",
      "confidence": "high",
      "category": "localization",
      "investmentAmount": 500000
    },
    {
      "type": "explicit_assumption",
      "claim": "Target is 100 enterprise clients within 18 months",
      "source": "target 100 enterprise clients in 18 months",
      "confidence": "high",
      "category": "growth_target"
    },
    {
      "type": "implicit_implication",
      "claim": "Enterprise segment is the primary target in India",
      "source": "target 100 enterprise clients",
      "confidence": "medium",
      "evidence": "Specific focus on enterprise clients implies prioritization of this segment"
    },
    {
      "type": "implicit_implication",
      "claim": "18-month timeline is considered achievable",
      "source": "in 18 months",
      "confidence": "medium",
      "evidence": "Setting a specific timeline implies feasibility assessment"
    },
    {
      "type": "inferred_reasoning",
      "claim": "Speed to market may be a competitive factor",
      "source": "in 18 months",
      "confidence": "low",
      "evidence": "The specific 18-month timeline could suggest urgency driven by competitive pressure, but this is speculative"
    }
  ]
}

Now extract entities from the provided user input. Return ONLY valid JSON:`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 3000,
    }, "anthropic");

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = entityExtractionSchema.parse(parsed);

    console.log(`[StrategicUnderstanding] AI extracted ${validated.entities.length} entities, validating sources...`);
    
    const validEntities: EntityExtractionResult[] = [];
    const rejectedEntities: EntityExtractionResult[] = [];

    for (const entity of validated.entities) {
      if (this.validateSource(entity.source, userInput)) {
        validEntities.push(entity);
        console.log(`  ✓ [${entity.type}] ${entity.claim.substring(0, 60)}...`);
      } else {
        rejectedEntities.push(entity);
        console.warn(`  ✗ REJECTED [${entity.type}] ${entity.claim.substring(0, 60)}...`);
        console.warn(`    Invalid source: "${entity.source}" not found in input`);
      }
    }

    if (rejectedEntities.length > 0) {
      console.warn(`[StrategicUnderstanding] Rejected ${rejectedEntities.length} entities with invalid sources`);
    }

    console.log(`[StrategicUnderstanding] Final: ${validEntities.length} valid entities (${rejectedEntities.length} rejected)`);

    // Persist user input entities to database with discovered_by='user_input'
    console.log(`[StrategicUnderstanding] Persisting ${validEntities.length} user input entities...`);
    
    // Generate embeddings in batch to avoid timeouts
    const claims = validEntities.map(e => e.claim);
    const embeddings = await this.generateEmbeddingsBatch(claims);
    
    const persistedEntities: StrategicEntity[] = [];
    
    for (let i = 0; i < validEntities.length; i++) {
      const entity = validEntities[i];
      const embedding = embeddings[i];
      
      const entityData: InsertStrategicEntity = {
        understandingId: understanding.id,
        type: entity.type as any,
        claim: entity.claim,
        confidence: entity.confidence,
        embedding: embedding as any,
        source: entity.source,
        evidence: entity.evidence || null,
        category: entity.category || null,
        subcategory: entity.subcategory || null,
        investmentAmount: entity.investmentAmount || null,
        discoveredBy: 'user_input' as any,
        validFrom: new Date(),
        validTo: null,
        metadata: null,
      };

      const inserted = await db
        .insert(strategicEntities)
        .values(entityData)
        .returning();
      
      persistedEntities.push(inserted[0]);
    }
    
    console.log(`[StrategicUnderstanding] ✓ Persisted ${persistedEntities.length} user entities with discovered_by='user_input'`);

    return {
      understandingId: understanding.id,
      entities: validEntities,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.toLowerCase().trim();
    
    if (this.embeddingCache.has(cacheKey)) {
      console.log(`[StrategicUnderstanding] Embedding cache hit for: ${text.substring(0, 50)}...`);
      return this.embeddingCache.get(cacheKey)!;
    }

    const openai = this.getOpenAI();
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;
    this.embeddingCache.set(cacheKey, embedding);
    
    console.log(`[StrategicUnderstanding] Generated embedding for: ${text.substring(0, 50)}... (dim: ${embedding.length})`);
    
    return embedding;
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const openai = this.getOpenAI();
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embeddings = response.data.map(item => item.embedding);
    
    texts.forEach((text, idx) => {
      const cacheKey = text.toLowerCase().trim();
      this.embeddingCache.set(cacheKey, embeddings[idx]);
    });

    console.log(`[StrategicUnderstanding] Generated ${embeddings.length} embeddings in batch`);
    
    return embeddings;
  }

  async createEntity(
    understandingId: string, 
    entity: EntityExtractionResult,
    discoveredBy: 'user_input' | 'bmc_agent' | '5whys_agent' | 'porters_agent' | 'trends_agent' | 'system' = 'system'
  ): Promise<StrategicEntity> {
    const embedding = await this.generateEmbedding(entity.claim);

    const entityData: InsertStrategicEntity = {
      understandingId,
      type: entity.type as any,
      claim: entity.claim,
      confidence: entity.confidence,
      embedding: embedding as any,
      source: entity.source,
      evidence: entity.evidence || null,
      category: entity.category || null,
      subcategory: entity.subcategory || null,
      investmentAmount: entity.investmentAmount || null,
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: null,
    };

    const inserted = await db
      .insert(strategicEntities)
      .values(entityData)
      .returning();

    return inserted[0];
  }

  async createRelationship(
    fromEntityId: string,
    toEntityId: string,
    relationshipType: string,
    confidence: "high" | "medium" | "low",
    evidence?: string,
    discoveredBy: 'user_input' | 'bmc_agent' | '5whys_agent' | 'porters_agent' | 'trends_agent' | 'system' = 'system',
    metadata?: any
  ): Promise<StrategicRelationship> {
    const relationshipData: InsertStrategicRelationship = {
      fromEntityId,
      toEntityId,
      relationshipType: relationshipType as any,
      confidence,
      evidence: evidence || null,
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: metadata || null,
    };

    const inserted = await db
      .insert(strategicRelationships)
      .values(relationshipData)
      .returning();

    return inserted[0];
  }

  async getEntitiesByUnderstanding(understandingId: string): Promise<StrategicEntity[]> {
    return await db
      .select()
      .from(strategicEntities)
      .where(eq(strategicEntities.understandingId, understandingId))
      .orderBy(desc(strategicEntities.discoveredAt));
  }

  async getRelationshipsByEntity(entityId: string): Promise<StrategicRelationship[]> {
    return await db
      .select()
      .from(strategicRelationships)
      .where(
        sql`${strategicRelationships.fromEntityId} = ${entityId} OR ${strategicRelationships.toEntityId} = ${entityId}`
      )
      .orderBy(desc(strategicRelationships.discoveredAt));
  }
}

export const strategicUnderstandingService = new StrategicUnderstandingService();
