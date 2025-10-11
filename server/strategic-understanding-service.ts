import OpenAI from "openai";
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

  async createEntity(understandingId: string, entity: EntityExtractionResult): Promise<StrategicEntity> {
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
      discoveredBy: "system",
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
    evidence?: string
  ): Promise<StrategicRelationship> {
    const relationshipData: InsertStrategicRelationship = {
      fromEntityId,
      toEntityId,
      relationshipType: relationshipType as any,
      confidence,
      evidence: evidence || null,
      discoveredBy: "system",
      validFrom: new Date(),
      validTo: null,
      metadata: null,
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
