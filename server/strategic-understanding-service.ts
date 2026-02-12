import OpenAI from "openai";
import { z } from "zod";
import { dbConnectionManager } from "./db-connection-manager";
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
import { 
  getStrategicUnderstandingBySession, 
  saveStrategicUnderstanding,
  getStrategicEntitiesByUnderstanding as getEntitiesSecure
} from "./services/secure-data-service";
import { encrypt, encryptJSON, decrypt, decryptJSON } from "./utils/encryption";
import { parseAIJson } from "./utils/parse-ai-json";

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
    // STEP 1: Check if understanding exists using secure service
    const existing = await getStrategicUnderstandingBySession(sessionId);

    if (existing) {
      return existing as StrategicUnderstanding;
    }

    // STEP 2: Generate title (LONG AI operation, NO database connection held)
    let title: string | null = null;
    try {
      const { generateTitle } = await import('./services/title-generator.js');
      title = await generateTitle(userInput);
    } catch (error) {
      console.warn('[StrategicUnderstanding] Failed to generate title:', error);
      // Fallback to truncated input
      title = userInput.substring(0, 60).trim() + (userInput.length > 60 ? '...' : '');
    }

    // STEP 3: Insert understanding using secure service (encrypts sensitive fields)
    const understanding = {
      sessionId,
      userInput,
      title,
      companyContext: companyContext || null,
      graphVersion: 1,
      lastEnrichedBy: null,
      lastEnrichedAt: null,
    };

    console.log('[StrategicUnderstanding] 🔐 Encrypting and saving Strategic Understanding...');
    const saved = await saveStrategicUnderstanding(understanding);
    console.log('[StrategicUnderstanding] ✓ Strategic Understanding saved with encryption');
    
    return saved as StrategicUnderstanding;
  }

  async extractUnderstanding(options: ExtractUnderstandingOptions): Promise<{ understandingId: string; entities: EntityExtractionResult[] }> {
    const { sessionId, userInput, companyContext } = options;
    
    // Get or create the strategic understanding record
    const understanding = await this.getOrCreateUnderstanding(sessionId, userInput, companyContext);

    const systemPrompt = `You are a strategic insight extraction expert. Your ONLY job is to extract verifiable insights from user input. Return ONLY valid JSON (no markdown, no explanation).

CRITICAL JSON FORMATTING RULES:
- ALL string values must have quotes properly escaped (use \\" for quotes inside strings)
- Return ONLY valid, parseable JSON
- Do not include any text outside the JSON object

CRITICAL GROUNDING RULES:
1. EXPLICIT entities: User DIRECTLY stated them - require exact quote in source field
2. IMPLICIT entities: Direct logical implications with clear reasoning chain
3. INFERRED entities: Exploratory reasoning (mark as low confidence)
4. NEVER invent facts not grounded in the input
5. Source field MUST contain actual text from input (exact substring match required)
6. If source text contains quotes, escape them properly in JSON`;

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

    // Retry logic: AI calls can fail intermittently
    let validated;
    let lastError: Error | null = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[StrategicUnderstanding] AI extraction attempt ${attempt}/${maxRetries}...`);
        
        const response = await aiClients.callWithFallback({
          systemPrompt,
          userMessage,
          maxTokens: 3000,
        }, "anthropic");

        let parsed;
        
        try {
          // Step 1: Parse JSON from AI response
          parsed = parseAIJson(response.content, 'entity extraction');
          console.log('[StrategicUnderstanding] ✓ JSON parsed successfully');
        } catch (parseError: any) {
          console.error('[StrategicUnderstanding] JSON parsing failed:', parseError);
          console.error('[StrategicUnderstanding] Raw AI response (first 500 chars):', response.content.substring(0, 500));
          throw new Error(`AI returned invalid JSON format. Please try again.`);
        }
        
        try {
          // Step 2: Validate against schema
          validated = entityExtractionSchema.parse(parsed);
          console.log('[StrategicUnderstanding] ✓ Schema validation passed');
          break; // Success! Exit retry loop
        } catch (validationError: any) {
          console.error('[StrategicUnderstanding] Schema validation failed:', validationError);
          console.error('[StrategicUnderstanding] Parsed JSON:', JSON.stringify(parsed, null, 2).substring(0, 1000));
          
          // Extract Zod error details if available
          if (validationError.errors) {
            const issues = validationError.errors.map((e: any) => 
              `${e.path.join('.')}: ${e.message}`
            ).join('; ');
            throw new Error(`AI response structure is invalid: ${issues}`);
          }
          throw new Error(`AI response structure is invalid. Please try again.`);
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[StrategicUnderstanding] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // 1s, 2s backoff
          console.log(`[StrategicUnderstanding] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, throw user-friendly error
    if (!validated) {
      console.error('[StrategicUnderstanding] All retry attempts exhausted');
      throw new Error(
        `Unable to process your input after ${maxRetries} attempts. ` +
        `This is usually temporary - please try again in a moment. ` +
        `If the issue persists, try rephrasing your input.`
      );
    }

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

    // Generate embeddings in batch — gracefully skip if unavailable
    const claims = validEntities.map(e => e.claim);
    let embeddings: (number[] | null)[] = claims.map(() => null);
    try {
      const generated = await this.generateEmbeddingsBatch(claims);
      // Validate dimensions match the database column (1536)
      if (generated.length > 0 && generated[0].length === EMBEDDING_DIMENSIONS) {
        embeddings = generated;
      } else if (generated.length > 0) {
        console.warn(`[StrategicUnderstanding] Embedding dimension mismatch: got ${generated[0].length}, expected ${EMBEDDING_DIMENSIONS}. Skipping embeddings.`);
      }
    } catch (embeddingError: any) {
      console.warn(`[StrategicUnderstanding] Embedding generation failed (non-blocking): ${embeddingError.message}`);
    }

    // Prepare all entity data with encryption for sensitive fields
    const entitiesData: InsertStrategicEntity[] = validEntities.map((entity, i) => ({
      understandingId: understanding.id,
      type: entity.type as any,
      claim: encrypt(entity.claim)!, // 🔐 Encrypted
      confidence: entity.confidence,
      embedding: embeddings[i] as any,
      source: encrypt(entity.source)!, // 🔐 Encrypted
      evidence: entity.evidence ? encrypt(entity.evidence) : null, // 🔐 Encrypted if present
      category: entity.category ? encrypt(entity.category) : null, // 🔐 Encrypted if present
      subcategory: entity.subcategory ? encrypt(entity.subcategory) : null, // 🔐 Encrypted if present
      investmentAmount: entity.investmentAmount || null,
      discoveredBy: 'user_input' as any,
      validFrom: new Date(),
      validTo: null,
      metadata: null, // 🔐 Would be encrypted if present
    }));
    
    // Persist all entities with retry (handles connection timeouts)
    const persistedEntities = await dbConnectionManager.retryWithBackoff(async (db) => {
      const inserted: StrategicEntity[] = [];
      for (const entityData of entitiesData) {
        const result = await db
          .insert(strategicEntities)
          .values(entityData)
          .returning();
        inserted.push(result[0]);
      }
      return inserted;
    });
    
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
    let embedding: number[] | null = null;
    try {
      const generated = await this.generateEmbedding(entity.claim);
      embedding = generated.length === EMBEDDING_DIMENSIONS ? generated : null;
      if (!embedding && generated.length > 0) {
        console.warn(`[StrategicUnderstanding] Embedding dimension mismatch: got ${generated.length}, expected ${EMBEDDING_DIMENSIONS}`);
      }
    } catch (embeddingError: any) {
      console.warn(`[StrategicUnderstanding] Embedding generation failed (non-blocking): ${embeddingError.message}`);
    }

    // Encrypt sensitive fields before inserting
    const entityData: InsertStrategicEntity = {
      understandingId,
      type: entity.type as any,
      claim: encrypt(entity.claim)!, // 🔐 Encrypted
      confidence: entity.confidence,
      embedding: embedding as any,
      source: encrypt(entity.source)!, // 🔐 Encrypted
      evidence: entity.evidence ? encrypt(entity.evidence) : null, // 🔐 Encrypted if present
      category: entity.category ? encrypt(entity.category) : null, // 🔐 Encrypted if present
      subcategory: entity.subcategory ? encrypt(entity.subcategory) : null, // 🔐 Encrypted if present
      investmentAmount: entity.investmentAmount || null,
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: null, // 🔐 Would be encrypted if present
    };

    // Use retryWithBackoff since this is often called after long operations
    return await dbConnectionManager.retryWithBackoff(async (db) => {
      const inserted = await db
        .insert(strategicEntities)
        .values(entityData)
        .returning();

      // Decrypt before returning (callers expect plaintext)
      const record = inserted[0];
      return {
        ...record,
        claim: decrypt(record.claim) || record.claim,
        source: decrypt(record.source) || record.source,
        evidence: record.evidence ? decrypt(record.evidence) || record.evidence : null,
        category: record.category ? decrypt(record.category) || record.category : null,
        subcategory: record.subcategory ? decrypt(record.subcategory) || record.subcategory : null,
        metadata: record.metadata ? decryptJSON(record.metadata) || record.metadata : null,
      };
    });
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
    // Encrypt sensitive fields before inserting
    const relationshipData: InsertStrategicRelationship = {
      fromEntityId,
      toEntityId,
      relationshipType: relationshipType as any,
      confidence,
      evidence: evidence ? encrypt(evidence) : null, // 🔐 Encrypted if present
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: metadata ? encryptJSON(metadata) : null, // 🔐 Encrypted if present
    };

    // Use retryWithBackoff since this is often called after long operations
    return await dbConnectionManager.retryWithBackoff(async (db) => {
      const inserted = await db
        .insert(strategicRelationships)
        .values(relationshipData)
        .returning();

      // Decrypt before returning
      return {
        ...inserted[0],
        evidence: inserted[0].evidence ? decrypt(inserted[0].evidence) || inserted[0].evidence : null,
        metadata: inserted[0].metadata ? decryptJSON(inserted[0].metadata) || inserted[0].metadata : null,
      };
    });
  }

  /**
   * Create entity with pre-generated embedding (for batch operations)
   * Uses provided db connection to avoid creating new connections
   */
  async createEntityWithEmbedding(
    db: any,
    understandingId: string,
    entity: EntityExtractionResult,
    embedding: number[],
    discoveredBy: 'user_input' | 'bmc_agent' | '5whys_agent' | 'porters_agent' | 'trends_agent' | 'system' = 'system'
  ): Promise<StrategicEntity> {
    // Validate embedding dimensions before insert
    const safeEmbedding = (embedding && embedding.length === EMBEDDING_DIMENSIONS) ? embedding : null;
    if (!safeEmbedding && embedding?.length) {
      console.warn(`[StrategicUnderstanding] Skipping embedding: got ${embedding.length} dims, expected ${EMBEDDING_DIMENSIONS}`);
    }
    // Encrypt sensitive fields before inserting
    const entityData: InsertStrategicEntity = {
      understandingId,
      type: entity.type as any,
      claim: encrypt(entity.claim)!, // 🔐 Encrypted
      confidence: entity.confidence,
      embedding: safeEmbedding as any,
      source: encrypt(entity.source)!, // 🔐 Encrypted
      evidence: entity.evidence ? encrypt(entity.evidence) : null, // 🔐 Encrypted if present
      category: entity.category ? encrypt(entity.category) : null, // 🔐 Encrypted if present
      subcategory: entity.subcategory ? encrypt(entity.subcategory) : null, // 🔐 Encrypted if present
      investmentAmount: entity.investmentAmount || null,
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: null, // 🔐 Would be encrypted if present
    };

    const inserted = await db
      .insert(strategicEntities)
      .values(entityData)
      .returning();

    // Decrypt before returning (callers expect plaintext)
    const record = inserted[0];
    return {
      ...record,
      claim: decrypt(record.claim) || record.claim,
      source: decrypt(record.source) || record.source,
      evidence: record.evidence ? decrypt(record.evidence) || record.evidence : null,
      category: record.category ? decrypt(record.category) || record.category : null,
      subcategory: record.subcategory ? decrypt(record.subcategory) || record.subcategory : null,
      metadata: record.metadata ? decryptJSON(record.metadata) || record.metadata : null,
    };
  }

  /**
   * Create relationship directly with provided db connection (for batch operations)
   */
  async createRelationshipDirect(
    db: any,
    fromEntityId: string,
    toEntityId: string,
    relationshipType: string,
    confidence: "high" | "medium" | "low",
    evidence?: string,
    discoveredBy: 'user_input' | 'bmc_agent' | '5whys_agent' | 'porters_agent' | 'trends_agent' | 'system' = 'system',
    metadata?: any
  ): Promise<StrategicRelationship> {
    // Encrypt sensitive fields before inserting
    const relationshipData: InsertStrategicRelationship = {
      fromEntityId,
      toEntityId,
      relationshipType: relationshipType as any,
      confidence,
      evidence: evidence ? encrypt(evidence) : null, // 🔐 Encrypted if present
      discoveredBy: discoveredBy as any,
      validFrom: new Date(),
      validTo: null,
      metadata: metadata ? encryptJSON(metadata) : null, // 🔐 Encrypted if present
    };

    const inserted = await db
      .insert(strategicRelationships)
      .values(relationshipData)
      .returning();

    // Decrypt before returning (callers expect plaintext)
    const record = inserted[0];
    return {
      ...record,
      evidence: record.evidence ? decrypt(record.evidence) || record.evidence : null,
      metadata: record.metadata ? decryptJSON(record.metadata) || record.metadata : null,
    };
  }

  async getEntitiesByUnderstanding(understandingId: string): Promise<StrategicEntity[]> {
    // Use secure service to automatically decrypt entities
    const entities = await getEntitiesSecure(understandingId);
    
    // Sort by discoveredAt descending (same as original behavior)
    return entities.sort((a, b) => {
      const aTime = a.discoveredAt?.getTime() || 0;
      const bTime = b.discoveredAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getRelationshipsByEntity(entityId: string): Promise<StrategicRelationship[]> {
    // Use fresh connection for read operations after long gaps
    return await dbConnectionManager.withFreshConnection(async (db) => {
      return await db
        .select()
        .from(strategicRelationships)
        .where(
          sql`${strategicRelationships.fromEntityId} = ${entityId} OR ${strategicRelationships.toEntityId} = ${entityId}`
        )
        .orderBy(desc(strategicRelationships.discoveredAt));
    });
  }
}

export const strategicUnderstandingService = new StrategicUnderstandingService();
